---
title: "外观模式(Facade)"
---

## 1. 定义及使用场景

要求一个子系统的外部与其内部的通信必须通过一个统一的对象进行。Facade模式提供一个高层次的接口，使得子系统更易于使用。

使用场景  

- 为一个复杂子系统提供一个简单接口。子系统往往因为不断演化而变得越来越复杂，甚至可能被替换。大多数模式使用时都会产生更多、更小的类，在这使子系统更具可重用性的同时也更容易对子系统进行定制、修改，这种易变性使得隐藏子系统的具体实现变得尤为重要。Facade可以提供一个简单统一的接口，对外隐藏子系统的具体实现、隔离变化。
- 当你需要构建一个层次结构的子系统时，使用Facade模式定义子系统中每层的入口点。如果子系统之间是相互依赖的，你可以让它们仅通过Facade接口进行通信，从而简化了它们之间的依赖关心。

首先，在设计初期阶段，应该有意识的将不同的两个层分离，曾与层之间建立外观Facade；其次，在开发阶段，子系统往往因为不断的重构演化而变得越来越复杂，增加外观Facade可以提供一个简单的接口，减少它们之间的依赖；第三，在维护一个遗留的大型系统时，可能这个系统已经非常难以维护和扩展了，新系统开发一个外观Facade类，来提供设计粗糙或高度复杂的遗留代码的比较清晰简单的接口，让新系统与Facade对象交互，Facade与遗留代码交互所有复杂的工作。

## 2. UML图

![外观模式UML图](/assets/images/design-pattern/facade.png)  
<center>外观模式UML图</center>

- Facade  
  系统对外的统一接口，系统内部系统地工作
- SystemA、SystemB、SystemC  
  子系统接口

## 3. 举个例子
手机中硬件特别多，每一个软件的功能会调用多个硬件同时进行协作。

```kotlin
interface Camera {
    fun open()

    fun takePicture()

    fun close()
}

class SamsungCamera : Camera {
    override fun open() {
        println("open camera")
    }

    override fun takePicture() {
        println("takePicture")
    }

    override fun close() {
        println("close camera")
    }
}

interface Phone {
    fun dial()

    fun hangup()
}

class PhoneImpl : Phone {
    override fun dial() {
        println("dial")
    }

    override fun hangup() {
        println("hangup")
    }
}

class MobilePhone {
    private val phone = PhoneImpl()
    private val camera = SamsungCamera()

    fun dial() {
        phone.dial()
    }

    fun videoChat() {
        println("video chatting ----- ")
        camera.open()
        phone.dial()
    }

    fun hangup() {
        phone.hangup()
    }

    fun takePicture() {
        camera.open()
        camera.takePicture()
    }

    fun closeCamera() {
        camera.close()
    }
}

fun main(args: Array<String>) {
    val nexus6 = MobilePhone()

    nexus6.takePicture()

    nexus6.videoChat()
}
```

输出结果如下
```text
open camera
takePicture
video chatting -----
open camera
dial
```

## 4. 源码中的例子

在用Android开发过程中，Context是最重要的一个类型，Context意为上下文，也就是程序的运行环境。它封装了很多重要的操作，如`startActivity()`、`sendBroadcast()`、`bindService`等，因此，Context对开发者来说是最重要的高层接口。Context只是一个定义了很多接口的抽象类，这些接口的功能实现并不是在Context及其子类中，而是通过其他子系统来完成，例如`startActivity`的真正实现是通过`ActivityManagerService`，获取应用包相关信息则是通过`PackageManagerService`。Context只是做了一个高层次的统一封装，正如上文所示，Context只是一个抽象类，它的真正实现在ContextImpl类中，ContextImpl就是今天我们要分析的外观类。