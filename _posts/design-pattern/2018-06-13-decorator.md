---
title: "装饰模式(Decorator)"
excerpt: "动态地给一个对象添加一些额外的职责，就增加功能来说，装饰模式相比生成子类更加灵活"
categories:
  - Design Patterns
tags:
  - Decorator
toc: true
toc_label: "目录"
last_modified_at: 2018-06-13T16:49:19+08:00
---

## 1. 定义及使用场景
动态地给一个对象添加一些额外的职责，就增加功能来说，装饰模式相比生成子类更加灵活

使用场景：
需要透明且动态地扩展类的功能时

装饰模式是以对客户端透明的方式扩展对象的功能，是继承关系的一个替代方案；而代理模式则是给一个对象提供一个代理对象，并有代理对象来控制原有对象的引用。装饰模式应该为所装饰的对象增强功能；代理模式对代理的对象施加控制，但不对对象本身的功能进行增强。
{: .notice }

## 2. UML图
![decorator]({{ basepath }}/assets/images/design-pattern/decorator.png)

- Component  
  抽象组件，可以是一个接口或抽象类，其充当的是就是被装饰的原始对象。
- ConcreteComponent  
  组件具体实现类
- Decorator  
  抽象装饰者。
- ConcreteDecoratorA  
  装饰者具体实现类

## 3. 举个例子
人穿衣服，有便宜衣服和贵衣服。

```kotlin
abstract class Person {
    abstract fun dressed()
}

class Boy : Person() {
    override fun dressed() {
        println("穿了内衣内裤")
    }
}

open class PersonCloth(val person: Person) : Person() {
    override fun dressed() {
        person.dressed()
    }
}

class CheapCloth(person: Person) : PersonCloth(person) {

    private fun dressShorts() = println("穿件短裤")

    override fun dressed() {
        super.dressed()
        dressShorts()
    }
}

class ExpensiveCloth(person: Person) : PersonCloth(person) {

    private fun dressShirt() = println("穿件短袖")

    private fun dressLeather() = println("穿件皮衣")

    private fun dressJean() = println("穿件牛仔衣")

    override fun dressed() {
        super.dressed()
        dressShirt()
        dressLeather()
        dressJean()
    }
}

fun main(args: Array<String>) {
    val person = Boy()

    val clothCheap = CheapCloth(person)
    clothCheap.dressed()

    println()

    val clothExpensive = ExpensiveCloth(person)
    clothExpensive.dressed()
}
```

输出结果如下
```text
穿了内衣内裤
穿件短裤

穿了内衣内裤
穿件短袖
穿件皮衣
穿件牛仔衣
```
