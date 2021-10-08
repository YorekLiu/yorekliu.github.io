---
title: "状态模式(State)"
---

## 1. 定义及使用场景
当一个对象内在状态改变时允许改变其行为，这个对象看起来就像是改变了其类

使用场景  

- 一个对象的行为取决于它的状态，并且它必须在运行时根据状态改变它的行为
- 代码中包含大量与对象状态有关的条件语句。例如，一个操作中含有庞大的多分支语句，且这些分支依赖于该对象的状态

状态模式将每一个条件分支放入一个独立的类中，这使得可以根据对象自身的情况将对象的状态作为一个对象，这个对象可以不依赖与其他对象而独立变化，这样通过多态来去除过多的、重复的if-else等分支语句。

## 2. UML图

![状态模式UML图](/assets/images/design-pattern/state.png)  
<center>状态模式UML图</center>

- Context  
  用来操作策略的环境
- State  
  抽象状态类或状态接口
- ConcreteState  
  具体状态类

## 3. 举个例子
我们以电视遥控器为例，电视处于关机状态不响应任何操作；

```kotlin
interface TvState {
    fun nextChannel()

    fun prevChannel()

    fun turnUp()

    fun turnDown()
}

class PowerOffState : TvState {
    override fun nextChannel() {}

    override fun prevChannel() {}

    override fun turnUp() {}

    override fun turnDown() {}
}

class PowerOnState : TvState {
    override fun nextChannel() {
        println("下一频道")
    }

    override fun prevChannel() {
        println("上一频道")
    }

    override fun turnUp() {
        println("调高音量")
    }

    override fun turnDown() {
        println("调低音量")
    }
}

interface PowerController {
    fun powerOn()

    fun powerOff()
}

class TvController : PowerController {
    private var state: TvState? = null

    override fun powerOn() {
        state = PowerOnState()
        println("开机了----")
    }

    override fun powerOff() {
        state = PowerOffState()
        println("关机了----")
    }

    fun nextChannel() {
        state?.nextChannel()
    }

    fun prevChannel() {
        state?.prevChannel()
    }

    fun turnUp() {
        state?.turnUp()
    }

    fun turnDown() {
        state?.turnDown()
    }
}

fun main(args: Array<String>) {
    with(TvController()) {
        powerOn()

        nextChannel()

        turnUp()

        powerOff()

        turnDown()

        prevChannel()
    }
}
```

输出结果如下
```text
开机了----
下一频道
调高音量
关机了----
```

## 4. 源码中的例子

[StateMachine.java](http://androidxref.com/7.1.1_r6/xref/frameworks/base/core/java/com/android/internal/util/StateMachine.java)这个状态机就是一个状态模式的实现。