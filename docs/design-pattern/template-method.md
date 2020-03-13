---
title: "模版方法模式(Template method)"
---

## 1. 定义及使用场景

**定义一个操作中算法的框架，而将一些步骤延迟到子类中，使得子类可以不改变一个算法的结构即可重新定义该算法的某些特定步骤**

使用场景  

- 多个子类有公有方法，而且逻辑基本相同时
- 重要、复杂的算法，可以把核心算法设计为模版方法，周边的相关细节功能则由各个子类实现
- 重构时，模板方法模式是一个经常使用的模式，把相同的代码抽取到父类中，然后通过钩子函数约束其行为

封装流程：将某个固定流程封装到一个final函数中，并且让子类能够定制这个流程的某些或者所有步骤，这就要求父类提供公用的代码，提升代码的复用率，同时也带来了更好的可扩展性。

模版方法模式是通过把不变行为搬移到超类中，去除子类中的重复代码来体现它的有优势。模板方法模式就是提供了一个很好的代码复用平台，当不变的和可变的行为在方法的子类实现中混合在一起的时候，不变的行为就会在子类中重复出现。通过模版方法模式把这些行为搬移到单一的地方，这样就帮助子类摆脱重复的不变行为的纠缠。

## 2. UML图

![模版方法模式UML图](/assets/images/design-pattern/template-method.png)  
<center>模版方法模式UML图</center>

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

## 4. 源码中的例子

在Android中，AsyncTask是比较常用的一个类型，这个类就使用了模板方法模式。关于AsyncTask更详细的分析，请参考[Android线程与线程池——AsyncTask](/android/framework/Android%E7%BA%BF%E7%A8%8B%E4%B8%8E%E7%BA%BF%E7%A8%8B%E6%B1%A0/#21-asynctask)，我们这里只分析在该类中使用的模板方法模式。在使用AsyncTask时，我们都知道把耗时的方法放在`doInBackground(Params...params)`中，在`doInBackground`之前，如果还想做一些类似初始化的操作，可以把实现写在`onPreExecute`方法中，当`doInBackground`方法执行完成后，会执行`onPostExecute`方法，而我们只需要构建AsyncTask对象，然后执行`execute`方法即可。我们可以看到，它整个执行过程其实是一个框架，具体的实现都需要子类来完成，而且它执行的算法框架是固定的，调用`execute`后会依次执行`onPreExecute`、`doInBackground`、`onPostExecute`。

另外一个典型例子就是Activity的生命周期方法了，Activity从启动到显示到窗口中会经历如下过程：`onCreate`、`onStart`、`onResume`，这就是一个典型的Activity启动流程，也是一个模板方法的运用。