---
title: "Java&Kotlin在泛型方面的区别"
---

本文主要内容为Java、Kotlin在泛型方面的语法对比，另外还会介绍extends、super关键词以及通配符、泛型擦除等。

## 泛型

**Java**

```java
// 泛型方法，带泛型返回值
public static <T> T getMiddle(T... a) {
    return a[a.length / 2];
}

// 泛型方法
public static <T> void printMiddle(T... a) {
    System.out.println("printMiddle = " + a[a.length / 2]);
}

// 泛型类型限定
public static <T extends Comparable<T>> int compare(T t1, T t2) {
    return t1.compareTo(t2);
}

// 泛型类型多个限定
public static <T extends Comparable & Serializable> void printArray(T[] input) {
    Arrays.sort(input);
    System.out.print("sorted: ");
    for (T t: input) {
        System.out.print(t + "\t");
    }
    System.out.println();
}

// 泛型类
public static class A<T> {
    // 获取泛型T的实际类型
    public String getType() {
        ParameterizedType parameterizedType = (ParameterizedType) getClass().getGenericSuperclass();
        return parameterizedType.getActualTypeArguments()[0].toString();
    }

    public T getT(T t) {
        return t;
    }
}
```

**Kotlin**

```kotlin
// 泛型方法，带泛型返回值
fun <T> getMiddle(vararg a : T) : T {
    return a[a.size / 2]
}

// 泛型方法
fun <T> printMiddle(vararg a : T) {
    println("printMiddle = ${a[a.size / 2]}")
}

// 泛型类型限定
fun <T : Comparable<T>> compare(t1: T, t2: T): Int {
    return t1.compareTo(t2)
}

// 泛型类型多个限定，注意多限定时需要使用where关键词
fun <T> printArray(input: Array<T>) where T : Comparable<T>, T : java.io.Serializable  {
    input.sort()
    print("sorted: ")
    for (t in input) {
        print("$t\t")
    }
    println()
}

// 泛型类
open class A<T> {
    // 获取泛型T的实际类型
    fun getType(): String = (javaClass.genericSuperclass as ParameterizedType).actualTypeArguments[0].toString()

    fun getT(t: T): T = t
}
```

上面对比了Java & Kotlin泛型方法、泛型类。  

这里需要注意的是，在泛型类中获取泛型的具体类型（`getType()`方法）时，需要继承该类并指定对应类型后才能调用。这与类型擦除的概念有关。所以调用此方法最常用的技巧就是借助于匿名内部类，该技巧在Gson中常常见到，比如下面的Gson调用例子：

```kotlin
Gson().fromJson(it.values, object : TypeToken<List<CatBean>>() {}.type)
```

上面的例子会将`it.values`这个`JSONArray`对象转换为`List<CatBean>`对象。

在我们的示例中，同样我们也可以以内部匿名类的形式也可以获取T的实际类型：

```kotlin
println("A.getType() = ${object : A<Int>(){}.getType()}")
```

控制台打印的结果为：

```
A.getType() = class java.lang.Integer
```

### extends、super通配符

extends、super与通配符 `?` 搭配可以造成不同的效果。  

- `List<? extends Number>` 表示上限通配符，可以读出Number数据，但是不能添加任何对象
- `List<? super Number>` 表示下限通配符，可以存入Number及其子类类型的对象，但是取出的时候只能用Object取出
- `List<?>` 表示无限定通配符，等价于`List<? extends Object>`

怎么理解上面的这段话呢？我们以Number为例，下面是要用到的继承关系图，注意图中的extends、super关键词的范围。

![Number的部分继承关系](/assets/images/android/generics-wildcard.jpg)  
<center>Number的部分继承关系</center>

在`List<? extends Number>`中，泛型的具体类型在运行时只能是一个特定的，该类型是Number或者Number的子类都可以，但是由于不确定是哪个具体的类，所以不能添加任何对象，因为添加的对象可能不兼容。比如说，当里面存放的是Float时，我们动态的添加Integer，这是不允许的。同时，从其中读取数据，数据的类型肯定是Number类型的。

`List<? super Number>`含义与上面相反，泛型的具体类型在运行时只能是一个特定的，该类型是Number或者Number的父类都可以。但是，Number以及其子类都是可以添加进去的。正是因为这个原因，在取出时，所以无法找到一个最高公共父类，除了Object，所以取出时只能是Object类型了。

下面是测试的例子，被注释掉的代码就是编译器报错的代码：

```java
    public static void getData(List<?> data) {
        Integer integer = new Integer(1);
        Object object = new Object();
        Number number = new Number() {...};

//        data.add(integer);
//        data.add(object);
//        data.add(number);
        data.add(null);

        object = data.get(0);
    }

    public static void getData2(List<? extends Number> data) {
        Integer integer = new Integer(1);
        Object object = new Object();
        Number number = new Number() {...};

//        data.add(integer);
//        data.add(object);
//        data.add(number);
        data.add(null);

        number = data.get(0);
    }

    public static void getData3(List<? super Number> data) {
        Integer integer = new Integer(1);
        Object object = new Object();
        Number number = new Number() {...};

        data.add(integer);
//        data.add(object);
        data.add(number);
        data.add(null);

        object = data.get(0);
    }
```

> **PECS原则（Producer Extends Consumer Super）**  
> 我们知道：对于 `extends` 通配符，我们无法向其中加入任何对象，但是我们可以进行正常的取出。  
> 对于 `super` 通配符，我们可以存入 `T` 类型对象或 `T` 类型的子类对象，但是我们取出的时候只能用 `Object` 类变量指向取出的对象。  
> 从上面的总结可以看出，`extends` 通配符偏向于内容的获取，而 `super` 通配符更偏向于内容的存入。我们有一个 PECS 原则（*Producer Extends Consumer Super*）很好的解释了这两个通配符的使用场景。  
> Producer Extends 说的是当你的情景是生产者类型，需要获取资源以供生产时，我们建议使用 `extends` 通配符，因为使用了 `extends` 通配符的类型更适合获取资源。  
> Consumer Super 说的是当你的场景是消费者类型，需要存入资源以供消费时，我们建议使用 `super` 通配符，因为使用 `super `通配符的类型更适合存入资源。  
> 但如果你既想存入，又想取出，那么你最好还是不要使用 `extends` 或 `super` 通配符。

### 类型擦除

Java的泛型是伪泛型，这是因为Java在编译期间，所有的泛型信息都会被擦掉，正确理解泛型概念的首要前提是理解类型擦除。Java的泛型基本上都是在编译器这个层次上实现的，在生成的字节码中是不包含泛型中的类型信息的，使用泛型的时候加上类型参数，在编译器编译的时候会去掉，这个过程成为类型擦除。

如在代码中定义`List<Object>`和`List<String>`等类型，在编译后都会变成`List`，JVM看到的只是`List`，而由泛型附加的类型信息对JVM是看不到的。Java编译器会在编译时尽可能的发现可能出错的地方，但是仍然无法在运行时刻出现的类型转换异常的情况，类型擦除也是Java的泛型与C++模板机制实现方式之间的重要区别。

原始类型就是擦除去了泛型信息，最后在字节码中的类型变量的真正类型，无论何时定义一个泛型，相应的原始类型都会被自动提供，类型变量擦除，并使用其限定类型（无限定的变量用Object）替换。

## 注解

下面是使用Kotlin和Java编写同一个注解的例子：

=== "kotlin"

    ``` kotlin
    @Retention(AnnotationRetention.RUNTIME)
    @Target(AnnotationTarget.FUNCTION)
    annotation class Post(
        val domain: String = "default",
        val path: String
    )
    ```

=== "java"

    ``` java
    public @interface Post {
        String domain()  default "default";
        String path();
    }
    ```