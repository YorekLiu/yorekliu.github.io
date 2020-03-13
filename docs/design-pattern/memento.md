---
title: "备忘录模式(Memento)"
---

## 1. 定义及使用场景

**在不破环封闭的前提下，捕获一个对象的内在状态，并在该对象之外保存这个状态。这样，以后就可将该对象恢复到原先保存的状态**

使用场景  

- 需要保存一个对象在某个时刻的状态或部分状态
- 如果用一个接口来让其他对象得到这些状态，将会暴露对象的实现细节并破坏对象的封装性，一个对象不希望外界直接访问其内部状态，通过中间对象可以间接访问其内部状态

Memento模式比较适用于功能比较复杂的，但需要维护和记录属性历史的类，或者需要保存的属性只是众多属性中的一小部分时，Originator可以根据保存的Memento信息还原到前一状态。  
如果某个系统中使用命令模式时，需要实现命令的撤销功能，那么命令模式可以使用备忘录模式来存储可撤销操作的状态。  
使用备忘录可以把复杂的对象内部信息对其他的对象屏蔽起来。  
当角色的状态改变时，有可能这个状态无效，这时候就可以使用暂时存储起来的备忘录将状态复原。

## 2. UML图

![备忘录模式UML图](/assets/images/design-pattern/memento.png)  
<center>备忘录模式UML图</center>

- Originator  
  负责创建一个备忘录，可以记录、恢复自身的内部状态。同时还可以根据需要决定Memento存储自身哪些内部状态
- Memento  
  备忘录角色，用于存储Originator的内部状态，并且可以防止Originator以外对象访问Memento
- Caretaker  
  负责存储备忘录，不能对备忘录的内容进行操作和访问，只能将备忘录传递给其他对象

## 3. 举个例子
一个简单的游戏存档功能，将进度存储起来，下次进入游戏可以继续开始游戏。

```kotlin
/** Memento */
class Memento {
    var checkPoint = 0
    var lifeValue = 0
    var weapon = ""
}

/** Originator */
class CallOfDuty {
    var checkPoint = 1
    var lifeValue = 100
    var weapon = "沙漠之鹰"

    fun play() {
        println("玩游戏 : 第${checkPoint}关 奋战杀敌中")

        lifeValue -= 10

        println("进度升级了")

        checkPoint++

        println("到达 第${checkPoint}关")
    }

    fun quit() {
        println(" ---------------------- ")
        println("退出前的游戏属性 : ${toString()}")
        println(" ---------------------- ")
    }

    fun createMemento() : Memento {
        return Memento().apply {
            this.checkPoint = this@CallOfDuty.checkPoint
            this.lifeValue = this@CallOfDuty.lifeValue
            this.weapon = this@CallOfDuty.weapon
        }
    }

    fun restore(memento: Memento) {
        memento.run {
            this@CallOfDuty.checkPoint = this.checkPoint
            this@CallOfDuty.lifeValue = this.lifeValue
            this@CallOfDuty.weapon = this.weapon
        }
    }

    override fun toString(): String {
        return "CallOfDuty(checkPoint=$checkPoint, lifeValue=$lifeValue, weapon='$weapon')"
    }
}

/** Caretaker */
class Caretaker {
    private var memento: Memento? = null

    fun archive(memento: Memento) {
        this@Caretaker.memento = memento
    }

    fun getMemento() : Memento = memento!!
}

fun main(args: Array<String>) {
    val game = CallOfDuty()
    game.play()

    val caretaker = Caretaker()
    caretaker.archive(game.createMemento())

    game.quit()

    val newGame = CallOfDuty()
    newGame.restore(caretaker.getMemento())
    newGame.play()
    newGame.quit()
}
```

输出结果如下
```text
玩游戏 : 第1关 奋战杀敌中
进度升级了
到达 第2关
 ----------------------
退出前的游戏属性 : CallOfDuty(checkPoint=2, lifeValue=90, weapon='沙漠之鹰')
 ----------------------
玩游戏 : 第2关 奋战杀敌中
进度升级了
到达 第3关
 ----------------------
退出前的游戏属性 : CallOfDuty(checkPoint=3, lifeValue=80, weapon='沙漠之鹰')
 ----------------------
```

## 4. 源码中的例子

在Android开发中，状态模式应用是Activity中的状态保存，也就是里面的`onSaveInstanceState`和`onRestoreInstanceState`。当Activity不是正常方式退出，且Activity在随后的时间内被系统杀死之前会调用这两个方法让开发人员可以有机会存储Activity相关的信息，并且在下次返回Activity时恢复这些数据。通过这两个函数，开发人员能够在某些特殊场景下存储与界面相关的信息，提升用户体验，例如，用户在写了一大段表白短信之后，此时一个电话打进来，用户的短信输入界面被退到后台，如果在打电话的过程中短信应用被系统杀死了，那么在用户再次进入短信应用时，上一次输入的内容将不会存在，Activity的状态存储机制就是为了应对这种情况出现的。