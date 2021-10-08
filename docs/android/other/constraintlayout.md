---
title: "ConstraintLayout使用大全"
---

ConstraintLayout最基本的相对定位功能都足以替代RelativeLayout，更不要说其他牛逼的高级特性，比如约束宽高比、多控件整体居中、辅助线等。ConstraintLayout值得我们学习，功能非常强大，而且对于减少布局层级有非常大的帮助。  
但是其支持的属性非常之多，所以有些属性没有系统学习还是有点摸不着头脑，所以这里总结整理一下。  

目前[ConstraintLayout最新稳定版本为1.1.3](https://developer.android.com/jetpack/androidx/releases/constraintlayout)。本文是基于官方文档[ Developer Guide ](https://developer.android.com/reference/android/support/constraint/ConstraintLayout#developer-guide)的翻译。

**Tips**: 现在都是androidx的年代了，但由于作者不想给测试各种东西的项目升级，所以代码也是非androidx的。注意一下，如有必要，请自行替换成androidx。

## 1. 相对定位

相对定位类似于RelativeLayout的作用，在水平轴和竖直轴上可以有如下约束：

- 水平轴：left、right、start、end sides
- 竖直轴：top、bottom sides 以及 text baseline

例如，将button B 放到 button A 的右边（图1）

![图1 相对定位例子](/assets/images/android/constraintlayout-relative-position-example.png)

<center>图1 相对定位例子</center>

xml代码如下：

```xml
<Button android:id="@+id/buttonA" ... /> 
<Button android:id="@+id/buttonB" ... 
        app:layout_constraintLeft_toRightOf="@+id/buttonA" />
```

上面的代码告诉系统，我们想要button B的左侧被约束到button A的右侧。这样一个位置约束意味着系统尝试使这两侧在同一个位置上。

下面是所有可用的约束（图2）：

![图2 相对定位约束](/assets/images/android/constraintlayout-relative-positioning-constraints.png)

<center>图2 相对定位约束</center>

- `layout_constraintLeft_toLeftOf`
- `layout_constraintLeft_toRightOf`
- `layout_constraintRight_toLeftOf`
- `layout_constraintRight_toRightOf`
- `layout_constraintTop_toTopOf`
- `layout_constraintTop_toBottomOf`
- `layout_constraintBottom_toTopOf`
- `layout_constraintBottom_toBottomOf`
- `layout_constraintBaseline_toBaselineOf`
- `layout_constraintStart_toEndOf`
- `layout_constraintStart_toStartOf`
- `layout_constraintEnd_toStartOf`
- `layout_constraintEnd_toEndOf`

这些属性需要使用view的 **id** 或者 **parent** 作为值。

## 2. Margins

![图3 相对定位的margin](/assets/images/android/constraintlayout-relative-positioning-margin.png)

<center>图3 相对定位的margin</center>

如果设置了margin，它们将会作用于对应的约束上（图3），将边距强制作为为目标和源之间的空间。通常有如下属性：

- `android:layout_marginStart`
- `android:layout_marginEnd`
- `android:layout_marginLeft`
- `android:layout_marginTop`
- `android:layout_marginRight`
- `android:layout_marginBottom`

### 2.1 作用到GONE控件上的Margins

当 **约束目标** 的可见性为`View.GONE`时，可以使用以下属性指定要使用的不同的margin：

- `layout_goneMarginStart`
- `layout_goneMarginEnd`
- `layout_goneMarginLeft`
- `layout_goneMarginTop`
- `layout_goneMarginRight`
- `layout_goneMarginBottom`

举一个简单的例子，两个Button的布局如下：

```xml
<?xml version="1.0" encoding="utf-8"?>
<android.support.constraint.ConstraintLayout
    ...>

    <Button
        android:id="@+id/button1"
        ...
        app:layout_constraintStart_toStartOf="parent" />

    <Button
        android:id="@+id/button2"
        ...
        app:layout_goneMarginStart="16dp"
        app:layout_constraintStart_toEndOf="@id/button1"/>

</android.support.constraint.ConstraintLayout>
```

当约束目标（button1）可见性分别为`View.VISIBLE`和`View.GONE`时，显示如下：

<figure class="half">
    <img src="/assets/images/android/constraintlayout-margin-gone-example-1.png">
    <img src="/assets/images/android/constraintlayout-margin-gone-example-2.png">
</figure>

<center>gone margin 对不同可见性的约束目标的作用</center>

## 3. 居中和偏移(Bias)

ConstraintLayout一个有用的方面在于如何处理“不可能”的约束。比如，布局代码如下：

```xml
<android.support.constraint.ConstraintLayout ...> 
    <Button android:id="@+id/button" ... 
            app:layout_constraintLeft_toLeftOf="parent"
            app:layout_constraintRight_toRightOf="parent/> 
</>
```

除非ConstraintLayout恰好具有与Button完全相同的大小，否则上面两个约束不能同时满足（两条边都不会是我们想要的位置）。

在这种情况下，约束的作用就像是相反的力量平等的拉Widget（图4），这样Widget最终将在父容器中居中。这同样适用于垂直方向上的情况。

![图4 居中定位](/assets/images/android/constraintlayout-centering-positioning.png)

<center>图4 居中定位</center>

值得一提的是，在这两个约束的前提下，如果上面的Button的`layout_width`不同，效果也不同。如下所示：

<img src="/assets/images/android/constraintlayout-center-wrap-content.png">
<img src="/assets/images/android/constraintlayout-center-match-parent.png">
<img src="/assets/images/android/constraintlayout-center-0dp.png">

<center>wrap content、match parent、0dp时的效果</center>


### 3.1 偏移(Bias)

上面这种相反的约束的效果默认是使Widget居中；但是我们可以使用bias属性调整力量的比例：

- `layout_constraintHorizontal_bias`
- `layout_constraintVertical_bias`

比如，下面的代码可以使左侧使用30%的偏移而不是默认的50%，这样会使左侧更短，从而导致Widget更倾向于左侧（图5）：

![图5 调整了bias的居中定位](/assets/images/android/constraintlayout-centering-positioning-bias.png)

<center>图5 调整了bias的居中定位</center>

```xml
<android.support.constraint.ConstraintLayout ...> 
    <Button android:id="@+id/button" ... 
            app:layout_constraintHorizontal_bias="0.3" 
            app:layout_constraintLeft_toLeftOf="parent" 
            app:layout_constraintRight_toRightOf="parent/> 
</>
```

使用偏移，我们可以制作更好地适应屏幕尺寸变化的用户界面。

## 4. 圆形定位（1.1新增）

我们可以用角度和距离来约束一个Widget的中心相对于另一个Widget的中心。这允许我们将Widget放在圆上（图6）。以下属性可以使用：

- `layout_constraintCircle` : 另一个widget的id
- `layout_constraintCircleRadius` : 到另一个widegt中心的距离
- `layout_constraintCircleAngle` : Widget应该处于哪个角度 (0～360的角度)

<img src="/assets/images/android/constraintlayout-circle1.png" style="border: none">
<img src="/assets/images/android/constraintlayout-circle2.png" style="border: none">
    
<center>图6 圆形定位</center>

```xml
<Button android:id="@+id/buttonA" ... /> 
<Button android:id="@+id/buttonB" ... 
        app:layout_constraintCircle="@+id/buttonA" 
        app:layout_constraintCircleRadius="100dp" 
        app:layout_constraintCircleAngle="45" />
```

## 5. 可见性行为

ConstraintLayout对标记为`View.GONE`的Widget有特定处理。

像往常一样，**GONE** widgets 不会显示，也不是布局本身的一部分（即如果标记为GONE，它们的实际尺寸将不会更改）。

但就布局计算而言，GONE widgets 仍然是其中的一部分，具有重要的区别：

- 对于布局过程，它们的尺寸将被视为零（基本上，它们将被解析为一个点）
- 如果他们对其他widgets有约束，它们仍然会起到作用，但任何边距都会好像等于零

![图7 可见性行为](/assets/images/android/constraintlayout-visibility-behavior.png)

<center>图7 可见性行为</center>

这种特定的行为允许我们在构建布局时暂时将widget标记为GONE，而不会破坏布局（图7），这在进行简单的布局动画时尤其有用。 

**注意：** 使用的边距将是B在连接到A时定义的边距（例如图7）。在某些情况下，这可能不是我们想要的margin（例如，A距其容器的一边有100dp的边距，B到A只有16dp；如果A标记为GONE，那么B到容器的边距为16dp）。因此，我们可以指定在连接到标记为GONE的widget时要使用的备用margin（请参阅上面有关[作用到GONE控件上的Margins](#21-gonemargins)的部分）。

## 6. 尺寸约束

### 6.1 ConstraintLayout中的最小尺寸

我们可以为ConstraintLayout本身定义最小和最大尺寸：

- `android:minWidth` 设置layout的最小宽度
- `android:minHeight` 设置layout的最小高度
- `android:maxWidth` 设置layout的最大宽度
- `android:maxHeight` 设置layout的最大高度

当ConstraintLayout的尺寸被设置为`WRAP_CONTENT`时，这些最小、最大值会被使用。

### 6.2 Widget的尺寸约束

widget的尺寸可以通过设置`android:layout_width`和`android:layout_height`的属性值来指定，有如下三种方式：

- 使用具体值
- 使用`WRAP_CONTENT`，这样widget会计算自身的尺寸
- 使用`0dp`，这等于“`MATCH_CONSTRAINT`”

前两种工作方式和其他布局一样。最后一种方式将会调整widget的尺寸来匹配设置的约束（参见图8，(a)为wrap_content，(b)为0dp）。如果设置了margin，它们将在计算中被考虑在内（图8，0dp的(c)）。

![图8 尺寸约束](/assets/images/android/constraintlayoutdimension-match-constraints.png)

<center>图8 尺寸约束</center>

**重要：** 对于包含在ConstraintLayout中的Widget来说，不建议使用`MATCH_PARENT`。可以通过使用`MATCH_CONSTRAINT`来定义类似的行为，其中相应的left/right或top/bottom约束被设置为“`parent`”。

### 6.3 WRAP_CONTENT: 强制约束（1.1新增）

如果尺寸设置为`WRAP_CONTENT`，则在1.1之前的版本中，它们将被视为literal尺寸——这意味着约束不会限制最终的尺寸。虽然通常情况下，这就足够（并且更快），但在某些情况下，我们可能希望使用`WRAP_CONTENT`，同时仍然强制执行约束以限制最终的尺寸。在这种情况下，我们可以添加一个相应的属性：

- `app:layout_constrainedWidth=”true|false”`
- `app:layout_constrainedHeight=”true|false”`

上面比较难理解，这里给出一个例子。button1居中显示，button2约束在button1的右边、parent的左边：

```xml
<Button
    android:id="@+id/button1"
    android:layout_width="wrap_content"
    android:layout_height="wrap_content"
    android:text="aaaaaaa"
    app:layout_constraintStart_toStartOf="parent"
    app:layout_constraintEnd_toEndOf="parent"
    app:layout_constraintTop_toTopOf="parent"
    app:layout_constraintBottom_toBottomOf="parent"/>

<Button
    android:id="@+id/button2"
    android:layout_width="wrap_content"
    android:layout_height="wrap_content"
    android:text="22222222222222222222222222222"
    app:layout_constrainedWidth="true"
    android:layout_marginTop="40dp"
    app:layout_constraintTop_toTopOf="@id/button1"
    app:layout_constraintStart_toEndOf="@id/button1"
    app:layout_constraintEnd_toEndOf="parent"/>
```

对button2使不使用`app:layout_constrainedWidth="true"`的效果如下：

<img src="/assets/images/android/constraintlayout-constrainted-width-before.png" style="border: none">
<img src="/assets/images/android/constraintlayout-constrainted-width-after.png" style="border: none">

<center>约束width前 & 约束width后</center>

### 6.4 MATCH_CONSTRAINT 尺寸（1.1新增）

当尺寸设置为`MATCH_CONSTRAINT`时（也就是设置为0dp），默认行为是使结果大小占用所有可用空间。几个额外的修饰符如下： 

- `layout_constraintWidth_min` 和 `layout_constraintHeight_min`：将设置此维度的最小大小 
- `layout_constraintWidth_max` 和 `layout_constraintHeight_max`：将设置此维度的最大大小 
- `layout_constraintWidth_percent` 和 `layout_constraintHeight_percent`：将此维度的大小设置为parent的百分比

例如，使button1的宽度为parent的50%，可以这样：

```xml
<Button
        android:id="@+id/button1"
        android:layout_width="0dp"
        ...
        app:layout_constraintWidth_default="percent"
        app:layout_constraintWidth_percent="0.5"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintEnd_toEndOf="parent"/>
```

<p>&nbsp;</p><font size="3"><b>最小与最大</b></font>  

最小与最大的值可以是一个dp数值，也可以是“`wrap`”，后者将会使用`WRAP_CONTENT`的值。

<p>&nbsp;</p><font size="3"><b>百分比尺寸</b></font>  

想要使用百分比，我们需要按照以下步骤：

- 尺寸必须设置为`MATCH_CONSTRAINT` (0dp)
- 默认值应该设置为percent `app:layout_constraintWidth_default="percent"` 或 `app:layout_constraintHeight_default="percent"`
- 最后设置`layout_constraintWidth_percent` 或 `layout_constraintHeight_percent` 属性，值在0～1之间

<p>&nbsp;</p><font size="3"><b>比例</b></font>  

我们可以将Widget的一个维度定义为另一个维度的比例。为此，我们需要将至少一个约束维度设置为 **0dp** （即 **MATCH_CONSTRAINT** ），并将属性 `layout_constraintDimensionRatio` 设置为给定比率。例如：

```xml
<Button android:layout_width="wrap_content"
        android:layout_height="0dp"
        app:layout_constraintDimensionRatio="1:1" />
```

上面的例子会将 button 的高度设置为与其宽度相同。

比例可以是以下值：

- float值，代表宽比高的比例
- `width:height`格式的字符串

在宽高都被设置为`MATCH_CONSTRAINT` (0dp)时，我们也可以使用比例。这种情况下，系统会在满足所有约束，且维持指定比例的情况下，设置最大的尺寸。  
我们还可以基于一个维度的尺寸来约束另一个维度的尺寸，只需要在比例中添加"**W,**"或"**H,**"前缀来约束宽或高。比如，button 的一个维度被两个条件约束（e.g. 宽为0dp，在父布局中居中），我们可以通过在比例前增加“**W**”（约束宽）或“**H**”（约束高），并以逗号分割来指定约束哪个维度。

```xml
<Button android:layout_width="0dp" 
        android:layout_height="0dp" 
        app:layout_constraintDimensionRatio="H,16:9" 
        app:layout_constraintBottom_toBottomOf="parent" 
        app:layout_constraintTop_toTopOf="parent"/>
```

上面的例子中，首先高度服从约束，所以高度为parent的高度；然后，宽度会服从比例的约束，高：宽=16：9。这个button的最终结果就是，如果parent大小刚好是16:9，那么button就会刚好占满整个屏幕。

> app:layout_constraintDimensionRatio="H,16:9" 指的是 H:W=16:9  
> app:layout_constraintDimensionRatio="W,16:9" 指的是 W:H=16:9  
> app:layout_constraintDimensionRatio="16:9" 指的是 W:H=16:9

## 7. 链（Chains）

链提供了一条轴（水平或数值）上的群体行为。另一条轴可以单独约束。

<p>&nbsp;</p><font size="3"><b>创建链</b></font>  

一系列彼此之间双向连接的widgets可以理解为一条链（如图9，两个widgets组成的最小的链）

![图9 链](/assets/images/android/constraintlayout-chains.png)

<center>图9 链</center>

<p>&nbsp;</p><font size="3"><b>链头 (Chain heads)</b></font>  

链的第一个元素（也称之为链“头”）上的属性控制着整个链：

![图10 链头](/assets/images/android/constraintlayout-chains-head.png)

<center>图10 链头</center>

水平链上最左边的widget就是链头；同理，竖直链上最上面的widget是链头。

<p>&nbsp;</p><font size="3"><b>链中的margin</b></font>  

If margins are specified on connections, they will be taken in account.  In the case of spread chains, margins will be deducted from the allocated space.（这句实在是无法信达雅，大致意思就是说：链中的margin会被考虑在内。在spread模式下，先处理margin，剩下的空间交给widget处理）

<p>&nbsp;</p><font size="3"><b>链的样式</b></font>  

通过在链头上设置`layout_constraintHorizontal_chainStyle`或`layout_constraintVertical_chainStyle`属性，可以改变链的样式（默认为`CHAIN_SPREAD`）。

- `CHAIN_SPREAD` - 元素将会展开，Flutter中MainAxisAlignment.spaceEvenly的效果（默认样式）
- 权重链（Weighted chain） - 在`CHAIN_SPREAD`模式中，设置为`MATCH_CONSTRAINT`的widgets，将会平分剩下的空间
- `CHAIN_SPREAD_INSIDE` - 和`CHAIN_SPREAD`类似，但链的两端不会展开，Flutter中MainAxisAlignment.spaceBetween的效果
- `CHAIN_PACKED` - 链中的元素会挤在一起。bias属性会影响整体的位置。
    ![图11 链的样式](/assets/images/android/constraintlayout-chains-styles.png)
    <center>图11 链的样式</center>

**权重链**  

链的默认行为是元素平分可用的空间。如果一个或多个元素使用了`MATCH_CONSTRAINT`，它们将会使用其他元素用剩的所有可用的空白空间（相互之间平等分配，整个行为就像LinearLayout那样）。`layout_constraintHorizontal_weight`和`layout_constraintVertical_weight`属性将会控制`MATCH_CONSTRAINT`元素怎样分配空间。例如，一条链中两个元素使用`MATCH_CONSTRAINT`，第一个元素权重为2，第二个元素权重为1，因此，第一个元素占用的空间会是第二个元素的两倍。

**Margins与链（1.1版本中）**  

在链中的元素上使用margin时，margin是相加的。  
例如，在水平链上，如果一个元素定义了10dp的右边距，而下一个元素定义了5dp的左边距，则这两个元素之间产生的边距为15dp。  
在计算链中用于定位items的剩余空间时，会同时考虑item及其边距。剩余空间中不包含边距。

## 8. 虚拟辅助对象（Virtual Helper objects）

除了上面描述的功能之外，我们还可以使用ConstraintLayout中的特殊辅助对象来帮助我们进行布局。一般，辅助对象不会显示在设备上（因为它们都是`View.GONE`的），只用来辅助布局，且只适用于ConstraintLayout中。  
目前，`Guideline`对象允许我们创建相对于ConstraintLayout容器定位的水平和垂直辅助线。widgets可以约束在这些辅助线上。  
在1.1版本中，也增加了`Barrier`、`Group`、`Placeholder`三个辅助对象。

<p>&nbsp;</p><font size="3"><b>Guideline</b></font>  

Guideline可以是水平或者竖直的：

- 竖直Guideline宽度为0，高度为`ConstraintLayout` parent的高度
- 水平Guideline高度为0，宽度为`ConstraintLayout` parent的宽度

Guideline的位置可以由下面三种方式决定：

- 从layout的左边或上面开始指定一个固定的距离（dp值） - `layout_constraintGuide_begin`
- 从layout的右边或下面开始指定一个固定的距离（dp值） - `layout_constraintGuide_end`
- 指定layout的宽度或高度的百分比位置（0～1浮点数） - `layout_constraintGuide_percent`



<p>&nbsp;</p><font size="3"><b>Barrier</b></font>  

Barrier接收多个widget的id作为参数，基于最极端的widget的指定的一侧创建一个虚拟的辅助线。

Barrier的方向可以通过`barrierDirection`来设置，有如下可选值

- `left`
- `start`
- `right`
- `end`
- `top`
- `bottom`

例如，这里有两个button，分别是@id/button1和@id/button2。`constraint_referenced_ids`将会引用它们，两个id之间用逗号区分。

![](/assets/images/android/constraintlayout-barrier-buttons.png)

```xml
<android.support.constraint.Barrier
        android:id="@+id/barrier"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        app:barrierDirection="start"
        app:constraint_referenced_ids="button1,button2" />
```

Barrier的方向设置为了start，所以结果如下：

![](/assets/images/android/constraintlayout-barrier-start.png)

相反的，我们将Barrier的方向设置为end，结果如下：

![](/assets/images/android/constraintlayout-barrier-end.png)

如果widgets的尺寸变化了，Barrier将会根据设置的方向自动移动到最极端的widget上：

![](/assets/images/android/constraintlayout-barrier-adapt.png)

其他widget可以约束到Barrier上，而不是单独的widget。这样的话，我们的layout可以自动适配widget尺寸的变化（比如，对于同一个单词，不同语言下长度会不一样）。

Barrier如果引用了GONE的widgets，默认行为会基于GONE后的坐标创建障碍。如果我们不想让Barrier将GONE的widgets考虑在内，我们可以将`barrierAllowsGoneWidgets`属性设置为false（默认为true）。



<p>&nbsp;</p><font size="3"><b>Group</b></font>  

Group的作用就是控制所有引用的widget的可见性。widget id之间还是用逗号分割：

```xml
<android.support.constraint.Group
        android:id="@+id/group"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:visibility="visible"
        app:constraint_referenced_ids="button4,button9" />
```

使用这种方式隐藏、显示一组widget是非常容易的，不需要程序性的维护这个集合。

多个Group可以引用同一个widget，在这种情况下，xml定义的顺序会导致最后的可见性状态（最后定义的group最终会生效）。



<p>&nbsp;</p><font size="3"><b>Placeholder</b></font>  

Placeholder提供可一个能够定位在已存在对象上的可见对象。  
当另一个view的id设置到了placeholder上（通过`setContent()`方法），placeholder会变成content view。如果content view存在在屏幕上，那么它会从原来的位置gone。  
content view的位置由布局中Placeholder的参数决定（Placeholder可以向其他view一样被约束），content view的其他属性由content view自己决定。

## 9. Optimizer (1.1版本中)

在1.1版本中，暴露了约束优化器。我们可以在`ConstraintLayout`上通过添加`app:layout_optimizationLevel`的方式，决定使用哪种优化。

- **none** : 不使用任何优化
- **standard** : 默认值。仅优化direct、barrier约束
- **direct** : 优化direct约束
- **barrier** : 优化barrier约束
- **chain** : 优化chain约束（试验性）
- **dimensions** : 优化尺寸测量（试验性）, 减少匹配约束元素的测量的次数

该属性是一个掩码（mask），所以我们可以决定打开或关闭指定的优化。  
比如，`app:layout_optimizationLevel="direct|barrier|chain"`。

## 10. ConstraintSet

ConstraintSet允许我们通过代码设置一系列约束，除此之外，还能对ConstraintLayout里面的控件做动画。

首先，我们通过各种方式初始化好两个需要交替互换的`ConstraintSet`。这里两个`ConstraintSet`中只有一个`Group`显示与隐藏的区别。

```kotlin
private lateinit var debitCardSet: ConstraintSet
private lateinit var creditCardSet: ConstraintSet

private fun initView() {
    debitCardSet = ConstraintSet()
    debitCardSet.clone(constraintLayout)
    debitCardSet.setVisibility(R.id.groupCreditCard, View.GONE)
    creditCardSet = ConstraintSet()
    creditCardSet.clone(constraintLayout)
    creditCardSet.setVisibility(R.id.groupCreditCard, View.VISIBLE)
}
```

然后，在需要切换`Group`的显示与隐藏时，调用下面的方法：

```kotlin
private fun showCreditCard(showCreditCard: Boolean) {
    val transition = AutoTransition()
    transition.duration = 200
    TransitionManager.beginDelayedTransition(constraintLayout, transition)
    val constraintSet = if (showCreditCard) creditCardSet else debitCardSet
    constraintSet.applyTo(constraintLayout)
}
```

显示效果如下：

![](/assets/images/android/constraintlayout-constraint-set.gif)