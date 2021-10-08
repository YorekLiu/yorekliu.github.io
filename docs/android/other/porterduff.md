---
title: "使用Porter-Duff合成数字图像"
---

[PorterDuff.Mode](https://developer.android.com/reference/android/graphics/PorterDuff.Mode.html)

---

Porter-Duff的名称是对 Thomas Porter 和 Tom Duff 的工作的致敬，他们在1984年的题为“合成数字图像”的开创性论文中提出了这一点。在论文中，作者描述了12个合成操作，这些操作控制了怎样计算 **source （要呈现的图形对象）** 与 **destination （渲染目标的内容）** 的组合所产生的颜色。  

“合成数字图像”发表于1984年7月的 *Computer Graphics* 第18卷第3期。  

由于 Porter 和 Duff 的工作仅关注 source 和 destination 的 alpha 通道的影响，原始论文中描述的12个操作在这里称为alpha合成模式（alpha compositing modes）。  

为方便起见，此类还提供了几种混合模式（blending modes），它们类似地定义了合成源和目标的结果，但不受限于alpha通道。这些混合模式不是由 Porter 和 Duff 定义的，但为方便起见，已包含在此类中。

## PorterDuff.Mode枚举值

PorterDuff.Mode有12+6个枚举值，如下表所示：

| PorterDuff.Mode | 含义 |
| --------------- | --- |
| CLEAR | src覆盖的dst部分被清除为0 |
| SRC | src取代dst |
| DST | src被丢弃，保留完整的dst |
| SRC_OVER | src显示在dst上方 |
| DST_OVER | src显示在dst下方 |
| SRC_IN | src覆盖dst的部分被保留，剩下的src和dst被丢弃 |
| DST_IN | dst覆盖src的部分被保留，剩下的src和dst被丢弃 |
| SRC_OUT | src没有覆盖dst的部分被保留，src覆盖dst的部分被丢弃，dst全部被丢弃 |
| DST_OUT | dst没有覆盖src的部分被保留，dst覆盖src的部分被丢弃，src全部被丢弃 |
| SRC_ATOP | src没有覆盖dst的部分被丢弃，其余的src会被绘制到dst上方 |
| DST_ATOP | dst没有覆盖src的部分被丢弃，其余的dst会被绘制到src上方 |
| XOR | src覆盖dst部分的src和dst都被丢弃，其余的src会进行绘制 |
| ADD | 将src添加到dst并使结果饱和 |
| MULTIPLY | 将src和dst相乘 |
| SCREEN | 添加src和dst，然后减去src乘dst |
| OVERLAY | 根据dst的颜色将src和dst MULTIPLY 或 SCREEN |
| DARKEN | 保留src和dst的最小 component |
| LIGHTEN | 保留src和dst的最大 component |

官方文档下面对每个枚举还有一个公式，某些不太好理解的枚举值，可以参考公式。此外，官方文档上几乎所有的枚举都有图。

重现这些效果的过程中踩了一点坑，下面分享下。

## 重现效果

首先上一张符合官网效果的图：

<figure style="width: 80%" class="align-center">
    <img src="/assets/images/android/porterduff-difference.png">
    <figcaption>Porter-Duff效果重现图（依次对应最后表格的1、2、3、4）</figcaption>
</figure>

如上图，最左边的一张图是符合官网效果的，右边三张是不同API在默认`layerType`下的表现。  
此外，我还测试了从KK到Q的不同版本、不同`layerType`、不同实现方式下的效果，表格会在最后列出来，测试的结果资源可以点击下载 [porterduff.zip](/assets/file/porterduff.zip)

每4个枚举一行，所以使用了5行的空间，枚举值如下：

```kotlin
PorterDuff.Mode.CLEAR, PorterDuff.Mode.SRC, PorterDuff.Mode.DST,  PorterDuff.Mode.SRC_OVER,
PorterDuff.Mode.DST_OVER, PorterDuff.Mode.SRC_IN, PorterDuff.Mode.DST_IN, PorterDuff.Mode.SRC_OUT,
PorterDuff.Mode.DST_OUT, PorterDuff.Mode.SRC_ATOP, PorterDuff.Mode.DST_ATOP, PorterDuff.Mode.XOR,
PorterDuff.Mode.ADD, PorterDuff.Mode.MULTIPLY, PorterDuff.Mode.SCREEN, PorterDuff.Mode.OVERLAY,
PorterDuff.Mode.DARKEN, PorterDuff.Mode.LIGHTEN
```

先上测试所需的两个图片：

<img src="/assets/images/android/src.png">
<img src="/assets/images/android/dst.png">

<center>Source image & Destination image</center>

然后就是测试代码了：  

!!! warning
    **注意**：我在查资料时发现有文章说Canvas实现效果和Bitmap实现效果有差异，后者会得到官网的效果。所以，下面的测试代码有两个方法，`drawCanvas`使用Canvas实现，`drawBitmap`使用Bitmap实现。后来在KK到Q上面进行测试，发现两个方法在其他一样的情况下效果都一样。  
    真正对实现效果有影响的是**layerType**，该值默认会是`LAYER_TYPE_NONE`，我们只需要指定为`LAYER_TYPE_SOFTWARE`就会得到官网的效果。而且对于`LAYER_TYPE_NONE`来说，各个API Level之间还有一点差异，详见后面表格以及测试结果资源 [porterduff.zip](/assets/file/porterduff.zip)

**activity_porter_duff.xml**

```xml
<?xml version="1.0" encoding="utf-8"?>
<yorek.demoandtest.porterduff.PorterDuffView
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent" />
<!-- android:layerType="software" -->
```

**PorterDuffView.kt**

```kotlin
class PorterDuffView (
    context: Context,
    attrs: AttributeSet? = null
) : View(context, attrs) {

    private val destinationImage by lazy { BitmapFactory.decodeResource(resources, R.drawable.dst) }
    private val sourceImage by lazy { BitmapFactory.decodeResource(resources, R.drawable.src) }
    private var paint = TextPaint(Paint.ANTI_ALIAS_FLAG)

    private val imageWidth by lazy { destinationImage.width }
    private val imageHeight by lazy { destinationImage.height }

    private val modeList = listOf(
        PorterDuff.Mode.CLEAR, PorterDuff.Mode.SRC, PorterDuff.Mode.DST,  PorterDuff.Mode.SRC_OVER,
        PorterDuff.Mode.DST_OVER, PorterDuff.Mode.SRC_IN, PorterDuff.Mode.DST_IN, PorterDuff.Mode.SRC_OUT,
        PorterDuff.Mode.DST_OUT, PorterDuff.Mode.SRC_ATOP, PorterDuff.Mode.DST_ATOP, PorterDuff.Mode.XOR,
        PorterDuff.Mode.ADD, PorterDuff.Mode.MULTIPLY, PorterDuff.Mode.SCREEN, PorterDuff.Mode.OVERLAY,
        PorterDuff.Mode.DARKEN, PorterDuff.Mode.LIGHTEN
    )

    init {
        paint.color = Color.WHITE
        paint.density = context.resources.displayMetrics.density
        paint.textSize = paint.density * 20F
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        drawCanvas(canvas)
//        drawBitmap(canvas)
    }

    private fun drawCanvas(canvas: Canvas) {
        canvas.drawColor(Color.GRAY)

        var currentLeft = 0F
        var currentTop = 0F

        // 每行4个
        for (i in 0 until modeList.size) {
            val saveCount = canvas.saveLayer(0F, 0F, currentLeft + imageWidth, currentTop + imageHeight, paint, Canvas.ALL_SAVE_FLAG)

            canvas.drawBitmap(destinationImage, currentLeft, currentTop, paint)
            paint.xfermode = PorterDuffXfermode(modeList[i])
            canvas.drawBitmap(sourceImage, currentLeft, currentTop, paint)

            paint.xfermode = null
            canvas.restoreToCount(saveCount)

            if ((i + 1) % 4 == 0) {
                currentLeft = 0F
                currentTop += imageHeight
            } else {
                currentLeft += imageWidth
            }
        }

        canvas.drawText("API Level ${Build.VERSION.SDK_INT}, ${getLayerTypeName()}, Canvas", 100F, height - 100F, paint)
    }


    private fun drawBitmap(canvas: Canvas) {
        canvas.drawColor(Color.GRAY)

        var currentLeft = 0F
        var currentTop = 0F

        // 每行4个
        for (i in 0 until modeList.size) {
            val saveCount = canvas.saveLayer(0F, 0F, canvas.width.toFloat(), canvas.height.toFloat(), null, Canvas.ALL_SAVE_FLAG)

            val destinationBitmap = Bitmap.createBitmap(imageWidth, imageHeight, Bitmap.Config.ARGB_8888)
            val sourceBitmap = Bitmap.createBitmap(imageWidth, imageHeight, Bitmap.Config.ARGB_8888)
            val destinationCanvas = Canvas(destinationBitmap)
            val sourceCanvas = Canvas(sourceBitmap)

            destinationCanvas.drawBitmap(destinationImage, 0F, 0F, paint)
            canvas.drawBitmap(destinationBitmap, currentLeft, currentTop, paint)

            sourceCanvas.drawBitmap(sourceImage, 0F, 0F, paint)
            paint.xfermode = PorterDuffXfermode(modeList[i])
            canvas.drawBitmap(sourceBitmap, currentLeft, currentTop, paint)

            paint.xfermode = null
            canvas.restoreToCount(saveCount)

            if ((i + 1) % 4 == 0) {
                currentLeft = 0F
                currentTop += imageHeight
            } else {
                currentLeft += imageWidth
            }
        }

        canvas.drawText("API Level ${Build.VERSION.SDK_INT}, ${getLayerTypeName()}, Bitmap", 100F, height - 100F, paint)
    }

    private fun getLayerTypeName() =
        when (layerType) {
            LAYER_TYPE_NONE -> "NONE"
            LAYER_TYPE_SOFTWARE -> "SOFTWARE"
            LAYER_TYPE_HARDWARE -> "HARDWARE"
            else -> "UNKNOWN"
        }
}
```

**PorterDuffActivity.kt**

```kotlin
class PorterDuffActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_porter_duff)
    }
}
```

上面三个文件就是全部的测试代码了，这里有两个配置：一个是xml中`layerType`的指定与否；另外一个就是`PorterDuffView.kt`文件中第29行和第30行的二选一。

测试结果如下：

<center>KK到Q版本PorterDuff表现的异同</center>

<table>
  <thead>
    <tr>
      <th></th>
      <th colspan="2">software</th>
      <th colspan="2">default</th>
    </tr>
    <tr>
      <th></th>
      <th>Bitmap</th>
      <th>Canvas</th>
      <th>Bitmap</th>
      <th>Canvas</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Q (beta 4)</td>
      <td colspan="2" rowspan="7">1</td>
      <td colspan="2">2</td>
    </tr>
    <tr>
      <td>P</td>
      <td colspan="2">3</td>
    </tr>
    <tr>
      <td>O</td>
      <td colspan="2" rowspan="5">4</td>
    </tr>
    <tr>
      <td>N</td>
    </tr>
    <tr>
      <td>M</td>
    </tr>
    <tr>
      <td>L</td>
    </tr>
    <tr>
      <td>KK</td>
    </tr>
  </tbody>
</table>

上图的1、2、3、4分别指 *Porter-Duff效果重现图* 中的第1、2、3、4张图。