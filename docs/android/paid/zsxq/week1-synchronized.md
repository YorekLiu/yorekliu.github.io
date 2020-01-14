---
title: "理解Java中synchronized关键词"
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

关于`synchronized`关键词作用，可以参考[Java常见概念——线程——第3点](/java/java-foundation/#6)