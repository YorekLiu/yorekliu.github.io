---
title: "微信APM Matrix解析"
---

前段时间终于看完了张绍文老师的《Android开发高手课》，在里面受益良多。而在文章中也一直提到Matrix这个项目，所以最近有空研读Matrix的源码，然后对比了我厂对应模块的APM实现，发现大致逻辑都是一样的。所以Matrix里面的代码，经过少数二次加工就可以上线了，不用重复造轮子，含金量还是极大的。

刚下载完Matrix Android部分的代码，module比较多。一时不知道如何下手，博主这里按照sample中的顺序分为下面几个部分，每个部分的实现可能会涉及到多个module：

- **Trace Canary**
    - **FrameTracer**  
    帧率监控模块
    - **EvilMethodTracer**  
    慢方法监控模块
    - **AnrTracer**  
    ANR监控模块
    - **StartUpTracer**  
    启动耗时  

- **I/O Canary**  
    检测文件I/O的4类问题，包括：文件I/O监控（主线程I/O、重复读、buffer过小）和Closeable Leak监控
- **SQLite Lint**  
    按官方最佳实践自动化检测 SQLite 语句的使用质量
- **Resource Canary**  
    基于 WeakReference 的特性和 Square Haha 库开发的 Activity 泄漏和 Bitmap 重复创建检测工具


各个部分的主要作用如上所示，下面对每个模块进行一个预热的小结，有助于读者可以高屋建瓴地了解Matrix全貌，然后逐个突破。

除此之外，还是建议大家看看matrix上的文档，细看之下，也有不少收获。**看源码只知道做了什么，看配套wiki可以知道为什么怎么做。**

- [Matrix for Android](https://github.com/Tencent/matrix#matrix_android_cn)
- [Matrix Wiki](https://github.com/Tencent/matrix/wiki)

## 1. Trace Canary

!!! tip "Wiki"  
    [Matrix Wiki - TraceCanary](https://github.com/Tencent/matrix/wiki/Matrix-Android-TraceCanary)

TraceCanary分为帧率监控、慢方法监控、ANR监控以及启动耗时这4个功能。  
那么，为什么这些功能会统一在Trace模块下呢，这是因为分析卡顿、分析慢方法以及ANR具体发生在哪个位置，耗时如何，确实是需要插桩去trace每个函数的调用的。

如上面的Wiki所述，插桩方案确实比MessageQueue方案、Choreographer方案更优，**可以准确的获取各个函数的执行耗时，还可以准确的获取当前执行的堆栈信息**。  
关于MessageQueue方案与插桩方案的讨论，《Android开发高手课》中也说到了：[卡顿优化的监控](/android/paid/master/stuck_2/#_1)

插桩打点操作的类就是`AppMethodBeat`，该类会在编译期对函数的出入进行插桩`i(methodId)/o(methodId)`，并在`Activity#onWindowFocusChanged`方法中插入`at`方法，供后面各种tracer使用。插桩的核心代码在插件中的`MethodTracer`。

插桩之外，我们还需要监控主线程MessageQueue(`LooperMonitor`)以及Choreographer(`UIThreadMonitor`)，从里面抽象出一个可以通知Message开始执行、执行完成、Choreographer开始渲染的接口(`LooperObserver`)。基于这个接口，我们可以开始监控的实现。

### 1. 帧率监控FrameTracer

在`UIThreadMonitor`中会通过`LooperMonitor`监听所有主线程的Message的执行，同时会向`Choreographer#callbackQueues`中插入一个回调来监听`CALLBACK_INPUT`、`CALLBACK_ANIMATION`、`CALLBACK_TRAVERSAL`这三种事务的执行耗时。  

这样当`Choreographer#FrameHandler`开始执行的vsync时，`UIThreadMonitor`就可以捕获到vsync执行的起止时间，以及doFrame时各个部分的耗时。然后可以通过一系列计算来计算出帧率。实际上，只需要知道渲染每一帧的起止时间就可以算出帧率了。

### 2. 慢函数监控EvilMethodTracer

通过监控主线程中每个Message执行的起止时间，如果时间差超过一定的阈值，就认为发生了慢函数调用。此时可以通过`AppMethodBeat`中的数据，分析出这段时间内函数执行的堆栈信息，以及每个函数执行的耗时。这样，慢函数无所遁形了。

### 3. ANR监控AnrTracer

ANR的监控更加简单了，在主线程中一般认为超过5s就会发生ANR。所以在Message开始执行时，抛出一个5s后爆炸的炸弹，在Message执行完毕之后remove。若这颗炸弹最终还是爆炸了，那就说明发生了ANR。此时还是通过分析`AppMethodBeat`中的数据得到函数执行的堆栈以及耗时。

### 4. 启动耗时StartUpTracer

启动耗时我们先要hook一下`ActivityThread.mH.mCallback`，获取`handleMessage`执行的Message，然后在`AppMethodBeat`的帮助下也很简单。

`AppMethodBeat.i`第一次发生时，可以认为是Application创建的时间(t0)；第一次Activity的启动或者Service、Receiver的创建认为是Application创建的结束时间(t1)。这两者的时间差即为Application创建耗时。  
第一个Activity的`onWindowFocusChange`发生时，即为时间t2，t2-t0就是首屏启动耗时。  
第二个Activity（一般是真正的MainActivity）的`onWindowFocusChange`发生时，即为时间t3，t3-t0就是冷启动的总耗时。  

```
 firstMethod.i       LAUNCH_ACTIVITY   onWindowFocusChange   LAUNCH_ACTIVITY    onWindowFocusChange
 ^                         ^                   ^                     ^                  ^
 |                         |                   |                     |                  |
 t0                        t1                  t2                                       t3
 |---------app---------|---|---firstActivity---|---------...---------|---careActivity---|
 |<--applicationCost-->|
 |<--------------firstScreenCost-------------->|
 |<---------------------------------------coldCost------------------------------------->|
 .                         |<-----warmCost---->|
```

真正的源码分析请移步：[Matrix-TraceCanary解析](/android/3rd-library/matrix-trace)

> 通过`UIThreadMonitor`还可以写出更多好玩的东西，比如后台渲染的检测，获取引发后台渲染的堆栈信息还是可以通过`AppMethodBeat`来实行。

## 2. I/O Canary

!!! tip "Wiki"  
    [Matrix Wiki - IOCanary](https://github.com/Tencent/matrix/wiki/Matrix-Android-IOCanary)

IOCanary分为四个检测场景：**主线程I/O、读写Buffer过小、重复读、Closeable泄漏监控**。关于I/O监控的相关内容可以查看[如何监控线上I/O操作](/android/paid/master/io_3/#_1)以及上面matrix wiki中的相关部分。

上面四个场景中，前面三个可以采用native hook的方式收集I/O信息，在`close`操作时计算并上报。后者可以借`StrictMode`的东风，这是Android系统底层自带的监控，通过简单的hook可以将`CloseGuard#reporter`替换成自己的实现，然后在其`report`函数中完成上报即可。

真正的源码分析请移步：[Matrix-IOCanary解析](/android/3rd-library/matrix-io)

## 3. Resource Canary

TODO

## 4. SQLite Lint

TODO