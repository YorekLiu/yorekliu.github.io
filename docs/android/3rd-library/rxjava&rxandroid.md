---
title: "RxJava源码解析及使用实例"
---

???+ note "用过RxJava和RxAndroid吗？RxAndroid切换线程是怎么实现的呢？"
    RxAndroid的线程切换是通过`Handler`实现的，RxJava则是通过将`Runnable`提交到 **线程池** 来实现的。

---

## 参考资料

- [RxJava/RxAndroid 使用实例实践 - 简书](https://www.jianshu.com/p/031745744bfa)  
  通俗易懂，通过一个查找Cheese的例子讲出了RxJava的特点
- [给 Android 开发者的 RxJava 详解](http://gank.io/post/560e15be2dca930e00da1083)  
  基于RxJava1，有例子还有部分源码讲解
- [详解 RxJava2 的线程切换原理](https://www.jianshu.com/p/a9ebf730cd08)
- [友好 RxJava2.x 源码解析系列](https://juejin.im/post/5a209c876fb9a0452577e830)


本文RxJava源码版本为2.1.13，RxAndroid版本为2.0.2。RxAndroid这个库只提供了一个调度器，所以没有单独拎出来说。

## 1. 基本订阅流程

在正文开始前，我们以`Observable.create`操作符为例，先看一下下面几个基本类之间的关系：

<figure style="width:90%" class="align-center">
    <img src="/assets/images/android/rxjava/rxjava_uml.png">
    <figcaption>以create为例，相关类的UML图</figcaption>
</figure>

理清这几个类有助于下面文章的分析：

- `ObservableSource`  
  顾名思义，就是数据源，会被`Observer`消耗。这是一个接口，其实现类为抽象类`Observable`，接口中的`subscribe`方法会由抽象类`Observable`的抽象方法`subscribeActual`方法进行实现。
- `Emitter`  
  决定如何发射数据，只在create等操作符中才会出现
- `Observer`  
  数据的消耗端
  

本文会以下面的例子进行源码的解读：

```java
Observable.create(object : ObservableOnSubscribe<String> {
    override fun subscribe(emitter: ObservableEmitter<String>) {
        emitter.onNext("1")
        emitter.onNext("2")
        emitter.onComplete()
    }
}).map(object : Function<String, Int> {
    override fun apply(t: String): Int {
        return t.toInt() * 10
    }
}).subscribe(object : Observer<Int> {
    override fun onComplete() {
        System.out.print("onComplete\n")
    }

    override fun onSubscribe(d: Disposable) {
        System.out.print("onSubscribe\n")
    }

    override fun onNext(t: Int) {
        System.out.print("onNext $t\n")
    }

    override fun onError(e: Throwable) {
        System.out.print("onError\n")
    }
})
```

运行结果：

```java
onSubscribe
onNext 10
onNext 20
onComplete
```

在开始之前先把上面的链式代码展开一下，方便下面继续逐个展开：

```java
// 订阅者
val resultObserver = object : Observer<Int> {
    override fun onComplete() {
        System.out.print("onComplete\n")
    }

    override fun onSubscribe(d: Disposable) {
        System.out.print("onSubscribe\n")
    }

    override fun onNext(t: Int) {
        System.out.print("onNext $t\n")
    }

    override fun onError(e: Throwable) {
        System.out.print("onError\n")
    }
}

// 观察者
val source = object : ObservableOnSubscribe<String> {
    override fun subscribe(emitter: ObservableEmitter<String>) {
        emitter.onNext("1")
        emitter.onNext("2")
        emitter.onComplete()
    }
}

// map转换方法
val function = object : Function<String, Int> {
    override fun apply(t: String): Int {
        return t.toInt() * 10
    }
}

// 链式调用
Observable.create(source).map(function).subscribe(resultObserver)
```

下面正式开始看看rxjava为何这么牛逼。  

先看看`Observable.create`的方法：

```java
@CheckReturnValue
@SchedulerSupport(SchedulerSupport.NONE)
public static <T> Observable<T> create(ObservableOnSubscribe<T> source) {
    // 检查入参source是否为null
    ObjectHelper.requireNonNull(source, "source is null");
    // 1️⃣尝试使用RxJavaPlugins.onObservableAssembly这个方法进行转换
    return RxJavaPlugins.onAssembly(new ObservableCreate<T>(source));
}
```

1️⃣：`RxJavaPlugins.onAssembly`类似的方法在尝试将一个`Observable`对象转换为另外一个`Observable`对象。当然，这取决与转换器`onObservableAssembly`是否为空；默认情况下，它是空的，但是可以通过`RxJavaPlugins`的静态方法进行get/set，如下面代码所示。

```java
@NonNull
public static <T> Observable<T> onAssembly(@NonNull Observable<T> source) {
    Function<? super Observable, ? extends Observable> f = onObservableAssembly;
    if (f != null) {
        return apply(f, source);
    }
    return source;
}
```

由于`f`为空，所以这里直接返回了`source`也就是刚刚new好的`ObservableCreate<T>(source)`。

因此，开头的例子中最后的链式调用部分就等价于：

```java
ObservableCreate<String>(source).map(function).subscribe(resultObserver)
```

下面看一下`map`操作符：

```java
@CheckReturnValue
@SchedulerSupport(SchedulerSupport.NONE)
public final <R> Observable<R> map(Function<? super T, ? extends R> mapper) {
    ObjectHelper.requireNonNull(mapper, "mapper is null");
    return RxJavaPlugins.onAssembly(new ObservableMap<T, R>(this, mapper));
}
```

这段代码与`create`操作符类似，这里直接返回了一个`ObservableMap`。

所以，开头的例子中最后的链式调用部分再次展开为：

```java
ObservableMap<String, Int>(
    ObservableCreate<String>(source),
    function
).subscribe(resultObserver)
```

在上面，我们已经创建好了两个`Observable`，一个原始的创建数据的`ObservableCreate`以及一个用于转换的`ObservableMap`。  

**所有的操作符都将上一个**`Observable`**作为一个参数传入构造函数，这就是RxJava中数据会依次经过这些**`Observable`**的原因。**  
同时，值得注意的是，rxjava中每个操作符都会在内部创建一个`Observable`对象。

接下来，我们回到示例程序的`subscribe`操作中，我们知道`subscribe`是`ObservableSource`接口的方法，该方法在抽象类`Observable`中进行了重写，在重写方法中交给了抽象方法`subscribeActual`来实现，我们看看这部分代码：

```java
@SchedulerSupport(SchedulerSupport.NONE)
@Override
public final void subscribe(Observer<? super T> observer) {
    // 检查入参observer是否为空
    ObjectHelper.requireNonNull(observer, "observer is null");
    try {
        // 同1️⃣处的注释，默认情况下返回入参参数observer
        observer = RxJavaPlugins.onSubscribe(this, observer);
        // 检查转换后的observer是否为空
        ObjectHelper.requireNonNull(observer, "Plugin returned null Observer");
        // 调用抽象方法subscribeActual进行真正的订阅
        subscribeActual(observer);
    } catch (NullPointerException e) { // NOPMD
        throw e;
    } catch (Throwable e) {
        Exceptions.throwIfFatal(e);
        // can't call onError because no way to know if a Disposable has been set or not
        // can't call onSubscribe because the call might have set a Subscription already
        RxJavaPlugins.onError(e);

        NullPointerException npe = new NullPointerException("Actually not, but can't throw other exceptions due to RS");
        npe.initCause(e);
        throw npe;
    }
}
```

现在，我们正式开始看看例子是怎么执行的。  
由于先执行的是最近的Observable也就是`ObservableMap`，我们先看看其`subscribeActual`方法：

```java
public final class ObservableMap<T, U> extends AbstractObservableWithUpstream<T, U> {
    final Function<? super T, ? extends U> function;

    public ObservableMap(ObservableSource<T> source, Function<? super T, ? extends U> function) {
        super(source);
        this.function = function;
    }

    @Override
    public void subscribeActual(Observer<? super U> t) {
        source.subscribe(new MapObserver<T, U>(t, function));
    }

    static final class MapObserver<T, U> extends BasicFuseableObserver<T, U> {
        ...
    }
}
```

我们先不看具体的实现，先尝试把所有的代码全部展开，然后在研究例子的结果。目前可以展开如下：

```java
ObservableCreate<String>(source).subscribe(MapObserver<String, Int>(resultObserver, function))
```

现在轮到展开`ObservableCreate`了：

```java
public final class ObservableCreate<T> extends Observable<T> {
    final ObservableOnSubscribe<T> source;

    public ObservableCreate(ObservableOnSubscribe<T> source) {
        this.source = source;
    }

    @Override
    protected void subscribeActual(Observer<? super T> observer) {
        CreateEmitter<T> parent = new CreateEmitter<T>(observer);
        observer.onSubscribe(parent);

        try {
            source.subscribe(parent);
        } catch (Throwable ex) {
            Exceptions.throwIfFatal(ex);
            parent.onError(ex);
        }
    }

    static final class CreateEmitter<T>
    extends AtomicReference<Disposable>
    implements ObservableEmitter<T>, Disposable {
        ...
    }
    ...
}
```

然后展开这最后一部分代码：

```java
// 代码中observer参数就是例子中的MapObserver<String, Int>(resultObserver, function)
// source参数就是例子中的source
val observer = MapObserver<String, Int>(resultObserver, function)

// 所以实例代码的subscribe方法就等于下面这一段
val parent = CreateEmitter<String>(observer)
// 2️⃣
observer.onSubscribe(parent)
// 3️⃣
source.subscribe(parent)
```

`CreateEmitter`是一个继承了`AtomicReference`并实现了`ObservableEmitter`和`Disposable`接口的类
- 对于`ObservableEmitter`接口来说，该类就是在对应的接口方法中调用构造器入参`observer`的对应发射方法
- 对于`Disposable`接口来说，该类向客户端返回了一个可以dispose操作的对象`parent`；其原理是根据`AtomicReference<Disposable>`是否为`DISPOSED`判断是不是处于disposed状态

`MapObserver`简单来说就是在`onNext`方法中会将原始值t用转换方法`mappper`进行转换，然后调用构造器入参`actual`这个Observer的`onNext`方法

2️⃣：调用`observer.onSubscribe(parent)`，因为`observer.actual`为`resultObserver`，所以通知我们写的消费者开始进行订阅了。

3️⃣：调用`source.subscribe(parent)`，正式开始订阅。
- 这里的`source`就是最原始的数据源，这里将`parent`作为参数`emitter`传入到`source`的`subscribe`方法中，然后在该方法中我们调用了其`onNext`、`onComplete`方法。实际上调用的就是`CreateEmitter`的对应的方法
- 在`CreateEmitter.onNext`中会调用`observer.onNext`，这里的`observer`就是`MapObserver`
- 在`MapObserver.onNext`中会将原始值t用转换方法`mapper`进行转换，然后调用构造器入参`actual`这个Observer的`onNext`方法。最后的`actual`实际上就是`resultObserver`。
- 这样，原始数据"1"经过`CreateEmitter`的发射后，在`MapObserver`中经过`mapper`转换最后到了`resultObserver`中

### 1.1 基本订阅流程小结

小结一下，下面是示例中的定义：

```java
// 订阅者
val resultObserver = object : Observer<Int> {
    override fun onComplete() { ... }
    override fun onSubscribe(d: Disposable) { ... }
    override fun onNext(t: Int) { ... }
    override fun onError(e: Throwable) { ... }
}
// 观察者
val source = object : ObservableOnSubscribe<String> {
    override fun subscribe(emitter: ObservableEmitter<String>) {
        emitter.onNext("1")
        emitter.onNext("2")
        emitter.onComplete()
    }
}
// map转换方法
val function = object : Function<String, Int> {
    override fun apply(t: String): Int {
        return t.toInt() * 10
    }
}
// 链式调用
Observable.create(source).map(function).subscribe(resultObserver)
```

将链式调用一步步从前往后展开，会发现前面的操作符都会作为参数传入后面的操作符中。这样当订阅开始时，会从最后面的操作符开始订阅。

```java
// 原始链式调用
Observable.create(source).map(function).subscribe(resultObserver)

// 将链式调用一步步从前往后展开
// 展开create
ObservableCreate<String>(source).map(function).subscribe(resultObserver)

// 展开map
ObservableMap<String, Int>(ObservableCreate<String>(source), function).subscribe(resultObserver)
```

下面开始订阅：

```java
// 原始链式调用
ObservableMap<String, Int>(ObservableCreate<String>(source), function).subscribe(resultObserver)

// 订阅ObservableMap
ObservableCreate<String>(source).subscribe(MapObserver<String, Int>(resultObserver, function))

// 订阅ObservableCreate
// val observer = MapObserver<String, Int>(resultObserver, function)
// val parent = CreateEmitter<String>(observer)
observer.onSubscribe(parent)
source.subscribe(parent)
```

事件流向为：

```java
// val observer = MapObserver<String, Int>(resultObserver, function)
// val parent = CreateEmitter<String>(observer)
observer.onSubscribe(parent) -> resultObserver.onSubscribe(observer)

source.subscribe(parent) -> parent.onNext("1")/onNext("2")/onComplete() -> 
CreateEmitter<String>(observer).onNext("1")/onNext("2")/onComplete() ->
observer.onNext("1")/onNext("2")/onComplete() -> 
resultObserver.onNext(function.apply("1"))/onNext(function.apply("2"))/onComplete() -> 
resultObserver.onNext(10)/onNext(20)/onComplete()
```

最后，本节例子的流程图如下，左边部分表示Observable链的构建过程，右边表示订阅时的数据流图：

<figure style="width:80%" class="align-center">
    <img src="/assets/images/android/rxjava/rxjava_demo_data_flow_progress.png">
    <figcaption>本节例子的流程图</figcaption>
</figure>

## 2. 线程切换

本节以下面的示例为例：

```java
Schedulers.newThread().scheduleDirect {
    test()
}

private fun test() {
    Log.e("TAG", "test(): " + Thread.currentThread().name)
    Observable.create(ObservableOnSubscribe<String> { emitter ->
        Log.e("TAG", "subscribe(): " + Thread.currentThread().name)
        emitter.onNext("1")
        emitter.onNext("2")
        emitter.onComplete()
    }).subscribeOn(Schedulers.io())
        .observeOn(AndroidSchedulers.mainThread())
        .subscribe(object : Observer<String> {
            override fun onComplete() {
                Log.e("TAG", "onComplete(): " + Thread.currentThread().name)
            }

            override fun onSubscribe(d: Disposable) {
                Log.e("TAG", "onSubscribe(): " + Thread.currentThread().name)
            }

            override fun onNext(t: String) {
                Log.e("TAG", "onNext(): " + Thread.currentThread().name)
            }

            override fun onError(e: Throwable) {
                Log.e("TAG", "onError(): " + Thread.currentThread().name)
            }
        })
}
```

运行结果：

```java
E/TAG: test(): RxNewThreadScheduler-2
E/TAG: onSubscribe(): RxNewThreadScheduler-2
E/TAG: subscribe(): RxCachedThreadScheduler-2
E/TAG: onNext(): main
E/TAG: onNext(): main
E/TAG: onComplete(): main
```

我们发现，`onSubscribe`发生在当前线程，与`subscribeOn`和`observeOn`无关；  
`subscribeOn`决定了最上游数据产生的线程；`observeOn`决定了下游的订阅发生的线程。

### 2.1 observeOn

`observeOn`用来指定观察者回调的线程，该方法执行后会返回一个`ObservableObserveOn`对象。  

```java
@CheckReturnValue
@SchedulerSupport(SchedulerSupport.CUSTOM)
public final Observable<T> observeOn(Scheduler scheduler) {
    return observeOn(scheduler, false, bufferSize());
}

@CheckReturnValue
@SchedulerSupport(SchedulerSupport.CUSTOM)
public final Observable<T> observeOn(Scheduler scheduler, boolean delayError, int bufferSize) {
    ObjectHelper.requireNonNull(scheduler, "scheduler is null");
    ObjectHelper.verifyPositive(bufferSize, "bufferSize");
    return RxJavaPlugins.onAssembly(new ObservableObserveOn<T>(this, scheduler, delayError, bufferSize));
}
```

在我们的例子中，`ObservableObserveOn`的四个参数为：

```java
source = this
scheduler = AndroidSchedulers.mainThread()
delayError = false
bufferSize = Math.max(1, Integer.getInteger("rx2.buffer-size", 128)) = 128
```

下面看看其`subscribeActual`方法：

```java
@Override
protected void subscribeActual(Observer<? super T> observer) {
    // 如果传入的scheduler是Scheduler.trampoline()的情况
    // 该线程的意义是传入当前线程，也就是不做任何线程切换操作
    if (scheduler instanceof TrampolineScheduler) {
        source.subscribe(observer);
    } else {
        // 否则肯定是要进行线程切换的
        Scheduler.Worker w = scheduler.createWorker();
        // 将Scheduler创建的Worker传入了ObserveOnObserver
        // 这里直接调用了上游的subscribe方法，因此observeOn操作也不会影响上游线程执行环境
        source.subscribe(new ObserveOnObserver<T>(observer, w, delayError, bufferSize));
    }
}
```

`scheduler.createWorker()`只是创建了一个`handler`为主线程handler的Worker，在后面的代码中会通过其`schedule(Runnable run, long delay, TimeUnit unit)`提交一个`Runnable`，这个`Runnable`就执行在主线程中了。后面遇见再说，这里先了解一下这个Worker到底是干什么用的。

这样我们到了`ObserveOnObserver`中，首先看看其`onSubscribe`方法：

```java
@Override
public void onSubscribe(Disposable s) {
    if (DisposableHelper.validate(this.s, s)) {
        this.s = s;
        if (s instanceof QueueDisposable) {
            ...
        }
        // 创建一个单生产者单消费者的队列
        queue = new SpscLinkedArrayQueue<T>(bufferSize);
        // 直接调用上游的onSubscribe方法
        actual.onSubscribe(this);
    }
}
```

从上面的分析我们看出，`observeOn`不会影响上游线程执行环境，也不会影响下游的`onSubscribe`回调的线程。

接着看`onNext`方法：

```java
@Override
public void onNext(T t) {
    // done标志位在onComplete以及onError中被设置为true
    if (done) {
        return;
    }
    // sourdeMode本例中为0，所以会将t加入到queue中
    if (sourceMode != QueueDisposable.ASYNC) {
        queue.offer(t);
    }
    schedule();
}
```

很明显，接着肯定是看`schedule`方法：

```java
void schedule() {
    // ObserveOnObserver类间接继承了AtomicInteger
    // 第一个执行该方法肯定返回0，执行后就自增为1了
    // 也就意味着worker.schedule(this)只会执行一次
    if (getAndIncrement() == 0) {
        worker.schedule(this);
    }
}
```

`Worker.schedule(Runnable run)`方法直接调用了重载方法`schedule(Runnable run, long delay, TimeUnit unit)`，后面的两个参数为`0L, TimeUnit.NANOSECONDS`，这就意味着立刻马上执行`run`。

#### 2.1.1 RxAndroid

由于这里的`worker`是`AndroidSchedulers.mainThread()`create出来的，所以这里就要解释RxAndroid这个库的代码了，该库总共就4个文件，其中两个文件比较重要：`HandlerScheduler`以及封装了该类的`AndroidSchedulers`。  
`AndroidSchedulers`提供了两个公有静态方法来切换线程：`mainThread()`指定主线程;`from(Looper looper)`指定别的线程。这两者都是通过创建`HandlerScheduler`时指定`Handle`的`Looper`来实现的，`AndroidSchedulers`代码如下：

```java
/** Android-specific Schedulers. */
public final class AndroidSchedulers {

    private static final class MainHolder {

        static final Scheduler DEFAULT = new HandlerScheduler(new Handler(Looper.getMainLooper()));
    }

    private static final Scheduler MAIN_THREAD = RxAndroidPlugins.initMainThreadScheduler(
            new Callable<Scheduler>() {
                @Override public Scheduler call() throws Exception {
                    return MainHolder.DEFAULT;
                }
            });

    /** A {@link Scheduler} which executes actions on the Android main thread. */
    public static Scheduler mainThread() {
        return RxAndroidPlugins.onMainThreadScheduler(MAIN_THREAD);
    }

    /** A {@link Scheduler} which executes actions on {@code looper}. */
    public static Scheduler from(Looper looper) {
        if (looper == null) throw new NullPointerException("looper == null");
        return new HandlerScheduler(new Handler(looper));
    }

    private AndroidSchedulers() {
        throw new AssertionError("No instances.");
    }
}
```

再说说另外一个关键文件`HandlerScheduler`，该类的作用就是将`Runnable`使用指定的`Handler`来执行。该类的两个公共方法：`scheduleDirect`方法直接执行`Runnable`；或者通过`createWorker()`创建一个`HandlerWorker`对象，稍后通过该对象的`schedule`方法执行`Runnable`。该文件比较简单，不做过多描述。

---

现在回到`ObserveOnObserver.schedule`方法中，这里调用了`worker.schedule(this)`方法。这里已经通过`HandlerScheduler`回到主线程了。  

接着看`ObserveOnObserver.run`方法。

```java
@Override
public void run() {
    if (outputFused) {
        drainFused();
    } else {
        drainNormal();
    }
}
```

由于`outputFused`在本例中为false（打断点可知），所以我们看看`drainNormal()`方法。

```java
void drainNormal() {
    int missed = 1;

    // queue在onSubscribe方法中被创建，且在onNext中放入了一个值
    final SimpleQueue<T> q = queue;
    // actual就是下游的observer
    final Observer<? super T> a = actual;

    for (;;) {
        if (checkTerminated(done, q.isEmpty(), a)) {
            return;
        }

        for (;;) {
            boolean d = done;
            T v;

            // 取值
            try {
                v = q.poll();
            } catch (Throwable ex) {
                Exceptions.throwIfFatal(ex);
                s.dispose();
                q.clear();
                a.onError(ex);
                worker.dispose();
                return;
            }
            boolean empty = v == null;

            if (checkTerminated(d, empty, a)) {
                return;
            }

            if (empty) {
                break;
            }

            // 调用下游observer的onNext方法
            a.onNext(v);
        }

        missed = addAndGet(-missed);
        if (missed == 0) {
            break;
        }
    }
}
```

在上面代码中在一些关键点写了一些注释，需要注意的是，调用该方法的`run`方法已经被切换到主线程中执行了，这样此方法也是在主线程中执行的。  

至此，`observeOn`工作原理已经解释完毕，我们已经知道了`observeOn`是如何决定了下游订阅发生的线程的：将Runnable抛给指定的线程池来执行，Runnable里面会调用下游observer的`onNext`方法。

下面看看`subscribeOn`。

### 2.2 subscribeOn

`subscribeOn`切换原理和`observeOn`非常相似。有了前面的铺垫，本小节会进行的非常快。  

在`Observable.subscribeOn`方法中，创建了一个`ObservableSubscribeOn`对象，我们看一下其`subscribeActual`方法：

```java
@Override
public void subscribeActual(final Observer<? super T> s) {
    // 将下游observer包装成为SubscribeOnObserver
    final SubscribeOnObserver<T> parent = new SubscribeOnObserver<T>(s);
    // 调用下游的onSubscribe方法
    s.onSubscribe(parent);
    // 1. SubscribeTask是一个Runnable对象，其run方法为：source.subscribe(parent)
    // 2. 调用scheduler.scheduleDirect开始执行Runnable
    parent.setDisposable(scheduler.scheduleDirect(new SubscribeTask(parent)));
}
```

和上面分析的`observeOn`类似，`scheduler.scheduleDirect`肯定起到一个线程切换的过程，线程切换之后就会执行`source.subscribe(parent)`。就这样`subscribe`会一直向上传递到数据发射的位置，发射数据的方法的线程自然也会发生改变。  

回过头来看一下`scheduler.scheduleDirect`干了些什么，这里的`scheduler`是`IoScheduler`，该方法是其基类`Scheduler`的方法：

```java
@NonNull
public Disposable scheduleDirect(@NonNull Runnable run) {
    return scheduleDirect(run, 0L, TimeUnit.NANOSECONDS);
}

@NonNull
public Disposable scheduleDirect(@NonNull Runnable run, long delay, @NonNull TimeUnit unit) {
    final Worker w = createWorker();

    final Runnable decoratedRun = RxJavaPlugins.onSchedule(run);
    // DisposeTask的run方法就是调用了decoratedRun的run方法
    DisposeTask task = new DisposeTask(decoratedRun, w);
    // w是IoScheduler创建的EventLoopWorker
    w.schedule(task, delay, unit);

    return task;
}
```

我们接着看一下`EventLoopWorker.schedule`方法：

```java
@NonNull
@Override
public Disposable schedule(@NonNull Runnable action, long delayTime, @NonNull TimeUnit unit) {
    if (tasks.isDisposed()) {
        // don't schedule, we are unsubscribed
        return EmptyDisposable.INSTANCE;
    }

    return threadWorker.scheduleActual(action, delayTime, unit, tasks);
}
```

这里的`threadWorker`实际上是一个`NewThreadWorker`，直接看`scheduleActual`方法：

```java
@NonNull
public ScheduledRunnable scheduleActual(final Runnable run, long delayTime, @NonNull TimeUnit unit, @Nullable DisposableContainer parent) {
    Runnable decoratedRun = RxJavaPlugins.onSchedule(run);
    // 就相当于一个Runnable
    ScheduledRunnable sr = new ScheduledRunnable(decoratedRun, parent);

    if (parent != null) {
        if (!parent.add(sr)) {
            return sr;
        }
    }

    Future<?> f;
    try {
        // 根据延迟时间执行这个runnable
        if (delayTime <= 0) {
            f = executor.submit((Callable<Object>)sr);
        } else {
            f = executor.schedule((Callable<Object>)sr, delayTime, unit);
        }
        sr.setFuture(f);
    } catch (RejectedExecutionException ex) {
        if (parent != null) {
            parent.remove(sr);
        }
        RxJavaPlugins.onError(ex);
    }

    return sr;
}
```

这样，开始的`SubscribeTask`就会在指定的io线程池中进行运行了。


**为什么`subscribeOn()`只有第一次切换有效？**  
因为RxJava最终能影响`ObservableOnSubscribe`这个匿名实现接口的运行环境的只能是最后一次`subscribe`操作，又因为RxJava订阅的时候是从下往上订阅，所以从上往下第一个`subscribeOn()`就是最后运行的。

举个例子：

```java
Observable.create(ObservableOnSubscribe<String> { emitter ->
    emitter.onNext("1")
    emitter.onNext("2")
    emitter.onComplete()
}).subscribeOn(Schedulers.io())
    .map(...)
    .subscribeOn(Schedulers.newThread())
    .observeOn(AndroidSchedulers.mainThread())
    .subscribe(...)
```

数据发射时所在的线程可以这样理解：

```java
// 伪代码
Thread("newThread()") {
    Thread("io()") {
        emitter.onNext("1")
        emitter.onNext("2")
        emitter.onComplete()
    }
}
```

### 2.3 线程切换小结

最后，线程切换特点可以从下图例子中体现出来：

<figure style="width: 50%" class="align-center">
    <img src="/assets/images/android/rxjava/rxjava_schedulers.png">
    <figcaption>RxJava线程转化关系图</figcaption>
</figure>

## 3. 使用实例

距离上面内容发布已经很久了，其实RxJava看起来很棒，各种文档看着似乎也很明白。但是刚接触的人还是不知道一个功能用RxJava怎么写。

这段时间我也用Rx写了一点功能，下面来点心得以及部分代码。

RxJava的使用，使用的前提就是这个功能需要在多个线程中切来切去，在这个前提下，步骤越多，RxJava就越好使。

### 3.1 剪切板检测关键词

这个需求需要从剪切板检测口令，下面是流程

1. 检查剪切板
2. 判断是否符合口令的规则，若不是，结束流程
3. 若是，清空剪切板
4. 调用口令解析的服务
5. 成功后，发送埋点，并解析数据，触发对应的跳转

可以看到，上面的流程比较繁琐，但是RxJava可以写的很优雅：

```kotlin
Maybe.create<String> { emitter ->
    // 在主线程中检查剪切板，否则可能会检测不到
    val clipboard = ClipboardUtils.getClipboardText(TingApplication.getAppContext())
    if (clipboard.isNullOrEmpty()) {
        emitter.onComplete()
    } else {
        emitter.onSuccess(clipboard.toString())
    }
}.subscribeOn(AndroidSchedulers.mainThread())
    // 剪切板是否符合规则，不符合的话不会调用onSuccess方法，所以下面的所有流程都不会走
    .filter { it.startsWith("Xm") }
    // 符合规则，则清空剪切板
    .doOnSuccess { ClipboardUtils.clearClipboard(TingApplication.getAppContext()) }  
    // 切换到IO线程，准备解析口令
    .observeOn(Schedulers.io())
    // 解析口令
    .map { contentService.getShareBackFlow(it) }
    // 解析口令成功后，发送数据埋点
    .doOnSuccess { sendDataTracking(it) }
    // 上面的都成功后，切换到主线程
    .observeOn(AndroidSchedulers.mainThread())
    // 从口令数据中解析出schema
    .map { getITingKidFromLink(it) }
    // 判断schema是否是客户端支持的schema
    .filter { SchemaController.isITingKid(it) }
    // 将schema回调到客户端进行处理
    .doOnSuccess(linkConsumer)
    .subscribe()
```

### 3.2 分享功能

在分享功能中

1. 微信分享的thumbData支持传入byte[]、drawable资源id以及url，后面两者需要我们自己加载一下数据，然后转换成byte[]格式
2. 图片分享时支持传入Bitmap，但考虑到Bitmap过大会导致分享失败，所以可以写入到本地文件，然后传路径即可

为了支持上面的这些功能，需要我们在分享的时候判断一下是否需要转换byte[]，是否需要写入Bitmap到本地文件。每次分享根据参数的不同，可能需要处理前者、后者或者两者。这时，RxJava也可以排上用场。

```java
private void realShareAfterModelHandled(String dest, int compressFlag) {
    List<Single<String>> singleList = new ArrayList<>();

    // thumbData是否需要转换成byte[]格式
    if ((compressFlag & COMPRESS_FLAG_NORMAL_COVER) != 0) {
        Single<String> thumbDataSingle = getBitmapFromUrlSingle(mShareModel.getThumbDataModel(), COMPRESS_FLAG_NORMAL_COVER)
                .doOnSuccess(bytes -> mShareModel.setThumbData(bytes))
                .observeOn(AndroidSchedulers.mainThread())
                .map(bytes -> TAG);
        singleList.add(thumbDataSingle);
    }
    // 小程序专用的thumbData是否需要转换成byte[]格式
    if ((compressFlag & COMPRESS_FLAG_BIG_COVER) != 0) {
        Single<String> bigThumbDataSingle = getBitmapFromUrlSingle(mShareModel.getBigThumbDataModel(), COMPRESS_FLAG_BIG_COVER)
                .doOnSuccess(bytes -> mShareModel.setBigThumbData(bytes))
                .observeOn(AndroidSchedulers.mainThread())
                .map(bytes -> TAG);
        singleList.add(bigThumbDataSingle);
    }
    // Bitmap是否需要写入本地文件
    if ((compressFlag & COMPRESS_FLAG_SHARE_BITMAP) != 0) {
        Single<String> shareBitmapSingle = getShareBitmapPathSingle()
                .doOnSuccess(success -> mBitmapShareFilePath = ShareFileManager.getShareFile().getAbsolutePath())
                .observeOn(AndroidSchedulers.mainThread())
                .map(bytes -> TAG);
        singleList.add(shareBitmapSingle);
    }

    // 将多个任务zip到一起，这样异步处理的loading框可以统一控制
    if (!singleList.isEmpty()) {
        Single.zip(singleList, strings -> strings)
            .subscribe(new SingleObserver<Object>() {
                @Override
                public void onSubscribe(Disposable d) {
                    if (mShareLoading != null) {
                        mShareLoading.showLoading();
                    }
                }

                @Override
                public void onSuccess(Object t) {
                    if (mShareLoading != null) {
                        mShareLoading.hideLoading();
                    }
                    realShare(dest);
                }

                @Override
                public void onError(Throwable e) {
                    e.printStackTrace();
                    if (mShareLoading != null) {
                        mShareLoading.hideLoading();
                    }
                    mActivity.showToast("分享失败，请稍后尝试！");
                }
            });
    } else {
        Logger.d(TAG, "resultSingle is null");
        mActivity.showToast("分享失败，请稍后尝试！");
    }
}

private Single<byte[]> getBitmapFromUrlSingle(Object model, int compressType) {
    return Single.create((SingleOnSubscribe<Bitmap>) emitter -> {
        GlideRequest<Bitmap> request = getGlideRequest(model);

        try {
            // 在IO线程，同步加载图片
            emitter.onSuccess(request.submit().get());
        } catch (Exception e) {
            emitter.onError(e);
        }
    }).subscribeOn(Schedulers.io())
            // 切换到CPU线程，执行CPU忙的操作
            .observeOn(Schedulers.computation())
            .map(bitmap -> {
                // 压缩图片，如果是小程序的图，控制在128kb以下，否则32kb
                if (compressType == COMPRESS_FLAG_BIG_COVER) {
                    return BitmapUtils.compressByQuality(bitmap, 128 * 1024, false);
                } else {
                    return BitmapUtils.bmpToByteArray(bitmap, 32);
                }
            });
}

private GlideRequest<Bitmap> getGlideRequest(Object model) {
    if ((model instanceof String) || (model instanceof Integer)) {
        return GlideApp.with(mActivity).asBitmap().load(model);
    } else {
        throw new IllegalArgumentException("model is neither a byte[], nor a String. Can't parse to a bitmap.");
    }
}

private Single<Boolean> getShareBitmapPathSingle() {
    return Single.create((SingleOnSubscribe<Boolean>) emitter -> {
        // 在IO线程，写入Bitmap到本地文件
        try {
            File shareFile = ShareFileManager.getShareFile();
            boolean success = BitmapUtils.writeBitmapToFile(mShareModel.getShareBitmapModel(), shareFile.getAbsolutePath());
            if (success) {
                emitter.onSuccess(true);
            } else {
                emitter.onError(new Throwable("write share image failed."));
            }
        } catch (Exception e) {
            emitter.onError(e);
        }
    }).subscribeOn(Schedulers.io());
}
```