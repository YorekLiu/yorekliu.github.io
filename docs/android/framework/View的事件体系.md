---
title:  "View的事件体系"
---

本章的主要内容有：

- View的基础知识
- View的滑动、弹性滑动
- View的事件分发机制
- View的滑动冲突处理

## 1 View的基础知识
本节包括View的位置参数、MotionEvent、VelocityTracker、GestureDetector以及Scroller。

### 1.1 View的位置参数
View的位置由四个顶点来决定：**top、left、right、bottom**，这些都是相对于View的父容器来说的，因此是一种 **相对坐标**。

从Android 3.0以来，View新增了几个参数坐标：**x、y、translationX、translationY**。x、y是View的左上角的坐标，translationX、translationY是View左上角相对于父容器的偏移量。这也是一种 **相对坐标**。

这几个坐标的换算关系如下：  

> x = left + translationX  
> y = top + translationY

x、y这两个坐标参数都是虚拟的，其getter和setter是通过left、top、translationX和translationY四个参数转化而来的。
```java
    /**
     * The visual x position of this view, in pixels. This is equivalent to the
     * {@link #setTranslationX(float) translationX} property plus the current
     * {@link #getLeft() left} property.
     *
     * @return The visual x position of this view, in pixels.
     */
    @ViewDebug.ExportedProperty(category = "drawing")
    public float getX() {
        return mLeft + getTranslationX();
    }

    /**
     * Sets the visual x position of this view, in pixels. This is equivalent to setting the
     * {@link #setTranslationX(float) translationX} property to be the difference between
     * the x value passed in and the current {@link #getLeft() left} property.
     *
     * @param x The visual x position of this view, in pixels.
     */
    public void setX(float x) {
        setTranslationX(x - mLeft);
    }
```
> **注意**：在View的平移过程中，发生改变的是x、y、translationX、translationY这几个参数。top和left是表示原始左上角的位置信息，其值不会发生改变。

### 1.2 MotionEvent
**1.MotionEvent**  
MotionEvent典型的三个事件：ACTION_DOWN、ACTION_MOVE、ACTION_UP  
两组方法：`getX/getY`和`getRawX/getRawY`。前者获取相对于View左上角的x/y值，后者获取的是相对于屏幕左上角的x/y值。  

![View的四个顶点以及MotionEvent的x、y、rawX、rawY](/assets/images/android/view的位置坐标.png)

**2.触摸事件的一些常量**  
这些常量定义在`frameworks/base/core/res/res/values/config.xml `文件中。
```xml
< !-- Base "touch slop" value used by ViewConfiguration as a movement threshold where scrolling should begin. -->
<dimen name="config_viewConfigurationTouchSlop">8dp</dimen>

< !-- Minimum velocity to initiate a fling, as measured in dips per second. -->
<dimen name="config_viewMinFlingVelocity">50dp</dimen>

< !-- Maximum velocity to initiate a fling, as measured in dips per second. -->
<dimen name="config_viewMaxFlingVelocity">8000dp</dimen>
```
除了触摸事件，还有其他的信息也定义在其中，比如启用短信强制7bit编码的config_sms_force_7bit_encoding等。
```xml
<bool name="config_sms_force_7bit_encoding">false</bool>
```

TouchSlop是系统能够识别出的被认为是滑动的最小距离(一般是8dp)，该值在自定义View的触摸事件时会用上。被识别为Fling的最小、最大速度也可以获取。  
可以通过如下方式获取这些常量：
```java
ViewConfiguration.get(this).getScaledTouchSlop();
ViewConfiguration.get(this).getScaledMinimumFlingVelocity();
ViewConfiguration.get(this).getScaledMaximumFlingVelocity();
```
### 1.3 VelocityTracker、GestureDetector和Scroller

#### 1.3.1 VelocityTracker

VelocityTracker可以用来追踪手指在滑动过程中的速度，包括水平和竖直方向的速度。  

1. 首先在View的onTouchEvent方法中追踪当前点击事件的速度

    ```java
    VelocityTracker velocityTracker = VelocityTracker.obtain();
    velocityTracker.addMovement(event);
    ```

2. 在我们想知道当前的滑动速度时：  
 
    ```java
    velocityTracker.computeCurrentVelocity(1000);
    
    int xV = (int) velocityTracker.getXVelocity();
    int xY = (int) velocityTracker.getYVelocity();
    ```
    这里的速度指的是单位时间内手指滑过的像素数。水平从左往右滑动，水平速度为正；反之，为负。  

3. 在不需要时，需要释放掉资源

    ```java
    velocityTracker.clear();
    velocityTracker.recycle();
    ```

下面是来自[官网开发者文档的实例](https://developer.android.com/training/gestures/movement#velocity)：

```kotlin
private const val DEBUG_TAG = "Velocity"

class MainActivity : Activity() {
    private var mVelocityTracker: VelocityTracker? = null

    override fun onTouchEvent(event: MotionEvent): Boolean {

        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                // Reset the velocity tracker back to its initial state.
                mVelocityTracker?.clear()
                // If necessary retrieve a new VelocityTracker object to watch the
                // velocity of a motion.
                mVelocityTracker = mVelocityTracker ?: VelocityTracker.obtain()
                // Add a user's movement to the tracker.
                mVelocityTracker?.addMovement(event)
            }
            MotionEvent.ACTION_MOVE -> {
                mVelocityTracker?.apply {
                    val pointerId: Int = event.getPointerId(event.actionIndex)
                    addMovement(event)
                    // When you want to determine the velocity, call
                    // computeCurrentVelocity(). Then call getXVelocity()
                    // and getYVelocity() to retrieve the velocity for each pointer ID.
                    computeCurrentVelocity(1000)
                    // Log velocity of pixels per second
                    // Best practice to use VelocityTrackerCompat where possible.
                    Log.d("", "X velocity: ${getXVelocity(pointerId)}")
                    Log.d("", "Y velocity: ${getYVelocity(pointerId)}")
                }
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                // Return a VelocityTracker object back to be re-used by others.
                mVelocityTracker?.recycle()
                mVelocityTracker = null
            }
        }
        return true
    }
}
```

#### 1.3.2 GestureDetector
手势检测器，用来辅助检测用户的单击、滑动、长按、双击等行为。

在View内部添加`GestureDetector`的过程如下：

1. 创建一个`GestureDetector`对象并传入`OnGestureListener`接口的实现类，根据需要还可以选择实现`OnDoubleTapListener`接口从而监听双击行为：
   ```java
   GestureDetector mGestureDetector = new GestureDetector(this);
   // 禁止掉长按事件，使View可以响应长按事件
   mGestureDetector.setIsLongpressEnabled(false);
   ```

2. 接管目标View的没TouchEvent方法，在待监听View的onTouchEvent方法中加如下实现：
   ```java
   return mGestureDetector.onTouchEvent(event);
   ```

在Activity中使用时，如[官网开发者文档实例](https://developer.android.com/training/gestures/detector#detect)所示：

```kotlin
private const val DEBUG_TAG = "Gestures"

class MainActivity :
        Activity(),
        GestureDetector.OnGestureListener,
        GestureDetector.OnDoubleTapListener {

    private lateinit var mDetector: GestureDetectorCompat

    // Called when the activity is first created.
    public override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        // Instantiate the gesture detector with the
        // application context and an implementation of
        // GestureDetector.OnGestureListener
        mDetector = GestureDetectorCompat(this, this)
        // Set the gesture detector as the double tap
        // listener.
        mDetector.setOnDoubleTapListener(this)
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        return if (mDetector.onTouchEvent(event)) {
            true
        } else {
            super.onTouchEvent(event)
        }
    }

    override fun onDown(event: MotionEvent): Boolean {
        Log.d(DEBUG_TAG, "onDown: $event")
        return true
    }

    override fun onFling(
            event1: MotionEvent,
            event2: MotionEvent,
            velocityX: Float,
            velocityY: Float
    ): Boolean {
        Log.d(DEBUG_TAG, "onFling: $event1 $event2")
        return true
    }

    override fun onLongPress(event: MotionEvent) {
        Log.d(DEBUG_TAG, "onLongPress: $event")
    }

    override fun onScroll(
            event1: MotionEvent,
            event2: MotionEvent,
            distanceX: Float,
            distanceY: Float
    ): Boolean {
        Log.d(DEBUG_TAG, "onScroll: $event1 $event2")
        return true
    }

    override fun onShowPress(event: MotionEvent) {
        Log.d(DEBUG_TAG, "onShowPress: $event")
    }

    override fun onSingleTapUp(event: MotionEvent): Boolean {
        Log.d(DEBUG_TAG, "onSingleTapUp: $event")
        return true
    }

    override fun onDoubleTap(event: MotionEvent): Boolean {
        Log.d(DEBUG_TAG, "onDoubleTap: $event")
        return true
    }

    override fun onDoubleTapEvent(event: MotionEvent): Boolean {
        Log.d(DEBUG_TAG, "onDoubleTapEvent: $event")
        return true
    }

    override fun onSingleTapConfirmed(event: MotionEvent): Boolean {
        Log.d(DEBUG_TAG, "onSingleTapConfirmed: $event")
        return true
    }

}
```

OnGestureListener接口、OnDoubleTapListener接口方法有很多：  

<figcaption>OnGestureListener接口</figcaption>

| 方法名 | 描述 |
| -------- | -------- |
| onDown | 手指触摸屏幕的一瞬间，由ACTION_DOWN触发 |
| onShowPress | 手指触摸屏幕，没有移动也没有松开，由ACTION_DOWN触发（注意其强调的状态） |
| onSingleTapUp | 手指点击后松开，由ACTION_UP触发 |
| onScroll | 手指滑动，由一个ACTION_DOWN，多个ACTION_MOVE触发 |
| onLongPress | 长按事件 |
| onFling | 快速滑动，由一个完整的事件序列触发 |

<figcaption>OnDoubleTapListener接口</figcaption>

| 方法名 | 描述 |
| -------- | -------- |
| onDoubleTap | 双击事件，不能和`onSingleTapConfirmed`共存 |
| onSingleTapConfirmed | 严格的单击行为 |
| onDoubleTapEvent | 发生了双击行为，在双击期间，down、move、up都会触发此回调 |

#### 1.3.3 Scroller

Scroller可用于实现View的弹性滑动。Scroller本身无法让View弹性滑动，它需要和View的`computeScroll`方法配合使用才能共同完成这个功能。

[开发者官网的示例](https://developer.android.com/reference/android/widget/Scroller)如下所示：

```java
 private Scroller mScroller = new Scroller(context);
 ...
 public void zoomIn() {
     // Revert any animation currently in progress
     mScroller.forceFinished(true);
     // Start scrolling by providing a starting point and
     // the distance to travel
     mScroller.startScroll(0, 0, 100, 0);
     // Invalidate to request a redraw
     invalidate();
 }

 @Override
 public void computeScroller() {
     if (mScroller.computeScrollOffset()) {
         // Get current x and y positions
         int currX = mScroller.getCurrX();
         int currY = mScroller.getCurrY();

         ...
         // zoom

         postInvalidate();
     }
 }
```

## 2 View的滑动

实现View的滑动有很多种方法，一般有五种方法：

1. `layout()`  
`layout()`方法会调用`onLayout()`来设置显示的位置，传入left、top、right、bottom四个参数即可。

2. `offsetLeftAndRight()`/`offsetTopAndBottom()`  
此方法和layout()差不多，`offsetLeftAndRight()`传入x轴方向的偏移，`offsetTopAndBottom()`传入y轴方向的偏移。  
**比较推荐这种方法**

3. LayoutParams  

    ```java
    ViewGroup.MarginLayoutParams layoutParams = (ViewGroup.MarginLayoutParams) view.getLayoutParams();
    layoutParams.width = 100;
    layoutParams.leftMargin = 200;
    layoutParams.rightMargin = 200;
    view.setLayoutParams(layoutParams);
    //或者view.requestLayout();
    ```

4. 动画  
通过动画改变，主要是操作View的`translationX`和`translationY`两个属性

5. scrollTo()/scrollBy()  
`scrollBy`调用了`scrollTo`，前者是相对于当前位置的相对滑动，后者是绝对滑动。  
>**注意**：使用`scrollTo()`/`scrollBy()`来实现View的滑动，只能将View的内容进行移动，并不能移动内容本身。因此mScrollX和mScrollY的值是平常理解的值得相反数，也就是说：如果想让内容从左往右滑动，那么mScrollX为负值；从上往下，mScrollY为负值。

## 3 弹性滑动
**弹性滑动的思想**：化整为零，将一次大的滑动分为若干次小的滑动，并在一段时间内完成。方式各种各样，比如Scroller、动画、使用Handler的postDelayed或者Thread的sleep等。


### 3.1 使用Scroller实现弹性滑动
在1.3.3节中我们说了Scroller的使用方法，Scroller的使用就是两个方法的调用`startScroll`以及`computeScrollOffset`。

先来看一下`startScroll`方法：
```java
public void startScroll(int startX, int startY, int dx, int dy, int duration) {
    mMode = SCROLL_MODE;
    mFinished = false;
    mDuration = duration;
    mStartTime = AnimationUtils.currentAnimationTimeMillis();
    mStartX = startX;
    mStartY = startY;
    mFinalX = startX + dx;
    mFinalY = startY + dy;
    mDeltaX = dx;
    mDeltaY = dy;
    mDurationReciprocal = 1.0f / (float) mDuration;
}
```
`startScroll`方法内部什么也没有做，只是保存了传递进来的几个参数，然后根据这些参数初始化相关的参数。在这里中mFinished初始化为false，mMode为SCROLL_MODE。

然后看下`computeScrollOffset`方法，由于mMode初始化为SCROLL_MODE，所以我们只看这部分的代码：
```java
public boolean computeScrollOffset() {
    if (mFinished) {
        return false;
    }

    int timePassed = (int)(AnimationUtils.currentAnimationTimeMillis() - mStartTime);

    if (timePassed < mDuration) {
        switch (mMode) {
        case SCROLL_MODE:
            final float x = mInterpolator.getInterpolation(timePassed * mDurationReciprocal);
            mCurrX = mStartX + Math.round(x * mDeltaX);
            mCurrY = mStartY + Math.round(x * mDeltaY);
            break;
        case FLING_MODE:
                ......

            break;
        }
    }
    else {
        mCurrX = mFinalX;
        mCurrY = mFinalY;
        mFinished = true;
    }
    return true;
}
```
`computeScrollOffset`返回true表示正在计算，返回false表示已经计算完成(滑动随之完成)。在此方法中我们可以看到，此方法的作用就是根据时间流逝的百分比来计算出scrollX、scrollY改变的百分比，最后在计算出当前的值(mCurrX、mCurrY)，这类似于动画中Interpolator的概念。  
Scroller真正让View产生弹性滑动的原因是`startScroll`下面的`invalidate()`方法。`invalidate()`会导致View重绘，重绘时会调用`draw`方法，`draw`又会调用`computeScrollOffset`方法。在`computeScrollOffset`方法中会滑动一小段距离，然后又调用`postInvalidate`进行第二次重绘，直到整个过程结束。

### 3.2 使用动画
使用动画来实现弹性滑动很简单，不做过多的描述。但其本身的原理也是化整为零，涉及到的原理有插值器Interpolator、估值器TypeEvaluator。

插值器的作用是根据时间流逝的百分比来确定动画执行过程的百分比。  
估值器的作用是根据动画过程执行的百分比来确定当前的位置。

上面Scroller的`computeScrollOffset()`方法实现的功能就类似与插值器和估值器的功能。  
关于动画的详细内容会在[Android动画](/android/framework/Android%E5%8A%A8%E7%94%BB/)中讲解。

### 3.3 使用延时策略
延时策略实现弹性滑动的核心思想是通过发送一系列延时消息从而达到一种渐进式的效果。具体来说可以使用Handler或者View的`postDelayed`，也可以使用线程的`sleep`方法。实现也比较简单，不过多描述。


## 4 View的事件分发机制

View的事件分发机制不只针对触摸事件，其他的事件（比如按键事件、轨迹球事件）也是类似的思想。都是Activity委托Window，Window委托DecorView，DecorView再来依次通知子元素。这里我们针对触摸事件进行源码分析。

!!! tip
    如果不知道轨迹球是个啥的话，可以百度一下罗技M570轨迹球鼠标，博主正在用。

### 4.1 触摸事件的传递规则

!!! success
    在View事件分发机制中，尤其需要注意一点：**ViewGroup继承至View**。

ViewGroup触摸事件的分发由三个重要的方法来共同完成：

1. `public boolean dispatchTouchEvent(MotionEvent ev)`  
用来进行事件的分发。如果事件能够传递给当前View，此方法一定会被调用。返回true表示此事件被处理了。
2. `public boolean onInterceptTouchEvent(MotionEvent ev)`  
用来判断是否拦截此事件。返回true表示拦截此事件。
3. `public boolean onTouchEvent(MotionEvent event)`  
用来处理点击事件。返回true表示处理了事件。

下图表示ViewGroup的事件传递规则：

![ViewGroup的事件传递规则](/assets/images/android/ViewGroup的事件传递规则.png)

对于一个ViewGroup来说，点击事件产生后，其`dispatchTouchEvent`方法会被调用，如果其`onInterceptTouchEvent`返回true，表示ViewGroup要拦截该事件，其`onTouchEvent`就会被调用；  
否则，表示不拦截当前事件，点击事件就会传递给它的子元素，子元素的`dispatchTouchEvent`方法会被调用。如果最后点击事件传递到了View，由于View没有`onInterceptTouchEvent`方法，一旦有事件传递给它，其`onTouchEvent`就会被调用。  
其关系可以用伪代码来表示：
```java
public boolean dispatchTouchEvent(MotionEvent ev) {
    boolean consume = false;
    if (onInterceptTouchEvent(ev)) {
        consume = onTouchEvent(ev);
    } else {
        consume = child.dispatchTouchEvent(ev);
    }

    return consume;
}
```

当一个点击事件产生后，它的传递过程如下：Activity -> Window -> 顶级View。顶级View再在View体系内部进行传递。

### 4.2 事件分发的源码解析
所有源码基于Android 7.1。  

#### 4.2.1 Activity的事件分发过程

当触摸事件传递到Activity时，也是从Activity的`dispatchTouchEvent`方法开始。

```java
public boolean dispatchTouchEvent(MotionEvent ev) {
    if (ev.getAction() == MotionEvent.ACTION_DOWN) {
        onUserInteraction();
    }
    if (getWindow().superDispatchTouchEvent(ev)) {
        return true;
    }
    return onTouchEvent(ev);
}
```
当触摸事件是ACTION_DOWN时，会回调`onUserInteraction`方法。`onUserInteraction`在Activity里面是一个空实现，会在按键事件、触摸事件、轨迹球事件分发到Activity时调用。

触摸事件的具体分发是由Activity内部的Window来完成的。Window是一个抽象类，其实现类是PhoneWindow（关于Window与WindowManager会在后续章节中讲解）。

这点可以从Android 7.0以后的代码上直接看出来，具体在Activity类的[attach](http://androidxref.com/7.1.1_r6/xref/frameworks/base/core/java/android/app/Activity.java#6619)方法中`mWindow = new PhoneWindow(this, window);`。[更多关于Window的知识可以查看此文章](/android/framework/Window%E4%B8%8EWindowManager/)

下面接着看PhoneWindow的superDispatchTouchEvent方法：
```java
@Override
public boolean superDispatchTouchEvent(MotionEvent event) {
    return mDecor.superDispatchTouchEvent(event);
}
```
PhoneWindow直接将事件委托给了DecorView处理，而DecorView是一个FrameLayout。
```java
** @hide */
public class DecorView extends FrameLayout implements RootViewSurfaceTaker, WindowCallbacks {
    ....
    public boolean superDispatchTouchEvent(MotionEvent event) {
        return super.dispatchTouchEvent(event);
    }
    ....
}
```
从这里开始，事件已经传递到了顶级View，顶级View一般都是ViewGroup。

因此，点击事件在Activity中的传递由Activity的`dispatchTouchEvent`方法开始，Activity会将事件交给Window处理，而Window又会转手交给DecorView处理。如果DecorView里面有View处理了触摸事件，那么Activity的`dispatchTouchEvent`会返回true；否则，如果没有View处理点击事件，那么Activity的`onTouchEvent`会被调用。

#### 4.2.2 顶级View的事件分发过程

在4.1节中我们以伪代码的形式阐述了ViewGroup的触摸事件传递规则，现在我们看看真正的源码。ViewGroup的事件分发机制主要体现在`dispatchTouchEvent`方法中。这个方法太长，也比较难看，我们分段说明。

这一段说明针对ACTION_DOWN进行的重置操作：
```java
// Handle an initial down.
if (actionMasked == MotionEvent.ACTION_DOWN) {
    // Throw away all previous state when starting a new touch gesture.
    // The framework may have dropped the up or cancel event for the previous gesture
    // due to an app switch, ANR, or some other state change.
    cancelAndClearTouchTargets(ev);
    resetTouchState();
}
```
当ACTION_DOWN事件来到时，ViewGroup会首先进行重置操作，清除touch targets以及FLAG_DISALLOW_INTERCEPT标志位。

下面这一段说明的是否要拦截点击事件：
```java
 // Check for interception.
final boolean intercepted;
if (actionMasked == MotionEvent.ACTION_DOWN || mFirstTouchTarget != null) {
    final boolean disallowIntercept = (mGroupFlags & FLAG_DISALLOW_INTERCEPT) != 0;
    if (!disallowIntercept) {
        intercepted = onInterceptTouchEvent(ev);
        ev.setAction(action); // restore action in case it was changed
    } else {
        intercepted = false;
    }
} else {
    // There are no touch targets and this action is not an initial down
    // so this view group continues to intercept touches.
    intercepted = true;
}
```
mFirstTouchTarget在ViewGroup的子元素成功处理事件时会被赋值指向子View。因此，**如果是ACTION_DOWN或者子元素成功处理时，ViewGroup才会判断是否要拦截当前事件**。反之，如果不是初始的ACTION_DOWN事件且没有触摸目标，ViewGroup会继续拦截触摸事件，这样自己就会处理。

当然，FLAG_DISALLOW_INTERCEPT标志位是一个特殊情况。此标记位可以通过子View的`requestDisallowInterceptTouchEvent`设置。当此标记位设置后，ViewGroup无法拦截除了ACTION_DOWN之外的事件。ACTION_DOWN事件无法拦截的原因是因为ViewGroup在分发事件时会重置此标记位（见第一段代码）。因此，ACTION_DOWN事件来临时，ViewGroup总会调用`onInterceptTouchEvent`方法询问自己是否需要拦截。

从上面的源码分析，我们可以得出两个结论：

1. 当ViewGroup决定拦截事件后，那么后续的点击事件将会默认交给它处理并且不再调用它的`onInterceptTouchEvent`方法。也就是说，`onInterceptTouchEvent`不是每次事件都会被调用的，如果我们想提前处理所有的点击事件，要选择`dispatchTouchEvent`方法，只有这个方法能确保每次都会调用
2. `FLAG_DISALLOW_INTERCEPT`这个标志的作用是让ViewGroup不再拦截事件，前提是ViewGroup不拦截ACTION_DOWN事件。  
`FLAG_DISALLOW_INTERCEPT`标记位的作用给我们提供了一个思路，当面对滑动冲突时，我们可以考虑基于该原理的内部拦截法。


下面一段代码讲述的是ViewGroup不拦截之后，事件在子View中的分发
```java
if (!canceled && !intercepted) {

    // If the event is targeting accessiiblity focus we give it to the
    // view that has accessibility focus and if it does not handle it
    // we clear the flag and dispatch the event to all children as usual.
    // We are looking up the accessibility focused host to avoid keeping
    // state since these events are very rare.
    View childWithAccessibilityFocus = ev.isTargetAccessibilityFocus()
            ? findChildWithAccessibilityFocus() : null;

    if (actionMasked == MotionEvent.ACTION_DOWN
            || (split && actionMasked == MotionEvent.ACTION_POINTER_DOWN)
            || actionMasked == MotionEvent.ACTION_HOVER_MOVE) {
        final int actionIndex = ev.getActionIndex(); // always 0 for down
        final int idBitsToAssign = split ? 1 << ev.getPointerId(actionIndex)
                : TouchTarget.ALL_POINTER_IDS;

        // Clean up earlier touch targets for this pointer id in case they
        // have become out of sync.
        removePointersFromTouchTargets(idBitsToAssign);

        final int childrenCount = mChildrenCount;
        if (newTouchTarget == null && childrenCount != 0) {
            final float x = ev.getX(actionIndex);
            final float y = ev.getY(actionIndex);
            // Find a child that can receive the event.
            // Scan children from front to back.
            final ArrayList<View> preorderedList = buildTouchDispatchChildList();
            final boolean customOrder = preorderedList == null
                    && isChildrenDrawingOrderEnabled();
            final View[] children = mChildren;
            for (int i = childrenCount - 1; i >= 0; i--) {
                final int childIndex = getAndVerifyPreorderedIndex(
                        childrenCount, i, customOrder);
                final View child = getAndVerifyPreorderedView(
                        preorderedList, children, childIndex);

                // If there is a view that has accessibility focus we want it
                // to get the event first and if not handled we will perform a
                // normal dispatch. We may do a double iteration but this is
                // safer given the timeframe.
                if (childWithAccessibilityFocus != null) {
                    if (childWithAccessibilityFocus != child) {
                        continue;
                    }
                    childWithAccessibilityFocus = null;
                    i = childrenCount - 1;
                }

                if (!canViewReceivePointerEvents(child)
                        || !isTransformedTouchPointInView(x, y, child, null)) {
                    ev.setTargetAccessibilityFocus(false);
                    continue;
                }

                newTouchTarget = getTouchTarget(child);
                if (newTouchTarget != null) {
                    // Child is already receiving touch within its bounds.
                    // Give it the new pointer in addition to the ones it is handling.
                    newTouchTarget.pointerIdBits |= idBitsToAssign;
                    break;
                }

                resetCancelNextUpFlag(child);
                if (dispatchTransformedTouchEvent(ev, false, child, idBitsToAssign)) {
                    // Child wants to receive touch within its bounds.
                    mLastTouchDownTime = ev.getDownTime();
                    if (preorderedList != null) {
                        // childIndex points into presorted list, find original index
                        for (int j = 0; j < childrenCount; j++) {
                            if (children[childIndex] == mChildren[j]) {
                                mLastTouchDownIndex = j;
                                break;
                            }
                        }
                    } else {
                        mLastTouchDownIndex = childIndex;
                    }
                    mLastTouchDownX = ev.getX();
                    mLastTouchDownY = ev.getY();
                    newTouchTarget = addTouchTarget(child, idBitsToAssign);
                    alreadyDispatchedToNewTouchTarget = true;
                    break;
                }

                // The accessibility focus didn't handle the event, so clear
                // the flag and do a normal dispatch to all children.
                ev.setTargetAccessibilityFocus(false);
            }
            if (preorderedList != null) preorderedList.clear();
        }

        if (newTouchTarget == null && mFirstTouchTarget != null) {
            // Did not find a child to receive the event.
            // Assign the pointer to the least recently added target.
            newTouchTarget = mFirstTouchTarget;
            while (newTouchTarget.next != null) {
                newTouchTarget = newTouchTarget.next;
            }
            newTouchTarget.pointerIdBits |= idBitsToAssign;
        }
    }
}
```
上面的代码配合注释也很清楚，首先从前往后遍历找到能够接受事件的View。是否能够接受事件由第50、51行的两个方法决定：子元素是否可见、是否在播放动画，点击事件的坐标是否落在子元素的区域内。如果某子元素满足这些条件，那么事件则会交给其处理。`dispatchTransformedTouchEvent`方法实际上调用的就是子元素的`dispatchTouchEvent`方法，这样触摸事件就交给子元素进行分发了。`dispatchTransformedTouchEvent`方法内部核心源码：

```java
final boolean handled;
...
if (child == null) {
    handled = super.dispatchTouchEvent(transformedEvent);
} else {
    ...
    handled = child.dispatchTouchEvent(transformedEvent);
}

...
return handled;
```

当子元素的dispatchTouchEvent方法true，则mFirstTouchTarget会在`addTouchTarget(child, idBitsToAssign)`方法中完成赋值，然后跳出事件分发循环。

如果遍历所有子View都没有被合适地处理，此时ViewGroup就会自己处理点击事件。
```java
// Dispatch to touch targets.
if (mFirstTouchTarget == null) {
    // No touch targets so treat this as an ordinary view.
    handled = dispatchTransformedTouchEvent(ev, canceled, null,
        TouchTarget.ALL_POINTER_IDS);
}
```
在前面的代码中分析过`dispatchTransformedTouchEvent`方法，此处第三个参数传入null，显然会调用`super.dispatchTouchEvent(transformedEvent)`，即View的`dispatchTouchEvent`方法，此时点击事件会传递给View处理。

#### 4.2.3 View的事件处理过程

View对点击事件的处理比较简单。因为View是叶子节点了，它没有子元素，无法向下传递事件，只能自己处理。

下面我们看看`dispatchTouchEvent`方法，同样View的`dispatchTouchEvent`方法也会判断到底要不要执行`onTouchEvent`：
```java
public boolean dispatchTouchEvent(MotionEvent event) {
    ...
    boolean result = false;
    ...

    if (onFilterTouchEventForSecurity(event)) {
        ...
        //noinspection SimplifiableIfStatement
        ListenerInfo li = mListenerInfo;
        if (li != null && li.mOnTouchListener != null
                && (mViewFlags & ENABLED_MASK) == ENABLED
                && li.mOnTouchListener.onTouch(this, event)) {
            result = true;
        }

        if (!result && onTouchEvent(event)) {
            result = true;
        }
    }
    ...

    return result;
}
```
View首先会判断有没有设置OnTouchListener，若有则会先执行OnTouchListener的`onTouch`方法。如果`onTouch`方法返回true，那么`onTouchEvent`不会被调用。因此OnTouchListener的优先级会比`onTouchEvent`要高。此外，若想`OnTouchListener`生效，View还要处于ENABLED状态。

接着看看`onTouchEvent`方法，该方法也有点长，但是非常好理解，我们分为几段来阅读。

1. 即使View处于DISABLED状态，只要其是可点击或者可长按，就能消耗事件。

    ```java
    if ((viewFlags & ENABLED_MASK) == DISABLED) {
       if (action == MotionEvent.ACTION_UP && (mPrivateFlags & PFLAG_PRESSED) != 0) {
           setPressed(false);
       }
       // A disabled view that is clickable still consumes the touch
       // events, it just doesn't respond to them.
       return (((viewFlags & CLICKABLE) == CLICKABLE
               || (viewFlags & LONG_CLICKABLE) == LONG_CLICKABLE)
               || (viewFlags & CONTEXT_CLICKABLE) == CONTEXT_CLICKABLE);
    }
    ```

2. 如果有TouchDelegat，则调用TouchDelegat的onTouchEvent。若代理消耗了事件，则不再继续执行。

     ```java
     if (mTouchDelegate != null) {
         if (mTouchDelegate.onTouchEvent(event)) {
             return true;
         }
     }
     ```

3. 当View处于可点击或者可长按时，就会消耗事件，即`onTouchEvent`返回true。点击事件发生在`performClick`方法中。PerformClick是一个封装`performClick`在`run`方法的Runnable类。

    ```java
    if (((viewFlags & CLICKABLE) == CLICKABLE ||
            (viewFlags & LONG_CLICKABLE) == LONG_CLICKABLE) ||
            (viewFlags & CONTEXT_CLICKABLE) == CONTEXT_CLICKABLE) {
        switch (action) {
            case MotionEvent.ACTION_UP:
                    ...
                    if (!mHasPerformedLongPress && !mIgnoreNextUpEvent) {
                        ...
                        if (!focusTaken) {
                            // Use a Runnable and post this rather than calling
                            // performClick directly. This lets other visual state
                            // of the view update before click actions start.
                            if (mPerformClick == null) {
                                mPerformClick = new PerformClick();
                            }
                            if (!post(mPerformClick)) {
                                performClick();
                            }
                        }
                    }
                ...
                break;
            ...
        }
    
        return true;
    }
    ```

4. 点击事件的执行过程：View首先会判断有没有设置OnClickListener，若有则会先执行OnClickListener的`onClick`方法，并返回true；否则返回false。

    ```java
    public boolean performClick() {
        final boolean result;
        final ListenerInfo li = mListenerInfo;
        if (li != null && li.mOnClickListener != null) {
            playSoundEffect(SoundEffectConstants.CLICK);
            li.mOnClickListener.onClick(this);
            result = true;
        } else {
            result = false;
        }
    
        ...
        return result;
    }
    ```

    View的LONG_CLICKABLE属性默认为false；而CLICKABLE属性和具体的View有关，即可点击的View比如Button其属性为true，不可点击的比如TextView则为false。`setOnClickListener`以及`setOnLongClickListener`会将View的对应属性设为true。
    ```java
    public void setOnClickListener(@Nullable OnClickListener l) {
        if (!isClickable()) {
            setClickable(true);
        }
        getListenerInfo().mOnClickListener = l;
    }
    
    public void setOnLongClickListener(@Nullable OnLongClickListener l)  {
        if (!isLongClickable()) {
            setLongClickable(true);
        }
        getListenerInfo().mOnLongClickListener = l;
    }
    ```

小结一下，View的事件分发机制流程图可以小结如下：

![View事件传递流程图](/assets/images/android/view-event-dispatch.png)

### 4.3 事件传递规则的一些结论

1. 一般情况下，一个事件序列只能被一个View拦截且消耗。一旦某个View开始拦截，那么这个事件序列都只能由它来处理，且其`onInterceptTouchEvent`方法不会在调用，但其parent的`onInterceptTouchEvent`会调用，这给滑动冲突的控制逻辑提供了机会。*mFirstTouchTarget*
2. 某个View一旦开始处理事件，如果它不消耗ACTION_DOWN（既`onTouchEvent`方法返回了false），那么同一序列中其他事件不会交给它处理，事件将重新交给它的父元素去处理，即父元素的`onTouchEvent`会被调用。*mFirstTouchTarget*
3. 如果View只消耗ACTION_DOWN，同时当前View可以持续收到后续事件。最后除了ACTION_DOWN之外的点击事件会传递给Activity处理。*对于ACTION_DOWN后面的事件，mFirstTouchTarget收到了事件，但是其不消耗，也就是返回false，这样Activity就会调用`onTouchEvent`方法*
4. ViewGroup默认不拦截事件。
5. View没有`onInterceptTouchEvent`方法，事件一旦传递给View，其`onTouchEvent`方法就会调用
6. View的`onTouchEvent`默认会消耗事件，除非它是不可点击、不可长按的。View的longClickable默认为false，clickable要看View的类型。
7. View的enable属性不影响onTouchEvent的返回值。
8. onClick事件发生的前提是当前View必须是可点击的，并且要收到down和up事件。
9. 事件传递总是先传递给父布局，然后在传给子布局。子布局可以通过`requestDisallowInterceptTouchEvent`来干预父布局的事件分发，ACTION_DOWN除外。
10. 在子View处理了ACTION_DOWN之后，如果在父View中拦截ACTION_UP或ACTION_MOVE，在第一次父View拦截消息的瞬间，子视图会收到ACTION_CANCEL事件，同时子View不再接受后续消息。

### 4.4 一句话概括

当触摸事件发生时，首先Activity将点击事件传递给Window，再从Window传递给DecorView这个顶层View。  
触摸事件会最先到达顶层View的`dispatchTouchEvent`，然后由该方法进行分发，如果`dispatchTouchEvent`返回true，则整个事件将会被销毁；如果`dispatchTouchEvent`返回false，则交给上层view的`onTouchEvent`方法来开始处理这个事件。  
如果`interceptTouchEvent`返回true，也就是拦截掉了，则交给自身的`onTouchEvent`来处理；如果`interceptTouchEvent`返回false，那么事件将继续传递给子View，由子View的`dispatchTouchEvent`再来开始这个事件的分发。如果子View也是一个ViewGroup，那么事件会一直传递下去。  
如果事件传递到某一层的子View的`dispatchTouchEvent`上，那么就会调用`onTouchEvent`进行处理，如果这个方法返回了false，那么这个事件会从这个View开始往上传递，都是`onTouchEvent`来接收，直到`onTouchEvent`返回true为止。而如果传递到最顶层View的`onTouchEvent`也返回false的话，这个事件就会消失。

### 4.5 View的点击事件是如何触发的

View的点击事件是如何触发的，一切都在`View.onTouchEvent`方法里面。其实很简单，只要手指 **按下、移动、抬起** 时都在View里面，那么就会触发了。  

我们先看看手指按下时的事件`ACTION_DOWN`：

```java
case MotionEvent.ACTION_DOWN:
    mHasPerformedLongPress = false;

    ...

    // Walk up the hierarchy to determine if we're inside a scrolling container.
    boolean isInScrollingContainer = isInScrollingContainer();

    // For views inside a scrolling container, delay the pressed feedback for
    // a short period in case this is a scroll.
    if (isInScrollingContainer) {
        mPrivateFlags |= PFLAG_PREPRESSED;
        if (mPendingCheckForTap == null) {
            mPendingCheckForTap = new CheckForTap();
        }
        mPendingCheckForTap.x = event.getX();
        mPendingCheckForTap.y = event.getY();
        postDelayed(mPendingCheckForTap, ViewConfiguration.getTapTimeout());
    } else {
        // Not inside a scrolling container, so show the feedback right away
        setPressed(true, x, y);
        checkForLongClick(0, x, y);
    }
    break;
```

由于我们不在一个滑动的View中，所以这里会走19行的else代码块。第21行的`setPressed(true, x, y)`方法中会将View设置为`PFLAG_PRESSED`状态，这意味着View当前处于按下的状态了。  

接着我们看看`ACTION_MOVE`时是如何处理的：

```java
case MotionEvent.ACTION_MOVE:
    drawableHotspotChanged(x, y);

    // Be lenient about moving outside of buttons
    if (!pointInView(x, y, mTouchSlop)) {
        // Outside button
        removeTapCallback();
        if ((mPrivateFlags & PFLAG_PRESSED) != 0) {
            // Remove any future long press/tap checks
            removeLongPressCallback();

            setPressed(false);
        }
    }
    break;
```

在第5行中会判断Point(x, y)是否在View范围中，如果不在了，则清除`PFLAG_PRESSED`状态。注意这里只有清除的方法，没有设置的方法。因此，一旦手指移出了View后，再次移进来也不会设置标志位了，因此也不能触发点击事件了。  
此外，需要提一下这里判断Point(x, y)是否在View范围中的方法`pointInView(x, y, mTouchSlop)`。`mTouchSlop`的取值为`ViewConfiguration.get(context).getScaledTouchSlop()`，这在[1.2节--MotionEvent](#12-motionevent)中提到过。在自定义View需要处理点击事件时，常常需要该值来参与点击事件的判定。`pointInView`方法中使用了该值来扩大View的判定范围，代码如下：

```java
public boolean pointInView(float localX, float localY, float slop) {
    return localX >= -slop && localY >= -slop && localX < ((mRight - mLeft) + slop) &&
            localY < ((mBottom - mTop) + slop);
}
```

最后就是手指松开时的`ACTION_UP`方法了，这段代码在上面探讨View的事件传递机制时说到过，这里再简单贴一下代码：

```java
case MotionEvent.ACTION_UP:
    boolean prepressed = (mPrivateFlags & PFLAG_PREPRESSED) != 0;
    if ((mPrivateFlags & PFLAG_PRESSED) != 0 || prepressed) {
        // take focus if we don't have it already and we should in
        // touch mode.
        boolean focusTaken = false;
        if (isFocusable() && isFocusableInTouchMode() && !isFocused()) {
            focusTaken = requestFocus();
        }

        ...

        if (!mHasPerformedLongPress && !mIgnoreNextUpEvent) {
            // This is a tap, so remove the longpress check
            removeLongPressCallback();

            // Only perform take click actions if we were in the pressed state
            if (!focusTaken) {
                // Use a Runnable and post this rather than calling
                // performClick directly. This lets other visual state
                // of the view update before click actions start.
                if (mPerformClick == null) {
                    mPerformClick = new PerformClick();
                }
                if (!post(mPerformClick)) {
                    performClick();
                }
            }
        }
        ...
    }
    mIgnoreNextUpEvent = false;
    break;
```

首先第一句会获取`PFLAG_PREPRESSED`状态，这个状态在`ACTION_DOWN`时，如果在一个滑动的View中才会被临时设置；100毫秒后会取消该状态，并重新设置`PFLAG_PRESSED`状态。此外会在if条件中会判断`PFLAG_PRESSED`状态，如果两个状态有一个设置了，才会进行里面的代码执行点击事件。  
在第13行if中，`mIgnoreNextUpEvent`在触摸屏上一般都是false，这个标志位是给其他设备使用的。因此，只要长按事件没有发生就会执行里面的代码，触发点击事件。

### 4.6 View的长按事件是如何触发的

View的长按事件还是在`onTouchEvent`中，不同的是，由于长按事件有一个触发时间（500ms），所以里面通过`postDelayed`一个Runnable，在Runnable里面进行处理的。  

相关代码如下：

```java
case MotionEvent.ACTION_DOWN:
    mHasPerformedLongPress = false;
    ...
    // Walk up the hierarchy to determine if we're inside a scrolling container.
    boolean isInScrollingContainer = isInScrollingContainer();

    // For views inside a scrolling container, delay the pressed feedback for
    // a short period in case this is a scroll.
    if (isInScrollingContainer) {
        mPrivateFlags |= PFLAG_PREPRESSED;
        if (mPendingCheckForTap == null) {
            mPendingCheckForTap = new CheckForTap();
        }
        mPendingCheckForTap.x = event.getX();
        mPendingCheckForTap.y = event.getY();
        postDelayed(mPendingCheckForTap, ViewConfiguration.getTapTimeout());
    } else {
        // Not inside a scrolling container, so show the feedback right away
        setPressed(true, x, y);
        checkForLongClick(0, x, y);
    }
    break;

case MotionEvent.ACTION_MOVE:
    drawableHotspotChanged(x, y);

    // Be lenient about moving outside of buttons
    if (!pointInView(x, y, mTouchSlop)) {
        // Outside button
        removeTapCallback();
        if ((mPrivateFlags & PFLAG_PRESSED) != 0) {
            // Remove any future long press/tap checks
            removeLongPressCallback();

            setPressed(false);
        }
    }
    break;
```

在`ACTION_DOWN`时，会调用`checkForLongClick`方法（第20行），里面会`postDelay`触发长按事件；当手指移动出View的边界时，会`removeLongPressCallback()`取消长按操作（第33行）。

所以关键代码就在里面了，我们先看看`checkForLongClick`方法的相关代码：

```java
private void checkForLongClick(int delayOffset, float x, float y) {
    if ((mViewFlags & LONG_CLICKABLE) == LONG_CLICKABLE) {
        mHasPerformedLongPress = false;

        if (mPendingCheckForLongPress == null) {
            mPendingCheckForLongPress = new CheckForLongPress();
        }
        mPendingCheckForLongPress.setAnchor(x, y);
        mPendingCheckForLongPress.rememberWindowAttachCount();
        postDelayed(mPendingCheckForLongPress,
                ViewConfiguration.getLongPressTimeout() - delayOffset);
    }
}
```

首先是检查是否允许长按，如果允许则继续执行。在里面会初始化一个长按的Runnable，并记录点击位置，然后`postDelay`出去。`ViewConfiguration.getLongPressTimeout()`获取的值为500ms。

长按的Runnable `CheckForLongPress`的代码如下，主要就是调用了`performLongClick`方法：

```java
private final class CheckForLongPress implements Runnable {
    private int mOriginalWindowAttachCount;
    private float mX;
    private float mY;

    @Override
    public void run() {
        if (isPressed() && (mParent != null)
                && mOriginalWindowAttachCount == mWindowAttachCount) {
            if (performLongClick(mX, mY)) {
                mHasPerformedLongPress = true;
            }
        }
    }

    public void setAnchor(float x, float y) {
        mX = x;
        mY = y;
    }

    public void rememberWindowAttachCount() {
        mOriginalWindowAttachCount = mWindowAttachCount;
    }
}
```

接着跟踪一下`performLongClick`方法：

```java
public boolean performLongClick(float x, float y) {
    mLongClickX = x;
    mLongClickY = y;
    final boolean handled = performLongClick();
    mLongClickX = Float.NaN;
    mLongClickY = Float.NaN;
    return handled;
}

public boolean performLongClick() {
    return performLongClickInternal(mLongClickX, mLongClickY);
}

private boolean performLongClickInternal(float x, float y) {
    sendAccessibilityEvent(AccessibilityEvent.TYPE_VIEW_LONG_CLICKED);

    boolean handled = false;
    final ListenerInfo li = mListenerInfo;
    if (li != null && li.mOnLongClickListener != null) {
        handled = li.mOnLongClickListener.onLongClick(View.this);
    }
    if (!handled) {
        final boolean isAnchored = !Float.isNaN(x) && !Float.isNaN(y);
        handled = isAnchored ? showContextMenu(x, y) : showContextMenu();
    }
    if (handled) {
        performHapticFeedback(HapticFeedbackConstants.LONG_PRESS);
    }
    return handled;
}
```

显然处理的方法是`performLongClickInternal`。长按事件的处理顺序为：

1. 首先如果有设置长按事件，调用长按事件；
2. 如果事件没有处理，则尝试展示上下文菜单ContextMenu。

最后，如果上面有一位成功处理了事件(返回true)，那么调用`performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)`触发震动反馈。这也就是为什么在View的`OnLongClickListener`中返回true，会有震动反馈的原因了。

最后看一下，当手指移动出View的边界时，`removeLongPressCallback()`方法调用了`removeCallbacks`方法移除了`mPendingCheckForLongPress`，因此长按操作就取消了：

```java
private void removeLongPressCallback() {
    if (mPendingCheckForLongPress != null) {
        removeCallbacks(mPendingCheckForLongPress);
    }
}
```

## 5 View的滑动冲突处理

### 5.1 常见的滑动冲突场景

常见的滑动冲突场景可以分一下三类：

- 外部滑动方向与内部滑动方向不一致（左图）
- 外部滑动方向与内部滑动方向一致（右图）
- 上面两种情况的嵌套

![两种基本滑动冲突](/assets/images/android/两种基本滑动冲突.png)

场景1主要是ViewPager+Fragment，Fragment里面往往是一个ListView。但是ViewPager内部已经处理了这种滑动冲突，因此采用ViewPager时我们无需关系。但如果采用ScrollView就需要手动处理了。我们可以根据在水平方向和竖直方向移动的大小来判断用户往哪个方向移动。
> 在ViewPager的一页中嵌套一个相同方向的ViewPager也无需处理滑动冲突。比如网易云的主界面。

场景2就比较复杂了，需要根据具体的逻辑来判断。一个典型的场景是电商应用商品详情页，滑到底部继续滑就可以从购买页面进入商品详情页面。

第二种情况也有可能是一个嵌套滑动问题，比如CoordinatorLayout效果，这种情况下需要使用[NestedScrolling机制](/android/other/nestedscrolling/)进行解决了。

### 5.2 滑动冲突的解决方式

根据事件分发的原理，有两种处理方式：

1. 重写父容器`onInterceptTouchEvent`方法的**外部拦截法**
2. 重写子元素`dispatchTouchEvent`和父容器`onInterceptTouchEvent`方法的**内部拦截法**

显然外部拦截法实现起来更方便。

> 这里的内外相对于可滑动的View而言。

#### 5.2.1 外部拦截法

外部拦截法的`onInterceptTouchEvent`方法如下所示：

```java
int x, y, lastX, lastY;
@Override
public boolean onInterceptTouchEvent(MotionEvent ev) {
    boolean intercepted = false;
    x = (int) ev.getX();
    y = (int) ev.getY();

    switch (ev.getAction()) {
        case MotionEvent.ACTION_DOWN:
        case MotionEvent.ACTION_UP:
            intercepted = false;
            break;

        case MotionEvent.ACTION_MOVE:
            intercepted = shouldParentIntercept();
            break;
    }

    lastX = x;
    lastY = y;
    return intercepted;
}

private boolean shouldParentIntercept() {
    // TODO :
    return true;
}
```

- 对于ACTION_DOWN，必须返回false。因此一旦返回true，父容器就会自己处理该点击事件，这将导致子View接收不到点击事件。  
- 对于ACTION_MOVE，如果父布局需要拦截，返回true，否则false。  
- 最后ACTION_UP，必须返回false。否则子元素无法出发onClick事件。

#### 5.2.2 内部拦截法

内部拦截法指父容器不拦截任何事件，所有事件都传递给子View。如果子View需要，则消耗掉；否则由父容器处理。这里需要与父容器的`requestDisallowInterceptTouchEvent`配合。

子元素的`dispatchTouchEvent()`：

```java
int x, y, lastX, lastY;
@Override
public boolean dispatchTouchEvent(MotionEvent ev) {
    x = (int) ev.getX();
    y = (int) ev.getY();

    switch (ev.getAction()) {
        case MotionEvent.ACTION_DOWN:
            getParent().requestDisallowInterceptTouchEvent(true);
            break;

        case MotionEvent.ACTION_MOVE:
            if (shouldParentIntercept()) {
                getParent().requestDisallowInterceptTouchEvent(false);
            }
            break;

        case MotionEvent.ACTION_UP:
            break;
    }

    lastX = x;
    lastY = y;

    return super.dispatchTouchEvent(ev);
}

private boolean shouldParentIntercept() {
    // TODO :
    return true;
}
```

父容器的`onInterceptTouchEvent`（一般的父容器都不会拦截事件，不需要特别注意）：

```java
@Override
public boolean onInterceptTouchEvent(MotionEvent ev) {
    return ev.getAction() != MotionEvent.ACTION_DOWN;
}
```

父布局不能拦截ACTION_DOWN，因为这样的话所有的事件无法传递到子View中。一个触摸事件由ACTION_DOWN开始，一旦有某个View处理了该事件，mFirstTouchTarget就被赋值了，后续事件全部会交给其处理。
