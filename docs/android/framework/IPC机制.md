---
title: "IPC机制"
---

## 1 Android IPC简介
IPC全称为interprocess communication，中文为进程间通信，是指两个进程间进行数据交换的过程。

进程(process)和线程(thread)是两个不同的概念。进程一般指一个一个执行单元，是程序运行的实例，在移动设备上指一个应用；而线程是CPU调度和分派的最小单位。一个进程中可以有多个线程，两者是包含与被包含关系。

**每一个Android应用程序都在它自己的进程中运行，都拥有一个独立的 Dalvik 虚拟机实例。而每一个 DVM 都是在Linux中的一个进程，所以说可以认为是同一个概念。**

任何一个操作系统都有相应的IPC机制，Linux上面可以通过命名管道、共享内存、信号量等来进行IPC。而在Android中，最有特色的就是Binder，通过Binder可以轻松进行IPC操作。

## 2 Android中的多进程模式
在Android中我们可以通过指定四大组件的`android:process`属性来轻易的开启多进程，除此之外，没有其他办法达到目的。当然我们还可以通过JNI在native层去fork新的进程，但这不常规。

process名称可以通过":"来简写，这样开启的进程属于当前应用的私有进程，其他应用的组件不可以和它跑在同一个进程中；而进程名不以":"开头的进程属于全局进程，其他应用可以通过shareUID方式和它跑在同一进程中。

Android为每一个应用分配了一个唯一的UID，具有相同UID的应用才能共享数据。两个应用通过ShareUID跑在同一进程中是有要求的，需要两者有同样的ShareUID并且签名相同。**UID相同，不管是否在同一进程中，它们可以互相访问对方的私有数据，包括data目录、组件信息等——一个程序的两个进程。如果在同一进程中，它们还能共享内存数据——就相当于一个程序。**

由于每个进程都有独立的虚拟机，不同的虚拟机在内存上对应不同的地址空间。因此它们之间通过内存来共享数据都会共享失败。一般来说，使用多进程会导致以下问题：
- 静态成员和单例模式完全失效
- 线程同步机制完全失效
- SharedPreferences的可靠性下降
- Application会多次创建 (*统计app启动次数时，需要注意此坑。Application也能被第三方Push SDK唤起*)

## 3 IPC基础概念介绍
本节主要包含三个方面的内容：Serializable接口、Parcelable接口以及Binder。

### 3.1 Serializable接口
Serializable接口是Java提供的一个序列化接口，它是一个空接口，使用时只需要实现Serializable并声明一个serialVersionUID就可以，无需override任何方法。
```java
private static final long serialVersionUID = 32163781263816L;
```
可以将实现了Serializable接口的对象序列化到文件中或者从文件中反序列化，操作非常简单。
```java
// 序列化过程
User user = new User();
ObjectOutputStream oos = new ObjectOutputStream(new FileOutputStream("cache.txt"));
oos.writeObject(user);
oos.close();

// 反序列化过程
ObjectInputStream ins = new ObjectInputStream(new FileInputStream("cache.txt"));
User newUser = (user) ins.readObject();
ins.close();
```
实际上，甚至serialVersionUID常量都不是必须的，如果我们不声明这个常量，序列化会正常进行，但是会影响反序列化。

**serialVersionUID的作用**  
serialVersionUID是用来辅助序列化和反序列化过程的，只有序列化后的数据中的serialVersionUID和当前类的serialVersionUID相同时才能正常的反序列化。当两者不相同时，会报`InvalidClassException`错误。

因此我们应该指定serialVersionUID的值为一个常量，比如1L，这样当类的结构发生变化(比如增删某些成员变量)时，我们仍然能够最大化的避免反序列化的失败，能够最大限度的恢复数据。

如果类结构发生了非常规性变化，比如修改了类名，修改了成员变量的类型，此时尽管serialVersionUID验证通过了，但是反序列化还是会失败。

另外，默认的序列化过程是可以改变的，只需要重写`writeObject`和`readObject`即可。

### 3.2 Parcelable接口
Parcelable接口也是一种Android中的序列化接口，性能比Serializable要好，性能要高，但是需要实现额外的方法。

Parcelable主要用在内存序列化上，但是通过Parcelable可以将对象序列化到存储设备中或将对象序列化后通过网络传输也都是可以的，这是过程会稍显复杂，因此这种情况下建议使用Serializable。
实现`Parcelable`接口需要override`describeContents()`和`writeToParcel()`两个方法，以及一个`Parcelable.Creator<T>`的内部类。
```java
 public class MyParcelable implements Parcelable {
     private int mData;
     private Book book;

     public int describeContents() {
         return 0;
     }

     public void writeToParcel(Parcel out, int flags) {
         out.writeInt(mData);
         out.writeParcelable(book, 0);
     }

     public static final Parcelable.Creator<MyParcelable> CREATOR
             = new Parcelable.Creator<MyParcelable>() {
         public MyParcelable createFromParcel(Parcel in) {
             return new MyParcelable(in);
         }

         public MyParcelable[] newArray(int size) {
             return new MyParcelable[size];
         }
     };

     private MyParcelable(Parcel in) {
         mData = in.readInt();
         book = in.readParcelable(Thread.currentThread().getContextClassLoader());
     }
 }
```
`describeContents`方法一般返回0，仅当当前对象中存在文件描述符时，才返回1。另外，由于Book是一个Parcelable对象，因此反序列化过程需要传递当前线程的上下文加载器，否则会报无法找到类的错误。

`writeToParcel`，其中flags有两种值：0和1。当为1时，当前对象需要作为返回值返回，不能立即释放资源，几乎所有的情况都返回0。

> Android Studio可以下载 **Android Parcelable code generator** 插件辅助完成序列化接口的书写。  
> Kotlin语言在配置好之后可以通过`@Parcelize`注解直接生成辅助代码。  

### 3.3 Binder

???+ quote "Binder相较于其他IPC方式的优势"  
    [Binder简介](/android/paid/zsxq/week11-binder/)

直观来说，Binder是Android中的一个类，它实现了`IBinder`接口。  
从IPC角度来说，Binder是Android中的一种跨进程通信方式。Binder还可以理解为一种虚拟的物理设备，它的设备驱动是`/dev/binder`，该通信方式在Linux中没有；  
从Framework角度来说，Binder是ServiceManager连接各种Manager（ActivityManager、WindowManager等等）和相应的ManagerService的桥梁；  
从应用层来说，Binder是客户端和服务端进行通信的媒介，当`bindService`的时候，服务端会返回一个包含了服务端业务调用的Binder对象，通过这个Binder对象，客户端就可以获取服务端提供的服务或者数据，这里的服务包括普通服务和基于AIDL的服务。

Binder在Android应用开发中主要用于Service中，包括AIDL和Messenger。

关于AIDL，我们可以在菜单中选择创建一个aidl文件，文件会生成在
`demoandtest/app/src/main/aidl/yorek/demoandtest/aidl/IBookManager.aidl`
，也就是会在main下面新建一个aidl文件夹，与java文件夹同一层目录。
然后系统会自动为该文件生成对应的Java代码，Java代码生成在
`demoandtest/app/build/generated/source/aidl/debug/yorek/demoandtest/aidl/IBookManager.java`

```java
/*
 * This file is auto-generated.  DO NOT MODIFY.
 * Original file: /Users/yorek/Codes/AndroidStudioProjects/demoandtest/app/src/main/aidl/yorek/demoandtest/aidl/IBookManager.aidl
 */
package yorek.demoandtest.aidl;
// Declare any non-default types here with import statements

public interface IBookManager extends android.os.IInterface {
    /**
     * Local-side IPC implementation stub class.
     */
    public static abstract class Stub extends android.os.Binder implements yorek.demoandtest.aidl.IBookManager {
        private static final java.lang.String DESCRIPTOR = "yorek.demoandtest.aidl.IBookManager";

        /**
         * Construct the stub at attach it to the interface.
         */
        public Stub() {
            this.attachInterface(this, DESCRIPTOR);
        }

        /**
         * Cast an IBinder object into an yorek.demoandtest.aidl.IBookManager interface,
         * generating a proxy if needed.
         */
        public static yorek.demoandtest.aidl.IBookManager asInterface(android.os.IBinder obj) {
            if ((obj == null)) {
                return null;
            }
            android.os.IInterface iin = obj.queryLocalInterface(DESCRIPTOR);
            if (((iin != null) && (iin instanceof yorek.demoandtest.aidl.IBookManager))) {
                return ((yorek.demoandtest.aidl.IBookManager) iin);
            }
            return new yorek.demoandtest.aidl.IBookManager.Stub.Proxy(obj);
        }

        @Override
        public android.os.IBinder asBinder() {
            return this;
        }

        @Override
        public boolean onTransact(int code, android.os.Parcel data, android.os.Parcel reply, int flags) throws android.os.RemoteException {
            switch (code) {
                case INTERFACE_TRANSACTION: {
                    reply.writeString(DESCRIPTOR);
                    return true;
                }
                case TRANSACTION_basicTypes: {
                    data.enforceInterface(DESCRIPTOR);
                    int _arg0;
                    _arg0 = data.readInt();
                    long _arg1;
                    _arg1 = data.readLong();
                    boolean _arg2;
                    _arg2 = (0 != data.readInt());
                    float _arg3;
                    _arg3 = data.readFloat();
                    double _arg4;
                    _arg4 = data.readDouble();
                    java.lang.String _arg5;
                    _arg5 = data.readString();
                    this.basicTypes(_arg0, _arg1, _arg2, _arg3, _arg4, _arg5);
                    reply.writeNoException();
                    return true;
                }
            }
            return super.onTransact(code, data, reply, flags);
        }

        private static class Proxy implements yorek.demoandtest.aidl.IBookManager {
            private android.os.IBinder mRemote;

            Proxy(android.os.IBinder remote) {
                mRemote = remote;
            }

            @Override
            public android.os.IBinder asBinder() {
                return mRemote;
            }

            public java.lang.String getInterfaceDescriptor() {
                return DESCRIPTOR;
            }

            /**
             * Demonstrates some basic types that you can use as parameters
             * and return values in AIDL.
             */
            @Override
            public void basicTypes(int anInt, long aLong, boolean aBoolean, float aFloat, double aDouble, java.lang.String aString) throws android.os.RemoteException {
                android.os.Parcel _data = android.os.Parcel.obtain();
                android.os.Parcel _reply = android.os.Parcel.obtain();
                try {
                    _data.writeInterfaceToken(DESCRIPTOR);
                    _data.writeInt(anInt);
                    _data.writeLong(aLong);
                    _data.writeInt(((aBoolean) ? (1) : (0)));
                    _data.writeFloat(aFloat);
                    _data.writeDouble(aDouble);
                    _data.writeString(aString);
                    mRemote.transact(Stub.TRANSACTION_basicTypes, _data, _reply, 0);
                    _reply.readException();
                } finally {
                    _reply.recycle();
                    _data.recycle();
                }
            }
        }

        static final int TRANSACTION_basicTypes = (android.os.IBinder.FIRST_CALL_TRANSACTION + 0);
    }

    /**
     * Demonstrates some basic types that you can use as parameters
     * and return values in AIDL.
     */
    public void basicTypes(int anInt, long aLong, boolean aBoolean, float aFloat, double aDouble, java.lang.String aString) throws android.os.RemoteException;
}

```
我们可以看到AIDL生成的文件时一个继承至IInterface的接口，里面有一个公有内部类`Stub`，这个类就是一个Binder类。当客户端与服务端都位于同一个进程时，方法不会走跨进程的`transact`过程，而当不同进程时，会由`Stub`的内部代理类`Proxy`来调用`transact`过程。

下面介绍这两个类的每个方法的含义：

- Stub
    * DESCRIPTOR  
      Binder的唯一标识，一般用当前Binder的完整类名。
    * asInterface(android.os.IBinder obj)  
      用户将服务器的Binder对象转换成客户端所需要的AIDL接口类型的对象。这种转换是区分进程的，如果客户端和服务器端位于同一进程，那么返回的就是服务器端的Stub本身，否则是封装后的Stub.proxy代理对象。
    * asBinder  
      返回当前Binder对象
    * onTransact   
      该方法会由`Proxy`中对应的功能函数(如上面`basicTypes `)调用，`IBinder`接口的具体实现者`Binder`的`transact`方法会调用`onTransact`方法，并返回boolean结果。该方法运行在服务端中的`Binder`线程池中。  
      > 如果此方法返回false，那么客户端的请求会失败，因此我们可以利用这个特性来做权限验证。

- Proxy
    * basicTypes  
      该方法运行在客户端。内部实现：
        1. 创建方法所需的输入型Parcel对象_data、输出型Parcel对象_reply，如果有返回值还会创建返回值对象_result
        2. 先向_data中写入Binder的标识`DESCRIPTOR`，然后写入方法的参数
        3. 调用`transact`发起PRC(Remote Procedure Calls，远程过程调用)，同时挂起当前线程。
        4. 客户端的`onTransact`方法调用，PRC返回后，当前线程继续执行，从_reply中读取PRC返回结果，若有返回值，继续读取返回值
        5. 回收_data、_reply，如果有返回值，返回_result

需要注意两点：  

1. 客户端发起远程请求时，当前线程会被挂起直到服务端进程返回数据，因此如果远程方法是耗时的，不能在UI线程发起远程请求；  
2. 服务器端的Binder方法运行在Binder线程池中，所以Binder方法不管是否耗时都应该采用同步的方式实现，因为它已经运行在一个线程中了。  

![Binder工作机制](/assets/images/android/Binder工作机制.png)

Binder中还有很重要的两个方法`linkToDeath`以及`unlinkToDeath`。  
Binder运行在服务端进程中，如果服务端进程被杀死，那么客户端到服务端的Binder会断裂(称之为Binder死亡)，这会导致我们远程调用失败。  
为了解决这个问题，Binder提供了上述两个方法，通过`linkToDeath`我们可以给Binder设置一个死亡代理`DeathRecipient`。当Binder死亡时会回调`DeathRecipient`的`binderDied`方法，在里面我们可以移除之前的Binder代理并重新绑定远程服务：
```java
private IBinder.DeathRecipient mDeathRecipient = new IBinder.DeathRecipient() {
    @Override
    public void binderDied() {
        if (mBookManager == null)  return;
        mBookManager.asBinder().unlinkToDeath(mDeathRecipient, 0);
        mBookManager = null;
        // 接下来重新绑定远程Service
    }
}
```
在客户端绑定远程服务成功后，给binder设置死亡代理:
```java
binder.linkToDeath(mDeathRecipient, 0);
```
同时还有另一种方式重新连接Service，即在onServiceDisconnected中重连。  
这两种方法的区别在于`onServiceDisconnected`在客户端的UI线程执行，而`binderDied`在Binder线程池中回调，因此在`binderDied`方法中不能访问UI线程。  
另外通过Binder的`isBinderAlive()`方法也可以判断Binder是否死亡。


## 4 Android中的IPC方式
Android中可以实现IPC方式的有很多，比如通过Intent附加extras传递信息，通过共享文件传递数据，还可以采用Binder方式来进行IPC。另外，ContentProvider天生就是支持PIC的，通过网络通信也是可以的，因此还可以采用`Socket`。  
上面的方式都可以进行IPC，但是使用方法和侧重点还是有很大的区别的。

下表是常见IPC方式的优缺点以及使用场景

| 名称 | 优点 | 缺点 | 使用场景 |
| ----- | ------ | ------- | ------- |
| Bundle | 简单易用 | 只能传输Bundle支持的数据 | 四大组件之间的进程间通信 |
| 文件共享 | 简单易用 | 不适合高并发场景，且无法做到进程间的即时通信 | 无并发访问情况，交换简单的数据，实时性不高的场景 |
| AIDL | 功能强大，支持一对多并发通信，支持实时通信 | 使用稍复杂，需要处理好线程同步 | 一对多通信且有RPC需求 |
| Messenger | 功能一般，支持一对多串行通信，支持实时通信 | 不能很高的处理高并发情形，不支持RPC，数据通过Messenger进行传输，因此只能传输Bundle支持的数据类型 | 低并发的一对多即时通信，无RPC需求 |
| ContentProvider | 在数据源访问方面功能强大，支持一对多并发数据访问，可以通过Call方法扩展其他操作 | 可以理解为受约束的AIDL，主要提供对数据源CRUD操作 | 一对多的进程间的数据共享 |
| Socket | 功能强大，可以通过网络传输字节流，支持一对多并发实时通信 | 实现细节略嫌麻烦，不支持直接的RPC | 网络数据交换 |

### 4.1 使用Bundle
我们知道Intent的启动Activity、Service、Receiver都是通过构造`ComponentName`来实现的，我们可以使用`intent.setComponent(new ComponentName())`的方式来显示开启另一进程的组件，或者以隐式的方式开启。  
当然缺点是Bundle支持的数据类型有限。

### 4.2 使用文件共享
两个进程读写同一个文件来交换数据。在Window上，一个文件加了锁会导致其他进程无法访问该文件，但是在Linux上，对其进行并发读写是没有任何限制的，甚至可以并发写，尽管这很可能出问题。  
文件共享适合在数据同步不高的进程间进行通信，并且要妥善处理好读写问题。

SharedPreferences也属于文件的一种，但是系统会在内存中持有一份SharedPreferences文件的缓存，因此在多进程模式下，系统对其进行的读写就不可靠，面对高并发的读写访问，SharedPreferences有很大几率会丢失数据。

### 4.3 使用Messenger
Messenger其底层实现是AIDL，可以在不同进程间传递Message对象，但它一次只能处理一个请求，因此不需要在服务端考虑因并发执行而产生的线程同步问题。

实现一个客户端与服务端双向通信的Messenger需要以下两步。

**1.对于服务端来说**  
服务端需要一个处理事务的Handler，并通过它创建Messenger对象，然后在onBind中返回Messenger对象底层的Binder即可。  
若需要与客户端进行通信，可使用`msg.replyTo`方法获取客户端的Messenger对象，通过该对象发送Message，客户端即可接受到。

```java
public class MessengerService extends Service {
    public static final String TAG = "MessengerService";

    private static class MessengerHandler extends Handler {
        @Override
        public void handleMessage(Message msg) {
            if (msg.what == 0x0001) {
                Log.d(TAG, "handleMessage: receive msg from Client : code = 0x0001, data = " +
                        msg.getData().getString("msg"));

                Messenger client = msg.replyTo;
                Message replyMsg = Message.obtain(null, 0x0002);
                Bundle data = new Bundle();
                data.putString("reply", "this is server");
                replyMsg.setData(data);
                try {
                    client.send(replyMsg);
                } catch (RemoteException e) {
                    e.printStackTrace();
                }
            }

            super.handleMessage(msg);
        }
    }

    private final Messenger mMessenger = new Messenger(new MessengerHandler());

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return mMessenger.getBinder();
    }
}
```

**2.对客户端来说**  
客户端需要通过bind方式绑定服务端，并通过服务端返回的IBinder实例创建出Messenger对象，通过此对象发送Message可以和服务端进行通信。  
为了能够响应服务端的回复，需要像服务端那样创建一个Messenger对象，并在发送消息给服务端时将`msg.replyTo`指定为该实例。  

```java
public class MessengerActivity extends ActivityBase {
    public static final String TAG = "MessengerActivity";

    private Messenger mMessenger;
    private Messenger mReplyMessenger = new Messenger(new MessengerHandler());

    private static class MessengerHandler extends Handler {
        @Override
        public void handleMessage(Message msg) {
            if (msg.what == 0x0002) {
                Log.d(TAG, "handleMessage: receive msg from Server : code = 0x0002, data = " +
                        msg.getData().getString("reply"));
            }

            super.handleMessage(msg);
        }
    }
    private ServiceConnection mConnection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder service) {
            mMessenger = new Messenger(service);
            Message msg = Message.obtain(null, 0x0001);
            Bundle data = new Bundle();
            data.putString("msg", "this is client");
            msg.setData(data);
            msg.replyTo = mReplyMessenger;
            try {
                mMessenger.send(msg);
            } catch (RemoteException e) {
                e.printStackTrace();
            }
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {

        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_messenger);

        Intent intent = new Intent(this, MessengerService.class);
        bindService(intent, mConnection, Service.BIND_AUTO_CREATE);
    }

    @Override
    protected void onDestroy() {
        unbindService(mConnection);
        super.onDestroy();
    }
}

```

> D/MessengerService: handleMessage: receive msg from Client : code = 0x0001, data = this is client  
D/MessengerActivity: handleMessage: receive msg from Server : code = 0x0002, data = this is server

**为了能够与服务端进行通信，需要在客户端以服务端返回的Messenger底层的Binder对象来构造一个Messenger，这样两端的Messenger实例相当于是同一个。  
为了能够响应服务端，需要在客户端构建一个Messenger对象，并通过Message的relpyTo字段带到服务端，这样服务端可以通过这个Messenger来发送消息给客户端。**

### 4.4 使用AIDL

!!! info
    [Android Interface Definition Language (AIDL)](https://developer.android.com/guide/components/aidl)

创建一个使用AIDL的绑定状态的Service，有以下几步  

1. 创建.aidl文件  
该文件定义了具有方法签名的程序接口。
2. 实现接口  
Android SDK工具会基于.aidl文件自动生成一个Java实现的接口文件。接口有一个内部抽象类`Stub`，该类继承至Binder，实现了AIDL接口中的方法。我们必须在Service里面继承`Stub`类，然后实现这些方法。
3. 将接口暴露给客户端  
实现Service，重写`onBind`方法，返回`Stub`类的实例。

!!! warning
    **注意**: 在第一次release后，AIDL接口的任何修改都必须能够向后兼容，这样能够避免破坏其他使用该Service的应用程序。也就是说，因为.aidl文件必须复制至其他应用为了能够使用我们的Service的接口，我们必须维护好原始接口。

注意：**只有允许不同应用的客户端用IPC方式访问服务，并且想要在服务中处理多线程时，才有必要使用AIDL**。如果不需要执行跨越不同应用的并发IPC，就应该通过[bind service](https://developer.android.com/guide/components/bound-services.html#Binder)的方式创建接口；或者，如果您想执行IPC，但根本不需要处理多线程，则使用`Messenger`类来实现接口。无论如何，在实现AIDL之前，请您务必理解[绑定的服务](https://developer.android.com/guide/components/bound-services.html)。

???+ "AIDL默认是同步调用还是异步调用？怎么指定调用为异步调用？"
    **默认都是同步调用，可以使用**`oneway`**关键词指定远程调用为异步调用**。  
    在开始设计AIDL接口之前，请注意对AIDL接口的调用是直接函数调用。你不应该对发生调用的线程做出假设。情况会有所不同，具体取决于调用是来自本地进程中的线程还是来自远程进程。特别的：  
    1. 从本地进程进行的调用执行在进行调用的同一线程中。如果这是您的UI线程，则AIDL接口继续在UI线程中执行。如果它是另一个线程，那就是在Service的子线程中执行代码。因此，如果只有本地线程正在访问该服务，你可以完全控制在哪些线程中执行（但如果是这种情况，那么你根本不应该使用AIDL，而应该通过[bind service](https://developer.android.com/guide/components/bound-services.html#Binder)方式来创建接口）。  
    2. 来自远程进程的调用将从平台在自己的进程内维护的线程池中进行调度。你必须为来自未知线程的调用做好准备，此时可能同时发生多个调用。换句话说，AIDL接口的实现必须完全是线程安全的。从同一远程对象上的一个线程上进行的调用会按顺序到达接收端。  
    3. `oneway`关键字可以修改远程调用的行为。使用它时，远程调用不会阻塞；它只是发送事务数据并立即返回。接口的实现最终接受来自`Binder`线程池的常规调用，以普通的远程调用的方式。如果`oneway`用作本地调用，则没有影响，调用仍然是同步的。

#### 4.4.1 创建.aidl文件

默认情况下，AIDL支持下面数据类型

- Java中所有基本数据类型(比如`int`, `long`, `char`, `boolean`等等)
- `String`和`CharSequence`
- `List`  
`List`中所有的都必须能被AIDL支持。尽管方法使用的`List`接口，但另一方接收的实际具体类始终是`ArrayList`
- `Map`  
`Map`中所有的都必须能被AIDL支持。尽管方法使用的`Map`接口，但另一方接收的实际具体类始终是`HashMap`

必须import上面未列出的其他类型，即使它们与接口定义在同一个包中。  
如果AIDL文件中用到了自定义的Parcelable对象，那么必须新建一个和它同名的AIDL文件，并在其中声明它为Parcelable类型。比如：  
  ```java
  package com.yorek.demo.aidl;   
  parcelable Book;
  ```

定义服务接口时，要注意：

- 方法可以有0或多个参数，有返回值或无返回值
- 所有非基本数据类型都必须标上数据流向：`in`、`out`或者`inout`。基本数据类型默认都是`in`  
  > `in`表示数据只能由客户端流向服务端；表现为服务端将会接收到一个那个对象的完整数据，但是客户端的那个对象不会因为服务端对传参的修改而发生变动  
  > `out`表示数据只能由服务端流向客户端；表现为服务端将会接收到那个对象的的空对象，但是在服务端对接收到的空对象有任何修改之后客户端将会同步变动  
  > `inout`则表示数据可在服务端与客户端之间双向流通；表现为服务端将会接收到客户端传来对象的完整信息，并且客户端将会同步服务端对该对象的任何变动
- `.aidl`文件中所有注释都被包含在生成的`IBinder`接口中（import和package语句之前的注释除外）
- `String`和`int`常量可以定义在AIDL接口中。比如：`const int VERSION = 1;`
- 方法调用根据`transact()`方法的参数`code`来分发，此值一般基于方法在接口中的索引。因为这会使版本控制变得困难，所以我们可以手动将事务代码分配给方法：`void method() = 10;`
- 使用`@nullable`来注解可空的参数或返回值

以上6点是根据英文版翻译。  
官方中文版本为第1、2、3条加上第4条「只支持方法；您不能公开 AIDL 中的静态字段。」

#### 4.4.2 实现接口

我们需要在Service中创建`Stub`类，然后实现AIDL的接口方法，如下所示
```java
private final IRemoteService.Stub mBinder = new IRemoteService.Stub() {
    public int getPid(){
        return Process.myPid();
    }
    public void basicTypes(int anInt, long aLong, boolean aBoolean,
        float aFloat, double aDouble, String aString) {
        // Does nothing
    }
};
```

> 实现接口时，有以下几条规则需要注意：  
> 1. AIDL是在服务端的Binder线程池中执行的，因此多个客户端同时访问时，需要处理好线程同步问题并保证线程安全。  
> 2. 默认情况下，RPC是同步的。如果service处理请求可能耗时的话，不要在Activity的主线程调用，这可能会导致ANR。客户端请求应该总是在子线程调用。  
> 3. 抛出的异常不会发送给调用者。

#### 4.4.3 暴露接口给客户端

在`onBind`方法中将上面步骤的mBinder方法返回。  
客户端（比如Activity）在bindService成功时，客户端在`onServiceConnected`回调中接收IBinder实例，可以调用`YourServiceInterface.Stub.asInterface(service)`将IBinder实例转化成Service实例。比如
```java
IRemoteService mIRemoteService;
private ServiceConnection mConnection = new ServiceConnection() {
    // Called when the connection with the service is established
    public void onServiceConnected(ComponentName className, IBinder service) {
        // Following the example above for an AIDL interface,
        // this gets an instance of the IRemoteInterface, which we can use to call on the service
        mIRemoteService = IRemoteService.Stub.asInterface(service);
    }

    // Called when the connection with the service disconnects unexpectedly
    public void onServiceDisconnected(ComponentName className) {
        Log.e(TAG, "Service has unexpectedly disconnected");
        mIRemoteService = null;
    }
};
```

**AIDL权限验证的两种方式:**  
1. 在`onBind`中验证，验证失败返回null。这样客户端无法绑定服务。  
2. 在`Stub`中的`onTransact`方法中验证，验证失败返回false。这样服务端不会执行AIDL中的方法从而可以达到效果。  

#### 4.4.4 例子

下面举一个简单的例子，客户端向服务端传入一个字符串`$string`，服务端返回`hello $string`：

**ITestInterface.aidl**

```java
package yorek.demoandtest;

interface ITestInterface {
    String say(String string);
}
```

**TestService.kt**

```kotlin
class TestService : Service() {
    private val mTestImpl = object : ITestInterface.Stub() {
        override fun onTransact(code: Int, data: Parcel, reply: Parcel?, flags: Int): Boolean {
            // 检查权限，验证失败返回false
            return super.onTransact(code, data, reply, flags)
        }

        override fun say(string: String?): String {
            return "hello $string"
        }
    }

    override fun onBind(intent: Intent?): IBinder {
        // 检查权限，验证失败返回null
        return mTestImpl
    }
}
```

**AIDLActivity.kt**

```kotlin
class AIDLActivity : ActivityBase() {

    private val mConnection = object : ServiceConnection {
        override fun onServiceDisconnected(name: ComponentName?) {
            Log.e("AIDLActivity", "onServiceDisconnected: thread = ${Thread.currentThread().name} name = $name")
        }

        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            Log.e("AIDLActivity", "onServiceConnected: thread = ${Thread.currentThread().name} name = $name, service = $service")

            val testInterface = ITestInterface.Stub.asInterface(service)
            val reply = testInterface.say("world")
            Log.e("AIDLActivity", "reply = $reply")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_aidl)

        val intent = Intent(this, TestService::class.java)
        bindService(intent, mConnection, Context.BIND_AUTO_CREATE)
    }

    override fun onDestroy() {
        unbindService(mConnection)
        super.onDestroy()
    }
}
```

测试日志如下：

```text
E/AIDLActivity: onServiceConnected: thread = main name = ComponentInfo{yorek.demoandtest/yorek.demoandtest.ipc.aidl.TestService}, service = android.os.BinderProxy@279f8e8
E/AIDLActivity: reply = hello world
```

客户端与服务端双向通信的例子，可以查看[跨进程EventBus](/android/3rd-library/eventbus/#3-eventbus)的实现

### 4.5 使用ContentProvider
和Messenger一样，ContentProvider底层实现同样也是Binder，但是使用过程比AIDL要简单的多。ContentProvider的具体类型可以查看
另一篇文章[Android四大组件(4)](/android/framework/Android%E5%9B%9B%E5%A4%A7%E7%BB%84%E4%BB%B6(4)/)

### 4.6 使用Socket
在服务端的Service里面使用`ServerSocket`来接收客户端的请求。在客户端使用`Socket`发送请求。通过I/O流发送、接收信息。这主要是Java知识了，不多做介绍。

另外在UDP协议中，Socket对应的是`DatagramPackage`以及`DatagramSocket`。

## 5 Binder连接池
Binder连接池不是Binder线程池。Binder连接池的作用是将各个业务模块的Binder统一转发到Service中，这样可以避免Service的重复创建。  
随着AIDL数量的增加，Service的数量不能无限增加。

创建一个Binder连接池有以下三步  

1. 为Binder连接池新建IBinderPool.aidl
    ```java
    // IBinderPool.aidl
    package yorek.demoandtest.ipc.binderpool;
    
    interface IBinderPool {
        IBinder queryBinder(int binderCode);
    }
    ```

2. 为Binder连接池创建远程Service并实现IBinderPool(`IBinderPool.Stub`可以放到Binder连接池具体实现中，因此此处可以直接创建连接池中的Stub类)。  
    当Binder连接池连接上远程服务时，会根据不同的binderCode返回不同的Binder对象，通过这个BInder对象所执行的操作全部发生在远程Service中。
    ```java
    public class BinderPoolService extends Service {
        public static final String TAG = "BinderPoolService";
    
        private Binder mBinderPool = new BinderPool.BinderPoolImpl();
    
        @Override
        public IBinder onBind(Intent intent) {
            Log.d(TAG, "onBind: ");
            return mBinderPool;
        }
    }
    ```

3. 实现Binder连接池
    ```java
    public class BinderPool {
        public static final String TAG = "BinderPool";
    
        public static final int BINDER_NONE = -1;
        public static final int BINDER_JOB_ONE = 0;
        public static final int BINDER_JOB_TWO = 1;
    
        private Context mContext;
        private IBinderPool mBinderPool;
        private static volatile BinderPool sInstance;
        private CountDownLatch mCountDownLatch;
    
        private ServiceConnection mBinderPoolConnection = new ServiceConnection() {
            @Override
            public void onServiceConnected(ComponentName name, IBinder service) {
                mBinderPool = IBinderPool.Stub.asInterface(service);
                try {
                    mBinderPool.asBinder().linkToDeath(mBindPoolDeathRecipient, 0);
                } catch (RemoteException e) {
                    e.printStackTrace();
                }
    
                mCountDownLatch.countDown();
            }
    
            @Override
            public void onServiceDisconnected(ComponentName name) {}
        };
        private IBinder.DeathRecipient mBindPoolDeathRecipient = new IBinder.DeathRecipient() {
            @Override
            public void binderDied() {
                Log.w(TAG, "[binderDied] binder died.");
                mBinderPool.asBinder().unlinkToDeath(mBindPoolDeathRecipient, 0);
                mBinderPool = null;
    
                connectBinderPoolService();
            }
        };
    
        private BinderPool(Context context) {
            mContext = context.getApplicationContext();
            connectBinderPoolService();
        }
    
        public static BinderPool getInstance(Context context) {
            if (sInstance == null) {
                synchronized (BinderPool.class) {
                    if (sInstance == null) {
                        sInstance = new BinderPool(context);
                    }
                }
            }
    
            return sInstance;
        }
    
        private synchronized void connectBinderPoolService() {
            mCountDownLatch = new CountDownLatch(1);
            Intent service = new Intent(mContext, BinderPoolService.class);
            mContext.bindService(service, mBinderPoolConnection, Context.BIND_AUTO_CREATE);
    
            try {
                mCountDownLatch.await();
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        }
    
        public IBinder queryBinder(int binderCode) {
            IBinder binder = null;
            try {
                if (mBinderPool != null) {
                    binder = mBinderPool.queryBinder(binderCode);
                }
            } catch (RemoteException e) {
                e.printStackTrace();
            }
    
            return binder;
        }
    
        public static class BinderPoolImpl extends IBinderPool.Stub {
            @Override
            public IBinder queryBinder(int binderCode) throws RemoteException {
                IBinder binder = null;
    
                switch (binderCode) {
                    case BINDER_JOB_ONE:
                        // binder = new SecurityCenterImpl();
                        break;
    
                    case BINDER_JOB_TWO:
                        // binder = new ComputeImpl();
                        break;
    
                    default:
                }
    
                return binder;
            }
        }
    }
    ```

4. 具体使用:
    ```java
    private void doWork() {
            BinderPool binderPool = BinderPool.getInstance(this);
            IBinder jobOneBinder = binderPool.queryBinder(BinderPool.BINDER_JOB_ONE);
            //ISecurityCenter mSecurityCenterImpl =
            //        (ISecurityCenter) SecurityCenterImpl.asInterface(jobOneBinder);
        }
    ```
    在获取Binder连接池实例时，如果是第一次获取会执行`connectBinderPoolService`方法绑定到远程Service中，远程Service中运行着`BinderPool.Stub`实例。  
    注意，使用连接池时需要在额外的线程中使用，这是因为在Binder连接池中，我们通过`CountDownLatch`将`bindService`这一异步操作转换成了同步操作，这就意味着它可能是耗时的，加上 **Binder方法的调用过程也可能是耗时的** ，因此不建议放到主线程中。
