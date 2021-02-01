---
title: "03 | 内存优化（上）：4GB内存时代，再谈内存优化"
---

!!! note "极客时间——[Android开发高手课](https://time.geekbang.org/column/intro/142)"
    本博客上的这些内容全是CV自[Android开发高手课](https://time.geekbang.org/column/intro/142)的原始内容，外加Sample的个人练习小结。若CV这个行动让您感到不适，请移步即可。  

**内存问题**  

内存会引发两个问题：异常以及卡顿。  
内存的两个误区：  

1. 内存占用越少越好？  
   当系统内存充足的时候，我们可以多用一些获得更好的性能。当系统内存不足的时候，希望可以做到“用时分配，及时释放”
2. Native 内存不用管？  
   当系统物理内存不足时，lmk 开始杀进程，从后台、桌面、服务、前台，直到手机重启  

**测量方法**  

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