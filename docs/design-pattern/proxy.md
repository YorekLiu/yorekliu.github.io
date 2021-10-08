---
title: "代理模式(Proxy)"
---

## 1. 定义及使用场景
为其他对象提供一种代理以控制对这个对象的访问

使用场景：  
当无法或不想直接访问某个对象或访问某个对象存在困难时可以通过一个代理对象来间接访问，为了保证客户端使用的透明性，委托对象与代理对象需要实现相同的接口。

> 代理模式大致可以分为静态代理与动态代理两种。  
> Java提供了便捷的动态代理接口InvocationHandler，实现该接口需要重写其调用方法invoke。  
> 按照适用范围又可以分为四种：  
>  
> 1. **远程代理(Remote Proxy)**：为某个对象在不同的内存地址空间提供局部代理，使系统可以在Server部分的实现隐藏，以便Client可以不必考虑Server的存在。  
> 2. **虚拟代理(Virtual Proxy)**：使用一个代理对象表示一个十分耗资源的对象并在真正需要时才创建。  
>    比如打开一个很大的网页，该网页包含很多文字和图片，为了最快的打开网页，刚开始加载的只是文字，图片却一张一张地下载后才能看到。那些为打开的图片框，就是通过虚拟代理来替代了真实的图片，此时代理存储了真实图片的路径和尺寸。
> 3. **保护代理(Protection Proxy)**：用来控制真实对象访问时的权限。  
> 4. **智能引用(Smart Preference)**：当调用真实的对象时，代理处理另外一些事。

## 2. UML图

![代理模式UML图](/assets/images/design-pattern/proxy.png)  
<center>代理模式UML图</center>

- Subject  
  抽象主题类。主要职责是声明真实主题与代理的共同接口方法，该类既可以是一个抽象类也可以是一个接口。
- RealSubject  
  真实主题类。也称委托类或被代理类，该类定义了代理所表示的真实对象，由其执行具体的业务逻辑方法，而客户类则通过代理类间接地调用真实主题类中定义的方法
- ProxySubject  
  代理类，也称为委托类，该类持有一个对真实主题的引用，在其所实现的接口方法中待哦用真实主题类中对应的接口方法执行，以此起到代理的作用。
- Client  
  客户类，使用代理类的类型

## 3. 举个例子

```kotlin
interface ILawsuit {
    fun submit()

    fun burden()

    fun defend()

    fun finish()
}

class Alice : ILawsuit {
    override fun submit() = println("老板拖欠工资，特此申请仲裁")

    override fun burden() = println("这是合同和过去一年的银行工资流水")

    override fun defend() = println("证据确凿，不需要再说什么了")

    override fun finish() = println("诉讼成功")
}

class Lawyer(var lawsuit: ILawsuit) : ILawsuit {
    override fun submit() = lawsuit.submit()

    override fun burden() = lawsuit.burden()

    override fun defend() = lawsuit.defend()

    override fun finish() = lawsuit.finish()
}

fun main(args: Array<String>) {
    val alice: ILawsuit = Alice()

    val lawyer: ILawsuit = Lawyer(alice)

    with(lawyer) {
        submit()
        burden()
        defend()
        finish()
    }
}
```

输出结果如下
```text
老板拖欠工资，特此申请仲裁
这是合同和过去一年的银行工资流水
证据确凿，不需要再说什么了
诉讼成功
```

## 4. 源码中的例子

Android中最常见的代理模式就是`.aidl`文件生成的文件了。在下面的文件中，`Stub.asInterface`方法会根据调用端是同一进程，来决定是否返回`Proxy`对象：

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

更多相关知识可以参考[IPC机制——Binder](/android/framework/IPC机制/#33-binder)