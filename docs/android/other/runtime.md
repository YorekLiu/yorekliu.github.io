---
title: "Android Runtime"
---

首先介绍一下这些概念：

- Dalvik：Android 5.0以前默认的虚拟机，采用JIT (Just In Time) 编译。  

- ART (Android Runtime)：Android 4.4体验模式、5.0及以上使用的虚拟机，采用AOT (Ahead Of Time) 编译。

- JIT (Just In Time) 及时编译：程序运行起来后，实时地把代码编译为机器语言然后执行

- AOT (Ahead Of Time) 预先编译：在软件安装的时候把代码编译成机器代码

## 1. Dalvik与JVM的区别

1. Dalvik 基于寄存器，而 JVM 基于栈。基于寄存器的虚拟机在执行的时候花费的时间更短。
2. Java虚拟机运行java字节码，Dalvik虚拟机运行的是其专有的文件格式Dex (Dalvik Executable)。

## 2. JIT与AOT的区别

|  | RAM占用 | ROM占用 | 流畅度 | 省电 | 兼容性 | 加载速度 |
|  |  |  |  | --------------- | ---------- | ---------- |
| Just-in-time | 大 | 小 | 普通 | 普通 | 好 | 慢 |
| Ahead-of-time | 小 | 大 | 好 | 好 | 普通 | 快 |

JIT与AOT的区别主要是编译发生的时间不同所导致的：

- AOT 提前编译会导致安装时比较慢，编译后的产物也会占用一定的存储空间
- JIT 及时编译安装过程很快，但是运行时需要编译，所以会性能消耗和内存消耗

## 3. Android运行时演进

1. 在Android 5.0之前，使用JIT模式。由于边解释边执行，所以效率比较低。
2. 在Android 5.0 ~ 6.0，使用AOT模式。效率高，但是安装时间长。
3. 从Android 7.0 到现在，采用解释器 + JIT + AOT这种混合模式。
4. 在Android 8.0上改进了解释器，解释模式执行效率大幅提升
5. Android 10上提供了预先放置热点代码的方式，应用在安装的时候就能知道常用代码会被提前编译(Google Play)。

下面主要介绍Android 7.0上引进的解释器+JIT+AOT混合模式。    

在[Android 7.0 改进](https://developer.android.com/about/versions/nougat/android-7.0#jit_aot)文中我们可以看到这么一段关于混合编译的说明：  
在 Android 7.0 中，我们添加了即时 (JIT) 编译器，对 ART 进行代码分析，让它可以在应用运行时持续提升 Android 应用的性能。JIT 编译器对 Android 运行组件当前的 Ahead of Time (AOT) 编译器进行了补充，有助于提升运行时性能，节省存储空间，加快应用更新和系统更新速度。  
配置文件指导的编译让 Android 运行组件能够根据应用的实际使用以及设备上的情况管理每个应用的 AOT/JIT 编译。例如，Android 运行组件维护每个应用热方法的配置文件，并且可以预编译和缓存这些方法以实现最佳性能。对于应用的其他部分，在实际使用之前不会进行编译。  
除提升应用的关键部分的性能外，配置文件指导的编译还有助于减少整个 RAM 占用，包括关联的二进制文件。此功能对于低内存设备非常尤其重要。  
Android 运行组件在管理配置文件指导的编译时，可最大程度降低对设备电池的影响。仅当设备处于空闲状态和充电时才进行编译，从而可以通过提前执行该工作节约时间和省电。  

关于混合模式的具体流程，在[实现 ART 即时 (JIT) 编译器](https://source.android.com/devices/tech/dalvik/jit-compiler)一文中也有提及：

![JIT Workflow](/assets/images/android/jit-workflow.png)

- 在不影响前台应用性能的情况下运行 JIT 所需的内存取决于相关应用。大型应用比小型应用需要更多内存。一般来说，大型应用所需的内存稳定维持在 4 MB 左右。

此外，[ART JIT in Android N](http://s3.amazonaws.com/connect.linaro.org/las16/Presentations/Tuesday/LAS16-201%20-%20ART%20JIT%20in%20Android%20N.pdf)也是一个不错的参考材料。

## 4. Dalvik与ART的垃圾回收

[调试 ART 垃圾回收](https://source.android.com/devices/tech/dalvik/gc-debug)

[垃圾收集算法](/jvm/java-gc/#33)  
[CMS垃圾回收器](/jvm/java-gc/#356-cms)

**Dalvik 使用 标记清除(Mark-Sweep)算法：**  
> 其缺点如下：**一个是效率问题**，标记和清除两个过程的效率都不高；**另一个是空间问题**，标记清除之后会产生大量不连续的内存碎片，空间碎片太多可能会导致以后在程序运行过程中需要分配较大对象时，无法找到足够的连续内存而不得不提前触发另一次垃圾收集动作。

与 Dalvik 相比，**ART CMS (Concurrent Mark Sweep)** 垃圾回收计划在很多方面都有一定的改善：

1. 与 Dalvik 相比，暂停次数从 2 次减少到 1 次。Dalvik 的第一次暂停主要是为了进行根标记，即在 ART 中进行并发标记，让线程标记自己的根，然后马上恢复运行。与 Dalvik 类似，ART GC 在清除过程开始之前也会暂停 1 次。  
两者在这方面的主要差异在于：在此暂停期间，某些 Dalvik 环节在 ART 中并发进行。这些环节包括 java.lang.ref.Reference 处理、系统弱清除（例如，jni 弱全局等）、重新标记非线程根和卡片预清理。在 ART 暂停期间仍进行的阶段包括扫描脏卡片以及重新标记线程根，这些操作有助于缩短暂停时间。**(解决了问题1)**
2. 相对于 Dalvik，ART GC 改进的最后一个方面是粘性 CMS 回收器增加了 GC 吞吐量。不同于普通的分代 GC，粘性 CMS 不移动。系统会将年轻对象保存在一个分配堆栈（基本上是 java.lang.Object 数组）中，而非为其设置一个专属区域。这样可以避免移动所需的对象以维持低暂停次数，但缺点是容易在堆栈中加入大量复杂对象图像而使堆栈变长。**(BTW，ART提供了Large Object Space专门放置Bitmap)**  
3. ART GC 与 Dalvik 的另一个主要区别在于 ART GC 引入了移动垃圾回收器。使用移动 GC 的目的在于通过堆压缩来减少后台应用使用的内存。目前，触发堆压缩的事件是 ActivityManager 进程状态的改变。当应用转到后台运行时，它会通知 ART 已进入不再“感知”卡顿的进程状态。此时 ART 会进行一些操作（例如，压缩和监视器压缩），从而导致应用线程长时间暂停。目前正在使用的两个移动 GC 是同构空间压缩和半空间压缩。
    1. 半空间压缩将对象在两个紧密排列的碰撞指针空间之间进行移动。这种移动 GC 适用于小内存设备，因为它可以比同构空间压缩稍微多节省一点内存。额外节省出的空间主要来自紧密排列的对象，这样可以避免 RosAlloc/DlMalloc 分配器占用开销。由于 CMS 仍在前台使用，且不能从碰撞指针空间中进行收集，因此当应用在前台使用时，半空间还要再进行一次转换。这种情况并不理想，因为它可能引起较长时间的暂停。
    2. 同构空间压缩通过将对象从一个 RosAlloc 空间复制到另一个 RosAlloc 空间来实现。这有助于通过减少堆碎片来减少内存使用量。这是目前非低内存设备的默认压缩模式。相比半空间压缩，同构空间压缩的主要优势在于应用从后台切换到前台时无需进行堆转换。

> 简单来说， **ART CMS** 解决了与之相对的三个问题：  
> 1. CMS机制本身缓解了垃圾回收过程中Stop The World的效率问题，虽然其本身初始标记阶段和重新标记阶段也会STW。  
> 2. ART 提供了 Large Object Space 专门放置 Bitmap，可有效缓解大对象的分配问题。  
> 3. ART 引入了移动垃圾回收器 (Moving Collector) 来压缩内存，使内存空间更加紧凑，从而达到GC整体性能的巨大提升。
