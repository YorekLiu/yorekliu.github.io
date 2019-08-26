---
title: "Week1-理解Java中synchronized关键词"
excerpt: "理解Java中的synchronized关键字"
categories:
  - Android
tags:
  - 知识星球
  - synchronized
  - 多线程
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

问题1 ：不能同步  
问题2 ：能同步  
{: .notice--success }

关于`synchronized`关键词作用，可以参考[Java常见概念——线程——第3点](/java/java-foundation/#6-%E7%BA%BF%E7%A8%8B)