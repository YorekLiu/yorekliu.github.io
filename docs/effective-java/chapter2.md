---
title: "对于所有对象都通用的方法"
---

## 第八条：覆盖equals时请遵守通用约定
覆盖`equals`方法看起来很简单，但是有许多覆盖方式会导致错误，并且后果非常严重。最容易避免这类问题的办法就是不覆盖`equals`方法，在这种情况下，类的每个实例都只与它自身相等。以下就是几个不需要覆盖`equals`方法的例子：

- **类的每个实例本质上都是唯一的**。对于代表活动实体而不是值（value）的类来说确实如此。例如`Thread`。Object提供的equals实现对于这些类来说正是正确的行为。  
- **不关心类是否提供了“逻辑相等（logical equality）”的测试功能**。例如，`java.util.Random`覆盖了`equals`，以检查两个`Random`实例是否产生相同的随机数序列，但是设计者并不认为客户端需要或者期望这样的功能。在这样的情况下，从`Object`继承得到的`equals`实现已经足够了。
- **超类已经覆盖了`equals`，从超类继承过来的的行为对于子类也是合适的**。例如，大多数的`Set`实现都从`AbstractSet`继承`equals`实现，`List`实现从`AbstractList`继承`equals`实现,`Map`实现从`AbstractMap`继承`equals`实现。
- **类是私有的或是包级私有的，可以确定它的`equals`方法永远也不会被调用**。在这种情况下，无疑是应该覆盖`equals`方法的，并直接抛出`AssertionError`，以防它被意外调用。

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

1. **使用==操作符检查“参数是否为这个对象的引用”**。如果是，则返回true。这只不过是一种性能优化，如果比较操作有可能很昂贵，就值得这么做。
2. **使用`instanceof`操作符检查“参数是否为正确的类型”**。一般来说，所谓“正确的类型”是指`equals`方法所在的那个类。有些情况下，是指该类所实现的某个接口。
3. **把参数转换成正确的类型。**
4. **对于该类中每个“关键（significant）域，检查参数中的域是否与该对象中对应的域相匹配”。**  
  对于对象引用域，可以递归调用`equals`方法判断  
  对于float，可以使用`Float.compare`方法；对于Double，可以使用`Double.compare`方法。因为float、double存在NaN、-0.0f类似的常量  
  对于数组，可以使用`Arrays.equals`方法  
  其他基本类型，可以使用==操作符进行判断
  域的比较顺序可能会影响到`equals`方法的性能。为了获得最佳的性能，应该最先比较最有可能不一致的域，或者是开销最低的域，最理想的情况是两个条件同时满足的域。
5. **当你编写完成了`equals`方法之后，应该问自己三个问题：它是不是对称的、传递的、一致的**？并且不要只是自问，还要编写单元测试来检验这些特性！

根据上述诀窍构建`equals`的具体例子，可以参考第九条`PhoneNumbers.equals`，下面是最后的一些告诫：

- **覆盖`equals`时总要覆盖`hashCode`**
- **不要企图让`equals`方法过于智能**——简单的测试域中的值是否相等即可，不要想过度地去寻求各种等价关系
- **不要将`equals`声明中的`Object`对象替换成其他的类型**

## 第九条：覆盖equals时总要覆盖hashCode
一个很常见的错误根源在于没有覆盖`hashCode`方法。在每个覆盖了`equals`方法的类中，也必须覆盖`hashCode`方法。如果不这样做的话，就会违反`Object.hashcode`的通用约定，从而导致该类无法结合所有基于散列的集合一起正常工作，这样的集合包括`HashMap`、`HashSet`和`Hashtable`。

下面是约定的内容，摘自`Object`规范[JavaSE6]：

- 在应用程序的执行期间，只要对象的`equals`方法的比较操作所用到的信息没有被修改，那么对同一个对象调用多次，`hashCode`方法都必须始终如一地返回同一个整数。在同一个应用程序的多次执行过程中，每次执行所返回的整数可以不一致。
- 如果两个对象根据`equals(Object)`方法比较是相等的，那么调用这两个对象中任意一个对象的`hashCode`方法都必须产生同样的整数结果。
- 如果两个对象根据个对象的`hashCode`方法比较是不相等的，那么调用这两个对象中任意一方法，则不一定要产生不同的整数结果。但是程序员应该知道，给不相等的对象产生截然不同的整数结果，有可能提高散列表（hash table）的性能。

**因没有覆盖`hashCode`而违反的关键约定是第二条：相等的对象必须具有相等的散列码（hash code）。**

```java
// The worst possible legal hash function - never use!
@Override public int hashCode() { return 42; }
```

上面这个`hashCode`方法是合法的，因为它确保了相等的对象总是具有同样的散列码。但它也极为恶劣，因为它使得每个对象都具有同样的散列码。因此，每个对象都被映射到同一个散列桶中，使散列表退化为链表（linked list）。它使得本该线性时间运行的程序变成了以平方级时间在运行。对于规模很大的散列表而言，这会关系到散列表能否正常工作。

一个好的散列函数通常倾向于“为不相等的对象产生不相等的散列码”。这正是`hashCode`约定中第三条的含义。理想情况下，散列函数应该把集合中不相等的实例均匀地分不到所有可能的散列值上。要想完全达到这种理想的情形是非常困难的。幸运的是，相对接近这种理想情形则并不太苦难。下面给出一种简单的解决办法：

1. 把某个非零的常数值，比如说17，保存在一个名为result的`int`类型的变量中。
2. 对于对象中每个关键域`f`（指`equals`方法中涉及的每个域），完成以下步骤：  
  a. 为该域计算`int`类型的散列码`c`:  
   i. 如果该域是`boolean`类型，则计算 `(f ? 1 : 0)`  
   ii. 如果该域是`byte`、`char`、`short`或者`int`类型，则计算`(int)f`  
   iii. 如果该域是`long`类型，则计算`(int)(f ^ (f >>> 32))`  
   iv. 如果该域是`float`类型，则计算`Float.floatToIntBits(f)`  
   v. 如果该域是`double`为得到的`long`类型，则计算`Double.doubleToLongBits(f)`，然后按照步骤2.a.iii，类型值计算散列值  
   vi. 如果该域是一个对象引用，并且该域的`equals`方法通过递归地调用`equals`的方式来比较这个域，则同样为这个域递归地调用`hashCode`。如果需要更复杂的比较，则为这个域计算一个“范式（canonical representation）”，然后针对这个范式调用`hashCode`。如果这个域的值为`null`，则返回0（或者其他某个常数，但通常是0）  
   vii. 如果该域是一个数组，则要把每一个元素当做单独的域来处理。也就是说，递归地应用上述规则，对每个重要的元素计算一个散列码，然后根据步骤2.b中的做法把这些散列值组合起来。如果数组域中的每个元素都很重要，可以利用发行版本1.5中增加的其中一个`Arrays.hashCode`方法  
 b. 按照下面的公式，把步骤2.a中计算得到的散列码`c`合并到`result`中:  
 `result = 31 * result + c;`  
3. 返回`result`  
4. 写完了`hashCode`方法之后，问问自己“相等的实例是否都具有相等的散列码”。要编写单元测试来验证你的推断。如果相等实例有着不相等的散列码，则要找出原因，并修正错误

在散列码的计算过程中，**可以把冗余域`（redundant field）`排除在外**。换句话说，如果一个域的值可以根据参与计算的其他域值计算出来，则可以把这样的域排除在外。**必须排除`equals`比较计算中没有用到的任何域**，否则很有可能违反`hashCode`约定的第二条。

上述步骤1中用到了一个非零的初始值，因此步骤2.a中计算的散列值为0的那些初始域，会影响到散列值。如果步骤1中的初始值为0，则整个散列值将不受这些初始域的影响，因为这些初始域会增加冲突的可能性。值17则是任选的。

步骤2.b中的乘法部分使得散列值依赖于域的顺序，如果一个类包含多个相似的域，这样的乘法运算就会产生一个更好的散列函数。例如，如果`String`散列函数省略了这个乘法部分，那么只是字母顺序不同的所有字符串都会有相同的散列码。**之所以选择31，是因为它是一个奇素数。如果乘数是偶数，并且乘法溢出的话，信息就会丢失，因为与2相乘等价于位移运算。使用素数的好处并不很明显，但是习惯上都使用素数来计算散列结果。**31有个很好的特性，即用位移和减法来代替乘法，可以得到更好的性能，`31 * i == (i << 5) - i`。现代的VM可以自动完成这种优化。

举个例子：
```java
@Override public int hashCode() {
  int result = 17;
  result = 31 * result + areaCode;
  result = 31 * result + prefix;
  result = 31 * result + lineNumber;
  return result;
}
```

如果一个类是不可变的，并且计算散列码的开销也比较大，就应该考虑把散列码缓存在对象内部，而不是每次请求的时候都重新计算散列码。如果你觉得这种类型的大多数对象会被用作散列键（hash keys），就应该在创建实例的时候计算散列码。否则，可以选择“延迟初始化（lazily initialize）”散列码，一直到`hashCode`被第一次调用的时候才初始化（见第71条）。现在尚不清楚我们的`PhoneNumber`类是否值得这样处理，但可以通过它来说明这种方法该如何实现：
```java
// Lazily initialized, cached hashCode
private volidate int hashCode; // (See item 71)

@Override public int hashCode() {
  int result = hashCode;
  if (result == 0) {
    result = 31 * result + areaCode;
    result = 31 * result + prefix;
    result = 31 * result + lineNumber;
    hashCode = result;
  }
  return result;
}
```

**不要试图从散列码计算中排除掉一个对象的关键部分来提高性能**。虽然这样的散列函数运行 起来可能更快，但是它的效果不见得会好，可能会导致散列表慢到根本无法使用。特别是在实践中，散列函数可能面临大量的实例，在你选择忽略的区域中，这些实例仍然区别非常大。如果是这样，散列函数就会把所有这些实例映射到极少数的散列码上，基于散列的集合将会显示出平方级的性能指标。这不仅仅是个理论问题。在Java 1.2发行版本之前实现的`String`散列函数至多只检查16个字符，从第一个字符开始，在整个字符串中均匀选取。对于像URL这种层次状名字的大型集合，该散列函数正好表现出了这里所提到的病态行为。

## 第十条：始终要覆盖toString
虽然`java.lang.Object`提供了`toString`方法的一个实现，但它返回的字符串通常不是类的用户所期望看到的。它包含类的名称，以及一个“@”符号，接着是散列码的无符号十六进制表示
法。例如“PhoneNumber@163b91”。`toString`的通用约定之处，被返回的字符串应该是一个“简洁的，但信息丰富，并且易于阅读的的表达形式”[JavaSE6]。尽管有人认为“
PhoneNumber@163b91”算得上是简洁和易于阅读了，但是与“(707)867-5309”比较起来，它还算不上是信息丰富的。`toString`的约定进一步之处，“建议所有的子类都覆盖这个方法。”这是一个很好的建议，真的！

虽然遵守`toString`的约定并不像遵守`equals`和`hashCode`的约定（见第8条和第9条）那么重要，但是，提供好的`toString`实现可以使类用起来更加舒适。当对象被传递给`println`、`printf` 、字符串联操作符（+）以及`assert`或者被调试器打印出来时，`toString`方法会被自动调用。（Java 1.5发行版本在平台中增加了`printf`方法，还提供了包括`String.format`的相关方法，与C语言中的`sprint`相似。）

**在实际应用中，`toString`方法应该返回对象中包含的所有值得关注的信息**，譬如上述电话号码例子那样。如果对象太大，或者对象中包含的状态信息难以用字符串来表达，这样做就有点不切实际。在这种情况下，**toString应该返回一个摘要信息**，例如“Manhattan white pages
(1487536 listings)”或者“Thread[main, 5, main]”。理想情况下，字符串应该是自描述的（self-explanatory），（Thread例子不满足这样的要求。）

**在实现`toString`的时候，必须要做出一个很重要的决定：是否在文档中指定返回值的格式**。对于值类（value class），比如电话号码类、矩阵类，也建议这么做。指定格式的好处是，它可以被用作一种标准的、明确的、适合人阅读的对象表示法。这种表示法可以用于输入和输出，以及用在永久的适合人类阅读的数据对象中。例如XML文档。如果你指定了格式，最后再提供一个相匹配的静态工厂或者构造器，以便程序员可以很容易地在对象和它的字符串表示法之间来回转换。Java平台类库中的许多值类都采用了这种做法，包括`BigInteger`、`BigDecimal`和绝大多数苏的基本类型包装类（boxed primitive class）。

指定`toString`返回值的格式也有不足之处：如果这个类已经被广泛使用，一旦指定格式，就必须始终如一地坚持这种格式。程序员将会编写出相应的代码来解析这种字符串表示法、产生字符串表示法，以及把字符串表示法嵌入到持久的数据中。如果将来的发行版本中改变了这种表示法，就会破坏他们的代码和数据，他们当然会抱怨。如果不指定格式，就可以保留灵活性，便于在将来的发行版本中增加信息，或者改进格式。

**无论你是否决定指定格式，都应该在文档中明确的表明你的意图**。如果你要指定格式，则应该严格地这样去做。例如，下面是第9条中`PhoneNumber`类的`toString`方法：

```java
/**
 * Returns the string representation of this phone number.
 * The string consists of fourteen characters whose format
 * is "(XXX) YYY-ZZZZ", where XXX is the area code. YYY is
 * the prefix, and ZZZZ is the line number.(Each of the
 * capital letters represents a single decimal digit.)
 *
 * If any of the three parts of this phone number is too small
 * to fill up its field, the field is padded with leading zeros.
 * For example, if the value of the line number is 123, the last
 * four characters of the string representation will be "0123".
 *
 * Note that there is a single space separating the closing
 * parenthesis after the area code from the first digit of the
 * prefix.
 */
@Override public String toString() {
    return String.format("(%03d) %03d-%04d",
                        areaCode, prefix, lineNumber);
}
```

如果你决定不指定格式，那么文档注释部分也应该有如下所示的指示信息：

```java
/**
 * Returns a brief description of this potion. The exact details
 * of the representation are unspecified and subject to change,
 */
@Override public String toString() { ... }
```

对于那些依赖于格式的细节进行编程或者产生永久数据的程序员，在读到这段注释之后，一旦格式被改变，则只能自己承担后果。  
无论是否指定格式，都为 **返回值中包含的所有信息，提供一种编程式的访问途径**。例如，`PhoneNumber`类应该包含针对`area code`、`prefix`和`line number`的访问方法。如果不这么做，就会迫使那些需要这些信息的程序员不得不自己去解析这些字符串。除了降低了程序的性能，使得程序员们去做这些不必要的工作之外，这个解析过程也很容易出错，会导致系统不稳定，如果格式发生变化，还会导致系统崩溃。如果没有提供这些访问方法，即使你已经指明了字符串的格式是可以变化的，这个字符串格式也成了事实上的API。

## 第十一条：谨慎地覆盖clone
`Cloneable`接口的目的是作为对象的的一个mixin接口（mixin interface）（见第18条），表明这样的对象允许克隆（clone）。遗憾的是，它并没有成功地达到这个目的。其主要的缺陷在 于，它缺少一个`clone`方法，Object的`clone`方法是受保护的。如果不借助于反射（reflection）（见第53条），就不能仅仅因为一个对象实现了`Cloneable`，就可以调用`clone`方法。即使是反射调用也可能会失败，因为不能保证该对象一定具有可访问的`clone`方法。尽管存在这样那样的缺陷，这项设施仍然被广泛地使用着，因此值得我们进一步地了解。

既然`Cloneable`并没有包含任何方法，那么它到底有什么作用呢？它决定了`Object`中受保护的`clone`方法实现的行为：如果一个类实现了`Cloneable`，`Object`的`clone`方法就返回该对象的逐域拷贝，否则就会抛出`CloneNotSupportedException`异常。**这是接口的一种极端非典型的用法，也不值得效仿**。通常情况下，实现接口是为了表明类可以为它的客户做些什么。然而，对于`Cloneable`接口，它改变了超类中受保护的方法的行为。

如果实现`Cloneable`接口是要对某个类起到租用，类和它的所有超类都必须遵守一个相当复杂的、不可实施的，并且基本上没有文档说明的协议。由此得到一种语言之外的（extralinguistic）机制：无需调用构造器就可以创建对象。

`Clone`方法的通用约定是非常弱的，下面是来自`java.lang.Object`规范中的约定内容[JavaSE6]：  
创建和返回对象的一个拷贝。这个“拷贝”的精确含义取决于该对象的类。一般的含义是，对于任何对象x，表达式  
```java
x.clone() != x
```
将会是true，并且，表达式
```java
x.clone().getClass() == x.getClass()
```
将会是true，但这些都不是绝对的要求。虽然通常情况下，表达式
```java
x.clone().equals(x)
```
将会是true，但是，这也不是一个绝对的要求。拷贝对象的往往会导致创建它的类的一个新实例，但它同时也会要求拷贝内部的数据结构。这个过程中没有调用构造器。

这个约定存在几个问题。“不调用构造器”的规定太强硬了。行为良好的`clone`方法可以调用构造器来创建对象，构造之后再复制内部数据。如果这个类是`final`的，`clone`甚至可能会返回一个由构造器创建的对象。

然而，`x.clone().getClass()`通常应该等同于`x.getClass()`的规定又太软弱了。在实践中，程序员会假设：如果他们扩展了一个类，并且从子类中调用了`super.clone`，返回的对象就将`x.clone().getClass()`是该子类的实例。超类能够提供这种功能的唯一途径是，返回一个通过调用`super.clone`而得到的对象。如果`clone`方法返回一个由构造器创建的对象，它就得到有错误的类。因此，**如果你覆盖了非`final`类中的`clone`方法，则应该返回一个通过调用`super.clone`而得到的对象**。如果类的所有超类都遵守这条规则，那么调用`super.clone`最终会调用`Object`的`clone`方法，从而创建出正确类的实例。这种机制大体上类似于自动的构造器调用链，只不过它不是强制要求的。

从1.6发行版本开始，`Cloneable`哪些责任。**实际上，对于实现了接口并没有清楚地指明，一个类在实现这个接口时应该承担`Cloneable`的类，我们总是期望它提供一个功能适当的公有的`clone`方法**。通常情况下，除非该类的所有超类都提供了行为良好的`clone`实现，无论是公有的还是受保护的，否则，都不可能这么做。

假设你希望在一个类中实现`Cloneable`，并且它的超类都提供行为良好的`Clone`方法。你从` super.clone()`中得到的对象可能会接近于最终要返回的对象，也可能相差甚远，这要取决于这个类的本质。从每个超类的角度来看，这个对象将是原始对象功能完整的克隆`（clone）`。在这个类中声明的域（如果有的话）将等同于被克隆对象中相应的域。如果每个域包含一个基本类型的值，或者包含一个指向不可变对象的引用，那么被返回对象则可能正是你所需要的对象，在这种情况下不需要再做进一步处理。例如，第9条中的`PhoneNumber`类正是如此。在这种情况下，你所需要做的，除了声明实现了`Cloneable`之外，就是对`Object`中受保护的`clone`方法提供公有的访问途径：
```java
@Override public PhoneNumber clone() {
    try {
        return (PhoneNumber) super.clone();
    } catch (CloneNotSupportedException e) {
        throw new AssertionError(); // Can't happen
    }
}
```
注意上述的`clone`方法返回的是`PhoneNumber`，而不是`Object`。从Java 1.5发行版本开始，这么做是合法的，也是我们所期待的，因为1.5发行版本中引入了协变返回类型（covariant return type）作为泛型。换句话说，目前覆盖方法的返回类型可以是被覆盖方法的返回类型的 子类了。这样有助于覆盖方法提供更多关于被返回对象的信息，并且在客户端中不必进行转换。由于`Object.clone`返回`Object`，`PhoneNumber.clone`必须在返回`super.clone()`的结果之前将它转换。这里提现了一条通则：**永远不要让客户去做任何类库能够替客户完成的事情**。

如果对象中包含的域引用了可变的对象，使用上述这种简单的的后果。例如，考虑第6条中的`Stack`类：

```java
public class Stack {
    private Object[] elements;
    private int size = 0;
    private static final int DEFAULT_INITIAL_CAPACITY = 16;

    public Stack() {
        this.elements = new Object[DEFAULT_INITIAL_CAPACITY];
    }

    public void push(Object e) {
        ensureCapacity();
        elements[size++] = e;
    }

    public Object pop() {
        if (size == 0)
            throw new EmptyStackException();
        Object result = elements[--size];
        elements[size] = null; // Eliminate obsolete reference
        return result;
    }

    // Ensure space for at least one more element.
    private void ensureCapacity() {
        if (elements.length == size)
           elements = Arrays.copyOf(elements, 2 * size + 1);
     }
}
```
假设你希望把这个类做成可克隆的（cloneable）。如果它的`clone`方法仅仅返回`super.clone()`，这样得到的`Stack`实例，在其size域中具有正确的值，但是它的域将引用与原始`Stack`实例相同的数组。修改原始的实例会破坏被克隆对象中的约束条件，反之亦然。很快你就会发现，这个程序将产生毫无意义的结果，或者抛出`NullPointerException`异常。

如果调用`Stack`类中唯一的构造器，这种情况就永远不会发生。**实际上，`clone`方法就是另一个构造器；你必须确保它不会伤害到原始的对象，并确保正确地创建被克隆对象中的约束条件（invariaant）**。为了使`Stack`类中的`clone`方法正常地工作，它必须要拷贝栈的内部信息。最容易的做法是，在elements数组中递归的调用`clone`：
```java
@Override public Stack clone() {
    try {
        Stack result = (Stack) super.clone();
        result.elements = elements.clone();
        return result;
    } catch (CloneNotSupportedException e) {
        throw new AssertionError();
    }
}
```
注意，我们不一定要将`elements.clone()`的结果转换成`Object[]`。自Java 1.5发行版本起，在数组上调用`clone`返回的数组，其编译时类型与被克隆数组的类型相同。

还要注意，如果`elements`域是`final`的，上述方案就不能正常工作，因为`clone`方法是被禁止给`elements`域赋新值的。这是个根本的问题：**`clone`架构与引用可变对象的`final`域的正常用法是不相兼容的**，除非在原始对象和克隆对象之间可以安全地共享此可变对象。为了使类成为可克隆的，可能有必要从某些域中去掉`final`修饰符。

递归地调用`clone`有时还不够。例如，假设你正在为一个散列表编写`clone`方法，它的内部数据包含一个散列通数组，每个散列通都指向“键——值”对链表的第一个项，如果桶是空的，则为`null`。出于性能方面的考虑，该类实现了它自己的轻量级单向链表，而没有使用Java内部的 `java.util.LinkedList`。该类如下：
```java
public class HashTable implements Cloneable {
    private Entry[] buckets = ...;
    private static class Entry {
        final Object key;
        Object value;
        Entry next;

        Entry(Object key, Object value, Entry next) {
            this.key = key;
            this.value = value;
            this.next = next;
        }
    }

    ... // Remainder omitted
}
```
假设你仅仅递归地克隆这个散列桶数组，就像我们对`Stack`类所做的那样：
```java
// Broken - results in shared internal state!
@Override public HashTable clone() {
    try {
        HashTable result = (HashTable) super.clone();
        result.buckets = buckets.clone();
        return result;
    } catch (CloneNotSupportedException e) {
        throw new AssertionError();
    }
}
```
虽然被克隆对象有它自己的散列桶数组，但是，这个数组引用的链表与原始对象是一样的，从而很容易引起克隆对象和原始对象中不确定的行为。为了修正这个问题，必须单独地拷贝并组成每个桶的链表。下面是一种常见的做法：
```java
public class HashTable implements Cloneable {
    private Entry[] buckets = ...;
    private static class Entry {
        final Object key;
        Object value;
        Entry next;

        Entry(Object key, Object value, Entry next) {
            this.key = key;
            this.value = value;
            this.next = next;
        }

        // Recursively copy the linked list headed by this entry
        Entry deepCopy() {
            return new Entry(key, value,
                next == null ? null : next.deepCopy());
        }
    }

    @Override public HashTable clone() {
        try {
            HashTable result = (HashTable) super.clone();
            result.buckets = new Entry[buckets.length];
            for (int i = 0; i < buckets.length; i++)
                if (buckets[i] != null)
                    result.buckets[i] = buckets[i].deepCopy();
            return result;
        } catch (CloneNotSupportedException e) {
            throw new AssertionError();
        }
    }

    ... // Remainder omitted
}
```
私有类`HashTable.Entry`被加强了，它支持一个“深度拷贝（deep copy）”方法。`HashTable`上的`clone`方法分配了一个大小适中的、新的`buckets`数组，并且遍历原的` buckets`数组，对每一个非空散列桶进行深度拷贝。`Entry`类中的深度拷贝方法递归地调用它自身，以便拷贝整个链表（它是链表的头结点）。虽然这种方法很灵活，如果散列桶不是很长的话，也会工作得很好，但是，这样克隆一个链表并不是一个好方法，因为针对列表中的每个元素，它都要消耗一段栈空间。如果链表比较长，这很容易导致栈溢出。为了避免发生这种情况，你可以在`deepCopy`中用迭代（iteration）代替递归（recursion）：
```java
// Iteratively copy the linked list headed by this Entry
Entry deepCopy() {
    Entry result = new Entry(key, value, next);

    for (Entry p = result; p.next != null; p = p.next)
        p.next = new Entry(p.next.key, p.next.value, p.next.next);

    return result;
}
```
克隆复杂对象的最后一种办法是，先调用`super.clone`，然后把结果对象中的所有域都设置为 它们的空白状态（virgin state），然后调用高层（higher-level）的方法来重新产生对象的状态。在我们的`HashTable`例子中，`buckets`域将被初始化为一个新的散列桶数组，然后，对于正在被克隆的散列表中的每一个键——值映射，都调用`put(key, value)`方法（上面没有给
出其代码）。这种做法往往会产生一个简单、合理且相当优美的`clone`方法，但是它运行起来通常没有“直接操作对象及其克隆对象的内部状态的`clone`方法”快。

如同构造器一样，`clone`方法不应该在构造的过程中，调用新对象中任何非`final`的方法（见第17条）。如果`clone`调用了一个被覆盖的方法，那么在该方法所在的子类有机会修正它在克隆对象中的状态之前，该方法就会先被执行，这样很有可能会导致克隆对象和原始对象之间的不一致。因此，上一段落中讨论到的`put(key, value)`方法应该要么是`final`的，要么是私有的（如果是私有的，它应该算是非`final`公有方法的“辅助方法[helper method]”）。

`Object`的`clone`方法被声明为可抛出`CloneNotSupportedException`异常，但是，覆盖版本的`clone`方法可能会忽略这个声明。公有的`clone`方法应该省略这个声明，因为不会抛出受检异常（checked exception）的方法与会抛出异常的方法相比，使用起来更加轻松（见第59条）。如果专门为了继承而设计的类[见第17条]覆盖了`clone`方法，覆盖版本的`clone`方法 就应该模拟`Object.clone`的行为：它应该被声明为`protected`、抛出`CloneNotSupportedException`异常，并且该类不应该实现`Cloneable`接口。这样做可以使子类具有实现或者不实现`Cloneable`接口的自由，就仿佛它们直接扩展了`Object`一样。

还有一点值得注意。如果你决定用线程安全的类实现`Cloneable`接口，要记得它的`clone`方 法必须得到很好的同步，就像任何其他方法一样（见第66条）。`Object`的`clone`方法没有同步，因此即使很满意，可能也必须编写同步的`clone`方法来调用`super.clone`。

**简而言之，所有实现了`Cloneable`接口的类都应该用一个公有的方法覆盖`clone`。此公有方法首先调用`super.clone`，然后修正任何需要修正的域。一般情况下，这意味着要拷贝任何包含内部“深层结构”的可变对象，并用指向新对象的引用代替原来指向这些对象的引用。虽然，这些内部拷贝操作往往可以通过递归地调用`clone`来完成，但这通常并不是最佳方法。如果该类只包含基本类型的域，或者指向不可变对象的引用，那么多半的情况是没有域需要修正。这条规则也有例外，譬如，代表序号或者其他唯一ID值的域，或者代表对象的创建时间的域，不管这些域是基本类型还是不可变的，它们也都需要被修正**。

真的有必要这么复杂吗？很少有这种必要。如果你扩展一个实现`Cloneable`接口的类，那么你除了实现一个行为良好的`clone`方法外，没有别的选择。否则，最好提供某些其他的途径来代替对象拷贝，或者干脆不提供这样的功能。例如，对于不可变类，支持对象拷贝并没有太大的意义，因为被拷贝的对象与原始对象没有实质的不同。

**另一个实现对象拷贝的好办法是提供一个拷贝构造器（copy constructor）或拷贝工厂（copy factory）**。拷贝构造器只是一个构造器，它唯一的参数类型是包含该构造器的类，例如：
```java
public Yum(Yum yum);
```
拷贝工厂是类似于拷贝构造器的静态工厂：
```java
public static Yum newInstance(Yum yum);
```
拷贝构造器的做法，及其静态工厂方法的变型，都比`Cloneable/clone`方法具有更多的优势：它们不依赖于某一种很有风险的、语言之外的对象创建机制；它们不要求遵守尚未制定好文档的规范；它们不会与`final`域的正常使用发生冲突；它们不会抛出不必要的受检异常（checked exception）；它们不需要进行类型转换。*虽然你不可能把拷贝构造器或者静态工厂放到接口中，但是由于`Cloneable`接口缺少一个公有的`clone`方法，所以它也没有提供一个接口该有的功能*。因此，使用拷贝构造器或者拷贝工厂来代替`clone`方法时，并没有放弃接口的功能特性。

更进一步，拷贝构造器或者拷贝工程可以带一个参数，参数类型是通过该类实现的接口。例如，按照惯例，所有通用集合实现都提供了一个拷贝构造器，它的参数类型为`Collection`或者`Map`。基于接口的拷贝构造器和拷贝工厂（更准确的叫法应该是“转换构造器（conversion constructor）”和转换工厂（conversion fatory）），允许客户选择拷贝的实现类型，而不是强迫客户接受原始的实现类型。例如，假设你有一个`HashSet`，并且希望把它拷贝成一个`TreeSet`。`clone`方法无法提供这样的功能，但是用转换构造器很容易实现：`new TreeSet(s)`。

既然`Cloneable`接口具有上述那么多问题，可以肯定地说，其他的接口都不应该扩展（extend）这个接口，为了继承而设计的类（见第17条）也不应该实现（implement）这个接口。由于它具有这么多的缺点，有些专家级的程序员干脆从来不去覆盖`clone`方法，也从来不去调用它，除非拷贝数组。你必须清楚一点，对于一个专门为了继承而设计的类，如果你未能提供行为良好的受保护的（protected）`clone`方法，它的子类就不可能实现`Cloneable`接口。


## 第十二条：考虑实现Comparable接口
与本章中讨论的其他方法不同，`compareTo`方法并没有在`Object`中声明。相反，它是` Comparable`接口中唯一的方法。`compareTo`方法不但允许进行简单的等同行比较，而且允许执行顺序比较，除此之外，它与`Object`的`equals`方法具有相似的特征，它还是个泛型。类实现了`Comparable`接口，就表明它的实例具有内在的排序关系（natural ordering）。为实现`Comparable`接口的对象数组进行排序就这么简单：
```java
Arrays.sort(a);
```
对存储在集合中的`Comparable`对象进行搜索、计算极限值以及自动维护也同样简单。例如，下面的程序依赖于`String`实现了`Comparable`接口，它去掉了命令行参数列表中的重复参数，并按字母顺序打印出来：
```java
public class WordList {
    public static void main(String[] args) {
        Set<String> s = new TreeSet<String>();
        Collections.addAll(s, args);
        System.out.println(s);
    }
}
```
一旦类实现了`Comparable`接口，它就可以跟许多泛型算法（generic algorithm）以及依赖于该接口的集合实现（collection implementation）进行写作。你付出很小的努力就可以获得非常强大的功能。事实上，Java平台类库中的所有值类（value classes）都实现 了`Comparable`接口。如果你正在编写一个值类，它具有非常明显的内在排序关系，比如按字母排序、按数值顺序或者按年代顺序，那你就应该坚决考虑实现这个接口：
```java
public interface Comparable<T> {
   int compareTo(T t);
}
```
`compareTo`方法的通用约定与`equals`方法的相似：  
将这个对象与指定的对象进行比较。当该对象小于、等于或大于指定对象的时候，分别返回一个负整数、零或者正整数。如果由于指定对象的类型而无法与该对象进行比较，则抛出`ClassCastException`异常。  
在下面的说明中，符号`sgn`（表达式）表示数学中的`signum`函数，它根据表达式（expression）的值为负值、零和正值，分别返回-1、0或1。  
- 实现者必须确保所有的x和y都满足`sgn(x.compareTo(y) == -sgn(y.compareTo(x)))` 。（这也暗示着，当且仅当`y.compareTo(x)`抛出异常时， `x.compareTo(y)`才必须抛出异常。）
- 实现者还必须确保这个比较关系是可传递的：`x.compareTo(y) > 0 && y.compareTo(z) > 0`暗示着`x.compareTo(z) > 0`。
- 最后，实现者必须确保`x.compareTo(y) == 0`暗示着所有的z都满足`sgn(x.compareTo(z)) == sgn(y.compareTo(z))`。
- 强烈建议，但这并非绝对必要。一般说来，任何实现了`Comparable`接口的类，若违反了这个条件，都应该明确予以说明。推荐使用这样的说法：“注意，该类具有内在的排序功能，但是与`equals`不一致。”

千万不要被上述约定中的数学关系所迷惑。如同`equals`约定（见第8条）一样，`compareTo`约定并没有它看起来的那么复杂。在类的内部，任何合理的顺序关系都可以 满足`compareTo`约定。与`equals`不同的是，在跨越不同类的时候，`compareTo`可以不做比较：如果两个被比较的对象引用不同类的对象，`compareTo`可以抛出`ClassCastException`异常。通常，这正是`compareTo`在这种情况下应该做的事情，如果类设置了正确的参数，这也正是它所要做的事情。虽然以上约定并没有把跨类之间的比较排除在外，但是从Java 1.6发行版本开始，Java平台类库中就没有哪个类有支持这种特性了。

就好像违反了`hashCode`约定的类会破坏其他依赖于散列做法的类一样，违反`compareTo`约定的类也会破坏其他依赖于比较关系的类。依赖于比较关系的类包括有序集合类`TreeSet`和`TreeMap`，以及工具类`Collections`和`Arrays`，它们内部包含有搜索和排序算法。

前三个条款的一个直接结果是，由`compareTo`方法施加的等同性测试（equality set）也一定遵守相同于`equals`约定所施加的限制条件：自反性、对称性和传递性。因此，下面的告诫也同样适用：无法在用新的值组件扩展可实例化的类时，同时保持`compareTo`约定，除非愿意放弃面向对象的抽象优势（见第8条）。针对`equals`的权宜之计也同样适用于`compareTo`方法。如果你想为一个实现了`Comparable`接口的类增加值组件，请不要扩展这个类；而是要编写一个不相关的类，其中包含第一个类的一个实例。然后提供一个“视图 （view）”方法返回这个实例。这样既可以让你自由地在第二个类上实现`compareTo`方法，同时也允许它的客户端在必要的时候，把第二个类的实例视同第一个类的实例。

`compareTo`约定的最后一段是一个强烈的建议，而不是真正的规则，只是说明了`compareTo`方法施加的等同性测试，在通常情况下应该返回与`equals`方法同样的结果。如果遵守了这一条，那么由`compareTo`方法所施加的顺序关系就被认为“与`equals`一致（consistent with equals）”。如果违反了这条规则，顺序关系就被认为“与`equals`不一致（inconsistent with equals）”。如果一个类的`compareTo`方法施加了一个与`equals`方法不一致的顺序关系，它仍然能够正常工作，但是，如果一个有序集合（sorted collection）包含了该类的元素，这个集合就可能无法遵守相应结合接口（ Collection 、 Set或Map）的通用约定。这是因为，**对于这些接口的通用约定是按照`equals`方法来定义的，但是有序集合使用了由`compareTo`方法而不是`equals`方法所施加的等同性测试**。尽管出现这种情况不会造成灾难性的后果，但是应该有所了解。

例如，考虑`BigDecimal`类，它的`compareTo`方法与`equals`不一致。如果你创建了一个HashSet实例，并且添加`new BigDecimal("1.0")`和`new BigDecimal("1.0")`，这个集合就将包含两个元素，因为新增到集合中的两个`BigDecimal`实例，通过`equals`方法来比较时是不相等的。然而，如果你使用`TreeSet`而不是`HashSet`来执行同样的过程，集合中将只包含一个元素，因为这两个`BigDecimal`实例在通过`compareTo`方法进行比较时是相等的。（详情请参阅`BigDecimal`的文档。）

编写`compareTo`方法与编写`equals`方法非常相似，但也存在几处重大的差别。因为`Comparable`接口是参数化的，而且`comparable`方法是静态的类型，因此不必进行类型检查，也不必对它的参数进行转型。如果参数的类型不合适，这个调用甚至无法编译。如果参数为`null`，这个调用应该抛出`NullPointerException`异常，并且一旦该方法试图访问它的成员时就应该抛出。

`CompareTo`方法中域的比较是有顺序的比较，而不是等同性的比较。比较对象引用域可是递归地调用`compareTo`方法来实现。如果一个域并没有实现`Comparable`接口，或者你需要使用一个非标准的排序关系，就可以使用一个显式的`Comparator`来代替。或者编写自己的`Comparator`，或者使用已有的`Comparator`，譬如针对第8条中`CaseInsensitiveString`类的这个`compareTo`方法使用一个已有的Comparator：
```java
public final class CaseInsensitiveString
        implements Comparable<CaseInsensitiveString> {
    public int compareTo(CaseInsensitiveString cis) {
        return String.CASE_INSENSITIVE_ORDER.compare(s, cis.s);
    }
    ... // Remainder omitted
}
```
注意`CaseInsensitiveString`类实现了`Comparable<CaseInsensitiveString>`接口。由此可见，`CaseInsensitiveString`引用只能与其他的`Comparable<CaseInsensitiveString>`引用进行比较。在声明类去实现`Comparable`接口时，这是常用的模式。还要注意`compareTo`方法的参数是`CaseInsensitiveString`，而不是`Object`，这是上述的类声明所要求的。

比较整数型基本类型的域，可以使用关系操作符\<和\>。例如，浮点域用`Double.compare`或者`Float.compare`，而不用关系操作符，当应用到浮点值时，它们没有遵守`compareTo`的通用约定。对于数组，则要把这些指导原则应用到每个元素上。

如果一个类有多个关键域，那么，按照什么样的顺序来比较这些域是非常关键的。你必须从最关键的域开始，逐步进行到所有的重要域。如果某个域的比较产生了非零的结果（零代表相等），则整个比较操作结束，并返回该结果。如果最关键的域是相等的，则进一步比较次最关键的域，以此类推。如果所有的域都是相等的，则对象就是相等的，并返回零。下面通过第9条中的`PhoneNumber`类的`compareTo`方法来说明这种方法：
```java
public int compareTo(PhoneNumber pn) {
    // Compare area codes
    if (areaCode < pn.areaCode)
        return -1;
    if (areaCode > pn.areaCode)
        return 1;

    // Area codes are equal, compare prefixes
    if (prefix < pn.prefix)
        return -1;
    if (prefix > pn.prefix)
        return 1;

    // Area codes and prefixes are equal, compare line numbers
    if (lineNumber < pn.lineNumber)
        return -1;
    if (lineNumber > pn.lineNumber)
        return 1;

    return 0; // All fields are equal
}
```
虽然这个方法可行，但它还可以进行改进。回想一下，`compareTo`方法的约定并没有指定返回值的大小（magnitude），而只是指定了返回值的符号。你可以利用这一点来简化代码，或许还能提高它的运行速度：
```java
public int compareTo(PhoneNumber pn) {
    // Compare area codes
    int areaCodeDiff = areaCode - pn.areaCode;
    if (areaCodeDiff != 0)
        return areaCodeDiff;

    // Area codes are equal, compare prefixes
    int prefixDiff = prefix - pn.prefix;
    if (prefixDiff != 0)
        return prefixDiff;

    // Area codes and prefixes are equal, compare line numbers
    return lineNumber - pn.lineNumber;
}
```

这项技巧在这里能够工作得很好，但是用起来要非常小心。除非你确信相关的域不会为负值，或者更一般的情况：最小和最大的可能域值之差小于或等于`INTEGER.MAX_VALUE`($2^{23}-1$)，否则就不要使用这种方法。这项技巧有时不能正常工作的原因在于，一个有符号的32位的整数还没有大道足以表达任意两个32位整数的差。如果i是一个很大的正整数（`int`类型），而j是一个很大的负整数（`int`类型），那么 (i-j)将会溢出，并返回一个负值。这样就使得`compareTo`方法将对某些参数返回错误的结果，违反了`compareTo`约定的第一条和第二条。这不是一个纯粹的理论问题：它已经在实际的系统中导致了失败，这些失败可能非常难以调试，因为这样的`compareTo`方法对大多数的输入值都能正常工作。
