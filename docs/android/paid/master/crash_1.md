---
title: "01 | 崩溃优化（上）：关于“崩溃”那些事儿"
---

!!! tip "极客时间——[Android开发高手课](https://time.geekbang.org/column/intro/142)"
    本栏目内容源于[Android开发高手课](https://time.geekbang.org/column/intro/142)，外加Sample的个人练习小结。本栏目内的内容将会持续混合着博主个人的收集到的知识点。若本栏目内容令人不适，请移步原始课程。  

### Android 的两种崩溃

*UncaughtExceptionHandler捕获Java异常，使用BreakPad的底层机制捕获Native异常*  

Bugly出品 [Android 平台 Native 代码的崩溃捕获机制及实现](https://mp.weixin.qq.com/s/g-WzYF3wWAljok1XjPoo7w?)

1. Native 崩溃的捕获流程：编译端保留符号文件，客户端捕获奔溃上传服务器，服务器获取日志匹配符号文件进行解析。   
2. Native 崩溃的捕获难点：怎么样保证客户端在各种极端情况下依然可以生成崩溃日志？  
      - 情况一：文件句柄泄漏，导致创建日志文件失败，怎么办？  
      应对方式：我们需要提前申请文件句柄 fd 预留，防止出现这种情况。  
      - 情况二：因为栈溢出了，导致日志生成失败，怎么办？  
      应对方式：为了防止栈溢出导致进程没有空间创建调用栈执行处理函数，我们通常会使用常见的 signalstack。在一些特殊情况，我们可能还需要直接替换当前栈，所以这里也需要在堆中预留部分空间。  
      - 情况三：整个堆的内存都耗尽了，导致日志生成失败，怎么办？  
      应对方式：这个时候我们无法安全地分配内存，也不敢使用 stl 或者 libc 的函数，因为它们内部实现会分配堆内存。这个时候如果继续分配内存，会导致出现堆破坏或者二次崩溃的情况。Breakpad 做的比较彻底，重新封装了Linux Syscall Support，来避免直接调用 libc。  
      - 情况四：堆破坏或二次崩溃导致日志生成失败，怎么办？  
      应对方式：Breakpad 会从原进程 fork 出子进程去收集崩溃现场，此外涉及与 Java 相关的，一般也会用子进程去操作。这样即使出现二次崩溃，只是这部分的信息丢失，我们的父进程后面还可以继续获取其他的信息。在一些特殊的情况，我们还可能需要从子进程 fork 出孙进程。
3. 选择合适的崩溃服务：Bugly、啄木鸟、Firebase等等  

### 如何客观地衡量崩溃

1. UV 崩溃率：
    ```java
    UV 崩溃率 = 发生崩溃的 UV / 登录 UV
    ```
2. PV 崩溃率
3. 启动崩溃率  
    这里为什么要单独统计启动崩溃率呢？因为启动崩溃对用户带来的伤害最大，应用无法启动往往通过热修复也无法拯救。闪屏广告、运营活动，很多应用启动过程异常复杂，又涉及各种资源、配置下发，极其容易出现问题。微信读书、蘑菇街、淘宝、天猫这些“重运营”的应用都有使用一种叫作[**“安全模式”**](https://mp.weixin.qq.com/s?__biz=MzUxMzcxMzE5Ng==&mid=2247488429&idx=1&sn=448b414a0424d06855359b3eb2ba8569&source=41#wechat_redirect)的技术来保障客户端的启动流程，在监控到客户端启动失败后，给用户自救的机会。

???+ success "UV与PV"
    UV是每日中去重后的，PV是每次的访问。UV崩溃率一般会比PV崩溃率高。


### 如何客观地衡量稳定性

ANR如何发现？  

1. 使用 FileObserver 监听 /data/anr/traces.txt 的变化。  
    非常不幸的是，很多高版本的 ROM，已经没有读取这个文件的权限了。这个时候你可能只能思考其他路径，海外可以使用 Google Play 服务，而国内微信利用[Hardcoder](https://mp.weixin.qq.com/s/9Z8j3Dv_5jgf7LDQHKA0NQ?)框架（HC 框架是一套独立于安卓系统实现的通信框架，它让 App 和厂商 ROM 能够实时“对话”了，目标就是充分调度系统资源来提升 App 的运行速度和画质，切实提高大家的手机使用体验）向厂商获取了更大的权限。
2. 监控消息队列的运行时间。这个方案无法准确地判断是否真正出现了 ANR 异常，也无法得到完整的 ANR 日志。在我看来，更应该放到卡顿的性能范畴。  

应用退出的情形：  

- 主动自杀。Process.killProcess()、exit() 等。
- 崩溃。出现了 Java 或 Native 崩溃。
- 系统重启；系统出现异常、断电、用户主动重启等，我们可以通过比较应用开机运行时间是否比之前记录的值更小。
- 被系统杀死。被 low memory killer 杀掉、从系统的任务管理器中划掉等。
- ANR。
   
我们可以在应用启动的时候设定一个标志，在主动自杀或崩溃后更新标志，这样下次启动时通过检测这个标志就能确认运行期间是否发生过异常退出。对应上面的五种退出场景，我们排除掉主动自杀和崩溃（崩溃会单独的统计）这两种场景，希望可以监控到剩下三种的异常退出，理论上这个异常捕获机制是可以达到 100% 覆盖的。  

通过这个异常退出的检测，可以反映如 ANR、low memory killer、系统强杀、死机、断电等其他无法正常捕获到的问题。当然异常率会存在一些误报，比如用户从系统的任务管理器中划掉应用。对于线上的大数据来说，还是可以帮助我们发现代码中的一些隐藏问题。  

**异常率：UV 异常率 = 发生异常退出或崩溃的 UV / 登录 UV**  

根据应用的前后台状态，我们可以把异常退出分为前台异常退出和后台异常退出。“被系统杀死”是后台异常退出的主要原因，当然我们会更关注前台的异常退出的情况，这会跟 ANR、OOM 等异常情况有更大的关联。  
通过异常率我们可以比较全面的评估应用的稳定性，对于线上监控还需要完善崩溃的报警机制。在微信我们可以做到 5 分钟级别的崩溃预警，确保能在第一时间发现线上重大问题，尽快决定是通过发版还是动态热修复解决问题。


### 课后作业

使用Breakpad捕获一个native崩溃。

按照[Sample](https://github.com/AndroidAdvanceWithGeektime/Chapter01)的readme来，总体来说还是比较顺利的。除了minidump_stackwalk这一步。

下面记录一下一些过程。

1. 下载sample、import project，然后配置工程ndk。这样就可以编译成功了

2. 点击crash按钮触发native crash

3. 从手机中取出***.dmp文件，开始解析  
    ```shell
    adb pull /sdcard/crashDump .
    ```

4. 使用`minidump_stackwalk`工具生成堆栈跟踪log。注意sample中的`tools/mac/minidump_stackwalker`可能无法正常使用，查阅资料发现，android sdk里面有这个工具，且可以正常使用。  
    sample中的工具无法正常解析：
    ```shell
    $ tools/mac/minidump_stackwalk ~/Downloads/crashDump/5f80da03-05ec-4dc0-229cd696-9f22b046.dmp > ~/Downloads/crash.txt
    dyld: Symbol not found: __ZTTNSt7__cxx1118basic_stringstreamIcSt11char_traitsIcESaIcEEE
      Referenced from: /Users/yorekliu/Code/Geek/Chapter01-master/tools/mac/./minidump_stackwalk
      Expected in: /usr/lib/libstdc++.6.dylib
     in /Users/yorekliu/Code/Geek/Chapter01-master/tools/mac/./minidump_stackwalk
    [1]    4543 abort      ./minidump_stackwalk  > ~/Downloads/crash.txt
    ```
   
    Android sdk中的工具可以解析出文件，虽然报了一大堆ERROR的日志：
    ```shell
    $ ~/Library/Android/sdk/lldb/3.1/bin/minidump_stackwalk 5f80da03-05ec-4dc0-229cd696-9f22b046.dmp > crash.txt
    ```
   
5. 查看crash发生的线程以及位置和寄存器信息  
    ```shell
    $ head -20 crash.txt
    
    Operating system: Android
                      0.0.0 Linux 4.9.200-gefe7b0929fbd-ab6216672 #0 SMP PREEMPT Tue Feb 18 22:08:24 UTC 2020 aarch64
    CPU: arm64
         8 CPUs
    
    Crash reason:  SIGSEGV
    Crash address: 0x0
    Process uptime: not available
    
    Thread 0 (crashed)              // crash发生的线程
     0  libcrash-lib.so + 0x5e0     // crash位置和寄存器信息  
         x0 = 0x0000007cf32c16c0    x1 = 0x0000007fc9ce82f4
         x2 = 0x0000000000000001    x3 = 0x0000000003e103e1
         x4 = 0x12c805a812c805a8    x5 = 0x0000007c6e0f288c
         x6 = 0x0000000000000001    x7 = 0x000000000000206e
         x8 = 0x0000000000000001    x9 = 0x0000000000000000
        x10 = 0x0000000000430000   x11 = 0x0000007c00000000
        x12 = 0x0000000000000030   x13 = 0x000000000775fb88
        x14 = 0x0000000000000006   x15 = 0xffffffffffffffff
        x16 = 0x0000007c061b7fe8   x17 = 0x0000007c061a75cc
    ```

6. 使用`addr2line`解析符号，可以查看到crash的位置：
    ```shell
    $ ~/Library/Android/sdk/ndk/16.1.4479499/toolchains/aarch64-linux-android-4.9/prebuilt/darwin-x86_64/bin/aarch64-linux-android-addr2line -f -C -e ~/Code/Geek/Chapter01-master/sample/build/intermediates/cmake/debug/obj/arm64-v8a/libcrash-lib.so 0x5e0
    Crash()
    /Users/yorekliu/Code/Geek/Chapter01-master/sample/.externalNativeBuild/cmake/debug/arm64-v8a/../../../../src/main/cpp/crash.cpp:10
    ```
   
    或者
    ```shell
    $ ~/Library/Android/sdk/ndk/16.1.4479499/toolchains/aarch64-linux-android-4.9/prebuilt/darwin-x86_64/bin/aarch64-linux-android-addr2line -f -C -e ~/Code/Geek/Chapter01-master/sample/build/intermediates/transforms/mergeJniLibs/debug/0/lib/arm64-v8a/libcrash-lib.so 0x5e0 
    Crash()
    /Users/yorekliu/Code/Geek/Chapter01-master/sample/.externalNativeBuild/cmake/debug/arm64-v8a/../../../../src/main/cpp/crash.cpp:10
    ```


除了使用不知道怎么出现的`minidump_stackwalk`外，我们还可以从breakpad自行编译出`minidump_stackwalk`，过程如下：

1. 下载breakpad的源码，在其`src/third_party`下clone linux-syscall-support的源码：
    ```shell
    ~/Code/Geek/breakpad/src/third_party$ git clone git clone https://chromium.googlesource.com/linux-syscall-support lss
    ```  
    当然上面这个lss我一直下载不下来，所以无奈之下copy了sample里面的内容。
2. 按照breakpad的readme进行编译：
    ```shell
     ~/Code/Geek/breakpad$ ./configure && make
     ~/Code/Geek/breakpad$ sudo make install 
    ```
3. 然后就可以在任意位置直接使用`minidump_stackwalk`了：
    ```shell
    minidump_stackwalk 5f80da03-05ec-4dc0-229cd696-9f22b046.dmp > crash.txt
    ```