---
title: "RecyclerView的一些使用细节"
excerpt: "RecyclerView多级嵌套时的缓存优化、smooth scroll问题"
categories:
  - Android
tags:
  - RecyclerView
  - RecycledViewPool
  - SmoothScroller
toc: true
toc_label: "目录"
last_modified_at: 2020-01-05T03:23:18+08:00
---

RecyclerView高级特性系列：

- [ListView、RecyclerView缓存策略解析](/android/recyclerview-cache/)
- [RecyclerView高级特性——拖拽排序以及滑动删除](/android/RecyclerView-Sort&Delete/)
- [RecyclerView高级特性——ItemDecoration](/android/recyclerview-item-docoration/)
- [RecyclerView的一些使用细节——多级嵌套时的缓存优化、smooth scroll问题](/android/recyclerview-others/)

---

本文比较轻松，不涉及到源码，只说一些API上面的东西。

## 1. 多级嵌套时的缓存优化

最近有这么一个需求：有若干本书，每本书有若干个章节。这很自然的想到，这是一个大RecyclerView，里面每一项也都是一个RecyclerView，这就是RecyclerView两级嵌套了。

此时我们想一下item的复用问题：
- 对于最外层的RecyclerView A来说，它的item复用显然是没有任何问题的
- 对于A里面每一项的RecyclerView B来说，复用的性价比太低了。因为A的项一旦显示出来，B里面的就会全部显示；A一旦滑出屏幕，B里面的就会放进缓存。但是缓存里面的item只会被当前的B使用。也可以是说，如果A里面有10项，每一项里面都有5个小项，那么我将A从头滑到尾，那么就会有50项在内存中。

那么问题来了，有没有什么方法让B之间共享缓存呢？肯定是有的，我们需要使用到`RecyclerView.RecycledViewPool`，这个东西我们在[ListView、RecyclerView缓存策略解析](/android/recyclerview-cache/)这篇文章中分析过，这里只说使用方式。

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


## 3. 关闭dataset改变时的动画效果

```kotlin
if (recyclerView.itemAnimator is SimpleItemAnimator) {
    (recyclerView.itemAnimator as SimpleItemAnimator).supportsChangeAnimations = false
}
```