---
title: "Android中的Drawable资源"
---

来自Google的文档：[https://developer.android.com/guide/topics/resources/drawable-resource.html](https://developer.android.com/guide/topics/resources/drawable-resource.html)

## 1 Android中Drawable类型

Android中`Drawable`的类型共有十种：

| Drawable | Drawable中对应名称 | xml中对应名称 |
| ----- | ------ | ----- |
| Bitmap File | BitmapDrawable | .png .jpg .gif文件 |
| Nine-Patch File | NinePatchDrawable | .9.png文件 |
| Layer List | LayerDrawable | layer-list节点 |
| State List | StateListDrawable | selector节点 |
| Level List | LevelListDrawable | level-list节点 |
| Transition Drawable | TransitionDrawable | transition节点 |
| Inset Drawable | InsetDrawable | inset节点 |
| Clip Drawable | ClipDrawable | clip节点 |
| Scale Drawable | ScaleDrawable | scale节点 |
| Shape Drawable | ShapeDrawable | shape节点 |


想要创建`AnimationDrawable`可以参考另外[Android动画](/android/framework/Android%E5%8A%A8%E7%94%BB/)一篇文章

[颜色资源](https://developer.android.com/guide/topics/resources/more-resources.html#Color)也可以在xml中作为一个`drawable`使用。比如，创建state list drawable时，可以使用`android:drawable`属性(`android:drawable="@color/green"`)引用颜色资源。


## 2 各种类型Drawable详解

### 2.1 Bitmap

Android支持三种格式的bitmap文件：

- 首选`png`格式
- 可接受`jpg`格式
- 不建议`gif`格式

!!! tip
    `aapt`工具在编译时会自动以无损压缩的方式优化图片。放在`res/raw`里面的图片，不会被优化。

#### 2.1.1 Bitmap文件

文件位置  

- `res/drawable/filename.png (.png, .jpg, .gif)`

编译资源数据类型

- `BitmapDrawable`

资源引用

- 在Java中：`R.drawable.filename`
- 在XML中：`@[package:]drawable/filename`

例子

- XML中引用

    ```xml
    <ImageView
        android:layout_height="wrap_content"
        android:layout_width="wrap_content"
        android:src="@drawable/myimage" />
    ```

- Java中引用

    ```java
    Resources res = getResources();
    Drawable drawable = res.getDrawable(R.drawable.myimage);
    ```

#### 2.1.2 XML Bitmap

XML Bitmap是一个定义在XML中指向一个bitmap文件的资源，该方式起的作用仅仅是给原始的bitmap文件起了别名。XML能够为bitmap申明额外的属性，比如`dithering`和`tiling`。

> 我们可以使用`<bitmap>`作为一个`<item>`的子节点。比如在创建state list和layer list时，这是非常有用的。

文件位置

- `res/drawable/filename.xml`

编译资源数据类型

- `BitmapDrawable`

资源引用

- 在Java中：`R.drawable.filename`
- 在XML中：`@[package:]drawable/filename`

语法  
```xml
<?xml version="1.0" encoding="utf-8"?>
<bitmap
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:src="@[package:]drawable/drawable_resource"
    android:antialias=["true" | "false"]
    android:dither=["true" | "false"]
    android:filter=["true" | "false"]
    android:gravity=["top" | "bottom" | "left" | "right" | "center_vertical" |
                      "fill_vertical" | "center_horizontal" | "fill_horizontal" |
                      "center" | "fill" | "clip_vertical" | "clip_horizontal"]
    android:mipMap=["true" | "false"]
    android:tileMode=["disabled" | "clamp" | "repeat" | "mirror"] />
```

元素  

- `<bitmap>`  
    定义位图来源及其属性。  
    属性：  
    - `xmlns:android`  
      *String*。定义 XML 命名空间，其必须是`http://schemas.android.com/apk/res/android`。这仅当`<bitmap>`是根元素时才需要，当 `<bitmap>`嵌套在`<item>`内时不需要。
    - `android:src`  
      *Drawable resource*。**必备**。引用drawable。
    - `android:antialias`  
      *Boolean*。启用或停用抗锯齿。
    - `android:dither`  
      *Boolean*。当位图的像素配置与屏幕不同时(例如：ARGB 8888 位图和 RGB 565 屏幕)，启用或停用位图抖动。
    - `android:filter`  
      *Boolean*。启用或停用位图过滤。当位图收缩或拉伸以使其外观平滑时使用过滤。
    - `android:gravity`  
      *Keyword*。定义bitmap的gravity。gravity表示当bitmap小于容器时，drawable在其容器中放置的位置。  
      必须是以下一个或多个(用 '|' 分隔)常量值：  

        | 值 | 说明 |
        | -- | --- |
        | top	| 将对象放在其容器顶部，不改变其大小。 |
        | bottom	| 将对象放在其容器底部，不改变其大小。 |
        | left	| 将对象放在其容器左边缘，不改变其大小。 |
        | right	| 将对象放在其容器右边缘，不改变其大小。 |
        | center_vertical	| 将对象放在其容器的垂直中心，不改变其大小。 |
        | fill_vertical	| 按需要扩展对象的垂直大小，使其完全适应其容器。 |
        | center_horizontal	| 将对象放在其容器的水平中心，不改变其大小。 |
        | fill_horizontal	| 按需要扩展对象的水平大小，使其完全适应其容器。 |
        | center | 将对象放在其容器的水平和垂直轴中心，不改变其大小。 |
        | fill | 按需要扩展对象的垂直大小，使其完全适应其容器。这是默认值。 |
        | clip_vertical	| 可设置为让子元素的上边缘和/或下边缘裁剪至其容器边界的附加选项。裁剪基于垂直gravity：top gravity裁剪上边缘，bottom gravity裁剪下边缘，任一gravity不会同时裁剪两边。 |
        | clip_horizontal	| 可设置为让子元素的左边和/或右边裁剪至其容器边界的附加选项。裁剪基于水平gravity：left gravity裁剪右边缘，right gravity裁剪左边缘，任一gravity不会同时裁剪两边。 |

    - `android:mipMap`  
      *Boolean*。启用或停用mipmap提示。如需了解详细信息，请参阅setHasMipMap()。默认值为false。
    - `android:tileMode`  
      *Keyword*。定义平铺模式。当平铺模式启用时，mipmap会重复。gravity在平铺模式启用时将被忽略。  
      必须是以下常量值之一：

        | 值 | 说明 |
        | -- | --- |
        | disabled | 不平铺bitmap。这是默认值。 |
        | clamp | 当着色器绘制范围超出其原边界时复制边缘颜色 |
        | repeat | 水平和垂直重复着色器的图像。 |
        | mirror | 水平和垂直重复着色器的图像，交替镜像图像以使相邻图像始终相接。 |

例子

```xml
<?xml version="1.0" encoding="utf-8"?>
<bitmap xmlns:android="http://schemas.android.com/apk/res/android"
    android:src="@drawable/icon"
    android:tileMode="repeat" />
```

### 2.2 Nine-Patch

#### 2.2.1 Nine-Patch File

文件位置

- `res/drawable/filename.9.png`

编译的资源数据类型

- `NinePatchDrawable`

资源引用

- 在Java中：`R.drawable.filename`
- 在XML中：`@[package:]drawable/filename`

示例

```xml
<Button
    android:layout_height="wrap_content"
    android:layout_width="wrap_content"
    android:background="@drawable/myninepatch" />
```

#### 2.2.2 XML Nine-Patch

文件位置

- `res/drawable/filename.xml`

编译的资源数据类型

- `NinePatchDrawable`

资源引用

- 在Java中：`R.drawable.filename`
- 在XML中：`@[package:]drawable/filename`

语法

```xml
<?xml version="1.0" encoding="utf-8"?>
<nine-patch
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:src="@[package:]drawable/drawable_resource"
    android:dither=["true" | "false"] />
```

元素

- `<nine-patch>`   
    - `android:src`  
      `Drawable resource`。**必备**。引用Nine-Patch文件。
    - `android:dither`
      `Boolean`。当位图的像素配置与屏幕不同时(例如：ARGB 8888 位图和 RGB 565 屏幕)，启用或停用位图抖动。

示例

```xml
<?xml version="1.0" encoding="utf-8"?>
<nine-patch xmlns:android="http://schemas.android.com/apk/res/android"
    android:src="@drawable/myninepatch"
    android:dither="false" />
```


### 2.3 Layer List

`LayerDrawable`是管理其他drawable的drawable。列表中的每个drawable按照列表的顺序绘制，列表中的最后一个drawable绘于顶部。

每个drawable由单一`<layer-list>`元素内的`<item>`元素表示。

文件位置

- `res/drawable/filename.xml`

编译的资源数据类型

- `LayerDrawable`

资源引用

- 在Java中：`R.drawable.filename`
- 在XML中：`@[package:]drawable/filename`

语法
```xml
<?xml version="1.0" encoding="utf-8"?>
<layer-list
    xmlns:android="http://schemas.android.com/apk/res/android" >
    <item
        android:drawable="@[package:]drawable/drawable_resource"
        android:id="@[+][package:]id/resource_name"
        android:top="dimension"
        android:right="dimension"
        android:bottom="dimension"
        android:left="dimension" />
</layer-list>
```

元素

- `<layer-list>`  
  **必备**。这必须是根元素。包含一个或多个`<item>`元素。  
- `<item>`  
    定义要放在layer drawable中由其属性定义的位置的drawable。必须是`<selector>`元素的子项。接受子`<bitmap>`元素。
    - `android:drawable`  
    *Drawable resource*。**必备**。引用drawable resource
    - `android:id`  
    *Resource ID*。此为drawable的唯一ID。要为此项新建resource ID，需要使用以下形式：`@+id/name`。加号表示应创建为新ID。可以使用此ID检索和修改具有`View.findViewById()`或`Activity.findViewById()`的drawable。
    - `android:top`  
    整型。顶部偏移(像素)
    - `android:right`  
    整型。右边偏移(像素)
    - `android:bottom`  
    整型。底部偏移(像素)
    - `android:left`  
    整型。左边偏移(像素)  
    默认情况下，所有drawable都会缩放以适应包含View的大小。因此，将图像放在layer list中的不同位置可能会增大View的大小，并且有些图像会相应地缩放。为避免缩放list中的项目，请在`<item>`元素内使用`<bitmap>`元素指定drawable，并且对某些不缩放的项目（例如 "center"）定义gravity。例如，以下`<item>`定义缩放以适应其容器View的项目：  

    ```xml
    <item android:drawable="@drawable/image" />
    ```
    为避免缩放，以下示例使用gravity居中的`<bitmap>`元素：

    ```xml
    <item>
      <bitmap android:src="@drawable/image"
              android:gravity="center" />
    </item>
    ```

示例  

- XML文件保存在`res/drawable/layers.xml`中：

    ```xml
    <?xml version="1.0" encoding="utf-8"?>
    <layer-list xmlns:android="http://schemas.android.com/apk/res/android">
        <item>
          <bitmap android:src="@drawable/android_red"
            android:gravity="center" />
        </item>
        <item android:top="10dp" android:left="10dp">
          <bitmap android:src="@drawable/android_green"
            android:gravity="center" />
        </item>
        <item android:top="20dp" android:left="20dp">
          <bitmap android:src="@drawable/android_blue"
            android:gravity="center" />
        </item>
    </layer-list>
    ```

    请注意，此示例使用嵌套的`<bitmap>`元素为每个具有“中心”gravity的项目定义drawableresource。这可确保没有图像会为了适应容器的大小而缩放，因为偏移图像会造成大小调整。

- 此布局`XML`会将drawable应用到视图，结果导致一堆不断偏移的图像

    ```xml
    <ImageView
        android:layout_height="wrap_content"
        android:layout_width="wrap_content"
        android:src="@drawable/layers" />
    ```
    
    ![layers](/assets/images/android/drawable-layers.png)

### 2.4 State List

`StateListDrawable`是在XML中定义的drawable，它根据对象的状态，使用多个不同的图像来表示同一个图形。例如，`Button`小部件可以是多种不同状态（`pressed`、`focused`或这两种状态都不是）中的其中一种，而且可以利用state list drawable为每种状态提供不同的背景图片。

可以在`XML`文件中描述state list。每个图形由单一`<selector>`元素内的`<item>`元素表示。每个`<item>`均使用各种属性来描述应用作drawable的图形的状态。

!!! warning
    在每个状态变更期间，将从上到下遍历状态列表，并使用第一个与当前状态匹配的项目 —此选择并非基于“最佳匹配”，而是选择符合状态最低条件的第一个项目。

文件位置

- `res/drawable/filename.xml`

编译的资源数据类型

- `StateListDrawable`

资源引用

- 在Java中：`R.drawable.filename`
- 在XML中：`@[package:]drawable/filename`

语法

```xml
<?xml version="1.0" encoding="utf-8"?>
<selector xmlns:android="http://schemas.android.com/apk/res/android"
    android:constantSize=["true" | "false"]
    android:dither=["true" | "false"]
    android:variablePadding=["true" | "false"] >
    <item
        android:drawable="@[package:]drawable/drawable_resource"
        android:state_pressed=["true" | "false"]
        android:state_focused=["true" | "false"]
        android:state_hovered=["true" | "false"]
        android:state_selected=["true" | "false"]
        android:state_checkable=["true" | "false"]
        android:state_checked=["true" | "false"]
        android:state_enabled=["true" | "false"]
        android:state_activated=["true" | "false"]
        android:state_window_focused=["true" | "false"] />
</selector>
```

元素

- `<selector>`  
  **必备**。这必须是根元素。包含一个或多个`<item>`元素。
    - `android:constantSize`  
    *Boolean*。如果drawable报告的内部大小在状态变更时保持不变，则值为“true”（大小是所有状态的最大值）；如果大小根据当前状态而变化，则值为“false”。默认值为 false。
    - `android:dither`  
    *Boolean*。值为“true”时，将在位图的像素配置与屏幕不同时（例如：ARGB 8888 位图和 RGB 565 屏幕）启用位图的抖动；值为“false”时则停用抖动。默认值为 true。
    - android:variablePadding  
    *Boolean*。如果drawable的内边距应根据选择的当前状态而变化，则值为“true”；如果内边距应保持不变（基于所有状态的最大内边距），则值为“false”。启用此功能要求您在状态变更时处理执行布局，这通常不受支持。默认值为 false。  
- `<item>`  
  定义要在某些状态期间使用的drawable，如其属性所述。必须是`<selector>`元素的子项。  
    - `android:drawable`  
    *Drawable resource*。**必备**。引用drawable资源。
    - `android:state_pressed`  
    *Boolean*。如果在按下对象（例如触摸/点按某按钮）时应使用此项目，则值为“true”；如果在默认的未按下状态时应使用此项目，则值为“false”。
    - `android:state_focused`  
    *Boolean*。如果在对象具有输入焦点（例如当用户选择文本输入时）时应使用此项目，则值为“true”；如果在默认的非焦点状态时应使用此项目，则值为“false”。
    - `android:state_hovered`  
    *Boolean*。如果当光标悬停在对象上时应使用此项目，则值为“true”；如果在默认的非悬停状态时应使用此项目，则值为“false”。通常，这个drawable可能与用于“聚焦”状态的drawable相同。  
    此项为 API 级别 14 新引入的配置。
    - `android:state_selected`  
    *Boolean*。如果在使用定向控件浏览（例如使用方向键浏览列表）的情况下对象为当前用户选择时应使用此项目，则值为“true”；如果在未选择对象时应使用此项目，则值为“false”。  
    当焦点 (android:state_focused) 不充分（例如，列表视图有焦点但使用方向键选择其中的项目）时，使用所选状态。
    - `android:state_checkable`  
    *Boolean*。如果当对象可选中时应使用此项目，则值为“true”；如果当对象不可选中时应使用此项目，则值为“false”。（仅当对象可在可选中与不可选中小部件之间转换时才有用。）
    - `android:state_checked`    
    *Boolean*。如果在对象已选中时应使用此项目，则值为“true”；如果在对象未选中时应使用此项目，则值为“false”。
    - `android:state_enabled`  
    *Boolean*。如果在对象启用（能够接收触摸/点击事件）时应使用此项目，则值为“true”；如果在对象停用时应使用此项目，则值为“false”。
    - `android:state_activated`  
    *Boolean*。如果在对象激活作为持续选择（例如，在持续导航视图中“突出显示”之前选中的列表项）时应使用此项目，则值为“true”；如果在对象未激活时应使用此项目，则值为“false”。  
    此项为 API 级别 11 新引入的配置。
    - `android:state_window_focused`  
    *Boolean*。如果当应用窗口有焦点（应用在前台）时应使用此项目，则值为“true”；如果当应用窗口没有焦点（例如，通知栏下拉或对话框出现）时应使用此项目，则值为“false”。  

> 注：请记住，Android 将应用状态列表中第一个与对象当前状态匹配的项目。因此，如果列表中的第一个项目不含上述任何状态属性，则每次都会应用它，这就是默认值应始终放在最后的原因（如以下示例所示）。

示例

- XML文件保存在`res/drawable/button.xml`中

    ```xml
    <?xml version="1.0" encoding="utf-8"?>
    <selector xmlns:android="http://schemas.android.com/apk/res/android">
        <item android:state_pressed="true"
              android:drawable="@drawable/button_pressed" /> <!-- pressed -->
        <item android:state_focused="true"
              android:drawable="@drawable/button_focused" /> <!-- focused -->
        <item android:state_hovered="true"
              android:drawable="@drawable/button_focused" /> <!-- hovered -->
        <item android:drawable="@drawable/button_normal" /> <!-- default -->
    </selector>
    ```

- 此布局XML将state list drawable应用到按钮

    ```xml
    <Button
        android:layout_height="wrap_content"
        android:layout_width="wrap_content"
        android:background="@drawable/button" />
    ```

### 2.5 Level List

管理大量备选drawable的drawable，每个drawable都分配有最大的备选数量。使用`setLevel()`设置drawable的级别值会加载level list中 `android:maxLevel`值大于或等于传递到方法的值的drawable资源。

文件位置

- `res/drawable/filename.xml`

编译的资源数据类型

- `LevelListDrawable`

资源引用

- 在Java中：`R.drawable.filename`
- 在XML中：`@[package:]drawable/filename`

语法

```xml
<?xml version="1.0" encoding="utf-8"?>
<level-list
    xmlns:android="http://schemas.android.com/apk/res/android" >
    <item
        android:drawable="@drawable/drawable_resource"
        android:maxLevel="integer"
        android:minLevel="integer" />
</level-list>
```

元素

- `<level-list>`  
  这必须是根元素。包含一个或多个`<item>`元素。
- `<item>`  
  定义要在某特定level使用的drawable。  
    - `android:drawable`  
      *Drawable resource*。**必备**。引用要插入的drawable资源。
    - `android:maxLevel`  
      *Integer*。此item允许的最高级别。
    - `android:minLevel`  
      *Integer*。此item允许的最低级别。

示例

```xml
<?xml version="1.0" encoding="utf-8"?>
<level-list xmlns:android="http://schemas.android.com/apk/res/android" >
    <item
        android:drawable="@drawable/status_off"
        android:maxLevel="0" />
    <item
        android:drawable="@drawable/status_on"
        android:maxLevel="1" />
</level-list>
```

在此项目应用到`View`后，可通过`setLevel()`或`setImageLevel()`更改level。

### 2.6 Transition Drawable

`TransitionDrawable`是可在两种drawable资源之间交错淡出的drawable。

每个drawable由单一`<transition>`元素内的`<item>`元素表示。不支持超过两个项目。要向前转换，请调用`startTransition()`。要向后转换，则调用`reverseTransition()`。

文件位置

- `res/drawable/filename.xml`

编译的资源数据类型

- `TransitionDrawable`

资源引用

- 在Java中：`R.drawable.filename`
- 在XML中：`@[package:]drawable/filename`

语法

```xml
<?xml version="1.0" encoding="utf-8"?>
<transition
xmlns:android="http://schemas.android.com/apk/res/android" >
    <item
        android:drawable="@[package:]drawable/drawable_resource"
        android:id="@[+][package:]id/resource_name"
        android:top="dimension"
        android:right="dimension"
        android:bottom="dimension"
        android:left="dimension" />
</transition>
```

元素

- `<transition>`  
  这必须是根元素。包含一个或多个`<item>`元素。
- `<item>`  
  定义要用作drawable转换一部分的drawable。必须是`<transition>`元素的子项。接受子`<bitmap>`元素。  
    - `android:drawable`  
      *Drawable resource*。**必备**。引用要插入的drawable资源。
    - `android:id`  
      *Resource ID*。此drawable的唯一resource ID。要为此项新建resource ID，请使用以下形式："@+id/name"。加号表示应创建为新ID。可以使用此ID检索和修改具有`View.findViewById()`或`Activity.findViewById()`的drawable。
    - `android:top`  
      *Integer*。顶部偏移（像素）。
    - `android:right`  
      *Integer*。右边偏移（像素）。
    - `android:bottom`  
      *Integer*。底部偏移（像素）。
    - `android:left`  
      *Integer*。左边偏移（像素）。

示例

- XML文件保存在`res/drawable/transition.xml`中：
    ```xml
    <?xml version="1.0" encoding="utf-8"?>
    <transition xmlns:android="http://schemas.android.com/apk/res/android">
        <item android:drawable="@drawable/on" />
        <item android:drawable="@drawable/off" />
    </transition>
    ```

- 此布局XML会将drawable应用到视图：
    ```xml
    <ImageButton
        android:id="@+id/button"
        android:layout_height="wrap_content"
        android:layout_width="wrap_content"
        android:src="@drawable/transition" />
    ```

- 以下代码从第一个item到第二个iten执行500ms的转换：
    ```java
    ImageButton button = (ImageButton) findViewById(R.id.button);
    TransitionDrawable drawable = (TransitionDrawable) button.getDrawable();
    drawable.startTransition(500);
    ```

### 2.7 Inset Drawable

在XML文件中定义的以指定距离插入其他drawable的drawable。当视图需要小于视图实际边界的背景时，此类drawable很有用。

文件位置

- `res/drawable/filename.xml`

编译的资源数据类型

- `InsetDrawable`

资源引用

- 在Java中：`R.drawable.filename`
- 在XML中：`@[package:]drawable/filename`

语法

```xml
<?xml version="1.0" encoding="utf-8"?>
<inset
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:drawable="@drawable/drawable_resource"
    android:insetTop="dimension"
    android:insetRight="dimension"
    android:insetBottom="dimension"
    android:insetLeft="dimension" />
```

元素

- `<inset>`  
  定义插入drawable。这必须是根元素。
    - `android:drawable`  
      *Drawable resource*。**必备**。引用要插入的drawable资源。
    - `android:insetTop`  
      *Dimension*。顶部插入，以dimension value或dimension resource表示
    - `android:insetRight`  
      *Dimension*。右边插入，以dimension value或dimension resource表示
    - `android:insetBottom`  
      *Dimension*。底部插入，以dimension value或dimension resource表示
    - `android:insetLeft`  
      *Dimension*。左边插入，以dimension value或dimension resource表示

示例
```xml
<?xml version="1.0" encoding="utf-8"?>
<inset xmlns:android="http://schemas.android.com/apk/res/android"
    android:drawable="@drawable/background"
    android:insetTop="10dp"
    android:insetLeft="10dp" />
```

### 2.8 Clip Drawable

在XML文件中定义的对其他drawable进行裁剪（根据其当前级别）的drawable。可以根据级别以及用于控制其在整个容器中位置的`gravity`，来控制子drawable的裁剪宽度和高度。**通常用于实现进度栏之类的项目。**

文件位置

- `res/drawable/filename.xml`

编译的资源数据类型

- `ClipDrawable`

资源引用

- 在Java中：`R.drawable.filename`
- 在XML中：`@[package:]drawable/filename`

语法

```xml
<?xml version="1.0" encoding="utf-8"?>
<clip
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:drawable="@drawable/drawable_resource"
    android:clipOrientation=["horizontal" | "vertical"]
    android:gravity=["top" | "bottom" | "left" | "right" | "center_vertical" |
                     "fill_vertical" | "center_horizontal" | "fill_horizontal" |
                     "center" | "fill" | "clip_vertical" | "clip_horizontal"] />
```

元素

- `<clip>`  
  定义裁剪drawable。这必须是根元素。
    - `android:drawable`  
      *Drawable resource*。**必备**。引用要插入的drawable资源。
    - `android:clipOrientation`  
      *Keyword*。**必备**。引用要裁剪的drawable资源。

        | 值 | 说明 |
        | -- | --- |
        | horizontal | 水平裁剪drawable。 |
        | vertical | 垂直裁剪drawable。 |

    - `android:gravity`  
      *Keyword*。指定drawable中要裁剪的位置。  
      必须是以下一个或多个（用 '|' 分隔）常量值：

        | 值 | 说明 |
        | -- | --- |
        | top | 将对象放在其容器顶部，不改变其大小。当`clipOrientation`是 "vertical" 时，在drawable的底部裁剪。 |
        | bottom | 将对象放在其容器底部，不改变其大小。当`clipOrientation`是 "vertical" 时，在drawable的顶部裁剪。 |
        | left | 将对象放在其容器左边缘，不改变其大小。这是默认值。当`clipOrientation`是 "horizontal" 时，在drawable的右边裁剪。这是默认值。 |
        | right | 将对象放在其容器右边缘，不改变其大小。当`clipOrientation`是 "horizontal" 时，在drawable的左边裁剪。 |
        | center_vertical | 将对象放在其容器的垂直中心，不改变其大小。裁剪行为与gravity为 "center" 时相同。 |
        | fill_vertical | 按需要扩展对象的垂直大小，使其完全适应其容器。当`clipOrientation`是 "vertical" 时，不会进行裁剪，因为drawable会填充垂直空间（除非drawable级别为 0，此时它不可见）。 |
        | center_horizontal | 将对象放在其容器的水平中心，不改变其大小。裁剪行为与gravity为 "center" 时相同。 |
        | fill_horizontal | 按需要扩展对象的水平大小，使其完全适应其容器。当`clipOrientation`是 "horizontal" 时，不会进行裁剪，因为drawable会填充水平空间（除非drawable级别为 0，此时它不可见）。 |
        | center | 将对象放在其容器的水平和垂直轴中心，不改变其大小。当`clipOrientation`是 "horizontal" 时，在左边和右边裁剪。当`clipOrientation`是 "vertical" 时，在顶部和底部裁剪。 |
        | fill | 按需要扩展对象的垂直大小，使其完全适应其容器。不会进行裁剪，因为drawable会填充水平和垂直空间（除非drawable级别为 0，此时它不可见）。 |
        | clip_vertical | 可设置为让子元素的上边缘和/或下边缘裁剪至其容器边界的附加选项。裁剪基于垂直gravity：top gravity裁剪上边缘，bottom gravity裁剪下边缘，任一gravity不会同时裁剪两边。 |
        | clip_horizontal | 可设置为让子元素的左边和/或右边裁剪至其容器边界的附加选项。裁剪基于水平gravity：left gravity裁剪右边缘，right gravity裁剪左边缘，任一gravity不会同时裁剪两边。 |


示例

- XML文件保存在`res/drawable/clip.xml`中：
    ```xml
    <?xml version="1.0" encoding="utf-8"?>
    <clip xmlns:android="http://schemas.android.com/apk/res/android"
        android:drawable="@drawable/android"
        android:clipOrientation="horizontal"
        android:gravity="left" />
    ```

- 此布局XML会将drawable应用到视图：
    ```xml
    <ImageView
        android:id="@+id/image"
        android:background="@drawable/clip"
        android:layout_height="wrap_content"
        android:layout_width="wrap_content" />
    ```

- 以下代码从第一个item到第二个iten执行500ms的转换：
    ```java
    ImageView imageview = (ImageView) findViewById(R.id.image);
    ClipDrawable drawable = (ClipDrawable) imageview.getDrawable();
    drawable.setLevel(drawable.getLevel() + 1000);
    ```

增大级别可减少裁剪量并慢慢显示图像。此处的级别为 7000：

![layers](/assets/images/android/drawable-clip.png)

> 注：默认级别为 0，即完全裁剪，使图像不可见。当级别为 10,000 时，图像不会裁剪，而是完全可见。

### 2.9 Scale Drawable

在XML文件中定义的更改其他drawable大小（根据其当前级别）的drawable。

文件位置

- `res/drawable/filename.xml`

编译的资源数据类型

- `ScaleDrawable`

资源引用

- 在Java中：`R.drawable.filename`
- 在XML中：`@[package:]drawable/filename`

语法

```xml
<?xml version="1.0" encoding="utf-8"?>
<scale
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:drawable="@drawable/drawable_resource"
    android:scaleGravity=["top" | "bottom" | "left" | "right" | "center_vertical" |
                          "fill_vertical" | "center_horizontal" | "fill_horizontal" |
                          "center" | "fill" | "clip_vertical" | "clip_horizontal"]
    android:scaleHeight="percentage"
    android:scaleWidth="percentage" />
```

元素

- `<scale>`  
    定义裁剪drawable。这必须是根元素。
    - `android:drawable`  
      *Drawable resource*。**必备**。引用要插入的drawable资源。
    - `android:scaleGravity`  
      *Keyword*。指定缩放后的gravity位置。  
      必须是以下一个或多个（用 '|' 分隔）常量值：

        | 值 | 说明 |
        | -- | --- |
        | top	| 将对象放在其容器顶部，不改变其大小。 |
        | bottom	| 将对象放在其容器底部，不改变其大小。 |
        | left	| 将对象放在其容器左边缘，不改变其大小。 |
        | right	| 将对象放在其容器右边缘，不改变其大小。 |
        | center_vertical	| 将对象放在其容器的垂直中心，不改变其大小。 |
        | fill_vertical	| 按需要扩展对象的垂直大小，使其完全适应其容器。 |
        | center_horizontal	| 将对象放在其容器的水平中心，不改变其大小。 |
        | fill_horizontal	| 按需要扩展对象的水平大小，使其完全适应其容器。 |
        | center | 将对象放在其容器的水平和垂直轴中心，不改变其大小。 |
        | fill | 按需要扩展对象的垂直大小，使其完全适应其容器。这是默认值。 |
        | clip_vertical	| 可设置为让子元素的上边缘和/或下边缘裁剪至其容器边界的附加选项。裁剪基于垂直gravity：top gravity裁剪上边缘，bottom gravity裁剪下边缘，任一gravity不会同时裁剪两边。 |
        | clip_horizontal	| 可设置为让子元素的左边和/或右边裁剪至其容器边界的附加选项。裁剪基于水平gravity：left gravity裁剪右边缘，right gravity裁剪左边缘，任一gravity不会同时裁剪两边。 |

    - `android:scaleHeight`  
      *Percentage*。缩放高度，表示为drawable边界的百分比。值的格式为 XX%。例如：100%、12.5% 等。
    - `android:scaleWidth`  
      *Percentage*。缩放宽度，表示为drawable边界的百分比。值的格式为 XX%。例如：100%、12.5% 等。

示例

```xml
<?xml version="1.0" encoding="utf-8"?>
<scale xmlns:android="http://schemas.android.com/apk/res/android"
    android:drawable="@drawable/logo"
    android:scaleGravity="center_vertical|center_horizontal"
    android:scaleHeight="80%"
    android:scaleWidth="80%" />
```

### 2.10 Shape Drawable
这是在XML中定义的一般形状。

文件位置

- `res/drawable/filename.xml`

编译的资源数据类型

- `GradientDrawable`

资源引用

- 在Java中：`R.drawable.filename`
- 在XML中：`@[package:]drawable/filename`

语法

```xml
<?xml version="1.0" encoding="utf-8"?>
<shape
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape=["rectangle" | "oval" | "line" | "ring"] >
    <corners
        android:radius="integer"
        android:topLeftRadius="integer"
        android:topRightRadius="integer"
        android:bottomLeftRadius="integer"
        android:bottomRightRadius="integer" />
    <gradient
        android:angle="integer"
        android:centerX="float"
        android:centerY="float"
        android:centerColor="integer"
        android:endColor="color"
        android:gradientRadius="integer"
        android:startColor="color"
        android:type=["linear" | "radial" | "sweep"]
        android:useLevel=["true" | "false"] />
    <padding
        android:left="integer"
        android:top="integer"
        android:right="integer"
        android:bottom="integer" />
    <size
        android:width="integer"
        android:height="integer" />
    <solid
        android:color="color" />
    <stroke
        android:width="integer"
        android:color="color"
        android:dashWidth="integer"
        android:dashGap="integer" />
</shape>
```

元素

- `<shape>`  
    The shape drawable。这必须是根元素。
    - `android:shape`  
      *Keyword*。定义形状的类型。有效值为:

        | 值 | 说明 |
        | -- | --- |
        | rectangle	| 填充包含视图的矩形。这是默认形状。 |
        | oval	| 适应包含视图尺寸的椭圆形状。 |
        | line	| 跨越包含视图宽度的水平线。此形状需要`<stroke>`元素定义线宽。 |
        | ring	| 环形。 |

    - 仅当`android:shape="ring"`如下时才使用以下属性：  
    - `android:innerRadius`  
      *Dimension*。环内部（中间的孔）的半径，以dimension value或dimension resource表示。
    - `android:innerRadiusRatio`  
      *Float*。环内部的半径，以环宽度的比率表示。例如，如果`android:innerRadiusRatio="5"`，则内半径等于环宽度除以5。此值被 `android:innerRadius`覆盖。默认值为9。
    - `android:thickness`  
      *Dimension*。环的厚度，以dimension value或dimension resource表示。
    - `android:thicknessRatio`  
      *Float*。环的厚度，表示为环宽度的比率。例如，如果`android:thicknessRatio="2"`，则厚度等于环宽度除以2。此值被`android:innerRadius`覆盖。默认值为3。
    - `android:useLevel`  
      *Boolean*。如果这用作`LevelListDrawable`，则此值为“true”。这通常应为“false”，否则形状不会显示。

- `<corners>`  
  为形状产生圆角。仅当形状为矩形时适用。
    - `android:radius`  
      *Dimension*。所有角的半径，以dimension value或dimension resource表示。对于每个角，这会被以下属性覆盖。
    - `android:topLeftRadius`  
      *Dimension*。左上角的半径，以dimension value或dimension resource表示。
    - `android:topRightRadius`  
      *Dimension*。右上角的半径，以dimension value或dimension resource表示。
    - `android:bottomLeftRadius`  
      *Dimension*。左下角的半径，以dimension value或dimension resource表示。
    - `android:bottomRightRadius`  
      *Dimension*。右下角的半径，以dimension value或dimension resource表示。
      > **Note**：必须为每个角（初始）提供大于1的角半径，否则无法产生圆角。如果希望特定角不要圆角，解决方法是使用`android:radius`设置大于1的默认角半径，然后使用实际所需的值替换每个角，为不希望圆角的角设置零（“0dp”）。

- `<gradient>`  
  指定形状的渐变颜色。
    - `android:angle`  
      *Integer*。渐变的角度（度）。0为从左到右，90为从上到上。必须是45的倍数。默认值为0。
    - `android:centerX`  
      *Float*。渐变中心的相对X轴位置 (0 - 1.0)。
    - `android:centerY`  
      *Float*。渐变中心的相对Y轴位置 (0 - 1.0)。
    - `android:centerColor`  
      *Color*。起始颜色与结束颜色之间的可选颜色，以十六进制值或颜色资源表示。
    - `android:endColor`  
      *Color*。结束颜色，表示为十六进制值或颜色资源。
    - `android:gradientRadius`  
      *Float*。渐变的半径。仅在`android:type="radial"`时适用。
    - `android:startColor`  
      *Color*。起始颜色，表示为十六进制值或颜色资源。
    - `android:type`  

        | 值 | 说明 |
        | -- | --- |
        | linear	| 线性渐变。这是默认值 |
        | radial	| 径向渐变。起始颜色为中心颜色 |
        | sweep	| 流线型渐变 |

    - `android:useLevel`  
      *Boolean*。如果这用作`LevelListDrawable`，则此值为“true”。

- `<padding>`  
  要应用到包含视图元素的内边距（这会填充视图内容的位置，而非形状）。  
    - `android:left`  
      *Dimension*。左内边距，以dimension value或dimension resource表示
    - `android:top`  
      *Dimension*。上内边距，以dimension value或dimension resource表示
    - `android:right`  
      *Dimension*。右内边距，以dimension value或dimension resource表示
    - `android:bottom`  
      *Dimension*。下内边距，以dimension value或dimension resource表示

- `<size>`  
    形状的大小。
    - `android:height`  
      *Dimension*。shape的高度，以dimension value或dimension resource表示
    - `android:width`  
      *Dimension*。shape的宽度，以dimension value或dimension resource表示
      > 注：默认情况下，shape按照此处定义的尺寸按比例缩放至容器视图的大小。在`ImageView`中使用shape时，可通过将`android:scaleType`设置为 `center`来限制缩放。

- `<solid>`  
  用于填充shape的纯色。
    - `android:color`  
      *Color*。应用于shape的颜色，以十六进制值或颜色资源表示。

- `<stroke>`  
  shape的实心线。
    - `android:width`  
      *Dimension*。线宽，以dimension value或dimension resource表示。
    - `android:color`  
      *Color*。线的颜色，表示为十六进制值或颜色资源。
    - `android:dashGap`  
      *Dimension*。短划线的间距，以dimension value或dimension resource表示。仅在设置了`android:dashWidth`时有效。
    - `android:dashWidth`  
      *Dimension*。每个短划线的大小，以dimension value或dimension resource表示。仅在设置了`android:dashGap`时有效。

示例  

- XML文件保存在`res/drawable/gradient_box.xml`中

    ```xml
    <?xml version="1.0" encoding="utf-8"?>
    <shape xmlns:android="http://schemas.android.com/apk/res/android"
        android:shape="rectangle">
        <gradient
            android:startColor="#FFFF0000"
            android:endColor="#80FF00FF"
            android:angle="45"/>
        <padding android:left="7dp"
            android:top="7dp"
            android:right="7dp"
            android:bottom="7dp" />
        <corners android:radius="8dp" />
    </shape>
    ```

- 此布局XML会将shape drawable应用到视图：

    ```xml
    <TextView
        android:background="@drawable/gradient_box"
        android:layout_height="wrap_content"
        android:layout_width="wrap_content" />
    ```

- 此应用代码将获取shape drawable，并将其应用到视图：

    ```java
    Resources res = getResources();
    Drawable shape = res. getDrawable(R.drawable.gradient_box);
    
    TextView tv = (TextView)findViewByID(R.id.textview);
    tv.setBackground(shape);
    ```

## 3 Drawable例子

例1：selector + shape 完成按钮的背景效果

```xml
<?xml version="1.0" encoding="utf-8"?>
<selector xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:state_pressed="true">
        <shape
            android:shape="rectangle">
            <solid android:color="@color/eeeeee"/>
            <corners android:radius="@dimen/dp_12"/>
        </shape>
    </item>
    <item>
        <shape
            android:shape="rectangle">
            <solid android:color="@color/f5f5f5"/>
            <corners android:radius="@dimen/dp_12"/>
        </shape>
    </item>
</selector>
```

第一个item是默认状态下的效果，第二个是点击状态下的效果，如下：
![shape_selector](/assets/images/android/drawable-shape_selector.png)


例2：selector + layer list + shape完成复杂的RadioGroup选中图案
```xml
<?xml version="1.0" encoding="utf-8"?>
<selector xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:state_checked="true">
        <layer-list>
            <item>
                <shape android:shape="rectangle">
                    <solid android:color="@color/ff03a3ff" />
                </shape>
            </item>
            <item
                android:top="@dimen/dp_2"
                android:left="@dimen/dp_0.5"
                android:right="@dimen/dp_0.5">
                <shape android:shape="rectangle">
                    <solid android:color="@color/white" />
                </shape>
            </item>
        </layer-list>
    </item>
    <item android:drawable="@color/f3f4f5" android:state_pressed="true" />
    <item>
        <layer-list>
            <item>
                <shape android:shape="rectangle">
                    <solid android:color="@color/dcdcdc" />
                </shape>
            </item>
            <item
                android:top="@dimen/dp_0.5"
                android:bottom="@dimen/dp_0.5">
                <shape android:shape="rectangle">
                    <solid android:color="@color/white" />
                </shape>
            </item>
        </layer-list>
    </item>
</selector>
```
上面xml分别表示了选中状态、点击以及正常情况下的样子

正常、点击、选中状态的drawable如前三个RadioButton所示：
![radiobutton_selector](/assets/images/android/drawable-radiobutton_selector.png)
