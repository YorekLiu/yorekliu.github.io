---
title: "Glide v4 源码解析（二）"
excerpt: "从源码的角度理解Glide三步的执行流程"
categories:
  - Android
tags:
  - Glide
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