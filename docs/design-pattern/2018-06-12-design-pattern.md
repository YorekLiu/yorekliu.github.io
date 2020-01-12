---
title: "设计模式概述"
excerpt: "设计模式中设计原则、设计模式的概述"
categories:
  - Design Patterns
tags:
  - content
last_modified_at: 2018-06-12T11:49:19+08:00
---

"设计模式"总的来说有设计原则6个，设计模式3类23种：  

[**6个设计原则**](/design%20patterns/design-principle/)  
- 单一职责原则(Single Responsibility Principle, SRP)
- 开闭原则(Open Close Principle, OCP)
- 里氏替换原则(Liskov Substitution Principle, LSP)
- 依赖倒转原则(Dependence Inversion Principle, DIP)
- 接口隔离原则(Interface Segregation Principle, ISP)
- 迪米特法则(Law of Demeter, LoD), 最少知识原则(Principle of Least Knowledge)

> 其中，前5个原则称为SOLID原则

**3类设计模式，共23个**

**创建型模式(Creational patterns)**
1. [单例模式(Singleton)](/design%20patterns/singleton/)
2. [建造者模式(Builder)](/design%20patterns/builder/)
3. [原型模式(Prototype)](/design%20patterns/prototype/)
4. [工厂方法模式(Factory method)](/design%20patterns/factory-method/)
5. [抽象工厂模式(Abstract factory)](/design%20patterns/abstract-factory/)

**结构型模式(Structural patterns)**
6. [代理模式(Proxy)](/design%20patterns/proxy/)
7. [组合模式(Composite)](/design%20patterns/composite/)
8. [适配器模式(Adapter)](/design%20patterns/adapter/)
9. [装饰模式(Decorator)](/design%20patterns/decorator/)
10. [享元模式(Flyweight)](/design%20patterns/flyweight/)
11. [外观模式(Facade)](/design%20patterns/facade/)
12. [桥接模式(Bridge)](/design%20patterns/bridge/)

**行为型模式(Behavioral patterns)**
13. [策略模式(Strategy)](/design%20patterns/strategy/)
14. [状态模式(State)](/design%20patterns/state/)
15. [责任链模式(Chain of responsibility)](/design%20patterns/chain-of-responsibility/)
16. [解释器模式(Interpreter)](/design%20patterns/interpreter/)
17. [命令模式(Command)](/design%20patterns/command/)
18. [观察者模式(Observer)](/design%20patterns/observer/)
19. [备忘录模式(Memento)](/design%20patterns/memento/)
20. [迭代器模式(Iterator)](/design%20patterns/iterator/)
21. [模版方法模式(Template method)](/design%20patterns/template-method/)
22. [访问者模式(Visitor)](/design%20patterns/visitor/)
23. [中介者模式(Mediator)](/design%20patterns/mediator/)

**设计模式这么多，这里整理了相关的[易混淆的设计模式](/design%20patterns/confusing-design-pattern)**
{: .notice--info }

> 这是作者从《Android源码设计模式解析与实战(第二版)》中提取出来的思维导图[下载]({{ basepath }}/assets/file/android-design-pattern.xmind){: .btn .btn--success}  
> 以及作者提供的23种UML图的[百度云盘](https://pan.baidu.com/s/1qXDPXy0)

<figure style="width: 100%" class="align-center">
    <img src="/assets/images/design-pattern/uml-example.png">
    <figcaption>UML图图示样例</figcaption>
</figure>