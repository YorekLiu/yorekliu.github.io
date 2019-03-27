---
title: "Week16-进程保活"
categories:
  - Android
tags:
  - 知识星球
  - 进程保活
toc: true
toc_label: "目录"
# last_modified_at: 2019-03-20T17:51:34+08:00
---

## Question

进程保活

## Answer

进程保活方案就固定的几个，网上的资料基本都讲到了。

总的来说，思路分为两个方面：

1. 提高进程优先级，降低被系统杀死的可能性
2. 在进程被杀死后，进行拉活

下面分别对这两方面进行论述。在正式开始第一方面之前，需要先了解一下进程优先级的划分。

### 前言

#### 进程优先级

[Processes and Application Lifecycle](https://developer.android.com/guide/components/activities/process-lifecycle)
{: .notice--info }

进程的重要性程度依次为：

1. **前台进程**  
  用户当前操作所必须的进程。如果一个进程满足以下任一条件，即视为前台进程：  
    - 拥有用户正在交互的`Activity`（已调用`Activity`的`onResume()`方法）  
    - 拥有绑定到用户正在交互的`Activity`上的某个`Service`
    - 拥有正在“前台”运行的`Service`（服务已调用`startForeground()`）
    - 拥有正执行一个生命周期回调的`Service`（`onCreate()`、`onStart()`或`onDestroy()`）
    - 拥有正执行其`onReceive()`方法的`BroadcastReceiver`
  通常，在任何时候前台进程都不多。只有在内存不足以支持它们同时继续运行，这一万不得已的情况下，系统才会终止它们。此时，设备往往已达到内存分页状态，因此需要终止一些前台进程来确保用户界面正常响应。
2. **可见进程**  
  正在执行用户可感知的任务，被杀死会将对用户体验产生明显的负影响。如果一个进程满足以下任一条件，即视为可见进程：
    - 拥有不在前台、但仍对用户可见的`Activity`（已调用其`onPause()`方法）。例如，如果前台`Activity`以对话框的形式显示出来，这样可以露出来上一个`Activity`，则有可能会发生这种情况。  
    
    例子的原文是***if the foreground Activity is displayed as a dialog that allows the previous Activity to be seen behind it***，本人觉得大部分翻译（包括官方中文）都不太准确，所以自行翻译了一下。
    {: .notice--info }

    - 拥有通过`Service.startForeground()`方式来在前台服务运行的`Service`
    - 拥有一个系统用来提供用户有感的特别功能（比如动态壁纸，输入法服务等）的`Service`  
3. **服务进程**  
  正在运行已使用`startService()`方法启动的`Service`的进程。尽管服务进程与用户所见内容没有直接关联，但是它们通常在执行一些用户关心的操作（例如，在后台播放音乐或从网络下载数据）。因此，除非内存不足以维持所有前台进程和可见进程同时运行，否则系统会让服务进程保持运行状态。  
  已经运行了很长时间（例如30分钟或更长）的服务可能会降级，以允许其进程下降到下面描述的缓存LRU列表。这有助于避免非常长时间运行的服务出现内存泄漏或其他问题而占用大量RAM，进而导致系统无法有效使用缓存进程的情况。
4. **缓存进程**  
  缓存进程是当前不需要的进程，因此当其他地方需要内存时，系统可以根据需要自由地终止进程。在正常运行的系统中，这些是内存管理中涉及的唯一过程：运行良好的系统将始终具有多个缓存进程（用于在应用程序之间进行更高效的切换），并根据需要定期终止最旧的进程。只有在非常关键（且不可取）的情况下，系统才会杀死所有缓存进程，并且必须开始杀死服务进程。  
  **这些进程通常包含一个或多个当前对用户不可见的`Activity`实例（已调用并返回`onStop()`方法）**。如果他们正确地实现了他们的Activity生命周期，当系统杀死此类进程时，它不会影响用户返回该应用程序时的体验：它可以在新进程中重新创建相关Activity时恢复以前保存的状态。
  这些进程保存在伪LRU列表中，列表中的最后一个进程是第一个被回收内存的进程。在此列表上排序的确切策略是平台的实现细节，但通常它会尝试在其他类型的进程之前保留更多有用的进程（用户的桌面程序所在的进程、用户看到的最后一个Activity所在的进程等）。还可以应用其他用于终止进程的策略：对允许的进程数量的硬限制，对进程可以持续缓存的时间量的限制等。

在作者撰写该文章时，英文官网对于进程的重要性分类只有以上这四种，与中文官网的五种不同。英文官网中把中文官网里面的**后台进程**和**空进程**合并到了**缓存进程**中。  
疑是中文版本没有及时更新：[进程生命周期](https://developer.android.com/guide/components/processes-and-threads.html#Lifecycle)，注意查看时在最下面把语言调整为中文，英文语言时这段内容是不可见的。
{: .notice--info }

#### 进程回收策略

上文谈到，进程有几种优先级，优先级越高越不容易被回收；越低越容易被回收。  
这里的回收策略是Low Memory Killer机制，它是根据OOM_ADJ阈值级别触发相应力度的内存回收的机制。  

关于OOM_ADJ常量的一些定义，在文件**frameworks/base/services/core/java/com/android/server/am/ProcessList.java**中，详细定义如下，后面还有简单表格：

```java
// Adjustment used in certain places where we don't know it yet.
// (Generally this is something that is going to be cached, but we
// don't know the exact value in the cached range to assign yet.)
static final int UNKNOWN_ADJ = 16;

// This is a process only hosting activities that are not visible,
// so it can be killed without any disruption.
static final int CACHED_APP_MAX_ADJ = 15;
static final int CACHED_APP_MIN_ADJ = 9;

// The B list of SERVICE_ADJ -- these are the old and decrepit
// services that aren't as shiny and interesting as the ones in the A list.
static final int SERVICE_B_ADJ = 8;

// This is the process of the previous application that the user was in.
// This process is kept above other things, because it is very common to
// switch back to the previous app.  This is important both for recent
// task switch (toggling between the two top recent apps) as well as normal
// UI flow such as clicking on a URI in the e-mail app to view in the browser,
// and then pressing back to return to e-mail.
static final int PREVIOUS_APP_ADJ = 7;

// This is a process holding the home application -- we want to try
// avoiding killing it, even if it would normally be in the background,
// because the user interacts with it so much.
static final int HOME_APP_ADJ = 6;

// This is a process holding an application service -- killing it will not
// have much of an impact as far as the user is concerned.
static final int SERVICE_ADJ = 5;

// This is a process with a heavy-weight application.  It is in the
// background, but we want to try to avoid killing it.  Value set in
// system/rootdir/init.rc on startup.
static final int HEAVY_WEIGHT_APP_ADJ = 4;

// This is a process currently hosting a backup operation.  Killing it
// is not entirely fatal but is generally a bad idea.
static final int BACKUP_APP_ADJ = 3;

// This is a process only hosting components that are perceptible to the
// user, and we really want to avoid killing them, but they are not
// immediately visible. An example is background music playback.
static final int PERCEPTIBLE_APP_ADJ = 2;

// This is a process only hosting activities that are visible to the
// user, so we'd prefer they don't disappear.
static final int VISIBLE_APP_ADJ = 1;

// This is the process running the current foreground app.  We'd really
// rather not kill it!
static final int FOREGROUND_APP_ADJ = 0;

// This is a process that the system or a persistent process has bound to,
// and indicated it is important.
static final int PERSISTENT_SERVICE_ADJ = -11;

// This is a system persistent process, such as telephony.  Definitely
// don't want to kill it, but doing so is not completely fatal.
static final int PERSISTENT_PROC_ADJ = -12;

// The system process runs at the default adjustment.
static final int SYSTEM_ADJ = -16;

// Special code for native processes that are not being managed by the system (so
// don't have an oom adj assigned by the system).
static final int NATIVE_ADJ = -17;
```

<figcaption>OOM_ADJ常量的定义以及解释</figcaption>

| ADJ级别 | 值 | 解释 |
| :----- | :- | :-- |
| UNKNOWN_ADJ | 16 | 一般指进程将要被缓存，但是不知道将要被赋予缓存区间的具体的值 |
| CACHED_APP_MAX_ADJ | 15 | 缓存进程的最大值 |
| CACHED_APP_MIN_ADJ | 9 | 缓存进程的最小值 |
| SERVICE_B_ADJ | 8 | SERVICE_ADJ的B list，里面都是年老的Service，没有A list中的有趣 |
| PREVIOUS_APP_ADJ | 7 | 上一个App的进程 |
| HOME_APP_ADJ | 6 | 桌面进程 |
| SERVICE_ADJ | 5 | 服务进程 |
| HEAVY_WEIGHT_APP_ADJ | 4 | 重量级后台进程，在`system/rootdir/init.rc`中设置 |
| BACKUP_APP_ADJ | 3 | 正在进行备份操作 |
| PERCEPTIBLE_APP_ADJ | 2 | 用户有感进程，例如后台音乐播放 |
| VISIBLE_APP_ADJ | 1 | 可见进程 |
| FOREGROUND_APP_ADJ | 0 | 前台进程 |
| PERSISTENT_SERVICE_ADJ | -11 | 系统进程或persistent进程已绑定的进程 |
| PERSISTENT_PROC_ADJ | -12 | 系统persistent进程，比如telephony |
| SYSTEM_ADJ | -16 | 系统进程 |
| NATIVE_ADJ | -17 | native进程（不被系统管理） |

`ProcessList`中还有关于LMK的其他的一些定义（比如`PAGE_SIZE`、`MIN_CACHED_APPS`、`MAX_CACHED_APPS`等），这里不展开了。  
在上面的这些OOM_ADJ中：
- OOM_ADJ>=4，代表比较容易被杀死的Android进程
- 0 <= OOM_ADJ <= 3，表示不容易被杀死的Android进程
- 其他小于0的表示非Android进程，这些都是纯Linux进程

可有通过shell查看进程的优先级：

```shell
m3note:/ # ps | grep yorek
u0_a111   6320  358   2038500 73404 SyS_epoll_ 7f09f722c0 S xyz.yorek.redpan
m3note:/ # cat proc/6320/oom_adj
0
m3note:/ # cat proc/6320/oom_adj
12
m3note:/ # cat proc/6320/oom_adj
15
```

1. 首先通过`ps | grep <keyword>`找出关心的线程的pid，这里是6320。
2. 然后app在前台运行的时候`cat`一下，结果是0，查表为`FOREGROUND_APP_ADJ`常量
3. 按下HOME键回到桌面，此时结果是12，介于`CACHED_APP_MIN_ADJ`和`CACHED_APP_MAX_ADJ`之间
4. 重新进入app，退出应用回到桌面，结果为15，为`CACHED_APP_MAX_ADJ`

另外，在使用了前台通知提升优先级的情况下，获取的结果为3。*当然，此方法有一些注意点，在遇到具体方案时再说*。

下面正式分析一些保活方案，还是从两个方面来说。

### 提高进程优先级

该方面可以从`Activity`和`Service`两个点出发：

1. 利用Activity提升权限
  1像素大小、透明的Activity。解决息屏后被杀死的问题。
2. 带通知的前台Service
  可以利用黑科技取消通知（7.1已失效），但进程优先级不会变

下面依次给出实现代码。

#### 利用Activity提升权限

此方式主要解决息屏后被系统杀死的情况。我们可以监听息屏和解锁的广播，在息屏时启动一个只有一个像素的透明Activity，此时应用就位于前台了，优先级为0。在解锁时将此Activity销毁。这样不会让用户感觉到流氓。  

**关于息屏和解锁的广播：**在8.0开始，不能在manifest文件中声明这些广播，只能在代码中动态注册。所以，如果保活的Activity位于另外一个进程中，需要特别注意一下进程问题。  
[Broadcasts overview - Android 8.0](https://developer.android.com/guide/components/broadcasts#android_80)
{: .notice--warning }

在下面的代码中，由于保活的Activity位于`:live`进程中，所以导致receiver也在要此进程中进行动态注册，才能有效地管理保活Activity。于是在`:live`进程中新增了一个`Service`达到了此目的。

首先，在应用中适当的位置开启上面说的这个后台Service：

```java
startService(Intent(this, KeepLiveActivity.KLService::class.java))
```

在该Service中代码注册广播`KeepLiveReceiver`：

```java
class KLService : Service() {
    override fun onBind(intent: Intent?) = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val filter = IntentFilter()
        filter.addAction(Intent.ACTION_SCREEN_OFF)
        filter.addAction(Intent.ACTION_USER_PRESENT)
        val keepLiveReceiver = KeepLiveReceiver()
        registerReceiver(keepLiveReceiver, filter)
        return START_STICKY
    }
}
```

该广播中会监听两个ACTION，并调用`KeepLiveManager`进行对应的处理：

```java
class KeepLiveReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action

        if (Intent.ACTION_SCREEN_OFF == action) {
            // 息屏事件，开启保活Activity
            KeepLiveManager.startKeepLiveActivity(context)
        } else if (Intent.ACTION_USER_PRESENT == action) {
            // 用户解锁了，赶紧销毁此Activity
            KeepLiveManager.finishKeepLiveActivity()
        }
    }
}

object KeepLiveManager {
    private var mActivitySR: SoftReference<Activity>? = null

    /** 在保活Activity创建的时候调用，解锁屏幕时销毁的时候使用 */
    fun setActivity(activity: Activity) {
        mActivitySR = SoftReference(activity)
    }

    /** 开启保活Activity */
    fun startKeepLiveActivity(context: Context) {
        val intent = Intent(context, KeepLiveActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
        context.startActivity(intent)
    }

    /** 用户解锁了，调用保活Activity的finish方法 */
    fun finishKeepLiveActivity() {
        mActivitySR?.get()?.finish()
    }
}
```

最后就是保活Activity的内容了：

```java
class KeepLiveActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // 将Activity的window调成1像素大小，然后放到左上角
        val tempWindow = window
        tempWindow.setGravity(Gravity.START or Gravity.TOP)
        val params = tempWindow.attributes
        params.x = 0
        params.y = 0
        params.width = 1
        params.height = 1
        tempWindow.attributes = params
        // 将Activity的引用保存到KeepLiveManager中，销毁的时候使用
        KeepLiveManager.setActivity(this)
    }
}
```

当然，上面这些组件需要注册一下：

```xml
<activity android:name=".activity.KeepLiveActivity"
          android:excludeFromRecents="true"
          android:exported="false"
          android:finishOnTaskLaunch="false"
          android:process=":live"
          android:theme="@style/KeepLiveTheme"/>
<service android:name=".activity.KeepLiveActivity$KLService"
          android:process=":live"/>
```

测试结果（:live进程）：

```shell
generic_x86:/ # cat proc/5201/oom_adj  # app在前台
13
generic_x86:/ # cat proc/5201/oom_adj  # app在后台
13
generic_x86:/ # cat proc/5201/oom_adj  # 锁屏时
0
```

#### 带通知的前台Service

将Service设置为前台，可以使整个进程优先级变为

### 进程保活
  

## 参考资料


- [进程保活方案 - 简书](https://www.jianshu.com/p/845373586ac1)
- [Android常见进程保活方法](https://www.jianshu.com/p/6665bdb6c948)
- [Android进程保活招数概览](https://www.jianshu.com/p/c1a9e3e86666)