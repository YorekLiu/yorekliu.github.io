---
title: "Java常见概念"
---

## 1. 进程与线程

进程(process)和线程(thread)是两个不同的概念。进程一般指一个一个执行单元，是程序运行的实例，在移动设备上指一个应用；而线程是CPU调度和分派的最小单位。一个进程中可以有多个线程，两者是包含与被包含关系。  
**每一个Android应用程序都在它自己的进程中运行，都拥有一个独立的 Dalvik 虚拟机实例。而每一个 DVM 都是在Linux中的一个进程，所以说可以认为是同一个概念。**  
——<cite>[Android IPC简介](/android/framework/IPC机制/#1-android-ipc)</cite>

## 2. OOP三大基本特性

OOP三大基本特性

1. 封装：把客观事物进行封装成抽象类，该类的数据和方法只让可信的类操作，对不可信的类隐藏。
2. 继承：可以让某个类型的对象获得另一个类型的对象的属性的方法。
3. 多态：一个类实例的相同方法在不同情形有不同表现形式。多态机制使具有不同内部结构的对象可以共享相同的外部接口。这意味着，虽然针对不同对象的具体操作不同，但通过一个公共的类，它们（那些操作）可以通过相同的方式予以调用。

## 3. Java中4种引用类型

[《深入理解Java虚拟机(第二版)》3.2.3节 再谈引用](/jvm/java-gc/#323)

在JDK1.2之后，Java对引用的概念进行了扩充，将引用分为强引用(Strong Reference)、软引用(Soft Reference)、弱引用(Weak Reference)、虚引用(Phantom Reference)4种，这4种引用强度依次逐渐减弱。  

- 强引用就是指在程序代码之中普遍存在的，类似`Object obj = new Object()`这类的引用。**只要强引用还存在，垃圾收集器永远不会回收掉被引用的对象。** 如果想中断强引用关联着的对象，可以将引用赋值为null。

- 软引用是用来描述一些还有用但并非必需的对象。**对于软引用关联着的对象，在系统将要发生内存溢出异常之前，将会把这些对象列进回收范围之中进行第二次回收**。如果这次回收还没有足够的内存，才会抛出内存溢出异常。

- 弱引用也是用来描述非必须对象的，但是它的强度比软引用更弱一些，**被弱引用关联着的对象只能生存到下一次垃圾收集发生之前**。当垃圾收集器工作时，无论当前内存是否足够，都会回收掉只被弱引用关联的对象。

- 虚引用也成为幽灵引用或幻影引用，它是最弱的一种引用关系。**一个对象是否有虚引用的存在，完全不会对其生存时间构成影响，也无法通过虚引用来取得一个对象实例**。为一个对象设置虚引用关联的唯一目的就是能在这个对象被收集器回收时收到一个系统通知。  

要注意的是，虚引用必须和引用队列关联使用，当垃圾回收器准备回收一个对象前，如果发现它还有虚引用，就会把这个虚引用加入到与之关联的引用队列中。程序可以通过判断引用队列中是否已经加入了虚引用，来了解被引用的对象是否将要被垃圾回收。如果程序发现某个虚引用已经被加入到引用队列，那么就可以在所引用的对象的内存被回收之前采取必要的行动。  

> 关于引用队列`ReferenceQueue`的例子，可以参考[Glide v4 源码解析（三）——深入探究Glide缓存机制](/android/3rd-library/glide3/#4-activeresources)一文中关于ActiveResources的相关描述。

## 4. 关于错误

`Error`类和`Exception`类的父类都是`Throwable`类，它们区别如下：

- Error：一般指与虚拟机相关的问题，如系统崩溃，虚拟机错误，内存空间不足，方法调用栈溢等。对于这类错误导致的应用程序中断，仅靠程序本身无法恢复和和预防，遇到这样的错误，建议让程序终止
- Exception：表示程序可以处理的异常，可以捕获且可能恢复。遇到这类异常，应该尽可能处理异常，使程序恢复运行，而不应该随意终止异常

---

关于Unchecked Exception 与 Checked Exception：

**Unchecked Exception**

- 指的是不可被控制的异常，或称运行时异常，主要体现在程序的瑕疵或逻辑错误，并且在运行时无法恢复
- 包括`Error`与`RuntimeException`及其子类，如：`OutOfMemoryError`，`IllegalArgumentException`， `NullPointerException`，`IllegalStateException`，`IndexOutOfBoundsException`等
- 语法上不需要声明抛出异常也可以编译通过

**Checked Exception**

- 指的是可被控制的异常，或称非运行时异常，通常直接继承自Exception
- 除了Error和RuntimeException及其子类之外，如：`ClassNotFoundException`,`SQLException`, `IOException`等
- 需要try catch处理或throws声明抛出异常

## 5. xml解析方式

xml解析方式

- Dom解析：将XML文件的所有内容读取到内存中（内存的消耗比较大），然后允许您使用DOM API遍历XML树、检索所需的数据
- Sax解析：Sax是一个解析速度快并且占用内存少的xml解析器，Sax解析XML文件采用的是事件驱动，它并不需要解析完整个文档，而是按内容顺序解析文档的过程
- Pull解析：Pull解析器的运行方式与 Sax 解析器相似。它提供了类似的事件，可以使用一个switch对感兴趣的事件进行处理

Android framework 中 Pull 解析用的比较多。

## 6. 线程

**1、线程的状态**

线程的五种状态（新建、就绪、运行、阻塞、死亡）如下图所示：

![线程的五种状态](/assets/images/android/thread_status.png)   
<center>线程的五种状态</center>
---

**2、如何停止一个线程**：

1. 创建一个标识（flag），当线程完成你所需要的工作后，可以将标识设置为退出标识
2. 使用Thread的`stop()`方法，这种方法可以强行停止线程，不过已经过期了，因为其在停止的时候可能会导致数据的紊乱
3. 使用Thread的`interrupt()`方法和`interrupted()`方法，两者配合break退出循环，或者return来停止线程，有点类似标识（flag）
4. （推荐）当我们想要停止线程的时候，可以使用try-catch语句，在try语句中抛出`InterruptedException`异常，强行停止线程进入catch语句，这种方法可以将错误向上抛，使线程停止事件得以传播

---

**3、**`synchronized`**关键词**

Java多线程中的同步机制会对资源进行加锁，保证在同一时间只有一个线程可以操作对应资源，避免多程同时访问相同资源发生冲突。
`synchronized`是Java中的关键字，它是一种同步锁，可以实现同步机制。

`synchronized`可以修饰的对象为以下三种：

1. 修饰代码块  
   该代码块被称为同步代码块，作用的主要对象是调用这个代码块的对象，对象锁
2. 修饰普通方法  
   该方法称为同步方法，作用的主要对象是调用这个方法的对象，对象锁
3. 修饰静态方法  
   作用范围为整个静态方法，作用的主要对象为这个类的所有对象，类锁
4. 修饰类  
   作用范围为`synchronized`后面括号括起来的类，作用的主要对象为这个类的所有对象，类锁

---

**4、**`synchronized`**和Lock的区别**

相同点：Lock能完成synchronized所实现的所有功能 

不同点：

- synchronized是基于JVM的同步锁，JVM会帮我们自动释放锁。Lock是通过代码实现的，Lock要求我们手工释放，必须在finally语句中释放。
- Lock锁的范围有局限性、块范围。synchronized可以锁块、对象、类
- Lock功能比synchronized强大，可以通过`tryLock`方法在非阻塞线程的情况下拿到锁

---

**5、多线程的等待唤醒主要方法**

下面都是`Object`中的方法： 

- `void notify()`：唤醒在此对象监视器上等待的单个线程
- `void notifyAll()`：唤醒在此对象监视器上等待的所有线程
- `void wait()`：导致当前的线程等待，直到其他线程调用此对象的`notify()`方法或`notifyAll()`方法
- `void wait(long timeout)`：导致当前的线程等待，直到其他线程调用此对象的`notify()`方法或`notifyAll()`方法，或者等待指定的时间量
- `void wait(long timeout, int nanos)`：导致当前的线程等待，直到其他线程调用此对象的`notify()`方法或`notifyAll()`方法，或者其他某个线程中断当前线程，或者等待指定的时间量

---

**6、sleep和wait的区别**

- sleep是Thread类的方法；调用sleep()，在指定的时间里，暂停程序的执行，让出CPU给其他线程，当超过时间的限制后，又重新恢复到运行状态，在这个过程中，线程不会释放对象锁
- wait是Object类中的方法；调用wait()时，线程会释放对象锁，进入此对象的等待锁池中，只有此对象调用notify()时，线程进入运行状态

---

**7、死锁**

死锁：指两个或两个以上的线程在执行的过程中，因抢夺资源而造成互相等待，导致线程无法进行下去

产生死锁的4个必要条件

1. 循环等待：线程中必须有循环等待
2. 不可剥夺：线程已获得资源，再未使用完成之前，不可被剥夺抢占
3. 资源独占：线程在某一时间内独占资源
4. 申请保持：线程因申请资源而阻塞，对已获得的资源保持不放

---

**8、守护线程**

守护线程：指为其他线程的运行提供服务的线程，可通过`setDaemon(boolean on)`方法设置线程的Daemon模式，true为守护模式，false为用户模式

---

**9. NIO**

NIO：同步非阻塞，服务器实现模式是一个请求对应一个线程，即客户端的连接请求都会注册在多路复用器上，当多路复用器轮询到有I/O请求时才启动一个线程进行处理。其应用场景适用于连接数目多且连接短的架构，对线程并发有局限性

Java中的IO和NIO的区别

1. IO是面向流的，NIO是面向缓冲区的
2. IO的各种流是阻塞的，NIO是非阻塞模式

---

**10、**`volatile`**关键字**

用`volatile`修饰的变量，线程在每次修改变量的时候，都会读取变量修改后的值，可以简单的理解为`volatile`修饰的变量保存的是变量的地址。`volatile`变量具有`synchronized`的可见性，但是不具备原子性。

- 可见性：在多线程并发的条件下，对于变量的修改，其他线程中能获取到修改后的值
- 原子性：在多线程并发的条件下，对于变量的操作是线程安全的，不会受到其他线程的干扰

`volatile`不是线程安全的，要使`volatile`变量提供理想的线程安全，必须同时满足下面两个条件

1. 对变量的写操作不依赖于当前值
2. 该变量没有包含在具有其他变量的不变式中

比如自增操作（x++）看上去类似一个单独操作，实际上它是一个由[读取－修改－写入]操作序列组成的组合操作，必须以原子方式执行，而`volatile`不能提供必须的原子特性。实现正确的操作，应该使x的值在操作期间保持线程安全，而`volatile`变量无法实现这点

线程安全是指在多线程访问同一代码的时候，不会出现不确定的结果

然而，Java提供了`java.util.concurrent.atomic.*`包下的变量或引用，让变量或对象的操作具有原子性，在高并发的情况下，依然能保持获取到最新修改的值，常见的有`AtomicBoolean`、`AtomicReference`等

- `volatile`原理：对于值的操作，会立即更新到主存中，当其他线程获取最新值时会从主存中获取
- `atomic`原理：对于值的操作，是基于底层硬件处理器提供的原子指令，保证并发时线程的安全

最常见的`volatile`使用就是[单例模式——DCL模式](/design-pattern/singleton/#33-double-check-lockdcl)

---

**11、**`CountDownLatch`**与**`CountDownTimer`  

`CountDownLatch`是用来实现线程同步的一个工具。其主要有一下三个方法  
1. `public CountDownLatch(int count)`  
  初始化计数器
2.  `public void await() throws InterruptedException`  
  堵塞线程，直到计数器为0
3.  `public void countDown()`  
  计数，表示执行完成。没调用一次，计数器会减1

`CountDownTimer`是一种用来实现倒计时的手段，其用法如下:  

```java
timer = new CountDownTimer(count * 1000, 1000) {
    @Override
    public void onTick(long millisUntilFinished) {
        tvGetcode.setText(((millisUntilFinished / 1000) + "秒后重发"));
    }

    @Override
    public void onFinish() {
        tvGetcode.setEnabled(true);
        tvGetcode.setText("获取验证码");
    }
};
timer.start();
```

如上，创建之后调用`start`方法开始计数，每隔一段(第二个参数)就会调用`onTick`方法，在这里更新倒计时，最后会调用`onFinish`方法，这里进行倒计时完成的操作。  
当然`CountDownTimer`也是有`cancel`来取消倒计时的。

不过，在实践中发现这种倒计时方式`onTick`报时不太准，因为这依赖于底层的`Handler`来执行操作。

## 7. 锁

- Lock类也可以实现线程同步，而Lock获得锁需要执行`lock`方法，释放锁需要执行`unlock`方法
- Lock类可以创建`Condition`对象，`Condition`对象用来是线程等待和唤醒线程，需要注意的是`Condition`对象的唤醒的是用同一个`Condition`执行`await`方法的线程，所以也就可以实现唤醒指定类的线程
- Lock类分公平锁和不公平锁，公平锁是按照加锁顺序来的，非公平锁是不按顺序的，也就是说先执行lock方法的锁不一定先获得锁
- Lock类有读锁和写锁，读读共享，写写互斥，读写互斥
- 对于互斥锁，如果资源已经被占用，资源申请者只能进入睡眠状态。但是自旋锁不会引起调用者睡眠，如果自旋锁已经被别的执行单元保持，调用者就一直循环在那里看是否该自旋锁的保持者已经释放了锁，"自旋"一词就是因此而得名。

重入锁`ReentrantLock`是`Lock`接口的实现类，其使用示例如下：

```java
Lock lock = new ReentrantLock();
lock.lock();
try {
    ... // method
} finally {
    lock.unlock();
}
```

与`synchronized`配合`Object.wait`、`Object.notify(All)`类似，与`Lock`搭配的是`Condition`的`await`和`signal(All)`方法：

```java
condition = lock.newCondition();

lock.lock();
try {
    while (...) {
      condition.await();
    }
    condition.signalAll();
} finally {
    lock.unlock();
}
```

## 8. 阻塞队列

阻塞队列常用于生产者和消费者的场景，生产者是往队列里添加元素的线程，消费者是从队列里拿元 素的线程。阻塞队列就是生产者存放元素的容器，而消费者也只从容器里拿元素。

阻塞队列有两个常见的阻塞场景，它们分别是：

1. 当队列中没有数据的情况下，消费者端的所有线程都会被自动阻塞（挂起），直到有数据放入队列 
2. 当队列中填满数据的情况下，生产者端的所有线程都会被自动阻塞（挂起），直到队列中有空的位置，线程被自动唤醒。

支持以上两种阻塞场景的队列被称为阻塞队列。

`BlockingQueue<E>`的核心方法

- 放入数据
   - `offer(E e)`  
     表示如果可能的话，将e加到BlockingQueue里。即如果BlockingQueue可以容纳，则返回true，否则返回false。（本方法不阻塞当前执行方法的线程）
   - `offer(E o，long timeout，TimeUnit unit)`  
     可以设定等待的时间。如果在指定的时间内还不能往队列中加入BlockingQueue，则返回失败。
   - `put(E e)`  
     将e加到BlockingQueue里。如果BlockQueue没有空间，则调用此方法的线程被阻断，直到BlockingQueue里面有空间再继续。 
- 获取数据
   - `poll(long timeout，TimeUnit unit)`  
     从BlockingQueue中取出一个队首的对象。如果在指定时间内，队列一旦有数据可取，则立即返回队列中的数据；否则直到时间超时还没有数据可取，返回失败。
   - `take()`  
     取走BlockingQueue里排在首位的对象。若BlockingQueue为空，则阻断进入等待状态，直到BlockingQueue有新的数据被加入。
   - `drainTo(Collection<? super E> c, int maxElements)`  
     一次性从BlockingQueue获取所有可用的数据对象（还可以指定获取数据的个数）。通过该方法，可以提升获取数据的效率；无须多次分批加锁或释放锁。

在线程池中接触到的阻塞队列有两种：

- `LinkedBlockingQueue`：由链表结构组成的有界阻塞队列  
  它是基于链表的阻塞队列，同`ArrayListBlockingQueue`类似，此队列按照 **先进先出（FIFO）** 的原则对元素进行排序，其内部也维持着一个数据缓冲队列（该队列由一个链表构成）。当生产者往队列中放入一个数据时，队列会从生产者手中获取数据，并缓存在队列内部，而生产者立即返回；只有当队列缓冲区达到缓存容量的最大值时（`LinkedBlockingQueue`可以通过构造方法指定该值），才会阻塞生产者队列，直到消费者从队列中消费掉一份数据，生产者线程会被唤醒。反之，对于消费者这端的处理也基于同样的原理。而`LinkedBlockingQueue`之所以能够高效地处理并发数据，还因为其对于生产者端和消费者端分别采用了独立的锁来控制数据同步。这也意味着在高并发的情况下生产者和消费者可以并行地操作队列中的数据，以此来提高整个队列的并发性能。作为开发者，我们需要注意的是，如果构造一个`LinkedBlockingQueue`对象，而没有指定其容量大小，`LinkedBlockingQueue`会默认一个类似无限大小的容量 （`Integer.MAX_VALUE`）。这样一来，如果生产者的速度一旦大于消费者的速度，也许还没有等到队列满阻塞产生，系统内存就有可能已被消耗殆尽了。`ArrayBlockingQueue`和`LinkedBlockingQueue`是两个最普通也是最常用的阻塞队列。一般情况下，在处理多线程间的生产者-消费者问题时，使用这两个类足已。
- `SynchronousQueue`：不存储元素的阻塞队列  
  它是一个不存储元素的阻塞队列。每个插入操作必须等待另一个线程的移除操作，同样任何一个移除操作都等待另一个线程的插入操作。因此此队列内部其实没有任何一个元素，或者说容量是0，严格来说它并不是一种容器。由于队列没有容量，因此不能调用peek操作（返回队列的头元素）。

## 9. 反射

反射是指在运行状态中，对于任意一个类，都可以获得这个类的所有属性和方法，对于任意一个对象，都能够调用它的任意一个方法和属性。

反射使用步骤如下

1. 获取类的字节码（`getClass()`、`forName()`、`<类名>.class`）
2. 根据类的方法名或变量名，获取类的方法或变量
3. 执行类的方法或使用变量，如果不使用，也可以创建该类的实例对象（通过获取构造函数执行`newInstance`方法）

Android中有一个常用的例子，那就是反射修改`android.support.design.widget.BottomNavigationView`的`mShiftMode`属性。代码如下：

```java
@SuppressLint("RestrictedApi")
public static void disableShiftMode(BottomNavigationView view) {
    BottomNavigationMenuView menuView = (BottomNavigationMenuView) view.getChildAt(0);
    try {
        Field shiftingMode = menuView.getClass().getDeclaredField("mShiftingMode");
        shiftingMode.setAccessible(true);
        shiftingMode.setBoolean(menuView, false);
        shiftingMode.setAccessible(false);

        for (int i = 0; i < menuView.getChildCount(); i++) {
            BottomNavigationItemView item = (BottomNavigationItemView) menuView.getChildAt(i);
            item.setShiftingMode(false);
            // set once again checked value, so view will be updated
            item.setChecked(item.getItemData().isChecked());
        }
    } catch (NoSuchFieldException e) {
        Log.e("BNVHelper", "Unable to get shift mode field", e);
    } catch (IllegalAccessException e) {
        Log.e("BNVHelper", "Unable to change value of shift mode", e);
    }
}
```

在上面的代码中，第5行完成了反射步骤1、2，第6、7、8行完成了步骤3。

当然，现在androidx当道的年代，这种方式已经不适用了，androidx里面的`BottomNavigationView`可定制性更好，详情可以参考[Material库中的BNV](/android/other/Android底部导航栏框架/#3-materialbnv)

## 10. 进程相关

**Android中进程优先级**：

- 前台进程
- 可见进程
- 服务进程
- 缓存进程
- *空进程*（*）

在作者撰写该文章时，英文官网对于进程的重要性分类只有以上这四种，与中文官网的五种不同。英文官网中把中文官网里面的 **后台进程** 和 **空进程** 合并到了 **缓存进程** 中。  
疑是中文版本没有及时更新：[进程生命周期](https://developer.android.com/guide/components/processes-and-threads.html#Lifecycle)，注意查看时在最下面把语言调整为中文，英文语言时这段内容是不可见的。  
<cite>[进程保活——进程优先级](/android/paid/zsxq/week16-keep-app-alive/#11)</cite>

---

**[IPC机制](/android/framework/IPC%E6%9C%BA%E5%88%B6/)**

下表是常见IPC方式的优缺点以及使用场景

| 名称 | 优点 | 缺点 | 使用场景 |
| ----- | ------ | ------- | ------- |
| Bundle | 简单易用 | 只能传输Bundle支持的数据 | 四大组件之间的进程间通信 |
| 文件共享 | 简单易用 | 不适合高并发场景，且无法做到进程间的即时通信 | 无并发访问情况，交换简单的数据，实时性不高的场景 |
| AIDL | 功能强大，支持一对多并发通信，支持实时通信 | 使用稍复杂，需要处理好线程同步 | 一对多通信且有RPC需求 |
| Messenger | 功能一般，支持一对多串行通信，支持实时通信 | 不能很高的处理高并发情形，不支持RPC，数据通过Messenger进行传输，因此只能传输Bundle支持的数据类型 | 低并发的一对多即时通信，无RPC需求 |
| ContentProvider | 在数据源访问方面功能强大，支持一对多并发数据访问，可以通过Call方法扩展其他操作 | 可以理解为受约束的AIDL，主要提供对数据源CRUD操作 | 一对多的进程间的数据共享 |
| Socket | 功能强大，可以通过网络传输字节流，支持一对多并发实时通信 | 实现细节略嫌麻烦，不支持直接的RPC | 网络数据交换 |

## 11. ClassLoader

[Android中的ClassLoader](/android/paid/zsxq/week10-classloader/)

## 12. 易错题

1、静态代码块、构造代码块、构造方法的执行顺序

```java
class Parent {
    static {
        System.out.println("Parent static");
    }

    {
        System.out.println("Parent");
    }

    Parent() {
        System.out.println("Parent constructor");
    }
}

class Child extends Parent {
    static {
        System.out.println("Child static");
    }

    {
        System.out.println("Child");
    }

    Child() {
        System.out.println("Child constructor");
    }
}

public class CodeBlockTest {
    public static void main(String[] args) {
        Parent parent = new Child();
    }
}
```

输出结果：

```
Parent static
Child static
Parent
Parent constructor
Child
Child constructor
```
普通代码块的执行顺序一定先于构造器，不管两者的先后顺序。