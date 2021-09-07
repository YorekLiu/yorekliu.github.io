---
title: "Binder深入理解——以MediaService为例"
---

本博客Binder系列：

1. [Binder简介](/android/paid/zsxq/week11-binder/)
2. [Binder深入理解——以MediaService为例](/android/framework/binder1-mediaservice/)，基于[Android深入浅出之Binder机制](http://www.cnblogs.com/innost/archive/2011/01/09/1931456.html)
3. [Binder深入理解——罗老师系列](/android/framework/binder2/)，基于[Android进程间通信（IPC）机制Binder简要介绍和学习计划](https://blog.csdn.net/luoshengyang/article/details/6618363)

---

> 本节内容源于[参考文献1——Android深入浅出之Binder机制](http://www.cnblogs.com/innost/archive/2011/01/09/1931456.html)，代码版本为[2.3.6](http://androidxref.com/2.3.6/)，摘抄部分代码略有删减。

MediaService的`main`函数如下：  
**frameworks/base/media/mediaserver/main_mediaserver.cpp**

```c
int main(int argc, char** argv)
{
    // 获得一个ProcessState实例
    sp<ProcessState> proc(ProcessState::self());
    // 得到一个ServiceManager对象
    sp<IServiceManager> sm = defaultServiceManager();
    // 初始化MediaPlayerService服务等
    AudioFlinger::instantiate();
    MediaPlayerService::instantiate();
    CameraService::instantiate();
    AudioPolicyService::instantiate();
    // 启动Process的线程池?
    ProcessState::self()->startThreadPool();
    // 将自己加入到刚才的线程池?
    IPCThreadState::self()->joinThreadPool();
}
```

正式开始分析之前，我们先看看sp是个什么。  
sp是一个定义在RefBase.h文件中的模板类，意思是strong pointer，这么做是为了方便C/C++程序员管理指针的分配和释放。与之对应的还有一个wp，也就是weak pointer。该文件位于frameworks/base/include/utils/RefBase.h。  
可以简单地将sp<T>理解为T*。

## 1 ProcessState

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

## 2 defaultServiceManager

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

## 3 BpBinder

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

[→Java层ThreadLocal的工作原理](/android/framework/Android%E6%B6%88%E6%81%AF%E6%9C%BA%E5%88%B6/#21-threadlocal)

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

## 4 interface_cast

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

## 5 BpServiceManager

啥是Bp？？这里的p就是proxy的意思，Bp就是BinderProxy，BpServiceManager，就是ServiceManager的Binder代理。  
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

    // 见后续
    virtual status_t addService(const String16& name, const sp<IBinder>& service)
    {
        ...
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

## 6 MediaPlayerService

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

## 7 BpServiewManager#addService

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

## 8 BnServiceManager

`defaultServiceManager`返回的是一个`BpServiceManager`，通过它可以把命令请求发送到binder设备，而且handle的值为0。  
那么，系统的另外一端肯定有个接收命令的。虽然`BnServiceManager`接收到了命令，但是并没有完成它应该干的的工作。`service_manager.c`干了这份工作，我们看看它就好了。  

关于Service Manager更详细的内容，可以看2.2节。

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

// do_add_service是真正添加BnMediaService的函数
int do_add_service(struct binder_state *bs,
                   uint16_t *s, unsigned len,
                   void *ptr, unsigned uid)
{
    struct svcinfo *si;
    ...
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

    // struct svcinfo
    // {
    //     struct svcinfo *next;
    //     void *ptr;
    //     struct binder_death death;
    //     unsigned len;
    //     uint16_t name[0];
    // };
    // struct svcinfo *svclist = 0;
    //
    // svclist是一个链表，将si插入到链表的头部
    // 这样就保存了当前注册到ServiceManager中的信息
    svclist = si;

    binder_acquire(bs, ptr);
    binder_link_to_death(bs, ptr, &si->death);
    return 0;
}
```

在上面的过程中，我们已经看到了`MediaPlayerService`是如何注册到`ServiceManager`中的。

## 9 ServiceManager存在的意义

**Service Manager是一个守护进程，用来管理Server，并向Client提供查询Server接口的能力**。Android系统中Service信息都是先add到ServiceManager中，由ServiceManager来集中管理，这样就可以查询当前系统有哪些服务。而且，Android系统中某个服务例如MediaPlayerService的客户端想要和MediaPlayerService通讯的话，必须先向ServiceManager查询MediaPlayerService的信息，然后通过ServiceManager返回的东西再来和MediaPlayerService交互。

毕竟，要是MediaPlayerService身体不好，老是挂掉的话，客户的代码就麻烦了，就不知道后续新生的MediaPlayerService的信息了，所以只能这样：

- MediaPlayerService向ServiceManager注册
- MediaPlayerClient查询当前注册在ServiceManager中的MediaPlayerService的信息
- 根据这个信息，MediaPlayerClient和MediaPlayerService交互

另外，ServiceManager的handle标示是0，所以只要往handle是0的服务发送消息了，最终都会被传递到ServiceManager中去。

## 10 MediaService的运行

在上一节的分析中，我们知道了：`defaultServiceManager()`得到了一个`BpServiceManager`，然后在`MediaPlayerService::instantiate()`的过程中会进行`addService`的操作。  
然后service_manager会进行`binder_looper`，专门等着从binder中接收请求。虽然service_manager没有从`BnServiceManager`中派生，但是它肯定完成了`BnServiceManager`的功能。

同样，我们在上面已经看到了创建`MediaPlayerService`的过程，它继承至`BnMediaPlayerService`。那么，它也应该打开binder，然后进入loop状态。

在[ProcessState](#1-processstate)中，我们看到这里已经打开了binder。一个进程只需要打开binder一次就行了，接下来看看哪里有loop。

在`main_mediaserver.cpp`文件中还有最后的两行代码没有分析，我们接着往下面分析。  

首先看`ProcessState::self()->startThreadPool();`  
**frameworks/base/libs/binder/ProcessState.cpp**  

```c
void ProcessState::startThreadPool()
{
    AutoMutex _l(mLock);
    if (!mThreadPoolStarted) {
        mThreadPoolStarted = true;
        spawnPooledThread(true);
    }
}

void ProcessState::spawnPooledThread(bool isMain)
{
    if (mThreadPoolStarted) {
        int32_t s = android_atomic_add(1, &mThreadPoolSeq);
        char buf[32];
        sprintf(buf, "Binder Thread #%d", s);
        LOGV("Spawning new pooled thread, name=%s\n", buf);
        // 创建一个PoolThread，isMain为true，然后run起来
        sp<Thread> t = new PoolThread(isMain);
        t->run(buf);
    }
}
```

接着看一下`ThreadPool`和`Thread`的构造函数  

```c
// PoolThread继承至Thread
class PoolThread : public Thread
{
public:
    PoolThread(bool isMain)
    : mIsMain(isMain)
    {
    }

protected:
    ...
};


// frameworks/base/include/utils/threads.h
class Thread : virtual public RefBase
{
public:
    // Create a Thread object, but doesn't create or start the associated
    // thread. See the run() method.
                        Thread(bool canCallJava = true);
    ...

    // Start the thread in threadLoop() which needs to be implemented.
    virtual status_t    run(    const char* name = 0,
                                int32_t priority = PRIORITY_DEFAULT,
                                size_t stack = 0);
    ...
};

// frameworks/base/libs/utils/Threads.cpp
//
// canCallJava从声明来看默认是true
Thread::Thread(bool canCallJava)
    :   mCanCallJava(canCallJava),
        mThread(thread_id_t(-1)),
        mLock("Thread::mLock"),
        mStatus(NO_ERROR),
        mExitPending(false), mRunning(false)
{
}

// new PoolThread(isMain);  t->run(buf);
// 实际上调用的是基类也就是下面的run方法
// priority默认是PRIORITY_DEFAULT， stack默认为0
status_t Thread::run(const char* name, int32_t priority, size_t stack)
{
    Mutex::Autolock _l(mLock);

    if (mRunning) {
        // thread already started
        return INVALID_OPERATION;
    }

    // reset status and exitPending to their default value, so we can
    // try again after an error happened (either below, or in readyToRun())
    mStatus = NO_ERROR;
    mExitPending = false;
    mThread = thread_id_t(-1);

    // hold a strong reference on ourself
    mHoldSelf = this;

    mRunning = true;

    bool res;
    if (mCanCallJava) {
        // Create thread with lots of parameters
        // mCanCallJava默认是true，entryFunction是_threadLoop
        res = createThreadEtc(_threadLoop,
                this, name, priority, stack, &mThread);
    } else {
        res = androidCreateRawThreadEtc(_threadLoop,
                this, name, priority, stack, &mThread);
    }

    if (res == false) {
        mStatus = UNKNOWN_ERROR;   // something happened!
        mRunning = false;
        mThread = thread_id_t(-1);
        mHoldSelf.clear();  // "this" may have gone away after this.

        return UNKNOWN_ERROR;
    }

    // Do not refer to mStatus here: The thread is already running (may, in fact
    // already have exited with a valid mStatus result). The NO_ERROR indication
    // here merely indicates successfully starting the thread and does not
    // imply successful termination/execution.
    return NO_ERROR;
}
```

在`createThreadEtc(_threadLoop, this, name, priority, stack, &mThread)`函数中开始创建了线程，并在过程中会调用`_threadLoop`函数。  
我们看看`_threadLoop`里面干了啥：  

```c
int Thread::_threadLoop(void* user)
{
    Thread* const self = static_cast<Thread*>(user);
    sp<Thread> strong(self->mHoldSelf);
    wp<Thread> weak(strong);
    self->mHoldSelf.clear();

    // this is very useful for debugging with gdb
    self->mTid = gettid();

    bool first = true;

    do {
        bool result;
        if (first) {
            first = false;
            self->mStatus = self->readyToRun();
            result = (self->mStatus == NO_ERROR);

            if (result && !self->mExitPending) {
                // Binder threads (and maybe others) rely on threadLoop
                // running at least once after a successful ::readyToRun()
                // (unless, of course, the thread has already been asked to exit
                // at that point).
                // This is because threads are essentially used like this:
                //   (new ThreadSubclass())->run();
                // The caller therefore does not retain a strong reference to
                // the thread and the thread would simply disappear after the
                // successful ::readyToRun() call instead of entering the
                // threadLoop at least once.
                //
                // 调用自己的threadLoop
                result = self->threadLoop();
            }
        } else {
            // 调用自己的threadLoop
            result = self->threadLoop();
        }

        if (result == false || self->mExitPending) {
            self->mExitPending = true;
            self->mLock.lock();
            self->mRunning = false;
            self->mThreadExitedCondition.broadcast();
            self->mLock.unlock();
            break;
        }

        // Release our strong reference, to let a chance to the thread
        // to die a peaceful death.
        strong.clear();
        // And immediately, re-acquire a strong reference for the next loop
        strong = weak.promote();
    } while(strong != 0);

    return 0;
}

virtual bool threadLoop()
{
    // mIsMain为true。
    // 而且注意，这是一个新的线程，所以必然会创建一个
    // 新的IPCThreadState对象（TLS）
    IPCThreadState::self()->joinThreadPool(mIsMain);
    return false;
}
```

主线程和Binder工作线程都调用了`IPCThreadState::joinThreadPool();`方法，看看干了什么  

```c
// frameworks/base/include/binder/IPCThreadState.h
class IPCThreadState
{
public:
    static  IPCThreadState*     self();
    ...
    void                joinThreadPool(bool isMain = true);
}

// frameworks/base/include/binder/IPCThreadState.cpp
void IPCThreadState::joinThreadPool(bool isMain)
{
    mOut.writeInt32(isMain ? BC_ENTER_LOOPER : BC_REGISTER_LOOPER);
    ...
    status_t result;

    // 这个do-while循环就完成了loop的事情
    do {
        int32_t cmd;
        ...
        // now get the next command to be processed, waiting if necessary
        result = talkWithDriver();
        if (result >= NO_ERROR) {
            ...
            cmd = mIn.readInt32();
            result = executeCommand(cmd);
        }

        ...

        // Let this thread exit the thread pool if it is no longer
        // needed and it is not the main process thread.
        if(result == TIMED_OUT && !isMain) {
            break;
        }
    } while (result != -ECONNREFUSED && result != -EBADF);

    ...

    mOut.writeInt32(BC_EXIT_LOOPER);
    talkWithDriver(false);
}
```

在上面我们终于看到了loop的操作，接下来看一下里面的`executeCommand`函数干了什么：  

```c
status_t IPCThreadState::executeCommand(int32_t cmd)
{
    BBinder* obj;
    RefBase::weakref_type* refs;
    status_t result = NO_ERROR;

    switch (cmd) {
        ...
        case BR_TRANSACTION:
        {
            // 来了一个BR_TRANSACTION命令，解析成binder_transaction_data结构
            binder_transaction_data tr;
            result = mIn.read(&tr, sizeof(tr));
            LOG_ASSERT(result == NO_ERROR,
                        "Not enough command data for brTRANSACTION");
            if (result != NO_ERROR) break;

            Parcel buffer;
            buffer.ipcSetDataReference(
                                           reinterpret_cast<const uint8_t*>(tr.data.ptr.buffer),
                                           tr.data_size,
                                           reinterpret_cast<const size_t*>(tr.data.ptr.offsets),
                                           tr.offsets_size/sizeof(size_t), freeBuffer, this);
            ...
            Parcel reply;
            ...
            if (tr.target.ptr) {
                // 这里调用了BBinder的transact函数
                sp<BBinder> b((BBinder*)tr.cookie);
                const status_t error = b->transact(tr.code, buffer, &reply, 0);
                if (error < NO_ERROR) reply.setError(error);
            } else {
                const status_t error = the_context_object->transact(tr.code, buffer, &reply, 0);
                if (error < NO_ERROR) reply.setError(error);
            }

            //LOGI("<<<< TRANSACT from pid %d restore pid %d uid %d\n",
            //     mCallingPid, origPid, origUid);

            if ((tr.flags & TF_ONE_WAY) == 0) {
                LOG_ONEWAY("Sending reply to %d!", mCallingPid);
                sendReply(reply, 0);
            } else {
                LOG_ONEWAY("NOT sending reply to %d!", mCallingPid);
            }
            ...
        }
            break;
        ...
    }

    if (result != NO_ERROR) {
        mLastError = result;
    }

    return result;
}
```

在上面的代码中，发现了一个`BBinder`类，**实际上理解为`BnBinder`更好**。  
在创建`MediaPlayerService`时，其继承至`BnMediaPlayerService`；而`BnMediaPlayerService`的定义如下

```c
class BnMediaPlayerService: public BnInterface<IMediaPlayerService>
```

`BnInterface`是一个类模板：

```c
template<typename INTERFACE>
class BnInterface : public INTERFACE, public BBinder
{
public:
    virtual sp<IInterface>      queryLocalInterface(const String16& _descriptor);
    virtual const String16&     getInterfaceDescriptor() const;

protected:
    virtual IBinder*            onAsBinder();
};
```

`BBinder#transit`函数调用了自身的`onTransit`函数，也就是说最后还是调用了`BnMediaPlayerService::onTransact`：

```c
status_t BBinder::transact(
                            uint32_t code, const Parcel& data, Parcel* reply, uint32_t flags)
{
    data.setDataPosition(0);

    status_t err = NO_ERROR;
    switch (code) {
        case PING_TRANSACTION:
            reply->writeInt32(pingBinder());
            break;
        default:
            err = onTransact(code, data, reply, flags);
            break;
    }

    if (reply != NULL) {
        reply->setDataPosition(0);
    }

    return err;
}

status_t BnMediaPlayerService::onTransact(
    uint32_t code, const Parcel& data, Parcel* reply, uint32_t flags)
{
    // BnMediaPlayerService从BBinder和IMediaPlayerService派生
    // 所有IMediaPlayerService提供的函数都通过命令类型来区分
    switch(code) {
        case CREATE_URL: {
            CHECK_INTERFACE(IMediaPlayerService, data, reply);
            ...

            // create是一个由MediaPlayerService实现的虚函数
            sp<IMediaPlayer> player = create(
                    pid, client, url, numHeaders > 0 ? &headers : NULL);

            reply->writeStrongBinder(player->asBinder());
            return NO_ERROR;
        } break;
        ...
        default:
            return BBinder::onTransact(code, data, reply, flags);
    }
}
```

看到上面我们就知道了，其实`BnXxx::onTransact`函数接收命令，然后转发到派生类的函数`IXxx`，由他们完成实际的工作。

**说明**：这里有点特殊，`startThreadPool`和`joinThreadPool`完后确实有两个线程：主线程和工作线程，而且都在做消息循环。  
为什么要这么做呢？他们参数isMain都是true。不知道google搞什么。难道是怕一个线程工作量太多，所以搞两个线程来工作？这种解释应该也是合理的。  
网上有人测试过把最后一句屏蔽掉，也能正常工作。但是难道主线程提出了，程序还能不退出吗？这个...管它的，反正知道有两个线程在那处理就行了。

**此外，看看`MediaPlayerClient`如何与`MediaPlayerService`进行交互。**   
使用`MediaPlayerService`时，要先创建它的`BpMediaPlayerService`：  

**frameworks/base/media/libmedia/IMediaDeathNotifier.cpp**  
```c
// establish binder interface to MediaPlayerService
/*static*/const sp<IMediaPlayerService>&
IMediaDeathNotifier::getMediaPlayerService()
{
    LOGV("getMediaPlayerService");
    Mutex::Autolock _l(sServiceLock);
    if (sMediaPlayerService.get() == 0) {
        sp<IServiceManager> sm = defaultServiceManager();
        sp<IBinder> binder;
        do {
            // 向ServiceManager查询对应服务的信息，返回binder
            binder = sm->getService(String16("media.player"));
            if (binder != 0) {
                break;
             }
             LOGW("Media player service not published, waiting...");
             usleep(500000); // 0.5 s
        } while(true);

        if (sDeathNotifier == NULL) {
        sDeathNotifier = new DeathNotifier();
    }
    binder->linkToDeath(sDeathNotifier);
    // 通过interface_cast，将这个binder转化成BpMediaPlayerService
    // 注意，此处的binder只是用来和binder设备进行通讯
    // 实际上和IMediaPlayerService的功能一点关系都没有
    // BpMediaPlayerService用这个binder和BnMediaPlayerService通讯
    sMediaPlayerService = interface_cast<IMediaPlayerService>(binder);
    }
    LOGE_IF(sMediaPlayerService == 0, "no media player service!?");
    return sMediaPlayerService;
}
```

Binder其实就是一个和binder设备打交道的接口，而上层IMediaPlayerService只不过把它当做一个类似socket使用罢了。  

## 11 小结  

![ServiceManager的UML类图](/assets/images/android/binder_service_manager_uml.png)

整个MediaServer流程的简单描述如下图：

[![MediaServer流程的简单描述](/assets/images/android/binder_mediaserver_progress.png)](/assets/images/android/binder_mediaserver_progress.png)

- client调用service
  - client调用`defaultServiceManager->getService`获得一个binder，然后通过`interface_cast<IXxxService>(binder)`转换成对应的`BpXxxService`
  - 调用`BpXxxService#foo`函数，将需要的参数写入一个`Parcel`，然后调用`remote()->transact(FOO_CODE_TRANSACTION, data, &reply)`函数（可参考BpServiceManager中addService等方法的写法）
  - `remote()`其实就是一个`BpBinder`对象，其`transact`函数会调用`IPCThreadState::self()->transact`发送数据
- service回调client
  - 在`IPCThreadState#joinThreadPool`的loop过程中收到了client的请求，会调用`BBinder#transact`函数
  - 该函数会调用`BBinder#onTransact`虚拟函数，其实现部分由`BnXxxService`实现
  - 在`BnXxxService#onTransact`函数中会经过code判断是哪种命令，然后解析client数据，执行`foo`函数的实现部分，最后将结果写入reply中