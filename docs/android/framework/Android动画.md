---
title: "Android动画"
---

Android动画可以分为两种：View动画、属性动画。  
View动画也分为两种：补间(Tween)动画以及帧动画。  

**补间动画** 通过对场景里的对象做图像变换（Translate、Scale、Rotate、Alpha）从而产生动画效果。  
**帧动画通** 过顺序播放一系列图像而产生动画效果，如果图片过多过大就容易OOM。  
**属性动画** 通过动态改变对象的属性从而达到动画效果，属性动画为Android 3.0（API 11）的新特性。  

## 1. View动画
View动画的作用对象是View，它支持四种动画效果：平移动画、缩放动画、旋转动画以及透明度动画。

### 1.1 View动画的介绍、使用、监听器

**View动画的介绍**

View动画的四种变换效果对应着Animation的四个子类：TranslateAnimation、ScaleAnimation、RotateAnimation和AlphaAnimation。这四种动画既可以通过XML来定义也可以通过代码来定义，对于View动画，建议采用XML方式来定义，这样可读性更好。

View动画XML文件存放位置：

- res/anim/filename.xml  

使用方式：  

- Java文件：R.anim.filename
- XML文件：@[package:]anim/filename  

语法：  

```xml
<?xml version="1.0" encoding="utf-8"?>
<set xmlns:android="http://schemas.android.com/apk/res/android"
    android:interpolator="@[package:]anim/interpolator_resource"
    android:shareInterpolator=["true" | "false"] >
    <alpha
        android:fromAlpha="float"
        android:toAlpha="float" />
    <scale
        android:fromXScale="float"
        android:toXScale="float"
        android:fromYScale="float"
        android:toYScale="float"
        android:pivotX="float"
        android:pivotY="float" />
    <translate
        android:fromXDelta="float"
        android:toXDelta="float"
        android:fromYDelta="float"
        android:toYDelta="float" />
    <rotate
        android:fromDegrees="float"
        android:toDegrees="float"
        android:pivotX="float"
        android:pivotY="float" />
    <set>
        ...
    </set>
</set>
```

- &lt;set&gt;  
  表示动画合集，对应AnimationSet类，它可以包含若干个动画，也可以包含其他&lt;set&gt;节点
    - android:interpolator  
      插值器资源。该属性可以不指定，默认从平台获取，其值是`@android:anim/accelerate_decelerate_interpolator`。关于插值器的概念会在本章后续讲解。
    - android:shareInterpolator  
      *Boolean*。集合中动画是否公用插值器。
- &lt;alpha>  
  表示透明度，对应AlphaAnimation，它是一个淡入淡出的动画效果。
    - android:fromAlpha  
      *Float*。透明度的起始值
    - android:toAlpha  
      *Float*。透明度的结束值。
- &lt;scale>  
  表示缩放动画，对应ScaleAnimation。我们可以使用`pivotX`和`pivotY`来特别申明缩放的中心点。
    - android:fromXScale  
      *Float*。水平方向缩放的起始值。
    - android:toXScale  
      *Float*。水平方向缩放的结束值。
    - android:fromYScale  
      *Float*。竖直方向缩放的起始值。
    - android:toYScale  
      *Float*。竖直方向缩放的起始值。
    - android:pivotX  
      *Float*。缩放中心点的x坐标
    - android:pivotY  
      *Float*。缩放中心点的y坐标
- &lt;translate>  
  表示平移动画，对应TranslateAnimation。以下属性支持三种格式：  
    -100\~100的数字，以"%"结尾，这表示相对于自己的百分比；  
    -100\~100的数字，以"%p"结尾，这表示相对于父布局的百分比；  
    没有后缀的数字，表示这是一个绝对值。  
**`pivotX`和`pivotY`也支持这些属性。**
    - android:fromXDelta  
      *Float或者百分比*。x的起始值
    - android:toXDelta  
      *Float或者百分比*。x的终止值
    - android:fromYDelta  
      *Float或者百分比*。y的起始值
    - android:toYDelta  
      *Float或者百分比*。y的终止值
- &lt;rotate>表示旋转动画，对应RotateAnimation。
    - android:fromDegrees  
      *Float*。旋转开始的角度
    - android:toDegrees  
      *Float*。旋转结束的角度
    - android:pivotX  
      *Float*。缩放中心点的x坐标
    - android:pivotY  
      *Float*。缩放中心点的y坐标

View动画除了以上属性外，还有一些常用的属性：

- android:duration  
  动画持续时间
- android:fillAfter  
  动画结束以后View是否停留在结束为止。

下面是实际例子：
```xml
<set xmlns:android="http://schemas.android.com/apk/res/android"
    android:shareInterpolator="false">
    <scale
        android:interpolator="@android:anim/accelerate_decelerate_interpolator"
        android:fromXScale="1.0"
        android:toXScale="1.4"
        android:fromYScale="1.0"
        android:toYScale="0.6"
        android:pivotX="50%"
        android:pivotY="50%"
        android:fillAfter="false"
        android:duration="700" />
    <set
        android:interpolator="@android:anim/accelerate_interpolator"
        android:startOffset="700">
        <scale
            android:fromXScale="1.4"
            android:toXScale="0.0"
            android:fromYScale="0.6"
            android:toYScale="0.0"
            android:pivotX="50%"
            android:pivotY="50%"
            android:duration="400" />
        <rotate
            android:fromDegrees="0"
            android:toDegrees="-45"
            android:toYScale="0.0"
            android:pivotX="50%"
            android:pivotY="50%"
            android:duration="400" />
    </set>
</set>
```

**View动画的使用**

在Java代码中可以通过如下方式使用：
```java
ImageView image = (ImageView) findViewById(R.id.image);
Animation hyperspaceJump = AnimationUtils.loadAnimation(this, R.anim.hyperspace_jump);
image.startAnimation(hyperspaceJump);
```

除了在XML中定义之外，还可以通过代码来定义动画：
```java
AlphaAnimation alphaAnimation = new AlphaAnimation(0.0f, 1.0f);
alphaAnimation.setDuration(300);
image.startAnimation(alphaAnimation);
```

**View动画的监听器**

Animation可以设置`AnimationListener`监听器：
```java
public static interface AnimationListener {
    void onAnimationStart(Animation animation);
    void onAnimationEnd(Animation animation);
    void onAnimationRepeat(Animation animation);
}
```

### 1.2 自定义View动画
自定义动画只需要继承Animation这个抽象类，然后重写其`initialize`和`applyTransformation`方法即可，在`initialize`方法中做一些初始化工作，在`applyTransformation`方法中进行相应的矩阵转换，很多时候需要采用`android.graphics.Camera`来简化矩阵变换的过程。具体可以参考ApiDemos里面的Rotate3dAnimation.java
```java
public class Rotate3dAnimation extends Animation {
    private final float mFromDegrees;
    private final float mToDegrees;
    private final float mCenterX;
    private final float mCenterY;
    private final float mDepthZ;
    private final boolean mReverse;
    private Camera mCamera;

    /**
     * Creates a new 3D rotation on the Y axis. The rotation is defined by its
     * start angle and its end angle. Both angles are in degrees. The rotation
     * is performed around a center point on the 2D space, definied by a pair of
     * X and Y coordinates, called centerX and centerY. When the animation
     * starts, a translation on the Z axis (depth) is performed. The length of
     * the translation can be specified, as well as whether the translation
     * should be reversed in time.
     *
     * @param fromDegrees
     *            the start angle of the 3D rotation
     * @param toDegrees
     *            the end angle of the 3D rotation
     * @param centerX
     *            the X center of the 3D rotation
     * @param centerY
     *            the Y center of the 3D rotation
     * @param reverse
     *            true if the translation should be reversed, false otherwise
     */
    public Rotate3dAnimation(float fromDegrees, float toDegrees, float centerX, float centerY, float depthZ,
            boolean reverse) {
        mFromDegrees = fromDegrees;
        mToDegrees = toDegrees;
        mCenterX = centerX;
        mCenterY = centerY;
        mDepthZ = depthZ;
        mReverse = reverse;
    }

    @Override
    public void initialize(int width, int height, int parentWidth, int parentHeight) {
        super.initialize(width, height, parentWidth, parentHeight);
        mCamera = new Camera();
    }

    @Override
    protected void applyTransformation(float interpolatedTime, Transformation t) {
        final float fromDegrees = mFromDegrees;
        float degrees = fromDegrees + ((mToDegrees - fromDegrees) * interpolatedTime);

        final float centerX = mCenterX;
        final float centerY = mCenterY;

        final Camera camera = mCamera;

        final Matrix matrix = t.getMatrix();

        camera.save();

        if (mReverse) {
            camera.translate(0.0f, 0.0f, mDepthZ * interpolatedTime);
        } else {
            camera.translate(0.0f, 0.0f, mDepthZ * (1.0f - interpolatedTime));
        }
        camera.rotateY(degrees);
        camera.getMatrix(matrix);
        camera.restore();

        matrix.preTranslate(-centerX, -centerY);
        matrix.postTranslate(centerX, centerY);
    }
}
```

### 1.3 帧动画

帧动画对应AnimationDrawable。  

帧动画XML文件存放位置：

- res/drawable/filename.xml

使用方式：

- Java文件：R. drawable.filename
- XML文件：@[package:] drawable/filename

语法：
```xml
<?xml version="1.0" encoding="utf-8"?>
<animation-list xmlns:android="http://schemas.android.com/apk/res/android"
    android:oneshot=["true" | "false"] >
    <item
        android:drawable="@[package:]drawable/drawable_resource_name"
        android:duration="integer" />
</animation-list>
```

- &lt;animation-list>  
  此节点必须是根节点，它可以包含一或多个&lt;item>节点。
    - android:oneshot  
      *Boolean*。true表示只播放一次，false表示循环播放。
- &lt;item>  
  动画的一帧。
    - android:drawable  
    *Drawable资源*。
    - android:duration  
    *Drawable资源*。该帧的持续时间

在Java代码中可以通过如下方式使用：

```java
ImageView rocketImage = (ImageView) findViewById(R.id.rocket_image);
rocketImage.setBackgroundResource(R.drawable.rocket_thrust);

rocketAnimation = (AnimationDrawable) rocketImage.getBackground();
rocketAnimation.start();
```

帧动画的资源如果过多过大容易导致OOM。  
> 由于Android中帧动画实在是占用内存过大，而且本人用Glide加载也遇到过Gif错乱的情况。最后通过隔一段时间给ImageView设置src来完成效果。这种方式不占内存，也不依赖第三方库，棒极。

### 1.4 View动画的特殊使用场景

View动画除了给控件使用之外，还可以在ViewGroup中控制子元素的出场顺序，在Activity中可以实现不同Activity之间的切换效果等。

#### 1.4.1 LayoutAnimation

LayoutAnimation作用于ViewGroup，为ViewGroup指定一个动画，这样其子元素出场时都会具有这种效果，这种效果常用于ListView、GridView等上。  

LayoutAnimation的使用方法遵循以下几步：  

1. 为item写出场动画anim_item  
2. 将出场动画包装成LayoutAnimation  

    ```xml
    <layoutAnimation
        xmlns:android="http://schemas.android.com/apk/res/android"
        android:delay="0.5"
        android:animationOrder="normal"
        android:animation="@anim/anim_item" />
    ```
    
    - android:delay  
      *Float*。子元素开始动画的时间延迟，如果子元素入场动画为300ms，那么0.5表示每个子元素都需要延迟150ms才开始播放入场动画。
    - android:animationOrder  
      表示子元素动画的顺序，有normal，reverse和random。reserve表示后面的子元素先开始播放入场动画。

3. 为ViewGroup指定android:layoutAnimation属性。

除了在XML中定义之外，还可以通过LayoutAnimationController来实现：
```java
Animation animation = AnimationUtils.loadAnimation(this, R.anim.anim_item);
LayoutAnimationController controller = new LayoutAnimationController(animation);
controller.setDelay(0.5);
controller.setOrder(LayoutAnimationController.ORDER_NORMAL);
listView.setLayoutAnimation(controller);
```

#### 1.4.2 Activity的切换效果
Activity的切换效果通过调用`overridePendingTransition(int enterAnim, int exitAnim)`来实现。需要注意，此方法必须位于`startActivity`或者`finish`的后面。
对于Fragment来说，可以通过`FragmentTransaction#setCustomAnimations`来添加切换动画，或者通过`FragmentTransaction#setTransition`使用预置的几种效果。

### 1.5 CircularReveal圆形显示动画

当需要显示或隐藏一组UI元素时，显示动画可为用户提供视觉连续性。`ViewAnimationUtils.createCircularReveal()`方法使我们可以设置剪贴的圆形动画以显示或隐藏视图。此动画在`ViewAnimationUtils`类中提供，该类适用于Android 5.0 (API Level 21) 及更高版本。

例子如下：

```kotlin
// previously invisible view
val myView: View = findViewById(R.id.my_view)

// Check if the runtime version is at least Lollipop
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
    // get the center for the clipping circle
    val cx = myView.width / 2
    val cy = myView.height / 2

    // get the final radius for the clipping circle
    val finalRadius = Math.hypot(cx.toDouble(), cy.toDouble()).toFloat()

    // create the animator for this view (the start radius is zero)
    val anim = ViewAnimationUtils.createCircularReveal(myView, cx, cy, 0f, finalRadius)
    // make the view visible and start the animation
    myView.visibility = View.VISIBLE
    anim.start()
} else {
    // set the view to invisible without a circular reveal animation below Lollipop
    myView.visibility = View.INVISIBLE
}
```

`ViewAnimationUtils.createCircularReveal()`动画需要五个参数。  
第一个参数是要隐藏或显示在屏幕上的View。  
接下来的两个参数是剪切圆心的x和y坐标。通常，这将是视图的中心，但您也可以使用用户触摸的点，以便动画从他们选择的位置开始。  
第四个参数是剪切圆的起始半径。在上面的示例中，初始半径设置为0，因此要显示的View将被圆圈隐藏。  
最后一个参数是圆的最终半径。显示视图时，请确保最终半径大于View本身，以便在动画完成之前完全显示View。

下面的代码将隐藏之前显示的View：

```kotlin
// previously visible view
val myView: View = findViewById(R.id.my_view)

// Check if the runtime version is at least Lollipop
if (Build.VERSION.SDK_INT == Build.VERSION_CODES.LOLLIPOP) {
    // get the center for the clipping circle
    val cx = myView.width / 2
    val cy = myView.height / 2

    // get the initial radius for the clipping circle
    val initialRadius = Math.hypot(cx.toDouble(), cy.toDouble()).toFloat()

    // create the animation (the final radius is zero)
    val anim = ViewAnimationUtils.createCircularReveal(myView, cx, cy, initialRadius, 0f)

    // make the view invisible when the animation is done
    anim.addListener(object : AnimatorListenerAdapter() {

        override fun onAnimationEnd(animation: Animator) {
            super.onAnimationEnd(animation)
            myView.visibility = View.INVISIBLE
        }
    })

    // start the animation
    anim.start()
} else {
    // set the view to visible without a circular reveal animation below Lollipop
    myView.visibility = View.VISIBLE
}
```

在这种情况下，剪切圆的初始半径设置为与View一样大，因此在动画开始之前View将可见。最终半径设置为0，因此在动画结束时将隐藏View。向动画添加监听器非常重要，这样在动画完成时可以将视图的可见性设置为`INVISIBLE`。

## 2 属性动画

属性动画是Android 3.0（API 11）之后加入的特性，和View动画不同，它对作用对象进行了扩展，属性动画可以对任何对象做动画，甚至可以没有对象。属性动画中有ValueAnimator、ObjectAnimator和AnimatorSet等概念，它针对的对象的属性，所以通过他们可以实现绚丽的动画。建议在代码中使用属性动画，因此这样我们可以灵活的设定初始值、终止值。

### 2.1 使用属性动画

属性动画可以对任何对象的属性进行动画而不仅限于View，动画默认持续时间300ms，默认帧率10ms/帧。  
属性动画的几个常用动画类是ValueAnimator、ObjectAnimator和AnimatorSet，其中ObjectAnimator继承至ValueAnimator，AnimatorSet是动画合集。

属性动画的XML定义：

属性动画XML文件存放位置：

- `res/animator/filename.xml`

使用方式：

- Java文件：`R.animator.filename`
- XML文件：`@[package:]animator/filename`

语法：

```xml
<set
  android:ordering=["together" | "sequentially"]>

    <objectAnimator
        android:propertyName="string"
        android:duration="int"
        android:valueFrom="float | int | color"
        android:valueTo="float | int | color"
        android:startOffset="int"
        android:repeatCount="int"
        android:repeatMode=["repeat" | "reverse"]
        android:valueType=["intType" | "floatType"]/>

    <animator
        android:duration="int"
        android:valueFrom="float | int | color"
        android:valueTo="float | int | color"
        android:startOffset="int"
        android:repeatCount="int"
        android:repeatMode=["repeat" | "reverse"]
        android:valueType=["intType" | "floatType"]/>

    <set>
        ...
    </set>
</set>
```

- &lt;set>  
表示动画合集，对应AnimatorSet类，它可以包含若干个动画，也可以包含其他&lt;set>节点
    - android:ordering  
      `sequentially`按照顺序依次播放  
      `together`默认值，同时播放
- &lt;objectAnimator>  
对应ObjectAnimator
    - android:propertyName  
      属性动画作用对象的属性名称，比如alpha等
    - android:duration  
      动画持续时间
    - android:valueFrom  
      属性的起始值
    - android:valueTo  
      属性的终止值
    - android:startOffset  
      动画的延迟时间
    - android:repeatCount  
      动画重复次数，-1表示无限循环，1表示重复1次（也就是一共播放两次），默认0
    - android:repeatMode  
      动画重复模式repeat，reverse两个值可选。reverse每一遍的播放方向都会与上一次相反
    - android:valueType  
      根据属性值，有intType和floatType可选，默认floatType。**如果属性值是color，不需要指定该属性，animation framework会自动处理**

举个例子：
```xml
<set android:ordering="sequentially">
    <set>
        <objectAnimator
            android:propertyName="x"
            android:duration="500"
            android:valueTo="400"
            android:valueType="intType"/>
        <objectAnimator
            android:propertyName="y"
            android:duration="500"
            android:valueTo="300"
            android:valueType="intType"/>
    </set>
    <objectAnimator
        android:propertyName="alpha"
        android:duration="500"
        android:valueTo="1f"/>
</set>
```

在Java中使用

```java
AnimatorSet set = (AnimatorSet) AnimatorInflater.loadAnimator(myContext,
    R.anim.property_animator);
set.setTarget(myObject);
set.start();
```

### 2.2 属性动画的监听器

Animator可以设置两个监听器：`AnimatorListener`监听器、`AnimatorPauseListener`监听器（很少见）和`AnimatorUpdateListener`监听器：
```java
public static interface AnimatorListener {
    void onAnimationStart(Animator animation);
    void onAnimationEnd(Animator animation);
    void onAnimationCancel(Animator animation);
    void onAnimationRepeat(Animator animation);
}

public static interface AnimatorPauseListener {
    void onAnimationPause(Animator animation);
    void onAnimationResume(Animator animation);
}

public static interface AnimatorUpdateListener {
    void onAnimationUpdate(ValueAnimator animation);
}
```
AnimatorUpdateListener的`onAnimationUpdate`的方法在动画的每一帧都会被调用，前面提到过，默认是10ms/帧。

### 2.3 使用ValueAnimator做动画

ValueAnimator允许我们通过指定一组int，float或color来动画化，从而在动画持续时间内对某些类型的值进行动画处理。我们可以通过调用ValueAnimator的工厂方法：`ofInt()`、`ofFloat()`或者`ofObject`来获得ValueAnimator对象：

```java
ValueAnimator animation = ValueAnimator.ofFloat(0f, 100f);
animation.setDuration(1000);
animation.start();
```

在此代码中，当`start()`方法运行时，ValueAnimator将开始计算0到100之间动画的值，其持续时间为1000 ms。

我们还可以通过执行以下操作为 **自定义对象类型进行动画处理**：

```java
ValueAnimator animation = ValueAnimator.ofObject(new MyTypeEvaluator(), startPropertyValue, endPropertyValue);
animation.setDuration(1000);
animation.start();
```

在此代码中，当`start()`方法运行时，ValueAnimator将使用MyTypeEvaluator提供的逻辑持续1000 ms，在`startPropertyValue`和`endPropertyValue`之间开始计算动画值。

我们可以通过向ValueAnimator对象添加`AnimatorUpdateListener`来使用动画值，如以下代码所示：
```java
animation.addUpdateListener(new ValueAnimator.AnimatorUpdateListener() {
    @Override
    public void onAnimationUpdate(ValueAnimator updatedAnimation) {
        // You can use the animated value in a property that uses the
        // same type as the animation. In this case, you can use the
        // float value in the translationX property.
        float animatedValue = (float)updatedAnimation.getAnimatedValue();
        textView.setTranslationX(animatedValue);
    }
});
```
在`onAnimationUpdate()`方法中，我们可以使用`getAnimatedValue()`获取更新的动画值，并在其中一个View的属性中使用它。

### 2.4 使用ObjectAnimator做动画

`ObjectAnimator`是`ValueAnimator`的一个子类（在前面的部分讨论过），它将`ValueAnimator`的估值器和插值器结合起来，使它具有目标对象属性动画化的能力。 这使得任何对象的动画化变得更加简单，我们不再需要实现`ValueAnimator.AnimatorUpdateListener`，因为动画属性会自动更新。

实例化一个`ObjectAnimator`类似于一个`ValueAnimator`，但是我们也可以指定对象、对象的属性以及动画值：
```java
ObjectAnimator animation = ObjectAnimator.ofFloat(textView, "translationX", 100f);
animation.setDuration(1000);
animation.start();
```

为了使ObjectAnimator正确的更新属性，我们必须保证以下几点：

- 正在进行动画的对象属性必须提供有setter方法（in camel case，驼峰命名法）。因此`ObjectAnimator`会在动画期间自动更新属性，它必须能够使用setter方法操作到属性，否则程序会crash。如果object没有set方法，我们有三种选择：
    - 如果有权限的话，给这个类加上setter方法
    - 使用一个包装类（wrapper class）来包装原始对象，间接为其提供set方法
    -  使用ValueAnimator来代替，自己实现属性的改变。
- 如果在ObjectAnimator工厂方法中为`values...`参数只指定一个值，则假定这个值是动画的结束值。 因此，正在动画的对象属性必须具有用于获取动画起始值的getter函数。
- 正在动画的属性的getter（如果需要）和setter方法必须与ObjectAnimator中指定的起始值和结束值是相同的类型。 例如，如果构造以下ObjectAnimator，则必须具有

    ```java
    targetObject.setPropName(float)
    targetObject.getPropName(float)
    
    ObjectAnimator.ofFloat(targetObject, "propName", 1f)
    ```

- 根据要动画的属性或对象，我们可能需要在视图上调用`invalidate()`方法来强制屏幕使用更新的动画值重新绘制。 我们可以在`onAnimationUpdate()`回调中执行此操作。 例如，当Drawable对象重新绘制时，可以对Drawable对象的color属性进行动画化，只会导致屏幕更新。 View上的所有属性setters，如`setAlpha()`和`setTranslationX()`都会invalidate View，因此在使用新值调用这些方法时，不需要invalidate the View。

### 2.5 使用AnimatorSet组合多个动画

下面实例代码选自 [Bouncing Balls](https://developer.android.com/resources/samples/ApiDemos/src/com/example/android/apis/animation/BouncingBalls.html) 例子 (简单修改过)，它播放下面这些动画对象以下面的方式：

1. Plays bounceAnim.
2. Plays squashAnim1, squashAnim2, stretchAnim1, and stretchAnim2 at the same time.
3. Plays bounceBackAnim.
4. Plays fadeAnim.

```java
AnimatorSet bouncer = new AnimatorSet();
bouncer.play(bounceAnim).before(squashAnim1);
bouncer.play(squashAnim1).with(squashAnim2);
bouncer.play(squashAnim1).with(stretchAnim1);
bouncer.play(squashAnim1).with(stretchAnim2);
bouncer.play(bounceBackAnim).after(stretchAnim2);
ValueAnimator fadeAnim = ObjectAnimator.ofFloat(newBall, "alpha", 1f, 0f);
fadeAnim.setDuration(250);
AnimatorSet animatorSet = new AnimatorSet();
animatorSet.play(bouncer).before(fadeAnim);
animatorSet.start();
```

`play(1).before(2)` -> 播放1在2之前 -> 先播1在播2  
`play(1).after(2)` -> 播放1在2之后 -> 先播2在播1

### 2.6 对ViewGroup进行动画

我们可以使用`LayoutTransition`在ViewGroup中对动画布局进行更改。 ViewGroup中的View可以在将View添加到ViewGroup或将其从ViewGroup中删除时或使用VISIBLE，INVISIBLE或GONE调用View的`setVisibility()`方法时，经历出现或者消失的动画。 当添加或删除View时，ViewGroup中的剩余视图也可以动画进入新的位置。我们可以在`LayoutTransition`对象中定义以下动画，通过调用`setAnimator()`并传递具有以下`LayoutTransition`常量的Animator对象：

- APPEARING - 动画运行在容器中的正在出现的item上
- CHANGE_APPEARING - 动画运行在容器中由于新item正在出现导致改变的item上
- DISAPPEARING - 动画运行在容器中的正在消失的item上
- CHANGE_DISAPPEARING - 动画运行在容器中由于新item正在消失导致改变的item上

我们可以为这四种类型的事件以自定义layout transitions的外观的形式来定义自己的自定义动画，或者只是告诉动画系统使用默认动画。

API Demos中的[LayoutAnimations](https://developer.android.com/resources/samples/ApiDemos/src/com/example/android/apis/animation/LayoutAnimations.html)示例显示了如何为layout transitions定义动画，然后在要动画化的View对象上设置动画。

`LayoutAnimationsByDefault`及其相应的`layout_animations_by_default.xml`布局资源文件显示如何启用XML中ViewGroups的默认layout transitions。我们唯一需要做的是为ViewGroup设置`android:animateLayoutchanges`属性为true。将此属性设置为true，动画会自动出现当从ViewGroup添加或删除View，ViewGroup中的其余视图也一样。

```java
<LinearLayout
    android:orientation="vertical"
    android:layout_width="wrap_content"
    android:layout_height="match_parent"
    android:id="@+id/verticalContainer"
    android:animateLayoutChanges="true" />
```

### 2.7 指定关键帧
关键帧（Keyframe）对象由time/value键值对组成，它可以让我们在动画的特定时间定义特定状态。每个关键帧还可以具有自己的插值器，来在之前关键帧的时间与该关键帧的时间之间的时间间隔内控制动画的行为。

要实例化一个关键帧对象，必须使用这些工厂方法中的一个，即`ofInt()`、`ofFloat()`、`ofObject()`来获取适当类型的关键帧。然后调用`ofKeyframe()`工厂方法来获取一个`PropertyValuesHolder`对象。拥有该对象后，我们可以通过将`PropertyValuesHolder`对象和目标对象传递给动画来获取动画。
```java
Keyframe kf0 = Keyframe.ofFloat(0f, 0f);
Keyframe kf1 = Keyframe.ofFloat(.5f, 360f);
Keyframe kf2 = Keyframe.ofFloat(1f, 0f);
PropertyValuesHolder pvhRotation = PropertyValuesHolder.ofKeyframe("rotation", kf0, kf1, kf2);
ObjectAnimator rotationAnim = ObjectAnimator.ofPropertyValuesHolder(target, pvhRotation)
rotationAnim.setDuration(5000ms);
```

### 2.8 使用ViewPropertyAnimator进行动画
`ViewPropertyAnimator`提供了一种简单的方式来使用单个底层的Animator对象并行地对视图的多个属性进行动画化。 它的行为非常类似于`ObjectAnimator`，因为它会修改视图属性的实际值，但在一次动画多个属性时效率更高。 此外，使用`ViewPropertyAnimator`的代码更加简洁易读。 以下代码片段显示了在同时动画View的x和y属性时使用多个ObjectAnimator对象，单个ObjectAnimator和ViewPropertyAnimator的差异。

**Multiple ObjectAnimator objects**
```java
ObjectAnimator animX = ObjectAnimator.ofFloat(myView, "x", 50f);
ObjectAnimator animY = ObjectAnimator.ofFloat(myView, "y", 100f);
AnimatorSet animSetXY = new AnimatorSet();
animSetXY.playTogether(animX, animY);
animSetXY.start();
```
**One ObjectAnimator**
```java
PropertyValuesHolder pvhX = PropertyValuesHolder.ofFloat("x", 50f);
PropertyValuesHolder pvhY = PropertyValuesHolder.ofFloat("y", 100f);
ObjectAnimator.ofPropertyValuesHolder(myView, pvhX, pvyY).start();
```
**ViewPropertyAnimator**
```java
myView.animate().x(50f).y(100f);
```
ViewPropertyAnimator还有`withLayer()`方法，如果Activity或者View是硬件加速的，那么这也是硬件加速；否则效果和LAYER_TYPE_SOFTWARE效果一样。

## 3 理解插值器和估值器
TimeInterpolator中文名为时间插值器，其作用是根据时间流逝的百分比来计算出当前属性值改变的百分比，系统预置的Interploator有：

| Interpolator class | Resource ID |
| ----------------------- | ----------------- |
| AccelerateDecelerateInterpolator | @android:anim/accelerate_decelerate_interpolator |
| AccelerateInterpolator | @android:anim/accelerate_interpolator |
AnticipateInterpolator | @android:anim/anticipate_interpolator |
AnticipateOvershootInterpolator | @android:anim/anticipate_overshoot_interpolator |
BounceInterpolator | @android:anim/bounce_interpolator |
CycleInterpolator |  @android:anim/cycle_interpolator |
| DecelerateInterpolator | @android:anim/decelerate_interpolator |
| LinearInterpolator | @android:anim/linear_interpolator |
| OvershootInterpolator |  @android:anim/overshoot_interpolator |

下图是其数学模型：
![Android插值器数学模型](/assets/images/android/Android插值器数学模型.png)


TypeEvaluator中文翻译为估值器，其作用是根据当前属性改变的百分比来计算改变后的属性值，系统预置的有：

- IntEvaluator 针对整型属性
- FloatEvaluator 针对单精度浮点数属性
- ArgbEvaluator 针对Color属性

自定义插值器和估值器很简单，因为它们都是接口。
自定义插值器需要实现Interpolator或者TimeInterpolator接口，重写`getInterpolation`方法即可：
```java
public interface TimeInterpolator {
    float getInterpolation(float input);
}

public interface Interpolator extends TimeInterpolator {
    // A new interface, TimeInterpolator, was introduced for the new android.animation
    // package. This older Interpolator interface extends TimeInterpolator so that users of
    // the new Animator-based animations can use either the old Interpolator implementations or
    // new classes that implement TimeInterpolator directly.
}
```
自定义估值器需要重新实现TypeEvaluator接口，重写`evaluate`方法：
```java
public interface TypeEvaluator<T> {

    /**
     * This function returns the result of linearly interpolating the start and end values, with
     * <code>fraction</code> representing the proportion between the start and end values. The
     * calculation is a simple parametric calculation: <code>result = x0 + t * (x1 - x0)</code>,
     * where <code>x0</code> is <code>startValue</code>, <code>x1</code> is <code>endValue</code>,
     * and <code>t</code> is <code>fraction</code>.
     *
     * @param fraction   The fraction from the starting to the ending values
     * @param startValue The start value.
     * @param endValue   The end value.
     * @return A linear interpolation between the start and end values, given the
     *         <code>fraction</code> parameter.
     */
    public T evaluate(float fraction, T startValue, T endValue);

}
```

## 4 View动画和属性动画的总结
**View动画系统只能对View对象进行动画**，因此，如果我们想为非View对象设置动画效果，则必须实现自己的代码。**View动画系统对View属性的支持也受到了限制**，因为它仅将View对象的几个方面暴露给动画，例如视图的缩放和旋转，不包括背景颜色。

**View动画系统的另一个缺点是它只修改了View的绘制位置，而不是实际的View本身**。例如，如果您将按钮动画化移动到屏幕上，则按钮正确绘制，但我们可以单击按钮的实际位置不会更改，因此我们必须实现自己的逻辑来处理此问题。

**使用属性动画系统，这些约束被完全删除，我们可以对任何对象（View和非View）的任何属性进行动画处理，并且对象本身实际上进行了修改。**属性动画系统在执行动画的过程中也更为强大。在高层次上，**我们可以为要动画化的属性（如颜色，位置或大小）分配动画，并可以定义动画的各个方面，比如插值和多个动画的同步。**

然而，**View动画系统需要较少的时间来设置，并且需要较少的代码来写入**。如果View动画完成了我们需要执行的所有操作，或者如果现有代码已经按照我们想要的方式工作，则不需要使用属性动画系统。当然，如果出现特殊的用例，在不同情况下使用两种动画系统也可能是有意义的。

下表总结了两者的特点：

|  | View Animation | Property Animation |
| -- | ------------------- | ------------------------- |
| 引入时间 | BASE, API level 1 | HONEYCOMB, API level 11 |
| 包名 | [android.view.animation.Animation](https://developer.android.com/reference/android/view/animation/Animation.html) | [android.animation.Animator](https://developer.android.com/reference/android/animation/Animator.html) |
| xml文件存放位置 | res/anim | res/animator |
| Java代码加载方式 | AnimationUtils.loadAnimation | AnimatorInflater.loadAnimator |
| 动画监听器 | AnimationListener | AnimatorListener、AnimatorUpdateListener |

## 5 属性动画的工作原理
**代码基于Android 7.1.**  

我们先从`ObjectAnimator#start`开始：
```java
@Override
public void start() {
    AnimationHandler.getInstance().autoCancelBasedOn(this);
    if (DBG) {
        Log.d(LOG_TAG, "Anim target, duration: " + getTarget() + ", " + getDuration());
        for (int i = 0; i < mValues.length; ++i) {
            PropertyValuesHolder pvh = mValues[i];
            Log.d(LOG_TAG, "   Values[" + i + "]: " +
                pvh.getPropertyName() + ", " + pvh.mKeyframes.getValue(0) + ", " +
                pvh.mKeyframes.getValue(1));
        }
    }
    super.start();
}
```
这里调用了`AnimationHandler`的`autoCancelBasedOn`方法，此方法又会回调`ObjectAnimator`的`shouldAutoCancel`方法：
```java
// AnimationHandler
void autoCancelBasedOn(ObjectAnimator objectAnimator) {
    for (int i = mAnimationCallbacks.size() - 1; i >= 0; i--) {
        AnimationFrameCallback cb = mAnimationCallbacks.get(i);
        if (cb == null) {
            continue;
        }
        if (objectAnimator.shouldAutoCancel(cb)) {
            ((Animator) mAnimationCallbacks.get(i)).cancel();
        }
    }
}

// ObjectAnimator
boolean shouldAutoCancel(AnimationHandler.AnimationFrameCallback anim) {
    if (anim == null) {
        return false;
    }

    if (anim instanceof ObjectAnimator) {
        ObjectAnimator objAnim = (ObjectAnimator) anim;
        if (objAnim.mAutoCancel && hasSameTargetAndProperties(objAnim)) {
            return true;
        }
    }
    return false;
}

private boolean hasSameTargetAndProperties(@Nullable Animator anim) {
    if (anim instanceof ObjectAnimator) {
        PropertyValuesHolder[] theirValues = ((ObjectAnimator) anim).getValues();
        if (((ObjectAnimator) anim).getTarget() == getTarget() &&
                mValues.length == theirValues.length) {
            for (int i = 0; i < mValues.length; ++i) {
                PropertyValuesHolder pvhMine = mValues[i];
                PropertyValuesHolder pvhTheirs = theirValues[i];
                if (pvhMine.getPropertyName() == null ||
                        !pvhMine.getPropertyName().equals(pvhTheirs.getPropertyName())) {
                    return false;
                }
            }
            return true;
        }
    }
    return false;
}
```
`AnimationHandler`里面的`mAnimationCallbacks`其实就是`ValueAnimator`，`ValueAnimator`实现了该接口，并在`start`方法中将自己加入了`mAnimationCallbacks`中。
因此，上面这些代码很简单，`ObjectAnimator`的`start`方法会先将`mAutoCancel`为true且和当前动画相同的`ObjectAnimator`动画取消，然后在调用基类也就是`ValueAnimator`的`start`方法。

下面我们接着看`ValueAnimator`的`start`方法：
```java
@Override
public void start() {
    start(false);
}

private void start(boolean playBackwards) {
    if (Looper.myLooper() == null) {
        throw new AndroidRuntimeException("Animators may only be run on Looper threads");
    }
    mReversing = playBackwards;
    // Special case: reversing from seek-to-0 should act as if not seeked at all.
    if (playBackwards && mSeekFraction != -1 && mSeekFraction != 0) {
        if (mRepeatCount == INFINITE) {
            // Calculate the fraction of the current iteration.
            float fraction = (float) (mSeekFraction - Math.floor(mSeekFraction));
            mSeekFraction = 1 - fraction;
        } else {
            mSeekFraction = 1 + mRepeatCount - mSeekFraction;
        }
    }
    mStarted = true;
    mPaused = false;
    mRunning = false;
    mAnimationEndRequested = false;
    // Resets mLastFrameTime when start() is called, so that if the animation was running,
    // calling start() would put the animation in the
    // started-but-not-yet-reached-the-first-frame phase.
    mLastFrameTime = 0;
    AnimationHandler animationHandler = AnimationHandler.getInstance();
    animationHandler.addAnimationFrameCallback(this, (long) (mStartDelay * sDurationScale));

    if (mStartDelay == 0 || mSeekFraction >= 0) {
        // If there's no start delay, init the animation and notify start listeners right away
        // to be consistent with the previous behavior. Otherwise, postpone this until the first
        // frame after the start delay.
        startAnimation();
        if (mSeekFraction == -1) {
            // No seek, start at play time 0. Note that the reason we are not using fraction 0
            // is because for animations with 0 duration, we want to be consistent with pre-N
            // behavior: skip to the final value immediately.
            setCurrentPlayTime(0);
        } else {
            setCurrentFraction(mSeekFraction);
        }
    }
}
```
可以看出属性动画需要运行在有Looper的线程中，这段代码会根据情况调用`setCurrentPlayTime`或者`setCurrentFraction`方法；而在`setCurrentPlayTime`方法中计算了fraction后也调用了`setCurrentFraction`方法。接着我们看这个方法：
```java
public void setCurrentFraction(float fraction) {
    initAnimation();
    fraction = clampFraction(fraction);
    long seekTime = (long) (getScaledDuration() * fraction);
    long currentTime = AnimationUtils.currentAnimationTimeMillis();
    mStartTime = currentTime - seekTime;
    mStartTimeCommitted = true; // do not allow start time to be compensated for jank
    if (!isPulsingInternal()) {
        // If the animation loop hasn't started, the startTime will be adjusted in the first
        // frame based on seek fraction.
        mSeekFraction = fraction;
    }
    mOverallFraction = fraction;
    final float currentIterationFraction = getCurrentIterationFraction(fraction);
    animateValue(currentIterationFraction);
}
```
这段代码就是根据将传入的fraction进行一系列转换，然后在传入`animateValue`方法，我们接着看：
```java
@CallSuper
void animateValue(float fraction) {
    fraction = mInterpolator.getInterpolation(fraction);
    mCurrentFraction = fraction;
    int numValues = mValues.length;
    for (int i = 0; i < numValues; ++i) {
        mValues[i].calculateValue(fraction);
    }
    if (mUpdateListeners != null) {
        int numListeners = mUpdateListeners.size();
        for (int i = 0; i < numListeners; ++i) {
            mUpdateListeners.get(i).onAnimationUpdate(this);
        }
    }
}
```
上面代码首先在插值器中获取当前属性改变的百分比，然后在调用`mValues[i].calculateValue(fraction)`计算没帧动画所对应的属性。mValues对应的类是`PropertyValuesHolder`类，我们在调用ObjectAnimator、ValueAnimator的`ofInt`系列工厂方法时，会将传入的值包装成`PropertyValuesHolder`对象，而`PropertyValuesHolder`又会将这些数据封装成`KeyframeSet`。`mValues[i].calculateValue(fraction)`的计算过程最终会交给`KeyframeSet`的`getValue`方法：
```java
public Object getValue(float fraction) {
    // Special-case optimization for the common case of only two keyframes
    if (mNumKeyframes == 2) {
        if (mInterpolator != null) {
            fraction = mInterpolator.getInterpolation(fraction);
        }
        return mEvaluator.evaluate(fraction, mFirstKeyframe.getValue(),
                mLastKeyframe.getValue());
    }
    if (fraction <= 0f) {
        final Keyframe nextKeyframe = mKeyframes.get(1);
        final TimeInterpolator interpolator = nextKeyframe.getInterpolator();
        if (interpolator != null) {
            fraction = interpolator.getInterpolation(fraction);
        }
        final float prevFraction = mFirstKeyframe.getFraction();
        float intervalFraction = (fraction - prevFraction) /
            (nextKeyframe.getFraction() - prevFraction);
        return mEvaluator.evaluate(intervalFraction, mFirstKeyframe.getValue(),
                nextKeyframe.getValue());
    } else if (fraction >= 1f) {
        final Keyframe prevKeyframe = mKeyframes.get(mNumKeyframes - 2);
        final TimeInterpolator interpolator = mLastKeyframe.getInterpolator();
        if (interpolator != null) {
            fraction = interpolator.getInterpolation(fraction);
        }
        final float prevFraction = prevKeyframe.getFraction();
        float intervalFraction = (fraction - prevFraction) /
            (mLastKeyframe.getFraction() - prevFraction);
        return mEvaluator.evaluate(intervalFraction, prevKeyframe.getValue(),
                mLastKeyframe.getValue());
    }
    Keyframe prevKeyframe = mFirstKeyframe;
    for (int i = 1; i < mNumKeyframes; ++i) {
        Keyframe nextKeyframe = mKeyframes.get(i);
        if (fraction < nextKeyframe.getFraction()) {
            final TimeInterpolator interpolator = nextKeyframe.getInterpolator();
            final float prevFraction = prevKeyframe.getFraction();
            float intervalFraction = (fraction - prevFraction) /
                (nextKeyframe.getFraction() - prevFraction);
            // Apply interpolator on the proportional duration.
            if (interpolator != null) {
                intervalFraction = interpolator.getInterpolation(intervalFraction);
            }
            return mEvaluator.evaluate(intervalFraction, prevKeyframe.getValue(),
                    nextKeyframe.getValue());
        }
        prevKeyframe = nextKeyframe;
    }
    // shouldn't reach here
    return mLastKeyframe.getValue();
}
```
在`getValue`方法中的`mEvaluator`就是估值器。每一个关键帧都还有它自己的插值器，它控制的之前关键帧与现在这一帧之间的插值。

另外，在初始化的时候，如果属性的初始值没有提供，则其get方法会调用，具体在`PropertyValuesHolder`的`setupValue`方法。我们可以看到，其get是通过反射来调用的：
```java
private void setupValue(Object target, Keyframe kf) {
    if (mProperty != null) {
        Object value = convertBack(mProperty.get(target));
        kf.setValue(value);
    } else {
        try {
            if (mGetter == null) {
                Class targetClass = target.getClass();
                setupGetter(targetClass);
                if (mGetter == null) {
                    // Already logged the error - just return to avoid NPE
                    return;
                }
            }
            Object value = convertBack(mGetter.invoke(target));
            kf.setValue(value);
        } catch (InvocationTargetException e) {
            Log.e("PropertyValuesHolder", e.toString());
        } catch (IllegalAccessException e) {
            Log.e("PropertyValuesHolder", e.toString());
        }
    }
}
```
