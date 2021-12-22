---
title: "注解的定义及解析"
---

注解是代码里的特殊标记，这些标记可以在编译、类加载、运行时被读取，并执行相应的处理。本章的内容主要介绍注解的种类、如何自定义以及如何解析自定义注解。

## 1. 注解的定义

我们熟知的Retrofit就是以注解的形式提供接口的注册的，这里拿我们最常使用的`@GET`注解来进行说明：

```java
import static java.lang.annotation.ElementType.METHOD;
import static java.lang.annotation.RetentionPolicy.RUNTIME;

@Documented
@Target(METHOD)
@Retention(RUNTIME)
public @interface GET {
  String value() default "";
}
```

这个注解可以分为两个部分：

1. 第一部分就是用来注解`@GET`注解的注解，这些注解称之为元注解
2. 第二部分就是`@GET`注解的结构定义了

元注解有以下几种：

- `@Inherited`  
   注解可以被继承
- `@Documented`  
   注解可以被JavaDoc工具记录
- `@Repeatable`  
   JDK 8 新增，允许一个注解在同一声明类型上多次使用
- `@Retention`  
   注解的保留策略  
   取值是一个`RetentionPolicy`枚举类型，分别表示不同级别的保留策略，而根据保留策略的不同，处理该注解的方式也不相同  
    - `SOURCE`  
       源码级，注解信息只会保留到源代码中，编译器会在编译时丢弃调注解信息，因此不会保留到.class文件中
    - `CLASS`  
       编译时注解，默认值，注解信息会一直保留到.class文件阶段，但不会保存到运行时阶段。所以，需要在编译时通过注解处理器处理。
    - `RUNTIME`  
       运行时注解，注解信息在class文件阶段以及运行时阶段都会保留，因此可以通过反射获取注解信息。
- `@Target`  
   注解可以修饰的范围  
   取值是一个`ElementType`枚举类型的数组，有以下枚举值可取：  
    - `TYPE`  
       修饰类、接口（包括注解类型）、枚举类型
    - `FIELD`  
       修饰成员变量（包括枚举常量）
    - `METHOD`  
       修饰方法
    - `PARAMETER`  
       修饰参数
    - `CONSTRUCTOR`  
       修饰构造器
    - `LOCAL_VARIABLE`  
       修饰局部变量
    - `ANNOTATION_TYPE`  
       修饰注解类型
    - `PACKAGE`  
       修饰包
    - `TYPE_PARAMETER`  
       Type parameter declaration，1.8新增
    - `TYPE_USE`  
       Use of a type，1.8新增

自定义注解类型使用`@interface`关键字，这和定义一个接口非常像。注解只有成员变量，没有方法，注解的成员变量在注解定义中以“无形参的方法”形式来声明，其“方法名”定义了该成员变量的名字，其返回值定义了该成员变量的类型。成员变量可以使用`default`关键词指定默认值。

因此，开头的Retrofit中`@GET`注解的含义为：可以被JavaDoc工具记录的修饰方法的运行时注解，该注解接受一个参数`String`类型的`value`，默认值为` `。

## 2. 注解的处理

在上面我们知道了，`@Retention`注解可以设定自定义注解的保留策略，这3个策略的生命周期长度为SOURCE＜CLASS＜RUNTIME。生命周期短的能起作用的地方，生命周期长的一定也能起作用。  

一般如果需要在运行时去动态获取注解信息，那只能用`RetentionPolicy.RUNTIME`；如果要在编译时进行一些预处理操作，比如生成一些辅助代码，就用`RetentionPolicy.CLASS`；如果只是做一些检查性的操作，比如`@Override`和`@SuppressWarnings`，则可选用`RetentionPolicy.SOURCE`。  

当设定为`RetentionPolicy.RUNTIME`时，这个注解就是运行时注解。同样地，设定为`RetentionPolicy.CLASS`，这个注解就是编译时注解。  

如果没有处理注解的工具，那么注解也不会有什么大的作用。对于不同的注解有不同的注解处理器。

**针对运行时注解会采用反射机制处理，针对编译时注解会采用注解处理器`AbstractProcessor`来处理。*当然，编译时注解在编译时搭配ASM等字节码插桩技术也是可以读取并利用上的。***

### 2.1 运行时注解的处理

**运行时注解由于注解信息在运行时也会保留，所以一般会采用反射机制进行处理。**  

还是拿开头Retrofit的`@GET`注解来进行说明，Retrofit整个工作流程的讲解可以查看[Retrofit2源码解析](/android/3rd-library/retrofit/)。

`@GET`注解的处理过程在Refrofit的`ServiceMethod.java`中，每一个`ServiceMethod`都对应一个网络请求的接口，在我们首次调用网络请求的时候会创建该对象。我们看看其建造者中相关代码：

```java
  static final class Builder<T, R> {
    final Retrofit retrofit;
    final Method method;
    final Annotation[] methodAnnotations;
    ...

    Builder(Retrofit retrofit, Method method) {
      this.retrofit = retrofit;
      this.method = method;
      this.methodAnnotations = method.getAnnotations();
      ...
    }

    public ServiceMethod build() {
      ...
      for (Annotation annotation : methodAnnotations) {
        parseMethodAnnotation(annotation);
      }
      ...
    }

    private void parseMethodAnnotation(Annotation annotation) {
      if (annotation instanceof DELETE) {
        parseHttpMethodAndPath("DELETE", ((DELETE) annotation).value(), false);
      } else if (annotation instanceof GET) {
        parseHttpMethodAndPath("GET", ((GET) annotation).value(), false);
      }
      ...
    }
  }
```

这里通过`Method.getAnnotations()`反射方法获取了该方法的所有注解，然后遍历注解，找到自定义的`@GET`注解，最后调用`@GET`注解的`value`获得设置的值。

### 2.2 编译时注解的处理

**编译时注解由于注解信息只保存到.class文件阶段，所以一般会在编译时进行处理。处理的结果一般是生成一个辅助文件参与后续编译。**

通常，设计编译时注解处理器需要以下几步

1. 定义注解
2. 编写注解处理器
3. 注册注解处理器
4. 应用注解

在第2步中，通常需要通过注解生成辅助文件参与后续编译，所以涉及到生成辅助文件的类库。生成辅助文件的类库根据生成文件类型的不同，分为`com.squareup:javapoet`和`com.squareup:kotlinpoet`。

由于辅助文件的生成需要耗点篇幅来写，所以本文在不生成辅助文件的前提下，介绍一下最简单的编译时注解处理器。该处理器仅仅在编译时打印出被注解的类的信息。  

#### 2.2.1 自定义注解

新建一个`Java Library`的Module，命名为`annotations`。然后自定义一个注解：

**RuntimePermissions.java**

```java
@Retention(RetentionPolicy.CLASS)
@Target(ElementType.TYPE)
public @interface RuntimePermissions {
    String[] permissions();
}
```

#### 2.2.2 编写注解处理器

新建一个`Java Library`的Module，命名为`processor`。同时，让该模块依赖`annotations`模块：

**processor/build.gradle**

```gradle
implementation project(':annotations')
```

接下来编写注解处理器，自定义的注解处理器需要继承`AbstractProcessor`，并实现4个方法：

**PermissionProcessor.kt**

```java
class PermissionProcessor : AbstractProcessor() {
    private lateinit var filer: Filer
    private lateinit var elementUtils: Elements
    private lateinit var typeUtils: Types
    private lateinit var messager: Messager

    override fun init(processingEnv: ProcessingEnvironment) {
        super.init(processingEnv)

        filer = processingEnv.filer
        elementUtils = processingEnv.elementUtils
        typeUtils = processingEnv.typeUtils
        messager = processingEnv.messager
    }

    override fun getSupportedAnnotationTypes(): MutableSet<String> {
        return hashSetOf(RuntimePermissions::class.java.canonicalName)
    }

    override fun getSupportedSourceVersion(): SourceVersion? {
        return SourceVersion.latestSupported()
    }

    override fun process(annotations: MutableSet<out TypeElement>, roundEnv: RoundEnvironment): Boolean {
        messager.printMessage(Diagnostic.Kind.WARNING, ">>> process begin")
        roundEnv.getElementsAnnotatedWith(RuntimePermissions::class.java)
            .filter { it.kind == ElementKind.CLASS }
            .forEach {
                messager.printMessage(
                    Diagnostic.Kind.WARNING,
                    "printMessage: $it, value=${it.getAnnotation(RuntimePermissions::class.java).permissions}")
            }
        messager.printMessage(Diagnostic.Kind.WARNING, ">>> process end")
        return true
    }
}
```

上面的代码就是一个非常简单但完整的注解处理器了，这四个方法的作用如下：

- `init`  
   初始化方法，在这里我们初始化一些工具类，比如`Filer`、`Elements`、`Types`、`Messager`等
- `getSupportedAnnotationTypes`  
   指定注解处理器可以哪些注解
- `getSupportedSourceVersion`  
   用来指定你使用的Java版本，通常这里返回`SourceVersion.latestSupported()`
- `process`  
   处理器开始处理注解的方法，在这里写扫描、评估和处理注解的代码，以及生成辅助文件。

在Java 7 以后，也可以使用注解来代替`getSupportedAnnotationTypes`方法和`getSupportedSourceVersion`方法，如下所示：

```java
@SupportedSourceVersion(SourceVersion.RELEASE_8)
@SupportedAnnotationTypes("xyz.yorek.annotations.RuntimePermissions")
class PermissionProcessor : AbstractProcessor() {
    private lateinit var filer: Filer
    private lateinit var elementUtils: Elements
    private lateinit var typeUtils: Types
    private lateinit var messager: Messager

    override fun init(processingEnv: ProcessingEnvironment) {
        super.init(processingEnv)

        filer = processingEnv.filer
        elementUtils = processingEnv.elementUtils
        typeUtils = processingEnv.typeUtils
        messager = processingEnv.messager
    }

    override fun process(annotations: MutableSet<out TypeElement>, roundEnv: RoundEnvironment): Boolean {
        ...
        return true
    }
}
```

在上面我们提到了四个工具类：`Filer`、`Elements`、`Types`、`Messager`，它们都有独特的作用：

- `Elements`：一个用来处理`Element`的工具类，Element就是代表源码中的句子，可以理解为DOM树的形式。通过`Element.getEnclosingElement()`可以获得父元素，通过`Element.getEnclosedElements()`可以遍历子元素。  
  Element元素实例如下：
  ```java
  package com.example;    // PackageElement

  public class Foo {      // TypeElement
  
      private int a;      // VariableElement
      private Foo other;  // VariableElement
  
      public Foo () {}    // ExecuteableElement
  
      public void setA (  // ExecuteableElement
                int newA  // VariableElement
      ) {}
  }
  ```
- `Types`：一个用来处理`TypeMirror`的工具类，可以通过`TypeMirror`获取类的相关信息；调用`Element.asType()`方法可以获得`TypeMirror`
- `Filer`：正如这个名字所示，使用`Filer`你可以创建辅助文件
- `Messager`: 提供给注解处理器一个报告错误、警告以及提示信息的途径。它不是日志工具，而是展示给注解处理器使用者的。  

  > 消息有不同的级别。其中`Diagnostic.Kind.Error`级别最严重，输出此级别的信息会导致编译报错。

回到我们的示例注解处理器中，现在我们知道了自定义处理器是干什么的了。  

1. 首先，该注解处理器会处理`RuntimePermissions`注解，支持最新的Java版本
2. 在处理注解时（`process`方法），首先会获取所有`RuntimePermissions`注解修饰的Element，这里面可能是类、方法、变量等。所以我们需要过滤掉所有不符合的Element，只留下类的Element。
3. 最后，调用`Messager`打印出注解修饰的类的类名以及注解的值。

这个自定义注解器非常简单，复杂一点的就需要生成辅助文件了。根据辅助文件的格式的不同（`.kt`或`.java`），可以使用两个不同的类库`com.squareup:javapoet`和`com.squareup:kotlinpoet`。辅助文件的生成就靠上面这两个类库，具体使用可以参考GitHub主页：  

- [JavaPoet](https://github.com/square/javapoet/)
- [KotlinPoet](https://github.com/square/kotlinpoet/)

此外，博主常用的动态权限请求库[PermissionsDispatcher](https://github.com/permissions-dispatcher/PermissionsDispatcher)中有对这两个库的使用，而且提供了同一个例子的Java和Kotlin版本，这对我们对比研究这两个库有极大的帮助，同时能顺便读读PermissionsDispatcher的源码。详情请移步[PermissionDispatcher源码解析——基于注解的动态权限请求框架PermissionDispatcher源码解析](/android/3rd-library/permissiondispatcher/)。

#### 2.2.3 注册注解处理器

接下来我们需要在`processor`库的main目录下面，新建一个`resources/`目录，在该目录下继续创建`META-INF/services/`目录，最后在`META-INF/services/`文件夹中创建`javax.annotation.processing.Processor`文件，内容就是自定义注解处理器的全名：

**META-INF/services/javax.annotation.processing.Processor** 

```text
xyz.yorek.processor.PermissionProcessor
```

这些步骤可以对应如下shell（在`processor`模块根目录下执行）：：

```shell
mkdir -p src/main/resources/META-INF/services/
echo xyz.yorek.processor.PermissionProcessor > src/main/resources/META-INF/services/javax.annotation.processing.Processor
```

如果嫌麻烦，可以使用Google开源的[`AutoService`](https://github.com/google/auto/tree/master/service)来完成。首先在`processor`库中添加如下依赖：

```gradle
...
apply plugin: 'kotlin-kapt'

dependencies {
    ...
    implementation 'com.google.auto.service:auto-service:1.0-rc6'
    kapt "com.google.auto.service:auto-service:1.0-rc6"
}
```

在`PermissionProcessor`类上添加`@AutoService(Processor::class)`即可，这样AutoService会自动为我们生成注册文件：

```java
@AutoService(Processor::class)
class PermissionProcessor : AbstractProcessor() {
    ...
}
```

> **注意，在使用第三方库时，如何区分它的注解的工作原理是运行时注解与编译时注解呢？**  
> 我们看看需不需要添加注解处理器就知道了。添加了注解处理器的类库，一般都会生成辅助文件，所以是编译时注解。否则就是通过反射来获取注解信息了，这就是运行时注解。  
> 就像上面的AutoService，我们kapt了注解处理器，所以会为我们生成辅助文件`src/main/resources/META-INF/services/javax.annotation.processing.Processor`

#### 2.2.4 应用注解

回到`app`模块中，因为我们需要使用注解以及注解处理器，所以先配置一下`build.gradle`：

**app/build.gradle**

```gradle
...
apply plugin: 'kotlin-kapt'
...
dependencies {
    ...
    implementation project(':annotations')
    kapt project(':processor')
}
```

然后在`MainActivity.java`上配置一下我们的自定义注解：

```java
@RuntimePermissions(permissions = ["Hello", "World"])
class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
    }
}
```

配置完毕后，clean后make一下，就能看到在注解器中配置的信息了。如下面第47行所示：

```text
Executing tasks: [:processor:assemble, :processor:testClasses, :app:assembleDebug]


> Task :annotations:compileJava
warning: [options] bootstrap class path not set in conjunction with -source 1.7
1 warning

> Task :processor:kaptGenerateStubsKotlin
> Task :processor:kaptKotlin
> Task :processor:compileKotlin
> Task :processor:compileJava NO-SOURCE
> Task :processor:processResources
> Task :processor:classes
> Task :processor:inspectClassesForKotlinIC
> Task :processor:jar
> Task :processor:assemble
> Task :processor:kaptGenerateStubsTestKotlin NO-SOURCE

> Task :processor:kaptTestKotlin
Annotation processors discovery from compile classpath is deprecated.
Set 'kapt.includeCompileClasspath = false' to disable discovery.
Run the build with '--info' for more details.

> Task :processor:compileTestKotlin NO-SOURCE
> Task :processor:compileTestJava NO-SOURCE
> Task :processor:processTestResources NO-SOURCE
> Task :processor:testClasses UP-TO-DATE
> Task :annotations:processResources NO-SOURCE
> Task :annotations:classes
> Task :annotations:jar
> Task :app:preBuild UP-TO-DATE
> Task :app:preDebugBuild UP-TO-DATE
> Task :app:compileDebugAidl NO-SOURCE
> Task :app:compileDebugRenderscript NO-SOURCE
> Task :app:checkDebugManifest UP-TO-DATE
> Task :app:generateDebugBuildConfig UP-TO-DATE
> Task :app:mainApkListPersistenceDebug
> Task :app:generateDebugResValues
> Task :app:generateDebugResources
> Task :app:mergeDebugResources
> Task :app:createDebugCompatibleScreenManifests
> Task :app:processDebugManifest
> Task :app:processDebugResources
> Task :app:kaptGenerateStubsDebugKotlin

> Task :app:kaptDebugKotlin
w: warning: >>> process begin
w: warning: printMessage: xyz.yorek.component.MainActivity, value=[Ljava.lang.String;@2a0c97c4
w: warning: >>> process end
w: warning: >>> process begin
w: warning: >>> process end

> Task :app:compileDebugKotlin
> Task :app:prepareLintJar UP-TO-DATE
> Task :app:generateDebugSources UP-TO-DATE
> Task :app:javaPreCompileDebug
> Task :app:compileDebugJavaWithJavac
> Task :app:compileDebugSources
> Task :app:mergeDebugShaders
> Task :app:compileDebugShaders
> Task :app:generateDebugAssets
> Task :app:mergeDebugAssets
> Task :app:checkDebugDuplicateClasses
> Task :app:transformClassesWithDexBuilderForDebug
> Task :app:validateSigningDebug
> Task :app:mergeExtDexDebug
> Task :app:mergeDexDebug
> Task :app:signingConfigWriterDebug
> Task :app:mergeDebugJniLibFolders
> Task :app:transformNativeLibsWithMergeJniLibsForDebug
> Task :app:transformNativeLibsWithStripDebugSymbolForDebug
> Task :app:processDebugJavaRes NO-SOURCE
> Task :app:transformResourcesWithMergeJavaResForDebug
> Task :app:packageDebug
> Task :app:assembleDebug

Deprecated Gradle features were used in this build, making it incompatible with Gradle 6.0.
Use '--warning-mode all' to show the individual deprecation warnings.
See https://docs.gradle.org/5.1.1/userguide/command_line_interface.html#sec:command_line_warnings

BUILD SUCCESSFUL in 8s
38 actionable tasks: 34 executed, 4 up-to-date
```

以上就是一个最简单的编译时注解处理器的编写过程了。

至此，注解的全方面介绍已经完毕，剩下的编译时生成辅助文件的相关代码我们会在[PermissionDispatcher源码解析——基于注解的动态权限请求框架PermissionDispatcher源码解析](/android/3rd-library/permissiondispatcher/)这篇文章中进行具体描述。

### 2.3 SOURCE注解妙用

SOURCE 级别注解搭配 `@IntDef` 可以用来替代枚举类型，用以提示开发者该方法的入参、出参的可选项：

```java
public static final int MODE_SCROLLABLE = 0;
public static final int MODE_FIXED = 1;
public static final int MODE_AUTO = 2;

@IntDef(value = {MODE_SCROLLABLE, MODE_FIXED, MODE_AUTO})
@Retention(RetentionPolicy.SOURCE)
public @interface Mode {}

/////////////////////////////////////////////////////////
@Mode int mode;

public void setTabMode(@Mode int mode) {
   if (mode != this.mode) {
      this.mode = mode;
      applyModeAndGravity();
   }
}

@Mode
public int getTabMode() {
   return mode;
}
```