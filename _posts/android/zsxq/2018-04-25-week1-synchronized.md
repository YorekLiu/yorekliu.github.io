---
title: "Week1-理解Java中synchronized关键词"
excerpt: "理解Java中的synchronized关键字"
categories:
  - Android
tags:
  - 知识星球
  - synchronized
  - 多线程
  - ReentrantLock
  - Lock
  - FairLock
  - NonfairLock
  - 读锁
  - 写锁
  - 自旋锁
  - 互斥锁
  - 重入锁
  - volatile
  - 阻塞队列
  - LinkedBlockingQueue
  - SynchronousQueue
toc: true
toc_label: "目录"
last_modified_at: 2018-04-25T16:38:00+08:00
---

## Question
理解Java中的synchronized关键字。  
指标：理解synchronized的含义、明确synchronized关键字修饰普通方法、静态方法和代码块时锁对象的差异。

有如下一个类A
```java
class A {
    public synchronized void a() {
    }

    public synchronized void b() {
    }
}
```

然后创建两个对象
```java
A a1 = new A();
A a2 = new A();
```

然后在两个线程中并发访问如下代码：
```java
Thread1                       Thread2
a1.a();                       a2.a();
```

请问二者能否构成线程同步？

如果A的定义是下面这种呢？
```java
class A {
    public static synchronized void a() {
    }

    public static synchronized void b() {
    }
}
```

## Answer
Java多线程中的同步机制会对资源进行加锁，保证在同一时间只有一个线程可以操作对应资源，避免多程同时访问相同资源发生冲突。  
Synchronized是Java中的关键字，它是一种同步锁，可以实现同步机制。

Synchronized主修修饰对象为以下三种：
1. 修饰普通方法  
  一个对象中的加锁方法只允许一个线程访问。但要注意这种情况下锁的是访问该方法的实例对象，如果多个线程不同对象访问该方法，则无法保证同步。
2. 修饰静态方法  
  由于静态方法是类方法，所以这种情况下锁的是包含这个方法的类，也就是类对象；这样如果多个线程不同对象访问该静态方法，也是可以保证同步的。
3. 修饰代码块  
  其中普通代码块：如Synchronized(obj)这里的obj可以为类中的一个属性、也可以是当前的对象，它的同步效果和修饰普通方法一样；  
  Synchronized方法修饰静态代码块它的同步效果和修饰静态方法类似。

Synchronized方法控制范围较大，它会同步对象中所有Synchronized方法的代码。

Synchronized代码块控制范围较小，它只会同步代码块中的代码，而位于代码块之外的代码是可以被多个线程访问的。

简单来说，就是Synchronized代码块更加灵活精确。

问题1 ：不能同步  
问题2 ：能同步  
{: .notice--success }

## 多线程编程

进程(process)和线程(thread)是两个不同的概念。进程一般指一个一个执行单元，是程序运行的实例，在移动设备上指一个应用；而线程是CPU调度和分派的最小单位。一个进程中可以有多个线程，两者是包含与被包含关系。  
**每一个Android应用程序都在它自己的进程中运行，都拥有一个独立的 Dalvik 虚拟机实例。而每一个 DVM 都是在Linux中的一个进程，所以说可以认为是同一个概念。**  
——<cite>[Android IPC简介](/android/IPC机制/#1-android-ipc简介)</cite>
{: .notice--info }

线程的五种状态（新建、就绪、运行、阻塞、死亡）如下图所示：

<figure style="width: 66%" class="align-center">
    <img src="/assets/images/android/thread_status.png">
    <figcaption>线程的五种状态</figcaption>
</figure>

### 锁

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

### synchronized、volatile

`synchronized`在上面已经说过了。

`volatile`见[单例模式-DCL模式](/design%20patterns/singleton/#33-double-check-lockdcl模式)

### 阻塞队列

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
  它是基于链表的阻塞队列，同`ArrayListBlockingQueue`类似，此队列按照**先进先出（FIFO）**的原则对元素进行排序，其内部也维持着一个数据缓冲队列（该队列由一个链表构成）。当生产者往队列中放入一个数据时，队列会从生产者手中获取数据，并缓存在队列内部，而生产者立即返回；只有当队列缓冲区达到缓存容量的最大值时（`LinkedBlockingQueue`可以通过构造方法指定该值），才会阻塞生产者队列，直到消费者从队列中消费掉一份数据，生产者线程会被唤醒。反之，对于消费者这端的处理也基于同样的原理。而`LinkedBlockingQueue`之所以能够高效地处理并发数据，还因为其对于生产者端和消费者端分别采用了独立的锁来控制数据同步。这也意味着在高并发的情况下生产者和消费者可以并行地操作队列中的数据，以此来提高整个队列的并发性能。作为开发者，我们需要注意的是，如果构造一个`LinkedBlockingQueue`对象，而没有指定其容量大小，`LinkedBlockingQueue`会默认一个类似无限大小的容量 （`Integer.MAX_VALUE`）。这样一来，如果生产者的速度一旦大于消费者的速度，也许还没有等到队列满阻塞产生，系统内存就有可能已被消耗殆尽了。`ArrayBlockingQueue`和`LinkedBlockingQueue`是两个最普通也是最常用的阻塞队列。一般情况下，在处理多线程间的生产者-消费者问题时，使用这两个类足已。
- `SynchronousQueue`：不存储元素的阻塞队列  
  它是一个不存储元素的阻塞队列。每个插入操作必须等待另一个线程的移除操作，同样任何一个移除操作都等待另一个线程的插入操作。因此此队列内部其实没有任何一个元素，或者说容量是0，严格来说它并不是一种容器。由于队列没有容量，因此不能调用peek操作（返回队列的头元素）。