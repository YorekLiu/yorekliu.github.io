---
title: "面向对象的六大原则"
excerpt: "遵循面向对象的六大原则，是我们走向灵活软件之路所迈出的第一步"
categories:
  - Design Patterns
tags:
  - overview
  - Principle
  - Single Responsibility Principle
  - SRP
  - Open Close Principle
  - OCP
  - Liskov Substitution Principle
  - LSP
  - Dependence Inversion Principle
  - DIP
  - Interface Segregation Principle
  - ISP
  - Law of Demeter
  - LoD
  - Principle of Least Knowledge
toc: true
toc_label: "目录"
toc_icon: "heart"
last_modified_at: 2018-06-12T12:49:19+08:00
---

## 1. 单一职责原则
单一职责原则(Single Responsibility Principle, SRP)：每个模块或类都应该对软件提供的功能的一部分负责，而这个责任应该完全由类来封装。它的所有服务都应严格遵守这一职责。  
> 一个类应该只有一个发生变化的原因。<cite>Robert C. Martin</cite>

## 2. 开闭原则
开闭原则(Open Close Principle, OCP)：软件中的对象(类、模块、函数等)对扩展是开放的，对修改是封闭的。  
当然，这只是理想化的愿景，在实际开发中，修改原有代码、扩展代码往往是同时存在的。  
已存在的实现类对于修改是封闭的，新的实现类可以通过覆写父类的接口应对变化。

## 3. 里氏替换原则
里氏替换原则(Liskov Substitution Principle, LSP)：所有使用基类的地方必须能透明地使用其子类的对象

## 4. 依赖倒转原则
依赖倒转原则(Dependence Inversion Principle, DIP)：是指一种特定的解耦（传统的依赖关系建立在高层次上，而具体的策略设置则应用在低层次的模块上）形式，使得高层次的模块不依赖于低层次的模块的实现细节，依赖关系被颠倒（反转），从而使得低层次模块依赖于高层次模块的需求抽象。

1. 高层次的模块不应该依赖于低层次的模块，两者都应该依赖于抽象接口。
2. 抽象接口不应该依赖于具体实现。而具体实现则应该依赖于抽象接口。

## 5. 接口隔离原则
接口隔离原则(Interface Segregation Principle, ISP)：客户端不应该依赖它不需要的接口。

## 6. 迪米特法则
迪米特法则(Law of Demeter, LoD), 最少知识原则(Principle of Least Knowledge)：
1. 每个对象应该对其他对象尽可能最少的知道
2. 每个对象应该仅和其朋友通信；不和陌生人通信
3. 仅仅和直接朋友通信