---
title: "Android判断虚拟按键(导航栏)显示与否、高度以及获取屏幕实际高度"
---

最近发现了一个Bug：网络异常时弹出SnackBar提示检查网络。

但是当有导航栏存在时，SnackBar会出现在导航栏的下面，被导航栏覆盖掉，导致不能点击。这段代码如下所示：
```java
final ViewGroup viewGroup = (ViewGroup) findViewById(android.R.id.content).getRootView();
snackBar = Snackbar.make(viewGroup, "网络不可用，请检查网络设置", Snackbar.LENGTH_LONG);
snackBar.getView().setBackgroundResource(R.color.colorPrimary);
snackBar.setActionTextColor(Color.WHITE);
snackBar.setAction("现在去", new View.OnClickListener() {
    @Override
    public void onClick(View v) {
        startActivity(new Intent(Settings.ACTION_SETTINGS));
    }
}).show();
```
后来研究了下，发现只需要改一句代码就可以了：
```java
final ViewGroup viewGroup = (ViewGroup) findViewById(android.R.id.content);
```
上面这段代码获取的是content View，然后其`getRootView()`就是DecorView了。所以其原因也就不难理解了。

但是在我研究途中，走了不少弯路。我想了这个方法：  
**判断NavigationBar存在与否；若存在，获取其高度，给SnackBar设置bottomMargin。**

## 1 走的弯路

### 1.1 判断Navigation存在与否

这个只能根据Android系统编译时生成的文件来判断，如果ROM支持动态设置的话，那就不行了。所以，还是有缺陷的。

原理的代码来自`PhoneWindowManager#setInitialDisplaySize`：
```java
boolean mHasNavigationBar = res.getBoolean(com.android.internal.R.bool.config_showNavigationBar);

// Allow a system property to override this. Used by the emulator.
// See also hasNavigationBar().
String navBarOverride = SystemProperties.get("qemu.hw.mainkeys");
if ("1".equals(navBarOverride)) {
    mHasNavigationBar = false;
} else if ("0".equals(navBarOverride)) {
    mHasNavigationBar = true;
}
```
简单的来说，就是判断AOSP里`frameworks/base/core/res/res/values/config.xml`里面`config_showNavigationBar`是否是`true`，然后在根据手机目录`system/build.prop`里面`qemu.hw.mainkeys`的值来判断。

**上面这段代码是不能直接运行的**，首先`config_showNavigationBar`的值不能直接获取，需要先获取其resId然后在获取其值。
```java
int resourceId = resources.getIdentifier("config_showNavigationBar","bool", "android");
boolean mHasNavigationBar = resources.getBoolean(resourceId);
```

题外话：按照同样的原理，将上面的`config_showNavigationBar`换成`status_bar_height`就可以获取状态栏的高度。

获取statusbar的高度可以使用这个方法
```java
public static int getStatusBarHeight(Context context) {
    int result = 0;
    int resourceId = context.getResources().getIdentifier("status_bar_height", "dimen", "android");
    if (resourceId > 0) {
        result = context.getResources().getDimensionPixelSize(resourceId);
    }
    return result;
}
```

其次，`SystemProperties`的API在普通应用也是获取不到的。但是`SystemProperties`中的值可以简单的理解为记录在`system/build.prop`中这个文件中。我们可以通过Runtime.exec读取该文件，获取`qemu.hw.mainkeys`属性的值。

目前，博主在阅读[滴滴的开源项目VirtualAPK](https://github.com/didi/VirtualAPK)时，学会了不用通过读`system/build.prop`就可以获取系统变量的方法了。原理是Fake SystemProperties文件。

### 1.2 获取NavigationBar的高度
这步也是和上面`config_showNavigationBar`获取一样：
```java
int resourceId = resources.getIdentifier("navigation_bar_height","dimen", "android");
int navigationBarHeight = resources.getDimensionPixelSize(resourceId);
```
**这只是获取config.xml里面的大小，其值与导航栏出现与否无关，都是大于0的**。

### 1.3 给SnackBar设置bottomMargin
```java
((ViewGroup.MarginLayoutParams) snackBar.getView().getLayoutParams()).bottomMargin = navigationBarHeight;
```

### 1.4 弯路总结
**实际上，这个方法还不是完美的。因为这个是根据Android系统编译时生成的文件来判断，如果ROM支持动态设置的话，那就不行了。**

## 2 由Bug启发的获取屏幕实际高度的方法

当然最后我才意识到，**可以通过对比屏幕可用高度以及DecorView的高度是否一样来判断NavigationBar是否显示出来了。**

我们可以看到DecorView处于最底层，其上面有statusbar、actionbar、content以及navigationbar。屏幕可用高度是不会包括navigationbar的。

所以我们可以判断DecorView的高度与可用屏幕高度是否相等来判断是否有导航栏，因为导航栏是不会计算到可用屏幕高度中的。

![DecorView上大致的布局](/assets/images/android/DecorView上大致的布局.png)

具体判断NavigationBar是否存在的代码如下
```java
private void test() {
   getWindow().getDecorView().post(mRunnable);
}
private Runnable mRunnable = new Runnable() {
    @Override
    public void run() {
        int decorViewHeight = getWindow().getDecorView().getHeight();
        DisplayMetrics dm = new DisplayMetrics();
        getWindowManager().getDefaultDisplay().getMetrics(dm);
        int useableScreenHeight = dm.heightPixels;
        boolean hasNavigation = decorViewHeight != useableScreenHeight;
    }
};
```

**因此，可以得出两个小技巧**：

1. **获取NavigationBar的高度**  
在上面的代码中，我们可以用DecorView的高度减去屏幕可用高度，若为0表示当前NavigationBar不占用高度；若不为0，则就是NavigationBar的高度
2. **获取整个屏幕的高度**  
DecorView的高度即为整个屏幕(包括NavigationBar)的高度

当然，还有一种更简单的方法`getRealSize`，不过需要API Level 17或以上才能使用
```java
WindowManager wm = (WindowManager) getSystemService(WINDOW_SERVICE);
Display display = wm.getDefaultDisplay();
Point size = new Point();
display.getRealSize(size);
```
