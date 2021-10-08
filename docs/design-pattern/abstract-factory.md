---
title: "抽象工厂模式(Abstract factory)"
---

## 1. 定义及使用场景

**为创建一组相关或者是相互依赖的对象提供一个接口，而不需要指定它们的具体类。**

使用场景：  
一个对象族有相同的约束时可以使用抽象工厂模式。比如，Android、iOS、Window Phone下都有拨号软件和短信软件，两者都属于软件的范畴，但是，它们所在的操作系统平台不一样，即便是同一家公司出品的软件，其代码的实现逻辑也是不同的，这时候就可以考虑使用抽象工厂模式来产生Android、iOS、Window Phone下的拨号软件和短信软件。

## 2. UML图

![抽象工厂方法模式UML图](/assets/images/design-pattern/abstract-factory.png)  
<center>抽象工厂方法模式UML图</center>

## 3. 举个例子

在上章的例子中，虽然Q3、Q5、Q7都是一个车系，但是三者的零部件差别非常大。它们的轮胎、发动机、制动系统等部件不同。

```kotlin
interface ITire {
    fun tire()
}

class NormalTire : ITire {
    override fun tire() {
        println("normal tire")
    }
}

class SUVTire : ITire {
    override fun tire() {
        println("suv tire")
    }
}

interface IEngine {
    fun engine()
}

class DomesticEngine : IEngine {
    override fun engine() {
        println("domestic engine")
    }
}

class ImportEngine : IEngine {
    override fun engine() {
        println("import engine")
    }
}

interface IBrake {
    fun brake()
}

class NormalBrake : IBrake {
    override fun brake() {
        println("normal brake")
    }
}

class SeniorBrake : IBrake {
    override fun brake() {
        println("senior brake")
    }
}

abstract class CarFactory {
    abstract fun createTire(): ITire

    abstract fun createEngine(): IEngine

    abstract fun createBrake(): IBrake
}

class Q3Factory : CarFactory() {
    override fun createTire(): ITire = NormalTire()

    override fun createEngine(): IEngine = DomesticEngine()

    override fun createBrake(): IBrake = NormalBrake()
}

class Q7Factory : CarFactory() {
    override fun createTire(): ITire = SUVTire()

    override fun createEngine(): IEngine = ImportEngine()

    override fun createBrake(): IBrake = SeniorBrake()
}

fun main(args: Array<String>) {
    val factoryQ3: CarFactory = Q3Factory()
    factoryQ3.createTire().tire()
    factoryQ3.createEngine().engine()
    factoryQ3.createBrake().brake()

    println()

    val factoryQ7: CarFactory = Q7Factory()
    factoryQ7.createTire().tire()
    factoryQ7.createEngine().engine()
    factoryQ7.createBrake().brake()
}
```

输出结果如下
```text
normal tire
domestic engine
normal brake

suv tire
import engine
senior brake
```

## 4. 源码中的例子

以framework中[MediaPlayerFactory](http://androidxref.com/6.0.0_r5/xref/frameworks/av/media/libmediaplayerservice/MediaPlayerFactory.cpp#307)为例，在`MediaPlayerService`的构造函数中，调用了`MediaPlayerFactory::registerBuiltinFactories();`函数来准备若干个`MediaPlayerFactory`：

```c
void MediaPlayerFactory::registerBuiltinFactories() {
    Mutex::Autolock lock_(&sLock);

    if (sInitComplete)
        return;

    registerFactory_l(new StagefrightPlayerFactory(), STAGEFRIGHT_PLAYER);
    registerFactory_l(new NuPlayerFactory(), NU_PLAYER);
    registerFactory_l(new TestPlayerFactory(), TEST_PLAYER);

    sInitComplete = true;
}

status_t MediaPlayerFactory::registerFactory_l(IFactory* factory,
                                               player_type type) {
    if (NULL == factory) {
        ALOGE("Failed to register MediaPlayerFactory of type %d, factory is"
              " NULL.", type);
        return BAD_VALUE;
    }

    if (sFactoryMap.indexOfKey(type) >= 0) {
        ALOGE("Failed to register MediaPlayerFactory of type %d, type is"
              " already registered.", type);
        return ALREADY_EXISTS;
    }

    if (sFactoryMap.add(type, factory) < 0) {
        ALOGE("Failed to register MediaPlayerFactory of type %d, failed to add"
              " to map.", type);
        return UNKNOWN_ERROR;
    }

    return OK;
}
```

随后在`MediaPlayerService::Client::createPlayer`函数中调用了`MediaPlayerFactory::createPlayer`函数来根据`playerType`创建出对应的`sp<MediaPlayerBase>`：

```c
sp<MediaPlayerBase> MediaPlayerFactory::createPlayer(
        player_type playerType,
        void* cookie,
        notify_callback_f notifyFunc,
        pid_t pid) {
    sp<MediaPlayerBase> p;
    IFactory* factory;
    status_t init_result;
    Mutex::Autolock lock_(&sLock);

    if (sFactoryMap.indexOfKey(playerType) < 0) {
        ALOGE("Failed to create player object of type %d, no registered"
              " factory", playerType);
        return p;
    }

    factory = sFactoryMap.valueFor(playerType);
    CHECK(NULL != factory);
    p = factory->createPlayer(pid);

    if (p == NULL) {
        ALOGE("Failed to create player object of type %d, create failed",
               playerType);
        return p;
    }

    init_result = p->initCheck();
    if (init_result == NO_ERROR) {
        p->setNotifyCallback(cookie, notifyFunc);
    } else {
        ALOGE("Failed to create player object of type %d, initCheck failed"
              " (res = %d)", playerType, init_result);
        p.clear();
    }

    return p;
}
```

举出来的例子更像是工厂方法模式的例子:(  