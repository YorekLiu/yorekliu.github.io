---
title: "Glide v4 源码解析（二）"
excerpt: "从源码的角度理解Glide三步的执行流程"
categories:
  - Android
tags:
  - Glide
  - 对象池
  - Pools.Pool
header:
  overlay_image: /assets/images/android/glide_logo.png
  overlay_filter: rgba(126, 202, 286, 0.6)
toc: true
toc_label: "目录"
# last_modified_at: 2019-04-19T01:41:08+08:00
---

本系列文章参考3.7.0版本的[guolin - Glide最全解析](https://blog.csdn.net/sinyu890807/column/info/15318)，并按此思路结合4.9.0版本源码以及使用文档进行更新。  
➟ [Glide v4.9.0](https://github.com/bumptech/glide/tree/v4.9.0)  
➟ [中文使用文档](https://muyangmin.github.io/glide-docs-cn/)  
{: .notice--info }

本章主要内容为从源码的角度理解Glide三步的执行流程。

由于上一章中我们已经导入了Glide库，所以可以直接在Android Studio中查看Glide的源码。相比clone GitHub上的源码，使用Android Studio查看Glide源码的好处是，这是只读的，防止我们误操作。而且还能直接上在源码对应的上断点，真是太方便了。

还是以`Glide.with(this).load(URL).into(ivGlide)`为例，看看这背后隐藏了什么秘密。

## 1. Glide.with

`Glide.with`有很多重载方法：

```java
public class Glide implements ComponentCallbacks2 {
    ...
    @NonNull
    public static RequestManager with(@NonNull Context context) {
        return getRetriever(context).get(context);
    }

    @NonNull
    public static RequestManager with(@NonNull Activity activity) {
        return getRetriever(activity).get(activity);
    }

    @NonNull
    public static RequestManager with(@NonNull FragmentActivity activity) {
        return getRetriever(activity).get(activity);
    }

    @NonNull
    public static RequestManager with(@NonNull Fragment fragment) {
        return getRetriever(fragment.getActivity()).get(fragment);
    }

    @SuppressWarnings("deprecation")
    @Deprecated
    @NonNull
    public static RequestManager with(@NonNull android.app.Fragment fragment) {
        return getRetriever(fragment.getActivity()).get(fragment);
    }

    @NonNull
    public static RequestManager with(@NonNull View view) {
        return getRetriever(view.getContext()).get(view);
    }
}
```

可以看到，每个重载方法内部都首先调用`getRetriever(@Nullable Context context)`方法获取一个`RequestManagerRetriever`对象，然后调用其`get`方法来返回`RequestManager`。  
传入`getRetriever`的参数都是`Context`，而`RequestManagerRetriever.get`方法传入的参数各不相同，所以生命周期的绑定肯定发生在`get`方法中。

我们把`Glide.with`方法里面的代码分成两部分来分析。

### 1.1 getRetriever(Context)

`getRetriever(Context)`方法会根据`@GlideModule`注解的类以及`AndroidManifest.xml`文件中meta-data配置的`GlideModule`来创建一个`Glide`实例，然后返回该实例的`requestManagerRetriever`。  

我们跟着源码过一边，首先从`getRetriever(Context)`开始：

```java
@NonNull
private static RequestManagerRetriever getRetriever(@Nullable Context context) {
  // Context could be null for other reasons (ie the user passes in null), but in practice it will
  // only occur due to errors with the Fragment lifecycle.
  Preconditions.checkNotNull(
      context,
      "You cannot start a load on a not yet attached View or a Fragment where getActivity() "
          + "returns null (which usually occurs when getActivity() is called before the Fragment "
          + "is attached or after the Fragment is destroyed).");
  return Glide.get(context).getRequestManagerRetriever();
}
```

因入参`context`为`fragment.getActivity()`时，`context`可能为空，所以这里进行了一次判断。然后就调用了`Glide.get(context)`创建了一个Glide，最后将`requestManagerRetriever`返回即可。  

我们看一下`Glide`的创建过程：

```java
@NonNull
public static Glide get(@NonNull Context context) {
  if (glide == null) {
    synchronized (Glide.class) {
      if (glide == null) {
        checkAndInitializeGlide(context);
      }
    }
  }

  return glide;
}

private static void checkAndInitializeGlide(@NonNull Context context) {
  // In the thread running initGlide(), one or more classes may call Glide.get(context).
  // Without this check, those calls could trigger infinite recursion.
  if (isInitializing) {
    throw new IllegalStateException("You cannot call Glide.get() in registerComponents(),"
        + " use the provided Glide instance instead");
  }
  isInitializing = true;
  initializeGlide(context);
  isInitializing = false;
}

private static void initializeGlide(@NonNull Context context) {
  initializeGlide(context, new GlideBuilder());
}
```

上面这段代码没有什么可说的，下面看看`initializeGlide`时如何创建`Glide`实例的。

```java
@SuppressWarnings("deprecation")
private static void initializeGlide(@NonNull Context context, @NonNull GlideBuilder builder) {
  Context applicationContext = context.getApplicationContext();
  // 如果有配置@GlideModule注解，那么会反射构造kapt生成的GeneratedAppGlideModuleImpl类
  GeneratedAppGlideModule annotationGeneratedModule = getAnnotationGeneratedGlideModules();
  // 如果Impl存在，且允许解析manifest文件
  // 则遍历manifest中的meta-data，解析出所有的GlideModule类
  List<com.bumptech.glide.module.GlideModule> manifestModules = Collections.emptyList();
  if (annotationGeneratedModule == null || annotationGeneratedModule.isManifestParsingEnabled()) {
    manifestModules = new ManifestParser(applicationContext).parse();
  }

  // 根据Impl的黑名单，剔除manifest中的GlideModule类
  if (annotationGeneratedModule != null
      && !annotationGeneratedModule.getExcludedModuleClasses().isEmpty()) {
    Set<Class<?>> excludedModuleClasses =
        annotationGeneratedModule.getExcludedModuleClasses();
    Iterator<com.bumptech.glide.module.GlideModule> iterator = manifestModules.iterator();
    while (iterator.hasNext()) {
      com.bumptech.glide.module.GlideModule current = iterator.next();
      if (!excludedModuleClasses.contains(current.getClass())) {
        continue;
      }
      if (Log.isLoggable(TAG, Log.DEBUG)) {
        Log.d(TAG, "AppGlideModule excludes manifest GlideModule: " + current);
      }
      iterator.remove();
    }
  }

  if (Log.isLoggable(TAG, Log.DEBUG)) {
    for (com.bumptech.glide.module.GlideModule glideModule : manifestModules) {
      Log.d(TAG, "Discovered GlideModule from manifest: " + glideModule.getClass());
    }
  }

  // 如果Impl存在，那么设置为该类的RequestManagerFactory； 否则，设置为null
  RequestManagerRetriever.RequestManagerFactory factory =
      annotationGeneratedModule != null
          ? annotationGeneratedModule.getRequestManagerFactory() : null;
  builder.setRequestManagerFactory(factory);
  // 依次调用manifest中GlideModule类的applyOptions方法，将配置写到builder里
  for (com.bumptech.glide.module.GlideModule module : manifestModules) {
    module.applyOptions(applicationContext, builder);
  }
  // 写入Impl的配置
  // 也就是说Impl配置的优先级更高，如果有冲突的话
  if (annotationGeneratedModule != null) {
    annotationGeneratedModule.applyOptions(applicationContext, builder);
  }
  // 🔥🔥🔥调用GlideBuilder.build方法创建Glide
  Glide glide = builder.build(applicationContext);
  // 依次调用manifest中GlideModule类的registerComponents方法，来替换Glide的默认配置
  for (com.bumptech.glide.module.GlideModule module : manifestModules) {
    module.registerComponents(applicationContext, glide, glide.registry);
  }
  // 调用Impl中替换Glide配置的方法
  if (annotationGeneratedModule != null) {
    annotationGeneratedModule.registerComponents(applicationContext, glide, glide.registry);
  }
  // 注册内存管理的回调，因为Glide实现了ComponentCallbacks2接口
  applicationContext.registerComponentCallbacks(glide);
  // 保存glide实例到静态变量中
  Glide.glide = glide;
}
```

> `applyOptions`、`registerComponents`这两个方法后面会详细讨论，这里只是简单说明一下。

在我们本节的例子中，我们`AndroidManifest`和`@GlideModule`注解中都没有进行过配置，所以上面的代码可以简化为：

```java
@SuppressWarnings("deprecation")
private static void initializeGlide(@NonNull Context context, @NonNull GlideBuilder builder) {
  Context applicationContext = context.getApplicationContext();
  // 🔥🔥🔥调用GlideBuilder.build方法创建Glide
  Glide glide = builder.build(applicationContext);
  // 注册内存管理的回调，因为Glide实现了ComponentCallbacks2接口
  applicationContext.registerComponentCallbacks(glide);
  // 保存glide实例到静态变量中
  Glide.glide = glide;
}
```

🔥🔥🔥我们看一下`GlideBuilder.build`方法：

```java
@NonNull
Glide build(@NonNull Context context) {
  ...

  RequestManagerRetriever requestManagerRetriever =
      new RequestManagerRetriever(requestManagerFactory);

  return new Glide(
      context,
      engine,
      memoryCache,
      bitmapPool,
      arrayPool,
      requestManagerRetriever,
      connectivityMonitorFactory,
      logLevel,
      defaultRequestOptions.lock(),
      defaultTransitionOptions,
      defaultRequestListeners,
      isLoggingRequestOriginsEnabled);
}
```

这里的`requestManagerRetriever`直接调用了构造器，且传入参数实际上为null，在`RequestManagerRetriever`的构造器方法中会为此创建一个默认的`DEFAULT_FACTORY`：

```java
public class RequestManagerRetriever implements Handler.Callback {

  private final Handler handler;
  private final RequestManagerFactory factory;

  public RequestManagerRetriever(@Nullable RequestManagerFactory factory) {
    this.factory = factory != null ? factory : DEFAULT_FACTORY;
    handler = new Handler(Looper.getMainLooper(), this /* Callback */);
  }

  /**
   * Used internally to create {@link RequestManager}s.
   */
  public interface RequestManagerFactory {
    @NonNull
    RequestManager build(
        @NonNull Glide glide,
        @NonNull Lifecycle lifecycle,
        @NonNull RequestManagerTreeNode requestManagerTreeNode,
        @NonNull Context context);
  }

  private static final RequestManagerFactory DEFAULT_FACTORY = new RequestManagerFactory() {
    @NonNull
    @Override
    public RequestManager build(@NonNull Glide glide, @NonNull Lifecycle lifecycle,
        @NonNull RequestManagerTreeNode requestManagerTreeNode, @NonNull Context context) {
      return new RequestManager(glide, lifecycle, requestManagerTreeNode, context);
    }
  };
}
```

目前为止，`Glide`**单例已经被创建出来了**，其`requestManagerRetriever`会作为`getRetriever(Context)`的返回值返回。

接下来回到`Glide.with`方法中，接着执行的是`RequestManagerRetriever.get`方法，该方法根据入参是对生命周期可感的。

### 1.2 RequestManagerRetriever.get

`RequestManagerRetriever.get`方法与`Glide.with`一样，也有很多重载方法：

```java
@NonNull
private RequestManager getApplicationManager(@NonNull Context context) {
  // Either an application context or we're on a background thread.
  if (applicationManager == null) {
    synchronized (this) {
      if (applicationManager == null) {
        // Normally pause/resume is taken care of by the fragment we add to the fragment or
        // activity. However, in this case since the manager attached to the application will not
        // receive lifecycle events, we must force the manager to start resumed using
        // ApplicationLifecycle.

        // TODO(b/27524013): Factor out this Glide.get() call.
        Glide glide = Glide.get(context.getApplicationContext());
        applicationManager =
            factory.build(
                glide,
                new ApplicationLifecycle(),
                new EmptyRequestManagerTreeNode(),
                context.getApplicationContext());
      }
    }
  }

  return applicationManager;
}

@NonNull
public RequestManager get(@NonNull Context context) {
  if (context == null) {
    throw new IllegalArgumentException("You cannot start a load on a null Context");
  } else if (Util.isOnMainThread() && !(context instanceof Application)) {
    if (context instanceof FragmentActivity) {
      return get((FragmentActivity) context);
    } else if (context instanceof Activity) {
      return get((Activity) context);
    } else if (context instanceof ContextWrapper) {
      return get(((ContextWrapper) context).getBaseContext());
    }
  }

  return getApplicationManager(context);
}

@NonNull
public RequestManager get(@NonNull FragmentActivity activity) {
  if (Util.isOnBackgroundThread()) {
    return get(activity.getApplicationContext());
  } else {
    assertNotDestroyed(activity);
    FragmentManager fm = activity.getSupportFragmentManager();
    return supportFragmentGet(
        activity, fm, /*parentHint=*/ null, isActivityVisible(activity));
  }
}

@NonNull
public RequestManager get(@NonNull Fragment fragment) {
  Preconditions.checkNotNull(fragment.getActivity(),
        "You cannot start a load on a fragment before it is attached or after it is destroyed");
  if (Util.isOnBackgroundThread()) {
    return get(fragment.getActivity().getApplicationContext());
  } else {
    FragmentManager fm = fragment.getChildFragmentManager();
    return supportFragmentGet(fragment.getActivity(), fm, fragment, fragment.isVisible());
  }
}

@SuppressWarnings("deprecation")
@NonNull
public RequestManager get(@NonNull Activity activity) {
  if (Util.isOnBackgroundThread()) {
    return get(activity.getApplicationContext());
  } else {
    assertNotDestroyed(activity);
    android.app.FragmentManager fm = activity.getFragmentManager();
    return fragmentGet(
        activity, fm, /*parentHint=*/ null, isActivityVisible(activity));
  }
}

@SuppressWarnings("deprecation")
@NonNull
public RequestManager get(@NonNull View view) {
  if (Util.isOnBackgroundThread()) {
    return get(view.getContext().getApplicationContext());
  }

  Preconditions.checkNotNull(view);
  Preconditions.checkNotNull(view.getContext(),
      "Unable to obtain a request manager for a view without a Context");
  Activity activity = findActivity(view.getContext());
  // The view might be somewhere else, like a service.
  if (activity == null) {
    return get(view.getContext().getApplicationContext());
  }

  // Support Fragments.
  // Although the user might have non-support Fragments attached to FragmentActivity, searching
  // for non-support Fragments is so expensive pre O and that should be rare enough that we
  // prefer to just fall back to the Activity directly.
  if (activity instanceof FragmentActivity) {
    Fragment fragment = findSupportFragment(view, (FragmentActivity) activity);
    return fragment != null ? get(fragment) : get(activity);
  }

  // Standard Fragments.
  android.app.Fragment fragment = findFragment(view, activity);
  if (fragment == null) {
    return get(activity);
  }
  return get(fragment);
}
```

在这些`get`方法中，**首先判断当前线程是不是后台线程**，如果是后台线程那么就会调用`getApplicationManager`方法返回一个`RequestManager`：

```java
Glide glide = Glide.get(context.getApplicationContext());
applicationManager =
    factory.build(
        glide,
        new ApplicationLifecycle(),
        new EmptyRequestManagerTreeNode(),
        context.getApplicationContext());
```

由于此处`factory`是`DEFAULT_FACTORY`，所以`RequestManager`就是下面的值：

```java
RequestManager(glide,
        new ApplicationLifecycle(),
        new EmptyRequestManagerTreeNode(),
        context.getApplicationContext());
```

**如果当前线程不是后台线程**，`get(View)`和`get(Context)`会根据情况调用`get(Fragment)`或`get(FragmentActivity)`。其中`get(View)`为了找到一个合适的`Fragment`或fallback `Activity`，内部操作比较多，开销比较大，不要轻易使用。

`get(Fragment)`和`get(FragmentActivity)`方法都会调用`supportFragmentGet`方法，只是传入参数不同：

```java
// FragmentActivity activity
FragmentManager fm = activity.getSupportFragmentManager();
supportFragmentGet(activity, fm, /*parentHint=*/ null, isActivityVisible(activity));

// Fragment fragment
FragmentManager fm = fragment.getChildFragmentManager();
supportFragmentGet(fragment.getActivity(), fm, fragment, fragment.isVisible());
```

> Glide会使用一个加载目标所在的宿主Activity或Fragment的子`Fragment`来安全保存一个`RequestManager`，而`RequestManager`被Glide用来开始、停止、管理Glide请求。

而`supportFragmentGet`就是创建/获取这个`SupportRequestManagerFragment`，并返回其持有的`RequestManager`的方法。

```java
@NonNull
private RequestManager supportFragmentGet(
    @NonNull Context context,
    @NonNull FragmentManager fm,
    @Nullable Fragment parentHint,
    boolean isParentVisible) {
  // 🐟🐟🐟获取一个SupportRequestManagerFragment
  SupportRequestManagerFragment current =
      getSupportRequestManagerFragment(fm, parentHint, isParentVisible);
  // 获取里面的RequestManager对象
  RequestManager requestManager = current.getRequestManager();
  // 若没有，则创建一个
  if (requestManager == null) {
    // TODO(b/27524013): Factor out this Glide.get() call.
    Glide glide = Glide.get(context);
    // 🔥🔥🔥
    requestManager =
        factory.build(
            glide, current.getGlideLifecycle(), current.getRequestManagerTreeNode(), context);
    // 设置到SupportRequestManagerFragment里面，下次就不需要创建了
    current.setRequestManager(requestManager);
  }
  return requestManager;
}

// 🐟🐟🐟看看Fragment怎么才能高效
@NonNull
private SupportRequestManagerFragment getSupportRequestManagerFragment(
    @NonNull final FragmentManager fm, @Nullable Fragment parentHint, boolean isParentVisible) {      
  // 已经添加过了，可以直接返回
  SupportRequestManagerFragment current =
      (SupportRequestManagerFragment) fm.findFragmentByTag(FRAGMENT_TAG);
  if (current == null) {
    // 从map中获取，取到也可以返回了
    current = pendingSupportRequestManagerFragments.get(fm);
    if (current == null) {
      // 都没有，那么就创建一个，此时lifecycle默认为ActivityFragmentLifecycle
      current = new SupportRequestManagerFragment();
      // 对于fragment来说，此方法会以Activity为host创建另外一个SupportRequestManagerFragment
      // 作为rootRequestManagerFragment
      // 并会将current加入到rootRequestManagerFragment的childRequestManagerFragments中
      // 在RequestManager递归管理请求时会使用到
      current.setParentFragmentHint(parentHint);
      // 如果当前页面是可见的，那么调用其lifecycle的onStart方法
      if (isParentVisible) {
        current.getGlideLifecycle().onStart();
      }
      // 将刚创建的fragment缓存起来
      pendingSupportRequestManagerFragments.put(fm, current);
      // 将fragment添加到页面中
      fm.beginTransaction().add(current, FRAGMENT_TAG).commitAllowingStateLoss();
      // 以fm为key从pendingSupportRequestManagerFragments中删除
      handler.obtainMessage(ID_REMOVE_SUPPORT_FRAGMENT_MANAGER, fm).sendToTarget();
    }
  }
  return current;
}
```

🔥🔥🔥在上面的`supportFragmentGet`方法中，成功创建了一个`RequestManager`对象，由于`factory`是`DEFAULT_FACTORY`，所以就是下面的值：

```java
RequestManager(glide,
  current.getGlideLifecycle(),          // ActivityFragmentLifecycle()
  current.getRequestManagerTreeNode(),  // SupportFragmentRequestManagerTreeNode()
  context);
```

好👏👏👏，在上一步中`Glide`单例完成了初始化，这一步中成功的创建并返回了一个`RequestManager`。`Glide.with`已经分析完毕。

## 2. RequestManager.load

`RequestManager.load`方法的重载也很多，但该方法只是设置了一些值而已，并没有做一些很重的工作。

因为这里涉及到类有点绕，所以在正式探索之前，我们看一下相关的类的UML图：

<figure style="width: 66%" class="align-center">
    <img src="/assets/images/android/glide-request-options-uml.png">
    <figcaption>RequestOptions相关UML图</figcaption>
</figure>

这里我们可以看出来`RequestBuilder`和`RequestOptions`都派生自抽象类`BaseRequestOptions`。

下面我们看一下`RequestManager`的一些方法，先看`load`的一些重载方法：

```java
@NonNull
@CheckResult
@Override
public RequestBuilder<Drawable> load(@Nullable Bitmap bitmap) {
  return asDrawable().load(bitmap);
}

@NonNull
@CheckResult
@Override
public RequestBuilder<Drawable> load(@Nullable Drawable drawable) {
  return asDrawable().load(drawable);
}

@NonNull
@CheckResult
@Override
public RequestBuilder<Drawable> load(@Nullable String string) {
  return asDrawable().load(string);
}

@NonNull
@CheckResult
@Override
public RequestBuilder<Drawable> load(@Nullable Uri uri) {
  return asDrawable().load(uri);
}

@NonNull
@CheckResult
@Override
public RequestBuilder<Drawable> load(@Nullable File file) {
  return asDrawable().load(file);
}

@SuppressWarnings("deprecation")
@NonNull
@CheckResult
@Override
public RequestBuilder<Drawable> load(@RawRes @DrawableRes @Nullable Integer resourceId) {
  return asDrawable().load(resourceId);
}

@SuppressWarnings("deprecation")
@CheckResult
@Override
@Deprecated
public RequestBuilder<Drawable> load(@Nullable URL url) {
  return asDrawable().load(url);
}

@NonNull
@CheckResult
@Override
public RequestBuilder<Drawable> load(@Nullable byte[] model) {
  return asDrawable().load(model);
}

@NonNull
@CheckResult
@Override
public RequestBuilder<Drawable> load(@Nullable Object model) {
  return asDrawable().load(model);
}
```

在所有的`RequestManager.load`方法中都会先调用`asDrawable()`方法得到一个`RequestBuilder`对象，然后再调用`RequestBuilder.load`方法。  

### 2.1 RequestManager.asXxx

`asDrawable`方法同其他as方法（`asGif`、`asBitmap`、`asFile`）一样，都会先调用`RequestManager.as`方法生成一个`RequestBuilder<ResourceType>`对象，然后各个as方法会附加一些不同的options：

```java
@NonNull
@CheckResult
public RequestBuilder<Bitmap> asBitmap() {
  return as(Bitmap.class).apply(DECODE_TYPE_BITMAP);
}

@NonNull
@CheckResult
public RequestBuilder<GifDrawable> asGif() {
  return as(GifDrawable.class).apply(DECODE_TYPE_GIF);
}  

@NonNull
@CheckResult
public RequestBuilder<Drawable> asDrawable() {
  return as(Drawable.class);
}

@NonNull
@CheckResult
public RequestBuilder<File> asFile() {
  return as(File.class).apply(skipMemoryCacheOf(true));
}

@NonNull
@CheckResult
public <ResourceType> RequestBuilder<ResourceType> as(
    @NonNull Class<ResourceType> resourceClass) {
  return new RequestBuilder<>(glide, this, resourceClass, context);
}
```

在`RequestBuilder`的构造器方法方法中将`Drawable.class`这样的入参保存到了`transcodeClass`变量中：

```java
@SuppressLint("CheckResult")
@SuppressWarnings("PMD.ConstructorCallsOverridableMethod")
protected RequestBuilder(
    @NonNull Glide glide,
    RequestManager requestManager,
    Class<TranscodeType> transcodeClass,
    Context context) {
  this.glide = glide;
  this.requestManager = requestManager;
  this.transcodeClass = transcodeClass;
  this.context = context;
  this.transitionOptions = requestManager.getDefaultTransitionOptions(transcodeClass);
  this.glideContext = glide.getGlideContext();

  initRequestListeners(requestManager.getDefaultRequestListeners());
  apply(requestManager.getDefaultRequestOptions());
}
```

然后回到之前的`asGif`方法中，看看`apply(DECODE_TYPE_BITMAP)`干了些什么：

```java
// RequestManager
private static final RequestOptions DECODE_TYPE_GIF = RequestOptions.decodeTypeOf(GifDrawable.class).lock();

@NonNull
@CheckResult
public RequestBuilder<GifDrawable> asGif() {
  return as(GifDrawable.class).apply(DECODE_TYPE_GIF);
}

// RequestOptions
@NonNull
@CheckResult
public static RequestOptions decodeTypeOf(@NonNull Class<?> resourceClass) {
  return new RequestOptions().decode(resourceClass);
}

// BaseRequestOptions
@NonNull
@CheckResult
public T decode(@NonNull Class<?> resourceClass) {
  if (isAutoCloneEnabled) {
    return clone().decode(resourceClass);
  }

  this.resourceClass = Preconditions.checkNotNull(resourceClass);
  fields |= RESOURCE_CLASS;
  return selfOrThrowIfLocked();
}

@NonNull
@CheckResult
public T apply(@NonNull BaseRequestOptions<?> o) {
  if (isAutoCloneEnabled) {
    return clone().apply(o);
  }
  BaseRequestOptions<?> other = o;
  ...
  if (isSet(other.fields, RESOURCE_CLASS)) {
    resourceClass = other.resourceClass;
  }
  ...
  return selfOrThrowIfLocked();
}

// RequestBuilder
@NonNull
@CheckResult
@Override
public RequestBuilder<TranscodeType> apply(@NonNull BaseRequestOptions<?> requestOptions) {
  Preconditions.checkNotNull(requestOptions);
  return super.apply(requestOptions);
}
```

不难发现，`apply(DECODE_TYPE_BITMAP)`就是将`BaseRequestOptions.resourceClass`设置为了`GifDrawable.class`；对于`asBitmap()`来说，`resourceClass`为`Bitmap.class`；而对于`asDrawable()`和`asFile()`来说，`resourceClass`没有进行过设置，所以为默认值`Object.class`。

现在`RequestBuilder`已经由as系列方法生成，现在接着会调用`RequestBuilder.load`方法

### 2.2 RequestBuilder.load

`RequestManager.load`方法都会调用对应的`RequestBuilder.load`重载方法；`RequestBuilder.load`的各个方法基本上都会直接转发给`loadGeneric`方法，只有少数的方法才会apply额外的options。

`loadGeneric`方法也只是保存一下参数而已：

```java
@NonNull
@CheckResult
@SuppressWarnings("unchecked")
@Override
public RequestBuilder<TranscodeType> load(@Nullable Object model) {
  return loadGeneric(model);
}

@NonNull
@CheckResult
@Override
public RequestBuilder<TranscodeType> load(@Nullable Bitmap bitmap) {
  return loadGeneric(bitmap)
      .apply(diskCacheStrategyOf(DiskCacheStrategy.NONE));
}

@NonNull
@CheckResult
@Override
public RequestBuilder<TranscodeType> load(@Nullable Drawable drawable) {
  return loadGeneric(drawable)
      .apply(diskCacheStrategyOf(DiskCacheStrategy.NONE));
}

@NonNull
@CheckResult
@Override
public RequestBuilder<TranscodeType> load(@Nullable Uri uri) {
  return loadGeneric(uri);
}

@NonNull
@CheckResult
@Override
public RequestBuilder<TranscodeType> load(@Nullable File file) {
  return loadGeneric(file);
}

@NonNull
@CheckResult
@Override
public RequestBuilder<TranscodeType> load(@RawRes @DrawableRes @Nullable Integer resourceId) {
  return loadGeneric(resourceId).apply(signatureOf(ApplicationVersionSignature.obtain(context)));
}

@Deprecated
@CheckResult
@Override
public RequestBuilder<TranscodeType> load(@Nullable URL url) {
  return loadGeneric(url);
}

@NonNull
@CheckResult
@Override
public RequestBuilder<TranscodeType> load(@Nullable byte[] model) {
  RequestBuilder<TranscodeType> result = loadGeneric(model);
  if (!result.isDiskCacheStrategySet()) {
      result = result.apply(diskCacheStrategyOf(DiskCacheStrategy.NONE));
  }
  if (!result.isSkipMemoryCacheSet()) {
    result = result.apply(skipMemoryCacheOf(true /*skipMemoryCache*/));
  }
  return result;
}

@NonNull
private RequestBuilder<TranscodeType> loadGeneric(@Nullable Object model) {
  this.model = model;
  isModelSet = true;
  return this;
}
```

如上面最后的方法`loadGeneric`，这里只是将参数保存在`model`中并设置`isModelSet=true`就完了，看来Glide进行图片加载的最核心的步骤应该就是`RequestBuilder.into`方法了。

## 3. RequestBuilder.into

Glide三步中前两步还是比较简单的，真正令人头大的位置就是本节要深入探索的`into`方法了。因为Glide各种配置相当多，各种分支全部列出来还是相当繁琐的，而且一次性全部看完也是不可能的。所以此处只探索最基本的源码。

`RequestBuilder.into`有四个重载方法，最终都调用了参数最多的一个：

```java
@NonNull
public <Y extends Target<TranscodeType>> Y into(@NonNull Y target) {
  return into(target, /*targetListener=*/ null, Executors.mainThreadExecutor());
}

@NonNull
@Synthetic
<Y extends Target<TranscodeType>> Y into(
    @NonNull Y target,
    @Nullable RequestListener<TranscodeType> targetListener,
    Executor callbackExecutor) {
  return into(target, targetListener, /*options=*/ this, callbackExecutor);
}

private <Y extends Target<TranscodeType>> Y into(
    @NonNull Y target,
    @Nullable RequestListener<TranscodeType> targetListener,
    BaseRequestOptions<?> options,
    Executor callbackExecutor) {
  ... //见后文分解
}

// 🤚🤚🤚 这是我们最常用的一个重载
@NonNull
public ViewTarget<ImageView, TranscodeType> into(@NonNull ImageView view) {
  // sanity check
  Util.assertMainThread();
  Preconditions.checkNotNull(view);

  BaseRequestOptions<?> requestOptions = this;
  // isTransformationSet()在第一次运行肯定为false，该值可能会在if里面被设置
  // isTransformationAllowed()一般为true，除非主动调用了dontTransform()方法
  if (!requestOptions.isTransformationSet()
      && requestOptions.isTransformationAllowed()
      && view.getScaleType() != null) {
    // Clone in this method so that if we use this RequestBuilder to load into a View and then
    // into a different target, we don't retain the transformation applied based on the previous
    // View's scale type.
    // 
    // 根据ImageView的ScaleType设置不同的down sample和transform选项
    switch (view.getScaleType()) {
      case CENTER_CROP:
        requestOptions = requestOptions.clone().optionalCenterCrop();
        break;
      case CENTER_INSIDE:
        requestOptions = requestOptions.clone().optionalCenterInside();
        break;
      case FIT_CENTER:  // 默认值
      case FIT_START:
      case FIT_END:
        requestOptions = requestOptions.clone().optionalFitCenter();
        break;
      case FIT_XY:
        requestOptions = requestOptions.clone().optionalCenterInside();
        break;
      case CENTER:
      case MATRIX:
      default:
        // Do nothing.
    }
  }

  // 调用上面的重载方法
  return into(
      glideContext.buildImageViewTarget(view, transcodeClass),
      /*targetListener=*/ null,
      requestOptions,
      Executors.mainThreadExecutor());
}
```

我们看看`into(ImageView)`方法的实现，里面会先判断需不需要对图片进行裁切，然后调用别的`into`重载方法。重载方法我们稍后在说，先看看case为默认值`FIT_CENTER`时的情况：

首先会调用`requestOptions.clone()`对原始的RequestOptions进行复制，其目的源码中写了：当使用此RequestOptions加载到一个View，然后加载到另外一个目标时，不要保留基于上一个View的scale type所产生的transformation。  

复制完成之后，然后会接着调用`optionalFitCenter()`方法：

```java
@NonNull
@CheckResult
public T optionalFitCenter() {
  return optionalScaleOnlyTransform(DownsampleStrategy.FIT_CENTER, new FitCenter());
}

@NonNull
private T optionalScaleOnlyTransform(
    @NonNull DownsampleStrategy strategy, @NonNull Transformation<Bitmap> transformation) {
  return scaleOnlyTransform(strategy, transformation, false /*isTransformationRequired*/);
}

@SuppressWarnings("unchecked")
@NonNull
private T scaleOnlyTransform(
    @NonNull DownsampleStrategy strategy,
    @NonNull Transformation<Bitmap> transformation,
    boolean isTransformationRequired) {
  BaseRequestOptions<T> result = isTransformationRequired
        ? transform(strategy, transformation) : optionalTransform(strategy, transformation);
  result.isScaleOnlyOrNoTransform = true;
  return (T) result;
}

@SuppressWarnings({"WeakerAccess", "CheckResult"})
@NonNull
final T optionalTransform(@NonNull DownsampleStrategy downsampleStrategy,
    @NonNull Transformation<Bitmap> transformation) {
  // isAutoCloneEnabled默认为false，只有在主动调用了autoClone()方法之后才会为true
  if (isAutoCloneEnabled) {
    return clone().optionalTransform(downsampleStrategy, transformation);
  }

  downsample(downsampleStrategy);
  return transform(transformation, /*isRequired=*/ false);
}

@NonNull
@CheckResult
public T downsample(@NonNull DownsampleStrategy strategy) {
  return set(DownsampleStrategy.OPTION, Preconditions.checkNotNull(strategy));
}

@NonNull
@CheckResult
public <Y> T set(@NonNull Option<Y> option, @NonNull Y value) {
  if (isAutoCloneEnabled) {
    return clone().set(option, value);
  }

  Preconditions.checkNotNull(option);
  Preconditions.checkNotNull(value);
  options.set(option, value);
  return selfOrThrowIfLocked();
}

@NonNull
T transform(
    @NonNull Transformation<Bitmap> transformation, boolean isRequired) {
  if (isAutoCloneEnabled) {
    return clone().transform(transformation, isRequired);
  }

  DrawableTransformation drawableTransformation =
      new DrawableTransformation(transformation, isRequired);
  transform(Bitmap.class, transformation, isRequired);
  transform(Drawable.class, drawableTransformation, isRequired);
  // TODO: remove BitmapDrawable decoder and this transformation.
  // Registering as BitmapDrawable is simply an optimization to avoid some iteration and
  // isAssignableFrom checks when obtaining the transformation later on. It can be removed without
  // affecting the functionality.
  transform(BitmapDrawable.class, drawableTransformation.asBitmapDrawable(), isRequired);
  transform(GifDrawable.class, new GifDrawableTransformation(transformation), isRequired);
  return selfOrThrowIfLocked();
}

@NonNull
<Y> T transform(
    @NonNull Class<Y> resourceClass,
    @NonNull Transformation<Y> transformation,
    boolean isRequired) {
  if (isAutoCloneEnabled) {
    return clone().transform(resourceClass, transformation, isRequired);
  }

  Preconditions.checkNotNull(resourceClass);
  Preconditions.checkNotNull(transformation);
  transformations.put(resourceClass, transformation);
  fields |= TRANSFORMATION;
  isTransformationAllowed = true;
  fields |= TRANSFORMATION_ALLOWED;
  // Always set to false here. Known scale only transformations will call this method and then
  // set isScaleOnlyOrNoTransform to true immediately after.
  isScaleOnlyOrNoTransform = false;
  if (isRequired) {
    fields |= TRANSFORMATION_REQUIRED;
    isTransformationRequired = true;
  }
  return selfOrThrowIfLocked();
}
```

上面这些操作实际上只是几个值保存到`BaseRequestOptions`内部的两个`CachedHashCodeArrayMap`里面，其中键值对以及保存到的位置如下：

<figcaption>optionalFitCenter()过程保存的KV</figcaption>

| 保存的位置 | K | V |
| -------- | - | - |
| Options.values | DownsampleStrategy.OPTION | DownsampleStrategy.FitCenter() |
| transformations | Bitmap.class | FitCenter() |
| transformations | Drawable.class | DrawableTransformation(FitCenter(), false) |
| transformations | BitmapDrawable.class | DrawableTransformation(FitCenter(), false).asBitmapDrawable() |
| transformations | GifDrawable.class | GifDrawableTransformation(FitCenter()) |

将KV保存好了之后，就准备调用最终的`into`方法了，我们看一下入参：

```java
into(
    glideContext.buildImageViewTarget(view, transcodeClass),
    /*targetListener=*/ null,
    requestOptions,
    Executors.mainThreadExecutor());
```

第一个参数等于`(ViewTarget<ImageView, Drawable>) new DrawableImageViewTarget(view)`：

```java
// GlideContext
@NonNull
public <X> ViewTarget<ImageView, X> buildImageViewTarget(
    @NonNull ImageView imageView, @NonNull Class<X> transcodeClass) {
  // imageViewTargetFactory是ImageViewTargetFactory的一个实例
  // transcodeClass在RequestManager.load方法中确定了，就是Drawable.class
  return imageViewTargetFactory.buildTarget(imageView, transcodeClass);
}

// ImageViewTargetFactory
@NonNull
@SuppressWarnings("unchecked")
public <Z> ViewTarget<ImageView, Z> buildTarget(@NonNull ImageView view,
    @NonNull Class<Z> clazz) {
  if (Bitmap.class.equals(clazz)) {
    return (ViewTarget<ImageView, Z>) new BitmapImageViewTarget(view);
  } else if (Drawable.class.isAssignableFrom(clazz)) {
    // 返回的是(ViewTarget<ImageView, Drawable>) new DrawableImageViewTarget(view);
    return (ViewTarget<ImageView, Z>) new DrawableImageViewTarget(view);
  } else {
    throw new IllegalArgumentException(
        "Unhandled class: " + clazz + ", try .as*(Class).transcode(ResourceTranscoder)");
  }
}
```

`Executors.mainThreadExecutor()`就是一个使用MainLooper的Handler，在execute Runnable时使用此Handler post出去。

```java
  /** Posts executions to the main thread. */
  public static Executor mainThreadExecutor() {
    return MAIN_THREAD_EXECUTOR;
  }

  private static final Executor MAIN_THREAD_EXECUTOR =
      new Executor() {
        private final Handler handler = new Handler(Looper.getMainLooper());

        @Override
        public void execute(@NonNull Runnable command) {
          handler.post(command);
        }
      };
```

现在我们终于回到了最终的`load`重载方法：

```java
private <Y extends Target<TranscodeType>> Y into(
    @NonNull Y target,
    @Nullable RequestListener<TranscodeType> targetListener,
    BaseRequestOptions<?> options,
    Executor callbackExecutor) {
  // sanity check
  Preconditions.checkNotNull(target);
  if (!isModelSet) {
    throw new IllegalArgumentException("You must call #load() before calling #into()");
  }

  // 创建了一个SingleRequest，见后面️⛰️⛰️⛰️
  Request request = buildRequest(target, targetListener, options, callbackExecutor);

  // 这里会判断需不需要重新开始任务
  // 如果当前request和target上之前的request previous相等
  // 且设置了忽略内存缓存或previous还没有完成
  // 那么会进入if分支，无需进行一些相关设置，这是一个很好的优化
  Request previous = target.getRequest();
  if (request.isEquivalentTo(previous)
      && !isSkipMemoryCacheWithCompletePreviousRequest(options, previous)) {
    request.recycle();
    // If the request is completed, beginning again will ensure the result is re-delivered,
    // triggering RequestListeners and Targets. If the request is failed, beginning again will
    // restart the request, giving it another chance to complete. If the request is already
    // running, we can let it continue running without interruption.
    // 如果正在运行，就不管它；如果已经失败了，就重新开始
    if (!Preconditions.checkNotNull(previous).isRunning()) {
      // Use the previous request rather than the new one to allow for optimizations like skipping
      // setting placeholders, tracking and un-tracking Targets, and obtaining View dimensions
      // that are done in the individual Request.
      previous.begin();
    }
    return target;
  }

  // 如果不能复用previous
  // 先清除target上之前的Request
  requestManager.clear(target);
  // 将Request作为tag设置到view中
  target.setRequest(request);
  // 😷😷😷 真正开始网络图片的加载
  requestManager.track(target, request);

  return target;
}
```

### 3.1 buildRequest

⛰️⛰️⛰️ 这里跟踪一下`buildRequest`的流程，看看是如何创建出`SingleRequest`的。

```java
private Request buildRequest(
    Target<TranscodeType> target,
    @Nullable RequestListener<TranscodeType> targetListener,
    BaseRequestOptions<?> requestOptions,
    Executor callbackExecutor) {
  return buildRequestRecursive(
      target,
      targetListener,                       // null
      /*parentCoordinator=*/ null,
      transitionOptions,
      requestOptions.getPriority(),         // Priority.NORMAL
      requestOptions.getOverrideWidth(),    // UNSET
      requestOptions.getOverrideHeight(),   // UNSET
      requestOptions,
      callbackExecutor);                    // Executors.mainThreadExecutor()
}

private Request buildRequestRecursive(
    Target<TranscodeType> target,
    @Nullable RequestListener<TranscodeType> targetListener,
    @Nullable RequestCoordinator parentCoordinator,
    TransitionOptions<?, ? super TranscodeType> transitionOptions,
    Priority priority,
    int overrideWidth,
    int overrideHeight,
    BaseRequestOptions<?> requestOptions,
    Executor callbackExecutor) {

  // Build the ErrorRequestCoordinator first if necessary so we can update parentCoordinator.
  ErrorRequestCoordinator errorRequestCoordinator = null;
  // errorBuilder为null, skip
  // 因此errorRequestCoordinator为null
  if (errorBuilder != null) {
    errorRequestCoordinator = new ErrorRequestCoordinator(parentCoordinator);
    parentCoordinator = errorRequestCoordinator;
  }

  // 如何获得SingleRequest
  Request mainRequest =
      buildThumbnailRequestRecursive(
          target,
          targetListener,       // null
          parentCoordinator,    // null
          transitionOptions,
          priority,
          overrideWidth,
          overrideHeight,
          requestOptions,
          callbackExecutor);

  // errorRequestCoordinator为null
  if (errorRequestCoordinator == null) {
    return mainRequest;
  }
  ...
}

private Request buildThumbnailRequestRecursive(
    Target<TranscodeType> target,
    RequestListener<TranscodeType> targetListener,
    @Nullable RequestCoordinator parentCoordinator,
    TransitionOptions<?, ? super TranscodeType> transitionOptions,
    Priority priority,
    int overrideWidth,
    int overrideHeight,
    BaseRequestOptions<?> requestOptions,
    Executor callbackExecutor) {
  // thumbnail重载方法没有调用过，所以会走最后的else case
  if (thumbnailBuilder != null) {
    ...
  } else if (thumbSizeMultiplier != null) {
    ...
  } else {
    // Base case: no thumbnail.
    return obtainRequest(
        target,
        targetListener,
        requestOptions,
        parentCoordinator,
        transitionOptions,
        priority,
        overrideWidth,
        overrideHeight,
        callbackExecutor);
  }
}

private Request obtainRequest(
    Target<TranscodeType> target,
    RequestListener<TranscodeType> targetListener,
    BaseRequestOptions<?> requestOptions,
    RequestCoordinator requestCoordinator,
    TransitionOptions<?, ? super TranscodeType> transitionOptions,
    Priority priority,
    int overrideWidth,
    int overrideHeight,
    Executor callbackExecutor) {
  return SingleRequest.obtain(
      context,
      glideContext,
      model,
      transcodeClass,
      requestOptions,
      overrideWidth,
      overrideHeight,
      priority,
      target,
      targetListener,
      requestListeners,
      requestCoordinator,
      glideContext.getEngine(),
      transitionOptions.getTransitionFactory(),
      callbackExecutor);
}
```

`SingleRequest`的初始状态为`Status.PENDING`。

### 3.2 RequestManager.track

😷😷😷下面开始分析`RequestManager.track`的流程

```java
synchronized void track(@NonNull Target<?> target, @NonNull Request request) {
  targetTracker.track(target);
  requestTracker.runRequest(request);
}
```

在这里面，`targetTracker`成员变量在声明的时候直接初始化为`TargetTracker`类的无参数实例，该类的作用是保存所有的Target并向它们转发生命周期事件；`requestTracker`在`RequestManager`的构造器中传入了`new RequestTracker()`，该类的作用管理所有状态的请求。

`targetTracker.track(target)`将target保存到了内部的`targets`中：

```java
private final Set<Target<?>> targets =
    Collections.newSetFromMap(new WeakHashMap<Target<?>, Boolean>());

public void track(@NonNull Target<?> target) {
  targets.add(target);
}
```

下面看看`requestTracker.runRequest(request)`干了什么：

```java
/**
  * Starts tracking the given request.
  */
public void runRequest(@NonNull Request request) {
  requests.add(request);
  if (!isPaused) {
    request.begin();
  } else {
    request.clear();
    if (Log.isLoggable(TAG, Log.VERBOSE)) {
      Log.v(TAG, "Paused, delaying request");
    }
    pendingRequests.add(request);
  }
}
```

`isPaused`默认为false，只有调用了`RequestTracker.pauseRequests`或`RequestTracker.pauseAllRequests`后才会为true。  
因此，下面会执行`request.begin()`方法。上面说到过，这里的request实际上是`SingleRequest`对象，我们看一下它的`begin()`方法。

```java
@Override
public synchronized void begin() {
  // sanity check
  assertNotCallingCallbacks();
  stateVerifier.throwIfRecycled();
  startTime = LogTime.getLogTime();
  // 如果model为空，会调用监听器的onLoadFailed处理
  // 若无法处理，则展示失败时的占位图
  if (model == null) {
    if (Util.isValidDimensions(overrideWidth, overrideHeight)) {
      width = overrideWidth;
      height = overrideHeight;
    }
    // Only log at more verbose log levels if the user has set a fallback drawable, because
    // fallback Drawables indicate the user expects null models occasionally.
    int logLevel = getFallbackDrawable() == null ? Log.WARN : Log.DEBUG;
    onLoadFailed(new GlideException("Received null model"), logLevel);
    return;
  }

  if (status == Status.RUNNING) {
    throw new IllegalArgumentException("Cannot restart a running request");
  }

  // If we're restarted after we're complete (usually via something like a notifyDataSetChanged
  // that starts an identical request into the same Target or View), we can simply use the
  // resource and size we retrieved the last time around and skip obtaining a new size, starting a
  // new load etc. This does mean that users who want to restart a load because they expect that
  // the view size has changed will need to explicitly clear the View or Target before starting
  // the new load.
  // 
  // 如果我们在请求完成后想重新开始加载，那么就会返回已经加载好的资源
  // 如果由于view尺寸的改变，我们的确需要重新来加载，此时我们需要明确地清除View或Target
  if (status == Status.COMPLETE) {
    onResourceReady(resource, DataSource.MEMORY_CACHE);
    return;
  }

  // Restarts for requests that are neither complete nor running can be treated as new requests
  // and can run again from the beginning.
  // 
  // 请求岂没有完成也没有在运行，就当作新请求来对待。此时可以从beginning开始运行

  // 如果指定了overrideWidth和overrideHeight，那么直接调用onSizeReady方法
  // 否则会获取ImageView的宽、高，然后调用onSizeReady方法
  // 在该方法中会创建图片加载的Job并开始执行
  status = Status.WAITING_FOR_SIZE;
  if (Util.isValidDimensions(overrideWidth, overrideHeight)) {
    onSizeReady(overrideWidth, overrideHeight);
  } else {
    target.getSize(this);
  }

  // 显示加载中的占位符
  if ((status == Status.RUNNING || status == Status.WAITING_FOR_SIZE)
      && canNotifyStatusChanged()) {
    target.onLoadStarted(getPlaceholderDrawable());
  }
  if (IS_VERBOSE_LOGGABLE) {
    logV("finished run method in " + LogTime.getElapsedMillis(startTime));
  }
}
```

`begin`方法可以分为几个大步骤，每个步骤的用途已经在代码中进行注释了。

跟着代码，我们先看一下`model = null`时，`onLoadFailed(new GlideException("Received null model"), logLevel);`干了什么：

```java
private synchronized void onLoadFailed(GlideException e, int maxLogLevel) {
  stateVerifier.throwIfRecycled();
  e.setOrigin(requestOrigin);
  int logLevel = glideContext.getLogLevel();
  if (logLevel <= maxLogLevel) {
    Log.w(GLIDE_TAG, "Load failed for " + model + " with size [" + width + "x" + height + "]", e);
    if (logLevel <= Log.INFO) {
      e.logRootCauses(GLIDE_TAG);
    }
  }

  // 设置状态为Status.FAILED
  loadStatus = null;
  status = Status.FAILED;

  isCallingCallbacks = true;
  try {
    //TODO: what if this is a thumbnail request?
    // 尝试调用各个listener的onLoadFailed回调进行处理
    boolean anyListenerHandledUpdatingTarget = false;
    if (requestListeners != null) {
      for (RequestListener<R> listener : requestListeners) {
        anyListenerHandledUpdatingTarget |=
            listener.onLoadFailed(e, model, target, isFirstReadyResource());
      }
    }
    anyListenerHandledUpdatingTarget |=
        targetListener != null
            && targetListener.onLoadFailed(e, model, target, isFirstReadyResource());

    // 如果没有一个回调能够处理，那么显示失败占位符
    if (!anyListenerHandledUpdatingTarget) {
      setErrorPlaceholder();
    }
  } finally {
    isCallingCallbacks = false;
  }

  // 通知requestCoordinator，此请求失败
  notifyLoadFailed();
}

private void notifyLoadFailed() {
  if (requestCoordinator != null) {
    requestCoordinator.onRequestFailed(this);
  }
}
```

看一下`setErrorPlaceholder`中显示失败占位符的逻辑：

```java
private synchronized void setErrorPlaceholder() {
  if (!canNotifyStatusChanged()) {
    return;
  }

  Drawable error = null;
  if (model == null) {
    error = getFallbackDrawable();
  }
  // Either the model isn't null, or there was no fallback drawable set.
  if (error == null) {
    error = getErrorDrawable();
  }
  // The model isn't null, no fallback drawable was set or no error drawable was set.
  if (error == null) {
    error = getPlaceholderDrawable();
  }
  target.onLoadFailed(error);
}
```

这里的`target`是`DrawableImageViewTarget`类型，`onLoadFailed`方法的逻辑实现在其父类`ImageViewTarget`中：

```java
@Override
public void onLoadFailed(@Nullable Drawable errorDrawable) {
  super.onLoadFailed(errorDrawable);
  setResourceInternal(null);
  setDrawable(errorDrawable);
}

@Override
public void setDrawable(Drawable drawable) {
  view.setImageDrawable(drawable);
}
```

显而易见，当model为null时，失败占位符的显示逻辑如下：

1. 如果设置了fallback，那么显示fallback
2. 否则，如果设置了error，那么显示error
3. 否则，如果设置了placeholder，那么显示placeholder

> 这也证明了[Glide v4 源码解析（一）--- 占位符](/android/glide1/#21-占位符)中，关于model为null部分的流程是正确的。

回到`SingleRequest.begin()`方法中。  
判断完model是否为null后，下面会判断status是否为`Status.COMPLETE`。如果是，会调用`onResourceReady(resource, DataSource.MEMORY_CACHE)`并返回。该方法我们后面也会遇到，后面在说。

接下来会获取要加载图片的size并调用`onSizeReady`方法，我们直接看该方法：

```java
@Override
public synchronized void onSizeReady(int width, int height) {
  stateVerifier.throwIfRecycled();
  if (IS_VERBOSE_LOGGABLE) {
    logV("Got onSizeReady in " + LogTime.getElapsedMillis(startTime));
  }

  // 在SingleRequest.begin方法中已经将status设置为WAITING_FOR_SIZE状态了
  if (status != Status.WAITING_FOR_SIZE) {
    return;
  }
  // 设置状态为RUNNING
  status = Status.RUNNING;

  // 将原始尺寸与0～1之间的系数相乘，取最接近的整数值，得到新的尺寸
  float sizeMultiplier = requestOptions.getSizeMultiplier();
  this.width = maybeApplySizeMultiplier(width, sizeMultiplier);
  this.height = maybeApplySizeMultiplier(height, sizeMultiplier);

  if (IS_VERBOSE_LOGGABLE) {
    logV("finished setup for calling load in " + LogTime.getElapsedMillis(startTime));
  }
  // 🔥🔥🔥 根据load里面的这些参数开始加载
  loadStatus =
      engine.load(
          glideContext,
          model,
          requestOptions.getSignature(),
          this.width,
          this.height,
          requestOptions.getResourceClass(),
          transcodeClass,
          priority,
          requestOptions.getDiskCacheStrategy(),
          requestOptions.getTransformations(),
          requestOptions.isTransformationRequired(),
          requestOptions.isScaleOnlyOrNoTransform(),
          requestOptions.getOptions(),
          requestOptions.isMemoryCacheable(),
          requestOptions.getUseUnlimitedSourceGeneratorsPool(),
          requestOptions.getUseAnimationPool(),
          requestOptions.getOnlyRetrieveFromCache(),
          this,
          callbackExecutor);

  // This is a hack that's only useful for testing right now where loads complete synchronously
  // even though under any executor running on any thread but the main thread, the load would
  // have completed asynchronously.
  //
  // status目前显然是RUNNING状态，所以不会将loadStatus设置为null
  if (status != Status.RUNNING) {
    loadStatus = null;
  }
  if (IS_VERBOSE_LOGGABLE) {
    logV("finished onSizeReady in " + LogTime.getElapsedMillis(startTime));
  }
}
```

### 3.3 Engine.load

🔥🔥🔥目前看来，`engine.load`就是开始请求的关键代码了。`Engine`是负责开始加载，管理active、cached状态资源的类。在`GlideBuilder.build`中创建`Glide`时，若没有主动设置engine，会使用下面的参数进行创建：

```java
if (sourceExecutor == null) {
  sourceExecutor = GlideExecutor.newSourceExecutor();
}

if (diskCacheExecutor == null) {
  diskCacheExecutor = GlideExecutor.newDiskCacheExecutor();
}

if (memoryCache == null) {
  memoryCache = new LruResourceCache(memorySizeCalculator.getMemoryCacheSize());
}

if (diskCacheFactory == null) {
  diskCacheFactory = new InternalCacheDiskCacheFactory(context);
}

if (engine == null) {
  engine =
      new Engine(
          memoryCache,
          diskCacheFactory,
          diskCacheExecutor,
          sourceExecutor,
          GlideExecutor.newUnlimitedSourceExecutor(),
          GlideExecutor.newAnimationExecutor(),
          isActiveResourceRetentionAllowed /* 默认为false */);
}
```

`Engine.load`方法中会以一些参数作为key，依次从active状态、cached状态和进行中的load里寻找。若没有找到，则会创建对应的job并开始执行。  
提供给一个或以上请求且没有被释放的资源被称为active资源。一旦所有的消费者都释放了该资源，该资源就会被放入cache中。如果有请求将资源从cache中取出，它会被重新添加到active资源中。如果一个资源从cache中移除，其本身会被discard，其内部拥有的资源将会回收或者在可能的情况下重用。并没有严格要求消费者一定要释放它们的资源，所以active资源会以弱引用的方式保持。  

注意方法的注释，里面有上面两方面的说明：请求遵守的流程以及active状态资源的说明。

```java
/**
  * Starts a load for the given arguments.
  *
  * <p>Must be called on the main thread.
  *
  * <p>The flow for any request is as follows:
  *
  * <ul>
  *   <li>Check the current set of actively used resources, return the active resource if present,
  *       and move any newly inactive resources into the memory cache.
  *   <li>Check the memory cache and provide the cached resource if present.
  *   <li>Check the current set of in progress loads and add the cb to the in progress load if one
  *       is present.
  *   <li>Start a new load.
  * </ul>
  *
  * <p>Active resources are those that have been provided to at least one request and have not yet
  * been released. Once all consumers of a resource have released that resource, the resource then
  * goes to cache. If the resource is ever returned to a new consumer from cache, it is re-added to
  * the active resources. If the resource is evicted from the cache, its resources are recycled and
  * re-used if possible and the resource is discarded. There is no strict requirement that
  * consumers release their resources so active resources are held weakly.
  *
  * @param width The target width in pixels of the desired resource.
  * @param height The target height in pixels of the desired resource.
  * @param cb The callback that will be called when the load completes.
  */
public synchronized <R> LoadStatus load(
    GlideContext glideContext,
    Object model,
    Key signature,
    int width,
    int height,
    Class<?> resourceClass,
    Class<R> transcodeClass,
    Priority priority,
    DiskCacheStrategy diskCacheStrategy,
    Map<Class<?>, Transformation<?>> transformations,
    boolean isTransformationRequired,
    boolean isScaleOnlyOrNoTransform,
    Options options,
    boolean isMemoryCacheable,
    boolean useUnlimitedSourceExecutorPool,
    boolean useAnimationPool,
    boolean onlyRetrieveFromCache,
    ResourceCallback cb,
    Executor callbackExecutor) {
  long startTime = VERBOSE_IS_LOGGABLE ? LogTime.getLogTime() : 0;

  // EngineKey以传入的8个参数作为key
  EngineKey key = keyFactory.buildKey(model, signature, width, height, transformations,
      resourceClass, transcodeClass, options);

  // 从active资源中进行加载，第一次显然取不到
  EngineResource<?> active = loadFromActiveResources(key, isMemoryCacheable);
  if (active != null) {
    cb.onResourceReady(active, DataSource.MEMORY_CACHE);
    if (VERBOSE_IS_LOGGABLE) {
      logWithTimeAndKey("Loaded resource from active resources", startTime, key);
    }
    return null;
  }

  // 从内存cache资源中进行加载，第一次显然取不到
  EngineResource<?> cached = loadFromCache(key, isMemoryCacheable);
  if (cached != null) {
    cb.onResourceReady(cached, DataSource.MEMORY_CACHE);
    if (VERBOSE_IS_LOGGABLE) {
      logWithTimeAndKey("Loaded resource from cache", startTime, key);
    }
    return null;
  }

  // 从正在进行的jobs中进行加载，第一次显然取不到
  EngineJob<?> current = jobs.get(key, onlyRetrieveFromCache);
  if (current != null) {
    current.addCallback(cb, callbackExecutor);
    if (VERBOSE_IS_LOGGABLE) {
      logWithTimeAndKey("Added to existing load", startTime, key);
    }
    return new LoadStatus(cb, current);
  }

  // 构建出一个EngineJob
  EngineJob<R> engineJob =
      engineJobFactory.build(
          key,
          isMemoryCacheable,
          useUnlimitedSourceExecutorPool,
          useAnimationPool,
          onlyRetrieveFromCache);

  // 构建出一个DecodeJob，该类实现了Runnable接口
  DecodeJob<R> decodeJob =
      decodeJobFactory.build(
          glideContext,
          model,
          key,
          signature,
          width,
          height,
          resourceClass,
          transcodeClass,
          priority,
          diskCacheStrategy,
          transformations,
          isTransformationRequired,
          isScaleOnlyOrNoTransform,
          onlyRetrieveFromCache,
          options,
          engineJob);

  // 根据engineJob.onlyRetrieveFromCache的值是否为true
  // 将engineJob保存到onlyCacheJobs或者jobs HashMap中
  jobs.put(key, engineJob);

  // 添加资源加载状态回调，参数会包装成ResourceCallbackAndExecutor类型
  // 并保存到ResourceCallbacksAndExecutors.callbacksAndExecutors中
  engineJob.addCallback(cb, callbackExecutor);
  // 🔥🔥🔥开始执行decodeJob任务
  engineJob.start(decodeJob);

  if (VERBOSE_IS_LOGGABLE) {
    logWithTimeAndKey("Started new load", startTime, key);
  }
  return new LoadStatus(cb, engineJob);
}
```

在上面的这段代码中，从各个位置取资源是比较简单的，这里不多说了。  
`engineJobFactory`与`decodeJobFactory`两个Factory存在的意义在于里面使用了对象池Pools.Pool。以`DecodeJobFactory`为例：

```java
@VisibleForTesting
static class DecodeJobFactory {
  ...
  @Synthetic final Pools.Pool<DecodeJob<?>> pool =
      FactoryPools.threadSafe(JOB_POOL_SIZE,
          new FactoryPools.Factory<DecodeJob<?>>() {
        @Override
        public DecodeJob<?> create() {
          return new DecodeJob<>(diskCacheProvider, pool);
        }
      });
  ...
  @SuppressWarnings("unchecked")
  <R> DecodeJob<R> build(...) {
    DecodeJob<R> result = Preconditions.checkNotNull((DecodeJob<R>) pool.acquire());
    return result.init(...);
  }
}

// FactoryPools.java
public final class FactoryPools {
  @NonNull
  public static <T extends Poolable> Pool<T> threadSafe(int size, @NonNull Factory<T> factory) {
    return build(new SynchronizedPool<T>(size), factory);
  }

  @NonNull
  private static <T extends Poolable> Pool<T> build(@NonNull Pool<T> pool,
      @NonNull Factory<T> factory) {
    return build(pool, factory, FactoryPools.<T>emptyResetter());
  }

  @NonNull
  private static <T> Pool<T> build(@NonNull Pool<T> pool, @NonNull Factory<T> factory,
      @NonNull Resetter<T> resetter) {
    return new FactoryPool<>(pool, factory, resetter);
  }

  private static final class FactoryPool<T> implements Pool<T> {
    private final Factory<T> factory;
    private final Resetter<T> resetter;
    private final Pool<T> pool;

    FactoryPool(@NonNull Pool<T> pool, @NonNull Factory<T> factory, @NonNull Resetter<T> resetter) {
      this.pool = pool;
      this.factory = factory;
      this.resetter = resetter;
    }

    @Override
    public T acquire() {
      T result = pool.acquire();
      if (result == null) {
        result = factory.create();
        if (Log.isLoggable(TAG, Log.VERBOSE)) {
          Log.v(TAG, "Created new " + result.getClass());
        }
      }
      if (result instanceof Poolable) {
        ((Poolable) result).getVerifier().setRecycled(false /*isRecycled*/);
      }
      return result;
    }

    @Override
    public boolean release(@NonNull T instance) {
      if (instance instanceof Poolable) {
        ((Poolable) instance).getVerifier().setRecycled(true /*isRecycled*/);
      }
      resetter.reset(instance);
      return pool.release(instance);
    }
  }
}

// Pools
public final class Pools {

    /**
     * Interface for managing a pool of objects.
     *
     * @param <T> The pooled type.
     */
    public interface Pool<T> {

        /**
         * @return An instance from the pool if such, null otherwise.
         */
        @Nullable
        T acquire();

        /**
         * Release an instance to the pool.
         *
         * @param instance The instance to release.
         * @return Whether the instance was put in the pool.
         *
         * @throws IllegalStateException If the instance is already in the pool.
         */
        boolean release(@NonNull T instance);
    }

    private Pools() {
        /* do nothing - hiding constructor */
    }

    /**
     * Simple (non-synchronized) pool of objects.
     *
     * @param <T> The pooled type.
     */
    public static class SimplePool<T> implements Pool<T> {
        private final Object[] mPool;

        private int mPoolSize;

        /**
         * Creates a new instance.
         *
         * @param maxPoolSize The max pool size.
         *
         * @throws IllegalArgumentException If the max pool size is less than zero.
         */
        public SimplePool(int maxPoolSize) {
            if (maxPoolSize <= 0) {
                throw new IllegalArgumentException("The max pool size must be > 0");
            }
            mPool = new Object[maxPoolSize];
        }

        @Override
        @SuppressWarnings("unchecked")
        public T acquire() {
            if (mPoolSize > 0) {
                final int lastPooledIndex = mPoolSize - 1;
                T instance = (T) mPool[lastPooledIndex];
                mPool[lastPooledIndex] = null;
                mPoolSize--;
                return instance;
            }
            return null;
        }

        @Override
        public boolean release(@NonNull T instance) {
            if (isInPool(instance)) {
                throw new IllegalStateException("Already in the pool!");
            }
            if (mPoolSize < mPool.length) {
                mPool[mPoolSize] = instance;
                mPoolSize++;
                return true;
            }
            return false;
        }

        private boolean isInPool(@NonNull T instance) {
            for (int i = 0; i < mPoolSize; i++) {
                if (mPool[i] == instance) {
                    return true;
                }
            }
            return false;
        }
    }

    /**
     * Synchronized) pool of objects.
     *
     * @param <T> The pooled type.
     */
    public static class SynchronizedPool<T> extends SimplePool<T> {
        private final Object mLock = new Object();

        /**
         * Creates a new instance.
         *
         * @param maxPoolSize The max pool size.
         *
         * @throws IllegalArgumentException If the max pool size is less than zero.
         */
        public SynchronizedPool(int maxPoolSize) {
            super(maxPoolSize);
        }

        @Override
        public T acquire() {
            synchronized (mLock) {
                return super.acquire();
            }
        }

        @Override
        public boolean release(@NonNull T element) {
            synchronized (mLock) {
                return super.release(element);
            }
        }
    }
}
```

接着看看`engineJob.start(decodeJob)`这句代码：

```java
// EngineJob
public synchronized void start(DecodeJob<R> decodeJob) {
  this.decodeJob = decodeJob;
  // decodeJob.willDecodeFromCache()返回true
  GlideExecutor executor = decodeJob.willDecodeFromCache()
      ? diskCacheExecutor
      : getActiveSourceExecutor();
  executor.execute(decodeJob);
}

// DecodeJob
/**
  * Returns true if this job will attempt to decode a resource from the disk cache, and false if it
  * will always decode from source.
  */
boolean willDecodeFromCache() {
  // 返回值为Stage.RESOURCE_CACHE
  Stage firstStage = getNextStage(Stage.INITIALIZE);
  return firstStage == Stage.RESOURCE_CACHE || firstStage == Stage.DATA_CACHE;
}

private Stage getNextStage(Stage current) {
    // diskCacheStrategy为DiskCacheStrategy.AUTOMATIC
    // decodeCachedResource()为true
    switch (current) {
      case INITIALIZE:
        return diskCacheStrategy.decodeCachedResource()
            ? Stage.RESOURCE_CACHE : getNextStage(Stage.RESOURCE_CACHE);
      case RESOURCE_CACHE:
        return diskCacheStrategy.decodeCachedData()
            ? Stage.DATA_CACHE : getNextStage(Stage.DATA_CACHE);
      case DATA_CACHE:
        // Skip loading from source if the user opted to only retrieve the resource from cache.
        return onlyRetrieveFromCache ? Stage.FINISHED : Stage.SOURCE;
      case SOURCE:
      case FINISHED:
        return Stage.FINISHED;
      default:
        throw new IllegalArgumentException("Unrecognized stage: " + current);
    }
  }
```

此状态机的所有状态如下：

```java
/**
  * Where we're trying to decode data from.
  */
private enum Stage {
  /** The initial stage. */
  INITIALIZE,
  /** Decode from a cached resource. */
  RESOURCE_CACHE,
  /** Decode from cached source data. */
  DATA_CACHE,
  /** Decode from retrieved source. */
  SOURCE,
  /** Encoding transformed resources after a successful load. */
  ENCODE,
  /** No more viable stages. */
  FINISHED,
}
```

回到`EngineJob.start`方法中，由于`decodeJob.willDecodeFromCache()`为true，那么就使用`diskCacheExecutor`来执行decodeJob。  
`diskCacheExecutor`默认值为`GlideExecutor.newDiskCacheExecutor()`，这是类似于一个`SingleThreadExecutor`的线程池，这里使用了设计模式中的代理模式：

```java
/**
 * A prioritized {@link ThreadPoolExecutor} for running jobs in Glide.
 */
public final class GlideExecutor implements ExecutorService {
  private static final String DEFAULT_DISK_CACHE_EXECUTOR_NAME = "disk-cache";
  private static final int DEFAULT_DISK_CACHE_EXECUTOR_THREADS = 1;

  private final ExecutorService delegate;

  public static GlideExecutor newDiskCacheExecutor() {
    return newDiskCacheExecutor(
        DEFAULT_DISK_CACHE_EXECUTOR_THREADS,
        DEFAULT_DISK_CACHE_EXECUTOR_NAME,
        UncaughtThrowableStrategy.DEFAULT);
  }

  public static GlideExecutor newDiskCacheExecutor(
      int threadCount, String name, UncaughtThrowableStrategy uncaughtThrowableStrategy) {
    return new GlideExecutor(
        new ThreadPoolExecutor(
            threadCount /* corePoolSize */,
            threadCount /* maximumPoolSize */,
            0 /* keepAliveTime */,
            TimeUnit.MILLISECONDS,
            new PriorityBlockingQueue<Runnable>(),
            new DefaultThreadFactory(name, uncaughtThrowableStrategy, true)));
  }

  @VisibleForTesting
  GlideExecutor(ExecutorService delegate) {
    this.delegate = delegate;
  }

  @Override
  public void execute(@NonNull Runnable command) {
    delegate.execute(command);
  }

  @NonNull
  @Override
  public Future<?> submit(@NonNull Runnable task) {
    return delegate.submit(task);
  }
  ...
}
```

现在，`decodeJob`已经提交到了线程池中，待会儿我们在看子线程中的执行情况。  
现在回到主线程的`SingleRequest.begin`方法中，接下来执行的是：

```java
if ((status == Status.RUNNING || status == Status.WAITING_FOR_SIZE)
    && canNotifyStatusChanged()) {
  target.onLoadStarted(getPlaceholderDrawable());
}
```

由于此时`status == Status.RUNNING`为true，现在开始展示placeholder。

### 3.4 DecodeJob.run

接着，继续看看`decodeJob.run`方法在线程池中的执行情况：

```java
@Override
public void run() {
  // This should be much more fine grained, but since Java's thread pool implementation silently
  // swallows all otherwise fatal exceptions, this will at least make it obvious to developers
  // that something is failing.
  GlideTrace.beginSectionFormat("DecodeJob#run(model=%s)", model);
  // Methods in the try statement can invalidate currentFetcher, so set a local variable here to
  // ensure that the fetcher is cleaned up either way.
  // 
  // currentFetcher目前为null
  DataFetcher<?> localFetcher = currentFetcher;
  try {
    if (isCancelled) {
      notifyFailed();
      return;
    }
    runWrapped();
  } catch (CallbackException e) {
    // If a callback not controlled by Glide throws an exception, we should avoid the Glide
    // specific debug logic below.
    throw e;
  } catch (Throwable t) {
    // Catch Throwable and not Exception to handle OOMs. Throwables are swallowed by our
    // usage of .submit() in GlideExecutor so we're not silently hiding crashes by doing this. We
    // are however ensuring that our callbacks are always notified when a load fails. Without this
    // notification, uncaught throwables never notify the corresponding callbacks, which can cause
    // loads to silently hang forever, a case that's especially bad for users using Futures on
    // background threads.
    if (Log.isLoggable(TAG, Log.DEBUG)) {
      Log.d(TAG, "DecodeJob threw unexpectedly"
          + ", isCancelled: " + isCancelled
          + ", stage: " + stage, t);
    }
    // When we're encoding we've already notified our callback and it isn't safe to do so again.
    if (stage != Stage.ENCODE) {
      throwables.add(t);
      notifyFailed();
    }
    if (!isCancelled) {
      throw t;
    }
    throw t;
  } finally {
    // Keeping track of the fetcher here and calling cleanup is excessively paranoid, we call
    // close in all cases anyway.
    if (localFetcher != null) {
      localFetcher.cleanup();
    }
    GlideTrace.endSection();
  }
}
```

里面真正执行的是`runWrapped`方法：

```java
private void runWrapped() {
  // runReason在DecodeJob.init方法中被初始化为INITIALIZE
  switch (runReason) {
    case INITIALIZE:
      // INITIALIZE下一个状态显然为RESOURCE_CACHE
      stage = getNextStage(Stage.INITIALIZE);
      currentGenerator = getNextGenerator();
      runGenerators();
      break;
    ...
  }
}

/**
 * 返回一个ResourceCacheGenerator
 */
private DataFetcherGenerator getNextGenerator() {
  switch (stage) {
    case RESOURCE_CACHE:
      return new ResourceCacheGenerator(decodeHelper, this);
    ...
  }
}
```

`getNextGenerator()`方法返回了一个`ResourceCacheGenerator`，然后调用`runGenerators()`方法进行执行。

```java
private void runGenerators() {
  currentThread = Thread.currentThread();
  startFetchTime = LogTime.getLogTime();
  boolean isStarted = false;
  while (!isCancelled && currentGenerator != null
      && !(isStarted = currentGenerator.startNext())) {
    stage = getNextStage(stage);
    currentGenerator = getNextGenerator();

    if (stage == Stage.SOURCE) {
      reschedule();
      return;
    }
  }
  // We've run out of stages and generators, give up.
  if ((stage == Stage.FINISHED || isCancelled) && !isStarted) {
    notifyFailed();
  }

  // Otherwise a generator started a new load and we expect to be called back in
  // onDataFetcherReady.
}
```

在该方法中会依次调用各个状态生成的`DataFetcherGenerator`的`startNext()`尝试fetch数据，直到有某个状态的`DataFetcherGenerator.startNext()`方法可以胜任。若状态抵达到了`Stage.FINISHED`或job被取消，且所有状态的`DataFetcherGenerator.startNext()`都无法满足条件，则调用`SingleRequest.onLoadFailed`进行错误处理。  

这里面fetch数据逻辑有点复杂，因为涉及到`Registry`类，该类是用来管理Glide注册进来的用来拓展或替代Glide默认加载、解码、编码逻辑的组件。在Glide创建的时候，绝大多数代码都是对`Registry`的操作。

### 3.5 ResourceCacheGenerator

下面我们看看`ResourceCacheGenerator.startNext`方法，由于方法这里面方法调用层次非常深，所以先直接写上每一步执行的结果，有一个大体上的了解：

```java
@Override
public boolean startNext() {
  // list里面只有一个GlideUrl对象
  List<Key> sourceIds = helper.getCacheKeys();
  if (sourceIds.isEmpty()) {
    return false;
  }
  // 获得了三个resourceClass
  // GifDrawable、Bitmap、BitmapDrawable
  List<Class<?>> resourceClasses = helper.getRegisteredResourceClasses();
  if (resourceClasses.isEmpty()) {
    if (File.class.equals(helper.getTranscodeClass())) {
      return false;
    }
    throw new IllegalStateException(
        "Failed to find any load path from " + helper.getModelClass() + " to "
            + helper.getTranscodeClass());
  }
  // 遍历sourceIds中的每一个key、resourceClasses中每一个class，以及其他的一些值组成key
  // 尝试在磁盘缓存中以key找到缓存文件
  while (modelLoaders == null || !hasNextModelLoader()) {
    resourceClassIndex++;
    if (resourceClassIndex >= resourceClasses.size()) {
      sourceIdIndex++;
      if (sourceIdIndex >= sourceIds.size()) {
        return false;
      }
      resourceClassIndex = 0;
    }

    Key sourceId = sourceIds.get(sourceIdIndex);
    Class<?> resourceClass = resourceClasses.get(resourceClassIndex);
    Transformation<?> transformation = helper.getTransformation(resourceClass);
    // PMD.AvoidInstantiatingObjectsInLoops Each iteration is comparatively expensive anyway,
    // we only run until the first one succeeds, the loop runs for only a limited
    // number of iterations on the order of 10-20 in the worst case.
    currentKey =
        new ResourceCacheKey(// NOPMD AvoidInstantiatingObjectsInLoops
            helper.getArrayPool(),
            sourceId,
            helper.getSignature(),
            helper.getWidth(),
            helper.getHeight(),
            transformation,
            resourceClass,
            helper.getOptions());
    cacheFile = helper.getDiskCache().get(currentKey);
    // 如果找到了缓存文件，那么循环条件则会为false，也就退出循环了
    if (cacheFile != null) {
      sourceKey = sourceId;
      modelLoaders = helper.getModelLoaders(cacheFile);
      modelLoaderIndex = 0;
    }
  }

  // 找没找到缓存文件，都会执行这里的方法
  // 如果找到了hasNextModelLoader方法则会为true，可以执行循环
  // 没有找到缓存文件，则不会进入循环，会直接返回false
  loadData = null;
  boolean started = false;
  while (!started && hasNextModelLoader()) {
    ModelLoader<File, ?> modelLoader = modelLoaders.get(modelLoaderIndex++);
    loadData = modelLoader.buildLoadData(cacheFile,
        helper.getWidth(), helper.getHeight(), helper.getOptions());
    if (loadData != null && helper.hasLoadPath(loadData.fetcher.getDataClass())) {
      started = true;
      loadData.fetcher.loadData(helper.getPriority(), this);
    }
  }

  return started;
}
```

我们一行行解析这里面的代码，先看看`helper.getCacheKeys()`是如何把我们绕晕后，成功的将String转换为GlideUrl的。

**DecodeHelper.java**
```java
List<Key> getCacheKeys() {
  // 这里使用了一个标志位，防止在DataCacheGenerator中重复加载
  if (!isCacheKeysSet) {
    isCacheKeysSet = true;
    cacheKeys.clear();
    // 得到可以处理该请求的ModelLoader的LoadData列表
    List<LoadData<?>> loadData = getLoadData();
    //noinspection ForLoopReplaceableByForEach to improve perf
    // 将每一个loadData里的sourceKey以及每一个alternateKeys添加到cacheKeys中
    for (int i = 0, size = loadData.size(); i < size; i++) {
      LoadData<?> data = loadData.get(i);
      // cacheKeys显然为null，所以添加了一个GlideUrl
      if (!cacheKeys.contains(data.sourceKey)) {
        cacheKeys.add(data.sourceKey);
      }
      // 实例中alternateKeys为空集合
      for (int j = 0; j < data.alternateKeys.size(); j++) {
        if (!cacheKeys.contains(data.alternateKeys.get(j))) {
          cacheKeys.add(data.alternateKeys.get(j));
        }
      }
    }
  }
  return cacheKeys;
}

List<LoadData<?>> getLoadData() {
  // 这里也使用了一个标志位，防止在重复加载
  if (!isLoadDataSet) {
    isLoadDataSet = true;
    loadData.clear();
    // 获得了注册的3个ModelLoader
    List<ModelLoader<Object, ?>> modelLoaders = glideContext.getRegistry().getModelLoaders(model);
    //noinspection ForLoopReplaceableByForEach to improve perf
    for (int i = 0, size = modelLoaders.size(); i < size; i++) {
      ModelLoader<Object, ?> modelLoader = modelLoaders.get(i);
      // 对每个ModelLoader调用buildLoadData，看看其是否可以满足条件
      LoadData<?> current =
          modelLoader.buildLoadData(model, width, height, options);
      if (current != null) {
        loadData.add(current);
      }
    }
  }
  // 返回可以处理该请求的ModelLoader的LoadData列表
  return loadData;
}
```

上面代码中比较麻烦的部分在`glideContext.getRegistry().getModelLoaders(model)`，在深入探索该方法的代码之前，我们还是先看看`Registry`类的相关代码吧。

`Registry`类中提供了很多用来拓展、替换默认组件的方法，根据组件功能的不同，会交给内部很多不同的`XxxRegistry`处理：

```java
public class Registry {
  public static final String BUCKET_GIF = "Gif";
  public static final String BUCKET_BITMAP = "Bitmap";
  public static final String BUCKET_BITMAP_DRAWABLE = "BitmapDrawable";
  private static final String BUCKET_PREPEND_ALL = "legacy_prepend_all";
  private static final String BUCKET_APPEND_ALL = "legacy_append";

  private final ModelLoaderRegistry modelLoaderRegistry;
  private final EncoderRegistry encoderRegistry;
  private final ResourceDecoderRegistry decoderRegistry;
  private final ResourceEncoderRegistry resourceEncoderRegistry;
  private final DataRewinderRegistry dataRewinderRegistry;
  private final TranscoderRegistry transcoderRegistry;
  private final ImageHeaderParserRegistry imageHeaderParserRegistry;

  private final ModelToResourceClassCache modelToResourceClassCache =
      new ModelToResourceClassCache();
  private final LoadPathCache loadPathCache = new LoadPathCache();
  private final Pool<List<Throwable>> throwableListPool = FactoryPools.threadSafeList();

  public Registry() {
    this.modelLoaderRegistry = new ModelLoaderRegistry(throwableListPool);
    this.encoderRegistry = new EncoderRegistry();
    this.decoderRegistry = new ResourceDecoderRegistry();
    this.resourceEncoderRegistry = new ResourceEncoderRegistry();
    this.dataRewinderRegistry = new DataRewinderRegistry();
    this.transcoderRegistry = new TranscoderRegistry();
    this.imageHeaderParserRegistry = new ImageHeaderParserRegistry();
    setResourceDecoderBucketPriorityList(
        Arrays.asList(BUCKET_GIF, BUCKET_BITMAP, BUCKET_BITMAP_DRAWABLE));
  }
  ...
}
```

拿马上要遇到的`modelLoaderRegistry`来说，相关的管理组件的三个方法为：

```java
@NonNull
public <Model, Data> Registry append(
    @NonNull Class<Model> modelClass, @NonNull Class<Data> dataClass,
    @NonNull ModelLoaderFactory<Model, Data> factory) {
  modelLoaderRegistry.append(modelClass, dataClass, factory);
  return this;
}

@NonNull
public <Model, Data> Registry prepend(
    @NonNull Class<Model> modelClass, @NonNull Class<Data> dataClass,
    @NonNull ModelLoaderFactory<Model, Data> factory) {
  modelLoaderRegistry.prepend(modelClass, dataClass, factory);
  return this;
}

@NonNull
public <Model, Data> Registry replace(
    @NonNull Class<Model> modelClass,
    @NonNull Class<Data> dataClass,
    @NonNull ModelLoaderFactory<? extends Model, ? extends Data> factory) {
  modelLoaderRegistry.replace(modelClass, dataClass, factory);
  return this;
}
```

上面这三个方法实际上又会交给`MultiModelLoaderFactory`来处理，这是一个代理模式：

```java
public synchronized <Model, Data> void append(
    @NonNull Class<Model> modelClass,
    @NonNull Class<Data> dataClass,
    @NonNull ModelLoaderFactory<? extends Model, ? extends Data> factory) {
  multiModelLoaderFactory.append(modelClass, dataClass, factory);
  cache.clear();
}

public synchronized <Model, Data> void prepend(
    @NonNull Class<Model> modelClass,
    @NonNull Class<Data> dataClass,
    @NonNull ModelLoaderFactory<? extends Model, ? extends Data> factory) {
  multiModelLoaderFactory.prepend(modelClass, dataClass, factory);
  cache.clear();
}

public synchronized <Model, Data> void remove(@NonNull Class<Model> modelClass,
    @NonNull Class<Data> dataClass) {
  tearDown(multiModelLoaderFactory.remove(modelClass, dataClass));
  cache.clear();
}
```

`MultiModelLoaderFactory`中会使用一个`entries`的list来保存所有注入的内容。

前面已经提到过，Glide在构造时会对`Registry`进行大量的操作。因为我们示例是load的String类型的Url，所以`Registry`中相关的操作如下：

```java
/* Models */
.append(String.class, InputStream.class, new DataUrlLoader.StreamFactory<String>())
.append(String.class, InputStream.class, new StringLoader.StreamFactory())
.append(String.class, ParcelFileDescriptor.class, new StringLoader.FileDescriptorFactory())
.append(
    String.class, AssetFileDescriptor.class, new StringLoader.AssetFileDescriptorFactory())
```

了解了这些之后，我们回过头看看`Registry.getModelLoaders`方法干了啥：

```java
// Registry.java
@NonNull
public <Model> List<ModelLoader<Model, ?>> getModelLoaders(@NonNull Model model) {
  List<ModelLoader<Model, ?>> result = modelLoaderRegistry.getModelLoaders(model);
  if (result.isEmpty()) {
    throw new NoModelLoaderAvailableException(model);
  }
  return result;
}
```

这里只是调用了`modelLoaderRegistry.getModelLoaders(model)`，如果返回结果不为空则返回该结果，否则抛出异常。我们继续跟踪一下：

```java
// ModelLoaderRegistry.java
// getModelLoaders方法会获取所有可以处理String类型的ModelLoader
@NonNull
public <A> List<ModelLoader<A, ?>> getModelLoaders(@NonNull A model) {
  // 返回所有注册过的modelClass为String的ModelLoader，就是上面列出来的四个
  List<ModelLoader<A, ?>> modelLoaders = getModelLoadersForClass(getClass(model));
  int size = modelLoaders.size();
  boolean isEmpty = true;
  List<ModelLoader<A, ?>> filteredLoaders = Collections.emptyList();
  //noinspection ForLoopReplaceableByForEach to improve perf
  for (int i = 0; i < size; i++) {
    ModelLoader<A, ?> loader = modelLoaders.get(i);
    // 对于每个ModelLoader，看看真正能不能处理这种类型的数据
    // 此处会过滤第一个
    if (loader.handles(model)) {
      if (isEmpty) {
        filteredLoaders = new ArrayList<>(size - i);
        isEmpty = false;
      }
      filteredLoaders.add(loader);
    }
  }
  return filteredLoaders;
}

// 返回所有注册过的modelClass为String的ModelLoader
@NonNull
private synchronized <A> List<ModelLoader<A, ?>> getModelLoadersForClass(
    @NonNull Class<A> modelClass) {
  List<ModelLoader<A, ?>> loaders = cache.get(modelClass);
  if (loaders == null) {
    loaders = Collections.unmodifiableList(multiModelLoaderFactory.build(modelClass));
    cache.put(modelClass, loaders);
  }
  return loaders;
}
```

我们看看`multiModelLoaderFactory.build(modelClass)`的逻辑：

```java
@NonNull
synchronized <Model> List<ModelLoader<Model, ?>> build(@NonNull Class<Model> modelClass) {
  try {
    List<ModelLoader<Model, ?>> loaders = new ArrayList<>();
    // 遍历所有注册进来的entry
    for (Entry<?, ?> entry : entries) {
      // Avoid stack overflow recursively creating model loaders by only creating loaders in
      // recursive requests if they haven't been created earlier in the chain. For example:
      // A Uri loader may translate to another model, which in turn may translate back to a Uri.
      // The original Uri loader won't be provided to the intermediate model loader, although
      // other Uri loaders will be.
      if (alreadyUsedEntries.contains(entry)) {
        continue;
      }
      // 注册过的entry有很多，但是entry.modelClass是modelClass（即String.class）的同类或基类、基接口的却只有四个
      if (entry.handles(modelClass)) {
        alreadyUsedEntries.add(entry);
        // 对每一个符合条件的entry调用build接口
        loaders.add(this.<Model, Object>build(entry));
        alreadyUsedEntries.remove(entry);
      }
    }
    return loaders;
  } catch (Throwable t) {
    alreadyUsedEntries.clear();
    throw t;
  }
}

@NonNull
@SuppressWarnings("unchecked")
private <Model, Data> ModelLoader<Model, Data> build(@NonNull Entry<?, ?> entry) {
  return (ModelLoader<Model, Data>) Preconditions.checkNotNull(entry.factory.build(this));
}

// Entry类还是比较简单的
private static class Entry<Model, Data> {
  private final Class<Model> modelClass;
  @Synthetic final Class<Data> dataClass;
  @Synthetic final ModelLoaderFactory<? extends Model, ? extends Data> factory;

  public Entry(
      @NonNull Class<Model> modelClass,
      @NonNull Class<Data> dataClass,
      @NonNull ModelLoaderFactory<? extends Model, ? extends Data> factory) {
    this.modelClass = modelClass;
    this.dataClass = dataClass;
    this.factory = factory;
  }

  public boolean handles(@NonNull Class<?> modelClass, @NonNull Class<?> dataClass) {
    return handles(modelClass) && this.dataClass.isAssignableFrom(dataClass);
  }

  public boolean handles(@NonNull Class<?> modelClass) {
    return this.modelClass.isAssignableFrom(modelClass);
  }
}
```

下面我们看看`entry.factory.build(this)`创建了四个什么样的ModelLoader：

```java

```