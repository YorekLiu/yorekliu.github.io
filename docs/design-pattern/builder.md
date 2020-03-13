---
title: "建造者模式(Builder)"
---

## 1. 定义及使用场景

**将一个复杂对象的构建与它的表示分离，使得同样的构建过程可以创建不同的表示。**

使用场景：

1. 相同的方法，不同的执行顺序，产生不同的事件结果时
2. 多个部件或零件，都可以装配到一个对象中，但是产生的运行结果却又不相同时
3. 产品类非常复杂，或者产品类中的调用顺序不同产生了不同的结果，这个时候使用建造者模式非常合适
4. 当初始化一个对象特别复杂，如参数多，且很多参数都具有默认值时

## 2. UML图

![Builder模式UML图](/assets/images/design-pattern/builder.png)  
<center>Builder模式UML图</center>

- Product  
  产品类——产品的抽象类
- Builder  
  抽象Builder类，规范产品的组建，一般由子类实现具体的组建过程
- ConcreteBuilder  
  具体的Builder类
- Director  
  统一组装过程

## 3. 举个例子
我们需要创建汽车，而汽车有轮胎的个数以及车身的颜色可定制，那么用Builder模式可以这样。

```kotlin
/**
 * Represents the product created by the builder.
 */
data class Car @JvmOverloads constructor(
        var wheels: Int = 0,
        var color: String = ""
)

/**
 * The builder abstraction.
 */
interface CarBuilder {
    fun build(): Car

    fun setColor(color: String): CarBuilder

    fun setWheels(wheels: Int): CarBuilder
}

class CarBuilderImpl : CarBuilder {
    private var car: Car = Car();

    override fun build(): Car = car

    override fun setColor(color: String): CarBuilder {
        car.color = color
        return this
    }

    override fun setWheels(wheels: Int): CarBuilder {
        car.wheels = wheels
        return this
    }
}

class CarBuilderDirector(private var builder: CarBuilder) {
    fun construct(): Car =
            with(builder) {
                setWheels(4)
                setColor("Red")
                build()
            }
}

fun main(args: Array<String>) {
    val builder = CarBuilderImpl()

    val carBuilderDirector = CarBuilderDirector(builder)

    println(carBuilderDirector.construct())
}
```

打印结果如下
```text
Car(wheels=4, color=Red)
```

## 4. 源码中的例子

Builder模式在Android源码中非常常见，比如`AlertDialog.Builder`、`NotificationCompat.Builder`、`OkHttpClient.Builder`、`Retrofit.Builder`等。