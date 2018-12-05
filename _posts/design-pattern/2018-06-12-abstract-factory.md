---
title: "抽象工厂模式(Abstract factory)"
excerpt: "为创建一组相关或者是相互依赖的对象提供一个接口，而不需要指定它们的具体类"
categories:
  - Design Patterns
tags:
  - Abstract factory
toc: true
toc_label: "目录"
last_modified_at: 2018-06-12T16:49:19+08:00
---

## 1. 定义及使用场景
为创建一组相关或者是相互依赖的对象提供一个接口，而不需要指定它们的具体类。

使用场景：
一个对象族有相同的约束时可以使用抽象工厂模式。比如，Android、iOS、Window Phone下都有拨号软件和短信软件，两者都属于软件的范畴，但是，它们所在的操作系统平台不一样，即便是同一家公司出品的软件，其代码的实现逻辑也是不同的，这时候就可以考虑使用抽象工厂模式来产生Android、iOS、Window Phone下的拨号软件和短信软件。

## 2. UML图
![abstract-factory]({{ basepath }}/assets/images/design-pattern/abstract-factory.png)

## 3. 举个例子
在上章的例子中，虽然Q3、Q5、Q7都是一个车系，但是三者的零部件差别非常大。它们的轮胎、发动机、制动系统等部件不同。

```kotlin
interface ITire {
    fun tire()
}

class NormalTire : ITire {
    override fun tire() {
        println("normal tire")
    }
}

class SUVTire : ITire {
    override fun tire() {
        println("suv tire")
    }
}

interface IEngine {
    fun engine()
}

class DomesticEngine : IEngine {
    override fun engine() {
        println("domestic engine")
    }
}

class ImportEngine : IEngine {
    override fun engine() {
        println("import engine")
    }
}

interface IBrake {
    fun brake()
}

class NormalBrake : IBrake {
    override fun brake() {
        println("normal brake")
    }
}

class SeniorBrake : IBrake {
    override fun brake() {
        println("senior brake")
    }
}

abstract class CarFactory {
    abstract fun createTire(): ITire

    abstract fun createEngine(): IEngine

    abstract fun createBrake(): IBrake
}

class Q3Factory : CarFactory() {
    override fun createTire(): ITire = NormalTire()

    override fun createEngine(): IEngine = DomesticEngine()

    override fun createBrake(): IBrake = NormalBrake()
}

class Q7Factory : CarFactory() {
    override fun createTire(): ITire = SUVTire()

    override fun createEngine(): IEngine = ImportEngine()

    override fun createBrake(): IBrake = SeniorBrake()
}

fun main(args: Array<String>) {
    val factoryQ3: CarFactory = Q3Factory()
    factoryQ3.createTire().tire()
    factoryQ3.createEngine().engine()
    factoryQ3.createBrake().brake()

    println()

    val factoryQ7: CarFactory = Q7Factory()
    factoryQ7.createTire().tire()
    factoryQ7.createEngine().engine()
    factoryQ7.createBrake().brake()
}
```

输出结果如下
```text
normal tire
domestic engine
normal brake

suv tire
import engine
senior brake
```
