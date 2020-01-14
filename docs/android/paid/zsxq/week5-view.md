---
title: "关于View的知识"
---

## Question

话题：关于View的知识  
1、`View#getWidth()`和`getMeasuredWidth()`有什么区别吗？  
2、如何在onCreate中拿到View的宽度和高度？

## Answer

关于`View`的绘制原理，可以看这篇全面的文章：[View的绘制原理](/android/framework/View的绘制原理/)

### 1. View的getWidth()和getMeasuredWidth()有什么区别吗？
`View`的`getWidth`与`getMeasuredWidth`分别对应与`View`绘制的layout、measure阶段。  

`getWidth`的方法如下：

```java
/**
   * Return the width of the your view.
   *
   * @return The width of your view, in pixels.
   */
  @ViewDebug.ExportedProperty(category = "layout")
  public final int getWidth() {
      return mRight - mLeft;
  }
```
我们可以看到，`getWidth`方法实际上由`mRight`与`mLeft`相减而来，而`mRight`与其他三点顶点的坐标在`setFrame`中被设置。`setFrame`方法最后又在`View#layout`方法中间接或直接调用。

下面我们看看`getMeasuredWidth`方法：
```java
/**
   * Like {@link #getMeasuredWidthAndState()}, but only returns the
   * raw width component (that is the result is masked by
   * {@link #MEASURED_SIZE_MASK}).
   *
   * @return The raw measured width of this view.
   */
  public final int getMeasuredWidth() {
      return mMeasuredWidth & MEASURED_SIZE_MASK;
  }
```
`mMeasuredWidth`这个值在`setMeasuredDimensionRaw`中被设置，而此方法会在`setMeasuredDimension`中被调用。`onMeasure`最后会调用此方法设置`View`的测量宽高。

!!! danger
    `getWidth`与`getMeasuredWidth`大部分情况下都是相等的，也有一些特殊情况会不相等。这些特殊情况就是在`measure`过程完成之后，在父布局的`onLayout`或者自身的`onDraw`方法中调用`measure`方法导致。

### 2. 如何在onCreate中拿到View的宽度和高度？

**1. Activity/View#onWindowFocusChanged**  
    注意，此方法伴随着Activity的生命周期会被多次回调，具体来说，当Activity得到焦点和失去焦点时会被回调。
    ```java
    @Override
    public void onWindowFocusChanged(boolean hasWindowFocus) {
        super.onWindowFocusChanged(hasWindowFocus);
        if (hasWindowFocus) {
            int width = view.getMeasuredWidth();
            int height = view.getMeasuredHeight();
        }
    }
    ```

**2. View#post(Runnable)**  
    使用post可以将一个runnable投递到消息队列的尾部，然后等待Looper调用此runnable，View也初始化好了。
    ```java
    view.post(new Runnable() {
        @Override
        public void run() {
            int width = view.getMeasuredWidth();
            int height = view.getMeasuredHeight();
        }
    });
    ```

**3. ViewTreeObserver#onGlobalLayoutListener**  
    `ViewTreeObserver#onGlobalLayoutListener`接口会在View树的状态发生改变或者View树内部View可见性发生改变时回调。需要注意的是，伴随着View树的状态改变，此接口会被多次回调，因此可以在适当的时候取消监听。
    ```java
    ViewTreeObserver observer = view.getViewTreeObserver();
    observer.addOnGlobalLayoutListener(new ViewTreeObserver.OnGlobalLayoutListener() {
        @Override
        public void onGlobalLayout() {
            view.getViewTreeObserver().removeOnGlobalLayoutListener(this);
            int width = view.getMeasuredWidth();
            int height = view.getMeasuredHeight();
        }
    });
    ```

**4. View#measure**  
    可以手动对View进行measure操作来获取View的宽高。但是此方法比较复杂，且有局限性。
