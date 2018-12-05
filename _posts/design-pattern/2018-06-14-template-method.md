---
title: "模版方法模式(Template method)"
excerpt: "定义一个操作中算法的框架，而将一些步骤延迟到子类中，使得子类可以不改变一个算法的结构即可重新定义该算法的某些特定步骤"
categories:
  - Design Patterns
tags:
  - Template method
toc: true
toc_label: "目录"
last_modified_at: 2018-06-14T19:49:19+08:00
---

## 1. 定义及使用场景
定义一个操作中算法的框架，而将一些步骤延迟到子类中，使得子类可以不改变一个算法的结构即可重新定义该算法的某些特定步骤

使用场景  
- 多个子类有公有方法，而且逻辑基本相同时
- 重要、复杂的算法，可以把核心算法设计为模版方法，周边的相关细节功能则由各个子类实现
- 重构时，模板方法模式是一个经常使用的模式，把相同的代码抽取到父类中，然后通过钩子函数约束其行为

封装流程：将某个固定流程封装到一个final函数中，并且让子类能够定制这个流程的某些或者所有步骤，这就要求父类提供公用的代码，提升代码的复用率，同时也带来了更好的可扩展性。
{: .notice }

## 2. UML图
![template-method]({{ basepath }}/assets/images/design-pattern/template-method.png)

- AbsTemplate  
  抽象类，定义了一套算法框架
- ConcreteImplA  
  具体实现类A
- ConcreteImplB  
  具体实现类B

## 3. 举个例子
我们模拟一下计算机的启动流程。

```kotlin
abstract class AbstractComputer {
    protected open fun powerOn() {
        println("开启电源")
    }

    protected open fun checkHardware() {
        println("检查硬件")
    }

    protected open fun loadOS() {
        println("载入操作系统")
    }

    protected open fun login() {
        println("小白的计算机无验证，直接进入系统")
    }

    fun startUp() {
        println(" ------------ 开机 START ------------ ")
        powerOn()
        checkHardware()
        loadOS()
        login()
        println(" ------------ 开机  END  ------------ ")
    }
}

class CoderComputer : AbstractComputer() {
    override fun login() {
        println("程序员只需要进行用户和密码验证就可以了")
    }
}

class MilitaryComputer : AbstractComputer() {
    override fun checkHardware() {
        super.checkHardware()
        println("检查硬件防火墙")
    }

    override fun login() {
        println("进行指纹识别等复杂的用户验证")
    }
}

fun main(args: Array<String>) {
    var computer: AbstractComputer = CoderComputer()
    computer.startUp()

    computer = MilitaryComputer()
    computer.startUp()
}
```

输出结果如下
```text
------------ 开机 START ------------
开启电源
检查硬件
载入操作系统
程序员只需要进行用户和密码验证就可以了
------------ 开机  END  ------------
------------ 开机 START ------------
开启电源
检查硬件
检查硬件防火墙
载入操作系统
进行指纹识别等复杂的用户验证
------------ 开机  END  ------------
```
