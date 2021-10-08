---
title: "05 | 卡顿优化（上）：你要掌握的卡顿分析方法"
---

!!! tip "极客时间——[Android开发高手课](https://time.geekbang.org/column/intro/142)"
    本栏目内容源于[Android开发高手课](https://time.geekbang.org/column/intro/142)，外加Sample的个人练习小结。本栏目内的内容将会持续混合着博主个人的收集到的知识点。若本栏目内容令人不适，请移步原始课程。  

### 基础知识

在具体讲卡顿工具前，你需要了解一些基础知识，它们主要都和 CPU 相关。造成卡顿的原因可能有千百种，不过最终都会反映到 **CPU 时间** 上。我们可以把 CPU 时间分为两种：用户时间和系统时间。用户时间就是执行用户态应用程序代码所消耗的时间；系统时间就是执行内核态系统调用所消耗的时间，包括 I/O、锁、中断以及其他系统调用的时间。

1. CPU性能  
    也因此在开发过程中，我们需要根据设备 CPU 性能来“看菜下饭”，例如线程池使用线程数根据 CPU 的核心数，一些高级的 AI 功能只在主频比较高或者带有 NPU 的设备开启。  
    可以通过读取下面的文件获取CPU核心数以及CPU频率：  
    ```java
    // 获取 CPU 核心数
    cat /sys/devices/system/cpu/possible  

    // 获取某个 CPU 的频率
    cat /sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_max_freq
    ```
2. 卡顿问题分析指标  
    出现卡顿问题后，首先我们应该查看 **CPU 的使用率**。怎么查呢？我们可以通过/proc/stat得到整个系统的 CPU 使用情况，通过/proc/[pid]/stat可以得到某个进程的 CPU 使用情况。比较重要的字段有：  
    ```text
    proc/self/stat:
        utime:       用户时间，反应用户代码执行的耗时  
        stime:       系统时间，反应系统调用执行的耗时
        majorFaults：需要硬盘拷贝的缺页次数
        minorFaults：无需硬盘拷贝的缺页次数
    ```
    关于 stat 文件各个属性的含义和 CPU 使用率的计算，你可以阅读[《Linux 环境下进程的 CPU 占用率》](http://www.samirchen.com/linux-cpu-performance/)和[Linux 文档](https://man7.org/linux/man-pages/man5/proc.5.html)。  
    如果 CPU 使用率长期大于 60% ，表示系统处于繁忙状态，就需要进一步分析用户时间和系统时间的比例。对于普通应用程序，系统时间不会长期高于 30%，如果超过这个值，我们就应该进一步检查是 I/O 过多，还是其他的系统调用问题。  

    Android 是站在 Linux 巨人的肩膀上，虽然做了不少修改也砍掉了一些工具，但还是保留了很多有用的工具可以协助我们更容易地排查问题，这里我给你介绍几个常用的命令。例如，**top 命令** 可以帮助我们查看哪个进程是 CPU 的消耗大户； **vmstat 命令** 可以实时动态监视操作系统的虚拟内存和 CPU 活动； **strace 命令** 可以跟踪某个进程中所有的系统调用。

    除了 CPU 的使用率，我们还需要查看 **CPU 饱和度**。CPU 饱和度反映的是线程排队等待 CPU 的情况，也就是 CPU 的负载情况。  
    
    CPU 饱和度首先会跟应用的线程数有关，如果启动的线程过多，容易导致系统不断地切换执行的线程，把大量的时间浪费在上下文切换，我们知道每一次 CPU 上下文切换都需要刷新寄存器和计数器，至少需要几十纳秒的时间。  
    
    我们可以通过使用vmstat命令或者/proc/[pid]/schedstat文件来查看 CPU 上下文切换次数，这里特别需要注意nr_involuntary_switches被动切换的次数。

    ```text
    proc/self/sched:
        nr_voluntary_switches：     
        主动上下文切换次数，因为线程无法获取所需资源导致上下文切换，最普遍的是IO。    
        nr_involuntary_switches：   
        被动上下文切换次数，线程被系统强制调度导致上下文切换，例如大量线程在抢占CPU。
        se.statistics.iowait_count：IO 等待的次数
        se.statistics.iowait_sum：  IO 等待的时间
    ```

    此外也可以通过 uptime 命令可以检查 CPU 在 1 分钟、5 分钟和 15 分钟内的平均负载。比如一个 4 核的 CPU，如果当前平均负载是 8，这意味着每个 CPU 上有一个线程在运行，还有一个线程在等待。一般平均负载建议控制在“0.7 × 核数”以内。

    ```text
    00:02:39 up 7 days, 46 min,  0 users,  
    load average: 13.91, 14.70, 14.32
    ```

    另外一个会影响 CPU 饱和度的是线程优先级，线程优先级会影响 Android 系统的调度策略，它主要由 nice 和 cgroup 类型共同决定。nice 值越低，抢占 CPU 时间片的能力越强。当 CPU 空闲时，线程的优先级对执行效率的影响并不会特别明显，但在 CPU 繁忙的时候，线程调度会对执行效率有非常大的影响。  
    ![](/assets/images/android/master/android_master_stuck_1.png)  

    关于线程优先级，你需要注意 **是否存在高优先级的线程空等低优先级线程，例如主线程等待某个后台线程的锁**。从应用程序的角度来看，无论是用户时间、系统时间，还是等待 CPU 的调度，都是程序运行花费的时间。


### Android 卡顿排查工具

可能你会觉得按照上面各种 Linux 命令组合来排查问题太麻烦了，有没有更简单的、图形化的操作界面呢？Traceview 和 systrace 都是我们比较熟悉的排查卡顿的工具，从实现上这些工具分为两个流派。  
第一个流派是 instrument。获取一段时间内所有函数的调用过程，可以通过分析这段时间内的函数调用流程，再进一步分析待优化的点。  
第二个流派是 sample。有选择性或者采用抽样的方式观察某些函数调用过程，可以通过这些有限的信息推测出流程中的可疑点，然后再继续细化分析。

这两种流派有什么差异？我们在什么场景应该选择哪种合适的工具呢？还有没有其他有用的工具可以使用呢？下面我们一一来看。

#### TraceView

Traceview利用 Android Runtime 函数调用的 event 事件，将函数运行的耗时和调用关系写入 trace 文件中。

由此可见，Traceview 属于 instrument 类型，它可以用来查看整个过程有哪些函数调用，但是工具本身带来的性能开销过大，有时无法反映真实的情况。比如一个函数本身的耗时是 1 秒，开启 Traceview 后可能会变成 5 秒，而且这些函数的耗时变化并不是成比例放大。

使用`Debug.startMethodTracing()`以及`Debug.stopMethodTracing()`可以在程序中动态开启TraceView。  
在 Android 5.0 之后，新增了`Debug.startMethodTracingSampling`方法，可以使用基于样本的方式进行分析，以减少分析对运行时的性能影响。新增了 sample 类型后，就需要我们在开销和信息丰富度之间做好权衡。

#### Nanoscope

那在 instrument 类型的性能分析工具里，有没有性能损耗比较小的呢？

答案是有的，Uber 开源的[Nanoscope](https://github.com/uber/nanoscope)就能达到这个效果。它的实现原理是直接修改 Android 虚拟机源码，在ArtMethod执行入口和执行结束位置增加埋点代码，将所有的信息先写到内存，等到 trace 结束后才统一生成结果文件。

在使用过程可以明显感觉到应用不会因为开启 Nanoscope 而感到卡顿，但是 trace 结束生成结果文件这一步需要的时间比较长。**另一方面它可以支持分析任意一个应用，可用于做竞品分析。**

但是它也有不少限制：

- 需要自己刷 ROM，并且当前只支持 Nexus 6P，或者采用其提供的 x86 架构的模拟器。
- 默认只支持主线程采集，其他线程需要[代码手动设置](https://github.com/uber/nanoscope/wiki/Architecture%3A-Nanoscope-ROM#java-api)。考虑到内存大小的限制，每个线程的内存数组只能支持大约 20 秒左右的时间段。

Uber 写了一系列自动化脚本协助整个流程，使用起来还算简单。Nanoscope 作为基本没有性能损耗的 instrument 工具，它非常适合做启动耗时的自动化分析。  Nanoscope 生成的是符合 Chrome tracing 规范的 HTML 文件。我们可以通过脚本来实现两个功能：

1. 第一个是反混淆。通过 mapping 自动反混淆结果文件。
2. 第二个是自动化分析。传入相同的起点和终点，实现两个结果文件的 diff，自动分析差异点。

这样我们可以每天定期去跑自动化启动测试，查看是否存在新增的耗时点。**我们有时候为了实现更多定制化功能或者拿到更加丰富的信息，这个时候不得不使用定制 ROM 的方式。而 Nanoscope 恰恰是一个很好的工具，可以让我们更方便地实现定制 ROM，在后面启动和 I/O 优化里我还会提到更多类似的案例。**

#### systrace

[systrace](https://source.android.com/devices/tech/debug/systrace?hl=zh-cn)是 Android 4.1 新增的性能分析工具。我通常使用 systrace 跟踪系统的 I/O 操作、CPU 负载、Surface 渲染、GC 等事件。

systrace 利用了 Linux 的[ftrace](https://source.android.com/devices/tech/debug/ftrace)调试工具，相当于在系统各个关键位置都添加了一些性能探针，也就是在代码里加了一些性能监控的埋点。Android 在 ftrace 的基础上封装了[atrace](https://android.googlesource.com/platform/frameworks/native/+/master/cmds/atrace/atrace.cpp)，并增加了更多特有的探针，例如 Graphics、Activity Manager、Dalvik VM、System Server 等。

systrace 工具只能监控特定系统调用的耗时情况，所以它是属于 sample 类型，而且性能开销非常低。但是它不支持应用程序代码的耗时分析，所以在使用时有一些局限性。

由于系统预留了`Trace.beginSection`接口来监听应用程序的调用耗时，那我们有没有办法在 systrace 上面自动增加应用程序的耗时分析呢？  
划重点了，我们可以通过 **编译时给每个函数插桩** 的方式来实现，也就是在重要函数的入口和出口分别增加`Trace.beginSection`和`Trace.endSection`。当然出于性能的考虑，我们会过滤大部分指令数比较少的函数，这样就实现了在 systrace 基础上增加应用程序耗时的监控。通过这样方式的好处有：

- 可以看到整个流程系统和应用程序的调用流程。包括系统关键线程的函数调用，例如渲染耗时、线程锁，GC 耗时等。
- 性能损耗可以接受。由于过滤了大部分的短函数，而且没有放大 I/O，所以整个运行耗时不到原来的两倍，基本可以反映真实情况。

systrace 生成的也是 HTML 格式的结果，我们利用跟 Nanoscope 相似方式实现对反混淆的支持。  
![systrace](/assets/images/android/master/systrace.jpg)

#### Simpleperf

那如果我们想分析 Native 函数的调用，上面的三个工具都不能满足这个需求。

Android 5.0 新增了[Simpleperf](https://android.googlesource.com/platform/system/extras/+/master/simpleperf/doc/README.md)性能分析工具，它利用 CPU 的性能监控单元（PMU）提供的硬件 perf 事件。使用 Simpleperf 可以看到所有的 Native 代码的耗时，有时候一些 Android 系统库的调用对分析问题有比较大的帮助，例如加载 dex、verify class 的耗时等。

Simpleperf 同时封装了 systrace 的监控功能，通过 Android 几个版本的优化，现在 Simpleperf 比较友好地支持 Java 代码的性能分析。具体来说分几个阶段：

第一个阶段：在 Android M 和以前，Simpleperf 不支持 Java 代码分析。  
第二个阶段：在 Android O 和以前，需要手动指定编译 OAT 文件。   
第三个阶段：在 Android P 和以后，无需做任何事情，Simpleperf 就可以支持 Java 代码分析。

从这个过程可以看到 Google 还是比较看重这个功能，在 Android Studio 3.2 也在 Profiler 中直接支持 Simpleperf。  

顾名思义，从名字就能看出 Simpleperf 是属于 sample 类型，它的性能开销非常低，使用火焰图展示分析结果。火焰图示例如下：  
![flame_graph](/assets/images/android/master/flame_graph.jpg)

目前除了 Nanoscope 之外的三个工具都只支持 debugable 的应用程序，如果想测试 release 包，需要将测试机器 root。对于这个限制，我们在实践中会专门打出 debugable 的测试包，然后自己实现针对 mapping 的反混淆功能。**其中 Simpleperf 的反混淆比较难实现，因为在函数聚合后会抛弃参数，无法直接对生成的 HTML 文件做处理**。当然我们也可以根据各个工具的实现思路，自己重新打造一套支持非 debugable 的自动化测试工具。

**选择哪种工具，需要看具体的场景。我来汇总一下，如果需要分析 Native 代码的耗时，可以选择 Simpleperf；如果想分析系统调用，可以选择 systrace；如果想分析整个程序执行流程的耗时，可以选择 Traceview 或者插桩版本的 systrace。**

### 可视化方法

随着 Android 版本的演进，Google 不仅提供了更多的性能分析工具，而且也在慢慢优化现有工具的体验，使功能更强大、使用门槛更低。而 Android Studio 则肩负另外一个重任，那就是让开发者使用起来更加简单的，图形界面也更加直观。

在 Android Studio 3.2 的 Profiler 中直接集成了几种性能分析工具，其中：

- Sample Java Methods 的功能类似于 Traceview 的 sample 类型。
- Trace Java Methods 的功能类似于 Traceview 的 instrument 类型。
- Trace System Calls 的功能类似于 systrace。
- SampleNative (API Level 26+) 的功能类似于 Simpleperf。

坦白来说，Profiler 界面在某些方面不如这些工具自带的界面，支持配置的参数也不如命令行，不过 Profiler 的确大大降低了开发者的使用门槛。  
另外一个比较大的变化是分析结果的展示方式，这些分析工具都支持了 Call Chart 和 Flame Chart 两种展示方式。下面我来讲讲这两种展示方式适合的场景。

#### 1. Call Chart

Call Chart 是 Traceview 和 systrace 默认使用的展示方式。它按照应用程序的函数执行顺序来展示，适合用于分析整个流程的调用。举一个最简单的例子，A 函数调用 B 函数，B 函数调用 C 函数，循环三次，就得到了下面的 Call Chart。

![call_chart](/assets/images/android/master/call_chart.jpg)

Call Chart 就像给应用程序做一个心电图，我们可以看到在这一段时间内，各个线程的具体工作，比如是否存在线程间的锁、主线程是否存在长时间的 I/O 操作、是否存在空闲等。

#### 2. Flame Chart

Flame Chart 也就是大名鼎鼎的[火焰图](http://www.brendangregg.com/flamegraphs.html)。它跟 Call Chart 不同的是，Flame Chart 以一个全局的视野来看待一段时间的调用分布，它就像给应用程序拍 X 光片，可以很自然地把时间和空间两个维度上的信息融合在一张图上。上面函数调用的例子，换成火焰图的展示结果如下。

![flame_chart_demo](/assets/images/android/master/flame_chart_demo.jpg)

当我们不想知道应用程序的整个调用流程，只想直观看出哪些代码路径花费的 CPU 时间较多时，火焰图就是一个非常好的选择。例如，之前我的一个反序列化实现非常耗时，通过火焰图发现耗时最多的是大量 Java 字符串的创建和拷贝，通过将核心实现转为 Native，最终使性能提升了很多倍。

火焰图还可以使用在各种各样的维度，例如内存、I/O 的分析。有些内存可能非常缓慢地泄漏，通过一个内存的火焰图，我们就知道哪些路径申请的内存最多，有了火焰图我们根本不需要分析源代码，也不需要分析整个流程。

最后我想说，每个工具都可以生成不同的展示方式，我们需要根据不同的使用场景选择合适的方式。

### 课后作业

当发生 ANR 的时候，Android 系统会打印 CPU 相关的信息到日志中，使用的是[ProcessCpuTracker.java](http://androidxref.com/9.0.0_r3/xref/frameworks/base/core/java/com/android/internal/os/ProcessCpuTracker.java)。但是这样好像并没有权限可以拿到其他应用进程的 CPU 信息，那能不能换一个思路？

当发现应用的某个进程 CPU 使用率比较高的时候，可以通过下面几个文件检查该进程下各个线程的 CPU 使用率，继而统计出该进程各个线程的时间占比。

```text
/proc/[pid]/stat             // 进程CPU使用情况
/proc/[pid]/task/[tid]/stat  // 进程下面各个线程的CPU使用情况
/proc/[pid]/sched            // 进程CPU调度相关
/proc/loadavg                // 系统平均负载，uptime命令对应文件
```

如果线程销毁了，它的 CPU 运行信息也会被删除，所以我们一般只会计算某一段时间内 CPU 使用率。下面是计算 5 秒间隔内一个 Sample 进程的 CPU 使用示例。**有的时候可能找不到耗时的线程，有可能是有大量生命周期很短的线程，这个时候可以把时间间隔缩短来看看**。

```
usage: CPU usage 5000ms(from 23:23:33.000 to 23:23:38.000):
System TOTAL: 2.1% user + 16% kernel + 9.2% iowait + 0.2% irq + 0.1% softirq + 72% idle
CPU Core: 8
Load Average: 8.74 / 7.74 / 7.36

Process:com.sample.app 
  50% 23468/com.sample.app(S): 11% user + 38% kernel faults:4965

Threads:
  43% 23493/singleThread(R): 6.5% user + 36% kernel faults：3094
  3.2% 23485/RenderThread(S): 2.1% user + 1% kernel faults：329
  0.3% 23468/.sample.app(S): 0.3% user + 0% kernel faults：6
  0.3% 23479/HeapTaskDaemon(S): 0.3% user + 0% kernel faults：982
  ...
```

???+ answer
    8核cpu，平均负载8，idle时间去到72%，说明应用运行中系统CPU性能有很大的盈余。  
    sample应用时间分布大头在kernel。再看线程，线程状态R表示正在运行，S表示TASK_INTERRUPTIBLE，在等待某件事情发生（多数是IO）。SingleThread是主要耗时线程，并且共发生了3094次缺页异常(faults字段)。缺页异常的处理是在内核空间，也解释了kernel 耗时大头的原因，而这里做的操作就是读写磁盘。猜测可能是很多小文件的读写。  
    综合分析瓶颈应该是sample将io集中在一个线程中处理，系统的全部cpu没有利用上，一核忙死，其他3核闲死。

### Demo

[Sample Github](https://github.com/AndroidAdvanceWithGeektime/Chapter05)

基本就是仿照[ProcessCpuTracker.java](http://androidxref.com/9.0.0_r3/xref/frameworks/base/core/java/com/android/internal/os/ProcessCpuTracker.java)的实现，读取的API换成了IO流实现。

???+ notice
    在Android 8.0及以上，部分权限收紧，导致`/proc/stat`以及`/proc/loadavg`无法读取到。  
    使用`Runtime.getRuntime().exec()`直接cat对应文件也不行。可能是手法错误？不过loadavg可以通过Runtime执行`uptime`得到。

=== "MainActivity"

    ```java
    public class MainActivity extends Activity {
        public static Context sContext;
        public static ProcessCpuTracker processCpuTracker = new ProcessCpuTracker(android.os.Process.myPid());
    
        Handler handler = new Handler();
    
        @Override
        protected void onCreate(Bundle savedInstanceState) {
            super.onCreate(savedInstanceState);
            setContentView(R.layout.activity_main);
            sContext = getApplicationContext();
            final Button testGc = (Button) findViewById(R.id.test_gc);
            testGc.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    processCpuTracker.update();
                    testGc();
                    processCpuTracker.update();
                    android.util.Log.e("ProcessCpuTracker",
                            processCpuTracker.printCurrentState(SystemClock.uptimeMillis()));
                }
            });
    
    
            final Button testIO = (Button) findViewById(R.id.test_io);
            testIO.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    processCpuTracker.update();
    
                    testIO();
                    handler.postDelayed(new Runnable() {
                        @Override
                        public void run() {
                            processCpuTracker.update();
                            android.util.Log.e("ProcessCpuTracker",
                                    processCpuTracker.printCurrentState(SystemClock.uptimeMillis()));
                        }
                    }, 5000);
    
    
                }
            });
    
            final Button processOut = (Button) findViewById(R.id.test_process);
            processOut.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    processCpuTracker.update();
                    android.util.Log.e("ProcessCpuTracker",
                            processCpuTracker.printCurrentState(SystemClock.uptimeMillis()));
    
                }
            });
    
            findViewById(R.id.test_uptime).setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    execUpTime();
                }
            });
    
        }
    
        private void testIO() {
            Thread thread = new Thread(new Runnable() {
                @Override
                public void run() {
                    writeSth();
    
                    try {
                        Thread.sleep(100000);
                    } catch (InterruptedException e) {
                        e.printStackTrace();
                    }
                }
            });
            thread.setName("SingleThread");
            thread.start();
        }
    
    
        private void testGc() {
            for (int i = 0; i < 10000; i++) {
                int[] test = new int[100000];
                System.gc();
            }
        }
    
        private void execUpTime() {
           ShellExecutor.execute("uptime");
        }
    
        private void writeSth() {
            try {
                File f = new File(getFilesDir(), "aee.txt");
    
                if (f.exists()) {
                    f.delete();
                }
                FileOutputStream fos = new FileOutputStream(f);
    
                byte[] data = new byte[1024 * 4 * 3000];
    
                for (int i = 0; i < 30; i++) {
                    Arrays.fill(data, (byte) i);
                    fos.write(data);
                    fos.flush();
                }
                fos.close();
    
            } catch (FileNotFoundException e) {
                e.printStackTrace();
            } catch (IOException e) {
                e.printStackTrace();
            }
        }
    }
    ```

=== "ProcessCpuTracker"

    ```java
    /**
     * 有bug, 之前没有现在有，而且更新的时候也有问题
     * 之前有，现在没有，当0处理
     */
    public class ProcessCpuTracker {
        private static final String TAG = "ProcessCpuTracker";
    
        // /proc/self/stat
        private static final int PROCESS_STATS_STATUS = 2 - 2;
        private static final int PROCESS_STATS_MINOR_FAULTS = 9 - 2;
        private static final int PROCESS_STATS_MAJOR_FAULTS = 11 - 2;
        private static final int PROCESS_STATS_UTIME = 13 - 2;
        private static final int PROCESS_STATS_STIME = 14 - 2;
    
        // /proc/
        private static final String NR_VOLUNTARY_SWITCHES = "nr_voluntary_switches";
        private static final String NR_INVOLUNTARY_SWITCHES = "nr_involuntary_switches";
        private static final String SE_IOWAIT_COUNT = "se.statistics.iowait_count";
        private static final String SE_IOWAIT_SUM = "se.statistics.iowait_sum";
    
        // /proc/stat
        private static final int SYSTEM_STATS_USER_TIME = 2;
        private static final int SYSTEM_STATS_NICE_TIME = 3;
        private static final int SYSTEM_STATS_SYS_TIME = 4;
        private static final int SYSTEM_STATS_IDLE_TIME = 5;
        private static final int SYSTEM_STATS_IOWAIT_TIME = 6;
        private static final int SYSTEM_STATS_IRQ_TIME = 7;
        private static final int SYSTEM_STATS_SOFT_IRQ_TIME = 8;
    
        // /proc/loadavg
        private static final int LOAD_AVERAGE_1_MIN = 0;
        private static final int LOAD_AVERAGE_5_MIN = 1;
        private static final int LOAD_AVERAGE_15_MIN = 2;
    
        // How long a CPU jiffy is in milliseconds.
        private final long mJiffyMillis;
        private float mLoad1 = 0;
        private float mLoad5 = 0;
        private float mLoad15 = 0;
        // All times are in milliseconds. They are converted from jiffies to milliseconds
        // when extracted from the kernel.
        private long mCurrentSampleTime;
        private long mLastSampleTime;
        private long mCurrentSampleRealTime;
        private long mLastSampleRealTime;
        private long mCurrentSampleWallTime;
        private long mLastSampleWallTime;
        private long mBaseUserTime;
        private long mBaseSystemTime;
        private long mBaseIoWaitTime;
        private long mBaseIrqTime;
        private long mBaseSoftIrqTime;
        private long mBaseIdleTime;
        private int mRelUserTime;
        private int mRelSystemTime;
        private int mRelIoWaitTime;
        private int mRelIrqTime;
        private int mRelSoftIrqTime;
        private int mRelIdleTime;
        private boolean mRelStatsAreGood;
        private byte[] mBuffer = new byte[4096];
        private boolean DEBUG = true;
        private Stats mCurrentProcStat;
        private int mCurrentProcID;
    
        public static class Stats {
            public final int pid;
            final String statFile;
            final String cmdlineFile;
            final String threadsDir;
            final ArrayList<Stats> workingThreads;
            public String baseName;
            public String name;
            /**
             * Time in milliseconds.
             */
            public long base_uptime;
            /**
             * Time in milliseconds.
             */
            public long rel_uptime;
            /**
             * Time in milliseconds.
             */
            public long base_utime;
            /**
             * Time in milliseconds.
             */
            public long base_stime;
            /**
             * Time in milliseconds.
             */
            public int rel_utime;
            /**
             * Time in milliseconds.
             */
            public int rel_stime;
            public long base_minfaults;
            public long base_majfaults;
            public int rel_minfaults;
            public int rel_majfaults;
            public String status;
    
            Stats(int _pid, boolean isThread) {
                pid = _pid;
                if (isThread) {
                    final File procDir = new File("/proc/self/task", Integer.toString(pid));
                    workingThreads = null;
                    statFile = procDir + "/stat";
                    cmdlineFile = new File(procDir, "comm").toString();
                    threadsDir = null;
                } else {
                    final File procDir = new File("/proc", Integer.toString(pid));
                    statFile = new File(procDir, "stat").toString();
                    cmdlineFile = new File(procDir, "cmdline").toString();
                    threadsDir = (new File(procDir, "task")).toString();
                    workingThreads = new ArrayList<Stats>();
                }
            }
        }
    
    
        public ProcessCpuTracker(int id) {
            long jiffyHz = Sysconf.getScClkTck();
            mJiffyMillis = 1000 / jiffyHz;
            mCurrentProcID = id;
            mCurrentProcStat = new Stats(mCurrentProcID, false);
    
        }
    
        public void update() {
            if (DEBUG) {
                android.util.Log.v(TAG, "Update: " + this);
            }
            final long nowUptime = SystemClock.uptimeMillis();
            final long nowRealtime = SystemClock.elapsedRealtime();
            final long nowWallTime = System.currentTimeMillis();
            final String[] sysCpu = readProcFile("/proc/stat");
    
            //for (int i = 0; i < sysCpu.length; i++) {
            //    android.util.Log.e(TAG,"i:" + i + ", sys:" + sysCpu[i]);
            //}
    
            if (sysCpu != null) {
                // Total user time is user + nice time.
                final long usertime = (Long.parseLong(sysCpu[SYSTEM_STATS_USER_TIME])
                        + Long.parseLong(sysCpu[SYSTEM_STATS_NICE_TIME])) * mJiffyMillis;
                // Total system time is simply system time.
                final long systemtime = Long.parseLong(sysCpu[SYSTEM_STATS_SYS_TIME]) * mJiffyMillis;
                // Total idle time is simply idle time.
                final long idletime = Long.parseLong(sysCpu[SYSTEM_STATS_IDLE_TIME]) * mJiffyMillis;
                // Total irq time is iowait + irq + softirq time.
                final long iowaittime = Long.parseLong(sysCpu[SYSTEM_STATS_IOWAIT_TIME]) * mJiffyMillis;
                final long irqtime = Long.parseLong(sysCpu[SYSTEM_STATS_IRQ_TIME]) * mJiffyMillis;
                final long softirqtime = Long.parseLong(sysCpu[SYSTEM_STATS_SOFT_IRQ_TIME]) * mJiffyMillis;
                // This code is trying to avoid issues with idle time going backwards,
                // but currently it gets into situations where it triggers most of the time. :(
    
                mRelUserTime = (int) (usertime - mBaseUserTime);
                mRelSystemTime = (int) (systemtime - mBaseSystemTime);
                mRelIoWaitTime = (int) (iowaittime - mBaseIoWaitTime);
                mRelIrqTime = (int) (irqtime - mBaseIrqTime);
                mRelSoftIrqTime = (int) (softirqtime - mBaseSoftIrqTime);
                mRelIdleTime = (int) (idletime - mBaseIdleTime);
                mRelStatsAreGood = true;
                if (DEBUG) {
                    android.util.Log.i(TAG, "Total U:" + (usertime)
                            + " S:" + (systemtime) + " I:" + (idletime)
                            + " W:" + (iowaittime) + " Q:" + (irqtime)
                            + " O:" + (softirqtime));
                    android.util.Log.i(TAG, "Rel U:" + mRelUserTime + " S:" + mRelSystemTime
                            + " I:" + mRelIdleTime + " Q:" + mRelIrqTime);
                }
                mBaseUserTime = usertime;
                mBaseSystemTime = systemtime;
                mBaseIoWaitTime = iowaittime;
                mBaseIrqTime = irqtime;
                mBaseSoftIrqTime = softirqtime;
                mBaseIdleTime = idletime;
    
            }
            mLastSampleTime = mCurrentSampleTime;
            mCurrentSampleTime = nowUptime;
            mLastSampleRealTime = mCurrentSampleRealTime;
            mCurrentSampleRealTime = nowRealtime;
            mLastSampleWallTime = mCurrentSampleWallTime;
            mCurrentSampleWallTime = nowWallTime;
    
            getName(mCurrentProcStat, mCurrentProcStat.cmdlineFile);
            collectProcsStats("/proc/self/stat", mCurrentProcStat);
            if (mCurrentProcStat.workingThreads != null) {
                File[] threadsProcFiles = new File(mCurrentProcStat.threadsDir).listFiles();
                for (File thread : threadsProcFiles) {
                    int threadID = Integer.parseInt(thread.getName());
                    Log.d("xxxxx", "threadId:" + threadID);
                    Stats threadStat = findThreadStat(threadID, mCurrentProcStat.workingThreads);
                    if (threadStat == null) {
                        threadStat = new Stats(threadID, true);
    
                        getName(threadStat, threadStat.cmdlineFile);
                        mCurrentProcStat.workingThreads.add(threadStat);
                    }
                    collectProcsStats(threadStat.statFile, threadStat);
                }
                Collections.sort(mCurrentProcStat.workingThreads, sLoadComparator);
            }
    
    
            final String[] loadAverages = readProcFile("/proc/loadavg");
    
            if (loadAverages != null) {
                float load1 = Float.parseFloat(loadAverages[LOAD_AVERAGE_1_MIN]);
                float load5 = Float.parseFloat(loadAverages[LOAD_AVERAGE_5_MIN]);
                float load15 = Float.parseFloat(loadAverages[LOAD_AVERAGE_15_MIN]);
                if (load1 != mLoad1 || load5 != mLoad5 || load15 != mLoad15) {
                    mLoad1 = load1;
                    mLoad5 = load5;
                    mLoad15 = load15;
                }
            }
            if (DEBUG) {
                android.util.Log.i(TAG, "*** TIME TO COLLECT STATS: "
                        + (SystemClock.uptimeMillis() - mCurrentSampleTime));
            }
        }
    
        @Nullable
        private Stats findThreadStat(int id, ArrayList<Stats> stats) {
            for (Stats stat : stats) {
                if (stat.pid == id) {
                    return stat;
                }
            }
            return null;
        }
    
        private void collectProcsStats(String procFile, Stats st) {
            String[] procStats = readProcFile(procFile);
            //for (int i = 0; i < procStats.length; i++) {
            //    android.util.Log.e(TAG,"i:" + i + ", sys:" + procStats[i]);
            //}
            if (procStats == null) {
                return;
            }
            final String status = procStats[PROCESS_STATS_STATUS];
            final long minfaults = Long.parseLong(procStats[PROCESS_STATS_MINOR_FAULTS]);
            final long majfaults = Long.parseLong(procStats[PROCESS_STATS_MAJOR_FAULTS]);
            final long utime = Long.parseLong(procStats[PROCESS_STATS_UTIME]) * mJiffyMillis;
            final long stime = Long.parseLong(procStats[PROCESS_STATS_STIME]) * mJiffyMillis;
    
            if (DEBUG) {
                android.util.Log.v(TAG, "Stats changed " + st.name + " status:" + status + " pid=" + st.pid
                        + " utime=" + utime + "-" + st.base_utime
                        + " stime=" + stime + "-" + st.base_stime
                        + " minfaults=" + minfaults + "-" + st.base_minfaults
                        + " majfaults=" + majfaults + "-" + st.base_majfaults);
            }
            final long uptime = SystemClock.uptimeMillis();
    
            st.rel_uptime = uptime - st.base_uptime;
            st.base_uptime = uptime;
            st.rel_utime = (int) (utime - st.base_utime);
            st.rel_stime = (int) (stime - st.base_stime);
            st.base_utime = utime;
            st.base_stime = stime;
            st.rel_minfaults = (int) (minfaults - st.base_minfaults);
            st.rel_majfaults = (int) (majfaults - st.base_majfaults);
            st.base_minfaults = minfaults;
            st.base_majfaults = majfaults;
            st.status = status;
        }
    
    
        private final static Comparator<Stats> sLoadComparator = new Comparator<Stats>() {
            public final int
            compare(Stats sta, Stats stb) {
                int ta = sta.rel_utime + sta.rel_stime;
                int tb = stb.rel_utime + stb.rel_stime;
                if (ta != tb) {
                    return ta > tb ? -1 : 1;
                }
                return 0;
            }
        };
    
        /**
         * @return time in milliseconds.
         */
        final public int getLastUserTime() {
            return mRelUserTime;
        }
    
        /**
         * @return time in milliseconds.
         */
        final public int getLastSystemTime() {
            return mRelSystemTime;
        }
    
        /**
         * @return time in milliseconds.
         */
        final public int getLastIoWaitTime() {
            return mRelIoWaitTime;
        }
    
        /**
         * @return time in milliseconds.
         */
        final public int getLastIrqTime() {
            return mRelIrqTime;
        }
    
        /**
         * @return time in milliseconds.
         */
        final public int getLastSoftIrqTime() {
            return mRelSoftIrqTime;
        }
    
        /**
         * @return time in milliseconds.
         */
        final public int getLastIdleTime() {
            return mRelIdleTime;
        }
    
        final public boolean hasGoodLastStats() {
            return mRelStatsAreGood;
        }
    
        final public float getTotalCpuPercent() {
            int denom = mRelUserTime + mRelSystemTime + mRelIrqTime + mRelIdleTime;
            if (denom <= 0) {
                return 0;
            }
            return ((float) (mRelUserTime + mRelSystemTime + mRelIrqTime) * 100) / denom;
        }
    
        final private String printCurrentLoad() {
            StringWriter sw = new StringWriter();
            PrintWriter pw = new PrintWriter(sw, false);
            pw.print("Load: ");
            pw.print(mLoad1);
            pw.print(" / ");
            pw.print(mLoad5);
            pw.print(" / ");
            pw.println(mLoad15);
            pw.flush();
            return sw.toString();
        }
    
        @SuppressLint("SimpleDateFormat")
        final public String printCurrentState(long now) {
            final SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS");
            StringWriter sw = new StringWriter();
            PrintWriter pw = new PrintWriter(sw, false);
            pw.println("");
            pw.print("CPU usage from ");
            if (now > mLastSampleTime) {
                pw.print(now - mLastSampleTime);
                pw.print("ms to ");
                pw.print(now - mCurrentSampleTime);
                pw.print("ms ago");
            } else {
                pw.print(mLastSampleTime - now);
                pw.print("ms to ");
                pw.print(mCurrentSampleTime - now);
                pw.print("ms later");
            }
            pw.print(" (");
            pw.print(sdf.format(new Date(mLastSampleWallTime)));
            pw.print(" to ");
            pw.print(sdf.format(new Date(mCurrentSampleWallTime)));
            pw.print(")");
            long sampleTime = mCurrentSampleTime - mLastSampleTime;
            long sampleRealTime = mCurrentSampleRealTime - mLastSampleRealTime;
            long percAwake = sampleRealTime > 0 ? ((sampleTime * 100) / sampleRealTime) : 0;
            if (percAwake != 100) {
                pw.print(" with ");
                pw.print(percAwake);
                pw.print("% awake");
            }
            pw.println(":");
            final int totalTime = mRelUserTime + mRelSystemTime + mRelIoWaitTime
                    + mRelIrqTime + mRelSoftIrqTime + mRelIdleTime;
    
            Stats st = mCurrentProcStat;
            printProcessCPU(pw,
                    st.pid, st.name, st.status, (int) st.rel_uptime,
                    st.rel_utime, st.rel_stime, 0, 0, 0, 0, st.rel_minfaults, st.rel_majfaults);
            if (st.workingThreads != null) {
                pw.println("thread stats:");
                int M = st.workingThreads.size();
                for (int j = 0; j < M; j++) {
                    Stats tst = st.workingThreads.get(j);
                    printProcessCPU(pw,
                            tst.pid, tst.name, tst.status, (int) st.rel_uptime,
                            tst.rel_utime, tst.rel_stime, 0, 0, 0, 0, tst.rel_minfaults, tst.rel_majfaults);
                }
            }
    
            printProcessCPU(pw, -1, "TOTAL", "", totalTime, mRelUserTime, mRelSystemTime,
                    mRelIoWaitTime, mRelIrqTime, mRelSoftIrqTime, mRelIdleTime, 0, 0);
            pw.println(printCurrentLoad());
    
            if (DEBUG) {
                android.util.Log.i(TAG, "totalTime " + totalTime + " over sample time "
                        + (mCurrentSampleTime - mLastSampleTime) + ", real uptime:" + st.rel_uptime);
            }
            pw.flush();
            return sw.toString();
        }
    
        private void printRatio(PrintWriter pw, long numerator, long denominator) {
            long thousands = (numerator * 1000) / denominator;
            long hundreds = thousands / 10;
            pw.print(hundreds);
            if (hundreds < 10) {
                long remainder = thousands - (hundreds * 10);
                if (remainder != 0) {
                    pw.print('.');
                    pw.print(remainder);
                }
            }
        }
    
        private void printProcessCPU(PrintWriter pw, int pid, String label, String status,
                                     int totalTime, int user, int system, int iowait, int irq, int softIrq, int idle,
                                     int minFaults, int majFaults) {
            if (totalTime == 0) {
                totalTime = 1;
            }
            printRatio(pw, user + system + iowait + irq + softIrq + idle, totalTime);
            pw.print("% ");
            if (pid >= 0) {
                pw.print(pid);
                pw.print("/");
            }
            pw.print(label + "(" + status + ")");
            pw.print(": ");
            printRatio(pw, user, totalTime);
            pw.print("% user + ");
            printRatio(pw, system, totalTime);
            pw.print("% kernel");
            if (iowait > 0) {
                pw.print(" + ");
                printRatio(pw, iowait, totalTime);
                pw.print("% iowait");
            }
            if (irq > 0) {
                pw.print(" + ");
                printRatio(pw, irq, totalTime);
                pw.print("% irq");
            }
            if (softIrq > 0) {
                pw.print(" + ");
                printRatio(pw, softIrq, totalTime);
                pw.print("% softirq");
            }
            if (idle > 0) {
                pw.print(" + ");
                printRatio(pw, idle, totalTime);
                pw.print("% idle");
            }
            if (minFaults > 0 || majFaults > 0) {
                pw.print(" / faults:");
                if (minFaults > 0) {
                    pw.print(" ");
                    pw.print(minFaults);
                    pw.print(" minor");
                }
                if (majFaults > 0) {
                    pw.print(" ");
                    pw.print(majFaults);
                    pw.print(" major");
                }
            }
            pw.println();
        }
    
        private String readFile(String file, char endChar) {
            // Permit disk reads here, as /proc/meminfo isn't really "on
            // disk" and should be fast.  TODO: make BlockGuard ignore
            // /proc/ and /sys/ files perhaps?
            FileInputStream is = null;
    
            try {
                is = new FileInputStream(file);
                int len = is.read(mBuffer);
                is.close();
                if (len > 0) {
                    int i;
                    for (i = 0; i < len; i++) {
                        if (mBuffer[i] == endChar || mBuffer[i] == 10) {
                            break;
                        }
                    }
                    return new String(mBuffer, 0, i);
                }
            } catch (java.io.FileNotFoundException e) {
                //
            } catch (IOException e) {
                //
            } finally {
                SystemInfo.closeQuietly(is);
            }
            return null;
        }
    
        private void getName(Stats st, String cmdlineFile) {
            String newName = st.name;
            if (st.name == null || st.name.equals("app_process")
                    || st.name.equals("<pre-initialized>")) {
                String cmdName = readFile(cmdlineFile, '\0');
                if (cmdName != null && cmdName.length() > 1) {
                    newName = cmdName;
                    int i = newName.lastIndexOf("/");
                    if (i > 0 && i < newName.length() - 1) {
                        newName = newName.substring(i + 1);
                    }
                }
                if (newName == null) {
                    newName = st.baseName;
                }
            }
            if (st.name == null || !newName.equals(st.name)) {
                st.name = newName;
            }
        }
    
        @Nullable
        protected String[] readProcFile(String file) {
            RandomAccessFile procFile = null;
            String procFileContents;
            try {
                procFile = new RandomAccessFile(file, "r");
                procFileContents = procFile.readLine();
                int rightIndex = procFileContents.indexOf(")");
                if (rightIndex > 0) {
                    procFileContents = procFileContents.substring(rightIndex + 2);
                }
    
                return procFileContents.split(" ");
            } catch (IOException ioe) {
                ioe.printStackTrace();
                return null;
            } finally {
                SystemInfo.closeQuietly(procFile);
            }
    
        }
    
    }
    ```
    
=== "Sysconf"

    ```java
    /**
     * Use {@link libcore.io.Posix} to obtain values from SysConf without having to include call through
     * to JNI directly, and let the Android Framework's classes do that for us.
     *
     * <p>The singleton instance of the Posix class was made directly accessible from Lollipop (SDK 21)
     * onwards; from ICS to Lollipop we can access an instance at {@code libcore.io.Libcore.os} using
     * reflection.
     *
     * @see <a href="https://fburl.com/8o3hnt3k">The Posix Class in AOSP</a>
     * @see <a href="https://fburl.com/wf5sbpjs">The CPP implementation of Posix</a>
     * @see <a href="https://fburl.com/9kyylxzu">Libcore singleton with a Posix instance</a>
     */
    /*package*/ class Sysconf {
    
        private static final String TAG = "Sysconf";
        protected static final long DEFAULT_CLOCK_TICKS_PER_SECOND = 100;
    
    
        @SuppressLint("ObsoleteSdkInt")
        public static long getScClkTck(long fallback) {
            long result = fallback;
            if (Build.VERSION.SDK_INT >= 21) {
                result = Os.sysconf(OsConstants._SC_CLK_TCK);
            } else if (Build.VERSION.SDK_INT >= 14) {
                result = fromLibcore("_SC_CLK_TCK", fallback);
            }
    
            return result > 0 ? result : fallback;
        }
    
        public static long getScClkTck() {
           return getScClkTck(DEFAULT_CLOCK_TICKS_PER_SECOND);
        }
    
        @SuppressLint("ObsoleteSdkInt")
        public static long getScNProcessorsConf(long fallback) {
            if (Build.VERSION.SDK_INT >= 21) {
                return Os.sysconf(OsConstants._SC_NPROCESSORS_CONF);
            } else if (Build.VERSION.SDK_INT >= 14) {
                return fromLibcore("_SC_NPROCESSORS_CONF", fallback);
            }
    
            return fallback;
        }
    
        private static long fromLibcore(String field, long fallback) {
            try {
                Class osConstantsClass = Class.forName("libcore.io.OsConstants");
                int scClkTck = osConstantsClass.getField(field).getInt(null);
                Class libcoreClass = Class.forName("libcore.io.Libcore");
                Class osClass = Class.forName("libcore.io.Os");
                Object osInstance = libcoreClass.getField("os").get(null);
                return (long) osClass.getMethod("sysconf", int.class).invoke(osInstance, scClkTck);
            } catch (NoSuchMethodException ex) {
                logReflectionException(ex);
            } catch (NoSuchFieldException ex) {
                logReflectionException(ex);
            } catch (IllegalAccessException ex) {
                logReflectionException(ex);
            } catch (InvocationTargetException ex) {
                logReflectionException(ex);
            } catch (ClassNotFoundException ex) {
                logReflectionException(ex);
            }
    
            return fallback;
        }
    
        private static void logReflectionException(Exception ex) {
            android.util.Log.e(TAG, "Unable to read _SC_CLK_TCK by reflection", ex);
        }
    }
    ```

=== "ShellExecutor"

    ```java
    class ShellExecutor {
        public static void execute(String... cmd) {
            try {
                Process process = Runtime.getRuntime().exec("cat /proc/loadavg");
                process.waitFor();
                BufferedReader in = new BufferedReader(new InputStreamReader(process.getInputStream()));
                StringBuilder stringBuilder = new StringBuilder("result=");
                String line;
                while ((line = in.readLine()) != null) {
                    stringBuilder.append(line).append("\n");
                }
                android.util.Log.e("ProcessCpuTracker", stringBuilder.toString());
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }
    ```