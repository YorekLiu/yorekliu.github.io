---
title: "Service"
---

本章的主要角色是[Service](https://developer.android.com/guide/components/services.html)。

Service是一种能够在后台执行长期运行操作的组件，它并没有UI界面。所有应用都可以开启一个Service，甚至当用户切换其他应用时，它也能继续在后台运行。另外，别的组件可以跟一个Service绑定，甚至可以执行IPC操作。比如，Service可以处理网络事务、播放音乐、处理文件I/O，或者与一个content provider交互，这一切都在后台运行。

> 注意：**Service运行在宿主进程的主线程中，所有生命周期方法也都在主线程中回调。Service并不会创建自己的线程**，在没有特别申明的情况下也不会运行在分离的进程中。如果你的Service打算执行消耗CPU的工作或者阻塞的操作，比如播放MP3或网络操作等，你应该在Service内创建新的线程。这能减少ANR的风险，主线程也能专心与处于UI事务。

## 1 Service的类型

有两种类型的Service：

1. **Started 启动状态**  
当一个应用组件调用了`startService`时，Service会处于启动状态。当Service启动后，它能够无期限的运行在后台，甚至开启该Service的组件已经销毁了。通常，处于启动状态的Service执行单一的操作，而且不返回操作结果给调用者。比如，从网络下载文件。当任务完成后，Service应该停止它本身。可以在Service内部调用`stopSelf()`或者其他组件调用`stopService()`来终止Service。

2. **Bound 绑定状态**  
当一个应用组件调用了`bindService`时，Service会处于绑定状态。处于绑定状态的Service提供了一个允许其他组件与该Service交互的C/S接口，这些交互可能是发送请求，接收数据，甚至执行IPC操作。只要其他应用组件绑定了他，它就会开始运行。多个组件能绑定到一个Service实例上，当它们都解绑时，此Service实例就会销毁。

> **启动状态与绑定状态不是互斥的。** 你能绑定一个以`startService()`启动的Service。比如，你可以通过`startService()`启动一个Service播放音乐。然后，用户可能想切歌或者获取当前歌曲的信息，此时Activity可以通过`bindService()`绑定到该Service。这种情况下，直到客户端全部解绑，`stopService()`或`stopSelf()`才能停止Service。  
> 
> **关于启动、绑定状态的Service如何停止？** 无论`startService`几次，只需要`stopService`或者`stopSelf`一次。调用多次`bindService`，必须调用多次`unbindService`。但同一组件bind多次，后面几次实际上是没有bind上的，所以只需要unbind一次。因此，只需要调用一次`stopService`或`stopSelf`方法让Service退出启动状态，然后调用多次`unbindService`方法退出绑定状态，对执行顺序没有要求。最后一个操作会导致`Service#onDestroy`方法执行。  
> 
> 举下面几个例子理清Service、ServiceConnection的生命周期方法：  
> 1. start、bind、stop、unbind  
>   [onCreate -> onStartCommand -> onStart] -> [onBind -> onServiceConnected] -> [] -> [onUnbind -> onDestroy]  
> 2. bind、start、stop、unbind  
>   [onCreate -> onBind -> onServiceConnected] -> [onStartCommand -> onStart] -> [] -> [onUnbind -> onDestroy]  
> 3. start、bind、unbind、stop  
>   [onCreate -> onStartCommand -> onStart] -> [onBind -> onServiceConnected] -> [onUnbind] -> [onDestroy]  
> 4. bind、start、unbind、stop  
>   [onCreate -> onBind -> onServiceConnected] -> [onStartCommand -> onStart] -> [onUnbind] -> [onDestroy]  
> 5. `Service.onBind`返回`null`的情况下bind、start、unbind、stop  
>   [onCreate -> onBind] -> [onStartCommand -> onStart] -> [onUnbind] -> [onDestroy]  
> 6. bind、start、bind、start、start、bind、stop、unbind、stop、unbind  
>   [onCreate -> onBind -> onServiceConnected] -> [onStartCommand -> onStart] -> [] -> [onStartCommand -> onStart] -> [onStartCommand -> onStart] -> [] -> [] -> [onUnbind -> onDestroy] -> [] -> [报错，已经unbind过了，不能再次unbind]  

## 2 Service的生命周期方法

Service主要有四个生命周期方法：`onCreate()`、`onStartCommand()`、`onBind()`、`onDestroy()`

- `onCreate()`  
  Service第一次创建时，系统会调用此方法进行一次性初始化设置。调用时间在`onStartCommand`和`onBind`之前。如果该Service已经处于运行状态，此方法不会调用。

- `onStartCommand()`  
  当其他组件(比如Activity)通过调用`startService`来请求Service启动时，系统会调用此方法。该方法执行时，Service将启动并可以无限期地在后台运行。如果实现了此功能，那么通过调用`stopSelf()`或`stopService()`来停止其工作是很有必要的。如果只想提供绑定功能，则不需要实现此方法。  
  `onStartCommand()`有三种返回值：
     - `START_NOT_STICKY`  
       如果系统在`onStartCommand()`方法返回之后杀死这个服务，那么直到接受到新的Intent对象，这个服务才会被重新创建。这是最安全的选项，用来避免在不需要的时候运行你的服务。
     - `START_STICKY`  
       如果系统在`onStartCommand()`返回后杀死了这个服务，系统就会重新创建这个服务并且调用`onStartCommand()`方法，但是它不会重新传递最后的Intent对象，系统会用一个null的Intent对象来调用`onStartCommand()`方法，在这个情况下，除非有一些被发送的Intent对象在等待启动服务。这适用于不执行命令的媒体播放器（或类似的服务），它只是无限期的运行着并等待工作的到来。
      - `START_REDELIVER_INTENT`  
       如果系统在`onStartCommand()`方法返回后，系统就会重新创建了这个服务，并且用发送给这个服务的最后的Intent对象调用了`onStartCommand()`方法。任意等待中的Intent对象会依次被发送。这适用于那些应该立即恢复正在执行的工作的服务，如下载文件。

- `onBind()`  
   当其他组件想要通过调用`bindService()`与Service绑定（例如执行RPC）时，系统会调用此方法。在实现此方法时，必须返回`IBinder`对象给客户端，使客户端可以与`Service`进行通信。这个方法是必须要实现的；如果不支持绑定，可以直接返回null，这样客户端的方法不会回调。同时，对于支持绑定的Service，可以在此方法中进行验证，如果验证失败，可以返回null，这样客户端绑定不上。  
   
!!! info
    `ServiceConnection`里面的方法会回调在主线程；  
    `onServiceConnected`方法在与Service的链接建立时回调，也就说Service的`onBind`方法返回了一个`IBinder`；  
    `onServiceDisconnected`方法会在与Service的链接被动断开时调用，但此时`ServiceConnection`并没有被移除，绑定关系仍然是active状态的，Service下次运行的时候会回调`onServiceConnected`方法。此外，客户端主动断开不会回调此方法。

- `onDestroy()`  
   当Service不在使用时，系统会调用此方法。可以在此进行资源的回收，比如线程、注册过的监听器、receiver等。

## 3 Service的生命周期

![Service的生命周期](/assets/images/android/service_lifecycle.png)

Service也有两个主要的生命周期循环：

- **完整的生命周期**：从`onCreate`调用开始，到`onDestroy`返回为止。  
  像Activity一样，Service可以做一些初始化设置在`onCreate`方法中，然后在`onDestroy`中释放所有剩余的资源。比如音乐播放Service，可以在`onCreate`中创建音乐播放线程，然后在`onDestroy`中停止线程。

- **活动的生命周期**：开始于对`onStartCommand()`或`onBind()`的调用。  
  如果服务启动，则活动生命周期将在完整生命周期结束的同时结束（即使在`onStartCommand()`返回后，该服务仍然处于活动状态）。如果服务被绑定，当`onUnbind()`返回时，活动生命周期结束。

对于已经处于active状态的Service，再次通过`startService`或`bindService`来启动同一个Service，其`onCreate`不会再次调用，而是直接调用对应的`onStartCommand()`或者`onBind()`方法。  

!!! warning
    同一组件多次start会触发`onStartCommand()`；多次bind只会触发一次`onBind()`，因此只算一次bind。

## 4 IntentService

IntentService是使用一个工作线程串行(one at a time)处理所有开始请求的Service的子类。如果你的Service不需要同时处理多个请求的话，这是最好的选择。仅仅需要实现`onHandleIntent()`方法来完成`onStartCommand()`接收到Intent后分发过来的请求。

IntentService有以下特点：

1. 它创建一个默认的工作线程，此工作线程用来处理Service接收到的Intent请求。
2. 工作线程由`HandlerThread` + 用来将Intent分发给`onHandleIntent()`方法的Handler实例组成。
3. 在所有的开始请求执行完成后，会自动调用`stopSelf()`方法，因此不需要自己手动调用。
4. 提供默认的会返回null的`onBind()`方法。
5. 提供`onStartCommand()`的默认实现，它将Intent发送到工作队列，然后转发到`onHandleIntent()`。

这就是实现一个IntentService所需要的：一个构造函数和一个`onHandleIntent()`的实现。 如果要覆盖其他回调方法，例如`onCreate()`，`onStartCommand()`或`onDestroy()`，要调用父类的实现，以便IntentService可以正确处理工作线程的生命周期。当Service需要提供绑定状态时，你需要重写`onBind()`方法。

关于IntentService的源码部分，可以查看另外一篇文章：[Android线程与线程池](/android/framework/Android%E7%BA%BF%E7%A8%8B%E4%B8%8E%E7%BA%BF%E7%A8%8B%E6%B1%A0/)
