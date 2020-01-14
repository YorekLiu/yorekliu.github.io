---
title: "RecyclerView高级特性——拖拽排序以及滑动删除"
---

RecyclerView高级特性系列：

- [ListView、RecyclerView缓存策略解析](/android/other/recyclerview-cache/)
- [RecyclerView高级特性——拖拽排序以及滑动删除](/android/other/RecyclerView-Sort&Delete/)
- [RecyclerView高级特性——ItemDecoration](/android/other/recyclerview-item-docoration/)
- [RecyclerView的一些使用细节——多级嵌套时的缓存优化、smooth scroll问题](/android/other/recyclerview-others/)

---

RecyclerView支持拖拽排序以及滑动删除，实现过程也比较简单。

下面先上一段demo效果视频：

<iframe width="320" height="568" src="/assets/videos/recyclerview_drag_swipe.mp4" frameborder="0" allowfullscreen></iframe>


主要流程如下：

1. 定义拖拽操作、滑动删除接口
3. `Adapter`中实现第一步的接口，这里主要是体现对数据的操作
2. 自定义Callback实现`android.support.v7.widget.helper.ItemTouchHelper.Callback`，此Callback就是`RecyclerView`实现拖拽、滑动删除的关键
4. 创建`ItemTouchHelper`并`attachToRecyclerView`

下面上代码

## 1. 定义拖拽、滑动操作的接口

```java
public interface IDragSwipe {
    /**
     * 两个Item交换位置
     * @param fromPosition 第一个Item的位置
     * @param toPosition 第二个Item的位置
     */
    void onItemSwapped(int fromPosition, int toPosition);

    /**
     * 删除Item
     * @param position 待删除Item的位置
     */
    void onItemDeleted(int position);

    /**
     * Item标记完成
     * @param position Item的位置
     */
    void onItemDone(int position);
}
```

这里定义了三个方法，交换、删除以及标记完成

## 2. Adapter实现该接口

```java
public class TodoTaskAdapter extends BaseQuickAdapter<TodoTask, BaseViewHolder> implements IDragSwipe {
    ...

    @Override
    public void onItemSwapped(int fromPosition, int toPosition) {
        Collections.swap(getData(), fromPosition, toPosition);
        notifyItemMoved(fromPosition, toPosition);
    }

    @Override
    public void onItemDeleted(int position) {
        Toast.makeText(mContext, "onItemDeleted", Toast.LENGTH_SHORT).show();
        mData.remove(position);
        notifyItemRemoved(position);
    }

    @Override
    public void onItemDone(int position) {
        Toast.makeText(mContext, "onItemDone", Toast.LENGTH_SHORT).show();
        mData.remove(position);
        notifyItemRemoved(position);
    }
}
```

如上所示  

- 交换时使用`Collections.swap`将对应位置的数据进行交换，然后通知数据有更改(`notifyItemMoved`以及`notifyItemRemoved`)会有默认的动画效果。
- 删除以及标记完成都是简单的移除了数据，然后通知更新。这里可以按照自己的业务来，这里只是demo

## 3. 自定义Callback类，调用Adapter的交换、删除等操作方法

这步是重要的过程，我们先上全部的代码。

```java
public class DragSwipeCallback extends android.support.v7.widget.helper.ItemTouchHelper.Callback {

    /** 通过此变量通知外界发生了排序、删除等操作 */
    private IDragSwipe mAdapter;

    public DragSwipeCallback(IDragSwipe adapter){
        // 注入IDragSwipe
        mAdapter = adapter;
    }

    @Override
    public int getMovementFlags(RecyclerView recyclerView, RecyclerView.ViewHolder viewHolder) {
        // 确定拖拽、滑动支持的方向
        int dragFlags = ItemTouchHelper.UP | ItemTouchHelper.DOWN;
        int swipeFlags = ItemTouchHelper.START | ItemTouchHelper.END;
        return makeMovementFlags(dragFlags, swipeFlags);
    }

    @Override
    public boolean isLongPressDragEnabled() {
        return true;
    }

    @Override
    public boolean isItemViewSwipeEnabled() {
        return true;
    }

    /**
     * 拖拽、交换事件
     */
    @Override
    public boolean onMove(RecyclerView recyclerView, RecyclerView.ViewHolder viewHolder, RecyclerView.ViewHolder target) {
        mAdapter.onItemSwapped(viewHolder.getAdapterPosition(), target.getAdapterPosition());
        return true;
    }

    /**
     * 滑动成功的事件
     */
    @Override
    public void onSwiped(RecyclerView.ViewHolder viewHolder, int direction) {
        switch (direction) {
            case ItemTouchHelper.END: // START->END 标记完成事件
                mAdapter.onItemDone(viewHolder.getAdapterPosition());
                break;
            case ItemTouchHelper.START: // END->START 删除事件
                mAdapter.onItemDeleted(viewHolder.getAdapterPosition());
                break;
            default:
        }
    }

    /**
     * 拖拽、滑动时如何绘制列表
     * actionState只会为ACTION_STATE_DRAG或者ACTION_STATE_SWIPE
     */
     @Override
     public void onChildDraw(Canvas c, RecyclerView recyclerView, RecyclerView.ViewHolder viewHolder, float dX, float dY, int actionState, boolean isCurrentlyActive) {
         switch (actionState) {
             case ItemTouchHelper.ACTION_STATE_DRAG:
                 // 拖拽时，如果是isCurrentlyActive，则设置translationZ，否则复位
                 viewHolder.itemView.setTranslationZ(SizeUtils.dp2px(isCurrentlyActive ? 4 : 0));
                 super.onChildDraw(c, recyclerView, viewHolder, dX, dY, actionState, isCurrentlyActive);
                 break;
             case ItemTouchHelper.ACTION_STATE_SWIPE:
                 // 滑动时，对view的绘制
                 View rootView = viewHolder.itemView;
                 View contentView = rootView.findViewById(R.id.ll_content_root);
                 View actionView = rootView.findViewById(R.id.ll_action_root);
                 ImageView doneImageView = actionView.findViewById(R.id.iv_task_done);
                 View actionSpaceView = actionView.findViewById(R.id.view_action_space);
                 ImageView deleteImageView = actionView.findViewById(R.id.iv_task_delete);
                 if (dX < 0) {
                     deleteImageView.setImageResource(R.drawable.ic_delete_white_24dp);
                     deleteImageView.setBackgroundResource(R.color.ffff4081);
                     doneImageView.setImageDrawable(null);
                     doneImageView.setBackgroundResource(R.color.ffff4081);
                     actionSpaceView.setBackgroundResource(R.color.ffff4081);
                 } else {
                     doneImageView.setImageResource(R.drawable.ic_done_white_24dp);
                     doneImageView.setBackgroundResource(R.color.ff53c4ac);
                     deleteImageView.setImageDrawable(null);
                     deleteImageView.setBackgroundResource(R.color.ff53c4ac);
                     actionSpaceView.setBackgroundResource(R.color.ff53c4ac);
                 }
                 contentView.setTranslationX(dX);
                 break;
             default:
         }
     }

    /**
     * 在onSelectedChanged、onChildDraw、onChildDrawOver操作完成后可以在此进行清楚操作
     */
    @Override
    public void clearView(RecyclerView recyclerView, RecyclerView.ViewHolder viewHolder) {
        super.clearView(recyclerView, viewHolder);
        View rootView = viewHolder.itemView;
        View contentView = rootView.findViewById(R.id.ll_content_root);
        contentView.setTranslationX(0);
    }
}
```

## 4. 创建`ItemTouchHelper`并`attachToRecyclerView`

创建`TodoTaskAdapter`、将其注入`DragSwipeCallback`类，然后注入`ItemTouchHelper`，最后`attachToRecyclerView`

```java
mTodoTaskAdapter = new TodoTaskAdapter(queryTaskFromDB());
ItemTouchHelper.Callback callback = new DragSwipeCallback(mTodoTaskAdapter);
ItemTouchHelper touchHelper = new ItemTouchHelper(callback);
mRecyclerView.setLayoutManager(new LinearLayoutManager(this));
mRecyclerView.setAdapter(mTodoTaskAdapter);
touchHelper.attachToRecyclerView(mRecyclerView);
```

此处只是一个demo，让Adapter实现`IDragSwipe`接口，实际上本人觉得并不妥当。
