---
title: "理解Activity的启动模式"
---

## Question
话题：理解Activity的启动模式。  

1、Activity的启动模式有哪几种，分别用于什么场景？  
2、清晰地描述下onNewIntent和onConfigurationChanged这两个生命周期方法的场景？

## Answer
关于Activity，可以看这篇全面的文章：[Activity](/android/framework/Android四大组件(1)/)

### 1. Activity的启动模式

目前有四种启动模式：standard、singleTop、singleTask、singleInstance

- standard  
  标准模式  
  每次启动activity都会创建一个新的实例，不管该实例是否已经存在。被启动的activity会运行在启动该activity的任务栈中。所以使用非Activity类型的Context启动一个standard Activity就会报错，解决该问题的办法是为待启动的Activity指定FLAG_ACTIVITY_NEW_TASK，这样启动的时候就会为它准备一个新的任务栈，这样待启动Activity实际上是以singleTask模式启动的。
- singleTop  
  栈顶复用模式  
  如果Activity已经位于任务栈的栈顶，那么Activity不会重新创建，同时其`onNewIntent`方法会被回调。  
  适合接收通知而启动的内容显示页面。比如推送过来的新闻详情页面，根据传入的intent数据显示不同的新闻信息。
- singleTask  
  栈内复用模式  
  这是一种单实例模式，只要Activity在一个栈中存在，多起启动该Activity都不会重新创建实例，和singleTop一样，系统会回调其`onNewIntent`方法。同时，位于该Activity上面的Activity都会被出栈，所以该启动模式具有FLAG_ACTIVITY_CLEAR_TOP效果。  
  适合作为应用的主页面。
- singleInstance  
  单实例模式  
  加强版的singleTask，它具有singleTask的一些特点，此外，还强调了一点：具有该模式的Activity只能单独的位于一个任务栈中。  
  闹钟的响铃界面。从外部打开时，只需要显示一次。

### 2. onNewIntent、onConfigurationChanged
- onNewIntent  
  在`singleTop` 、`singleTask`、`singleInstance`再次启动相同的Activity，如果期望只有一个实例存在，再次启动就会调用`onNewIntent`。在`onNewIntent`可以通过`setIntent`更新intent数据。
- onConfigurationChanged  
  当设备语言、屏幕方向、键盘等参数改变后，默认会销毁当前Activity并重新创建一次来重新加载新的配置信息。为了防止系统销毁，可以在`activity`标签中设置`android:configChanges`。在设置后，若对应的配置发生了改变，那么系统不会重建`Activity`，而是回调其`onConfigurationChanged`方法。
