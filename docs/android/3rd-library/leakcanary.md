---
title: "LeakCanary2源码解析"
---

!!! info
    本文基于[LeakCanary](https://github.com/square/leakcanary/tree/v2.0-beta-3)最新2.0-beta-3版本进行分析。

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

### 3.1 LeakCanary2初始化

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
    // 这里为什么要这么费劲的获取该object的对象呢？
    // 因为InternalLeakCanary类是上层模块的，这里没有办法直接引用
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

  // 主线程抛出任务，delay 5s
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
    // lateinit修饰的对象可以通过::<field>.isInitialized来判断有没有初始化
    // 如果已经初始化了，则不需要再次install
    if (this::application.isInitialized) {
      return
    }
    InternalAppWatcher.application = application

    // 安装ActivityDestroyWatcher、FragmentDestroyWatcher
    val configProvider = { AppWatcher.config }
    ActivityDestroyWatcher.install(application, objectWatcher, configProvider)
    FragmentDestroyWatcher.install(application, objectWatcher, configProvider)
    // 通知上层模块的InternalLeakCanary.invoke方法
    onAppWatcherInstalled(application)
  }
  ...
}
```

在上面的这个install方法中，干了三件事：
1. 初始化一个`ObjectWatcher`对象：其`clock`就是`SystemClock.uptimeMillis()`，`checkRetainedExecutor`是利用主线程Handler执行的任务
2. Activity、Fragment销毁的观察者的安装
3. 通知InternalLeakCanary，watcher已经安装完成

由于Activity、Fragment的销毁不会立刻发生，所以我们先看看第3点中，`InternalLeakCanary`做了什么工作。  
`InternalLeakCanary`的部分声明为`object InternalLeakCanary : (Application) -> Unit`，所以它到底实现了什么呢。这其实对应kotlin中Functions.kt文件的Function1接口，P1为Application，R为Unit即void：

```kotlin
/** A function that takes 1 argument. */
public interface Function1<in P1, out R> : Function<R> {
    /** Invokes the function with the specified argument. */
    public operator fun invoke(p1: P1): R
}
```

所以接着看`InternalLeakCanary.invoke`方法即可，该方法也是完成了一些初始化操作，如下：

**InternalLeakCanary.kt**  

```kotlin
override fun invoke(application: Application) {
  this.application = application

  // 内存泄漏时回调该类的方法
  AppWatcher.objectWatcher.addOnObjectRetainedListener(this)

  val heapDumper = AndroidHeapDumper(application, leakDirectoryProvider)

  // gcTrigger使用的默认的
  val gcTrigger = GcTrigger.Default

  val configProvider = { LeakCanary.config }

  // HandlerThread + Handler 来处理后台任务
  val handlerThread = HandlerThread(LEAK_CANARY_THREAD_NAME)
  handlerThread.start()
  val backgroundHandler = Handler(handlerThread.looper)

  heapDumpTrigger = HeapDumpTrigger(
      application, backgroundHandler, AppWatcher.objectWatcher, gcTrigger, heapDumper,
      configProvider
  )
  // 自定义的扩展方法来检测App是否可见（处于前台）
  application.registerVisibilityListener { applicationVisible ->
    this.applicationVisible = applicationVisible
    heapDumpTrigger.onApplicationVisibilityChanged(applicationVisible)
  }
  // 动态添加Shortcut
  addDynamicShortcut(application)

  disableDumpHeapInInstrumentationTests()
}
```

其实上面这些初始化的变量，大部分我们都不会在检测内存泄漏时遇到，这些变量大部分都与dump heap有关。  
这里展开说说其中的“自定义的扩展方法来检测App是否可见（处于前台）”这里面的实现原理，这个需求在日常开发中也会用到，也是通过向Application注册Activity生命周期回调，通过计算start-stop的Activity个数来实现的：

**leakcanary-android-core/src/main/java/leakcanary/internal/VisibilityTracker.kt**

```kotlin
internal class VisibilityTracker(
  private val listener: (Boolean) -> Unit
) :
    Application.ActivityLifecycleCallbacks by noOpDelegate() {

  private var startedActivityCount = 0

  /**
   * Visible activities are any activity started but not stopped yet. An activity can be paused
   * yet visible: this will happen when another activity shows on top with a transparent background
   * and the activity behind won't get touch inputs but still need to render / animate.
   */
  private var hasVisibleActivities: Boolean = false

  override fun onActivityStarted(activity: Activity) {
    startedActivityCount++
    if (!hasVisibleActivities && startedActivityCount == 1) {
      hasVisibleActivities = true
      listener.invoke(true)
    }
  }

  override fun onActivityStopped(activity: Activity) {
    // This could happen if the callbacks were registered after some activities were already
    // started. In that case we effectively considers those past activities as not visible.
    if (startedActivityCount > 0) {
      startedActivityCount--
    }
    if (hasVisibleActivities && startedActivityCount == 0 && !activity.isChangingConfigurations) {
      hasVisibleActivities = false
      listener.invoke(false)
    }
  }
}

internal fun Application.registerVisibilityListener(listener: (Boolean) -> Unit) {
  registerActivityLifecycleCallbacks(VisibilityTracker(listener))
}
```

上面就是LeakCanary的初始化代码了，下一节开始说说Activity与Fragment是如何检测内存泄漏的。

### 3.2 如何观察Activity、Fragment

在上一节LeakCanary2初始化中，我们还没有讲解下面两行代码：

```kotlin
ActivityDestroyWatcher.install(application, objectWatcher, configProvider)
FragmentDestroyWatcher.install(application, objectWatcher, configProvider)
```

这两行代码都是通过向Application注册`registerActivityLifecycleCallbacks`从而获取每个启动的Activity，然后

- 对于Activity而言，直接观察Activity即可
- 对于Fragment而言，由于Fragment需要依附于Activity，且需要从Activity中获取FragmentManager，然后通过其`registerFragmentLifecycleCallbacks`方法观察Fragment

上面两行代码就是这个实现逻辑。
先看看Activity的观察逻辑：

**leakcanary-object-watcher-android/src/main/java/leakcanary/internal/ActivityDestroyWatcher.kt**

```kotlin
internal class ActivityDestroyWatcher private constructor(
  private val objectWatcher: ObjectWatcher,
  private val configProvider: () -> Config
) {

  private val lifecycleCallbacks =
    object : Application.ActivityLifecycleCallbacks by noOpDelegate() {
      // noOpDelegate()是一个动态代理的实现，不过里面没有写任何逻辑 所以是no op
      // 此处相当于一个适配器方法
      override fun onActivityDestroyed(activity: Activity) {
        if (configProvider().watchActivities) {
          objectWatcher.watch(activity)
        }
      }
    }

  companion object {
    fun install(
      application: Application,
      objectWatcher: ObjectWatcher,
      configProvider: () -> Config
    ) {
      val activityDestroyWatcher =
        ActivityDestroyWatcher(objectWatcher, configProvider)
      application.registerActivityLifecycleCallbacks(activityDestroyWatcher.lifecycleCallbacks)
    }
  }
}
```

上面的逻辑很简单，就是对于每个Activity，在其`onDestroy`方法调用之后，调用`objectWatcher.watch`观察这个Activity。该方法的逻辑我们下一节再说。

然后我们看看Fragment里面的观察逻辑，由于Fragment有两种：
1. `android.app.Fragment`
2. support包里面的`androidx.fragment.app.Fragment`

前者的FragmentLifecycleCallbacks有API Level限制，限制为O；后者则没有API限制了，但是有androidx限制。所以FragmentDestroyWatcher会判断这两个的是否满足条件，满足条件后才会进行观察。

**leakcanary-object-watcher-android/src/main/java/leakcanary/internal/FragmentDestroyWatcher.kt**

```kotlin
/**
 * Internal class used to watch for fragments leaks.
 */
internal object FragmentDestroyWatcher {

  private const val ANDROIDX_FRAGMENT_CLASS_NAME = "androidx.fragment.app.Fragment"
  private const val ANDROIDX_FRAGMENT_DESTROY_WATCHER_CLASS_NAME =
    "leakcanary.internal.AndroidXFragmentDestroyWatcher"

  fun install(
    application: Application,
    objectWatcher: ObjectWatcher,
    configProvider: () -> AppWatcher.Config
  ) {
    val fragmentDestroyWatchers = mutableListOf<(Activity) -> Unit>()

    // 如果SDK大于等于O，则添加android.app.Fragment的观察者
    if (SDK_INT >= O) {
      fragmentDestroyWatchers.add(
          AndroidOFragmentDestroyWatcher(objectWatcher, configProvider)
      )
    }

    // 通过反射判定androidx.fragment.app.Fragment以及其观察者是否存在
    if (classAvailable(ANDROIDX_FRAGMENT_CLASS_NAME) &&
        classAvailable(ANDROIDX_FRAGMENT_DESTROY_WATCHER_CLASS_NAME)
    ) {
      // 反射实例化androidx Fragment的观察者并添加到里面list里面
      val watcherConstructor = Class.forName(ANDROIDX_FRAGMENT_DESTROY_WATCHER_CLASS_NAME)
          .getDeclaredConstructor(ObjectWatcher::class.java, Function0::class.java)
      @kotlin.Suppress("UNCHECKED_CAST")
      fragmentDestroyWatchers.add(
          watcherConstructor.newInstance(objectWatcher, configProvider) as (Activity) -> Unit
      )
    }

    // 如果watcher为空，则不需要进行观察了
    if (fragmentDestroyWatchers.size == 0) {
      return
    }

    // 对每个Activity里面的所有的Fragment进行观察
    application.registerActivityLifecycleCallbacks(object : Application.ActivityLifecycleCallbacks by noOpDelegate() {
      override fun onActivityCreated(
        activity: Activity,
        savedInstanceState: Bundle?
      ) {
        for (watcher in fragmentDestroyWatchers) {
          watcher(activity)
        }
      }
    })
  }

  private fun classAvailable(className: String): Boolean {
    return try {
      Class.forName(className)
      true
    } catch (e: ClassNotFoundException) {
      false
    }
  }
}
```

`AndroidOFragmentDestroyWatcher`、`AndroidXFragmentDestroyWatcher`两者的源码非常类似，只是针对的Fragment不同而调用的API不同而已，下面以`AndroidXFragmentDestroyWatcher`为例看看里面是如何实现的。

**leakcanary-object-watcher-android-androidx/src/main/java/leakcanary/internal/AndroidXFragmentDestroyWatcher.kt**

```kotlin
internal class AndroidXFragmentDestroyWatcher(
  private val objectWatcher: ObjectWatcher,
  private val configProvider: () -> Config
) : (Activity) -> Unit {

  private val fragmentLifecycleCallbacks = object : FragmentManager.FragmentLifecycleCallbacks() {

    override fun onFragmentViewDestroyed(
      fm: FragmentManager,
      fragment: Fragment
    ) {
      val view = fragment.view
      if (view != null && configProvider().watchFragmentViews) {
        objectWatcher.watch(view)
      }
    }

    override fun onFragmentDestroyed(
      fm: FragmentManager,
      fragment: Fragment
    ) {
      if (configProvider().watchFragments) {
        objectWatcher.watch(fragment)
      }
    }
  }

  override fun invoke(activity: Activity) {
    if (activity is FragmentActivity) {
      val supportFragmentManager = activity.supportFragmentManager
      supportFragmentManager.registerFragmentLifecycleCallbacks(fragmentLifecycleCallbacks, true)
    }
  }
}
```

实现就是向Activity的FragmentManager注册`FragmentLifecycleCallbacks`，这样在Fragment调用`onDestroyView`和`onDestory`之后就能观察Fragment的View或者Fragment本身了。

### 3.3 内存泄漏判定

现在我们来看看`ObjectWatcher.watch(Any)`方法，在上面一节中我们看到，Activity、Fragment的View、Fragment都是由该方法进行观察的，所以最后还是统一回到了这里。

**leakcanary-object-watcher/src/main/java/leakcanary/ObjectWatcher.kt**

```kotlin
/**
  * Identical to [watch] with an empty string reference name.
  */
@Synchronized fun watch(watchedObject: Any) {
  watch(watchedObject, "")
}

/**
  * Watches the provided [watchedObject].
  *
  * @param name A logical identifier for the watched object.
  */
@Synchronized fun watch(
  watchedObject: Any,
  name: String
) {
  if (!isEnabled()) {
    return
  }
  // 将ReferenceQueue中出现的弱引用移除
  // 这是一个出现频率很高的方法，也是内存泄漏检测的关键点之一
  removeWeaklyReachableObjects()
  val key = UUID.randomUUID()
      .toString()
  // 记下观测开始的时间
  val watchUptimeMillis = clock.uptimeMillis()
  // 这里创建了一个自定义的弱引用，且调用了基类的WeakReference<Any>(referent, referenceQueue)构造器
  // 这样的话，弱引用被回收之前会出现在ReferenceQueue中
  val reference =
    KeyedWeakReference(watchedObject, key, name, watchUptimeMillis, queue)
  SharkLog.d {
      "Watching " +
          (if (watchedObject is Class<*>) watchedObject.toString() else "instance of ${watchedObject.javaClass.name}") +
          (if (name.isNotEmpty()) " named $name" else "") +
          " with key $key"
  }
  
  // 将key-reference保存到map中
  watchedObjects[key] = reference
  // 主线程5秒之后执行moveToRetained(key)方法
  checkRetainedExecutor.execute {
    moveToRetained(key)
  }
}
```

上面这段代码便是LeakCanary的关键代码之一：
1. 将要观测的对象使用WeakReference保存起来，并在构造时传入一个ReferenceQueue，这样待观测的对象在被回收之前，会出现在ReferenceQueue中。
2. 5秒钟之后再检查一下是否出现在了引用队列中，若出现了，则没有泄露。

为什么会是5S，这里猜测与Android GC有关。在Activity.H中，收到`GC_WHEN_IDLE`消息时会进行`Looper.myQueue().addIdleHandler(mGcIdler)`，而`mGcIdler`最后会触发`doGcIfNeeded`操作，在该方法中会判断上次GC与现在时间的差值，而这个值就是`MIN_TIME_BETWEEN_GCS = 5*1000`。

回到上面的代码，需要了解两个方法`removeWeaklyReachableObjects()`与`moveToRetained(key)`。前者比较简单，就会将引用队列中出现的对象从map中移除，因为它们没有发生内存泄漏。但是注意一下注释，这里强调了一点：**弱引用入队列发生在终结函数或者GC发生之前**。

```kotlin
private fun removeWeaklyReachableObjects() {
  // WeakReferences are enqueued as soon as the object to which they point to becomes weakly
  // reachable. This is before finalization or garbage collection has actually happened.
  var ref: KeyedWeakReference?
  do {
    ref = queue.poll() as KeyedWeakReference?
    if (ref != null) {
      watchedObjects.remove(ref.key)
    }
  } while (ref != null)
}
```

然后我们接着看重头戏`moveToRetained`方法：

```kotlin
@Synchronized private fun moveToRetained(key: String) {
  removeWeaklyReachableObjects()
  val retainedRef = watchedObjects[key]
  if (retainedRef != null) {
    retainedRef.retainedUptimeMillis = clock.uptimeMillis()
    onObjectRetainedListeners.forEach { it.onObjectRetained() }
  }
}
```

5秒钟到了，还是先将引用队列中出现的对象从map中移除，因为它们没有内存泄漏。然后判断key还在不在map中，如果在的话，说明可能发生了内存泄漏。此时记下内存泄漏发生的时间，即更新`retainedUptimeMillis`字段，然后通知所有的对象，内存泄漏发生了。  

我们回忆一下，此处的`onObjectRetainedListeners`只有一个，就是我们在Activity、Fragment的观测者安装完毕后，通知了`InternalLeakCanary`，而`InternalLeakCanary`添加了一个监听器，就是它自己。所以我们看看`InternalLeakCanary.onObjectRetained()`方法：

**leakcanary-android-core/src/main/java/leakcanary/internal/InternalLeakCanary.kt**

```kotlin
override fun onObjectRetained() {
  if (this::heapDumpTrigger.isInitialized) {
    heapDumpTrigger.onObjectRetained()
  }
}
```

跟踪一下`HeapDumpTrigger.onObjectRetained()`方法：

**leakcanary-android-core/src/main/java/leakcanary/internal/HeapDumpTrigger.kt**

```kotlin
fun onObjectRetained() {
  scheduleRetainedObjectCheck("found new object retained")
}

private fun scheduleRetainedObjectCheck(reason: String) {
  if (checkScheduled) {
    SharkLog.d { "Already scheduled retained check, ignoring ($reason)" }
    return
  }
  checkScheduled = true
  backgroundHandler.post {
    checkScheduled = false
    checkRetainedObjects(reason)
  }
}

private fun checkRetainedObjects(reason: String) {
  val config = configProvider()
  // A tick will be rescheduled when this is turned back on.
  if (!config.dumpHeap) {
    SharkLog.d { "No checking for retained object: LeakCanary.Config.dumpHeap is false" }
    return
  }
  SharkLog.d { "Checking retained object because $reason" }

  var retainedReferenceCount = objectWatcher.retainedObjectCount

  if (retainedReferenceCount > 0) {
    gcTrigger.runGc()
    retainedReferenceCount = objectWatcher.retainedObjectCount
  }

  if (checkRetainedCount(retainedReferenceCount, config.retainedVisibleThreshold)) return

  if (!config.dumpHeapWhenDebugging && DebuggerControl.isDebuggerAttached) {
    showRetainedCountWithDebuggerAttached(retainedReferenceCount)
    scheduleRetainedObjectCheck("debugger was attached", WAIT_FOR_DEBUG_MILLIS)
    SharkLog.d {
        "Not checking for leaks while the debugger is attached, will retry in $WAIT_FOR_DEBUG_MILLIS ms"
    }
    return
  }

  SharkLog.d { "Found $retainedReferenceCount retained references, dumping the heap" }
  val heapDumpUptimeMillis = SystemClock.uptimeMillis()
  KeyedWeakReference.heapDumpUptimeMillis = heapDumpUptimeMillis
  dismissRetainedCountNotification()
  val heapDumpFile = heapDumper.dumpHeap()
  if (heapDumpFile == null) {
    SharkLog.d { "Failed to dump heap, will retry in $WAIT_AFTER_DUMP_FAILED_MILLIS ms" }
    scheduleRetainedObjectCheck("failed to dump heap", WAIT_AFTER_DUMP_FAILED_MILLIS)
    showRetainedCountWithHeapDumpFailed(retainedReferenceCount)
    return
  }
  lastDisplayedRetainedObjectCount = 0
  objectWatcher.clearObjectsWatchedBefore(heapDumpUptimeMillis)

  HeapAnalyzerService.runAnalysis(application, heapDumpFile)
}
```

上面的代码就是对于内存泄漏判定的代码了，首先进入`onObjectRetained`方法，该方法会调用`scheduleRetainedObjectCheck`方法。此方法也就是在后台线程中执行`checkRetainedObjects`方法来检查泄漏的对象：
1. 首先获取泄漏对象的个数，如果大于0，则GC一次之后再次获取
2. 如果此时泄漏对象的个数大于等于5个`config.retainedVisibleThreshold`，则继续执行下面的代码，准备dump heap
3. 如果config里面配置的“调试时不允许dump heap”为false（默认值）且正在调试，则20s之后再试
4. 否则可以开始dump heap：此时会先记下dump发生的时间，取消内存泄漏通知，dump heap，清除所有观测事件小于等于dump发生时间的对象（因为这些对象已经处理完毕了），最后运行HeapAnalyzerService开始分析heap。

第26行的代码是如何获取泄露对象的个数的呢？我们想一下，在前面的代码中，主线程5秒之后执行了一段检测的代码，在这里面将所有泄露的对象都记下了当时的时间，存在`retainedUptimeMillis`字段里面。那么我们遍历所有元素，统计一下该字段不为默认值（-1）的个数即可：

**leakcanary-object-watcher/src/main/java/leakcanary/ObjectWatcher.kt**

```kotlin
/**
  * Returns the number of retained objects, ie the number of watched objects that aren't weakly
  * reachable, and have been watched for long enough to be considered retained.
  */
val retainedObjectCount: Int
  @Synchronized get() {
    removeWeaklyReachableObjects()
    return watchedObjects.count { it.value.retainedUptimeMillis != -1L }
  }
```

第29行，如果有内存泄漏的话，会调用`gcTrigger.runGc()`方法，这里的`gcTrigger`我们提到过，是`GcTrigger.Default`：

**leakcanary/leakcanary-object-watcher/src/main/java/leakcanary/GcTrigger.kt**

```kotlin
/**
  * Default implementation of [GcTrigger].
  */
object Default : GcTrigger {
  override fun runGc() {
    // Code taken from AOSP FinalizationTest:
    // https://android.googlesource.com/platform/libcore/+/master/support/src/test/java/libcore/
    // java/lang/ref/FinalizationTester.java
    // System.gc() does not garbage collect every time. Runtime.gc() is
    // more likely to perform a gc.
    Runtime.getRuntime()
        .gc()
    enqueueReferences()
    System.runFinalization()
  }

  private fun enqueueReferences() {
    // Hack. We don't have a programmatic way to wait for the reference queue daemon to move
    // references to the appropriate queues.
    try {
      Thread.sleep(100)
    } catch (e: InterruptedException) {
      throw AssertionError()
    }
  }
}
```

在上面注释中提到，`System.gc()`并不会每次都会执行GC，`Runtime.gc()`更有可能执行GC。  
执行一次GC操作之后，下面粗暴的等待100ms，这样有足够的时间可以让弱引用移动到合适的引用队列里面。这就是`GcTrigger.Default`所干的事情。

GCTrigger触发GC之后，再次判断一下发生内存泄漏的对象的个数，如果仍然还有，那么肯定是泄漏无疑了，实锤！！  
随后调用`checkRetainedCount(retainedReferenceCount, config.retainedVisibleThreshold)`方法，判断泄漏对象的个数是否达到了阈值，如果达到了则直接dump heap；否则发出一个内存泄漏的通知。  
我们看一下这个方法：

```kotlin
private fun checkRetainedCount(
  retainedKeysCount: Int,
  retainedVisibleThreshold: Int
): Boolean {
  // lastDisplayedRetainedObjectCount默认值为0，此处我们肯定有内存泄漏，因此countChanged为true
  val countChanged = lastDisplayedRetainedObjectCount != retainedKeysCount
  // 保存下当前的内存泄漏对象的个数
  lastDisplayedRetainedObjectCount = retainedKeysCount
  // 如果内存泄漏个数为0，则说明已经处理了所有的内存泄漏
  if (retainedKeysCount == 0) {
    SharkLog.d { "No retained objects" }
    if (countChanged) {
      showNoMoreRetainedObjectNotification()
    }
    return true
  }

  // 如果泄漏个数小于5个
  if (retainedKeysCount < retainedVisibleThreshold) {
    if (applicationVisible || applicationInvisibleLessThanWatchPeriod) {
      SharkLog.d {
          "Found $retainedKeysCount retained objects, which is less than the visible threshold of $retainedVisibleThreshold"
      }
      // 展示一个内存泄漏发生的通知
      showRetainedCountBelowThresholdNotification(retainedKeysCount, retainedVisibleThreshold)
      // 2秒钟之后再次执行检查泄漏对象的方法，看看泄漏个数是否有变化
      scheduleRetainedObjectCheck(
          "Showing retained objects notification", WAIT_FOR_OBJECT_THRESHOLD_MILLIS
      )
      return true
    }
  }
  // 如果泄漏个数大于等于5个，返回false，则返回后checkRetainedObjects方法会继续执行
  // 此时就会dump heap
  return false
}
```

至此，我们已经知道了内存泄漏是如何判定的，正如第3节开头所述：

> **LeakCanary 2.0 beta 3 检测内存泄漏原理**：  
> 在Activity destroy后将Activity的弱引用关联到ReferenceQueue中，这样Activity将要被GC前，会出现在ReferenceQueue中。  
> 随后，会向主线程的抛出一个5秒后执行的Runnable，用于检测内存泄漏。  
> 这段代码首先会将引用队列中出现的对象从观察对象数组中移除，然后再判断要观察的此对象是否存在。若不存在，则说明没有内存泄漏，结束。否则，就说明可能出现了内存泄漏，会调用`Runtime.getRuntime().gc()`进行GC，等待100ms后再次根据引用队列判断，若仍然出现在引用队列中，那么说明有内存泄漏，此时根据内存泄漏的个数弹出通知或者开始dump hprof。

LeakCanary2往后就是如何生成hprof文件以及如何解析了

- 生成hprof可以使用`android.os.Debug.dumpHprofData(String fileName)`方法  
  LeakCanary2中对应代码在/leakcanary-android-core/src/main/java/leakcanary/internal/AndroidHeapDumper.kt +88
- 解析hprof文件，LeakCanary2使用的是[Shark](https://square.github.io/leakcanary/shark/)，这个我也不懂