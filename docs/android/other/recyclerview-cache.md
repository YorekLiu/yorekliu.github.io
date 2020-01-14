---
title: "ListView、RecyclerView缓存策略解析"
---

RecyclerView高级特性系列：

- [ListView、RecyclerView缓存策略解析](/android/other/recyclerview-cache/)
- [RecyclerView高级特性——拖拽排序以及滑动删除](/android/other/RecyclerView-Sort&Delete/)
- [RecyclerView高级特性——ItemDecoration](/android/other/recyclerview-item-docoration/)
- [RecyclerView的一些使用细节——多级嵌套时的缓存优化、smooth scroll问题](/android/other/recyclerview-others/)

---

> 本文源码版本为27

本章的主要内容为ListView、RecyclerView缓存策略解析。虽然ListView现在基本被更强大的RecyclerView所取代，但我们还是要了解一下其缓存原理，吸收一下思想。

所以，先从简单一点的ListView开始。

## 1. ListView缓存策略

> ListView和GridView一样，都继承自`AbsListView`。而缓存策略的实现是在`AbsListView`类中，所以两者的缓存策略也是一致的。

我们体验ListView的缓存最多的地方就是`BaseAdapter.getView(int, View, ViewGroup)`方法中了，一个典型的`BaseAdapter`的实现如下：

```java
public class DemoAdapter extends BaseAdapter {
    private Context mContext;
    private List<Data> mDataList;

    public DemoAdapter(Context context, List<Data> dataList) {
        mContext = context;
        mDataList = dataList;
    }

    @Override
    public int getCount() {
        return mDataList.size();
    }

    @Override
    public Object getItem(int position) {
        return null;
    }

    @Override
    public long getItemId(int position) {
        return 0;
    }

    @Override
    public View getView(int position, View convertView, ViewGroup parent) {
        ViewHolder viewHolder;
        if (convertView == null) {
            convertView = LayoutInflater.from(mContext).inflate(R.layout.item_location_hot_city, null);
            viewHolder = new ViewHolder(convertView);
            convertView.setTag(viewHolder);
        } else {
            viewHolder = (ViewHolder) convertView.getTag();
        }

        final Data data = mDataList.get(position);
        viewHolder.tvTitle.setText(data.getName());

        return convertView;
    }

    private static class ViewHolder {
        View itemView;
        TextView tvTitle;

        public ViewHolder(View view) {
            itemView = view;
            tvTitle = (TextView) view.findViewById(R.id.tv_title);
        }
    }
}
```

在上面的方法中，一个非常重要的优化点就是`getView`方法中对`convertView`的判断。如果为空就需要我们创建一下；如果不为空，就说明是 **缓存** 的View，可以直接拿来填充数据。

那么，ListView如何管理缓存的View，什么时候调用`BaseAdapter.getView`方法并传入缓存的View或者null呢。这就是本节的重点，本节的讨论都是体现在`convertView`上。

### 1.1 RecycleBin

在讲`AbsListView`和`ListView`代码之前，先说一下`AbsListView.RecycleBin`，该类负责管理view的复用。`RecycleBin` **有两个等级的缓存：**`ActiveViews`**和**`ScrapViews`。

- ActiveViews是指显示在屏幕上的view
- ScrapViews是可能被adapter重新使用的老view，这样可以避免不必要的view创建。

`RecycleBin`里面的字段如下：

```java
/**
  * The position of the first view stored in mActiveViews.
  */
private int mFirstActivePosition;

/**
  * Views that were on screen at the start of layout. This array is populated at the start of
  * layout, and at the end of layout all view in mActiveViews are moved to mScrapViews.
  * Views in mActiveViews represent a contiguous range of Views, with position of the first
  * view store in mFirstActivePosition.
  */
private View[] mActiveViews = new View[0];

/**
  * Unsorted views that can be used by the adapter as a convert view.
  */
private ArrayList<View>[] mScrapViews;

private int mViewTypeCount;

private ArrayList<View> mCurrentScrap;

private ArrayList<View> mSkippedScrap;

private SparseArray<View> mTransientStateViews;
private LongSparseArray<View> mTransientStateViewsById;
```

解释如下：

- `mFirstActivePosition`、`mActiveViews`  
  mFirstActivePosition是指mActiveViews中第一个View在ListView中的position  
  mActiveViews是指正在屏幕上显示的View；在layout发生前保存，供layout中进行复用，在layout后会将剩余没有复用的View降级到scrap中

- `mScrapViews`、`mViewTypeCount`与`mCurrentScrap`  
  可以被Adapter作为convert view使用的View  
  `mScrapViews`根据`mViewTypeCount`的值来确定有数组都多大，无论数组具体多大，`mCurrentScrap = mScrapViews[0]`都成立。但一般来说 
    - 当`mViewTypeCount`为1时，`ScrapViews`就是指`mCurrentScrap`  
    - 当`mViewTypeCount`大于1时，`ScrapViews`指`mScrapViews`  

- `mTransientStateViewsById`、`mTransientStateViews`、`mSkippedScrap`  
  当`View.hasTransientState()`为true时，会使用这上面的数据结构存储`ScrapViews`  
  当`Adapter.hasStableIds()`为true时，使用`mTransientStateViewsById`存储  
  当`mDataChanged`为false时，使用`mTransientStateViews`存储  
  否则，使用`mSkippedScrap`存储，该List里面的View稍后会被清除，不会被复用  

`RecycleBin`的方法本质上就是对上面数据的一些操作。主要的方法有：

- `setViewTypeCount(int)`  
  根据传入值为每个类型的数据元都申请一个List来存放缓存
- `fillActiveViews(int childCount, int firstActivePosition)`  
  保存firstActivePosition的值，并将[0, childCount)范围的View保存到mActiveViews数组中
- `getActiveView(int)`  
  与上面过程相反，首先将传入参数减去firstActivePosition得到View在mActiveViews数组中的下标，然后用下标取View
- `addScrapView(View, int)`  
  将旧View保存到对应的`ScrapViews`、`mTransientStateViewsById`、`mTransientStateViews`、`mSkippedScrap`集合中  
- `getScrapView(int)`  
  从`ScrapViews`集合中获取旧View
- `getTransientStateView(int)`  
  从`mTransientStateViewsById`、`mTransientStateViews`集合中获取旧View

在了解了`RecycleBin`的重要字段和方法之后，下面可以开始分析ListView的缓存机制了。我们以ListView初次layout、再次layout以及用户滑动三个过程来分析。

### 1.2 ListView初次layout

ListView初次layout，显然是没有任何子view以及缓存的view的，我们看看这种情况下ListView的流程。首先，`onMeasure`方法显然是不需要分析的，因为不涉及到缓存的设计。所以，我们直接看基类`AbsListView`的`onLayout`方法。

```java
/**
  * Subclasses should NOT override this method but
  *  {@link #layoutChildren()} instead.
  */
@Override
protected void onLayout(boolean changed, int l, int t, int r, int b) {
    super.onLayout(changed, l, t, r, b);

    mInLayout = true;

    final int childCount = getChildCount();
    if (changed) {
        for (int i = 0; i < childCount; i++) {
            getChildAt(i).forceLayout();
        }
        mRecycler.markChildrenDirty();
    }

    layoutChildren();

    mOverscrollMax = (b - t) / OVERSCROLL_LIMIT_DIVISOR;

    // TODO: Move somewhere sane. This doesn't belong in onLayout().
    if (mFastScroll != null) {
        mFastScroll.onItemCountChanged(getChildCount(), mItemCount);
    }
    mInLayout = false;
}
```

这里第12行的判断中，`changed`是否为true都不重要，因为没有任何子view。然后19行`layoutChildren()`方法是一个要点，`AbsListView`并没有实现该方法，而是交给了子类来实现。所以，我们看看`ListView.layoutChildren()`方法：

```java
@Override
protected void layoutChildren() {
    final boolean blockLayoutRequests = mBlockLayoutRequests;
    if (blockLayoutRequests) {
        return;
    }

    mBlockLayoutRequests = true;

    try {
        super.layoutChildren();

        invalidate();

        if (mAdapter == null) {
            resetList();
            invokeOnItemScrollListener();
            return;
        }

        final int childrenTop = mListPadding.top;
        final int childrenBottom = mBottom - mTop - mListPadding.bottom;
        final int childCount = getChildCount();

        int index = 0;
        int delta = 0;

        View sel;
        View oldSel = null;
        View oldFirst = null;
        View newSel = null;

        ...

        boolean dataChanged = mDataChanged;
        if (dataChanged) {
            handleDataChanged();
        }

        // Handle the empty set by removing all views that are visible
        // and calling it a day
        if (mItemCount == 0) {
            resetList();
            invokeOnItemScrollListener();
            return;
        } else if (mItemCount != mAdapter.getCount()) {
            throw new IllegalStateException("The content of the adapter has changed but "
                    + "ListView did not receive a notification. Make sure the content of "
                    + "your adapter is not modified from a background thread, but only from "
                    + "the UI thread. Make sure your adapter calls notifyDataSetChanged() "
                    + "when its content changes. [in ListView(" + getId() + ", " + getClass()
                    + ") with Adapter(" + mAdapter.getClass() + ")]");
        }

        setSelectedPositionInt(mNextSelectedPosition);

        ...

        // Pull all children into the RecycleBin.
        // These views will be reused if possible
        final int firstPosition = mFirstPosition;
        final RecycleBin recycleBin = mRecycler;
        if (dataChanged) {
            for (int i = 0; i < childCount; i++) {
                recycleBin.addScrapView(getChildAt(i), firstPosition+i);
            }
        } else {
            recycleBin.fillActiveViews(childCount, firstPosition);
        }

        // Clear out old views
        detachAllViewsFromParent();
        recycleBin.removeSkippedScrap();

        switch (mLayoutMode) {
            ...
        case LAYOUT_MOVE_SELECTION:
            ...
        default:
            if (childCount == 0) {
                if (!mStackFromBottom) {
                    final int position = lookForSelectablePosition(0, true);
                    setSelectedPositionInt(position);
                    sel = fillFromTop(childrenTop);
                } else {
                    final int position = lookForSelectablePosition(mItemCount - 1, false);
                    setSelectedPositionInt(position);
                    sel = fillUp(mItemCount - 1, childrenBottom);
                }
            } else {
                if (mSelectedPosition >= 0 && mSelectedPosition < mItemCount) {
                    sel = fillSpecific(mSelectedPosition,
                            oldSel == null ? childrenTop : oldSel.getTop());
                } else if (mFirstPosition < mItemCount) {
                    sel = fillSpecific(mFirstPosition,
                            oldFirst == null ? childrenTop : oldFirst.getTop());
                } else {
                    sel = fillSpecific(0, childrenTop);
                }
            }
            break;
        }

        // Flush any cached views that did not get reused above
        recycleBin.scrapActiveViews();

        // remove any header/footer that has been temp detached and not re-attached
        removeUnusedFixedViews(mHeaderViewInfos);
        removeUnusedFixedViews(mFooterViewInfos);

        ...

        // Tell focus view we are done mucking with it, if it is still in
        // our view hierarchy.
        if (focusLayoutRestoreView != null
                && focusLayoutRestoreView.getWindowToken() != null) {
            focusLayoutRestoreView.dispatchFinishTemporaryDetach();
        }

        mLayoutMode = LAYOUT_NORMAL;
        mDataChanged = false;
        if (mPositionScrollAfterLayout != null) {
            post(mPositionScrollAfterLayout);
            mPositionScrollAfterLayout = null;
        }
        mNeedSync = false;
        setNextSelectedPositionInt(mSelectedPosition);

        updateScrollIndicators();

        if (mItemCount > 0) {
            checkSelectionChanged();
        }

        invokeOnItemScrollListener();
    } finally {
        if (mFocusSelector != null) {
            mFocusSelector.onLayoutComplete();
        }
        if (!blockLayoutRequests) {
            mBlockLayoutRequests = false;
        }
    }
}
```

在上面的代码中，可以直奔重点，直接来到第63的if语句。dataChanged只有在数据源发生改变的情况下才会变成true，其它情况都是false，显然此时为false。所以会执行第68行的`recycleBin.fillActiveViews(childCount, firstPosition)`将ListView中的View进行缓存，可是目前ListView中还没有任何的子View，因此这一行暂时还起不了任何作用。  

接下来，会来到第75行的switch语句，一般情况下ListView的 layout mode 为`LAYOUT_NORMAL`，所以会走default分支。由于childCount目前为0，且mStackFromBottom默认为false，表示默认从上往下进行布局，所以会执行第84行的`fillFromTop()`方法。

`fillFromTop(int)`会调用`fillDown(int, int)`方法从上到下填充ListView，直到加载完了一屏数据或者数据加载完毕：

```java
/**
  * Fills the list from top to bottom, starting with mFirstPosition
  *
  * @param nextTop The location where the top of the first item should be
  *        drawn
  *
  * @return The view that is currently selected
  */
private View fillFromTop(int nextTop) {
    mFirstPosition = Math.min(mFirstPosition, mSelectedPosition);
    mFirstPosition = Math.min(mFirstPosition, mItemCount - 1);
    if (mFirstPosition < 0) {
        mFirstPosition = 0;
    }
    return fillDown(mFirstPosition, nextTop);
}

/**
  * Fills the list from pos down to the end of the list view.
  *
  * @param pos The first position to put in the list
  *
  * @param nextTop The location where the top of the item associated with pos
  *        should be drawn
  *
  * @return The view that is currently selected, if it happens to be in the
  *         range that we draw.
  */
private View fillDown(int pos, int nextTop) {
    View selectedView = null;

    int end = (mBottom - mTop);
    if ((mGroupFlags & CLIP_TO_PADDING_MASK) == CLIP_TO_PADDING_MASK) {
        end -= mListPadding.bottom;
    }

    while (nextTop < end && pos < mItemCount) {
        // is this the selected item?
        boolean selected = pos == mSelectedPosition;
        View child = makeAndAddView(pos, nextTop, true, mListPadding.left, selected);

        nextTop = child.getBottom() + mDividerHeight;
        if (selected) {
            selectedView = child;
        }
        pos++;
    }

    setVisibleRangeHint(mFirstPosition, mFirstPosition + getChildCount() - 1);
    return selectedView;
}
```

在上面第37行的while循环条件中，前面的`nextTop < end`判断的是是否超过了屏幕，每次添加新view之后`nextTop`值都会累加，后面的`pos < mItemCount`判断的是是否所有数据已经显示完毕。  
第40行的`makeAndAddView`应该是fill过程的重点，我们看看如何make、如何add view的。

```java
/**
  * Obtains the view and adds it to our list of children. The view can be
  * made fresh, converted from an unused view, or used as is if it was in
  * the recycle bin.
  *
  * @param position logical position in the list
  * @param y top or bottom edge of the view to add
  * @param flow {@code true} to align top edge to y, {@code false} to align
  *             bottom edge to y
  * @param childrenLeft left edge where children should be positioned
  * @param selected {@code true} if the position is selected, {@code false}
  *                 otherwise
  * @return the view that was added
  */
private View makeAndAddView(int position, int y, boolean flow, int childrenLeft,
        boolean selected) {
    if (!mDataChanged) {
        // Try to use an existing view for this position.
        final View activeView = mRecycler.getActiveView(position);
        if (activeView != null) {
            // Found it. We're reusing an existing child, so it just needs
            // to be positioned like a scrap view.
            setupChild(activeView, position, y, flow, childrenLeft, selected, true);
            return activeView;
        }
    }

    // Make a new view for this position, or convert an unused view if
    // possible.
    final View child = obtainView(position, mIsScrap);

    // This needs to be positioned and measured.
    setupChild(child, position, y, flow, childrenLeft, selected, mIsScrap[0]);

    return child;
}
```

`mDataChanged`显然还是false的，因此会尝试调用`RecycleBin.getActiveView`获取一个layout开始时fill的view（上面`ListView.layoutChildren()`方法的第68行`recycleBin.fillActiveViews(childCount, firstPosition)`会fill view到ActiveViews中），显然此时获取不到view。所以，接下来会执行第30行的`obtainView`方法创建或复用View，然后接着调用行第32行的`setupChild`方法放置并测量View。  
那么`obtainView()`内部到底是怎么工作的呢？我们先进入到这个方法里面看一下：

```java
/**
 * Gets a view and have it show the data associated with the specified
 * position. This is called when we have already discovered that the view
 * is not available for reuse in the recycle bin. The only choices left are
 * converting an old view or making a new one.
 *
 * @param position the position to display
 * @param outMetadata an array of at least 1 boolean where the first entry
 *                    will be set {@code true} if the view is currently
 *                    attached to the window, {@code false} otherwise (e.g.
 *                    newly-inflated or remained scrap for multiple layout
 *                    passes)
 *
 * @return A view displaying the data associated with the specified position
 */
View obtainView(int position, boolean[] outMetadata) {
    Trace.traceBegin(Trace.TRACE_TAG_VIEW, "obtainView");

    outMetadata[0] = false;

    // Check whether we have a transient state view. Attempt to re-bind the
    // data and discard the view if we fail.
    final View transientView = mRecycler.getTransientStateView(position);
    if (transientView != null) {
        final LayoutParams params = (LayoutParams) transientView.getLayoutParams();

        // If the view type hasn't changed, attempt to re-bind the data.
        if (params.viewType == mAdapter.getItemViewType(position)) {
            final View updatedView = mAdapter.getView(position, transientView, this);

            // If we failed to re-bind the data, scrap the obtained view.
            if (updatedView != transientView) {
                setItemViewLayoutParams(updatedView, position);
                mRecycler.addScrapView(updatedView, position);
            }
        }

        outMetadata[0] = true;

        // Finish the temporary detach started in addScrapView().
        transientView.dispatchFinishTemporaryDetach();
        return transientView;
    }

    final View scrapView = mRecycler.getScrapView(position);
    final View child = mAdapter.getView(position, scrapView, this);
    if (scrapView != null) {
        if (child != scrapView) {
            // Failed to re-bind the data, return scrap to the heap.
            mRecycler.addScrapView(scrapView, position);
        } else if (child.isTemporarilyDetached()) {
            outMetadata[0] = true;

            // Finish the temporary detach started in addScrapView().
            child.dispatchFinishTemporaryDetach();
        }
    }

    if (mCacheColorHint != 0) {
        child.setDrawingCacheBackgroundColor(mCacheColorHint);
    }

    ...

    setItemViewLayoutParams(child, position);

    ...

    Trace.traceEnd(Trace.TRACE_TAG_VIEW);

    return child;
}
```

`obtainView()`方法中代码包含了非常重要的逻辑，整个ListView最重要的内容就在这里。首先，会设置`outMetadata[0]`为false，这里的`outMetadata`实际上就是`mIsScrap`变量，该变量后面会用到。然后调用`RecycleBin.getTransientStateView`方法获取transient状态的scrap view。显然，目前没有这样的view。接着会到第45行执行`RecycleBin.getScapView`方法获取一个scrap view，显然，目前还是没有这样的view，所以`scrapView`为null。最后，会调用`Adapter.getView`方法来获取一个view。  
回想一下文章开头在[ListView的缓存策略](#1-listview)写的一个典型的`BaseAdapter`的实现，如果传入的`convertView`为null，我们就会inflate一个view并返回。返回的view也会作为`obtainView`的结果进行返回，最终传入`setupChild`中：

```java
/**
  * Adds a view as a child and make sure it is measured (if necessary) and
  * positioned properly.
  *
  * @param child the view to add
  * @param position the position of this child
  * @param y the y position relative to which this view will be positioned
  * @param flowDown {@code true} to align top edge to y, {@code false} to
  *                 align bottom edge to y
  * @param childrenLeft left edge where children should be positioned
  * @param selected {@code true} if the position is selected, {@code false}
  *                 otherwise
  * @param isAttachedToWindow {@code true} if the view is already attached
  *                           to the window, e.g. whether it was reused, or
  *                           {@code false} otherwise
  */
private void setupChild(View child, int position, int y, boolean flowDown, int childrenLeft,
        boolean selected, boolean isAttachedToWindow) {
    Trace.traceBegin(Trace.TRACE_TAG_VIEW, "setupListItem");

    final boolean isSelected = selected && shouldShowSelector();
    final boolean updateChildSelected = isSelected != child.isSelected();
    final int mode = mTouchMode;
    final boolean isPressed = mode > TOUCH_MODE_DOWN && mode < TOUCH_MODE_SCROLL
            && mMotionPosition == position;
    final boolean updateChildPressed = isPressed != child.isPressed();
    final boolean needToMeasure = !isAttachedToWindow || updateChildSelected
            || child.isLayoutRequested();

    // Respect layout params that are already in the view. Otherwise make
    // some up...
    AbsListView.LayoutParams p = (AbsListView.LayoutParams) child.getLayoutParams();
    if (p == null) {
        p = (AbsListView.LayoutParams) generateDefaultLayoutParams();
    }
    p.viewType = mAdapter.getItemViewType(position);
    p.isEnabled = mAdapter.isEnabled(position);

    // Set up view state before attaching the view, since we may need to
    // rely on the jumpDrawablesToCurrentState() call that occurs as part
    // of view attachment.
    if (updateChildSelected) {
        child.setSelected(isSelected);
    }

    if (updateChildPressed) {
        child.setPressed(isPressed);
    }

    if (mChoiceMode != CHOICE_MODE_NONE && mCheckStates != null) {
        if (child instanceof Checkable) {
            ((Checkable) child).setChecked(mCheckStates.get(position));
        } else if (getContext().getApplicationInfo().targetSdkVersion
                >= android.os.Build.VERSION_CODES.HONEYCOMB) {
            child.setActivated(mCheckStates.get(position));
        }
    }

    if ((isAttachedToWindow && !p.forceAdd) || (p.recycledHeaderFooter
            && p.viewType == AdapterView.ITEM_VIEW_TYPE_HEADER_OR_FOOTER)) {
        attachViewToParent(child, flowDown ? -1 : 0, p);

        // If the view was previously attached for a different position,
        // then manually jump the drawables.
        if (isAttachedToWindow
                && (((AbsListView.LayoutParams) child.getLayoutParams()).scrappedFromPosition)
                        != position) {
            child.jumpDrawablesToCurrentState();
        }
    } else {
        p.forceAdd = false;
        if (p.viewType == AdapterView.ITEM_VIEW_TYPE_HEADER_OR_FOOTER) {
            p.recycledHeaderFooter = true;
        }
        addViewInLayout(child, flowDown ? -1 : 0, p, true);
        // add view in layout will reset the RTL properties. We have to re-resolve them
        child.resolveRtlPropertiesIfNeeded();
    }

    if (needToMeasure) {
        final int childWidthSpec = ViewGroup.getChildMeasureSpec(mWidthMeasureSpec,
                mListPadding.left + mListPadding.right, p.width);
        final int lpHeight = p.height;
        final int childHeightSpec;
        if (lpHeight > 0) {
            childHeightSpec = MeasureSpec.makeMeasureSpec(lpHeight, MeasureSpec.EXACTLY);
        } else {
            childHeightSpec = MeasureSpec.makeSafeMeasureSpec(getMeasuredHeight(),
                    MeasureSpec.UNSPECIFIED);
        }
        child.measure(childWidthSpec, childHeightSpec);
    } else {
        cleanupLayoutState(child);
    }

    final int w = child.getMeasuredWidth();
    final int h = child.getMeasuredHeight();
    final int childTop = flowDown ? y : y - h;

    if (needToMeasure) {
        final int childRight = childrenLeft + w;
        final int childBottom = childTop + h;
        child.layout(childrenLeft, childTop, childRight, childBottom);
    } else {
        child.offsetLeftAndRight(childrenLeft - child.getLeft());
        child.offsetTopAndBottom(childTop - child.getTop());
    }

    if (mCachingStarted && !child.isDrawingCacheEnabled()) {
        child.setDrawingCacheEnabled(true);
    }

    Trace.traceEnd(Trace.TRACE_TAG_VIEW);
}
```

`setupChild`方法的传入参数中，`isAttachedToWindow`传入的是`mIsScrap[0]`，该值在`obtainView`方法中设置为了false。所以，我们略过一些状态的判定，可以直接来到59行的if语句，显然条件都不满足，因此会走70行的else分支。在该分支中会调用`ViewGroup.addViewInLayout`方法将child添加到ListView中。  
同时，由于`isAttachedToWindow`为false，所以`needToMeasure`初始化为了true。因此，child会在第91行完成measure操作，在103行完成layout操作。  

值得一提的是，在层层返回到`layoutChildren`方法之后，方法会继续执行到第105行的`recycleBin.scrapActiveViews();`语句，该方法会将`ActionViews`所有剩下的View移动到`ScrapView`集合中。也就是说，`ActionViews`的生命周期仅仅只存在于layout过程中。

至此，ListView初次layout的缓存流程已经探究完毕。下面我们看再次layout时的缓存流程。

### 1.3 ListView再次layout

再次layout主要是探究有缓存的情况下，ListView如何处理缓存的。  

我们直接从`layoutChildren`方法开始：

```java
@Override
protected void layoutChildren() {
    final boolean blockLayoutRequests = mBlockLayoutRequests;
    if (blockLayoutRequests) {
        return;
    }

    mBlockLayoutRequests = true;

    try {
        super.layoutChildren();

        invalidate();

        if (mAdapter == null) {
            resetList();
            invokeOnItemScrollListener();
            return;
        }

        final int childrenTop = mListPadding.top;
        final int childrenBottom = mBottom - mTop - mListPadding.bottom;
        final int childCount = getChildCount();

        int index = 0;
        int delta = 0;

        View sel;
        View oldSel = null;
        View oldFirst = null;
        View newSel = null;

        ...

        boolean dataChanged = mDataChanged;
        if (dataChanged) {
            handleDataChanged();
        }

        // Handle the empty set by removing all views that are visible
        // and calling it a day
        if (mItemCount == 0) {
            resetList();
            invokeOnItemScrollListener();
            return;
        } else if (mItemCount != mAdapter.getCount()) {
            throw new IllegalStateException("The content of the adapter has changed but "
                    + "ListView did not receive a notification. Make sure the content of "
                    + "your adapter is not modified from a background thread, but only from "
                    + "the UI thread. Make sure your adapter calls notifyDataSetChanged() "
                    + "when its content changes. [in ListView(" + getId() + ", " + getClass()
                    + ") with Adapter(" + mAdapter.getClass() + ")]");
        }

        setSelectedPositionInt(mNextSelectedPosition);

        ...

        // Pull all children into the RecycleBin.
        // These views will be reused if possible
        final int firstPosition = mFirstPosition;
        final RecycleBin recycleBin = mRecycler;
        if (dataChanged) {
            for (int i = 0; i < childCount; i++) {
                recycleBin.addScrapView(getChildAt(i), firstPosition+i);
            }
        } else {
            recycleBin.fillActiveViews(childCount, firstPosition);
        }

        // Clear out old views
        detachAllViewsFromParent();
        recycleBin.removeSkippedScrap();

        switch (mLayoutMode) {
            ...
        case LAYOUT_MOVE_SELECTION:
            ...
        default:
            if (childCount == 0) {
                if (!mStackFromBottom) {
                    final int position = lookForSelectablePosition(0, true);
                    setSelectedPositionInt(position);
                    sel = fillFromTop(childrenTop);
                } else {
                    final int position = lookForSelectablePosition(mItemCount - 1, false);
                    setSelectedPositionInt(position);
                    sel = fillUp(mItemCount - 1, childrenBottom);
                }
            } else {
                if (mSelectedPosition >= 0 && mSelectedPosition < mItemCount) {
                    sel = fillSpecific(mSelectedPosition,
                            oldSel == null ? childrenTop : oldSel.getTop());
                } else if (mFirstPosition < mItemCount) {
                    sel = fillSpecific(mFirstPosition,
                            oldFirst == null ? childrenTop : oldFirst.getTop());
                } else {
                    sel = fillSpecific(0, childrenTop);
                }
            }
            break;
        }

        // Flush any cached views that did not get reused above
        recycleBin.scrapActiveViews();

        // remove any header/footer that has been temp detached and not re-attached
        removeUnusedFixedViews(mHeaderViewInfos);
        removeUnusedFixedViews(mFooterViewInfos);

        ...

        // Tell focus view we are done mucking with it, if it is still in
        // our view hierarchy.
        if (focusLayoutRestoreView != null
                && focusLayoutRestoreView.getWindowToken() != null) {
            focusLayoutRestoreView.dispatchFinishTemporaryDetach();
        }

        mLayoutMode = LAYOUT_NORMAL;
        mDataChanged = false;
        if (mPositionScrollAfterLayout != null) {
            post(mPositionScrollAfterLayout);
            mPositionScrollAfterLayout = null;
        }
        mNeedSync = false;
        setNextSelectedPositionInt(mSelectedPosition);

        updateScrollIndicators();

        if (mItemCount > 0) {
            checkSelectionChanged();
        }

        invokeOnItemScrollListener();
    } finally {
        if (mFocusSelector != null) {
            mFocusSelector.onLayoutComplete();
        }
        if (!blockLayoutRequests) {
            mBlockLayoutRequests = false;
        }
    }
}
```

还是和初次layout一样，会执行第68行的`recycleBin.fillActiveViews`方法，不过由于此时ListView中有View了，所以这些子View都会被缓存到RecycleBin中。接着执行第72行的`detachAllViewsFromParent`方法将children的mParent以及自己置为null，这样会暂时从ListView中detach，待稍后在复用过程中调用`attachViewToParent`方法重新attach。  
接着来到了第75行的switch，我们还是进入了default分支。由于此时childCount不为0，所以会走else分支。又由于mSelectedPosition默认为`INVALID_POSITION`即-1，所以会走94行的分支，执行`fillSpecific`操作。

```java
/**
  * Put a specific item at a specific location on the screen and then build
  * up and down from there.
  *
  * @param position The reference view to use as the starting point
  * @param top Pixel offset from the top of this view to the top of the
  *        reference view.
  *
  * @return The selected view, or null if the selected view is outside the
  *         visible area.
  */
private View fillSpecific(int position, int top) {
    boolean tempIsSelected = position == mSelectedPosition;
    View temp = makeAndAddView(position, top, true, mListPadding.left, tempIsSelected);
    // Possibly changed again in fillUp if we add rows above this one.
    mFirstPosition = position;

    View above;
    View below;

    final int dividerHeight = mDividerHeight;
    if (!mStackFromBottom) {
        above = fillUp(position - 1, temp.getTop() - dividerHeight);
        // This will correct for the top of the first view not touching the top of the list
        adjustViewsUpOrDown();
        below = fillDown(position + 1, temp.getBottom() + dividerHeight);
        int childCount = getChildCount();
        if (childCount > 0) {
            correctTooHigh(childCount);
        }
    } else {
        below = fillDown(position + 1, temp.getBottom() + dividerHeight);
        // This will correct for the bottom of the last view not touching the bottom of the list
        adjustViewsUpOrDown();
        above = fillUp(position - 1, temp.getTop() - dividerHeight);
        int childCount = getChildCount();
        if (childCount > 0) {
                correctTooLow(childCount);
        }
    }

    if (tempIsSelected) {
        return temp;
    } else if (above != null) {
        return above;
    } else {
        return below;
    }
}
```

`fillSpecific()`方法和`fillUp()`、`fillDown()`方法功能差不多，都是fill操作，不同的是`fillSpecific()`方法会先将指定位置的子View先加载到屏幕上，然后再从该View往上以及往下fill其它子View。  
这里我们直接关注重点方法——`makeAndAddView`：

```java
/**
  * Obtains the view and adds it to our list of children. The view can be
  * made fresh, converted from an unused view, or used as is if it was in
  * the recycle bin.
  *
  * @param position logical position in the list
  * @param y top or bottom edge of the view to add
  * @param flow {@code true} to align top edge to y, {@code false} to align
  *             bottom edge to y
  * @param childrenLeft left edge where children should be positioned
  * @param selected {@code true} if the position is selected, {@code false}
  *                 otherwise
  * @return the view that was added
  */
private View makeAndAddView(int position, int y, boolean flow, int childrenLeft,
        boolean selected) {
    if (!mDataChanged) {
        // Try to use an existing view for this position.
        final View activeView = mRecycler.getActiveView(position);
        if (activeView != null) {
            // Found it. We're reusing an existing child, so it just needs
            // to be positioned like a scrap view.
            setupChild(activeView, position, y, flow, childrenLeft, selected, true);
            return activeView;
        }
    }

    // Make a new view for this position, or convert an unused view if
    // possible.
    final View child = obtainView(position, mIsScrap);

    // This needs to be positioned and measured.
    setupChild(child, position, y, flow, childrenLeft, selected, mIsScrap[0]);

    return child;
}
```

还是先尝试从`ActiveViews`中获取View，显然这次可以了。接着调用第23行的`setupChild`方法并返回了actionView。既然如何，ListView就不会执行下面第30行的`obtainView`方法了，因为`ActiveViews`中获取的View肯定是上一刻还显示在屏幕上的，无需让Adapter再次inflate布局或者重新更新的UI值。

我们注意到上面第23行的`setupChild`方法中，最后一个参数为`true`，该参数是`isAttachedToWindow`。因此`needToMeasure`为false，表示child不需要重新measure、layout；另外，也会导致下面第59行的if为true，进而导致调用`attachViewToParent`方法，让child重新attach到ListView上：

```java
/**
  * Adds a view as a child and make sure it is measured (if necessary) and
  * positioned properly.
  *
  * @param child the view to add
  * @param position the position of this child
  * @param y the y position relative to which this view will be positioned
  * @param flowDown {@code true} to align top edge to y, {@code false} to
  *                 align bottom edge to y
  * @param childrenLeft left edge where children should be positioned
  * @param selected {@code true} if the position is selected, {@code false}
  *                 otherwise
  * @param isAttachedToWindow {@code true} if the view is already attached
  *                           to the window, e.g. whether it was reused, or
  *                           {@code false} otherwise
  */
private void setupChild(View child, int position, int y, boolean flowDown, int childrenLeft,
        boolean selected, boolean isAttachedToWindow) {
    Trace.traceBegin(Trace.TRACE_TAG_VIEW, "setupListItem");

    final boolean isSelected = selected && shouldShowSelector();
    final boolean updateChildSelected = isSelected != child.isSelected();
    final int mode = mTouchMode;
    final boolean isPressed = mode > TOUCH_MODE_DOWN && mode < TOUCH_MODE_SCROLL
            && mMotionPosition == position;
    final boolean updateChildPressed = isPressed != child.isPressed();
    final boolean needToMeasure = !isAttachedToWindow || updateChildSelected
            || child.isLayoutRequested();

    // Respect layout params that are already in the view. Otherwise make
    // some up...
    AbsListView.LayoutParams p = (AbsListView.LayoutParams) child.getLayoutParams();
    if (p == null) {
        p = (AbsListView.LayoutParams) generateDefaultLayoutParams();
    }
    p.viewType = mAdapter.getItemViewType(position);
    p.isEnabled = mAdapter.isEnabled(position);

    // Set up view state before attaching the view, since we may need to
    // rely on the jumpDrawablesToCurrentState() call that occurs as part
    // of view attachment.
    if (updateChildSelected) {
        child.setSelected(isSelected);
    }

    if (updateChildPressed) {
        child.setPressed(isPressed);
    }

    if (mChoiceMode != CHOICE_MODE_NONE && mCheckStates != null) {
        if (child instanceof Checkable) {
            ((Checkable) child).setChecked(mCheckStates.get(position));
        } else if (getContext().getApplicationInfo().targetSdkVersion
                >= android.os.Build.VERSION_CODES.HONEYCOMB) {
            child.setActivated(mCheckStates.get(position));
        }
    }

    if ((isAttachedToWindow && !p.forceAdd) || (p.recycledHeaderFooter
            && p.viewType == AdapterView.ITEM_VIEW_TYPE_HEADER_OR_FOOTER)) {
        attachViewToParent(child, flowDown ? -1 : 0, p);

        // If the view was previously attached for a different position,
        // then manually jump the drawables.
        if (isAttachedToWindow
                && (((AbsListView.LayoutParams) child.getLayoutParams()).scrappedFromPosition)
                        != position) {
            child.jumpDrawablesToCurrentState();
        }
    } else {
        p.forceAdd = false;
        if (p.viewType == AdapterView.ITEM_VIEW_TYPE_HEADER_OR_FOOTER) {
            p.recycledHeaderFooter = true;
        }
        addViewInLayout(child, flowDown ? -1 : 0, p, true);
        // add view in layout will reset the RTL properties. We have to re-resolve them
        child.resolveRtlPropertiesIfNeeded();
    }

    if (needToMeasure) {
        final int childWidthSpec = ViewGroup.getChildMeasureSpec(mWidthMeasureSpec,
                mListPadding.left + mListPadding.right, p.width);
        final int lpHeight = p.height;
        final int childHeightSpec;
        if (lpHeight > 0) {
            childHeightSpec = MeasureSpec.makeMeasureSpec(lpHeight, MeasureSpec.EXACTLY);
        } else {
            childHeightSpec = MeasureSpec.makeSafeMeasureSpec(getMeasuredHeight(),
                    MeasureSpec.UNSPECIFIED);
        }
        child.measure(childWidthSpec, childHeightSpec);
    } else {
        cleanupLayoutState(child);
    }

    final int w = child.getMeasuredWidth();
    final int h = child.getMeasuredHeight();
    final int childTop = flowDown ? y : y - h;

    if (needToMeasure) {
        final int childRight = childrenLeft + w;
        final int childBottom = childTop + h;
        child.layout(childrenLeft, childTop, childRight, childBottom);
    } else {
        child.offsetLeftAndRight(childrenLeft - child.getLeft());
        child.offsetTopAndBottom(childTop - child.getTop());
    }

    if (mCachingStarted && !child.isDrawingCacheEnabled()) {
        child.setDrawingCacheEnabled(true);
    }

    Trace.traceEnd(Trace.TRACE_TAG_VIEW);
}
```

回想一下第59行if的意义

- 第一次layout时由于没有可用的缓存，所以创建了新的View并使`isAttachedToWindow`为false，这样会调用`addViewInLayout`方法向ListView添加一个新View
- 第二次layout由于有可用的缓存，且缓存View由于`detachAllViewsFromParent()`方法的调用从而暂时处于detach状态；接着在成功复用到了View后，调用`setupChild`方法时传入参数`isAttachedToWindow`为true，这样就会执行`attachViewToParent`方法了，使child恢复了attach状态

至此第二次layout过程结束了，下面研究一下用户滑动ListView时发生了什么。

### 1.4 用户滑动

`ListView`的`onTouchEvent`实现是在`AbsListView`中，也就是说`GridView`也有着同样的机制。

```java
@Override
public boolean onTouchEvent(MotionEvent ev) {
    if (!isEnabled()) {
        // A disabled view that is clickable still consumes the touch
        // events, it just doesn't respond to them.
        return isClickable() || isLongClickable();
    }

    if (mPositionScroller != null) {
        mPositionScroller.stop();
    }

    if (mIsDetaching || !isAttachedToWindow()) {
        // Something isn't right.
        // Since we rely on being attached to get data set change notifications,
        // don't risk doing anything where we might try to resync and find things
        // in a bogus state.
        return false;
    }

    startNestedScroll(SCROLL_AXIS_VERTICAL);

    if (mFastScroll != null && mFastScroll.onTouchEvent(ev)) {
        return true;
    }

    initVelocityTrackerIfNotExists();
    final MotionEvent vtev = MotionEvent.obtain(ev);

    final int actionMasked = ev.getActionMasked();
    if (actionMasked == MotionEvent.ACTION_DOWN) {
        mNestedYOffset = 0;
    }
    vtev.offsetLocation(0, mNestedYOffset);
    switch (actionMasked) {
        case MotionEvent.ACTION_DOWN: {
            onTouchDown(ev);
            break;
        }

        case MotionEvent.ACTION_MOVE: {
            onTouchMove(ev, vtev);
            break;
        }

        case MotionEvent.ACTION_UP: {
            onTouchUp(ev);
            break;
        }

        case MotionEvent.ACTION_CANCEL: {
            onTouchCancel();
            break;
        }

        case MotionEvent.ACTION_POINTER_UP: {
            onSecondaryPointerUp(ev);
            final int x = mMotionX;
            final int y = mMotionY;
            final int motionPosition = pointToPosition(x, y);
            if (motionPosition >= 0) {
                // Remember where the motion event started
                final View child = getChildAt(motionPosition - mFirstPosition);
                mMotionViewOriginalTop = child.getTop();
                mMotionPosition = motionPosition;
            }
            mLastY = y;
            break;
        }

        case MotionEvent.ACTION_POINTER_DOWN: {
            // New pointers take over dragging duties
            final int index = ev.getActionIndex();
            final int id = ev.getPointerId(index);
            final int x = (int) ev.getX(index);
            final int y = (int) ev.getY(index);
            mMotionCorrection = 0;
            mActivePointerId = id;
            mMotionX = x;
            mMotionY = y;
            final int motionPosition = pointToPosition(x, y);
            if (motionPosition >= 0) {
                // Remember where the motion event started
                final View child = getChildAt(motionPosition - mFirstPosition);
                mMotionViewOriginalTop = child.getTop();
                mMotionPosition = motionPosition;
            }
            mLastY = y;
            break;
        }
    }

    if (mVelocityTracker != null) {
        mVelocityTracker.addMovement(vtev);
    }
    vtev.recycle();
    return true;
}
```

MotionEvent的事件种类太多了，而我们只关心移动的事件，所以直接看`onTouchMove`方法即可：

```java
private void onTouchMove(MotionEvent ev, MotionEvent vtev) {
    if (mHasPerformedLongPress) {
        // Consume all move events following a successful long press.
        return;
    }

    int pointerIndex = ev.findPointerIndex(mActivePointerId);
    if (pointerIndex == -1) {
        pointerIndex = 0;
        mActivePointerId = ev.getPointerId(pointerIndex);
    }

    if (mDataChanged) {
        // Re-sync everything if data has been changed
        // since the scroll operation can query the adapter.
        layoutChildren();
    }

    final int y = (int) ev.getY(pointerIndex);

    switch (mTouchMode) {
        case TOUCH_MODE_DOWN:
        case TOUCH_MODE_TAP:
        case TOUCH_MODE_DONE_WAITING:
            // Check if we have moved far enough that it looks more like a
            // scroll than a tap. If so, we'll enter scrolling mode.
            if (startScrollIfNeeded((int) ev.getX(pointerIndex), y, vtev)) {
                break;
            }
            // Otherwise, check containment within list bounds. If we're
            // outside bounds, cancel any active presses.
            final View motionView = getChildAt(mMotionPosition - mFirstPosition);
            final float x = ev.getX(pointerIndex);
            if (!pointInView(x, y, mTouchSlop)) {
                setPressed(false);
                if (motionView != null) {
                    motionView.setPressed(false);
                }
                removeCallbacks(mTouchMode == TOUCH_MODE_DOWN ?
                        mPendingCheckForTap : mPendingCheckForLongPress);
                mTouchMode = TOUCH_MODE_DONE_WAITING;
                updateSelectorState();
            } else if (motionView != null) {
                // Still within bounds, update the hotspot.
                final float[] point = mTmpPoint;
                point[0] = x;
                point[1] = y;
                transformPointToViewLocal(point, motionView);
                motionView.drawableHotspotChanged(point[0], point[1]);
            }
            break;
        case TOUCH_MODE_SCROLL:
        case TOUCH_MODE_OVERSCROLL:
            scrollIfNeeded((int) ev.getX(pointerIndex), y, vtev);
            break;
    }
}
```

`onTouchMove`方法会对`mTouchMode`做一个switch，手指在屏幕上滑动时，对应的mode为`TOUCH_MODE_SCROLL`，所以我们直接来到了`scrollIfNeeded`方法。由于方法实在有点长，所以省略了不相关的一些代码：

```java
private void scrollIfNeeded(int x, int y, MotionEvent vtev) {
    int rawDeltaY = y - mMotionY;
    int scrollOffsetCorrection = 0;
    int scrollConsumedCorrection = 0;
    if (mLastY == Integer.MIN_VALUE) {
        rawDeltaY -= mMotionCorrection;
    }
    ...
    final int deltaY = rawDeltaY;
    int incrementalDeltaY =
            mLastY != Integer.MIN_VALUE ? y - mLastY + scrollConsumedCorrection : deltaY;
    int lastYCorrection = 0;

    if (mTouchMode == TOUCH_MODE_SCROLL) {
        if (PROFILE_SCROLLING) {
            if (!mScrollProfilingStarted) {
                Debug.startMethodTracing("AbsListViewScroll");
                mScrollProfilingStarted = true;
            }
        }

        if (mScrollStrictSpan == null) {
            // If it's non-null, we're already in a scroll.
            mScrollStrictSpan = StrictMode.enterCriticalSpan("AbsListView-scroll");
        }

        if (y != mLastY) {
            // We may be here after stopping a fling and continuing to scroll.
            // If so, we haven't disallowed intercepting touch events yet.
            // Make sure that we do so in case we're in a parent that can intercept.
            if ((mGroupFlags & FLAG_DISALLOW_INTERCEPT) == 0 &&
                    Math.abs(rawDeltaY) > mTouchSlop) {
                final ViewParent parent = getParent();
                if (parent != null) {
                    parent.requestDisallowInterceptTouchEvent(true);
                }
            }

            final int motionIndex;
            if (mMotionPosition >= 0) {
                motionIndex = mMotionPosition - mFirstPosition;
            } else {
                // If we don't have a motion position that we can reliably track,
                // pick something in the middle to make a best guess at things below.
                motionIndex = getChildCount() / 2;
            }

            int motionViewPrevTop = 0;
            View motionView = this.getChildAt(motionIndex);
            if (motionView != null) {
                motionViewPrevTop = motionView.getTop();
            }

            // No need to do all this work if we're not going to move anyway
            boolean atEdge = false;
            if (incrementalDeltaY != 0) {
                atEdge = trackMotionScroll(deltaY, incrementalDeltaY);
            }

            // Check to see if we have bumped into the scroll limit
            motionView = this.getChildAt(motionIndex);
            if (motionView != null) {
                // Check if the top of the motion view is where it is
                // supposed to be
                final int motionViewRealTop = motionView.getTop();
                if (atEdge) {
                    // Apply overscroll

                    int overscroll = -incrementalDeltaY -
                            (motionViewRealTop - motionViewPrevTop);
                    if (dispatchNestedScroll(0, overscroll - incrementalDeltaY, 0, overscroll,
                            mScrollOffset)) {
                        lastYCorrection -= mScrollOffset[1];
                        if (vtev != null) {
                            vtev.offsetLocation(0, mScrollOffset[1]);
                            mNestedYOffset += mScrollOffset[1];
                        }
                    } else {
                        final boolean atOverscrollEdge = overScrollBy(0, overscroll,
                                0, mScrollY, 0, 0, 0, mOverscrollDistance, true);

                        if (atOverscrollEdge && mVelocityTracker != null) {
                            // Don't allow overfling if we're at the edge
                            mVelocityTracker.clear();
                        }

                        final int overscrollMode = getOverScrollMode();
                        if (overscrollMode == OVER_SCROLL_ALWAYS ||
                                (overscrollMode == OVER_SCROLL_IF_CONTENT_SCROLLS &&
                                        !contentFits())) {
                            if (!atOverscrollEdge) {
                                mDirection = 0; // Reset when entering overscroll.
                                mTouchMode = TOUCH_MODE_OVERSCROLL;
                            }
                            if (incrementalDeltaY > 0) {
                                mEdgeGlowTop.onPull((float) -overscroll / getHeight(),
                                        (float) x / getWidth());
                                if (!mEdgeGlowBottom.isFinished()) {
                                    mEdgeGlowBottom.onRelease();
                                }
                                invalidateTopGlow();
                            } else if (incrementalDeltaY < 0) {
                                mEdgeGlowBottom.onPull((float) overscroll / getHeight(),
                                        1.f - (float) x / getWidth());
                                if (!mEdgeGlowTop.isFinished()) {
                                    mEdgeGlowTop.onRelease();
                                }
                                invalidateBottomGlow();
                            }
                        }
                    }
                }
                mMotionY = y + lastYCorrection + scrollOffsetCorrection;
            }
            mLastY = y + lastYCorrection + scrollOffsetCorrection;
        }
    } else if (mTouchMode == TOUCH_MODE_OVERSCROLL) {
        ...
    }
}
```

上面的方法中我们需要看的就是第57行的`trackMotionScroll`方法，由于滑动的每个事件都会触发上面的方法，所以方法会被调用很多次。`trackMotionScroll`代码如下：

```java
/**
  * Track a motion scroll
  *
  * @param deltaY Amount to offset mMotionView. This is the accumulated delta since the motion
  *        began. Positive numbers mean the user's finger is moving down the screen.
  * @param incrementalDeltaY Change in deltaY from the previous event.
  * @return true if we're already at the beginning/end of the list and have nothing to do.
  */
boolean trackMotionScroll(int deltaY, int incrementalDeltaY) {
    final int childCount = getChildCount();
    if (childCount == 0) {
        return true;
    }

    final int firstTop = getChildAt(0).getTop();
    final int lastBottom = getChildAt(childCount - 1).getBottom();

    final Rect listPadding = mListPadding;

    // "effective padding" In this case is the amount of padding that affects
    // how much space should not be filled by items. If we don't clip to padding
    // there is no effective padding.
    int effectivePaddingTop = 0;
    int effectivePaddingBottom = 0;
    if ((mGroupFlags & CLIP_TO_PADDING_MASK) == CLIP_TO_PADDING_MASK) {
        effectivePaddingTop = listPadding.top;
        effectivePaddingBottom = listPadding.bottom;
    }

     // FIXME account for grid vertical spacing too?
    final int spaceAbove = effectivePaddingTop - firstTop;
    final int end = getHeight() - effectivePaddingBottom;
    final int spaceBelow = lastBottom - end;

    final int height = getHeight() - mPaddingBottom - mPaddingTop;
    if (deltaY < 0) {
        deltaY = Math.max(-(height - 1), deltaY);
    } else {
        deltaY = Math.min(height - 1, deltaY);
    }

    if (incrementalDeltaY < 0) {
        incrementalDeltaY = Math.max(-(height - 1), incrementalDeltaY);
    } else {
        incrementalDeltaY = Math.min(height - 1, incrementalDeltaY);
    }

    final int firstPosition = mFirstPosition;

    // Update our guesses for where the first and last views are
    if (firstPosition == 0) {
        mFirstPositionDistanceGuess = firstTop - listPadding.top;
    } else {
        mFirstPositionDistanceGuess += incrementalDeltaY;
    }
    if (firstPosition + childCount == mItemCount) {
        mLastPositionDistanceGuess = lastBottom + listPadding.bottom;
    } else {
        mLastPositionDistanceGuess += incrementalDeltaY;
    }

    final boolean cannotScrollDown = (firstPosition == 0 &&
            firstTop >= listPadding.top && incrementalDeltaY >= 0);
    final boolean cannotScrollUp = (firstPosition + childCount == mItemCount &&
            lastBottom <= getHeight() - listPadding.bottom && incrementalDeltaY <= 0);

    if (cannotScrollDown || cannotScrollUp) {
        return incrementalDeltaY != 0;
    }

    final boolean down = incrementalDeltaY < 0;

    final boolean inTouchMode = isInTouchMode();
    if (inTouchMode) {
        hideSelector();
    }

    final int headerViewsCount = getHeaderViewsCount();
    final int footerViewsStart = mItemCount - getFooterViewsCount();

    int start = 0;
    int count = 0;

    if (down) {
        int top = -incrementalDeltaY;
        if ((mGroupFlags & CLIP_TO_PADDING_MASK) == CLIP_TO_PADDING_MASK) {
            top += listPadding.top;
        }
        for (int i = 0; i < childCount; i++) {
            final View child = getChildAt(i);
            if (child.getBottom() >= top) {
                break;
            } else {
                count++;
                int position = firstPosition + i;
                if (position >= headerViewsCount && position < footerViewsStart) {
                    // The view will be rebound to new data, clear any
                    // system-managed transient state.
                    child.clearAccessibilityFocus();
                    mRecycler.addScrapView(child, position);
                }
            }
        }
    } else {
        int bottom = getHeight() - incrementalDeltaY;
        if ((mGroupFlags & CLIP_TO_PADDING_MASK) == CLIP_TO_PADDING_MASK) {
            bottom -= listPadding.bottom;
        }
        for (int i = childCount - 1; i >= 0; i--) {
            final View child = getChildAt(i);
            if (child.getTop() <= bottom) {
                break;
            } else {
                start = i;
                count++;
                int position = firstPosition + i;
                if (position >= headerViewsCount && position < footerViewsStart) {
                    // The view will be rebound to new data, clear any
                    // system-managed transient state.
                    child.clearAccessibilityFocus();
                    mRecycler.addScrapView(child, position);
                }
            }
        }
    }

    mMotionViewNewTop = mMotionViewOriginalTop + deltaY;

    mBlockLayoutRequests = true;

    if (count > 0) {
        detachViewsFromParent(start, count);
        mRecycler.removeSkippedScrap();
    }

    // invalidate before moving the children to avoid unnecessary invalidate
    // calls to bubble up from the children all the way to the top
    if (!awakenScrollBars()) {
        invalidate();
    }

    offsetChildrenTopAndBottom(incrementalDeltaY);

    if (down) {
        mFirstPosition += count;
    }

    final int absIncrementalDeltaY = Math.abs(incrementalDeltaY);
    if (spaceAbove < absIncrementalDeltaY || spaceBelow < absIncrementalDeltaY) {
        fillGap(down);
    }

    mRecycler.fullyDetachScrapViews();
    if (!inTouchMode && mSelectedPosition != INVALID_POSITION) {
        final int childIndex = mSelectedPosition - mFirstPosition;
        if (childIndex >= 0 && childIndex < getChildCount()) {
            positionSelector(mSelectedPosition, getChildAt(childIndex));
        }
    } else if (mSelectorPosition != INVALID_POSITION) {
        final int childIndex = mSelectorPosition - mFirstPosition;
        if (childIndex >= 0 && childIndex < getChildCount()) {
            positionSelector(INVALID_POSITION, getChildAt(childIndex));
        }
    } else {
        mSelectorRect.setEmpty();
    }

    mBlockLayoutRequests = false;

    invokeOnItemScrollListener();

    return false;
}
```

这个方法接收两个参数，deltaY表示从手指按下时的位置到当前手指位置的距离，incrementalDeltaY则表示据上次触发event事件手指在Y方向上位置的改变量，那么其实我们就可以通过incrementalDeltaY的正负值情况来判断用户是向上还是向下滑动的了。如第71行所示，如果incrementalDeltaY小于0，说明是向下滑动，否则就是向上滑动。  

下面将会进行一个边界值检测的过程，可以看到，从第89行开始，当ListView向下滑动的时候，就会进入一个for循环当中，从上往下依次获取子View，第91行当中，如果该子View的bottom值已经小于top值了，就说明这个子View已经移出屏幕了，所以会调用`RecycleBin.addScrapView()`方法将这个View加入到scrap view当中，并将count计数器加1，计数器用于记录有多少个子View被移出了屏幕。那么如果是ListView向上滑动的话，其实过程是基本相同的，只不过变成了从下往上依次获取子View，然后判断该子View的top值是不是大于bottom值了，如果大于的话说明子View已经移出了屏幕，同样把它加入到废弃缓存中，并将计数器加1。

接下来在第132行，会根据当前计数器的值来进行一个detach操作，它的作用就是把所有移出屏幕的子View全部detach掉。紧接着在第142行调用了`offsetChildrenTopAndBottom()`方法，并将incrementalDeltaY作为参数传入，这个方法的作用是让ListView中所有的子View都按照传入的参数值进行相应的偏移，这样就实现了随着手指的拖动，ListView的内容也会随着滚动的效果。

然后在第149行会进行判断，如果ListView中最后一个View的底部已经移入了屏幕，或者ListView中第一个View的顶部移入了屏幕，就会调用`fillGap()`方法，那么因此我们就可以猜出`fillGap()`方法是用来加载屏幕外数据的。该方法是个抽象方法，需要子类实现，所以我们看看`ListView.fillGap`方法：

```java
/**
  * {@inheritDoc}
  */
@Override
void fillGap(boolean down) {
    final int count = getChildCount();
    if (down) {
        int paddingTop = 0;
        if ((mGroupFlags & CLIP_TO_PADDING_MASK) == CLIP_TO_PADDING_MASK) {
            paddingTop = getListPaddingTop();
        }
        final int startOffset = count > 0 ? getChildAt(count - 1).getBottom() + mDividerHeight :
                paddingTop;
        fillDown(mFirstPosition + count, startOffset);
        correctTooHigh(getChildCount());
    } else {
        int paddingBottom = 0;
        if ((mGroupFlags & CLIP_TO_PADDING_MASK) == CLIP_TO_PADDING_MASK) {
            paddingBottom = getListPaddingBottom();
        }
        final int startOffset = count > 0 ? getChildAt(0).getTop() - mDividerHeight :
                getHeight() - paddingBottom;
        fillUp(mFirstPosition - 1, startOffset);
        correctTooLow(getChildCount());
    }
}
```

无论是`fillDown`还是`fillUp`，里面都是通过`makeAndAddView`方法来得到View，不过此时有些不同，因为`ActiveViews`已经在layout过程完成后被清空了，所以会执行`obtainView`方法来获取view：

```java
/**
  * Obtains the view and adds it to our list of children. The view can be
  * made fresh, converted from an unused view, or used as is if it was in
  * the recycle bin.
  *
  * @param position logical position in the list
  * @param y top or bottom edge of the view to add
  * @param flow {@code true} to align top edge to y, {@code false} to align
  *             bottom edge to y
  * @param childrenLeft left edge where children should be positioned
  * @param selected {@code true} if the position is selected, {@code false}
  *                 otherwise
  * @return the view that was added
  */
private View makeAndAddView(int position, int y, boolean flow, int childrenLeft,
        boolean selected) {
    if (!mDataChanged) {
        // Try to use an existing view for this position.
        final View activeView = mRecycler.getActiveView(position);
        if (activeView != null) {
            // Found it. We're reusing an existing child, so it just needs
            // to be positioned like a scrap view.
            setupChild(activeView, position, y, flow, childrenLeft, selected, true);
            return activeView;
        }
    }

    // Make a new view for this position, or convert an unused view if
    // possible.
    final View child = obtainView(position, mIsScrap);

    // This needs to be positioned and measured.
    setupChild(child, position, y, flow, childrenLeft, selected, mIsScrap[0]);

    return child;
}

/**
 * Gets a view and have it show the data associated with the specified
 * position. This is called when we have already discovered that the view
 * is not available for reuse in the recycle bin. The only choices left are
 * converting an old view or making a new one.
 *
 * @param position the position to display
 * @param outMetadata an array of at least 1 boolean where the first entry
 *                    will be set {@code true} if the view is currently
 *                    attached to the window, {@code false} otherwise (e.g.
 *                    newly-inflated or remained scrap for multiple layout
 *                    passes)
 *
 * @return A view displaying the data associated with the specified position
 */
View obtainView(int position, boolean[] outMetadata) {
    Trace.traceBegin(Trace.TRACE_TAG_VIEW, "obtainView");

    outMetadata[0] = false;

    // Check whether we have a transient state view. Attempt to re-bind the
    // data and discard the view if we fail.
    final View transientView = mRecycler.getTransientStateView(position);
    if (transientView != null) {
        final LayoutParams params = (LayoutParams) transientView.getLayoutParams();

        // If the view type hasn't changed, attempt to re-bind the data.
        if (params.viewType == mAdapter.getItemViewType(position)) {
            final View updatedView = mAdapter.getView(position, transientView, this);

            // If we failed to re-bind the data, scrap the obtained view.
            if (updatedView != transientView) {
                setItemViewLayoutParams(updatedView, position);
                mRecycler.addScrapView(updatedView, position);
            }
        }

        outMetadata[0] = true;

        // Finish the temporary detach started in addScrapView().
        transientView.dispatchFinishTemporaryDetach();
        return transientView;
    }

    final View scrapView = mRecycler.getScrapView(position);
    final View child = mAdapter.getView(position, scrapView, this);
    if (scrapView != null) {
        if (child != scrapView) {
            // Failed to re-bind the data, return scrap to the heap.
            mRecycler.addScrapView(scrapView, position);
        } else if (child.isTemporarilyDetached()) {
            outMetadata[0] = true;

            // Finish the temporary detach started in addScrapView().
            child.dispatchFinishTemporaryDetach();
        }
    }

    if (mCacheColorHint != 0) {
        child.setDrawingCacheBackgroundColor(mCacheColorHint);
    }

    ...

    setItemViewLayoutParams(child, position);

    ...

    Trace.traceEnd(Trace.TRACE_TAG_VIEW);

    return child;
}
```

在上面第61行会调用`RecycleBin.getTransientStateView`方法获取transient状态的ScrapView，一般是没有的。所以会执行第83行的`RecycleBin.getScrapView`方法从`ScrapViews`里面获取一个View。在`trackMotionScroll`方法中我们会将任何移出屏幕的View添加到`ScrapViews`中，所以肯定是可以取到这个View的。因此，会在第84行中调用`Adapter.getView`方法让Adapter复用该View，并填充对应的数据，这样这个View看起来就像是全新的一样。

当然，如果复用View时，控件没有处理好，也是会出现复用引起的bug的，值得注意。一个典型的问题就是，如果某数据值为true就设置ImageView显示某个图片，但是值为false时又没有做任何处理，快速滑动时就会出现ImageView的显示与实际数据对不上的情况。

那么，以上就是ListView缓存机制的全部内容。

## 2. RecyclerView缓存策略

RecyclerView源码解析可以参考[RecyclerView 源码分析](https://www.jianshu.com/p/61fe3f3bb7ec)系列

首先，我们还是看一下RecycerView典型的`Adapter`的实现：

```java

public class MyRecyclerViewAdapter extends RecyclerView.Adapter<RecyclerviewAdapter.MyViewHolder> {
 
    private Context context;
    private List<String> data;
 
    public MyRecyclerViewAdapter(Context context,List<String> data){
        this.context = context;
        this.data = data;
    }
 
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(context).inflate(R.layout.recycler_item_my, parent, false);
        return new MyViewHolder(view);
    }
 
    @Override
    public void onBindViewHolder(@NonNull MyViewHolder holder, final int position) {
        holder.name.setText(data.get(position));
 
        holder.itemView.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                Log.e("这里是点击每一行item的响应事件",""+position+item);
            }
        });
 
    }
 
    @Override
    public int getItemCount() {
        return data.size();
    }
 
    public class MyViewHolder extends RecyclerView.ViewHolder{
        TextView name;
 
        public MyViewHolder(View itemView) {
            super(itemView);
            name = itemView.findViewById(R.id.name);
        }
    }
}
```

可以看到`Adapter`主要是两个方法在缓存中起作用：用来创建新的ViewHolder的`onCreateViewHolder`，以及用来显示数据的`onBindViewHolder`方法。

### 2.1 Recycler

同`ListView`中的`RecycleBin`一样，`RecyclerView`中的缓存也由一个内部类`Recycler`进行管理。`Recycler`里面有四个不同层次的缓存，比`ListView`层次要丰富一点，当然，这与`RecyclerView`拓展性更好有一定的关系。

`Recycler`里面字段如下：

```java
final ArrayList<ViewHolder> mAttachedScrap = new ArrayList<>();
ArrayList<ViewHolder> mChangedScrap = null;

final ArrayList<ViewHolder> mCachedViews = new ArrayList<ViewHolder>();

private final List<ViewHolder>
        mUnmodifiableAttachedScrap = Collections.unmodifiableList(mAttachedScrap);

private int mRequestedCacheMax = DEFAULT_CACHE_SIZE;
int mViewCacheMax = DEFAULT_CACHE_SIZE;

RecycledViewPool mRecyclerPool;

private ViewCacheExtension mViewCacheExtension;

static final int DEFAULT_CACHE_SIZE = 2;
```

解释如下：

- `mAttachedScrap`、`mChangedScrap`  
   **一级缓存**，同`ListView`中`ActionViews`，在layout发生前将屏幕上面的ViewHolder保存起来，供layout中进行复用
- `mCachedViews`  
   **二级缓存**，默认大小保持在`DEFAULT_CACHE_SIZE = 2`，可以通过`RecyclerView.setItemViewCacheSize(int)`方法进行设置
   `mCachedViews`数量如果超出限制，会根据索引将里面旧的移动到`RecyclerViewPool`中
- `ViewCacheExtension`  
   **三级缓存**，开发者可以自定义的缓存
- `RecyclerViewPool`  
   **四级缓存**，可以在多个RecyclerView中共享缓存  
   根据ViewType来缓存ViewHolder，每个ViewType的数组大小默认为`DEFAULT_MAX_SCRAP = 5`，超过部分会丢弃，可以通过其`setMaxRecycledViews(int viewType, int max)`方法来控制对应type的缓存池大小。

`Recycler`的方法本质上就是对上面数据结构的一些操作。主要的方法有：

- `recycleView(View)`  
   将view对应的ViewHolder移动到`mCachedViews`中；如果View是scrapped状态，会先unscrap
- `recycleViewHolderInternal(ViewHolder)`  
   将ViewHolder保存到`mCachedViews`中
- `addViewHolderToRecycledViewPool(ViewHolder, boolean)`  
   将ViewHolder保存到`RecycledViewPool`中
- `scrapView(View)`  
   将一个attached状态的View保存到`mAttachedScrap`或`mChangedScrap`中
- `getChangedScrapViewForPosition(int)`  
   从`mChangedScrap`中寻找匹配的ViewHolder
- `getScrapOrHiddenOrCachedHolderForPosition(int, boolean)`  
   依次从`mAttachedScrap`、`mCachedViews`中寻找匹配的ViewHolder
- `getScrapOrCachedViewForId(long, int, boolean)`  
   依次从`mAttachedScrap`、`mCachedViews`中寻找匹配的ViewHolder
- `tryGetViewHolderForPositionByDeadline(int, boolean, long)`  
   从`mChangedScrap`、`mAttachedScrap`、`mCachedViews`、`ViewCacheExtension`、`RecycledViewPool`中进行匹配；若匹配不了，最后会直接调用`Adapter.createViewHolder`方法进行创建
- `tryBindViewHolderByDeadline(ViewHolder, int, int, long)`  
   调用`Adapter.bindViewHolder`方法绑定View

### 2.2 缓存流程

`RecyclerView`的缓存流程同ListView一样，也是体现在了layout过程中。由于`RecyclerView` layout过程中步骤比较多，而这些内容不是本章的重点，所以这里只给出大致流程，重点放到缓存流程中。

`RecyclerView`的layout流程分为三个方法，对应layout step的三个步骤。这部分表格如下：

| layout step | layout过程 | 方法作用 |
| --------- | ------------ | --- |
| State.STEP_START | dispatchLayoutStep1 | `State.STEP_START`状态可以执行，执行完毕后状态变成`State.STEP_LAYOUT`<br />1. 处理Adapter的更新，更新一些相关的值<br />2. 决定应该执行哪个动画<br />3. 保存当前View的动画信息<br />4. 如果有必要，执行预测性的layout并保存View动画信息  |
| State.STEP_LAYOUT | dispatchLayoutStep2 | `State.STEP_LAYOUT | State.STEP_ANIMATIONS`状态可以执行，执行完毕后状态变成`State.STEP_ANIMATIONS`<br />真正执行views的layout；如有必要，该步骤可能执行多次 |
| State.STEP_ANIMATIONS | dispatchLayoutStep3 | `State.STEP_ANIMATIONS | State.STEP_ANIMATIONS`状态可以执行，执行开始前状态变成`State.STEP_START`<br />执行第一步保存的View的动画信息 |

本章中我们关注的重点显然是在`dispatchLayoutStep2`方法中：

```java
/**
  * The second layout step where we do the actual layout of the views for the final state.
  * This step might be run multiple times if necessary (e.g. measure).
  */
private void dispatchLayoutStep2() {
    eatRequestLayout();
    onEnterLayoutOrScroll();
    mState.assertLayoutStep(State.STEP_LAYOUT | State.STEP_ANIMATIONS);
    mAdapterHelper.consumeUpdatesInOnePass();
    mState.mItemCount = mAdapter.getItemCount();
    mState.mDeletedInvisibleItemCountSincePreviousLayout = 0;

    // Step 2: Run layout
    mState.mInPreLayout = false;
    mLayout.onLayoutChildren(mRecycler, mState);

    mState.mStructureChanged = false;
    mPendingSavedState = null;

    // onLayoutChildren may have caused client code to disable item animations; re-check
    mState.mRunSimpleAnimations = mState.mRunSimpleAnimations && mItemAnimator != null;
    mState.mLayoutStep = State.STEP_ANIMATIONS;
    onExitLayoutOrScroll();
    resumeRequestLayout(false);
}
```

该方法比较简单，重点在第15行的`mLayout.onLayoutChildren(mRecycler, mState)`方法中。这里mLayout我们选择最常用的`LinearLayoutManager`进行分析。`LinearLayoutManager.onLayoutChildren`方法如下：

```java
/**
  * {@inheritDoc}
  */
@Override
public void onLayoutChildren(RecyclerView.Recycler recycler, RecyclerView.State state) {
    // layout algorithm:
    // 1) by checking children and other variables, find an anchor coordinate and an anchor
    //  item position.
    // 2) fill towards start, stacking from bottom
    // 3) fill towards end, stacking from top
    // 4) scroll to fulfill requirements like stack from bottom.
    // create layout state
    if (DEBUG) {
        Log.d(TAG, "is pre layout:" + state.isPreLayout());
    }
    if (mPendingSavedState != null || mPendingScrollPosition != NO_POSITION) {
        if (state.getItemCount() == 0) {
            removeAndRecycleAllViews(recycler);
            return;
        }
    }
    if (mPendingSavedState != null && mPendingSavedState.hasValidAnchor()) {
        mPendingScrollPosition = mPendingSavedState.mAnchorPosition;
    }

    ensureLayoutState();
    mLayoutState.mRecycle = false;
    // resolve layout direction
    resolveShouldLayoutReverse();

    final View focused = getFocusedChild();
    if (!mAnchorInfo.mValid || mPendingScrollPosition != NO_POSITION
            || mPendingSavedState != null) {
        mAnchorInfo.reset();
        mAnchorInfo.mLayoutFromEnd = mShouldReverseLayout ^ mStackFromEnd;
        // calculate anchor position and coordinate
        updateAnchorInfoForLayout(recycler, state, mAnchorInfo);
        mAnchorInfo.mValid = true;
    } else if (focused != null && (mOrientationHelper.getDecoratedStart(focused)
                    >= mOrientationHelper.getEndAfterPadding()
            || mOrientationHelper.getDecoratedEnd(focused)
            <= mOrientationHelper.getStartAfterPadding())) {
        // This case relates to when the anchor child is the focused view and due to layout
        // shrinking the focused view fell outside the viewport, e.g. when soft keyboard shows
        // up after tapping an EditText which shrinks RV causing the focused view (The tapped
        // EditText which is the anchor child) to get kicked out of the screen. Will update the
        // anchor coordinate in order to make sure that the focused view is laid out. Otherwise,
        // the available space in layoutState will be calculated as negative preventing the
        // focused view from being laid out in fill.
        // Note that we won't update the anchor position between layout passes (refer to
        // TestResizingRelayoutWithAutoMeasure), which happens if we were to call
        // updateAnchorInfoForLayout for an anchor that's not the focused view (e.g. a reference
        // child which can change between layout passes).
        mAnchorInfo.assignFromViewAndKeepVisibleRect(focused);
    }
    if (DEBUG) {
        Log.d(TAG, "Anchor info:" + mAnchorInfo);
    }

    // LLM may decide to layout items for "extra" pixels to account for scrolling target,
    // caching or predictive animations.
    int extraForStart;
    int extraForEnd;
    final int extra = getExtraLayoutSpace(state);
    // If the previous scroll delta was less than zero, the extra space should be laid out
    // at the start. Otherwise, it should be at the end.
    if (mLayoutState.mLastScrollDelta >= 0) {
        extraForEnd = extra;
        extraForStart = 0;
    } else {
        extraForStart = extra;
        extraForEnd = 0;
    }
    extraForStart += mOrientationHelper.getStartAfterPadding();
    extraForEnd += mOrientationHelper.getEndPadding();
    if (state.isPreLayout() && mPendingScrollPosition != NO_POSITION
            && mPendingScrollPositionOffset != INVALID_OFFSET) {
        // if the child is visible and we are going to move it around, we should layout
        // extra items in the opposite direction to make sure new items animate nicely
        // instead of just fading in
        final View existing = findViewByPosition(mPendingScrollPosition);
        if (existing != null) {
            final int current;
            final int upcomingOffset;
            if (mShouldReverseLayout) {
                current = mOrientationHelper.getEndAfterPadding()
                        - mOrientationHelper.getDecoratedEnd(existing);
                upcomingOffset = current - mPendingScrollPositionOffset;
            } else {
                current = mOrientationHelper.getDecoratedStart(existing)
                        - mOrientationHelper.getStartAfterPadding();
                upcomingOffset = mPendingScrollPositionOffset - current;
            }
            if (upcomingOffset > 0) {
                extraForStart += upcomingOffset;
            } else {
                extraForEnd -= upcomingOffset;
            }
        }
    }
    int startOffset;
    int endOffset;
    final int firstLayoutDirection;
    if (mAnchorInfo.mLayoutFromEnd) {
        firstLayoutDirection = mShouldReverseLayout ? LayoutState.ITEM_DIRECTION_TAIL
                : LayoutState.ITEM_DIRECTION_HEAD;
    } else {
        firstLayoutDirection = mShouldReverseLayout ? LayoutState.ITEM_DIRECTION_HEAD
                : LayoutState.ITEM_DIRECTION_TAIL;
    }

    onAnchorReady(recycler, state, mAnchorInfo, firstLayoutDirection);
    detachAndScrapAttachedViews(recycler);
    mLayoutState.mInfinite = resolveIsInfinite();
    mLayoutState.mIsPreLayout = state.isPreLayout();
    if (mAnchorInfo.mLayoutFromEnd) {
        // fill towards start
        updateLayoutStateToFillStart(mAnchorInfo);
        mLayoutState.mExtra = extraForStart;
        fill(recycler, mLayoutState, state, false);
        startOffset = mLayoutState.mOffset;
        final int firstElement = mLayoutState.mCurrentPosition;
        if (mLayoutState.mAvailable > 0) {
            extraForEnd += mLayoutState.mAvailable;
        }
        // fill towards end
        updateLayoutStateToFillEnd(mAnchorInfo);
        mLayoutState.mExtra = extraForEnd;
        mLayoutState.mCurrentPosition += mLayoutState.mItemDirection;
        fill(recycler, mLayoutState, state, false);
        endOffset = mLayoutState.mOffset;

        if (mLayoutState.mAvailable > 0) {
            // end could not consume all. add more items towards start
            extraForStart = mLayoutState.mAvailable;
            updateLayoutStateToFillStart(firstElement, startOffset);
            mLayoutState.mExtra = extraForStart;
            fill(recycler, mLayoutState, state, false);
            startOffset = mLayoutState.mOffset;
        }
    } else {
        // fill towards end
        updateLayoutStateToFillEnd(mAnchorInfo);
        mLayoutState.mExtra = extraForEnd;
        fill(recycler, mLayoutState, state, false);
        endOffset = mLayoutState.mOffset;
        final int lastElement = mLayoutState.mCurrentPosition;
        if (mLayoutState.mAvailable > 0) {
            extraForStart += mLayoutState.mAvailable;
        }
        // fill towards start
        updateLayoutStateToFillStart(mAnchorInfo);
        mLayoutState.mExtra = extraForStart;
        mLayoutState.mCurrentPosition += mLayoutState.mItemDirection;
        fill(recycler, mLayoutState, state, false);
        startOffset = mLayoutState.mOffset;

        if (mLayoutState.mAvailable > 0) {
            extraForEnd = mLayoutState.mAvailable;
            // start could not consume all it should. add more items towards end
            updateLayoutStateToFillEnd(lastElement, endOffset);
            mLayoutState.mExtra = extraForEnd;
            fill(recycler, mLayoutState, state, false);
            endOffset = mLayoutState.mOffset;
        }
    }

    // changes may cause gaps on the UI, try to fix them.
    // TODO we can probably avoid this if neither stackFromEnd/reverseLayout/RTL values have
    // changed
    if (getChildCount() > 0) {
        // because layout from end may be changed by scroll to position
        // we re-calculate it.
        // find which side we should check for gaps.
        if (mShouldReverseLayout ^ mStackFromEnd) {
            int fixOffset = fixLayoutEndGap(endOffset, recycler, state, true);
            startOffset += fixOffset;
            endOffset += fixOffset;
            fixOffset = fixLayoutStartGap(startOffset, recycler, state, false);
            startOffset += fixOffset;
            endOffset += fixOffset;
        } else {
            int fixOffset = fixLayoutStartGap(startOffset, recycler, state, true);
            startOffset += fixOffset;
            endOffset += fixOffset;
            fixOffset = fixLayoutEndGap(endOffset, recycler, state, false);
            startOffset += fixOffset;
            endOffset += fixOffset;
        }
    }
    layoutForPredictiveAnimations(recycler, state, startOffset, endOffset);
    if (!state.isPreLayout()) {
        mOrientationHelper.onLayoutComplete();
    } else {
        mAnchorInfo.reset();
    }
    mLastStackFromEnd = mStackFromEnd;
    if (DEBUG) {
        validateChildOrder();
    }
}
```

方法很长，但还好有一些注释。  

1. 首先，从开头到第112行都是第一步的内容：计算锚点坐标以及锚点item的position。谁让112行是`onAnchorReady`方法呢，太明显了。
2. 注意第113行的`detachAndScrapAttachedViews`方法，该方法会对所有的子View调用`scrapOrRecycleView`方法。这样所有的子View都会暂时detach掉，并保存到`mAttachedScrap`或`mChangedScrap`或`mCachedViews`中，等待后续复用。  
    ```java
         /**
         * Temporarily detach and scrap all currently attached child views. Views will be scrapped
         * into the given Recycler. The Recycler may prefer to reuse scrap views before
         * other views that were previously recycled.
         *
         * @param recycler Recycler to scrap views into
         */
     public void detachAndScrapAttachedViews(Recycler recycler) {
         final int childCount = getChildCount();
         for (int i = childCount - 1; i >= 0; i--) {
             final View v = getChildAt(i);
             scrapOrRecycleView(recycler, i, v);
         }
     }

     private void scrapOrRecycleView(Recycler recycler, int index, View view) {
         final ViewHolder viewHolder = getChildViewHolderInt(view);
         if (viewHolder.shouldIgnore()) {
             if (DEBUG) {
                 Log.d(TAG, "ignoring view " + viewHolder);
             }
             return;
         }
         if (viewHolder.isInvalid() && !viewHolder.isRemoved()
                 && !mRecyclerView.mAdapter.hasStableIds()) {
             removeViewAt(index);
             recycler.recycleViewHolderInternal(viewHolder);
         } else {
             detachViewAt(index);
             recycler.scrapView(view);
             mRecyclerView.mViewInfoStore.onViewDetached(viewHolder);
         }
     }
    ```

    前面提到过`mCachedViews`如果空间不足，会根据索引将里面旧的移动到`RecyclerViewPool`中，这样此方法的就将除了`ViewCacheExtension`之外的缓存全部囊括了。

3. 根据计算的值，多次调用`fill`方法填充子View。  
    显然，`fill`方法是新重点。该方法和ListView中的`fillDown`等类似，也是循环计算-填充-计算，我们直接看填充部分。填充部分调用了`layoutChunk`方法：该方法会首先调用`LayoutState.next`方法获取一个view；然后会`addView`，add过程中如果是detach过的，将会view重新attach到RecyclerView上，否则就是remove过了的，直接addView；最后调用`measureChildWithMargins`、`layoutDecoratedWithMargins`方法对子View进行测量、布局。`layoutChunk`方法代码如下：

    ```java
    void layoutChunk(RecyclerView.Recycler recycler, RecyclerView.State state,
            LayoutState layoutState, LayoutChunkResult result) {
        View view = layoutState.next(recycler);
        if (view == null) {
            if (DEBUG && layoutState.mScrapList == null) {
                throw new RuntimeException("received null view when unexpected");
            }
            // if we are laying out views in scrap, this may return null which means there is
            // no more items to layout.
            result.mFinished = true;
            return;
        }
        LayoutParams params = (LayoutParams) view.getLayoutParams();
        if (layoutState.mScrapList == null) {
            if (mShouldReverseLayout == (layoutState.mLayoutDirection
                    == LayoutState.LAYOUT_START)) {
                addView(view);
            } else {
                addView(view, 0);
            }
        } else {
            if (mShouldReverseLayout == (layoutState.mLayoutDirection
                    == LayoutState.LAYOUT_START)) {
                addDisappearingView(view);
            } else {
                addDisappearingView(view, 0);
            }
        }
        measureChildWithMargins(view, 0, 0);
        result.mConsumed = mOrientationHelper.getDecoratedMeasurement(view);
        int left, top, right, bottom;
        if (mOrientation == VERTICAL) {
            if (isLayoutRTL()) {
                right = getWidth() - getPaddingRight();
                left = right - mOrientationHelper.getDecoratedMeasurementInOther(view);
            } else {
                left = getPaddingLeft();
                right = left + mOrientationHelper.getDecoratedMeasurementInOther(view);
            }
            if (layoutState.mLayoutDirection == LayoutState.LAYOUT_START) {
                bottom = layoutState.mOffset;
                top = layoutState.mOffset - result.mConsumed;
            } else {
                top = layoutState.mOffset;
                bottom = layoutState.mOffset + result.mConsumed;
            }
        } else {
            top = getPaddingTop();
            bottom = top + mOrientationHelper.getDecoratedMeasurementInOther(view);
    
            if (layoutState.mLayoutDirection == LayoutState.LAYOUT_START) {
                right = layoutState.mOffset;
                left = layoutState.mOffset - result.mConsumed;
            } else {
                left = layoutState.mOffset;
                right = layoutState.mOffset + result.mConsumed;
            }
        }
        // We calculate everything with View's bounding box (which includes decor and margins)
        // To calculate correct layout position, we subtract margins.
        layoutDecoratedWithMargins(view, left, top, right, bottom);
        if (DEBUG) {
            Log.d(TAG, "laid out child at position " + getPosition(view) + ", with l:"
                    + (left + params.leftMargin) + ", t:" + (top + params.topMargin) + ", r:"
                    + (right - params.rightMargin) + ", b:" + (bottom - params.bottomMargin));
        }
        // Consume the available space if the view is not removed OR changed
        if (params.isItemRemoved() || params.isItemChanged()) {
            result.mIgnoreConsumed = true;
        }
        result.mFocusable = view.hasFocusable();
    }
    ```

    很显然，缓存部分的关键就是`LayoutState.next`方法了：

    ```java
    /**
      * Gets the view for the next element that we should layout.
      * Also updates current item index to the next item, based on {@link #mItemDirection}
      *
      * @return The next element that we should layout.
      */
    View next(RecyclerView.Recycler recycler) {
        if (mScrapList != null) {
            return nextViewFromScrapList();
        }
        final View view = recycler.getViewForPosition(mCurrentPosition);
        mCurrentPosition += mItemDirection;
        return view;
    }
    ```

    我们先略过`mScrapList`，暂时认为其为null，后面遇到再分析。所以这里调用了`RecyclerView.getViewForPosition`方法：

    ```java
    public View getViewForPosition(int position) {
        return getViewForPosition(position, false);
    }
    
    View getViewForPosition(int position, boolean dryRun) {
        return tryGetViewHolderForPositionByDeadline(position, dryRun, FOREVER_NS).itemView;
    }
    ```

    离真相又近了一步，`tryGetViewHolderForPositionByDeadline`方法里面会对各级缓存进行匹配，这里分段进行解释。

    1. 如果有`mChangedScrap`，尝试进行匹配  

        ```java
         // 0) If there is a changed scrap, try to find from there
         if (mState.isPreLayout()) {
             holder = getChangedScrapViewForPosition(position);
             fromScrapOrHiddenOrCache = holder != null;
         }
        ```
        这里的`isPreLayout()`与`mState.mRunPredictiveAnimations`有直接关系，可以看成前者的值取决与后者，该值在`dispatchLayoutStep1`过程中被更新；当Item发生了更新时，`scrapView`方法会将ViewHolder保存到`mChangedScrap`中去。

    2. 尝试从`mAttachedScrap`、`mCachedViews`中寻找匹配的ViewHolder。找到之后会对ViewHolder做一些检查，如果不满足条件，且`dryRun`为false（实际上就是false），会将ViewHolder清除掉并保存到`mCachedViews`中。在向`mCachedViews`中添加缓存时，如果超过了允许的上限(即`mViewCacheMax`)，将会把旧的缓存移动到`RecycledViewPool`中。
        ```java
         // 1) Find by position from scrap/hidden list/cache
         if (holder == null) {
             holder = getScrapOrHiddenOrCachedHolderForPosition(position, dryRun);
             if (holder != null) {
                 if (!validateViewHolderForOffsetPosition(holder)) {
                     // recycle holder (and unscrap if relevant) since it can't be used
                     if (!dryRun) {
                         // we would like to recycle this but need to make sure it is not used by
                         // animation logic etc.
                         holder.addFlags(ViewHolder.FLAG_INVALID);
                         if (holder.isScrap()) {
                             removeDetachedView(holder.itemView, false);
                             holder.unScrap();
                         } else if (holder.wasReturnedFromScrap()) {
                             holder.clearReturnedFromScrapFlag();
                         }
                         recycleViewHolderInternal(holder);
                     }
                     holder = null;
                 } else {
                     fromScrapOrHiddenOrCache = true;
                 }
             }
         }
        ```

    3. 如果`Adapter.hasStableIds()`为true，会根据ItemId和ViewType在`mAttachedScrap`、`mCachedViews`中寻找ViewHolder。`Adapter`中该属性默认为false。
        ```java
         // 2) Find from scrap/cache via stable ids, if exists
         if (mAdapter.hasStableIds()) {
             holder = getScrapOrCachedViewForId(mAdapter.getItemId(offsetPosition),
                     type, dryRun);
             if (holder != null) {
                 // update position
                 holder.mPosition = offsetPosition;
                 fromScrapOrHiddenOrCache = true;
             }
         }
        ```

    4. 如果存在`ViewCacheExtension`，调用`ViewCacheExtension.getViewForPositionAndType`寻找ViewHolder  
        ```java
         if (holder == null && mViewCacheExtension != null) {
             // We are NOT sending the offsetPosition because LayoutManager does not
             // know it.
             final View view = mViewCacheExtension
                     .getViewForPositionAndType(this, position, type);
             if (view != null) {
                 holder = getChildViewHolder(view);
                 if (holder == null) {
                     throw new IllegalArgumentException("getViewForPositionAndType returned"
                             + " a view which does not have a ViewHolder"
                             + exceptionLabel());
                 } else if (holder.shouldIgnore()) {
                     throw new IllegalArgumentException("getViewForPositionAndType returned"
                             + " a view that is ignored. You must call stopIgnoring before"
                             + " returning this view." + exceptionLabel());
                 }
             }
         }
        ```
    5. fallback到`RecycledViewPool`，看是否有可用的ViewHolder  
        ```java
         if (holder == null) { // fallback to pool
             if (DEBUG) {
                 Log.d(TAG, "tryGetViewHolderForPositionByDeadline("
                         + position + ") fetching from shared pool");
             }
             holder = getRecycledViewPool().getRecycledView(type);
             if (holder != null) {
                 holder.resetInternal();
                 if (FORCE_INVALIDATE_DISPLAY_LIST) {
                     invalidateDisplayListInt(holder);
                 }
             }
         }
        ```
    6. 以上都不满足，最后调用`Adapter.createViewHolder`创建ViewHolder
        ```java
         if (holder == null) {
             long start = getNanoTime();
             if (deadlineNs != FOREVER_NS
                     && !mRecyclerPool.willCreateInTime(type, start, deadlineNs)) {
                 // abort - we have a deadline we can't meet
                 return null;
             }
             holder = mAdapter.createViewHolder(RecyclerView.this, type);
             if (ALLOW_THREAD_GAP_WORK) {
                 // only bother finding nested RV if prefetching
                 RecyclerView innerView = findNestedRecyclerView(holder.itemView);
                 if (innerView != null) {
                     holder.mNestedRecyclerView = new WeakReference<>(innerView);
                 }
             }
     
             long end = getNanoTime();
             mRecyclerPool.factorInCreateTime(type, end - start);
             if (DEBUG) {
                 Log.d(TAG, "tryGetViewHolderForPositionByDeadline created new ViewHolder");
             }
         }
        ```

    在获取到ViewHolder之后，如果需要bind，会调用`tryBindViewHolderByDeadline`方法，该方法中接着调用`Adapter.bindViewHolder`方法交给开发者完成绑定工作。

    ```java
    boolean bound = false;
    if (mState.isPreLayout() && holder.isBound()) {
        // do not update unless we absolutely have to.
        holder.mPreLayoutPosition = position;
    } else if (!holder.isBound() || holder.needsUpdate() || holder.isInvalid()) {
        if (DEBUG && holder.isRemoved()) {
            throw new IllegalStateException("Removed holder should be bound and it should"
                    + " come here only in pre-layout. Holder: " + holder
                    + exceptionLabel());
        }
        final int offsetPosition = mAdapterHelper.findPositionOffset(position);
        bound = tryBindViewHolderByDeadline(holder, offsetPosition, position, deadlineNs);
    }
    ```

    `tryGetViewHolderForPositionByDeadline`方法完成之后会一直返回到`LinearLayoutManager.layoutChunk`方法中，接着会根据ViewHolder的来源，该attach的attach，该addView的addView，最后measure并layout，一个子View的layout过程就完成了。

最后以一张流程图结束本节：

![RecyclerView缓存流程](/assets/images/android/recyclerview-cache.png)

## 3. 两者在缓存方面的对比

上面两节分析了ListView与RecyclerView缓存机制的相关源码，这里总结一下。毕竟，前面的分析就是为了最后的结论。

> 本节来源于[Android ListView与RecyclerView对比浅析--缓存机制](https://www.cnblogs.com/bugly/p/6015391.html)

ListView与RecyclerView缓存机制原理大致相似：滑动过程中，离屏的ItemView即被回收至缓存，入屏的ItemView则会优先从缓存中获取，只是ListView与RecyclerView的实现细节有差异.（这只是缓存使用的其中一个场景，还有如刷新等）。原理图如下所示：

![ListView缓存流程](/assets/images/android/listview-cache.png)

两者缓存机制的对比有以下几点不同：

1. 层级不同   
    RecyclerView比ListView多两级缓存，支持多个离屏ItemView缓存，支持开发者自定义缓存处理逻辑，支持所有RecyclerView共用同一个RecyclerViewPool(缓存池)。  
    <figcaption>ListView缓存层级</figcaption>

    | 缓存层级 | 是否需要创建 | 是否需要绑定 | 生命周期 | 备注 |
    | ------- | ---------- | ---------- | ------ | ---- |
    | mActionViews | 否 | 否 | `onLayout`函数周期内 | 用于屏幕内itemView快速复用 |
    | mScrapViews | 否 | 是 | 与mAdapter一致，当mAdapter被更换时，mScrapViews即被清空 |  |

    <figcaption>RecyclerView缓存层级</figcaption>

    | 缓存层级 | 是否需要创建 | 是否需要绑定 | 生命周期 | 备注 |
    | ------- | ---------- | ---------- | ------ | ---- |
    | mAttachedScrap | 否 | 否 | `onLayout`函数周期内 | 用于屏幕内ViewHolder快速复用 |
    | mCacheViews | 否 | 否 | 与mAdapter一致，当mAdapter被更换时，mCacheViews被降级至RecyclerViewPool；且容量超限时，老的会被降级到RecyclerViewPool | 默认上限为2，即缓存屏幕外2个ViewHolder |
    | mViewCacheExtension |  |  |  | 不直接使用，需要用户定制，默认不实现 |
    | mRecyclerPool | 否 | 是 | 与自身生命周期一致，不再被引用时即被释放 | 默认上限为5，可以用来实现所有RecyclerView同一个Pool |

    ListView和RecyclerView缓存机制基本一致：  

    1. mActiveViews和mAttachedScrap功能相似，用来快速重用屏幕上可见的列表项，而不需要重新创建和绑定  
    2. mScrapViews和mCacheViews + mRecyclerPool功能相似，用来缓存离开屏幕的itemView，让即将进入屏幕的itemView复用  
    3. RecyclerView的优势在于:  
        - mCacheViews的使用，可以做到屏幕外的列表项在进入屏幕时也无须bindView快速重用  
        - mRecyclerPool可以供多个RecyclerView共同使用，在特定场景下（如ViewPager+多个列表页，或者竖向列表的item中嵌套有横向列表等）有优势。  

    客观来说，RecyclerView在特定场景下对ListView的缓存机制做了补强和完善。

2. 缓存不同  
    - RecyclerView缓存RecyclerView.ViewHolder，抽象可理解为：View + ViewHolder  
    - ListView缓存View，实际使用的时候需要手动将自定义的ViewHolder添加到View的tag中  

    缓存不同，二者在缓存的使用上也略有差异，具体来说：

    1. RecyclerView中mCacheViews获取时，是通过匹配pos获取目标位置的换缓存的，这样做的好处是，当数据源不变的情况下，无须重新bindView；而同样是离屏缓存，ListView从mScrapViews根据pos获取相应的缓存，但是并没有直接使用，而是重新调用了Adapter的getView方法，这就必定会导致我们的bind代码执行。
    2. ListView中通过pos获取的是View；RecyclerView通过pos获取的是ViewHolder。

另外，RecyclerView更大的亮点在于提供了局部刷新的接口，这样可以避免调用许多无用的bindView。

ListView和RecyclerView最大的区别在于数据源改变时的缓存的处理逻辑，ListView是"一锅端"，将所有的mActiveViews都移入了二级缓存mScrapViews，而RecyclerView则是更加灵活地对每个View修改标志位，区分是否重新bindView。