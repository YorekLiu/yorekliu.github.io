---
title: "Broadcasts"
---

本章的主要内容是[Broadcasts](https://developer.android.com/guide/components/broadcasts.html)

Broadcasts是一种通讯组件，Android应用程序可以发送或接收来自Android系统和其他Android应用程序的广播消息，类似于观察者设计模式。当感兴趣的事件发生时，这些广播被发送。例如，当各种系统事件（例如系统启动或设备开始充电）发生时，Android系统会发送广播。应用程序还可以发送自定义广播，例如，通知其他应用程序可能感兴趣的内容（例如，一些新数据已被下载）。

## 1 系统广播
系统广播的action的列表，可以在SDK中找到，目录是`platforms/android-25/data/broadcast_actions.txt`

### 1.1 系统广播的变更
Android 7.0及以上平台不可以发送以下系统广播，该项优化影响所有的应用，不仅仅是目标为Android 7.0的应用：  

- ACTION_NEW_PICTURE  
- ACTION_NEW_VIDEO

应用目标为Android 7.0 (API level 24)及更高平台必须动态注册以下广播，静态注册无效：

- CONNECTIVITY_ACTION

## 2 广播的注册
应用可以有两种方式注册BroadcastReceiver，第一种为在manifest中注册的静态注册，第二种为通过context在代码中注册的动态注册。

### 2.1 静态注册
通过静态注册的receiver，在应用安装时系统包管理器会注册此receiver。此receiver会变成应用的一个独立入口点，这意味着如果应用没有正在运行，系统可以启动应用然后在传递广播。
系统会创建新的BroadcastReceiver组件处理每一个接收到的广播。该对象仅仅在调用`onReceive(Context, Intent)`方法期间才是合法的，一旦该方法返回了，系统会认为此组件不再是active状态。

### 2.2 动态注册
动态注册时需要注意，不再需要该接受者或者context不再合法时`unregisterReceiver`。
动态注册的广播接收者只要它们注册的上下文有效就一直接收广播。例如，如果用Activity的context注册，主要Activity不被销毁，你就可以接收广播。如果使用Application的context，应用在运行时都可以接收广播。

>1. 在`onReceive`中不易进行耗时操作，其最长只有10s的周期。如果需要多一点点时间执行作业的话，可以使用`goAsync()`或者启动`JobSchedule`
>2. 如果只需要应用内广播，可以使用本地广播`LocalBroadcastManager.registerReceiver(BroadcastReceiver, IntentFilter)`来替代。

## 3 广播的发送

Android提供了四种广播的发送方式：

1. `sendOrderedBroadcast(Intent, String)`发送有序广播  
该广播一次发送给一个接受者，每个接受者轮流执行，该广播可以携带结果给下一个接受者，或者被接受者丢弃，这样就不会传递给下一个接受者了。接受者的顺序按照`android:priority`排列，同一优先级的广播接收者将会无序执行。
2. `sendBroadcast(Intent)`发送普通广播  
3. `sendStickyBroadcast` or `sendStickyOrderedBroadcast`发送粘性广播，不过此类广播由于不安全（都能访问）、没有保护（都能修改）以及其他的问题，已经被弃用了。
4. `LocalBroadcastManager.sendBroadcast`发送本地广播  
在不需要发送跨app广播时，发送本地广播是最佳的选择。第一，其效率比较高(因为不用考虑IPC)；第二，也不用当心其他应用接收或者发送该广播而导致的安全性问题。

> 如果想要只发送广播给特定的应用，可以使用Intent的`setPackage(String)`方法

## 4 使用权限限制广播
### 4.1 带权限发送
调用`sendBroadcast(Intent, String)`或`sendOrderedBroadcast(Intent, String, BroadcastReceiver，Handler, int, String, Bundle)`时，可以指定权限参数。 只有已经请求了标签中的权限标签（或者因为是危险权限后面被运行时授予的权限）的接收者才可以接收广播。
例如，下面代码发送广播：
```java
sendBroadcast(new Intent("com.example.NOTIFY"), Manifest.permission.SEND_SMS);
```
要接收广播，接收应用程序必须如下所示请求权限：
```xml
<uses-permission android：name =“android.permission.SEND_SMS”/>
```
可以指定现有的系统权限，如SEND_SMS或定义一个自定义权限 <permission>元素。

### 4.2 带权限接收
当注册广播接收者(无论是通过`registerReceiver(BroadcastReceiver, IntentFilter, String, Handler)`注册还是通过在manifest文件<receiver>标签中)，特别申明一个权限参数时，只有已经请求了标签中的权限标签（或者因为是危险权限后面被运行时授予的权限）的接收者才可以发送广播。
例如，假设接收广播的应用已经在manifest文件中声明了如下receiver：
```xml
<receiver android:name=".MyBroadcastReceiver" android:permission="android.permission.SEND_SMS">
    <intent-filter>
        <action android:name="android.intent.action.AIRPLANE_MODE"/>   
    </intent-filter>
</receiver>
```
或者通过动态注册的receiver有如下代码：
```java
IntentFilter filter = new IntentFilter(Intent.ACTION_AIRPLANE_MODE_CHANGED);
registerReceiver(receiver, filter, Manifest.permission.SEND_SMS, null );
```
为了能够发射广播到这些receivers，发射应用必须请求下面的权限：
```xml
<uses-permission android:name="android.permission.SEND_SMS"/>
```

## 5. LocalBroadcastManager

`LocalBroadcastManager`可以用来发送App内广播，它具有以下特点：

1. 本地广播只能在自身App内传播，不必担心泄漏隐私数据
2. 本地广播不允许其他App对你的App发送该广播，不必担心安全漏洞被利用
3. 本地广播比全局广播更高效

`LocalBroadcastManager`的特点来源于其实现方式：

- 由于动态注册广播、发送广播需要通过`LocalBroadcastManager`实例，该实例是单例模式实现，其他App无法获取到自身App中的实例，因此，第1、2点是成立的。  
- 最后，由于`LocalBroadcastManager`不需要经过AMS，这样就少了两个IPC过程，显然更高效，第3点成立。

### 5.1 LocalBroadcastManager的使用

`LocalBroadcastManager`的使用非常简单，代码如下：

注册广播：

```kotlin
private val mBroadcastReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        Log.e(TAG, "onReceive action=${intent?.action}")
    }
}

val intentFilter = IntentFilter(ACTION_TEST)
LocalBroadcastManager.getInstance(this).registerReceiver(mBroadcastReceiver, intentFilter)
```

发送广播：

```kotlin
val intent = Intent(ACTION_TEST)
LocalBroadcastManager.getInstance(this).sendBroadcast(intent)
```

### 5.2 源码解析

先看看`LocalBroadcastManager`的单例方法：

```java
@NonNull
public static LocalBroadcastManager getInstance(@NonNull Context context) {
    synchronized (mLock) {
        if (mInstance == null) {
            mInstance = new LocalBroadcastManager(context.getApplicationContext());
        }
        return mInstance;
    }
}

private LocalBroadcastManager(Context context) {
    mAppContext = context;
    mHandler = new Handler(context.getMainLooper()) {

        @Override
        public void handleMessage(Message msg) {
            switch (msg.what) {
                case MSG_EXEC_PENDING_BROADCASTS:
                    executePendingBroadcasts();
                    break;
                default:
                    super.handleMessage(msg);
            }
        }
    };
}
```

这里`LocalBroadcastManager`采用了单例模式，在构造器中保存了一个ApplicationContext，同时初始化了一个主线程的`mHandler`。该Handler的作用就是在主线程中执行各个`BroadcastReceiver`的`onReceiver`方法，这符合我们对`BroadcastReceiver`的认知。

在看注册方法之前，我们先看一下`LocalBroadcastManager`里面的保存BroadcastReceiver的数据结构：

```java
private final HashMap<BroadcastReceiver, ArrayList<ReceiverRecord>> mReceivers = new HashMap<>();
private final HashMap<String, ArrayList<ReceiverRecord>> mActions = new HashMap<>();

// register的两个参数会封装成为该类型
private static final class ReceiverRecord {
    final IntentFilter filter;
    final BroadcastReceiver receiver;
    boolean broadcasting;
    boolean dead;

    ReceiverRecord(IntentFilter _filter, BroadcastReceiver _receiver) {
        filter = _filter;
        receiver = _receiver;
    }
    ...
}
```

`ReceiverRecord`就是register方法中传入的两个参数包装而成的。  
`mReceivers`里面存放是`BroadcastReceiver`到`ArrayList<ReceiverRecord>`的映射，方便在注册、注销的时候使用；而`mActions`里面存放是`Action`到`ArrayList<ReceiverRecord>`的映射，方便发送广播时找到可以响应的`BroadcastReceiver`。

下面继续看看注册广播的代码，代码比较简单，解释在注释中：

```java
public void registerReceiver(@NonNull BroadcastReceiver receiver,
        @NonNull IntentFilter filter) {
    synchronized (mReceivers) {
        // 将入参包装为ReceiverRecord对象
        ReceiverRecord entry = new ReceiverRecord(filter, receiver);
        // 1. receiver对应的value还没有初始化，则初始化
        // 2. 向receiver对应的value中添加ReceiverRecord对象
        ArrayList<ReceiverRecord> filters = mReceivers.get(receiver);
        if (filters == null) {
            filters = new ArrayList<>(1);
            mReceivers.put(receiver, filters);
        }
        filters.add(entry);
        // 遍历入参filter中的actions，对于每个action
        // 1. action对应的value还没有初始化，则初始化
        // 2. 向action对应的value中添加ReceiverRecord对象
        for (int i=0; i<filter.countActions(); i++) {
            String action = filter.getAction(i);
            ArrayList<ReceiverRecord> entries = mActions.get(action);
            if (entries == null) {
                entries = new ArrayList<ReceiverRecord>(1);
                mActions.put(action, entries);
            }
            entries.add(entry);
        }
    }
}
```

注销的代码也类似，这里不细说。下面看看发送广播的代码：

```java
public boolean sendBroadcast(@NonNull Intent intent) {
    synchronized (mReceivers) {
        // 获取intent中各个数据，稍后用来与IntentFilter进行匹配
        final String action = intent.getAction();
        final String type = intent.resolveTypeIfNeeded(
                mAppContext.getContentResolver());
        final Uri data = intent.getData();
        final String scheme = intent.getScheme();
        final Set<String> categories = intent.getCategories();

        // 获取action对应的ArrayList<ReceiverRecord>，准备进行遍历
        ArrayList<ReceiverRecord> entries = mActions.get(intent.getAction());
        if (entries != null) {
            // 匹配成功的结果将会保存到这里
            ArrayList<ReceiverRecord> receivers = null;
            for (int i=0; i<entries.size(); i++) {
                ReceiverRecord receiver = entries.get(i);

                // 防止一个BroadcastReceiver响应多次
                if (receiver.broadcasting) {
                    continue;
                }

                // 如果匹配成功，添加到receivers数组中
                // 且将其broadcasting置为true，防止同一个BroadcastReceiver响应多次
                int match = receiver.filter.match(action, type, scheme, data,
                        categories, "LocalBroadcastManager");
                if (match >= 0) {
                    if (receivers == null) {
                        receivers = new ArrayList<ReceiverRecord>();
                    }
                    receivers.add(receiver);
                    receiver.broadcasting = true;
                }
            }

            // 最后将匹配的结果里面的标志位复位，以待后面发送广播时还能接受
            // 同时将intent-receivers包装成为一个BroadcastRecord对象，这就是一个二元组
            // 最后给mHandler发送一个消息，mHandler收到消息后就会在主线程执行广播的onReceiver方法了
            if (receivers != null) {
                for (int i=0; i<receivers.size(); i++) {
                    receivers.get(i).broadcasting = false;
                }
                // mPendingBroadcasts保存的是每次发送广播后，匹配成功的广播接收者
                mPendingBroadcasts.add(new BroadcastRecord(intent, receivers));
                if (!mHandler.hasMessages(MSG_EXEC_PENDING_BROADCASTS)) {
                    mHandler.sendEmptyMessage(MSG_EXEC_PENDING_BROADCASTS);
                }
                return true;
            }
        }
    }
    return false;
}
```

在上面代码的最后一段注释中，我们说到了`MSG_EXEC_PENDING_BROADCASTS`消息的作用就是让广播的`onReceiver`方法在主线程进行触发，那么我们看看是不是这么回事。  
`mHandler`的代码在本节开头提到了，该msg会在主线程中执行`executePendingBroadcasts()`方法。我们看看是怎么进行触发的：

```java
private void executePendingBroadcasts() {
    while (true) {
        final BroadcastRecord[] brs;
        // 将mPendingBroadcasts复制到brs数组中
        // 注意这里加了锁，防止在复制的过程中，有新的广播发送，然后丢失新的结果
        synchronized (mReceivers) {
            final int N = mPendingBroadcasts.size();
            if (N <= 0) {
                return;
            }
            brs = new BroadcastRecord[N];
            mPendingBroadcasts.toArray(brs);
            mPendingBroadcasts.clear();
        }
        // 遍历brs，brs中的每一项都是一次广播发送后匹配的结果
        for (int i=0; i<brs.length; i++) {
            final BroadcastRecord br = brs[i];
            // 取出receivers中每一个receiver
            final int nbr = br.receivers.size();
            for (int j=0; j<nbr; j++) {
                final ReceiverRecord rec = br.receivers.get(j);
                // 如果receiver没有退订
                if (!rec.dead) {
                    // 调用其onReceive方法
                    rec.receiver.onReceive(mAppContext, br.intent);
                }
            }
        }
    }
}
```

最后注意一下，`LocalBroadcastManager`还有另外一个同步发送广播的方法 `sendBroadcastSync`：

```java
/**
  * Like {@link #sendBroadcast(Intent)}, but if there are any receivers for
  * the Intent this function will block and immediately dispatch them before
  * returning.
  */
public void sendBroadcastSync(@NonNull Intent intent) {
    if (sendBroadcast(intent)) {
        executePendingBroadcasts();
    }
}
```

我们知道`executePendingBroadcasts()`方法里面会执行`BroadcastReceiver.onReceive`方法，如果我们在子线程中调用`sendBroadcastSync`方法，那么`BroadcastReceiver.onReceive`方法也会回调在子线程中。  
同时，由于Handler是一个异步过程，如果前面有`sendBroadcast`方法的结果还没有来得及执行，这时调用同步`sendBroadcastSync`方法，会导致前面的结果也在子线程中进行回调了。

---

下面是一个例子：

```kotlin
Thread(Runnable {
    LocalBroadcastManager.getInstance(this).let {
        Log.e(TAG, "sendBroadcast 11111 ")
        it.sendBroadcast(intent)
        Log.e(TAG, "sendBroadcast 22222 ")
        it.sendBroadcastSync(intent)
        Log.e(TAG, "sendBroadcast 33333 ")
        it.sendBroadcast(intent)
        Log.e(TAG, "sendBroadcast 44444 ")
        it.sendBroadcastSync(intent)
        Log.e(TAG, "sendBroadcast 55555 ")
        it.sendBroadcast(intent)
        Log.e(TAG, "sendBroadcast 66666 ")
    }
}).start()
```

我们在一个子线程中按照这样的顺序发送广播：异步、同步、异步、同步、异步。操作结果如下：

```
E/ScreenOActity: sendBroadcast 11111 
E/ScreenOActity: sendBroadcast 22222 
E/ScreenOActity: onReceive action=yorek.demoandtest.screenchange.ACTION_TEST thread=Thread-5
E/ScreenOActity: onReceive action=yorek.demoandtest.screenchange.ACTION_TEST thread=Thread-5
E/ScreenOActity: sendBroadcast 33333 
E/ScreenOActity: sendBroadcast 44444 
E/ScreenOActity: onReceive action=yorek.demoandtest.screenchange.ACTION_TEST thread=Thread-5
E/ScreenOActity: onReceive action=yorek.demoandtest.screenchange.ACTION_TEST thread=Thread-5
E/ScreenOActity: sendBroadcast 55555 
E/ScreenOActity: sendBroadcast 66666 
E/ScreenOActity: onReceive action=yorek.demoandtest.screenchange.ACTION_TEST thread=main
```

从结果可以看出

1. 异步广播的结果如果没来得及执行，会在同步广播的调用下进行执行，此时异步广播的结果也会在该线程下
2. 异步广播会堵塞住，直到执行完毕才会执行后面的代码