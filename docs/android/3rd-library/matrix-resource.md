---
title: "Matrix-ResourceCanary解析"
---

!!! tip "Wiki"  
    [Matrix - ResourceCanary](https://github.com/Tencent/matrix/wiki/Matrix-Android-ResourceCanary)  
    [Matrix - ApkChecker](https://github.com/Tencent/matrix/wiki/Matrix-Android-ApkChecker)  

**ResourceCanary 的设计目标是准确的检测 Activity 泄露**，检测泄露需要 hprof 文件，**而该文件还可以用来进行冗余 Bitmap 的检测**。此外，考虑到有人工分析 hprof 文件的情况，需要将用户生成的 hprof 文件上传到服务端，而这个文件通常比较大，所以我们需要对 **hprof 进行裁剪。** hprof 文件的分析过程可以放到服务器端。

另外，ResourceCanary 里面还提供了一个 Activity 级别泄露解决方案 **ActivityLeakFixer** ：它可以解决 IME 泄露问题；以及在 Activity 销毁时清除所有 View 的 Drawable、Listener 等，这样泄露的就是空壳了。  
同理我们还可以自己弄一个 Fragment 级别的方案，注意一下可能会有坑。然后这个类实在是没有什么值得展开说的，下面不展开了。

除了 ResourceCanary 之外，Matrix 中还有另外一个神器 RemoveUnusedResourcesTask —— 在 build 时删除被 ApkChecker 检测出来的无用资源。我们知道assets、drawable等里面的无用资源是没有办法完全删掉，但是这个插件是可以删掉的。  
这个 ApkChecker 与 ResourceCanary 我们在这篇文章也会进行讲解。

因此，本篇文章的重点就是 ResourceCanary 的本体，以及 ApkChecker 与对应插件这两个部分了。

## 1. Resource Canary

