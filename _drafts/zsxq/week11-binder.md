---
title: "Week11-Binder"
categories:
  - Android
tags:
  - 知识星球
  - Binder
toc: true
toc_label: "目录"
---

## Question
话题：Binder  
1、什么是Binder？简单描述下它的工作过程和使用场景

## Answer

答案结合[sososeen09的Binder学习概要](https://www.jianshu.com/p/a50d3f2733d6)以及[IPC机制的3.3节](/android/IPC%E6%9C%BA%E5%88%B6/#33-binder)
{: .notice--info }

### 1. 什么是Binder

Binder机制是一种进程间通信机制，它由一系统组件组成，分别是Client、Server、Service Manager和Binder驱动程序。Binder就是一种把这四个组件粘合在一起的粘结剂了，其中，核心组件便是Binder驱动程序了，Service Manager提供了辅助管理的功能，Client和Server正是在Binder驱动和Service Manager提供的基础设施上，进行Client-Server之间的通信。Service Manager和Binder驱动已经在Android平台中实现好，开发者只要按照规范实现自己的Client和Server组件就可以了。

总结一下Binder机制中四个组件Client、Server、Service Manager和Binder驱动程序的关系：

<figure style="width: 66%" class="align-center">
    <img src="/assets/images/android/binder_overview.png">
    <figcaption>Binder机制中四个组件之间的关系</figcaption>
</figure>

1. Client、Server和Service Manager实现在用户空间中，Binder驱动程序实现在内核空间中
2. Binder驱动程序和Service Manager在Android平台中已经实现，开发者只需要在用户空间实现自己的Client和Server
3. Binder驱动程序提供设备文件/dev/binder与用户空间交互，Client、Server和Service Manager通过open和ioctl文件操作函数与Binder驱动程序进行通信
4. Client和Server之间的进程间通信通过Binder驱动程序间接实现
5. Service Manager是一个守护进程，用来管理Server，并向Client提供查询Server接口的能力

### 2. Binder的工作过程

#### 2.1 以MediaService为例，分析Binder机制  

*本节内容源于[参考文献1——Android深入浅出之Binder机制](http://www.cnblogs.com/innost/archive/2011/01/09/1931456.html)，代码版本为[2.3.6](http://androidxref.com/2.3.6/)，摘抄部分代码略有删减。*

MediaService的`main`函数如下：  
**frameworks/base/media/mediaserver/main_mediaserver.cpp**

```c
int main(int argc, char** argv)
{
    // 获得一个ProcessState实例
    sp<ProcessState> proc(ProcessState::self());
    // 得到一个ServiceManager对象
    sp<IServiceManager> sm = defaultServiceManager();
    // 初始化MediaPlayerService服务
    MediaPlayerService::instantiate();
    // 启动Process的线程池?
    ProcessState::self()->startThreadPool();
    // 将自己加入到刚才的线程池?
    IPCThreadState::self()->joinThreadPool();
}
```

正式开始分析之前，我们先看看sp是个什么。  
sp是一个定义在RefBase.h文件中的模板类，意思是strong pointer，这么做是为了方便C/C++程序员管理指针的分配和释放。与之对应的还有一个wp，也就是weak pointer。该文件位于frameworks/base/include/utils/RefBase.h。  
可以简单地将sp<T>理解为T*。

##### 2.1.1 ProcessState

第一个调用的函数是`ProcessState::self()`，然后赋值给了proc这个变量，由于sp的特性，程序执行完之后系统会自动释放proc指向的资源。

`ProcessState::self()`的相关代码如下：  
**frameworks/base/libs/binder/ProcessState.cpp**  

```c
// 创建一个ProcessState对象
sp<ProcessState> ProcessState::self()
{
    if (gProcess != NULL) return gProcess;

    AutoMutex _l(gProcessMutex);
    if (gProcess == NULL) gProcess = new ProcessState;
    return gProcess;
}

ProcessState::ProcessState()
: mDriverFD(open_driver()) // 创建ProcessState时调用了关键函数open_driver
, mVMStart(MAP_FAILED)     // 映射内存的起始地址
, mManagesContexts(false)
, mBinderContextCheckFunc(NULL)
, mBinderContextUserData(NULL)
, mThreadPoolStarted(false)
, mThreadPoolSeq(1)
{
    if (mDriverFD >= 0) {
        // mmap the binder, providing a chunk of virtual address space to receive transactions.
        // #define BINDER_VM_SIZE ((1*1024*1024) - (4096 *2)) 也就是1M-4*2K
        // mmap系统调用使得进程之间通过映射同一个普通文件实现共享内存。
        // 普通文件被映射到进程地址空间后，进程可以像访问普通内存一样对文件进行访问，不必再调用rw等操作
        mVMStart = mmap(0, BINDER_VM_SIZE, PROT_READ, MAP_PRIVATE | MAP_NORESERVE, mDriverFD, 0);
        if (mVMStart == MAP_FAILED) {
            // *sigh*
            LOGE("Using /dev/binder failed: unable to mmap transaction memory.\n");
            close(mDriverFD);
            mDriverFD = -1;
        }
    }
}

// open_driver就是打开/dev/binder设备
// 该设备就是在内核中一个专门用于完成进程间通讯而设置的一个虚拟的设备
// BTW，说白了就是内核的提供的一个机制，这个和我们用socket加NET_LINK方式和内核通讯是一个道理。
static int open_driver()
{
    if (gSingleProcess) {
        return -1;
    }

    int fd = open("/dev/binder", O_RDWR);
    if (fd >= 0) {
        fcntl(fd, F_SETFD, FD_CLOEXEC);
        // 检查binder的状态
        int vers;
        status_t result = ioctl(fd, BINDER_VERSION, &vers);

        if (result == -1) {
            LOGE("Binder ioctl to obtain version failed: %s", strerror(errno));
            close(fd);
            fd = -1;
        }
        if (result != 0 || vers != BINDER_CURRENT_PROTOCOL_VERSION) {
            LOGE("Binder driver protocol does not match user space protocol!");
            close(fd);
            fd = -1;
        }

        // 通过ioctl方式告诉内核，这个fd支持最大线程数是15个。
        size_t maxThreads = 15;
        result = ioctl(fd, BINDER_SET_MAX_THREADS, &maxThreads);
        if (result == -1) {
            LOGE("Binder ioctl to set max threads failed: %s", strerror(errno));
        }
    } else {
        LOGW("Opening '/dev/binder' failed: %s\n", strerror(errno));
    }
    return fd;
}
```

通过以上分析，我们可以看出`ProcessState::self()`实际上就是open binder，然后将得到的fd mmap到内存。

##### 2.1.2 defaultServiceManager

该方法的实现在IServiceManager.cpp中：  
**frameworks/base/include/binder/IServiceManager.cpp**

```c
sp<IServiceManager> defaultServiceManager()
{
    if (gDefaultServiceManager != NULL) return gDefaultServiceManager;

    {
        AutoMutex _l(gDefaultServiceManagerLock);
        if (gDefaultServiceManager == NULL) {
            gDefaultServiceManager = interface_cast<IServiceManager>(
                ProcessState::self()->getContextObject(NULL));
        }
    }

    return gDefaultServiceManager;
}
```

这也是一个单例模式的实现，我们注意到创建`IServiceManager`时的语句：  
`interface_cast<IServiceManager>(ProcessState::self()->getContextObject(NULL))`。  
`ProcessState::self()`就是上一步中创建的gProcess，然后调用了其`getContextObject(NULL)`方法。

我们跟踪一下调用过程：

```c
sp<IBinder> ProcessState::getContextObject(const sp<IBinder>& caller)
{
    if (supportsProcesses()) {
        // mDriverFD肯定是>=0的，所以满足条件
        return getStrongProxyForHandle(0);
    } else {
        return getContextObject(String16("default"), caller);
    }
}

bool ProcessState::supportsProcesses() const
{
    return mDriverFD >= 0;
}

// handle在MFC中接触过，中文名为句柄，是对资源的一种标示。此处传入的值为0
// handle可以理解为某个数据结构在其数组中的索引。
sp<IBinder> ProcessState::getStrongProxyForHandle(int32_t handle)
{
    sp<IBinder> result;

    AutoMutex _l(mLock);

    // lookupHandleLocked会在一个Vector中查找或插入handle
    // 当插入时，其binder和refs都置为NULL，见下面贴出来的函数代码
    // struct handle_entry {
    //     IBinder* binder;
    //     RefBase::weakref_type* refs;
    // };
    handle_entry* e = lookupHandleLocked(handle);

    if (e != NULL) {
        // We need to create a new BpBinder if there isn't currently one, OR we
        // are unable to acquire a weak reference on this current one.  See comment
        // in getWeakProxyForHandle() for more info about this.
        IBinder* b = e->binder;
        if (b == NULL || !e->refs->attemptIncWeak(this)) {
            // 由于handle值为0，所以N <= (size_t)handle肯定成立，因此b肯定为null
            // 这里创建了一个BpBinder对象
            b = new BpBinder(handle);
            e->binder = b;
            if (b) e->refs = b->getWeakRefs();
            result = b;
        } else {
            // This little bit of nastyness is to allow us to add a primary
            // reference to the remote proxy when this team doesn't have one
            // but another team is sending the handle to us.
            result.force_set(b);
            e->refs->decWeak(this);
        }
    }

    // 返回上面创建的BpBinder
    return result;
}

ProcessState::handle_entry* ProcessState::lookupHandleLocked(int32_t handle)
{
    const size_t N=mHandleToObject.size();
    if (N <= (size_t)handle) {
        // 在上面的分析中，由于handle值为0，所以N <= (size_t)handle肯定成立
        handle_entry e;
        e.binder = NULL;
        e.refs = NULL;
        status_t err = mHandleToObject.insertAt(e, N, handle+1-N);
        if (err < NO_ERROR) return NULL;
    }
    return &mHandleToObject.editItemAt(handle);
}
```

在上面的调用过程之后，我们发现`ProcessState::self()->getContextObject(NULL)`实际上就等价于`new BpBinder(0)`;  
于是，开始的代码就变成了`gDefaultServiceManager = interface_cast<IServiceManager>(new BpBinder(0))`。

那么BpBinder又是个什么呢？

##### 2.1.3 BpBinder

**frameworks/base/libs/binder/BpBinder.cpp**

```c
BpBinder::BpBinder(int32_t handle)    // 接上面分析，这里的handle值为0
: mHandle(handle)
, mAlive(1)
, mObitsSent(0)
, mObituaries(NULL)
{
    LOGV("Creating BpBinder %p handle %d\n", this, mHandle);

    extendObjectLifetime(OBJECT_LIFETIME_WEAK);
    IPCThreadState::self()->incWeakHandle(handle);
}
```

我们来到了IPCThreadState类。  
**frameworks/base/include/binder/IPCThreadState.cpp**

```c
static bool gHaveTLS = false;
IPCThreadState* IPCThreadState::self()
{
    // 初始值为false，所有先走if后面的代码，然后goto进来
    if (gHaveTLS) {
    restart:
        const pthread_key_t k = gTLS;
        // TLS是Thread Local Storage，Java中也有这个概念，对应ThreadLocal
        // 从线程本地存储空间中获得保存在其中的IPCThreadState对象
        // 这里是pthread_getspecific，那么肯定有对应的pthread_setspecific
        IPCThreadState* st = (IPCThreadState*)pthread_getspecific(k);
        if (st) return st;
        return new IPCThreadState;
    }

    if (gShutdown) return NULL;

    pthread_mutex_lock(&gTLSMutex);
    if (!gHaveTLS) {
        if (pthread_key_create(&gTLS, threadDestructor) != 0) {
            pthread_mutex_unlock(&gTLSMutex);
            return NULL;
        }
        gHaveTLS = true;
    }
    pthread_mutex_unlock(&gTLSMutex);
    goto restart;
}
```

[ThreadLocal的工作原理](/android/Android%E6%B6%88%E6%81%AF%E6%9C%BA%E5%88%B6/#21-threadlocal%E7%9A%84%E5%B7%A5%E4%BD%9C%E5%8E%9F%E7%90%86)
{: .notice--info }

我们找一下`pthread_setspecific`的地方，在构造函数中

```c
IPCThreadState::IPCThreadState()
: mProcess(ProcessState::self()), mMyThreadId(androidGetTid())
{
    pthread_setspecific(gTLS, this);
    clearCaller();
    // in、out理解为命令的buffer
    mIn.setDataCapacity(256);
    mOut.setDataCapacity(256);
}
```

由上可知，在new BpBinder的过程中创建了一个`IPCThreadState`。

我们回到defaultServiceManager的创建过程，接下来是`interface_cast`。

##### 2.1.4 interface_cast

`interface_cast`定义在IInterface.h文件中  

**frameworks/base/include/binder/IInterface.h**

```c
template<typename INTERFACE>
inline sp<INTERFACE> interface_cast(const sp<IBinder>& obj)
{
    return INTERFACE::asInterface(obj);
}
```

看来还是要看`IServiceManager::asInterface`的定义以及实现  

**frameworks/base/include/binder/IServiceManager.h**

```c
class IServiceManager : public IInterface
{
public:
    DECLARE_META_INTERFACE(ServiceManager);
    ...
};
```

上面这个`DECLARE_META_INTERFACE`是个好东西，与之对应的是宏`IMPLEMENT_META_INTERFACE`。  
这两个宏定义在IInterface.h文件中

**frameworks/base/include/binder/IInterface.h**

```c
#define DECLARE_META_INTERFACE(INTERFACE)                               \
    static const String16 descriptor;                                   \
    static sp<I##INTERFACE> asInterface(const sp<IBinder>& obj);        \
    virtual const String16& getInterfaceDescriptor() const;             \
    I##INTERFACE();                                                     \
    virtual ~I##INTERFACE();                                            \


#define IMPLEMENT_META_INTERFACE(INTERFACE, NAME)                       \
    const String16 I##INTERFACE::descriptor(NAME);                      \
    const String16& I##INTERFACE::getInterfaceDescriptor() const {      \
        return I##INTERFACE::descriptor;                                \
    }                                                                   \
    sp<I##INTERFACE> I##INTERFACE::asInterface(const sp<IBinder>& obj)  \
    {                                                                   \
        sp<I##INTERFACE> intr;                                          \
        if (obj != NULL) {                                              \
            intr = static_cast<I##INTERFACE*>(                          \
                obj->queryLocalInterface(                               \
                    I##INTERFACE::descriptor).get());               \
            if (intr == NULL) {                                         \
                intr = new Bp##INTERFACE(obj);                          \
            }                                                           \
        }                                                               \
        return intr;                                                    \
    }                                                                   \
    I##INTERFACE::I##INTERFACE() { }                                    \
    I##INTERFACE::~I##INTERFACE() { }                                   \
```

在上面的代码中，把INTERFACE换成ServiceManager理解就行了。这就是这两个宏为IServiceManager类声明、实现了一些变量和函数。

也就是说`IServiceManager::asInterface`等于下面这段代码：

```c
sp<IServiceManager> IServiceManager::asInterface(const sp<IBinder>& obj)
{
    sp<IServiceManager> intr;
    if (obj != NULL) {
        intr = static_cast<IServiceManager*>(
            obj->queryLocalInterface(
                IServiceManager::descriptor).get());
        if (intr == NULL) {
            intr = new BpServiceManager(obj);
        }
    }
    return intr;
}
```

所以`interface_cast<IServiceManager>(new BpBinder(0))`等于`new BpServiceManager(new BpBinder(0))`。  

这里又是一个Bp...

##### 2.1.5 BpServiceManager

啥是佩奇(Bp)？？这里的p就是proxy的意思，Bp就是BinderProxy，BpServiceManager，就是ServiceManager的Binder代理。  
BpServiceManager就在IServiceManager.cpp中  

```c
class BpServiceManager : public BpInterface<IServiceManager>
{
public:
    // 这个传入的impl就是BpBinder(0)
    BpServiceManager(const sp<IBinder>& impl)
    : BpInterface<IServiceManager>(impl)
    {
    }

    virtual status_t addService(const String16& name, const sp<IBinder>& service)
    {
        Parcel data, reply;
        data.writeInterfaceToken(IServiceManager::getInterfaceDescriptor());
        data.writeString16(name);
        data.writeStrongBinder(service);
        status_t err = remote()->transact(ADD_SERVICE_TRANSACTION, data, &reply);
        return err == NO_ERROR ? reply.readInt32() : err;
    }
};

IMPLEMENT_META_INTERFACE(ServiceManager, "android.os.IServiceManager");
```

接着看一下BpInterface<IServiceManager>(impl)干了什么。  

```c
template<typename INTERFACE>
inline BpInterface<INTERFACE>::BpInterface(const sp<IBinder>& remote)
: BpRefBase(remote)
{
}

BpRefBase::BpRefBase(const sp<IBinder>& o)
: mRemote(o.get()), mRefs(NULL), mState(0)
{
    extendObjectLifetime(OBJECT_LIFETIME_WEAK);
    // 这里的mRemote就是BpBinder(0)
    if (mRemote) {
        mRemote->incStrong(this);           // Removed on first IncStrong().
        mRefs = mRemote->createWeak(this);  // Held for our entire lifetime.
    }
}
```

因此，我们知道了创建`BpServiceManager`时的`BpBinder(0)`就存在其`mRemote`字段中。

重新回到`main`函数，现在我们打开了binder设备，并且创建了一个`BpServiceManager`对象。我们接下来看看`MediaPlayerService::instantiate();`操作。  

##### 2.1.6 MediaPlayerService

**frameworks/base/media/libmediaplayerservice/MediaPlayerService.cpp**  

```c
void MediaPlayerService::instantiate() {
    // 调用BpServiceManager的addService方法，
    // 传入服务的名字以及服务
    defaultServiceManager()->addService(
                                        String16("media.player"), new MediaPlayerService());
}

MediaPlayerService::MediaPlayerService()
{
    LOGV("MediaPlayerService created");
    mNextConnId = 1;
}
```

从头文件可以看出，`MediaPlayerService`是从`BnMediaPlayerService`派生出来的。  

```c
class MediaPlayerService : public BnMediaPlayerService
```

**Bn是Binder Native的意思，与Bp相对应。**  
到目前为止，我们已经构造出来了`BpServiceManager`和`BnMediaPlayerService`。但这俩不是对应的两端，因为Bp/Bn后面的名称不相同。

##### 2.1.7 BpServiewManager#addService

再回头看一下`BpServiewManager#addService`方法的实现。

```c
virtual status_t addService(const String16& name, const sp<IBinder>& service)
{
    // data是发送到BnServiceManager的命令包  
    // reply是收到的答复
    Parcel data, reply;
    // IServiceManager::getInterfaceDescriptor()就是包名:android.os.IServiceManager
    data.writeInterfaceToken(IServiceManager::getInterfaceDescriptor());
    // 写入Service的名字以及引用
    data.writeString16(name);
    data.writeStrongBinder(service);
    // 调用BpBinder的transact函数
    status_t err = remote()->transact(ADD_SERVICE_TRANSACTION, data, &reply);
    return err == NO_ERROR ? reply.readInt32() : err;
}
```

接着看`BpBinder#transact`函数  

```c
status_t BpBinder::transact(
                            uint32_t code, const Parcel& data, Parcel* reply, uint32_t flags)
{
    // Once a binder has died, it will never come back to life.
    if (mAlive) {
        // 调用了IPCThreadState的transact函数
        // mHandle=0, code=ADD_SERVICE_TRANSACTION, data、reply同上, flags默认为0
        status_t status = IPCThreadState::self()->transact(
                                                            mHandle, code, data, reply, flags);
        if (status == DEAD_OBJECT) mAlive = 0;
        return status;
    }

    return DEAD_OBJECT;
}
```

IPCThreadState在创建BpBinder的时候就创建了，再看看`IPCThreadState#transact`函数  

```c
status_t IPCThreadState::transact(int32_t handle,
                                    uint32_t code, const Parcel& data,
                                    Parcel* reply, uint32_t flags)
{
    status_t err = data.errorCheck();

    flags |= TF_ACCEPT_FDS;

    if (err == NO_ERROR) {
         // 调用writeTransactionData函数发送数据
        err = writeTransactionData(BC_TRANSACTION, flags, handle, code, data, NULL);
    }

    if (err != NO_ERROR) {
        if (reply) reply->setError(err);
        return (mLastError = err);
    }

    // TF_ONE_WAY = 0x01
    if ((flags & TF_ONE_WAY) == 0) {
        if (reply) {
            // 应该走这个
            err = waitForResponse(reply);
        } else {
            Parcel fakeReply;
            err = waitForResponse(&fakeReply);
        }
    } else {
        err = waitForResponse(NULL, NULL);
    }

    return err;
}

// 写数据到mOut中
status_t IPCThreadState::writeTransactionData(int32_t cmd, uint32_t binderFlags,
                                                int32_t handle, uint32_t code, const Parcel& data, status_t* statusBuffer)
{
    binder_transaction_data tr;

    tr.target.handle = handle;
    tr.code = code;
    tr.flags = binderFlags;

    const status_t err = data.errorCheck();
    if (err == NO_ERROR) {
        tr.data_size = data.ipcDataSize();
        tr.data.ptr.buffer = data.ipcData();
        tr.offsets_size = data.ipcObjectsCount()*sizeof(size_t);
        tr.data.ptr.offsets = data.ipcObjects();
    } else if (statusBuffer) {
        tr.flags |= TF_STATUS_CODE;
        *statusBuffer = err;
        tr.data_size = sizeof(status_t);
        tr.data.ptr.buffer = statusBuffer;
        tr.offsets_size = 0;
        tr.data.ptr.offsets = NULL;
    } else {
        return (mLastError = err);
    }

    // 上面把命令数据封装成binder_transaction_data，然后
    // 写到mOut中，mOut是命令的缓冲区，也是一个Parcel
    mOut.writeInt32(cmd);
    mOut.write(&tr, sizeof(tr));

    return NO_ERROR;
}

status_t IPCThreadState::waitForResponse(Parcel *reply, status_t *acquireResult)
{
    int32_t cmd;
    int32_t err;

    while (1) {
        // talkWithDriver，挺关键的
        if ((err=talkWithDriver()) < NO_ERROR) break;
        err = mIn.errorCheck();
        if (err < NO_ERROR) break;
        if (mIn.dataAvail() == 0) continue;

        // talkWithDriver中应该把mOut发出去，然后接受数据到mIn中
        cmd = mIn.readInt32();

        switch (cmd) {
            case BR_TRANSACTION_COMPLETE:
                if (!reply && !acquireResult) goto finish;
                break;
                ...
        }
    }

finish:
    ...

    return err;
}

status_t IPCThreadState::talkWithDriver(bool doReceive)
{
    binder_write_read bwr;

    // ...省略一堆判断
    status_t err;
    do {
        // ioctl来对binder进行读写
        if (ioctl(mProcess->mDriverFD, BINDER_WRITE_READ, &bwr) >= 0)
            err = NO_ERROR;
        else
            err = -errno;
    } while (err == -EINTR);

    if (err >= NO_ERROR) {
        if (bwr.write_consumed > 0) {
            if (bwr.write_consumed < (ssize_t)mOut.dataSize())
                mOut.remove(0, bwr.write_consumed);
            else
                mOut.setDataSize(0);
        }
        // 回复数据会写入mIn中
        if (bwr.read_consumed > 0) {
            mIn.setDataSize(bwr.read_consumed);
            mIn.setDataPosition(0);
        }
        return NO_ERROR;
    }

    return err;
}
```

至此，`BpServiceManager`发送`addService`消息，然后收到了回复。  

说道`BpServiceManager`，顺便先说说`BnServiceManager`。

##### 2.1.8 BnServiceManager

`defaultServiceManager`返回的是一个`BpServiceManager`，通过它可以把命令请求发送到binder设备，而且handle的值为0。  
那么，系统的另外一端肯定有个接收命令的。很可惜，`BnServiceManager`并不真实存在，但确实有一个组件完成了`BnServiceManager`的工作，那就是`service_manager.c`。  

**frameworks/base/cmds/servicemanager/service_manager.c**

```c
int main(int argc, char **argv)
{
    struct binder_state *bs;
    void *svcmgr = BINDER_SERVICE_MANAGER;
    // 打开binder设备
    bs = binder_open(128*1024);

    // 成为manager
    if (binder_become_context_manager(bs)) {
        LOGE("cannot become context manager (%s)\n", strerror(errno));
        return -1;
    }

    svcmgr_handle = svcmgr;
    // 不断循环，处理BpServiceManager发过来的命令
    binder_loop(bs, svcmgr_handler);
    return 0;
}
```

**frameworks/base/cmds/servicemanager/binder.c**

```c
struct binder_state *binder_open(unsigned mapsize)
{
    struct binder_state *bs;

    bs = malloc(sizeof(*bs));
    if (!bs) {
        errno = ENOMEM;
        return 0;
    }

    // 打开binder设备
    bs->fd = open("/dev/binder", O_RDWR);
    if (bs->fd < 0) {
        fprintf(stderr,"binder: cannot open device (%s)\n",
                strerror(errno));
        goto fail_open;
    }

    bs->mapsize = mapsize;
    bs->mapped = mmap(NULL, mapsize, PROT_READ, MAP_PRIVATE, bs->fd, 0);
    if (bs->mapped == MAP_FAILED) {
        fprintf(stderr,"binder: cannot map device (%s)\n",
                strerror(errno));
        goto fail_map;
    }

        /* TODO: check version */

    return bs;

fail_map:
    close(bs->fd);
fail_open:
    free(bs);
    return 0;
}
```

返回来看看`binder_become_context_manager`和`binder_loop`函数  

```c
int binder_become_context_manager(struct binder_state *bs)
{
    // 通过ioctl，使自己成为manager
    return ioctl(bs->fd, BINDER_SET_CONTEXT_MGR, 0);
}

void binder_loop(struct binder_state *bs, binder_handler func)
{
    int res;
    struct binder_write_read bwr;
    unsigned readbuf[32];

    bwr.write_size = 0;
    bwr.write_consumed = 0;
    bwr.write_buffer = 0;

    readbuf[0] = BC_ENTER_LOOPER;
    binder_write(bs, readbuf, sizeof(unsigned));

    for (;;) {
        // 循环读写binder
        bwr.read_size = sizeof(readbuf);
        bwr.read_consumed = 0;
        bwr.read_buffer = (unsigned) readbuf;

        res = ioctl(bs->fd, BINDER_WRITE_READ, &bwr);

        if (res < 0) {
            LOGE("binder_loop: ioctl failed (%s)\n", strerror(errno));
            break;
        }

        // 调用func解析收到的命令
        // func就是svcmgr_handler
        res = binder_parse(bs, 0, readbuf, bwr.read_consumed, func);
        if (res == 0) {
            LOGE("binder_loop: unexpected reply?!\n");
            break;
        }
        if (res < 0) {
            LOGE("binder_loop: io error %d %s\n", res, strerror(errno));
            break;
        }
    }
}

int svcmgr_handler(struct binder_state *bs,
                   struct binder_txn *txn,
                   struct binder_io *msg,
                   struct binder_io *reply)
{
    struct svcinfo *si;
    uint16_t *s;
    unsigned len;
    void *ptr;

    s = bio_get_string16(msg, &len);

    switch(txn->code) {
        ...
        case SVC_MGR_ADD_SERVICE:
            s = bio_get_string16(msg, &len);
            ptr = bio_get_ref(msg);
            // 此方法就是真正添加BnMediaService的函数
            if (do_add_service(bs, s, len, ptr, txn->sender_euid))
                return -1;
            break;
        ...
    }

    bio_put_uint32(reply, 0);
    return 0;
}

// TODO 
int do_add_service(struct binder_state *bs,
                   uint16_t *s, unsigned len,
                   void *ptr, unsigned uid)
{
    struct svcinfo *si;
    ...
    si = find_svc(s, len);
    if (si) {
        if (si->ptr) {
            LOGE("add_service('%s',%p) uid=%d - ALREADY REGISTERED\n",
                 str8(s), ptr, uid);
            return -1;
        }
        si->ptr = ptr;
    } else {
        si = malloc(sizeof(*si) + (len + 1) * sizeof(uint16_t));
        if (!si) {
            LOGE("add_service('%s',%p) uid=%d - OUT OF MEMORY\n",
                 str8(s), ptr, uid);
            return -1;
        }
        si->ptr = ptr;
        si->len = len;
        memcpy(si->name, s, (len + 1) * sizeof(uint16_t));
        si->name[len] = '\0';
        si->death.func = svcinfo_death;
        si->death.ptr = si;
        si->next = svclist;
        svclist = si;
    }
    
    binder_acquire(bs, ptr);
    binder_link_to_death(bs, ptr, &si->death);
    return 0;
}
```

#### 2.2 Service Manager是如何成为守护进程的  

本节着重介绍组件Service Manager，它是整个Binder机制的守护进程，用来管理开发者创建的各种Server，并且向Client提供查询Server远程接口的功能。

既然Service Manager组件是用来管理Server并且向Client提供查询Server远程接口的功能，那么，Service Manager就必然要和Server以及Client进行通信了。我们知道，Service Manger、Client和Server三者分别是运行在独立的进程当中，这样它们之间的通信也属于进程间通信了，而且也是采用Binder机制进行进程间通信，因此，Service Manager在充当Binder机制的守护进程的角色的同时，也在充当Server的角色，然而，它是一种特殊的Server，下面我们将会看到它的特殊之处。

### 3. Binder的使用场景

这里为什么会同时使用进程虚拟地址空间和内核虚拟地址空间来映射同一个物理页面呢？这就是Binder进程间通信机制的精髓所在了，同一个物理页面，一方映射到进程虚拟地址空间，一方面映射到内核虚拟地址空间，这样，进程和内核之间就可以减少一次内存拷贝了，提到了进程间通信效率。举个例子如，Client要将一块内存数据传递给Server，一般的做法是，Client将这块数据从它的进程空间拷贝到内核空间中，然后内核再将这个数据从内核空间拷贝到Server的进程空间，这样，Server就可以访问这个数据了。但是在这种方法中，执行了两次内存拷贝操作，而采用我们上面提到的方法，只需要把Client进程空间的数据拷贝一次到内核空间，然后Server与内核共享这个数据就可以了，整个过程只需要执行一次内存拷贝，提高了效率。

## 参考文献

1. [Android深入浅出之Binder机制](http://www.cnblogs.com/innost/archive/2011/01/09/1931456.html)——以MediaService为例，分析Binder的运作过程
2. [Android进程间通信（IPC）机制Binder简要介绍和学习计划](https://blog.csdn.net/luoshengyang/article/details/6618363)——**老罗的系列文章，强烈推荐**