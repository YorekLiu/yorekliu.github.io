---
title: "Week22-Android Studio build过程"
excerpt: "Android Studio点击build按钮后，Android Studio就会编译整个项目并将apk安装到手机上，这个过程的背后到底发生了什么？"
categories:
  - Android
tags:
  - 知识星球
  - gradle
  - assemble
  - aR
  - aapt
  - aidl
  - javac
  - dx
  - apkbuilder
  - jarsigner
  - zipalign
  - ApkBuilderMain
  - apksigner
toc: true
toc_label: "目录"
last_modified_at: 2019-04-16T16:25:10+08:00
---

## Question

Android Studio点击build按钮后，Android Studio就会编译整个项目并将apk安装到手机上，请详细描述下这个过程的背后到底发生了什么？

## Answer

点击build按钮后，AS会根据Build Variants中Module的Build Variant的类型对对应的Module执行`gradlew :${Module}:assemble${variant}`  
以一个典型的单Module的工程为例，此处就是`gradlew :app:assembleDebug`
{: .notice--info }

### [The build process](https://developer.android.com/studio/build#build-process)  

下面是典型Android应用的构建过程：  

<figure style="width: 50%" class="align-center">
    <img src="/assets/images/android/build-process.png">
    <figcaption>典型Android App模块的构建过程</figcaption>
</figure>

该过程一般分为四步：编译 -> 打包 -> 签名 -> 对齐

1. 编译器将源代码转换为DEX（Dalvik Executable）文件，其中包括在Android设备上运行的字节码；其余的作为打包好的资源
2. APK Packager把DEX文件以及打包好的资源再次打包成一个单一的APK。在安装或发布APK之前，APK必须要被签名
3. APK Packager会使用debug签名文件或release签名文件对APK进行签名
4. 在生成最终的APK之前，APK Packager会使用[zipalign](https://developer.android.com/studio/command-line/zipalign.html)工具进行优化，此工具会使我们的App在运行时使用更少的内存


<figure style="width: 66%" class="align-right">
    <img src="/assets/images/android/android_apk_build_process.png">
    <figcaption>更详细的Android App模块的构建过程</figcaption>
</figure>

右图是更详细的构建过程图（*该部分内容没有在官网上找到出处，据说是老版本官网的内容*）

可以很明显的看到，这里面有七步：

1. 应用资源（res文件、assets文件、AndroidManifest.xml以及android.jar）通过**aapt**生成`R.java`文件以及打包好的资源文件
2. AIDL文件通过**aidl**生成对应的Java文件
3. 源码文件、`R.java`文件以及AIDL生成的Java文件通过**javac**编译成`.class`文件
4. 第3步生成的`.class`文件以及第三方库中的`.class`文件通过**dx**处理生成`classes.dex`文件
5. 打包好的资源文件、上一步生成的`classes.dex`文件、第三方库中的资源文件以及`.so`文件等其他资源通过**apkbuilder**生成未签名的`.apk`文件
6. 调用**jarsigner**对上面未签名`.apk`进行签名
7. 调用**zipalign**对签名后的`.apk`进行对齐处理


注意：`apkbuilder`是一个调用了`tools/lib/sdklib.jar`里面`com.android.sdklib.build.ApkBuilderMain`的脚本，在某次sdk更新之后脚本被删除了，但是调用还在。  
关于`jarsigner`与脚本`apksigner`，这两着的差别在于V1签名和V2签名；`apksigner`支持V2签名。[Android-APK签名工具-jarsigner和apksigner](https://www.jianshu.com/p/53078d03c9bf)
{: .notice--warning }

编译工具路径可以参考：[Android SDK Build Tools](https://developer.android.com/studio/command-line#tools-build)  
编译流程可以参考：[Android逆向分析(2) APK的打包与安装](http://blog.zhaiyifan.cn/2016/02/13/android-reverse-2/)
{: .notice--info }

点击查看[更详细的构建流程](/assets/images/android_build_process_detail.png)


### gradlew命令

可以通过如下命令获取编译log：

```shell
./gradlew aR --info > ~/Downloads/log.txt
```

从中可以提取`assembleRelease`的子任务（日志有经过美化）：

```
Tasks to be executed: [
  task ':app:preBuild', 
  task ':app:extractProguardFiles', 
  task ':app:preReleaseBuild', 
  task ':app:compileReleaseAidl', 
  task ':app:compileReleaseRenderscript', 
  task ':app:checkReleaseManifest', 
  task ':app:generateReleaseBuildConfig', 
  task ':app:prepareLintJar', 
  task ':app:generateReleaseSources', 
  task ':app:dataBindingExportBuildInfoRelease', 
  task ':app:dataBindingMergeDependencyArtifactsRelease', 
  task ':app:generateReleaseResValues', 
  task ':app:generateReleaseResources', 
  task ':app:mergeReleaseResources', 
  task ':app:transformDataBindingBaseClassLogWithDataBindingMergeGenClassesForRelease', 
  task ':app:dataBindingGenBaseClassesRelease', 
  task ':app:dataBindingExportFeaturePackageIdsRelease', 
  task ':app:mainApkListPersistenceRelease', 
  task ':app:createReleaseCompatibleScreenManifests', 
  task ':app:processReleaseManifest', 
  task ':app:processReleaseResources', 
  task ':app:kaptGenerateStubsReleaseKotlin', 
  task ':app:kaptReleaseKotlin', 
  task ':app:compileReleaseKotlin', 
  task ':app:javaPreCompileRelease', 
  task ':app:compileReleaseJavaWithJavac', 
  task ':app:compileReleaseNdk', 
  task ':app:compileReleaseSources', 
  task ':app:lintVitalRelease', 
  task ':app:mergeReleaseShaders', 
  task ':app:compileReleaseShaders', 
  task ':app:generateReleaseAssets', 
  task ':app:mergeReleaseAssets', 
  task ':app:validateSigningRelease', 
  task ':app:signingConfigWriterRelease', 
  task ':app:processReleaseJavaRes', 
  task ':app:transformResourcesWithMergeJavaResForRelease', 
  task ':app:transformClassesAndResourcesWithProguardForRelease', 
  task ':app:transformClassesWithDexBuilderForRelease', 
  task ':app:transformClassesWithMultidexlistForRelease', 
  task ':app:transformDexArchiveWithDexMergerForRelease', 
  task ':app:transformClassesAndDexWithShrinkResForRelease', 
  task ':app:mergeReleaseJniLibFolders', 
  task ':app:transformNativeLibsWithMergeJniLibsForRelease', 
  task ':app:transformNativeLibsWithStripDebugSymbolForRelease', 
  task ':app:packageRelease', 
  task ':app:assembleRelease'
]
```