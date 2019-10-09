---
title: "LeakCanary2源码解析"
excerpt: "LeakCanary-2.0-beta-3源码解析"
categories:
  - Android
tags:
  - LeakCanary
toc: true
toc_label: "目录"
# last_modified_at: 2019-09-28T11:32:23+08:00
---

本文基于[LeakCanary](https://github.com/square/leakcanary/tree/v2.0-beta-3)最新2.0-beta-3版本进行分析。
{: .notice--info }

众所周知，LeakCanary是一个内存泄漏检测的工具。那么，内存泄漏是如何定义的，通常有哪些情况呢？  
在分析源代码之前，我们先弄清楚这两个问题。这两个问题在[LeakCanary - Fundamentals](https://square.github.io/leakcanary/fundamentals/)中有提及。

## 1. 什么是内存泄漏 (What is a memory leak?)

In a Java based runtime, a memory leak is a programming error that causes an application to keep a reference to an object that is no longer needed. As a result, the memory allocated for that object cannot be reclaimed, eventually leading to an OutOfMemoryError crash.  
在基于Java的运行时中，内存泄漏是一种编程错误，它导致应用程序保留对不再需要的对象的引用。这会导致为该对象分配的内存无法回收，最终导致`OutOfMemoryError`崩溃。

For example, an Android activity instance is no longer needed after its onDestroy() method is called, and storing a reference to that activity in a static field would prevent it from being garbage collected.  
例如，在Activity的`onDestroy()`方法被调用后，Android activity的实例就不再需要了，此时在静态字段中存储该Activity的引用将阻止其被回收。

## 2. 常见的内存泄漏 (Common causes for memory leaks)

Most memory leaks are caused by bugs related to the lifecycle of objects. Here are a few common Android mistakes:  
大多数内存泄漏是由与对象生命周期相关的错误引起的。以下是一些常见的Android错误：

- Storing an Activity context as a field in an object that survives activity recreation due to configuration changes.  
  将Activity上下文存储为对象中的字段，这样配置更改后activity会重新创建，但是老的仍然存活。
- Registering a listener, broadcast receiver or RxJava subscription which references an object with lifecycle, and forgetting to unregister when the lifecycle reaches its end.  
  对有生命周期的对象注册了监听器、广播接收者或者RxJava的订阅，且当对象的生命到达了终点时没有取消注册。
- Storing a view in a static field, and not clearing that field when the view is detached.  
  在静态字段中存储了view，且当view detach时没有清空静态变量。

## 3. LeakCanary2如何检测内存泄漏

LeakCanary v2 与 v1 的代码由略微的不同，下面是两者的检测内存泄漏的原理。

> **LeakCanary 1.5.1 检测内存泄漏原理**：  
> 在Activity destroy后将Activity的弱引用关联到ReferenceQueue中，这样Activity将要被GC前，会出现在ReferenceQueue中。  
> 随后，会向主线程的MessageQueue添加一个`IdleHandler`，用于在idle时触发一个发生在HandlerThread的等待5秒后开始检测内存泄漏的代码。  
> 这段代码首先会判断是否对象出现在引用队列中，如果有，则说明没有内存泄漏，结束。否则，调用`Runtime.getRuntime().gc()`进行GC，等待100ms后再次判断是否已经出现在引用队列中，若还没有被出现，那么说明有内存泄漏，开始dump hprof。
> 
> **LeakCanary 2.0 beta 3 检测内存泄漏原理**：  
> 在Activity destroy后将Activity的弱引用关联到ReferenceQueue中，这样Activity将要被GC前，会出现在ReferenceQueue中。  
> 随后，会向主线程的抛出一个5秒后执行的Runnable，用于检测内存泄漏。  
> 这段代码首先会将引用队列中出现的对象从观察对象数组中移除，然后再判断要观察的此对象是否存在。若不存在，则说明没有内存泄漏，结束。否则，就说明可能出现了内存泄漏，会调用`Runtime.getRuntime().gc()`进行GC，等待100ms后再次根据引用队列判断，若仍然出现在引用队列中，那么说明有内存泄漏，此时根据内存泄漏的个数弹出通知或者开始dump hprof。

LeakCanary 2.0使用非常简单，只需要在build.gradle中配置一下，无需在项目中添加任何代码。

```gradle
dependencies {
  // debugImplementation because LeakCanary should only run in debug builds.
  debugImplementation 'com.squareup.leakcanary:leakcanary-android:2.0-beta-3'
}
```

原理就是利用ContentProvider的特性，其onCreate方法会在Application的onCreate方法之前被系统调用。所以只需要在AndroidManifest.xml中配置一下这个ContentProvider，然后在onCreate方法中进行初始化即可。  

**leakcanary-object-watcher-android/src/main/AndroidManifest.xml**

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest
    xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.squareup.leakcanary.objectwatcher"
    >

  <application>
    <provider
        android:name="leakcanary.internal.AppWatcherInstaller$MainProcess"
        android:authorities="${applicationId}.leakcanary-installer"
        android:exported="false"/>
  </application>
</manifest>
```

**leakcanary-object-watcher-android/src/main/java/leakcanary/internal/AppWatcherInstaller.kt**

```kotlin
/**
 * Content providers are loaded before the application class is created. [AppWatcherInstaller] is
 * used to install [leakcanary.AppWatcher] on application start.
 */
internal sealed class AppWatcherInstaller : ContentProvider() {

  /**
   * [MainProcess] automatically sets up the LeakCanary code that runs in the main app process.
   */
  internal class MainProcess : AppWatcherInstaller()

  /**
   * When using the `leakcanary-android-process` artifact instead of `leakcanary-android`,
   * [LeakCanaryProcess] automatically sets up the LeakCanary code
   */
  internal class LeakCanaryProcess : AppWatcherInstaller() {
    override fun onCreate(): Boolean {
      super.onCreate()
      AppWatcher.config = AppWatcher.config.copy(enabled = false)
      return true
    }
  }

  override fun onCreate(): Boolean {
    val application = context!!.applicationContext as Application
    InternalAppWatcher.install(application)
    return true
  }

  override fun query(
    uri: Uri,
    strings: Array<String>?,
    s: String?,
    strings1: Array<String>?,
    s1: String?
  ): Cursor? {
    return null
  }

  override fun getType(uri: Uri): String? {
    return null
  }

  override fun insert(
    uri: Uri,
    contentValues: ContentValues?
  ): Uri? {
    return null
  }

  override fun delete(
    uri: Uri,
    s: String?,
    strings: Array<String>?
  ): Int {
    return 0
  }

  override fun update(
    uri: Uri,
    contentValues: ContentValues?,
    s: String?,
    strings: Array<String>?
  ): Int {
    return 0
  }
}
```

我们可以看到，该ContentProvider除了在onCreate方法中进行了初始化处理，其他方法都是空实现。在上面的第26行，onCreate方法中初始化代码为`InternalAppWatcher.install(application)`。

`InternalAppWatcher.install(Application)`方法完成了LeakCanary的初始化操作，里面涉及到协作的一些类的定义。

**leakcanary-object-watcher-android/src/main/java/leakcanary/internal/InternalAppWatcher.kt**

```kotlin
internal object InternalAppWatcher {

  // 通过判断lateinit修饰的Application是否已经初始化，来判断LeakCanary是否已经安装
  val isInstalled
    get() = ::application.isInitialized

  // LeakCanary安装完成的回调，实际上对应的是leakcanary.internal.InternalLeakCanary这个类
  private val onAppWatcherInstalled: (Application) -> Unit

  val isDebuggableBuild by lazy {
    (application.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
  }

  lateinit var application: Application

  // ObjectWatcher参数1
  private val clock = object : Clock {
    override fun uptimeMillis(): Long {
      return SystemClock.uptimeMillis()
    }
  }

  private val mainHandler = Handler(Looper.getMainLooper())

  init {
    val internalLeakCanary = try {
      val leakCanaryListener = Class.forName("leakcanary.internal.InternalLeakCanary")
      leakCanaryListener.getDeclaredField("INSTANCE")
          .get(null)
    } catch (ignored: Throwable) {
      NoLeakCanary
    }
    @kotlin.Suppress("UNCHECKED_CAST")
    onAppWatcherInstalled = internalLeakCanary as (Application) -> Unit
  }

  private val checkRetainedExecutor = Executor {
    mainHandler.postDelayed(it, AppWatcher.config.watchDurationMillis)
  }
  val objectWatcher = ObjectWatcher(
      clock = clock,
      checkRetainedExecutor = checkRetainedExecutor,
      isEnabled = { AppWatcher.config.enabled }
  )

  fun install(application: Application) {
    ...
    checkMainThread()
    if (this::application.isInitialized) {
      return
    }
    InternalAppWatcher.application = application

    val configProvider = { AppWatcher.config }
    ActivityDestroyWatcher.install(application, objectWatcher, configProvider)
    FragmentDestroyWatcher.install(application, objectWatcher, configProvider)
    onAppWatcherInstalled(application)
  }

  private fun checkMainThread() {
    if (Looper.getMainLooper().thread !== Thread.currentThread()) {
      throw UnsupportedOperationException(
          "Should be called from the main thread, not ${Thread.currentThread()}"
      )
    }
  }
  ...
}
```