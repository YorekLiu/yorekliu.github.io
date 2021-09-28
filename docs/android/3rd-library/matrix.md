---
title: "微信APM Matrix解析"
---

!!! tip "Matrix"
    Matrix系列文章在赏析全部源码完毕之后才开始写，写得也比较慢，在写的过程中Matrix版本号由0.6.5版本变成了现在的2.0.0版本。  
    此版本新增了一些模块，也修复了之前的一些问题。但原来写好的文章全部更新一下比较费时，因此新更新的文章内容若是2.0.0版本新增的，会加上对应的版本号以示区别。

前段时间终于看完了张绍文老师的《Android开发高手课》，在里面受益良多。而在文章中也一直提到Matrix这个项目，所以最近有空研读Matrix的源码，然后对比了我厂对应模块的APM实现，发现大致逻辑都是一样的。所以Matrix里面的代码，经过少数二次加工就可以上线了，不用重复造轮子，含金量还是极大的。

刚下载完Matrix Android部分的代码，module比较多。一时不知道如何下手，博主这里按照sample中的顺序分为下面几个部分，每个部分的实现可能会涉及到多个module：

- **Trace Canary**
    - **FrameTracer**  
    帧率监控模块
    - **EvilMethodTracer**  
    慢方法监控模块
    - **LooperAnrTracer**  
    依赖于消息机制的ANR监控模块
    - **SignalAnrTracer**  
    依赖于SIGQUIT信号的ANR监控模块
    - **StartUpTracer**  
    启动耗时模块
    - **ThreadPriorityTracer**  
    检测主线程的优先级的改变，以及设置的timerslack_ns超过50000的情况  
    - **IdleHandlerLagTracer**  
    检查IdleHandler的执行时间，若超过2000ms则上报

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
    [Matrix - TraceCanary](https://github.com/Tencent/matrix/wiki/Matrix-Android-TraceCanary)

TraceCanary分为帧率监控、慢方法监控、ANR监控、启动耗时、主线程优先级检测、IdleHandler耗时检测这6个功能。  
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

### 3. ANR监控LooperAnrTracer

ANR的监控更加简单了，在主线程中一般认为超过5s就会发生ANR。所以在Message开始执行时，抛出一个5s后爆炸的炸弹，在Message执行完毕之后remove。若这颗炸弹最终还是爆炸了，那就说明发生了ANR。此时还是通过分析`AppMethodBeat`中的数据得到函数执行的堆栈以及耗时。

在2.0.0版本还新增了Message执行耗时超过2s的监控，实现原理和ANR一样。

### 4. ANR监控SignalAnrTracer

*2.0.0版本添加*

Android在发生ANR时会发送出SIGQUIT信号，我们可以利用Linux的信号捕捉机制捕捉SIGQUIT信号。  

信号捕捉机制在实现上可以分为三步：

1. 通过`int sigaltstack(const stack_t* __new_signal_stack, stack_t* __old_signal_stack);`方法设置额外的栈空间。当遇到栈溢出时，就会使用这段栈空间，避免了signal handler无法正常运行
2. 通过`int sigaction(int __signal, const struct sigaction* __new_action, struct sigaction* __old_action);`为对应的信号设置信号捕获函数，这样当信号发生时就会调用到我们设定的函数
3. 使用`int pthread_sigmask(int __how, const sigset_t* __new_set, sigset_t* __old_set);` SIG_UNBLOCK SIGQUIT信号，这样signal handler才能处理SIGQUIT信号

当捕获到SIGQUIT信号时，我们使用爱奇艺的xHook框架根据版本号hook ANR日志的打开以及写入，将写入原文件的内容复制一份到我们自己的日志文件，并调用原函数写入原ANR日志文件。最后调用原始的信号处理函数，完成整个流程的闭环。

BTW，信号捕获机制在捕获Native代码的崩溃上也有使用，详见Bugly出品的[Android 平台 Native 代码的崩溃捕获机制及实现](https://mp.weixin.qq.com/s/g-WzYF3wWAljok1XjPoo7w?)。


### 5. 启动耗时StartUpTracer

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

源码分析请移步：[Matrix-TraceCanary解析](/android/3rd-library/matrix-trace)

> 通过`UIThreadMonitor`还可以写出更多好玩的东西，比如后台渲染的检测，获取引发后台渲染的堆栈信息还是可以通过`AppMethodBeat`来实行。

### 6. ThreadPriorityTracer

*2.0.0版本添加*

监控主线程的优先级更改以及timerslack_ns的更改。前者有变动就进行上报，后者超过了默认值50000就进行上报。 

原理就是通过xhook hook所有so的`setpriority`函数和`prctl`函数，在里面进行判断。

### 7. IdleHandlerLagTracer

*2.0.0版本添加*

顾名思义，此Tracer就是监控IdleHandler任务执行耗时卡顿的情况。  

具体实现如下：

1. 通过反射获取 `MessageQueue.mIdleHandlers` 这个List，并这个List替换成自己的List实现。
2. 当List的add、remove方法调用时，将传入的IdleHandler包装为自己的IdleHandler传入。
3. 当IdleHandler执行的时候，调用原始IdleHandler的方法进行执行，执行前后postDelay、remove一个Runnable。这样当IdleHandler执行超时时，就会触发Runnable，在这里面可以进行分析上报。

## 2. I/O Canary

!!! tip "Wiki"  
    [Matrix - IOCanary](https://github.com/Tencent/matrix/wiki/Matrix-Android-IOCanary)

IOCanary分为四个检测场景：**主线程I/O、读写Buffer过小、重复读、Closeable泄漏监控**。关于I/O监控的相关内容可以查看[如何监控线上I/O操作](/android/paid/master/io_3/#_1)以及上面matrix wiki中的相关部分。

上面四个场景中，前面三个可以采用native hook的方式收集I/O信息，在`close`操作时计算并上报。后者可以借`StrictMode`的东风，这是Android系统底层自带的监控，通过简单的hook可以将`CloseGuard#reporter`替换成自己的实现，然后在其`report`函数中完成上报即可。

源码分析请移步：[Matrix-IOCanary解析](/android/3rd-library/matrix-io)

## 3. Resource Canary

!!! tip "Wiki"  
    [Matrix - ResourceCanary](https://github.com/Tencent/matrix/wiki/Matrix-Android-ResourceCanary)  
    [Matrix - ApkChecker](https://github.com/Tencent/matrix/wiki/Matrix-Android-ApkChecker)  

Resource Canary包含常见的内存泄漏监控、重复创建的冗余的Bitmap监控等；还包括了Activity泄漏的兜底方案`ActivityLeakFixer`。该方案会包含了输入法导致的泄露的hook fix以及泄漏后回收所有View。当然，后者并不是重点。

内存泄漏引用链的检测与重复Bitmap检测都需要通过分析dump出的hprof文件，因此 **什么时机dump** 是一个好问题。这里Matrix在原有LeakCanary实现的基础上进行了一些优化，详见[细节与改进 - 减少误报](https://github.com/Tencent/matrix/wiki/Matrix-Android-ResourceCanary#%E5%87%8F%E5%B0%91%E8%AF%AF%E6%8A%A5)，具体体现如下：

- 增加一个一定能被回收的“哨兵”对象，用来确认系统确实进行了GC
- 直接通过WeakReference.get()来判断对象是否已被回收，避免因延迟导致误判
- 若发现某个Activity无法被回收，再重复判断3次，且要求从该Activity被记录起有2个以上的Activity被创建才认为是泄漏，以防在判断时该Activity被局部变量持有导致误判
- 对已判断为泄漏的Activity，记录其类名，避免重复提示该Activity已泄漏

因为dump出的hprof文件通常比较大，因此直接拿原始文件进行上报，一方面会消耗大量带宽资源，另一方面服务端将Hprof文件长期存档时也会占用服务器的存储空间。这是不可取的，因此我们需要 **裁剪Hprof**。裁剪的算法有那么几种，使用爱奇艺native hook框架xHook的实现的美团的Probe（需要裁掉的部分直接不写入到hprof中）以及Java实现的裁剪（生成后再裁剪，例如LeakCanary）等。  
裁剪的数据也类似，以Matrix中为例，Matrix只保留了“部分字符串数据和Bitmap的buffer数组”，其他的字符串数据以及所有的数组都可以直接剔除。prof文件中buffer区存放了所有对象的数据，包括字符串数据、所有的数组等，而我们的分析过程却只需要用到部分字符串数据和Bitmap的buffer数组，其余的buffer数据都可以直接剔除，这样处理之后的Hprof文件通常能比原始文件小1/10以上。——[细节与改进 - 裁剪Hprof](https://github.com/Tencent/matrix/wiki/Matrix-Android-ResourceCanary#%E8%A3%81%E5%89%AAhprof)

拿到客户端上报的裁剪后的Hprof文件后，服务端可以对文件进行后续的内存泄漏检测以及 **重复Bitmap检测**，这里说说后者。  
> 这个功能Android Monitor已经有完整实现了，原理简单粗暴——把所有未被回收的Bitmap的数据buffer取出来，然后先对比所有长度为1的buffer，找出相同的，记录所属的Bitmap对象；再对比所有长度为2的、长度为3的buffer……直到把所有buffer都比对完，这样就记录下了所有冗余的Bitmap对象了，接着再套用LeakCanary获取引用链的逻辑把这些Bitmap对象到GC Root的最短强引用链找出来即可。  
> 这部分代码位于matrix-resource-canary-analyzer中，可以部署到服务端。

Resource Canary中除了上面功能之外，还有一个`matrix-apk-canary`的jar包，此工具可以针对apk文件进行分析检测。此jar包功能强大，详细说明如链接[Matrix-Android-ApkChecker](https://github.com/Tencent/matrix/wiki/Matrix-Android-ApkChecker)。

最后，Resource Canary还提供了一个重要的功能：**自动移除没有用到的资源**。在第一节Trace Canary中，我们说到了插桩，这里插桩是通过Gradle Plugin + ASM实现的。在该Plugin中还有另外一个Task：`RemoveUnusedResourcesTask`。  
这里所谓的UnusedResources是依靠于上面的ApkChecker中检测。`RemoveUnusedResourcesTask`将原app包zip格式读取到内存，然后过滤掉不需要的res/文件，并同样过滤处理resources.arsc文件，完毕将shrink后的app写回磁盘中。并进行签名，同步修改R.txt文件等。

源码分析请移步：[Matrix-ResourceCanary解析](/android/3rd-library/matrix-resource)

## 4. SQLite Lint

!!! tip "Wiki"  
    [Matrix - SQLiteLint](https://github.com/Tencent/matrix/wiki/Matrix-Android-SQLiteLint)  

SQLiteLint的作用在于在上线前就进行SQLite使用质量的检测，运用一些 **最佳实践的规则** 来在App运行时对SQL语句、执行序列、表信息等进行分析检测，从而发现潜在的、可疑的SQLite使用问题。

检测流程如下：

1. 收集APP运行时的sql执行信息
    包括执行语句、创建的表信息等。其中表相关信息可以通过pragma命令得到。对于执行语句，有两种情况：  
    1. DB框架提供了回调接口。比如微信使用的是WCDB，很容易就可以通过MMDataBase.setSQLiteTrace 注册回调拿到这些信息。  
    2. 若使用Android默认的DB框架，SQLiteLint提供了一种无侵入的获取到执行的sql语句及耗时等信息的方式。通过hook的技巧，向SQLite3 C层的api `sqlite3_profile`方法注册回调，也能拿到分析所需的信息，从而无需开发者额外的打点统计代码。
2. 预处理  
    包括生成对应的sql语法树，生成不带实参的sql，判断是否select*语句等，为后面的分析做准备。预处理和后面的算法调度都在一个单独的处理线程。
3. 调度具体检测算法执行  
    checker就是各种检测算法，也支持扩展。并且检测算法都是以C++实现，方便支持多平台。而调度的时机包括：最近未分析sql语句调度，抽样调度，初始化调度，每条sql语句调度。
4. 发布问题  
    上报问题或者弹框提示。  

这里的问题有几个：  
1. 第一是执行过程的第一点，**如何获取到执行的sql语句以及耗时**，上面也提到了，对于Android默认的DB框架，matrix采取了Java hook打开开关的方式，这在Android 10及以上就不能生效了。所以，可以考虑native hook，做好适配。  
2. 第二个问题，**预处理** 阶段，这里使用了SQLite里面的lemon库解析原始的sql语句。[The Lemon Parser Generator](https://sqlite.org/src/doc/trunk/doc/lemon.html)。  
3. 第三个问题，根据 **最佳实践规则** 整理出来的检查算法有哪些？  

 | 检测算法 | 功能 | 调度时机 | 简要原理 |  
 | ------- | --- | ------- | ------ |  
 | explain_query_plan_checker | 检测索引使用的问题 | 最近未分析sql语句调度（kUncheckedSql） | 执行`explain query plan ${sql}`，建立分析树并结合sql语法的语法树，进行检测分析 |  
 | avoid_select_all_checker | 检测select * 问题 | 最近未分析sql语句调度（kUncheckedSql） | 预处理阶段判断有没有*，检测时读取对应字段即可 |  
 | without_rowid_better_checker | 检测建议使用without rowid特性 | 初始化调度（kAfterInit） | 通过`select name, sql from sqlite_master where type='table'`拿到创建表的sql语句（without rowid）；通过`PRAGMA table_info($tablename$)`拿到表的column属性。结合一定的规则进行判断 |  
 | avoid_auto_increment_checker | 检测Autoincrement问题 | 初始化调度（kAfterInit） | 在创建表的语句中判断有没有关键词autoincrement即可 |  
 | prepared_statement_better_checker | 检测建议使用prepared statement | 采样，每30条SQL时执行（kSample） | 分析历史SQL队列，判断同一个表达式执行在指定间隔时间内执行的次数超没超过指定的间隔次数 |  
 | redundant_index_checker | 检测冗余索引问题 | 最近未分析sql语句调度（kUncheckedSql） | 通过`PRAGMA index_list(“$tablename$”)`拿到表的索引；通过`PRAGMA index_info($indexname$)`拿到索引的详细信息。检查冗余索引 |  

上面这些checker在官方WIKI上都有一些介绍，这里不在赘述了。  

下面是上面涉及到的SQL语法：

#### 4.1 SQLiteLint用到的SQL

1. `explain query plan ${sql}`  

    > explain query plan SELECT * FROM t_asset WHERE id=1;  
    > 
    > | id | parent | notused | detail |
    > | -- | ------ | ------- | ------ |
    > | 2  |  0     |  0      | SEARCH TABLE t_asset USING INTEGER PRIMARY KEY (rowid=?) |

2. `select name, sql from sqlite_master where type='table'`

    > select name, sql from sqlite_master where type='table'
    > 
    > | name | sql |
    > | -- | ------ |
    > | t_asset | CREATE TABLE "t_asset" (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, name TEXT NOT NULL, icon TEXT NOT NULL, currency TEXT NOT NULL, asset_category_id INTEGER NOT NULL, \`system\` INTEGER NOT NULL DEFAULT 1) |

3. `PRAGMA table_info($tablename$)`

    > PRAGMA table_info(t_asset)
    > 
    > | cid | name | type | notnull | dift_value | pk |
    > | -- | ------ | --- | ------- | ---------- | -- |
    > | 0 | id | INTEGER | 1 |  | 1 |
    > | 1 | name | TEXT | 1	|  | 0 |
    > | 2 | icon | TEXT | 1 |  | 0 |
    > | 3 | currency | TEXT | 1 |  | 0 |
    > | 4 | asset_category_id | INTEGER | 1 |  | 0 |
    > | 5 | system | INTEGER | 1 | 1 | 0 |

4. `PRAGMA index_list($tablename$)`

    > PRAGMA index_list(t_asset)
    > 
    > | seq | name | unique | origin | partial |
    > | -- | ------ | --- | ------- | ---------- |
    > | 0 | index_t | 0 | c | 0 |

5. `PRAGMA index_info($indexname$)`

    > PRAGMA index_info(index_t)
    > 
    > | seqno | cid | name |
    > | -- | ------ | --- |
    > | 0 | 4 | asset_category_id |

源码分析请移步：[Matrix-SQLiteLint解析](/android/3rd-library/matrix-sqlitelint)