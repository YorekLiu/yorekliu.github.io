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

`LooperMonitor`的主要作用就是在Message执行前后回调出对应的方法。其实现原理是通过设置`Looper#mLogging`这个字段，让Message在执行前后打印出日志，然后根据日志的特点来判断是开始执行还是执行结束。可以看下`Looper#loop`方法的代码片段：

**<small>android/os/Looper.java</small>**

```java
public static void loop() {
    ...
    for (;;) {
        Message msg = queue.next(); // might block
        ...
        // This must be in a local variable, in case a UI event sets the logger
        final Printer logging = me.mLogging;
        if (logging != null) {
            logging.println(">>>>> Dispatching to " + msg.target + " " +
                    msg.callback + ": " + msg.what);
        }
        ...
        try {
            msg.target.dispatchMessage(msg);
            ...
        } finally {
            ...
        }
        ...
        if (logging != null) {
            logging.println("<<<<< Finished to " + msg.target + " " + msg.callback);
        }
        ...
    }
}
```

下面看看`LooperMonitor`的初始化相关的代码。  
首先LooperMonitor是一个饥汉单例的实现，其作用对象是主线程的Looper。  
在LooperMonitor创建之后，首先调用`resetPrinter`方法保存原始的printer，然后使用LooperPrinter来装饰原始的printer并设置到Looper中，这样我们判断print的日志就知道Message的执行起始。  
最后，向MessageQueue中添加了一个`IdleHandler`，在对应的`queueIdle`方法中会周期性（60s）的调用`resetPrinter`方法来保证Looper中的printer对象是我们自定义的`LooperPrinter`。

**<small>/matrix/matrix-android/matrix-trace-canary/src/main/java/com/tencent/matrix/trace/core/LooperMonitor.java</small>**

```java
public class LooperMonitor implements MessageQueue.IdleHandler {
    ...
    private static final LooperMonitor mainMonitor = new LooperMonitor();

    public LooperMonitor(Looper looper) {
        Objects.requireNonNull(looper);
        this.looper = looper;
        resetPrinter();
        addIdleHandler(looper);
    }

    private LooperMonitor() {
        this(Looper.getMainLooper());
    }

    private static boolean isReflectLoggingError = false;

    private synchronized void resetPrinter() {
        Printer originPrinter = null;
        try {
            if (!isReflectLoggingError) {
                originPrinter = ReflectUtils.get(looper.getClass(), "mLogging", looper);
                if (originPrinter == printer && null != printer) {
                    return;
                }
            }
        } catch (Exception e) {
            isReflectLoggingError = true;
            Log.e(TAG, "[resetPrinter] %s", e);
        }

        if (null != printer) {
            MatrixLog.w(TAG, "maybe thread:%s printer[%s] was replace other[%s]!",
                    looper.getThread().getName(), printer, originPrinter);
        }
        looper.setMessageLogging(printer = new LooperPrinter(originPrinter));
        if (null != originPrinter) {
            MatrixLog.i(TAG, "reset printer, originPrinter[%s] in %s", originPrinter, looper.getThread().getName());
        }
    }

    private synchronized void addIdleHandler(Looper looper) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            looper.getQueue().addIdleHandler(this);
        } else {
            try {
                MessageQueue queue = ReflectUtils.get(looper.getClass(), "mQueue", looper);
                queue.addIdleHandler(this);
            } catch (Exception e) {
                Log.e(TAG, "[removeIdleHandler] %s", e);
            }
        }
    }
    ...
}
```

下面我们来到了`LooperPrinter`对象，直接看其`println`方法的实现，我们可以发现直接判断起始字符为不为`>`就可以知道是`onDispatchStart`还是`onDispatchEnd`：

**<small>matrix/matrix-android/matrix-trace-canary/src/main/java/com/tencent/matrix/trace/core/LooperMonitor.java</small>**

```java
class LooperPrinter implements Printer {
    public Printer origin;
    boolean isHasChecked = false;
    boolean isValid = false;

    LooperPrinter(Printer printer) {
        this.origin = printer;
    }

    @Override
    public void println(String x) {
        if (null != origin) {
            origin.println(x);
            if (origin == this) {
                throw new RuntimeException(TAG + " origin == this");
            }
        }

        if (!isHasChecked) {
            isValid = x.charAt(0) == '>' || x.charAt(0) == '<';
            isHasChecked = true;
            if (!isValid) {
                MatrixLog.e(TAG, "[println] Printer is inValid! x:%s", x);
            }
        }

        if (isValid) {
            dispatch(x.charAt(0) == '>', x);
        }

    }
}

private void dispatch(boolean isBegin, String log) {

    for (LooperDispatchListener listener : listeners) {
        if (listener.isValid()) {
            if (isBegin) {
                if (!listener.isHasDispatchStart) {
                    listener.onDispatchStart(log);
                }
            } else {
                if (listener.isHasDispatchStart) {
                    listener.onDispatchEnd(log);
                }
            }
        } else if (!isBegin && listener.isHasDispatchStart) {
            listener.dispatchEnd();
        }
    }
}
```

## 3. AppMethodBeat

???+ note "关于Plugin"
    Matrix master分支的插件（0.6.5版本）代码不支持R8以及AGP4.x。在feature分支有一个`upgrade-agp-4.1-wip`分支对此做了支持。但是不影响我们对其原理的分析解读。  
    但是这部分源码颇费笔墨，所以另开一章进行解读。

AppMethodBeat会被Plugin在编译时进行调用，调用位置为Java方法的出入口以及`Activity#onWindowFocusChange`，Plugin会在这些位置分别调用其`i(int methodId)`、`o(int methodId)`以及`at`方法。  
对于`i/o`方法里面的参数`methodId`，Plugin在插桩时会为每一个函数生成一个唯一的id，保证通过这个id可以找到对应的方法，methodId可以在编译文件`app/build/outputs/mapping/debug/methodMapping.txt`中得到。  
> 下面是methodMapping文件中的示例：
> 1,1,sample.tencent.matrix.trace.TestTraceFragmentActivity <init> ()V
> 2,1,sample.tencent.matrix.trace.TestFpsActivity <init> ()V  
> 上面分别表示：methodId,accessFlag,className methodName [desc]

插桩过程中会过滤一些不需要插桩的函数，结果输出在`app/build/outputs/mapping/debug/methodMapping.txt`中，其格式为`className methodName [desc]`。

插桩的这部分源码在`matrix/matrix-android/matrix-gradle-plugin/src/main/java/com/tencent/matrix/trace/MethodTracer.java`中，后面在解读Matrix Plugin时会进行详细说明。BTW，其实插桩插件流程总体可以分为两步：第一步收集工程中的class以及jar包中的class，在插桩完毕后进行回写，这一步都比较通用；第二步就是调用ASM进行插桩，这一部分才与需求相关。

`AppMethodBeat#i`、``AppMethodBeat#o`会将函数调用的i/o标志、methodId以及时间存到`sBuffer = new long[100 * 10000]`数组中，这个数组消耗内存约为8bytes * 100 * 10000 = 800_0000bytes = 7812.5kb = 7.629394531mb。这部分内存消耗还是有点大的，是一个副作用吧。

我们说到，后面各种Tracer都是分析这个`sBuffer`数组来得到的函数调用堆栈，那么这个数组里面保存的数据有怎么样的格式呢？  

编译期已经对全局的函数进行插桩，在运行期间每个函数的执行前后都会调用 `AppMethodBeat.i/o` 的方法，如果是在主线程中执行，则在函数的执行前后获取当前距离 MethodBeat 模块初始化的时间 offset（为了压缩数据，存进一个long类型变量中），并将当前执行的是 AppMethodBeat i或者o、mehtod id 及时间 offset，存放到一个 long 类型变量中，记录到一个预先初始化好的数组 long[] 中 index 的位置（预先分配记录数据的 buffer 长度为 100w，内存占用约 7.6M）。数据存储如下图[^1]：

![matrix_app_method_beat_sbuffer](/assets/images/android/matrix_app_method_beat_sbuffer.jpg)

`AppMethodBeat.i/o`主要干的就是上面的这个事儿；在`AppMethodBeat.at`方法中，会在Activity#onWindowFocusChange时调用`IAppMethodBeatListener#onActivityFocused`方法。

小结一下，Matrix会在编译时对函数进行插桩，这样在运行期间每个函数的执行前后都会调用 AppMethodBeat.i/o 的方法，这些方法的调用记录会被数组保存起来，供后面各种Tracer进行函数调用堆栈分析。并且会在Activity#onWindowFocusChange处插入 AppMethodBeat.at 方法，当Activity获得焦点时调用回调通知外部。

## 4. 各种Tracer

### 4.1 帧率监控FrameTracer

FrameTracer的实现依赖与`UIThreadMonitor`中抛出来的`LooperObserver#doFrame`回调。该回调的方法声明如下：

**<small>matrix/matrix-android/matrix-trace-canary/src/main/java/com/tencent/matrix/trace/listeners/LooperObserver.java</small>**

```java
public void doFrame(String focusedActivityName, long start, long end, long frameCostMs, long inputCostNs, long animationCostNs, long traversalCostNs)
```

各个参数解释如下：

- focusedActivityName  
  正在显示的Activity名称
- start  
  Message执行前的时间
- end  
  Message执行完毕，调用`LooperObserver#doFrame`时的时间
- frameCostMs  
  如果调用执行`dispatchEnd`时，`dispatchBegin`执行过了，那么该值为上面的`end-start`的值；否则为0
- inputCostNs、animationCostNs、traversalCostNs  
  执行三种CallbackQueue的耗时


下面我们看看`FrameTracer`是如何通过这些值计算出帧率信息的，直接看override的`doFrame`方法：

**<small>matrix/matrix-android/matrix-trace-canary/src/main/java/com/tencent/matrix/trace/tracer/FrameTracer.java</small>**

```java
@Override
public void doFrame(String focusedActivityName, long start, long end, long frameCostMs, long inputCostNs, long animationCostNs, long traversalCostNs) {
    if (isForeground()) {
        notifyListener(focusedActivityName, end - start, frameCostMs, frameCostMs >= 0);
    }
}

private void notifyListener(final String visibleScene, final long taskCostMs, final long frameCostMs, final boolean isContainsFrame) {
    long start = System.currentTimeMillis();
    try {
        synchronized (listeners) {
            for (final IDoFrameListener listener : listeners) {
                if (config.isDevEnv()) {
                    listener.time = SystemClock.uptimeMillis();
                }
                final int dropFrame = (int) (taskCostMs / frameIntervalMs);

                listener.doFrameSync(visibleScene, taskCostMs, frameCostMs, dropFrame, isContainsFrame);
                if (null != listener.getExecutor()) {
                    listener.getExecutor().execute(new Runnable() {
                        @Override
                        public void run() {
                            listener.doFrameAsync(visibleScene, taskCostMs, frameCostMs, dropFrame, isContainsFrame);
                        }
                    });
                }
                if (config.isDevEnv()) {
                    listener.time = SystemClock.uptimeMillis() - listener.time;
                    MatrixLog.d(TAG, "[notifyListener] cost:%sms listener:%s", listener.time, listener);
                }
            }
        }
    } finally {
        long cost = System.currentTimeMillis() - start;
        if (config.isDebug() && cost > frameIntervalMs) {
            MatrixLog.w(TAG, "[notifyListener] warm! maybe do heavy work in doFrameSync! size:%s cost:%sms", listeners.size(), cost);
        }
    }
}
```

在`FrameTracer#doFrame`中会在App处于 **前台** 的状态下调用`notifyListener`方法，注意这里的`taskCostMs`参数值为end-start，实际上这个参数的值应该与`frameCostMs`的值一致。  
在`notifyListener`方法中，首先通过`taskCostMs / frameIntervalMs`来计算此次执行丢的帧数，记为`dropFrame`。也就是说单次Message的执行耗时不超过16ms，则不会产生丢帧。最后调用`IDoFrameListener#doFrameSync`以及`IDoFrameListener#doFrameAsync`执行lisetner的同步方法以及异步方法。

在有了上面计算出来的`dropFrame`之后，我们在后面就不太需要`taskCostMs`以及`frameCostMs`这两个值了。我们把注意力放到其他几个参数中去，有了这几个参数（visibleScene、dropFrame、isContainsFrame），后面就可以进行帧率的上报以及实时帧率的显示。

先看看帧率上报的部分代码。在`FrameTracer`构造的时候，Matrix向其中添加了一个`FPSCollector`这个实现了`IDoFrameListener`接口的类，用来进行帧率的收集以及上报。

**<small>matrix/matrix-android/matrix-trace-canary/src/main/java/com/tencent/matrix/trace/tracer/FrameTracer.java</small>**

```java
private class FPSCollector extends IDoFrameListener {

    private Handler frameHandler = new Handler(MatrixHandlerThread.getDefaultHandlerThread().getLooper());

    Executor executor = new Executor() {
        @Override
        public void execute(Runnable command) {
            frameHandler.post(command);
        }
    };

    private HashMap<String, FrameCollectItem> map = new HashMap<>();

    @Override
    public Executor getExecutor() {
        return executor;
    }

    @Override
    public void doFrameAsync(String visibleScene, long taskCost, long frameCostMs, int droppedFrames, boolean isContainsFrame) {
        super.doFrameAsync(visibleScene, taskCost, frameCostMs, droppedFrames, isContainsFrame);
        if (Utils.isEmpty(visibleScene)) {
            return;
        }

        FrameCollectItem item = map.get(visibleScene);
        if (null == item) {
            item = new FrameCollectItem(visibleScene);
            map.put(visibleScene, item);
        }

        item.collect(droppedFrames, isContainsFrame);

        if (item.sumFrameCost >= timeSliceMs) { // report
            map.remove(visibleScene);
            item.report();
        }
    }
}
```

`FPSCollector`以页面为key，记录每个页面的帧情况。首先调用`FrameCollectItem.collect`收集帧率信息。然后当页面累计事件`sumFrameCost`超过一定阈值（默认10s）时，进行上报。

然后我们看看重点的`FrameCollectItem#collect`方法：

```java
void collect(int droppedFrames, boolean isContainsFrame) {
    long frameIntervalCost = UIThreadMonitor.getMonitor().getFrameIntervalNanos();
    sumFrameCost += (droppedFrames + 1) * frameIntervalCost / Constants.TIME_MILLIS_TO_NANO;
    sumDroppedFrames += droppedFrames;
    sumFrame++;
    if (!isContainsFrame) {
        sumTaskFrame++;
    }

    if (droppedFrames >= frozenThreshold) {
        dropLevel[DropStatus.DROPPED_FROZEN.index]++;
        dropSum[DropStatus.DROPPED_FROZEN.index] += droppedFrames;
    } else if (droppedFrames >= highThreshold) {
        dropLevel[DropStatus.DROPPED_HIGH.index]++;
        dropSum[DropStatus.DROPPED_HIGH.index] += droppedFrames;
    } else if (droppedFrames >= middleThreshold) {
        dropLevel[DropStatus.DROPPED_MIDDLE.index]++;
        dropSum[DropStatus.DROPPED_MIDDLE.index] += droppedFrames;
    } else if (droppedFrames >= normalThreshold) {
        dropLevel[DropStatus.DROPPED_NORMAL.index]++;
        dropSum[DropStatus.DROPPED_NORMAL.index] += droppedFrames;
    } else {
        dropLevel[DropStatus.DROPPED_BEST.index]++;
        dropSum[DropStatus.DROPPED_BEST.index] += (droppedFrames < 0 ? 0 : droppedFrames);
    }
}
```

`sumFrameCost`记录的是累计的帧耗时。`sumDroppedFrames`记录的是累计丢帧数。`sumFrame`是累计帧数。在记录这些数之后，按照丢帧的数值，记录到对应的丢帧状态数组中。在记录完毕之后，会在适当的时间被调用`report`方法进行上报，上报的代码就不是重点了。

上面就是`TrameTracer`中帧率上报的代码分析，除开具体的计算部分之外，其他代码非常简明扼要。但就是计算部分的代码，我始终觉得有很大的bug。  

???+ question "isContainsFrame始终为true"
    我们回到`UIThreadMonitor#dispatchEnd`中调用`LooperObserver#doFrame`的位置，我们假设前面提到的`isBelongFrame`始终为false的bug已经解决了，再看`isBelongFrame ? end - start : 0`这段代码，这段代码的值肯定始终是`>= 0`的。然后我们看`FrameTracer#doFrame`中的对于isContainsFrame参数的计算：`frameCostMs >= 0`，毫无疑问，该值也是恒真的。  
    这就导致在`FrameCollectItem#collect`中`sumTaskFrame`始终不能自增，导致在report时`dropTaskFrameSum`始终为0。

???+ question "sumFrameCost计算真的合理吗"
    我们说到`sumFrameCost`是统计的累计帧耗时，那么当`isContainsFrame`为false时，也就是执行其他Message时，`sumFrameCost`也会累积？  
    比如我们在demo中直接在主Handler循环delay 1ms执行自己，那么最终也会由`UIThreadMonitor`捕获到该Message并最后传到`FrameCollectItem#collect`中。尽管没有触发任何UI操作，但还是按照frame的message进行统计了。  
    我们可以执行下面代码，发现很快就触发了上报。
    ```java
    final Handler handler = new Handler();
    handler.postDelayed(new Runnable() {
        @Override
        public void run() {
            handler.postDelayed(this, 1);
        }
    }, 1);
    ```
    感觉这里先看看是不是`isContainsFrame`，然后在累加比较合适。







[^1]: [Matrix-Android-TraceCanary#实现细节](https://github.com/Tencent/matrix/wiki/Matrix-Android-TraceCanary#%E5%AE%9E%E7%8E%B0%E7%BB%86%E8%8A%82)