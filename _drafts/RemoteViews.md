---
title: "RemoteViews"
excerpt: "本文依附于RemoteViews的主要使用场景来分析其工作原理"
categories:
  - Android
tags:
  - RemoteViews
  - Notification
  - NotificationManager
  - AppWidget
  - AppWidgetProvider
  - PendingIntent
comments: true
toc: true
toc_label: "目录"
toc_icon: "heart"
---

RemoteViews在Android中的使用场景有两种：通知栏和桌面小插件。为了更好的分析`RemoteViews`的内部机制，本章先介绍`RemoteViews`在通知栏和桌面小部件上的应用。

## 1 RemoteViews的应用
`RemoteViews`在实际开发中，主要是用在通知栏和桌面小部件的开发过程中。

通知栏主要是通过`NotificationManager`的`notify`方法来实现的，它除了默认效果之外，还可以另外定义布局。  
桌面小部件是通过`AppWidgetProvider`来实现的，`AppWidgetProvider`本质上是一个广播。

通知栏和桌面小部件的开发过程都会用到`RemoteViews`，因为它们在更新界面时无法想在Activity里面那样去直接更新View，这是因为二者的界面都运行在其他进程中，准确的说是系统的`SystemServer`进程。为了跨进程更新界面，`RemoteViews`提供了一系列`set`方法，并且这些方法只是View全部方法的子集，而且`RemoteViews`支持的View类型也是有限的。

下面简单说说`RemoteViews`在通知栏和桌面小部件中的使用方法。

### 1.1 RemoteViews在通知栏上的应用
我们知道，通知栏除了默认的效果外还支持自定义布局，下面分别说明这些情况。

**1.系统默认的通知样式**  
使用下面的代码可以弹出一个系统样式的通知栏：
```java
Intent intent = new Intent(this, NotificationActivity.class);
PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT);
NotificationCompat.Builder builder = new NotificationCompat.Builder(this);
builder.setSmallIcon(R.mipmap.ic_launcher)
        .setTicker("hello world")
        .setWhen(System.currentTimeMillis())
        .setContentTitle("notification test")
        .setContentText("this is a notification")
        .setContentIntent(pendingIntent);
Notification notification = builder.build();
notification.flags = Notification.FLAG_AUTO_CANCEL;

NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
notificationManager.notify(1, notification);
```

![remoteviews-system-notification]({{ basepath }}/assets/images/remoteviews-system-notification.png)  

**2.自定义通知样式**  
自定义通知样式需要我们提供一个布局文件，然后通过`RemoteViews`来加载这个布局即可以改变通知的样式，代码如下所示：
```java
Intent intent = new Intent(this, NotificationActivity.class);
PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT);
NotificationCompat.Builder builder = new NotificationCompat.Builder(this);

RemoteViews remoteViews = new RemoteViews(getPackageName(), R.layout.item_search_result);
remoteViews.setImageViewResource(R.id.iv_file, R.mipmap.ic_launcher);
remoteViews.setTextViewText(R.id.tv_title, "notification title");
remoteViews.setTextViewText(R.id.tv_desc, "This is a notification");
PendingIntent pendingIntent1 = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), PendingIntent.FLAG_UPDATE_CURRENT);
remoteViews.setOnClickPendingIntent(R.id.iv_file, pendingIntent1);

builder.setSmallIcon(R.mipmap.ic_launcher)
        .setTicker("hello world")
        .setWhen(System.currentTimeMillis())
        .setCustomContentView(remoteViews)
        .setContentIntent(pendingIntent);
Notification notification = builder.build();
notification.flags = Notification.FLAG_AUTO_CANCEL;

NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
notificationManager.notify(2, notification);
```
![remoteviews-custom-notification]({{ basepath }}/assets/images/remoteviews-custom-notification.png)

我们只需要提供当前应用的包名和布局文件的资源id就可以创建一个`RemoteViews`。更新`RemoteViews`里面的View需要通过`RemoteViews`提供的一系列的方法来更新View。

### 1.2 RemoteViews在桌面小部件上的应用
`AppWidgetProvider`是Android中提供的用于实现桌面小部件的类，其本质是一个广播。

桌面小部件的开发步骤可以分为以下几步：
**1.定义小部件界面**
