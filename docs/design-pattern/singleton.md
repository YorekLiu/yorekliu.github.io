---
title: "单例模式(Singleton)"
---

## 1. 定义以及使用场景

- 确保某一个类只有一个实例，而且向整个系统提供这个实例
- 确保某个类有且仅有一个对象的场景，避免产生多个对象消耗过多的资源；或者某种类型的对象应该有且只有一个。

## 2. UML图

![单例模式UML图](/assets/images/design-pattern/singleton.png)  
<center>单例模式UML图</center>

实现单例模式的几个关键点：

1. 构造函数不对外开放，一般为private
2. 通过一个静态方法或者枚举返回单例类对象
3. 确保单例类的对象有且只有一个，尤其是在多线程环境下
4. 确保单例类对象在反序列化时不会重新构建对象

## 3. 单例模式的6种实现方式

有6种实现方式

- 饥汉模式
- 懒汉模式
- DCL模式 **(推荐)**
- 静态内部类模式 **(推荐)**
- 枚举模式
- 容器模式

### 3.1 饥汉模式

```java
pubilc class Singleton {
    private static final Singleton INSTANCE = new Singleton();

    pubilc static Singleton getInstance() {
        return INSTANCE;
    }

    private Singleton() {}
}
```

### 3.2 懒汉模式

```java
public class Singleton {
    private static Singleton sInstance;

    public static synchronized Singleton getInstance() {
        if (sInstance == null) {
            sInstance = new Singleton();
        }

        return sInstance;
    }

    private Singleton() {}
}
```

优点

- 只有需要时才会初始化，在一定程度上节约了资源

缺点

- 第一次加载时需要及时进行初始化，反应稍慢
- 且每次调用都会进行同步，造成不必要的同步开销。一般不建议使用

### 3.3 Double Check Lock(DCL)模式

```java
public class Singleton {
    private volatile static Singleton sInstance;

    public static Singleton getInstance() {
        if (sInstance == null) {
            synchronized (Singleton.class) {
                if (sInstance == null) {
                    sInstance = new Singleton();
                }
            }
        }

        return sInstance;
    }

    private Singleton() {}
}
```

> DCL有两个细节：`volatile`以及两次判断`if (sInstance == null)`。

优点

- DCL的优点就是资源利用率高，只有第一次执行`getInstance`才会初始化。

缺点

- 第一次加载时反应稍慢，也由于Java内存模型的原因会偶尔导致失效。但是将`sInstance`的定义加上`volatile`就能保证程序的正确性。

>`sInstance = new Singleton()`这句代码会编译成为多条汇编指令，大致有三件事
> 
>1. 给Singleton分配内存
>2. 调用`Singleton()`的构造方法，初始化成员字段
>3. 将`sInstance`对象指向分配的内存空间  
>
>由于Java编译器允许处理器乱序执行，以及JDK1.5之前的JMM(Java Memory Model)中Cache、寄存器到主内存回写循序的规定，上面第二条、第三条的顺序时无法保证的。也就是说，执行顺序可能是1-2-3，也可能是1-3-2。如果是后者，而且在3执行完毕、2未执行之前，被切换到线程B上，这时`sInstance`已经在线程A上执行过第三点了，`sInstance`已经非空，所以B直接取走了`sInstance`，再使用时就会出错。这就是 **DCL失效问题**。  
>在JDK1.5以后，可以增加`volatile`关键词，可以保证`sInstance`对象每次都从主内存中读取。

更多`volatile`，可以查阅[Java常见概念—线程——第10点volatile](/java/java-foundation/#6)

### 3.4 静态内部类模式

```java
public class Singleton {
    private Singleton() {}

    public static Singleton getInstance() {
        return SingletonHolder.SINGLETON;
    }

    private static class SingletonHolder {
        private static final Singleton SINGLETON = new Singleton();
    }
}
```

当第一次加载`Singleton`类时不会初始化`sInstance`，只有在第一次调用`Singleton#getInstance`方法时才会导致`sInstance`被初始化。因此，第一次调用`getInstance`方法会导致虚拟机加载`SingletonHolder`类，这种方式不仅能够保证线程安全，也能够保证单例对象的唯一性，同时也延迟了单例的实例化，这是推荐的单例实现方式。

### 3.5 枚举单例
```java
public enum Singleton {
    INSTANCE;

    public void doSomething() {
        // do something
    }
}
```
枚举单例写法简单，而且枚举实例的创建是线程安全的，而且在任何情况下都是它一个单例。  
在别的几种单例中，反序列化时会重新创建对象，除非我们自己重写`readResolve`方法。

```java
public final class Singleton implements Serializable {
    private Singleton() {}

    public static Singleton getInstance() {
        return SingletonHolder.SINGLETON;
    }

    private Object readResolve() throws ObjectStreamException {
        return SingletonHolder.SINGLETON;
    }

    private static class SingletonHolder {
        private static final Singleton SINGLETON = new Singleton();
    }
}
```
枚举单例不存在这种情况。

### 3.6 使用容器实现单例模式
```java
public class SingletonManager {
    private static Map<String, Object> sObjectMap = new HashMap<>();

    private SingletonManager() {}

    public static void registerService(String key, Object instance) {
        if (!sObjectMap.containsKey(key)) {
            sObjectMap.put(key, instance);
        }
    }

    public static Object getService(String key) {
        return sObjectMap.get(key);
    }
}
```
在程序的初始，将多种单例类注入到一个统一的管理类中，在使用时根据key获取对象对应类型的对象。这种方式使我们可以管理多种类型的单例，而且在使用时可以通过统一的接口进行获取操作，降低了用户的使用成本，也对用户隐藏了具体实现，降低了耦合度。

## 4. 源码中的例子

前面几种单例模式非常常见，这里说说第6种单例模式在Android Framework中的应用。  

`SystemServiceRegistry`类是用来管理所有能够被`Context#getSystemService`返回的系统服务的类。  
由于系统服务很多，初始化的时候就全部加载完就可以浪费了，所以这里根据Service的特点，有`CachedServiceFetcher`、`StaticServiceFetcher`、`StaticApplicationContextServiceFetcher`三种加载策略来实现懒加载以及值的保存。  
举`StaticServiceFetcher`来说，其内部又采用了懒汉单例模式来初始化Service。  

```java
/**
  * Override this class when the system service does not need a ContextImpl
  * and should be cached and retained process-wide.
  */
static abstract class StaticServiceFetcher<T> implements ServiceFetcher<T> {
    private T mCachedInstance;

    @Override
    public final T getService(ContextImpl ctx) {
        synchronized (StaticServiceFetcher.this) {
            if (mCachedInstance == null) {
                try {
                    mCachedInstance = createService();
                } catch (ServiceNotFoundException e) {
                    onServiceNotFound(e);
                }
            }
            return mCachedInstance;
        }
    }

    public abstract T createService() throws ServiceNotFoundException;
}
```

在`SystemServiceRegistry`初始化的时候，会将一系列系统服务的`serviceName`、`serviceClass`、`serviceFetcher`保存到HashMap中。

```java
// Service registry information.
// This information is never changed once static initialization has completed.
private static final HashMap<Class<?>, String> SYSTEM_SERVICE_NAMES =
        new HashMap<Class<?>, String>();
private static final HashMap<String, ServiceFetcher<?>> SYSTEM_SERVICE_FETCHERS =
        new HashMap<String, ServiceFetcher<?>>();

...

static {
    registerService(Context.ACCESSIBILITY_SERVICE, AccessibilityManager.class,
            new CachedServiceFetcher<AccessibilityManager>() {
        @Override
        public AccessibilityManager createService(ContextImpl ctx) {
            return AccessibilityManager.getInstance(ctx);
        }});

    registerService(Context.CAPTIONING_SERVICE, CaptioningManager.class,
            new CachedServiceFetcher<CaptioningManager>() {
        @Override
        public CaptioningManager createService(ContextImpl ctx) {
            return new CaptioningManager(ctx);
        }});
...
    registerService(Context.HDMI_CONTROL_SERVICE, HdmiControlManager.class,
                new StaticServiceFetcher<HdmiControlManager>() {
            @Override
            public HdmiControlManager createService() throws ServiceNotFoundException {
                IBinder b = ServiceManager.getServiceOrThrow(Context.HDMI_CONTROL_SERVICE);
                return new HdmiControlManager(IHdmiControlService.Stub.asInterface(b));
            }});
...
}

/**
 * Statically registers a system service with the context.
 * This method must be called during static initialization only.
 */
private static <T> void registerService(String serviceName, Class<T> serviceClass,
            ServiceFetcher<T> serviceFetcher) {
    SYSTEM_SERVICE_NAMES.put(serviceClass, serviceName);
    SYSTEM_SERVICE_FETCHERS.put(serviceName, serviceFetcher);
}
```

在需要获取Service时，会执行对应的`ServiceFetcher`来获取系统服务。

```java
/**
    * Gets a system service from a given context.
    */
public static Object getSystemService(ContextImpl ctx, String name) {
    ServiceFetcher<?> fetcher = SYSTEM_SERVICE_FETCHERS.get(name);
    return fetcher != null ? fetcher.getService(ctx) : null;
}
```