---
title: "桥接模式(Bridge)"
---

## 1. 定义及使用场景

对象的继承关系是在编译时就定义好了，所以无法在运行时改变从父类继承的实现。子类的实现与它的父类有紧密的依赖关系，以至于父类实现中的任何变化必然会导致子类发生变化。当你需要复用子类时，如果继承下来的实现不适合解决新的问题，则父类必须重写或被其他更适合的类替换。这种依赖关系限制了灵活性并最终限制了复用性。

> **合成/聚合复用原则**，尽量使用合成/聚合，尽量不要使用类继承。

聚合表示一种弱的“拥有”关系，体现的是A对象可以包含B对象，但B对象不是A对象的一部分；合成则是一种强的“拥有”关系，体现了严格的部分和整体的关系，部分和整体的生命周期一样。  
合成/聚合复用原则的好处是，优先使用对象的合成/聚合将有助于你保持每个类被封装，并被集中在单个任务上。这样类和类的继承层次会保持较小规模，并且不太可能增长为不可控制的庞然大物。

---

**桥接模式将抽象部分与实现部分分离，使它们都可以独立地进行变化。**  

什么叫做抽象与它的实现分离，这并不是说，让抽象类与其派生类分离，因为这没有任何意义。实现指的是抽象类和它的派生类用来实现自己的对象。换句话说，就是指：实现系统可能有多角度分类，每一种分类都有可能变化，那么就把这种多角度分离出来让它们独立变化，减少它们之间的耦合。

**使用场景**  
从模式的定义上我们大致可以了解到，这里Bridge的作用其实就是连接"抽象部分"与"实现部分"，但是事实上，任何多维度变化类或者多个树状类之间的耦合都可以使用桥接模式来实现解耦。  
如果一个系统需要在构建的抽象化角色和具体化角色之间增加更多的灵活性，避免在两个层次之间建立静态的继承联系，可以通过桥接模式使它们在抽象层建立一个关联关系。  
对于那些不希望使用继承或因为多层次继承导致系统类的个数急剧增加的系统，也可以考虑使用桥接模式。  
一个类存在两个独立变化的维度，且这两个维度都需要进行扩展。

## 2. UML图

![桥接模式UML图](/assets/images/design-pattern/bridge.png)  
<center>桥接模式UML图</center>

- Abstraction  
  抽象部分  
  该类保持一个对实现部分对象的引用，抽象部分中的方法需要调用实现部分的对象来实现，该类一般为抽象类。
- RefinedAbstraction  
  抽象部分的具体实现，该类一般是对抽象部分的方法进行完善和扩展。
- Implementor  
  可以为接口或抽象类，其方法不一定要和抽象部分的中的一致，一般情况下是由实现部分提供基本的操作，而抽象部分定义的则是基于实现部分这些基本操作的业务方法。
- ConcreteImplementor  
  实现部分的具体实现
- Client  
  客户端

## 3. 举个例子
下面的例子描述了Shape的绘制。

```kotlin
/**
 * Implementor
 */
interface DrawingAPI {
    fun drawCircle(x: Double, y: Double, radius: Double)
}

/**
 * ConcreteImplementor
 */
class DrawingAPI1 : DrawingAPI {
    override fun drawCircle(x: Double, y: Double, radius: Double) {
        println("API1.circle at $x:$y radius $radius")
    }
}

/**
 * ConcreteImplementor
 */
class DrawingAPI2 : DrawingAPI {
    override fun drawCircle(x: Double, y: Double, radius: Double) {
        println("API2.circle at $x:$y radius $radius")
    }
}

/**
 * Abstraction
 */
abstract class Shape(protected var drawingAPI: DrawingAPI) {

    abstract fun draw()

    abstract fun resizeByPercentage(pct: Double)
}

/**
 * Refined Abstraction
 */
class CircleShape(
        private var x: Double,
        private var y: Double,
        private var radius: Double,
        drawingAPI: DrawingAPI
) : Shape(drawingAPI) {

    override fun draw() {
        drawingAPI.drawCircle(x, y, radius)
    }

    override fun resizeByPercentage(pct: Double) {
        radius *= (1.0 + pct / 100.0)
    }
}

fun main(args: Array<String>) {
    listOf(
            CircleShape(1.0, 1.0, 1.0, DrawingAPI1()),
            CircleShape(5.0, 7.0, 11.0, DrawingAPI2())
    ).forEach {
        it.resizeByPercentage(2.5)
        it.draw()
    }
}
```

输出结果如下
```text
API1.circle at 1.0:1.0 radius 1.025
API2.circle at 5.0:7.0 radius 11.274999999999999
```

## 4. 源码中的例子

那么在framework内部的源码实现中，比较典型的是Window与WindowManager之间的关系：

![bridge-pattern-in-window](/assets/images/design-pattern/bridge-pattern-in-window.png)  

如上图所示，在framework中Window和PhoneWindow构成窗口的抽象部分，其中Window类为该抽象部分的抽象接口，PhoneWindow为抽象部分具体的实现及扩展。而WindowManager则为实现部分的基类，WindowManagerImpl为实现部分具体的逻辑实现，其使用WindowManagerGlobal通过IWindowManager接口与WindowManagerService（也就是我们常说的WMS）进行交互，并由WMS完成具体的窗口管理工作。