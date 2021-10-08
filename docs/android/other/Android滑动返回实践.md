---
title: "Android滑动返回实践"
---

## 1. 前言
限于历史原因，滑动返回三方库采用了[anzewei/ParallaxBackLayout](https://github.com/anzewei/ParallaxBackLayout)  

在项目中可以正常使用，功能算是有了，但是有一个问题不能忍——statusbar在滑动的时候没有反应

## 2. 如何解决
因为`Activity`非常多，所以一个个Activity来处理肯定不是效率最高的。因此我想着从`styles.xml`以及`BaseActivity`处下手。

**处理前**
```xml
<style name="MyAppTheme" parent="Theme.AppCompat.Light.NoActionBar">
    <item name="colorPrimary">@color/colorPrimary</item>
    <item name="colorPrimaryDark">@color/colorPrimaryDark</item>
    <item name="colorAccent">@color/colorAccent</item>
    <item name="android:statusBarColor">@color/white</item>
    <item name="android:windowBackground">@color/colorWindow</item>
    <item name="android:windowAnimationStyle">@style/MyWindowAnimTheme</item>
</style>
```

这里主要是两个属性:状态栏颜色以及Activity默认背景色

**第一次尝试**
```xml
<style name="MyAppTheme" parent="Theme.AppCompat.Light.NoActionBar">
    <item name="colorPrimary">@color/colorPrimary</item>
    <item name="colorPrimaryDark">@color/colorPrimaryDark</item>
    <item name="colorAccent">@color/colorAccent</item>
    <item name="android:windowTranslucentStatus">false</item>
    <item name="android:windowDrawsSystemBarBackgrounds">true</item>
    <item name="android:statusBarColor">@color/white</item>
    <item name="android:windowBackground">@color/colorWindow</item>
    <item name="android:windowAnimationStyle">@style/MyWindowAnimTheme</item>
</style>
```

此次尝试发现没有效果

**第二次尝试**
```xml
<style name="MyAppTheme" parent="Theme.AppCompat.Light.NoActionBar">
    <item name="colorPrimary">@color/colorPrimary</item>
    <item name="colorPrimaryDark">@color/colorPrimaryDark</item>
    <item name="colorAccent">@color/colorAccent</item>
    <item name="android:windowTranslucentStatus">false</item>
    <item name="android:windowDrawsSystemBarBackgrounds">true</item>
    <item name="android:statusBarColor">@android:color/transparent</item>
    <item name="android:windowBackground">@color/colorWindow</item>
    <item name="android:windowAnimationStyle">@style/MyWindowAnimTheme</item>
</style>
```
发现statusbar颜色设置为有透明度的，这样就有效果了。因此应该是statusbar的颜色遮住了滑动返回时view在状态栏下面的变化。  
但是又有一个新的问题，状态栏现在是没有颜色的，因此我们只能通过设置window的背景色来达到给状态栏上色的，然后设置contentView的背景色为原来window的背景色

**Final尝试**

设置windowBackground为状态栏的颜色
```xml
<style name="MyAppTheme" parent="Theme.AppCompat.Light.NoActionBar">
    <item name="colorPrimary">@color/colorPrimary</item>
    <item name="colorPrimaryDark">@color/colorPrimaryDark</item>
    <item name="colorAccent">@color/colorAccent</item>
    <item name="android:windowTranslucentStatus">false</item>
    <item name="android:windowDrawsSystemBarBackgrounds">true</item>
    <item name="android:statusBarColor">@android:color/transparent</item>
    <item name="android:windowBackground">@color/white</item>
    <item name="android:windowAnimationStyle">@style/MyWindowAnimTheme</item>
</style>
```

设置contentView的背景色为原来Window的颜色
```java
// BaseActivity.java
@Override
public void onContentChanged() {
    super.onContentChanged();
    setStatusBar();
    View contentView = findViewById(android.R.id.content);
    if (contentView != null) {
        contentView.setBackgroundResource(R.color.colorWindow);
    }
}
```

至于为什么选择在`onContentChanged`方法里面设置contentView的背景色。  
这是因为`setContentView`的三个重载方法以及`addContentView`方法，最后都会回调该方法。

具体源码在`AppCompatDelegateImplV9`中
```java
@Override
public void setContentView(View v) {
   ensureSubDecor();
   ViewGroup contentParent = (ViewGroup) mSubDecor.findViewById(android.R.id.content);
   contentParent.removeAllViews();
   contentParent.addView(v);
   mOriginalWindowCallback.onContentChanged();
}

@Override
public void setContentView(int resId) {
   ensureSubDecor();
   ViewGroup contentParent = (ViewGroup) mSubDecor.findViewById(android.R.id.content);
   contentParent.removeAllViews();
   LayoutInflater.from(mContext).inflate(resId, contentParent);
   mOriginalWindowCallback.onContentChanged();
}

@Override
public void setContentView(View v, ViewGroup.LayoutParams lp) {
   ensureSubDecor();
   ViewGroup contentParent = (ViewGroup) mSubDecor.findViewById(android.R.id.content);
   contentParent.removeAllViews();
   contentParent.addView(v, lp);
   mOriginalWindowCallback.onContentChanged();
}

@Override
public void addContentView(View v, ViewGroup.LayoutParams lp) {
   ensureSubDecor();
   ViewGroup contentParent = (ViewGroup) mSubDecor.findViewById(android.R.id.content);
   contentParent.addView(v, lp);
   mOriginalWindowCallback.onContentChanged();
}
```

这个位置的`mOriginalWindowCallback`就是`AppCompatActivity`,我们看看源码
```java
public class AppCompatActivity extends FragmentActivity implements AppCompatCallback, SupportParentable, DelegateProvider

// ---------
@NonNull
public AppCompatDelegate getDelegate() {
    if (this.mDelegate == null) {
        this.mDelegate = AppCompatDelegate.create(this, this);
    }

    return this.mDelegate;
}

// ---------
public static AppCompatDelegate create(Activity activity, AppCompatCallback callback)
```

最后上一段Final版本效果的视频

<iframe width="320" height="568" src="/assets/videos/swipe_back.mp4" frameborder="0" allowfullscreen></iframe>
