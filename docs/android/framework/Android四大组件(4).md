---
title: "Content Providers与Fragment"
---

本章的主要内容是[Content Providers](https://developer.android.com/guide/topics/providers/content-providers.html)以及[Fragment](https://developer.android.com/guide/components/fragments.html)

## 1 ContentProvider介绍

ContentProvider可以帮助应用程序管理自身存储的数据，并提供了一种与其他应用程序共享数据的方式。它们封装数据，并提供数据安全的机制。ContentProvider是代码运行的进程与另一个进程连接数据的标准接口。实现ContentProvider有很多优点。更重要的是，你可以配置一个ContentProvider，以允许其他应用程序能够安全地访问和修改应用程序数据，如下图所示。

![/assets/images/android/content-provider-overview.png](/assets/images/android/content-provider-overview.png)

系统预置了很多ContentProvider，比如MediaProvider、CalendarProvider、ContactsProvider等等，要跨进程访问这些信息，只需要通过ContentProvider的query、update、insert和delete方法即可。

而创建一个ContentProvider也很简单，只需要实现onCreate、query、update、insert、delete和getType。onCreate可以做一些初始化工作，getType用来返回一个URI请求所对应的mimeType，如果应用不关注这个，可以返回null或者"\*/\*"。剩下的四个方法对应CRUD操作。

**ContentProvider的底层是Binder，除了onCreate由系统回调运行在主线程中，其他五个方法运行在Binder线程池中，不是线程安全的。而如果在同一个进程访问ContentProvider，根据Binder的原理，同进程的Binder调用就是直接的对象调用，这个时候CRUD运行在调用者的线程中。**

另外，ContentProvider的内部存储不一定是sqlite，它可以是任意数据。

## 2 自定义ContentProvider

### 2.1 ContentProvider的注册  

ContentProvider在manifest中的配置项如下：

```xml
 <provider android:authorities="list"
          android:directBootAware=["true" | "false"]
          android:enabled=["true" | "false"]
          android:exported=["true" | "false"]
          android:grantUriPermissions=["true" | "false"]
          android:icon="drawable resource"
          android:initOrder="integer"
          android:label="string resource"
          android:multiprocess=["true" | "false"]
          android:name="string"
          android:permission="string"
          android:process="string"
          android:readPermission="string"
          android:syncable=["true" | "false"]
          android:writePermission="string" >
    . . .
</provider>
```

- `android:authorities`  
  ContentProvider唯一授权码，通过这个可以访问此Provider。另外该字串必须唯一，因此建议加上包名。
- `android:name`  
  实现了ContentProvider的类名，指注册那个Provider。
- Permissions  
     有如下几种权限
     - `android:grantUriPermssions`: 临时权限标记
     - `android:permission`: 单个Provider范围读写权限
     - `android:readPermission`: Provider范围读权限
     - `android:writePermission`: Provider范围写权限
- 启动和控制属性  
     这些属性决定了Android系统如何以及何时启动Provider，Provider的进程特性以及其他运行时设置：
     - `android:enabled`: 是否允许系统启动provider
     - `android:exported`: 是否允许其他应用启动provider
     - `android:initOrder`: 相对于同一进程中的其他提供者，应该启动此provider的顺序。
     - `android:multiProcess`: 允许系统在与调用客户端相同的进程中启动Provider。
     - `android:process`: Provider应该运行的进程名。
     - `android:syncable`: Provider的数据要与服务端数据同步。
- 信息化属性  
     可以选择设置provider的图标和名称  
     - `android:icon`: provider的图标. 图标的显示紧挨着Provider的名称，可以在Settings > Apps > All中查看。
     - `android:label`: 可显示Provider或者其数据或者两者的描述信息的文本，可以在Settings > Apps > All中查看。

完整文档可以查看[provider-element](https://developer.android.com/guide/topics/manifest/provider-element.html)  

### 2.2 ContentProvider的实现

ContentProvider通过URI来区分外界要访问的数据集合，为了更好的知道URI对应的是什么表、什么字段，我们可以使用`UriMatcher`来简化操作。

该办法的原理就是在addURI方法中将`authority`与`path`组合，然后等match时与传入的URI比较。如果相等则返回`code`。
```java
public class LocalProvider extends ContentProvider {
    private static final String TAG = "LocalProvider";

    private SQLiteOpenHelper mOpenHelper;

    private static final int DATA = 1;
    private static final int DATA_ID = 2;
    private static final UriMatcher sURLMatcher = new UriMatcher(
            UriMatcher.NO_MATCH);

    static {
        sURLMatcher.addURI("*", "data", DATA);
        sURLMatcher.addURI("*", "data/#", DATA_ID);
    }

    private static class DatabaseHelper extends SQLiteOpenHelper {
        private static final String DATABASE_NAME = "local.db";
        private static final int DATABASE_VERSION = 1;

        public DatabaseHelper(Context context) {
            super(context, DATABASE_NAME, null, DATABASE_VERSION);
        }

        @Override
        public void onCreate(SQLiteDatabase db) {
            db.execSQL("CREATE TABLE data (" +
                       "_id INTEGER PRIMARY KEY," +
                       "text TEXT, " +
                       "integer INTEGER);");

            // insert alarms
            db.execSQL("INSERT INTO data (text, integer) VALUES ('first data', 100);");
        }

        @Override
        public void onUpgrade(SQLiteDatabase db, int oldVersion, int currentVersion) {
            Log.w(TAG, "Upgrading test database from version " +
                  oldVersion + " to " + currentVersion +
                  ", which will destroy all old data");
            db.execSQL("DROP TABLE IF EXISTS data");
            onCreate(db);
        }
    }

    public LocalProvider() {
    }

    @Override
    public boolean onCreate() {
        mOpenHelper = new DatabaseHelper(getContext());
        return true;
    }

    @Override
    public Cursor query(Uri url, String[] projectionIn, String selection,
            String[] selectionArgs, String sort) {
        SQLiteQueryBuilder qb = new SQLiteQueryBuilder();

        // Generate the body of the query
        int match = sURLMatcher.match(url);
        switch (match) {
            case DATA:
                qb.setTables("data");
                break;
            case DATA_ID:
                qb.setTables("data");
                qb.appendWhere("_id=");
                qb.appendWhere(url.getPathSegments().get(1));
                break;
            default:
                throw new IllegalArgumentException("Unknown URL " + url);
        }

        SQLiteDatabase db = mOpenHelper.getReadableDatabase();
        Cursor ret = qb.query(db, projectionIn, selection, selectionArgs,
                              null, null, sort);

        if (ret == null) {
            if (false) Log.d(TAG, "Alarms.query: failed");
        } else {
            ret.setNotificationUri(getContext().getContentResolver(), url);
        }

        return ret;
    }

    @Override
    public String getType(Uri url) {
        int match = sURLMatcher.match(url);
        switch (match) {
            case DATA:
                return "vnd.android.cursor.dir/vnd.google.unit_tests.local";
            case DATA_ID:
                return "vnd.android.cursor.item/vnd.google.unit_tests.local";
            default:
                throw new IllegalArgumentException("Unknown URL");
        }
    }

    @Override
    public int update(Uri url, ContentValues values, String where, String[] whereArgs) {
        int count;
        long rowId = 0;
        int match = sURLMatcher.match(url);
        SQLiteDatabase db = mOpenHelper.getWritableDatabase();
        switch (match) {
            case DATA_ID: {
                String segment = url.getPathSegments().get(1);
                rowId = Long.parseLong(segment);
                count = db.update("data", values, "_id=" + rowId, null);
                break;
            }
            default: {
                throw new UnsupportedOperationException(
                        "Cannot update URL: " + url);
            }
        }
        if (false) Log.d(TAG, "*** notifyChange() rowId: " + rowId);
        getContext().getContentResolver().notifyChange(url, null);
        return count;
    }


    @Override
    public Uri insert(Uri url, ContentValues initialValues) {
        return null;
    }

    @Override
    public int delete(Uri url, String where, String[] whereArgs) {
        throw new UnsupportedOperationException("delete not supported");
    }
}
```

值得注意的是，`update`、`insert`、`delete`方法会引起数据源的改变，此时需要通过`ContentResolver.notifyChange`方法通知当前ContentProvider中的数据已经发生了变化。  

要观察ContentProvider的数据改变情况，可以通过ContentResolver的`registerContentObserver`方法来注册观察，通过`unregisterContentObserver`来解除观察。  

上面已经提到过，除了onCreate之外的其他五个方法都是运行在Binder线程池中，**因此CRUD四大方法是存在多线程并发访问的。但是SQLiteDatabase内部对数据库的操作是有同步处理的，因此此时无需考虑线程同步问题。但是多个SQLiteDatabase同时操作数据库就无法保证线程同步了。如果ContentProvider底层的数据集是一块内存(比如List)，此时就要进行数据同步处理。**  

!!! tip
    `ContentProvider.onCreate`的执行要在`Application.onCreate`之前，详细可以查看[ContentProvider的工作过程](/android/framework/%E5%9B%9B%E5%A4%A7%E7%BB%84%E4%BB%B6%E5%90%AF%E5%8A%A8%E8%BF%87%E7%A8%8B/#5-contentprovider)

ContentProvider除了支持对数据源的增删改查操作外，还支持自定义的Call方法，这个过程可以通过ContentProvider的Call方法和ContentResolver的Call方法来完成。

## 3 Fragment

Fragment表示Activity中的部分行为或者UI。我们可以将多个framgent组合进一个Activity来构建一个多窗格的UI，一个fragment也能在多个Activity中进行复用。我们可以将fragment理解为Activity的一个模块，它有自己的生命周期，接收自己的输入事件，我们可以在Activity运行时添加或者删除一个fragment。

Fragment必须嵌入到Activity中，且其生命周期会直接被宿主Activity的生命周期影响。

### 3.1 Fragment的创建

![Fragment生命周期](/assets/images/android/fragment_lifecycle.png)

通常我们至少需要实现以下生命周期方法：

- `onCreate()`  
创建Fragment时调用。我们应该初始化Fragment暂停或停止，然后恢复时要保留的必要组件。
- `onCreateView()`  
第一次绘制UI时调用。我们在这里要返回fragment布局的根view，如果Fragment不提供UI，可以返回null。
- `onPause()`  
用户正在离开fragment时调用，这并不总是意味着Fragment正在被销毁。我们应该在这里提供需要持久化的用户的更改操作，因为用户可能不再回来。

### 3.2 添加layout

```java
public static class ExampleFragment extends Fragment {
    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container,
                             Bundle savedInstanceState) {
        // Inflate the layout for this fragment
        return inflater.inflate(R.layout.example_fragment, container, false);
    }
}
```

`inflate`方法有三个参数：

- 待填充的layout的id
- 一个被填充layout的parent的ViewGroup
- 填充时被填充layout是否被添加到第二个参数上。此处用false因为系统已经处理了，如果传递true将会导致冗余。

### 3.3 将Fragment添加至Activity

方式一 **在Activity的layout中声明fragment**

```java
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:orientation="horizontal"
    android:layout_width="match_parent"
    android:layout_height="match_parent">
    <fragment android:name="com.example.news.ArticleListFragment"
            android:id="@+id/list"
            android:layout_weight="1"
            android:layout_width="0dp"
            android:layout_height="match_parent" />
    <fragment android:name="com.example.news.ArticleReaderFragment"
            android:id="@+id/viewer"
            android:layout_weight="2"
            android:layout_width="0dp"
            android:layout_height="match_parent" />
</LinearLayout>
```

方式二 **代码添加Fragment到已存在的ViewGroup中**

```java
FragmentManager fragmentManager = getFragmentManager();
FragmentTransaction fragmentTransaction = fragmentManager.beginTransaction();

ExampleFragment fragment = new ExampleFragment();
fragmentTransaction.add(R.id.fragment_container, fragment);
fragmentTransaction.commit();
```
> 有时候我们有多个Fragment交替显示的需求，我们可以先将多个Fragment全部通过方式二添加到FrameLayout上面，然后通过`hide`、`show`的方式来控制显示与隐藏。

**添加没有UI界面的Fragment**  
有时我们也想为Activity添加一个后台运行的Fragment，此时可以使用`fragmentTransaction.add(Fragment, String)`，提供一个唯一的String作为tag，而不是布局的id。可以使用`fragmentManager.findFragmentByTag()`获取Fragment。

### 3.4 管理Fragment

我们可以使用`FragmentManager`管理Fragment。在Activity中使用`getFragmentManager()`来获取它。
`FragmentManager`可以做以下事情：

- 从Activity中获取已存在的Fragment，`findFragmentById()`获取有UI的，`findFragmentByTag()`获取没有UI的。
- 使用`popBackStack()`（模拟用户的Back命令）从返回栈中弹出Fragment。
- 使用`addOnBackStackChangedListener()`注册一个监听器监听返回栈的更改。

### 3.5 执行FragmentTransaction

FragmentTransaction可以执行add、remove、replace，完成后执行commit生效。

```java
// Create new fragment and transaction
Fragment newFragment = new ExampleFragment();
FragmentTransaction transaction = getFragmentManager().beginTransaction();

// Replace whatever is in the fragment_container view with this fragment,
// and add the transaction to the back stack
transaction.replace(R.id.fragment_container, newFragment);
transaction.addToBackStack(null);

// Commit the transaction
transaction.commit();
```

通过调用`addToBackStack()`，替换的事务将保存到返回栈，以便用户可以通过按Back按钮来反转事务并返回上一个Fragment。
为了从返回栈中取回碎片，必须在Activity中重写`onBackPressed()`

```java
@Override
public void onBackPressed() {
    if (getFragmentManager().getBackStackEntryCount() > 0) {
        getFragmentManager().popBackStack();
    } else {
        super.onBackPressed();
    }
}
```

如果不重写该方法，会导致不能回退Fragment。
如果在一个事务提交中操作了多次，这多次操作将会作为一个独立的事务提交，如果回退事务，这些事务将会一起回退。
在我们remove一个Fragment时，如果没有调用`addToBackStack()`，Fragment将会被销毁；如果调用了，Fragment将会stopped。

>提示：对于每个Fragment的事务，在提交之前可以调用`setTransition()`来应用转场动画。


调用`commit()`并不会立刻执行事务。当主线程能够执行时，会按照顺序执行。如果有必要，可以在主线程调用`executePendingTransactions()`来立刻执行通过`commit()`提交的事务。除非事务依赖于其他线程的作业，一般不需要这么做。
> **注意**：只有在Activity保存状态（用户离开Activity）之前，才可以使用`commit()`提交事务。 如果您尝试在此之后提交，将抛出异常。 这是因为如果Activity需要恢复，则提交后的状态可能会丢失。 对于丢失提交的情况如果OK的话，可以使用`commitAllowingStateLoss()`。  
使用`commitAllowingStateLoss()`可以有效的避免`commit()`抛出的异常，建议使用。

### 3.6 与Activity通信

Fragment中可以使用`getActivity()`获取Activity的实例。

```java
View listView = getActivity().findViewById(R.id.list);
```

在Activity中可以使用FragmentManager的`findFragmentById()`或者`findFragmentByTag()`获取Fragment实例。

```java
ExampleFragment fragment = (ExampleFragment) getFragmentManager().findFragmentById(R.id.example_fragment);
```

#### 3.6.1 创建与Activity的事件回调

可以在Fragment中声明一个回调接口，宿主Activity必须实现该接口。为了保证宿主Activity实现了该接口，可以在Fragment的`onAttach(Activity)`中将宿主Activity进行强制类型转换，若宿主Activity没有实现该接口，则会抛出错误。

```java
public static class FragmentA extends ListFragment {
    OnArticleSelectedListener mListener;

    // Container Activity must implement this interface
    public interface OnArticleSelectedListener {
        public void onArticleSelected(Uri articleUri);
    }
    ...
    @Override
    public void onAttach(Activity activity) {
        super.onAttach(activity);
        try {
            mListener = (OnArticleSelectedListener) activity;
        } catch (ClassCastException e) {
            throw new ClassCastException(activity.toString() + " must implement OnArticleSelectedListener");
        }
    }
    ...
}
```

#### 3.6.2 给App bar添加Item

Fragment通过实现`onCreateOptionsMenu()`可以给Activity添加菜单项。但是，为了使该方法能够接受调用，我们必须在`onCreate()`期间调用`setHasOptionsMenu()`，该方法表明Fragment将会为Activity添加菜单项；否则，Fragment不会接受`onCreateOptionsMenu()`方法的调用。  
我们从Fragment中添加到选项菜单中的菜单项都会附加到已存在的菜单项中。Fragment在菜单项被选中时也能接受`onOptionsItemSelected()`回调。  
在Fragment中也能使用`registerForContextMenu()`为View注册上下文菜单。当用户打开上下文菜单时，Fragment会接受到`onCreateContextMenu()`方法的调用。当用户选择一个菜单时，Fragment会接受到`onContextItemSelected()`的回调。

> **注意**: 虽然Fragment会接受到每一个由它添加的菜单的on-item-selected回调，但是宿主Activity首先会接受到这些回调。如果Activity实现的on-item-selected回调方法没有处理这些菜单项，那么事件会被传递到Fragment的回调。这对于选项菜单和上下文菜单都适用。

For more information about menus, see the [Menus](https://developer.android.com/guide/topics/ui/menus.html) developer guide and the [App Bar](https://developer.android.com/training/appbar/index.html) training class.

### 3.7 处理Fragment的生命周期

管理Fragment的生命周期就像管理Activity的生命周期。就像一个Activity一样，Fragment也有三种状态：

- Resumed  
Fragment在运行的Activity中处于可见状态

- Paused  
另一个Activity处于前台并且获得了焦点，但是宿主Activity仍然处于可见状态（前台Activity部分透明或者没有覆盖整个屏幕）。

- Stopped  
Fragment完全不可见。宿主Activity已经停止了或者Fragment已经从Activity中移除但是被添加到了返回栈中。处于停止状态的Fragment仍然是活着的（所有的状态和成员信息被系统保留）。但是，它不再对用户可见，如果宿主Activity被杀，它也会被杀。

像Activity一样，我们能够使用`Bundle`保留Fragment的状态，如果Activity进程被杀死，当Activity重新创建时，我们需要恢复Fragment的状态。我们可以在Fragment的`onSaveInstanceState()`期间保存状态，然后在`onCreate`或者`onCreateView()`或者`onActivityCreated()`期间恢复。

Activity与Fragment之间最重要的不同在于两者在返回栈的保存方式。Activity被放置在由系统管理的返回栈中(More information, see [Tasks and Back Stack](https://developer.android.com/guide/components/tasks-and-back-stack.html))。然而，Fragment被放置在由宿主Activity管理的返回栈中。

> **注意**：如果我们需要一个`Context`对象，我们可以调用`getActivity()`方法。但是，仅仅当Fragment已经附加到Activity上时才可以。放Fragment还没有附上时，或者已经解除附加，`getActivity()`会返回null。

Fragment所在的Activity的生命周期会直接影响到Fragment的生命周期，每一个Activity的生命周期回调都会导致Fragment的相似的回调。

![activity_fragment_lifecycle.png](/assets/images/android/activity_fragment_lifecycle.png)

Fragment还有少许额外的生命周期回调，它处理与Activity的独特交互，以执行诸如构建和销毁Fragment UI的动作。下面是这些回调:

- `onAttach()`  
当Fragment已经和Activity产生了关联时调用
- `onCreateView()`  
当创建Fragment的视图时调用
- `onActivityCreated()`  
当Activity的`onCreate`方法返回之后调用
- `onDestroyView()`  
当Fragment的视图正在被移除时调用
- `onDetach()`  
当Fragment正在与Activity解除关联时调用


### 3.8 Fragment嵌套Fragment的生命周期

有时候，我们有这样的需求:MainActivity有三个tab页，其中有个tab有两种显示样式，比如日历样式与列表样式。点击tab中的某个按钮，可以切换样式。

我们可以使用一个空壳子Fragment A来作为tab的Fragment，然后在里面创建两个Fragment B、C，动态的替换A里面的Fragment。这样达到了我们的目的。

然后我们又需要Fragment B、C每次可见的时候（比如从别的tab页切回来、进入一个Activity后退回来，从别的样式的Fragment切回来）刷新数据。这时候我们需要知道这些操作哪些方法被回调了。

当这个tab是第二个tab时：
> 点击tab2 **setUserVisibleHint(boolean isVisibleToUser)**  
A isVisibleToUser = [true]  
页面切换 **onHiddenChanged(boolean hidden)**  
B onHiddenChanged  false  
C onHiddenChanged  true  
从别的页面回来  **onStart**  
B onStart  
C onStart  

关于Fragment的一些坑，我找到了一篇好文:YoKey的[Fragment全解析系列](https://www.jianshu.com/p/d9143a92ad94)
