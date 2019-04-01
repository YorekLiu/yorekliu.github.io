---
title: "Week1-理解Java中synchronized关键词"
excerpt: "理解Java中的synchronized关键字"
categories:
  - Android
tags:
  - synchronized
  - 知识星球
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
   其中普通代码块 如Synchronized（obj） 这里的obj 可以为类中的一个属性、也可以是当前的对象，它的同步效果和修饰普通方法一样；Synchronized方法 （obj.class）静态代码块它的同步效果和修饰静态方法类似。

Synchronized方法控制范围较大，它会同步对象中所有Synchronized方法的代码。

Synchronized代码块控制范围较小，它只会同步代码块中的代码，而位于代码块之外的代码是可以被多个线程访问的。

简单来说 就是Synchronized代码块更加灵活精确。

问题1 ：不能同步  
问题2 ：能同步  
{: .notice--success }
