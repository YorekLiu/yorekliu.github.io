---
title: "这可能是MVVM中最优雅的按键防抖方案"
---

该方案基于MVVM，对`android:onClickListener="@{() -> listener.onTogglePwd()}"`和`android:onClick="@{vm::onTogglePwd}"`两种类型的点击事件防抖。  
原理简单、共40行代码、无侵入。

---

最近在考虑按钮防抖的方案，本来看上了RxView，但是觉得实施起来好麻烦，因为在项目中点击事件都是这么写的：

```xml
<ImageButton
    ...
    android:onClickListener="@{() -> listener.onTogglePwd()}" />
```

但是我就是不想改代码:)  

既然xml中的属性可以通过`@BindingAdapter`注解修饰的方法来设置，那么我们是不是可以从这方面入手。答案是肯定的，要不然这篇文章怎么急迫的想蹦出来。

**首先，我们让`android:onClickListener`走我们指定的方法**  

这很简单，通过`@BindingAdapter`就可以了。

```kotlin
object ViewThrottleBindingAdapter {
    @BindingAdapter("android:onClickListener")
    @JvmStatic fun setViewOnClickListener(view: View, callback: View.OnClickListener) {
        ...
    }
}
```

这样我们就捕获了所有`android:onClickListener`方式的点击事件。然后我们将这个原始的`OnClickListener`包装一下，加上防抖的逻辑就可以了。  

另外，对于`android:onClick="@{vm::onTogglePwd}"`这种类型的点击事件，只需要额外加一个`@BinderAdapter`也能生效。👍👍👍👍

**全部代码**

```kotlin
object ViewThrottleBindingAdapter {
    @BindingAdapter("android:onClickListener")
    @JvmStatic fun setViewOnClickListener(view: View, callback: View.OnClickListener) {
        view.setOnClickListener(ThrottleOnClickListener(callback))
    }

    @BindingAdapter("android:onClick")
    @JvmStatic fun setViewOnClick(view: View, callback: View.OnClickListener) {
        view.setOnClickListener(ThrottleOnClickListener(callback))
    }

    /** 原始OnClickListener的包装 */
    class ThrottleOnClickListener(
        private val callback: View.OnClickListener
    ) : View.OnClickListener {

        // 上次点击时间
        private var mLastTime = 0L

        override fun onClick(v: View?) {
            val currentTime = System.currentTimeMillis()
            if (currentTime - mLastTime >= CLICK_THRESHOLD) {
                mLastTime = currentTime
                // 调用点击方法
                callback.onClick(v)
            } else {
                Logger.d(TAG_APP, "[ThrottleOnClickListener] [onClick] throttle")
            }
        }

        companion object {
            // 1秒之类的点击过滤掉
            private const val CLICK_THRESHOLD = 1000
        }
    }
}
```

**测试日志（代码中已经删掉了测试日志代码）**

下面的测试日志记录了30次点击测试结果（包括第一次点击）。
每两行中

- 第一行记录上次触发点击的时间、当前时间以及两者的差值
- 第二行记录了本次点击结果是去抖掉了还是触发了点击

```
[ThrottleOnClickListener] [onClick] mLastTime=0 currentTime=1553691662272 diff=1553691662272
[ThrottleOnClickListener] [onClick] performClick
[ThrottleOnClickListener] [onClick] mLastTime=1553691662272 currentTime=1553691662514 diff=242
[ThrottleOnClickListener] [onClick] throttle
[ThrottleOnClickListener] [onClick] mLastTime=1553691662272 currentTime=1553691662678 diff=406
[ThrottleOnClickListener] [onClick] throttle
[ThrottleOnClickListener] [onClick] mLastTime=1553691662272 currentTime=1553691662824 diff=552
[ThrottleOnClickListener] [onClick] throttle
[ThrottleOnClickListener] [onClick] mLastTime=1553691662272 currentTime=1553691662996 diff=724
[ThrottleOnClickListener] [onClick] throttle
[ThrottleOnClickListener] [onClick] mLastTime=1553691662272 currentTime=1553691663160 diff=888
[ThrottleOnClickListener] [onClick] throttle
[ThrottleOnClickListener] [onClick] mLastTime=1553691662272 currentTime=1553691663332 diff=1060
[ThrottleOnClickListener] [onClick] performClick
[ThrottleOnClickListener] [onClick] mLastTime=1553691663332 currentTime=1553691663503 diff=171
[ThrottleOnClickListener] [onClick] throttle
[ThrottleOnClickListener] [onClick] mLastTime=1553691663332 currentTime=1553691663659 diff=327
[ThrottleOnClickListener] [onClick] throttle
[ThrottleOnClickListener] [onClick] mLastTime=1553691663332 currentTime=1553691663841 diff=509
[ThrottleOnClickListener] [onClick] throttle
[ThrottleOnClickListener] [onClick] mLastTime=1553691663332 currentTime=1553691663979 diff=647
[ThrottleOnClickListener] [onClick] throttle
[ThrottleOnClickListener] [onClick] mLastTime=1553691663332 currentTime=1553691664160 diff=828
[ThrottleOnClickListener] [onClick] throttle
[ThrottleOnClickListener] [onClick] mLastTime=1553691663332 currentTime=1553691664315 diff=983
[ThrottleOnClickListener] [onClick] throttle
[ThrottleOnClickListener] [onClick] mLastTime=1553691663332 currentTime=1553691664493 diff=1161
[ThrottleOnClickListener] [onClick] performClick
[ThrottleOnClickListener] [onClick] mLastTime=1553691664493 currentTime=1553691664657 diff=164
[ThrottleOnClickListener] [onClick] throttle
[ThrottleOnClickListener] [onClick] mLastTime=1553691664493 currentTime=1553691664823 diff=330
[ThrottleOnClickListener] [onClick] throttle
[ThrottleOnClickListener] [onClick] mLastTime=1553691664493 currentTime=1553691665005 diff=512
[ThrottleOnClickListener] [onClick] throttle
[ThrottleOnClickListener] [onClick] mLastTime=1553691664493 currentTime=1553691665183 diff=690
[ThrottleOnClickListener] [onClick] throttle
[ThrottleOnClickListener] [onClick] mLastTime=1553691664493 currentTime=1553691665331 diff=838
[ThrottleOnClickListener] [onClick] throttle
[ThrottleOnClickListener] [onClick] mLastTime=1553691664493 currentTime=1553691665511 diff=1018
[ThrottleOnClickListener] [onClick] performClick
[ThrottleOnClickListener] [onClick] mLastTime=1553691665511 currentTime=1553691665682 diff=171
[ThrottleOnClickListener] [onClick] throttle
[ThrottleOnClickListener] [onClick] mLastTime=1553691665511 currentTime=1553691665849 diff=338
[ThrottleOnClickListener] [onClick] throttle
[ThrottleOnClickListener] [onClick] mLastTime=1553691665511 currentTime=1553691666028 diff=517
[ThrottleOnClickListener] [onClick] throttle
[ThrottleOnClickListener] [onClick] mLastTime=1553691665511 currentTime=1553691666199 diff=688
[ThrottleOnClickListener] [onClick] throttle
[ThrottleOnClickListener] [onClick] mLastTime=1553691665511 currentTime=1553691666378 diff=867
[ThrottleOnClickListener] [onClick] throttle
[ThrottleOnClickListener] [onClick] mLastTime=1553691665511 currentTime=1553691666566 diff=1055
[ThrottleOnClickListener] [onClick] performClick
[ThrottleOnClickListener] [onClick] mLastTime=1553691666566 currentTime=1553691666721 diff=155
[ThrottleOnClickListener] [onClick] throttle
[ThrottleOnClickListener] [onClick] mLastTime=1553691666566 currentTime=1553691669076 diff=2510
[ThrottleOnClickListener] [onClick] performClick
[ThrottleOnClickListener] [onClick] mLastTime=1553691669076 currentTime=1553691670512 diff=1436
[ThrottleOnClickListener] [onClick] performClick
[ThrottleOnClickListener] [onClick] mLastTime=1553691670512 currentTime=1553691672241 diff=1729
[ThrottleOnClickListener] [onClick] performClick
```