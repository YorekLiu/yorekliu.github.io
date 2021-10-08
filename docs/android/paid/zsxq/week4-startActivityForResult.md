---
title: "关于startActivityForResult"
---

## Question
话题：关于startActivityForResult  

1. startActivityForResult的使用场景是什么？onActivityResult回调里面的resultCode和requestCode含义是什么？  
2. Activity A启动B的时候，在B中何时该执行setResult ？setResult可以位于Activity的finish方法之后吗？  

## Answer

???+ question "1. startActivityForResult的使用场景是什么？onActivityResult回调里面的resultCode和requestCode含义是什么？"

1. 使用场景  
  `startActivityForResult`就是两个`Activity`间进行信息交流的一种手段。

2. resultCode、requestCode含义
    requestCode是为了解决多个请求的区分问题。  
    resultCode是请求结果码，告诉调用者成功/失败等消息。该信息被调用Activity写入，并经过AMS传递给源`Activity`

???+ question "2. Activity A启动B的时候，在B中何时该执行setResult？setResult可以位于Activity的finish方法之后吗？"

`setResult`在`finish`之前执行，该方法只是将数据记录在`Activity`的`mResultCode`和`mResultData`中。  
如果`setResult`在`finish`之后执行，那么消息无法传递给源`Activity`

`Activity#finish`时序图如下所示，
![Activity#finish时序图](/assets/images/android/activity_finish.png)

关键节点:  

1. `Client`端通过`AMP`把数据发送给`Server`端`AMS Binder`实体  
2. AMS把数据包装成`ActivityResult`并保存在源`ActivityRecord`的results变量中  
3. AMS通过`ApplicationThreadProxy`向Client端发送pause信息让栈顶`Activity`进入paused状态，并等待Client端回复或超时  
4. AMS接收Client端已paused信息，恢复下一个获取焦点的`Activity`，读取之前保存在`ActivityRecord.results`变量的数据派发给Client端对应的 Activity  
5. Client端数据经过`ApplicationThread`对象、`ActivityThread`对象的分发最后到达Activity


???+ question "存疑：startActivityForResult 和 singleTask 导致源 Activity 收不到正确结果问题"
    源`Activity`和目标`Activity`无法在跨Task情况下通过onActivityResult传递数据    
    Android5.0以上AMS在处理manifest.xml文件中的singleTask和singleInstance信息「不会」创建新的Task，因此可以收到正常回调 [7.0.0_r1](http://androidxref.com/7.0.0_r1/xref/frameworks/base/services/core/java/com/android/server/am/ActivityStarter.java#1196)  
    Android4.4.4以下AMS在处理manifest.xml文件中的singleTask和singleInstance信息「会」创建新的Task，因此在startActivity之后立即收到取消的回调 [4.4.4_r1](http://androidxref.com/4.4.4_r1/xref/frameworks/base/services/java/com/android/server/am/ActivityStackSupervisor.java#1399)  
    通过`dumpsys activity activities`命令查看AMS状态，验证两个Activity是否属于不同的Task