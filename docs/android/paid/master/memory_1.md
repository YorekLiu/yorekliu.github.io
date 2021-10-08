---
title: "03 | 内存优化（上）：4GB内存时代，再谈内存优化"
---

!!! tip "极客时间——[Android开发高手课](https://time.geekbang.org/column/intro/142)"
    本栏目内容源于[Android开发高手课](https://time.geekbang.org/column/intro/142)，外加Sample的个人练习小结。本栏目内的内容将会持续混合着博主个人的收集到的知识点。若本栏目内容令人不适，请移步原始课程。  

在写今天这篇文章前，我又翻了翻三年前我在 WeMobileDev 公众号写过的[《Android 内存优化杂谈》](https://mp.weixin.qq.com/s/Z7oMv0IgKWNkhLon_hFakg?)，今天再看，对里面的一句话更有感触：“我们并不能将内存优化中用到的所有技巧都一一说明，而且随着 Android 版本的更替，可能很多方法都会变的过时”。


### 移动设备发展

Facebook 有一个叫[device-year-class](https://github.com/facebookarchive/device-year-class)的开源库，它会用年份来区分设备的性能。虽然此repo很长时间没有更新，但是按照 issue 中的说法，是因为最近几年设备的性能区别不是非常大，早些年的区别很大，所以目前判断到 2016 年就足够了。

### 内存问题

#### 内存引发的两个问题

内存会引发两个问题：异常以及卡顿。  

![memory_pss](/assets/images/android/master/memory_pss.webp)

内存造成的第一个问题是 **异常**。在前面的崩溃分析我提到过“异常率”，异常包括 OOM、内存分配失败这些崩溃，也包括因为整体内存不足导致应用被杀死、设备重启等问题。不知道你平时是否在工作中注意过，如果我们把用户设备的内存分成 2GB 以下和 2GB 以上两部分，你可以试试分别计算他们的异常率或者崩溃率，看看差距会有多大。

内存造成的第二个问题是 **卡顿**。Java 内存不足会导致频繁 GC，这个问题在 Dalvik 虚拟机会更加明显。而 ART 虚拟机在内存管理跟回收策略上都做大量优化，内存分配和 GC 效率相比提升了 5～10 倍。如果想具体测试 GC 的性能，例如暂停挂起时间、总耗时、GC 吞吐量，我们可以通过发送 **SIGQUIT 信号获得 ANR 日志**。

```shell
adb shell kill -S QUIT PID
adb pull /data/anr/traces.txt
```

它包含一些 ANR 转储信息以及 GC 的详细性能信息。

```shell
sticky concurrent mark sweep paused:  Sum: 5.491ms 99% C.I. 1.464ms-2.133ms Avg: 1.830ms Max: 2.133ms     // GC 暂停时间

Total time spent in GC: 502.251ms     // GC 总耗时
Mean GC size throughput: 92MB/s       // GC 吞吐量
Mean GC object throughput: 1.54702e+06 objects/s 
```

另外我们还可以使用 systrace 来观察 GC 的性能耗时，这部分内容在专栏后面会详细讲到。

除了频繁 GC 造成卡顿之外，物理内存不足时系统会触发 low memory killer 机制，系统负载过高是造成卡顿的另外一个原因。

???+ success "LMK"  
    关于lmk（low memory killer），可以查看event.log中被杀的日志：
    
    ```log
    06-21 14:34:48.468 1000 1764 2416 I am_proc_died: [0,12111,com.ximalaya.ting.kid,700,16]
    06-21 14:34:48.475 1000 1764 2416 I am_low_memory: 61
    ```
    
    am_proc_died的日志格式如下：
    
    ```log
    am_proc_died (User|1|5),(PID|1|5),(Process Name|3),(OomAdj|1|5),(ProcState|1|5)
    ```
    
    这就意味着，我们这个进程目前OomAdj为700，也就是上一个应用的优先级（`PREVIOUS_APP_ADJ`）。ProcState为16，即 `PROCESS_STATE_CACHED_ACTIVITY`。

#### 内存的两个误区

除了内存引起的异常和卡顿，在日常做内存优化和架构设计时，很多同学还非常容易陷入两个误区之中。

内存的两个误区：  

**1. 内存占用越少越好？**  

VSS、PSS、Java 堆内存不足都可能会引起异常和卡顿。有些同学认为内存是洪水猛兽，占用越少应用的性能越好，这种认识在具体的优化过程中很容易“用力过猛”。

应用是否占用了过多的内存，跟设备、系统和当时情况有关，而不是 300MB、400MB 这样一个绝对的数值。当系统内存充足的时候，我们可以多用一些获得更好的性能。当系统内存不足的时候，希望可以做到“**用时分配，及时释放**”，就像下面这张图一样，当系统内存出现压力时，能够迅速释放各种缓存来减少系统压力。

![memory_lmk](/assets/images/android/master/memory_lmk.webp)


**2. Native 内存不用管？**  
   当系统物理内存不足时，lmk 开始杀进程，从后台、桌面、服务、前台，直到手机重启  

### 测量方法

在日常开发中，有时候我们需要去排查应用程序中的内存问题。对于系统内存和应用内存的使用情况，你可以参考 Android Developer 中 [《调查 RAM 使用情况》](http://developer.android.com/studio/profile/investigate-ram?hl=zh-cn)。

``` shell
adb shell dumpsys meminfo <package_name|pid> [-d]

Applications Memory Usage (in Kilobytes):
Uptime: 84070586 Realtime: 84070586

** MEMINFO in pid 23094 [com.ximalaya.ting.kid] **
                   Pss  Private  Private  SwapPss      Rss     Heap     Heap     Heap
                 Total    Dirty    Clean    Dirty    Total     Size    Alloc     Free
                ------   ------   ------   ------   ------   ------   ------   ------
  Native Heap    80753    80672        0   102563    81020   219896   169726    37688
  Dalvik Heap    30063    29948        0     1297    30268    42086    25702    16384
 Dalvik Other    12028     7336        0       44    16880                           
        Stack     2756     2756        0     1369     2760                           
       Ashmem       18       12        0        0       40                           
      Gfx dev    23712    23712        0        0    23712                           
    Other dev       57       24       32        0      292                           
     .so mmap    31272     2072    26500     1421    36808                           
    .jar mmap     2731        0      576        0    20864                           
    .apk mmap     4043       20     3568      164    15248                           
    .ttf mmap      176        0      108        0      392                           
    .dex mmap    23318    23180      132    32768    23328                           
    .oat mmap      308        0       60        2      684                           
    .art mmap     7411     5984       80     1990    11696                           
   Other mmap     1658       12     1132        1     2760                           
    GL mtrack    19880    19880        0        0    19880                           
      Unknown     4451     4376        0     1515     4556                           
        TOTAL   387769   199984    32188   143134   387769   261982   195428    54072
 
 App Summary
                       Pss(KB)                        Rss(KB)
                        ------                         ------
           Java Heap:    36012                          41964
         Native Heap:    80672                          81020
                Code:    56356                         106800
               Stack:     2756                           2760
            Graphics:    43592                          43592
       Private Other:    12784
              System:   155597
             Unknown:                                   15052
 
           TOTAL PSS:   387769            TOTAL RSS:   291188       TOTAL SWAP PSS:   143134
 
 Objects
               Views:     1263         ViewRootImpl:        3
         AppContexts:       12           Activities:        3
              Assets:       29        AssetManagers:        0
       Local Binders:      155        Proxy Binders:       50
       Parcel memory:       59         Parcel count:      220
    Death Recipients:        3      OpenSSL Sockets:        0
            WebViews:        0
 
 SQL
         MEMORY_USED:     3589
  PAGECACHE_OVERFLOW:      447          MALLOC_SIZE:      117
 
 DATABASES
      pgsz     dbsz   Lookaside(b)          cache  Dbname
         4       52             92        99/53/6  /data/user/0/com.ximalaya.ting.kid/databases/database_322264_202958003
         4       44             66        24/45/4  /data/user/0/com.ximalaya.ting.kid/databases/database_201354_8648380003
         4       44             92        39/53/6  /data/user/0/com.ximalaya.ting.kid/databases/database_201354_8648380003
         4       24             38         6/35/6  /data/user/0/com.ximalaya.ting.kid/databases/tbsbeacon_db_com.ximalaya.ting.kid
         4       24             47        12/24/3  /data/user/0/com.ximalaya.ting.kid/databases/tbsbeacon_db_com.ximalaya.ting.kid (3)
         4       24             57        18/27/5  /data/user/0/com.ximalaya.ting.kid/databases/tbsbeacon_db_com.ximalaya.ting.kid (2)
         4       44             92        27/51/6  /data/user/0/com.ximalaya.ting.kid/databases/database_201354_8648380003
         4       44             29         1/39/2  /data/user/0/com.ximalaya.ting.kid/databases/database_0_0
         4       16             59        43/29/6  /data/user/0/com.ximalaya.ting.kid/databases/kids_punch.db
         4       40             39         2/26/3  /data/user/0/com.ximalaya.ting.kid/databases/db_diandu
         4       20            100       32/51/21  :memory:
         4       24             17         0/24/1  /data/user/0/com.ximalaya.ting.kid/databases/http_client_cache
         4       44             53         1/39/2  /data/user/0/com.ximalaya.ting.kid/databases/database_0_0
         4       20             28      5801/25/2  /data/user/0/com.ximalaya.ting.kid/databases/bigdata.db
         4       36             67         4/28/5  /data/user/0/com.ximalaya.ting.kid/databases/okdownload-breakpoint.db
         4       36             99       12/37/12  /data/user/0/com.ximalaya.ting.kid/databases/tes_db
         4       44             87        21/41/4  /data/user/0/com.ximalaya.ting.kid/databases/database_0_0
         4       20             25         1/25/2  /data/user/0/com.ximalaya.ting.kid/databases/play_event
         4       20             27         3/25/2  /data/user/0/com.ximalaya.ting.kid/databases/tracker.db
         4       52            100       86/38/15  /data/user/0/com.ximalaya.ting.kid/databases/bugly_db_
         4       36             45        30/26/3  /data/user/0/com.ximalaya.ting.kid/databases/firework.db
         4       52             92        99/53/6  /data/user/0/com.ximalaya.ting.kid/databases/database_322264_202958003
         4       44             43         1/39/2  /data/user/0/com.ximalaya.ting.kid/databases/database_0_0
```

**Java内存分配：**

有些时候我们希望跟踪 Java 堆内存的使用情况，这个时候最常用的有 Allocation Tracker 和 MAT 这两个工具。

在我曾经写过的[《Android 内存申请分析》](https://mp.weixin.qq.com/s/b_lFfL1mDrNVKj_VAcA2ZA?)里，提到过 Allocation Tracker 的三个缺点。  
1. 获取的信息过于分散，中间夹杂着不少其他的信息，很多信息不是应用申请的，可能需要进行不少查找才能定位到具体的问题。  
2. 跟 Traceview 一样，无法做到自动化分析，每次都需要开发者手工开始 / 结束，这对于某些问题的分析可能会造成不便，而且对于批量分析来说也比较困难。  
3. 虽然在 Allocation Tracking 的时候，不会对手机本身的运行造成过多的性能影响，但是在停止的时候，直到把数据 dump 出来之前，经常会把手机完全卡死，如果时间过长甚至会直接 ANR。 
 
我们可以用自定义的“Allocation Tracker”来监控 Java 内存的监控，也可以拓展成实时监控 Java 内存泄漏。这方面经验不多的同学也不用担心，我在今天的“课后作业”提供了一个自定义的“Allocation Tracker”供你参考。**不过任何一个工具如果只需要做到线下自动化测试，实现起来会相对简单，但想要移植到线上使用，那就要更加关注兼容性、稳定性和性能，付出的努力要远远高于实验室方案。**

**Native内存分配检测：**

1. 内存泄漏检测：首先 Google 之前将 Valgrind 弃用，建议我们使用 Chromium 的[AddressSanitize](https://source.android.com/devices/tech/debug/asan.html) 。遵循“谁最痛，谁最需要，谁优化”，所以 Chromium 出品了一大堆 Native 相关的工具。Android 之前对 AddressSanitize 支持的不太好，需要 root 和一大堆的操作，但在 Android 8.0 之后，我们可以根据这个[指南](http://github.com/google/sanitizers/wiki/AddressSanitizerOnAndroid)来使用 AddressSanitize。目前 AddressSanitize 内存泄漏检测只支持 x86_64 Linux 和 OS X 系统，不过相信 Google 很快就可以支持直接在 Android 上进行检测了。
2. 跟踪内存申请：那我们有没有类似 Allocation Tracker 那样的 Native 内存分配工具呢？在这方面，Android 目前的支持还不是太好，但 Android Developer 近来也补充了一些相关的文档，你可以参考[《调试本地内存使用》](https://source.android.com/devices/tech/debug/native-memory)。关于 Native 内存的问题，有两种方法，分别是Malloc 调试和Malloc 钩子。  
    1. [Malloc 调试](http://android.googlesource.com/platform/bionic/+/master/libc/malloc_debug/README.md)可以帮助我们去调试 Native 内存的一些使用问题，例如堆破坏、内存泄漏、非法地址等。Android 8.0 之后支持在非 root 的设备做 Native 内存调试，不过跟 AddressSanitize 一样，需要通过[wrap.sh](http://developer.android.com/ndk/guides/wrap-script.html)做包装。  
    ```shell
    adb shell setprop wrap.<APP> '"LIBC_DEBUG_MALLOC_OPTIONS=backtrace logwrapper"'
    ```
    2. [Malloc 钩子](http://android.googlesource.com/platform/bionic/+/master/libc/malloc_hooks/README.md)是在 Android P 之后，Android 的 libc 支持拦截在程序执行期间发生的所有分配 / 释放调用，这样我们就可以构建出自定义的内存检测工具。  
    ```shell
    adb shell setprop wrap.<APP> '"LIBC_HOOKS_ENABLE=1"'
    ```

    但是在使用“Malloc 调试”时，感觉整个 App 都会变卡，有时候还会产生 ANR。如何在 Android 上对应用 Native 内存分配和泄漏做自动化分析，也是我最近想做的事情。据我了解，微信最近几个月在 Native 内存泄漏监控上也做了一些尝试，我会在专栏下一期具体讲讲。