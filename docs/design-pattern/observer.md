---
title: "观察者模式(Observer)"
---

## 1. 定义及使用场景

**定义对象间的一种一对多的依赖关系，使得每当一个对象改变状态，则所有依赖于它的对象都会得到通知并被自动更新**

使用场景  

- 关联行为场景，需要注意的是，关联行为是可以拆分的，而不是“组合关系”。(也就是可以自由的注册、注销)
- 事件多级出发场景
- 跨系统的消息交换场景，如消息队列，事件总线的处理机制

## 2. UML图

![观察者模式UML图](/assets/images/design-pattern/observer.png)  
<center>观察者模式UML图</center>

- Subject  
  抽象主题，被观察者(Observable)
- ConcreteSubject  
  具体主题，具体被观察者(ConcreteObservable)
- Observer  
  抽象观察者，Subject更新时会通知自己
- ConcreteObserver  
  具体观察者

## 3. 举个例子
下面一个实例把控制台的每个输入字符串作为一个事件，传递给订阅者。本实例使用了Java中的`Observable`

```kotlin
class EventSource : Observable(), Runnable {
    override fun run() {
        while (true) {
            val response = Scanner(System.`in`).next()
            setChanged()
            notifyObservers(response)
        }
    }
}

fun main(args: Array<String>) {
    println("Enter Text: ")

    val eventSource = EventSource()

    eventSource.addObserver { _, arg ->
        println("Received response: $arg")
    }

    Thread(eventSource).start()
}
```

输出结果如下
```text
Enter Text:
Hello
Received response: Hello
World
Received response: World
This
Received response: This
is
Received response: is
Observer
Received response: Observer
Demo
Received response: Demo
```
