---
title: "Window与WindowManager"
---

Window表示一个窗口的概念，它存在于Window、Dialog以及Toast中，但是日常开发中并不多见，它可以实现悬浮窗。Window是一个抽象类，其具体实现是`PhoneWindow`。WindowManager是外界访问Window的入口，Window的具体实现在`WindowManagerService`中，WindowManager与`WindowManagerService`之间的交互是一个IPC过程。  

Android中所有的视图都是通过Window来呈现的，不管是Activity、Dialog还是Toast，它们的视图实际上都是附加在Window上的，因此Window实际是View的直接管理者。在View的事件分发机制也可以知道，单击事件由Window传递给DecorView，再由DecorView传递给我们的View，就连Activity的设置视图的方法`setContentView`在底层也是通过Window来实现的。

## 1 Window与WindowManager

我们先看下面这段通过WindowManager添加Window的代码：

```java
public class WindowTestActivity extends BaseActivity {

    public static final int OVERLAY_PERMISSION_REQ_CODE = 0x0001;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_window_test);

        addFloatingView();
    }

    private void addFloatingView() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            requestDrawOverLaysPermission();
        } else {
            addFloatingViewInternal();
        }
    }

    private void addFloatingViewInternal() {
        Button mButton = new Button(this);
        mButton.setText("Button");
        WindowManager.LayoutParams layoutParams = new WindowManager.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.TYPE_SYSTEM_ERROR,
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                | WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                | WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED,
                PixelFormat.TRANSLUCENT);
        layoutParams.gravity = Gravity.LEFT | Gravity.TOP;
        layoutParams.x = 100;
        layoutParams.y = 300;

        WindowManager windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        windowManager.addView(mButton, layoutParams);
    }

    @TargetApi(Build.VERSION_CODES.M)
    public void requestDrawOverLaysPermission() {
        if (!Settings.canDrawOverlays(this)) {
            Toast.makeText(this, "can not DrawOverlays", Toast.LENGTH_SHORT).show();
            Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + this.getPackageName()));
            startActivityForResult(intent, OVERLAY_PERMISSION_REQ_CODE);
        } else {
            // Already hold the SYSTEM_ALERT_WINDOW permission, do add view or something.
            addFloatingViewInternal();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == OVERLAY_PERMISSION_REQ_CODE) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (!Settings.canDrawOverlays(this)) {
                    // SYSTEM_ALERT_WINDOW permission not granted...
                    Toast.makeText(this, "Permission Denied by user. Please Check it in Settings", Toast.LENGTH_SHORT).show();
                    requestDrawOverLaysPermission();
                } else {
                    Toast.makeText(this, "Permission Allowed", Toast.LENGTH_SHORT).show();
                    // Already hold the SYSTEM_ALERT_WINDOW permission, do addview or something.
                    addFloatingViewInternal();
                }
            }
        }
    }
}
```
这段代码适配了Android M，在M及以后使用系统级别悬浮窗需要引导用户打开此设置。

实际添加Window的方法是`addFloatView`。这个方法可以将Button添加到屏幕坐标的(100, 300)处。当然使用系统级别的悬浮窗不要忘记注册权限(`<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />`)，不然在L上会报错，在M上没有`Draw over other apps`设置项。

> **注意**： **WindowManager.LayoutParams的x和y是与gravity的相对值。也就是说window会会先根据gravity确定位置，然后根据x,y确定偏移量。** gravity参数表示Window出现的位置，默认是屏幕中间。x、y的值是相对于gravity的。  
> 通过Google Play Store(Version 6.05 or heigher is required)下载的需要该权限的应用，会被framework自动授予该权限。These are the commits [[1]](https://github.com/android/platform_frameworks_base/commit/01af6a42a6a008d4b208a92510537791b261168c) [[2]](https://github.com/android/platform_frameworks_base/commit/4ff3b614ab73539763343e0981869c7ab5ee9979) that allow the Play Store to give the automatic grant of the SYSTEM_ALERT_WINDOW permission.

WindowManager的flags、type属性比较重要。上面构造函数的第三个、第四个就是它们：`layoutParams(int w, int h, int _type, int _flags, int _format)`。

flags属性表示Window的属性，它有很多选项，我们这里只说三种，剩下的可以查看[官方文档](https://developer.android.com/reference/android/view/WindowManager.LayoutParams.html)

- `FLAG_NOT_FOCUSABLE`  
  Window不需要获得焦点，因此也不会接收各种输入事件，此标记会同时启用`FLAG_NOT_TOUCH_MODAL`标记位，无论代码中有没有明确设置这个标记位。  
  设置了此状态意味着不需要和软键盘进行交互，因为它是Z-ordered的，独立于任何激活状态的软键盘。因此，它可以处于激活状态软键盘的上面，如果必要，可以覆盖软键盘。我们可以使用`FLAG_ALT_FOCUSABLE_IM`修改这个行为。

- `FLAG_NOT_TOUCH_MODAL`  
  Window是否是modal状态。  
  即使Window是可以获得焦点的（`FLAG_NOT_FOCUSABLE`没有设置），在Window外面的点击事件都会传递给后面的Window。否则，Window将会处理所有的点击事件，无论是否在它的范围内。

- `FLAG_SHOW_WHEN_LOCKED`  
  Window可以显示在KeyGuard或者其他锁屏界面上。和`FLAG_KEEP_SCREEN_ON`一起使用可以在屏幕打开后直接显示Window，而不用经历KeyGuard。与`FLAG_DISMISS_KEYGUARD`一起使用可以自动跳过non-secure KeyGuard。此Flag只能用于最顶层全屏Window上。

type参数表示Window的类型，**Window可以分为三种类型：Application Window、子Window以及系统Window**：

- Application Window对应着一个Activity；
- 子Window不能单独存在，它需要附属在特定的父Window中，比如Dialog就是一个子Window；
- 系统Window需要申明权限才能创建，比如Toast以及系统状态栏就是系统Window。

Window是分层的，每个Window都有对应的Z-ordered，层级大的会覆盖在层级小的Window上面。在三种Window中，Application Window是 1 ~ 99，子Window是 1000 ~ 1999，系统Window是 2000 ~ 2999。  
系统层级是最大的，我们一般可以选用`TYPE_SYSTEM_OVERLAY`或者`TYPE_SYSTEM_ERROR`，同时声明权限(`<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />`)。

对应 Window 层级定义如下：

| 名称 | 值 | 说明 |
| :-- | :- | :-- |
| FIRST_APPLICATION_WINDOW | 1 | Start of window types that represent normal application windows. |
| TYPE_BASE_APPLICATION | 1 | Window type: an application window that serves as the "base" windowof the overall application; all other application windows will appear on top of it. In multiuser systems shows only on the owning user's window. |
| TYPE_APPLICATION | 2 | Window type: a normal application window.  The {@link #token} must be an Activity token identifying who the window belongs to. In multiuser systems shows only on the owning user's window. |
| TYPE_APPLICATION_STARTING | 3 | Window type: special application window that is displayed while the application is starting.  Not for use by applications themselves; this is used by the system to display something until the application can show its own windows. In multiuser systems shows on all users' windows. |
| TYPE_DRAWN_APPLICATION | 4 | Window type: a variation on TYPE_APPLICATION that ensures the window manager will wait for this window to be drawn before the app is shown. In multiuser systems shows only on the owning user's window. |
| LAST_APPLICATION_WINDOW | 99 | End of types of application windows. |
| FIRST_SUB_WINDOW | 100 | Start of types of sub-windows.  The {@link #token} of these windows must be set to the window they are attached to.  These types of windows are kept next to their attached window in Z-order, and their coordinate space is relative to their attached window. |
| TYPE_APPLICATION_PANEL | FIRST_SUB_WINDOW | Window type: a panel on top of an application window.  These windows appear on top of their attached window. |
| TYPE_APPLICATION_MEDIA | FIRST_SUB_WINDOW + 1 | Window type: window for showing media (such as video).  These windows are displayed behind their attached window. |
| TYPE_APPLICATION_SUB_PANEL | FIRST_SUB_WINDOW + 2 | Window type: a sub-panel on top of an application window.  These windows are displayed on top their attached window and any {@link #TYPE_APPLICATION_PANEL} panels. |
| TYPE_APPLICATION_ATTACHED_DIALOG | FIRST_SUB_WINDOW + 3 | Window type: like {@link #TYPE_APPLICATION_PANEL}, but layout of the window happens as that of a top-level window, <em>not</em> as a child of its container. |
| TYPE_APPLICATION_MEDIA_OVERLAY | FIRST_SUB_WINDOW + 4 | Window type: window for showing overlays on top of media windows. These windows are displayed between TYPE_APPLICATION_MEDIA and the application window.  They should be translucent to be useful.  This is a big ugly hack so: |
| TYPE_APPLICATION_ABOVE_SUB_PANEL | FIRST_SUB_WINDOW + 5 | Window type: a above sub-panel on top of an application window and it's sub-panel windows. These windows are displayed on top of their attached window and any {@link #TYPE_APPLICATION_SUB_PANEL} panels. |
| LAST_SUB_WINDOW | 1999 | End of types of sub-windows. |
| FIRST_SYSTEM_WINDOW | 2000 | Start of system-specific window types.  These are not normally created by applications. |
| TYPE_STATUS_BAR | FIRST_SYSTEM_WINDOW | Window type: the status bar.  There can be only one status bar window; it is placed at the top of the screen, and all other windows are shifted down so they are below it. In multiuser systems shows on all users' windows. |
| TYPE_SEARCH_BAR | FIRST_SYSTEM_WINDOW+1 | Window type: the search bar.  There can be only one search bar window; it is placed at the top of the screen. In multiuser systems shows on all users' windows. |
| ... | ... | ... |
| TYPE_SYSTEM_ALERT | FIRST_SYSTEM_WINDOW+3 | Window type: system window, such as low power alert. These windows are always on top of application windows. In multiuser systems shows only on the owning user's window. @deprecated for non-system apps. Use {@link #TYPE_APPLICATION_OVERLAY} instead. |
| ... | ... | ... |
| TYPE_TOAST | FIRST_SYSTEM_WINDOW+5 | Window type: transient notifications. In multiuser systems shows only on the owning user's window. @deprecated for non-system apps. Use {@link #TYPE_APPLICATION_OVERLAY} instead. |
| ... | ... | ... |
| TYPE_APPLICATION_OVERLAY | FIRST_SYSTEM_WINDOW + 38 | Window type: Application overlay windows are displayed above all activity windows (types between {@link #FIRST_APPLICATION_WINDOW} and {@link #LAST_APPLICATION_WINDOW}) but below critical system windows like the status bar or IME. <p> The system may change the position, size, or visibility of these windows at anytime to reduce visual clutter to the user and also manage resources. <p> Requires {@link android.Manifest.permission#SYSTEM_ALERT_WINDOW} permission. <p> The system will adjust the importance of processes with this window type to reduce the chance of the low-memory-killer killing them. <p> In multi-user systems shows only on the owning user's screen. |
| LAST_SYSTEM_WINDOW | 2999 | End of types of system windows. |
| INVALID_WINDOW_TYPE | -1 | Used internally when there is no suitable type available. |

???+ tips "常见的Window的type"
    Activity类型是TYPE_BASE_APPLICATION  
    DialogFragment是TYPE_APPLICATION  
    PopupWindow是TYPE_APPLICATION_PANEL

WindowManager提供的功能很简单，常用的方法只有三个：添加、更新、删除View。这三个方法定义在ViewManager中，而WindowManager继承至ViewManager：

```java
public interface ViewManager
{
    public void addView(View view, ViewGroup.LayoutParams params);
    public void updateViewLayout(View view, ViewGroup.LayoutParams params);
    public void removeView(View view);
}
```

## 2 Window内部机制

Window是一个抽象的概念，每一个Window都对应着一个View和一个ViewRootImpl，Window与View通过ViewRootImpl来建立联系，因此Window实际上并不存在，它是以View的形式存在的。在实际使用中无法访问Window，对Window的访问必须通过WindowManager。我们接下来分析下Window的三个方法。

### 2.1 Window的添加过程

> 本章源码基于Android 7.1

Window的添加过程通过WindowManager的`addView`来实现，**WindowManager是一个接口，其真正实现是WindowManagerImpl类**。WindowManagerImpl中三个操作如下：

```java
@Override
public void addView(@NonNull View view, @NonNull ViewGroup.LayoutParams params) {
    applyDefaultToken(params);
    mGlobal.addView(view, params, mContext.getDisplay(), mParentWindow);
}

@Override
public void updateViewLayout(@NonNull View view, @NonNull ViewGroup.LayoutParams params) {
    applyDefaultToken(params);
    mGlobal.updateViewLayout(view, params);
}

@Override
public void removeView(View view) {
    mGlobal.removeView(view, false);
}

private void applyDefaultToken(@NonNull ViewGroup.LayoutParams params) {
    // Only use the default token if we don't have a parent window.
    if (mDefaultToken != null && mParentWindow == null) {
        if (!(params instanceof WindowManager.LayoutParams)) {
            throw new IllegalArgumentException("Params must be WindowManager.LayoutParams");
        }

        // Only use the default token if we don't already have a token.
        final WindowManager.LayoutParams wparams = (WindowManager.LayoutParams) params;
        if (wparams.token == null) {
            wparams.token = mDefaultToken;
        }
    }
}
```
`applyDefaultToken`方法将会为Window设置默认token，这个token只有在`AccessibilityService`中才会设置。所以，一般情况下该方法没有任何效果，可以忽略。

WindowManagerImpl并没有直接实现Window的三大操作，而是全部交给了WindowManagerGlobal处理。WindowManagerGlobal以单例的模式向外提供自己的实例：`private final WindowManagerGlobal mGlobal = WindowManagerGlobal.getInstance();`。WindowManagerImpl的这种工作模式是典型的[桥接模式](/design-pattern/bridge/)，将所有的操作全部委托给WindowManagerGlobal来实现。

接下来我们看WindowManagerGlobal的`addView`方法，该方法分为以下几部分：  

1. 检查传入参数，并调整子Window布局参数  
    ```java
    if (view == null) {
        throw new IllegalArgumentException("view must not be null");
    }
    if (display == null) {
        throw new IllegalArgumentException("display must not be null");
    }
    if (!(params instanceof WindowManager.LayoutParams)) {
        throw new IllegalArgumentException("Params must be WindowManager.LayoutParams");
    }
    
    final WindowManager.LayoutParams wparams = (WindowManager.LayoutParams) params;
    if (parentWindow != null) {
        parentWindow.adjustLayoutParamsForSubWindow(wparams);
    } else {
        // If there's no parent, then hardware acceleration for this view is
        // set from the application's hardware acceleration setting.
        final Context context = view.getContext();
        if (context != null
                && (context.getApplicationInfo().flags
                        & ApplicationInfo.FLAG_HARDWARE_ACCELERATED) != 0) {
            wparams.flags |= WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED;
        }
    }
    ```
    `adjustLayoutParamsForSubWindow`方法实现是在`Window`中，该方法的作用就是根据`wparams`的type判断属于哪种Window。如果是子Window，会使用DecorView的getWindowToken来设置其token；如果是应用Window，也会根据是否有父Parent来决定将应用Token还是父Parent的应用Token设置其Token。之后会设置其packageName以及是否使用硬件加速的flags。

2. 设置系统属性监听器、检查View状态、为子Window查找parentView
    ```java
    // Start watching for system property changes.
    if (mSystemPropertyUpdater == null) {
        mSystemPropertyUpdater = new Runnable() {
            @Override public void run() {
                synchronized (mLock) {
                    for (int i = mRoots.size() - 1; i >= 0; --i) {
                        mRoots.get(i).loadSystemProperties();
                    }
                }
            }
        };
        SystemProperties.addChangeCallback(mSystemPropertyUpdater);
    }
    
    int index = findViewLocked(view, false);
    if (index >= 0) {
        if (mDyingViews.contains(view)) {
            // Don't wait for MSG_DIE to make it's way through root's queue.
            mRoots.get(index).doDie();
        } else {
            throw new IllegalStateException("View " + view
                    + " has already been added to the window manager.");
        }
        // The previous removeView() had not completed executing. Now it has.
    }
    
    // If this is a panel window, then find the window it is being
    // attached to for future reference.
    if (wparams.type >= WindowManager.LayoutParams.FIRST_SUB_WINDOW &&
            wparams.type <= WindowManager.LayoutParams.LAST_SUB_WINDOW) {
        final int count = mViews.size();
        for (int i = 0; i < count; i++) {
            if (mRoots.get(i).mWindow.asBinder() == wparams.token) {
                panelParentView = mViews.get(i);
            }
        }
    }
    ```
    在View的检查操作中，如果View已经添加过了，且正在被删除，那么会立刻执行`doDie`进行一些相关的销毁操作；否则，如果View已经添加过，但是不在mDyingViews数组中，这说明是重复添加，会报`IllegalStateException("View " + view + " has already been added to the window manager.")`错。

3. 创建ViewRootImpl并将View添加到列表中  
    在`WindowManagerGlobal`中有四个很重要的成员变量：
    ```java
    private final ArrayList<View> mViews = new ArrayList<View>();
    private final ArrayList<ViewRootImpl> mRoots = new ArrayList<ViewRootImpl>();
    private final ArrayList<WindowManager.LayoutParams> mParams =
            new ArrayList<WindowManager.LayoutParams>();
    private final ArraySet<View> mDyingViews = new ArraySet<View>();
    ```
    - mViews保存的是所有Window对应的View
    - mRoots存储的所有Window对应的ViewRootImpl，
    - mParams存储的所有Window对应的布局参数
    - mDyingViews保存的正在被删除的View对象，或者说是已经调用了`removeView`方法但是删除操作还未完成的Window对象

    在addView中通过如下方式将Window的一系列对象添加到列表中：
    ```java
    root = new ViewRootImpl(view.getContext(), display);

    view.setLayoutParams(wparams);

    mViews.add(view);
    mRoots.add(root);
    mParams.add(wparams);
    ```

4. 通过ViewRootImpl更新界面并完成Window的添加过程
    ```java
    // do this last because it fires off messages to start doing things
    try {
        root.setView(view, wparams, panelParentView);
    } catch (RuntimeException e) {
        // BadTokenException or InvalidDisplayException, clean up.
        synchronized (mLock) {
            final int index = findViewLocked(view, false);
            if (index >= 0) {
                removeViewLocked(index, true);
            }
        }
        throw e;
    }
    ```
    我们可以看出，该方法最后调用的是ViewRootImpl的`setView(view, wparams, panelParentView);`方法。该方法内部会调用`requestLayout ()`来完成异步刷新请求，进行View的测量、布局以及绘制。`requestLayout`的内部接着会调用`scheduleTraversals`方法，这实际上是View绘制 的入口：
    ```java
    @Override
    public void requestLayout() {
        if (!mHandlingLayoutInLayoutRequest) {
            checkThread();
            mLayoutRequested = true;
            scheduleTraversals();
        }
    }
    ```
    在`setView`方法中，调用`requestLayout`方法后，接着会通过`WindowSession`来完成Window的添加过程。
    ```java
    try {
        mOrigWindowType = mWindowAttributes.type;
        mAttachInfo.mRecomputeGlobalAttributes = true;
        collectViewAttributes();
        res = mWindowSession.addToDisplay(mWindow, mSeq, mWindowAttributes,
                getHostVisibility(), mDisplay.getDisplayId(),
                mAttachInfo.mContentInsets, mAttachInfo.mStableInsets,
                mAttachInfo.mOutsets, mInputChannel);
    } catch (RemoteException e) {
        ...
    } finally {
        ...
    }
    ```
    mWindowSession的类型是IWindowSession，它的真正实现类是`Session`，是一个Binder对象，因此Window的添加过程是一次IPC操作。下面是 `mWindowSession`结构的部分代码：
    ```java
    // ViewRootImpl
    mWindowSession = WindowManagerGlobal.getWindowSession();
    
    // WindowManagerGlobal
    public static IWindowSession getWindowSession() {
        synchronized (WindowManagerGlobal.class) {
            if (sWindowSession == null) {
                try {
                    InputMethodManager imm = InputMethodManager.getInstance();
                    IWindowManager windowManager = getWindowManagerService();
                    sWindowSession = windowManager.openSession(
                            new IWindowSessionCallback.Stub() {
                                @Override
                                public void onAnimatorScaleChanged(float scale) {
                                    ValueAnimator.setDurationScale(scale);
                                }
                            },
                            imm.getClient(), imm.getInputContext());
                } catch (RemoteException e) {
                    throw e.rethrowFromSystemServer();
                }
            }
            return sWindowSession;
        }
    }

    public static IWindowManager getWindowManagerService() {
        synchronized (WindowManagerGlobal.class) {
            if (sWindowManagerService == null) {
                sWindowManagerService = IWindowManager.Stub.asInterface(
                        ServiceManager.getService("window"));
                try {
                    if (sWindowManagerService != null) {
                        ValueAnimator.setDurationScale(
                                sWindowManagerService.getCurrentAnimatorScale());
                    }
                } catch (RemoteException e) {
                    throw e.rethrowFromSystemServer();
                }
            }
            return sWindowManagerService;
        }
    }
    
    // WindowManagerService
    @Override
    public IWindowSession openSession(IWindowSessionCallback callback, IInputMethodClient client,
            IInputContext inputContext) {
        if (client == null) throw new IllegalArgumentException("null client");
        if (inputContext == null) throw new IllegalArgumentException("null inputContext");
        Session session = new Session(this, callback, client, inputContext);
        return session;
    }
    
    // Session
    final class Session extends IWindowSession.Stub implements IBinder.DeathRecipient
    ```
    
    我们再看一下Session的`addToDisplay`方法：
    ```java
    @Override
    public int addToDisplay(IWindow window, int seq, WindowManager.LayoutParams attrs,
            int viewVisibility, int displayId, Rect outContentInsets, Rect outStableInsets,
            Rect outOutsets, InputChannel outInputChannel) {
        return mService.addWindow(this, window, seq, attrs, viewVisibility, displayId,
                outContentInsets, outStableInsets, outOutsets, outInputChannel);
    }
    ```
    mService就是WindowManagerService。如此一来，Window的添加请求就交给WindowManagerService了，在WindowManagerService内部会将传入的session、client等封装成WindowState并以client为key保存在`mWindowMap`中。具体Window在WindowManagerService内部是怎么添加的，不在这里进行进一步的分析，因为都是一些细节，深入没有太大意义。到目前为止，我们对Window的添加流程已经很清楚了。

### 2.2 Window的删除过程

Window的删除过程也是WindowManagerImpl通过WindowManagerGlobal来实现的。我们看一下`WindowManagerGlobal#removeView`方法：

```java
public void removeView(View view, boolean immediate) {
    if (view == null) {
        throw new IllegalArgumentException("view must not be null");
    }

    synchronized (mLock) {
        int index = findViewLocked(view, true);
        View curView = mRoots.get(index).getView();
        removeViewLocked(index, immediate);
        if (curView == view) {
            return;
        }

        throw new IllegalStateException("Calling with view " + view
                + " but the ViewAncestor is attached to " + curView);
    }
}
```

此方法的逻辑很清楚，首先通过`findViewLocked`找到待删除View的索引，然后再调用`removeViewLocked`做进一步的删除操作：

```java
private void removeViewLocked(int index, boolean immediate) {
    ViewRootImpl root = mRoots.get(index);
    View view = root.getView();

    if (view != null) {
        InputMethodManager imm = InputMethodManager.getInstance();
        if (imm != null) {
            imm.windowDismissed(mViews.get(index).getWindowToken());
        }
    }
    boolean deferred = root.die(immediate);
    if (view != null) {
        view.assignParent(null);
        if (deferred) {
            mDyingViews.add(view);
        }
    }
}
```

`removeViewLocked`是通过ViewRootImpl的`die(boolean)`来完成删除操作的。在`WindowManager`中提供了两种删除接口`removeView`和`removeViewImmediate`，他们会分别调用WindowManagerGlobal的`remove(view, false)`和`remove(view, true)`，后面的boolean变量就是这里的immediate，他们分别表示异步删除和同步删除。其中`removeViewImmediate`需要特别注意，一般不需要使用该方法来删除Window以免发生意外的错误。  

这里主要说说异步删除的情况，具体操作由`ViewRootImpl#die`方法完成：

```java
boolean die(boolean immediate) {
    // Make sure we do execute immediately if we are in the middle of a traversal or the damage
    // done by dispatchDetachedFromWindow will cause havoc on return.
    if (immediate && !mIsInTraversal) {
        doDie();
        return false;
    }

    if (!mIsDrawing) {
        destroyHardwareRenderer();
    } else {
        Log.e(mTag, "Attempting to destroy the window while drawing!\n" +
                "  window=" + this + ", title=" + mWindowAttributes.getTitle());
    }
    mHandler.sendEmptyMessage(MSG_DIE);
    return true;
}
```

在immediate为false的情况下，die方法只是发送了一个`MSG_DIE`消息后返回true了，并没有完成删除操作。因此从上面的`removeViewLocked`中可以看到，View没有立刻完成删除操作，只会将其加入mDyingViews中。  
这里的mHandler是一个`ViewRootHandler`对象，MSG_DIE消息会执行`doDie()`方法。因此在`die`方法中，如果参数immediate为true就会立刻调用`doDie`方法，这就是同步删除；如果为false，则会通过Handler来调用`doDie`方法，这就是两者的区别。

关于`ViewRootHandler`，我们在[Android消息机制](/android/framework/Android消息机制/)中我们提到过，`View.post(Runnable)`所抛出的Runnable对象都会由此Handler来执行。

下面我们看看`doDie`方法：

```java
void doDie() {
    checkThread();
    if (LOCAL_LOGV) Log.v(mTag, "DIE in " + this + " of " + mSurface);
    synchronized (this) {
        if (mRemoved) {
            return;
        }
        mRemoved = true;
        if (mAdded) {
            dispatchDetachedFromWindow();
        }

        if (mAdded && !mFirst) {
            destroyHardwareRenderer();

            if (mView != null) {
                int viewVisibility = mView.getVisibility();
                boolean viewVisibilityChanged = mViewVisibility != viewVisibility;
                if (mWindowAttributesChanged || viewVisibilityChanged) {
                    // If layout params have been changed, first give them
                    // to the window manager to make sure it has the correct
                    // animation info.
                    try {
                        if ((relayoutWindow(mWindowAttributes, viewVisibility, false)
                                & WindowManagerGlobal.RELAYOUT_RES_FIRST_TIME) != 0) {
                            mWindowSession.finishDrawing(mWindow);
                        }
                    } catch (RemoteException e) {
                    }
                }

                mSurface.release();
            }
        }

        mAdded = false;
    }
    WindowManagerGlobal.getInstance().doRemoveView(this);
}
```

`doDie`方法会首先检查是否是UI线程，然后调用`dispatchDetachedFromWindow`方法，真正删除View的逻辑就在这里。  

`dispatchDetachedFromWindow`干了这三件事：

1. 通知ViewTree调用`onWindowDetached`；调用View的`dispatchDetachedFromWindow`方法，此方法会调用`onDetachedFromWindow`以及`onDetachedFromWindowInternal`方法。前者我们可以重写来在其内部做一些资源回收的操作；后者framework已经做了一些垃圾回收操作，如果我们重写了该方法，一定要调用`super`的该方法。
2. 进行垃圾回收操作，比如清除数据、移除回调；
3. 通过Session的remove方法删除Window：`mWindowSession.remove(mWindow);`。这也是一个IPC过程，最终会调用`WindowManagerService`的`removeWindow`方法。

```java
void dispatchDetachedFromWindow() {
    if (mView != null && mView.mAttachInfo != null) {
        mAttachInfo.mTreeObserver.dispatchOnWindowAttachedChange(false);
        mView.dispatchDetachedFromWindow();
    }

    mAccessibilityInteractionConnectionManager.ensureNoConnection();
    mAccessibilityManager.removeAccessibilityStateChangeListener(
            mAccessibilityInteractionConnectionManager);
    mAccessibilityManager.removeHighTextContrastStateChangeListener(
            mHighContrastTextManager);
    removeSendWindowContentChangedCallback();

    destroyHardwareRenderer();

    setAccessibilityFocus(null, null);

    mView.assignParent(null);
    mView = null;
    mAttachInfo.mRootView = null;

    mSurface.release();

    if (mInputQueueCallback != null && mInputQueue != null) {
        mInputQueueCallback.onInputQueueDestroyed(mInputQueue);
        mInputQueue.dispose();
        mInputQueueCallback = null;
        mInputQueue = null;
    }
    if (mInputEventReceiver != null) {
        mInputEventReceiver.dispose();
        mInputEventReceiver = null;
    }
    try {
        mWindowSession.remove(mWindow);
    } catch (RemoteException e) {
    }

    // Dispose the input channel after removing the window so the Window Manager
    // doesn't interpret the input channel being closed as an abnormal termination.
    if (mInputChannel != null) {
        mInputChannel.dispose();
        mInputChannel = null;
    }

    mDisplayManager.unregisterDisplayListener(mDisplayListener);

    unscheduleTraversals();
}
```

最后在`doDie`方法中调用了`WindowManagerGlobal#doRemoveView`方法，此方法会删除当前View的数据，包括`mRoots`、`mParams`、`mViews`以及`mDyingViews`。至此，Window的删除过程已经完成了。

### 2.3 Window的更新过程

Window的更新过程通过`WindowManagerGlobal#updateViewLayout`开始：

```java
public void updateViewLayout(View view, ViewGroup.LayoutParams params) {
    if (view == null) {
        throw new IllegalArgumentException("view must not be null");
    }
    if (!(params instanceof WindowManager.LayoutParams)) {
        throw new IllegalArgumentException("Params must be WindowManager.LayoutParams");
    }

    final WindowManager.LayoutParams wparams = (WindowManager.LayoutParams)params;

    view.setLayoutParams(wparams);

    synchronized (mLock) {
        int index = findViewLocked(view, true);
        ViewRootImpl root = mRoots.get(index);
        mParams.remove(index);
        mParams.add(index, wparams);
        root.setLayoutParams(wparams, false);
    }
}
```

此方法很简单，首先检查参数是否合法，然后更新View的LayoutParams，接着更新mParams数组，最后调用`ViewRootImpl#setLayoutParams`方法来更新Window。`setLayoutParams`方法中最后调用了`scheduleTraversals`，该方法在View的工作原理时讲解过，它是View测量、布局、绘制的入口。`scheduleTraversals`方法会在最后调用`performTraversals`方法，在此方法内部会实现View的重绘，此外还会调用`relayoutWindow`方法进而调用`mWindowSession.relayout`方法来实现Window的更新，当然同以往一样，这也是一个IPC过程。

## 3. Window的创建过程

从上面的分析可以看出，View是Android中视图的呈现方式，但是View不能单独存在，它必须依附于Window，因此有视图的地方就有Window。

### 3.1 Activity的Window创建过程

要分析Activity中Window的创建过程，需要了解Activity的启动过程。Activity的启动过程非常复杂，这里只说与本节内容有关的部分。Activity的启动最终会通过`ActivityThread#performLaunchActivity`来完成启动过程。此方法内部会通过类加载器创建Activity的实例，然后调用`attach`方法为其关联运行中所依赖的一些变量：

```java
Activity activity = null;
try {
    java.lang.ClassLoader cl = r.packageInfo.getClassLoader();
    activity = mInstrumentation.newActivity(
            cl, component.getClassName(), r.intent);
    StrictMode.incrementExpectedActivityCount(activity.getClass());
    r.intent.setExtrasClassLoader(cl);
    r.intent.prepareToEnterProcess();
    if (r.state != null) {
        r.state.setClassLoader(cl);
    }
} catch (Exception e) {
    if (!mInstrumentation.onException(activity, e)) {
        throw new RuntimeException(
            "Unable to instantiate activity " + component
            + ": " + e.toString(), e);
    }
}

try {
    Application app = r.packageInfo.makeApplication(false, mInstrumentation);

    if (localLOGV) Slog.v(TAG, "Performing launch of " + r);
    if (localLOGV) Slog.v(
            TAG, r + ": app=" + app
            + ", appName=" + app.getPackageName()
            + ", pkg=" + r.packageInfo.getPackageName()
            + ", comp=" + r.intent.getComponent().toShortString()
            + ", dir=" + r.packageInfo.getAppDir());

    if (activity != null) {
        Context appContext = createBaseContextForActivity(r, activity);
        CharSequence title = r.activityInfo.loadLabel(appContext.getPackageManager());
        Configuration config = new Configuration(mCompatConfiguration);
        if (r.overrideConfig != null) {
            config.updateFrom(r.overrideConfig);
        }
        if (DEBUG_CONFIGURATION) Slog.v(TAG, "Launching activity "
                + r.activityInfo.name + " with config " + config);
        Window window = null;
        if (r.mPendingRemoveWindow != null && r.mPreserveWindow) {
            window = r.mPendingRemoveWindow;
            r.mPendingRemoveWindow = null;
            r.mPendingRemoveWindowManager = null;
        }
        activity.attach(appContext, this, getInstrumentation(), r.token,
                r.ident, app, r.intent, r.activityInfo, title, r.parent,
                r.embeddedID, r.lastNonConfigurationInstances, config,
                r.referrer, r.voiceInteractor, window);
        ...
    }
...
```

在`Activity#attach`方法中，系统会为Activity创建一个Window并为其设置一些回调接口。由于Activity实现了Window的回调接口，因此当Window接收到外界的状态改变时就会回调Activity的方法。这些回调接口里面有一个Callback接口，里面有我们熟知的`dispatchTouchEvent`、`onAttachedToWindow`、`onDetachedFromWindow`、`onMenuItemSelected`等一些接口。

```java
...
attachBaseContext(context);
mFragments.attachHost(null /*parent*/);
mWindow = new PhoneWindow(this, window);
mWindow.setWindowControllerCallback(this);
mWindow.setCallback(this);
mWindow.setOnWindowDismissedCallback(this);
...
```

上面在`Activity.attach`方法中完成了Window的创建；而Activity的视图附属在Window是通过`Activity#setContentView`来实现的：

```java
public void setContentView(@LayoutRes int layoutResID) {
    getWindow().setContentView(layoutResID);
    initWindowDecorActionBar();
}
```

`Activity#setContentView`调用了`Window#setContentView`方法设置View到content上，然后`initWindowDecorActionBar`方法会判断需不需要自动初始化ActionBar。  
接下来我们看一下`Window#setContentView`方法：

```java
@Override
public void setContentView(int layoutResID) {
    // Note: FEATURE_CONTENT_TRANSITIONS may be set in the process of installing the window
    // decor, when theme attributes and the like are crystalized. Do not check the feature
    // before this happens.
    if (mContentParent == null) {
        installDecor();
    } else if (!hasFeature(FEATURE_CONTENT_TRANSITIONS)) {
        mContentParent.removeAllViews();
    }

    if (hasFeature(FEATURE_CONTENT_TRANSITIONS)) {
        final Scene newScene = Scene.getSceneForLayout(mContentParent, layoutResID,
                getContext());
        transitionTo(newScene);
    } else {
        mLayoutInflater.inflate(layoutResID, mContentParent);
    }
    mContentParent.requestApplyInsets();
    final Callback cb = getCallback();
    if (cb != null && !isDestroyed()) {
        cb.onContentChanged();
    }
    mContentParentExplicitlySet = true;
}
```

`PhoneWindow.setContentView`方法大致遵循如下几个步骤：

1. 如果DecorView还没有创建，那么创建它  
   上面代码第6行的if语句，mContentParent就是id为`android.R.id.content`的FrameLayout，如果它为null，说明DecorView还没有创建，因此会调用`installDecor`方法来完成DecorView的创建。
   ```java
   private void installDecor() {
       mForceDecorInstall = false;
       if (mDecor == null) {
           mDecor = generateDecor(-1);
           ...
       }
       ...
       if (mContentParent == null) {
           mContentParent = generateLayout(mDecor);
           ...
       }
   }
   ```
   `installDecor`方法完成的事情比较简单，首先如果没有DecorView，那么通过`generateDecor`方法new一个`DecorView`，此时DecorView还没有任何内容，是一个空白的FrameLayout。其次，如果mContentParent为null，通过`generateLayout`创建mContentParent并加载具体的布局文件到DecorView中，这个过程如下：
   ```java
   // PhoneWindow#generateLayout
   mDecor.startChanging();
   mDecor.onResourcesLoaded(mLayoutInflater, layoutResource);
   ViewGroup contentParent = (ViewGroup)findViewById(ID_ANDROID_CONTENT);
   
   // DecorView
   void onResourcesLoaded(LayoutInflater inflater, int layoutResource) {
       ...
       mDecorCaptionView = createDecorCaptionView(inflater);
       final View root = inflater.inflate(layoutResource, null);
       if (mDecorCaptionView != null) {
           if (mDecorCaptionView.getParent() == null) {
               addView(mDecorCaptionView,
                       new ViewGroup.LayoutParams(MATCH_PARENT, MATCH_PARENT));
           }
           mDecorCaptionView.addView(root,
                   new ViewGroup.MarginLayoutParams(MATCH_PARENT, MATCH_PARENT));
       } else {
   
           // Put it below the color views.
           addView(root, 0, new ViewGroup.LayoutParams(MATCH_PARENT, MATCH_PARENT));
       }
       mContentRoot = (ViewGroup) root;
       ...
   }
   ```
   我们可以看到在`DecorView#onResourcesLoaded`方法中，通过`inflater.inflate(layoutResource, null)`填充了布局，在后面通过`mDecorCaptionView.addView(root, ...)`或者`addView(root, ...)`的方式将content添加到了DecorView中。

2. 将View添加至DecorView的mContentParent中  
  FEATURE_CONTENT_TRANSITIONS标志表示需要使用动画。如果带有这个FEATURE_CONTENT_TRANSITIONS，那么通过Scene处理填充，这样其内部可以播放enterAction、exitAction；否则直接使用`mLayoutInflater.inflate(layoutResID, mContentParent);`填充布局。  
  无论通过哪种方式，最后都会调用`LayoutInflater.inflate`进行填充，这样Activity的布局文件就已经添加到DecorView中的mContentParent中了，所以这就是`setContentView`的由来了。

3. 回调Activity的`onContentChanged`方法通知Activity视图已经发生改变  
   ```java
   final Callback cb = getCallback();
   if (cb != null && !isDestroyed()) {
       cb.onContentChanged();
   }
   ```
   `onContentChanged`方法在Activity内部是一个空实现。

经过`setContentView`方法后，DecorView已经创建且初始化完毕了，Activity的布局文件也已经添加到了DecorView的mContentParent中，但是这个时候Window还没有被WindowManage添加。  
真正的添加操作发生在`Activity#makeVisible`方法中，此方法在`ActivityThread.handleResumeActivity`中进行调用。此外，在调用之前，还会调用下列方法让Activity进入resume状态：`performResumeActivity`->`r.activity.performResume();`->`mInstrumentation.callActivityOnResume(this)`->`Activity.onResume`方法。

```java
void makeVisible() {
    if (!mWindowAdded) {
        ViewManager wm = getWindowManager();
        wm.addView(mDecor, getWindow().getAttributes());
        mWindowAdded = true;
    }
    mDecor.setVisibility(View.VISIBLE);
}
```

### 3.2 Dialog的Window创建过程

Dialog中Window的创建过程和Activity类似，不过比Activity的要简单的多，还是可以分为几个步骤来分析：  

1. 创建Window  
   在Dialog的构造器中创建了Window，仍然是一个PhoneWindow对象。该过程和Activity的Window创建过程一致：
   ```java
   Dialog(@NonNull Context context, @StyleRes int themeResId, boolean createContextThemeWrapper) {
       ...
   
       mWindowManager = (WindowManager) context.getSystemService(Context.WINDOW_SERVICE);
   
       final Window w = new PhoneWindow(mContext);
       mWindow = w;
       w.setCallback(this);
       w.setOnWindowDismissedCallback(this);
       w.setWindowManager(mWindowManager, null, null);
       w.setGravity(Gravity.CENTER);
   
       mListenersHandler = new ListenersHandler(this);
   }
   ```

2. 初始化DecorView并将Dialog的视图添加到DecorView  
   此过程也和Window类似，通过调用`Window.setContentView`来实现
   ```java
   public void setContentView(@LayoutRes int layoutResID) {
       mWindow.setContentView(layoutResID);
   }
   ```

3. 将DecorView添加到Window中显示  
   在Dialog的show方法中会完成这步操作。和Activity一样，都是在自身要出现在前台时才会将添加Window。
   ```java
   public void show() {
       if (mShowing) {
           if (mDecor != null) {
               if (mWindow.hasFeature(Window.FEATURE_ACTION_BAR)) {
                   mWindow.invalidatePanelMenu(Window.FEATURE_ACTION_BAR);
               }
               mDecor.setVisibility(View.VISIBLE);
           }
           return;
       }
   
       mCanceled = false;
   
       if (!mCreated) {
           dispatchOnCreate(null);
       } else {
           // Fill the DecorView in on any configuration changes that
           // may have occured while it was removed from the WindowManager.
           final Configuration config = mContext.getResources().getConfiguration();
           mWindow.getDecorView().dispatchConfigurationChanged(config);
       }
   
       onStart();
       mDecor = mWindow.getDecorView();
   
       if (mActionBar == null && mWindow.hasFeature(Window.FEATURE_ACTION_BAR)) {
           final ApplicationInfo info = mContext.getApplicationInfo();
           mWindow.setDefaultIcon(info.icon);
           mWindow.setDefaultLogo(info.logo);
           mActionBar = new WindowDecorActionBar(this);
       }
   
       ...
   
       mWindowManager.addView(mDecor, l);
       mShowing = true;
   
       sendShowMessage();
   }
   ```
   当Dialog被dismiss时，会调用`mWindowManager.removeViewImmediate(mDecor)`移除DecorView。
   
普通Dialog必须采用Activity的Context来构造，否则会报`BadTokenException`，因为token一般只有Activity拥有。但是系统Dialog可以不需要token，使用系统级别Dialog时注意需要声明权限。

### 3.3 Toast的Window创建过程

Toast的工作流程稍显复杂，因为其内部有两个IPC过程：

1. Toast访问NotificationManagerService（NMS）
2. NMS回调TN接口。

Toast属于系统Window，它内部的View可以由两种方式指定，系统默认样式或者通过`setView`指定的自定义View，但不管怎么样，它们都对应Toast的`mNextView`。  
Toast提供了`show`和`cancel`分别用于显示和隐藏Toast，其内部都是一个IPC过程，实现如下：

```java
/**
 * Show the view for the specified duration.
 */
public void show() {
    if (mNextView == null) {
        throw new RuntimeException("setView must have been called");
    }

    INotificationManager service = getService();
    String pkg = mContext.getOpPackageName();
    TN tn = mTN;
    tn.mNextView = mNextView;

    try {
        service.enqueueToast(pkg, tn, mDuration);
    } catch (RemoteException e) {
        // Empty
    }
}

/**
 * Close the view if it's showing, or don't show it if it isn't showing yet.
 * You do not normally have to call this.  Normally view will disappear on its own
 * after the appropriate duration.
 */
public void cancel() {
    mTN.hide();

    try {
        getService().cancelToast(mContext.getPackageName(), mTN);
    } catch (RemoteException e) {
        // Empty
    }
}
```

从上面的代码来看，显示和隐藏Toast都需要通过NMS来实现，由于NMS运行在系统的进程中，所以只能通过远程调用的方式来显示、隐藏Toast。  
上面的TN继承至`ITransientNotification.Stub`，是一个Binder，在Toast与NMS进行IPC，NMS处理Toast的显示或隐藏时会回调TN中的方法，此过程发生在客户端的Binder线程池中，所以需要通过Handler将其切换到当前线程。  
这里的service的服务端是NMS的`mService`成员变量，它是实现了`INotificationManager.Stub()`的内部匿名类。

我们先看一下NMS的`enqueueToast`操作：
```java
@Override
public void enqueueToast(String pkg, ITransientNotification callback, int duration)
{
    ...

    final boolean isSystemToast = isCallerSystem() || ("android".equals(pkg));
    final boolean isPackageSuspended =
            isPackageSuspendedForUser(pkg, Binder.getCallingUid());

    if (ENABLE_BLOCKED_TOASTS && (!noteNotificationOp(pkg, Binder.getCallingUid())
            || isPackageSuspended)) {
        if (!isSystemToast) {
            ...
            return;
        }
    }

    synchronized (mToastQueue) {
        int callingPid = Binder.getCallingPid();
        long callingId = Binder.clearCallingIdentity();
        try {
            ToastRecord record;
            int index = indexOfToastLocked(pkg, callback);
            // If it's already in the queue, we update it in place, we don't
            // move it to the end of the queue.
            if (index >= 0) {
                record = mToastQueue.get(index);
                record.update(duration);
            } else {
                // Limit the number of toasts that any given package except the android
                // package can enqueue.  Prevents DOS attacks and deals with leaks.
                if (!isSystemToast) {
                    int count = 0;
                    final int N = mToastQueue.size();
                    for (int i=0; i<N; i++) {
                         final ToastRecord r = mToastQueue.get(i);
                         if (r.pkg.equals(pkg)) {
                             count++;
                             if (count >= MAX_PACKAGE_NOTIFICATIONS) {
                                 Slog.e(TAG, "Package has already posted " + count
                                        + " toasts. Not showing more. Package=" + pkg);
                                 return;
                             }
                         }
                    }
                }

                Binder token = new Binder();
                mWindowManagerInternal.addWindowToken(token,
                        WindowManager.LayoutParams.TYPE_TOAST);
                record = new ToastRecord(callingPid, pkg, callback, duration, token);
                mToastQueue.add(record);
                index = mToastQueue.size() - 1;
                keepProcessAliveIfNeededLocked(callingPid);
            }
            // If it's at index 0, it's the current toast.  It doesn't matter if it's
            // new or just been updated.  Call back and tell it to show itself.
            // If the callback fails, this will remove it from the list, so don't
            // assume that it's valid after this.
            if (index == 0) {
                showNextToastLocked();
            }
        } finally {
            Binder.restoreCallingIdentity(callingId);
        }
    }
}
```

这段代码也很清楚，首先如果不是系统进程发出的Toast且应用处于挂起状态，那么return。然后会根据包名以及TN判断是否已经处于队列中，如果是那么更新duration，否则将Toast封装成一个`ToastRecord`然后插入`mToastQueue`队列中。当然如果是非系统应用，那么此应用最多有`MAX_PACKAGE_NOTIFICATIONS`也就是50个Toast存在。上述操作完成后，如果当前的Toast处于Toast队列第0个位置，那么会调用`showNextToastLocked`显示当前的Toast。

```java
void showNextToastLocked() {
    ToastRecord record = mToastQueue.get(0);
    while (record != null) {
        if (DBG) Slog.d(TAG, "Show pkg=" + record.pkg + " callback=" + record.callback);
        try {
            record.callback.show(record.token);
            scheduleTimeoutLocked(record);
            return;
        } catch (RemoteException e) {
            Slog.w(TAG, "Object died trying to show notification " + record.callback
                    + " in package " + record.pkg);
            // remove it from the list and let the process die
            int index = mToastQueue.indexOf(record);
            if (index >= 0) {
                mToastQueue.remove(index);
            }
            keepProcessAliveIfNeededLocked(record.pid);
            if (mToastQueue.size() > 0) {
                record = mToastQueue.get(0);
            } else {
                record = null;
            }
        }
    }
}
```

此段代码也好理解，首先取Toast队列第0个，会回调TN中的`show`方法，让Toast显示出来。然后调用`scheduleTimeoutLocked`方法，该方法的作用是根据duration的值延时发送MESSAGE_TIMEOUT消息，此消息会触发`cancelToastLocked`方法，`cancelToastLocked`又会通过TN回调`hide`方法，这样在指定时间后就让Toast消失。这就是Toast的工作原理了。  
在`cancelToastLocked`方法的最后，后当Toast队列还有Toast时，继续调用`showNextToastLocked`，这就是Toast的处理循环。  

我们看一下`scheduleTimeoutLocked`方法：

```java
private void scheduleTimeoutLocked(ToastRecord r)
{
    mHandler.removeCallbacksAndMessages(r);
    Message m = Message.obtain(mHandler, MESSAGE_TIMEOUT, r);
    long delay = r.duration == Toast.LENGTH_LONG ? LONG_DELAY : SHORT_DELAY;
    mHandler.sendMessageDelayed(m, delay);
}
```

这里有两个Toast显示的固定值：`LONG_DELAY`为3500ms，`SHORT_DELAY`为2000ms。

通过上面的代码，我们知道了Toast的显示与隐藏实际上是通过Toast中TN这个类来实现的，`show`和`hide`分别与其对应。我们接着看一下TN中这两个方法:

```java
final Runnable mHide = new Runnable() {
    @Override
    public void run() {
        handleHide();
        // Don't do this in handleHide() because it is also invoked by handleShow()
        mNextView = null;
    }
};

final Handler mHandler = new Handler() {
    @Override
    public void handleMessage(Message msg) {
        IBinder token = (IBinder) msg.obj;
        handleShow(token);
    }
};

/**
 * schedule handleShow into the right thread
 */
@Override
public void show(IBinder windowToken) {
    if (localLOGV) Log.v(TAG, "SHOW: " + this);
    mHandler.obtainMessage(0, windowToken).sendToTarget();
}

/**
 * schedule handleHide into the right thread
 */
@Override
public void hide() {
    if (localLOGV) Log.v(TAG, "HIDE: " + this);
    mHandler.post(mHide);
}

public void handleShow(IBinder windowToken) {
    if (localLOGV) Log.v(TAG, "HANDLE SHOW: " + this + " mView=" + mView
            + " mNextView=" + mNextView);
    if (mView != mNextView) {
        // remove the old view if necessary
        handleHide();
        mView = mNextView;
        Context context = mView.getContext().getApplicationContext();
        String packageName = mView.getContext().getOpPackageName();
        if (context == null) {
            context = mView.getContext();
        }
        mWM = (WindowManager)context.getSystemService(Context.WINDOW_SERVICE);
        // We can resolve the Gravity here by using the Locale for getting
        // the layout direction
        final Configuration config = mView.getContext().getResources().getConfiguration();
        final int gravity = Gravity.getAbsoluteGravity(mGravity, config.getLayoutDirection());
        mParams.gravity = gravity;
        if ((gravity & Gravity.HORIZONTAL_GRAVITY_MASK) == Gravity.FILL_HORIZONTAL) {
            mParams.horizontalWeight = 1.0f;
        }
        if ((gravity & Gravity.VERTICAL_GRAVITY_MASK) == Gravity.FILL_VERTICAL) {
            mParams.verticalWeight = 1.0f;
        }
        mParams.x = mX;
        mParams.y = mY;
        mParams.verticalMargin = mVerticalMargin;
        mParams.horizontalMargin = mHorizontalMargin;
        mParams.packageName = packageName;
        mParams.hideTimeoutMilliseconds = mDuration ==
            Toast.LENGTH_LONG ? LONG_DURATION_TIMEOUT : SHORT_DURATION_TIMEOUT;
        mParams.token = windowToken;
        if (mView.getParent() != null) {
            if (localLOGV) Log.v(TAG, "REMOVE! " + mView + " in " + this);
            mWM.removeView(mView);
        }
        if (localLOGV) Log.v(TAG, "ADD! " + mView + " in " + this);
        mWM.addView(mView, mParams);
        trySendAccessibilityEvent();
    }
}

public void handleHide() {
    if (localLOGV) Log.v(TAG, "HANDLE HIDE: " + this + " mView=" + mView);
    if (mView != null) {
        // note: checking parent() just to make sure the view has
        // been added...  i have seen cases where we get here when
        // the view isn't yet added, so let's try not to crash.
        if (mView.getParent() != null) {
            if (localLOGV) Log.v(TAG, "REMOVE! " + mView + " in " + this);
            mWM.removeViewImmediate(mView);
        }

        mView = null;
    }
}
```

`show`方法会通过Handler调用`handleShow`方法。`hide`方法会通过Handler最后调用`handleHide`方法。`handleShow`最后会调用`mWM.addView(mView, mParams);`将Toast视图添加到Window中；而`handleHide`最后会调用`mWM.removeViewImmediate(mView);`将Toast视图从Window中移除。  
在上面的分析中我们知道，Toast的显示与隐藏都是NMS通过调用TN的方法来控制的，因此它们运行在Binder线程池中。为了将执行环境切换到Toast请求所在的线程，这里在发出Toast请求的线程中创建了一个Handler。这也是为什么在子线程中Toast不出来的原因了。

到这里Toast的Window创建过程已经分析完毕了。出了上面提到的Activity、Dialog和Toast外，PopupWindow、状态栏等都是通过Window来实现的。