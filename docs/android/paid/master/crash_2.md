---
title: "02 | 崩溃优化（下）：应用崩溃了，你应该如何去分析？"
---

!!! tip "极客时间——[Android开发高手课](https://time.geekbang.org/column/intro/142)"
    本栏目内容源于[Android开发高手课](https://time.geekbang.org/column/intro/142)，外加Sample的个人练习小结。本栏目内的内容将会持续混合着博主个人的收集到的知识点。若本栏目内容令人不适，请移步原始课程。  

### 崩溃现场

日志如何收集，保留哪些信息？  

1. 崩溃信息  
    - 进程名、线程名。崩溃的进程是前台进程还是后台进程，崩溃是不是发生在 UI 线程
    - 崩溃堆栈和类型。崩溃是属于 Java 崩溃、Native 崩溃，还是 ANR，对于不同类型的崩溃我们关注的点也不太一样。特别需要看崩溃堆栈的栈顶，看具体崩溃在系统的代码，还是我们自己的代码里面。  
    有时候我们除了崩溃的线程，还希望拿到其他关键的线程的日志。就像上面的例子，虽然是 MyThread 线程崩溃，但是我也希望可以知道主线程当前的调用栈。
2. 系统信息  
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
3. 内存信息  
    OOM、ANR、虚拟内存耗尽等，很多崩溃都跟内存有直接关系。如果我们把用户的手机内存分为“2GB 以下”和“2GB 以上”两个桶，会发现“2GB 以下”用户的崩溃率是“2GB 以上”用户的几倍。  
    - 系统剩余内存。关于系统内存状态，可以直接读取文件 `/proc/meminfo`。当系统可用内存很小（低于 MemTotal 的 10%）时，OOM、大量 GC、系统频繁自杀拉起等问题都非常容易出现。
    - 应用使用内存。包括 Java 内存、RSS（Resident Set Size）、PSS（Proportional Set Size），我们可以得出应用本身内存的占用大小和分布。PSS 和 RSS 通过 `/proc/self/smaps` 计算，可以进一步得到例如 apk、dex、so 等更加详细的分类统计。
    - 虚拟内存。虚拟内存可以通过 `/proc/self/status` 得到，通过 `/proc/self/maps` 文件可以得到具体的分布情况。有时候我们一般不太重视虚拟内存，但是很多类似 OOM、tgkill 等问题都是虚拟内存不足导致的。  
    一般来说，对于 32 位进程，如果是 32 位的 CPU，虚拟内存达到 3GB 就可能会引起内存申请失败的问题。如果是 64 位的 CPU，虚拟内存一般在 3～4GB 之间。当然如果我们支持 64 位进程，虚拟内存就不会成为问题。Google Play 要求 2019 年 8 月一定要支持 64 位，在国内虽然支持 64 位的设备已经在 90% 以上了，但是商店都不支持区分 CPU 架构类型发布，普及起来需要更长的时间。
    
4. 资源信息  
    有的时候我们会发现应用堆内存和设备内存都非常充足，还是会出现内存分配失败的情况，这跟资源泄漏可能有比较大的关系。  
    - 文件句柄 fd。文件句柄的限制可以通过 `/proc/self/limits` 获得，一般单个进程允许打开的最大文件句柄个数为 1024。但是如果文件句柄超过 800 个就比较危险，需要将所有的 fd 以及对应的文件名输出到日志中，进一步排查是否出现了有文件或者线程的泄漏。文件句柄对应的文件可以通过读取 `proc/self/fd/` 目录下文件来获得。 
    - 线程数。当前线程数大小可以通过上面的 status 文件得到，一个线程可能就占 2MB 的虚拟内存，过多的线程会对虚拟内存和文件句柄带来压力。根据我的经验来说，如果线程数超过 400 个就比较危险。需要将所有的线程 id 以及对应的线程名输出到日志中，进一步排查是否出现了线程相关的问题。线程相关信息可以通过 `proc/self/task/<tid>/stat` 来获取。  
    - JNI。使用 JNI 时，如果不注意很容易出现引用失效、引用爆表等一些崩溃。我们可以通过 DumpReferenceTables 统计 JNI 的引用表，进一步分析是否出现了 JNI 泄漏等问题。
   
5. 应用信息  
    - 崩溃场景。崩溃发生在哪个 Activity 或 Fragment，发生在哪个业务中。
    - 关键操作路径。不同于开发过程详细的打点日志，我们可以记录关键的用户操作路径，这对我们复现崩溃会有比较大的帮助。
    - 其他自定义信息。不同的应用关心的重点可能不太一样，比如网易云音乐会关注当前播放的音乐，QQ 浏览器会关注当前打开的网址或视频。此外例如运行时间、是否加载了补丁、是否是全新安装或升级等信息也非常重要。  

除了上面这些通用的信息外，针对特定的一些崩溃，我们可能还需要获取类似磁盘空间、电量、网络使用等特定信息。所以说一个好的崩溃捕获工具，会根据场景为我们采集足够多的信息，让我们有更多的线索去分析和定位问题。当然数据的采集需要注意用户隐私，做到足够强度的加密和脱敏。


### 崩溃分析

崩溃分析“三部曲”：  

第一步：确定重点：

   1. 确认严重程度：优先解决Top崩溃或者对业务有重大影响的崩溃
   2. 崩溃基本信息：确定崩溃的类型以及异常描述，对崩溃有大致的判断  
      - Java崩溃
      - Native崩溃：需要观察 signal、code、fault addr 等内容，以及崩溃时 Java 的堆栈。关于各 signal 含义的介绍，你可以查看[崩溃信号介绍](https://www.mkssoftware.com/docs/man5/siginfo_t.5.asp)。比较常见的是有 SIGSEGV 和 SIGABRT，前者一般是由于空指针、非法指针造成，后者主要因为 ANR 和调用 abort() 退出所导致。
      - ANR：先看看主线程的堆栈，是否是因为锁等待导致。接着看看 ANR 日志中 iowait、CPU、GC、system server 等信息，进一步确定是 I/O 问题，或是 CPU 竞争问题，还是由于大量 GC 导致卡死。
   3. Logcat：Logcat 一般会存在一些有价值的线索，日志级别是 Warning、Error 的需要特别注意。从 Logcat 中我们可以看到当时系统的一些行为跟手机的状态，例如出现 ANR 时，会有“am_anr”；App 被杀时，会有“am_kill”。不同的系统、厂商输出的日志有所差别，当从一条崩溃日志中无法看出问题的原因，或者得不到有用信息时，不要放弃，建议查看相同崩溃点下的更多崩溃日志。
   4. 各个资源情况：结合崩溃的基本信息，我们接着看看是不是跟 “内存信息” 有关，是不是跟“资源信息”有关。比如是物理内存不足、虚拟内存不足，还是文件句柄 fd 泄漏了。  

第二步：查找共性  
第三步：尝试复现

> 补充一下获得logcat和Jave堆栈的方法：  
> 一. 获取logcat  
> logcat日志流程是这样的，应用层 --> liblog.so --> logd，底层使用ring buffer来存储数据。  
> 获取的方式有以下三种：  
>     1. 通过logcat命令获取。  
>     优点：非常简单，兼容性好。  
>     缺点：整个链路比较长，可控性差，失败率高，特别是堆破坏或者堆内存不足时，基本会失败。  
>     2. hook liblog.so实现。通过hook liblog.so 中__android_log_buf_write 方法，将内容重定向到自己的buffer中。  
>     优点：简单，兼容性相对还好。  
>     缺点：要一直打开。  
>     3. 自定义获取代码。通过移植底层获取logcat的实现，通过socket直接跟logd交互。  
>     优点：比较灵活，预先分配好资源，成功率也比较高。  
>     缺点：实现非常复杂
> 
> 二. 获取Java 堆栈  
>     native崩溃时，通过unwind只能拿到Native堆栈。我们希望可以拿到当时各个线程的Java堆栈  
>     1. Thread.getAllStackTraces()。  
>      优点：简单，兼容性好。  
>      缺点：  
>          a. 成功率不高，依靠系统接口在极端情况也会失败。  
>          b. 7.0之后这个接口是没有主线程堆栈。  
>          c. 使用Java层的接口需要暂停线程  
>     2. hook libart.so。通过hook ThreadList和Thread的函数，获得跟ANR一样的堆栈。为了稳定性，我们会在fork子进程执行。  
>     优点：信息很全，基本跟ANR的日志一样，有native线程状态，锁信息等等。  
>     缺点：黑科技的兼容性问题，失败时可以用Thread.getAllStackTraces()兜底  
> 
> 获取Java堆栈的方法还可以用在卡顿时，因为使用fork进程，所以可以做到完全不卡主进程。这块我们在后面会详细的去讲。


### 疑难问题：系统崩溃如何解决？

1. 查找可能的原因
2. 尝试规避
3. Hook解决

95% 以上的崩溃都能解决或者规避，大部分的系统崩溃也是如此。比如课后作业中修复`TimeoutException`问题。
> BugReport日志格式 https://blog.csdn.net/oatnehc/article/details/11284907  

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