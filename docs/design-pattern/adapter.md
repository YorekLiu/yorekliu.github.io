---
title: "适配器模式(Adapter)"
---

## 1. 定义及使用场景

**适配器模式把一个类的接口变换成客户端所期待的另一个接口，从而使原本因接口不匹配而无法工作的两个类能够在一起工作**

使用场景：
- 系统需要使用现有的类，而此类的接口不符合系统的需要，即接口不兼容
- 想要建立一个可以重复使用的类，用于与一些彼此之间没有太大关联的一些类，包括一些可能在将来引进的类一起工作
- 需要一个统一的输出接口，而输入端的类型不可预知

> 适配器模式分为两种：类适配器模式、对象适配器模式  
> 对象适配器比类适配器更加灵活，它不会将被适配对象中的方法暴露出来；而类适配器模式由于继承了被适配对象，因此，被适配对象类的函数在Adapter类中也都含有，这使得Adapter类出现一些奇怪的接口，用户使用成本较高。  
> 因此，对象适配器模式更加灵活、实用。

## 2. UML图

![类适配器与对象适配器](/assets/images/design-pattern/class-adapter.png)  
![类适配器与对象适配器](/assets/images/design-pattern/object-adapter.png)  
<center>类适配器与对象适配器</center>

## 3. 举个例子
做一个简单的220V to 5V的充电器

```kotlin
/**
 * Target
 */
interface FiveVolt {
    fun getVolt5(): Int
}

/**
 * Adaptee
 */
class Volt220 {
    fun getVolt220() = 220
}

/**
 * Adapter
 */
class VoltAdapter(val volt220: Volt220) : FiveVolt {
    override fun getVolt5(): Int = volt220.getVolt220() / 44
}

fun main(args: Array<String>) {
    val adapter = VoltAdapter(Volt220())

    println("输出电压：${adapter.getVolt5()}")
}
```

输出结果如下
```text
输出电压：5
```

## 4. 源码中的例子

在开发过程中，ListView的`Adapter`是我们最为常见的类型之一。我们需要使用Adapter加载每个ItemView的布局，并且进行数据绑定等操作。