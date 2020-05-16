---
title: "Glide v4 源码解析（一）"
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

本章的主要内容为Glide v4的基本使用。

## 1. 准备

> From: [下载和设置](https://muyangmin.github.io/glide-docs-cn/doc/download-setup.html)  
>
> **Min Sdk Version** - 使用Glide需要minimum SDK版本API **14** (Ice Cream Sandwich) 或更高。  
> **Compile Sdk Version** - Glide必须使用API **27** (Oreo MR1) 或更高版本的SDK来编译。  
> **Support Library Version** - Glide使用的支持库版本为**27**。  
>
> 如果你需要使用不同的支持库版本，你需要在你的`build.gradle`文件里从 Glide 的依赖中去除`com.android.support`。例如，假如你想使用 v26 的支持库：  
> dependencies {  
> &nbsp;&nbsp;&nbsp;&nbsp;implementation ("com.github.bumptech.glide:glide:4.8.0") {  
> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;exclude group: "com.android.support"  
> &nbsp;&nbsp;&nbsp;&nbsp;}  
> &nbsp;&nbsp;&nbsp;&nbsp;implementation   "com.android.support:support-fragment:26.1.0"  
>  }
>
> 使用与 Glide 依赖的支持库不同的版本可能会导致一些运行时异常，请参阅 [#2730](https://github.com/bumptech/glide/issues/2730) 获取这方面的更多信息。

现在正式准备添加Glide的依赖：

```gradle
...
apply plugin: 'kotlin-kapt'

dependencies {
    ...
    implementation 'com.github.bumptech.glide:glide:4.9.0'
    kapt 'com.github.bumptech.glide:compiler:4.9.0'
}
```

因为Glide中需要用到网络功能，因此还得在`AndroidManifest.xml`中声明一下网络权限：

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

最后我们准备一个演示使用的Activity，里面放一个`ImageView`以及一个`Button`用来触发`Glide`的加载。这种简单的页面没有什么好说的，直接上示例代码：

```xml
<?xml version="1.0" encoding="utf-8"?>
<android.support.constraint.ConstraintLayout
    xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="match_parent">

    <ImageView
        android:id="@+id/ivGlide"
        android:layout_width="0dp"
        android:layout_height="0dp"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintEnd_toEndOf="parent"
        app:layout_constraintTop_toTopOf="parent"
        app:layout_constraintBottom_toBottomOf="parent"/>

    <android.support.design.widget.FloatingActionButton
        android:id="@+id/fab"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_margin="24dp"
        android:src="@drawable/btn_camera"
        app:layout_constraintEnd_toEndOf="parent"
        app:layout_constraintBottom_toBottomOf="parent"/>

</android.support.constraint.ConstraintLayout>
```

```kotlin
class GlideActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_glide)

        fab.setOnClickListener {
            load()
        }
    }

    private fun load() {
        // Glide加载代码
    }

    companion object {
        // 静态图片资源
        private const val URL = "http://cn.bing.com/az/hprichbg/rb/Dongdaemun_ZH-CN10736487148_1920x1080.jpg"
        // Gif资源
        private const val GIF_URL = "http://p1.pstatp.com/large/166200019850062839d3"
    }
}
```

## 2. 简单使用

多数情况下，使用Glide加载图片非常简单，一行代码足矣：

```kotlin
Glide.with(this).load(URL).into(ivGlide)
```

实例效果运行如下：

<figure style="width: 25%" class="align-center">
    <img src="/assets/images/android/glide-3-step-example.gif">
    <figcaption>Glide加载结果</figcaption>
</figure>

取消加载同样很简单：

```kotlin
Glide.with(this).clear(ivGlide)
```

尽管及时取消不必要的加载是很好的实践，但这并不是必须的操作。**实际上，当**`Glide.with()`**中传入的**`Activity`**或**`Fragment`**实例销毁时，Glide会自动取消加载并回收资源。**  

在`ListView`或`RecyclerView`中加载图片的代码和在单独的View中加载完全一样。Glide已经自动处理了View的复用和请求的取消。  

对url进行null检验并不是必须的，如果url为null，Glide会清空View的内容，或者显示`placeholder`或`fallback`的内容。  

Glide唯一的要求是，对于任何可复用的View或Target，如果它们在之前的位置上，用Glide进行过加载操作，那么 **在新的位置上要去执行一个新的加载操作，或调用** `clear() `**API停止Glide的工作**。  

对View调用`clear()`或`into(View)`，表明在此之前的加载操作会被取消，并且在方法调用完成后，Glide不会改变view的内容。如果你忘记调用`clear()`，而又没有开启新的加载操作，那么就会出现这种情况：你已经为一个view设置好了一个Drawable，但该View在之前的位置上使用Glide进行过加载图片的操作，Glide加载完毕后可能会将这个View改回成原来的内容。

`Glide.with`方法有很多重载：

- `with(@NonNull Context context)`
- `with(@NonNull View view)`
- `with(@NonNull Activity activity)`
- `with(@NonNull FragmentActivity activity)`
- `with(@NonNull Fragment fragment)`

在上面的重载方法中，除了前两个重载方法外，其他三个都有很直观的生命周期；至于前两个，会尝试绑定到Activity或Fragment上面，如果失败了就会绑定到Application级别的生命周期上。

`Glide.with`就返回了一个`RequestManager`实例，其`load`方法也有很多重载：

- `load(@Nullable Bitmap bitmap)`
- `load(@Nullable Drawable drawable)`
- `load(@Nullable String string)`
- `load(@Nullable Uri uri)`
- `load(@Nullable File file)`
- `load(@RawRes @DrawableRes @Nullable Integer resourceId)`
- `load(@Nullable byte[] model)`
- `load(@Nullable Object model)`

`RequestManager`除了上面的方法外，还有其他一些有用的方法：

控制方法：

- `isPaused()`
- `pauseRequests()`
- `pauseAllRequests()`
- `pauseRequestsRecursive()`
- `resumeRequests()`
- `resumeRequestsRecursive()`
- `clear(@NonNull View view)`
- `clear(@Nullable final Target<?> target)`

生命周期方法：

- `onStart()`
- `onStop()`
- `onDestroy()`

其他方法：

- `downloadOnly()`
- `download(@Nullable Object model)`
- `asBitmap()`
- `asGif()`
- `asDrawable()`
- `asFile()`
- `as(@NonNull Class<ResourceType> resourceClass)`

`RequestManager.load`之后就返回了一个`RequestBuilder`对象，调用该对象的`into(@NonNull ImageView view)`方法就完成了Glide加载的三步。当然此方法还有一些高级的重载方法，我们后面在说。  
此外，上面提到的`RequestManager`的7个其他方法也都会返回一个`RequestBuilder`对象，而此时还没有设置要加载的资源，所以`RequestBuilder`也提供了很多`load`方法来设置要加载资源。

以上就是Glide三步(`with`、`load`、`into`)的简要说明。下面接着说一些拓展内容，但也很基础。

### 2.1 占位符

占位符类型有三种，分别在三种不同场景使用：

- `placeholder`  
  `placeholder`是当请求正在执行时被展示的Drawables。当请求成功完成时，`placehodler`会被请求到的资源替换。如果被请求的资源是从内存中加载出来的，那么`placehodler`可能根本不会被显示。如果请求失败并且没有设置`error`，则`placehodler`将被持续展示。类似地，如果请求的url/model为null，并且`error`和`fallback`都没有设置，那么`placehodler`也会继续显示。
- `error`  
  `error`在请求永久性失败时展示。`error`同样也在请求的url/model为null，且并没有设置`fallback`时展示。
- `fallback`  
  `fallback`在请求的url/model为null时展示。设计`fallback`的主要目的是允许用户指示null是否为可接受的正常情况。例如，一个null的个人资料url可能暗示这个用户没有设置头像，因此应该使用默认头像。然而，null也可能表明这个元数据根本就是不合法的，或者取不到。**默认情况下Glide将null作为错误处理**，所以可以接受null的应用应当显式地设置一个`fallback`。

<figure style="width: 98%" class="align-center">
    <img src="/assets/images/android/glide-placeholders-show-logic.png">
    <figcaption>占位符显示逻辑</figcaption>
</figure>

> model为null时，显示逻辑代码如下，具体会在[Glide v4 源码解析（二）](/android/3rd-library/glide2/#32-requestmanagertrack)中讨论
> ```java
> private synchronized void setErrorPlaceholder() {
>   if (!canNotifyStatusChanged()) {
>     return;
>   }
> 
>   Drawable error = null;
>   if (model == null) {
>     error = getFallbackDrawable();
>   }
>   // Either the model isn't null, or there was no fallback drawable set.
>   if (error == null) {
>     error = getErrorDrawable();
>   }
>   // The model isn't null, no fallback drawable was set or no error drawable was set.
>   if (error == null) {
>     error = getPlaceholderDrawable();
>   }
>   target.onLoadFailed(error);
> }
> ```

我们准备使用这段代码演示一下。  
注意，为了忽略缓存的影响，这里设置了忽略内存缓存`skipMemoryCache(true)`并将磁盘缓存策略设置为不缓存`diskCacheStrategy(DiskCacheStrategy.NONE)`。

```kotlin
val option = RequestOptions()
    .placeholder(ColorDrawable(Color.GRAY))
    .error(ColorDrawable(Color.RED))
    .fallback(ColorDrawable(Color.CYAN))
    .skipMemoryCache(true)
    .diskCacheStrategy(DiskCacheStrategy.NONE)

Glide.with(this)
    .load(URL)
    .apply(option)
    .into(ivGlide)
```

上面的代码也可以这么写：

```kotlin
Glide.with(this)
    .load(URL)
    .placeholder(ColorDrawable(Color.GRAY))
    .error(ColorDrawable(Color.RED))
    .fallback(ColorDrawable(Color.CYAN))
    .skipMemoryCache(true)
    .diskCacheStrategy(DiskCacheStrategy.NONE)
    .into(ivGlide)
```

使用`RequestOptions()`更方便，因为可以多个Glide加载语句共用这些通用设置。

下面展示了正确加载时、加载字符空串时的图：

<figure style="width: 25%" class="align-center">
    <img src="/assets/images/android/glide-placeholder-success-example.gif">
    <figcaption>Glide正确加载</figcaption>
    <img src="/assets/images/android/glide-error-example.gif">
    <figcaption>Glide加载空串</figcaption>
</figure>

!!! tip "From: [Placeholders#FAQ](https://muyangmin.github.io/glide-docs-cn/doc/placeholders.html#faq)"  
    **1. 占位符是异步加载的吗？**  
    No。占位符是在主线程从Android Resources加载的。我们通常希望占位符比较小且容易被系统资源缓存机制缓存起来。  
    **2. 变换是否会被应用到占位符上？**  
    No。Transformation仅被应用于被请求的资源，而不会对任何占位符使用。  
    在应用中包含必须在运行时做变换才能使用的图片资源是很不划算的。相反，在应用中包含一个确切符合尺寸和形状要求的资源版本几乎总是一个更好的办法。假如你正在加载圆形图片，你可能希望在你的应用中包含圆形的占位符。另外你也可以考虑自定义一个View来剪裁(clip)你的占位符，而达到你想要的变换效果。  
    **3. 在多个不同的View上使用相同的Drawable可行么？**  
    通常可以，但不是绝对的。任何无状态(non-stateful)的Drawable（例如 BitmapDrawable）通常都是ok的。但是有状态的Drawable不一样，在同一时间多个View上展示它们通常不是很安全，因为多个View会立刻修改(mutate) Drawable。对于有状态的Drawable，建议传入一个资源ID，或者使用`newDrawable()`来给每个请求传入一个新的拷贝。

### 2.2 指定图片格式

Glide支持加载GIF，Picasso不支持。而且Glide加载GIF不需要额外的代码，其内部会判断图片格式。

我们可以直接使用下面的示例代码加载GIF：

```kotlin
val option = RequestOptions()
    .placeholder(ColorDrawable(Color.GRAY))
    .error(ColorDrawable(Color.RED))
    .fallback(ColorDrawable(Color.CYAN))
    .skipMemoryCache(true)
    .diskCacheStrategy(DiskCacheStrategy.NONE)

Glide.with(this)
    .load(GIF_URL)
    .apply(option)
    .into(ivGlide)
```

运行结果如下图所示：

<figure style="width: 25%" class="align-center">
    <img src="/assets/images/android/glide-load-gif.gif">
    <figcaption>Glide加载GIF</figcaption>
</figure>

现在我们只想加载静态图片，我们可以在`Glide.with`后面追加`asBitmap()`方法实现：

```kotlin
Glide.with(this)
    .asBitmap()
    .load(GIF_URL)
    .apply(option)
    .into(ivGlide)
```

由于调用了`asBitmap()`方法，现在GIF图就无法正常播放了，而是会在界面上显示第一帧的图片。

<figure style="width: 25%" class="align-center">
    <img src="/assets/images/android/glide-load-gif-with-asbitmap.gif">
    <figcaption>Glide asBitmap加载GIF</figcaption>
</figure>

同理，我们在加载普通图片时追加`asGif()`会怎么样呢：

```kotlin
Glide.with(this)
    .asGif()
    .load(URL)
    .apply(option)
    .into(ivGlide)
```

很不幸，显示加载错误图片：

<figure style="width: 25%" class="align-center">
    <img src="/assets/images/android/glide-load-url-with-asgif.gif">
    <figcaption>Glide asGif加载普通图片</figcaption>
</figure>

### 2.3 指定图片大小

实际上，使用Glide在绝大多数情况下我们都是不需要指定图片大小的。

在学习本节内容之前，你可能还需要先了解一个概念，就是我们平时在加载图片的时候很容易会造成内存浪费。什么叫内存浪费呢？比如说一张图片的尺寸是1000\*1000像素，但是我们界面上的ImageView可能只有200\*200像素，这个时候如果你不对图片进行任何压缩就直接读取到内存中，这就属于内存浪费了，因为程序中根本就用不到这么高像素的图片。

而使用Glide，我们就完全不用担心图片内存浪费，甚至是内存溢出的问题。因为Glide从来都不会直接将图片的完整尺寸全部加载到内存中，而是用多少加载多少。Glide会自动判断ImageView的大小，然后只将这么大的图片像素加载到内存当中，帮助我们节省内存开支。

也正是因为Glide是如此的智能，所以刚才在开始的时候我就说了，在绝大多数情况下我们都是不需要指定图片大小的，因为Glide会自动根据ImageView的大小来决定图片的大小。

不过，如果你真的有这样的需求，必须给图片指定一个固定的大小，Glide仍然是支持这个功能的。修改Glide加载部分的代码，如下所示：

```kotlin
Glide.with(this)
    .load(URL)
    .apply(option)
    .override(100)
    .into(ivGlide)
```

仍然非常简单，这里使用`override()`方法指定了一个图片的尺寸，也就是说，Glide现在只会将图片加载成100*100像素的尺寸，而不会管你的ImageView的大小是多少了。

对比图如下所示：

<figure style="width: 50%" class="align-center">
    <img src="/assets/images/android/glide-load-png-override-compare.png">
    <figcaption>override加载前后对比</figcaption>
</figure>

本章目前为止已经将一些常用的基本的内容了解了。下一章将深入源码进行探索，看看Glide为何这么强大。
