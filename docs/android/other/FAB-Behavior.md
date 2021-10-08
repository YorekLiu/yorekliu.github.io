---
title: "FloatingActionButton上滑隐藏下滑显示"
---

此交互是FAB的经典交互了，具体效果见如下视频：

<iframe width="320" height="568" src="/assets/videos/fab_behavior.mp4" frameborder="0" allowfullscreen></iframe>

可以看到`RecyclerView`占满整个屏幕后，`RecyclerView`继续上滑会使`FloatingActionButton`隐藏，`RecyclerView`向下滑动会使`FloatingActionButton`显示。  

>这个交互是通过给`FloatingActionButton`配置`app:layout_behavior`属性实现的。但是，需要注意的是：
>1. 页面根布局必须是`CoordinatorLayout`
>2. `RecyclerView`必须配置成`app:layout_behavior="@string/appbar_scrolling_view_behavior"`

---

下面奉上实现此效果的代码：  
**1. xml文件代码**

```xml
<?xml version="1.0" encoding="utf-8"?>
<android.support.design.widget.CoordinatorLayout
    xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    xmlns:tools="http://schemas.android.com/tools"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:fitsSystemWindows="true"
    tools:context="com.yorek.yltodo.ui.activity.TodoFolderActivity">

    <android.support.design.widget.AppBarLayout
        android:id="@+id/app_bar"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:fitsSystemWindows="true"
        android:background="@android:color/white">
        <android.support.design.widget.CollapsingToolbarLayout
            android:id="@+id/toolbar_layout"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:fitsSystemWindows="true"
            app:layout_scrollFlags="scroll|exitUntilCollapsed"
            app:titleEnabled="false">
            <RelativeLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:layout_gravity="bottom"
                android:layout_marginTop="?attr/actionBarSize"
                app:layout_collapseMode="parallax"
                app:layout_collapseParallaxMultiplier="0.5"
                android:background="@android:color/white">
                <ImageView
                    android:id="@+id/iv_folder_icon"
                    android:layout_width="48dp"
                    android:layout_height="48dp"
                    android:layout_alignParentStart="true"
                    android:layout_marginStart="24dp"
                    android:background="@drawable/bg_task_circle_ededed"
                    android:scaleType="centerInside"
                    android:src="@drawable/ic_home_ff53c4ac_24dp"
                    android:transitionName="@string/transition_task_icon"/>
                <TextView
                    android:id="@+id/tv_folder_count"
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:layout_below="@id/iv_folder_icon"
                    android:layout_marginTop="24dp"
                    android:layout_marginStart="24dp"
                    android:textColor="@color/ff999999"
                    android:textSize="18sp"
                    android:transitionName="@string/transition_task_count"/>
                <TextView
                    android:id="@+id/tv_folder_progress_value"
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:layout_alignParentEnd="true"
                    android:layout_below="@id/tv_folder_count"
                    android:layout_marginTop="24dp"
                    android:layout_marginBottom="24dp"
                    android:layout_marginEnd="24dp"
                    android:textColor="#ff9d9d9d"
                    android:transitionName="@string/transition_task_progress_value"/>
                <ProgressBar
                    android:id="@+id/pb_folder_progress"
                    style="?android:attr/progressBarStyleHorizontal"
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:layout_alignBottom="@id/tv_folder_progress_value"
                    android:layout_alignParentStart="true"
                    android:layout_marginBottom="6dp"
                    android:layout_marginEnd="8dp"
                    android:layout_marginStart="24dp"
                    android:layout_toStartOf="@id/tv_folder_progress_value"
                    android:background="@color/ffebebeb"
                    android:max="100"
                    android:maxHeight="4dp"
                    android:minHeight="4dp"
                    android:progress="50"
                    android:transitionName="@string/transition_task_progress"/>
            </RelativeLayout>
            <android.support.v7.widget.Toolbar
                android:id="@+id/toolbar"
                android:layout_width="match_parent"
                android:layout_height="?attr/actionBarSize"
                app:navigationIcon="?attr/homeAsUpIndicator"
                app:layout_collapseMode="pin"
                android:theme="@style/AppTheme.AppBarOverlay"/>
        </android.support.design.widget.CollapsingToolbarLayout>
    </android.support.design.widget.AppBarLayout>

    <android.support.v7.widget.RecyclerView
        android:id="@+id/recycler_view"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:background="@android:color/white"
        app:layout_behavior="@string/appbar_scrolling_view_behavior"/>

    <android.support.design.widget.FloatingActionButton
        android:id="@+id/fab"
        android:layout_width="56dp"
        android:layout_height="56dp"
        android:layout_gravity="bottom|end"
        android:layout_margin="@dimen/fab_margin"
        android:src="@drawable/ic_add_white_24dp"
        app:backgroundTint="@color/ff497de2"
        app:fabSize="auto"
        app:layout_behavior="com.yorek.yltodo.ui.widget.behavior.ScrollAwareFABBehavior"
        app:rippleColor="@color/ff2b5ec1"/>

</android.support.design.widget.CoordinatorLayout>
```

上面强调了，`AppBarLayout`里面的内容不是必须的，根据自己的需求写。

**2. ScrollAwareFABBehavior代码**  

```java
package com.yorek.yltodo.ui.widget.behavior;

import android.content.Context;
import android.support.design.widget.CoordinatorLayout;
import android.support.design.widget.FloatingActionButton;
import android.support.v4.view.ViewCompat;
import android.support.v4.view.ViewPropertyAnimatorListener;
import android.support.v4.view.animation.FastOutSlowInInterpolator;
import android.util.AttributeSet;
import android.view.View;
import android.view.ViewGroup;
import android.view.animation.Interpolator;

public class ScrollAwareFABBehavior extends FloatingActionButton.Behavior {
    private static final Interpolator INTERPOLATOR = new FastOutSlowInInterpolator();
    private boolean mIsAnimatingOut = false;

    public ScrollAwareFABBehavior(Context context, AttributeSet attrs) {
        super();
    }

    @Override
    public boolean onStartNestedScroll(final CoordinatorLayout coordinatorLayout, final FloatingActionButton child,
                                       final View directTargetChild, final View target, final int nestedScrollAxes) {
        // Ensure we react to vertical scrolling
        return nestedScrollAxes == ViewCompat.SCROLL_AXIS_VERTICAL
                || super.onStartNestedScroll(coordinatorLayout, child, directTargetChild, target, nestedScrollAxes);
    }

    @Override
    public void onNestedScroll(final CoordinatorLayout coordinatorLayout, final FloatingActionButton child,
                               final View target, final int dxConsumed, final int dyConsumed,
                               final int dxUnconsumed, final int dyUnconsumed) {
        super.onNestedScroll(coordinatorLayout, child, target, dxConsumed, dyConsumed, dxUnconsumed, dyUnconsumed);
        if (dyConsumed > 0 && !this.mIsAnimatingOut && child.getVisibility() == View.VISIBLE) {
            // User scrolled down and the FAB is currently visible -> hide the FAB
            animateOut(child);
        } else if (dyConsumed < 0 && child.getVisibility() != View.VISIBLE) {
            // User scrolled up and the FAB is currently not visible -> show the FAB
            animateIn(child);
        }
    }

    private void animateOut(final FloatingActionButton button) {
        ViewCompat.animate(button).translationY(button.getHeight() + getMarginBottom(button)).setInterpolator(INTERPOLATOR).withLayer()
                .setListener(new ViewPropertyAnimatorListener() {
                    @Override
                    public void onAnimationStart(View view) {
                        ScrollAwareFABBehavior.this.mIsAnimatingOut = true;
                    }

                    @Override
                    public void onAnimationCancel(View view) {
                        ScrollAwareFABBehavior.this.mIsAnimatingOut = false;
                    }

                    @Override
                    public void onAnimationEnd(View view) {
                        ScrollAwareFABBehavior.this.mIsAnimatingOut = false;
                        view.setVisibility(View.INVISIBLE);
                    }
                }).start();
    }

    private void animateIn(FloatingActionButton button) {
        button.setVisibility(View.VISIBLE);
        ViewCompat.animate(button).translationY(0)
                .setInterpolator(INTERPOLATOR).withLayer().setListener(null)
                .start();
    }

    private int getMarginBottom(View v) {
        int marginBottom = 0;
        final ViewGroup.LayoutParams layoutParams = v.getLayoutParams();
        if (layoutParams instanceof ViewGroup.MarginLayoutParams) {
            marginBottom = ((ViewGroup.MarginLayoutParams) layoutParams).bottomMargin;
        }
        return marginBottom;
    }
}
```

注意，第一部中配置的`layout_behavior`需要加上此文件的包名。
