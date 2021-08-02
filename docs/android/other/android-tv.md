---
title: "Android TV 专项"
---

## 1 关于Leanback

[Leanback](https://developer.android.com/jetpack/androidx/releases/leanback) 是官方提供的专门用来开发 TV 应用的一套 UI 组件、模板页面。初看 Demo 效果，觉得很好，实际上用进项目就会发现，其模板页面的可定制性不高，且其架构为 MVP 架构。

虽然我们 App 在总体上不会全部套用 Leanback 组件，但是我们还是可以从里面吸取（复制）一些精华，比如选中放大动画、超大发光阴影处理等，这里下面进行叙述。  
此外，页面主题也可以从 Leanback 主题进行继承，主题推荐继承自 `Theme.AppCompat.Leanback`，这是一个结合了 Leanback 主题特色的 AppCompat 主题，集两家之长， leanback 版本 `1.1.0-beta01` 及以上可以使用。

我们 App 主题如下：

```xml
<style name="TingKidTV" parent="@style/Theme.AppCompat.Leanback">
   ...
</style>
```

## 2 UI问题的一些记录

### 2.1 全局字体

字体文件通过最终商定，选定了字重 400 的 regular 字体，加粗强调的字体部分使用系统提供的 fake bold 设置项。中文字体体积非常大，一个字体文件最终会有 8M 左右，对于引入多字重的中文字体文件，需要慎重。

全局字体非常好实现，只需要 theme 使用 `Theme.AppCompat.Leanback`， Activity 继承自 `AppCompatActivity`，然后在 theme 中指定 `android:fontFamily` 即可：

```xml
<style name="TingKidTV" parent="@style/Theme.AppCompat.Leanback">
   <item name="android:fontFamily">@font/font_jiangcheng_yuan_regular</item>
   <item name="android:includeFontPadding">false</item>
</style>
```

### 2.2 关于opticalBounds

> Optical bounds describe where a widget appears to be. They sit inside the clip bounds which need to cover a larger area to allow other effects, such as shadows and glows, to be drawn.

我们可以利用 opticalBounds 来给选中的 item 加上一个超大的发光阴影，而且不占用正常布局的位置。**不过缺点在于 opticalBounds 在 Android 4.3 上才被引入，4.2 以下怎么兼容还需要探讨一下。**

比如在下图中，"经典文学"这个item处于选中状态。其正常状态的布局区域就是最里层蓝色区域；选中时白色框是一张.9图，这张图距离里面item有一个margin，同时外面的发光边缘（一直到红色的部分）相当之大，与其他item有一些交叉。

![android tv optical bounds](/assets/images/android/tv_optical_bounds.webp)

为了更简单的达到这种效果，而不干扰正常状态下的item布局，我们采用了 opticalBounds 特性。该特性需要我们给.9图绘制红线，然后给 RecyclerView 及里面的 item 的 root 设置 opticalBounds。

???+ warning "一些经验规律"
    注意不要给顶层 View 设置 opticalBounds。  
    opticalBounds 在列表中好使，但是在ConstraintLayout的顶层布局中仍然会占据间距。

图中的.9图效果如下（由于图中框框是白色的，可以在搜索栏左边切换到深色模式后查看图）：

![optical bounds](/assets/images/android/bg_item_focused_rect_padding_5dp.9.png)

opticalBounds 的设置如下：

```
// xml
android:layoutMode="opticalBounds"

// code
itemView.layoutMode = ViewGroup.LAYOUT_MODE_OPTICAL_BOUNDS
```

???+ note "如何绘制.9图中的红线"  
    注意在AS中绘制.9时有提示，***Press Control/Shift while dragging on the border to modify layout bounds.***

### 2.3 焦点相关处理

焦点相关处理总结为三点：

1. 自定义View如何响应遥控器事件
2. 焦点移动到边缘后，再次移动但是动不了时，给与对应方向的抖动效果
3. 在列表中，向左移动到行首时，再次移动回到上一行的行末；同理，向右移动到行末时，再次移动回到下一行行首

#### 2.3.1 处理遥控器事件

遥控器事件我们主要响应上下左右以及确定按钮，keycode 如下：

- KEYCODE_DPAD_UP
- KEYCODE_DPAD_DOWN
- KEYCODE_DPAD_LEFT
- KEYCODE_DPAD_RIGHT
- KEYCODE_DPAD_CENTER

注意处理时，先判断 action 是否是 ACTION_DOWN，防抖。

```kotlin
setOnKeyListener { _, keyCode, keyEvent ->
   if (keyEvent.action != KeyEvent.ACTION_DOWN) {
         return@setOnKeyListener false
   }
   when (keyCode) {
         KeyEvent.KEYCODE_DPAD_LEFT -> {
            mStackBannerView.prevPage()
            return@setOnKeyListener true
         }
         KeyEvent.KEYCODE_DPAD_RIGHT -> {
            mStackBannerView.nextPage()
            return@setOnKeyListener true
         }
         KeyEvent.KEYCODE_DPAD_CENTER,
         KeyEvent.KEYCODE_ENTER -> {
            mStackBannerView.pressCenterButton()
            return@setOnKeyListener true
         }
   }
   return@setOnKeyListener false
}
```

此外，在 xml 中可以指定该 View 的下一个对应方向的焦点 View。

```xml
android:nextFocusDown="@+id/verticalGridView"
android:nextFocusLeft="@id/flIntroduction"
android:nextFocusRight="@id/flIntroduction"
android:nextFocusUp="@id/flIntroduction"
```

还可以将 nextFocus 的 id 指向自身，这样可以让对应方向的焦点移动不了。

#### 2.3.2 焦点边缘抖动

首先还是处于防抖的考虑，只在 ACTION_DOWN 时进行处理。然后找到当前的焦点 View，根据遥控器的事件来判断该方向的下一个焦点。如果下一个焦点为 null 或者自己，那就说明此时没法再移动了，此时可以认为到达了边缘。下面就可以根据遥控器的事件针对性的进行某方向的动画。

下面这段代码写在Activity中即可。

```kotlin
override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
   if (!enableShake()) return super.onKeyDown(keyCode, event)
   if (event.action != KeyEvent.ACTION_DOWN) return super.onKeyDown(keyCode, event)
   val focusedView = window?.decorView?.findFocus() ?: return super.onKeyDown(keyCode, event)
   val reachedBorder = isReachedBorder(focusedView, event)
   if (!reachedBorder) {
      return super.onKeyDown(keyCode, event)
   }
   if (keyCode == KeyEvent.KEYCODE_DPAD_LEFT || keyCode == KeyEvent.KEYCODE_DPAD_RIGHT) {
      startAnimation(focusedView, keyCode)
   } else if (keyCode == KeyEvent.KEYCODE_DPAD_UP || keyCode == KeyEvent.KEYCODE_DPAD_DOWN) {
      startAnimation(focusedView, keyCode)
   }
   return super.onKeyDown(keyCode, event)
}

private fun isReachedBorder(focusedView: View, event: KeyEvent): Boolean {
   when (event.keyCode) {
      KeyEvent.KEYCODE_DPAD_LEFT -> {
            return focusedView.focusSearch(View.FOCUS_LEFT).run {
               this == null || this == focusedView
            }
      }
      KeyEvent.KEYCODE_DPAD_UP -> {
            return focusedView.focusSearch(View.FOCUS_UP).run {
               this == null || this == focusedView
            }
      }
      KeyEvent.KEYCODE_DPAD_RIGHT -> {
            return focusedView.focusSearch(View.FOCUS_RIGHT).run {
               this == null || this == focusedView
            }
      }
      KeyEvent.KEYCODE_DPAD_DOWN -> {
            return focusedView.focusSearch(View.FOCUS_DOWN).run {
               this == null || this == focusedView
            }
      }
   }
   return false
}

private fun startAnimation(view: View, keyCode: Int) {
   (view.getTag(R.id.shake_animation) as? Animator)?.end()
   val animator = when (keyCode) {
      KeyEvent.KEYCODE_DPAD_LEFT -> {
            ObjectAnimator.ofFloat(view, "translationX", 0f, -8f, 0f, 8f, 0f, -8f, 0f, 8f, 0f)
      }
      KeyEvent.KEYCODE_DPAD_RIGHT -> {
            ObjectAnimator.ofFloat(view, "translationX", 0f, 8f, 0f, -8f, 0f, 8f, 0f, -8f, 0f)
      }
      KeyEvent.KEYCODE_DPAD_UP -> {
            ObjectAnimator.ofFloat(view, "translationY", 0f, -8f, 0f, 8f, 0f, -8f, 0f, 8f, 0f)
      }
      KeyEvent.KEYCODE_DPAD_DOWN -> {
            ObjectAnimator.ofFloat(view, "translationY", 0f, 8f, 0f, -8f, 0f, 8f, 0f, -8f, 0f)
      }
      else -> return
   }
   animator.duration = 500
   view.setTag(R.id.shake_animation, animator)
   animator.start()
}

protected open fun enableShake() = true
```

#### 2.3.3 列表中焦点换行

目前我们竖向的列表是使用的 Leanback 中的 VerticalGridView，这是基于 RecyclerView 实现的。下面就是处理焦点换行的代码：

```kotlin
verticalGridView.setOnUnhandledKeyListener {
   if ((it.keyCode == KeyEvent.KEYCODE_DPAD_RIGHT
            || it.keyCode == KeyEvent.KEYCODE_DPAD_LEFT
            || it.keyCode == KeyEvent.KEYCODE_DPAD_DOWN)
         && it.action == KeyEvent.ACTION_DOWN) {
         val focusedPos = verticalGridView.selectedPosition
         val adapter = verticalGridView.adapter ?: return@setOnUnhandledKeyListener false
         val totalCount = adapter.itemCount
         val column = 4
         if (it.keyCode == KeyEvent.KEYCODE_DPAD_LEFT && focusedPos != 0 && (focusedPos % column == 0)) {
            // 向左移动 & 到了行首 & 还能往前移动
            verticalGridView.selectedPosition = focusedPos - 1
            return@setOnUnhandledKeyListener true
         } else if (it.keyCode == KeyEvent.KEYCODE_DPAD_RIGHT && focusedPos != (totalCount - 1) && (focusedPos % column == column - 1)) {
            // 向右移动 & 到了行尾 & 还能往后移动
            verticalGridView.selectedPosition = focusedPos + 1
            return@setOnUnhandledKeyListener true
         } else if (it.keyCode == KeyEvent.KEYCODE_DPAD_DOWN && focusedPos + column >= totalCount) {
            // 向下移动 & 且不是最后一行
            verticalGridView.selectedPosition = totalCount - 1
            return@setOnUnhandledKeyListener true
         }
   }
   return@setOnUnhandledKeyListener false
}
```

### 2.4 选中放大伴随流光效果

![android-tv-shadow](/assets/images/android/tv-shadow.webp)

选中方法的效果，可以从 `androidx.leanback.widget.FocusHighlightHelper` 中参考并摘抄一份，因为该类里面的一些静态类我们无法从外部直接引用。然后把自己的类糅合到自己的框架中。

选中放大效果没有什么好具体说的，搬运 leanback 即可。下面贴贴流光效果的代码，实际上就是一个斜着放的线性渐变，不断给其设置改变 translation 的 matrix：

```kotlin
class FocusView(
    context: Context,
    attributes: AttributeSet? = null
): View(context, attributes) {

    companion object {
        val FOCUS_BACKGROUND_OPTICAL_BOUNDS_PADDING = 23.dp()
        val FOCUS_BACKGROUND_RADIUS = 12.dp()
        val FOCUS_SHADER_WIDTH = 40.dp()
        const val FOCUS_THROUGH_WHOLE_SCREEN_DURATION = 2_000L
    }

    private val mPointLeftTop = Point()
    private val mPointRightBottom = Point()

    private val mShapeRoundRectF = RectF()
    private var mFloatRaii: FloatArray = Array(8) { FOCUS_BACKGROUND_RADIUS }.toFloatArray()
    private val mPath = Path()
    private val mPaint = Paint()
    private val mShape: LinearGradient
    private val mShapeMatrix = Matrix()
    private val mPadding = FOCUS_BACKGROUND_OPTICAL_BOUNDS_PADDING

    private var mAnimator: Animator? = null

    var enableShader: Boolean = true
    var shaderRadius: Float = FOCUS_BACKGROUND_RADIUS
        set(value) {
            if (field != value) {
                mFloatRaii = Array(8) { value }.toFloatArray()
                initPoint()
            }
            field = value
        }

    init {
        mPaint.isAntiAlias = true

        val colors: IntArray = intArrayOf(0x00FFFFFF, 0xCCFFFFFF.toInt(), 0x00FFFFFF)
        mShape = LinearGradient(0F, 0F, FOCUS_SHADER_WIDTH, FOCUS_SHADER_WIDTH, colors, null, Shader.TileMode.CLAMP)
    }

    override fun setAlpha(alpha: Float) {
        super.setAlpha(alpha)

        if (!enableShader) return

        if (alpha == 1.0F) {
            startShader()
        } else {
            mAnimator?.cancel()
            mAnimator = null
        }
    }

    override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
        super.onLayout(changed, left, top, right, bottom)
        initPoint()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        if (mAnimator != null) {
            mPaint.shader = mShape
            canvas.drawPath(mPath, mPaint)
        }
    }

    override fun hasOverlappingRendering(): Boolean {
        return false
    }

    private fun initPoint() {
        mPointLeftTop.set(mPadding.toInt(), mPadding.toInt())
        mPointRightBottom.set((width - 1 * mPadding).toInt(), (height - 1 * mPadding).toInt())
        mShapeRoundRectF.set(mPointLeftTop.x.toFloat(),
            mPointLeftTop.y.toFloat(),
            mPointRightBottom.x.toFloat(),
            mPointRightBottom.y.toFloat())

        mPath.reset()
        mPath.addRoundRect(mShapeRoundRectF, mFloatRaii, Path.Direction.CW)
    }

    private fun startShader() {
        val startX = mPointLeftTop.x
        val endX = mPointRightBottom.x
        val startY = mPointLeftTop.y
        val endY = mPointRightBottom.y
        with (ValueAnimator.ofFloat(0F, 1F)) {
            mAnimator = this
//            this.interpolator = DecelerateInterpolator()
            this.duration = getAnimationDuration()
            this.addUpdateListener {
                val fraction = it.animatedFraction
                val translateX = (startX + (endX - startX) * fraction)
                val translateY = (startY + (endY - startY) * fraction)
                mShapeMatrix.setTranslate(translateX, translateY)
                mShape.setLocalMatrix(mShapeMatrix)
                invalidate()
            }
            this.addListener(
                onCancel = {
                    mAnimator = null
                },
                onEnd = {
                    mAnimator = null
                }
            )
            this.start()
        }
    }

    private fun getAnimationDuration(): Long {
        val screenWidth = context.resources.displayMetrics.widthPixels
        if (screenWidth == 0) return FOCUS_THROUGH_WHOLE_SCREEN_DURATION
        val viewWidth = measuredWidth
        return FOCUS_THROUGH_WHOLE_SCREEN_DURATION * viewWidth / screenWidth
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        mAnimator?.cancel()
        mAnimator = null
    }
}
```

### 2.5 clipChildren妙用

在我们实现选中效果时，有时有一些UI元素属于装饰性的，不需要在选中时将其裹住，但是也要跟随着选中进行整体的缩放。比如下面电视机的天线条。

![tv-clipchildren](/assets/images/android/tv-clipchildren.webp)

有一个方法就是根布局使用 ConstraintLayout，然后将天线布置出去但是不要与其他元素行程一个整体的约束，从而撑大整个根布局；同时将根布局clipChildren设置为false即可。

```xml
<!-- FocusContainer是一个继承自ConstraintLayout的组件 -->
<com.ximalaya.ting.kid.tv.widget.FocusContainer
   android:id="@+id/pictureBookViewContainer"
   android:layout_width="wrap_content"
   android:layout_height="wrap_content"
   android:clipChildren="false"
   app:focusBackground="@drawable/bg_item_focused_rect_padding_5dp"
   app:focusLayoutBring2Front="false">
   <!-- 电视主体，占据了约束布局的有效空间 -->
   <com.ximalaya.ting.kid.tv.picturebook.widget.TvPictureBookView
      android:id="@+id/tvPictureBookView"
      android:padding="12dp"
      android:background="@drawable/bg_picture_book_window_shell"
      android:layout_width="424dp"
      android:layout_height="280dp" />
   <!-- 电视天线的辅助线 -->
   <Space
      android:id="@+id/space"
      android:layout_width="wrap_content" 
      android:layout_height="wrap_content"
      app:layout_constraintTop_toTopOf="parent"/>
   <!-- 电视天线 -->
   <ImageView
      android:id="@+id/ivVipAvatar"
      android:layout_width="wrap_content"
      android:layout_height="wrap_content"
      android:src="@drawable/img_tv_line"
      android:contentDescription="@null"
      app:layout_constraintStart_toStartOf="@id/tvPictureBookView"
      app:layout_constraintEnd_toEndOf="@id/tvPictureBookView"
      app:layout_constraintBottom_toBottomOf="@id/space" />
</com.ximalaya.ting.kid.tv.widget.FocusContainer>
```

### 2.6 draw order