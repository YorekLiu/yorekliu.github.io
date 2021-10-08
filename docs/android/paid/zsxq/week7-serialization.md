---
title: "关于序列化的知识"
---

## Question
话题：关于序列化的知识  
1、Parcelable和Serializable有什么用，它们有什么差别？  
2、自定义一个类让其实现Parcelable，大致流程是什么?  

## Answer

这部分的内容在[IPC机制](/android/framework/IPC机制/#3-ipc)中第三节[IPC基础概念介绍](/android/framework/IPC机制/#3-ipc)中有介绍

### Parcelable和Serializable有什么用，它们有什么差别？  
`Parcelable`与`Serializable`都可以实现序列化，使对象可以变为二进制流在内存中传输数据。在Android中，只要实现了两者其一的类就可以使用`Intent`和`Binder`来传递数据。实现了`Parcelable`接口的类依赖`Parcel`来实现数据的传递，它主要用于IPC机制的一个高性能传输。

**差别：**  

1. 来源上：  
    `Parcelable`是Android提供的序列化接口，只能用于Android平台，但是性能比`Serializable`好。  
    `Serializable`是Java提供的序列化接口，可以在任何使用Java语言的地方使用。

2. 使用上：  
    `Parcelable`的使用比较麻烦，序列化过程需要实现`Parcelable`的`writeToParcel`和`describeContents`方法；反序列化还要提供一个`CREATOR`的静态匿名内部类。Java代码推荐使用Android Studio上的`Android Parcelable code generator`插件来方便的实现`Parcelable`接口。Kotlin代码可以使用`kotlin-android-extension`中的`Parcelize`注解快速实现这些步骤。  
    `Serializable`的使用比较简单，只需要在注明实现`Serializable`接口即可，不需要额外实现任何方法。序列化机制依赖于一个long类型的`serialVersionUID`。如果没有显示指定该值，在序列化运行时会基于该类的结构自动计算一个值。如果类的结构发生变化就会导致自动计算的`serialVersionUID`不一致，这样很可能会导致反序列化过程失败。  
    如果显示的指定了`serialVersionUID`，只要类的结构不发生非常规性变化，如仅仅增删字段都能够反序列化成功。  
    
    > 如果需要把对象持久化到存储设备或者通过网络存储到其他设备，最好使用`Serializable`。

3. 效率上：  
    `Serializable`的序列化和反序列化都需要使用IO操作，而`Parcelable`不需要IO操作。因此`Parcelable`的效率更高于`Serializable`，在Android中更推荐使用`Parcelable`。

### 自定义一个类让其实现Parcelable，大致流程是什么?  

```java
public class PracticeBean implements Parcelable {
    private long id;
    private String name;
    private ParcelableBean parcelableBean;
    private SerializableBean serializableBean;

    public PracticeBean() { }

    protected PracticeBean(Parcel in) {
        this.id = in.readLong();
        this.name = in.readString();
        this.parcelableBean = in.readParcelable(ParcelableBean.class.getClassLoader());
        this.serializableBean = (SerializableBean) in.readSerializable();
    }

    @Override
    public int describeContents() {
        // 返回当前对象的内容描述符，如果含有FileDescriptor，则返回1，否则一律返回0
        // FileDescriptor的标记对应CONTENTS_FILE_DESCRIPTOR=0x0001
        return 0;
    }

    @Override
    public void writeToParcel(Parcel dest, int flags) {
        dest.writeLong(this.id);
        dest.writeString(this.name);
        dest.writeParcelable(this.parcelableBean, flags);
        dest.writeSerializable(this.serializableBean);
    }

    public static final Creator<PracticeBean> CREATOR = new Creator<PracticeBean>() {
        @Override
        public PracticeBean createFromParcel(Parcel source) {
            return new PracticeBean(source);
        }

        @Override
        public PracticeBean[] newArray(int size) {
            return new PracticeBean[size];
        }
    };
}
```
