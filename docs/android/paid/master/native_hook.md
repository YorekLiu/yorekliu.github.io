---
title: "35 | Native Hook 技术，天使还是魔鬼？"
---

!!! tip "极客时间——[Android开发高手课](https://time.geekbang.org/column/intro/142)"
    本栏目内容源于[Android开发高手课](https://time.geekbang.org/column/intro/142)，外加Sample的个人练习小结。本栏目内的内容将会持续混合着博主个人的收集到的知识点。若本栏目内容令人不适，请移步原始课程。  

## Native Hook 的不同流派

对于 Native Hook 技术，比较常见的有 GOT/PLT Hook、Trap Hook 以及 Inline Hook，下面逐个讲解这些 Hook 技术的实现原理和优劣比较。

### 1. GOT/PLT Hook

在[Chapter06-plus](https://github.com/AndroidAdvanceWithGeektime/Chapter06-plus)中，我们使用了 PLT Hook 技术来获取线程创建的堆栈。先来回顾一下它的整个流程，我们将 libart.so 中的外部函数 pthread_create 替换成自己的方法 pthread_create_hook。

![native_hook_pthread](/assets/images/android/native_hook_pthread.webp)

你可以发现，GOT/PLT Hook 主要是用于替换某个 SO 的外部调用，通过将外部函数调用跳转成我们的目标函数。GOT/PLT Hook 可以说是一个非常经典的 Hook 方法，它非常稳定，可以达到部署到生产环境的标准。

那 GOT/PLT Hook 的实现原理究竟是什么呢？你需要先对 SO 库文件的 ELF 文件格式和动态链接过程有所了解。

#### ELF 格式

ELF（Executableand Linking Format）是可执行和链接格式，它是一个开放标准，各种 UNIX 系统的可执行文件大多采用 ELF 格式。虽然 ELF 文件本身就支持三种不同的类型（重定位、执行、共享），不同的视图下格式稍微不同，不过它有一个统一的结构，这个结构如下图所示。

![elf](/assets/images/android/native_hook_elf.png)

网上介绍 ELF 格式的文章非常多，你可以参考[《ELF 文件格式解析》](https://felixzhang00.github.io/2016/12/24/2016-12-24-ELF%E6%96%87%E4%BB%B6%E8%A3%85%E8%BD%BD%E9%93%BE%E6%8E%A5%E8%BF%87%E7%A8%8B%E5%8F%8Ahook%E5%8E%9F%E7%90%86/)。顾名思义，对于 GOT/PLT Hook 来说，我们主要关心“.plt”和“.got”这两个节区：

- .plt。该节保存过程链接表（Procedure Linkage Table）。
- .got。该节保存着全局的偏移量表。

我们也可以使用`readelf -S`来查看 ELF 文件的具体信息。

#### 链接过程

接下来我们再来看看动态链接的过程，当需要使用一个 Native 库（.so 文件）的时候，我们需要调用dlopen("libname.so")来加载这个库。

在我们调用了dlopen("libname.so")之后，系统首先会检查缓存中已加载的 ELF 文件列表。如果未加载则执行加载过程，如果已加载则计数加一，忽略该调用。然后系统会用从 libname.so 的dynamic节区中读取其所依赖的库，按照相同的加载逻辑，把未在缓存中的库加入加载列表。

你可以使用下面这个命令来查看一个库的依赖：

```shell
readelf -d <library> | grep NEEDED
```

下面我们大概了解一下系统是如何加载的 ELF 文件的。

- 读 ELF 的程序头部表，把所有 PT_LOAD 的节区 mmap 到内存中。
- 从“.dynamic”中读取各信息项，计算并保存所有节区的虚拟地址，然后执行重定位操作。
- 最后 ELF 加载成功，引用计数加一。

但是这里有一个关键点，在 ELF 文件格式中我们只有函数的绝对地址。如果想在系统中运行，这里需要经过 **重定位**。这其实是一个比较复杂的问题，因为不同机器的 CPU 架构、加载顺序不同，导致我们只能在运行时计算出这个值。不过还好动态加载器（/system/bin/linker）会帮助我们解决这个问题。

如果你理解了动态链接的过程，我们再回头来思考一下“.got”和“.plt”它们的具体含义。

- **The Global Offset Table (GOT)**。简单来说就是在数据段的地址表，假定我们有一些代码段的指令引用一些地址变量，编译器会引用 GOT 表来替代直接引用绝对地址，因为绝对地址在编译期是无法知道的，只有重定位后才会得到 ，GOT 自己本身将会包含函数引用的绝对地址。

- **The Procedure Linkage Table (PLT)**。PLT 不同于 GOT，它位于代码段，动态库的每一个外部函数都会在 PLT 中有一条记录，每一条 PLT 记录都是一小段可执行代码。 一般来说，外部代码都是在调用 PLT 表里的记录，然后 PLT 的相应记录会负责调用实际的函数。我们一般把这种设定叫作“[蹦床](https://en.wikipedia.org/wiki/Trampoline_%28computing%29)”（Trampoline）。

PLT 和 GOT 记录是一一对应的，并且 GOT 表第一次解析后会包含调用函数的实际地址。既然这样，那 PLT 的意义究竟是什么呢？PLT 从某种意义上赋予我们一种懒加载的能力。当动态库首次被加载时，所有的函数地址并没有被解析。下面让我们结合图来具体分析一下首次函数调用，请注意图中黑色箭头为跳转，紫色为指针。

![native_hook_plt_got](/assets/images/android/native_hook_plt_got.webp)

- 我们在代码中调用 func，编译器会把这个转化为 func@plt，并在 PLT 表插入一条记录。
- PLT 表中第一条（或者说第 0 条）PLT[0]是一条特殊记录，它是用来帮助我们解析地址的。通常在类 Linux 系统，这个的实现会位于动态加载器，就是专栏前面文章提到的 /system/bin/linker。
- 其余的 PLT 记录都均包含以下信息：
    - 跳转 GOT 表的指令（jmp *GOT[n]）。
    - 为上面提到的第 0 条解析地址函数准备参数。
    - 调用 PLT[0]，这里 resovler 的实际地址是存储在 GOT[2] 。
- 在解析前 GOT[n]会直接指向 jmp *GOT[n]的下一条指令。在解析完成后，我们就得到了 func 的实际地址，动态加载器会将这个地址填入 GOT[n]，然后调用 func。

如果对上面的这个调用流程还有疑问，你可以参考[《GOT 表和 PLT 表》](https://www.jianshu.com/p/0ac63c3744dd)这篇文章，它里面有一张图非常清晰。

![native_hook_plt_got2](/assets/images/android/native_hook_plt_got2.webp)

当第一次调用发生后，之后再调用函数 func 就高效简单很多。首先调用 PLT[n]，然后执行 jmp *GOT[n]。GOT[n]直接指向 func，这样就高效的完成了函数调用。

![native_hook_plt_got3](/assets/images/android/native_hook_plt_got3.webp)

总结一下，因为很多函数可能在程序执行完时都不会被用到，比如错误处理函数或一些用户很少用到的功能模块等，那么一开始把所有函数都链接好实际就是一种浪费。为了提升动态链接的性能，我们可以使用 PLT 来实现延迟绑定的功能。

对于函数运行的实际地址，我们依然需要通过 GOT 表得到，整个简化过程如下：

![native_hook_plt_got4](/assets/images/android/native_hook_plt_got4.webp)

看到这里，相信你已经有了如何 Hack 这一过程的初步想法。这里业界通常会根据修改 PLT 记录或者 GOT 记录区分为 GOT Hook 和 PLT Hook，但其本质原理十分接近。

#### GOT/PLT Hook 实践

GOT/PLT Hook 看似简单，但是实现起来也是有一些坑的，需要考虑兼容性的情况。一般来说，推荐使用业界的成熟方案。

- 微信 Matrix 开源库的[ELF Hook](https://github.com/Tencent/matrix/tree/master/matrix/matrix-android/matrix-android-commons/src/main/cpp/elf_hook)，它使用的是 GOT Hook，主要使用它来做性能监控。  
   > 微信Matrix里面的hook已经换成了爱奇艺的xHook了
- 爱奇艺开源的的[xHook](https://github.com/iqiyi/xHook)，它使用的也是 PLT Hook。
- Facebook 的[PLT Hook](https://github.com/facebookincubator/profilo/tree/master/deps/plthooks)。

如果不想深入它内部的原理，我们只需要直接使用这些开源的优秀方案就可以了。因为这种 Hook 方式非常成熟稳定，除了 Hook 线程的创建，我们还有很多其他的使用范例。

- “I/O 优化”中使用[matrix-io-canary](https://github.com/Tencent/matrix/tree/master/matrix/matrix-android/matrix-io-canary) Hook 文件的操作。
- “网络优化”中使用 Hook 了 Socket 的相关操作，具体你可以参考[Chapter17](https://github.com/AndroidAdvanceWithGeektime/Chapter17)。

这种 Hook 方法也不是万能的，因为它只能替换导入函数的方式。有时候我们不一定可以找到这样的外部调用函数。如果想 Hook 函数的内部调用，这个时候就需要用到我们的 Trap Hook 或者 Inline Hook 了。

### 2. Trap Hook

对于函数内部的 Hook，你可以先从头想一下，会发现调试器就具备一切 Hook 框架具有的能力，可以在目标函数前断住程序，修改内存、程序段，继续执行。相信很多同学都会使用调试器，但是对调试器如何工作却知之甚少。下面让我们先了解一下软件调试器是如何工作的。

#### ptrace

一般软件调试器都是通过 ptrace 系统调用和 SIGTRAP 配合来进行断点调试，首先我们来了解一下什么是 ptrace，它又是如何断住程序运行，然后修改相关执行步骤的。

所谓合格的底层程序员，对于未知知识的了解，第一步就是使用man命令来查看系统文档。

> The ptrace() system call provides a means by which one process (the “tracer”) may observe and control the execution of another process (the “tracee”), and examine and change the tracee’s memory and registers. It is primarily used to implement breakpoint debugging and system call tracing.

这段话直译过来就是，ptrace 提供了一种让一个程序（tracer）观察或者控制另一个程序（tracee）执行流程，以及修改被控制程序内存和寄存器的方法，主要用于实现调试断点和系统调用跟踪。

我们再来简单了解一下调试器（GDB/LLDB）是如何使用 ptrace 的。首先调试器会基于要调试进程是否已启动，来决定是使用 fork 或者 attach 到目标进程。当调试器与目标程序绑定后，目标程序的任何 signal（除 SIGKILL）都会被调试器做先拦截，调试器会有机会对相关信号进行处理，然后再把执行权限交由目标程序继续执行。可以你已经想到了，这其实已经达到了 Hook 的目的。

#### 如何 Hook

但更进一步思考，如果我们不需要修改内存或者做类似调试器一样复杂的交互，我们完全可以不依赖 ptrace，只需要接收相关 signal 即可。这时我们就想到了句柄（signal handler）。对！我们完全可以主动 raise signal，然后使用 signal handler 来实现类似的 Hook 效果。

业界也有不少人将 Trap Hook 叫作断点 Hook，它的原理就是在需要 Hook 的地方想办法触发断点，并捕获异常。一般我们会利用 SIGTRAP 或者 SIGKILL（非法指令异常）这两种信号。下面以 SIGTRAP 信号为例，具体的实现步骤如下。

![native_hook_trap_signal](/assets/images/android/native_hook_trap_signal.webp)

- 注册信号接收句柄（signal handler），不同的体系结构可能会选取不同的信号，我们这里用 SIGTRAP。
- 在我们需要 Hook 得部分插入 Trap 指令。
- 系统调用 Trap 指令，进入内核模式，调用我们已经在开始注册好的信号接收句柄（signal handler）。
- 执行我们信号接收句柄（signal handler），这里需要注意，所有在信号接收句柄（signal handler）执行的代码需要保证[async-signal-safe](http://man7.org/linux/man-pages/man7/signal-safety.7.html)。这里我们可以简单的只把信号接收句柄当作蹦床，使用 logjmp 跳出这个需要 async-signal-safe（正如我在“崩溃分析”所说的，部分函数在 signal 回调中使用并不安全）的环境，然后再执行我们 Hook 的代码。
- 在执行完 Hook 的函数后，我们需要恢复现场。这里如果我们想继续调用原来的函数 A，那直接回写函数 A 的原始指令并恢复寄存器状态。

#### Trap Hook 实践

Trap Hook 实践Trap Hook 兼容性非常好，它也可以在生产环境中大规模使用。但是它最大的问题是效率比较低，不适合 Hook 非常频繁调用的函数。

对于 Trap Hook 的实践方案，在“[卡顿优化（下）](https://time.geekbang.org/column/article/72642)”中，我提到过 Facebook 的[Profilo](https://github.com/facebookincubator/profilo)，它就是通过定期发送 SIGPROF 信号来实现卡顿监控的。

### 3. Inline Hook

跟 Trap Hook 一样，Inline Hook 也是函数内部调用的 Hook。它直接将函数开始（Prologue）处的指令更替为跳转指令，使得原函数直接跳转到 Hook 的目标函数函数，并保留原函数的调用接口以完成后续再调用回来的目的。

与 GOT/PLT Hook 相比，Inline Hook 可以不受 GOT/PLT 表的限制，几乎可以 Hook 任何函数。不过其实现十分复杂，我至今没有见过可以用在生产环境的实现。并且在 ARM 体系结构下，无法对叶子函数和很短的函数进行 Hook。

在深入“邪恶的”细节前，我们需要先对 Inline Hook 的大体流程有一个简单的了解。

![native_hook_inline_hook](/assets/images/android/native_hook_inline_hook.webp)

如图所示，Inline Hook 的基本思路就是在已有的代码段中插入跳转指令，把代码的执行流程转向我们实现的 Hook 函数中，然后再进行指令修复，并跳转回原函数继续执行。这段描述看起来是不是十分简单而且清晰？

对于 Trap Hook，我们只需要在目标地址前插入特殊指令，并且在执行结束后把原始指令写回去就可以了。但是对 Inline Hook 来说，它是直接进行指令级的复写与修复。怎么理解呢？就相当于我们在运行过程中要去做 ASM 的字节码修改。

当然 Inline Hook 远远比 ASM 操作更加复杂，因为它还涉及不同 CPU 架构带来的指令集适配问题，我们需要根据不同指令集来分别进行指令复写与跳转。

下面我先来简单说明一下 Android 常见的 CPU 架构和指令集：

- **x86 和 MIPS 架构**。这两个架构已经基本没有多少用户了，我们可以直接忽视。一般来说我们只关心主流的 ARM 体系架构就可以了。
- **ARMv5 和 ARMv7 架构**。它的指令集分为 4 字节对齐的定长的 ARM 指令集和 2 字节对齐的变长 Thumb/Thumb-2 指令集。Thumb-2 指令集虽为 2 字节对齐，但指令集本身有 16 位也有 32 位。其中 ARMv5 使用的是 16 位的 Thumb16，在 ARMv7 使用的是 32 位的 Thumb32。不过目前 ARMv5 也基本没有多少用户了，我们也可以放弃 Thumb16 指令集的适配。
- **ARMv8 架构**。64 位的 ARMv8 架构可以兼容运行 32 位，所以它在 ARM32 和 Thumb32 指令集的基础上，增加了 ARM64 指令集。关于它们具体差异，你可以查看[ARM 的官方文档](http://infocenter.arm.com/help/index.jsp?topic=/com.arm.doc.dui0801b/IBAIEGDJ.html)。

ARM64 目前我还没有适配，不过 Google Play 要求所有应用在 2019 年 8 月 1 日之前需要支持 64 位，所以今年上半年也要折腾一下。但它们的原理基本类似，下面我以最主流的 ARMv7 架构为例，为你庖丁解牛 Inline Hook。

#### ARM32 指令集

ARMv7 中有一种广为流传的$PC=$PC+8的说法。这是指 ARMv7 中的三级流水线（取指、解码、执行），换句话说$PC寄存器总是指向正在取指的指令，而不是指向正在执行的指令。取指总会比执行快 2 个指令，在 ARM32 指令集下 2 个指令的长度为 8 个字节，所以$PC寄存器的值总是比当前指令地址要大 8。

![native_hook_armeabiv7](/assets/images/android/native_hook_armeabiv7.webp)

是不是感觉有些复杂，其实这是为了引出 ARM 指令集的常用跳转方法：LDR PC, [PC, #-4] ;0xE51FF004$TRAMPOLIN_ADDR

```
LDR PC, [PC, #-4] ;0xE51FF004
$TRAMPOLIN_ADDR
```

在了解了三级流水线以后，就不会对这个 PC-4 有什么疑惑了。

按照我们前面描述的 Inline Hook 的基本步骤，首先插入跳转指令，跳入我们的蹦床（Trampoline），执行我们实现的 Hook 后函数。这里还有一个“邪恶的”细节，由于指令执行是依赖当前运行环境的，即所有寄存器的值，而我们插入新的指令是有可能更改寄存器的状态的，所以我们要保存当前全部的寄存器状态到栈中，使用 BLX 指令跳转执行 Hook 后函数，执行完成后，再从栈中恢复所有的寄存器，最后才能像未 Hook 一样继续执行原先函数。

![native_hook_restore_pc](/assets/images/android/native_hook_restore_pc.webp)

在执行完 Hook 后的函数后，我们需要跳转回原先的函数继续执行。这里不要忘记我们在一开始覆盖的 LDR 指令，我们需要先执行被我们复写的指令，然后再使用如下指令，继续执行原先函数。

```
LDR PC, [PC, #-4]
HOOKED_ADDR+8
```

是不是有一种大功告成的感觉？其实这里还有一个巨大的坑在等着我们，那就是 **指令修复**。前面我提到保存并恢复了寄存器原有的状态，已达到可以继续像原有程序一样的继续执行。但仅仅是恢复寄存器就足够么？显然答案是否定的，虽然寄存器被我们完美恢复了，但是 2 条备份的指令被移动到了新的地址。当执行它们的时候，$PC寄存器的值是与原先不同的。这条指令的操作如果涉及$PC的值，那么它们将会执行出完全不同的结果。

到这里我就不对指令修复再深入解析了，感兴趣的同学可以在留言区进行讨论。

#### Inline Hook 实践

对于 Inline Hook，虽然它功能非常强大，而且执行效率也很高，但是业界目前还没有一套完全稳定可靠的开源方案。Inline Hook 一般会使用在自动化测试或者线上疑难问题的定位，例如“UI 优化”中说到 libhwui.so 崩溃问题的定位，我们就是利用 Inline Hook 去收集系统信息。

业界也有一些不错的参考方案：
- [Cydia Substrate](http://www.cydiasubstrate.com/)。在[Chapter3](https://github.com/AndroidAdvanceWithGeektime/Chapter03)中，我们就使用它来 Hook 系统的内存分配函数。
- [adbi](https://github.com/crmulliner/adbi)。支付宝在[GC 抑制](https://juejin.cn/post/6844903705028853767)中使用的 Hook 框架，不过已经好几年没有更新了。

## 各个流派的优缺点比较

最后我们再来总结一下不同的 Hook 方式的优缺点：

1. GOT/PLT Hook 是一个比较中庸的方案，有较好的性能，中等的实现难度，但其只能 Hook 动态库之间的调用的函数，并且无法 Hook 未导出的私有函数，而且只存在安装与卸载 2 种状态，一旦安装就会 Hook 所有函数调用。

2. Trap Hook 最为稳定，但由于需要切换运行模式（R0/R3），且依赖内核的信号机制，导致性能很差。

3. Inline Hook 是一个非常激进的方案，有很好的性能，并且也没有 PLT 作用域的限制，可以说是一个非常灵活、完美的方案。但其实现难度极高，我至今也没有看到可以部署在生产环境的 Inline Hook 方案，因为涉及指令修复，需要编译器的各种优化。

![native_hook_difference](/assets/images/android/native_hook_difference.webp)

但是需要注意，无论是哪一种 Hook 都只能 Hook 到应用自身的进程，我们无法替换系统或其他应用进程的函数执行。

## 总结

总的来说 Native Hook 是一门非常底层的技术，它会涉及库文件编译、加载、链接等方方面面的知识，而且很多底层知识是与 Android 甚至移动平台无关的。在这一领域，做安全的同学可能会更有发言权，我来讲可能班门弄斧了。不过希望通过这篇文章，让你对看似黑科技的 Hook 有一个大体的了解，希望可以在自己的平时的工作中使用 Hook 来完成一些看似不可能的任务，比如修复系统 Bug、线上监控 Native 内存分配等。

## 推荐文章

Native Hook 技术的确非常复杂，即使我们不懂得它的内部原理，我们也应该学会使用成熟的开源框架去实现一些功能。当然对于想进一步深入研究的同学，推荐你学习下面这些资料。

- [链接程序和库指南](https://docs.oracle.com/cd/E37934_01/pdf/E36754.pdf)
- [程序员的自我修养：链接、装载与库](https://item.jd.com/10067200.html)
- [链接器和加载器 Linkers and Loaders](https://search.jd.com/Search?keyword=%E9%93%BE%E6%8E%A5%E5%99%A8%E4%B8%8E%E5%8A%A0%E8%BD%BD%E5%99%A8&enc=utf-8)
- [Linux 二进制分析 Learning Linux Binary Analysis](https://item.jd.com/12240585.html)

如果你对调试器的研究也非常有兴趣，强烈推荐[Eli Bendersky](https://eli.thegreenplace.net/)写的博客，里面有一系列非常优秀的底层知识文章。其中一些关于 debugger 的，感兴趣的同学可以去阅读，并亲手实现一个简单的调试器。

- [how-debuggers-work-part-1](https://eli.thegreenplace.net/2011/01/23/how-debuggers-work-part-1)
- [how-debuggers-work-part-2-breakpoints](https://eli.thegreenplace.net/2011/01/27/how-debuggers-work-part-2-breakpoints)
- [how-debuggers-work-part-3-debugging-information](https://eli.thegreenplace.net/2011/02/07/how-debuggers-work-part-3-debugging-information)

???+ tip "Name Mangling"  
    C++函数名会有一个Name Mangling的机制。  
    `readelf -s xxx.so` 可以查看so里面的函数名，对于C++是mangling的。
    MacOS 内置了 `c++filt` 可以进行 demangle：  
    ```shell
    $ c++filt -n _ZNK3MapI10StringName3RefI8GDScriptE10ComparatorIS0_E16DefaultAllocatorE3hasERKS0_
    Map<StringName, Ref<GDScript>, Comparator<StringName>, DefaultAllocator>::has(StringName const&) const
    ```

## readelf指令

**显示节头信息：readelf -S**

```shell
$readelf -S <library>
There are 39 section headers, starting at offset 0x108a3c:

Section Headers:
  [Nr] Name              Type            Addr     Off    Size   ES Flg Lk Inf Al
  [ 0]                   NULL            00000000 000000 000000 00      0   0  0
  [ 1] .note.android.ide NOTE            00000134 000134 000098 00   A  0   0  4
  [ 2] .note.gnu.build-i NOTE            000001cc 0001cc 000024 00   A  0   0  4
  [ 3] .dynsym           DYNSYM          000001f0 0001f0 0020d0 10   A  4   1  4
  [ 4] .dynstr           STRTAB          000022c0 0022c0 0027fc 00   A  0   0  1
  [ 5] .gnu.hash         GNU_HASH        00004abc 004abc 000d70 04   A  3   0  4
  [ 6] .hash             HASH            0000582c 00582c 001060 04   A  3   0  4
  [ 7] .gnu.version      VERSYM          0000688c 00688c 00041a 02   A  3   0  2
  [ 8] .gnu.version_d    VERDEF          00006ca8 006ca8 00001c 00   A  4   1  4
  [ 9] .gnu.version_r    VERNEED         00006cc4 006cc4 000040 00   A  4   2  4
  [10] .rel.dyn          REL             00006d04 006d04 002c68 08   A  3   0  4
  [11] .rel.plt          REL             0000996c 00996c 000680 08   A  3   0  4
  [12] .plt              PROGBITS        00009fec 009fec 0009d4 00  AX  0   0  4
  [13] .text             PROGBITS        0000a9c0 00a9c0 00e874 00  AX  0   0  4
  [14] .ARM.exidx        ARM_EXIDX       00019234 019234 001190 08  AL 13   0  4
  [15] .ARM.extab        PROGBITS        0001a3c4 01a3c4 001514 00   A  0   0  4
  [16] .rodata           PROGBITS        0001b8d8 01b8d8 002e68 00   A  0   0  4
  [17] .data.rel.ro      PROGBITS        00020384 01f384 001768 00  WA  0   0  4
  [18] .fini_array       FINI_ARRAY      00021aec 020aec 000008 00  WA  0   0  4
  [19] .init_array       INIT_ARRAY      00021af4 020af4 000008 00  WA  0   0  4
  [20] .dynamic          DYNAMIC         00021afc 020afc 000130 08  WA  4   0  4
  [21] .got              PROGBITS        00021c2c 020c2c 0003d4 00  WA  0   0  4
  [22] .data             PROGBITS        00022000 021000 00008c 00  WA  0   0  4
  [23] .bss              NOBITS          00022090 021090 000269 00  WA  0   0 16
  [24] .comment          PROGBITS        00000000 02108c 0000b6 01  MS  0   0  1
  [25] .debug_str        PROGBITS        00000000 021142 02bacc 01  MS  0   0  1
  [26] .debug_loc        PROGBITS        00000000 04cc0e 016891 00      0   0  1
  [27] .debug_abbrev     PROGBITS        00000000 06349f 0050b9 00      0   0  1
  [28] .debug_info       PROGBITS        00000000 068558 045947 00      0   0  1
  [29] .debug_ranges     PROGBITS        00000000 0ade9f 002e60 00      0   0  1
  [30] .debug_macinfo    PROGBITS        00000000 0b0cff 00001f 00      0   0  1
  [31] .debug_frame      PROGBITS        00000000 0b0d20 004984 00      0   0  4
  [32] .debug_line       PROGBITS        00000000 0b56a4 017861 00      0   0  1
  [33] .debug_aranges    PROGBITS        00000000 0ccf08 0000a0 00      0   0  8
  [34] .note.gnu.gold-ve NOTE            00000000 0ccfa8 00001c 00      0   0  4
  [35] .ARM.attributes   ARM_ATTRIBUTES  00000000 0ccfc4 000036 00      0   0  1
  [36] .symtab           SYMTAB          00000000 0ccffc 02c3b0 10     37 10799  4
  [37] .strtab           STRTAB          00000000 0f93ac 00f4f0 00      0   0  1
  [38] .shstrtab         STRTAB          00000000 10889c 0001a0 00      0   0  1
Key to Flags:
  W (write), A (alloc), X (execute), M (merge), S (strings), I (info),
  L (link order), O (extra OS processing required), G (group), T (TLS),
  C (compressed), x (unknown), o (OS specific), E (exclude),
  y (noread), p (processor specific)
```

**查看库的依赖: readelf -d**

```shell
$readelf -d <library> | grep NEEDED
Dynamic section at offset 0x20afc contains 33 entries:
  Tag        Type                         Name/Value
 0x00000003 (PLTGOT)                     0x21cb4
 0x00000002 (PLTRELSZ)                   1664 (bytes)
 0x00000017 (JMPREL)                     0x996c
 0x00000014 (PLTREL)                     REL
 0x00000011 (REL)                        0x6d04
 0x00000012 (RELSZ)                      11368 (bytes)
 0x00000013 (RELENT)                     8 (bytes)
 0x6ffffffa (RELCOUNT)                   947
 0x00000006 (SYMTAB)                     0x1f0
 0x0000000b (SYMENT)                     16 (bytes)
 0x00000005 (STRTAB)                     0x22c0
 0x0000000a (STRSZ)                      10236 (bytes)
 0x6ffffef5 (GNU_HASH)                   0x4abc
 0x00000004 (HASH)                       0x582c
 0x00000001 (NEEDED)                     Shared library: [libwebp-decoder.so]
 0x00000001 (NEEDED)                     Shared library: [libjnigraphics.so]
 0x00000001 (NEEDED)                     Shared library: [liblog.so]
 0x00000001 (NEEDED)                     Shared library: [libdl.so]
 0x00000001 (NEEDED)                     Shared library: [libm.so]
 0x00000001 (NEEDED)                     Shared library: [libc.so]
 0x0000000e (SONAME)                     Library soname: [libframesequence.so]
 0x0000001a (FINI_ARRAY)                 0x21aec
 0x0000001c (FINI_ARRAYSZ)               8 (bytes)
 0x00000019 (INIT_ARRAY)                 0x21af4
 0x0000001b (INIT_ARRAYSZ)               8 (bytes)
 0x0000001e (FLAGS)                      BIND_NOW
 0x6ffffffb (FLAGS_1)                    Flags: NOW
 0x6ffffff0 (VERSYM)                     0x688c
 0x6ffffffc (VERDEF)                     0x6ca8
 0x6ffffffd (VERDEFNUM)                  1
 0x6ffffffe (VERNEED)                    0x6cc4
 0x6fffffff (VERNEEDNUM)                 2
 0x00000000 (NULL)                       0x0
```