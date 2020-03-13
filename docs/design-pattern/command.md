---
title: "命令模式(Command)"
---

## 1. 定义及使用场景

**将一个请求封装成一个对象，从而让用户使用不同的请求把客户端参数化；对请求排队或者记录请求日志，以及支持可撤销的操作**

使用场景  

- 需要抽象出待执行的行动，然后以参数的形式提供出来——类似于过程设计中的回调机制，而命令模式正是回调机制的一个面向对象的代替品。
- 在不同的时刻指定、排列和执行请求，一个命令对象可以有与初始请求无关的生存期
- 需要支持取消操作
- 支持修改日志功能，这样当系统崩溃时，这些修改可以被重做一遍
- 需要支持事务操作

## 2. UML图

![命令模式UML图](/assets/images/design-pattern/command.png)  
<center>命令模式UML图</center>

- Receiver  
  接受者。负责具体实施或执行一个请求
- Command  
  命令角色。定义所有具体命令的抽象接口
- ConcreteCommand  
  具体命令。在execute方法中调用接收者角色的相关方法，在接受者和命令执行的具体行为之间加以弱耦合
- Invoker  
  请求者。调用命令对象执行具体的方法
- Client  
  客户端

## 3. 举个例子
下面这个例子中，我们用一个开关控制开灯、关灯两个命令。

```kotlin
/** The Command interface */
interface Command {
    fun execute()
}

/** The Invoker class */
class Switch {
    private val history = mutableListOf<Command>()

    fun storeAndExecute(cmd: Command) {
        history.add(cmd)
        cmd.execute()
    }
}

/** The Command for turning on the light - ConcreteCommand #1 */
class FlipUpCommand(private val light: Light) : Command {
    override fun execute() {
        light.turnOn()
    }
}

/** The Command for turning off the light - ConcreteCommand #2 */
class FlipDownCommand(private val light: Light) : Command {
    override fun execute() {
        light.turnOff()
    }
}

/** The Receiver class */
class Light {
    fun turnOn() = println("The light is on")

    fun turnOff() = println("The light is off")
}

fun main(args: Array<String>) {
    val inputArgs = listOf("ON", "OFF", "ON", "OFF")

    val light = Light()

    val switchUp = FlipUpCommand(light)
    val switchDown = FlipDownCommand(light)

    val switch = Switch()

    inputArgs.forEach {
        when (it) {
            "ON" -> switch.storeAndExecute(switchUp)
            "OFF" -> switch.storeAndExecute(switchDown)
        }
    }
}
```

输出结果如下
```text
The light is on
The light is off
The light is on
The light is off
```

## 4. 源码中的例子

PackageManagerService也是Android系统的Service之一，其主要功能在于实现对应用包的解析、管理、卸载等操作，在PackageManagerService中，其对包的相关消息处理由其内部类PackageHandler承担，其将需要处理的请求作为对象通过消息传递给相关的方法，而对于包的安装、移动以及包大小的测量则分别封装为HandlerParams的3个具体子类InstallParams、MoveParams和MeasureParams，HandlerParams的逻辑不多，主要是对3个抽象方法的声明：

```java
private abstract class HandlerParams {
    private static final int MAX_RETRIES = 4;

    /**
     * Number of times startCopy() has been attempted and had a non-fatal
     * error.
     */
    private int mRetries = 0;

    /** User handle for the user requesting the information or installation. */
    private final UserHandle mUser;
    String traceMethod;
    int traceCookie;

    HandlerParams(UserHandle user) {
        mUser = user;
    }

    UserHandle getUser() {
        return mUser;
    }

    HandlerParams setTraceMethod(String traceMethod) {
        this.traceMethod = traceMethod;
        return this;
    }

    HandlerParams setTraceCookie(int traceCookie) {
        this.traceCookie = traceCookie;
        return this;
    }

    final boolean startCopy() {
        boolean res;
        try {
            if (DEBUG_INSTALL) Slog.i(TAG, "startCopy " + mUser + ": " + this);

            if (++mRetries > MAX_RETRIES) {
                Slog.w(TAG, "Failed to invoke remote methods on default container service. Giving up");
                mHandler.sendEmptyMessage(MCS_GIVE_UP);
                handleServiceError();
                return false;
            } else {
                handleStartCopy();
                res = true;
            }
        } catch (RemoteException e) {
            if (DEBUG_INSTALL) Slog.i(TAG, "Posting install MCS_RECONNECT");
            mHandler.sendEmptyMessage(MCS_RECONNECT);
            res = false;
        }
        handleReturnCode();
        return res;
    }

    final void serviceError() {
        if (DEBUG_INSTALL) Slog.i(TAG, "serviceError");
        handleServiceError();
        handleReturnCode();
    }

    abstract void handleStartCopy() throws RemoteException;
    abstract void handleServiceError();
    abstract void handleReturnCode();
}
```

这里结合命令模式来看，HandlerParams也是一个抽象命令者，而对于其3个子类则对应于各个功能不同的具体命令角色，请求者依然可以看作是由PackageManagerService承担的。