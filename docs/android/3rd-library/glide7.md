---
title: "Glide v4 源码解析（七）"
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

本章要实现的功能是监听Glide加载网络图片的进度。大致思路是这样：

1. 使用`OkHttp`集成库，替代`HttpUrlConnection`，这样方便我们实现下载进度的监听
2. 自定义`ResponseBody`，用来监听下载进度
3. 自定义`Interceptor`用来注入自定义`ResponseBody`
4. 实现加载进度更新的UI

## 1. 快速实现

首先肯定保证`build.gradle`里集成了这些库：

```gradle
apply plugin: 'kotlin-kapt'

dependencies {
  implementation 'com.squareup.okhttp3:okhttp:3.10.0'
  implementation 'com.github.bumptech.glide:glide:4.9.0'
  implementation "com.github.bumptech.glide:okhttp3-integration:4.9.0"
  kapt 'com.github.bumptech.glide:compiler:4.9.0'
}
```

然后为了让自定义的`Interceptor`可以加入到`OkHttpClient`中，我们需要`@Excludes`默认的`OkHttpLibraryGlideModule`，自己修改对应的`registerComponents`方法：

**MyAppGlideModule.kt**

```kotlin
@GlideModule
@Excludes(value = [OkHttpLibraryGlideModule::class])
class MyAppGlideModule : AppGlideModule() {
    override fun registerComponents(context: Context, glide: Glide, registry: Registry) {
        val okHttpClient = OkHttpClient.Builder()
            .addInterceptor(ProgressInterceptor())
            .build()

        registry.replace(GlideUrl::class.java, InputStream::class.java, OkHttpUrlLoader.Factory(okHttpClient))
    }
}
```

然后，自定义一个`ResponseBody`，用来计算下载进度并回调出去：

**ProgressResponseBody.kt**

```kotlin
class ProgressResponseBody(
    private val originResponseBody: ResponseBody,
    url: String
) : ResponseBody() {

    private var mListener = ProgressInterceptor.getListener(url)

    private val bufferedSource =
        Okio.buffer(object : ForwardingSource(originResponseBody.source()) {
            private var totalBytesRead = 0L
            private var currentProgress = 0

            override fun read(sink: Buffer, byteCount: Long): Long {
                return super.read(sink, byteCount).apply {
                    if (this == -1L) {
                        totalBytesRead = contentLength()
                    } else {
                        totalBytesRead += this
                    }
                    val progress = (100F * totalBytesRead / contentLength()).toInt()
                    Log.e("ProgressResponseBody", "download progress: $progress")
                    if (progress != currentProgress) {
                        currentProgress = progress
                        mListener?.onProgress(currentProgress)
                    }
                    if (totalBytesRead == contentLength()) {
                        mListener = null
                    }
                }
            }
        })

    override fun contentLength() = originResponseBody.contentLength()

    override fun contentType() = originResponseBody.contentType()

    override fun source(): BufferedSource = bufferedSource
}
```

上面的`bufferedSource`实现可以参考OkHttp3源码里面的`Cache.CacheResponseBody`的实现，唯一不同的是这里在原来`read`方法上加了一点代码用于计算下载进度。  
此外，在21行加了一行注释，用于测试。

最后，自定义一个`Interceptor`，用于注入我们定义好的`ProgressResponseBody`：

**ProgressInterceptor.kt**

```kotlin
class ProgressInterceptor : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val response = chain.proceed(request)
        val url = request.url().toString()
        val responseBody = response.body() ?: return response
        return response.newBuilder().body(ProgressResponseBody(responseBody, url)).build()
    }

    companion object {
        private val LISTENERS = hashMapOf<String, OnProgressChangeListener>()

        fun addListener(url: String, onProgressChangeListener: OnProgressChangeListener) {
            LISTENERS[url] = onProgressChangeListener
        }

        fun removeListener(url: String) {
            LISTENERS.remove(url)
        }

        fun getListener(url: String) = LISTENERS[url]
    }
}
```

`OnProgressChangeListener`的定义非常简单：

```kotlin
interface OnProgressChangeListener {
    fun onProgress(progress: Int)
}
```

上面这些代码就快速完成了本章的功能，我们使用下面的代码测试一下：

```kotlin
private fun load() {
    val progressDialog = ProgressDialog(context)
    progressDialog.setProgressStyle(ProgressDialog.STYLE_HORIZONTAL);
    progressDialog.setMessage("加载中")

    ProgressInterceptor.addListener(URL, object : OnProgressChangeListener {
        override fun onProgress(progress: Int) {
            progressDialog.progress = progress
        }
    })

    GlideApp.with(this)
        .load(URL)
        .diskCacheStrategy(DiskCacheStrategy.NONE)
        .placeholder(R.color.colorLoading)
        .error(R.color.colorError)
        .into(object : DrawableImageViewTarget(ivGlide1) {
            override fun onLoadStarted(placeholder: Drawable?) {
                super.onLoadStarted(placeholder)
                progressDialog.show()
            }

            override fun onLoadFailed(errorDrawable: Drawable?) {
                super.onLoadFailed(errorDrawable)
                progressDialog.dismiss()
                ProgressInterceptor.removeListener(URL)
            }

            override fun onResourceReady(
                resource: Drawable,
                transition: Transition<in Drawable>?
            ) {
                super.onResourceReady(resource, transition)
                progressDialog.dismiss()
                ProgressInterceptor.removeListener(URL)
            }
        })
}
```

运行之后我们可以在手机和控制台上看到效果。

但是，先不说UI效果，光是回调的添加、删除方式都有点low，我们得优化一下。

## 2. 优化版本

可优化项：

1. 整体考虑使用`@GlideOptions`添加API，调用起来只需要额外加一个方法即可
2. 加载的UI效果优化，需要自定义`ImageViewTarget`

解决思路：

1. 使用`@GlideOptions`添加一个控制是否显示加载进度条的API
2. 我们可以考虑自定义显示进度的Drawable，作为图片的placeholder，然后在自定义`ImageViewTarget`的里面更新进度

基于上面的思路，写出了一个用起来比较方便的方法。我们先看示例图：

<figure style="width: 30%" class="align-center">
    <img src="/assets/images/android/glide-loading-progress.gif">
    <figcaption>Glide自定义加载进度条</figcaption>
</figure>

下面是示例的加载代码：

```kotlin
private fun load() {
    GlideApp.with(this)
        .load(GIF_URL)
        .placeholder(R.color.colorLoading)
        .progress(context)
        .into(ProgressImageViewTarget(GIF_URL, ivGlide1))

    GlideApp.with(this)
        .load(URL2)
        .placeholder(R.color.colorLoading)
        .into(ProgressImageViewTarget(URL2, ivGlide2))

    GlideApp.with(this)
        .load(URL)
        .placeholder(R.color.colorLoading)
        .progress(context)
        .into(ProgressImageViewTarget(URL, ivGlide3))
}

companion object {
    private const val URL = "http://cn.bing.com/az/hprichbg/rb/Dongdaemun_ZH-CN10736487148_1920x1080.jpg"
    private const val URL2 = "https://www.baidu.com/img/bd_logo1.png"
    private const val GIF_URL = "http://p1.pstatp.com/large/166200019850062839d3"
}
```

可以看到，这里使用了Generated API，添加了一个`progress(Context)`方法控制是否需要显示加载进度条（例2没有开启这个选项）。然后自定义了一个`ProgressImageViewTarget`，用来接受加载进度并更新到UI上。使用起来就这么简单，只需要修改两处位置即可。

另外还有一点设计上的小细节，在下面贴对应代码的时候会提到。

由于本节的优化版本是基于上一节的代码的，所以没有改变的代码就不在贴出来了。这些代码包括：

- `MyAppGlideModule.kt`
- `OnProgressChangeListener.kt`
- `ProgressInterceptor.kt`
- `ProgressResponseBody.kt`

下面先说说自定义的placeholder drawable——`ProgressPlaceholderDrawable`。**该类会首先展示Glide设置好的placeholder，然后再在上面绘制进度条**。代码比较简单，一看就懂了：

**ProgressPlaceholderDrawable.kt**

```kotlin
class ProgressPlaceholderDrawable(
    private var context: Context,
    private var placeHolderDrawable: Drawable? = null,
    placeHolderId: Int = 0
) : Drawable() {

    private var mProgress: Int = 0
    private var mPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val mStartAngle = 270F
    private val mPaintStrokeWidth = getDensity() * 1.5F
    private val mProgressPadding = getDensity() * 3F

    init {
        // get original drawable
        if (placeHolderDrawable == null && placeHolderId != 0) {
            placeHolderDrawable = ContextCompat.getDrawable(context, placeHolderId)
        }

        mPaint.color = Color.GRAY
        mPaint.strokeWidth = mPaintStrokeWidth
    }

    override fun setBounds(bounds: Rect) {
        super.setBounds(bounds)
        placeHolderDrawable?.bounds = bounds
    }

    override fun setBounds(left: Int, top: Int, right: Int, bottom: Int) {
        super.setBounds(left, top, right, bottom)
        placeHolderDrawable?.setBounds(left, top, right, bottom)
    }

    override fun setTint(tintColor: Int) {
        super.setTint(tintColor)
        mPaint.color = tintColor
    }

    fun setProgress(@IntRange(from = 0, to = 100) progress: Int) {
        mProgress = progress
        invalidateSelf()
    }

    override fun draw(canvas: Canvas) {
        // draw original placeholder
        placeHolderDrawable?.draw(canvas)

        // calc center point
        val centerX = (bounds.width() ushr 1).toFloat()
        val centerY = (bounds.height() ushr 1).toFloat()
        var radius = (min(bounds.width(), bounds.height()) ushr 1).toFloat()
        // calc radius
        val dp30 = getDensity() * 30
        if (radius > dp30 * 1.25F) {
            radius = dp30
        } else {
            radius *= 0.8F
        }

        // draw outline circle
        mPaint.style = Paint.Style.STROKE
        canvas.drawCircle(centerX, centerY, radius, mPaint)

        // draw progress
        mPaint.style = Paint.Style.FILL
        val endAngle = (mProgress / 100F) * 360F
        val rect = RectF(
            centerX - radius + mProgressPadding,
            centerY - radius + mProgressPadding,
            centerX + radius - mProgressPadding,
            centerY + radius - mProgressPadding
        )
        canvas.drawArc(rect, mStartAngle, endAngle, true, mPaint)
    }

    override fun setAlpha(alpha: Int) {
        mPaint.alpha = alpha
        invalidateSelf()
    }

    override fun getOpacity() = PixelFormat.TRANSLUCENT

    override fun setColorFilter(colorFilter: ColorFilter?) {
        mPaint.colorFilter = colorFilter
        invalidateSelf()
    }

    private fun getDensity() = context.resources.displayMetrics.density
}
```

为了方便的wrap原来的placeholder，下面会使用`@GlideOption`注解生成新API。这里会将原来的placeholder传入新的placeholder中。同时，还设置了Paint的color为`Color.GRAY`。

**ProgressExtension.kt**

```kotlin
@GlideExtension
object ProgressExtension {

    @GlideOption
    @JvmStatic
    fun progress(options: BaseRequestOptions<*>, context: Context): BaseRequestOptions<*> {
        val progressPlaceholderDrawable =
            ProgressPlaceholderDrawable(
                context,
                options.getPlaceholderDrawable(),
                options.getPlaceholderId()
            )
        progressPlaceholderDrawable.setTint(Color.GRAY)
        return options.placeholder(progressPlaceholderDrawable)
    }
}
```

最后就是我们自定义的`ImageViewTarget`了，选择继承该类的原因很简单：需要我们自己处理的东西很少。

**ProgressImageViewTarget.kt**

```kotlin
class ProgressImageViewTarget<T>(
    private val url: String,
    imageView: ImageView
) : ImageViewTarget<T>(imageView) {

    override fun onLoadStarted(placeholder: Drawable?) {
        super.onLoadStarted(placeholder)
        if (placeholder is ProgressPlaceholderDrawable) {
            ProgressInterceptor.addListener(url, object : OnProgressChangeListener {
                override fun onProgress(progress: Int) {
                    placeholder.setProgress(progress)
                }
            })
        }
    }

    override fun onLoadFailed(errorDrawable: Drawable?) {
        super.onLoadFailed(errorDrawable)
        ProgressInterceptor.removeListener(url)
    }

    override fun onResourceReady(resource: T, transition: Transition<in T>?) {
        super.onResourceReady(resource, transition)
        ProgressInterceptor.removeListener(url)
    }

    override fun onLoadCleared(placeholder: Drawable?) {
        super.onLoadCleared(placeholder)
        ProgressInterceptor.removeListener(url)
    }

    override fun setResource(resource: T?) {
        if (resource is Bitmap) {
            view.setImageBitmap(resource)
        } else if (resource is Drawable) {
            view.setImageDrawable(resource)
        }
    }
}
```

在加载开始时，我们判断placeholder是不是我们定义的`ProgressPlaceholderDrawable`，如果时就添加监听，准备将下载进度呈现出来。最后在资源加载完毕后，展示资源时会判断资源是`Bitmap`类型还是`Drawable`类型，从而调用对应的API设置图片，这就是`BitmapImageViewTarget`和`DrawableImageViewTarget`实现的结合了。

以上总共7个文件就是本章的结晶，充分运用了Glide所学。但是，上面这种方法还是有两点地方需要改进：

1. 自定义了`Target`，导致有一些Glide默认配置没有自动配置，此时根据需求，需要我们手动设置一下
2. 对于同一个URL，多个Target同时加载，会导致前面的Target上的回调被后面的取代——因为目前简单使用了HashMap来保存回调；同时，多个Target加载同时记载一个URL，会使回调调用多次，所以看进度条会飘。

以上就是Glide系列的全部内容了。从第一篇文章发布（2019.04.19）到现在（2019.06.20），经历了两个月，终于摸的差不多了。除了第二章将Glide三步加载流程比较冗长之外，其他几章都选取Glide的某一个方面的特性进行解读，比较简短，但还是结合对应源码、对应的文档，给出了出处。耗时多，收获也多。