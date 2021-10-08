---
title: "Android搜索栏的实现"
---

本篇文章介绍Android系统提供的搜索栏实现`SearchView`以及终极实现方法`EditText`。

## 1 SearchView

`SearchView`提供有两个实现，这里我们选择兼容包里面的`android.support.v7.widget.SearchView`。

![SearchView](/assets/images/android/SearchView.png)

在ActionBar上使用SearchView，需要以下几步：

**1. 为Activity声明一个menu文件**
```xml
<?xml version="1.0" encoding="utf-8"?>
<menu xmlns:android="http://schemas.android.com/apk/res/android"
      xmlns:app="http://schemas.android.com/apk/res-auto">
    <item android:id="@+id/search"
          android:title="search_title"
          android:icon="@drawable/ic_search_white"
          app:showAsAction="collapseActionView|ifRoom"
          app:actionViewClass="android.support.v7.widget.SearchView" />
</menu>
```
**2. 在Activity的`onCreateOptionsMenu`方法里面设置SearchView**
```java
@Override
public boolean onCreateOptionsMenu(Menu menu) {
    MenuInflater inflater = getMenuInflater();
    inflater.inflate(R.menu.options_menu, menu);

    // Associate searchable configuration with the SearchView
    SearchManager searchManager = (SearchManager) getSystemService(Context.SEARCH_SERVICE);
    MenuItem menuItem = menu.findItem(R.id.search);
    mSearchView = (SearchView) menuItem.getActionView();
    setUpSearchView(searchManager, mSearchView, menuItem);

    return true;
}

private void setUpSearchView(SearchManager searchManager, final SearchView mSearchView, MenuItem menuItem) {
    mSearchView.setSearchableInfo(
            searchManager.getSearchableInfo(getComponentName()));
    mSearchView.setIconifiedByDefault(true);
    mSearchView.setQueryHint("*.doc(x)");
    mSearchView.setImeOptions(EditorInfo.IME_ACTION_SEARCH);
    mSearchView.setSubmitButtonEnabled(true);
    mSearchView.onActionViewCollapsed();
    mSearchView.setOnQueryTextListener(new SearchView.OnQueryTextListener() {
        @Override
        public boolean onQueryTextSubmit(String query) {
            InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
            if (imm != null) {
                imm.hideSoftInputFromWindow(mSearchView.getWindowToken(), 0);
            }
            mSearchView.clearFocus();
            scheduleSearch(query);
            return true;
        }

        @Override
        public boolean onQueryTextChange(String newText) {
            return false;
        }
    });
    mSearchView.findViewById(R.id.search_close_btn).setOnClickListener(new View.OnClickListener() {
        @Override
        public void onClick(View view) {
            mSearchView.setQuery("", false);
            result.clear();
            mResultAdapter.notifyDataSetChanged();
        }
    });
}
```
SearchView有很多API可供定制，下图以此是准备搜索、搜索中、搜索后的SearchView的样式。

![SearchView准备搜索、搜索中、搜索后](/assets/images/android/SearchView准备搜索、搜索中、搜索后.png)

`OnQueryTextListener`用来监听SearchView输入事件，**而想要检测叉叉按钮的点击事件，兼容性最好的方式就是通过`findViewById(R.id.search_close_btn)`找到这个控件，然后给它设置点击事件**。  
其他方式兼容性存在很大问题，不知道是Bug还是怎么样。

**3. 为Activity配置属性**  
1.写searchable.xml文件（不知道这个有啥用，尝试过配置，没有生效。随便写写就OK）  

```xml
<?xml version="1.0" encoding="utf-8"?>
<searchable xmlns:android="http://schemas.android.com/apk/res/android"
    android:label="@string/app_name"
    android:hint="*.doc"/>
```

2.需要给搜索Activity设置`meta-data`属性  

```xml
<meta-data
    android:name="android.app.searchable"
    android:resource="@xml/searchable"/>
```

3.给Activity添加action

```xml
<action android:name="android.intent.action.SEARCH" />
```

以上就是用系统自带的SearchView的使用方法。

## 2 EditText实现搜索框

其实，发现采用EditText修改样式代替SearchView，感觉更方便。
![EditText实现搜索框](/assets/images/android/EditText实现搜索框.png)

```xml
<ClearEditText
      android:id="@+id/et_search"
      android:layout_width="0dp"
      android:layout_height="match_parent"
      android:layout_weight="1"
      android:gravity="center_vertical"
      android:hint="搜索平台、信用卡"
      android:textColorHint="@color/ff666666"
      android:textSize="@dimen/sp_14"
      android:textColor="@color/ff333333"
      android:singleLine="true"
      android:imeOptions="actionSearch"
      android:background="@drawable/bg_et_r14_e5e5e5"
      android:paddingLeft="@dimen/dp_8"
      android:paddingRight="@dimen/dp_8"
      android:layout_marginRight="@dimen/dp_16"
      android:layout_marginTop="@dimen/dp_8"
      android:layout_marginBottom="@dimen/dp_8"
      android:drawablePadding="@dimen/dp_9"
      android:drawableLeft="@drawable/ic_calendar_search_n"
      android:drawableRight="@drawable/ic_cell_delete_n"/>
```
使用`addTextChangedListener`监听文本的改变，左边的search icon通过`drawableLeft`实现，右边删除按钮通过`android:drawableRight`实现。背景的shape如下：
```xml
<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android">
    <solid android:color="@color/ffe5e5e5e" />
    <corners android:radius="@dimen/dp_14" />
</shape>
```

以上就是用EditText代替SearchView的方法。
