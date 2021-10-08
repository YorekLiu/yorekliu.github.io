---
title: "访问者模式(Visitor)"
---

## 1. 定义及使用场景

**封装一些作用与某种数据结构中各元素的操作，它可以在不改变这个数据结构的前提下定义作用于这些元素的新的操作。**

使用场景

- 对象结构比较稳定，但经常需要在此对象结构上定义新的操作
- 需要对一个对象结构中的对象进行很多不同的并且不想管的操作，而需要避免这些操作“污染”这些对象的类，也不希望在增加新操作的时候修改这些类。

## 2. UML图

![访问者模式UML图](/assets/images/design-pattern/visitor.png)  
<center>访问者模式UML图</center>

- Visitor  
  它定义了对每一个元素(Element)访问的行为，它的参数就是可以访问的元素，它的方法个数理论上来讲与元素个数是一样的。因此，访问者模式要求元素的类族要稳定，如果经常添加、移除元素类，必然会导致频繁的修改Visitor接口，如果出现这种情况，则说明不适合使用访问者模式。
- ConcreteVisitor  
  具体的访问者，它需要给出对每一个元素类访问时所产生的具体行为
- Element  
  元素接口或抽象类，它定义了一个接受访问者(accept)的方法，其意义是指每一个元素都可以被访问者访问。
- ElementA、ElementB  
  具体的元素类，它提供接受访问方法的具体实现，而这个实现通常是使用访问者提供的访问该元素类的方法
- ObjectStructure  
  定义当中所提到的对象结构，=这是一种抽象表述，它内部管理了元素集合，而且可以迭代这些元素供访问者访问。

## 3. 举个例子
年终时，公司会对员工进行业绩考核，以此来评定该员工的绩效及年终奖、晋升等。但是不同领域的管理人员对于员工的评定标准是不一样的，为了简单明了地说明问题，我们把员工简单分为工程师和经理，评定员工的分别为CEO和CTO。而CEO和CTO对于不同员工的关注点是不一样的，这就需要对不同员工类型进行不同的处理。

```kotlin
interface Visitor {
    fun visit(engineer: Engineer)

    fun visit(manager: Manager)
}

abstract class Staff(var name: String) {
    val kpi = Random().nextInt(10)

    abstract fun accept(visitor: Visitor)
}

class Engineer(name: String) : Staff(name) {

    override fun accept(visitor: Visitor) {
        visitor.visit(this)
    }

    fun getCodeLines() = Random().nextInt(10 * 10000)
}

class Manager(name: String) : Staff(name) {
    val products = Random().nextInt(10)

    override fun accept(visitor: Visitor) {
        visitor.visit(this)
    }
}

class CEOVisitor : Visitor {
    override fun visit(engineer: Engineer) {
        println("工程师 : ${engineer.name}, KPI : ${engineer.kpi}")
    }

    override fun visit(manager: Manager) {
        println("经理 : ${manager.name}, KPI : ${manager.kpi}, 新产品数量 : ${manager.products}")
    }
}

class CTOVisitor : Visitor {
    override fun visit(engineer: Engineer) {
        println("工程师 : ${engineer.name}, 代码函数 : ${engineer.getCodeLines()}")
    }

    override fun visit(manager: Manager) {
        println("经理 : ${manager.name}, 产品数量 : ${manager.products}")
    }
}

class BusinessReport {
    private val staffs = listOf(
            Manager("王经理"),
            Engineer("工程师—Shawn.Xiong"),
            Engineer("工程师—Kael"),
            Engineer("工程师—Chaossss"),
            Engineer("工程师—Tiiime")
    )

    fun showReport(visitor: Visitor) {
        staffs.forEach {
            it.accept(visitor)
        }
    }
}

fun main(args: Array<String>) {
    val report = BusinessReport()

    println(" ------------ CEO -------------")
    report.showReport(CEOVisitor())

    println(" ------------ CTO -------------")
    report.showReport(CTOVisitor())
}
```

输出结果如下
```text
------------ CEO -------------
经理 : 王经理, KPI : 0, 新产品数量 : 1
工程师 : 工程师—Shawn.Xiong, KPI : 3
工程师 : 工程师—Kael, KPI : 8
工程师 : 工程师—Chaossss, KPI : 6
工程师 : 工程师—Tiiime, KPI : 0
------------ CTO -------------
经理 : 王经理, 产品数量 : 1
工程师 : 工程师—Shawn.Xiong, 代码函数 : 87056
工程师 : 工程师—Kael, 代码函数 : 31188
工程师 : 工程师—Chaossss, 代码函数 : 32861
工程师 : 工程师—Tiiime, 代码函数 : 48380
```
