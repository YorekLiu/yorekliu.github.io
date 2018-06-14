---
title: "中介者模式(Mediator)"
excerpt: "中介者模式包装了一系列对象相互作用的方式，使得这些对象不必相互明显作用。从而使它们松散耦合。当某些对象之间的作用发生改变时，不会立即影响其他的一些对象之间的作用。保证这些作用可以彼此独立的变化。中介者模式将多对多的相互作用转化为一对多的相互作用。中介者模式将对象的行为和协作抽象化，把对象在小尺度的行为上与其他对象的相互作用分开处理"
categories:
  - Design Patterns
tags:
  - Mediator
toc: true
toc_label: "目录"
toc_icon: "heart"
---

## 1. 定义及使用场景
中介者模式包装了一系列对象相互作用的方式，使得这些对象不必相互明显作用。从而使它们松散耦合。当某些对象之间的作用发生改变时，不会立即影响其他的一些对象之间的作用。保证这些作用可以彼此独立的变化。中介者模式将多对多的相互作用转化为一对多的相互作用。中介者模式将对象的行为和协作抽象化，把对象在小尺度的行为上与其他对象的相互作用分开处理

使用场景  
当对象之间的交互操作很多且每个对象的行为操作都依赖彼此时，为了防止在修改一个对象的行为时，同时涉及修改很多其他对象的行为，可以采用中介者模式，来解决紧耦合问题。  
该模式将对象之间的多对多关系变成一对多关系，中介者对象将系统从网状结构变成以调停者为中心的星形结构，达到降低系统的复杂性，提高可扩展性的作用。

## 2. UML图
![mediator]({{ basepath }}/assets/images/design-pattern/mediator.png)

- Mediator  
  抽象中介者角色，定义了同事对象到中介者对象的接口，一般以抽象类的方式实现
- ConcreteMediator  
  具体中介者角色，他从具体的同事对象接收消息，向具体同事对象发出命令
- Colleague  
  抽象同事类角色，定义了中介者对象的接口，它只知道中介者而不知道其他的同事对象
- ConcreteColleagueA  
  具体同事类，每个具体同事类都知道本身在小范围内的行为，而不知道它在大范围内的目的。

## 3. 举个例子
我们将电脑的各种零件整合起来构成一个完整的整体需要一个东西，这就是主板。我们看看主板如何充当这个中介者模式

```kotlin
abstract class Colleague(protected val mediator: Mediator)

abstract class Mediator {
    abstract fun changed(c: Colleague)
}

class CDDevice(mediator: Mediator) : Colleague(mediator) {
    private var data: String? = null

    fun read() = data!!

    fun load() {
        data = "视频数据,音频数据"

        mediator.changed(this)
    }
}

class CPU(mediator: Mediator) : Colleague(mediator) {
    var dataVideo: String? = null
        private set
    var dataSound: String? = null
        private set

    fun decodeData(data: String) {
        val tmp = data.split(",")

        dataVideo = tmp[0]
        dataSound = tmp[1]

        mediator.changed(this)
    }
}

class GraphicsCard(mediator: Mediator) : Colleague(mediator) {

    fun videoPlay(data: String) {
        println("视频: $data")
    }
}

class SoundCard(mediator: Mediator) : Colleague(mediator) {

    fun soundPlay(data: String) {
        println("音频: $data")
    }
}

class MainBoard : Mediator() {
    var cdDevice: CDDevice? = null
    var cpu: CPU? = null
    var soundCard: SoundCard? = null
    var graphicsCard: GraphicsCard? = null

    override fun changed(c: Colleague) {
        when (c) {
            cdDevice -> handleCD(c as CDDevice)
            cpu -> handleCPU(c as CPU)
        }
    }

    private fun handleCD(cdDevice: CDDevice) {
        cpu?.decodeData(cdDevice.read())
    }

    private fun handleCPU(cpu: CPU) {
        soundCard?.soundPlay(cpu.dataSound!!)
        graphicsCard?.videoPlay(cpu.dataVideo!!)
    }
}

fun main(args: Array<String>) {
    val mediator = MainBoard()

    val cd = CDDevice(mediator)
    val cpu = CPU(mediator)
    val vc = GraphicsCard(mediator)
    val sc = SoundCard(mediator)

    mediator.cdDevice = cd
    mediator.cpu = cpu
    mediator.graphicsCard = vc
    mediator.soundCard = sc

    cd.load()
}
```

输出结果如下
```text
音频: 音频数据
视频: 视频数据
```
