---
title: "初学者的Dagger2教程"
---

最近新开了个项目，想搞点事情。  

在原来的项目中，初始化并绑定ViewModel、DataBinding是靠泛型来实现的，基类声明如下：

```kotlin
abstract class BaseActivity<VM : BaseViewModel, B : ViewDataBinding> : AppCompatActivity()
```

虽然用着很愉快，基类里面的ViewModel和DataBinding都是传入的类型：

```kotlin
protected lateinit var viewModel: VM
protected lateinit var binding: B
```

但是在某些类里面使用基类时，看起来令人不爽，比如：

```kotlin
if (activity is BaseActivity<*, *>) {
    hostActivity = activity
}
```

所以就起了想法，想用Dagger2来替换这看起来不爽的泛型。**虽然替换后也不太爽，但是Dagger2有用起来了啊，这就够了。**

下面正式开始Dagger2教学。  

Dagger2就是一个依赖注入框架。使用时先添加对应依赖：

```
implementation "com.google.dagger:dagger:2.21"
kapt "com.google.dagger:dagger-compiler:2.21"
```

因为项目全部使用的Kotlin，所以这里使用的是`kapt`而不是Java中的`annotationProcessor`，另外kapt需要在`apply plugin: 'kotlin-kapt'`一下。

## 1. 基本注入

首先是最简单、最基本的无参对象的注入。

比如，我家的小狗渴了，想喝些什么。

为了让它可以喝到Dagger味的，我们可以这样在`Dog`类的无参构造函数上加一个`@Inject`注解。  

```kotlin
class Dog @Inject constructor() {
    fun drink() = "drink"
}
```

使用的时候可以通过`@Inject`注解来完成注入。

```kotlin
class DaggerActivity : BaseActivity() {

    @Inject
    lateinit var dog: Dog

    ...
}
```

需要注意的是，`@Inject`只是一个注解，我们还需要一个用来对注解进行处理的处理器。这个处理器就是我们刚开始kapt的`com.google.dagger:dagger-compiler`。

现在我们需要写一个额外的代码，告诉注解处理器如何处理该注解，这个额外的代码中，`@Component`注解是关键。

我们可以写出下面的这种注入器：

```kotlin
@Component
interface DogComponent {
    fun createDog(): Dog
}
```

该注入器提供了一个创建`Dog`的`createDog`方法。使用时如下使用：

```kotlin
dog = DaggerDogComponent.builder().build().createDog()
```

当然，使用上面这种方法时，`@Inject lateinit var dog: Dog`中的`@Inject`是不需要的。因为这里只是使用dagger创建了对象，而没有自动完成注入功能。  

所以，这里推荐第二种注解器的编写方式：

```kotlin
@Component
interface DogComponent {
    fun inject(activity: DaggerActivity)
}
```

**在** `DaggerActivity` **中使用时** ，通过下面的代码完成自动注入：

```kotlin
DaggerDogComponent.builder().build().inject(this)
// 等价于 DaggerDogComponent.create().inject(this)
```

自动注入了`Dog`之后，我们就能让它喝些什么了：

```kotlin
tv.text = dog.drink()
```

我们加粗强调了 **在** `DaggerActivity` **中使用** ，这是因为Dagger是强类型的，在哪个类中使用，就只能声明inject哪个类。如果我们把上面声明中的`DaggerActivity`换成基类`BaseActivity`，编译会通过，但是一运行就会报错。另外，在`builder`时如需要设置Module，但是没有声明`inject`此类，设置Module的方法会生成为`@deprecated`类型。

## 2. 对象注入

上面一节中，我们已经命令doge喝了，但是很遗憾，没有什么东西可以让它喝。我们认识到了错误，并赶紧提供了一杯`Water`。  

首先我们需要写一个`Water`类，由于这是被`Dog`需要的。所以，`Water`需要有一个`@Inject`的无参构造方法，然后在原来`Dog`的构造方法中直接加上`water`参数就可以了。

`@Component`部分和`DaggerActivity`中的代码无需任何改动，多么amazing。

看看改动后的`Water`和`Dog`代码：

```java
class Dog @Inject constructor(
    private val water: Water
) {
    fun drink() = "drink $water"
}

class Water @Inject constructor() {
    override fun toString() = "water"
}
```

经过上面的改动后，我们再次运行，就可以看到`Dog`已经喝到`Water`了。

此外，需要注意，基于上面的代码，如果我们在`DaggerActivity`中新`@Inject`一份`Water`，那么这两份`Water`并不是同一个`Water`。那么，如何得到一个Singleton的`Water`呢，可以使用`@Singleton`注解，下面一节会提到。

## 3. 模型与单例

在上面两节中，我们需要注入的对象都是自己可以改动的，如果遇到第三方源码里的对象需要注入，那么怎么办。此时，我们可以使用`@Module`注解，搭配`@Provides`注解使用。

我们拿`OkHttp`为例，顺便说下`@Singleton`注解的使用方法。

首先实现`OkHttp`的提供者`@Provides`，而`@Provides`必须处于`@Module`修饰的类中，我们我们可以先写出下面的代码：

```kotlin
@Module
class OkHttpModule {
    @Provides
    fun provideOkHttp() = OkHttpClient()
}
```

这样我们就赋予了Dagger创建`OkHttp`的能力，接下来要把这个Module添加到`@Component`中：

```kotlin
@Component(modules = [OkHttpModule::class])
interface OkHttpComponent {
    fun inject(activity: DaggerActivity)
}
```

编译之后就能注入到`DaggerActivity`中了：

```kotlin
class DaggerActivity : BaseActivity() {

    @Inject
    lateinit var okHttpClient: OkHttpClient

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ...
        DaggerOkHttpComponent.create().inject(this)
    }
}
```

另外，`OkHttpClient`和`Retrofit`都要单例实现，这样更高效。所以，我们改造一下，提供单例能力，只需要在`@Provides`和对应的`@Component`上添加`@Singleton`注解就可以了：

```kotlin
@Module
class OkHttpModule {
    @Singleton
    @Provides
    fun provideOkHttp() = OkHttpClient()
}

@Singleton
@Component(modules = [OkHttpModule::class])
interface OkHttpComponent {
    fun inject(activity: DaggerActivity)
}
```

怎么验证呢，我们可以在`DaggerActivity`中直接声明两个`OkHttpClient`，然后在注释掉`@Singleton`前后，打印其的`toString`方法返回的值，观察其hashcode的16进制表示是否相同即可。

需要注意，只对同一次`Inject`有效。如果在Application中inject一次，然后在页面中inject一次，这两次还是会生成不同的对象。

## 4. 带参注入

接着第二节，我们谈到了狗喝水。但是狗有很多啊，让哪一只喝水呢？加一个年龄参数吧。

`Dog`就变成这样了。

```kotlin
class Dog @Inject constructor(
    private val age: Int,
    private val water: Water
) {
    fun drink() = "$age years old dog wanna drink $water"
}
```

看这里两个参数，在前面可以知道，`water: Water`是已经可以被`@Inject`了的，剩下的`age: Int`怎么办。这是一个基本类型，没有任何可以直接`@Inject`的机会。  
**既然没有**`@Inject`**的机会，那么我们就**`@Provides`**嘛。只要能满足一个注解即可。**

所以，我们创建一个带需要被Provides的参数`age`的类`DogModule`，然后将该参数`@Provides`出去，供下面的`@Provides`方法创建`Dog`使用：

```kotlin
@Module
class DogModule(
    private val age: Int
) {
    @Provides
    fun provideAge() = age

    @Provides
    fun provideDog(water: Water) = Dog(age, water)
}
```

同第3节，这里的Module也需要加入到Component中：

```kotlin
@Component(modules = [DogModule::class])
interface DogComponent {
    fun inject(activity: DaggerActivity)
}
```

调用Dagger进行注入：

```kotlin
DaggerDogComponent.builder().dogModule(DogModule(10)).build().inject(this)
```

这样就将参数10传入到`Dog`中。

在第一节说道，Dagger是强类型的。如果没有inject到，会出现`@deprecated`的提示，建议此处将`DogComponent`中`inject`参数换成`AppCompatActivity`重新编译看看`dogModule`方法的提示。

## 5. 多Module注入

目前为止，我们已经有两个Module了：`DogModule`以及`OkHttpModule`。  

如果我们想在`DaggerActivity`中顺便使用OkHttp，那么我们可以在`DogComponent`的注解参数中将`OkHttpModule`加进入，这样在`DaggerActivity`中就可以`@Inject lateinit var okHttpClient: OkHttpClient`来注入了。下面是`DogComponent`的代码。

```kotlin
@Component(modules = [DogModule::class, OkHttpModule::class])
interface DogComponent {
    fun inject(activity: DaggerActivity)
}
```

---

又或者，我们的`Dog`也想上网`OkHttpClient`，那么我们可以满足

- 首先在`Dog`中加上对应的字段，同时在构造器中也新增该字段
- 在`DogModule.provideDog`的参数和实现中加入该字段
- 最后，在`DogComponent`的注解参数中将`OkHttpModule`加进入

代码如下：

```kotlin
class Dog @Inject constructor(
    private val age: Int,
    private val water: Water,
    private val okHttpClient: OkHttpClient
) {
    fun drink() = "$age years old dog wanna drink $water, $okHttpClient"
}

class Water @Inject constructor() {
    override fun toString() = "water"
}

@Module
class DogModule(
    private val age: Int
) {
    @Provides
    fun provideAge() = age

    @Provides
    fun provideDog(water: Water, okHttpClient: OkHttpClient) = Dog(age, water, okHttpClient)
}

@Module
class OkHttpModule {
    @Provides
    fun provideOkHttp() = OkHttpClient()
}

@Component(modules = [DogModule::class, OkHttpModule::class])
interface DogComponent {
    fun inject(activity: DaggerActivity)
}
```

使用的时候如下：

```kotlin
DaggerDogComponent.builder()
            .dogModule(DogModule(10))
            .okHttpModule(OkHttpModule())   // 此行可以省略
            .build()
            .inject(this)
```

## 6. @Named、@Qualifier

回到第4节之后，这时候我们可以让多大的`Dog`喝`Water`了；但可能有些`Dog`刚喝了什么，现在什么都不想喝。

这时候我们可以使用`@Named`或者`@Qualifier`注解来让客户端选择注入想要的`Dog`。

**首先说说`@Named`注解如何操作。**

提前小改一下`Dog`类，当构造时不传参数，就认为不喝水了：

```kotlin
class Dog {
    constructor()

    constructor(age: Int, water: Water) {
        this.age = age
        this.water = water
    }

    private var age: Int? = null
    private var water: Water? = null

    fun drink() = if (age != null) "$age years old dog wanna drink $water" else "no no no i don't wanna"
}
```

然后在`DogModule`中提供一个不需要喝水的`provideDogA`方法；同时为了区分客户端需要的`Dog`，需要在对应提供了创建`Dog`能力的方法上加上`@Named`注解：

```kotlin
@Module
class DogModule(
    private val age: Int
){
    @Provides
    fun provideAge() = age

    @Named("a")
    @Provides
    fun provideDog(water: Water) = Dog(age, water)

    @Named("b")
    @Provides
    fun provideDogA() = Dog()
}
```

**注意**：并不是所有创建`Dog`的方法都需要加上`@Named`注解，没有注解的可以匹配上没有注解的。比如，在这里可以删掉`@Named("b")`注解，注入的客户端也不加`@Named("b")`注解，这样可以匹配上。  
同时，需要注意，在同一个`@Module`里面不能有同样函数名的`@Provides`，即使函数签名不一样，否则会报错：*error: Cannot have more than one @Provides method with the same name in a single module*。

最后在客户端注入就行了：

```kotlin
@Inject
@field:Named("a")
lateinit var dog: Dog

@Inject
@field:Named("b")
lateinit var dogA: Dog

override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    ...
    DaggerDogComponent.builder()
        .dogModule(DogModule(24))
        .build()
        .inject(this)
}
```

**注意**：在客户端注入的时候，直接加上注解`@Named("b")`是不OK的，正确的写法是`@field:Named("b")`。作者在这里卡了很久，一直在某天晚上11点想起来了……

**下面接着看@Qualifier注解**  

`@Named`注解里面的value得是一个`String`，虽然 **可以传入静态字符串常量** ，但还是感觉太Kotlin，不JAVA。

所以这里看看`@Qualifier`的用法，首先我们需要使用该注解为两种不同的`Dog`编写两个不同的注解类：

```kotlin
@Qualifier
@Retention(AnnotationRetention.RUNTIME)
annotation class DrinkWaterDog

@Qualifier
@Retention(AnnotationRetention.RUNTIME)
annotation class DrinkNothingDog
```

然后使用上面的注解替换掉`DogModule`以及客户端里面的`@Named`注解：

```kotlin
@Module
class DogModule(
    private val age: Int
){
    @Provides
    fun provideAge() = age

    @Provides
    @DrinkWaterDog
    fun provideDog(water: Water) = Dog(age, water)

    @Provides
    @DrinkNothingDog
    fun provideDogA() = Dog()
}

// 客户端
class DaggerActivity : BaseActivity() {

    @Inject
    @field:DrinkWaterDog
    lateinit var dog: Dog

    @Inject
    @field:DrinkNothingDog
    lateinit var dogA: Dog

    @SuppressLint("SetTextI18n")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ...
        DaggerDogComponent.builder()
            .dogModule(DogModule(24))
            .build()
            .inject(this)
    }
}
```

## 7. 官网例子

官网例子是一个冲咖啡的小例子，先用`Heater`加热，然后`Pump`冲，最后就得到咖啡了：

```kotlin
// 1--Heater
interface Heater {
    fun on()
    fun off()
    fun isHot(): Boolean
}

class ElectricHeater : Heater {

    private var heating = false

    override fun on() {
        println("~ ~ ~ heating ~ ~ ~")
        heating = true
    }

    override fun off() {
        heating = false
    }

    override fun isHot() = heating
}

// 2--Pump
interface Pump {
    fun pump()
}

class Thermosiphon @Inject constructor(
    private val heater: Heater
) : Pump {
    override fun pump() {
        if (heater.isHot()) {
            println("=> => pumping => =>")
        }
    }
}

// 3--CoffeeMaker
class CoffeeMaker @Inject constructor(
    private val heater: Lazy<Heater>,
    private val pump: Pump
) {
    fun brew() {
        heater.get().on()
        pump.pump()
        println(" [_]P coffee! [_]P ")
        heater.get().off()
    }
}

// 4--Module
@Module
abstract class PumpModule {
    @Binds
    abstract fun providePump(pump: Thermosiphon): Pump
}

@Module(includes = [PumpModule::class])
class DripCoffeeModule {
    @Provides
    @Singleton
    fun provideHeater(): Heater = ElectricHeater()
}

// 5--Component
@Singleton
@Component(modules = [DripCoffeeModule::class])
interface CoffeeShop {
    fun maker(): CoffeeMaker
}

// main
fun main() {
    val coffeeShop = DaggerCoffeeShop.builder().build()
    coffeeShop.maker().brew()
}
```

运行结果：

```kotlin
~ ~ ~ heating ~ ~ ~
=> => pumping => =>
 [_]P coffee! [_]P 
```

我们分析下源码的运行流程中其中还涉及到`@Binds`注解和`Lazy`接口。

首先1、2两个部分定义了`Heater`、`Pump`接口以及其实现类；第3部分`CoffeeMaker`利用上面两个接口实现了咖啡的制作逻辑。然后看main部分，这里调用了`DaggerCoffeeShop`获得了一个`CoffeeMaker`并开始了制作。所以关键在4、5部分。我们溯源一下。  

首先看`CoffeeMaker`，其构造器被`@Inject`修饰了，所以这里面的`Heater`和`Pump`要不其构造器也是`@Inject`的，要不就是有`@Module`为其`@Provides`或者`@Binds`了。  

先看看`Pump`的创建过程。  
在第4部分的`PumpModule`中提供了`Pump`，注意这里的语法：

```kotlin
@Binds abstract fun providePump(pump: Thermosiphon): Pump
```

该方法是抽象类中的抽象方法，不像其他Module中的`@Provides`会给出创建过程，这里啥都没干，怎么创建了`Pump`对象了呢。  
关键肯定是`@Binds`，这里告诉Dagger使用`pump: Thermosiphon`来创建`Pump`。所以回过头来看一下`Thermosiphon`的构造器，果然被`@Inject`修饰了。

这里`Pump`就被创建了。接着看`Heater`的创建。  
先看类的定义，`Heater`以及`ElectricHeater`都没有被`@Inject`，那么肯定是在`@Module`里面。接着看`DripCoffeeModule`，这里果然`@Provides`了一个`Heater`，还是个`ElectricHeater`。  
另外注意一下，该Module还`includes`个`PumpModule`，这样在`@Component`中就不需要再次包含`PumpModule`了。

现在1、2、3里面的类都组织了起来，Dagger就能愉快的工作了。总结一下第5部分这个`@Component`的流程。  
首先在注解中指定了modules为`DripCoffeeModule`，而`DripCoffeeModule`又include了`PumpModule`，这样Component就能组织两个Module里面的`Heater`和`Pump`了。  
然后客户端调用`Dagger`构建`CoffeeMaker`，这类`@Inject`了两个参数：`Heater`、`Pump`，OK，都是满足的。这样，就能愉快的制作咖啡了。

最后看一下`Lazy`接口的用法，很简单：声明的时候使用`Lazy<T>`进行声明；使用时调用其`get`方法即可。