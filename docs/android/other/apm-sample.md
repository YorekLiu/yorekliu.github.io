---
title: "APM示例"
tags:
  - apm
---

这里主要是针对线上环境的一些应用性能监控思想，线下的一些常用方式不专门列出来。

## 1. 内存优化

### 1.1 杂项

#### 1.1.1 设备分级  

使用Facebook的[devide-year-class](https://github.com/facebookarchive/device-year-class)库，区分出设备的高中低级。  

主要原理是根据手机RAM的大小来分级，部分获取不到RAM的机型，会根据CPU的核心数、频率等来辅助分级。总体来说，获取信息的代价还是非常小的。

#### 1.1.2 缓存管理

“用时申请，及时释放”。可以监听`onTrimMemory`和`onLowMemory`事件。  
但是堆内存不足时，不会触发这两个事件（实际上是PSS不足时才会触发）。需要我们在子线程中周期性计算堆内存使用量，内存触顶时可以主动触发回收。  
这里也需要注意一下PSS、VSS的情况。

- Java堆内存可以通过 `Runtime` 接口来获取
- PSS可以通过cat `/proc/meminfo` 获取
- VSS可以通过cat `/proc/<pid>/status` 获取

#### 1.1.3 线程模型

一个线程占用虚拟内存大约在1M左右，可以通过`pthread_attr_getstacksize`来获取到，一般来说约等于1M - 两个signal stack guard（一般为16KB，也看机型）。  

在32位机器上线程过多容易导致虚拟内存不足，因为2^32大约为4G，内核占1G，应用只有3G不到。64位虚拟内存基本不可能用完，这个优化可以在64位上忽略。

但是线程最好收拢在线程池中，尽量不要直接new线程来执行。可以通过一些手段来收拢这种野线程，详见示例中的`WildThreadCaseUIWidgetProvider`。

#### 1.1.4 进程模型

一个空的进程也会占用10M+内存。

#### 1.1.5 包体积

应用中的各个部分会被系统mmap来使用，过大的包体积也会占用过大的内存。

### 1.2 Bitmap梳理

#### 1.2.1 统一图片库、收拢图片创建、图片decode调用

这里值得一提的是，本地资源图片通过xml指定或者通过id来使用时，系统底层会有缓存系统。  
我们在部分情况下会使用BitmapFactory来创建或者decode图片，这种情况下需要我们自己做缓存。

这部分见示例的`ImageCaseUIWidgetProvider`。

#### 1.2.2 检测大图片

检查图片大小是否超过了View的大小，甚至是超过了屏幕的宽高。这部分大图片可以主动裁剪加载。

详见`MemoryMethodInst`里面的代码。

#### 1.2.3 图片内存占用分析

基于1.2.1节中的统一的图片库以及统一的Bitmap管理，可以轻松获取到应用中所有的图片。可以分析出图片的内存占比以及具体图片的内存占用。

### 1.3 内存泄露

#### 1.3.1 Java内存泄露 && HPROF文件裁剪

Java内存泄露可以使用`LeakCanary`，这里博主在很久以前分析过内存泄露的检测原理：

- [LeakCanary2源码解析](/android/3rd-library/leakcanary/)

hprof文件在回传到服务器时，需要经过裁剪以及压缩等工作。这里的裁剪有两大流派，但是裁剪的主要内容是基本上一致的。详见

- [剖析hprof文件的两种主要裁剪流派](/android/3rd-library/hprof-shrink/)

#### 1.3.2 OOM分析

OOM问题要具体问题具体分析，OOM发生时的堆栈不一定是问题的罪魁祸首，有可能只是表象，要结合内存快照文件进行分析。  

我们仍然可以周期性的检测堆内存的使用量，触顶之后dump出内存快照，然后进行下一步分析。这两个步骤在1.1.2以及1.3.1中有提到。

也有现成的轮子，比如美团的Probe或者快手的KOOM，后者是开源的。

#### 1.3.3 Native内存泄露  

Native内存泄露可以hook内存的申请与释放，看两者是否匹配。这部分还是更偏向于Matrix的方案。  

至于KOOM里面也有native内存泄露的检测模块，但是由于系统自带lib的限制，仅限于Android 7.0及以上才能使用。又考虑到内存泄露的共性，这也是完全有效的。

native hook一般选用爱奇艺的xhook框架，被hook的函数会经过编译器的[Name Mangling](http://www.kegel.com/mangle.html)。  
所以在理解代码时，需要将Name Mangling后的函数经过demangler。这里推荐两种方式：

- 使用系统自带的`c++filt`：`c++filt -n _Znwj`
- 使用网页版：[http://demangler.com/](http://demangler.com/)

## 2. 包体积优化

AGP的升级会导致一些优化方法逐渐被内建，但是我们永远可以走的比AGP更快。

|  | 方法 |
| - | -- |
| lib | 单ABI架构、so文件整体7z压缩、so文件远程下发 |
| res | 单dpi（xxhdpi）、重复冗余图片合并、图片资源优化、资源混淆、无用资源优化 |
| dex | proguard |
| assets | 无用资源优化 |
| resources.arsc | 资源混淆、指定需要支持的语言、固定资源项entry名来减少字符串池的大小 |
| META-INF | 资源混淆 |
