---
title: "进程保活"
---

进程保活方案就固定的几个，网上的资料基本都讲到了。

总的来说，思路分为两个方面：

1. 提高进程优先级，降低被系统杀死的可能性
2. 在进程被杀死后，进行拉活

下面分别对这两方面进行论述。在正式开始第一方面之前，需要先了解一下进程优先级的划分。

## 1. 前言

### 1.1 进程优先级

!!! info
    [Processes and Application Lifecycle](https://developer.android.com/guide/components/activities/process-lifecycle)

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
      > 例子的原文是 **if the foreground Activity is displayed as a dialog that allows the previous Activity to be seen behind it**，本人觉得大部分翻译（包括官方中文）都不太准确，所以自行翻译了一下。
    - 拥有通过`Service.startForeground()`方式来在前台服务运行的`Service`
    - 拥有一个系统用来提供用户有感的特别功能（比如动态壁纸，输入法服务等）的`Service`  
3. **服务进程**  
  正在运行已使用`startService()`方法启动的`Service`的进程。尽管服务进程与用户所见内容没有直接关联，但是它们通常在执行一些用户关心的操作（例如，在后台播放音乐或从网络下载数据）。因此，除非内存不足以维持所有前台进程和可见进程同时运行，否则系统会让服务进程保持运行状态。  
  已经运行了很长时间（例如30分钟或更长）的服务可能会降级，以允许其进程下降到下面描述的缓存LRU列表。这有助于避免非常长时间运行的服务出现内存泄漏或其他问题而占用大量RAM，进而导致系统无法有效使用缓存进程的情况。
4. **缓存进程**  
  缓存进程是当前不需要的进程，因此当其他地方需要内存时，系统可以根据需要自由地终止进程。在正常运行的系统中，这些是内存管理中涉及的唯一过程：运行良好的系统将始终具有多个缓存进程（用于在应用程序之间进行更高效的切换），并根据需要定期终止最旧的进程。只有在非常关键（且不可取）的情况下，系统才会杀死所有缓存进程，并且必须开始杀死服务进程。  
  **这些进程通常包含一个或多个当前对用户不可见的`Activity`实例（已调用并返回`onStop()`方法）**。如果他们正确地实现了他们的Activity生命周期，当系统杀死此类进程时，它不会影响用户返回该应用程序时的体验：它可以在新进程中重新创建相关Activity时恢复以前保存的状态。  
  这些进程保存在伪LRU列表中，列表中的最后一个进程是第一个被回收内存的进程。在此列表上排序的确切策略是平台的实现细节，但通常它会尝试在其他类型的进程之前保留更多有用的进程（用户的桌面程序所在的进程、用户看到的最后一个Activity所在的进程等）。还可以应用其他用于终止进程的策略：对允许的进程数量的硬限制，对进程可以持续缓存的时间量的限制等。

!!! warning
    在作者撰写该文章时，英文官网对于进程的重要性分类只有以上这四种，与中文官网的五种不同。英文官网中把中文官网里面的 **后台进程** 和 **空进程** 合并到了 **缓存进程** 中。  
    疑是中文版本没有及时更新：[进程生命周期](https://developer.android.com/guide/components/processes-and-threads.html#Lifecycle)，注意查看时在最下面把语言调整为中文，英文语言时这段内容是不可见的。

### 1.2 进程回收策略

上文谈到，进程有几种优先级，优先级越高越不容易被回收；越低越容易被回收。  
这里的回收策略是Low Memory Killer机制，它是根据OOM_ADJ阈值级别触发相应力度的内存回收的机制。  

关于OOM_ADJ常量的一些定义，在文件 **frameworks/base/services/core/java/com/android/server/am/ProcessList.java** 中，详细定义如下，后面还有简单表格：

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

上面这些数值是6.0源码里面的值，从7.0开始取值不一样了。但是优先级关系还是一致的。  
see [7.0.0_r1_ProcessList.java](http://androidxref.com/7.0.0_r1/xref/frameworks/base/services/core/java/com/android/server/am/ProcessList.java#58)

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

另外，在使用了前台通知提升优先级的情况下，获取的结果为1。*当然，此方法有一些注意点，在下面具体方案讨论时再说*。

下面正式分析一些保活方案，还是从两个方面来说。

## 2. 提高进程优先级

该方面可以从`Activity`和`Service`两个点出发：

1. 利用Activity提升权限
  1像素大小、透明的Activity。解决息屏后被杀死的问题。
2. 带通知的前台Service
  可以利用黑科技取消通知（7.1已失效），但进程优先级不会变

下面依次给出实现代码。

### 2.1 利用Activity提升权限

此方式主要解决息屏后被系统杀死的情况。我们可以监听息屏和解锁的广播，在息屏时启动一个只有一个像素的透明Activity，此时应用就位于前台了，优先级为0。在解锁时将此Activity销毁。这样不会让用户感觉到流氓。  

!!! note "关于息屏和解锁的广播"
    在8.0开始，不能在manifest文件中声明这些广播，只能在代码中动态注册。所以，如果保活的Activity位于另外一个进程中，需要特别注意一下进程问题。  
    系统广播改动——[Changes to system broadcasts](https://developer.android.com/guide/components/broadcasts#changes-system-broadcasts)  
    可静态注册广播的列表——[Implicit Broadcast Exceptions](https://developer.android.com/guide/components/broadcast-exceptions)

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
          android:launchMode="singleInstance"
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

### 2.2 带通知的前台Service

将Service设置通过`startForeground`为前台，可以使整个进程变为前台进程。可以通过一些手段将通知栏通知取消掉，但在7.1及以后失效了。  
另外在[前面](/android/paid/zsxq/week16-keep-app-alive/#12)提到，由于7.0源码的更新，进程优先级的值有了些许差别，但是整个优先级序列是没有改变的。

在各版本模拟器上测的进程位于后台时的优先级如下：

| API Level | 进程优先级 | 注意事项 |
| :-------: | :----------: | ------------- |
| 7.0之前 | 1 | 通知栏没有前台服务的通知，可以被黑科技取消 |
| 7.0 | 3 | 通知栏没有前台服务的通知，可以被黑科技取消 |
| 7.1 | 3 | 通知栏有前台服务的通知，黑科技开始失效 |
| 8.0 | 3 | 通知栏有前台服务的通知<br />需要给Notification配置Channel了 |
| 9.0 | 3 | 通知栏有前台服务的通知<br />需要给Notification配置Channel<br />此外需要在AndroidManifest中注册`android.permission.FOREGROUND_SERVICE`权限 |
| Q beta1  | su指令缺失<br />无法获取 | 通知栏有前台服务的通知<br />需要给Notification配置Channel<br />要求`android.permission.FOREGROUND_SERVICE`权限 |

下面所有的代码：

```kotlin
class KeepLiveService : Service() {
    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.JELLY_BEAN_MR2) {
            startForeground(NOTIFY_ID, Notification())
        } else {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channelName = "channel_name"
                val desc = "channel_desc"
                val importance = NotificationManager.IMPORTANCE_LOW

                NotificationChannel(CHANNEL_ID, channelName, importance).apply {
                    description = desc
                    val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                    notificationManager.createNotificationChannel(this)
                }
            }

            val notification = NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .build()
            startForeground(NOTIFY_ID, notification)
            startService(Intent(this, StopNotificationService::class.java))
        }
        return START_STICKY
    }

    companion object {
        const val NOTIFY_ID = 10000
        const val CHANNEL_ID = "channel_id"
    }

    class StopNotificationService : Service() {
        override fun onBind(intent: Intent?) = null

        override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
            val notification = NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .build()
            startForeground(NOTIFY_ID, notification)
            stopSelf()

            return super.onStartCommand(intent, flags, startId)
        }
    }
}
```

此外还需要在`AndroidManifest.xml`中配置两个Service以及一个权限。

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
          package="xyz.yorek.xxx">

    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />

    <application
            ...>

        <service android:name=".service.KeepLiveService"/>
        <service android:name=".service.KeepLiveService$StopNotificationService"/>

    </application>

</manifest>
```

!!! success
    此方法tinker也有在用：[TinkerPatchService#increasingPriority](https://github.com/Tencent/tinker/blob/master/tinker-android/tinker-android-lib/src/main/java/com/tencent/tinker/lib/service/TinkerPatchService.java#L159)

## 3. 进程拉活

1. 利用系统广播  
    - 思想：在发生特定系统事件时，系统会发出响应的广播，通过“静态”注册对应的广播监听器，即可在发生响应事件时拉活。
    - 适用范围：适用于全部Android平台
    - 缺点：  
        * 在前文中有提到，从8.0开始，很多广播只能在代码中动态注册，无法静态注册。也就是说，App被杀死后，无法接收到系统的广播了。
        * 广播接收器被管理软件、系统软件通过“自启管理”等功能禁用的场景无法接收到广播，从而无法自启
        * 系统广播事件不可控，只能保证发生事件时拉活进程，但无法保证进程挂掉后立即拉活
2. 利用第三方应用广播
    - 思想：与接收系统广播类似，此处接收第三方头部应用的广播，这时候是可以静态注册的。
    - 适用范围：与系统广播一样。
    - 缺点：
        - 反编译分析过的第三方应用的多少
        - 第三方应用的广播属于应用私有，当前版本中有效的广播，在后续版本随时就可能被移除或被改为不外发
3. 利用系统Service机制
    - 思想：将`Service#onStartCommand`返回值设置为`START_STICKY`，利用系统在`Service`挂掉后会自动拉活。
    - 缺点：
        - Service第一次被异常杀死后很快被重启，第二次会比第一次慢，第三次又会比前一次慢，一旦在短时间内Service被杀死4-5次，则系统不再拉起。
        - 进程被取得Root权限的管理工具或系统工具通过force stop掉，无法重启
4. Native进程监听主进程的状态
    - 思想：利用Linux中的`fork`机制创建Native进程，在Native进程中监控主进程的存活，当主进程挂掉后，在Native进程中立即对主进程进行拉活
    - 适用范围：  
    主要适用于Android 5.0以下版本手机。  
    对于Android 5.0以上手机，系统虽然会将Native进程内的所有进程都杀死，这里其实就是系统“依次”杀死进程时间与拉活逻辑执行时间赛跑的问题，如果可以跑的比系统逻辑快，依然可以有效拉起。
    - 方法实现挑战：
        - 在Native进程中如何感知主进程死亡
            1. 在Native进程中通过死循环或定时器，轮训判断主进程是否存活，档主进程不存活时进行拉活。该方案的很大缺点是不停的轮询执行判断逻辑，非常耗电。
            2. 在主进程中创建一个监控文件，并且在主进程中持有文件锁。在拉活进程启动后申请文件锁将会被堵塞，一旦可以成功获取到锁，说明主进程挂掉，即可进行拉活。由于Android中的应用都运行于虚拟机之上，Java层的文件锁与Linux层的文件锁是不同的，要实现该功能需要封装Linux层的文件锁供上层调用。
        - 在Native进程中如何拉活主进程  
          通过am命令进行拉活。通过指定“--include-stopped-packages”参数来拉活主进程处于forestop状态的情况
        - 如何保证Native进程的唯一  
          从可扩展性和进程唯一等多方面考虑，将Native进程设计成C/S结构模式，主进程与Native进程通过`Localsocket`进行通信。在Native进程中利用Localsocket保证Native进程的唯一性，不至于出现创建多个Native进程以及Native进程变成僵尸进程等问题。
5. 双进程守护
    - 思想：Service被系统杀死时会回调`ServiceConnection.onServiceDisconnected`方法。利用此原理，可以在两个进程中开启两个Service互绑。
    - 适用范围：主要适用于Android 5.0以下版本手机。高版本中，双Service方案也改成了应用被杀，任何后台Service无法正常状态运行。
6. 利用JobScheduler机制
    - 思想：5.0以后系统对native进程等加强了管理，native拉活方式失效。系统在Android 5.0以上版本提供了`JobScheduler`接口，系统会定时调用该进程以使应用进行一些逻辑操作。可以搭配前台Service技术提高进程优先级。
    - 适用范围：主要适用于Android 5.0以上版本手机，7.0时候有一定影响（可以在电源管理中给APP授权）。该方案在Android 5.0以上版本中不受force stop影响，被强制停止的应用依然可以被拉活，在Android 5.0以上版本拉活效果非常好。仅在小米手机可能会出现有时无法拉活的问题。
7. 后台播放无声音频
    - 思想：启动一个第3点的`START_STICKY` Service，且在`onDestory`方法中重启自身，然后在Service利用`MediaPlayer.setLooping(true)`循环播放音频。
    - 使用范围：适用于7.0下手机。
8. 利用账号同步机制
    - 思想：Android系统的账号同步机制会定期同步账号进行，该方案目的在于利用同步机制进行进程的拉活。
    - 适用范围：该方案适用于所有的Android版本，包括被force stop掉的进程也可以进行拉活。最新Android版本（Android N）中系统好像对账户同步这里做了变动，该方法不再有效。

## 4. 其他策略

经研究发现还有其他一些系统拉活措施可以使用，但在使用时需要用户授权，用户感知比较强烈。这些方案包括：

1. 利用系统通知管理权限进行拉活
2. 利用辅助功能拉活，将应用加入厂商或管理软件白名单。

这些方案需要结合具体产品特性。

其他还有一些技术之外的措施，比如说应用内Push通道的选择：

- 国外版应用：接入Google的GCM/FCM。
- 国内版应用：根据终端不同，在小米手机（包括 MIUI）接入小米推送、华为手机接入华为推送；其他手机可以考虑接入极光、个推等。

## 5. 参考资料

- [进程保活方案 - 简书](https://www.jianshu.com/p/845373586ac1)
- [【腾讯Bugly干货分享】Android 进程保活招式大全](https://segmentfault.com/a/1190000006251859)
- [Android进程保活招数概览](https://www.jianshu.com/p/c1a9e3e86666)
- [2018年Android的保活方案效果统计](https://www.jianshu.com/p/b5371df6d7cb)