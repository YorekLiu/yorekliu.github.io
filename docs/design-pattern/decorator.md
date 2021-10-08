---
title: "装饰模式(Decorator)"
---

## 1. 定义及使用场景

装饰模式也称为包装模式(Wrapper Pattern)，可以动态地给一个对象添加一些额外的职责，就增加功能来说，装饰模式相比生成子类更加灵活

使用场景：  
需要透明且动态地扩展类的功能时

装饰模式是以对客户端透明的方式扩展对象的功能，是继承关系的一个替代方案；而代理模式则是给一个对象提供一个代理对象，并有代理对象来控制原有对象的引用。**装饰模式应该为所装饰的对象增强功能；代理模式对代理的对象施加控制，但不对对象本身的功能进行增强。**

装饰模式是为已有功能动态地添加更多功能的一种方式。当系统需要新功能的时候，是向旧的类中添加新的代码。这些新加的代码通常装饰了原有类的核心职责或主要行为，在主类中加入了新的字段，新的方法和新的逻辑，从而增加了主类的复杂度，而这些新加入的东西仅仅是为了满足一些只有某种特定情况下才会执行的特殊行为的需要。装饰模式缺提供了一个非常好的解决方案，它把每个要装饰的功能放到单独的类中，并让这个类包装它所要装饰的对象，因此，当需要执行特殊行为时，客户代码就可以运行时根据需要有选择地、按顺序地使用装饰功能包装对象了。

装饰模式的有点是把类中的装饰功能从类中搬移去除，这样可以简化原有的类。它有效地把类的核心职责和装饰功能区分开了，而且可以去除相关类中重复的装饰逻辑。

## 2. UML图

![装饰模式UML图](/assets/images/design-pattern/decorator.png)  
<center>装饰模式UML图</center>

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

## 4. 源码中的例子

ContextWrapper与Context的关系就是装饰模式的例子。

**ContextWrapper.java**

```java
public class ContextWrapper extends Context {
    Context mBase;

    public ContextWrapper(Context base) {
        mBase = base;
    }
    
    /**
     * Set the base context for this ContextWrapper.  All calls will then be
     * delegated to the base context.  Throws
     * IllegalStateException if a base context has already been set.
     * 
     * @param base The new base context for this wrapper.
     */
    protected void attachBaseContext(Context base) {
        if (mBase != null) {
            throw new IllegalStateException("Base context already set");
        }
        mBase = base;
    }

    /**
     * @return the base context as set by the constructor or setBaseContext
     */
    public Context getBaseContext() {
        return mBase;
    }

    @Override
    public AssetManager getAssets() {
        return mBase.getAssets();
    }
    ...
}
```

在上面的构造方法中，实际上传入的Context对象是`ContextImpl`类型，想了解更多，可以参考[四大组件启动过程](/android/framework/%E5%9B%9B%E5%A4%A7%E7%BB%84%E4%BB%B6%E5%90%AF%E5%8A%A8%E8%BF%87%E7%A8%8B/)。