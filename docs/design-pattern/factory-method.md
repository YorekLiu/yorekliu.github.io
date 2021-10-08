---
title: "工厂方法模式(Factory method)"
---

## 1. 定义及使用场景

创建一个用户创建对象的接口，让子类决定实例化哪个类。工厂方法使一个类的实例化延迟到其子类。

使用场景：

- 工厂方法模式通过依赖抽象来达到解耦的效果，并且将实例化的任务交给子类去完成，有非常好的扩展性
- 在任何需要生成复杂对象的地方，都可以使用工厂方法模式。复杂对象适合使用工厂模式，用new就可以完成创建的对象无需使用工厂方法
- 工厂方法模式的应用非常广泛，然而缺点也很明显，就是每次我们为工厂方法添加新的产品时，都需要编写一个新的产品类，所以要根据实际情况来权衡是否要用工厂方法模式

如果有多个工厂的方法，那么我们称为 **多工厂方法模式**。  
如果我们的工厂类只有一个，那么简化掉抽象类是没有问题的，我们只需要将对应的工厂方法改为静态方法即可。这样的方式又称为 **简单工厂模式** 或 **静态工厂模式** ，它是工厂方法模式的一个弱化版本。

## 2. UML图

![工厂方法模式UML图](/assets/images/design-pattern/factory-method.png)  
<center>工厂方法模式UML图</center>

## 3. 举个例子
我们需要组装各种一个牌子的几个款式的汽车，我们可以这样。

```kotlin
abstract class AudiCar {
    abstract fun drive()

    abstract fun selfNavigation()
}

abstract class AudiFactory {
    abstract fun <T : AudiCar> createAudiCar(clazz: Class<T>): T
}

class AudiCarFactory : AudiFactory() {
    override fun <T : AudiCar> createAudiCar(clazz: Class<T>): T {
        var car: AudiCar? = null
        try {
            car = Class.forName(clazz.name).newInstance() as AudiCar;
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return car as T
    }
}

class AudiQ3 : AudiCar() {
    override fun drive() {
        println("${javaClass.simpleName} drive")
    }

    override fun selfNavigation() {
        println("${javaClass.simpleName} selfNavigation")
    }
}

class AudiQ5 : AudiCar() {
    override fun drive() {
        println("${javaClass.simpleName} drive")
    }

    override fun selfNavigation() {
        println("${javaClass.simpleName} selfNavigation")
    }
}

class AudiQ7 : AudiCar() {
    override fun drive() {
        println("${javaClass.simpleName} drive")
    }

    override fun selfNavigation() {
        println("${javaClass.simpleName} selfNavigation")
    }
}

fun main(args: Array<String>) {
    val factory: AudiFactory = AudiCarFactory()

    with(factory.createAudiCar(AudiQ3::class.java)) {
        drive()
        selfNavigation()
    }

    with(factory.createAudiCar(AudiQ5::class.java)) {
        drive()
        selfNavigation()
    }

    with(factory.createAudiCar(AudiQ7::class.java)) {
        drive()
        selfNavigation()
    }
}
```

输出结果如下
```text
AudiQ3 drive
AudiQ3 selfNavigation
AudiQ5 drive
AudiQ5 selfNavigation
AudiQ7 drive
AudiQ7 selfNavigation
```

## 4. 源码中的例子

我们常用的数据结构中隐藏着对工厂方法模式的应用，以`List`和`Set`为例，他们都继承至`Collection`接口，而`Collection`继承至`Iterable`接口，该接口的声明如下：

```java
public interface Iterable<T> {
    
    Iterator<T> iterator();

    default void forEach(Consumer<? super T> action) {
        Objects.requireNonNull(action);
        for (T t : this) {
            action.accept(t);
        }
    }

    default Spliterator<T> spliterator() {
        return Spliterators.spliteratorUnknownSize(iterator(), 0);
    }
}
```

这意味着List和Set接口也会继承该方法，平时比较常用的两个间接类`ArrayList`和`HashSet`中`iterator`方法的实现就是构造并返回一个迭代器对象：

```java
public class ArrayList<E> extends AbstractList<E>
        implements List<E>, RandomAccess, Cloneable, java.io.Serializable
    public Iterator<E> iterator() {
        return new Itr();
    }
}
```

```java
public class HashSet<E>
    extends AbstractSet<E>
    implements Set<E>, Cloneable, java.io.Serializable {
    public Iterator<E> iterator() {
        return map.keySet().iterator();
    }
}
```

`ArrayList`和`HashSet`中的`iterator`方法其实就相当于一个工厂方法，专为new对象而生，这里iterator方法是构造并返回一个具体的迭代器。