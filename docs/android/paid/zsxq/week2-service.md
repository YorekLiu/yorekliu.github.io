---
title: "理解Service"
---

## Question
话题：清晰地理解Service。

1. Service的start和bind状态有什么区别？
2. 同一个Service，先startService，然后再bindService，如何把它停止掉？
3. 你有注意到Service的onStartCommand方法的返回值吗？不同返回值有什么区别？
4. Service的生命周期方法onCreate、onStart、onBind等运行在哪个线程？

## Answer
关于Service，可以看这篇全面的文章：[Service](/android/framework/Android四大组件(2)/)

### 1. start和bind状态的区别
当一个应用组件调用了`startService`时，Service会处于启动状态。当Service启动后，它能够无期限的运行在后台，甚至开启该Service的组件已经销毁了。可以在Service内部调用`stopSelf()`或者其他组件调用`stopService()`来终止Service。`IntentService`会自动调用`stopSelf`方法。

当一个应用组件调用了`bindService`时，Service会处于绑定状态。只要其他应用组件绑定了他，它就会开始运行。多个组件能绑定到一个Service实例上，当它们都解绑时，此Service实例就会销毁。

对于已经处于active状态的Service，再次通过`startService`或`bindService`来启动同一个Service，其`onCreate`不会再次调用，而是直接调用对应的`onStartCommand()`或者`onBind()`方法。

### 2. 如何停止多次启动的Service
无论`startService`几次，只需要`stopService`或者`stopSelf`一次

调用多次`bindService`，必须调用多次`unbindService`。**同一组件bind多次，只需要unbind一次**。因此，只需要调用一次`stopService`或`stopSelf`方法和多次`unbindService`方法，对执行顺序没有要求。最后一个操作会导致`Service#onDestroy`方法执行。

### 3. onStartCommand方法的返回值
```java
/**
 * Constant to return from {@link #onStartCommand}: compatibility
 * version of {@link #START_STICKY} that does not guarantee that
 * {@link #onStartCommand} will be called again after being killed.
 */
public static final int START_STICKY_COMPATIBILITY = 0;

/**
 * Constant to return from {@link #onStartCommand}: if this service's
 * process is killed while it is started (after returning from
 * {@link #onStartCommand}), then leave it in the started state but
 * don't retain this delivered intent.  Later the system will try to
 * re-create the service.  Because it is in the started state, it will
 * guarantee to call {@link #onStartCommand} after creating the new
 * service instance; if there are not any pending start commands to be
 * delivered to the service, it will be called with a null intent
 * object, so you must take care to check for this.
 *
 * <p>This mode makes sense for things that will be explicitly started
 * and stopped to run for arbitrary periods of time, such as a service
 * performing background music playback.
 */
public static final int START_STICKY = 1;

/**
 * Constant to return from {@link #onStartCommand}: if this service's
 * process is killed while it is started (after returning from
 * {@link #onStartCommand}), and there are no new start intents to
 * deliver to it, then take the service out of the started state and
 * don't recreate until a future explicit call to
 * {@link Context#startService Context.startService(Intent)}.  The
 * service will not receive a {@link #onStartCommand(Intent, int, int)}
 * call with a null Intent because it will not be re-started if there
 * are no pending Intents to deliver.
 *
 * <p>This mode makes sense for things that want to do some work as a
 * result of being started, but can be stopped when under memory pressure
 * and will explicit start themselves again later to do more work.  An
 * example of such a service would be one that polls for data from
 * a server: it could schedule an alarm to poll every N minutes by having
 * the alarm start its service.  When its {@link #onStartCommand} is
 * called from the alarm, it schedules a new alarm for N minutes later,
 * and spawns a thread to do its networking.  If its process is killed
 * while doing that check, the service will not be restarted until the
 * alarm goes off.
 */
public static final int START_NOT_STICKY = 2;

/**
 * Constant to return from {@link #onStartCommand}: if this service's
 * process is killed while it is started (after returning from
 * {@link #onStartCommand}), then it will be scheduled for a restart
 * and the last delivered Intent re-delivered to it again via
 * {@link #onStartCommand}.  This Intent will remain scheduled for
 * redelivery until the service calls {@link #stopSelf(int)} with the
 * start ID provided to {@link #onStartCommand}.  The
 * service will not receive a {@link #onStartCommand(Intent, int, int)}
 * call with a null Intent because it will will only be re-started if
 * it is not finished processing all Intents sent to it (and any such
 * pending events will be delivered at the point of restart).
 */
public static final int START_REDELIVER_INTENT = 3;
```

### 4. Service的生命周期方法运行在哪个线程
Service运行在宿主进程的主线程中，其生命周期方法也是运行在主线程，Service并不会创建自己的线程。如果想要在`Service`中执行耗时操作，必须另起线程(或者使用`IntentService`)，否则可能会产生ANR。
