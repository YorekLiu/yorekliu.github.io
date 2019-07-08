---
title: "Week12-OkHttp和Retrofit"
excerpt: "两个框架的作用、联系以及源码解读"
categories:
  - Android
tags:
  - 知识星球
  - Retrofit
  - OkHttp
  - Call
  - RealCall
  - Dispatcher
  - ExecutorService
  - CachedThreadPool
  - RetryAndFollowUpInterceptor
  - BridgeInterceptor
  - CacheInterceptor
  - ConnectInterceptor
  - CallServerInterceptor
  - RealInterceptorChain
  - interceptor
  - networkInterceptor
  - 责任链
  - CallAdapter
  - Converter
  - 反射
  - ServiceMethod
  - OkHttpCall
  - RxJava2CallAdapterFactory
  - RxJava2CallAdapter
  - GsonConverterFactory
  - GsonResponseBodyConverter
  - ParameterHandler
  - RxJava2
  - Request
  - 动态代理
header:
  teaser: /assets/images/android/okhttp_interceptors.png
  overlay_image: /assets/images/android/okhttp_interceptors.png
  overlay_filter: 0.5
toc: true
toc_label: "目录"
last_modified_at: 2019-03-08T12:23:00+08:00
---

## Question

介绍这两个框架的作用和联系

## Answer

OkHttp是由Square公司开发的一个处理网络请求的第三方库，用于替代`HttpUrlConnection`和Apache的`HttpClient`。  
它支持get请求和post请求，支持基于Http的文件上传和下载，支持缓存响应数据减少重复的网络请求，支持使用连接池以降低响应延迟问题（如果HTTP/2不可用）等。

> **关于HttpClient**:  
> [在 Android 6.0 中，我们取消了对 Apache HTTP 客户端的支持](https://developer.android.com/about/versions/marshmallow/android-6.0-changes#behavior-apache-http-client)。 从 Android 9 开始，默认情况下该内容库已从 bootclasspath 中移除且不可用于应用。  
> 要继续使用 Apache HTTP 客户端，以 Android 9 及更高版本为目标的应用可以向其 AndroidManifest.xml 添加以下内容：  
> `<uses-library android:name="org.apache.http.legacy" android:required="false"/>`  
> 注：拥有最低 SDK 版本 23 或更低版本的应用需要 android:required="false" 属性，因为在 API 级别低于 24 的设备上，org.apache.http.legacy库不可用。 （在这些设备上，Apache HTTP 类在 bootclasspath 中提供。）  
> 作为使用运行时 Apache 库的替代，应用可以在其 APK 中绑定自己的 org.apache.http 库版本。 如果进行此操作，您必须将该库重新打包（使用一个类似 Jar Jar 的实用程序）以避免运行时中提供的类存在类兼容性问题。

Retrofit也是Square公司开发的针对Android网络请求的框架，其实质是对OkHttp的封装，使用面向接口的方式进行网络请求，利用动态生成的代理类封装了网络接口。  
Retrofit使用注解描述HTTP请求，使网络接口集中在一起，简洁明了、方便管理。

## Read The Fucking Source Code

下面就是喜闻乐见的RTFSC环节，本文参考了以下资料

- [OKHttp源码解析](https://www.jianshu.com/p/27c1554b7fee)
- [Retrofit原理解析最简洁的思路](https://zhuanlan.zhihu.com/p/35121326)
- [Retrofit是如何工作的？](https://www.jianshu.com/p/cb3a7413b448)

### OkHttp3

首先介绍`OkHttp`部分，**代码基于[okhttp-3.8.0](https://github.com/square/okhttp/tree/parent-3.8.0)**

我们先看一下其`GET`请求的例子：

```java
public class GetExample {
  OkHttpClient client = new OkHttpClient();

  String run(String url) throws IOException {
    Request request = new Request.Builder()
        .url(url)
        .build();

    try (Response response = client.newCall(request).execute()) {
      return response.body().string();
    }
  }

  public static void main(String[] args) throws IOException {
    GetExample example = new GetExample();
    String response = example.run("https://raw.github.com/square/okhttp/master/README.md");
    System.out.println(response);
  }
}
```

#### OkHttpClient以及Request的构造器

先看看`OkHttpClient`的构造器：

```java
public OkHttpClient() {
  this(new Builder());
}

OkHttpClient(Builder builder) {
  this.dispatcher = builder.dispatcher;
  this.proxy = builder.proxy;
  this.protocols = builder.protocols;
  this.connectionSpecs = builder.connectionSpecs;
  this.interceptors = Util.immutableList(builder.interceptors);
  this.networkInterceptors = Util.immutableList(builder.networkInterceptors);
  this.eventListenerFactory = builder.eventListenerFactory;
  this.proxySelector = builder.proxySelector;
  this.cookieJar = builder.cookieJar;
  this.cache = builder.cache;
  this.internalCache = builder.internalCache;
  this.socketFactory = builder.socketFactory;

  boolean isTLS = false;
  for (ConnectionSpec spec : connectionSpecs) {
    isTLS = isTLS || spec.isTls();
  }

  if (builder.sslSocketFactory != null || !isTLS) {
    this.sslSocketFactory = builder.sslSocketFactory;
    this.certificateChainCleaner = builder.certificateChainCleaner;
  } else {
    X509TrustManager trustManager = systemDefaultTrustManager();
    this.sslSocketFactory = systemDefaultSslSocketFactory(trustManager);
    this.certificateChainCleaner = CertificateChainCleaner.get(trustManager);
  }

  this.hostnameVerifier = builder.hostnameVerifier;
  this.certificatePinner = builder.certificatePinner.withCertificateChainCleaner(
      certificateChainCleaner);
  this.proxyAuthenticator = builder.proxyAuthenticator;
  this.authenticator = builder.authenticator;
  this.connectionPool = builder.connectionPool;
  this.dns = builder.dns;
  this.followSslRedirects = builder.followSslRedirects;
  this.followRedirects = builder.followRedirects;
  this.retryOnConnectionFailure = builder.retryOnConnectionFailure;
  this.connectTimeout = builder.connectTimeout;
  this.readTimeout = builder.readTimeout;
  this.writeTimeout = builder.writeTimeout;
  this.pingInterval = builder.pingInterval;
}
```

构造器实现很简单，在默认构造器中传入了一个`OkHttpClient.Builder`建造者对象，然后将其中的参数复制给自己。  
在`OkHttpClient.Builder`的构造器中有很多默认的值，如下注释：

```java
public Builder() {
  dispatcher = new Dispatcher();    // 分发器，另有一个带线程池参数的构造器
  protocols = DEFAULT_PROTOCOLS;    // 支持的协议，默认为HTTP_2、HTTP_1_1
  connectionSpecs = DEFAULT_CONNECTION_SPECS;  // 传输层版本、连接协议
  // 事件监听器，3.8版本set方法还是package级别的，暂时不能设置
  eventListenerFactory = EventListener.factory(EventListener.NONE);
  proxySelector = ProxySelector.getDefault();   // 代理选择器
  cookieJar = CookieJar.NO_COOKIES;             // 读写Cookie的容器
  socketFactory = SocketFactory.getDefault();   // Socket工厂
  hostnameVerifier = OkHostnameVerifier.INSTANCE;// 主机名验证器
  certificatePinner = CertificatePinner.DEFAULT;
  proxyAuthenticator = Authenticator.NONE;      // 代理认证器
  authenticator = Authenticator.NONE;           // 本地认证器
  connectionPool = new ConnectionPool();        // 连接池
  dns = Dns.SYSTEM;                             // 域名
  followSslRedirects = true;                    // SSL重定向
  followRedirects = true;                       // 普通重定向
  retryOnConnectionFailure = true;              // 连接失败重试
  connectTimeout = 10_000;                      // 连接超时时间
  readTimeout = 10_000;                         // 读超时时间
  writeTimeout = 10_000;                        // 写超时时间
  pingInterval = 0;
}
```

上面各种属性都从名字大致可以知道是干啥用的。  
此外，`Request`的构造也很简单：

```java
final HttpUrl url;                // 请求的url
final String method;              // 请求方式
final Headers headers;            // 请求头
final @Nullable RequestBody body; // 请求体
final Object tag;                 // 请求的tag
```

#### Call & RealCall

我们接着看`client.newCall(request).execute()`这一行代码。  
首先是`OkHttpCient.newCall(Request)`方法：

```java
/**
  * Prepares the {@code request} to be executed at some point in the future.
  */
@Override public Call newCall(Request request) {
  return new RealCall(this, request, false /* for web socket */);
}
```

这里创建了一个`RealCall`对象，而`RealCall`实现了`Call`接口。`Call`接口声明如下：

```java
public interface Call extends Cloneable {
  /** 获得原始请求 */
  Request request();

  /** 同步执行请求 */
  Response execute() throws IOException;

  /** 异步执行请求 */
  void enqueue(Callback responseCallback);

  /** 尽可能取消请求。已经完成了的请求不能被取消 */
  void cancel();

  /**
   * 调用了execute()或者enqueue(Callback)后都是true
   */
  boolean isExecuted();

  boolean isCanceled();

  /** 创建一个新的、完全一样的Call对象，即使原对象状态为enqueued或者executed */
  Call clone();

  interface Factory {
    Call newCall(Request request);
  }
}
```

回到`RealCall`，看看其的构造器以及成员变量：

```java
final OkHttpClient client;
final RetryAndFollowUpInterceptor retryAndFollowUpInterceptor;
final EventListener eventListener;

/** The application's original request unadulterated by redirects or auth headers. */
final Request originalRequest;
final boolean forWebSocket;

// Guarded by this.
private boolean executed;

RealCall(OkHttpClient client, Request originalRequest, boolean forWebSocket) {
  // 事件监听器，默认为null，目前3.8版本也无法设置
  final EventListener.Factory eventListenerFactory = client.eventListenerFactory();

  this.client = client;
  this.originalRequest = originalRequest;
  this.forWebSocket = forWebSocket;
  // 创建一个重试、重定向拦截器
  this.retryAndFollowUpInterceptor = new RetryAndFollowUpInterceptor(client, forWebSocket);

  // TODO(jwilson): this is unsafe publication and not threadsafe.
  this.eventListener = eventListenerFactory.create(this);
}
```

#### RealCall.execute

接着看看重点`RealCall.execute`方法：

```java
@Override public Response execute() throws IOException {
  synchronized (this) {
    if (executed) throw new IllegalStateException("Already Executed");
    executed = true;
  }
  captureCallStackTrace();
  try {
    client.dispatcher().executed(this);
    Response result = getResponseWithInterceptorChain();
    if (result == null) throw new IOException("Canceled");
    return result;
  } finally {
    client.dispatcher().finished(this);
  }
}
```

在上面的方法中我们可以到，一旦`Call.execute`方法被执行，那么其`executed`就会被设置为`true`，如果多次调用就会报错。  
然后调用`client.dispatcher().executed(this);`，该方法就是将call加入到`Dispatcher.runningSyncCalls`队列中，没有其他多余的代码：

```java
/** Used by {@code Call#execute} to signal it is in-flight. */
synchronized void executed(RealCall call) {
  runningSyncCalls.add(call);
}
```

接着调用`getResponseWithInterceptorChain`进行网络请求并获取Response，该方法是`OkHttp`中的最重要的点，我们稍后在介绍`RealCall.enqueue`方法时再一起说。  
紧接着就是finally代码块里面的`client.dispatcher().finished(this)`。该方法也很简单，就是`Call`执行完毕后将其从`Dispatcher.runningSyncCalls`队列中移除，见下面的代码；同时，如果`promoteCalls`为true（此处入参false），还会执行`promoteCalls`方法，此方法为异步调用服务，具体代码后面会谈到；最后如果`runningAsyncCalls`、`runningSyncCalls`这俩正在执行的同步、异步队列之和为0，说明dispatcher处理空闲状态，那么调用`idleCallback.run`通知外界dispatcher已经空闲了，*该方法目前仅在测试方法中发现*。

```java
/** Used by {@code Call#execute} to signal completion. */
void finished(RealCall call) {
  finished(runningSyncCalls, call, false);
}

private <T> void finished(Deque<T> calls, T call, boolean promoteCalls) {
  int runningCallsCount;
  Runnable idleCallback;
  synchronized (this) {
    if (!calls.remove(call)) throw new AssertionError("Call wasn't in-flight!");
    if (promoteCalls) promoteCalls();
    runningCallsCount = runningCallsCount();
    idleCallback = this.idleCallback;
  }

  if (runningCallsCount == 0 && idleCallback != null) {
    idleCallback.run();
  }
}
```

#### RealCall.enqueue

顺便也说一下`RealCall.enqueue`的方法。  
同`execute`方法类似，一旦`Call.enqueue`方法被执行，那么其`executed`就会被设置为`true`，如果多次调用就会报错。  
然后调用`client.dispatcher().enqueue(new AsyncCall(responseCallback));`方法开始了异步调用。

```java
@Override public void enqueue(Callback responseCallback) {
  synchronized (this) {
    if (executed) throw new IllegalStateException("Already Executed");
    executed = true;
  }
  captureCallStackTrace();
  client.dispatcher().enqueue(new AsyncCall(responseCallback));
}
```

这里先看一下`AsyncCall`的相关代码，`execute`方法具体代码下面再说：

```java
final class AsyncCall extends NamedRunnable {
  private final Callback responseCallback;

  AsyncCall(Callback responseCallback) {
    super("OkHttp %s", redactedUrl());
    this.responseCallback = responseCallback;
  }
  ...
  @Override protected void execute() {
    ...
  }
}
```

`AsyncCall`的父类`NamedRunnable`是一个有`name`属性的`Runnable`抽象类，在执行代码前，会将当前线程名设置为`name`，执行完毕后恢复。

```java
/**
 * Runnable implementation which always sets its thread name.
 */
public abstract class NamedRunnable implements Runnable {
  protected final String name;

  public NamedRunnable(String format, Object... args) {
    this.name = Util.format(format, args);
  }

  @Override public final void run() {
    String oldName = Thread.currentThread().getName();
    Thread.currentThread().setName(name);
    try {
      execute();
    } finally {
      Thread.currentThread().setName(oldName);
    }
  }

  protected abstract void execute();
}
```

在了解了`AsyncCall`的大致结构，我们返回`Dispatcher.enqueue`方法：

```java
private int maxRequests = 64;
private int maxRequestsPerHost = 5;

synchronized void enqueue(AsyncCall call) {
  if (runningAsyncCalls.size() < maxRequests && runningCallsForHost(call) < maxRequestsPerHost) {
    runningAsyncCalls.add(call);
    executorService().execute(call);
  } else {
    readyAsyncCalls.add(call);
  }
}
```

`maxRequests`和`maxRequestsPerHost`都有默认值，且有setter方法可以设置具体值，两者的setter方法最后会执行`promoteCalls`方法尝试执行异步任务。  
在`enqueue`方法中，首先会检查「正在运行的异步请求数」以及「call对应的host上的异步请求数」是否达到了阈值。如果还没有达到阈值，那么加入到`runningAsyncCalls`队列中，同时开始执行请求；否则加入到`readyAsyncCalls`队列中进行等待。

这里出现了一个`executorService()`，这是一个单例实现的线程池，该线程池也可以在`Dispatcher`的构造器中注入。  

```java
/** Executes calls. Created lazily. */
private @Nullable ExecutorService executorService;

public Dispatcher(ExecutorService executorService) {
  this.executorService = executorService;
}

public synchronized ExecutorService executorService() {
  if (executorService == null) {
    executorService = new ThreadPoolExecutor(0, Integer.MAX_VALUE, 60, TimeUnit.SECONDS,
        new SynchronousQueue<Runnable>(), Util.threadFactory("OkHttp Dispatcher", false));
  }
  return executorService;
}
```

这里我们可以看出来，这是一个典型的`CachedThreadPool`。  
这是一个线程数量不定的线程池，他只有非核心线程，并且其最大线程数为`Integer.MAX_VALUE`。线程池中的空闲线程都有超时机制，这个超时时常为60s，超过这个时间的闲置线程就会被回收。`CachedThreadPool`的任务队列可以简单的理解为一个无法存储元素的队列，因此这将导致任何任务都会立刻执行。  
从其特性来看，这类线程池适合执行大量耗时较少的任务。当整个线程池处理闲置状态时，线程池中的线程都会因为超时而被停止，这个时候`CachedThreadPool`之中实际上是没有线程的，它几乎不占用任何系统资源。  
关于线程池的更多知识，可以参考[Android中的线程池](/android/Android线程与线程池/#3--android中的线程池)
{: .notice--info }

提交到线程池后，`AsyncCall.run`方法就会被调用，又因为`AsyncCall`继承了`NamedRunnable`，所以最后执行的是`AsyncCall.execute`方法：

```java
@Override protected void execute() {
  boolean signalledCallback = false;
  try {
    Response response = getResponseWithInterceptorChain();
    if (retryAndFollowUpInterceptor.isCanceled()) {
      signalledCallback = true;
      responseCallback.onFailure(RealCall.this, new IOException("Canceled"));
    } else {
      signalledCallback = true;
      responseCallback.onResponse(RealCall.this, response);
    }
  } catch (IOException e) {
    if (signalledCallback) {
      // Do not signal the callback twice!
      Platform.get().log(INFO, "Callback failure for " + toLoggableString(), e);
    } else {
      responseCallback.onFailure(RealCall.this, e);
    }
  } finally {
    client.dispatcher().finished(this);
  }
}
```

首先调用`getResponseWithInterceptorChain`进行网络请求并获取Response，然后根据请求是否被取消，调用对应的回调方法。最后调用`client.dispatcher().finished(this)`方法在`runningAsyncCalls`方法中移除call，并尝试执行其他的异步方法。  

我们先看`client.dispatcher().finished(this)`方法，最后再看`getResponseWithInterceptorChain`方法的实现：

```java
/** Used by {@code AsyncCall#run} to signal completion. */
void finished(AsyncCall call) {
  finished(runningAsyncCalls, call, true);
}

private <T> void finished(Deque<T> calls, T call, boolean promoteCalls) {
  int runningCallsCount;
  Runnable idleCallback;
  synchronized (this) {
    if (!calls.remove(call)) throw new AssertionError("Call wasn't in-flight!");
    if (promoteCalls) promoteCalls();
    runningCallsCount = runningCallsCount();
    idleCallback = this.idleCallback;
  }

  if (runningCallsCount == 0 && idleCallback != null) {
    idleCallback.run();
  }
}

private void promoteCalls() {
  if (runningAsyncCalls.size() >= maxRequests) return; // Already running max capacity.
  if (readyAsyncCalls.isEmpty()) return; // No ready calls to promote.

  for (Iterator<AsyncCall> i = readyAsyncCalls.iterator(); i.hasNext(); ) {
    AsyncCall call = i.next();

    if (runningCallsForHost(call) < maxRequestsPerHost) {
      i.remove();
      runningAsyncCalls.add(call);
      executorService().execute(call);
    }

    if (runningAsyncCalls.size() >= maxRequests) return; // Reached max capacity.
  }
}
```

两个`finished`方法不用多说；`promoteCalls`方法的代码也很清晰明了，这是一个将等待队列中的任务移到`runningAsyncCalls`且执行的过程。  

#### getResponseWithInterceptorChain

最后，终于来到了`getResponseWithInterceptorChain`方法，如下所示。

```java
Response getResponseWithInterceptorChain() throws IOException {
  // Build a full stack of interceptors.
  List<Interceptor> interceptors = new ArrayList<>();
  interceptors.addAll(client.interceptors());
  interceptors.add(retryAndFollowUpInterceptor);
  interceptors.add(new BridgeInterceptor(client.cookieJar()));
  interceptors.add(new CacheInterceptor(client.internalCache()));
  interceptors.add(new ConnectInterceptor(client));
  if (!forWebSocket) {
    interceptors.addAll(client.networkInterceptors());
  }
  interceptors.add(new CallServerInterceptor(forWebSocket));

  Interceptor.Chain chain = new RealInterceptorChain(
      interceptors, null, null, null, 0, originalRequest);
  return chain.proceed(originalRequest);
}
```

首先将以下拦截器依次加入到List中：

1. OkHttpClient设置的拦截器`interceptors()`
2. 重试、重定向拦截器`RetryAndFollowUpInterceptor`
3. 把用户请求转换为服务器请求、把服务器返响应转换为用户响应的`BridgeInterceptor`
4. 读取缓存直接返回、将响应写入到缓存中的`CacheInterceptor`
5. 与服务器建立连接的`ConnectInterceptor`
6. OkHttpClient设置的网络拦截器`networkInterceptors()`
7. 真正执行网络请求的`CallServerInterceptor`

将所有的拦截器保存在`interceptors`后，创建一个拦截器责任链`RealInterceptorChain`，并调用其`proceed`开始处理网络请求。

责任链模式的实例可以参考：[责任链模式(Chain of responsibility)](http://127.0.0.1:4000/design%20patterns/chain-of-responsibility/)
{: .notice--info }

**下面解释一下责任链模式是如何表现出来的？**  

首先看上面创建`RealInterceptorChain`的方法以及`RealInterceptorChain`的代码：

```java
// RealCall.java
Interceptor.Chain chain = new RealInterceptorChain(
    interceptors, null, null, null, 0, originalRequest);
return chain.proceed(originalRequest);

// RealInterceptorChain.java
public final class RealInterceptorChain implements Interceptor.Chain {
  private final List<Interceptor> interceptors;
  ...
  private final int index;
  private final Request request;

  public RealInterceptorChain(List<Interceptor> interceptors, StreamAllocation streamAllocation,
      HttpCodec httpCodec, RealConnection connection, int index, Request request) {
    this.interceptors = interceptors;
    ...
    this.index = index;
    this.request = request;
  }
  ...
  @Override public Response proceed(Request request) throws IOException {
    return proceed(request, streamAllocation, httpCodec, connection);
  }

  public Response proceed(Request request, StreamAllocation streamAllocation, HttpCodec httpCodec,
      RealConnection connection) throws IOException {
    if (index >= interceptors.size()) throw new AssertionError();
    ...
    // Call the next interceptor in the chain.
    RealInterceptorChain next = new RealInterceptorChain(
        interceptors, streamAllocation, httpCodec, connection, index + 1, request);
    Interceptor interceptor = interceptors.get(index);
    Response response = interceptor.intercept(next);
    ...
    return response;
  }
}
```

在不考虑`OkHttpClient.interceptor()`的情况下，上面这段代码的解释如下：

1. 在`getResponseWithInterceptorChain`创建了一个`index`为0的`RealInterceptorChain`（下称链），接着就调用了其`proceed`方法
2. 在`RealInterceptorChain.proceed`方法中：`index=0`
  - 创建了一个`index`为index+1的链`next`
  - 然后对当前`index`的拦截器（即`RetryAndFollowUpInterceptor`）执行`interceptor.intercept(next)`。  
  在`RetryAndFollowUpInterceptor`方法中执行了`chain.proceed`方法，而这里的`chain`是`RealInterceptorChain`实例，所以回到了`RealInterceptorChain.proceed`方法中
3. 此时`index=1`,同理链条可以一直执行下去；index=2..n-1
4. 直到遇到最后一个拦截器`CallServerInterceptor`，因此这是最后一个拦截器了，因此链肯定不能继续下去，不然就报错了`if (index >= interceptors.size()) throw new AssertionError();`，而且在`CallServerInterceptor.intercept`方法中也所搜不到`proceed`关键字。  
  又因为这是最后一个拦截器，所以肯定是负责和服务器建立实际通讯的。
5. Response的返回与Request相反，会从最后一个开始依次往前经过这些`Intercetor`

下图为OkHttp工作的大致流程，参考至[拆轮子系列：拆 OkHttp](https://blog.piasy.com/2016/07/11/Understand-OkHttp/index.html)
<figure style="width: 66%" class="align-center">
    <img src="/assets/images/android/okhttp_overview.jpg">
    <figcaption>OkHttp总体工作流程</figcaption>
</figure>

接下来，我们看一下各个拦截器具体的代码。

#### RetryAndFollowUpInterceptor

*This interceptor recovers from failures and follows redirects as necessary*.  

*How many redirects and auth challenges should we attempt? Chrome follows 21 redirects; Firefox, curl, and wget follow 20; Safari follows 16; and HTTP/1.0 recommends 5*.

```java
@Override public Response intercept(Chain chain) throws IOException {
  Request request = chain.request();

  streamAllocation = new StreamAllocation(
      client.connectionPool(), createAddress(request.url()), callStackTrace);

  int followUpCount = 0;
  Response priorResponse = null;
  while (true) {
    if (canceled) {
      streamAllocation.release();
      throw new IOException("Canceled");
    }

    Response response = null;
    boolean releaseConnection = true;
    try {
      response = ((RealInterceptorChain) chain).proceed(request, streamAllocation, null, null);
      releaseConnection = false;
    } catch (RouteException e) {
      // The attempt to connect via a route failed. The request will not have been sent.
      if (!recover(e.getLastConnectException(), false, request)) {
        throw e.getLastConnectException();
      }
      releaseConnection = false;
      continue;
    } catch (IOException e) {
      // An attempt to communicate with a server failed. The request may have been sent.
      boolean requestSendStarted = !(e instanceof ConnectionShutdownException);
      if (!recover(e, requestSendStarted, request)) throw e;
      releaseConnection = false;
      continue;
    } finally {
      // We're throwing an unchecked exception. Release any resources.
      if (releaseConnection) {
        streamAllocation.streamFailed(null);
        streamAllocation.release();
      }
    }

    // Attach the prior response if it exists. Such responses never have a body.
    if (priorResponse != null) {
      response = response.newBuilder()
          .priorResponse(priorResponse.newBuilder()
                  .body(null)
                  .build())
          .build();
    }

    Request followUp = followUpRequest(response);

    if (followUp == null) {
      if (!forWebSocket) {
        streamAllocation.release();
      }
      return response;
    }

    closeQuietly(response.body());

    if (++followUpCount > MAX_FOLLOW_UPS) {
      streamAllocation.release();
      throw new ProtocolException("Too many follow-up requests: " + followUpCount);
    }

    if (followUp.body() instanceof UnrepeatableRequestBody) {
      streamAllocation.release();
      throw new HttpRetryException("Cannot retry streamed HTTP body", response.code());
    }

    if (!sameConnection(response, followUp.url())) {
      streamAllocation.release();
      streamAllocation = new StreamAllocation(
          client.connectionPool(), createAddress(followUp.url()), callStackTrace);
    } else if (streamAllocation.codec() != null) {
      throw new IllegalStateException("Closing the body of " + response
          + " didn't close its backing stream. Bad interceptor?");
    }

    request = followUp;
    priorResponse = response;
  }
}
```

上面这些代码比较简单

1. 首先正常进行请求，如果遇到了异常，根据情况看是否可以恢复：若不能恢复，则抛出异常，结束请求；若正常请求成功，那么在finally块中释放资源
2. 如果请求是重试后的请求，那么将重试前请求的响应体设置为null并加到当前响应体`priorResponse`字段中
3. 根据Response的响应码判断是否需要重试：否不需要，则返回respone；若需要，则会检查重试次数是否达到阈值、是否可以继续重试
4. 继续执行while循环，返回步骤1

这里需要注意的是，在调用`chain.proceed`方法时，将创建好的`StreamAllocation`对象作为参数传入了`proceed`方法，所以之后的`RealInterceptorChain.streamAllocation`就可以使用了。

```java
streamAllocation = new StreamAllocation(
    client.connectionPool(), createAddress(request.url()), callStackTrace);
response = ((RealInterceptorChain) chain).proceed(request, streamAllocation, null, null);
```

#### BridgeInterceptor

*Bridges from application code to network code. First it builds a network request from a user request. Then it proceeds to call the network. Finally it builds a user response from the network response*.

直接上代码：

```java
@Override public Response intercept(Chain chain) throws IOException {
  Request userRequest = chain.request();
  Request.Builder requestBuilder = userRequest.newBuilder();

  RequestBody body = userRequest.body();
  if (body != null) {
    MediaType contentType = body.contentType();
    if (contentType != null) {
      requestBuilder.header("Content-Type", contentType.toString());
    }

    long contentLength = body.contentLength();
    if (contentLength != -1) {
      requestBuilder.header("Content-Length", Long.toString(contentLength));
      requestBuilder.removeHeader("Transfer-Encoding");
    } else {
      requestBuilder.header("Transfer-Encoding", "chunked");
      requestBuilder.removeHeader("Content-Length");
    }
  }

  if (userRequest.header("Host") == null) {
    requestBuilder.header("Host", hostHeader(userRequest.url(), false));
  }

  if (userRequest.header("Connection") == null) {
    requestBuilder.header("Connection", "Keep-Alive");
  }

  // If we add an "Accept-Encoding: gzip" header field we're responsible for also decompressing
  // the transfer stream.
  boolean transparentGzip = false;
  if (userRequest.header("Accept-Encoding") == null && userRequest.header("Range") == null) {
    transparentGzip = true;
    requestBuilder.header("Accept-Encoding", "gzip");
  }

  List<Cookie> cookies = cookieJar.loadForRequest(userRequest.url());
  if (!cookies.isEmpty()) {
    requestBuilder.header("Cookie", cookieHeader(cookies));
  }

  if (userRequest.header("User-Agent") == null) {
    requestBuilder.header("User-Agent", Version.userAgent());
  }

  Response networkResponse = chain.proceed(requestBuilder.build());

  HttpHeaders.receiveHeaders(cookieJar, userRequest.url(), networkResponse.headers());

  Response.Builder responseBuilder = networkResponse.newBuilder()
      .request(userRequest);

  if (transparentGzip
      && "gzip".equalsIgnoreCase(networkResponse.header("Content-Encoding"))
      && HttpHeaders.hasBody(networkResponse)) {
    GzipSource responseBody = new GzipSource(networkResponse.body().source());
    Headers strippedHeaders = networkResponse.headers().newBuilder()
        .removeAll("Content-Encoding")
        .removeAll("Content-Length")
        .build();
    responseBuilder.headers(strippedHeaders);
    responseBuilder.body(new RealResponseBody(strippedHeaders, Okio.buffer(responseBody)));
  }

  return responseBuilder.build();
}
```

上面代码总体来说干了两件事：
1. 对原始的Request进行检查，设置`Content-Type`、`Content-Length`、`Transfer-Encoding`、`Host`、`Connection`、`Accept-Encoding`、`Cookie`、`User-Agent`这些header
2. 进行网络请求。若是gzip编码，则对响应进行Gzip处理；否则直接返回

在上面的过程中，用到了`CookieJar`的实例。  
在请求前，会调用下面的方法读取url的Cookie：

```java
List<Cookie> cookies = cookieJar.loadForRequest(userRequest.url());
if (!cookies.isEmpty()) {
  requestBuilder.header("Cookie", cookieHeader(cookies));
}
```

`cookieHeader`就是将cookies里面的键值对拼接成一个字符串`k1=v1; k2=v2`，其实现如下：

```java
/** Returns a 'Cookie' HTTP request header with all cookies, like {@code a=b; c=d}. */
private String cookieHeader(List<Cookie> cookies) {
  StringBuilder cookieHeader = new StringBuilder();
  for (int i = 0, size = cookies.size(); i < size; i++) {
    if (i > 0) {
      cookieHeader.append("; ");
    }
    Cookie cookie = cookies.get(i);
    cookieHeader.append(cookie.name()).append('=').append(cookie.value());
  }
  return cookieHeader.toString();
}
```

收到响应后，会调用下面的方法存储url的Cookie：

```java
HttpHeaders.receiveHeaders(cookieJar, userRequest.url(), networkResponse.headers());
```

`HttpHeaders.receiveHeaders`实现如下：

```java
// HttpHeaders.java
public static void receiveHeaders(CookieJar cookieJar, HttpUrl url, Headers headers) {
  if (cookieJar == CookieJar.NO_COOKIES) return;

  List<Cookie> cookies = Cookie.parseAll(url, headers);
  if (cookies.isEmpty()) return;

  cookieJar.saveFromResponse(url, cookies);
}

// Cookie.java
/** Returns all of the cookies from a set of HTTP response headers. */
public static List<Cookie> parseAll(HttpUrl url, Headers headers) {
  List<String> cookieStrings = headers.values("Set-Cookie");
  List<Cookie> cookies = null;

  for (int i = 0, size = cookieStrings.size(); i < size; i++) {
    Cookie cookie = Cookie.parse(url, cookieStrings.get(i));
    if (cookie == null) continue;
    if (cookies == null) cookies = new ArrayList<>();
    cookies.add(cookie);
  }

  return cookies != null
      ? Collections.unmodifiableList(cookies)
      : Collections.<Cookie>emptyList();
}
```

`Cookie.parse`的实现比较复杂，我们只需要这是将每一个`Set-Cookie`的值取出来，然后解析成为一个个`Cookie`对象即可。  

**所以，使用OkHttp的Cookie功能时，自定义一个CookieJar就好了，不需要新增拦截器专门处理Cookie问题。**

#### CacheInterceptor

*Serves requests from the cache and writes responses to the cache*.

首先需要注意的是，OkHttp中的Cache策略采用的是`DiskLruCache`，关于`DiskLruCache`可以参考[DiskLruCache](/android/Bitmap的缓存与加载/#22-disklrucache)。  
直接上代码：
```java
@Override public Response intercept(Chain chain) throws IOException {
  // 根据是否设置了缓存以及网络请求，得到一个候选缓存
  Response cacheCandidate = cache != null
      ? cache.get(chain.request())
      : null;

  long now = System.currentTimeMillis();

  // 根据当前时间、请求对象以及候选缓存，获取缓存策略
  // 在缓存策略中，有两个重要的对象
  // networkRequest: 网络请求，若为null表示不使用网络
  // cacheResponse: 响应缓存，若为null表示不使用缓存
  CacheStrategy strategy = new CacheStrategy.Factory(now, chain.request(), cacheCandidate).get();
  Request networkRequest = strategy.networkRequest;
  Response cacheResponse = strategy.cacheResponse;

  if (cache != null) {
    cache.trackResponse(strategy);
  }

  // 如果有候选缓存但是没有响应缓存，说明候选缓存不可用
  // 关闭它，以免内存泄漏
  if (cacheCandidate != null && cacheResponse == null) {
    closeQuietly(cacheCandidate.body()); // The cache candidate wasn't applicable. Close it.
  }

  // If we're forbidden from using the network and the cache is insufficient, fail.
  // 如果网络请求和响应缓存都为null，那就没法子了
  if (networkRequest == null && cacheResponse == null) {
    return new Response.Builder()
        .request(chain.request())
        .protocol(Protocol.HTTP_1_1)
        .code(504)
        .message("Unsatisfiable Request (only-if-cached)")
        .body(Util.EMPTY_RESPONSE)
        .sentRequestAtMillis(-1L)
        .receivedResponseAtMillis(System.currentTimeMillis())
        .build();
  }

  // If we don't need the network, we're done.
  // 不需要网络请求，那么直接走缓存返回
  if (networkRequest == null) {
    return cacheResponse.newBuilder()
        .cacheResponse(stripBody(cacheResponse))
        .build();
  }

  // 没有缓存命中，则进行网络请求
  Response networkResponse = null;
  try {
    networkResponse = chain.proceed(networkRequest);
  } finally {
    // If we're crashing on I/O or otherwise, don't leak the cache body.
    if (networkResponse == null && cacheCandidate != null) {
      closeQuietly(cacheCandidate.body());
    }
  }

  // If we have a cache response too, then we're doing a conditional get.
  // 如果缓存策略中，网络请求和响应缓存都不为null，需要更新响应缓存
  if (cacheResponse != null) {
    if (networkResponse.code() == HTTP_NOT_MODIFIED) {
      Response response = cacheResponse.newBuilder()
          .headers(combine(cacheResponse.headers(), networkResponse.headers()))
          .sentRequestAtMillis(networkResponse.sentRequestAtMillis())
          .receivedResponseAtMillis(networkResponse.receivedResponseAtMillis())
          .cacheResponse(stripBody(cacheResponse))
          .networkResponse(stripBody(networkResponse))
          .build();
      networkResponse.body().close();

      // Update the cache after combining headers but before stripping the
      // Content-Encoding header (as performed by initContentStream()).
      cache.trackConditionalCacheHit();
      cache.update(cacheResponse, response);
      return response;
    } else {
      closeQuietly(cacheResponse.body());
    }
  }

  // 构建响应对象，等待返回
  Response response = networkResponse.newBuilder()
      .cacheResponse(stripBody(cacheResponse))
      .networkResponse(stripBody(networkResponse))
      .build();

  if (cache != null) {
    if (HttpHeaders.hasBody(response) && CacheStrategy.isCacheable(response, networkRequest)) {
      // 将请求放到缓存中
      // Offer this request to the cache.
      CacheRequest cacheRequest = cache.put(response);
      return cacheWritingResponse(cacheRequest, response);
    }

    // 如果请求不能被缓存，则移除该请求
    if (HttpMethod.invalidatesCache(networkRequest.method())) {
      try {
        cache.remove(networkRequest);
      } catch (IOException ignored) {
        // The cache cannot be written.
      }
    }
  }

  return response;
}
```

#### ConnectInterceptor

*Opens a connection to the target server and proceeds to the next interceptor*.

```java
@Override public Response intercept(Chain chain) throws IOException {
  RealInterceptorChain realChain = (RealInterceptorChain) chain;
  Request request = realChain.request();
  StreamAllocation streamAllocation = realChain.streamAllocation();

  // We need the network to satisfy this request. Possibly for validating a conditional GET.
  boolean doExtensiveHealthChecks = !request.method().equals("GET");
  HttpCodec httpCodec = streamAllocation.newStream(client, doExtensiveHealthChecks);
  RealConnection connection = streamAllocation.connection();

  return realChain.proceed(request, streamAllocation, httpCodec, connection);
}
```

上面的代码只有几行，其作用注释也说的很清楚了：与服务器建立连接，然后传递到下一个拦截器。  

其中`StreamAllocation`是一个重点，它是`Connections`、`Streams`、`Calls`三者的一个纽带，此类的实例使用一个或多个connections上的一个或多个stream来执行call。

- **Connections:** 连接到远程服务器的物理的socket。connections可能建立很慢，因此必须能够取消当前已经连接上的connection。
- **Streams:** 位于Connections上的逻辑上的HTTP请求、响应对。每个connection都有自己的allocation limit，这决定了connection可以承载多少可以并发的stream。HTTP/1.x connections一次可以承载1个流，HTTP/2通常可以承载多个。
- **Calls:** streams的逻辑序列，通常是初始请求及其后续请求。我们希望将单个call的所有streams保持在同一个connection上，以获得更好的表现。

`streamAllocation.newStream`方法就是打开连接的关键，看看到底怎么操作的：

```java
public HttpCodec newStream(OkHttpClient client, boolean doExtensiveHealthChecks) {
  int connectTimeout = client.connectTimeoutMillis();
  int readTimeout = client.readTimeoutMillis();
  int writeTimeout = client.writeTimeoutMillis();
  boolean connectionRetryEnabled = client.retryOnConnectionFailure();

  try {
    RealConnection resultConnection = findHealthyConnection(connectTimeout, readTimeout,
        writeTimeout, connectionRetryEnabled, doExtensiveHealthChecks);
    HttpCodec resultCodec = resultConnection.newCodec(client, this);

    synchronized (connectionPool) {
      codec = resultCodec;
      return resultCodec;
    }
  } catch (IOException e) {
    throw new RouteException(e);
  }
}
```

该方法有两处要点，第一处就是调用`findHealthyConnection`得到一个可用的connection，第二处就是调用`resultConnection.newCodec`得到一个对HTTP请求进行编码、HTTP响应进行解码的`HttpCodec`。

先看跟踪`findHealthyConnection`方法，该方法会调用`findConnection`得到一个connection，然后对其调用`isHealth(true)`方法进行健康诊断。如果健康，那么就可以返回该connection了；否则，从连接池中移除，并继续while循环。

```java
/**
  * Finds a connection and returns it if it is healthy. If it is unhealthy the process is repeated
  * until a healthy connection is found.
  */
private RealConnection findHealthyConnection(int connectTimeout, int readTimeout,
    int writeTimeout, boolean connectionRetryEnabled, boolean doExtensiveHealthChecks)
    throws IOException {
  while (true) {
    RealConnection candidate = findConnection(connectTimeout, readTimeout, writeTimeout,
        connectionRetryEnabled);

    // If this is a brand new connection, we can skip the extensive health checks.
    synchronized (connectionPool) {
      if (candidate.successCount == 0) {
        return candidate;
      }
    }

    // Do a (potentially slow) check to confirm that the pooled connection is still good. If it
    // isn't, take it out of the pool and start again.
    if (!candidate.isHealthy(doExtensiveHealthChecks)) {
      noNewStreams();
      continue;
    }

    return candidate;
  }
}
```

在`findConnection`方法中，会先看已经存在的connection，然后再看连接池，最后都没有就创建新的connection。  

```java
/**
  * Returns a connection to host a new stream. This prefers the existing connection if it exists,
  * then the pool, finally building a new connection.
  */
private RealConnection findConnection(int connectTimeout, int readTimeout, int writeTimeout,
    boolean connectionRetryEnabled) throws IOException {
  Route selectedRoute;
  synchronized (connectionPool) {
    if (released) throw new IllegalStateException("released");
    if (codec != null) throw new IllegalStateException("codec != null");
    if (canceled) throw new IOException("Canceled");

    // Attempt to use an already-allocated connection.
    RealConnection allocatedConnection = this.connection;
    if (allocatedConnection != null && !allocatedConnection.noNewStreams) {
      return allocatedConnection;
    }

    // Attempt to get a connection from the pool.
    Internal.instance.get(connectionPool, address, this, null);
    if (connection != null) {
      return connection;
    }

    selectedRoute = route;
  }

  // If we need a route, make one. This is a blocking operation.
  if (selectedRoute == null) {
    selectedRoute = routeSelector.next();
  }

  RealConnection result;
  synchronized (connectionPool) {
    if (canceled) throw new IOException("Canceled");

    // Now that we have an IP address, make another attempt at getting a connection from the pool.
    // This could match due to connection coalescing.
    Internal.instance.get(connectionPool, address, this, selectedRoute);
    if (connection != null) return connection;

    // Create a connection and assign it to this allocation immediately. This makes it possible
    // for an asynchronous cancel() to interrupt the handshake we're about to do.
    route = selectedRoute;
    refusedStreamCount = 0;
    result = new RealConnection(connectionPool, selectedRoute);
    acquire(result);
  }

  // Do TCP + TLS handshakes. This is a blocking operation.
  result.connect(connectTimeout, readTimeout, writeTimeout, connectionRetryEnabled);
  routeDatabase().connected(result.route());

  Socket socket = null;
  synchronized (connectionPool) {
    // Pool the connection.
    Internal.instance.put(connectionPool, result);

    // If another multiplexed connection to the same address was created concurrently, then
    // release this connection and acquire that one.
    if (result.isMultiplexed()) {
      socket = Internal.instance.deduplicate(connectionPool, address, this);
      result = connection;
    }
  }
  closeQuietly(socket);

  return result;
}
```

在创建新connection时，会执行TCP + TLS握手，然后放入连接池中。  
在调用`connect`进行握手时会调用`establishProtocol`方法确定协议：

```java
private void establishProtocol(ConnectionSpecSelector connectionSpecSelector) throws IOException {
  if (route.address().sslSocketFactory() == null) {
    protocol = Protocol.HTTP_1_1;
    socket = rawSocket;
    return;
  }

  connectTls(connectionSpecSelector);

  if (protocol == Protocol.HTTP_2) {
    socket.setSoTimeout(0); // HTTP/2 connection timeouts are set per-stream.
    http2Connection = new Http2Connection.Builder(true)
        .socket(socket, route.address().url().host(), source, sink)
        .listener(this)
        .build();
    http2Connection.start();
  }
}
```

也就是说，在建立连接时，如果是HTTP_2，就会初始化一个`http2Connection`。  

我们回到`streamAllocation.newStream`方法的`resultConnection.newCodec`语句中：

```java
public HttpCodec newCodec(
    OkHttpClient client, StreamAllocation streamAllocation) throws SocketException {
  if (http2Connection != null) {
    return new Http2Codec(client, streamAllocation, http2Connection);
  } else {
    socket.setSoTimeout(client.readTimeoutMillis());
    source.timeout().timeout(client.readTimeoutMillis(), MILLISECONDS);
    sink.timeout().timeout(client.writeTimeoutMillis(), MILLISECONDS);
    return new Http1Codec(client, streamAllocation, source, sink);
  }
}
```

我们发现，这里根据`http2Connection`有没有初始化，也就是是不是HTTP_2协议来创建对应的`HttpCodec`对象。

在拦截器的最后，调用`realChain.proceed(request, streamAllocation, httpCodec, connection)`将请求传递给下一个拦截器。

#### CallServerInterceptor

*This is the last interceptor in the chain. It makes a network call to the server*.

下面这些代码看起来也很清晰，就是利用`HttpCodec`进行请求数据、响应数据的读写。其中读写的不详细描述。

```java
@Override public Response intercept(Chain chain) throws IOException {
  RealInterceptorChain realChain = (RealInterceptorChain) chain;
  HttpCodec httpCodec = realChain.httpStream();
  StreamAllocation streamAllocation = realChain.streamAllocation();
  RealConnection connection = (RealConnection) realChain.connection();
  Request request = realChain.request();

  long sentRequestMillis = System.currentTimeMillis();
  httpCodec.writeRequestHeaders(request);

  Response.Builder responseBuilder = null;
  if (HttpMethod.permitsRequestBody(request.method()) && request.body() != null) {
    // If there's a "Expect: 100-continue" header on the request, wait for a "HTTP/1.1 100
    // Continue" response before transmitting the request body. If we don't get that, return what
    // we did get (such as a 4xx response) without ever transmitting the request body.
    if ("100-continue".equalsIgnoreCase(request.header("Expect"))) {
      httpCodec.flushRequest();
      responseBuilder = httpCodec.readResponseHeaders(true);
    }

    if (responseBuilder == null) {
      // Write the request body if the "Expect: 100-continue" expectation was met.
      Sink requestBodyOut = httpCodec.createRequestBody(request, request.body().contentLength());
      BufferedSink bufferedRequestBody = Okio.buffer(requestBodyOut);
      request.body().writeTo(bufferedRequestBody);
      bufferedRequestBody.close();
    } else if (!connection.isMultiplexed()) {
      // If the "Expect: 100-continue" expectation wasn't met, prevent the HTTP/1 connection from
      // being reused. Otherwise we're still obligated to transmit the request body to leave the
      // connection in a consistent state.
      streamAllocation.noNewStreams();
    }
  }

  httpCodec.finishRequest();

  if (responseBuilder == null) {
    responseBuilder = httpCodec.readResponseHeaders(false);
  }

  Response response = responseBuilder
      .request(request)
      .handshake(streamAllocation.connection().handshake())
      .sentRequestAtMillis(sentRequestMillis)
      .receivedResponseAtMillis(System.currentTimeMillis())
      .build();

  int code = response.code();
  if (forWebSocket && code == 101) {
    // Connection is upgrading, but we need to ensure interceptors see a non-null response body.
    response = response.newBuilder()
        .body(Util.EMPTY_RESPONSE)
        .build();
  } else {
    response = response.newBuilder()
        .body(httpCodec.openResponseBody(response))
        .build();
  }

  if ("close".equalsIgnoreCase(response.request().header("Connection"))
      || "close".equalsIgnoreCase(response.header("Connection"))) {
    streamAllocation.noNewStreams();
  }

  if ((code == 204 || code == 205) && response.body().contentLength() > 0) {
    throw new ProtocolException(
        "HTTP " + code + " had non-zero Content-Length: " + response.body().contentLength());
  }

  return response;
}
```

#### 小结

至此，OkHttp3的源码大致就过了一遍，这里小结一下。  

在OkHttp中，`RealCall`是Call的实现类，负责执行网络请求。其中，异步请求由`Dispatcher`进行调度，并放到线程池（一个典型的`CachedThreadPool`）中执行。  
执行网络请求的过程中，请求会依次经过`interceptors()`、`RetryAndFollowUpInterceptor`、`BridgeInterceptor`、`CacheInterceptor`、`ConnectInterceptor`、`networkInterceptors()`、`CallServerInterceptor`这些拦截器组成的责任链，最后发送到服务器。  
而响应会从`CallServerInterceptor`开始往前依次经过这些拦截器，最后客户端进行处理。

### Retrofit

**代码基于[retrofit-2.3.0](https://github.com/square/retrofit/tree/parent-2.3.0)**

包含三个库：

- com.squareup.retrofit2:retrofit
- com.squareup.retrofit2:adapter-rxjava2
- com.squareup.retrofit2:converter-gson

在正式开始前，先简单介绍一下几个关键词：

- `CallAdapter<R, T>`  
  将一个Call从响应类型R适配成T类型的适配器  
  - `Type responseType()`  
    适配器将HTTP响应体转换为Java对象时，该对象的类型  
    比如`Call<Repo>`的返回值是`Repo`
  - `T adapt(Call<R> call)`  
    返回一个代理了call的T
- `CallAdapter.Factory`  
  用于创建CallAdapter实例的工厂
  - `CallAdapter<?, ?> get(Type returnType, Annotation[] annotations, Retrofit retrofit)`  
    返回一个可以返回`returnType`的接口方法的CallAdapter，如果不能处理，则返回null
- `Converter<F, T>`  
  将F转换为T类型的值的转换器  
  - `T convert(F value) throws IOException`
- `Converter.Factory`  
  基于一个类型和目标类型创建一个`Converter`实例的工厂  
  - `Converter<ResponseBody, ?> responseBodyConverter(Type type, Annotation[] annotations, Retrofit retrofit)`  
    返回一个可以转换HTTP响应体到`type`的转换器
  - `Converter<?, RequestBody> requestBodyConverter(Type type, Annotation[] parameterAnnotations, Annotation[] methodAnnotations, Retrofit retrofit)`  
    返回一个可以转换`type`到HTTP请求体的转换器
  - `Converter<?, String> stringConverter(Type type, Annotation[] annotations, Retrofit retrofit)`  
    返回一个可以转换`type`到String的转换器

#### 使用例子

首先看日常使用中最简单的一个例子：

**1.&nbsp;&nbsp;Api接口的定义**

```java
interface ApiService {
    @GET("rest/app/update")
    fun checkUpdate(@Query("versionCode") versionCode: String): Observable<VersionRes>
}
```

**2.&nbsp;&nbsp;利用Retrofit生成`ApiService`接口的实现**

```java
val retrofit = Retrofit.Builder()
    .client(okHttpClient)
    .baseUrl(apiUrl)
    .addCallAdapterFactory(RxJava2CallAdapterFactory.create())
    .addConverterFactory(GsonConverterFactory.create())
    .build()
return retrofit.create(ApiService::class.java)
```

**3.&nbsp;&nbsp;发送网络请求**

```java
RetrofitHelper.getApiService().checkUpdate(
      BuildConfig.VERSION_NAME.replace("\\p{Punct}".toRegex(), "0")
  ).subscribeOn(Schedulers.io())
      .observeOn(AndroidSchedulers.mainThread())
      .subscribe(...)
```

#### Retrofit.Builder

我们先看看`Retrofit.Builder`在创建`Retrofit`时干了些什么。  

首先是`Builder`的构造器：

```java
Builder(Platform platform) {
  this.platform = platform;
  // Add the built-in converter factory first. This prevents overriding its behavior but also
  // ensures correct behavior when using converters that consume all types.
  converterFactories.add(new BuiltInConverters());
}

public Builder() {
  this(Platform.get());
}
```

这里首先是调用了`Platform.get()`，然后保存到变量`platform`中。另外会添加一个内置转化器`BuiltInConverters`实例到转化器工厂数组`converterFactories`中。

`Platform.get()`调用了`findPlatform()`方法，最后在Android平台上得到了一个`Android`对象。该对象的两个方法（`defaultCallbackExecutor` 和`defaultCallAdapterFactory`）下面会用到，我们看一下这部分实现：

```java
private static Platform findPlatform() {
  try {
    Class.forName("android.os.Build");
    if (Build.VERSION.SDK_INT != 0) {
      return new Android();
    }
  } catch (ClassNotFoundException ignored) {
  }
  try {
    Class.forName("java.util.Optional");
    return new Java8();
  } catch (ClassNotFoundException ignored) {
  }
  return new Platform();
}

static class Android extends Platform {
  @Override public Executor defaultCallbackExecutor() {
    return new MainThreadExecutor();
  }

  @Override CallAdapter.Factory defaultCallAdapterFactory(@Nullable Executor callbackExecutor) {
    if (callbackExecutor == null) throw new AssertionError();
    return new ExecutorCallAdapterFactory(callbackExecutor);
  }

  /** 在主线程执行的执行器 */
  static class MainThreadExecutor implements Executor {
    private final Handler handler = new Handler(Looper.getMainLooper());

    @Override public void execute(Runnable r) {
      handler.post(r);
    }
  }
}
```

接下来我们设置了一些参数，这些参数都会保存到成员变量中，我们对照`build`方法进行解释：

```java
public Retrofit build() {
  // 就是对应baseUrl
  if (baseUrl == null) {
    throw new IllegalStateException("Base URL required.");
  }

  // callFactory就是我们传入的OkHttpClient
  // 因为OkHttpClient实现了okhttp3.Call.Factory这个接口
  okhttp3.Call.Factory callFactory = this.callFactory;
  if (callFactory == null) {
    callFactory = new OkHttpClient();
  }

  // 没有设置过callbackExecutor，且此处platform为Android
  // 因此这里被赋值为了MainThreadExecutor
  Executor callbackExecutor = this.callbackExecutor;
  if (callbackExecutor == null) {
    callbackExecutor = platform.defaultCallbackExecutor();
  }

  // 我们在配置的时候设置了一个RxJava2CallAdapterFactory
  // 然后这里另外填加了一个ExecutorCallAdapterFactory
  // Make a defensive copy of the adapters and add the default Call adapter.
  List<CallAdapter.Factory> adapterFactories = new ArrayList<>(this.adapterFactories);
  adapterFactories.add(platform.defaultCallAdapterFactory(callbackExecutor));

  // 在Retrofit.Builder的构造器里面就添加了一个内置的BuiltInConverters
  // 然后加上我们配置的一个GsonConverterFactory
  // Make a defensive copy of the converters.
  List<Converter.Factory> converterFactories = new ArrayList<>(this.converterFactories);

  // 创建一个Retrofit对象
  return new Retrofit(callFactory, baseUrl, converterFactories, adapterFactories,
      callbackExecutor, validateEagerly);
}
```

`Retrofit`对象已经创建了，其构造器实现都是赋值语句，不用细看。接着我们看一下其`create`方法。这是探索`Retrofit`原理的必经之路。  

#### Retrofit.create

先上代码，部分代码说明补充在了注释中：

```java
public <T> T create(final Class<T> service) {
  // 检查类型是不是接口，定义的接口数是否大于0
  Utils.validateServiceInterface(service);
  // 如果为true，则会先加载全部的非default方法，同时缓存到map中；默认为false
  if (validateEagerly) {
    eagerlyValidateMethods(service);
  }
  // 动态代理
  return (T) Proxy.newProxyInstance(service.getClassLoader(), new Class<?>[] { service },
      new InvocationHandler() {
        private final Platform platform = Platform.get();

        @Override public Object invoke(Object proxy, Method method, @Nullable Object[] args)
            throws Throwable {
          // 如果是调用的Object中的方法，那就直接执行此方法
          // If the method is a method from Object then defer to normal invocation.
          if (method.getDeclaringClass() == Object.class) {
            return method.invoke(this, args);
          }
          // 如果是default方法(Java8中引进)，那就调用default方法
          // 由于plaform是Android不是Java8，所以此处是false的
          if (platform.isDefaultMethod(method)) {
            return platform.invokeDefaultMethod(method, service, proxy, args);
          }
          // 见正文分析
          ServiceMethod<Object, Object> serviceMethod =
              (ServiceMethod<Object, Object>) loadServiceMethod(method);
          OkHttpCall<Object> okHttpCall = new OkHttpCall<>(serviceMethod, args);
          return serviceMethod.callAdapter.adapt(okHttpCall);
        }
      });
}
```

现在来到了`create`方法中非常核心的三行代码：

```java
ServiceMethod<Object, Object> serviceMethod =
    (ServiceMethod<Object, Object>) loadServiceMethod(method);
OkHttpCall<Object> okHttpCall = new OkHttpCall<>(serviceMethod, args);
return serviceMethod.callAdapter.adapt(okHttpCall);
```

下面都是对这几行代码的分析了，我们先有一个大致的印象，知道每一行代码干了什么。

1. 在`loadServiceMethod`方法执行的时候，有一个取缓存的操作，若取不到则开始创建  
  创建的时候会根据方法、方法注解、方法参数、方法参数注解这几个方面  
  - 决定采用哪个`CallAdapter`、哪个`Converter`
  - 解析方法的注解，取出HTTP调用的方式`httpMethod`、是否有请求体`hasBody`、相对url`relativeUrl`等
  - 将每个参数的注解包装成为一个个`ParameterHandler`对象，等待调用

2. 将上一步的结果与方法的入参包装成一个`OkHttpCall`对象
3. 调用`serviceMethod.callAdapter.adapt(okHttpCall)`开始执行网络请求

下面我们一步一步地进行分析。

#### loadServiceMethod

先看看`loadServiceMethod`方法的相关代码：

```java
private final Map<Method, ServiceMethod<?, ?>> serviceMethodCache = new ConcurrentHashMap<>();

ServiceMethod<?, ?> loadServiceMethod(Method method) {
  ServiceMethod<?, ?> result = serviceMethodCache.get(method);
  if (result != null) return result;

  synchronized (serviceMethodCache) {
    result = serviceMethodCache.get(method);
    if (result == null) {
      result = new ServiceMethod.Builder<>(this, method).build();
      serviceMethodCache.put(method, result);
    }
  }
  return result;
}
```

可以很明显的看出来，这里采取了缓存的设计，**所以Retrofit也要单例实现才能发挥最大的作用**。  
很明显，这段代码的重点就是`ServiceMethod.Builder`的创建以及其`build`方法了。  

先看构造器的实现，这部分代码很简单，就是取出要调用方法的注解、参数以及参数注解：

```java
Builder(Retrofit retrofit, Method method) {
  this.retrofit = retrofit;
  this.method = method;
  this.methodAnnotations = method.getAnnotations();
  this.parameterTypes = method.getGenericParameterTypes();
  this.parameterAnnotationsArray = method.getParameterAnnotations();
}
```

在我们的例子中（tips:*可以直接在aar包对应文件中打上断点*）：
```java
methodAnnotations = [@GET("rest/app/update")]
parameterTypes = [String]
parameterAnnotationsArray = [[@Query(encoded=false, value=versionCode)]]
```

再看`ServiceMethod.Builder.build`方法，这部分代码很长很关键，我们一行一行代码捋一下。  
先上源代码，做一个整体解释：

```java
public ServiceMethod build() {
  // 根据method的返回值类型以及方法注解返回第一个可以处理的CallAdapter
  // 此处就是RxJava2CallAdapterFactory创建的RxJava2CallAdapter
  callAdapter = createCallAdapter();
  // 我们可以直接使用的真正的返回值类型，在例子中此处是VersionRes
  responseType = callAdapter.responseType();
  if (responseType == Response.class || responseType == okhttp3.Response.class) {
    throw methodError("'"
        + Utils.getRawType(responseType).getName()
        + "' is not a valid response body type. Did you mean ResponseBody?");
  }
  // 根据responseType以及方法注解返回第一个可以处理的Converter
  // 由于内置的BuiltInConverters无法处理VersionRes类型的返回值，所以第二个尝试处理
  // 它做到了，因此此处为GsonConverterFactory创建的GsonResponseBodyConverter
  responseConverter = createResponseConverter();

  // 根据注解的类型初始化一些参数
  // 在实例中，httpMethod为GET,hasBody为false，relativeUrl为rest/app/update
  for (Annotation annotation : methodAnnotations) {
    parseMethodAnnotation(annotation);
  }

  if (httpMethod == null) {
    throw methodError("HTTP method annotation is required (e.g., @GET, @POST, etc.).");
  }

  if (!hasBody) {
    if (isMultipart) {
      throw methodError(
          "Multipart can only be specified on HTTP methods with request body (e.g., @POST).");
    }
    if (isFormEncoded) {
      throw methodError("FormUrlEncoded can only be specified on HTTP methods with "
          + "request body (e.g., @POST).");
    }
  }

  // 将每个参数以及其注解封装成为一个ParameterHandler对象
  // 因为只有一个参数，所以这里把对应的结果写到代码上了
  int parameterCount = parameterAnnotationsArray.length;
  parameterHandlers = new ParameterHandler<?>[parameterCount];
  for (int p = 0; p < parameterCount; p++) {
    // String
    Type parameterType = parameterTypes[p];
    if (Utils.hasUnresolvableType(parameterType)) {
      throw parameterError(p, "Parameter type must not include a type variable or wildcard: %s",
          parameterType);
    }

    // [@Query(encoded=false, value=versionCode)]
    Annotation[] parameterAnnotations = parameterAnnotationsArray[p];
    if (parameterAnnotations == null) {
      throw parameterError(p, "No Retrofit annotation found.");
    }

    // ParameterHandler.Query(
    //   name = "VersionCode",
    //   encoded = false,
    //   valueConverter = BuiltInConverters.ToStringConverter
    // )
    parameterHandlers[p] = parseParameter(p, parameterType, parameterAnnotations);
  }

  if (relativeUrl == null && !gotUrl) {
    throw methodError("Missing either @%s URL or @Url parameter.", httpMethod);
  }
  if (!isFormEncoded && !isMultipart && !hasBody && gotBody) {
    throw methodError("Non-body HTTP method cannot contain @Body.");
  }
  if (isFormEncoded && !gotField) {
    throw methodError("Form-encoded method must contain at least one @Field.");
  }
  if (isMultipart && !gotPart) {
    throw methodError("Multipart method must contain at least one @Part.");
  }

  // 创建ServiceMethod对象，内部就是一些赋值操作
  return new ServiceMethod<>(this);
}
```

整体分析完了，我们先看一下`CallAdapter`、`Converter`的创建，然后再看各种注解的解析。

callAdapter的选择由`createCallAdapter`完成：

```java
private CallAdapter<T, R> createCallAdapter() {
  // returnType为Observable<VersionRes>
  Type returnType = method.getGenericReturnType();
  if (Utils.hasUnresolvableType(returnType)) {
    throw methodError(
        "Method return type must not include a type variable or wildcard: %s", returnType);
  }
  if (returnType == void.class) {
    throw methodError("Service methods cannot return void.");
  }
  // annotations为[@GET("rest/app/update")]
  Annotation[] annotations = method.getAnnotations();
  try {
    // 转到retrofit进行处理
    //noinspection unchecked
    return (CallAdapter<T, R>) retrofit.callAdapter(returnType, annotations);
  } catch (RuntimeException e) { // Wide exception range because factories are user code.
    throw methodError(e, "Unable to create call adapter for %s", returnType);
  }
}
```

继续跟踪`Retrofit.callAdapter`方法：

```java
public CallAdapter<?, ?> callAdapter(Type returnType, Annotation[] annotations) {
  return nextCallAdapter(null, returnType, annotations);
}

public CallAdapter<?, ?> nextCallAdapter(@Nullable CallAdapter.Factory skipPast, Type returnType,
    Annotation[] annotations) {
  checkNotNull(returnType, "returnType == null");
  checkNotNull(annotations, "annotations == null");

  // start = -1 + 1 = 0，也就是顺序遍历
  // 从RxJava2CallAdapterFactory、ExecutorCallAdapterFactory中找到满足条件的
  int start = adapterFactories.indexOf(skipPast) + 1;
  for (int i = start, count = adapterFactories.size(); i < count; i++) {
    CallAdapter<?, ?> adapter = adapterFactories.get(i).get(returnType, annotations, this);
    if (adapter != null) {
      return adapter;
    }
  }

  ...
  throw new IllegalArgumentException(...);
}
```

`RxJava2CallAdapterFactory`是满足条件的，我们看看其`get`方法：

```java
@Override
public CallAdapter<?, ?> get(Type returnType, Annotation[] annotations, Retrofit retrofit) {
  // returnType为Observable<VersionRes>，因此rawType就是Observable类型
  Class<?> rawType = getRawType(returnType);

  if (rawType == Completable.class) {
    // Completable is not parameterized (which is what the rest of this method deals with) so it
    // can only be created with a single configuration.
    return new RxJava2CallAdapter(Void.class, scheduler, isAsync, false, true, false, false,
        false, true);
  }

  boolean isFlowable = rawType == Flowable.class;
  boolean isSingle = rawType == Single.class;
  boolean isMaybe = rawType == Maybe.class;
  if (rawType != Observable.class && !isFlowable && !isSingle && !isMaybe) {
    return null;
  }

  boolean isResult = false;
  boolean isBody = false;
  Type responseType;
  if (!(returnType instanceof ParameterizedType)) {
    String name = isFlowable ? "Flowable"
        : isSingle ? "Single"
        : isMaybe ? "Maybe" : "Observable";
    throw new IllegalStateException(name + " return type must be parameterized"
        + " as " + name + "<Foo> or " + name + "<? extends Foo>");
  }

  // observableType为VersionRes类型
  Type observableType = getParameterUpperBound(0, (ParameterizedType) returnType);
  // rawObservableType也为VersionRes类型
  Class<?> rawObservableType = getRawType(observableType);
  if (rawObservableType == Response.class) {
    if (!(observableType instanceof ParameterizedType)) {
      throw new IllegalStateException("Response must be parameterized"
          + " as Response<Foo> or Response<? extends Foo>");
    }
    responseType = getParameterUpperBound(0, (ParameterizedType) observableType);
  } else if (rawObservableType == Result.class) {
    if (!(observableType instanceof ParameterizedType)) {
      throw new IllegalStateException("Result must be parameterized"
          + " as Result<Foo> or Result<? extends Foo>");
    }
    responseType = getParameterUpperBound(0, (ParameterizedType) observableType);
    isResult = true;
  } else {
    // 因此走这个分支，responseType就是VersionRes类型了
    responseType = observableType;
    isBody = true;
  }

  // 返回了一个RxJava2CallAdapter，而不是null，也就意味着找到了满足条件的CallAdapter
  return new RxJava2CallAdapter(responseType, scheduler, isAsync, isResult, isBody, isFlowable,
      isSingle, isMaybe, false);
}
```

从上面分析可以看出，这里的`callAdapter`就等于`RxJava2CallAdapter(VersionRes, null, false, false, true, false, false, false, false)`。

接下来看`responseConverter`的创建方法`createResponseConverter()`：

```java
private Converter<ResponseBody, T> createResponseConverter() {
  // annotations为[@GET("rest/app/update")]
  Annotation[] annotations = method.getAnnotations();
  try {
    // responseType为VersionRes
    return retrofit.responseBodyConverter(responseType, annotations);
  } catch (RuntimeException e) { // Wide exception range because factories are user code.
    throw methodError(e, "Unable to create converter for %s", responseType);
  }
}
```

还是转到了`Retrofit`中：

```java
public <T> Converter<ResponseBody, T> responseBodyConverter(Type type, Annotation[] annotations) {
  return nextResponseBodyConverter(null, type, annotations);
}

public <T> Converter<ResponseBody, T> nextResponseBodyConverter(
    @Nullable Converter.Factory skipPast, Type type, Annotation[] annotations) {
  checkNotNull(type, "type == null");
  checkNotNull(annotations, "annotations == null");

  // 依然是从0开始，依次尝试BuiltInConverters、GsonConverterFactory
  int start = converterFactories.indexOf(skipPast) + 1;
  for (int i = start, count = converterFactories.size(); i < count; i++) {
    Converter<ResponseBody, ?> converter =
        converterFactories.get(i).responseBodyConverter(type, annotations, this);
    if (converter != null) {
      //noinspection unchecked
      return (Converter<ResponseBody, T>) converter;
    }
  }
  ...
  throw new IllegalArgumentException(...);
}
```

我们先看看`BuiltInConverters`能不能处理：

```java
@Override
public Converter<ResponseBody, ?> responseBodyConverter(Type type, Annotation[] annotations,
    Retrofit retrofit) {
  if (type == ResponseBody.class) {
    return Utils.isAnnotationPresent(annotations, Streaming.class)
        ? StreamingResponseBodyConverter.INSTANCE
        : BufferingResponseBodyConverter.INSTANCE;
  }
  if (type == Void.class) {
    return VoidResponseBodyConverter.INSTANCE;
  }
  return null;
}
```

我们可以看到`BuiltInConverters`只能处理`ResponseBody`类型和`Void`类型两种类型的返回值类型。  
所以，我们接着看第二个转换器`GsonConverterFactory`：

```java
@Override
public Converter<ResponseBody, ?> responseBodyConverter(Type type, Annotation[] annotations,
    Retrofit retrofit) {
  TypeAdapter<?> adapter = gson.getAdapter(TypeToken.get(type));
  return new GsonResponseBodyConverter<>(gson, adapter);
}
```

这里调用了Gson的相关方法，是可以完成任务的。所以就返回了`GsonResponseBodyConverter`。

回到`ServiceMethod.Builder.build`方法，接下来就是处理方法注解以及参数注解了。代码很简单，if-else判断出属于约定好的哪种注解，就设置对应的值。这里就不展开说了。  

最后是`return new ServiceMethod<>(this);`，这里面就是干了赋值的操作。

#### serviceMethod.callAdapter.adapt

在这一步的上一步中，将`ServiceMethod`与方法入参一起组成了一个`OkHttpCall`对象。  
到目前为止，都只是做一些准备工作，还没有真正开始网络请求。那么这一步肯定就干了这件事。我们一点点往下看。

我们在前面已经知道了`serviceMethod.callAdapter`是一个`RxJava2CallAdapter`对象，所以我们直接看其`adapt`方法：

```java
@Override public Object adapt(Call<R> call) {
  // isAsync在RxJava2CallAdapterFactory.create()中被赋值，为false
  Observable<Response<R>> responseObservable = isAsync
      ? new CallEnqueueObservable<>(call)
      : new CallExecuteObservable<>(call);

  Observable<?> observable;
  if (isResult) {
    observable = new ResultObservable<>(responseObservable);
  } else if (isBody) {
    // isResult为false，isBody为true，所以走这个
    observable = new BodyObservable<>(responseObservable);
  } else {
    observable = responseObservable;
  }

  // scheduler默认为null
  if (scheduler != null) {
    observable = observable.subscribeOn(scheduler);
  }

  // 以下boolean都为false
  if (isFlowable) {
    return observable.toFlowable(BackpressureStrategy.LATEST);
  }
  if (isSingle) {
    return observable.singleOrError();
  }
  if (isMaybe) {
    return observable.singleElement();
  }
  if (isCompletable) {
    return observable.ignoreElements();
  }
  return observable;
}
```

从上面可以看出，这里会经过两个Observable，分别是`CallExecuteObservable`以及`BodyObservable`。前者作为参数传递给了后者。

我们先看看`CallExecuteObservable`干了什么：

```java
final class CallExecuteObservable<T> extends Observable<Response<T>> {
  // originalCall实际上就是OkHttpCall
  private final Call<T> originalCall;

  CallExecuteObservable(Call<T> originalCall) {
    this.originalCall = originalCall;
  }

  @Override protected void subscribeActual(Observer<? super Response<T>> observer) {
    // 此处的observer是BodyObservable.BodyObserver
    // Since Call is a one-shot type, clone it for each new observer.
    Call<T> call = originalCall.clone();
    // 注意这里，如果dispose了Observable，call同时也会被cancel
    // 调用BodyObserver.onSubscribe
    observer.onSubscribe(new CallDisposable(call));

    boolean terminated = false;
    try {
      // 调用OkHttpCall.execute方法执行同步请求
      Response<T> response = call.execute();
      if (!call.isCanceled()) {
        // 调用BodyObserver.onNext
        observer.onNext(response);
      }
      if (!call.isCanceled()) {
        terminated = true;
        // 调用BodyObserver.onComplete
        observer.onComplete();
      }
    } catch (Throwable t) {
      Exceptions.throwIfFatal(t);
      if (terminated) {
        RxJavaPlugins.onError(t);
      } else if (!call.isCanceled()) {
        try {
          // 调用BodyObserver.onError
          observer.onError(t);
        } catch (Throwable inner) {
          Exceptions.throwIfFatal(inner);
          RxJavaPlugins.onError(new CompositeException(t, inner));
        }
      }
    }
  }

  private static final class CallDisposable implements Disposable {
    private final Call<?> call;

    CallDisposable(Call<?> call) {
      this.call = call;
    }

    @Override public void dispose() {
      call.cancel();
    }

    @Override public boolean isDisposed() {
      return call.isCanceled();
    }
  }
}
```

在上面这段代码中，`call.execute()`是重点，在这段代码里面完成了`ServiceMethod`的乱七八糟的参数的组装，最后才执行`RealCall.execute`，我们最后再说。  

接下来看看`BodyObservable`的相关代码：

```java
final class BodyObservable<T> extends Observable<T> {
  // 上面的CallExecuteObservable
  private final Observable<Response<T>> upstream;

  BodyObservable(Observable<Response<T>> upstream) {
    this.upstream = upstream;
  }

  @Override protected void subscribeActual(Observer<? super T> observer) {
    // 这里的入参observer就是我们客户端定义的用来响应网络请求的observer了
    upstream.subscribe(new BodyObserver<T>(observer));
  }

  /** 该类的作用就是判断请求是否成功，并将成功的Response<R>转换为R，传给客户端 */
  private static class BodyObserver<R> implements Observer<Response<R>> {
    private final Observer<? super R> observer;
    private boolean terminated;

    BodyObserver(Observer<? super R> observer) {
      this.observer = observer;
    }

    @Override public void onSubscribe(Disposable disposable) {
      observer.onSubscribe(disposable);
    }

    @Override public void onNext(Response<R> response) {
      // 判断请求是否成功
      if (response.isSuccessful()) {
        // 若成功，将成功的Response<R>转换为R，传给客户端
        observer.onNext(response.body());
      } else {
        // 否则，向客户端抛出HttpException异常
        terminated = true;
        Throwable t = new HttpException(response);
        try {
          observer.onError(t);
        } catch (Throwable inner) {
          Exceptions.throwIfFatal(inner);
          RxJavaPlugins.onError(new CompositeException(t, inner));
        }
      }
    }

    @Override public void onComplete() {
      if (!terminated) {
        observer.onComplete();
      }
    }

    @Override public void onError(Throwable throwable) {
      if (!terminated) {
        observer.onError(throwable);
      } else {
        // This should never happen! onNext handles and forwards errors automatically.
        Throwable broken = new AssertionError(
            "This should never happen! Report as a bug with the full stacktrace.");
        //noinspection UnnecessaryInitCause Two-arg AssertionError constructor is 1.7+ only.
        broken.initCause(throwable);
        RxJavaPlugins.onError(broken);
      }
    }
  }
}
```

小结一下，`CallExecuteObservable`就是用来执行网络请求的，`BodyObservable`会将网络请求的结果(`Response<VersionRes>`)转换为客户端需要的结果(`VersionRes`)。

#### OkHttpCall.execute

回想一下`CallExecuteObservable`的关键代码，网络请求需要有一个`Request`，但是在`Retrofit`中目前没有发现任何设置的地方，所以这部分代码肯定在`OkHttpCall.execute`中：

```java
@Override public Response<T> execute() throws IOException {
  okhttp3.Call call;

  synchronized (this) {
    if (executed) throw new IllegalStateException("Already executed.");
    executed = true;

    if (creationFailure != null) {
      if (creationFailure instanceof IOException) {
        throw (IOException) creationFailure;
      } else {
        throw (RuntimeException) creationFailure;
      }
    }

    call = rawCall;
    if (call == null) {
      try {
        call = rawCall = createRawCall();
      } catch (IOException | RuntimeException e) {
        creationFailure = e;
        throw e;
      }
    }
  }

  if (canceled) {
    call.cancel();
  }

  return parseResponse(call.execute());
}
```

上面抛开一些同步处理、健康检查，其实就两行代码：

```java
call = rawCall = createRawCall();
return parseResponse(call.execute())
```

先看`createRawCall`方法：

```java
private okhttp3.Call createRawCall() throws IOException {
  // 构造一个Request对象
  Request request = serviceMethod.toRequest(args);
  // serviceMethod.callFactory是我们传入的OkHttpClient对象
  // 这行代码就是new一个RealCall对象
  okhttp3.Call call = serviceMethod.callFactory.newCall(request);
  if (call == null) {
    throw new NullPointerException("Call.Factory returned null.");
  }
  return call;
}
```

我们看看`serviceMethod.toRequest(args)`如何拼凑出一个`Request`对象：

```java
/** Builds an HTTP request from method arguments. */
Request toRequest(@Nullable Object... args) throws IOException {
  // 还是用例子来说，此处RequestBuilder里面的参数依次为
  // GET, http://aaa.bbb.ccc/, rest/app/update, null, null, false, false, false
  RequestBuilder requestBuilder = new RequestBuilder(httpMethod, baseUrl, relativeUrl, headers,
      contentType, hasBody, isFormEncoded, isMultipart);

  // handlers只有一个：
  // ParameterHandler.Query(
  //   name = "VersionCode",
  //   encoded = false,
  //   valueConverter = BuiltInConverters.ToStringConverter
  // )
  @SuppressWarnings("unchecked") // It is an error to invoke a method with the wrong arg types.
  ParameterHandler<Object>[] handlers = (ParameterHandler<Object>[]) parameterHandlers;

  int argumentCount = args != null ? args.length : 0;
  if (argumentCount != handlers.length) {
    throw new IllegalArgumentException("Argument count (" + argumentCount
        + ") doesn't match expected count (" + handlers.length + ")");
  }

  // 调用ParameterHandler.apply方法
  for (int p = 0; p < argumentCount; p++) {
    handlers[p].apply(requestBuilder, args[p]);
  }

  return requestBuilder.build();
}
```

上面调用了`ParameterHandler.Query.apply`方法：

```java
// 此处value就是实例中versionCode的值，假设是10000
@Override void apply(RequestBuilder builder, @Nullable T value) throws IOException {
  if (value == null) return; // Skip null values.

  // valueConverter是BuiltInConverters.ToStringConverter
  // 所以queryValue的值也是10000
  String queryValue = valueConverter.convert(value);
  if (queryValue == null) return; // Skip converted but null values

  // 最后调用了`RequestBuilder.addQueryParam`方法
  builder.addQueryParam(name, queryValue, encoded);
}
```

继续跟踪一下`RequestBuilder.addQueryParam`方法：

```java
void addQueryParam(String name, @Nullable String value, boolean encoded) {
  // relativeUrl为rest/app/update
  if (relativeUrl != null) {
    // Do a one-time combination of the built relative URL and the base URL.
    // 接口URL的拼接，urlBuilder可以简单理解为baseUrl+relativeUrl
    urlBuilder = baseUrl.newBuilder(relativeUrl);
    if (urlBuilder == null) {
      throw new IllegalArgumentException(
          "Malformed URL. Base: " + baseUrl + ", Relative: " + relativeUrl);
    }
    relativeUrl = null;
  }

  if (encoded) {
    //noinspection ConstantConditions Checked to be non-null by above 'if' block.
    urlBuilder.addEncodedQueryParameter(name, value);
  } else {
    // 不加密，走这里
    // 里面会将参数value以及参数name进行UTF-8编码，涉及到的特殊字符会进行转义
    // urlBuilder是OkHttp3库中的，这里不做深入了解了
    //noinspection ConstantConditions Checked to be non-null by above 'if' block.
    urlBuilder.addQueryParameter(name, value);
  }
}
```

回到上面，执行完`createRawCall`之后，就继续执行`parseResponse(call.execute())`。由于此时的`call`是`RealCall`类型了，所以也不用多说。接下来就是`parseResponse`方法。

```java
Response<T> parseResponse(okhttp3.Response rawResponse) throws IOException {
  ResponseBody rawBody = rawResponse.body();

  // Remove the body's source (the only stateful object) so we can pass the response along.
  rawResponse = rawResponse.newBuilder()
      .body(new NoContentResponseBody(rawBody.contentType(), rawBody.contentLength()))
      .build();

  int code = rawResponse.code();
  if (code < 200 || code >= 300) {
    try {
      // Buffer the entire body to avoid future I/O.
      ResponseBody bufferedBody = Utils.buffer(rawBody);
      return Response.error(bufferedBody, rawResponse);
    } finally {
      rawBody.close();
    }
  }

  if (code == 204 || code == 205) {
    rawBody.close();
    return Response.success(null, rawResponse);
  }

  ExceptionCatchingRequestBody catchingBody = new ExceptionCatchingRequestBody(rawBody);
  try {
    T body = serviceMethod.toResponse(catchingBody);
    return Response.success(body, rawResponse);
  } catch (RuntimeException e) {
    // If the underlying source threw an exception, propagate that rather than indicating it was
    // a runtime exception.
    catchingBody.throwIfCaught();
    throw e;
  }
}
```

该方法前面几部分比较原始，我们关注一下`T body = serviceMethod.toResponse(catchingBody);`，

```java
/** Builds a method return value from an HTTP response body. */
R toResponse(ResponseBody body) throws IOException {
  return responseConverter.convert(body);
}
```

这里面的`responseConverter`就是很早之前就创建好的`GsonResponseBodyConverter`。其`convert`方法如下所示：

```java
@Override public T convert(ResponseBody value) throws IOException {
  JsonReader jsonReader = gson.newJsonReader(value.charStream());
  try {
    return adapter.read(jsonReader);
  } finally {
    value.close();
  }
}
```

#### 小结

至此，我们把Retrofit部分整个流程捋了一遍，下面小结一下。

Retrofit使用了动态代理实现了我们定义的接口。在实现接口方法时，Retrofit会为每一个接口方法构建了一个`ServiceMethod`对象，并会缓存到内存中。在`ServiceMethod`构建时，会根据接口方法的注解类型、参数类型以及参数注解来拼接请求参数、确定请求类型、构建请求体等，同时会根据接口方法的注解和返回类型确定使用哪个`CallAdapter`包装`OkHttpCall`，同时根据接口方法的泛型类型参数以及方法注解确定使用哪个`Converter`提供请求体、响应体以及字符串转换服务。所有准备工作完成之后，调用了`CallAdapter.adapt`，在这里面真正开始了网络请求。

## 相关

1. OkHttpClient每次网络请求都需要创建一个吗?  
  不，绝大多数情况下都可以使用单例模式。  
  <cite>Most applications should call `new OkHttpClient()` exactly once, configure it with their cache, and use that same instance everywhere.</cite>
2. Retrofit每次网络请求也需要创建一个吗?  
  不。因为Retrofit每次加载新方法，都会缓存起来。如果每次都创建一个新的，那么缓存机制毫无作用。
3. OkHttp+Retrofit如何给网络请求打上tag？如何获取请求的tag？如何批量取消某种tag的请求？  
  使用Retrofit时绝大多数情况下不会直接接触到`Request`，所以无法有显而易见的方式来完成。不过好在`Retrofit.Builder.callFactory`可以完成由`Request`到`Call`的构造，在这里面我们可以打下tag。  
  ```java
Retrofit.Builder()
  .client(okHttpClient)
  .baseUrl(apiUrl)
  .addCallAdapterFactory(RxJava2CallAdapterFactory.create())
  .addConverterFactory(GsonConverterFactory.create())
  .callFactory {
      okHttpClient.newCall(it.newBuilder().tag("Hello").build())
  }
  .build()
  ```
  在`OkHttpClient`的拦截器中等可以接触到`Request`的位置使用其`tag()`方法获取到。  
  取消带tag的请求参考[okhttp3关于tag取消请求](https://blog.csdn.net/buyaoshitududongwo/article/details/80048179)，主要就是通过`OkHttpClient`实例的`dispatcher().queuedCalls()`和`dispatcher().runningCalls()`取得对应状态的Request队列，然后遍历取其tag，取消指定tag的Request。