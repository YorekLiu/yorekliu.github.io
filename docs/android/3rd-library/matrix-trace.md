---
title: "Matrix-TraceCanary解析"
---

!!! tip "Wiki"  
    [Matrix - TraceCanary](https://github.com/Tencent/matrix/wiki/Matrix-Android-TraceCanary)

正如Matrix系列开篇——[微信APM Matrix解析](/android/3rd-library/matrix/#1-trace-canary)所言，TraceCanary分为帧率监控、慢方法监控、ANR监控以及启动耗时这4个功能。这些功能基本都需要插桩去trace过程中每个函数的调用。  
在插桩之外，我们还需要监控主线程MessageQueue(`LooperMonitor`)以及Choreographer(`UIThreadMonitor`)，从里面抽象出一个可以通知Message开始执行、执行完成、Choreographer开始渲染的接口(`LooperObserver`)。基于这个接口，我们可以开始各项监控的实现。

确实，本章的重点就是解读 **插桩插件** 以及 **LooperMonitor、UIThreadMonitor** 是如何实现的。在理解上面这些组件的原理之后，基于此的监控的实现也就非常好理解了。

当然，在正式开始分析源码之前，我们先看一下Sample是如何初始化Matrix以及如何启动TracePlugin的。

## 1. 从Sample中看Plugin的启动

Matrix的初始化代码位于Sample的Application中，这里根据配置创建了TracePlugin、ResourcePlugin、IOCanaryPlugin以及SQLiteLintPlugin后添加到了`Matrix.Builder`中：

**<small>matrix/samples/sample-android/app/src/main/java/sample/tencent/matrix/MatrixApplication.java</small>**
```java
public class MatrixApplication extends Application {
    ...
    @Override
    public void onCreate() {
        super.onCreate();
        ...

        Matrix.Builder builder = new Matrix.Builder(this);
        builder.patchListener(new TestPluginListener(this));

        //trace
        TraceConfig traceConfig = new TraceConfig.Builder()
                .dynamicConfig(dynamicConfig)
                .enableFPS(fpsEnable)
                .enableEvilMethodTrace(traceEnable)
                .enableAnrTrace(traceEnable)
                .enableStartup(traceEnable)
                .splashActivities("sample.tencent.matrix.SplashActivity;")
                .isDebug(true)
                .isDevEnv(false)
                .build();

        TracePlugin tracePlugin = (new TracePlugin(traceConfig));
        builder.plugin(tracePlugin);

        if (matrixEnable) {

            //resource
            ...
            builder.plugin(new ResourcePlugin(resourceConfig));
            ResourcePlugin.activityLeakFixer(this);

            //io
            IOCanaryPlugin ioCanaryPlugin = new IOCanaryPlugin(new IOConfig.Builder()
                    .dynamicConfig(dynamicConfig)
                    .build());
            builder.plugin(ioCanaryPlugin);

            // prevent api 19 UnsatisfiedLinkError
            //sqlite
            ...
            builder.plugin(new SQLiteLintPlugin(sqlLiteConfig));
        }

        Matrix.init(builder.build());

        //start only startup tracer, close other tracer.
        tracePlugin.start();
    }
}
```

在第45行中，`builder.build()`会创建Matrix实例并调用所有添加过的Plugin的`init`方法，而`Matrix.init`方法仅仅是保存了这个Matrix实例而已。最后在48行中，启动了`TracePlugin`插件。  

Matrix实例创建的相关代码如下：

**<small>matrix/matrix/matrix-android/matrix-android-lib/src/main/java/com/tencent/matrix/Matrix.java</small>**

```java
public class Matrix {
    ...

    private Matrix(Application app, PluginListener listener, HashSet<Plugin> plugins) {
        this.application = app;
        this.pluginListener = listener;
        this.plugins = plugins;
        AppActiveMatrixDelegate.INSTANCE.init(application);
        for (Plugin plugin : plugins) {
            plugin.init(application, pluginListener);
            pluginListener.onInit(plugin);
        }

    }

    ...

    public static Matrix init(Matrix matrix) {
        if (matrix == null) {
            throw new RuntimeException("Matrix init, Matrix should not be null.");
        }
        synchronized (Matrix.class) {
            if (sInstance == null) {
                sInstance = matrix;
            } else {
                MatrixLog.e(TAG, "Matrix instance is already set. this invoking will be ignored");
            }
        }
        return sInstance;
    }

    ...

    public static class Builder {
        ...
        private HashSet<Plugin> plugins = new HashSet<>();
        ...

        public Matrix build() {
            if (pluginListener == null) {
                pluginListener = new DefaultPluginListener(application);
            }
            return new Matrix(application, pluginListener, plugins);
        }

    }
}
```

## 2. TracePlugin

在上面的Matrix的启动流程中，上面我们看到了TracePlugin的`init`方法以及`start`方法的调用。下面我们回归本章的主题，看看TracePlugin到底干了些什么。

首先看看`TracePlugin`初始化相关的代码：

**<small>matrix/matrix-android/matrix-trace-canary/src/main/java/com/tencent/matrix/trace/TracePlugin.java</small>**

```java
public class TracePlugin extends Plugin {
    private static final String TAG = "Matrix.TracePlugin";

    private final TraceConfig traceConfig;
    private EvilMethodTracer evilMethodTracer;
    private StartupTracer startupTracer;
    private FrameTracer frameTracer;
    private AnrTracer anrTracer;

    public TracePlugin(TraceConfig config) {
        this.traceConfig = config;
    }

    @Override
    public void init(Application app, PluginListener listener) {
        super.init(app, listener);
        MatrixLog.i(TAG, "trace plugin init, trace config: %s", traceConfig.toString());
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.JELLY_BEAN) {
            MatrixLog.e(TAG, "[FrameBeat] API is low Build.VERSION_CODES.JELLY_BEAN(16), TracePlugin is not supported");
            unSupportPlugin();
            return;
        }

        anrTracer = new AnrTracer(traceConfig);

        frameTracer = new FrameTracer(traceConfig);

        evilMethodTracer = new EvilMethodTracer(traceConfig);

        startupTracer = new StartupTracer(traceConfig);
    }

    @Override
    public void start() {
        super.start();
        if (!isSupported()) {
            MatrixLog.w(TAG, "[start] Plugin is unSupported!");
            return;
        }
        MatrixLog.w(TAG, "start!");
        Runnable runnable = new Runnable() {
            @Override
            public void run() {

                if (!UIThreadMonitor.getMonitor().isInit()) {
                    try {
                        UIThreadMonitor.getMonitor().init(traceConfig);
                    } catch (java.lang.RuntimeException e) {
                        MatrixLog.e(TAG, "[start] RuntimeException:%s", e);
                        return;
                    }
                }

                AppMethodBeat.getInstance().onStart();

                UIThreadMonitor.getMonitor().onStart();

                anrTracer.onStartTrace();

                frameTracer.onStartTrace();

                evilMethodTracer.onStartTrace();

                startupTracer.onStartTrace();
            }
        };

        if (Thread.currentThread() == Looper.getMainLooper().getThread()) {
            runnable.run();
        } else {
            MatrixLog.w(TAG, "start TracePlugin in Thread[%s] but not in mainThread!", Thread.currentThread().getId());
            MatrixHandlerThread.getDefaultMainHandler().post(runnable);
        }
    }
}
```

在`init`方法中，对低于JB的设备不启用TracePlugin，并创建了ANR监控、帧率监控、慢方法监控以及启动耗时这4个功能的Tracer。在`start`中，会在主线程中启动`UIThreadMonitor`、`AppMethodBeat`以及四大Tracer。  

TracePlugin的功能完全体现在了四大Tracer中，`UIThreadMonitor`、`AppMethodBeat`是这些Tracer起作用的基石。理解了这些基石，四大Tracer的分析就非常简单了。所以下面我们先分析分析`UIThreadMonitor`、`AppMethodBeat`。  
> 此外，基于这两大基石，我们还可以写出更多好玩的东西：比如 **后台渲染的检测**，`UIThreadMonitor`判断后台渲染是否产生，由`AppMethodBeat`可以获取引发后台渲染的堆栈信息。  

### 2.1 UIThreadMonitor

!!! note "一句话简述UIThreadMonitor"
    通过设置Looper中的printer，来判断Message的执行起始时间。然后hook Choreographer中的input animation traversal回调数组，向其中添加Runnable来获取每个操作的耗时。最后将这些数据抛出给各个Tracer作为判断的依据。

获取线程中每个Message的执行起始是在Matrix中是`LooperMonitor`类来实现的，`UIThreadMonitor`向该类注册一个回调，由此在对应回调中进行对应的操作。`LooperMonitor`的实现原理我们下一节在谈，目前我们知道它干了啥就行。我们接着看`UIThreadMonitor#init`方法：

**<small>matrix/matrix-android/matrix-trace-canary/src/main/java/com/tencent/matrix/trace/core/UIThreadMonitor.java</small>**

```java
public void init(TraceConfig config) {
    if (Thread.currentThread() != Looper.getMainLooper().getThread()) {
        throw new AssertionError("must be init in main thread!");
    }
    this.config = config;
    choreographer = Choreographer.getInstance();
    callbackQueueLock = reflectObject(choreographer, "mLock");
    callbackQueues = reflectObject(choreographer, "mCallbackQueues");

    addInputQueue = reflectChoreographerMethod(callbackQueues[CALLBACK_INPUT], ADD_CALLBACK, long.class, Object.class, Object.class);
    addAnimationQueue = reflectChoreographerMethod(callbackQueues[CALLBACK_ANIMATION], ADD_CALLBACK, long.class, Object.class, Object.class);
    addTraversalQueue = reflectChoreographerMethod(callbackQueues[CALLBACK_TRAVERSAL], ADD_CALLBACK, long.class, Object.class, Object.class);
    frameIntervalNanos = reflectObject(choreographer, "mFrameIntervalNanos");

    LooperMonitor.register(new LooperMonitor.LooperDispatchListener() {
        @Override
        public boolean isValid() {
            return isAlive;
        }

        @Override
        public void dispatchStart() {
            super.dispatchStart();
            UIThreadMonitor.this.dispatchBegin();
        }

        @Override
        public void dispatchEnd() {
            super.dispatchEnd();
            UIThreadMonitor.this.dispatchEnd();
        }

    });
    this.isInit = true;
    MatrixLog.i(TAG, "[UIThreadMonitor] %s %s %s %s %s frameIntervalNanos:%s", callbackQueueLock == null, callbackQueues == null, addInputQueue == null, addTraversalQueue == null, addAnimationQueue == null, frameIntervalNanos);

    if (config.isDevEnv()) {
        addObserver(new LooperObserver() {
            @Override
            public void doFrame(String focusedActivityName, long start, long end, long frameCostMs, long inputCost, long animationCost, long traversalCost) {
                MatrixLog.i(TAG, "activityName[%s] frame cost:%sms [%s|%s|%s]ns", focusedActivityName, frameCostMs, inputCost, animationCost, traversalCost);
            }
        });
    }
}
```

`UIThreadMonitor#init`方法主要干了两件事：

1. 反射获取`Choreographer`中`CALLBACK_INPUT`、`CALLBACK_ANIMATION`、`CALLBACK_TRAVERSAL`三种类型的`CallbackQueue`的`addCallbackLocked`方法的句柄。
2. 向`LooperMonitor`注册Message执行开始的回调、执行结束的回调。这里的Message是指主线程中发生的所有Message，包括App自己的以及Framework中的。

下面看看`UIThreadMonitor#start`方法，在里面初始化了需要检测的三种CallbackQueue的各种记录数组：

- callbackExist：记录是否已经向该类型的CallbackQueue添加了Runnable，避免重复添加
- queueStatus：记录CallbackQueue中添加的Runnable的运行状态，分为默认状态（DO_QUEUE_DEFAULT）、已经添加的状态（DO_QUEUE_BEGIN）、运行结束的状态（DO_QUEUE_END）
- queueCost：记录上面某种类型的Runnable的执行起始的耗时，这可以反映出当前这一次执行CallbackQueue里面的任务耗时有多久。

**<small>matrix/matrix-android/matrix-trace-canary/src/main/java/com/tencent/matrix/trace/core/UIThreadMonitor.java</small>**

```java
@Override
public synchronized void onStart() {
    if (!isInit) {
        throw new RuntimeException("never init!");
    }
    if (!isAlive) {
        this.isAlive = true;
        synchronized (this) {
            MatrixLog.i(TAG, "[onStart] callbackExist:%s %s", Arrays.toString(callbackExist), Utils.getStack());
            callbackExist = new boolean[CALLBACK_LAST + 1];
        }
        queueStatus = new int[CALLBACK_LAST + 1];
        queueCost = new long[CALLBACK_LAST + 1];
        addFrameCallback(CALLBACK_INPUT, this, true);
    }
}
```

在`UIThreadMonitor#onStart`方法中，最后调用`addFrameCallback`方法将一个Runnable（自己）插到了INPUT类型的CallbackQueue的头部。CallbackQueue是一个单链表组织起来的队列，里面按照时间从小到大进行组织，详细代码可以查看[Choreographer#CallbackQueue](https://cs.android.com/android/platform/superproject/+/master:frameworks/base/core/java/android/view/Choreographer.java;l=1005;drc=master;bpv=0;bpt=1)。

下面我们接着看一下`addFrameCallback`的实现，这里首先会判断某种type类型的callback是否已经添加，UIThreadMonitor是否已经启动等等检查，然后根据type取得需要invoke的方法句柄，然后调用该方法并设置callbackExist标志位。  
在第26行中我们注意到对入参`isAddHeader`做出的值转换——`!isAddHeader ? SystemClock.uptimeMillis() : -1`：也就是说如果isAddHeader为true，这里的值就是-1，会在CallbackQueue执行时首先执行（系统内部不会将这里的time设置为一个负值，所以无论何时，这里都将会是第一个执行的）；否则的话，传的是当前的时间戳，会根据值插入到单链表队列中。

**<small>matrix/matrix-android/matrix-trace-canary/src/main/java/com/tencent/matrix/trace/core/UIThreadMonitor.java</small>**

```java
private synchronized void addFrameCallback(int type, Runnable callback, boolean isAddHeader) {
    if (callbackExist[type]) {
        MatrixLog.w(TAG, "[addFrameCallback] this type %s callback has exist! isAddHeader:%s", type, isAddHeader);
        return;
    }

    if (!isAlive && type == CALLBACK_INPUT) {
        MatrixLog.w(TAG, "[addFrameCallback] UIThreadMonitor is not alive!");
        return;
    }
    try {
        synchronized (callbackQueueLock) {
            Method method = null;
            switch (type) {
                case CALLBACK_INPUT:
                    method = addInputQueue;
                    break;
                case CALLBACK_ANIMATION:
                    method = addAnimationQueue;
                    break;
                case CALLBACK_TRAVERSAL:
                    method = addTraversalQueue;
                    break;
            }
            if (null != method) {
                method.invoke(callbackQueues[type], !isAddHeader ? SystemClock.uptimeMillis() : -1, callback, null);
                callbackExist[type] = true;
            }
        }
    } catch (Exception e) {
        MatrixLog.e(TAG, e.toString());
    }
}
```

上面就是`onStart`方法干的事情，归根结底就是向Choreograpger注册了一个回调，这样下次Vsync信号来到时，就会触发这个callback。  

然后我们看看`UIThreadMonitor#run`里面的代码，这里面涉及到三个新的方法：

1. doFrameBegin：设置`isBelongFrame`标志位为true
2. doQueueBegin：更新对应type的queueStatus标志位为DO_QUEUE_BEGIN，并用queueCost[type]记下此时的时间
3. doQueueEnd：更新对应type的queueStatus标志位为DO_QUEUE_END，并用当前时间减去queueCost[type]的时间，这个时间为当前frame执行时此type的CallbackQueue执行的总耗时，记为queueCost[type]

因此，`UIThreadMonitor#run`就很好解释了：先声明该frame正在被统计，然后计算出CALLBACK_INPUT的队列执行耗时、CALLBACK_ANIMATION的队列执行耗时，以及CALLBACK_TRAVERSAL执行开始了。  

**<small>matrix/matrix-android/matrix-trace-canary/src/main/java/com/tencent/matrix/trace/core/UIThreadMonitor.java</small>**

```java
@Override
public void run() {
    final long start = System.nanoTime();
    try {
        doFrameBegin(token);
        doQueueBegin(CALLBACK_INPUT);

        addFrameCallback(CALLBACK_ANIMATION, new Runnable() {

            @Override
            public void run() {
                doQueueEnd(CALLBACK_INPUT);
                doQueueBegin(CALLBACK_ANIMATION);
            }
        }, true);

        addFrameCallback(CALLBACK_TRAVERSAL, new Runnable() {

            @Override
            public void run() {
                doQueueEnd(CALLBACK_ANIMATION);
                doQueueBegin(CALLBACK_TRAVERSAL);
            }
        }, true);

    } finally {
        if (config.isDevEnv()) {
            MatrixLog.d(TAG, "[UIThreadMonitor#run] inner cost:%sns", System.nanoTime() - start);
        }
    }
}
```

**那，为什么这里没有调用`doQueueEnd(CALLBACK_TRAVERSAL)`呢**。我们研究`Choreographer`发现，在CALLBACK_TRAVERSAL之后还有一个CALLBACK_COMMIT，我们向这个队列添加一个callback就可以在合理的位置调用`doQueueEnd(CALLBACK_TRAVERSAL)`了。 **但是很不幸，CALLBACK_COMMIT在Android 6.0及以后才会有。**  
为了兼容更早的版本，我们得想出其他办法：还记得上面提到的`LooperMonitor`吗，我们提到过`LooperMonitor`可以捕获到Message的执行的起始。Choreographer中的Vsync信号触发各种callback也是通过Android的消息机制来实现的，且该Message在执行完各种CallbackQueue就结束了，某种程度上来说，以Message的执行结束时间作CALLBACK_TRAVERSAL的结束时间也是可以的。

所以我们接着就来到了`UIThreadMonitor#dispatchEnd`方法：

**<small>matrix/matrix-android/matrix-trace-canary/src/main/java/com/tencent/matrix/trace/core/UIThreadMonitor.java</small>**

```java
private void dispatchEnd() {

    if (isBelongFrame) {
        doFrameEnd(token);
    }

    long start = token;
    long end = SystemClock.uptimeMillis();

    synchronized (observers) {
        for (LooperObserver observer : observers) {
            if (observer.isDispatchBegin()) {
                observer.doFrame(AppMethodBeat.getVisibleScene(), token, SystemClock.uptimeMillis(), isBelongFrame ? end - start : 0, queueCost[CALLBACK_INPUT], queueCost[CALLBACK_ANIMATION], queueCost[CALLBACK_TRAVERSAL]);
            }
        }
    }

    dispatchTimeMs[3] = SystemClock.currentThreadTimeMillis();
    dispatchTimeMs[1] = SystemClock.uptimeMillis();

    AppMethodBeat.o(AppMethodBeat.METHOD_ID_DISPATCH);

    synchronized (observers) {
        for (LooperObserver observer : observers) {
            if (observer.isDispatchBegin()) {
                observer.dispatchEnd(dispatchTimeMs[0], dispatchTimeMs[2], dispatchTimeMs[1], dispatchTimeMs[3], token, isBelongFrame);
            }
        }
    }

}
```

在方法的最开始，如果`isBelongFrame`标志位为true，表明是`UIThreadMonitor#run`方法已经执行过了，因此需要闭合整个frame的监控，闭合的这部分代码在`doFrameEnd`中。  
然后会调用`LooperObserver.doFrame`方法通知观察者当前帧的耗时情况，调用`LooperObserver.dispatchEnd`通知观察者Message执行已经结束了。  

这里没啥好说的，我们看一下闭合frame监控的`doFrameEnd`方法，这里调用了`doQueueEnd(CALLBACK_TRAVERSAL)`真正闭合了frame监控，然后恢复了queueStatus数组的状态，最后又调用了`addFrameCallback(CALLBACK_INPUT, this, true)`方法开始监控下一帧。嗯，复读机又回来了~：

**<small>matrix/matrix-android/matrix-trace-canary/src/main/java/com/tencent/matrix/trace/core/UIThreadMonitor.java</small>**

```java
private void doFrameEnd(long token) {

    doQueueEnd(CALLBACK_TRAVERSAL);

    for (int i : queueStatus) {
        if (i != DO_QUEUE_END) {
            queueCost[i] = DO_QUEUE_END_ERROR;
            if (config.isDevEnv) {
                throw new RuntimeException(String.format("UIThreadMonitor happens type[%s] != DO_QUEUE_END", i));
            }
        }
    }
    queueStatus = new int[CALLBACK_LAST + 1];

    addFrameCallback(CALLBACK_INPUT, this, true);

    this.isBelongFrame = false;
}
```

!!! warning "bug"
    **值得注意的是，这里有个bug，** 当isBelongFrame为true时，会闭合frame的监控，也就是`doFrameEnd`干的事儿。但是在该方法的最后，将isBelongFrame复位为false了。所以通知`LooperObserver#doFrame`以及`LooperObserver#dispatchEnd`中涉及到的值，实际上都是false。  
    在实际应用时，我们应该注意下，去修复这个问题。

说完了`UIThreadMonitor#dispatchEnd`方法，我们也顺便说说与之匹配的孪生方法`UIThreadMonitor#dispatchBegin`：

**<small>matrix/matrix-android/matrix-trace-canary/src/main/java/com/tencent/matrix/trace/core/UIThreadMonitor.java</small>**

```java
private void dispatchBegin() {
    token = dispatchTimeMs[0] = SystemClock.uptimeMillis();
    dispatchTimeMs[2] = SystemClock.currentThreadTimeMillis();
    AppMethodBeat.i(AppMethodBeat.METHOD_ID_DISPATCH);

    synchronized (observers) {
        for (LooperObserver observer : observers) {
            if (!observer.isDispatchBegin()) {
                observer.dispatchBegin(dispatchTimeMs[0], dispatchTimeMs[2], token);
            }
        }
    }
}
```

实际上该方法也很简单，保存下Message执行开始时的时间戳，然后调用`LooperObserver#dispatchBegin`方法回调出去。  
`dispatchTimeMs`是一个长度为4的long数组，0、1分别表示的是Message执行开始、结束的`uptimeMillis`；2、3分别表示的是Message执行开始、结束的`currentThreadTimeMillis`。

至此，`UIThreadMonitor`的解析已经完毕，我们可以小结一下其作用：

1. 在主线程中Message执行开始时，调用`LooperObserver#dispatchBegin(long beginMs, long cpuBeginMs, long token)`通知外部
2. 在主线程每一帧渲染结束时，调用`LooperObserver#doFrame(String focusedActivityName, long start, long end, long frameCostMs, long inputCostNs, long animationCostNs, long traversalCostNs)`通知外部
3. 在主线程中Message执行完毕时，调用`LooperObserver#dispatchEnd(long beginMs, long cpuBeginMs, long endMs, long cpuEndMs, long token, boolean isBelongFrame)`通知外部

### 2.2 LooperMonitor

## 3. AppMethodBeat以及其Plugin

## 4. 各种Tracer