---
title: "03 | 内存优化（上）：4GB内存时代，再谈内存优化"
---

!!! note "极客时间——[Android开发高手课](https://time.geekbang.org/column/intro/142)"
    本博客上的这些内容全是CV自[Android开发高手课](https://time.geekbang.org/column/intro/142)的原始内容，外加Sample的个人练习小结。若CV这个行动让您感到不适，请移步即可。  

**内存问题**  

内存会引发两个问题：异常以及卡顿。  

![memory_pss](/assets/images/android/master/memory_pss.webp)

---

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

---

内存的两个误区：  

1. 内存占用越少越好？  
   当系统内存充足的时候，我们可以多用一些获得更好的性能。当系统内存不足的时候，希望可以做到“用时分配，及时释放”
2. Native 内存不用管？  
   当系统物理内存不足时，lmk 开始杀进程，从后台、桌面、服务、前台，直到手机重启  

**测量方法**  



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

Java内存分配：

1. Allocation Tracker：跟踪 Java 堆内存的使用情况  
    三个缺点：
    1. 获取的信息过于分散，中间夹杂着不少其他的信息，很多信息不是应用申请的，可能需要进行不少查找才能定位到具体的问题。
    2. 跟 Traceview 一样，无法做到自动化分析，每次都需要开发者手工开始 / 结束，这对于某些问题的分析可能会造成不便，而且对于批量分析来说也比较困难。
    3. 虽然在 Allocation Tracking 的时候，不会对手机本身的运行造成过多的性能影响，但是在停止的时候，直到把数据 dump 出来之前，经常会把手机完全卡死，如果时间过长甚至会直接 ANR。
2. MAT分析堆内存  

Native内存分配检测：

1. AddressSanitize：首先 Google 之前将 Valgrind 弃用，建议我们使用 Chromium 的[AddressSanitize](https://source.android.com/devices/tech/debug/asan.html) 。遵循“谁最痛，谁最需要，谁优化”，所以 Chromium 出品了一大堆 Native 相关的工具。Android 之前对 AddressSanitize 支持的不太好，需要 root 和一大堆的操作，但在 Android 8.0 之后，我们可以根据这个[指南](http://github.com/google/sanitizers/wiki/AddressSanitizerOnAndroid)来使用 AddressSanitize。目前 AddressSanitize 内存泄漏检测只支持 x86_64 Linux 和 OS X 系统，不过相信 Google 很快就可以支持直接在 Android 上进行检测了。
2. malloc调试、malloc钩子：那我们有没有类似 Allocation Tracker 那样的 Native 内存分配工具呢？在这方面，Android 目前的支持还不是太好，但 Android Developer 近来也补充了一些相关的文档，你可以参考[《调试本地内存使用》](https://source.android.com/devices/tech/debug/native-memory)。关于 Native 内存的问题，有两种方法，分别是Malloc 调试和Malloc 钩子。  
    [Malloc 调试](http://android.googlesource.com/platform/bionic/+/master/libc/malloc_debug/README.md)可以帮助我们去调试 Native 内存的一些使用问题，例如堆破坏、内存泄漏、非法地址等。Android 8.0 之后支持在非 root 的设备做 Native 内存调试，不过跟 AddressSanitize 一样，需要通过[wrap.sh](http://developer.android.com/ndk/guides/wrap-script.html)做包装。  
    [Malloc 钩子](http://android.googlesource.com/platform/bionic/+/master/libc/malloc_hooks/README.md)是在 Android P 之后，Android 的 libc 支持拦截在程序执行期间发生的所有分配 / 释放调用，这样我们就可以构建出自定义的内存检测工具。