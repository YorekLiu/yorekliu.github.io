---
title: "Glide v4 源码解析（二）"
---

!!! tip
    本系列文章参考3.7.0版本的[guolin - Glide最全解析](https://blog.csdn.net/sinyu890807/column/info/15318)，并按此思路结合4.9.0版本源码以及使用文档进行更新。  
    ➟ [Glide v4.9.0](https://github.com/bumptech/glide/tree/v4.9.0)  
    ➟ [中文文档](https://muyangmin.github.io/glide-docs-cn/)  
    ➟ [英文文档](https://bumptech.github.io/glide/)🚀🚀  


!!! note "Glide系列文章目录"
    - [Glide1——Glide v4 的基本使用](/android/3rd-library/glide1/)
    - [Glide2——从源码的角度理解Glide三步的执行流程](/android/3rd-library/glide2/)
    - [Glide3——深入探究Glide缓存机制](/android/3rd-library/glide3/)
    - [Glide4——RequestBuilder中高级点的API以及Target](/android/3rd-library/glide4/)
    - [Glide5——Glide内置的transform以及自定义BitmapTransformation](/android/3rd-library/glide5/)
    - [Glide6——Glide利用AppGlideModule、LibraryGlideModule更改默认配置、扩展Glide功能；GlideApp与Glide的区别在哪？](/android/3rd-library/glide6/)
    - [Glide7——利用OkHttp、自定义Drawable、自定义ViewTarget实现带进度的图片加载功能](/android/3rd-library/glide7/)
    - [杂记：从Picasso迁移至Glide](/android/3rd-library/migrate-to-glide/)

---

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
  // 若没有指定transform，isTransformationSet()为false
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

> 这也证明了[Glide v4 源码解析（一）--- 占位符](/android/3rd-library/glide1/#21)中，关于model为null部分的流程是正确的。

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

这里总共有三个`DataFetcherGenerator`，依次是：

1. ResourceCacheGenerator  
   获取采样后、transformed后资源文件的缓存文件
2. DataCacheGenerator  
   获取原始的没有修改过的资源文件的缓存文件
3. SourceGenerator  
   获取原始源数据

这里面fetch数据逻辑有点复杂，因为涉及到`Registry`类，该类是用来管理Glide注册进来的用来拓展或替代Glide默认加载、解码、编码逻辑的组件。在Glide创建的时候，绝大多数代码都是对`Registry`的操作。

我们先大致说一下`Registry`类里面各个组件的功能吧。

### 3.5 Registry

Glide在创建时，会向`Registry`实例中注入相当多的配置，每个配置都会转发给对应的一个专门的类，这些专门的类有7个。  
在这7个类中，除了`DataRewinderRegistry`和`ImageHeaderParserRegistry`外，其他的Registry都会将注入的配置保存到内部的`Entry`类中。`Entry`类的作用就是判断该项配置能够满足条件（`handles`）。  
`handles`方法都是以`isAssignableFrom`方法判断，但被判断参数有一些差别。

在各个Registry中`Entry`类的`hanldes`实现前，先理解一下这里面出现的各种class：

- `modelClass`  
  Glide.with(..).load()中被load参数的类型，在实例中就是String.class
- `dataClass`  
  比较原始的数据，根据`ModelLoaderRegistry`中的配置，可以得到所有由`modelClass`有可能到达的`dataClass`  
  同时，一起注入的`ModelLoaderFactory<Model, Data>`是一个可以创建如何从`modelClass`到`dataClass`进行转换的`ModelLoader<Model, Data>`的类的工厂，可以根据`modelClass`获得
- `resourceClass`  
  解码后的资源类型，根据`ResourceDecoderRegistry`中的配置，可以由`dataClass`和`resourceClass`获得所有`registeredResourceClasses`  
  同时，一起注入的`ResourceDecoder<Data, Resource>`是一个将`dataClass`解码成`resourceClass`的类，可以由有可能到达的`dataClass`以及`registeredResourceClass`获得
- `transcodeClass`  
  最终要转换成的数据类型，一般情况下Drawable.class；若Glide加载是指定了asBitmap、asGif、asFile，那么此类型就是Bitmap.class、GifDrawable.class、File.class  
  若`registeredResourceClass`不是`transcodeClass`类型，则通过`TranscoderRegistry`注入的`ResourceTranscoder<Resource, T>`可以将`resourceClass`转为`transcodeClass`


下面是5个在各个Registry中`Entry`类的`hanldes`实现：

```java
// MultiModelLoaderFactory.Entry
private static class Entry<Model, Data> {
  private final Class<Model> modelClass;
  @Synthetic final Class<Data> dataClass;
  ...
  public boolean handles(@NonNull Class<?> modelClass, @NonNull Class<?> dataClass) {
    return handles(modelClass) && this.dataClass.isAssignableFrom(dataClass);
  }

  public boolean handles(@NonNull Class<?> modelClass) {
    return this.modelClass.isAssignableFrom(modelClass);
  }
}

// EncoderRegistry.Entry
private static final class Entry<T> {
  private final Class<T> dataClass;
  ...
  boolean handles(@NonNull Class<?> dataClass) {
    return this.dataClass.isAssignableFrom(dataClass);
  }
}

// ResourceEncoderRegistry.Entry
private static final class Entry<T> {
  private final Class<T> resourceClass;
  ...
  @Synthetic
  boolean handles(@NonNull Class<?> resourceClass) {
    return this.resourceClass.isAssignableFrom(resourceClass);
  }
}

// ResourceDecoderRegistry.Entry
private static class Entry<T, R> {
  private final Class<T> dataClass;
  @Synthetic final Class<R> resourceClass;
  ...
  public boolean handles(@NonNull Class<?> dataClass, @NonNull Class<?> resourceClass) {
    return this.dataClass.isAssignableFrom(dataClass) && resourceClass
        .isAssignableFrom(this.resourceClass);
  }
}

// TranscoderRegistry.Entry
private static final class Entry<Z, R> {
  private final Class<Z> fromClass;
  private final Class<R> toClass;
  ...
  public boolean handles(@NonNull Class<?> fromClass, @NonNull Class<?> toClass) {
    return this.fromClass.isAssignableFrom(fromClass) && toClass.isAssignableFrom(this.toClass);
  }
}
```

> `isAssignableFrom`判断该类是否是某个类的父类，`instanceof`判断该实例的类是否某个实例的类的子类。

这7个Registry类作用如下：

1. ModelLoaderRegistry  
   构建`modelClass`到`dataClass`的桥梁  
   *load custom Models (Urls, Uris, arbitrary POJOs) and Data (InputStreams, FileDescriptors).*
2. ResourceDecoderRegistry  
   `dataClass`到`resourceClass`的桥梁  
   *to decode new Resources (Drawables, Bitmaps) or new types of Data (InputStreams, FileDescriptors).*
3. EncoderRegistry  
   *write Data (InputStreams, FileDescriptors) to Glide’s disk cache*
4. TranscoderRegistry  
   构建`resourceClass`到`transcodeClass`的桥梁  
   *convert Resources (BitmapResource) into other types of Resources (DrawableResource)*
5. ResourceEncoderRegistry  
   *write Resources (BitmapResource, DrawableResource) to Glide’s disk cache.*
6. DataRewinderRegistry  
   提供对`ByteBuffer.class`、`InputStream.class`这两种data进行rewind操作的能力
7. ImageHeaderParserRegistry  
   提供解析Image头信息的能力

> 1. `ModelLoaders` to load custom Models (Urls, Uris, arbitrary POJOs) and Data (InputStreams, FileDescriptors).  
> 2. `ResourceDecoders` to decode new Resources (Drawables, Bitmaps) or new types of Data (InputStreams, FileDescriptors).  
> 3. `Encoders` to write Data (InputStreams, FileDescriptors) to Glide’s disk cache.  
> 4. `ResourceTranscoders` to convert Resources (BitmapResource) into other types of Resources (DrawableResource).  
> 5. `ResourceEncoders` to write Resources (BitmapResource, DrawableResource) to Glide’s disk cache.  
> 
> **Anatomy of a load**  
> The set of registered components, including both those registered by default in Glide and those registered in Modules are used to define a set of load paths. Each load path is a step by step progression from the the Model provided to `load()` to the Resource type specified by `as()`. A load path consists (roughly) of the following steps:  
> 1. Model -> Data (handled by `ModelLoader`s)
> 2. Data -> Resource (handled by `ResourceDecoder`s)
> 3. Resource -> Transcoded Resource (optional, handled by `ResourceTranscoder`s).
> 
> `Encoder`s can write Data to Glide’s disk cache cache before step 2.  
> `ResourceEncoder`s can write Resource’s to Glide’s disk cache before step 3.  
> When a request is started, Glide will attempt all available paths from the Model to the requested Resource type. A request will succeed if any load path succeeds. A request will fail only if all available load paths fail.  
> 
> <cite>[Configuration - Registering Components](http://bumptech.github.io/glide/doc/configuration.html#registering-components)</cite>  

### 3.6 ResourceCacheGenerator

下面我们看看`ResourceCacheGenerator.startNext`方法，由于方法这里面方法调用层次非常深，所以先直接写上每一步执行的结果，有一个大体上的了解：

```java
@Override
public boolean startNext() {
 // list里面只有一个GlideUrl对象
 List<Key> sourceIds = helper.getCacheKeys();
 if (sourceIds.isEmpty()) {
   return false;
 }
 // 获得了三个可以到达的registeredResourceClasses
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
 // 如果找到了，hasNextModelLoader()方法则会为true，可以执行循环
 // 没有找到缓存文件，则不会进入循环，会直接返回false
 loadData = null;
 boolean started = false;
 while (!started && hasNextModelLoader()) {
   ModelLoader<File, ?> modelLoader = modelLoaders.get(modelLoaderIndex++);
   //  在循环中会依次判断某个ModelLoader能不能加载此文件
   loadData = modelLoader.buildLoadData(cacheFile,
       helper.getWidth(), helper.getHeight(), helper.getOptions());
   if (loadData != null && helper.hasLoadPath(loadData.fetcher.getDataClass())) {
     started = true;
     // 如果某个ModelLoader可以，那么就调用其fetcher进行加载数据
     // 加载成功或失败会通知自身
     loadData.fetcher.loadData(helper.getPriority(), this);
   }
 }

 return started;
}
```

#### 3.6.1 helper.getCacheKeys

我们一行行解析这里面的代码，先看看`helper.getCacheKeys()`是如何把我们绕晕后，成功的将String转换为GlideUrl的。

**DecodeHelper.java**
```java
List<Key> getCacheKeys() {
 // 这里使用了一个标志位，防止在DataCacheGenerator中重复加载
 if (!isCacheKeysSet) {
   isCacheKeysSet = true;
   cacheKeys.clear();
   // 得到可以处理该请求的ModelLoader的LoadData list
   List<LoadData<?>> loadData = getLoadData();
   // 将每一个loadData里的sourceKey以及每一个alternateKeys添加到cacheKeys中
   // 在我们的三步例子中sourceKey为一个GlideUrl，alternateKeys为空
   for (int i = 0, size = loadData.size(); i < size; i++) {
     LoadData<?> data = loadData.get(i);
     if (!cacheKeys.contains(data.sourceKey)) {
       cacheKeys.add(data.sourceKey);
     }
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
   for (int i = 0, size = modelLoaders.size(); i < size; i++) {
     ModelLoader<Object, ?> modelLoader = modelLoaders.get(i);
     // 对每个ModelLoader调用buildLoadData，看看其是否可以满足条件
     // 如果返回不为null，说明是可以处理的，那么添加进来
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

`Registry`类中提供了很多用来拓展、替换默认组件的方法，根据组件功能的不同，会交给内部很多不同的Registry处理：

```java
public class Registry {
 private final ModelLoaderRegistry modelLoaderRegistry;
 private final EncoderRegistry encoderRegistry;
 private final ResourceDecoderRegistry decoderRegistry;
 private final ResourceEncoderRegistry resourceEncoderRegistry;
 private final DataRewinderRegistry dataRewinderRegistry;
 private final TranscoderRegistry transcoderRegistry;
 private final ImageHeaderParserRegistry imageHeaderParserRegistry;
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

前面已经提到过，Glide在构造时会对`Registry`进行大量的操作。因为我们示例是load的`String`类型的Url，也就是说，`modelClass` 为 `String.class`，所以`Registry`中符合的注册项只有4个：

```java
// model可能是一个base64格式的img，经过处理后可以变成InputStream类型(dataClass)的数据
.append(String.class, InputStream.class, new DataUrlLoader.StreamFactory<String>())
// model可能是一个uri，这种情况下可能性非常多，因为网络图片、assets图片、磁盘图片等等都是一个uri
.append(String.class, InputStream.class, new StringLoader.StreamFactory())
// model可能是一个本地图片、assets图片，所以可以处理成ParcelFileDescriptor.class类型的数据
.append(String.class, ParcelFileDescriptor.class, new StringLoader.FileDescriptorFactory())
// model可能是一个本地图片，所以可以处理成为AssetFileDescriptor.class类型的数据
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
// getModelLoaders方法会获取所有声明可以处理String类型的ModelLoader，并调用handles方法过滤掉肯定不能处理的
@NonNull
public <A> List<ModelLoader<A, ?>> getModelLoaders(@NonNull A model) {
 // 返回所有注册过的modelClass为String的ModelLoader，就是上面列出来的四个
 List<ModelLoader<A, ?>> modelLoaders = getModelLoadersForClass(getClass(model));
 int size = modelLoaders.size();
 boolean isEmpty = true;
 List<ModelLoader<A, ?>> filteredLoaders = Collections.emptyList();
 for (int i = 0; i < size; i++) {
   ModelLoader<A, ?> loader = modelLoaders.get(i);
   // 对于每个ModelLoader，看看是否可能处理这种类型的数据
   // 此处会过滤第一个，因为我们传入的url不以data:image开头
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

// 返回所有声明可以处理modelClass为String的ModelLoader
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

我们看看`multiModelLoaderFactory.build(modelClass)`是如何获取所有声明可以处理modelClass的ModelLoader的：

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
     // 注册过的entry有很多，但是entry.modelClass是modelClass（即String.class）的同类或父类的却只有四个
     if (entry.handles(modelClass)) {
       alreadyUsedEntries.add(entry);
       // 对每一个符合条件的entry调用build接口，获取对应的ModelLoader
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
```

这里的entry的数据结构以及保存的值我们在上面提到过，下面我们看看`entry.factory.build(this)`创建了四个什么样的ModelLoader：

- `append(String.class, InputStream.class, new DataUrlLoader.StreamFactory<String>())`  
 该Factory会创建一个处理data scheme(`data:[mediatype][;base64],encoded_data`, e.g. data:image/gif;base64,R0lGO...lBCBMQiB0UjIQA7)类型数据的`DataUrlLoader`  
 **声明可能处理以**`data:image`**开头的model**
- `append(String.class, InputStream.class, new StringLoader.StreamFactory())`  
 该Factory能够从String中加载InputStream  
 **声明可能处理所有类型的model**
- `.append(String.class, ParcelFileDescriptor.class, new StringLoader.FileDescriptorFactory())`  
 该Factory能够从String中加载ParcelFileDescriptor  
 **声明可能处理所有类型的model**
- `.append(String.class, AssetFileDescriptor.class, new StringLoader.AssetFileDescriptorFactory())`  
 该Factory能够从String中加载AssetFileDescriptor    
 **声明可能处理所有类型的model**

此处的四个ModelLoader中，`DataUrlLoader.StreamFactory`的逻辑非常清晰明了，其他三个有点麻烦。因为它们都是创建的`StringLoader`，而`StringLoader`内部也有一个`MultiModelLoader`，在Factory中build `StringLoader`时，会调用`multiFactory.build`创建一个内部的`MultiModelLoader`。  
因为String可能指向的数据太多了，所以采取`MultiModelLoader`保存所有可能的`ModelLoader`，在处理时会遍历list找出所有可以处理的。

我们看看`StringLoader.StreamFactory()`的build过程：

```java
/**
 * Factory for loading {@link InputStream}s from Strings.
 */
public static class StreamFactory implements ModelLoaderFactory<String, InputStream> {

 @NonNull
 @Override
 public ModelLoader<String, InputStream> build(
     @NonNull MultiModelLoaderFactory multiFactory) {
   return new StringLoader<>(multiFactory.build(Uri.class, InputStream.class));
 }

 @Override
 public void teardown() {
   // Do nothing.
 }
}
```

这里调用了`MultiModelLoaderFactory.build(Class, Class)`方法，该方法的重载方法`MultiModelLoaderFactory.build(Class)`我们在上面遇到过，两个方法有一些差别，不要弄混淆了。

```java
@NonNull
public synchronized <Model, Data> ModelLoader<Model, Data> build(@NonNull Class<Model> modelClass /* Uri.class */,
   @NonNull Class<Data> dataClass /* InputStream.class */) {
 try {
   List<ModelLoader<Model, Data>> loaders = new ArrayList<>();
   boolean ignoredAnyEntries = false;
   for (Entry<?, ?> entry : entries) {
     // Avoid stack overflow recursively creating model loaders by only creating loaders in
     // recursive requests if they haven't been created earlier in the chain. For example:
     // A Uri loader may translate to another model, which in turn may translate back to a Uri.
     // The original Uri loader won't be provided to the intermediate model loader, although
     // other Uri loaders will be.
     //
     // 防止递归时重复加载到，造成StackOverflow
     if (alreadyUsedEntries.contains(entry)) {
       ignoredAnyEntries = true;
       continue;
     }
     // ⚡⚡️⚡️ 差别1，这里会检查两个class
     if (entry.handles(modelClass, dataClass)) {
       alreadyUsedEntries.add(entry);
       loaders.add(this.<Model, Data>build(entry));
       alreadyUsedEntries.remove(entry);
     }
   }
   // ⚡⚡️⚡️ 差别2，这里会检查loaders的数量，并做相应的处理
   if (loaders.size() > 1) {
     return factory.build(loaders, throwableListPool);
   } else if (loaders.size() == 1) {
     return loaders.get(0);
   } else {
     // Avoid crashing if recursion results in no loaders available. The assertion is supposed to
     // catch completely unhandled types, recursion may mean a subtype isn't handled somewhere
     // down the stack, which is often ok.
     if (ignoredAnyEntries) {
       return emptyModelLoader();
     } else {
       throw new NoModelLoaderAvailableException(modelClass, dataClass);
     }
   }
 } catch (Throwable t) {
   alreadyUsedEntries.clear();
   throw t;
 }
}
```

我们看一下四个注册项调用`this.<Model, Data>build(entry)`后返回的值：

`append(String.class, InputStream.class, new DataUrlLoader.StreamFactory<String>())`
- build --> `DataUrlLoader`

`append(String.class, InputStream.class, new StringLoader.StreamFactory())`  
- build --> `StringLoader` 参数urlLoader = `multiFactory.build(Uri.class, InputStream.class)`  
  将String当作Uri来处理，下面开始在注册表中找所有modelClass为Uri.class，dataClass为InputStream.class的注册项  
  - `append(Uri.class, InputStream.class, new DataUrlLoader.StreamFactory<Uri>())`  
     - build --> `DataUrlLoader`
  - `append(Uri.class, InputStream.class, new HttpUriLoader.Factory())`  
     - build --> `HttpUriLoader` 参数urlLoader = `multiFactory.build(GlideUrl.class, InputStream.class)`  
       Uri可能是一个GlideUrl，下面开始在注册表中找所有modelClass为GlideUrl.class，dataClass为InputStream.class的注册项
        - `.append(GlideUrl.class, InputStream.class, new HttpGlideUrlLoader.Factory())`  
           - build --> `HttpGlideUrlLoader`
  - `append(Uri.class, InputStream.class, new AssetUriLoader.StreamFactory(context.getAssets()))`  
     - build --> `AssetUriLoader`
  - `append(Uri.class, InputStream.class, new MediaStoreImageThumbLoader.Factory(context))`  
     - build --> `MediaStoreImageThumbLoader`
  - `append(Uri.class, InputStream.class, new MediaStoreVideoThumbLoader.Factory(context))`  
     - build --> `MediaStoreVideoThumbLoader`
  - `append(Uri.class, InputStream.class, new UriLoader.StreamFactory(contentResolver))`  
     - build --> `UriLoader`
  - `append(Uri.class, InputStream.class, new UrlUriLoader.StreamFactory())`  
     - build --> `UrlUriLoader` 参数urlLoader = `multiFactory.build(GlideUrl.class, InputStream.class)`  
        Uri可能是一个GlideUrl，下面开始在注册表中找所有modelClass为GlideUrl.class，dataClass为InputStream.class的注册项
        - `.append(GlideUrl.class, InputStream.class, new HttpGlideUrlLoader.Factory())`  
           - build --> `HttpGlideUrlLoader`
  - `MultiModelLoader`

`append(String.class, ParcelFileDescriptor.class, new StringLoader.FileDescriptorFactory())`  
- build --> `StringLoader` 参数urlLoader = `multiFactory.build(Uri.class, ParcelFileDescriptor.class)`  
  将String当作Uri来处理，下面开始在注册表中找所有modelClass为Uri.class，dataClass为ParcelFileDescriptor.class的注册项  
  - `append(Uri.class, ParcelFileDescriptor.class, new AssetUriLoader.FileDescriptorFactory(context.getAssets()))`  
     - build --> `AssetUriLoader`
  - `append(Uri.class, ParcelFileDescriptor.class, new UriLoader.FileDescriptorFactory(contentResolver))`   
     - build --> `UriLoader`
  - `MultiModelLoader`

`append(String.class, AssetFileDescriptor.class, new StringLoader.AssetFileDescriptorFactory())`  
- build --> `StringLoader` 参数urlLoader = `multiFactory.build(Uri.class, AssetFileDescriptor.class)`  
  将String当作Uri来处理，下面开始在注册表中找所有modelClass为Uri.class，dataClass为AssetFileDescriptor.class的注册项  
  - `append(Uri.class, AssetFileDescriptor.class, new UriLoader.AssetFileDescriptorFactory(contentResolver))`  
     - build --> `UriLoader`
  - `UriLoader`

上面就是`this.<Model, Data>build(entry)`获得到的4个loader，然后在`modelLoaderRegistry.getModelLoaders(model)`方法中被过滤掉第一个，现在就返回3.6.1节刚开始的`DecodeHelper.getLoadData`方法里面了。

在`DecodeHelper.getLoadData`方法中会遍历每个ModelLoader，并调用其`buildLoadData`方法，如果不为空则加入到数组中。由于此处的3个ModelLoader都是`StringLoader`，我们看看`StringLoader.buildLoadData`方法：

```java
@Override
public LoadData<Data> buildLoadData(@NonNull String model, int width, int height,
   @NonNull Options options) {
 // 由于我们传入的model是一个网络图片地址，所以uri肯定是正常的
 Uri uri = parseUri(model);
 // 下面判断uriLoader是否有可能处理
 // 如果没有可能，那么返回null
 if (uri == null || !uriLoader.handles(uri)) {
   return null;
 }
 // 否则调用uriLoader的buildLoadData方法
 return uriLoader.buildLoadData(uri, width, height, options);
}

@Nullable
private static Uri parseUri(String model) {
 Uri uri;
 if (TextUtils.isEmpty(model)) {
   return null;
 // See https://pmd.github.io/pmd-6.0.0/pmd_rules_java_performance.html#simplifystartswith
 } else if (model.charAt(0) == '/') {
   uri = toFileUri(model);
 } else {
   uri = Uri.parse(model);
   String scheme = uri.getScheme();
   if (scheme == null) {
     uri = toFileUri(model);
   }
 }
 return uri;
}

private static Uri toFileUri(String path) {
 return Uri.fromFile(new File(path));
}
```

所以重点就在于`StringLoader.uriLoader`了，该参数我们上面分析递归过程的时候分析到了，是一个`MultiModelLoader`对象：

```java
class MultiModelLoader<Model, Data> implements ModelLoader<Model, Data> {

 private final List<ModelLoader<Model, Data>> modelLoaders;
 private final Pool<List<Throwable>> exceptionListPool;

 MultiModelLoader(@NonNull List<ModelLoader<Model, Data>> modelLoaders,
     @NonNull Pool<List<Throwable>> exceptionListPool) {
   this.modelLoaders = modelLoaders;
   this.exceptionListPool = exceptionListPool;
 }

 @Override
 public LoadData<Data> buildLoadData(@NonNull Model model, int width, int height,
     @NonNull Options options) {
   Key sourceKey = null;
   int size = modelLoaders.size();
   List<DataFetcher<Data>> fetchers = new ArrayList<>(size);
   //noinspection ForLoopReplaceableByForEach to improve perf
   for (int i = 0; i < size; i++) {
     ModelLoader<Model, Data> modelLoader = modelLoaders.get(i);
     if (modelLoader.handles(model)) {
       LoadData<Data> loadData = modelLoader.buildLoadData(model, width, height, options);
       if (loadData != null) {
         sourceKey = loadData.sourceKey;
         fetchers.add(loadData.fetcher);
       }
     }
   }
   return !fetchers.isEmpty() && sourceKey != null
       ? new LoadData<>(sourceKey, new MultiFetcher<>(fetchers, exceptionListPool)) : null;
 }

 @Override
 public boolean handles(@NonNull Model model) {
   for (ModelLoader<Model, Data> modelLoader : modelLoaders) {
     if (modelLoader.handles(model)) {
       return true;
     }
   }
   return false;
 }
}
```

`MultiModelLoader`类的`handles`方法和`buildLoadData`方法都比较清晰明了。  

- `handles`方法是只要内部有一个ModelLoader有可能处理，就返回true。  
- `buildLoadData`方法会先调用`hanldes`进行第一次筛选，然后在调用ModelLoader的`buildLoadData`方法，如果不为空则保存起来，最后返回`LoadData<>(sourceKey, new MultiFetcher<>(fetchers, exceptionListPool))`对象。

我们还是走一下`DecodeHelper.getLoadData`方法中的流程，遍历一下调用三个`StringLoader`的`buildLoadData`方法：

`append(String.class, InputStream.class, new StringLoader.StreamFactory())`  
- build --> `StringLoader` 参数urlLoader = `MultiModelLoader`
  - `DataUrlLoader`  处理data:image资源  
     1 *handles*: **false**  
     3 *buildLoadData*: 跳过 因为*handles* return **false**
  - `HttpUriLoader` 处理http、https资源 参数urlLoader = `HttpGlideUrlLoader`  
     2 *handles*: **true**  
     4 *buildLoadData*: `HttpGlideUrlLoader.buildLoadData(GlideUrl)` --> `LoadData<>(url, new HttpUrlFetcher(url, timeout))` ---> `fetchers.add(loadData.fetcher)`
  - `AssetUriLoader` 处理file:///android_asset/资源  
     5 *buildLoadData*: 跳过 因为*handles* return **false**
  - `MediaStoreImageThumbLoader` 处理content://media/且path segments中不包含video字符串的资源  
     6 *buildLoadData*: 跳过 因为*handles* return **false**
  - `MediaStoreVideoThumbLoader` 处理content://media/且path segments中包含video字符串的资源  
     7 *buildLoadData*: 跳过 因为*handles* return **false**
  - `UriLoader` 处理scheme为file、android.resource、content的资源  
     8 *buildLoadData*: 跳过 因为*handles* return **false**
  - `UrlUriLoader` 处理http、https资源 参数urlLoader = `HttpGlideUrlLoader`  
     9 *buildLoadData*: `HttpGlideUrlLoader.buildLoadData(GlideUrl)` ---> `LoadData<>(url, new HttpUrlFetcher(url, timeout))` ---> `fetchers.add(loadData.fetcher)`
- 得到 `LoadData<>(sourceKey, new MultiFetcher<>(fetchers, exceptionListPool))`

`append(String.class, ParcelFileDescriptor.class, new StringLoader.FileDescriptorFactory())`  
- build --> `StringLoader` 参数urlLoader = `MultiModelLoader`
  - `AssetUriLoader` 处理file:///android_asset/资源  
     1 *handles*: **false**  
  - `UriLoader` 处理scheme为file、android.resource、content的资源  
     2 *handles*: **false**  
- 得到 `null`

`append(String.class, AssetFileDescriptor.class, new StringLoader.AssetFileDescriptorFactory())`  
- build --> `StringLoader` 参数urlLoader =
  - `UriLoader` 处理scheme为file、android.resource、content的资源  
     1 *handles*: **false**  
- 得到 `null`

由于`DecodeHelper.getLoadData`只添加不为null的`LoadData`，所以只返回了一个`StringLoader.StreamFactory()`生成的`LoadData`。  

返回到上一个方法`DecodeHelper.getCacheKeys`中：

```java
List<Key> getCacheKeys() {
 if (!isCacheKeysSet) {
   isCacheKeysSet = true;
   cacheKeys.clear();
   List<LoadData<?>> loadData = getLoadData();
   //noinspection ForLoopReplaceableByForEach to improve perf
   for (int i = 0, size = loadData.size(); i < size; i++) {
     LoadData<?> data = loadData.get(i);
     if (!cacheKeys.contains(data.sourceKey)) {
       cacheKeys.add(data.sourceKey);
     }
     for (int j = 0; j < data.alternateKeys.size(); j++) {
       if (!cacheKeys.contains(data.alternateKeys.get(j))) {
         cacheKeys.add(data.alternateKeys.get(j));
       }
     }
   }
 }
 return cacheKeys;
}
```

很显然，返回的list中只有一个key：上面的`LoadData`的`sourceKey`，即`GlideUrl`。

#### 3.6.2 DH.getRegisteredResourceClasses

接着返回到上一个方法，也就是本小节的第一个方法`ResourceCacheGenerator.startNext`中。  
接下来要执行的代码是：

```java
// ResourceCacheGenerator.startNext
List<Class<?>> resourceClasses = helper.getRegisteredResourceClasses();

// DecodeHelper
List<Class<?>> getRegisteredResourceClasses() {
 return glideContext.getRegistry()
     .getRegisteredResourceClasses(model.getClass(), resourceClass, transcodeClass);
}
```

这里又回到了`Registry`类中，头疼。但还是要分析。

```java
@NonNull
public <Model, TResource, Transcode> List<Class<?>> getRegisteredResourceClasses(
   @NonNull Class<Model> modelClass,
   @NonNull Class<TResource> resourceClass,
   @NonNull Class<Transcode> transcodeClass) {
 // modelClass = String.class
 // resourceClass 默认为 Object.class
 // transcodeClass = Drawable.class
 //
 // 首先取缓存
 List<Class<?>> result =
     modelToResourceClassCache.get(modelClass, resourceClass, transcodeClass);

 // 有缓存就返回缓存，没有就加载，然后放入缓存
 if (result == null) {
   result = new ArrayList<>();
   // 从modelLoaderRegistry中寻找所有modelClass为String或父类的entry，并返回其dataClass
   // 此处得到的dataClasses为[InputStream.class, ParcelFileDescriptor.class, AssetFileDescriptor.class]  
   // 因为四个注册项中，前两个dataClass都为InputStream.class，去重时肯定会去掉一个
   List<Class<?>> dataClasses = modelLoaderRegistry.getDataClasses(modelClass);
   for (Class<?> dataClass : dataClasses) {
       // 🔥🔥🔥 看不懂了，先看看对应的ResourceDecoderRegistry数据结构吧
       List<? extends Class<?>> registeredResourceClasses =
           decoderRegistry.getResourceClasses(dataClass, resourceClass);
       for (Class<?> registeredResourceClass : registeredResourceClasses) {
         List<Class<Transcode>> registeredTranscodeClasses = transcoderRegistry
             .getTranscodeClasses(registeredResourceClass, transcodeClass);
         if (!registeredTranscodeClasses.isEmpty() && !result.contains(registeredResourceClass)) {
           result.add(registeredResourceClass);
         }
       }
     }
   modelToResourceClassCache.put(
       modelClass, resourceClass, transcodeClass, Collections.unmodifiableList(result));
 }

 return result;
}
```

🔥🔥🔥 获取完dataClasses后，下面要对每一个dataClass调用`decoderRegistry.getResourceClasses`方法。  

这里涉及到了`ResourceDecoderRegistry`类，同样该类中的数据也是Glide创建时注入的，我们看一下相关的代码。

```java
// Glide
.append(Registry.BUCKET_BITMAP, ByteBuffer.class, Bitmap.class, byteBufferBitmapDecoder)
.append(Registry.BUCKET_BITMAP, InputStream.class, Bitmap.class, streamBitmapDecoder)
.append(Registry.BUCKET_BITMAP, ParcelFileDescriptor.class, Bitmap.class,
parcelFileDescriptorVideoDecoder)
.append(Registry.BUCKET_BITMAP, AssetFileDescriptor.class, Bitmap.class, VideoDecoder.asset(bitmapPool))
.append(Registry.BUCKET_BITMAP, Bitmap.class, Bitmap.class, new UnitBitmapDecoder())
.append(Registry.BUCKET_BITMAP_DRAWABLE, ByteBuffer.class, BitmapDrawable.class, new BitmapDrawableDecoder<>(resources, byteBufferBitmapDecoder))
.append(Registry.BUCKET_BITMAP_DRAWABLE, InputStream.class, BitmapDrawable.class, new BitmapDrawableDecoder<>(resources, streamBitmapDecoder))
.append(Registry.BUCKET_BITMAP_DRAWABLE, ParcelFileDescriptor.class, BitmapDrawable.class, new BitmapDrawableDecoder<>(resources, parcelFileDescriptorVideoDecoder))
.append(Registry.BUCKET_GIF, InputStream.class, GifDrawable.class, new StreamGifDecoder(imageHeaderParsers, byteBufferGifDecoder, arrayPool))
.append(Registry.BUCKET_GIF, ByteBuffer.class, GifDrawable.class, byteBufferGifDecoder)
.append(Registry.BUCKET_BITMAP, GifDecoder.class, Bitmap.class, new GifFrameResourceDecoder(bitmapPool))
.append(Uri.class, Drawable.class, resourceDrawableDecoder)
.append(Uri.class, Bitmap.class, new ResourceBitmapDecoder(resourceDrawableDecoder, bitmapPool))
.append(File.class, File.class, new FileDecoder())
.append(Drawable.class, Drawable.class, new UnitDrawableDecoder())

// Registry
public class Registry {
 public static final String BUCKET_GIF = "Gif";
 public static final String BUCKET_BITMAP = "Bitmap";
 public static final String BUCKET_BITMAP_DRAWABLE = "BitmapDrawable";
 private static final String BUCKET_PREPEND_ALL = "legacy_prepend_all";
 private static final String BUCKET_APPEND_ALL = "legacy_append";

 private final ResourceDecoderRegistry decoderRegistry;

 public Registry() {
   this.decoderRegistry = new ResourceDecoderRegistry();
   setResourceDecoderBucketPriorityList(
       Arrays.asList(BUCKET_GIF, BUCKET_BITMAP, BUCKET_BITMAP_DRAWABLE));
 }

 @NonNull
 public final Registry setResourceDecoderBucketPriorityList(@NonNull List<String> buckets) {
   // See #3296 and https://bugs.openjdk.java.net/browse/JDK-6260652.
   List<String> modifiedBuckets = new ArrayList<>(buckets.size());
   modifiedBuckets.addAll(buckets);
   modifiedBuckets.add(0, BUCKET_PREPEND_ALL);
   modifiedBuckets.add(BUCKET_APPEND_ALL);
   decoderRegistry.setBucketPriorityList(modifiedBuckets);
   return this;
 }

 @NonNull
 public <Data, TResource> Registry append(
     @NonNull Class<Data> dataClass,
     @NonNull Class<TResource> resourceClass,
     @NonNull ResourceDecoder<Data, TResource> decoder) {
   append(BUCKET_APPEND_ALL, dataClass, resourceClass, decoder);
   return this;
 }

 @NonNull
 public <Data, TResource> Registry append(
     @NonNull String bucket,
     @NonNull Class<Data> dataClass,
     @NonNull Class<TResource> resourceClass,
     @NonNull ResourceDecoder<Data, TResource> decoder) {
   decoderRegistry.append(bucket, decoder, dataClass, resourceClass);
   return this;
 }

 @NonNull
 public <Data, TResource> Registry prepend(
     @NonNull String bucket,
     @NonNull Class<Data> dataClass,
     @NonNull Class<TResource> resourceClass,
     @NonNull ResourceDecoder<Data, TResource> decoder) {
   decoderRegistry.prepend(bucket, decoder, dataClass, resourceClass);
   return this;
 }
}

// ResourceDecoderRegistry
public class ResourceDecoderRegistry {
 private final List<String> bucketPriorityList = new ArrayList<>();
 private final Map<String, List<Entry<?, ?>>> decoders = new HashMap<>();

 public synchronized void setBucketPriorityList(@NonNull List<String> buckets) {
   List<String> previousBuckets = new ArrayList<>(bucketPriorityList);
   bucketPriorityList.clear();
   bucketPriorityList.addAll(buckets);
   for (String previousBucket : previousBuckets) {
     if (!buckets.contains(previousBucket)) {
       // Keep any buckets from the previous list that aren't included here, but but them at the
       // end.
       bucketPriorityList.add(previousBucket);
     }
   }
 }

 public synchronized <T, R> void append(@NonNull String bucket,
     @NonNull ResourceDecoder<T, R> decoder,
     @NonNull Class<T> dataClass, @NonNull Class<R> resourceClass) {
   getOrAddEntryList(bucket).add(new Entry<>(dataClass, resourceClass, decoder));
 }

 public synchronized <T, R> void prepend(@NonNull String bucket,
     @NonNull ResourceDecoder<T, R> decoder,
     @NonNull Class<T> dataClass, @NonNull Class<R> resourceClass) {
   getOrAddEntryList(bucket).add(0, new Entry<>(dataClass, resourceClass, decoder));
 }

 @NonNull
 private synchronized List<Entry<?, ?>> getOrAddEntryList(@NonNull String bucket) {
   if (!bucketPriorityList.contains(bucket)) {
     // Add this unspecified bucket as a low priority bucket.
     bucketPriorityList.add(bucket);
   }
   List<Entry<?, ?>> entries = decoders.get(bucket);
   if (entries == null) {
     entries = new ArrayList<>();
     decoders.put(bucket, entries);
   }
   return entries;
 }
}
```

`ResourceDecoderRegistry`内部维持着一个具有优先级 bucket 的 list，优先级顺序由BUCKET在`bucketPriorityList`中的顺序决定。  
在`Registry`的构造器中，创建`ResourceDecoderRegistry`后，就调用`setResourceDecoderBucketPriorityList`方法调整了其优先级，优先级别为：  
BUCKET_PREPEND_ALL, BUCKET_GIF, BUCKET_BITMAP, BUCKET_BITMAP_DRAWABLE, BUCKET_APPEND_ALL。  

`ResourceDecoderRegistry`的`append`方法和`prepend`方法就是向对应的桶中将entry插入到尾部或头部。

下面就是`ResourceDecoderRegistry`里面数据的图，decoders里面的数字表示的Entry与上面注册代码中行数相对应：

<figure style="width: 66%" class="align-center">
   <img src="/assets/images/android/glide-resource-decoder-registry-content.png">
   <figcaption>ResourceDecoderRegistry内部数据模型</figcaption>
</figure>

了解完了`ResourceDecoderRegistry`之后，我们在回到🔥🔥🔥原来的位置继续看看`decoderRegistry.getResourceClasses`方法干了什么：

```java
@NonNull
@SuppressWarnings("unchecked")
public synchronized <T, R> List<Class<R>> getResourceClasses(@NonNull Class<T> dataClass,
   @NonNull Class<R> resourceClass) {
 List<Class<R>> result = new ArrayList<>();
 for (String bucket : bucketPriorityList) {
   List<Entry<?, ?>> entries = decoders.get(bucket);
   if (entries == null) {
     continue;
   }
   for (Entry<?, ?> entry : entries) {
     if (entry.handles(dataClass, resourceClass)
         && !result.contains((Class<R>) entry.resourceClass)) {
       result.add((Class<R>) entry.resourceClass);
     }
   }
 }
 return result;
}
```

那么，该方法的作用就是根据传入的dataClass以及resourceClass在桶中依次按顺序查找映射关系，如果可以找到就返回这条映射关系的resourceClass。

这里的入参`dataClass in　[InputStream.class, ParcelFileDescriptor.class, AssetFileDescriptor.class]`, `resourceClass = Object.class`。  

上面的方法会运行三次，每一次的结果如下：

1. InputStream.class & Object.class  
  注册表第11、3、9行所对应的resourceClass 即`GifDrawable.class`、`Bitmap.class`、`BitmapDrawable.class`
2. ParcelFileDescriptor.class & Object.class  
  注册表第4、10行所对应的resourceClass 即`Bitmap.class`、`BitmapDrawable.class`
3. AssetFileDescriptor.class & Object.class  
  注册表第6行所对应的resourceClass 即`Bitmap.class`

OK，离看完这个部分的代码更近了一步，我的眼睛已经受不了了:(  

回到`Registry.getRegisteredResourceClasses`方法中，下面将会对每次运行返回的resourceClasses数组进行遍历，并调用了`transcoderRegistry.getTranscodeClasses`方法：

```java
// Registry.getRegisteredResourceClasses
for (Class<?> dataClass : dataClasses) {
 // 我们刚才分析了这个方法，返回值看上面的分析
 List<? extends Class<?>> registeredResourceClasses =
     decoderRegistry.getResourceClasses(dataClass, resourceClass);
 for (Class<?> registeredResourceClass : registeredResourceClasses) {
   // 🔥🔥🔥 现在分析这个方法
   List<Class<Transcode>> registeredTranscodeClasses = transcoderRegistry
       .getTranscodeClasses(registeredResourceClass, transcodeClass);
   if (!registeredTranscodeClasses.isEmpty() && !result.contains(registeredResourceClass)) {
     result.add(registeredResourceClass);
   }
 }
}
```

🔥🔥🔥 现在分析一下`transcoderRegistry.getTranscodeClasses`方法。

和上面分析过的两个Registry一样，`TranscoderRegistry`也同样是在Glide构建的时候注册进来的，相关代码如下：

```java
// Glide
.register(Bitmap.class, BitmapDrawable.class, new BitmapDrawableTranscoder(resources))
.register(Bitmap.class, byte[].class, bitmapBytesTranscoder)
.register(Drawable.class, byte[].class, new DrawableBytesTranscoder(bitmapPool, bitmapBytesTranscoder, gifDrawableBytesTranscoder))
.register(GifDrawable.class, byte[].class, gifDrawableBytesTranscoder);

// Registry
public class Registry {
 private final TranscoderRegistry transcoderRegistry;

 public Registry() {
   this.transcoderRegistry = new TranscoderRegistry();
 }

 @NonNull
 public <TResource, Transcode> Registry register(
     @NonNull Class<TResource> resourceClass, @NonNull Class<Transcode> transcodeClass,
     @NonNull ResourceTranscoder<TResource, Transcode> transcoder) {
   transcoderRegistry.register(resourceClass, transcodeClass, transcoder);
   return this;
 }
}

public class TranscoderRegistry {
 private final List<Entry<?, ?>> transcoders = new ArrayList<>();

 public synchronized <Z, R> void register(
     @NonNull Class<Z> decodedClass, @NonNull Class<R> transcodedClass,
     @NonNull ResourceTranscoder<Z, R> transcoder) {
   transcoders.add(new Entry<>(decodedClass, transcodedClass, transcoder));
 }
}
```

注册代码很简单，就是保存到list中就完事了。看看`TranscoderRegistry.getTranscodeClasses`方法：

```java
@NonNull
public synchronized <Z, R> List<Class<R>> getTranscodeClasses(
   @NonNull Class<Z> resourceClass, @NonNull Class<R> transcodeClass) {
 List<Class<R>> transcodeClasses = new ArrayList<>();
 // GifDrawable -> Drawable is just the UnitTranscoder, as is GifDrawable -> GifDrawable.
 // 🔥路径1
 if (transcodeClass.isAssignableFrom(resourceClass)) {
   transcodeClasses.add(transcodeClass);
   return transcodeClasses;
 }

 // 🔥路径2
 for (Entry<?, ?> entry : transcoders) {
   if (entry.handles(resourceClass, transcodeClass)) {
     transcodeClasses.add(transcodeClass);
   }
 }

 // list添加的都是入参transcodeClass
 return transcodeClasses;
}
```

此方法的作用是根据resourceClass和transcodeClass，从自身或者注册表的“map”中找出`transcodeClass`。

回到`Registry.getRegisteredResourceClasses`方法中的第二层for loop继续分析，下面就是对每个resourceClass得到的registeredTranscodeClasses（transcodeClass为`Drawable.class`）

1. InputStream.class & Object.class  
  resourceClass为
  - `GifDrawable.class`  
     路径1 允许添加resourceClass
  - `Bitmap.class`  
     路径2 走Glide注入代码片段的第2行 允许添加resourceClass
  - `BitmapDrawable.class`  
     路径1 允许添加resourceClass
2. ParcelFileDescriptor.class & Object.class  
  resourceClass为
  - `Bitmap.class`  
     路径2 走Glide注入代码片段的第2行 但resourceClass已经添加过
  - `BitmapDrawable.class`  
     路径1 但resourceClass已经添加过
3. AssetFileDescriptor.class & Object.class  
  resourceClass为
  - `Bitmap.class`  
     路径2 走Glide注入代码片段的第2行 但resourceClass已经添加过

因此，`Registry.getRegisteredResourceClasses`返回了`[GifDrawable.class、Bitmap.class、BitmapDrawable.class]`数组，该数组会经过`DecodeHelper`返回到`ResourceCacheGenerator.startNext`方法的调用中。

#### 3.6.3 寻找缓存文件并加载

继续回到本小节的第一个方法`ResourceCacheGenerator.startNext`方法中。下面要执行的代码是一个while循环，循环结束的标志是找到了缓存文件：

```java
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
```

走到这里，由于是初次加载，所以DiskLruCache里面肯定是没有缓存的。  

注意这里的Key的组成，在之前我们描述过`ResourceCacheGenerator`的作用：获取采样后、transformed后资源文件的缓存文件。在第3节中我们可以看到，DownsampleStrategy和Transformation保存在了`BaseRequestOptions`里面，前者保存在`BaseRequestOptions.Options`里，后者保存在`transformations`里。在这里这两个参数都作为了缓存文件的Key，这也侧面验证了`ResourceCacheGenerator`的作用。

但在加载代码上加上话`.diskCacheStrategy(DiskCacheStrategy.RESOURCE)`，就可以到了缓存，这样可以接着一次性把后面的方法也分析完，先看看下面的这个方法：

```java
modelLoaders = helper.getModelLoaders(cacheFile);
```

内部调用了`Registry.getModelLoaders`方法：

```java
List<ModelLoader<File, ?>> getModelLoaders(File file)
   throws Registry.NoModelLoaderAvailableException {
 return glideContext.getRegistry().getModelLoaders(file);
}
```

该方法我们上面具体分析过，稍加回忆后我们可以写出`getModelLoaders(File)`方法的过程：

1. 首先找出注入时以`File.class`为modelClass的注入代码
2. 调用所有注入的`factory.build`方法得到`ModelLoader`
3. 过滤掉不可能处理`model`的`ModelLoader`

这样得到了以下四个ModelLoader

- `.append(File.class, ByteBuffer.class, new ByteBufferFileLoader.Factory())`
  - `ByteBufferFileLoader`
- `.append(File.class, InputStream.class, new FileLoader.StreamFactory())`
  - `FileLoader`
- `.append(File.class, ParcelFileDescriptor.class, new FileLoader.FileDescriptorFactory())`
  - `FileLoader`
- `.append(File.class, File.class, UnitModelLoader.Factory.<File>getInstance())`
  - `UnitModelLoader`

所以此时的modelLoaders值为`[ByteBufferFileLoader, FileLoader, FileLoader, UnitModelLoader]`。

接下来会调用每一个ModelLoader尝试加载数据，直到找到第一个可以处理的ModelLoader：

```java
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
```

这四个ModelLoader都会调用`buildLoadData`方法创建`LoadData`对象，该对象重要的成员变量是`DataFetcher`；然后调用`helper.hasLoadPath`根据`resourceClass`参数和`transcodeClass`参数判断是否有路径达到`DataFetcher.getDataClass`，如果有那就调用此fetcher进行loadData，任务执行完毕。

例子中符合条件的`ModelLoader`以及其`fetcher`如下：

- `ByteBufferFileLoader`  
  fetcher = `ByteBufferFetcher(file)`  
  fetcher.dataClass = `ByteBuffer.class`
- `FileLoader`  
  fetcher = `FileFetcher(model, fileOpener)`  
  fetcher.dataClass = `InputStream.class`
- `FileLoader`  
  fetcher = `FileFetcher(model, fileOpener)`  
  fetcher.dataClass = `ParcelFileDescriptor.class`
- `UnitModelLoader`  
  fetcher = `UnitFetcher<>(model)`  
  fetcher.dataClass = `File.class`


看一下`DecodeHelper.getLoadPath`方法是如何判断路径的：

```java
// DecodeHelper
<Data> LoadPath<Data, ?, Transcode> getLoadPath(Class<Data> dataClass) {
 return glideContext.getRegistry().getLoadPath(dataClass, resourceClass, transcodeClass);
}

// Registry
@Nullable
public <Data, TResource, Transcode> LoadPath<Data, TResource, Transcode> getLoadPath(
   @NonNull Class<Data> dataClass, @NonNull Class<TResource> resourceClass,
   @NonNull Class<Transcode> transcodeClass) {
 // 先取缓存
 LoadPath<Data, TResource, Transcode> result =
     loadPathCache.get(dataClass, resourceClass, transcodeClass);
 // 如果取到NO_PATHS_SIGNAL这条LoadPath，那么返回null
 if (loadPathCache.isEmptyLoadPath(result)) {
   return null;
 } else if (result == null) {
   // 取到null，说明还没有获取过
   // 那么先获取decodePaths，在创建LoadPath对象并存入缓存中
   List<DecodePath<Data, TResource, Transcode>> decodePaths =
       getDecodePaths(dataClass, resourceClass, transcodeClass);
   // It's possible there is no way to decode or transcode to the desired types from a given
   // data class.
   if (decodePaths.isEmpty()) {
     result = null;
   } else {
     result =
         new LoadPath<>(
             dataClass, resourceClass, transcodeClass, decodePaths, throwableListPool);
   }
   // 存入缓存
   loadPathCache.put(dataClass, resourceClass, transcodeClass, result);
 }
 return result;
}
```

可以看出，`getLoadPath`的关键就是`getDecodePaths`方法：

```java
@NonNull
private <Data, TResource, Transcode> List<DecodePath<Data, TResource, Transcode>> getDecodePaths(
   @NonNull Class<Data> dataClass, @NonNull Class<TResource> resourceClass,
   @NonNull Class<Transcode> transcodeClass) {
 List<DecodePath<Data, TResource, Transcode>> decodePaths = new ArrayList<>();
 // 1
 List<Class<TResource>> registeredResourceClasses =
     decoderRegistry.getResourceClasses(dataClass, resourceClass);

 for (Class<TResource> registeredResourceClass : registeredResourceClasses) {
   // 2
   List<Class<Transcode>> registeredTranscodeClasses =
       transcoderRegistry.getTranscodeClasses(registeredResourceClass, transcodeClass);

   for (Class<Transcode> registeredTranscodeClass : registeredTranscodeClasses) {
     // 3
     List<ResourceDecoder<Data, TResource>> decoders =
         decoderRegistry.getDecoders(dataClass, registeredResourceClass);
     ResourceTranscoder<TResource, Transcode> transcoder =
         transcoderRegistry.get(registeredResourceClass, registeredTranscodeClass);
     // 4
     @SuppressWarnings("PMD.AvoidInstantiatingObjectsInLoops")
     DecodePath<Data, TResource, Transcode> path =
         new DecodePath<>(dataClass, registeredResourceClass, registeredTranscodeClass,
             decoders, transcoder, throwableListPool);
     decodePaths.add(path);
   }
 }
 return decodePaths;
}
```

首先就是`decoderRegistry.getResourceClasses(dataClass, resourceClass)`方法，该方法我们上面分析过，作用就是根据传入的dataClass以及resourceClass在Registry中找映射关系，如果可以找到就返回这条映射关系的resourceClass（该方法中dataClass为传入的fetcher.dataClass，resourceClass值为Object.class）。

然后对于每个获取到的registeredResourceClass，调用`transcoderRegistry.getTranscodeClasses`方法，此方法之前也解析过，其作用是根据resourceClass和transcodeClass，从自身或者注册表的“map”中找出transcodeClass（参数transcodeClass为`Drawable.class`）。

最后，对于每个registeredResourceClass和registeredTranscodeClass，都会获取其`ResourceDecoder`和`ResourceTranscoder`，并将这些参数组成一个`DecodePath`保存到list，最后返回。我们先看一下这些方法的实现，最后在给出每一步的操作结果。

所以我们直接看`decoderRegistry.getDecoders`方法：

```java
@NonNull
@SuppressWarnings("unchecked")
public synchronized <T, R> List<ResourceDecoder<T, R>> getDecoders(@NonNull Class<T> dataClass,
   @NonNull Class<R> resourceClass) {
 List<ResourceDecoder<T, R>> result = new ArrayList<>();
 for (String bucket : bucketPriorityList) {
   List<Entry<?, ?>> entries = decoders.get(bucket);
   if (entries == null) {
     continue;
   }
   for (Entry<?, ?> entry : entries) {
     if (entry.handles(dataClass, resourceClass)) {
       result.add((ResourceDecoder<T, R>) entry.decoder);
     }
   }
 }
 // TODO: cache result list.

 return result;
}
```

该方法也非常简单，那就是遍历所有的bucket中的所有entry，找出所有能处理dataClass、resourceClass的entry，保存其decoder。

最后看一下`transcoderRegistry.get`方法：

```java
@NonNull
@SuppressWarnings("unchecked")
public synchronized <Z, R> ResourceTranscoder<Z, R> get(
   @NonNull Class<Z> resourceClass, @NonNull Class<R> transcodedClass) {
 // For example, there may be a transcoder that can convert a GifDrawable to a Drawable, which
 // will be caught above. However, if there is no registered transcoder, we can still just use
 // the UnitTranscoder to return the Drawable because the transcode class (Drawable) is
 // assignable from the resource class (GifDrawable).
 if (transcodedClass.isAssignableFrom(resourceClass)) {
   return (ResourceTranscoder<Z, R>) UnitTranscoder.get();
 }
 for (Entry<?, ?> entry : transcoders) {
   if (entry.handles(resourceClass, transcodedClass)) {
     return (ResourceTranscoder<Z, R>) entry.transcoder;
   }
 }

 throw new IllegalArgumentException(
     "No transcoder registered to transcode from " + resourceClass + " to " + transcodedClass);
}
```

该方法逻辑和我们之前谈到过的`transcoderRegistry.getTranscodeClasses`方法类似，只不过返回的是对应的`transcoder`对象。

了解到上面这些方法的作用后，我们列出`Registry.getDecodePaths`方法执行的步骤以及结果（dataClass为下面的fetcher.dataClass，resourceClass为Object.class，transcodeClass为Drawable.class）：

- `ByteBufferFileLoader`  
  fetcher = `ByteBufferFetcher(file)`  
  fetcher.dataClass = `ByteBuffer.class`  
  1 registeredResourceClasses = `[GifDrawable.class, Bitmap.class, BitmapDrawable.class]`  
  2 registeredTranscodeClasses = `[[Drawable.class], [Drawable.class], [Drawable.class]]`  
  3 decoders = `[[ByteBufferGifDecoder], [ByteBufferBitmapDecoder], [BitmapDrawableDecoder]]`  
  4 transcoder = `[UnitTranscoder, BitmapDrawableTranscoder, UnitTranscoder]`  
  5 decodePaths = `[DecodePath(ByteBuffer.class, GifDrawable.class, Drawable.class, [ByteBufferGifDecoder], UnitTranscoder), DecodePath(ByteBuffer.class, Bitmap.class, Drawable.class, [ByteBufferBitmapDecoder], BitmapDrawableTranscoder), DecodePath(ByteBuffer.class, BitmapDrawable.class, Drawable.class, [BitmapDrawableDecoder], UnitTranscoder)]`  
  6 loadPath = `LoadPath(ByteBuffer.class, Object.class, Drawable.class, decodePaths)`  

在`ByteBufferFileLoader`中，我们已经找到一个一条可以加载的路径，那么就调用此`fetcher.loadData`方法进行加载。同时，该方法`ResourceCacheGenerator.startNext`返回true，这就意味着`DecodeJob`无需在尝试另外的`DataFetcherGenerator`进行加载，整个`into`过程已经大致完成，剩下的就是等待资源加载完毕后触发回调即可。

下面我们接着看看`loadData.fetcher.loadData(helper.getPriority(), this)`这条语句干了什么，在上面的分析中我们知道，这里的fetcher是`ByteBufferFetcher`对象，其loadData方法如下：

```java
@Override
public void loadData(@NonNull Priority priority,
   @NonNull DataCallback<? super ByteBuffer> callback) {
 ByteBuffer result;
 try {
   // 这里的file就是缓存下来的source file
   // 路径在demo中为 /data/data/yorek.demoandtest/cache/image_manager_disk_cache/65a6e0855da59221f073aba07dc6c69206834ef83f60c58062bee458fcac7dde.0
   result = ByteBufferUtil.fromFile(file);
 } catch (IOException e) {
   if (Log.isLoggable(TAG, Log.DEBUG)) {
     Log.d(TAG, "Failed to obtain ByteBuffer for file", e);
   }
   callback.onLoadFailed(e);
   return;
 }

 callback.onDataReady(result);
}
```

`ByteBufferUtil.fromFile`使用了`RandomAccessFile`和`FileChannel`进行文件操作。如果操作失败，调用`callback.onLoadFailed(e)`通知`ResourceCacheGenerator`类，该类会将操作转发给`DecodeJob`；`callback.onDataReady`操作类似。这样程序就回到了`DecodeJob`回调方法中了。

我们暂时不继续分析`DecodeJob`的回调方法，因为在本节中缓存文件本来是没有的，所以会交给下一个`DataFetcherGenerator`进行尝试处理，所以后面肯定也会遇到`DecodeJob`的回调方法。  

### 3.7 DataCacheGenerator

由于`Glide-with-load-into`三步没有在`ResourceCacheGenerator`中被fetch，所以回到`DecodeJob.runGenerators`方法中，继续执行while循环：

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

由于`diskCacheStrategy`默认为`DiskCacheStrategy.AUTOMATIC`，其`decodeCachedData()`返回true，所以`getNextStage(stage)`是`Stage.DATA_CACHE`。因此`getNextGenerator()`方法返回了`DataCacheGenerator(decodeHelper, this)`。然后在while循环中会执行其`startNext()`方法。

!!! success
    有了在`ResourceCacheGenerator`中缓存好的大量变量，`DataCacheGenerator`和`SourceGenerator`代码就非常简单了。


`ResourceCacheGenerator`在构造的时候就将`helper.getCacheKeys()`保存了起来，我们前面在谈`ResourceCacheGenerator`的时候提到过，`helper.getCacheKeys()`采取了防止重复加载的策略。

构造器相关代码如下：

```java
private final List<Key> cacheKeys;
private final DecodeHelper<?> helper;
private final FetcherReadyCallback cb;

DataCacheGenerator(DecodeHelper<?> helper, FetcherReadyCallback cb) {
  this(helper.getCacheKeys(), helper, cb);
}

DataCacheGenerator(List<Key> cacheKeys, DecodeHelper<?> helper, FetcherReadyCallback cb) {
  this.cacheKeys = cacheKeys;
  this.helper = helper;
  this.cb = cb;
}
```

然后看一下它的`startNext()`方法，该方法和`ResourceCacheGenerator.startNext`方法非常相似，由于获取的是原始的源数据，所以这里的key的组成非常简单。

```java
@Override
public boolean startNext() {
  while (modelLoaders == null || !hasNextModelLoader()) {
    sourceIdIndex++;
    if (sourceIdIndex >= cacheKeys.size()) {
      return false;
    }

    Key sourceId = cacheKeys.get(sourceIdIndex);
    // PMD.AvoidInstantiatingObjectsInLoops The loop iterates a limited number of times
    // and the actions it performs are much more expensive than a single allocation.
    @SuppressWarnings("PMD.AvoidInstantiatingObjectsInLoops")
    Key originalKey = new DataCacheKey(sourceId, helper.getSignature());
    cacheFile = helper.getDiskCache().get(originalKey);
    if (cacheFile != null) {
      this.sourceKey = sourceId;
      modelLoaders = helper.getModelLoaders(cacheFile);
      modelLoaderIndex = 0;
    }
  }

  loadData = null;
  boolean started = false;
  while (!started && hasNextModelLoader()) {
    ModelLoader<File, ?> modelLoader = modelLoaders.get(modelLoaderIndex++);
    loadData =
        modelLoader.buildLoadData(cacheFile, helper.getWidth(), helper.getHeight(),
            helper.getOptions());
    if (loadData != null && helper.hasLoadPath(loadData.fetcher.getDataClass())) {
      started = true;
      loadData.fetcher.loadData(helper.getPriority(), this);
    }
  }
  return started;
}

private boolean hasNextModelLoader() {
  return modelLoaderIndex < modelLoaders.size();
}
```

由于我们第一次加载，本地缓存文件肯定是没有的。我们接着看最后一个`SourceGenerator`，看看它是如何获取数据的。

### 3.8 SourceGenerator

在这之前我们需要注意，如果Glide在加载时指定了`.onlyRetrieveFromCache(true)`，那么在`DecodeJob.getNextStage(Stage)`方法中就会跳过`Stage.SOURCE`直接到达`Stage.FINISHED`。  
且当为`Stage.SOURCE`时，`DecodeJob.runGenerators()`方法会调用`reschedule()`方法，这将会导致`DecodeJob`重新被提交到`sourceExecutor`这个线程池中，同时runReason被赋值为`RunReason.SWITCH_TO_SOURCE_SERVICE`。该线程池默认实现为`GlideExecutor.newSourceExecutor()`:

```java
private static final int MAXIMUM_AUTOMATIC_THREAD_COUNT = 4;
private static final String DEFAULT_SOURCE_EXECUTOR_NAME = "source";

public static GlideExecutor newSourceExecutor() {
  return newSourceExecutor(
      calculateBestThreadCount(),
      DEFAULT_SOURCE_EXECUTOR_NAME,
      UncaughtThrowableStrategy.DEFAULT);
}

public static int calculateBestThreadCount() {
  if (bestThreadCount == 0) {
    bestThreadCount =
        Math.min(MAXIMUM_AUTOMATIC_THREAD_COUNT, RuntimeCompat.availableProcessors());
  }
  return bestThreadCount;
}
```

由于`DecodeJob`实现了`Runnable`接口，那么直接看`run()`方法里面的真正实现`runWrapped()`方法：

```java
private void runWrapped() {
  switch (runReason) {
    ...
    case SWITCH_TO_SOURCE_SERVICE:
      runGenerators();
      break;
  }
}
```

这里还是执行了`runGenerators()`方法。该方法我们已经很熟悉了，在这里会执行`SourceGenerator.startNext()`方法。  

```java
private int loadDataListIndex;

@Override
public boolean startNext() {
  // 首次运行dataToCache为null
  if (dataToCache != null) {
    Object data = dataToCache;
    dataToCache = null;
    cacheData(data);
  }

  // 首次运行sourceCacheGenerator为null
  if (sourceCacheGenerator != null && sourceCacheGenerator.startNext()) {
    return true;
  }
  sourceCacheGenerator = null;

  // 准备加载数据
  loadData = null;
  boolean started = false;
  // 这里直接调用了DecodeHelper.getLoadData()方法
  // 该方法在前面在ResourceCacheGenerator中被调用过，且被缓存了下来
  while (!started && hasNextModelLoader()) {
    loadData = helper.getLoadData().get(loadDataListIndex++);
    if (loadData != null
        && (helper.getDiskCacheStrategy().isDataCacheable(loadData.fetcher.getDataSource())
        || helper.hasLoadPath(loadData.fetcher.getDataClass()))) {
      started = true;
      loadData.fetcher.loadData(helper.getPriority(), this);
    }
  }
  return started;
}

private boolean hasNextModelLoader() {
  return loadDataListIndex < helper.getLoadData().size();
}
```

`helper.getLoadData()`的值在`ResourceCacheGenerator`中就已经被获取并缓存下来了，这是一个`MultiModelLoader`对象生成的`LoadData`对象，`LoadData`对象里面有两个fetcher。详见[第3.6.1节的末尾部分](/android/3rd-library/glide2/#361-helpergetcachekeys)

在上面的方法中，我们会遍历LoadData list，找出符合条件的LoadData，然后调用`loadData.fetcher.loadData`加载数据。  
在loadData不为空的前提下，会判断Glide的缓存策略是否可以缓存此数据源，或者是否有加载路径。  

我们知道，默认情况下Glide的缓存策略是`DiskCacheStrategy.AUTOMATIC`，其`isDataCacheable`实现如下：

```java
@Override
public boolean isDataCacheable(DataSource dataSource) {
  return dataSource == DataSource.REMOTE;
}
```

所以，我们看一下`loadData.fetcher.getDataSource()`返回了什么：

```java
static class MultiFetcher<Data> implements DataFetcher<Data>, DataCallback<Data> {
  @NonNull
  @Override
  public DataSource getDataSource() {
    return fetchers.get(0).getDataSource();
  }
}

// MultiFetcher中fetchers数组保存的两个DataFetcher都是HttpUrlFetcher
public class HttpUrlFetcher implements DataFetcher<InputStream> {
  @NonNull
  @Override
  public DataSource getDataSource() {
  return DataSource.REMOTE;
  }
}
```

显然，Glide的缓存策略是可以缓存此数据源的。所以会进行数据的加载。接着看看`MultiFetcher.loadData`方法。  
这里首先会调用内部的第0个DataFetcher进行加载，同时设置回调为自己。当这一个DataFetcher加载失败时，会尝试调用下一个DataFetcher进行加载，如果没有所有的DataFetcher都加载失败了，就把错误抛给上一层；当有DataFetcher加载成功时，也会把获取到的数据转交给上一层。

```java
static class MultiFetcher<Data> implements DataFetcher<Data>, DataCallback<Data> {

  private final List<DataFetcher<Data>> fetchers;
  private int currentIndex;
  private Priority priority;
  private DataCallback<? super Data> callback;

  @Override
  public void loadData(
      @NonNull Priority priority, @NonNull DataCallback<? super Data> callback) {
    this.priority = priority;
    this.callback = callback;
    exceptions = throwableListPool.acquire();
    fetchers.get(currentIndex).loadData(priority, this);

    // If a race occurred where we cancelled the fetcher in cancel() and then called loadData here
    // immediately after, make sure that we cancel the newly started fetcher. We don't bother
    // checking cancelled before loadData because it's not required for correctness and would
    // require an unlikely race to be useful.
    if (isCancelled) {
      cancel();
    }
  }

  @Override
  public void onDataReady(@Nullable Data data) {
    if (data != null) {
      callback.onDataReady(data);
    } else {
      startNextOrFail();
    }
  }

  @Override
  public void onLoadFailed(@NonNull Exception e) {
    Preconditions.checkNotNull(exceptions).add(e);
    startNextOrFail();
  }

  private void startNextOrFail() {
    if (isCancelled) {
      return;
    }

    if (currentIndex < fetchers.size() - 1) {
      currentIndex++;
      loadData(priority, callback);
    } else {
      Preconditions.checkNotNull(exceptions);
      callback.onLoadFailed(new GlideException("Fetch failed", new ArrayList<>(exceptions)));
    }
  }
}
```

这里面两个DataFetcher都是参数相同的`HttpUrlFetcher`实例，我们直接看里面如何从网络加载图片的。

```java
@Override
public void loadData(@NonNull Priority priority,
    @NonNull DataCallback<? super InputStream> callback) {
  long startTime = LogTime.getLogTime();
  try {
    InputStream result = loadDataWithRedirects(glideUrl.toURL(), 0, null, glideUrl.getHeaders());
    callback.onDataReady(result);
  } catch (IOException e) {
    if (Log.isLoggable(TAG, Log.DEBUG)) {
      Log.d(TAG, "Failed to load data for url", e);
    }
    callback.onLoadFailed(e);
  } finally {
    if (Log.isLoggable(TAG, Log.VERBOSE)) {
      Log.v(TAG, "Finished http url fetcher fetch in " + LogTime.getElapsedMillis(startTime));
    }
  }
}
```

很显然，这里将请求操作放到了`loadDataWithRedirects`方法中，然后将请求结果通过回调返回上一层也就是`MultiFetcher`中。  

`loadDataWithRedirects`第二个参数表示重定向的次数，在方法内部限制了重定向发生的次数不能超过`MAXIMUM_REDIRECTS=5`次。  
第三个参数是发生重定向前的原始url，用来与当前url判断，是不是重定向到自身了。而且可以看出，Glide加载网络图片使用的是`HttpUrlConnection`。  
第四个参数headers默认为`Headers.DEFAULT`，就是一个User-Agent的key-value对。

代码如下：

```java
private InputStream loadDataWithRedirects(URL url, int redirects, URL lastUrl,
    Map<String, String> headers) throws IOException {
  // 检查重定向次数
  if (redirects >= MAXIMUM_REDIRECTS) {
    throw new HttpException("Too many (> " + MAXIMUM_REDIRECTS + ") redirects!");
  } else {
    // Comparing the URLs using .equals performs additional network I/O and is generally broken.
    // See http://michaelscharf.blogspot.com/2006/11/javaneturlequals-and-hashcode-make.html.
    try {
      // 检查是不是重定向到自身了
      if (lastUrl != null && url.toURI().equals(lastUrl.toURI())) {
        throw new HttpException("In re-direct loop");

      }
    } catch (URISyntaxException e) {
      // Do nothing, this is best effort.
    }
  }

  // connectionFactory默认是DefaultHttpUrlConnectionFactory
  // 其build方法就是调用了url.openConnection()
  urlConnection = connectionFactory.build(url);
  for (Map.Entry<String, String> headerEntry : headers.entrySet()) {
    urlConnection.addRequestProperty(headerEntry.getKey(), headerEntry.getValue());
  }
  urlConnection.setConnectTimeout(timeout);
  urlConnection.setReadTimeout(timeout);
  urlConnection.setUseCaches(false);
  urlConnection.setDoInput(true);

  // Stop the urlConnection instance of HttpUrlConnection from following redirects so that
  // redirects will be handled by recursive calls to this method, loadDataWithRedirects.
  // 禁止HttpUrlConnection自动重定向，重定向功能由本方法自己实现
  urlConnection.setInstanceFollowRedirects(false);

  // Connect explicitly to avoid errors in decoders if connection fails.
  urlConnection.connect();
  // Set the stream so that it's closed in cleanup to avoid resource leaks. See #2352.
  stream = urlConnection.getInputStream();
  if (isCancelled) {
    return null;
  }
  final int statusCode = urlConnection.getResponseCode();
  if (isHttpOk(statusCode)) {
    // statusCode=2xx，请求成功
    return getStreamForSuccessfulRequest(urlConnection);
  } else if (isHttpRedirect(statusCode)) {
    // statusCode=3xx，需要重定向
    String redirectUrlString = urlConnection.getHeaderField("Location");
    if (TextUtils.isEmpty(redirectUrlString)) {
      throw new HttpException("Received empty or null redirect url");
    }
    URL redirectUrl = new URL(url, redirectUrlString);
    // Closing the stream specifically is required to avoid leaking ResponseBodys in addition
    // to disconnecting the url connection below. See #2352.
    cleanup();
    return loadDataWithRedirects(redirectUrl, redirects + 1, url, headers);
  } else if (statusCode == INVALID_STATUS_CODE) {
    // -1 表示不是HTTP响应
    throw new HttpException(statusCode);
  } else {
    // 其他HTTP错误
    throw new HttpException(urlConnection.getResponseMessage(), statusCode);
  }
}

// Referencing constants is less clear than a simple static method.
private static boolean isHttpOk(int statusCode) {
  return statusCode / 100 == 2;
}

// Referencing constants is less clear than a simple static method.
private static boolean isHttpRedirect(int statusCode) {
  return statusCode / 100 == 3;
}
```

现在我们已经获得网络图片的InputStream了，该资源会通过回调经过`MultiFetcher`到达`SourceGenerator`中。  

下面是`DataCallback`回调在`SourceGenerator`中的实现。

```java
@Override
public void onDataReady(Object data) {
  DiskCacheStrategy diskCacheStrategy = helper.getDiskCacheStrategy();
  if (data != null && diskCacheStrategy.isDataCacheable(loadData.fetcher.getDataSource())) {
    dataToCache = data;
    // We might be being called back on someone else's thread. Before doing anything, we should
    // reschedule to get back onto Glide's thread.
    cb.reschedule();
  } else {
    cb.onDataFetcherReady(loadData.sourceKey, data, loadData.fetcher,
        loadData.fetcher.getDataSource(), originalKey);
  }
}

@Override
public void onLoadFailed(@NonNull Exception e) {
  cb.onDataFetcherFailed(originalKey, e, loadData.fetcher, loadData.fetcher.getDataSource());
}
```

`onLoadFailed`很简单，直接调用`DecodeJob.onDataFetcherFailed`方法。`onDataReady`方法会首先判data能不能缓存，若能缓存则缓存起来，然后调用`DataCacheGenerator`进行加载缓存；若不能缓存，则直接调用`DecodeJob.onDataFetcherReady`方法通知外界data已经准备好了。

我们解读一下`onDataReady`里面的代码。首先，获取`DiskCacheStrategy`判断能不能被缓存，这里的判断代码在`SourceGenerator.startNext()`中出现过，显然是可以的。然后将data保存到`dataToCache`，并调用`cb.reschedule()`。  
`cb.reschedule()`我们在前面分析过，该方法的作用就是将`DecodeJob`提交到Glide的source线程池中。然后执行`DecodeJob.run()`方法，经过`runWrapped()`、 `runGenerators()`方法后，又回到了`SourceGenerator.startNext()`方法。

在方法的开头，会判断`dataToCache`是否为空，此时显然不为空，所以会调用`cacheData(Object)`方法进行data的缓存处理。缓存完毕后，会为该缓存文件生成一个`SourceCacheGenerator`。然后在`startNext()`方法中会直接调用该变量进行加载。

```java
@Override
public boolean startNext() {
  if (dataToCache != null) {
    Object data = dataToCache;
    dataToCache = null;
    cacheData(data);
  }

  if (sourceCacheGenerator != null && sourceCacheGenerator.startNext()) {
    return true;
  }
  sourceCacheGenerator = null;
}

private void cacheData(Object dataToCache) {
  long startTime = LogTime.getLogTime();
  try {
    Encoder<Object> encoder = helper.getSourceEncoder(dataToCache);
    DataCacheWriter<Object> writer =
        new DataCacheWriter<>(encoder, dataToCache, helper.getOptions());
    originalKey = new DataCacheKey(loadData.sourceKey, helper.getSignature());
    // 缓存data
    helper.getDiskCache().put(originalKey, writer);
    if (Log.isLoggable(TAG, Log.VERBOSE)) {
      Log.v(TAG, "Finished encoding source to cache"
          + ", key: " + originalKey
          + ", data: " + dataToCache
          + ", encoder: " + encoder
          + ", duration: " + LogTime.getElapsedMillis(startTime));
    }
  } finally {
    loadData.fetcher.cleanup();
  }

  sourceCacheGenerator =
      new DataCacheGenerator(Collections.singletonList(loadData.sourceKey), helper, this);
}
```

由于在构造`DataCacheGenerator`时，指定了`FetcherReadyCallback`为自己，所以`DataCacheGenerator`加载结果会由`SourceGenerator`转发给`DecodeJob`。  
由于资源会由`DataCacheGenerator`解码，所以我们可以在代码中看到，返回的data source是`DataSource.DATA_DISK_CACHE`。

### 3.9 DecodeJob.FetcherReadyCallback

我们先看一下fetch失败时干了什么，然后在看成功的时候。因为失败的代码比较简单。

`onDataFetcherFailed`代码如下：

```java
@Override
public void onDataFetcherFailed(Key attemptedKey, Exception e, DataFetcher<?> fetcher,
    DataSource dataSource) {
  fetcher.cleanup();
  GlideException exception = new GlideException("Fetching data failed", e);
  exception.setLoggingDetails(attemptedKey, dataSource, fetcher.getDataClass());
  throwables.add(exception);
  if (Thread.currentThread() != currentThread) {
    runReason = RunReason.SWITCH_TO_SOURCE_SERVICE;
    callback.reschedule(this);
  } else {
    runGenerators();
  }
}
```

显然，如果fetch失败了，如果不在source线程池中就会切换到source线程，然后重新调用`runGenerators()`方法尝试使用下一个`DataFetcherGenerator`进行加载，一直到没有一个可以加载，这时会调用`notifyFailed()`方法，正式宣告加载失败。

然后在看成功的时候：`onDataFetcherReady`方法会保存传入的参数，然后确认执行线程后调用`decodeFromRetrievedData()`方法进行解码。

```java
@Override
public void onDataFetcherReady(Key sourceKey, Object data, DataFetcher<?> fetcher,
    DataSource dataSource, Key attemptedKey) {
  this.currentSourceKey = sourceKey;
  this.currentData = data;
  this.currentFetcher = fetcher;
  this.currentDataSource = dataSource;
  this.currentAttemptingKey = attemptedKey;
  if (Thread.currentThread() != currentThread) {
    runReason = RunReason.DECODE_DATA;
    callback.reschedule(this);
  } else {
    GlideTrace.beginSection("DecodeJob.decodeFromRetrievedData");
    try {
      decodeFromRetrievedData();
    } finally {
      GlideTrace.endSection();
    }
  }
}
```

`decodeFromRetrievedData()`方法会先调用`decodeFromData`方法进行解码，然后调用`notifyEncodeAndRelease`方法进行缓存，同时也会通知`EngineJob`资源已经准备好了。

```java
private void decodeFromRetrievedData() {
  if (Log.isLoggable(TAG, Log.VERBOSE)) {
    logWithTimeAndKey("Retrieved data", startFetchTime,
        "data: " + currentData
            + ", cache key: " + currentSourceKey
            + ", fetcher: " + currentFetcher);
  }
  Resource<R> resource = null;
  try {
    resource = decodeFromData(currentFetcher, currentData, currentDataSource);
  } catch (GlideException e) {
    e.setLoggingDetails(currentAttemptingKey, currentDataSource);
    throwables.add(e);
  }
  if (resource != null) {
    notifyEncodeAndRelease(resource, currentDataSource);
  } else {
    runGenerators();
  }
}
```

先看看decode相关的代码，`decodeFromData`相关的代码有一些，我们直接列出这些代码。`decodeFromData`方法内部又会调用`decodeFromFetcher`方法干活。在`decodeFromFetcher`方法中首先会获取LoadPath。然后调用`runLoadPath`方法解析成资源。  

```java
private <Data> Resource<R> decodeFromData(DataFetcher<?> fetcher, Data data,
    DataSource dataSource) throws GlideException {
  try {
    if (data == null) {
      return null;
    }
    long startTime = LogTime.getLogTime();
    Resource<R> result = decodeFromFetcher(data, dataSource);
    if (Log.isLoggable(TAG, Log.VERBOSE)) {
      logWithTimeAndKey("Decoded result " + result, startTime);
    }
    return result;
  } finally {
    fetcher.cleanup();
  }
}

@SuppressWarnings("unchecked")
private <Data> Resource<R> decodeFromFetcher(Data data, DataSource dataSource)
    throws GlideException {
  LoadPath<Data, ?, R> path = decodeHelper.getLoadPath((Class<Data>) data.getClass());
  return runLoadPath(data, dataSource, path);
}

private <Data, ResourceType> Resource<R> runLoadPath(Data data, DataSource dataSource,
    LoadPath<Data, ResourceType, R> path) throws GlideException {
  Options options = getOptionsWithHardwareConfig(dataSource);
  DataRewinder<Data> rewinder = glideContext.getRegistry().getRewinder(data);
  try {
    // ResourceType in DecodeCallback below is required for compilation to work with gradle.
    return path.load(
        rewinder, options, width, height, new DecodeCallback<ResourceType>(dataSource));
  } finally {
    rewinder.cleanup();
  }
}
```

注意`runLoadPath`方法使用到了`DataRewinder`，这是一个将数据流里面的指针重新指向开头的类，在调用`ResourceDecoder`对data进行编码时会尝试很多个编码器，所以每一次尝试后都需要重置索引。  
在Glide初始化的时候默认注入了`ByteBufferRewinder`和`InputStreamRewinder`这两个类的工厂。这样就为`ByteBuffer`和`InputStream`的重定向提供了实现。  

值得注意的是，在`path.load(rewinder, options, width, height, new DecodeCallback<ResourceType>(dataSource))`这行代码中，最后传入了一个`DecodeCallback`回调，该类的回调方法会回调给`DecodeJob`对应的方法：

```java
private final class DecodeCallback<Z> implements DecodePath.DecodeCallback<Z> {

  private final DataSource dataSource;

  @Synthetic
  DecodeCallback(DataSource dataSource) {
    this.dataSource = dataSource;
  }

  @NonNull
  @Override
  public Resource<Z> onResourceDecoded(@NonNull Resource<Z> decoded) {
    return DecodeJob.this.onResourceDecoded(dataSource, decoded);
  }
}
```

然后我们看一下`LoadPath.load`方法的实现：

```java
public Resource<Transcode> load(DataRewinder<Data> rewinder, @NonNull Options options, int width,
    int height, DecodePath.DecodeCallback<ResourceType> decodeCallback) throws GlideException {
  List<Throwable> throwables = Preconditions.checkNotNull(listPool.acquire());
  try {
    return loadWithExceptionList(rewinder, options, width, height, decodeCallback, throwables);
  } finally {
    listPool.release(throwables);
  }
}
```

ummmm，这里调用了`loadWithExceptionList`方法：

```java
private Resource<Transcode> loadWithExceptionList(DataRewinder<Data> rewinder,
    @NonNull Options options,
    int width, int height, DecodePath.DecodeCallback<ResourceType> decodeCallback,
    List<Throwable> exceptions) throws GlideException {
  Resource<Transcode> result = null;
  //noinspection ForLoopReplaceableByForEach to improve perf
  for (int i = 0, size = decodePaths.size(); i < size; i++) {
    DecodePath<Data, ResourceType, Transcode> path = decodePaths.get(i);
    try {
      result = path.decode(rewinder, width, height, options, decodeCallback);
    } catch (GlideException e) {
      exceptions.add(e);
    }
    if (result != null) {
      break;
    }
  }

  if (result == null) {
    throw new GlideException(failureMessage, new ArrayList<>(exceptions));
  }

  return result;
}
```

对于每条DecodePath，都调用其`decode`方法，直到有一个DecodePath可以decode出资源。  
那么我们继续看看`DecodePath.decode`方法：

```java
public Resource<Transcode> decode(DataRewinder<DataType> rewinder, int width, int height,
    @NonNull Options options, DecodeCallback<ResourceType> callback) throws GlideException {
  Resource<ResourceType> decoded = decodeResource(rewinder, width, height, options);
  Resource<ResourceType> transformed = callback.onResourceDecoded(decoded);
  return transcoder.transcode(transformed, options);
}
```

显而易见，这里有3步：

1. 使用ResourceDecoder List进行decode
2. 将decoded的资源进行transform
3. 将transformed的资源进行transcode

在我们的示例中，第二条DecodePath(`DecodePath{ dataClass=class java.nio.DirectByteBuffer, decoders=[ByteBufferBitmapDecoder@1ca5fe14], transcoder=BitmapDrawableTranscoder@1d8f76bd}`)可以成功处理，并返回的是一个`LazyBitmapDrawableResource`对象。

我们看一下这里面的操作过程，首先是`decodeResource`的过程：

```java
@NonNull
private Resource<ResourceType> decodeResource(DataRewinder<DataType> rewinder, int width,
    int height, @NonNull Options options) throws GlideException {
  List<Throwable> exceptions = Preconditions.checkNotNull(listPool.acquire());
  try {
    return decodeResourceWithList(rewinder, width, height, options, exceptions);
  } finally {
    listPool.release(exceptions);
  }
}

@NonNull
private Resource<ResourceType> decodeResourceWithList(DataRewinder<DataType> rewinder, int width,
    int height, @NonNull Options options, List<Throwable> exceptions) throws GlideException {
  Resource<ResourceType> result = null;
  //noinspection ForLoopReplaceableByForEach to improve perf
  for (int i = 0, size = decoders.size(); i < size; i++) {
    // decoders只有一条，就是ByteBufferBitmapDecoder
    ResourceDecoder<DataType, ResourceType> decoder = decoders.get(i);
    try {
      // rewinder自然是ByteBufferRewind
      // data为ByteBuffer
      DataType data = rewinder.rewindAndGet();
      // ByteBufferBitmapDecoder内部会调用Downsampler的hanldes方法
      // 它对任意的InputStream和ByteBuffer都返回true
      if (decoder.handles(data, options)) {
        // 调用ByteBuffer.position(0)复位
        data = rewinder.rewindAndGet();
        // 开始解码
        result = decoder.decode(data, width, height, options);
      }
      // Some decoders throw unexpectedly. If they do, we shouldn't fail the entire load path, but
      // instead log and continue. See #2406 for an example.
    } catch (IOException | RuntimeException | OutOfMemoryError e) {
      if (Log.isLoggable(TAG, Log.VERBOSE)) {
        Log.v(TAG, "Failed to decode data for " + decoder, e);
      }
      exceptions.add(e);
    }

    if (result != null) {
      break;
    }
  }

  if (result == null) {
    throw new GlideException(failureMessage, new ArrayList<>(exceptions));
  }
  return result;
}
```

`ByteBufferBitmapDecoder.decode`方法会先将`ByteBuffer`转换成`InputStream`，然后在调用`Downsampler.decode`方法进行解码。

```java
@Override
public Resource<Bitmap> decode(@NonNull ByteBuffer source, int width, int height,
    @NonNull Options options)
    throws IOException {
  InputStream is = ByteBufferUtil.toStream(source);
  return downsampler.decode(is, width, height, options);
}
```

这里面使用的技巧也主要是使用的[Bitmap的加载](/android/framework/Bitmap%E7%9A%84%E7%BC%93%E5%AD%98%E4%B8%8E%E5%8A%A0%E8%BD%BD/#1-bitmap)中提到的技巧。  
不过在Glide中，除了设置了`BitmapFactory.Options`的`inJustDecodeBounds`和`inSampleSize`属性外，还会设置`inTargetDensity`、`inDensity`、`inScale`、`inPreferredConfig`、`inBitmap`属性。

> 在计算各种值的时候，用到了Math里面ceil、floor、round函数。  
> `ceil(x)`表示不小于x的最小整数  
> `floor(x)`表示不大于x的最大整数  
> `round(x)`表示表示四舍五入，理解为floor(x + 0.5)  
>
> <figcaption>ceil、floor、round示例</figcaption>  
>
> | x | ceil | floor | round |
> | :--: | :--: | :--: | :--: |
> | 1.4 | 2.0 | 1.0 | 1 |
> | 1.5 | 2.0 | 1.0 | 2 |
> | 1.6 | 2.0 | 1.0 | 2 |
> | -1.4 | -1.0 | -2.0 | -1 |
> | -1.5 | -1.0 | -2.0 | -1 |
> | -1.6 | -1.0 | -2.0 | -2 |
>
> <figure style="width: 66%" class="align-center">
>   <img src="/assets/images/android/math-floor-ceil.png">
>   <figcaption>floot、ceil取值走向示意图</figcaption>
> </figure>


这里执行完毕，会将decode出来的`Bitmap`包装成为一个`BitmapResource`对象。然后就一直往上返回，返回到`DecodePath.decode`方法中。接下来执行：

```java
Resource<ResourceType> transformed = callback.onResourceDecoded(decoded);
```

这里的`callback`我们在前面提到过，这会调用`DecodeJob.onResourceDecoded(DataSource, Resource<Z>)`方法。

```java
@Synthetic
@NonNull
<Z> Resource<Z> onResourceDecoded(DataSource dataSource,
    @NonNull Resource<Z> decoded) {
  @SuppressWarnings("unchecked")
  Class<Z> resourceSubClass = (Class<Z>) decoded.get().getClass();// Bitmap.class
  Transformation<Z> appliedTransformation = null;
  Resource<Z> transformed = decoded;
  // dataSource为DATA_DISK_CACHE，所以满足条件
  if (dataSource != DataSource.RESOURCE_DISK_CACHE) {
    // 在2.2节中给出了一个「optionalFitCenter()过程保存的KV表」，查阅得知Bitmap.class对应的正是FitCenter()
    appliedTransformation = decodeHelper.getTransformation(resourceSubClass);
    // 对decoded资源进行transform
    transformed = appliedTransformation.transform(glideContext, decoded, width, height);
  }
  // TODO: Make this the responsibility of the Transformation.
  if (!decoded.equals(transformed)) {
    decoded.recycle();
  }

  final EncodeStrategy encodeStrategy;
  final ResourceEncoder<Z> encoder;
  // Bitmap有注册对应的BitmapEncoder，所以是available的
  if (decodeHelper.isResourceEncoderAvailable(transformed)) {
    // encoder就是BitmapEncoder
    encoder = decodeHelper.getResultEncoder(transformed);
    // encodeStrategy为EncodeStrategy.TRANSFORMED
    encodeStrategy = encoder.getEncodeStrategy(options);
  } else {
    encoder = null;
    encodeStrategy = EncodeStrategy.NONE;
  }

  Resource<Z> result = transformed;
  // isSourceKey显然为true，所以isFromAlternateCacheKey为false，所以就返回了
  boolean isFromAlternateCacheKey = !decodeHelper.isSourceKey(currentSourceKey);
  // diskCacheStrategy为AUTOMATIC，该方法返回false
  if (diskCacheStrategy.isResourceCacheable(isFromAlternateCacheKey, dataSource,
      encodeStrategy)) {
    if (encoder == null) {
      throw new Registry.NoResultEncoderAvailableException(transformed.get().getClass());
    }
    final Key key;
    switch (encodeStrategy) {
      case SOURCE:
        key = new DataCacheKey(currentSourceKey, signature);
        break;
      case TRANSFORMED:
        key =
            new ResourceCacheKey(
                decodeHelper.getArrayPool(),
                currentSourceKey,
                signature,
                width,
                height,
                appliedTransformation,
                resourceSubClass,
                options);
        break;
      default:
        throw new IllegalArgumentException("Unknown strategy: " + encodeStrategy);
    }

    LockedResource<Z> lockedResult = LockedResource.obtain(transformed);
    deferredEncodeManager.init(key, encoder, lockedResult);
    result = lockedResult;
  }
  return result;
}
```

然后就回到`DecodePath.decode`方法的第三行了：

```java
return transcoder.transcode(transformed, options);
```

这里的transcoder就是`BitmapDrawableTranscoder`，该方法返回了一个`LazyBitmapDrawableResource`。

至此，resource已经decode完毕。下面一直返回到`DecodeJob.decodeFromRetrievedData()`方法中。下面会调用`notifyEncodeAndRelease`方法完成后面的事宜。

```java
private void notifyEncodeAndRelease(Resource<R> resource, DataSource dataSource) {
  // resource是BitmapResource类型，实现了Initializable接口
  if (resource instanceof Initializable) {
    // initialize方法调用了bitmap.prepareToDraw()
    ((Initializable) resource).initialize();
  }

  Resource<R> result = resource;
  LockedResource<R> lockedResource = null;
  // 由于在DecodeJob.onResourceDecoded方法中diskCacheStrategy.isResourceCacheable返回false
  // 所以没有调用deferredEncodeManager.init方法，因此此处为false
  if (deferredEncodeManager.hasResourceToEncode()) {
    lockedResource = LockedResource.obtain(resource);
    result = lockedResource;
  }

  // 通知回调，资源已经就绪
  notifyComplete(result, dataSource);

  stage = Stage.ENCODE;
  try {
    // 此处为false, skip
    if (deferredEncodeManager.hasResourceToEncode()) {
      deferredEncodeManager.encode(diskCacheProvider, options);
    }
  } finally {
    // lockedResource为null, skip
    if (lockedResource != null) {
      lockedResource.unlock();
    }
  }
  // Call onEncodeComplete outside the finally block so that it's not called if the encode process
  // throws.
  // 进行清理工作
  onEncodeComplete();
}
```

上面这段代码重点在于`notifyComplete`方法，该方法内部会调用`callback.onResourceReady(resource, dataSource)`将结果传递给回调，这里的回调是`EngineJob`：

```java
// EngineJob.java
@Override
public void onResourceReady(Resource<R> resource, DataSource dataSource) {
  synchronized (this) {
    this.resource = resource;
    this.dataSource = dataSource;
  }
  notifyCallbacksOfResult();
}

void notifyCallbacksOfResult() {
  ResourceCallbacksAndExecutors copy;
  Key localKey;
  EngineResource<?> localResource;
  synchronized (this) {
    stateVerifier.throwIfRecycled();
    if (isCancelled) {
      // TODO: Seems like we might as well put this in the memory cache instead of just recycling
      // it since we've gotten this far...
      resource.recycle();
      release();
      return;
    } else if (cbs.isEmpty()) {
      throw new IllegalStateException("Received a resource without any callbacks to notify");
    } else if (hasResource) {
      throw new IllegalStateException("Already have resource");
    }
    // engineResourceFactory默认为EngineResourceFactory
    // 其build方法就是new一个对应的资源
    // new EngineResource<>(resource, isMemoryCacheable, /*isRecyclable=*/ true)
    engineResource = engineResourceFactory.build(resource, isCacheable);
    // Hold on to resource for duration of our callbacks below so we don't recycle it in the
    // middle of notifying if it synchronously released by one of the callbacks. Acquire it under
    // a lock here so that any newly added callback that executes before the next locked section
    // below can't recycle the resource before we call the callbacks.
    hasResource = true;
    copy = cbs.copy();
    incrementPendingCallbacks(copy.size() + 1);

    localKey = key;
    localResource = engineResource;
  }

  // listener就是Engine，该方法会讲资源保存到activeResources中
  listener.onEngineJobComplete(this, localKey, localResource);

  // 这里的ResourceCallbackAndExecutor就是我们在3.3节中创建EngineJob和DecodeJob
  // 并在执行DecodeJob之前添加的回调
  // entry.executor就是Glide.with.load.into中出现的Executors.mainThreadExecutor()
  // entry.cb就是SingleRequest
  for (final ResourceCallbackAndExecutor entry : copy) {
    entry.executor.execute(new CallResourceReady(entry.cb));
  }
  decrementPendingCallbacks();
}
```

`listener.onEngineJobComplete`的代码很简单。首先会设置资源的回调为自己，这样在资源释放时会通知自己的回调方法，将资源从active状态变为cache状态，如`onResourceReleased`方法；然后将资源放入activeResources中，资源变为active状态；最后将engineJob从Jobs中移除：

```java
@Override
public synchronized void onEngineJobComplete(
    EngineJob<?> engineJob, Key key, EngineResource<?> resource) {
  // A null resource indicates that the load failed, usually due to an exception.
  if (resource != null) {
    resource.setResourceListener(key, this);

    if (resource.isCacheable()) {
      activeResources.activate(key, resource);
    }
  }

  jobs.removeIfCurrent(key, engineJob);
}

@Override
public synchronized void onResourceReleased(Key cacheKey, EngineResource<?> resource) {
  activeResources.deactivate(cacheKey);
  if (resource.isCacheable()) {
    cache.put(cacheKey, resource);
  } else {
    resourceRecycler.recycle(resource);
  }
}
```

然后看下`entry.executor.execute(new CallResourceReady(entry.cb));`的实现，`Executors.mainThreadExecutor()`的实现之前说过，就是一个使用MainLooper的Handler，在execute Runnable时使用此Handler post出去。所以我们的关注点就在`CallResourceReady`上面了：

```java
private class CallResourceReady implements Runnable {

    private final ResourceCallback cb;

    CallResourceReady(ResourceCallback cb) {
      this.cb = cb;
    }

    @Override
    public void run() {
      synchronized (EngineJob.this) {
        if (cbs.contains(cb)) {
          // Acquire for this particular callback.
          engineResource.acquire();
          callCallbackOnResourceReady(cb);
          removeCallback(cb);
        }
        decrementPendingCallbacks();
      }
    }
  }
```

ummmm，抛开同步操作不谈，首先调用`callCallbackOnResourceReady(cb)`调用callback，然后调用`removeCallback(cb)`移除callback。看看`callCallbackOnResourceReady(cb)`：

```java
@Synthetic
  synchronized void callCallbackOnResourceReady(ResourceCallback cb) {
    try {
      // This is overly broad, some Glide code is actually called here, but it's much
      // simpler to encapsulate here than to do so at the actual call point in the
      // Request implementation.
      cb.onResourceReady(engineResource, dataSource);
    } catch (Throwable t) {
      throw new CallbackException(t);
    }
  }
```

这里就调用了`cb.onResourceReady`，这里说到过entry.cb就是SingleRequest。所以继续看看`SingleRequest.onResourceReady`方法，很显然`onResourceReady(Resource<?>, DataSource)`都在做sanity check，最后调用了`onResourceReady(Resource<?>, R, DataSource)`：

```java
@Override
public synchronized void onResourceReady(Resource<?> resource, DataSource dataSource) {
  stateVerifier.throwIfRecycled();
  loadStatus = null;
  if (resource == null) {
    GlideException exception = new GlideException("Expected to receive a Resource<R> with an "
        + "object of " + transcodeClass + " inside, but instead got null.");
    onLoadFailed(exception);
    return;
  }

  Object received = resource.get();
  if (received == null || !transcodeClass.isAssignableFrom(received.getClass())) {
    releaseResource(resource);
    GlideException exception = new GlideException("Expected to receive an object of "
        + transcodeClass + " but instead" + " got "
        + (received != null ? received.getClass() : "") + "{" + received + "} inside" + " "
        + "Resource{" + resource + "}."
        + (received != null ? "" : " " + "To indicate failure return a null Resource "
        + "object, rather than a Resource object containing null data."));
    onLoadFailed(exception);
    return;
  }

  if (!canSetResource()) {
    releaseResource(resource);
    // We can't put the status to complete before asking canSetResource().
    status = Status.COMPLETE;
    return;
  }

  onResourceReady((Resource<R>) resource, (R) received, dataSource);
}
```

`onResourceReady(Resource<?>, R, DataSource)`方法如下，其处理过程和`onLoadFailed`方法非常类似：

```java
private synchronized void onResourceReady(Resource<R> resource, R result, DataSource dataSource) {
  // We must call isFirstReadyResource before setting status.
  // 由于requestCoordinator为null，所以返回true
  boolean isFirstResource = isFirstReadyResource();
  // 将status状态设置为COMPLETE
  status = Status.COMPLETE;
  this.resource = resource;

  if (glideContext.getLogLevel() <= Log.DEBUG) {
    Log.d(GLIDE_TAG, "Finished loading " + result.getClass().getSimpleName() + " from "
        + dataSource + " for " + model + " with size [" + width + "x" + height + "] in "
        + LogTime.getElapsedMillis(startTime) + " ms");
  }

  isCallingCallbacks = true;
  try {
     // 尝试调用各个listener的onResourceReady回调进行处理
    boolean anyListenerHandledUpdatingTarget = false;
    if (requestListeners != null) {
      for (RequestListener<R> listener : requestListeners) {
        anyListenerHandledUpdatingTarget |=
            listener.onResourceReady(result, model, target, dataSource, isFirstResource);
      }
    }
    anyListenerHandledUpdatingTarget |=
        targetListener != null
            && targetListener.onResourceReady(result, model, target, dataSource, isFirstResource);

    // 如果没有一个回调能够处理，那么自己处理
    if (!anyListenerHandledUpdatingTarget) {
      // animationFactory默认为NoTransition.getFactory()，生成的animation为NO_ANIMATION
      Transition<? super R> animation =
          animationFactory.build(dataSource, isFirstResource);
      // target为DrawableImageViewTarget
      target.onResourceReady(result, animation);
    }
  } finally {
    isCallingCallbacks = false;
  }

  // 通知requestCoordinator
  notifyLoadSuccess();
}
```

`DrawableImageViewTarget`的基类`ImageViewTarget`实现了此方法：

```java
// ImageViewTarget.java
@Override
public void onResourceReady(@NonNull Z resource, @Nullable Transition<? super Z> transition) {
  // NO_ANIMATION.transition返回false，所以直接调用setResourceInternal方法
  if (transition == null || !transition.transition(resource, this)) {
    setResourceInternal(resource);
  } else {
    maybeUpdateAnimatable(resource);
  }
}

private void setResourceInternal(@Nullable Z resource) {
  // Order matters here. Set the resource first to make sure that the Drawable has a valid and
  // non-null Callback before starting it.
  // 先设置图片
  setResource(resource);
  // 然后如果是动画，会执行动画
  maybeUpdateAnimatable(resource);
}

private void maybeUpdateAnimatable(@Nullable Z resource) {
  // BitmapDrawable显然不是一个Animatable对象，所以走else分支
  if (resource instanceof Animatable) {
    animatable = (Animatable) resource;
    animatable.start();
  } else {
    animatable = null;
  }
}

// DrawableImageViewTarget
@Override
protected void setResource(@Nullable Drawable resource) {
  view.setImageDrawable(resource);
}
```

OK，至此网络图片已经通过`view.setImageDrawable(resource)`加载完毕。完结撒花🎉🎉🎉🎉🎉🎉🎉  

But，整个流程看的脑阔疼。这篇文章从4月25号到今天5月5号经历了10天，抛开中间51的4天假，差不多也有一周之久，时断时续，一遍捋下来我自己也是半懵的，所以应该得有个总结吧。不然每次温习一遍，一遍就得温习几天。  
所以，接下来的几篇文章，每篇都会选取一个方面进行总结。此外，本文的流程图如下：

<figure style="width: 95%" class="align-center">
    <img src="/assets/images/android/glide-overview.png">
    <figcaption>Glide整体流程图</figcaption>
</figure>