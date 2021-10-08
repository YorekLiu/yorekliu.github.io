---
title: "迭代器模式(Iterator)"
---

## 1. 定义及使用场景

**提供一种方法顺序访问一个容器对象的各个元素，而又不需要暴露该对象的内部表示**

使用场景  

- 遍历一个容器对象时

当你需要访问一个聚集对象，而且不管这些对象是什么，都需要遍历的时候，你就应该考虑使用迭代器模式。当需要对聚集有多种方式遍历时，可以考虑使用迭代器模式。为遍历不同的聚集结构提供如开始、下一个、是否结束、当前哪一项等统一的接口。

## 2. UML图

![迭代器模式UML图](/assets/images/design-pattern/iterator.png)  
<center>迭代器模式UML图</center>

- Iterator  
  迭代器接口。迭代器接口负责定义、访问和遍历元素的接口
- ConcreteIterator  
  具体迭代器类。主要是实现迭代器接口并记录遍历的当前位置
- Aggregate  
  容器接口。负责提供创建具体迭代器角色的接口
- ConcreteAggregate  
  具体容器类。
- Client  
  客户类

## 3. 举个例子
使用迭代器模式兼容list与array容器。

```kotlin
data class Employee(
        var name: String,
        var age: Int,
        var sex: String,
        var title: String
)

interface Iterator<T> {
    fun hasNext(): Boolean

    fun next(): T
}

class HuiIterator(
        private val array: Array<Employee>
) : Iterator<Employee> {
    private var position = 0

    override fun hasNext() = !(position > array.size - 1)

    override fun next(): Employee {
        val e = array[position]
        position++
        return e
    }
}

class MinIterator(
        private val list: List<Employee>
) : Iterator<Employee> {
    private var position = 0

    override fun hasNext() = !(position > list.size - 1)

    override fun next(): Employee {
        val e = list[position]
        position++
        return e
    }
}

interface Company<T> {
    fun iterator(): Iterator<T>
}

class CompanyHui : Company<Employee> {
    private val array = arrayOf(
            Employee("辉哥", 108, "男", "程序员"),
            Employee("小红", 98, "男", "程序员"),
            Employee("小辉", 88, "男", "程序员")
    )

    fun getEmployees() = array

    override fun iterator(): Iterator<Employee> = HuiIterator(array)
}

class CompanyMin : Company<Employee> {
    private val list = listOf(
            Employee("小民", 96, "男", "程序员"),
            Employee("小芸", 22, "女", "测试"),
            Employee("小方", 18, "女", "测试"),
            Employee("可儿", 21, "女", "设计"),
            Employee("朗晴", 19, "女", "设计")
    )

    fun getEmployees() = list

    override fun iterator(): Iterator<Employee> = MinIterator(list)
}

fun main(args: Array<String>) {
    fun check(iterator: Iterator<Employee>) {
        while (iterator.hasNext()) {
            println(iterator.next().toString())
        }
    }

    val companyMin = CompanyMin()
    check(companyMin.iterator())

    val companyHui = CompanyHui()
    check(companyHui.iterator())
}
```

输出结果如下
```text
Employee(name=小民, age=96, sex=男, title=程序员)
Employee(name=小芸, age=22, sex=女, title=测试)
Employee(name=小方, age=18, sex=女, title=测试)
Employee(name=可儿, age=21, sex=女, title=设计)
Employee(name=朗晴, age=19, sex=女, title=设计)
Employee(name=辉哥, age=108, sex=男, title=程序员)
Employee(name=小红, age=98, sex=男, title=程序员)
Employee(name=小辉, age=88, sex=男, title=程序员)
```

## 4. 源码中的例子

迭代器这个模式对开发者来说几乎不会自己去实现一个迭代器，就拿Android来说，其除了各种数据结构体，如List、Map等所包含的迭代器外，Android自身源码中也为我们提供了迭代器遍历数据，最为典型的例子就是数据库查询使用Cursor，当我们使用SQLiteDatabase的query方法查询数据库时，会返回一个Cursor游标对象，该游标对象实质就是一个具体的迭代器，我们可以使用它来遍历数据库查询所得的结果集。