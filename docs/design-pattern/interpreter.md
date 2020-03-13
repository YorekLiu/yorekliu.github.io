---
title: "解释器模式(Interpreter)"
---

## 1. 定义及使用场景

**给定一个语言，定义它的文法的一种表示，并定义一个解释器，该解释器使用该表示来解释语言中的句子**

使用场景  

- 如果某个简单的语言需要解释执行而且可以将该语言中的语句表示为一个抽象语法树时可以考虑使用解释器模式
- 在某些特定领域出现不断重复的问题时，可以将该领域的问题转化为一种语法规则下的语句，然后构建解释器来解释该语言

## 2. UML图

![解释器模式UML图](/assets/images/design-pattern/interpreter.png)  
<center>解释器模式UML图</center>

- AbstractExpression  
  抽象表达式。声明一个抽象的解释操作父类，并定义一个抽象的解释方法，其具体的实现在各个具体的子类解释器中完成
- TerminalExpression  
  终结符表达式。实现文法中与终结符有关的解释操作。文法中每一个终结符都具有一个具体的终结表达式与之对应
- NonterminalExpression  
  非终结符表达式。实现文法中与非终结符有关的解释操作。
- Context  
  包含解释器之外的全部信息
- Client  
  解析表达式，构建抽象语法树，执行具体的解释操作等

## 3. 举个例子
我们实现一个简单的算法表达式的解析。

```kotlin
abstract class ArithmeticExpression {

    abstract fun interpret(): Int
}

class NumberExpression(private val num: Int) : ArithmeticExpression() {

    override fun interpret() = num
}

abstract class OperatorExpression(
        protected val exp1: ArithmeticExpression,
        protected val exp2: ArithmeticExpression
) : ArithmeticExpression()

class AdditionExpression(
        exp1: ArithmeticExpression,
        exp2: ArithmeticExpression
) : OperatorExpression(exp1, exp2) {

    override fun interpret() = exp1.interpret() + exp2.interpret()
}

class Calculator(expression: String) {
    private val mExpStack = Stack<ArithmeticExpression>()

    init {
        var exp1: ArithmeticExpression
        var exp2: ArithmeticExpression

        val elements = expression.split(" ")

        var i = 0
        while (i < elements.size) {
            when (elements[i][0]) {
                '+' -> {
                    exp1 = mExpStack.pop()
                    exp2 = NumberExpression(Integer.valueOf(elements[++i]))
                    mExpStack.push(AdditionExpression(exp1, exp2))
                }

                else -> mExpStack.push(NumberExpression(Integer.valueOf(elements[i])))
            }
            i++
        }
    }

    fun calculate() = mExpStack.pop().interpret()
}

fun main(args: Array<String>) {
    val calc = Calculator("153 + 3589 + 118 + 555")
    println(calc.calculate())
}
```

输出结果如下
```text
4415
```
