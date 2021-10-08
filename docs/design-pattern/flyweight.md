---
title: "享元模式(Flyweight)"
---

## 1. 定义及使用场景

**使用享元对象可有效地支持大量的细粒度的对象**

使用场景  

- 系统中存在大量的相似对象
- 细粒度的对象都具备较接近的外部状态，而且内部状态与环境无关，也就是说对象没有特定身份。
- 需要缓冲池的场景

## 2. UML图

![享元模式UML图](/assets/images/design-pattern/flyweight.png)  
<center>享元模式UML图</center>

- Flyweight  
  享元对象抽象类或者接口
- ConcreteFlyweight  
  具体的享元对象
- FlyweightFactory  
  享元工厂，负责管理享元对象池和创建享元对象

## 3. 举个例子
12306车票信息

```kotlin
interface Ticket {
    fun showTicketInfo(bunk: String)
}

class TrainTicket(
        val from: String,
        val to: String
) : Ticket {

    private var price: Int = 0

    override fun showTicketInfo(bunk: String) {
        price = Random().nextInt(300)

        println("购买从${from}到${to}的${bunk}火车票，价格为$price")
    }
}

object TicketFactory {
    val sTicketMap = ConcurrentHashMap<String, Ticket>()

    fun getTicket(from: String, to: String): Ticket {
        val key = "${from}-${to}"
        if (sTicketMap.containsKey(key)) {
            println("使用缓存 ---- ${key}")
            return sTicketMap.get(key)!!
        } else {
            println("创建对象 ---- ${key}")
            val ticket = TrainTicket(from, to)
            sTicketMap.put(key, ticket)
            return ticket
        }
    }
}

fun main(args: Array<String>) {
    val ticket1 = TicketFactory.getTicket("北京", "青岛")
    ticket1.showTicketInfo("上铺")

    val ticket2 = TicketFactory.getTicket("北京", "青岛")
    ticket2.showTicketInfo("下铺")

    val ticket3 = TicketFactory.getTicket("北京", "青岛")
    ticket3.showTicketInfo("站票")
}
```

输出结果如下
```text
创建对象 ---- 北京-青岛
购买从北京到青岛的上铺火车票，价格为202
使用缓存 ---- 北京-青岛
购买从北京到青岛的下铺火车票，价格为202
使用缓存 ---- 北京-青岛
购买从北京到青岛的站票火车票，价格为87
```

## 4. 源码中的例子

Handler中的Message就是一个享元模式，Message通过在内部构建一个链表来维护一个被回收的Message对象的对象池，当用户调用obtain函数时会优先从池中取，如果池中没有可以复用的对象则创建这个新的Message对象。这些新创建的Message对象在被使用完之后会被回收到这个对象池中，当下次再调用obtain函数时，它们就会被复用。这里的Message相当于承担了享元模式中3个元素的职责，即是Flyweight抽象，又是ConcreteFlyweight角色，同时又承担了FlyweightFactory管理对象池的职责。

> 享元和对象池的设计目的相近，主要是为了节省系统资源，它们维护和共享的通常是某种资源。对调用者而言对象池提供的对象都没有区别。  
> 享元模式是结构型模式。这意味着，它的侧重点是对象动态的、会变化的状态剥离，外部化，共享不变的东西。  
> 而对象池是构造型模式，侧重于提供对象实例。