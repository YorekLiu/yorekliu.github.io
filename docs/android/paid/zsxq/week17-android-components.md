---
title: "四大组件的作用以及多进程"
---

???+ question "Android四大组件中每个组件的作用是什么？它们都可以开启多进程吗？"

> Android四大组件分别是Activity、Service、BroadcastReceiver以及ContentProvider。除了BroadcastReceiver之外，其他三个组件都必须在AndroidManifest中进行注册。对于BroadcastReceiver来说，它既可以在AndroidManifest中进行注册，也可以在代码中进行注册。在调用方式上，Activity、Service和BroadcastReceiver需要借助Intent，而ContentProvider不需要借助Intent。 
> 
> Activity是一种展示组件，用户向用户直接展示一个界面，而且可以接受用户的输入信息从而进行交互。  
> Service是一种能够在后台执行长期运行操作的组件，它并没有UI界面。Service运行在宿主进程的主线程中，因此执行耗时的后台计算任务需要在单独的线程中去完成。  
> BroadcastReceiver是一种通讯组件，用于在不同组件甚至不同应用中传递消息。  
> ContentProvider是数据共享组件，用户向其他组件乃至其他应用共享数据。ContentProvider的CRUD操作需要处理好线程同步，因为这几个方法是在Binder线程池中调用的，另外ContentProvider组件不需要手动停止。  
> From [四大组件启动过程](/android/framework/四大组件启动过程/#1)

四大组件均可开启多线程，只需要在`AndroidManifest.xml`中配置`android:process=":remote"`即可。

> 在Android中我们可以通过指定四大组件的android:process属性来轻易的开启多进程，除此之外，没有其他办法达到目的。当然我们还可以通过JNI在native层去fork新的进程，但这不常规。  
> process名称可以通过”:”来简写，这样开启的进程属于当前应用的私有进程，其他应用的组件不可以和它跑在同一个进程中；而进程名不以”:”开头的进程属于全局进程，其他应用可以通过shareUID方式和它跑在同一进程中。  
> 
> From [Android中的多进程模式](/android/framework/IPC%E6%9C%BA%E5%88%B6/#2-android)

四大组件相关知识：

- [Activity](/android/framework/Android四大组件(1)/)
- [Service](/android/framework/Android四大组件(2)/)
- [Broadcasts](/android/framework/Android四大组件(3)/)
- [Content Providers](/android/framework/Android四大组件(4)/)