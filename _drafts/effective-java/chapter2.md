---
title: "对于所有对象都通用的方法"
excerpt: "尽管Object是一个具体类，但是设计它们主要是为了扩展。它所有的非final方法都有明确的通用约定（general contract），因为它们被设计成是要被覆盖（override）的。本章将讲述何时以及如何覆盖这些非final的Object方法。"
categories:
  - Effective Java
toc: true
toc_label: "目录"
toc_icon: "heart"
---

## 第八条：覆盖equals时请遵守通用约定
覆盖`equals`方法看起来很简单，但是有许多覆盖方式会导致错误，并且后果非常严重。最容易避免这类问题的办法就是不覆盖`equals`方法，在这种情况下，类的每个实例都只与它自身相等。以下就是几个不需要覆盖`equals`方法的例子：
- **类的每个实例本质上都是唯一的。**对于代表活动实体而不是值（value）的类来说确实如此。例如`Thread`。Object提供的equals实现对于这些类来说正是正确的行为。  
- **不关心类是否提供了“逻辑相等（logical equality）”的测试功能。**例如，`java.util.Random`覆盖了`equals`，以检查两个`Random`实例是否产生相同的随机数序列，但是设计者并不认为客户端需要或者期望这样的功能。在这样的情况下，从`Object`继承得到的`equals`实现已经足够了。
- **超类已经覆盖了`equals`，从超类继承过来的的行为对于子类也是合适的。**例如，大多数的`Set`实现都从`AbstractSet`继承`equals`实现，`List`实现从`AbstractList`继承`equals`实现,`Map`实现从`AbstractMap`继承`equals`实现。
- **类是私有的或是包级私有的，可以确定它的`equals`方法永远也不会被调用。**在这种情况下，无疑是应该覆盖`equals`方法的，并直接抛出`AssertionError`，以防它被意外调用。

如果类具有自己特有的“逻辑相等”概念（不同于对象等同的概念），而且超类还没有覆盖`equals`以实现期望的行为，这时我们就需要覆盖`equals`方法。这通常属于“值类（value class）”的情形。值类仅仅是一个表示值的类，例如`Integer`或者`Date`。  
程序员在利用`equals`方法来比较值对象的引用时，希望知道它们在逻辑上是否相等，而不是想了解它们是否指向同一个对象。  
为了满足程序员的要求，不仅必需覆盖`equals`方法，而且这样做也使得这个类的实例可以被用作映射表（map）的键 （key），或者集合（set）的元素，使映射或者集合表现出预期的行为。

有一种“值类”不需要覆盖`equals`方法，即用实例受控（见第1条）确保“每个值至多只存在一个对象”的类。枚举类型（见第30条）就属于这种类。对于这样的类而言，逻辑相同与对象等同是一回事，因此`Object`的`equals`方法等同于逻辑意义上的`equals`方法。

下面是约定的内容，来自`Object`的规范[JavaSE6]：`equals`方法实现了等价关系（equivalence relation）:
- **自反性（reflexive）**。对于任何非null的引用值x，x.equals(x)必须返回true。
- **对称性（symmetric）**。对于任何非null的引用值x和y，当且仅当y.equals(x)返回true时，x.equals(y)必须返回true。
- **传递性（transitive）**。对于任何非null的引用之x、y和z，如果x.equals(y)返回true，并且y.equals(z)返回true，那么x.equals(z)也必须返回true。
- **一致性（consistent）**。对于任何非null的引用值x和y，只要equals的比较操作在对象中所用的信息没有被修改，多次调用x.equals(y)就会一致地返回true，或者一致地返回false。
- 对于任何非null的引用值x，x.equals(null)必须返回false。

> 如果`instanceof`的第一个操作符是null，那么不管第二个操作符是哪种类型，`instanceof`操作都会指定返回false。因此，如果把null传递给equals方法，类型检查就会返回false，所以就不需要单独的null检查。

下面是实现高质量`equals`方法的诀窍:
1. **使用==操作符检查“参数是否为这个对象的引用”。**如果是，则返回true。这只不过是一种性能优化，如果比较操作有可能很昂贵，就值得这么做。
2. **使用`instanceof`操作符检查“参数是否为正确的类型”。**一般来说，所谓“正确的类型”是指`equals`方法所在的那个类。有些情况下，是指该类所实现的某个接口。
3. **把参数转换成正确的类型。**
4. **对于该类中每个“关键（significant）域，检查参数中的域是否与该对象中对应的域相匹配”。**  
  对于对象引用域，可以递归调用`equals`方法判断  
  对于float，可以使用`Float.compare`方法；对于Double，可以使用`Double.compare`方法。因为float、double存在NaN、-0.0f类似的常量  
  对于数组，可以使用`Arrays.equals`方法  
  其他基本类型，可以使用==操作符进行判断
  域的比较顺序可能会影响到`equals`方法的性能。为了获得最佳的性能，应该最先比较最有可能不一致的域，或者是开销最低的域，最理想的情况是两个条件同时满足的域。
5. **当你编写完成了`equals`方法之后，应该问自己三个问题：它是不是对称的、传递的、一致的？**并且不要只是自问，还要编写单元测试来检验这些特性！

根据上述诀窍构建`equals`的具体例子，可以参考第九条`PhoneNumbers.equals`，下面是最后的一些告诫：
- **覆盖`equals`时总要覆盖`hashCode`**
- **不要企图让`equals`方法过于智能**——简单的测试域中的值是否相等即可，不要想过度地去寻求各种等价关系
- **不要将`equals`声明中的`Object`对象替换成其他的类型**

## 第九条：覆盖equals时总要覆盖hashCode


## 第十条：始终要覆盖toString

## 第十一条：谨慎地覆盖clone

## 第十二条：考虑实现Comparable接口
