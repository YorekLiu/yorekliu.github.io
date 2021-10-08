---
title: "大尺寸图片加载问题"
---

???+ question "给定一个1000 x 20000（宽1000px，高20000px）的大图，如何正常加载显示且不发生OOM？"
    测试例子：[485ad.jpg (670x12287)](http://renyugang.io/wp-content/uploads/2018/06/485ad.jpg)

解决此问题的思路有两种：

1. 使用`BitmapFactory.Options`进行采样加载
2. 使用`BitmapRegionDecoder`按区域加载

## 1. 采样加载

此方法代码参考[Bitmap的加载](/android/framework/Bitmap%E7%9A%84%E7%BC%93%E5%AD%98%E4%B8%8E%E5%8A%A0%E8%BD%BD/#1-bitmap)。

<figure style="width: 66%" class="align-center">
    <img src="">
    <figcaption></figcaption>
</figure>

![不使用inSampleSize时内存情况](/assets/images/android/load_image_no_sample.png)
<center>不使用inSampleSize时内存情况</center>

![inSampleSize=4时内存情况](/assets/images/android/load_image_sample.png)
<center>inSampleSize=4时内存情况</center>

不使用`inSampleSize`时，Bitmap占用Java堆内存为：37.4-5=32.4M  
当`inSampleSize=4`时，占用内存理论上会变为原来的1/(4*4)=1/16，也就是32.4/16=2.025M，从图中差不多一致。

## 2. 按区域加载

此方式的原理比较简单：

```kotlin
val mDecoder = BitmapRegionDecoder.newInstance(...)
val mBitmap = mDecoder.decodeRegion(mRect, mOptions)
canvas.drawBitmap(mBitmap, 0F, 0F, null)
```

只需要在滑动的时候不断更新要显示的区域`mRect`，就能完成基本需求。

`BitmapRegionDecoder.newInstance`有很多重载方法：

- newInstance(byte[] data, int offset, int length, boolean isShareable)
- newInstance(FileDescriptor fd, boolean isShareable)
- newInstance(InputStream is, boolean isShareable)
- newInstance(String pathName, boolean isShareable)

下面是一个简单的例子：

```kotlin
interface OnMoveGestureListener {
    fun onMoveBegin(detector: MoveGestureDetector): Boolean

    fun onMove(detector: MoveGestureDetector): Boolean

    fun onMoveEnd(detector: MoveGestureDetector)

    open class Simple : OnMoveGestureListener {
        override fun onMoveBegin(detector: MoveGestureDetector) = true

        override fun onMove(detector: MoveGestureDetector) = false

        override fun onMoveEnd(detector: MoveGestureDetector) {}
    }
}

abstract class BaseGestureDetector(
    context: Context
) {
    protected var mGestureInPregress = false

    protected var mPreMotionEvent: MotionEvent? = null
    protected var mCurrentMotionEvent: MotionEvent? = null

    public fun onTouchEvent(event: MotionEvent): Boolean {
        if (!mGestureInPregress) {
            handleStartProgressEvent(event)
        } else {
            handleInProgressEvent(event)
        }

        return true
    }

    protected abstract fun handleInProgressEvent(event: MotionEvent)

    protected abstract fun handleStartProgressEvent(event: MotionEvent)

    protected abstract fun updateStateByEvent(event: MotionEvent)

    protected fun resetState() {
        mPreMotionEvent?.let {
            it.recycle()
            mPreMotionEvent = null
        }
        mCurrentMotionEvent?.let {
            it.recycle()
            mCurrentMotionEvent = null
        }

        mGestureInPregress = false
    }
}

class MoveGestureDetector(
    context: Context,
    private var mListener: OnMoveGestureListener? = null
) : BaseGestureDetector(context) {

    private var mPrePointer: PointF? = null
    private var mCurrentPointer: PointF? = null

    private val mExternalPointer = PointF()

    override fun handleInProgressEvent(event: MotionEvent) {
        val action = event.action and MotionEvent.ACTION_MASK
        when (action) {
            MotionEvent.ACTION_CANCEL,
            MotionEvent.ACTION_UP -> {
                mListener?.onMoveEnd(this)
                resetState()
            }

            MotionEvent.ACTION_MOVE -> {
                updateStateByEvent(event)
                val update = mListener?.onMove(this)

                if (update == true) {
                    mPreMotionEvent?.recycle()
                    mPreMotionEvent = MotionEvent.obtain(event)
                }
            }
        }
    }

    override fun handleStartProgressEvent(event: MotionEvent) {
        val action = event.action and MotionEvent.ACTION_MASK
        when (action) {
            MotionEvent.ACTION_DOWN -> {
                resetState()
                mPreMotionEvent = MotionEvent.obtain(event)
                updateStateByEvent(event)
            }

            MotionEvent.ACTION_MOVE -> {
                mGestureInPregress = mListener?.onMoveBegin(this) == true
            }
        }
    }

    override fun updateStateByEvent(event: MotionEvent) {
        mPreMotionEvent?.let {
            mPrePointer = calcFocalPointer(it)
            mCurrentPointer = calcFocalPointer(event)

            val skip = it.pointerCount != event.pointerCount
            if (skip) {
                mExternalPointer.x = 0F
                mExternalPointer.y = 0F
            } else {
                mExternalPointer.x = mCurrentPointer!!.x - mPrePointer!!.x
                mExternalPointer.y = mCurrentPointer!!.y - mPrePointer!!.y
            }
        }
    }

    fun getMoveX() = mExternalPointer.x

    fun getMoveY() = mExternalPointer.y

    private fun calcFocalPointer(event: MotionEvent): PointF {
        val count = event.pointerCount

        var x = 0F
        var y = 0F

        for (i in 0 until count) {
            x += event.getX(i)
            y += event.getY(i)
        }

        x /= count
        y /= count

        return PointF(x, y)
    }
}

class LargeImageView(
    context: Context,
    attributeSet: AttributeSet? = null
) : ImageView(context, attributeSet) {

    private var mDecoder: BitmapRegionDecoder? = null
    private val mOptions by lazy {
        BitmapFactory.Options().apply {
            inPreferredConfig = Bitmap.Config.RGB_565
        }
    }
    private val mRect by lazy { Rect() }

    private var mImageWidth = 0
    private var mImageHeight = 0

    private val mDetector: MoveGestureDetector by lazy {
        MoveGestureDetector(
            context,
            object : OnMoveGestureListener.Simple() {
                override fun onMove(detector: MoveGestureDetector): Boolean {
                    val moveX = detector.getMoveX().toInt()
                    val moveY = detector.getMoveY().toInt()

                    if (mImageWidth > width) {
                        mRect.offset(-moveX, 0)
                        checkWidth()
                        invalidate()
                    }
                    if (mImageHeight > height) {
                        mRect.offset(0, -moveY)
                        checkHeight()
                        invalidate()
                    }

                    return true
                }
            })
    }

    fun setInputStream(`is`: InputStream) {
        try {
            mDecoder = BitmapRegionDecoder.newInstance(`is`, false)

            BitmapFactory.Options().run {
                inJustDecodeBounds = true
                BitmapFactory.decodeStream(`is`, null, this)

                mImageWidth = this.outWidth
                mImageHeight = this.outHeight
            }

            requestLayout()
            invalidate()
        } catch (ex: Exception) {
            ex.printStackTrace()
        } finally {
            `is`.close()
        }
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        mDetector.onTouchEvent(event)
        return true
    }

    override fun onDraw(canvas: Canvas) {
        mDecoder?.decodeRegion(mRect, mOptions)?.run {
                canvas.drawBitmap(this, 0F, 0F, null)
        }
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        super.onMeasure(widthMeasureSpec, heightMeasureSpec)

        val width = measuredWidth
        val height = measuredHeight

        mRect.run {
            this.left = (mImageWidth - width) shr 1
            this.top = (mImageHeight - height) shr 1
            this.right = this.left + width
            this.bottom = this.top + height
        }
    }

    private fun checkWidth() {
        if (mRect.right > mImageWidth) {
            mRect.right = mImageWidth
            mRect.left = mImageWidth - width
        }
        if (mRect.left < 0) {
            mRect.left = 0
            mRect.right = width
        }
    }

    private fun checkHeight() {
        if (mRect.bottom > mImageHeight) {
            mRect.bottom = mImageHeight
            mRect.top = mImageHeight - height
        }
        if (mRect.top < 0) {
            mRect.top = 0
            mRect.bottom = height
        }
    }
}
```

使用时：

```kotlin
class BigImgActivity : ActivityBase() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_big_img)

        val `is` = assets.open("image.jpg")
        iv_bigimg.setInputStream(`is`)
    }
}
```

**上面的例子能跑，但还不是最佳的方案，这里面有几个缺点**

- 滑动的时候会解码，这样就会卡顿，不流畅，所以需要另开线程进行解码
- 如何才能高效地加载，（滑动1像素、细微缩放时整个屏幕都需要重新加载吗？需要缓存周围区域吗？）
- 只支持上下滑动，不支持缩放等


实际使用可以参考一下GitHub上star多的的开源库，比如[LargeImage](https://github.com/LuckyJayce/LargeImage)