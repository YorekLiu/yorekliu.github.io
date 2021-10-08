---
title: "Android线程与线程池"
---

本章代码基于Android 7.1。

## 1 线程、线程池概述
在Android中，线程分为主线程和子线程，主线程主要处理UI操作，耗时任务必须放在子线程中。

除了Thread外，Android中扮演线程角色的还有很多，比如`AsyncTask`、`IntentService`，同时`HandlerThread`也是一种特殊的线程。对于`AsyncTask`，其底部用到了线程池，对于`IntentService`和`HandlerThread`来说，它们的底部直接使用了子线程。

不同形式的线程虽然都是线程，但是它们具有不用的特点：

- `AsyncTask`封装了线程池和Handler，它主要是为了开发者在子线程中更新UI。
- `IntentService`是一个Service，系统使用了HandlerThread封装，这样可以方便的执行后台任务。当任务执行完成后，`IntentService`会自动退出。`IntentService`作用很像一个后台线程，但又因为它是一个Service，因此**不容易被系统杀死**从而尽量保证任务的执行；如果执行使用后台线程，由于这个时候没有活动的四大组件，那么这个进程的优先级会非常低，容易被系统杀死，这就是`IntentService`的特点。

线程池会缓存一定数量的线程，通过线程池就可以避免因为频繁创建和销毁线程所带来的系统开销。Android中线程池来源于Java，主要是通过`Executor`来派生特定类型的线程池，不同类型的线程池又具有各自的特性。

## 2 Android中线程存在形态

Android中的线程除了传统的`Thread`外，还包含`AsyncTask`、`HandlerThread`、`IntentService`。

AsyncTask简化了在子线程中访问UI的过程，但是AsyncTask经过了几次修改，导致了不同API版本AsyncTask具有不同的表现，尤其在多任务的并发执行上。

### 2.1 AsyncTask

AsyncTask是一种轻量级的异步执行任务类，它可以在线程池中执行后台任务，然后把执行的进度和最终结果传递给主线程并在主线程中更新UI。  
**AsyncTask封装了Thread和Handler，这使得它可以更加方便的执行后台任务以及在主线程中访问UI。**  
但是AsyncTask不适合进行特别耗时的后台任务，对于特别耗时的后台任务，建议使用线程池。  

AsyncTask是一个抽象泛型类，它有三个泛型参数，Params表示传入参数类型，Progress表示后台任务执行进度的类型，Result表示后台任务的返回结果的类型。如果AsyncTask不需要传递具体的参数，可以使用Void代替。

```java
public abstract class AsyncTask<Params, Progress, Result>
```

AsyncTask提供了4个核心方法，它们的含义如下所示：

```java
@WorkerThread
protected abstract Result doInBackground(Params... params);

@MainThread
protected void onPreExecute() {}

@MainThread
protected void onPostExecute(Result result) {}

@MainThread
protected void onProgressUpdate(Progress... values) {}
```

- `onPreExecute`  
  在主线程执行，在异步任务执行之前，此方法会被调用，一般做些准备工作。
- `doInBackground`  
  在工作线程中执行，此方法用于执行异步任务。在此方法中可以使用`publishProgress`来更新任务的进度，`publishProgress`会调用`onProgressUpdate`方法。此方法的返回结果会传递给`onPostExecute`方法，当然如果异步任务被取消，那么结果会返回给`onCancelled(Result)`。
- `onProgressUpdate`  
  在主线程中执行，当后台任务的执行进度发生改变时，此方法会被调用
- `onPostExecute`  
  在主线程中执行，在异步任务完成后，该方法会被调用。

下面是一个典型的例子：
```java
 private class DownloadFilesTask extends AsyncTask<URL, Integer, Long> {
     protected Long doInBackground(URL... urls) {
         int count = urls.length;
         long totalSize = 0;
         for (int i = 0; i < count; i++) {
             totalSize += Downloader.downloadFile(urls[i]);
             publishProgress((int) ((i / (float) count) * 100));
             // Escape early if cancel() is called
             if (isCancelled()) break;
         }
         return totalSize;
     }

     protected void onProgressUpdate(Integer... progress) {
         setProgressPercent(progress[0]);
     }

     protected void onPostExecute(Long result) {
         showDialog("Downloaded " + result + " bytes");
     }
 }
```
执行该任务也非常简单：
```java
new DownloadFilesTask().execute(url1, url2, url3);
```

AsyncTask有一些使用注意事项：

1. AsyncTask必须在主线程中加载，这在JB(Android 4.1)中已经自动完成了 [ICS](http://androidxref.com/4.0.4/xref/frameworks/base/core/java/android/app/ActivityThread.java#4401) [JB](http://androidxref.com/4.1.1/xref/frameworks/base/core/java/android/app/ActivityThread.java#4720) 。在JB之后的ActivityThread的`main`方法中，会调用`AsyncTask.init();`。
2. AsyncTask对象实例必须在UI线程中创建。
3. `execute`方法必须在UI线程调用。
4. 不要手动调用`onPreExecute`、`onPostExecute`、`doInBackground`、`onProgressUpdate`方法；但有需要，可以手动调用`publishProgress`方法
5. 一个AsyncTask只能执行一次
6. **刚开始引入时**，AsyncTask是单一后台线程**串行**执行的。从**Android 1.6(DONUT)**开始，AsyncTask采用了线程池**并行**处理任务。从**Android 3.0(HONEYCOMB)**开始，又变回了采用一个线程来**串行**处理任务。

> 如果想要并行执行，我们可以通过调用`executeOnExecutor`来使用THREAD_POOL_EXECUTOR执行任务。

`THREAD_POOL_EXECUTOR`是一个核心线程clamp在[2, 4]之间的允许核心线程超时的线程池，对应的初始化代码如下：

```java
private static final int CPU_COUNT = Runtime.getRuntime().availableProcessors();
// We want at least 2 threads and at most 4 threads in the core pool,
// preferring to have 1 less than the CPU count to avoid saturating
// the CPU with background work
private static final int CORE_POOL_SIZE = Math.max(2, Math.min(CPU_COUNT - 1, 4));
private static final int MAXIMUM_POOL_SIZE = CPU_COUNT * 2 + 1;
private static final int KEEP_ALIVE_SECONDS = 30;

private static final BlockingQueue<Runnable> sPoolWorkQueue =
            new LinkedBlockingQueue<Runnable>(128);

public static final Executor THREAD_POOL_EXECUTOR;

static {
    ThreadPoolExecutor threadPoolExecutor = new ThreadPoolExecutor(
            CORE_POOL_SIZE, MAXIMUM_POOL_SIZE, KEEP_ALIVE_SECONDS, TimeUnit.SECONDS,
            sPoolWorkQueue, sThreadFactory);
    threadPoolExecutor.allowCoreThreadTimeOut(true);
    THREAD_POOL_EXECUTOR = threadPoolExecutor;
}
```

### 2.2 AsyncTask的工作原理
AsyncTask的工作原理还是从`execute`方法开始：
```java
@MainThread
public final AsyncTask<Params, Progress, Result> execute(Params... params) {
    return executeOnExecutor(sDefaultExecutor, params);
}

@MainThread
public final AsyncTask<Params, Progress, Result> executeOnExecutor(Executor exec,
        Params... params) {
    if (mStatus != Status.PENDING) {
        switch (mStatus) {
            case RUNNING:
                throw new IllegalStateException("Cannot execute task:"
                        + " the task is already running.");
            case FINISHED:
                throw new IllegalStateException("Cannot execute task:"
                        + " the task has already been executed "
                        + "(a task can be executed only once)");
        }
    }

    mStatus = Status.RUNNING;

    onPreExecute();

    mWorker.mParams = params;
    exec.execute(mFuture);

    return this;
}
```
`execute`方法执行调用了`executeOnExecutor`，在`executeOnExecutor`方法中先调用了`onPreExecute`方法，然后在调用`exec.execute(mFuture)`开始执行任务。

我们看一下sDefaultExecutor：
```java
private static volatile Executor sDefaultExecutor = SERIAL_EXECUTOR;
public static final Executor SERIAL_EXECUTOR = new SerialExecutor();

private static class SerialExecutor implements Executor {
    final ArrayDeque<Runnable> mTasks = new ArrayDeque<Runnable>();
    Runnable mActive;

    public synchronized void execute(final Runnable r) {
        mTasks.offer(new Runnable() {
            public void run() {
                try {
                    r.run();
                } finally {
                    scheduleNext();
                }
            }
        });
        if (mActive == null) {
            scheduleNext();
        }
    }

    protected synchronized void scheduleNext() {
        if ((mActive = mTasks.poll()) != null) {
            THREAD_POOL_EXECUTOR.execute(mActive);
        }
    }
}
```
sDefaultExecutor就是一个串行线程池，一个进程中所有的`AsyncTask`全部在这个串行线程池中排队执行。

`FutureTask`继承至`Runnable`，它是一个并发类。AsyncTask的Params参数先被赋值给`mWorker.mParams`，`mWorker`会被封装成为一个`FutureTask`。在`SERIAL_EXECUTOR`的`execute`方法中会把对象`offer`到任务队列`mTasks`中，如果这时候没有活动的`AsyncTask`任务（`mActive == null`），那么会调用`scheduleNext`方法来执行下一个`AsyncTask`任务（`mActive = mTasks.poll()`）。因此，从这里可以看出，默认情况下`AsyncTask`是串行执行的。

`AsyncTask`任务有两个线程池（`SerialExecutor`和`THREAD_POOL_EXECUTOR`），其中前者用来任务的排队，后者用于真正的执行任务。`AsyncTask`里面还有一个InternalHandler，它用于将执行环境从线程池切换到主线程。

接下来我们看一下`FutureTask`的`run`方法。此方法会调用`mWorker.call`，在AsyncTask的构造方法中，可以看到下面这段代码：
```java
mWorker = new WorkerRunnable<Params, Result>() {
    public Result call() throws Exception {
        mTaskInvoked.set(true);
        Result result = null;
        try {
            Process.setThreadPriority(Process.THREAD_PRIORITY_BACKGROUND);
            //noinspection unchecked
            result = doInBackground(mParams);
            Binder.flushPendingCommands();
        } catch (Throwable tr) {
            mCancelled.set(true);
            throw tr;
        } finally {
            postResult(result);
        }
        return result;
    }
};
```
在该方法中首先会将`mTaskInvoked`设置为true，这表示当前任务已经被调用过了。然后在执行AsyncTask的`doInBackground`方法，如果执行出现了异常，那么`mCancelled`设置为true，并且抛出异常。在最后调用`postResult`将计算结果传出去。我们看一下`postResult`方法：
```java
private Result postResult(Result result) {
    @SuppressWarnings("unchecked")
    Message message = getHandler().obtainMessage(MESSAGE_POST_RESULT,
            new AsyncTaskResult<Result>(this, result));
    message.sendToTarget();
    return result;
}
```
我们可以看到，该方法会通过`sHandler`发送一个MESSAGE_POST_RESULT消息。接着看`sHandler`的实现：
```java
private static InternalHandler sHandler;

private static Handler getHandler() {
    synchronized (AsyncTask.class) {
        if (sHandler == null) {
            sHandler = new InternalHandler();
        }
        return sHandler;
    }
}

private static class InternalHandler extends Handler {
    public InternalHandler() {
        super(Looper.getMainLooper());
    }

    @SuppressWarnings({"unchecked", "RawUseOfParameterizedType"})
    @Override
    public void handleMessage(Message msg) {
        AsyncTaskResult<?> result = (AsyncTaskResult<?>) msg.obj;
        switch (msg.what) {
            case MESSAGE_POST_RESULT:
                // There is only one result
                result.mTask.finish(result.mData[0]);
                break;
            case MESSAGE_POST_PROGRESS:
                result.mTask.onProgressUpdate(result.mData);
                break;
        }
    }
}
```
**`sHandler`是一个静态的Handler对象，为了能够切换执行线程，这就要求`sHandler`必须在主线程中进行创建。由于静态成员会在加载类的时候进行初始化，因此就这变相要求AsyncTask的类必须在主线程中进行加载。**`sHandler`在收到MESSAGE_POST_RESULT消息后，会调用`AsyncTask#finish`方法：
```java
private void finish(Result result) {
    if (isCancelled()) {
        onCancelled(result);
    } else {
        onPostExecute(result);
    }
    mStatus = Status.FINISHED;
}
```
`AsyncTask`的`finish`方法逻辑比较简单，如果AsyncTask被取消执行了，那么会调用`onCancelled(Result)`方法；否则会调用`onPostExecute`方法。至此，AsyncTask的整个工作流程就分析完了。

### 2.3 IntentService

说到`IntentService`，不得先说说`HandlerThread`。因此`IntentService`封装了一个`HandlerThread`以及一个`Handler`。

#### 2.3.1 HandlerThread

`HandlerThread`继承了Thread，它是一种可以使用`Handler`的`Thread`。其实现非常简单，在其`run`方法中通过`Looper.prepare()`来创建消息队列，并通过`Looper.loop()`来开启消息循环。这样一旦有Message进来，就会在该线程中处理此Message。

```java
public void run() {
    mTid = Process.myTid();
    Looper.prepare();
    synchronized (this) {
        mLooper = Looper.myLooper();
        notifyAll();
    }
    Process.setThreadPriority(mPriority);
    onLooperPrepared();
    Looper.loop();
    mTid = -1;
}
```

基于以上原理的讨论，HanlderThread有如下显而易见的特点：

- HandlerThread本质上是一个线程，继承自Thread
- HandlerThread有自己的Looper对象，可以进行Looper循环，可以创建Handler
- HandlerThread可以在Handler的handlerMessage中执行异步方法
- HandlerThread优点是异步不会堵塞，减少对性能的消耗
- HandlerThread缺点是不能同时继续进行多任务处理，需要等待进行处理，处理效率较低
- HandlerThread与线程池不同，HandlerThread是一个串行队列，背后只有一个线程

HandlerThread是一个常用的类，它在Android中一个具体的使用场景是IntentService。

由于HandlerThread的run方法是一个无限循环，因此当明确不需要在使用HandlerThread时，可以通过它的`quit`或者`quitSafely`方法来终止线程的执行。

#### 2.3.2 IntentService

IntentService也是一种Service，它可用于执行后台耗时的任务，当任务执行完后会自动停止。同时IntentService是一种Service的原因，这导致它的优先级比单纯的线程要高，所以IntentService适合执行一些高优先级的后台任务。

IntentService内部封装了HandlerThread以及一个Handler，我们可以从其`onCreate`方法中看出来：
```java
public void onCreate() {
    // TODO: It would be nice to have an option to hold a partial wakelock
    // during processing, and to have a static startService(Context, Intent)
    // method that would launch the service & hand off a wakelock.

    super.onCreate();
    HandlerThread thread = new HandlerThread("IntentService[" + mName + "]");
    thread.start();

    mServiceLooper = thread.getLooper();
    mServiceHandler = new ServiceHandler(mServiceLooper);
}
```
当IntentService被创建时，其`onCreate`方法会被调用，在方法中会创建一个`HandlerThread`，然后通过它的Looper构造一个Handler。每次启动IntentService，它的`onStartCommand`方法就会被调用，`onStartCommand`又会调用`onStart`方法。在此方法中会将Intent传递给Handler处理。

```java
public void onStart(@Nullable Intent intent, int startId) {
    Message msg = mServiceHandler.obtainMessage();
    msg.arg1 = startId;
    msg.obj = intent;
    mServiceHandler.sendMessage(msg);
}
```

ServiceHandler在接收到消息时会调用`onHandleIntent`方法处理Intent。IntentService的`onHandleIntent`是一个抽象方法，我们需要自己实现它。当Intent处理完成后，会调用`stopSelf(int)`方法尝试停止Service。

```java
private final class ServiceHandler extends Handler {
    public ServiceHandler(Looper looper) {
        super(looper);
    }

    @Override
    public void handleMessage(Message msg) {
        onHandleIntent((Intent)msg.obj);
        stopSelf(msg.arg1);
    }
}
```

`stopSelf(int)`与`stopSelf()`的区别在于前者在尝试停止Service之前会判断最近启动Service的次数是否和startId相等；否者会立刻停止Service。  
如果目前只有一个后台任务，那么`onHandleIntent`方法处理完成后，`stopSelf(int)`方法会直接停止服务。如果存在多个任务，当`onHandleIntent`方法执行完最后一个时，`stopSelf(int)`才会直接停止服务。该特点源自于Service。

因为IntentService是通过`mServiceHandler.sendMessage(msg)`的方式来请求执行任务的，那么意味着IntentService也是顺序执行后台任务的，当有多个后台任务存在时，这些后台任务就会按照外界发起的顺序排队执行。

同时需要注意，因为HandlerThread的Looper是子线程的，所以导致IntentService的`onHandleIntent`方法是运行在子线程中的。因此如果需要在上述方法中访问UI，注意线程的切换。

## 3  Android中的线程池

线程池的好处可以概括为一下三点：

- 重用线程池中的线程，可以避免因为线程的创建和销毁带来的性能开销
- 能有效控制线程池的最大并发数，避免大量的线程之间因为互相抢占系统资源而导致的阻塞现象
- 能够对线程进行简单的管理，并提供定时执行以及指定间隔循环执行等功能

Android中的线程池来源于Java中的Executor，Executor是一个接口，真正的线程池的实现为ThreadPoolExecutor。ThreadPoolExecutor提供了一系列参数用来配置线程池，通过不同的参数可以创建不同的线程池。

### 3.1 ThreadPoolExecutor

ThreadPoolExecutor是线程池的真正实现，它的构造方法提供了一系列参数来配置线程池，下面这个参数是常用的：
```java
public ThreadPoolExecutor(int corePoolSize,
                          int maximumPoolSize,
                          long keepAliveTime,
                          TimeUnit unit,
                          BlockingQueue<Runnable> workQueue)
```

- corePoolSize  
线程池的核心线程数。核心线程会一直存活，即使它们处于闲置状态，除非设置allowCoreThreadTimeOut
- maximumPoolSize  
线程池中允许存在的最大线程数
- keepAliveTime  
当线程数量超过核心线程数量时，允许闲置线程等待新任务的时长
- unit  
keepAliveTime参数的时间单位。常用的有MILLISECONDS、SECONDS、MINUTES等
- workQueue  
线程池中任务队列。该队列将只保存通过`execute`方法提交的`Runnable`对象。

ThreadPoolExecutor执行任务时大致遵循以下规则：

1. 如果线程池中的线程数量未达到核心线程的数量，那么会直接启动一个核心线程来执行任务。
2. 如果线程池中的线程数量已经达到或者超过了核心线程的数量，那么任务会被插入到队列中排队等待执行。
3. 如果无法插入到队列中，这说明任务队列已满。这时候如果线程未达到线程池规定的最大值，那么会立刻启动一个非核心线程来执行任务。
4. 如果步奏3中的线程数量已经达到了线程池规定的最大值，那么就会拒绝执行此任务，线程池会调用`RejectedExecutionHandler#rejectedExecution`来通知调用者。

这段逻辑具体在`ThreadPoolExecutor#execute`方法中：
```java
public void execute(Runnable command) {
    if (command == null)
        throw new NullPointerException();
    /*
     * Proceed in 3 steps:
     *
     * 1. If fewer than corePoolSize threads are running, try to
     * start a new thread with the given command as its first
     * task.  The call to addWorker atomically checks runState and
     * workerCount, and so prevents false alarms that would add
     * threads when it shouldn't, by returning false.
     *
     * 2. If a task can be successfully queued, then we still need
     * to double-check whether we should have added a thread
     * (because existing ones died since last checking) or that
     * the pool shut down since entry into this method. So we
     * recheck state and if necessary roll back the enqueuing if
     * stopped, or start a new thread if there are none.
     *
     * 3. If we cannot queue task, then we try to add a new
     * thread.  If it fails, we know we are shut down or saturated
     * and so reject the task.
     */
    int c = ctl.get();
    if (workerCountOf(c) < corePoolSize) {
        if (addWorker(command, true))
            return;
        c = ctl.get();
    }
    if (isRunning(c) && workQueue.offer(command)) {
        int recheck = ctl.get();
        if (! isRunning(recheck) && remove(command))
            reject(command);
        else if (workerCountOf(recheck) == 0)
            addWorker(null, false);
    }
    else if (!addWorker(command, false))
        reject(command);
}
```
注释和代码很清晰明白，不累述。

### 3.2 线程池的分类

Android中常见四个线程池，它们分别是

1. FixedThreadPool
2. SingleThreadExecutor
3. CachedThreadPool
4. ScheduledThreadPool

其创建方法在`Executors`里面。我们可以看一下它们的特点：

- FixedThreadPool

    ```java
    public static ExecutorService newFixedThreadPool(int nThreads) {
        return new ThreadPoolExecutor(nThreads, nThreads,
                                      0L, TimeUnit.MILLISECONDS,
                                      new LinkedBlockingQueue<Runnable>());
    }
    ```
    
    这是一个线程数量固定、队列大小没有限制的线程池。在任何时候，线程都将会被激活以处理任务。线程池中的线程不会停止直到调用`shutdown`。由于`FixedThreadPool`只有核心线程并且这些核心线程不会被回收，这意味着它能够更快速的响应外界的请求。

- SingleThreadExecutor

    ```java
    public static ExecutorService newSingleThreadExecutor() {
        return new FinalizableDelegatedExecutorService
            (new ThreadPoolExecutor(1, 1,
                                    0L, TimeUnit.MILLISECONDS,
                                    new LinkedBlockingQueue<Runnable>()));
    }
    ```
    
    这是一个单一线程、队列大小没有限制的线程池。其内部只有一个线程，可以确保所有任务都在同一个线程中按顺序执行。`SingleThreadExecutor`的意义在于统一外界任务到一个线程中，这使得这些任务之间不需要处理线程同步问题。

- CachedThreadPool

    ```java
    public static ExecutorService newCachedThreadPool() {
        return new ThreadPoolExecutor(0, Integer.MAX_VALUE,
                                      60L, TimeUnit.SECONDS,
                                      new SynchronousQueue<Runnable>());
    }
    ```
    
    这是一个线程数量不定的线程池，他只有非核心线程，并且其最大线程数为`Integer.MAX_VALUE`。线程池中的空闲线程都有超时机制，这个超时时常为60s，超过这个时间的闲置线程就会被回收。`CachedThreadPool`的任务队列可以简单的理解为一个无法存储元素的队列，因此这将导致任何任务都会立刻执行。

    从其特性来看，这类线程池适合执行大量耗时较少的任务。当整个线程池处理闲置状态时，线程池中的线程都会因为超时而被停止，这个时候`CachedThreadPool`之中实际上是没有线程的，它几乎不占用任何系统资源。

- ScheduledThreadPool

    ```java
    private static final long DEFAULT_KEEPALIVE_MILLIS = 10L;
    
    public static ScheduledExecutorService newScheduledThreadPool(int corePoolSize) {
        return new ScheduledThreadPoolExecutor(corePoolSize);
    }
    
    public ScheduledThreadPoolExecutor(int corePoolSize) {
        super(corePoolSize, Integer.MAX_VALUE,
              DEFAULT_KEEPALIVE_MILLIS, MILLISECONDS,
              new DelayedWorkQueue());
    }
    ```
    
    这是一个核心线程数量固定、非核心线程数量没有限制、非核心线程闲置时间10s的线程池。此类线程池主要用于执行定时任务和具有固定周期的重复任务。

### 3.3 线程池线程复用原理

![线程复用原理](/assets/images/android/thread_reuse.png)