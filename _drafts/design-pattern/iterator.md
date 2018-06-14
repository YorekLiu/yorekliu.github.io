---
title: "迭代器模式(Iterator)"
excerpt: "提供一种方法顺序访问一个容器对象的各个元素，而又不需要暴露该对象的内部表示"
categories:
  - Design Patterns
tags:
  - Iterator
toc: true
toc_label: "目录"
toc_icon: "heart"
---

## 1. 定义及使用场景
提供一种方法顺序访问一个容器对象的各个元素，而又不需要暴露该对象的内部表示

使用场景  
- 遍历一个容器对象时

## 2. UML图
![iterator]({{ basepath }}/assets/images/design-pattern/iterator.png)

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
