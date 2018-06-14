---
title: "享元模式(Flyweight)"
excerpt: "使用享元对象可有效地支持大量的细粒度的对象"
categories:
  - Design Patterns
tags:
  - Flyweight
toc: true
toc_label: "目录"
toc_icon: "heart"
last_modified_at: 2018-06-13T17:49:19+08:00
---

## 1. 定义及使用场景
使用享元对象可有效地支持大量的细粒度的对象

使用场景  
- 系统中存在大量的相似对象
- 细粒度的对象都具备较接近的外部状态，而且内部状态与环境无关，也就是说对象没有特定身份。
- 需要缓冲池的场景

## 2. UML图
![flyweight]({{ basepath }}/assets/images/design-pattern/flyweight.png)

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
