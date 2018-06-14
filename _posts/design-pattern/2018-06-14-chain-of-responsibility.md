---
title: "责任链模式(Chain of responsibility)"
excerpt: "使多个对象都有机会处理请求，从而避免了请求的发送者和接受者之间的耦合关系，将这些对象连成一条链，并沿着这条链传递该请求，一直到有对象处理它为止"
categories:
  - Design Patterns
tags:
  - Chain of responsibility
toc: true
toc_label: "目录"
toc_icon: "heart"
last_modified_at: 2018-06-14T13:49:19+08:00
---

## 1. 定义及使用场景
使多个对象都有机会处理请求，从而避免了请求的发送者和接受者之间的耦合关系，将这些对象连成一条链，并沿着这条链传递该请求，一直到有对象处理它为止

使用场景  
- 多个对象可以处理同一请求，但具体由哪个对象处理则在运行时动态决定。
- 在请求处理者不明确的情况下向多个对象中的一个提交一个请求
- 需要动态指定一组对象处理请求

纯的责任链 -> 请求被某个处理对象处理  
不纯的责任链 -> 所有对象均未对其进行处理
{: .notice }

## 2. UML图
![chain-of-responsibility]({{ basepath }}/assets/images/design-pattern/chain-of-responsibility.png)

- Handler  
  抽象处理者角色，声明一个请求处理的方法，并在其中保持一个对下一个处理节点Handler对象的引用
- ConcreteHandler  
  具体处理者角色，对请求进行处理，如果不能处理则将该请求转发给下一个节点上的处理对象

## 3. 举个例子
我们要报销一定金额的费用。

```kotlin
abstract class Leader {
    var successor: Leader? = null

    fun handleRequest(money: Int) {
        if (money <= limit()) {
            handle(money)
        } else {
            successor?.let {
                println("${javaClass.simpleName}转交${it.javaClass.simpleName}处理")
                it.handleRequest(money)
            }
        }
    }

    abstract fun limit(): Int

    abstract fun handle(money: Int)
}

class GroupLeader : Leader() {
    override fun limit() = 1000

    override fun handle(money: Int) {
        println("组长批复报销${money}元")
    }
}

class Director : Leader() {
    override fun limit() = 5000

    override fun handle(money: Int) {
        println("主管批复报销${money}元")
    }
}

class Manager : Leader() {
    override fun limit() = 10000

    override fun handle(money: Int) {
        println("经理批复报销${money}元")
    }
}

class Boss : Leader() {
    override fun limit() = Int.MAX_VALUE

    override fun handle(money: Int) {
        println("老板批复报销${money}元")
    }
}

fun main(args: Array<String>) {
    val groupLeader = GroupLeader()
    val director = Director()
    val manager = Manager()
    val boss = Boss()

    groupLeader.successor = director
    director.successor = manager
    manager.successor = boss

    groupLeader.handleRequest(20000)
}
```

输出结果如下
```text
GroupLeader转交Director处理
Director转交Manager处理
Manager转交Boss处理
老板批复报销20000元
```
