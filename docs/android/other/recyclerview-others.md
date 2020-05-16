---
title: "RecyclerView的一些使用细节"
---

RecyclerView高级特性系列：

- [ListView、RecyclerView缓存策略解析](/android/other/recyclerview-cache/)
- [RecyclerView高级特性——拖拽排序以及滑动删除](/android/other/RecyclerView-Sort&Delete/)
- [RecyclerView高级特性——ItemDecoration](/android/other/recyclerview-item-docoration/)
- [RecyclerView的一些使用细节——多级嵌套时的缓存优化、smooth scroll问题](/android/other/recyclerview-others/)

---

本文比较轻松，不涉及到源码，只说一些API上面的东西。

## 1. 多级嵌套时的缓存优化

最近有这么一个需求：有若干本书，每本书有若干个章节。这很自然的想到，这是一个大RecyclerView，里面每一项也都是一个RecyclerView，这就是RecyclerView两级嵌套了。

此时我们想一下item的复用问题：
- 对于最外层的RecyclerView A来说，它的item复用显然是没有任何问题的
- 对于A里面每一项的RecyclerView B来说，复用的性价比太低了。因为A的项一旦显示出来，B里面的就会全部显示；A一旦滑出屏幕，B里面的就会放进缓存。但是缓存里面的item只会被当前的B使用。也可以是说，如果A里面有10项，每一项里面都有5个小项，那么我将A从头滑到尾，那么就会有50项在内存中。

那么问题来了，有没有什么方法让B之间共享缓存呢？肯定是有的，我们需要使用到`RecyclerView.RecycledViewPool`，这个东西我们在[ListView、RecyclerView缓存策略解析](/android/other/recyclerview-cache/)这篇文章中分析过，这里只说使用方式。

平平无奇的RecyclerView A的初始化：

```kotlin
recyclerView.layoutManager = LinearLayoutManager(mBaseActivity, LinearLayoutManager.HORIZONTAL, false)
recyclerView.adapter = AdapterA(mBaseActivity, this)
```

**AdapterA.kt**

```kotlin
class AdapterA(
    private val mContext: Context,
    private val mListener: OnItemClickListener
) : RecyclerView.Adapter<AdapterA.ViewHolder>() {

    ...

    // 给嵌套的子RecyclerView使用，所有子RecyclerView公用
    private val mRecyclerViewPool = RecyclerView.RecycledViewPool().apply {
        this.setMaxRecycledViews(0, 10)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val itemView = LayoutInflater.from(mContext).inflate(R.layout.item_example_unit, parent, false)
        val viewHolder = ViewHolder(itemView, mItemDecoration, mRecyclerViewPool, mListener)
        return viewHolder
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val singleClass = mClassDataList[position]

        ...

        // 更新子RecyclerView
        val adapter = holder.rvSections.adapter
        if ((adapter is ExampleSectionAdapter) && (singleClass.items != null)) {
            adapter.updateDataSet(singleClass.items!!)
        }
    }

    class ViewHolder(
        itemView: View,
        itemDecoration: RecyclerView.ItemDecoration,
        pool: RecyclerView.RecycledViewPool,
        mListener: OnItemClickListener
    ) : RecyclerView.ViewHolder(itemView) {
        ...

        init {
            // 嵌套的子RecyclerView的初始化可以在创建ViewHolder的时候就进行
            rvSections.layoutManager = LinearLayoutManager(
                itemView.context,
                LinearLayoutManager.HORIZONTAL,
                false
            ).apply {
                // 调用子RecyclerView的setRecycleChildrenOnDetach(true)
                // 这样在子RecyclerView滑出屏幕时，会将里面的item全部放入到RecycledViewPool
                recycleChildrenOnDetach = true
            }
            rvSections.adapter = AdapterB(itemView.context, mListener)
            // 这样所有的RecyclerViewB就共用一个RecycledViewPool了，极大的提高了缓存效率
            rvSections.setRecycledViewPool(pool)
        }
    }
}
```

## 2. smooth scroll

RecyclerView滑动的API挺多的，相关描述如下：

RecyclerView:

- scrollToPosition  
  直接滑动到指定位置，内部调用的是`LayoutManager.scrollToPosition`方法
- smoothScrollToPosition  
  平滑滑动到指定位置，内部调用的是`LayoutManager.smoothScrollToPosition`方法

LayoutManager:

- scrollToPosition  
  直接滑动到指定位置
- scrollToPositionWithOffset(position, offset)  
  直接滑动到指定位置，且offset指定的item与RecyclerView之间的起始边的距离
- startSmoothScroll(SmoothScroller)
  平滑滑动到SmoothScroller指定的位置，该方式可以指定滑动后item出现RecyclerView的开始位置、中间位置还是结束位置

下面是`LayoutManager.startSmoothScroll`的实例代码：

```kotlin
// 初始化LinearSmoothScroller，指定了水平滑动时，让item出现在RecyclerView开始的位置
val mSmoothScroller = object : LinearSmoothScroller(context) {
    override fun getHorizontalSnapPreference(): Int {
        return SNAP_TO_START
    }
}

// 指定要滑动到哪一个item
mSmoothScroller.targetPosition = mLocationPos
// 开始平滑滑动
mLayoutManager.startSmoothScroll(mSmoothScroller)
```

## 3. 控制总滑动时间

由于RecyclerView平滑滑动的时间会随着滑动距离的增长而增长，而如果距离过长，会导致需要滑几秒钟才能到达指定位置，这太慢了。有没有一个方式可以让RecylerView无论滑多长都只花指定的时间呢。

办法肯定是有的，在经过一番搜索之后，锁定了`LinearSmoothScroller.calculateTimeForScrolling`方法。该方法的解释为： *Calculates the time it should take to scroll the given distance (in pixels)*。按照注释来说，我们只需要让该方法返回固定值就能达到效果了。

但是经过试验，并没有达到想要的效果，原因在于该方法会被调用多次。因为RecyclerView在滑动时会边滑边计算，它也一下子无法确定要滑动的位置到底到哪，只好调用一次，先滑到这个位置，然后再调用下一次。每次调用该方法都是为了计算下10000个像素。  
比如说，我们要滑52000个像素，该方法则会调用5次，分别传入10000、10000、10000、10000、10000、2000。所以，如果我们让该方法返回固定值，显然RecyclerView平滑滑动的时间还是会随着滑动距离的增长而增长。这达不到效果。

然后我们第二次尝试，还是在该方法上做文章。虽然我们不知道到底会调用几次，但是我们设定一个总的时间，每次调用都返回剩下没有消耗的时间的一半，最后一次调用返回剩下的没有消耗的时间。这样虽然随着调用次数的增加，函数返回值会越来越小，这也就意味着RecyclerView会滑的越来越快，但是我们完成了功能，剩下的谁在乎呢。  
还是拿52000个像素做例子，假设总时间设定为1000ms，那么函数返回值分别为500、250、125、62、31、31。但是这种方式，滑动体验不太友好，短距离滑动时非常慢，所以实际应用可能需要根据滑动的距离做一个判断，需不需要使用这种方式。

为了达到更好的体验，我们在想还能不能优化一下。上面的这种方式，我们无法预知RecyclerView总的滑动距离，进而无法知道`LinearSmoothScroller.calculateTimeForScrolling`方法到底会被调用几次，所以只能一次分一半的时间。如果我们能计算出总得滑动距离，就可以按段分配时间了。  

所以我们可以有第三种方法，提前是我们能计算出RecyclerView本次滑动的距离，代码如下：

```kotlin
object : LinearSmoothScroller(context) {
    private val mTotalLongScrollTime = 600
    private val mTotalShortScrollTime = 300
    private var mPerCostTime = mTotalLongScrollTime

    override fun onStart() {
        super.onStart()
        // 获取起点、终点的position
        val currentPos = mLayoutManager.findFirstVisibleItemPosition()
        val targetPos = targetPosition

        // 计算x轴上的距离（实例代码中是横着的RecyclerView）
        val distance = abs(mItemDecoration.getTotalX(recyclerView, currentPos) - mItemDecoration.getTotalX(recyclerView, targetPos))
        // 获得滑动的段数
        val ceil = ceil(distance.toFloat() / 10000).toInt()
        // 如果段数为2段或以下，则每段耗时300ms，这样短距离滑动体验会好点
        // 否则，每段的耗时为600ms/段数，整个滑动过程耗时为600m
        mPerCostTime = if (ceil <= 2) {
            mTotalShortScrollTime
        } else {
            mTotalLongScrollTime / ceil
        }
    }

    override fun getHorizontalSnapPreference(): Int {
        return SNAP_TO_START
    }

    override fun calculateTimeForScrolling(dx: Int): Int {
        return mPerCostTime
    }

    override fun calculateTimeForDeceleration(dx: Int): Int {
        return mPerCostTime
    }
}
```

## 4. 关闭dataset改变时的动画效果

```kotlin
if (recyclerView.itemAnimator is SimpleItemAnimator) {
    (recyclerView.itemAnimator as SimpleItemAnimator).supportsChangeAnimations = false
}
```