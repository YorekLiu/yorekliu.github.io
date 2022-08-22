---
title: "02 | 崩溃优化（下）：应用崩溃了，你应该如何去分析？"
---

!!! tip "极客时间——[Android开发高手课](https://time.geekbang.org/column/intro/142)"
    本栏目内容源于[Android开发高手课](https://time.geekbang.org/column/intro/142)，外加Sample的个人练习小结。本栏目内的内容将会持续混合着博主个人的收集到的知识点。若本栏目内容令人不适，请移步原始课程。  

在侦探漫画《名侦探柯南》中，无论柯南走到哪里都会遇到新的“案件”，这也很像程序员的“日常”，我们每天工作也会遇到各种各样的疑难问题，“崩溃”就是其中比较常见的一种问题。

解决崩溃跟破案一样需要经验，我们分析的问题越多越熟练，定位问题就会越快越准。当然这里也有很多套路，比如对于“案发现场”我们应该留意哪些信息？怎样找到更多的“证人”和“线索”？“侦查案件”的一般流程是什么？对不同类型的“案件”分别应该使用什么样的调查方式？

“真相永远只有一个”，崩溃也并不可怕。通过今天的学习，希望你能成为代码届的名侦探柯南。

### 崩溃现场

崩溃现场是我们的“第一案发现场”，它保留着很多有价值的线索。在这里我们挖掘到的信息越多，下一步分析的方向就越清晰，而不是去靠盲目猜测。

操作系统是整个崩溃过程的“旁观者”，也是我们最重要的“证人”。一个好的崩溃捕获工具知道应该采集哪些系统信息，也知道在什么场景要深入挖掘哪些内容，从而可以更好地帮助我们解决问题。

接下来我们具体来看看在崩溃现场应该采集哪些信息。 

<large>1. 崩溃信息</large>

从崩溃的基本信息，我们可以对崩溃有初步的判断。

- 进程名、线程名。崩溃的进程是前台进程还是后台进程，崩溃是不是发生在 UI 线程。
- 崩溃堆栈和类型。崩溃是属于 Java 崩溃、Native 崩溃，还是 ANR，对于不同类型的崩溃我们关注的点也不太一样。特别需要看崩溃堆栈的栈顶，看具体崩溃在系统的代码，还是我们自己的代码里面。

```
Process Name: 'com.sample.crash'
Thread Name: 'MyThread'

java.lang.NullPointerException
    at ...TestsActivity.crashInJava(TestsActivity.java:275)
```

有时候我们除了崩溃的线程，还希望拿到其他关键的线程的日志。就像上面的例子，虽然是 MyThread 线程崩溃，但是我也希望可以知道主线程当前的调用栈。

<large>2. 系统信息</large>

系统的信息有时候会带有一些关键的线索，对我们解决问题有非常大的帮助。

- Logcat。这里包括应用、系统的运行日志。由于系统权限问题，获取到的 Logcat 可能只包含与当前 App 相关的。其中系统的 event logcat 会记录 App 运行的一些基本情况，记录在文件 /system/etc/event-log-tags 中。
     ```text
     system logcat:
     10-25 17:13:47.788 21430 21430 D dalvikvm: Trying to load lib ... 
     event logcat:
     10-25 17:13:47.788 21430 21430 I am_on_resume_called: 生命周期
     10-25 17:13:47.788 21430 21430 I am_low_memory: 系统内存不足
     10-25 17:13:47.788 21430 21430 I am_destroy_activity: 销毁 Activty
     10-25 17:13:47.888 21430 21430 I am_anr: ANR 以及原因
     10-25 17:13:47.888 21430 21430 I am_kill: APP 被杀以及原因
     ```

- 机型、系统、厂商、CPU、ABI、Linux 版本等。我们会采集多达几十个维度，这对后面讲到寻找共性问题会很有帮助。
- 设备状态：是否 root、是否是模拟器。一些问题是由 Xposed 或多开软件造成，对这部分问题我们要区别对待。

<large>3. 内存信息</large>

OOM、ANR、虚拟内存耗尽等，很多崩溃都跟内存有直接关系。如果我们把用户的手机内存分为“2GB 以下”和“2GB 以上”两个桶，会发现“2GB 以下”用户的崩溃率是“2GB 以上”用户的几倍。  

- 系统剩余内存。关于系统内存状态，可以直接读取文件 `/proc/meminfo`。当系统可用内存很小（低于 MemTotal 的 10%）时，OOM、大量 GC、系统频繁自杀拉起等问题都非常容易出现。
- 应用使用内存。包括 Java 内存、RSS（Resident Set Size）、PSS（Proportional Set Size），我们可以得出应用本身内存的占用大小和分布。PSS 和 RSS 通过 `/proc/self/smaps` 计算，可以进一步得到例如 apk、dex、so 等更加详细的分类统计。
- 虚拟内存。虚拟内存可以通过 `/proc/self/status` 得到，通过 `/proc/self/maps` 文件可以得到具体的分布情况。有时候我们一般不太重视虚拟内存，但是很多类似 OOM、tgkill 等问题都是虚拟内存不足导致的。  

```java
Name:     com.sample.name   // 进程名
FDSize:   800               // 当前进程申请的文件句柄个数
VmPeak:   3004628 kB        // 当前进程的虚拟内存峰值大小
VmSize:   2997032 kB        // 当前进程的虚拟内存大小
Threads:  600               // 当前进程包含的线程个数
```

一般来说，对于 32 位进程，如果是 32 位的 CPU，虚拟内存达到 3GB 就可能会引起内存申请失败的问题。如果是 64 位的 CPU，虚拟内存一般在 3～4GB 之间。当然如果我们支持 64 位进程，虚拟内存就不会成为问题。Google Play 要求 2019 年 8 月一定要支持 64 位，在国内虽然支持 64 位的设备已经在 90% 以上了，但是商店都不支持区分 CPU 架构类型发布，普及起来需要更长的时间。


<large>4. 资源信息</large>

有的时候我们会发现应用堆内存和设备内存都非常充足，还是会出现内存分配失败的情况，这跟资源泄漏可能有比较大的关系。  

- 文件句柄 fd。文件句柄的限制可以通过 `/proc/self/limits` 获得，一般单个进程允许打开的最大文件句柄个数为 1024。但是如果文件句柄超过 800 个就比较危险，需要将所有的 fd 以及对应的文件名输出到日志中，进一步排查是否出现了有文件或者线程的泄漏。文件句柄对应的文件可以通过读取 `proc/self/fd/` 目录下文件来获得。 

```
opened files count 812:
0 -> /dev/null
1 -> /dev/log/main4 
2 -> /dev/binder
3 -> /data/data/com.crash.sample/files/test.config
...
```

- 线程数。当前线程数大小可以通过上面的 status 文件得到，一个线程可能就占 2MB 的虚拟内存，过多的线程会对虚拟内存和文件句柄带来压力。根据我的经验来说，如果线程数超过 400 个就比较危险。需要将所有的线程 id 以及对应的线程名输出到日志中，进一步排查是否出现了线程相关的问题。线程相关信息可以通过 `proc/self/task/<tid>/stat` 来获取。  

```
threads count 412:               
1820 com.sample.crashsdk                         
1844 ReferenceQueueD                                             
1869 FinalizerDaemon   
...  
```

- JNI。使用 JNI 时，如果不注意很容易出现引用失效、引用爆表等一些崩溃。我们可以通过 DumpReferenceTables 统计 JNI 的引用表，进一步分析是否出现了 JNI 泄漏等问题。

<large>5. 应用信息</large>

除了系统，其实我们的应用更懂自己，可以留下很多相关的信息。

- 崩溃场景。崩溃发生在哪个 Activity 或 Fragment，发生在哪个业务中。
- 关键操作路径。不同于开发过程详细的打点日志，我们可以记录关键的用户操作路径，这对我们复现崩溃会有比较大的帮助。
- 其他自定义信息。不同的应用关心的重点可能不太一样，比如网易云音乐会关注当前播放的音乐，QQ 浏览器会关注当前打开的网址或视频。此外例如运行时间、是否加载了补丁、是否是全新安装或升级等信息也非常重要。  

除了上面这些通用的信息外，针对特定的一些崩溃，我们可能还需要获取类似磁盘空间、电量、网络使用等特定信息。所以说一个好的崩溃捕获工具，会根据场景为我们采集足够多的信息，让我们有更多的线索去分析和定位问题。当然数据的采集需要注意用户隐私，做到足够强度的加密和脱敏。

### 崩溃分析

有了这么多现场信息之后，我们可以开始真正的“破案”之旅了。绝大部分的“案件”只要我们肯花功夫，最后都能真相大白。不要畏惧问题，经过耐心和细心地分析，总能敏锐地发现一些异常或关键点，并且还要敢于怀疑和验证。下面我重点给你介绍崩溃分析“三部曲”。

第一步：确定重点：

确认和分析重点，关键在于在日志中找到重要的信息，对问题有一个大致判断。一般来说，我建议在确定重点这一步可以关注以下几点。

**1. 确认严重程度**。解决崩溃也要看性价比，我们优先解决 Top 崩溃或者对业务有重大影响，例如启动、支付过程的崩溃。我曾经有一次辛苦了几天解决了一个大的崩溃，但下个版本产品就把整个功能都删除了，这令我很崩溃。

**2. 崩溃基本信息**。确定崩溃的类型以及异常描述，对崩溃有大致的判断。一般来说，大部分的简单崩溃经过这一步已经可以得到结论。

- Java 崩溃。Java 崩溃类型比较明显，比如 NullPointerException 是空指针，OutOfMemoryError 是资源不足，这个时候需要去进一步查看日志中的 “内存信息”和“资源信息”。
- Native崩溃：需要观察 signal、code、fault addr 等内容，以及崩溃时 Java 的堆栈。关于各 signal 含义的介绍，你可以查看[崩溃信号介绍](https://www.mkssoftware.com/docs/man5/siginfo_t.5.asp)。比较常见的是有 SIGSEGV 和 SIGABRT，前者一般是由于空指针、非法指针造成，后者主要因为 ANR 和调用 abort() 退出所导致。
- **ANR**：先看看主线程的堆栈，是否是因为锁等待导致。接着看看 ANR 日志中 iowait、CPU、GC、system server 等信息，进一步确定是 I/O 问题，或是 CPU 竞争问题，还是由于大量 GC 导致卡死。

**3. Logcat**。Logcat 一般会存在一些有价值的线索，日志级别是 Warning、Error 的需要特别注意。从 Logcat 中我们可以看到当时系统的一些行为跟手机的状态，例如出现 ANR 时，会有“am_anr”；App 被杀时，会有“am_kill”。不同的系统、厂商输出的日志有所差别，**当从一条崩溃日志中无法看出问题的原因，或者得不到有用信息时，不要放弃，建议查看相同崩溃点下的更多崩溃日志**。

**4. 各个资源情况**。结合崩溃的基本信息，我们接着看看是不是跟 “内存信息” 有关，是不是跟“资源信息”有关。比如是物理内存不足、虚拟内存不足，还是文件句柄 fd 泄漏了。

无论是资源文件还是 Logcat，内存与线程相关的信息都需要特别注意，很多崩溃都是由于它们使用不当造成的。

第二步：查找共性

如果使用了上面的方法还是不能有效定位问题，我们可以尝试查找这类崩溃有没有什么共性。找到了共性，也就可以进一步找到差异，离解决问题也就更进一步。

机型、系统、ROM、厂商、ABI，这些采集到的系统信息都可以作为维度聚合，共性问题例如是不是因为安装了 Xposed，是不是只出现在 x86 的手机，是不是只有三星这款机型，是不是只在 Android 5.0 的系统上。应用信息也可以作为维度来聚合，比如正在打开的链接、正在播放的视频、国家、地区等。

找到了共性，可以对你下一步复现问题有更明确的指引。

第三步：尝试复现

如果我们已经大概知道了崩溃的原因，为了进一步确认更多信息，就需要尝试复现崩溃。如果我们对崩溃完全没有头绪，也希望通过用户操作路径来尝试重现，然后再去分析崩溃原因。

“只要能本地复现，我就能解”，相信这是很多开发跟测试说过的话。有这样的底气主要是因为在稳定的复现路径上面，我们可以采用增加日志或使用 Debugger、GDB 等各种各样的手段或工具做进一步分析。

回想当时在开发 Tinker 的时候，我们遇到了各种各样的奇葩问题。比如某个厂商改了底层实现、新的 Android 系统实现有所更改，都需要去 Google、翻源码，有时候还需要去抠厂商的 ROM 或手动刷 ROM。这个痛苦的经历告诉我，很多疑难问题需要我们耐得住寂寞，反复猜测、反复发灰度、反复验证。

疑难问题：系统崩溃

系统崩溃常常令我们感到非常无助，它可能是某个 Android 版本的 bug，也可能是某个厂商修改 ROM 导致。这种情况下的崩溃堆栈可能完全没有我们自己的代码，很难直接定位问题。针对这种疑难问题，我来谈谈我的解决思路。

**1. 查找可能的原因**。通过上面的共性归类，我们先看看是某个系统版本的问题，还是某个厂商特定 ROM 的问题。虽然崩溃日志可能没有我们自己的代码，但通过操作路径和日志，我们可以找到一些怀疑的点。

**2. 尝试规避**。查看可疑的代码调用，是否使用了不恰当的 API，是否可以更换其他的实现方式规避。

**3. Hook 解决**。这里分为 Java Hook 和 Native Hook。以我最近解决的一个系统崩溃为例，我们发现线上出现一个 Toast 相关的系统崩溃，它只出现在 Android 7.0 的系统中，看起来是在 Toast 显示的时候窗口的 token 已经无效了。这有可能出现在 Toast 需要显示时，窗口已经销毁了。

```java
android.view.WindowManager$BadTokenException: 
  at android.view.ViewRootImpl.setView(ViewRootImpl.java)
  at android.view.WindowManagerGlobal.addView(WindowManagerGlobal.java)
  at android.view.WindowManagerImpl.addView(WindowManagerImpl.java4)
  at android.widget.Toast$TN.handleShow(Toast.java)
```

为什么 Android 8.0 的系统不会有这个问题？在查看 Android 8.0 的源码后我们发现有以下修改：

```java
try {
  mWM.addView(mView, mParams);
  trySendAccessibilityEvent();
} catch (WindowManager.BadTokenException e) {
  /* ignore */
}
```

考虑再三，我们决定参考 Android 8.0 的做法，直接 catch 住这个异常。这里的关键在于寻找 Hook 点，这个案例算是相对比较简单的。Toast 里面有一个变量叫 mTN，它的类型为 handler，我们只需要代理它就可以实现捕获。

如果你做到了我上面说的这些，**95% 以上的崩溃都能解决或者规避，大部分的系统崩溃也是如此**。当然总有一些疑难问题需要依赖到用户的真实环境，我们希望具备类似动态跟踪和调试的能力。专栏后面还会讲到 xlog 日志、远程诊断、动态分析等高级手段，可以帮助我们进一步调试线上疑难问题，敬请期待。

崩溃攻防是一个长期的过程，我们希望尽可能地提前预防崩溃的发生，将它消灭在萌芽阶段。这可能涉及我们应用的整个流程，包括人员的培训、编译检查、静态扫描工作，还有规范的测试、灰度、发布流程等。

而崩溃优化也不是孤立的，它跟我们后面讲到的内存、卡顿、I/O 等内容都有关。可能等你学完整个课程后，再回头来看会有不同的理解。

### 总结

今天我们介绍了崩溃问题的一些分析方法、特殊技巧、以及疑难和常见问题的解决方法。当然崩溃分析要具体问题具体分析，不同类型的应用侧重点可能也有所不同，我们不能只局限在上面所说的一些方法。

讲讲自己的一些心得体会，在解决崩溃特别是一些疑难问题时，总会觉得患得患失。有时候解了一个问题，发现其他问题也跟“开心消消乐”一样消失了。有时候有些问题“解不出来郁闷，解出来更郁闷”，可能只是一个小的代码疏忽，换来了一个月的青春和很多根白头发。


### 课后作业

利用反射修复TimeoutException这个比较经典的疑难的系统崩溃问题。

```java
java.util.concurrent.TimeoutException: 
         android.os.BinderProxy.finalize() timed out after 10 seconds
at android.os.BinderProxy.destroy(Native Method)
at android.os.BinderProxy.finalize(Binder.java:459)
```

原理：修复`Daemons$FinalizerWatchdogDaemon`超时导致的崩溃，反射将其父类的thread置为null，这样在`runInternal()`方法中判断`isRunning()`就会返回false，从而导致退出循环不再执行终结方法。

代码：

```java
package com.dodola.watchdogkiller;

import java.lang.reflect.Field;
import java.lang.reflect.Method;

import android.os.Build;
import android.os.Debug;
import android.util.Log;

/**
 * Created by dodola on 2018/12/3.
 */
public class WatchDogKiller {
    private static final String TAG = "WatchDogKiller";
    private static volatile boolean sWatchdogStopped = false;

    public static boolean checkWatchDogAlive() {
        final Class clazz;
        try {
            clazz = Class.forName("java.lang.Daemons$FinalizerWatchdogDaemon");
            final Field field = clazz.getDeclaredField("INSTANCE");
            field.setAccessible(true);
            final Object watchdog = field.get(null);
            Method isRunningMethod = clazz.getSuperclass().getDeclaredMethod("isRunning");
            isRunningMethod.setAccessible(true);
            boolean isRunning = (boolean) isRunningMethod.invoke(watchdog);
            return isRunning;
        } catch (Exception e) {
            e.printStackTrace();
        }
        return false;
    }


    public static void stopWatchDog() {
        // 建议在在debug包或者灰度包中不要stop，保留发现问题的能力。为了Sample效果，先注释
        //if (!BuildConfig.DEBUG) {
        //    return;
        //}

        // Android P 以后不能反射FinalizerWatchdogDaemon
        if (Build.VERSION.SDK_INT >= 28) {
            Log.w(TAG, "stopWatchDog, do not support after Android P, just return");
            return;
        }
        if (sWatchdogStopped) {
            Log.w(TAG, "stopWatchDog, already stopped, just return");
            return;
        }
        sWatchdogStopped = true;
        Log.w(TAG, "stopWatchDog, try to stop watchdog");

        try {
            final Class clazz = Class.forName("java.lang.Daemons$FinalizerWatchdogDaemon");
            final Field field = clazz.getDeclaredField("INSTANCE");
            field.setAccessible(true);
            final Object watchdog = field.get(null);
            try {
                final Field thread = clazz.getSuperclass().getDeclaredField("thread");
                thread.setAccessible(true);
                thread.set(watchdog, null);
            } catch (final Throwable t) {
                Log.e(TAG, "stopWatchDog, set null occur error:" + t);

                t.printStackTrace();
                try {
                    // 直接调用stop方法，在Android 6.0之前会有线程安全问题
                    final Method method = clazz.getSuperclass().getDeclaredMethod("stop");
                    method.setAccessible(true);
                    method.invoke(watchdog);
                } catch (final Throwable e) {
                    Log.e(TAG, "stopWatchDog, stop occur error:" + t);
                    t.printStackTrace();
                }
            }
        } catch (final Throwable t) {
            Log.e(TAG, "stopWatchDog, get object occur error:" + t);
            t.printStackTrace();
        }
    }
}
```

### 备注

补充一下获得logcat和Jave堆栈的方法：  

一. 获取logcat  

logcat日志流程是这样的，应用层 --> liblog.so --> logd，底层使用ring buffer来存储数据。  

获取的方式有以下三种：  

1. 通过logcat命令获取。  
优点：非常简单，兼容性好。  
缺点：整个链路比较长，可控性差，失败率高，特别是堆破坏或者堆内存不足时，基本会失败。  
2. hook liblog.so实现。通过hook liblog.so 中__android_log_buf_write 方法，将内容重定向到自己的buffer中。  
优点：简单，兼容性相对还好。  
缺点：要一直打开。  
3. 自定义获取代码。通过移植底层获取logcat的实现，通过socket直接跟logd交互。  
优点：比较灵活，预先分配好资源，成功率也比较高。  
缺点：实现非常复杂

二. 获取Java 堆栈  

native崩溃时，通过unwind只能拿到Native堆栈。我们希望可以拿到当时各个线程的Java堆栈  

1. Thread.getAllStackTraces()。  
优点：简单，兼容性好。  
缺点：  
   a. 成功率不高，依靠系统接口在极端情况也会失败。  
   b. 7.0之后这个接口是没有主线程堆栈。  
   c. 使用Java层的接口需要暂停线程  
2. hook libart.so。通过hook ThreadList和Thread的函数，获得跟ANR一样的堆栈。为了稳定性，我们会在fork子进程执行。  
优点：信息很全，基本跟ANR的日志一样，有native线程状态，锁信息等等。  
缺点：黑科技的兼容性问题，失败时可以用Thread.getAllStackTraces()兜底  

获取Java堆栈的方法还可以用在卡顿时，因为使用fork进程，所以可以做到完全不卡主进程。  

主进程suspend-fork-resume-wait子进程，子进程fork出来后进行一些操作，这一个流程是非常常用的操作流程，在各大开源库中皆可以看到。主要原因就是用到了COW机制，fork出来的子进程与父进程会共享所有的数据。