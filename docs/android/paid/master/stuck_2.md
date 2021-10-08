---
title: "06 | 卡顿优化（下）：如何监控应用卡顿？"
---

!!! tip "极客时间——[Android开发高手课](https://time.geekbang.org/column/intro/142)"
    本栏目内容源于[Android开发高手课](https://time.geekbang.org/column/intro/142)，外加Sample的个人练习小结。本栏目内的内容将会持续混合着博主个人的收集到的知识点。若本栏目内容令人不适，请移步原始课程。  

### 卡顿监控

前面我讲过监控 ANR 的方法，不过也提到两个问题：一个是高版本的系统没有权限读取系统的 ANR 日志；另一个是 ANR 太依赖系统实现，我们无法灵活控制参数，例如我觉得主线程卡顿 3 秒用户已经不太能忍受，而默认参数只能监控至少 5 秒以上的卡顿。

所以现实情况就要求我们需要采用其他的方式来监控是否出现卡顿问题，并且针对特定场景还要监控其他特定的指标。

#### 1. 消息队列

我设计的第一套监控卡顿的方案是 **基于消息队列实现**，通过替换 Looper 的 Printer 实现。在 2013 年的时候，我写过一个名为 WxPerformanceTool 的性能监控工具，其中耗时监控就使用了这个方法。后面这个工具在腾讯公共组件做了内部开源，还获得了 2013 年的年度十佳组件。

![logger print](/assets/images/android/master/logger_printer.png)

还没庆祝完，很快就有同事跟我吐槽一个问题：线上开启了这个监控模块，快速滑动时平均帧率起码降低 5 帧。我通过 Traceview 一看，发现是因为上面图中所示的大量字符串拼接导致性能损耗严重。

后来很快又想到了另外一个方案，可以通过一个监控线程，每隔 1 秒向主线程消息队列的头部插入一条空消息。假设 1 秒后这个消息并没有被主线程消费掉，说明阻塞消息运行的时间在 0～1 秒之间。换句话说，如果我们需要监控 3 秒卡顿，那在第 4 次轮询中头部消息依然没有被消费的话，就可以确定主线程出现了一次 3 秒以上的卡顿。

![stuck_monitor_mq](/assets/images/android/master/stuck_monitor_mq.png)

这个方案也存在一定的误差，那就是发送空消息的间隔时间。但这个间隔时间也不能太小，因为监控线程和主线程处理空消息都会带来一些性能损耗，但基本影响不大。

???+ tip "两个方案"  
    这里是两种不同的方案。  
    1. 第一个方案利用Looper里面的printer在执行Message前后会通过这个对象打印出执行日志的机制，来获取一个Message执行的时长。从 Android 10 开始，Looper 里面提供了一个 sObserver 的静态变量可以用来观测 Message 的执行，这就可以避免字符串拼接带来的损耗了。  
    2. 第二个方法则是间隔一段时间来判断Message有没有被消费掉，从而得知正在执行的Message是否有卡顿的现象。

#### 2. 插桩

不过在使用了一段时间之后，我感觉还是有那么一点不爽。基于消息队列的卡顿监控并不准确，正在运行的函数有可能并不是真正耗时的函数。  

这是为什么呢？我画张图解释起来就清楚了。我们假设一个消息循环里面顺序执行了 A、B、C 三个函数，当整个消息执行超过 3 秒时，因为函数 A 和 B 已经执行完毕，我们只能得到的正在执行的函数 C 的堆栈，事实上它可能并不耗时。

![stuck_wrong_mq](/assets/images/android/master/stuck_wrong_mq.png)

**不过对于线上大数据来说，因为函数 A 和 B 相对比较耗时，所以抓取到它们的概率会更大一些，通过后台聚合后捕获到函数 A 和 B 的卡顿日志会更多一些。**

这也是我们线上目前依然使用基于消息队列的方法，但是肯定希望可以做到跟 Traceview 一样，可以拿到整个卡顿过程所有运行函数的耗时，就像下面图中的结果，可以明确知道其实函数 A 和 B 才是造成卡顿的主要原因。

![stuck_right](/assets/images/android/master/stuck_right.png)

既然这样，那我们能否直接利用 Android Runtime 函数调用的回调事件，做一个自定义的 Traceview++ 呢？  
答案是可以的，但是需要使用 Inline Hook 技术。我们可以实现类似 Nanoscope 先写内存的方案，但考虑到兼容性问题，这套方案并没有用到线上。  
对于大体量的应用，稳定性是第一考虑因素。那如果在编译过程插桩，兼容性问题肯定是 OK 的。上一讲讲到 systrace 可以通过插桩自动生成 Trace Tag，我们一样也可以在函数入口和出口加入耗时监控的代码，但是需要考虑的细节有很多。

- **避免方法数暴增**。在函数的入口和出口应该插入相同的函数，在编译时提前给代码中每个方法分配一个独立的 ID 作为参数。
- **过滤简单的函数**。过滤一些类似直接 return、i++ 这样的简单函数，并且支持黑名单配置。对一些调用非常频繁的函数，需要添加到黑名单中来降低整个方案对性能的损耗。
    ![](/assets/images/android/master/stuck_xxxx.png)

基于性能的考虑，线上只会监控主线程的耗时。微信的 Matrix 使用的就是这个方案，因为做了大量的优化，所以最终安装包体积只增大 1～2%，平均帧率下降也在 2 帧以内。虽然插桩方案对性能的影响总体还可以接受，但只会在灰度包使用。

插桩方案看起来美好，它也有自己的短板，那就是只能监控应用内自身的函数耗时，无法监控系统的函数调用，整个堆栈看起来好像“缺失了”一部分。

#### 3. Profilo

2018 年 3 月，Facebook 开源了一个叫[Profilo](https://github.com/facebookincubator/profilo)的库，它收集了各大方案的优点，令我眼前一亮。具体来说有以下几点：

**第一，集成 atrace 功能**。ftrace 所有性能埋点数据都会通过 trace_marker 文件写入内核缓冲区，Profilo 通过 PLT Hook 拦截了写入操作，选择部分关心的事件做分析。这样所有 systrace 的探针我们都可以拿到，例如四大组件生命周期、锁等待时间、类校验、GC 时间等。

**不过大部分的 atrace 事件都比较笼统，从事件“B|pid|activityStart”，我们并不知道具体是哪个 Activity 的创建**。同样我们可以统计 GC 相关事件的耗时，但是也不知道为什么发生了这次 GC。

![stuck_profilo](/assets/images/android/master/stuck_profilo.jpg)

**第二，快速获取 Java 堆栈。很多同学有一个误区，觉得在某个线程不断地获取主线程堆栈是不耗时的。但是事实上获取堆栈的代价是巨大的，它要暂停主线程的运行。**

Profilo 的实现非常精妙，它实现类似 Native 崩溃捕捉的方式快速获取 Java 堆栈，通过间隔发送 SIGPROF 信号，整个过程如下图所示。

![stuck_profilo_principle](/assets/images/android/master/stuck_profilo_principle.jpg)

Signal Handler 捕获到信号后，拿取到当前正在执行的 Thread，通过 Thread 对象可以获取当前线程的 ManagedStack，ManagedStack 是一个单链表，它保存了当前的 ShadowFrame 或者 QuickFrame 栈指针，先依次遍历 ManagedStack 链表，然后遍历其内部的 ShadowFrame 或者 QuickFrame 还原一个可读的调用栈，从而 unwind 出当前的 Java 堆栈。通过这种方式，可以实现线程一边继续跑步，我们还可以帮它做检查，而且耗时基本忽略不计。代码可以参照：[Profilo::unwind](https://github.com/facebookincubator/profilo/blob/master/cpp/profiler/unwindc/android_712/arm/unwinder.h)和[StackVisitor::WalkStack](http://androidxref.com/7.1.1_r6/xref/art/runtime/stack.cc#772)。

不用插桩、性能基本没有影响、捕捉信息还全，那 Profilo 不就是完美的化身吗？当然由于它利用了大量的黑科技，兼容性是需要注意的问题。它内部实现有大量函数的 Hook，unwind 也需要强依赖 Android Runtime 实现。Facebook 已经将 Profilo 投入到线上使用，但由于目前 Profilo 快速获取堆栈功能依然不支持 Android 8.0 和 Android 9.0，鉴于稳定性问题，建议采取抽样部分用户的方式来开启该功能。

**先小结一下，不管我们使用哪种卡顿监控方法，最后我们都可以得到卡顿时的堆栈和当时 CPU 运行的一些信息。大部分的卡顿问题都比较好定位，例如主线程执行一个耗时任务、读一个非常大的文件或者是执行网络请求等。**

### 其他监控

除了主线程的耗时过长之外，我们还有哪些卡顿问题需要关注呢？

Android Vitals 是 Google Play 官方的性能监控服务，涉及卡顿相关的监控有 ANR、启动、帧率三个。尤其是 ANR 监控，我们应该经常的来看看，主要是 Google 自己是有权限可以准确监控和上报 ANR。对于启动和帧率，Android Vitals 只是上报了应用的区间分布，但是不能归纳出问题。

这也是我们做性能优化时比较迷惑的一点，即使发现整体的帧率比过去降低了 5 帧，也并不知道是哪里造成的，还是要花很大的力气去做二次排查。

![stuck_vitals](/assets/images/android/master/stuck_vitals.png)

能不能做到跟崩溃、卡顿一样，直接给我一个堆栈，告诉我就是因为这里写的不好导致帧率下降了 5 帧。退一步说，如果做不到直接告诉我堆栈，能不能告诉我是因为聊天这个页面导致的帧率下降，让我缩小二次排查的范围。

#### 1. 帧率

业界都使用 Choreographer 来监控应用的帧率。跟卡顿不同的是，需要排除掉页面没有操作的情况，我们应该只在 **界面存在绘制** 的时候才做统计。

那么如何监听界面是否存在绘制行为呢？可以通过 addOnDrawListener 实现。

```java
getWindow().getDecorView().getViewTreeObserver().addOnDrawListener
```

我们经常用平均帧率来衡量界面流畅度，但事实上电影的帧率才 24 帧，用户对于应用的平均帧率是 40 帧还是 50 帧并不一定可以感受出来。对于用户来说，感觉最明显的是连续丢帧情况，Android Vitals 将连续丢帧超过 700 毫秒定义为冻帧，也就是连续丢帧 42 帧以上。

因此，我们可以统计更有价值的冻帧率。**冻帧率就是计算发生冻帧时间在所有时间的占比**。出现丢帧的时候，我们可以获取当前的页面信息、View 信息和操作路径上报后台，降低二次排查的难度。

正如下图一样，我们还可以按照 Activity、Fragment 或者某个操作定义场景，通过细化不同场景的平均帧率和冻帧率，进一步细化问题排查的范围。

![stuck_frame_frozen](/assets/images/android/master/stuck_frame_frozen.png)

#### 2. 生命周期监控

Activity、Service、Receiver 组件生命周期的耗时和调用次数也是我们重点关注的性能问题。例如 Activity 的 onCreate() 不应该超过 1 秒，不然会影响用户看到页面的时间。Service 和 Receiver 虽然是后台组件，不过它们生命周期也是占用主线程的，也是我们需要关注的问题。

对于组件生命周期我们应该采用更严格地监控，可以全量上报。在后台我们可以看到各个组件各个生命周期的启动时间和启动次数。

![stuck_lifecycle](/assets/images/android/master/stuck_lifecycle.png)

有一次我们发现有两个 Service 的启动次数是其他的 10 倍，经过排查发现是因为频繁的互相拉起导致。Receiver 也是这样，而且它们都需要经过 System Server。曾经有一个日志上报模块通过 Broadcast 来做跨进程通信，每秒发送几千次请求，导致系统 System Server 卡死。所以说每个组件各个生命周期的调用次数也是非常有参考价值的指标。

除了四大组件的生命周期，我们还需要监控各个进程生命周期的启动次数和耗时。通过下面的数据，我们可以看出某些进程是否频繁地拉起。

![stuck_process](/assets/images/android/master/stuck_process.png)

对于生命周期的监控实现，我们可以利用插件化技术 Hook 的方式。但是 Android P 之后，我还是不太推荐你使用这种方式。我更推荐使用编译时插桩的方式，**后面我会讲到 Aspect、ASM 和 ReDex 三种插桩技术的实现，敬请期待**。

#### 3. 线程监控

Java 线程管理是很多应用非常头痛的事情，应用启动过程就已经创建了几十上百个线程。而且大部分的线程都没有经过线程池管理，都在自由自在地狂奔着。

另外一方面某些线程优先级或者活跃度比较高，占用了过多的 CPU。这会降低主线程 UI 响应能力，我们需要特别针对这些线程做重点的优化。

对于 Java 线程，总的来说我会监控以下两点。

- 线程数量。需要监控线程数量的多少，以及创建线程的方式。例如有没有使用我们特有的线程池，这块可以通过 got hook 线程的 nativeCreate() 函数。主要用于进行线程收敛，也就是减少线程数量。

- 线程时间。监控线程的用户时间 utime、系统时间 stime 和优先级。主要是看哪些线程 utime+stime 时间比较多，占用了过多的 CPU。**正如上一期“每课一练”所提到的，可能有一些线程因为生命周期很短导致很难发现，这里我们需要结合线程创建监控**。

![stuck_thread](/assets/images/android/master/stuck_thread.png)

**看到这里可能有同学会比较困惑，卡顿优化的主题就是监控吗？导致卡顿的原因会有很多，比如函数非常耗时、I/O 非常慢、线程间的竞争或者锁等。其实很多时候卡顿问题并不难解决，相较解决来说，更困难的是如何快速发现这些卡顿点，以及通过更多的辅助信息找到真正的卡顿原因。**

就跟在本地使用各种卡顿分析工具一样，卡顿优化的难点在于如何把它们移植到线上，以最少的性能代价获得更加丰富的卡顿信息。当然某些卡顿问题可能是 I/O、存储或者网络引发的，后面会还有专门的内容来讲这些问题的优化方法。

### 总结

今天我们学习了卡顿监控的几种方法。随着技术的深入，我们发现了旧方案的一些缺点，通过不断地迭代和演进，寻找更好的方案。

Facebook 的 Profilo 实现了快速获取 Java 堆栈，其实它参考的是 JVM 的 AsyncGetCallTrace 思路，然后适配 Android Runtime 的实现。systrace 使用的是 Linux 的 ftrace，Simpleperf 参考了 Linux 的 perf 工具。还是熟悉的配方，还是熟悉的味道，我们很多创新性的东西，其实还是基于 Java 和 Linux 十年前的产物。

还是回到我在专栏开篇词说过的，切记不要浮躁，多了解和学习一些底层的技术，对我们的成长会有很大帮助。日常开发中我们也不能只满足于完成需求就可以了，在实现上应该学会多去思考内存、卡顿这些影响性能的点，我们比别人多想一些、多做一些，自己的进步自然也会更快一些。

### 课后练习

我在上一期中提到过 Linux 的 ftrace 机制，而 systrace 正是利用这个系统机制实现的。而 [Profilo](https://github.com/facebookincubator/profilo) 更是通过一些黑科技，实现了一个可以用于线上的“systrace”。那它究竟是怎么实现的呢？

通过今天这个[Sample](https://github.com/AndroidAdvanceWithGeektime/Chapter06)，你可以学习到它的实现思路。当你对这些底层机制足够熟悉的时候，可能就不局限在本地使用，而是可以将它们搬到线上了。当然，为了能更好地理解这个 Sample，可能你还需要补充一些 ftrace 和 atrace 相关的背景知识。你会发现这些的确都是 Linux 十年前的一些知识，但时至今日它们依然非常有用。

1. [ftrace 简介](https://www.ibm.com/developerworks/cn/linux/l-cn-ftrace/index.html)、[ftrace 使用（上）](https://www.ibm.com/developerworks/cn/linux/l-cn-ftrace1/index.html)、[frace 使用（下）](https://www.ibm.com/developerworks/cn/linux/l-cn-ftrace2/index.html)。
2. [atrace 介绍](http://source.android.com/devices/tech/debug/ftrace)、[atrace 实现](http://android.googlesource.com/platform/frameworks/native/+/master/cmds/atrace/atrace.cpp)。

---

本章的Sample完全来自于Facebook的性能分析框架[Profilo](https://github.com/facebookincubator/profilo)。

原理：

1. 由于所有的 atrace event 写入都是通过[/sys/kernel/debug/tracing/trace_marker](http://androidxref.com/9.0.0_r3/xref/system/core/libcutils/trace-container.cpp#85)，atrace 在初始化的时候会将该路径 fd 的值写入atrace_marker_fd全局变量中，我们可以通过 dlsym 轻易获取到这个 fd 的值。这样可以过滤掉其他文件的写入。
2. 想要获取 atrace 的日志，就需要设置好 atrace 的 category tag 才能获取到。我们从源码中可以得知，判断 tag 是否开启，是通过 atrace_enabled_tags & tag 来计算的，如果大于 0 则认为开启，等于 0 则认为关闭。判定一个 tag 是否是开启的，只需要 tag 值的左偏移数的位值和 atrace_enabled_tags 在相同偏移数的位值是否同为 1。其实也就是说，我将 atrace_enabled_tags 的所有位都设置为 1，那么在计算时候就能匹配到任何的 atrace tag。

因此，在hook时，先获取到文件的fd，并且保存下`atrace_enabled_tags`，最后hook `libc.so`的write方法。  
hook成功之后将`atrace_enabled_tags`所有位置为1，这样可以匹配到任何atrace tag。  
在触发atrace写入的时候，会调用hook之后的方法，这里可以打印出atrace日志到控制台了。

=== "MainActivity.java"

    ```java
    public class MainActivity extends Activity {
        @Override
        protected void onCreate(Bundle savedInstanceState) {
            super.onCreate(savedInstanceState);
            setContentView(R.layout.activity_main);
            findViewById(R.id.button).setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    boolean b = Atrace.hasHacks();
                    if (b) {
                        Atrace.enableSystrace();
                        Toast.makeText(MainActivity.this, "开启成功", Toast.LENGTH_SHORT).show();
                    }
                }
            });
        }
    }
    ```
    
=== "Atrace.java"

    ```java
    public final class Atrace {
        static {
            System.loadLibrary("tracehook");
        }
    
        private static boolean sHasHook = false;
        private static boolean sHookFailed = false;
    
    
        public static synchronized boolean hasHacks() {
            if (!sHasHook && !sHookFailed) {
                sHasHook = installSystraceHook();
    
                sHookFailed = !sHasHook;
            }
            return sHasHook;
        }
    
    
        public static void enableSystrace() {
            if (!hasHacks()) {
                return;
            }
    
            enableSystraceNative();
    
            SystraceReflector.updateSystraceTags();
        }
    
        public static void restoreSystrace() {
            if (!hasHacks()) {
                return;
            }
            restoreSystraceNative();
            SystraceReflector.updateSystraceTags();
        }
    
        private static native boolean installSystraceHook();
    
        private static native void enableSystraceNative();
    
        private static native void restoreSystraceNative();
    
        private static final class SystraceReflector {
            public static final void updateSystraceTags() {
                if (sTrace_sEnabledTags != null && sTrace_nativeGetEnabledTags != null) {
                    try {
                        sTrace_sEnabledTags.set(null, sTrace_nativeGetEnabledTags.invoke(null));
                    } catch (IllegalAccessException e) {
                    } catch (InvocationTargetException e) {
    
                    }
                }
            }
    
            private static final Method sTrace_nativeGetEnabledTags;
            private static final Field sTrace_sEnabledTags;
    
            static {
                Method m;
                try {
                    m = Trace.class.getDeclaredMethod("nativeGetEnabledTags");
                    m.setAccessible(true);
                } catch (NoSuchMethodException e) {
                    m = null;
                }
                sTrace_nativeGetEnabledTags = m;
    
                Field f;
                try {
                    f = Trace.class.getDeclaredField("sEnabledTags");
                    f.setAccessible(true);
                } catch (NoSuchFieldException e) {
                    f = null;
                }
                sTrace_sEnabledTags = f;
            }
        }
    }
    ```
    
=== "ATraceLogger.cpp"

    ```cpp
    #include <jni.h>
    #include <string>
    
    #include <atomic>
    #include <dlfcn.h>
    #include <sys/mman.h>
    #include <unistd.h>
    #include <sstream>
    #include <unordered_set>
    #include <android/log.h>
    #include <fcntl.h>
    #include <sys/fcntl.h>
    #include <stdlib.h>
    #include <libgen.h>
    #include <sys/system_properties.h>
    #include <vector>
    #include <syscall.h>
    #include "linker.h"
    #include "hooks.h"
    
    #define  LOG_TAG    "HOOOOOOOOK"
    #define  ALOG(...)  __android_log_print(ANDROID_LOG_INFO,LOG_TAG,__VA_ARGS__)
    static const int64_t kSecondNanos = 1000000000;
    
    int *atrace_marker_fd = nullptr;
    std::atomic<uint64_t> *atrace_enabled_tags = nullptr;
    std::atomic<uint64_t> original_tags(UINT64_MAX);
    std::atomic<bool> systrace_installed;
    bool first_enable = true;
    
    int32_t threadID() {
        return static_cast<int32_t>(syscall(__NR_gettid));
    }
    
    int64_t monotonicTime() {
        timespec ts{};
        syscall(__NR_clock_gettime, CLOCK_MONOTONIC, &ts);
        return static_cast<int64_t>(ts.tv_sec) * kSecondNanos + ts.tv_nsec;
    }
    
    void log_systrace(const void *buf, size_t count) {
        const char *msg = reinterpret_cast<const char *>(buf);
    
        switch (msg[0]) {
    
            case 'B': { // begin synchronous event. format: "B|<pid>|<name>"
                ALOG("========= %s", msg);
                break;
            }
            case 'E': { // end synchronous event. format: "E"
                ALOG("========= E");
    
                break;
            }
                // the following events we don't currently log.
            case 'S': // start async event. format: "S|<pid>|<name>|<cookie>"
            case 'F': // finish async event. format: "F|<pid>|<name>|<cookie>"
            case 'C': // counter. format: "C|<pid>|<name>|<value>"
            default:
                return;
        }
    }
    
    /**
    * 只针对特定的fd，降低性能影响
    * @param fd
    * @param count
    * @return
    */
    bool should_log_systrace(int fd, size_t count) {
        return systrace_installed && fd == *atrace_marker_fd && count > 0;
    }
    
    ssize_t write_hook(int fd, const void *buf, size_t count) {
        if (should_log_systrace(fd, count)) {
            log_systrace(buf, count);
            return count;
        }
        return CALL_PREV(write_hook, fd, buf, count);
    }
    
    ssize_t __write_chk_hook(int fd, const void *buf, size_t count, size_t buf_size) {
        if (should_log_systrace(fd, count)) {
            log_systrace(buf, count);
            return count;
        }
        return CALL_PREV(__write_chk_hook, fd, buf, count, buf_size);
    }
    
    /**
    * plt hook libc 的 write 方法
    */
    void hookLoadedLibs() {
        hook_plt_method("libc.so", "write", (hook_func) &write_hook);
        hook_plt_method("libc.so", "__write_chk", (hook_func) &__write_chk_hook);
    }
    
    static int getAndroidSdk() {
        static auto android_sdk = ([] {
            char sdk_version_str[PROP_VALUE_MAX];
            __system_property_get("ro.build.version.sdk", sdk_version_str);
            return atoi(sdk_version_str);
        })();
        return android_sdk;
    }
    
    void installSystraceSnooper() {
        auto sdk = getAndroidSdk();
        {
            std::string lib_name("libcutils.so");
            std::string enabled_tags_sym("atrace_enabled_tags");
            std::string fd_sym("atrace_marker_fd");
    
            if (sdk < 18) {
                lib_name = "libutils.so";
                // android::Tracer::sEnabledTags
                enabled_tags_sym = "_ZN7android6Tracer12sEnabledTagsE";
                // android::Tracer::sTraceFD
                fd_sym = "_ZN7android6Tracer8sTraceFDE";
            }
    
            void *handle;
            if (sdk < 21) {
                handle = dlopen(lib_name.c_str(), RTLD_LOCAL);
            } else {
                handle = dlopen(nullptr, RTLD_GLOBAL);
            }
    
            atrace_enabled_tags =
                    reinterpret_cast<std::atomic<uint64_t> *>(
                            dlsym(handle, enabled_tags_sym.c_str()));
    
            if (atrace_enabled_tags == nullptr) {
                throw std::runtime_error("Enabled Tags not defined");
            }
    
            atrace_marker_fd =
                    reinterpret_cast<int *>(dlsym(handle, fd_sym.c_str()));
    
            if (atrace_marker_fd == nullptr) {
                throw std::runtime_error("Trace FD not defined");
            }
            if (*atrace_marker_fd == -1) {
                throw std::runtime_error("Trace FD not valid");
            }
        }
    
        if (linker_initialize()) {
            throw std::runtime_error("Could not initialize linker library");
        }
    
        hookLoadedLibs();
    
        systrace_installed = true;
    }
    
    void enableSystrace() {
        if (!systrace_installed) {
            return;
        }
    
        if (!first_enable) {
            // On every enable, except the first one, find if new libs were loaded
            // and install systrace hook for them
            try {
                hookLoadedLibs();
            } catch (...) {
                // It's ok to continue if the refresh has failed
            }
        }
        first_enable = false;
    
        auto prev = atrace_enabled_tags->exchange(UINT64_MAX);
        if (prev !=
            UINT64_MAX) { // if we somehow call this twice in a row, don't overwrite the real tags
            original_tags = prev;
        }
    }
    
    void restoreSystrace() {
        if (!systrace_installed) {
            return;
        }
    
        uint64_t tags = original_tags;
        if (tags != UINT64_MAX) { // if we somehow call this before enableSystrace, don't screw it up
            atrace_enabled_tags->store(tags);
        }
    }
    
    bool installSystraceHook() {
        try {
            ALOG("===============install systrace hoook==================");
            installSystraceSnooper();
            return true;
        } catch (const std::runtime_error &e) {
            return false;
        }
    }
    
    
    extern "C"
    JNIEXPORT void JNICALL
    Java_com_dodola_atrace_Atrace_enableSystraceNative(JNIEnv *env, jclass type) {
        enableSystrace();
    }
    
    extern "C"
    JNIEXPORT void JNICALL
    Java_com_dodola_atrace_Atrace_restoreSystraceNative(JNIEnv *env, jclass type) {
        restoreSystrace();
    
    }
    
    extern "C"
    JNIEXPORT jboolean JNICALL
    Java_com_dodola_atrace_Atrace_installSystraceHook(JNIEnv *env, jclass type) {
        installSystraceHook();
        return static_cast<jboolean>(true);
    }
    ```