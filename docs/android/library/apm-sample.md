---
title: "APM示例"
tags:
  - apm
---

这里主要是针对线上环境的一些应用性能监控思想，线下的一些常用方式不专门列出来。

Repo: [YorekLiu/APMSample](https://github.com/YorekLiu/APMSample)

## 1. 内存优化

### 1.1 杂项

#### 1.1.1 设备分级  

使用Facebook的[devide-year-class](https://github.com/facebookarchive/device-year-class)库，区分出设备的高中低级。各个性能级别的设备可以采用不用的缓存策略、动画控制策略等。  

主要原理是根据手机RAM的大小来分级，部分获取不到RAM的机型，会根据CPU的核心数、频率等来辅助分级。总体来说，获取信息的代价还是非常小的。

#### 1.1.2 缓存管理

“用时申请，及时释放”。可以监听`onTrimMemory`和`onLowMemory`事件。  
但是堆内存不足时，不会触发这两个事件（实际上是PSS不足时才会触发，应用切后台也会触发）。需要我们在子线程中周期性计算堆内存使用量，内存触顶时可以主动触发回收。  
这里也需要注意一下PSS、VSS的情况。  
堆内存不足会导致GC卡顿甚至OOM，PSS不足会导致LMK甚至应用重启，VSS不足应用导致内存分配失败。

- Java堆内存可以通过 `Runtime` 接口来获取
- PSS可以通过cat `/proc/meminfo` 获取
- VSS可以通过cat `/proc/<pid>/status` 获取

#### 1.1.3 线程模型

一个线程占用虚拟内存大约在1M左右，可以通过`pthread_attr_getstacksize`来获取到，一般来说约等于1M - 两个signal stack guard（一般为16KB，也看机型）。  

在32位机器上线程过多容易导致虚拟内存不足，因为2^32大约为4G，内核占1G，应用只有3G不到。64位虚拟内存基本不可能用完，这个优化可以在64位上忽略。

???+ "如何验证线程栈空间大小"  
    可以cat `/proc/<pid>/maps`，每一个线程对应一个段：  
    ```
    77310db000-77310dc000 ---p 00000000 00:00 0                              [anon:thread stack guard]
    77310dc000-77310dd000 ---p 00000000 00:00 0
    77310dd000-773115f000 rw-p 00000000 00:00 0
    ```  
    我们看`rw-p`所在的这一行，两个地址相减为532480B，即520KB  

    在Android 12上，标识有一点点变化，tid也会出现在名称中了：  
    ```
    778a384000-778a385000 ---p 00000000 00:00 0                              [anon:stack_and_tls:11978]
    778a385000-778a48c000 rw-p 00000000 00:00 0                              [anon:stack_and_tls:11978]
    778a48c000-778a48e000 ---p 00000000 00:00 0
    ```

此外，线程最好收拢在线程池中，尽量不要直接new线程来执行。可以通过一些手段来收拢这种野线程。收拢的手段可以使用插桩技术，这里使用的是博主的[MethodTracer](https://github.com/YorekLiu/MethodTracer)，详见示例中的`WildThreadCaseUIWidgetProvider`。  

#### 1.1.4 进程模型

一个空的进程也会占用10M+内存，可以看PSS的值。

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
| res | 单dpi（xxhdpi）图片、重复冗余图片合并、图片资源优化、资源混淆、无用资源优化 |
| dex | proguard、redex |
| assets | 无用资源优化 |
| resources.arsc | 资源混淆、指定需要支持的语言、固定资源项entry名来减少字符串池的大小 |
| META-INF | 资源混淆 |


对例子进行的一系列优化效果：

| 方式 | MB | 备注 |
| --- | --- | --- |
| 开始 | 5.53 |  |
| 仅保留arm64-v8a | 4.33 | 使用spilts配置 |
| 仅保留xxhdpi | 4.17 | 使用spilts配置 | 
| resConfigs保留语言 | 3.93 | 删除三方库中的i18n语言 | 
| 禁用AGP的资源混淆，启用[AndResGuard](/android/3rd-library/andresguard)后 | 3.65 | AGP4.2内置了资源混淆功能，但是AndResGuard的总体效果更好。两者可以结合一下 |
| 7z压缩so | 3.65	| 原始lib文件大小：390.0KB，7z后：388.6KB。lib不多效果不明显，多的时候效果可以达到lib文件总体的4% | 
| 抽离so | 3.28 | 全部剔除了，从网络上下载即可 | 
| 无用resources删除 | 3.24 | AGP 7.1 实验性功能，可以彻底删除没有用到的资源，而不是占位图。使用`android.experimental.enableNewResourceShrinker.preciseShrinking=true`开启 | 

- lib
    - **单ABI架构**：使用`spilts.abi`配置可以实现
    - **so文件整体7z压缩**：so文件整体压缩后放在assets里面，在用到之前进行解压，并用SoLoader进行动态加载。  
      实现方案：自定义Task，将该Task夹在`merge${variantName}Assets`、`compress${variantName}Assets`之间，并设置该Task依赖于`strip${variantName}DebugSymbols`。这样我们压缩的so文件都是去掉了调试符号了的。Task运行时，会7z压缩指定编译目录里面的so文件，并将产物放到assets的编译目录下；同时会创建同名的空so文件，防止打包验证时so文件不在而失败。还有一点，将so压缩包放置到`merge${variantName}Assets`编译目录时，`compress${variantName}Assets`不会自动处理新加进来的so压缩包，所以我们需要在项目中添加一个空的so压缩包文件，来达到占位的功能。
    - **so文件整体抽离，然后远程下发**：so文件在打包时会释放到outputs目录中，需要上传到服务器，在用到so之前进行下载，并用SoLoader进行动态加载。  
      实现方案：同上面步骤类似，不过实现起来更简单。自定义Task，并设置该Task依赖于`strip${variantName}DebugSymbols`。Task运行时，会将指定编译目录里面的so文件放到outputs下面，同时会创建同名的空so文件，防止打包验证时so文件不在而失败。

      对so文件的操作可以查看`ApmSamplePlugin`以及`MinifySoTask`文件。

- res
    - **单dpi（xxhdpi）图片**：使用`spilts.abi`配置可以实现
    - **重复冗余图片合并、资源混淆**：可以直接使用`AndResGuard`，AGP7.x的适配版本可以使用博主fork出来的，自行编译发布即可。
    - **无用资源优化**：AGP7.1可以使用`android.experimental.enableNewResourceShrinker.preciseShrinking=true`达到目的，否则可以使用[`Matrix#RemoveUnusedResourcesTask`](/android/3rd-library/matrix-trace-plugin/#4-removeunusedresourcestask)达到目的，后者现在有了V2版本。
    - **图片资源优化**：对png、jpg等图片资源都可以主动压缩，也可以换用webp格式的图片。这里注意一下压不压缩的问题，在蓝湖上，未压缩的webp图片比压缩过的png图片更大。  
      当然，这里对于这项来说，太依赖于开发者本身了，没有达到全自动的阶段。对于全自动的探索，`Transform` API里面的 `TransformManager.CONTENT_RESOURCES` 处理的不是Android的resources，而是Java的。而在编译过程中，三方library中的resources也不会直接出现在编译中间产物中，没有办法在编译时就搞定。后面可以参考`AndResGuard`的做法，对整个APK进行解包，压缩图片或者转webp后，修改arsc文件，然后重新打包。

- dex  
    - **proguard**：这是最直观的方式了，混淆规则的治理对于大型项目来说非常有用，就是需要发动开发者们对自己的模块进行治理，对于历史项目来说，还是有一定的风险的。
    - **redex**：redex对于包体积优化这块不一定有用，但是这个项目非常有价值

- assets  
    - **无用资源优化**：针对于assets里面的无用资源优化还是有一点麻烦的，这是我们相对来说，比较容易忽视的地方。这个位置的难点在于如何找出无用的assets资源，删除的话可以直接删除编译中间产物就可以了，package时就会生效。  
      找出无用的assets资源可以参考[ApkChecker#UnusedAssetsTask](/android/3rd-library/matrix-apk-checker/#214-unusedassetstask)：搜索smali文件中引用字符串常量的指令，判断引用的字符串常量是否某个assets文件的名称

- resources.arsc  
    - **资源混淆、固定资源项entry名来减少字符串池的大小**：使用`AndResGuard`实现  
    - **指定需要支持的语言**：通过`resConfigs`指定  

- META-INF  
    - **资源混淆**：资源名混淆，会导致MF文件里面每一项的名称变短，也会导致文件SF里面的每一项的名称变短。对于apk来说，多个代码资源会组成一个个dex、so等，但是资源文件仍然是一个个的。