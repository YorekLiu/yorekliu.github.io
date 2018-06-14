---
title: "工厂方法模式(Factory method)"
excerpt: "创建一个用户创建对象的接口，让子类决定实例化哪个类"
categories:
  - Design Patterns
tags:
  - Factory method
toc: true
toc_label: "目录"
toc_icon: "heart"
---

## 1. 定义及使用场景
创建一个用户创建对象的接口，让子类决定实例化哪个类。

使用场景：
在任何需要生成复杂对象的地方，都可以使用工厂方法模式。复杂对象适合使用工厂模式，用new就可以完成创建的对象无需使用工厂方法。

如果有多个工厂的方法，那么我们称为多工厂方法模式。  
如果我们的工厂类只有一个，那么简化掉抽象类是没有问题的，我们只需要将对应的工厂方法改为静态方法即可。这样的方式又称为简单工厂模式或静态工厂模式，它是工厂方法模式的一个弱化版本。
{: .notice }

## 2. UML图
![factory-method]({{ basepath }}/assets/images/design-pattern/factory-method.png)

## 3. 举个例子
我们需要组装各种一个牌子的几个款式的汽车，我们可以这样。

```kotlin
abstract class AudiCar {
    abstract fun drive()

    abstract fun selfNavigation()
}

abstract class AudiFactory {
    abstract fun <T : AudiCar> createAudiCar(clazz: Class<T>): T
}

class AudiCarFactory : AudiFactory() {
    override fun <T : AudiCar> createAudiCar(clazz: Class<T>): T {
        var car: AudiCar? = null
        try {
            car = Class.forName(clazz.name).newInstance() as AudiCar;
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return car as T
    }
}

class AudiQ3 : AudiCar() {
    override fun drive() {
        println("${javaClass.simpleName} drive")
    }

    override fun selfNavigation() {
        println("${javaClass.simpleName} selfNavigation")
    }
}

class AudiQ5 : AudiCar() {
    override fun drive() {
        println("${javaClass.simpleName} drive")
    }

    override fun selfNavigation() {
        println("${javaClass.simpleName} selfNavigation")
    }
}

class AudiQ7 : AudiCar() {
    override fun drive() {
        println("${javaClass.simpleName} drive")
    }

    override fun selfNavigation() {
        println("${javaClass.simpleName} selfNavigation")
    }
}

fun main(args: Array<String>) {
    val factory: AudiFactory = AudiCarFactory()

    with(factory.createAudiCar(AudiQ3::class.java)) {
        drive()
        selfNavigation()
    }

    with(factory.createAudiCar(AudiQ5::class.java)) {
        drive()
        selfNavigation()
    }

    with(factory.createAudiCar(AudiQ7::class.java)) {
        drive()
        selfNavigation()
    }
}
```

输出结果如下
```text
AudiQ3 drive
AudiQ3 selfNavigation
AudiQ5 drive
AudiQ5 selfNavigation
AudiQ7 drive
AudiQ7 selfNavigation
```
