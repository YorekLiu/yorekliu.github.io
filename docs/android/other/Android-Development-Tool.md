---
title: "Android神兵利器"
---

## 大部分IDE

减少缩进  ⌘ + [

增加缩进  ⌘ + ]

- - -

## vim

提交时删除修改文件前面的#

1. 光标移动到需要删除#的第一行 ESC
2. Ctrl + V
3. Shift + G
4. Delete

大工告成，:wq回车
- - -

## Android查看页面名称以及查看页面布局id

查看页面名称可以使用`adb shell dumpsys activity top`命令，得到的信息如下

```text
TASK com.yorek.yltodo id=408
  ACTIVITY com.yorek.yltodo/.ui.activity.SplashActivity cfb9244 pid=31840
    Local Activity dc9e5f8 State:
      mResumed=true mStopped=false mFinished=false
      mChangingConfigurations=false
      mCurrentConfig={1.0 ?mcc?mnc [zh_CN] ldltr sw360dp w360dp h620dp 480dpi nrml long port finger -keyb/v/h -nav/h s.5 themeChanged=0 themeChangedFlags=0}
      mLoadersStarted=true
      Active Fragments in fe292ef:
        #0: ReportFragment{1791fc #0 android.arch.lifecycle.LifecycleDispatcher.report_fragment_tag}
          mFragmentId=#0 mContainerId=#0 mTag=android.arch.lifecycle.LifecycleDispatcher.report_fragment_tag
          mState=5 mIndex=0 mWho=android:fragment:0 mBackStackNesting=0
          mAdded=true mRemoving=false mFromLayout=false mInLayout=false
          mHidden=false mDetached=false mMenuVisible=true mHasMenu=false
          mRetainInstance=false mRetaining=false mUserVisibleHint=true
          mFragmentManager=FragmentManager{fe292ef in HostCallbacks{d6c2085}}
          mHost=android.app.Activity$HostCallbacks@d6c2085
          Child FragmentManager{4d08eda in ReportFragment{1791fc}}:
            FragmentManager misc state:
              mHost=android.app.Activity$HostCallbacks@d6c2085
              mContainer=android.app.Fragment$1@eef6f0b
              mParent=ReportFragment{1791fc #0 android.arch.lifecycle.LifecycleDispatcher.report_fragment_tag}
              mCurState=5 mStateSaved=false mDestroyed=false
      Added Fragments:
        #0: ReportFragment{1791fc #0 android.arch.lifecycle.LifecycleDispatcher.report_fragment_tag}
      FragmentManager misc state:
        mHost=android.app.Activity$HostCallbacks@d6c2085
        mContainer=android.app.Activity$HostCallbacks@d6c2085
        mCurState=5 mStateSaved=false mDestroyed=false
    ViewRoot:
      mAdded=true mRemoved=false
      mConsumeBatchedInputScheduled=false
      mConsumeBatchedInputImmediatelyScheduled=false
      mPendingInputEventCount=0
      mProcessInputEventsScheduled=false
      mTraversalScheduled=false      mIsAmbientMode=false
      android.view.ViewRootImpl$NativePreImeInputStage: mQueueLength=0
      android.view.ViewRootImpl$ImeInputStage: mQueueLength=0
      android.view.ViewRootImpl$NativePostImeInputStage: mQueueLength=0
    Choreographer:
      mFrameScheduled=true
      mLastFrameTime=13434855 (22 ms ago)
    View Hierarchy:
      DecorView@d49d1e8[SplashActivity]
        android.widget.LinearLayout{7d34001 V.E...... ........ 0,0-1080,1920}
          android.view.ViewStub{438bea6 G.E...... ......I. 0,0-0,0 #102040b android:id/action_mode_bar_stub}
          android.widget.FrameLayout{a3f0e7 V.E...... ........ 0,0-1080,1920}
            android.support.v7.widget.FitWindowsLinearLayout{2de2494 V.E...... ........ 0,0-1080,1920 #7f09000f app:id/action_bar_root}
              android.support.v7.widget.ViewStubCompat{632db3d G.E...... ......I. 0,0-0,0 #7f09001a app:id/action_mode_bar_stub}
              android.support.v7.widget.ContentFrameLayout{a21f32 V.E...... ........ 0,0-1080,1920 #1020002 android:id/content}
                android.widget.FrameLayout{d34b483 V.E...... ........ 0,0-1080,1920}
                  android.widget.LinearLayout{ec2f600 V.E...... ........ 0,0-1080,1920 #7f09005d app:id/fl_login}
                    android.support.v4.widget.Space{3f6ee39 I.ED..... ......I. 0,0-1080,382 #7f0900bd app:id/space}
                    android.support.v7.widget.AppCompatTextView{5cefc7e V.ED..... ........ 0,382-1080,535 #7f0900e2 app:id/tv_app_name}
                    com.yorek.yltodo.ui.widget.CodeEditText{18415df VFED..CL. .F...... 0,535-1080,764 #7f09003d app:id/code_edit_text}
                    android.support.v4.widget.Space{d61722c I.ED..... ......I. 0,764-1080,1531}
                    android.support.v7.widget.AppCompatTextView{d4f34f5 V.ED..... ........ 0,1531-1080,1584 #7f0900e4 app:id/tv_finger_print_status}
                    android.support.v7.widget.AppCompatImageView{75a628a V.ED..C.. ........ 468,1608-612,1752 #7f09006a app:id/iv_finger_print}
                  android.support.v7.widget.AppCompatImageView{c3e30fb V.ED..... ........ 396,816-684,1104 #7f09006d app:id/iv_logo}
    Looper (main, tid 1) {6898518}
      package com.yorek.yltodo version Code: 1 version Name: 1.0.0 cur loop is : Looper (main, tid 1) {6898518}
---------- Dump MessageQueue on Looper (main, tid 1) {6898518}----------
     Message 0: { when=-14ms callback=android.view.Choreographer$FrameDisplayEventReceiver target=android.view.Choreographer$FrameHandler planTime=1523198725746 dispatchTime=0 finishTime=0 }
     (Total messages: 1, polling=false, quitting=false)
-------------------------- END --------------------------

    Local FragmentActivity dc9e5f8 State:
      mCreated=truemResumed=true mStopped=false mReallyStopped=false
      mLoadersStarted=true
    FragmentManager misc state:
      mHost=android.support.v4.app.FragmentActivity$HostCallbacks@7ab2b71
      mContainer=android.support.v4.app.FragmentActivity$HostCallbacks@7ab2b71
      mCurState=5 mStateSaved=false mDestroyed=false
```

> 第一行的 *TASK* 就是前台任务栈的名称，第二行的 *ACTIVITY* 就是前台activity的名称

查看页面布局需要用到sdk里面的工具， *MacOS* 平台是`sdk/tools/bin/uiautomatorviewer`这个工具

```shell
yorek@yoreks-mbp:~/Library/Android/sdk/tools/bin$ ./uiautomatorviewer
```

在`bin`目录下通过脚本的调用方式调用即可。

step 1: 点击界面左上角第二个按钮，进入分析界面  
![step1](/assets/images/android/tools-uiautomator.png)
这四个按钮分别是打开、设备截图、压缩的设备截图、保存

step 2: 在左侧的操作页面选择感兴趣的控件，右边会出现其对应的信息
![step2](/assets/images/android/tools-uiautomator2.png)

## 性能优化常用工具

CPU占用分析：Systrace、TraceView  
内存占用分析： dump heap (MAT)、Allocation Tracker

Android Studio Profiler集成了：  
Memory Profiler -> dump heap (MAT、AS)、Allocation Tracker  
CPU Profiler -> Systrace、TraceView

!!! danger
    TODO: 补充具体案例

???+ question "Systrace、TraceView的区别"
    Systrace 可以跟踪系统的 I/O 操作、CPU 负载、Surface 渲染、GC 等事件。systrace 工具只能监控特定系统调用的耗时情况，所以它是属于 sample 类型，而且性能开销非常低。但是它不支持应用程序代码的耗时分析，所以在使用时有一些局限性。  
    
    Traceview 可以用来查看整个Java层代码执行过程有哪些函数调用，但是工具本身带来的性能开销过大，有时无法反映真实的情况。属于instrument类型。


???+ question "AS Profiler"
    在 Android Studio 3.2 的 Profiler 中直接集成了几种性能分析工具，其中：  

    -  Sample Java Methods 的功能类似于 Traceview 的 sample 类型。
    -  Trace Java Methods 的功能类似于 Traceview 的 instrument 类型。
    -  Trace System Calls 的功能类似于 systrace。
    -  SampleNative (API Level 26+) 的功能类似于 Simpleperf。

## bugreport

使用bugreport命令手机日志后，可以使用chkbugreport.jar来生成便于查看的日志文件：

```shell
adb bugreport log    # 生成log.zip
unzip log.zip -d log # 解压log.zip文件夹
java -jar chkbugreport.jar log/bugreport-NMF26X-2019-12-30-10-36-35.txt # 解析日志文件
```

上面日志文件解析完毕后，会生成一个log/bugreport-NMF26X-2019-12-30-10-36-35_out的文件夹，打开里面的index.html文件即可。

chkbugreport是Sony的一个开源项目，地址如下：[https://github.com/sonyxperiadev/ChkBugReport](https://github.com/sonyxperiadev/ChkBugReport)