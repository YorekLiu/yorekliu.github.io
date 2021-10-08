---
title: "Android原生底部导航栏"
---

BottomNavigationView+ViewPager+Fragment可以用来实现常见的底部导航的UI架构。本章的主要内容就是讲解这个UI样式的详细实现过程。

此外BottomNavigationView使用起来还是有一些值得摸索的小细节，本章也会在下部分内容结合BottomNavigationView的源码进行解释，这些细节包括：

- Menu数据超过3个会启用ShiftingMode，如何禁用这种讨厌的效果？
- 点击Menu进行切换时，选中的Menu的文字会变大，如何禁用这种UI设计师觉得不OK的效果（我觉得很OK啊）？
- 控制Menu选中、未选中状态ICON、文字颜色
- 阴影问题（全文搜索“阴影”）

话不多说，先上最终效果图。  
![BottomNavigationView实现底部导航栏](/assets/images/android/BottomNavigationView实现底部导航栏.png)

## 1 BottomNavigationView实现底部导航栏
首先简单说说这种效果的编写流程。  

I. 在`build.gradle`中引入 **最新** 的`design`以及`appcompat`库
```java
dependencies {
    compile 'com.android.support:appcompat-v7:25.0.1'
    compile 'com.android.support:design:25.1.1'
}
```

II. 保证Activity继承至`android.support.v7.app.AppCompatActivity`
```java
public class BottomNavigationViewActivity extends AppCompatActivity
```

III. 在`menu`文件中定义导航Menu
```xml
<menu xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:id="@+id/action_credit_accelerate"
          android:title="信用加速"
          android:icon="@drawable/btn_video_mode" />
    <item android:id="@+id/action_repay_calendar"
          android:title="还款日历"
          android:icon="@drawable/btn_video_mode" />
    <item android:id="@+id/action_mine"
          android:title="我的"
          android:icon="@drawable/btn_video_mode" />
    <item android:id="@+id/action_test"
          android:title="测试"
          android:icon="@drawable/btn_video_mode" />
</menu>
```

IV. 写Activity的布局文件
```xml
<?xml version="1.0" encoding="utf-8"?>
<RelativeLayout xmlns:android="http://schemas.android.com/apk/res/android"
                xmlns:app="http://schemas.android.com/apk/res-auto"
                android:layout_width="match_parent"
                android:layout_height="match_parent">

    <android.support.design.widget.BottomNavigationView
        android:id="@+id/bottom_navigation"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_alignParentBottom="true"
        android:background="@color/white"
        app:menu="@menu/menu_bottom_navigation"/>

    <android.support.v4.view.ViewPager
        android:id="@+id/viewpager"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:layout_above="@id/bottom_navigation"/>

    <View
        android:id="@+id/view_shadow"
        android:layout_width="match_parent"
        android:layout_height="4dp"
        android:alpha="0.6"
        android:layout_above="@id/bottom_navigation"
        android:background="@drawable/shadow_bottom_navigation"/>

</RelativeLayout>
```
这个布局比较简单，也很清晰。最底部是BottomNavigationView，用来导航。最上面是一个ViewPager，里面用来填充若干个Fragment。`view_shadow`是BottomNavigationView上面的一个阴影效果，设置alpha是为了让ViewPager里面的内容不会被阴影完全遮挡，阴影效果的drawable文件如下：
```xml
<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">
    <gradient
        android:startColor="#00ffffff"
        android:endColor="#D1D1D1"
        android:angle="270" />
</shape>
```
也可以使用`BottomNavigationView`的`app:elevation="8dp"`属性为其加上阴影，但是个人觉得效果不理想。若使用这种方式， **还要注意为其加上`android:background`属性，不然阴影不会出现。** 另外elevation没效果的bug已经修复了，将`design`库更新到`25.0.1`可以解决这个问题[This has been released in support library 25.0.1](https://issuetracker.google.com/issues/37124558)。

下面上一张对比图，左边是系统自带的，右边是通过View实现的。
![左边为elevation实现、右边为View实现](/assets/images/android/bottomnavigationbar-shadow.png)


V. 写Activity的代码
```java
public class BottomNavigationViewActivity extends ActivityBase
    implements BottomNavigationView.OnNavigationItemSelectedListener,
    ViewPager.OnPageChangeListener{

	BottomNavigationView mBottomNavigation;
	ViewPager mViewPager;

	private CreditAccelerateFragment mCreditAccelerateFragment;
	private RepayCalendarFragment mRepayCalendarFragment;
	private MineFragment mMineFragment;
	private TestFragment mTestFragment;

	private List<BaseFragment> mFragmentList;
	private PagerAdapter mPagerAdapter;

	private SparseIntArray id2pos;

	@Override
	protected void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);
		setContentView(R.layout.activity_bottom_navigation_view);

		mBottomNavigation = (BottomNavigationView) findViewById(R.id.bottom_navigation);
		mViewPager = (ViewPager) findViewById(R.id.viewpager);

		initData();
		initAdapter();
		initEvent();
	}

	private void initData() {
		mFragmentList = new ArrayList<>();
		mCreditAccelerateFragment = CreditAccelerateFragment.newInstance("", "");
		mRepayCalendarFragment = RepayCalendarFragment.newInstance("", "");
		mMineFragment = MineFragment.newInstance("", "");
		mTestFragment = TestFragment.newInstance("", "");
		mFragmentList.add(mCreditAccelerateFragment);
		mFragmentList.add(mRepayCalendarFragment);
		mFragmentList.add(mMineFragment);
		mFragmentList.add(mTestFragment);

		id2pos = new SparseIntArray(mFragmentList.size());
		id2pos.put(R.id.action_credit_accelerate, 0);
		id2pos.put(R.id.action_repay_calendar, 1);
		id2pos.put(R.id.action_mine, 2);
		id2pos.put(R.id.action_test, 3);
	}

	private void initAdapter() {
		mPagerAdapter = new HomePageFragmentAdapter(getSupportFragmentManager());
		mViewPager.setAdapter(mPagerAdapter);
	}

	private void initEvent() {
		mBottomNavigation.setOnNavigationItemSelectedListener(this);
		mViewPager.addOnPageChangeListener(this);
	}

	@Override
	public boolean onNavigationItemSelected(@NonNull MenuItem item) {
		mViewPager.setCurrentItem(id2pos.get(item.getItemId()));
		return true;
	}

	@Override
	public void onPageScrolled(int position, float positionOffset, int positionOffsetPixels) {}

	@Override
	public void onPageSelected(int position) {
		mBottomNavigation.getMenu().getItem(position).setChecked(true);
	}

	@Override
	public void onPageScrollStateChanged(int state) {}

	private class HomePageFragmentAdapter extends FragmentPagerAdapter {
		public HomePageFragmentAdapter(FragmentManager fm) {
			super(fm);
		}

		@Override
		public Fragment getItem(int position) {
			return mFragmentList.get(position);
		}

		@Override
		public int getCount() {
			return HOMEPAGE_FRAGMENT_COUNT;
		}
	}
}
```
这段代码也比较简单。

`initData`中完成了4个Fragment的创建，并将其保存到数据中；另外，还将每个Menu的id以及其position保存起来，以免后面点击BottomNavigationView时需要switch case判断点击了哪个Menu，这只是个人喜欢的写法，仅供参考。

`initAdapter`中创建并设置了ViewPager的Adapter，ViewPager的Adapter有两个可以选择，一个是FragmentPagerAdapter，还有一个是FragmentStatePagerAdapter。

`initEvent`里面分别给ViewPager和BottomNavigationView绑定了一个Listener。这两个Listener就是ViewPager和BottomNavigationView联动的关键。  
首先看一下BottomNavigationView的OnNavigationItemSelectedListener，它就只有一个方法`onNavigationItemSelected`。在这个方法里面我们控制ViewPager切换到对应的Fragment。
然后在看一下ViewPager的OnPageChangeListener，这里我们只用到了`onPageSelected`方法。同样，这里控制BottomNavigationView选择对应的Menu。

另外：由于ViewPager的特性，会导致有些fragment不断的销毁，重建。在需要的时候，我们可以重写`FragmentPagerAdapter`的`destroyItem方法`，将里面调用父类的方法删除，这样可以阻止Fragment的销毁。
```java
private class HomePageFragmentAdapter extends FragmentPagerAdapter {
    public HomePageFragmentAdapter(FragmentManager fm) {
        super(fm);
    }

    @Override
    public Fragment getItem(int position) {
        return mFragmentList.get(position);
    }

    @Override
    public int getCount() {
        return HOMEPAGE_FRAGMENT_COUNT;
    }

    @Override
    public Object instantiateItem(ViewGroup container, int position) {
        return super.instantiateItem(container, position);
    }

    @Override
    public void destroyItem(ViewGroup container, int position, Object object) {
        //super.destroyItem(container, position, object);
    }
}
```

VI. 下面最后看一下DEMO里面Fragment的写法，这些都是一样的，随便挑一个：
```java
public class RepayCalendarFragment extends BaseFragment {
	// TODO: Rename parameter arguments, choose names that match
	// the fragment initialization parameters, e.g. ARG_ITEM_NUMBER
	private static final String ARG_PARAM1 = "param1";
	private static final String ARG_PARAM2 = "param2";

	// TODO: Rename and change types of parameters
	private String mParam1;
	private String mParam2;


	public RepayCalendarFragment() {
		// Required empty public constructor
	}

	/**
	 * Use this factory method to create a new instance of
	 * this fragment using the provided parameters.
	 *
	 * @param param1 Parameter 1.
	 * @param param2 Parameter 2.
	 * @return A new instance of fragment CreditAccelerateFragment.
	 */
	// TODO: Rename and change types and number of parameters
	public static RepayCalendarFragment newInstance(String param1, String param2) {
		RepayCalendarFragment fragment = new RepayCalendarFragment();
		Bundle args = new Bundle();
		args.putString(ARG_PARAM1, param1);
		args.putString(ARG_PARAM2, param2);
		fragment.setArguments(args);
		return fragment;
	}

	@Override
	public void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);
		if (getArguments() != null) {
			mParam1 = getArguments().getString(ARG_PARAM1);
			mParam2 = getArguments().getString(ARG_PARAM2);
		}
	}

	@Override
	public View onCreateView(LayoutInflater inflater, ViewGroup container,
							 Bundle savedInstanceState) {
		// Inflate the layout for this fragment
		return inflater.inflate(R.layout.fragment_repay_calendar, container, false);
	}
}
```
上面的代码就是Android Studio自动生成的，具体页面的逻辑就要写在这里了。但是由于我们这只是一个DEMO，所以什么也没写。fragment_repay_calendar布局文件只是一个TextView而已。

> 到此，第一节就已经结束了。这个控件还是挺方便的。但是，还是有一些坑啊，比如最开始提到的三个细节。下面这一节来讲解如何达到这些效果。

## 2 BottomNavigationView的细节调整

### 2.1 禁用ShiftingMode模式

如果你的Menu超过三个，那么需要此步骤。否则，不需要。因为控件内部会根据`mShiftingMode = mMenu.size() > 3;`决定启不启用mShiftingMode。

我们先看禁用ShiftingMode前后对比图：
![禁用ShiftingMode前后对比图.png](/assets/images/android/禁用ShiftingMode前后对比图.png)

禁用代码：
```java
public class BottomNavigationViewHelper {
    public static void disableShiftMode(BottomNavigationView view) {
        BottomNavigationMenuView menuView = (BottomNavigationMenuView) view.getChildAt(0);
        try {
            Field shiftingMode = menuView.getClass().getDeclaredField("mShiftingMode");
            shiftingMode.setAccessible(true);
            shiftingMode.setBoolean(menuView, false);
            shiftingMode.setAccessible(false);
            for (int i = 0; i < menuView.getChildCount(); i++) {
                BottomNavigationItemView item = (BottomNavigationItemView) menuView.getChildAt(i);
                //noinspection RestrictedApi
                item.setShiftingMode(false);
                // set once again checked value, so view will be updated
                //noinspection RestrictedApi
                item.setChecked(item.getItemData().isChecked());
            }
        } catch (NoSuchFieldException e) {
            Log.e("BNVHelper", "Unable to get shift mode field", e);
        } catch (IllegalAccessException e) {
            Log.e("BNVHelper", "Unable to change value of shift mode", e);
        }
    }
}
```
只需要在获得BottomNavigationView后，调用上述方法即可：
```java
BottomNavigationView bottomNavigationView = (BottomNavigationView) findViewById(R.id.bottom_navigation_bar);
BottomNavigationViewHelper.disableShiftMode(bottomNavigationView);
```
来自StackOverflow的传送门：[How to disable BottomNavigationView shift mode?](https://stackoverflow.com/questions/40176244/how-to-disable-bottomnavigationview-shift-mode)

想要知道为什么这样做可以解决这个问题，我们需要查看源码了。

### 2.2 BottomNavigationView源码解析

首先看一下BottomNavigationView里面几个类成员变量：

```java
private final MenuBuilder mMenu;
private final BottomNavigationMenuView mMenuView;
private final BottomNavigationPresenter mPresenter = new BottomNavigationPresenter();
private MenuInflater mMenuInflater;

private OnNavigationItemSelectedListener mListener;
```
`mMenuInflater`用来将menu资源填充给`mMenu`，而`mPresenter`会在`BottomNavigationPresenter`内部调用`mMenuView.initialize(mMenu)`，将`mMenuView`与`mMenu`联系起来，这是一个简单的MVP模式的应用。`mListener`则是导航栏的回调接口了。

我们接着看BottomNavigationView的构造方法：
```java
public BottomNavigationView(Context context, AttributeSet attrs, int defStyleAttr) {
    super(context, attrs, defStyleAttr);

    // Create the menu
    mMenu = new BottomNavigationMenu(context);

    mMenuView = new BottomNavigationMenuView(context);
    FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
    params.gravity = Gravity.CENTER;
    mMenuView.setLayoutParams(params);

    mPresenter.setBottomNavigationMenuView(mMenuView);
    mMenuView.setPresenter(mPresenter);
    mMenu.addMenuPresenter(mPresenter);
    mPresenter.initForMenu(getContext(), mMenu);

    // Custom attributes
    TintTypedArray a = TintTypedArray.obtainStyledAttributes(context, attrs,
            R.styleable.BottomNavigationView, defStyleAttr,
            R.style.Widget_Design_BottomNavigationView);
    ...
    if (a.hasValue(R.styleable.BottomNavigationView_menu)) {
        inflateMenu(a.getResourceId(R.styleable.BottomNavigationView_menu, 0));
    }
    a.recycle();
    ...
    mMenu.setCallback(new MenuBuilder.Callback() {
        @Override
        public boolean onMenuItemSelected(MenuBuilder menu, MenuItem item) {
            return mListener != null && !mListener.onNavigationItemSelected(item);
        }

        @Override
        public void onMenuModeChange(MenuBuilder menu) {}
    });
}
```
其构造方法就清晰的展示了`mMenu`、`mMenuView`的创建，`mPresenter`与两者的联系，以及如何填充menu，如何设置点击回调。

我们看一下`mPresenter.initForMenu(getContext(), mMenu)`相关代码：
```java
// BottomNavigationPresenter#initForMenu
@Override
public void initForMenu(Context context, MenuBuilder menu) {
    mMenuView.initialize(mMenu);
    mMenu = menu;
}

// BottomNavigationMenuView#initialize
@Override
public void initialize(MenuBuilder menu) {
    mMenu = menu;
}
```
我们可以看到，这个初始化操作只是将MenuBuilder传递到了BottomNavigationMenuView而已，并没有发生关键的操作。

关键操作的发生来自于`BottomNavigationView`构造方法中填充menu的一段代码，我们跟踪一下。
```java
// BottomNavigationView#BottomNavigationView(Context, AttributeSet, int)
inflateMenu(a.getResourceId(R.styleable.BottomNavigationView_menu, 0));

public void inflateMenu(int resId) {
    mPresenter.setUpdateSuspended(true);
    getMenuInflater().inflate(resId, mMenu);
    mPresenter.setUpdateSuspended(false);
    mPresenter.updateMenuView(true);
}
```
我们可以看到在填充menu刚开始时，会置mUpdateSuspended为true，这样在填充menu未完成时，如果调用了`updateMenuView`，那么`updateMenuView`方法会立刻返回，不会往下面执行。这样可以避免异常情况出现。
接着，就会调用`getMenuInflater().inflate(resId, mMenu)`进行menu的填充。然后会置mUpdateSuspended为false，这样`updateMenuView`方法可以真正执行。

在最后会调用`mPresenter.updateMenuView(true);`方法进行BottomNavigationMenuView的构建。我看看一下这个方法：
```java
@Override
public void updateMenuView(boolean cleared) {
    if (mUpdateSuspended) return;
    if (cleared) {
        mMenuView.buildMenuView();
    } else {
        mMenuView.updateMenuView();
    }
}
```

接着就是BottomNavigationView控件的重头戏了，我们来到了BottomNavigationMenuView。我们看一下其`buildMenuView`方法：
```java
public void buildMenuView() {
    ...
    mButtons = new BottomNavigationItemView[mMenu.size()];
    mShiftingMode = mMenu.size() > 3;
    for (int i = 0; i < mMenu.size(); i++) {
        mPresenter.setUpdateSuspended(true);
        mMenu.getItem(i).setCheckable(true);
        mPresenter.setUpdateSuspended(false);
        BottomNavigationItemView child = getNewItem();
        mButtons[i] = child;
        child.setIconTintList(mItemIconTint);
        child.setTextColor(mItemTextColor);
        child.setItemBackground(mItemBackgroundRes);
        child.setShiftingMode(mShiftingMode);
        child.initialize((MenuItemImpl) mMenu.getItem(i), 0);
        child.setItemPosition(i);
        child.setOnClickListener(mOnClickListener);
        addView(child);
    }
    mActiveButton = Math.min(mMenu.size() - 1, mActiveButton);
    mMenu.getItem(mActiveButton).setChecked(true);
}
```
这里首先会根据menu的个数创建一个BottomNavigationItemView数组，每一个menu对应一个BottomNavigationItemView。然后会根据menu的个数是否大于3，来决定是否处于ShiftingMode。
```java
mShiftingMode = mMenu.size() > 3;
```
然后循环给每一个Item设置ShiftingMode、OnClickListener等等属性。  
最后会设置初始的选中的Button，通过调用其`setChecked(boolean)`方法。

我们看一下这个方法，该方法展示了ShiftingMode与非ShiftingMode下的动画效果。
```java
@Override
public void setChecked(boolean checked) {
    ViewCompat.setPivotX(mLargeLabel, mLargeLabel.getWidth() / 2);
    ViewCompat.setPivotY(mLargeLabel, mLargeLabel.getBaseline());
    ViewCompat.setPivotX(mSmallLabel, mSmallLabel.getWidth() / 2);
    ViewCompat.setPivotY(mSmallLabel, mSmallLabel.getBaseline());
    if (mShiftingMode) {
        if (checked) {
            LayoutParams iconParams = (LayoutParams) mIcon.getLayoutParams();
            iconParams.gravity = Gravity.CENTER_HORIZONTAL | Gravity.TOP;
            iconParams.topMargin = mDefaultMargin;
            mIcon.setLayoutParams(iconParams);
            mLargeLabel.setVisibility(VISIBLE);
            ViewCompat.setScaleX(mLargeLabel, 1f);
            ViewCompat.setScaleY(mLargeLabel, 1f);
        } else {
            LayoutParams iconParams = (LayoutParams) mIcon.getLayoutParams();
            iconParams.gravity = Gravity.CENTER;
            iconParams.topMargin = mDefaultMargin;
            mIcon.setLayoutParams(iconParams);
            mLargeLabel.setVisibility(INVISIBLE);
            ViewCompat.setScaleX(mLargeLabel, 0.5f);
            ViewCompat.setScaleY(mLargeLabel, 0.5f);
        }
        mSmallLabel.setVisibility(INVISIBLE);
    } else {
        if (checked) {
            LayoutParams iconParams = (LayoutParams) mIcon.getLayoutParams();
            iconParams.gravity = Gravity.CENTER_HORIZONTAL | Gravity.TOP;
            iconParams.topMargin = mDefaultMargin + mShiftAmount;
            mIcon.setLayoutParams(iconParams);
            mLargeLabel.setVisibility(VISIBLE);
            mSmallLabel.setVisibility(INVISIBLE);

            ViewCompat.setScaleX(mLargeLabel, 1f);
            ViewCompat.setScaleY(mLargeLabel, 1f);
            ViewCompat.setScaleX(mSmallLabel, mScaleUpFactor);
            ViewCompat.setScaleY(mSmallLabel, mScaleUpFactor);
        } else {
            LayoutParams iconParams = (LayoutParams) mIcon.getLayoutParams();
            iconParams.gravity = Gravity.CENTER_HORIZONTAL | Gravity.TOP;
            iconParams.topMargin = mDefaultMargin;
            mIcon.setLayoutParams(iconParams);
            mLargeLabel.setVisibility(INVISIBLE);
            mSmallLabel.setVisibility(VISIBLE);

            ViewCompat.setScaleX(mLargeLabel, mScaleDownFactor);
            ViewCompat.setScaleY(mLargeLabel, mScaleDownFactor);
            ViewCompat.setScaleX(mSmallLabel, 1f);
            ViewCompat.setScaleY(mSmallLabel, 1f);
        }
    }

    refreshDrawableState();
}
```
这里我们可以看出，上一小节就是mShiftingMode为true时产生的效果，所以我们只需要取消该模式即可。

另外，强调一下，BottomNavigationView官方建议3~5个Item，如果超过五个会报错，代码在`BottomNavigationMenu#addInternal`
```xml
@Override
protected MenuItem addInternal(int group, int id, int categoryOrder, CharSequence title) {
    if (size() + 1 > MAX_ITEM_COUNT) {
        throw new IllegalArgumentException(
                "Maximum number of items supported by BottomNavigationView is " + MAX_ITEM_COUNT
                        + ". Limit can be checked with BottomNavigationView#getMaxItemCount()");
    }
    ...
}
```

### 2.3 禁用选中项文字变大

另外我们关注第二个细节。

![第二个细节对比.png](/assets/images/android/bottomnavigationbar-text-scale.png)

选中的Item，底下的文字会比没有选中的大一号。如果我们想改，也是有办法的。

我们只需要在我们工程的`dimens.xml`中加入一行代码就OK了。
```xml
<dimen name="design_bottom_navigation_active_text_size">12sp</dimen>
```
 因为`design_bottom_navigation_text_size`表示未选择时文字的大小，这个值是12sp，而`design_bottom_navigation_active_text_size`表示选中的文字大小，这个值是14sp。  
 我们只需要在我们自己的资源文件中取一个同名的资源就可以覆盖系统资源，这样就可以解决掉这个问题。

具体可以从`BottomNavigationItemView`的构造方法中可以看出来：
```java
public BottomNavigationItemView(Context context, AttributeSet attrs, int defStyleAttr) {
    super(context, attrs, defStyleAttr);
    final Resources res = getResources();
    int inactiveLabelSize =
            res.getDimensionPixelSize(R.dimen.design_bottom_navigation_text_size);
    int activeLabelSize = res.getDimensionPixelSize(
            R.dimen.design_bottom_navigation_active_text_size);
    ...
    mScaleUpFactor = 1f * activeLabelSize / inactiveLabelSize;
    mScaleDownFactor = 1f * inactiveLabelSize / activeLabelSize;
    ...
}
```
结合上面贴出来的`setChecked`方法，可以判定是design_bottom_navigation_text_size与design_bottom_navigation_active_text_size不一样导致的。

我们从AOSP源码中可以看到这两个值的大小：[frameworks/support/design/res/values/dimens.xml](http://androidxref.com/7.1.1_r6/xref/frameworks/support/design/res/values/dimens.xml#62)
```xml
<dimen name="design_bottom_navigation_text_size">12sp</dimen>
<dimen name="design_bottom_navigation_active_text_size">14sp</dimen>
```
所以我们只需要修改其中一个值，让其与另外一个相等就OK了。我选择修改选中状态的值，也就是design_bottom_navigation_active_text_size。

### 2.4 控制Menu选中、未选中状态ICON、文字颜色
按照在本文第一节中的配置，系统会自动按照主题色给选中的Menu的ICON、文字渲染颜色。给文字渲染颜色很OK，但是给Menu渲染的时候，有可能不是我们想要的效果。

按照第一节的设置，BottomNavigationView的表现如下：

![没有特意控制Menu渲染前](/assets/images/android/bottomnavigationbar未设置前.png)

在控制渲染后：
![控制Menu渲染后](/assets/images/android/bottomnavigationbar未设置后.png)

通过上面对比知道，我们可以精确的控制Menu的文字、ICON在各种状态下显示的样子。

具体实现其实很简单，可以使用selector控制，代码如下：
```xml
<android.support.design.widget.BottomNavigationView
    android:id="@+id/bottom_navigation"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_alignParentBottom="true"
    android:background="@color/white"
    app:itemIconTint="@drawable/tab_text_color_selector"
    app:itemTextColor="@drawable/tab_text_color_selector"
    app:menu="@menu/menu_bottom_navigation" />
```
上面新增了两个控制属性：`app:itemIconTint`以及`app:itemTextColor`，这两个分别控制各种状态下 **非透明部分** 图标的渲染以及文字的渲染。  

也就是说想要达到上面渲染后的效果，还需要改menu文件里面的`android:icon`部分：
```xml
<?xml version="1.0" encoding="utf-8"?>
<menu xmlns:android="http://schemas.android.com/apk/res/android">
    <item
        android:id="@+id/action_loan"
        android:icon="@drawable/tab_icon_bill_selector"
        android:title="账单" />
    <item
        android:id="@+id/action_credit"
        android:icon="@drawable/tab_icon_credit_selector"
        android:title="信用" />
    <item
        android:id="@+id/action_mine"
        android:icon="@drawable/tab_icon_me_selector"
        android:title="我" />
</menu>
```

icon的drawable如下：
```xml
<?xml version="1.0" encoding="utf-8"?>
<selector xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@drawable/ic_tab_bill_s" android:state_checked="true" />
    <item android:drawable="@drawable/ic_tab_bill_n" android:state_checked="false" />
</selector>
```

至此，三个麻烦的问题都解决了。BottomNavigationView的工作原理大致也过了一遍。

### 2.5 禁止tint icon

`BottomNavigationView`会默认给icon tint上颜色，即使没有指定`app:itemIconTint`。代码片段如下：

```java
if (a.hasValue(R.styleable.BottomNavigationView_itemIconTint)) {
    mMenuView.setIconTintList(
            a.getColorStateList(R.styleable.BottomNavigationView_itemIconTint));
} else {
    mMenuView.setIconTintList(
            createDefaultColorStateList(android.R.attr.textColorSecondary));
}
```

所以我们可以在代码中手动调用`setItemIconTintList(null)`来禁止tint icon。

```kotlin
bottomNavigationView.itemIconTintList = null
```

该方法即使在Material库中的BNV也适用。

BTW，禁用点击ripple效果可以设置`app:itemBackground="@null"`。

### 2.6 禁止点击ripple

`android.support.design.widget.BottomNavigationView`控件如果想禁止点击时的ripple效果，只需要设置`app:itemBackground`的值和`android:background`一样即可。

## 3. Material库中的BNV

自从Google推出了androidx之后，原来design库有了新的替代品，而BottomNavigationView也有了新的包名`com.google.android.material.bottomnavigation.BottomNavigationView`。该组件在`com.google.android.material:material:x.x.x`中。  

Material库中的BNV使用和之前的差不多，不过2.1节的[禁用ShiftingMode模式](#21-shiftingmode)反射修改方式已经失效，毕竟两个库内部不太一样。新BNV提供了`app:itemHorizontalTranslationEnabled`和`app:labelVisibilityMode`方便开发者选择需要的样式。  
`app:itemHorizontalTranslationEnabled`可以简单粗暴的控制ShiftingMode是否开启。`app:labelVisibilityMode`有四种值可以设置，对应的xml选项如下：

| LabelVisibilityMode | xml选项 | UI表现 |
| ------------------- | ----- | -- |
|LABEL_VISIBILITY_AUTO | auto | 当item数量小于等于3时，表现和`labeled`一致；否则和`selected`一致 |
|LABEL_VISIBILITY_SELECTED | selected | label只会在选中的item上显示 |
|LABEL_VISIBILITY_LABELED | labeled | label会在所有的item上显示 |
|LABEL_VISIBILITY_UNLABELED | unlabeled | label会在所有的item上都不显示 |

毫无疑问，我们只需要令`app:itemHorizontalTranslationEnabled="false"`和`app:labelVisibilityMode="labeled"`即可完成[禁用ShiftingMode模式](#21-shiftingmode)的效果。  

实际上，只需要令`app:labelVisibilityMode="labeled"`即可。因为，此时`BottomNavigationMenuView.isShifting`会返回false，轮不到短路与后面的`itemHorizontalTranslationEnabled`出手。

<figcaption>BottomNavigationMenuView代码片段</figcaption>

```java
  @Override
  protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
    ...
    if (isShifting(labelVisibilityMode, visibleCount) && itemHorizontalTranslationEnabled) {
      ...
    } else {
        ...
    }
    ...
  }

  public void buildMenuView() {
    ...
    boolean shifting = isShifting(labelVisibilityMode, menu.getVisibleItems().size());
    for (int i = 0; i < menu.size(); i++) {
      ...
      child.setShifting(shifting);
      ...
    }
  }

  public void updateMenuView() {
    ...
    boolean shifting = isShifting(labelVisibilityMode, menu.getVisibleItems().size());
    for (int i = 0; i < menuSize; i++) {
      ...
      buttons[i].setShifting(shifting);
      ...
    }
  }

  private boolean isShifting(@LabelVisibilityMode int labelVisibilityMode, int childCount) {
    return labelVisibilityMode == LabelVisibilityMode.LABEL_VISIBILITY_AUTO
        ? childCount > 3
        : labelVisibilityMode == LabelVisibilityMode.LABEL_VISIBILITY_SELECTED;
  }
```

2.3节的[禁用选中项文字变大](#23)仍然实用于新BNV中。因为`design_bottom_navigation_item.xml`中仍然使用了`design_bottom_navigation_text_size`、`design_bottom_navigation_active_text_size`作为两个label的默认大小。  
当然，我们也可以使用新BNV提供的`app:itemTextAppearanceActive`、`app:itemTextAppearanceInactive`来控制文字大小。

此外，新BNV还提供了`app:itemIconSize`控制icon的大小。这样一来新BNV的可定制性就更强了。

小结一下新BNV提供的常用可定制项：

- app:itemHorizontalTranslationEnabled
- app:labelVisibilityMode
- app:itemTextAppearanceActive
- app:itemTextAppearanceInactive
- app:itemIconSize