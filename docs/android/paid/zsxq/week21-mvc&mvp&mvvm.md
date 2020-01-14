---
title: "MVC、MVP和MVVM"
---

## 1. MVC

MVC模式是最经典开发模式之一，它分为三个部分Model，View，Controller。

- 模型层（Model）：是应用程序中独立于用户界面的动态数据结构；它直接管理应用程序的数据，逻辑和规则。
- 视图层（View）：用户界面，用来展示信息。
- 控制层（Controller）：接收输入事件，操控model或view。

除了将应用程序划分为这些组件之外，MVC还定义了它们之间的交互

- model负责管理应用程序的数据，它从controller接收用户输入。
- view以特定格式呈现model。
- controller响应用户输入并对数据model对象执行交互。controller接收输入，可选地验证它，然后将输入传递给model。

MVC简单来说就是通过Controller来操作Model层的数据，并且返回给View层展示，如下图所示（MVC发展到现在有很多分支了，这里选择一种常见的）。

> 大多数情况下，View和Model都不会直接交互，而是通过Controller来间接交互。

![MVC示意图](/assets/images/android/mvc.png)

**适用场景**：适用于较小，功能较少，业务逻辑较少的项目。

**Android中的MVC也有它的缺点**：

- Activity并不是一个标准的MVC模式中的Controller，它的首要职责是加载应用的布局和初始化用户界面，接受并处理来自用户的操作请求，进而做出响应。随着界面及其逻辑的复杂度不断提升，Activity类的职责不断增加，以致变得庞大臃肿。
- View层和Model层直接进行交互，就必然会导致Model和View之间的耦合，不易开发和维护。

## 2. MVP

MVP（Model-View-Presenter）是MVC的演化版本，MVP的角色定义如下

- Model：主要提供数据的存取功能。Presenter需要通过Model层来存储、获取数据。  
- View：负责处理用户事件和视图部分的展示。在Android中，它可能是Activity、Fragment类或者是某个View控件。  
- Presenter：作为View和Model之间沟通的桥梁，它从Model层检索数据后返回给View层，使得View和Model之间没有耦合。  

在MVP里，Presenter完全将Model和View进行了分离，主要的程序逻辑在Presenter里实现。而且，Presenter与具体的View是没有直接关联的，而是通过 **定义好的接口进行交互** ，从而使得在变更View时可以保持Presenter的不变，这点符合面向接口编程的特点。View只应该有简单的setter/getter方法，以及用户输入和设置界面显示的内容，除此之外就不应该有更多的内容。绝不允许View直接访问Model，这就是其与MVC的很大不同之处。

![MVP示意图](/assets/images/android/mvp.png)

**适用场景**：视图界面不是很多的项目中。

**MVP优点**：

- Model与View完全分离，可以修改View而不影响Model
- 可以更高效的使用Model，因为Model与外界的交互都在Presenter内部
- 可以将一个Presenter用于多个View，而不需要改变Presenter的逻辑。这个特性很有用，因为View的变化总是比Model的变化频繁
- 把逻辑放在Presenter中，就可以脱离UI来测试这些逻辑（单元测试）

**MVP缺点**：

- Presenter作为桥梁协调View和Model，会导致Presenter变得很臃肿，维护比较困难

## 3. MVVM

MVVM（Model-View-ViewModel）将Presenter改为ViewModel，其和MVP类似，不同的是ViewModel跟Model和View进行双向绑定：当View发生改变时，ViewModel通知Model进行更新数据；同理Model数据更新后，ViewModel通知View更新。MVVM的结构图如下所示。

![MVVM示意图](/assets/images/android/mvvm.png)

**适用场景：适用于界面展示的数据较多的项目。**

**优点**：

- 低耦合  
  View可以独立于Model变化和修改，一个ViewModel可以绑定到不同的View上，当View变化的时候Model可以不变，当Model变化的时候View也可以不变。
- 可重用性  
  可以把一些View逻辑放在一个ViewModel里面，让很多view重用这段View逻辑。
- 独立开发  
  开发人员可以专注于业务逻辑和数据的开发（ViewModel），另一个开发人员可以专注于UI开发。
- 可测试  
  界面素来是比较难于测试的，而现在测试可以针对ViewModel来写。
- 提高可维护性
  提供双向绑定机制，解决了MVP大量的手动View和Model同步的问题。从而提高了代码的可维护性。

**缺点**：

- 过于简单的图形界面不适用。
- 对于大型的图形应用程序，视图状态较多，ViewModel的构建和维护的成本都会比较高。
- 数据绑定的声明是指令式地写在View的模版当中的，这些内容是没办法去打断点debug的。
- 目前这种架构方式的实现方式比较不完善规范，常见的就是DataBinding框架。

最后附上Google推荐的架构：[Recommended app architecture](https://developer.android.com/jetpack/docs/guide#recommended-app-arch)

<figure style="width: 66%" class="align-center">
    <img src="/assets/images/android/final-architecture.png">
    <figcaption>Recommended app architecture</figcaption>
</figure>