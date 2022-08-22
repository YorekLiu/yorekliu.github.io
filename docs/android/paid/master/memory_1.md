---
title: "03 | 内存优化（上）：4GB内存时代，再谈内存优化"
---

!!! tip "极客时间——[Android开发高手课](https://time.geekbang.org/column/intro/142)"
    本栏目内容源于[Android开发高手课](https://time.geekbang.org/column/intro/142)，外加Sample的个人练习小结。本栏目内的内容将会持续混合着博主个人的收集到的知识点。若本栏目内容令人不适，请移步原始课程。  

在写今天这篇文章前，我又翻了翻三年前我在 WeMobileDev 公众号写过的[《Android 内存优化杂谈》](https://mp.weixin.qq.com/s/Z7oMv0IgKWNkhLon_hFakg?)，今天再看，对里面的一句话更有感触：“我们并不能将内存优化中用到的所有技巧都一一说明，而且随着 Android 版本的更替，可能很多方法都会变的过时”。

三年过去了，4GB 内存的手机都变成了主流。那内存优化是不是变得不重要了？如今有哪些技巧已经淘汰，而我们又要升级什么技能呢？

今天在 4GB 内存时代下，我就再来谈谈“内存优化”这个话题。

### 移动设备发展

Facebook 有一个叫[device-year-class](https://github.com/facebookarchive/device-year-class)的开源库，它会用年份来区分设备的性能。可以看到，2008 年的手机只有可怜的 140MB 内存，而今年的华为 Mate 20 Pro 手机的内存已经达到了 8GB。

![memory_device_class](/assets/images/android/master/memory_device_class_year.webp)

> 虽然此repo很长时间没有更新，但是按照 issue 中的说法，是因为最近几年设备的性能区别不是非常大，早些年的区别很大，所以目前判断到 2016 年就足够了。

内存看起来好像是我们都非常熟悉的概念，那请问问自己，手机内存和 PC 内存有哪什么差异呢？8GB 内存是不是就一定会比 4GB 内存更好？我想可能很多人都不一定能回答正确。

手机运行内存（RAM）其实相当于我们的 PC 中的内存，是手机中作为 App 运行过程中临时性数据暂时存储的内存介质。不过考虑到体积和功耗，手机不使用 PC 的 DDR 内存，采用的是 LPDDR RAM，全称是“低功耗双倍数据速率内存”，其中 LP 就是“Lower Power”低功耗的意思。

以 LPDDR4 为例，带宽 = 时钟频率 × 内存总线位数 ÷ 8，即 1600 × 64 ÷ 8 = 12.8GB/s，因为是 DDR 内存是双倍速率，所以最后的带宽是 12.8 × 2 = 25.6GB/s。

目前市面上的手机，主流的运行内存有 LPDDR3、LPDDR4 以及 LPDDR4X。可以看出 LPDDR4 的性能要比 LPDDR3 高出一倍，而 LPDDR4X 相比 LPDDR4 工作电压更低，所以也比 LPDDR4 省电 20%～40%。当然图中的数据是标准数据，不同的生成厂商会有一些低频或者高频的版本，性能方面高频要好于低频。

那手机内存是否越大越好呢？

如果一个手机使用的是 4GB 的 LPDDR4X 内存，另外一个使用的是 6GB 的 LPDDR3 内存，那么无疑选择 4GB 的运行内存手机要更加实用一些。

但是内存并不是一个孤立的概念，它跟操作系统、应用生态这些因素都有关。同样是 1GB 内存，使用 Android 9.0 系统会比 Android 4.0 系统流畅，使用更加封闭、规范的 iOS 系统也会比“狂野”的 Android 系统更好。今年发布的 iPhone XR 和 iPhone XS 使用的都是 LPDDR4X 的内存，不过它们分别只有 3GB 和 4GB 的大小。

### 内存问题

在前面所讲的崩溃分析中，我提到过“内存优化”是崩溃优化工作中非常重要的一部分。类似 OOM，很多的“异常退出”其实都是由内存问题引起。那么内存究竟能引发什么样的问题呢？

<large>1. 两个问题<large>

![memory_pss](/assets/images/android/master/memory_pss.webp)

内存造成的第一个问题是 **异常**。在前面的崩溃分析我提到过“异常率”，异常包括 OOM、内存分配失败这些崩溃，也包括因为整体内存不足导致应用被杀死、设备重启等问题。不知道你平时是否在工作中注意过，如果我们把用户设备的内存分成 2GB 以下和 2GB 以上两部分，你可以试试分别计算他们的异常率或者崩溃率，看看差距会有多大。

内存造成的第二个问题是 **卡顿**。Java 内存不足会导致频繁 GC，这个问题在 Dalvik 虚拟机会更加明显。而 ART 虚拟机在内存管理跟回收策略上都做大量优化，内存分配和 GC 效率相比提升了 5～10 倍。如果想具体测试 GC 的性能，例如暂停挂起时间、总耗时、GC 吞吐量，我们可以通过发送 **SIGQUIT 信号获得 ANR 日志**。

```shell
adb shell kill -s QUIT PID
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

<large>1. 两个误区<large>

除了内存引起的异常和卡顿，在日常做内存优化和架构设计时，很多同学还非常容易陷入两个误区之中。

**误区一：内存占用越少越好**  

VSS、PSS、Java 堆内存不足都可能会引起异常和卡顿。有些同学认为内存是洪水猛兽，占用越少应用的性能越好，这种认识在具体的优化过程中很容易“用力过猛”。

应用是否占用了过多的内存，跟设备、系统和当时情况有关，而不是 300MB、400MB 这样一个绝对的数值。当系统内存充足的时候，我们可以多用一些获得更好的性能。当系统内存不足的时候，希望可以做到“**用时分配，及时释放**”，就像下面这张图一样，当系统内存出现压力时，能够迅速释放各种缓存来减少系统压力。

![memory_lmk](/assets/images/android/master/memory_lmk.webp)

现在手机已经有 6GB 和 8GB 的内存出现了，Android 系统也希望去提升内存的利用率，因此我们有必要简单回顾一下 Android Bitmap 内存分配的变化。

- 在 Android 3.0 之前，Bitmap 对象放在 Java 堆，而像素数据是放在 Native 内存中。如果不手动调用 recycle，Bitmap Native 内存的回收完全依赖 finalize 函数回调，熟悉 Java 的同学应该知道，这个时机不太可控。
- Android 3.0～Android 7.0 将 Bitmap 对象和像素数据统一放到 Java 堆中，这样就算我们不调用 recycle，Bitmap 内存也会随着对象一起被回收。不过 Bitmap 是内存消耗的大户，把它的内存放到 Java 堆中似乎不是那么美妙。即使是最新的华为 Mate 20，最大的 Java 堆限制也才到 512MB，可能我的物理内存还有 5GB，但是应用还是会因为 Java 堆内存不足导致 OOM。Bitmap 放到 Java 堆的另外一个问题会引起大量的 GC，对系统内存也没有完全利用起来。
- 有没有一种实现，可以将 Bitmap 内存放到 Native 中，也可以做到和对象一起快速释放，同时 GC 的时候也能考虑这些内存防止被滥用？NativeAllocationRegistry 可以一次满足你这三个要求，Android 8.0 正是使用这个辅助回收 Native 内存的机制，来实现像素数据放到 Native 内存中。Android 8.0 还新增了硬件位图 Hardware Bitmap，它可以减少图片内存并提升绘制效率。

**误区二：Native 内存不用管**  

虽然 Android 8.0 重新将 Bitmap 内存放回到 Native 中，那么我们是不是就可以随心所欲地使用图片呢？

答案当然是否定的。正如前面所说当系统物理内存不足时，lmk 开始杀进程，从后台、桌面、服务、前台，直到手机重启。系统构想的场景就像下面这张图描述的一样，大家有条不絮的按照优先级排队等着被 kill。

![memory_process_oom](/assets/images/android/master/memory_process_oom.webp)

low memory killer 的设计，是假定我们都遵守 Android 规范，但并没有考虑到中国国情。国内很多应用就像是打不死的小强，杀死一个拉起五个。频繁的杀死、拉起进程，又会导致 system server 卡死。当然在 Android 8.0 以后应用保活变得困难很多，但依然有一些方法可以突破。

既然讲到了将图片的内存放到 Native 中，我们比较熟悉的是 Fresco 图片库在 Dalvik 会把图片放到 Native 内存中。事实上在 Android 5.0～Android 7.0，也能做到相同的效果，只是流程相对复杂一些。

步骤一：通过直接调用 libandroid_runtime.so 中 Bitmap 的构造函数，可以得到一张空的 Bitmap 对象，而它的内存是放到 Native 堆中。但是不同 Android 版本的实现有那么一点差异，这里都需要适配。

步骤二：通过系统的方法创建一张普通的 Java Bitmap。

步骤三：将 Java Bitmap 的内容绘制到之前申请的空的 Native Bitmap 中。

步骤四：将申请的 Java Bitmap 释放，实现图片内存的“偷龙转凤”。

```java
// 步骤一：申请一张空的 Native Bitmap
Bitmap nativeBitmap = nativeCreateBitmap(dstWidth, dstHeight, nativeConfig, 22);

// 步骤二：申请一张普通的 Java Bitmap
Bitmap srcBitmap = BitmapFactory.decodeResource(res, id);

// 步骤三：使用 Java Bitmap 将内容绘制到 Native Bitmap 中
mNativeCanvas.setBitmap(nativeBitmap);
mNativeCanvas.drawBitmap(srcBitmap, mSrcRect, mDstRect, mPaint);

// 步骤四：释放 Java Bitmap 内存
srcBitmap.recycle();
srcBitmap = null；
```

虽然最终图片的内存的确是放到 Native 中了，不过这个“黑科技”有两个主要问题，一个是兼容性问题，另外一个是频繁申请释放 Java Bitmap 容易导致内存抖动。

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

**1. Java 内存分配**

有些时候我们希望跟踪 Java 堆内存的使用情况，这个时候最常用的有 Allocation Tracker 和 MAT 这两个工具。

在我曾经写过的[《Android 内存申请分析》](https://mp.weixin.qq.com/s/b_lFfL1mDrNVKj_VAcA2ZA?)里，提到过 Allocation Tracker 的三个缺点。  
1. 获取的信息过于分散，中间夹杂着不少其他的信息，很多信息不是应用申请的，可能需要进行不少查找才能定位到具体的问题。  
2. 跟 Traceview 一样，无法做到自动化分析，每次都需要开发者手工开始 / 结束，这对于某些问题的分析可能会造成不便，而且对于批量分析来说也比较困难。  
3. 虽然在 Allocation Tracking 的时候，不会对手机本身的运行造成过多的性能影响，但是在停止的时候，直到把数据 dump 出来之前，经常会把手机完全卡死，如果时间过长甚至会直接 ANR。 
 
因此我们希望可以做到脱离 Android Studio，实现一个自定义的“Allocation Tracker”，实现对象内存的自动化分析。通过这个工具可以获取所有对象的申请信息（大小、类型、堆栈等），可以找到一段时间内哪些对象占用了大量的内存。

但是这个方法需要考虑的兼容性问题会比较多，在 Dalvik 和 ART 中，Allocation Tracker 的处理流程差异就非常大。下面是在 Dalvik 和 ART 中，Allocation Tacker 的开启方式。

```java
// dalvik
bool dvmEnableAllocTracker()
// art
void setAllocTrackingEnabled()
```

我们可以用自定义的“Allocation Tracker”来监控 Java 内存的监控，也可以拓展成实时监控 Java 内存泄漏。这方面经验不多的同学也不用担心，我在今天的“课后作业”提供了一个自定义的“Allocation Tracker”供你参考。**不过任何一个工具如果只需要做到线下自动化测试，实现起来会相对简单，但想要移植到线上使用，那就要更加关注兼容性、稳定性和性能，付出的努力要远远高于实验室方案。**

在课后作业中我们会提供一个简单的例子，在熟悉 Android Studio 中 Profiler 各种工具的实现原理后，我们就可以做各种各样的自定义改造，在后面的文章中也会有大量的例子供你参考和练习。

**2. Native 内存分配**

Android 的 Native 内存分析是一直做得非常不好，当然 Google 在近几个版本也做了大量努力，让整个过程更加简单。

首先 Google 之前将 Valgrind 弃用，建议我们使用 Chromium 的[AddressSanitize](https://source.android.com/devices/tech/debug/asan.html) 。遵循“谁最痛，谁最需要，谁优化”，所以 Chromium 出品了一大堆 Native 相关的工具。Android 之前对 AddressSanitize 支持的不太好，需要 root 和一大堆的操作，但在 Android 8.0 之后，我们可以根据这个[指南](http://github.com/google/sanitizers/wiki/AddressSanitizerOnAndroid)来使用 AddressSanitize。目前 AddressSanitize 内存泄漏检测只支持 x86_64 Linux 和 OS X 系统，不过相信 Google 很快就可以支持直接在 Android 上进行检测了.

那我们有没有类似 Allocation Tracker 那样的 Native 内存分配工具呢？在这方面，Android 目前的支持还不是太好，但 Android Developer 近来也补充了一些相关的文档，你可以参考[《调试本地内存使用》](https://source.android.com/devices/tech/debug/native-memory)。关于 Native 内存的问题，有两种方法，分别是Malloc 调试和Malloc 钩子。  

[Malloc 调试](http://android.googlesource.com/platform/bionic/+/master/libc/malloc_debug/README.md)可以帮助我们去调试 Native 内存的一些使用问题，例如堆破坏、内存泄漏、非法地址等。Android 8.0 之后支持在非 root 的设备做 Native 内存调试，不过跟 AddressSanitize 一样，需要通过[wrap.sh](http://developer.android.com/ndk/guides/wrap-script.html)做包装。  

```shell
adb shell setprop wrap.<APP> '"LIBC_DEBUG_MALLOC_OPTIONS=backtrace logwrapper"'
```

[Malloc 钩子](http://android.googlesource.com/platform/bionic/+/master/libc/malloc_hooks/README.md)是在 Android P 之后，Android 的 libc 支持拦截在程序执行期间发生的所有分配 / 释放调用，这样我们就可以构建出自定义的内存检测工具。  

```shell
adb shell setprop wrap.<APP> '"LIBC_HOOKS_ENABLE=1"'
```

但是在使用“Malloc 调试”时，感觉整个 App 都会变卡，有时候还会产生 ANR。如何在 Android 上对应用 Native 内存分配和泄漏做自动化分析，也是我最近想做的事情。据我了解，微信最近几个月在 Native 内存泄漏监控上也做了一些尝试，我会在专栏下一期具体讲讲。

### 总结

LPDDR5 将在明年进入量产阶段，移动内存一直向着更大容量、更低功耗、更高带宽的方向发展。伴随内存的发展，内存优化的挑战和解决方案也不断变化。而内存优化又是性能优化重要的一部分，今天我讲到了很多的异常和卡顿都是因为内存不足引起的，并在最后讲述了如何在日常开发中分析和测量内存的使用情况。

一个好的开发者并不满足于做完需求，我们在设计方案的时候，还需要考虑要使用多少的内存，应该怎么去管理这些内存。在需求完成之后，我们也应该去回归需求的内存情况，是否存在使用不当的地方，是否出现内存泄漏。

### 备注

“通过发送 SIGQUIT 信号获得 ANR 日志”这个方法已经在Matrix中进行了实装。Matrix中一个组件是捕获SIGQUIT信号来获取ANR日志的ANR监控模块，这里面也顺便实现了向自己发送SIGQUIT来打印出ANR日志的功能。