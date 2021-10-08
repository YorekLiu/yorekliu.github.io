---
title: "Hotfix方案初探"
---

Hotfix方案分为三种：

1. 类加载方案（Tinker）
2. 底层替换方案（Sophix）
3. InstantRun方案（Robust）

三种典型的方案特点如下：

| 方案对比 | Sophix | Tinker | Robust |
| ------ | ------- | ------ | ----- |
| DEX修复 | 同时支持即时生效和冷启动修复 | 冷启动修复 | 即时成效 |
| 资源更新 | 差量包，不用合成 | 差量包，需要合成 | 差量包 |
| SO库更新 | 插桩实现，开发透明 | 替换接口，开发不透明 | 不支持 |
| 性能损耗 | 低，仅冷启动情况下有些损耗 | 高，有合成操作 | 低 |
| 四大组件 | 不能新增 | 不能新增 | 不能新增 |
| 生成补丁 | 直接选择已经编好的新旧包在本地生成 | 编译新包时设置基线包 | 编译新包时设置基线包 |
| 补丁大小 | 小 | 小 | 小 |
| 接入成本 | 傻瓜式接入 | 复杂 | 一般，文件服务器需要自己实现 |
| Android版本 | 全部支持 | 全部支持 | 全部支持 |
| 安全机制 | 加密传输及签名校验 | 加密传输及签名校验 | 自己实现 |
| 服务端支持 | 支持服务端控制 | 支持服务端控制 | 自己实现 |


### 1. [美团Robust](https://github.com/Meituan-Dianping/Robust/)

原理介绍可以看这里：[Android热补丁之Robust原理解析(一)](http://w4lle.com/2017/03/31/robust-0/)

类似于 InstantRun 热插拔的机制，在打基准包时为每类插入了一个 `ChangeQuickRedirect` 静态变量，并为每个方法插入了一段代理逻辑。当打上补丁后，静态变量不为空，这样就会调用代理方法，以此实现了热修复的功能。示例代码如下：

```java
public static ChangeQuickRedirect u;
protected void onCreate(Bundle bundle) {
    if (u != null) {
        if (PatchProxy.isSupport(new Object[]{bundle}, this, u, false, 78)) {
            PatchProxy.accessDispatchVoid(new Object[]{bundle}, this, u, false, 78);
            return;
        }
    }
    super.onCreate(bundle);
    ...
}
```

其主要流程中涉及到的点如下：

1. 打基准包：根据配置使用Javassit或者ASM为每个类进行插桩。
2. 打补丁包：扫描Modify、Add注释修饰的方法，为对应的类生成补丁。
3. 安装补丁：使用DexClassLoader加载补丁，加载完毕后反射得到特定的补丁入口类，并创建其对象。补丁入口类里面定义了需要修改的基准类以及对应的热修复ChangeQuickRedirect实现类。得到哪些修改的基准类后，再通过反射循环拿到每个基准类的class，将其中类型为 ChangeQuickRedirect 的静态变量反射修改为 补丁包中生成的热修复实现类。

![Robust](/assets/images/android/robust.png)

优点：

- 由于使用多ClassLoader方案（补丁中无新增Activity，所以不算激进类型的动态加载，无需hook system），**兼容性和稳定性更好**，不存在preverify的问题
- 由于采用 InstantRun 的热更新机制，所以可以即时生效，**不需要重启**
- 支持Android2.3-10版本
- 对性能影响较小，不需要合成patch
- 支持方法级别的修复，支持静态方法
- 支持新增方法和类
- 支持ProGuard的混淆、内联、编译器优化后引起的问题(桥方法、lambda、内部类等)等操作

当然，有优点就会有缺点：

- 暂时不支持新增字段，但可以通过新增类解决
- 暂时不支持修复构造方法，已经在内测
- **暂时不支持资源和 so 修复**，不过这个问题不大，因为独立于 dex 补丁，已经有很成熟的方案了，就看怎么打到补丁包中以及 diff 方案。
- 对于返回值是 this 的方法支持不太好
- 没有安全校验，需要开发者在加载补丁之前自己做验证
- 可能会出现深度方法内联导致的不可预知的错误(几率很小可以忽略)

### 2. Sophix

???+ quote "相关文档"  
    [《深入探索Android热修复技术原理》](https://yq.aliyun.com/articles/115122?spm=a2c4g.11186623.0.0.3afd1f05wgVPnD)  
    [业界首个非侵入式热修复方案Sophix重磅推出，颠覆移动端传统更新流程！](https://developer.aliyun.com/article/103527)  
    [Android热修复升级探索——追寻极致的代码热替换](https://developer.aliyun.com/article/74598)  
    [Android热修复升级探索——资源更新之新思路](https://developer.aliyun.com/article/96378)  
    [Android热修复升级探索——Dalvik下冷启动修复的新探索](https://developer.aliyun.com/article/107396)  

#### 2.1 代码修复

Sophix的代码修复采用了底层替换方案，时效性最好，加载轻快，立即见效。  

Java中的Method在ART虚拟机中对应一个ArtMethod指针，ArtMethod结构体中包含了Java方法的所有信息，包括执行入口、访问权限、所属类和代码执行地址等。  
替换ArtMethod结构体中的字段或者替换整个ArtMethod结构体，这就是 **底层替换方案**。  

AndFix采用的是替换ArtMethod结构体中的字段，这样会有兼容性问题，因为厂商可能会修改ArtMethod结构体，导致方法替换失败。  
Sophix采用的是替换整个ArtMethod结构体，这样不会存在兼容问题。

此外，Sophix也有类加载方案。这时需要冷启动才会生效。

#### 2.2 资源修复  

目前市面上的很多资源热修复方案基本上都是参考了Instant Run的实现。实际上，Instant Run的推出正是推动这次热修复浪潮的主因，各家热修复方案，在代码、资源等方面的实现，很大程度上地参考了Instant Run的代码，而资源修复方案正是被拿来用到最多的地方。

简要说来，Instant Run中的资源热修复分为两步：

1. 构造一个新的AssetManager，并通过反射调用addAssetPath，把这个完整的新资源包加入到AssetManager中。这样就得到了一个含有所有新资源的AssetManager。
2. 找到所有之前引用到原有AssetManager的地方，通过反射，把引用处替换为AssetManager。

对于补丁中的id一样的资源，直接addAssetPath最后是没有效果的。所以这里 **构造了一个package id为0x66的资源包，这个包里只包含改变了的资源项，然后直接在原有AssetManager中addAssetPath这个包就可以了**。由于补丁包的package id为0x66，不与目前已经加载的0x7f冲突，因此直接加入到已有的AssetManager中就可以直接使用了。  
**L版本上这样就够了，但是在Android KK和以下版本，addAssetPath是不会加载资源的，必须重新构造一个新的AssetManager并加入patch，再换掉原来的。** 所以这里可以先析构在重新初始化，native层会重新执行一遍流程。

#### 2.3 so修复

so库的修复本质上是对native方法的修复和替换。采用的是类似类修复反射注入方式。把补丁so库的路径插入到nativeLibraryDirectories数组的最前面，就能够达到加载so库的时候是补丁so库，而不是原来so库的目录，从而达到修复的目的。

不过Sohpix也对so的及时生效方面做了一定的探索：

- **针对动态注册的so，可以做到及时生效**。不对Dalvik虚拟机上有一个bug导致第二次load的so不生效。因此需要对补丁so进行改名。
- **针对静态注册的so，需要先对影响到的类进行解注册操作，但能难知道哪些类受到了影响**。其次，就算解决了前者，在加载补丁so之后，由于so信息保存在虚拟机中的Hashtable（采用开放定址法）中，会有补丁so可能出现在原始so之前的情况，因此加载补丁so也不会生效。

因此，Sophix最后采用了冷启动生效的方式，方案还是有两种：

1. 接口调用替换方案  
    SDK提供统一的so加载方法，内部会先尝试加载补丁中的so，不行再调用 `System.loadLibrary`方法。此方案缺点是对业务方有侵入性。
2. 反射注入方案  
    将补丁so库的路径插入到nativeLibraryDirectories数组的最前面，就能够达到加载so库的时候是补丁so库

### 3. [Tinker](https://github.com/Tencent/tinker)

#### 3.1 代码修复

利用类加载机制，将合成好的补丁dex插入到DexPathList中elements数组的最前面，这样查找类的时候就会先加载补丁中的类。  

但是这里注意一下，这里的补丁都采用了diff算法来达到patch文件轻量的目录，针对dex自研了DexDiff算法，其作用域是指令级别的。差分dex在客户端会经过合成来变成一个全量的dex。

#### 3.2 资源修复

InstantRun的原理：还是通过AssetManager#addAssetPath来添加补丁中的resources文件，**但是这样不会直接生效**。因此会重新创建一个AssetManager并更新所有的引用处。

注意这里对资源的修改，会比较生成的资源补丁文件的大小，超过配置的值则会采用bsdiff算法，否则不会采用。

#### 3.3 so修复

Tinker对so的修复没有直接把so插入到nativeLibraryDirectories数组的最前面，原因是“我们并没有为你区分abi(部分手机判断不准确)”，所以无法获取到具体的与架构相关的so。

Tinker提供了`TinkerApplicationHelper#loadArmV7aLibrary`、`TinkerApplicationHelper#loadArmLibrary`方法加载library。里面的逻辑是尝试先从patch中找到对应的library，然后调用`System.load(String filename)`方法加载。如果找不到，则还是调用系统的`System.loadLibrary(libName)`。
