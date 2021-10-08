---
title: "中介者模式(Mediator)"
---

## 1. 定义及使用场景

**中介者模式，用一个中介对象来封装一系列的对象交互。中介者使各对象不需要显式地相互引用，从而使其耦合松散，而且可以独立地改变它们之间的交互。**

中介者模式包装了一系列对象相互作用的方式，使得这些对象不必相互明显作用。从而使它们松散耦合。当某些对象之间的作用发生改变时，不会立即影响其他的一些对象之间的作用。保证这些作用可以彼此独立的变化。中介者模式将多对多的相互作用转化为一对多的相互作用。中介者模式将对象的行为和协作抽象化，把对象在小尺度的行为上与其他对象的相互作用分开处理

使用场景  
当对象之间的交互操作很多且每个对象的行为操作都依赖彼此时，为了防止在修改一个对象的行为时，同时涉及修改很多其他对象的行为，可以采用中介者模式，来解决紧耦合问题。  
该模式将对象之间的多对多关系变成一对多关系，中介者对象将系统从网状结构变成以调停者为中心的星形结构，达到降低系统的复杂性，提高可扩展性的作用。

## 2. UML图

![中介者模式UML图](/assets/images/design-pattern/mediator.png)  
<center>中介者模式UML图</center>

- Mediator  
  抽象中介者角色，定义了同事对象到中介者对象的接口，一般以抽象类的方式实现
- ConcreteMediator  
  具体中介者角色，他从具体的同事对象接收消息，向具体同事对象发出命令
- Colleague  
  抽象同事类角色，定义了中介者对象的接口，它只知道中介者而不知道其他的同事对象
- ConcreteColleagueA  
  具体同事类，每个具体同事类都知道本身在小范围内的行为，而不知道它在大范围内的目的。

## 3. 举个例子
我们将电脑的各种零件整合起来构成一个完整的整体需要一个东西，这就是主板。我们看看主板如何充当这个中介者模式

```kotlin
abstract class Colleague(protected val mediator: Mediator)

abstract class Mediator {
    abstract fun changed(c: Colleague)
}

class CDDevice(mediator: Mediator) : Colleague(mediator) {
    private var data: String? = null

    fun read() = data!!

    fun load() {
        data = "视频数据,音频数据"

        mediator.changed(this)
    }
}

class CPU(mediator: Mediator) : Colleague(mediator) {
    var dataVideo: String? = null
        private set
    var dataSound: String? = null
        private set

    fun decodeData(data: String) {
        val tmp = data.split(",")

        dataVideo = tmp[0]
        dataSound = tmp[1]

        mediator.changed(this)
    }
}

class GraphicsCard(mediator: Mediator) : Colleague(mediator) {

    fun videoPlay(data: String) {
        println("视频: $data")
    }
}

class SoundCard(mediator: Mediator) : Colleague(mediator) {

    fun soundPlay(data: String) {
        println("音频: $data")
    }
}

class MainBoard : Mediator() {
    var cdDevice: CDDevice? = null
    var cpu: CPU? = null
    var soundCard: SoundCard? = null
    var graphicsCard: GraphicsCard? = null

    override fun changed(c: Colleague) {
        when (c) {
            cdDevice -> handleCD(c as CDDevice)
            cpu -> handleCPU(c as CPU)
        }
    }

    private fun handleCD(cdDevice: CDDevice) {
        cpu?.decodeData(cdDevice.read())
    }

    private fun handleCPU(cpu: CPU) {
        soundCard?.soundPlay(cpu.dataSound!!)
        graphicsCard?.videoPlay(cpu.dataVideo!!)
    }
}

fun main(args: Array<String>) {
    val mediator = MainBoard()

    val cd = CDDevice(mediator)
    val cpu = CPU(mediator)
    val vc = GraphicsCard(mediator)
    val sc = SoundCard(mediator)

    mediator.cdDevice = cd
    mediator.cpu = cpu
    mediator.graphicsCard = vc
    mediator.soundCard = sc

    cd.load()
}
```

输出结果如下
```text
音频: 音频数据
视频: 视频数据
```

## 4. 源码中的例子

中介者模式在Android源码中的一个比较好的例子是Keyguard锁屏的功能实现，这里给大家介绍一个找这类设计模式实现的小技巧，很多读者觉得在浩瀚的Android代码中寻找一个设计模式实在太难，其实也并非如此，为什么这么说呢？因为Android源码的命名相当规范，如你要找一个设计模式，这里以中介者模式为例，只需要在源码中搜索“Mediator”关键词，你就会找到KeyguardViewMediator这个类，顺藤摸瓜只需阅读KeyguardViewMediator的源码就可以找到其他的同事类，由此构建一个完整的设计模式类图，这相对于在整个Android源码“大海中捞针”要容易得多，这里再次体现命名的重要性。我们来看看这个KeyguardViewMediator中都有些什么。

```java
public class KeyguardViewMediator {
    // ......省略—些代码......
    private AlarmManager mAlarmManager;
    private AudioManager mAudioManager;
    private StatusBarManager mStatusBarManager;
    private PowerManager mPM;
    private UserManager mUserManager;
    private SearchManager mSearchManager;
    private KeyguardViewManager mKeyguardViewManager;
    // ......省略—些代码......
}
```

首先，我们在KeyguardViewMediator中看到很多XXXManager管理器的成员变量，这些各种各样的管理器其实就是各个具体的同事类，Android使用KeyguardViewMediator来充当中介者协调这些管理器的状态改变，同样地KeyguardViewMediator中也定义了很多方法来处理这些管理器的状态，以解锁或锁屏时声音的播放为例，在KeyguardViewMediator中对应playSounds方法来协调音频的这一状态。

```java
private void playSounds(boolean locked) {
    if (mSuppressNextLockSound) {
        mSuppressNextLockSound = false;
        return;
    }
    final ContentResolver cr = mContext.getContentResolver();
    if (Settings.System.getInt(cr, Settings.System.LOCKSCREEN_SOUNDS_ENABLED, 1) == 1) {
        final int whichSound = locked ? mLockSoundId : mUnlockSoundId;
        mLockSounds.stop(mLockSoundStreamId);
        if (mAudioManager == null) {
            mAudioManager = (AudioManager) mContext.getSystemService(Context.AUDIO_SERVICE);
            if (mAudioManager == null) return;
            mMasterStreamType = mAudioManager.getMasterStreamType();
        }
        if (mAudioManager.isStreamMute(mMasterStreamType)) return;
        mLockSoundStreamId = mLockSounds.play(whichSound, mLockSoundVolume, mLockSoundVolume, 1/*priortiy*/, 0/*loop*/, 1.0f/*rate*/);
    }
}
```

而其他管理器的协调大家也可以在KeyguardViewMediator中找到类似的协调方法，这里不再多说。

另一个Anadroid中关于中介者模式的例子是Binder机制，Binder机制是Android中非常重要的一个机制，其用来绑定不同的系统级服务并进行跨进程通信。在Binder机制中，有3个非常重要的组件ServiceManager、BinderDriver和BpBinder，其中BpBinder是Binder的一个代理角色，其提供IBinder接口给各个客户端服务使用，这三者就扮演了一个中介者的角色。当手机启动后，ServiceManager会先向BinderDriver进行注册，注意，这里ServiceManager虽然是一个特殊的服务，但毕竟还是一个服务，其特殊性在于，它在BinderDriver中是最先被注册的，其注册ID为0，当其他的服务想要注册到BinderDriver时，会先通过这个0号ID获取到ServiceManager所对应的IBinder接口，该接口实质上的实现逻辑是由BpBinder实现的，获取到对应的接口后就回调用其中的transact方法，此后就会在BinderDriver中新注册一个ID 1来对应这个服务，如果有客户端想要使用这个服务，那么，它先会像BinderDriver一样获取到ID为0的接口，也就是ServiceManager所对应的接口，并调用其transact方法要求连接到刚才的服务，这时候BinderDriver就会将ID为1的服务回传给客户端并将相关消息反馈给ServiceManager完成连接。这里ServiceManager和BinderDriver就相当于一个中介者，协调各个服务端与客户端。