---
title: "Week11-Binder"
categories:
  - Android
tags:
  - 知识星球
  - Binder
toc: true
toc_label: "目录"
toc_icon: "star"
---

## Question
话题：Binder  
1、什么是Binder？简单描述下它的工作过程和使用场景


## Answer

### 1. 什么是Binder？简单描述下它的工作过程和使用场景

答案结合[sososeen09的Binder学习概要](https://www.jianshu.com/p/a50d3f2733d6)以及[IPC机制的3.3节](/android/IPC%E6%9C%BA%E5%88%B6/#33-binder)
{: .notice--info }


------
https://blog.csdn.net/luoshengyang/article/details/6621566

这里为什么会同时使用进程虚拟地址空间和内核虚拟地址空间来映射同一个物理页面呢？这就是Binder进程间通信机制的精髓所在了，同一个物理页面，一方映射到进程虚拟地址空间，一方面映射到内核虚拟地址空间，这样，进程和内核之间就可以减少一次内存拷贝了，提到了进程间通信效率。举个例子如，Client要将一块内存数据传递给Server，一般的做法是，Client将这块数据从它的进程空间拷贝到内核空间中，然后内核再将这个数据从内核空间拷贝到Server的进程空间，这样，Server就可以访问这个数据了。但是在这种方法中，执行了两次内存拷贝操作，而采用我们上面提到的方法，只需要把Client进程空间的数据拷贝一次到内核空间，然后Server与内核共享这个数据就可以了，整个过程只需要执行一次内存拷贝，提高了效率。


作者：罗升阳
来源：CSDN
原文：https://blog.csdn.net/luoshengyang/article/details/6621566
版权声明：本文为博主原创文章，转载请附上博文链接！
