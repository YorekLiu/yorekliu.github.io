---
title: "Binder简介"
---

## Question
话题：Binder  
1、什么是Binder？简单描述下它的工作过程和使用场景

## Answer

> 参考文献  
> [Android Bander设计与实现 - 设计篇](https://blog.csdn.net/universus/article/details/6211589)——Binder机制细节阐述，不涉及源码，力推  
> [sososeen09的Binder学习概要](https://www.jianshu.com/p/a50d3f2733d6)  
> [IPC机制——Binder](/android/framework/IPC%E6%9C%BA%E5%88%B6/#33-binder)  

### 1. 什么是Binder

直观来说，Binder是Android中的一个类，它实现了`IBinder`接口。  
从IPC角度来说，Binder是Android中的一种跨进程通信方式。Binder还可以理解为一种虚拟的物理设备，它的设备驱动是`/dev/binder`，该通信方式在Linux中没有；  
从Framework角度来说，Binder是ServiceManager连接各种Manager（ActivityManager、WindowManager等等）和相应的ManagerService的桥梁；  
从应用层来说，Binder是客户端和服务端进行通信的媒介，当`bindService`的时候，服务端会返回一个包含了服务端业务调用的Binder对象，通过这个Binder对象，客户端就可以获取服务端提供的服务或者数据，这里的服务包括普通服务和基于AIDL的服务。

### 2. Binder的工作过程

Binder机制由一些系统组件组成，分别是Client、Server、Service Manager和Binder驱动程序。Binder就是一种把这四个组件粘合在一起的粘结剂了，其中，核心组件便是Binder驱动程序，Service Manager提供了辅助管理的功能，Client和Server正是在Binder驱动和Service Manager提供的基础设施上，进行Client-Server之间的通信。Service Manager和Binder驱动已经在Android平台中实现好，开发者只要按照规范实现自己的Client和Server组件就可以了。

总结一下Binder机制中四个组件Client、Server、Service Manager和Binder驱动程序的关系：

![Binder机制中四个组件之间的关系](/assets/images/android/binder_overview.png)

1. Client、Server和Service Manager实现在用户空间中，Binder驱动程序实现在内核空间中
2. Binder驱动程序和Service Manager在Android平台中已经实现，开发者只需要在用户空间实现自己的Client和Server
3. Binder驱动程序提供设备文件`/dev/binder`与用户空间交互，Client、Server和Service Manager通过`open`和`ioctl`文件操作函数与Binder驱动程序进行通信
4. Client和Server之间的进程间通信通过Binder驱动程序间接实现
5. Service Manager是一个守护进程，用来管理Server，并向Client提供查询Server接口的能力

### 3. Binder的优点以及使用场景

优点：

1. **使用方便**：Linux支持的传统的IPC机制包括管道、System V IPC（即消息队列/共享内存/信号量）都不支持C/S通信方式，而基于这些底层机制架设一套协议来实现C/S通信，就增加了系统的复杂性，同时可靠性也得不到保证。Binder机制基于C/S架构，各种丰富多样的功能都由不同的Server负责管理，应用程序只需做为Client与这些Server建立连接便可以使用这些服务，花很少的时间和精力就能开发出令人眩目的功能。
2. **传输性能**：socket作为一款通用接口，其传输效率低，开销大，主要用在跨网络的进程间通信和本机上进程间的低速通信。消息队列和管道采用存储-转发方式，即数据先从发送方缓存区拷贝到内核开辟的缓存区中，然后再从内核缓存区拷贝到接收方缓存区，至少有两次拷贝过程。共享内存虽然无需拷贝，但控制复杂，难以使用。Binder机制同时使用进程虚拟地址空间和内核虚拟地址空间来映射同一个物理页面，这样，进程和内核之间就可以减少一次内存拷贝了，提到了进程间通信效率。  
   > 本文4.2节的源码分析中会遇到：  
   > 这里为什么会同时使用进程虚拟地址空间和内核虚拟地址空间来映射同一个物理页面呢？这就是Binder进程间通信机制的精髓所在了。**同一个物理页面，一方映射到进程虚拟地址空间，一方面映射到内核虚拟地址空间，这样，进程和内核之间就可以减少一次内存拷贝了，提到了进程间通信效率。**举个例子如，Client要将一块内存数据传递给Server，一般的做法是，Client将这块数据从它的进程空间拷贝到内核空间中，然后内核再将这个数据从内核空间拷贝到Server的进程空间，这样，Server就可以访问这个数据了。但是在这种方法中，执行了两次内存拷贝操作，而采用我们上面提到的方法，只需要把Client进程空间的数据拷贝一次到内核空间，然后Server与内核共享这个数据就可以了，整个过程只需要执行一次内存拷贝，提高了效率。

    | IPC方式 | 数据拷贝次数 |
    | --- | ---------- |
    | 共享内存 | 0 |
    | Binder | 1 |
    | Socket/管道/消息队列 | 2 |

3. **安全性**：传统IPC没有任何安全措施，完全依赖上层协议来确保。首先传统IPC的接收方无法获得对方进程可靠的UID/PID（用户ID/进程ID），从而无法鉴别对方身份。Android为每个安装好的应用程序分配了自己的UID，故进程的UID是鉴别进程身份的重要标志。使用传统IPC只能由用户在数据包里填入UID/PID，但这样不可靠，容易被恶意程序利用。可靠的身份标记只有由IPC机制本身在内核中添加。其次传统IPC访问接入点是开放的，无法建立私有通道。比如命名管道的名称，system V的键值，socket的ip地址或文件名都是开放的，只要知道这些接入点的程序都可以和对端建立连接，不管怎样都无法阻止恶意程序通过猜测接收方地址获得连接。

基于以上原因，Android需要建立一套新的IPC机制来满足系统对通信方式，传输性能和安全性的要求，这就是Binder。Binder基于Client-Server通信模式，传输过程只需一次拷贝，为发送发添加UID/PID身份，既支持实名Binder也支持匿名Binder，安全性高。

---

最常见的使用场景：

拿Activity的启动来说。我们先回忆一下[Activity的启动流程](/android/framework/%E5%9B%9B%E5%A4%A7%E7%BB%84%E4%BB%B6%E5%90%AF%E5%8A%A8%E8%BF%87%E7%A8%8B/#2-activity)。

Activity的启动需要用到ActivityManagerService，但是我们的App进程和ActivityManagerService所在的进程不是同一个进程，所以就需要用到进程间通讯了。在App进程中我们拿到的是ActivityManagerService的一个代理，也就是ActivityManagerProxy，这个ActivityManagerProxy与ActivityManagerService都实现了IActivityManager接口，因此它们具有相同的功能，但是ActivityManagerProxy只是做了一个中转，创建两个Parcel对象，一个用于携带请求的参数，一个用于拿到请求结果，然后调用transact方法，通过Binder驱动，ActivityManagerService的onTransact方法会被调用，然后根据相应的code，调用相应的方法，并把处理结果返回。

**在这个过程中，App进程就是Client，ActivityManagerService所在的进程是Service。**

但是Activity的启动过程还没有完，ActivityManagerService还会调用我们App所在进程的ApplicationThread来最终完成Activity的启动，其实ActivityManagerService拿到的也是ApplicationThread的一个代理ApplicationThreadProxy，通过这个代理，ApplicationThread相应的方法会被调用。

**在这个过程中，App进程是Server，ActivityManagerService所在的进程是Client。**

另外一个使用典型的使用场景就是AIDL了：[IPC机制——使用AIDL](/android/framework/IPC%E6%9C%BA%E5%88%B6/#44-aidl)

### 4. 加餐

想了解更多Binder的底层设计，可以查阅本博客Binder系列：

1. [Binder简介](/android/paid/zsxq/week11-binder/)
2. [Binder深入理解——以MediaService为例](/android/framework/binder1-mediaservice/)，基于[Android深入浅出之Binder机制](http://www.cnblogs.com/innost/archive/2011/01/09/1931456.html)
3. [Binder深入理解——罗老师系列](/android/framework/binder2/)，基于[Android进程间通信（IPC）机制Binder简要介绍和学习计划](https://blog.csdn.net/luoshengyang/article/details/6618363)