---
title: "PermissionDispatcher源码解析"
---

!!! info
    基于[PermissionDispatcher](https://github.com/permissions-dispatcher/PermissionsDispatcher) v4.5.0 左右的最新master源码，节点为`332b4a1`。

PermissionDispatcher是一个基于注解的动态权限请求框架。其主要工作原理就是在编译时获取指定注解的内容，然后生成辅助文件参与编译。本文将通过源码深入介绍PermissionDispatcher的原理。  
另外关于注解的一些介绍，在[注解的定义及解析](/android/other/annotation/)一文中有详细的介绍。

下面首先介绍一下PermissionDispatcher的模块关系图，以及各个模块的作用：

<figure style="width: 80%" class="align-center">
    <img src="/assets/images/android/permissiondispatcher-overview.png">
    <figcaption>PermissionDispatcher模块关系图</figcaption>
</figure>

- `sample-kotlin`  
  Kotlin版本的演示示例
- `sample`  
  Java版本的演示示例
- `library`  
  仅有一个`PermissionUtils`工具类，在生成的辅助文件中使用
- `processor`  
  自定义的注解处理器，在这里面会处理注解并生成辅助文件
- `annotation`  
  存放注解以及相关接口的位置
- `lint`  
  自定义的Lint
- `buildSrc`  
  自定义的Gradle插件

这里面的Lint以及Gradle插件模块我们暂时不需要关心，本文的主要精力在于processor模块以及其他的配套模块。

## 1. sample模块

`sample[-kotlin]`两个模块代码逻辑一模一样，区别在于：一个Java实现，另外一个Kotlin实现。而例子中涉及到的权限比也较常见：打开摄像头需要的**相机权限**以及读写通讯录需要的**通讯录权限**。两个权限的使用都发生在对应的Fragment中，例子页面如下所示：

<figure style="width: 20%" class="align-center">
    <img src="/assets/images/android/permission-dispatcher-demo.png">
    <figcaption>sample[-kotlin]例子主页面</figcaption>
</figure>

点击对应按钮，下面的空白区域就会显示响应的Fragment。  

例子中的代码非常简单，没有多少技术含量。唯一可以提一提的是：

1. Fragment回退栈的使用
2. 专门提供数据异步加载的`LoaderManager`，且会监听数据的改变
3. 相机预览涉及到的`SurfaceView`

两个模块的主页面代码见附录，这在后面讨论辅助文件的生成时有一定帮助。

## 2. library模块

library模块仅有一个`PermissionUtils`工具类，在生成的辅助文件中使用。该类有如下方法：

1. `boolean verifyPermissions(int... grantResults)`  
   检查这些权限是否都是`PERMISSION_GRANTED`状态；所有权限都是该状态，才会返回true
2. `boolean hasSelfPermissions(Context context, String... permissions)`  
   检查是否已经拥有了要申请的这些权限；所有权限都拥有了，才会返回true
3. `boolean shouldShowRequestPermissionRationale(Activity activity, String... permissions)`  
   `boolean shouldShowRequestPermissionRationale(Fragment fragment, String... permissions)`  
   检查是否应该弹出权限说明框；只要有一个权限需要弹出说明框，就会返回true

该工具类的具体使用，我们在后面生成的辅助文件中进行说明。

## 3. annotation模块

annotation模块里面有5个注解

<figcaption>复制至GitHub README.md的解释</figcaption>

|Annotation|Required|Description|
|---|---|---|
|`@RuntimePermissions`|**✓**|Register an `Activity`, `Fragment` or [Controller](https://github.com/bluelinelabs/Conductor) to handle permissions|
|`@NeedsPermission`|**✓**|Annotate a method which performs the action that requires one or more permissions|
|`@OnShowRationale`||Annotate a method which explains why the permissions are needed. It passes in a `PermissionRequest` object which can be used to continue or abort the current permission request upon user input. If you don't specify any argument for the method compiler will generate `process${NeedsPermissionMethodName}ProcessRequest` and `cancel${NeedsPermissionMethodName}ProcessRequest`. You can use those methods in place of `PermissionRequest`(ex: with `DialogFragment`)|
|`@OnPermissionDenied`||Annotate a method which is invoked if the user doesn't grant the permissions|
|`@OnNeverAskAgain`||Annotate a method which is invoked if the user chose to have the device "never ask again" about a permission|

除了上面的几个注解外，还有一个与`@OnShowRationale`注解搭配使用的`PermissionRequest`接口，该接口有两个方法，分别用来进行权限的继续申请或者取消：

**PermissionRequest.java**

```java
/**
 * Interface used by {@link OnShowRationale} methods to allow for continuation
 * or cancellation of a permission request.
 */
public interface PermissionRequest {
    void proceed();

    void cancel();
}
```

用法在示例中有展示，根据权限提示框上对应的按钮，需要触发对应的方法。示例代码粘贴如下：

```kotlin
@OnShowRationale(Manifest.permission.CAMERA)
fun showRationaleForCamera(request: PermissionRequest) {
    // NOTE: Show a rationale to explain why the permission is needed, e.g. with a dialog.
    // Call proceed() or cancel() on the provided PermissionRequest to continue or abort
    showRationaleDialog(R.string.permission_camera_rationale, request)
}

@OnShowRationale(Manifest.permission.READ_CONTACTS, Manifest.permission.WRITE_CONTACTS)
fun showRationaleForContacts(request: PermissionRequest) {
    // NOTE: Show a rationale to explain why the permission is needed, e.g. with a dialog.
    // Call proceed() or cancel() on the provided PermissionRequest to continue or abort
    showRationaleDialog(R.string.permission_contacts_rationale, request)
}

private fun showRationaleDialog(@StringRes messageResId: Int, request: PermissionRequest) {
    AlertDialog.Builder(this)
            .setPositiveButton(R.string.button_allow) { _, _ -> request.proceed() }
            .setNegativeButton(R.string.button_deny) { _, _ -> request.cancel() }
            .setCancelable(false)
            .setMessage(messageResId)
            .show()
}
```

## 4. processor模块

接着就是最重要的processor模块了，这是一个注解处理器模块，用途就是在编辑时生成辅助文件，辅助文件参与后续的编译过程。关于注解的一些介绍，在[注解的定义及解析](/android/other/annotation/)一文中有详细的介绍。

要了解一个注解处理器的作用是什么，我们先要通过注册文件找到它，注册文件的目录是固定的：

**src/main/resources/META-INF/services/javax.annotation.processing.Processor**

```
permissions.dispatcher.processor.PermissionsProcessor
```

显然，processor模块的注解处理器代码就是`PermissionsProcessor.kt`，这就是本节的要点了。

同时，我们注意到`resources/META-INF/`目录下还有一个gradle目录，下面也有一个文件：

**src/main/resources/META-INF/gradle/incremental.annotation.processors**

```
permissions.dispatcher.processor.PermissionsProcessor,isolating
```

这是配置给Gradle的，目的是开启Gradle增量编译，具体内容可以参考 [Incremental annotation processing](https://docs.gradle.org/current/userguide/java_plugin.html#sec:incremental_annotation_processing)。

下面正式开始解读`PermissionsProcessor`，示例代码及对应的编译后的辅助文件可以参考[附录](/#_1)。

首先看看`PermissionsProcessor`除了`process`外的其他方法：

```kotlin
/** Element Utilities, obtained from the processing environment */
var ELEMENT_UTILS: Elements by Delegates.notNull()
/** Type Utilities, obtained from the processing environment */
var TYPE_UTILS: Types by Delegates.notNull()

class PermissionsProcessor : AbstractProcessor() {

    /* Processing Environment helpers */
    private var filer: Filer by Delegates.notNull()

    override fun init(processingEnv: ProcessingEnvironment) {
        super.init(processingEnv)
        filer = processingEnv.filer
        ELEMENT_UTILS = processingEnv.elementUtils
        TYPE_UTILS = processingEnv.typeUtils
    }

    override fun getSupportedSourceVersion(): SourceVersion? {
        return SourceVersion.latestSupported()
    }

    override fun getSupportedAnnotationTypes(): Set<String> {
        return hashSetOf(RuntimePermissions::class.java.canonicalName)
    }

    override fun process(annotations: Set<TypeElement>, roundEnv: RoundEnvironment): Boolean {
        ...
        return true
    }
}
```

这三个方法都是非常标准的写法，在`getSupportedAnnotationTypes`方法中表明了该注解处理器只处理`@RuntimePermissions`注解。这是因为，`@RuntimePermissions`注解修饰的是一个类，其他四种类型的注解都分布在该类里面，这些注解可以通过`Elements`来获取，就和DOM树一样。

接下来就是`process`方法了。在该方法中的步骤如下：

1. 首先创建了一个用于自增请求码的`RequestCodeProvider`对象；
2. 然后获取所有注解了`@RuntimePermissions`的Element，并将这些Element包装成为一个`RuntimePermissionsElement`对象；
3. 最后根据Element是否有`@Metadata`注解来判断源文件是Java编写还是Kotlin编写，进而调用相应的方法生成相应格式的辅助文件。 


```kotlin
override fun process(annotations: Set<TypeElement>, roundEnv: RoundEnvironment): Boolean {
    // Create a RequestCodeProvider which guarantees unique request codes for each permission request
    val requestCodeProvider = RequestCodeProvider()

    // The Set of annotated elements needs to be ordered
    // in order to achieve Deterministic, Reproducible Builds
    roundEnv.getElementsAnnotatedWith(RuntimePermissions::class.java)
            .sortedBy { it.simpleName.toString() }
            .forEach {
                val rpe = RuntimePermissionsElement(it as TypeElement)
                val kotlinMetadata = it.getAnnotation(Metadata::class.java)
                if (kotlinMetadata != null) {
                    processKotlin(it, rpe, requestCodeProvider)
                } else {
                    processJava(it, rpe, requestCodeProvider)
                }
            }
    return true
}
```

---

下面依次说说process方法三个步骤中的要点。  
`RequestCodeProvider`实现就是靠`AtomicInteger.andIncrement`方法，非常简单：

```kotlin
class RequestCodeProvider {
    private val currentCode = AtomicInteger(0)

    fun nextRequestCode(): Int = currentCode.andIncrement
}
```

---

至于`RuntimePermissionsElement`，则是`TypeElement`对象的包装类，而`TypeElement`对象就是我们在注解的Activity、Fragment类了。`RuntimePermissionsElement`的作用就是解析Element的各种值、保存Element里面四种注解注解的子Element，另外还有针对四种注解注解的子Element的检查。代码如下：

```kotlin
class RuntimePermissionsElement(val element: TypeElement) {
    val typeName: TypeName = TypeName.get(element.asType())
    val ktTypeName = element.asType().asTypeName()
    val typeVariables = element.typeParameters.map { TypeVariableName.get(it) }
    val ktTypeVariables = element.typeParameters.map { it.asTypeVariableName() }
    val packageName = element.packageName()
    val inputClassName = element.simpleString()
    val generatedClassName = inputClassName + GEN_CLASS_SUFFIX
    val needsElements = element.childElementsAnnotatedWith(NeedsPermission::class.java)
    private val onRationaleElements = element.childElementsAnnotatedWith(OnShowRationale::class.java)
    private val onDeniedElements = element.childElementsAnnotatedWith(OnPermissionDenied::class.java)
    private val onNeverAskElements = element.childElementsAnnotatedWith(OnNeverAskAgain::class.java)

    init {
        validateNeedsMethods()
        validateRationaleMethods()
        validateDeniedMethods()
        validateNeverAskMethods()
    }
    ...
}
```

注意最前面4个属性，以“kt”开头的是给Kotlin使用的，否则是给Java使用的；而且两者也是使用对应的的poet库文件获取的。但实际上，两者的值都是一致的，没有什么区别。且有一些字段调用的方法是kotlin扩展方法，需要注意一下。  
下表是以示例中的MainActivity为例子，给出的`RuntimePermissionsElement`中各个字段的解释以及值。

<figcaption>以示例中MainActivity为例，RuntimePermissionsElement中各个字段的解释以及值</figcaption>

| RuntimePermissionsElement字段 | 解释 | 对应的值 |
| ---------------------------- | --------------------- | --- |
| typeName / ktTypeName | Element全名 | permissions.dispatcher.samplekotlin.MainActivity |
| typeVariables / ktTypeVariables | Element的范型参数 | 空集合 |
| packageName | Element的包名 | permissions.dispatcher.samplekotlin |
| inputClassName | Element类名 | MainActivity |
| generatedClassName | 要生成的辅助文件的类名<br />后缀固定为`PermissionsDispatcher` | MainActivityPermissionsDispatcher |
| needsElements | `@NeedsPermission`注解的方法 | [showCamera(), showContacts()] |
| onRationaleElements | `@OnShowRationale`注解的方法 | [showRationaleForCamera(permissions.dispatcher.PermissionRequest), showRationaleForContact(permissions.dispatcher.PermissionRequest)] |
| onDeniedElements | `@OnPermissionDenied`注解的方法 | [onCameraDenied(), onContactsDenied()] |
| onNeverAskElements | `@OnNeverAskAgain`注解的方法 | [onCameraNeverAskAgain(), onContactsNeverAskAgain()] |

---

最后就是对每一个需要产生辅助文件的Element进行处理了。这里首先会通过`it.getAnnotation(Metadata::class.java)`获取Metadata，该注解是Kotlin文件特有的注解，所有的kotlin文件在经过kotlin编译器之后都会带上该注解。所以我们可以通过Element是否有该注解来确定是否是Kotlin文件。  
如果是kotlin文件，则调用`processKotlin`方法，否则调用`processJava`方法。两个方法以及相关的代码如下所示：

```kotlin
private fun processKotlin(element: Element, rpe: RuntimePermissionsElement, requestCodeProvider: RequestCodeProvider) {
    val processorUnit = findAndValidateProcessorUnit(kotlinProcessorUnits, element)
    val kotlinFile = processorUnit.createFile(rpe, requestCodeProvider)
    kotlinFile.writeTo(filer)
}

private fun processJava(element: Element, rpe: RuntimePermissionsElement, requestCodeProvider: RequestCodeProvider) {
    val processorUnit = findAndValidateProcessorUnit(javaProcessorUnits, element)
    val javaFile = processorUnit.createFile(rpe, requestCodeProvider)
    javaFile.writeTo(filer)
}

val javaProcessorUnits = listOf(JavaActivityProcessorUnit(), JavaFragmentProcessorUnit(), JavaConductorProcessorUnit())
val kotlinProcessorUnits = listOf(KotlinActivityProcessorUnit(), KotlinFragmentProcessorUnit(), KotlinConductorProcessorUnit())

fun <K> findAndValidateProcessorUnit(units: List<ProcessorUnit<K>>, element: Element): ProcessorUnit<K> {
    val type = element.asType()
    try {
        return units.first { type.isSubtypeOf(it.getTargetType()) }
    } catch (ex: NoSuchElementException) {
        throw WrongClassException(type)
    }
}
```

很显然，在`processKotlin`/`processJava`方法中，首先从`kotlinProcessorUnits`/`javaProcessorUnits`中找到能处理Element的处理器，然后调用处理器生成辅助文件，最后通过`Filer`写入到磁盘中。这就是上面代码干的事情。  

如何找到能够处理Element的处理器，这里涉及到了`TypeMirror`，通过`TypeMirror`就可以判断两个Element之间的关系。`KotlinActivityProcessorUnit`、`KotlinBaseProcessorUnit`可以处理的`TypeMirror`类型如下：

```kotlin
fun typeMirrorOf(className: String): TypeMirror = ELEMENT_UTILS.getTypeElement(className).asType()

class KotlinActivityProcessorUnit : KotlinBaseProcessorUnit() {
    override fun getTargetType(): TypeMirror = typeMirrorOf("android.app.Activity")
    ...
}

class KotlinFragmentProcessorUnit : KotlinBaseProcessorUnit() {
    override fun getTargetType(): TypeMirror = typeMirrorOf("androidx.fragment.app.Fragment")
    ...
}
```

因此，我们实例中的MainActivity就会被`KotlinActivityProcessorUnit`和`JavaActivityProcessorUnit`所处理。而两者`createFile`方法的实现在各自的基类`KotlinBaseProcessorUnit`、`JavaBaseProcessorUnit`中。

这两个类里面基本都是`javapoet`、`kotlinpoet`库的API了，具体用法可以参考GitHub主页：[JavaPoet](https://github.com/square/javapoet/)、[KotlinPoet](https://github.com/square/kotlinpoet/)。由于Java语法与Kotlin语法上的差异，所以导致两个库的使用上也有一些差异。

下面简单说一下`KotlinBaseProcessorUnit`、`JavaBaseProcessorUnit`在创建辅助文件时的代码，过多的细节不做进一步说明。

**KotlinBaseProcessorUnit.kt**

```kotlin
override fun createFile(rpe: RuntimePermissionsElement, requestCodeProvider: RequestCodeProvider): FileSpec {
    return FileSpec.builder(rpe.packageName, rpe.generatedClassName)
            .addComment(FILE_COMMENT)
            .addAnnotation(createJvmNameAnnotation(rpe.generatedClassName))
            .addProperties(createProperties(rpe, requestCodeProvider))
            .addFunctions(createWithPermissionCheckFuns(rpe))
            .addFunctions(createOnShowRationaleCallbackFuns(rpe))
            .addFunctions(createPermissionHandlingFuns(rpe))
            .addTypes(createPermissionRequestClasses(rpe))
            .build()
}
```

第2行`builder`方法指定了文件将要生成在哪个包下，文件名是什么。  
第3行则在生成的文件的第一行添加了一行注释。  
第4行将会在辅助文件头中添加`@file:JvmName("MainActivityPermissionsDispatcher")`注解，若没有该注解，则文件在编译后会加上“Kt”的后缀，Java代码调用时该类时需要注意。  
第5行会为每一个`@NeedsPermission`请求方法生成一个对应的请求码以及权限数组，且如果请求方法有参数，会生成额外的对象(`GrantableRequest`)或者字段来保存传入的值。  
第6行为每个`@NeedsPermission`请求方法生成对应的处理方法。  
第7行为每个无参数的`@NeedsPermission`请求方法生成对应的处理方法。  
第8行生成权限请求回调方法。  
第9行为每个请求生成一个`PermissionRequest`的实现类。  
上面就是Kotlin辅助文件的生成过程，对照[附录-MainActivity.kt in samplekotlin](#mainactivitykt-in-samplekotlin)与[附录-kt辅助文件
](#kt)有助于理解每一行的作用。


**JavaBaseProcessorUnit.kt**

```kotlin
final override fun createFile(rpe: RuntimePermissionsElement, requestCodeProvider: RequestCodeProvider): JavaFile {
    return JavaFile.builder(rpe.packageName, createTypeSpec(rpe, requestCodeProvider))
            .addFileComment(FILE_COMMENT)
            .build()
}

private fun createTypeSpec(rpe: RuntimePermissionsElement, requestCodeProvider: RequestCodeProvider): TypeSpec {
    return TypeSpec.classBuilder(rpe.generatedClassName)
            .addOriginatingElement(rpe.element) // for incremental annotation processing
            .addModifiers(Modifier.FINAL)
            .addFields(createFields(rpe, requestCodeProvider))
            .addMethod(createConstructor())
            .addMethods(createWithPermissionCheckMethods(rpe))
            .addMethods(createOnShowRationaleCallbackMethods(rpe))
            .addMethods(createPermissionHandlingMethods(rpe))
            .addTypes(createPermissionRequestClasses(rpe))
            .build()
}
```

上面就是Java辅助文件的生成过程，经过了KotlinBaseProcessorUnit之后，读起来应该不费力。同样，对照[附录-MainActivity.java in sample](#mainactivityjava-in-sample)与[附录-java辅助文件
](#java)有助于理解每一行的作用。

## 附录

### MainActivity.kt in samplekotlin

```kotlin
package permissions.dispatcher.samplekotlin

import android.Manifest
import android.os.Bundle
import android.widget.Button
import android.widget.Toast
import androidx.annotation.StringRes
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import permissions.dispatcher.*
import permissions.dispatcher.samplekotlin.camera.CameraPreviewFragment
import permissions.dispatcher.samplekotlin.contacts.ContactsFragment

@RuntimePermissions
class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        val buttonCamera: Button = findViewById(R.id.button_camera)
        buttonCamera.setOnClickListener {
            showCameraWithPermissionCheck()
        }
        val buttonContacts: Button = findViewById(R.id.button_contacts)
        buttonContacts.setOnClickListener {
            showContactsWithPermissionCheck()
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        // NOTE: delegate the permission handling to generated method
        onRequestPermissionsResult(requestCode, grantResults)
    }

    @NeedsPermission(Manifest.permission.CAMERA)
    fun showCamera() {
        // NOTE: Perform action that requires the permission. If this is run by PermissionsDispatcher, the permission will have been granted
        supportFragmentManager.beginTransaction()
                .replace(R.id.sample_content_fragment, CameraPreviewFragment.newInstance())
                .addToBackStack("camera")
                .commitAllowingStateLoss()
    }

    @OnPermissionDenied(Manifest.permission.CAMERA)
    fun onCameraDenied() {
        // NOTE: Deal with a denied permission, e.g. by showing specific UI
        // or disabling certain functionality
        Toast.makeText(this, R.string.permission_camera_denied, Toast.LENGTH_SHORT).show()
    }

    @OnShowRationale(Manifest.permission.CAMERA)
    fun showRationaleForCamera(request: PermissionRequest) {
        // NOTE: Show a rationale to explain why the permission is needed, e.g. with a dialog.
        // Call proceed() or cancel() on the provided PermissionRequest to continue or abort
        showRationaleDialog(R.string.permission_camera_rationale, request)
    }

    @OnNeverAskAgain(Manifest.permission.CAMERA)
    fun onCameraNeverAskAgain() {
        Toast.makeText(this, R.string.permission_camera_never_ask_again, Toast.LENGTH_SHORT).show()
    }

    @NeedsPermission(Manifest.permission.READ_CONTACTS, Manifest.permission.WRITE_CONTACTS)
    fun showContacts() {
        // NOTE: Perform action that requires the permission.
        // If this is run by PermissionsDispatcher, the permission will have been granted
        supportFragmentManager.beginTransaction()
                .replace(R.id.sample_content_fragment, ContactsFragment.newInstance())
                .addToBackStack("contacts")
                .commitAllowingStateLoss()
    }

    @OnPermissionDenied(Manifest.permission.READ_CONTACTS, Manifest.permission.WRITE_CONTACTS)
    fun onContactsDenied() {
        // NOTE: Deal with a denied permission, e.g. by showing specific UI
        // or disabling certain functionality
        Toast.makeText(this, R.string.permission_contacts_denied, Toast.LENGTH_SHORT).show()
    }

    @OnShowRationale(Manifest.permission.READ_CONTACTS, Manifest.permission.WRITE_CONTACTS)
    fun showRationaleForContacts(request: PermissionRequest) {
        // NOTE: Show a rationale to explain why the permission is needed, e.g. with a dialog.
        // Call proceed() or cancel() on the provided PermissionRequest to continue or abort
        showRationaleDialog(R.string.permission_contacts_rationale, request)
    }

    @OnNeverAskAgain(Manifest.permission.READ_CONTACTS, Manifest.permission.WRITE_CONTACTS)
    fun onContactsNeverAskAgain() {
        Toast.makeText(this, R.string.permission_contacts_never_ask_again, Toast.LENGTH_SHORT).show()
    }

    private fun showRationaleDialog(@StringRes messageResId: Int, request: PermissionRequest) {
        AlertDialog.Builder(this)
                .setPositiveButton(R.string.button_allow) { _, _ -> request.proceed() }
                .setNegativeButton(R.string.button_deny) { _, _ -> request.cancel() }
                .setCancelable(false)
                .setMessage(messageResId)
                .show()
    }
}
```

### kt辅助文件

```kotlin
// This file was generated by PermissionsDispatcher. Do not modify!
@file:JvmName("MainActivityPermissionsDispatcher")

package permissions.dispatcher.samplekotlin

import androidx.core.app.ActivityCompat
import java.lang.ref.WeakReference
import kotlin.Array
import kotlin.Int
import kotlin.IntArray
import kotlin.String
import permissions.dispatcher.PermissionRequest
import permissions.dispatcher.PermissionUtils

private const val REQUEST_SHOWCAMERA: Int = 0

private val PERMISSION_SHOWCAMERA: Array<String> = arrayOf("android.permission.CAMERA")

private const val REQUEST_SHOWCONTACTS: Int = 1

private val PERMISSION_SHOWCONTACTS: Array<String> = arrayOf("android.permission.READ_CONTACTS",
    "android.permission.WRITE_CONTACTS")

fun MainActivity.showCameraWithPermissionCheck() {
  if (PermissionUtils.hasSelfPermissions(this, *PERMISSION_SHOWCAMERA)) {
    showCamera()
  } else {
    if (PermissionUtils.shouldShowRequestPermissionRationale(this, *PERMISSION_SHOWCAMERA)) {
      showRationaleForCamera(MainActivityShowCameraPermissionRequest(this))
    } else {
      ActivityCompat.requestPermissions(this, PERMISSION_SHOWCAMERA, REQUEST_SHOWCAMERA)
    }
  }
}

fun MainActivity.showContactsWithPermissionCheck() {
  if (PermissionUtils.hasSelfPermissions(this, *PERMISSION_SHOWCONTACTS)) {
    showContacts()
  } else {
    if (PermissionUtils.shouldShowRequestPermissionRationale(this, *PERMISSION_SHOWCONTACTS)) {
      showRationaleForContacts(MainActivityShowContactsPermissionRequest(this))
    } else {
      ActivityCompat.requestPermissions(this, PERMISSION_SHOWCONTACTS, REQUEST_SHOWCONTACTS)
    }
  }
}

fun MainActivity.onRequestPermissionsResult(requestCode: Int, grantResults: IntArray) {
  when (requestCode) {
    REQUEST_SHOWCAMERA ->
     {
      if (PermissionUtils.verifyPermissions(*grantResults)) {
        showCamera()
      } else {
        if (!PermissionUtils.shouldShowRequestPermissionRationale(this, *PERMISSION_SHOWCAMERA)) {
          onCameraNeverAskAgain()
        } else {
          onCameraDenied()
        }
      }
    }
    REQUEST_SHOWCONTACTS ->
     {
      if (PermissionUtils.verifyPermissions(*grantResults)) {
        showContacts()
      } else {
        if (!PermissionUtils.shouldShowRequestPermissionRationale(this, *PERMISSION_SHOWCONTACTS)) {
          onContactsNeverAskAgain()
        } else {
          onContactsDenied()
        }
      }
    }
  }
}

private class MainActivityShowCameraPermissionRequest(
  target: MainActivity
) : PermissionRequest {
  private val weakTarget: WeakReference<MainActivity> = WeakReference(target)

  override fun proceed() {
    val target = weakTarget.get() ?: return
    ActivityCompat.requestPermissions(target, PERMISSION_SHOWCAMERA, REQUEST_SHOWCAMERA)
  }

  override fun cancel() {
    val target = weakTarget.get() ?: return
    target.onCameraDenied()
  }
}

private class MainActivityShowContactsPermissionRequest(
  target: MainActivity
) : PermissionRequest {
  private val weakTarget: WeakReference<MainActivity> = WeakReference(target)

  override fun proceed() {
    val target = weakTarget.get() ?: return
    ActivityCompat.requestPermissions(target, PERMISSION_SHOWCONTACTS, REQUEST_SHOWCONTACTS)
  }

  override fun cancel() {
    val target = weakTarget.get() ?: return
    target.onContactsDenied()
  }
}
```

### MainActivity.java in sample

```java
package permissions.dispatcher.sample;

import android.Manifest;
import android.content.DialogInterface;
import android.os.Bundle;
import android.view.View;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.StringRes;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import permissions.dispatcher.NeedsPermission;
import permissions.dispatcher.OnNeverAskAgain;
import permissions.dispatcher.OnPermissionDenied;
import permissions.dispatcher.OnShowRationale;
import permissions.dispatcher.PermissionRequest;
import permissions.dispatcher.RuntimePermissions;
import permissions.dispatcher.sample.camera.CameraPreviewFragment;
import permissions.dispatcher.sample.contacts.ContactsFragment;

@RuntimePermissions
public class MainActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        findViewById(R.id.button_camera).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                MainActivityPermissionsDispatcher.showCameraWithPermissionCheck(MainActivity.this);
            }
        });
        findViewById(R.id.button_contacts).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                MainActivityPermissionsDispatcher.showContactsWithPermissionCheck(MainActivity.this);
            }
        });
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        // NOTE: delegate the permission handling to generated method
        MainActivityPermissionsDispatcher.onRequestPermissionsResult(this, requestCode, grantResults);
    }

    @NeedsPermission(Manifest.permission.CAMERA)
    void showCamera() {
        // NOTE: Perform action that requires the permission. If this is run by PermissionsDispatcher, the permission will have been granted
        getSupportFragmentManager().beginTransaction()
                .replace(R.id.sample_content_fragment, CameraPreviewFragment.newInstance())
                .addToBackStack("camera")
                .commitAllowingStateLoss();
    }

    @OnPermissionDenied(Manifest.permission.CAMERA)
    void onCameraDenied() {
        // NOTE: Deal with a denied permission, e.g. by showing specific UI
        // or disabling certain functionality
        Toast.makeText(this, R.string.permission_camera_denied, Toast.LENGTH_SHORT).show();
    }

    @OnShowRationale(Manifest.permission.CAMERA)
    void showRationaleForCamera(PermissionRequest request) {
        // NOTE: Show a rationale to explain why the permission is needed, e.g. with a dialog.
        // Call proceed() or cancel() on the provided PermissionRequest to continue or abort
        showRationaleDialog(R.string.permission_camera_rationale, request);
    }

    @OnNeverAskAgain(Manifest.permission.CAMERA)
    void onCameraNeverAskAgain() {
        Toast.makeText(this, R.string.permission_camera_never_ask_again, Toast.LENGTH_SHORT).show();
    }

    @NeedsPermission({Manifest.permission.READ_CONTACTS, Manifest.permission.WRITE_CONTACTS})
    void showContacts() {
        // NOTE: Perform action that requires the permission.
        // If this is run by PermissionsDispatcher, the permission will have been granted
        getSupportFragmentManager().beginTransaction()
                .replace(R.id.sample_content_fragment, ContactsFragment.newInstance())
                .addToBackStack("contacts")
                .commitAllowingStateLoss();
    }

    @OnPermissionDenied({Manifest.permission.READ_CONTACTS, Manifest.permission.WRITE_CONTACTS})
    void onContactsDenied() {
        // NOTE: Deal with a denied permission, e.g. by showing specific UI
        // or disabling certain functionality
        Toast.makeText(this, R.string.permission_contacts_denied, Toast.LENGTH_SHORT).show();
    }

    @OnShowRationale({Manifest.permission.READ_CONTACTS, Manifest.permission.WRITE_CONTACTS})
    void showRationaleForContact(PermissionRequest request) {
        // NOTE: Show a rationale to explain why the permission is needed, e.g. with a dialog.
        // Call proceed() or cancel() on the provided PermissionRequest to continue or abort
        showRationaleDialog(R.string.permission_contacts_rationale, request);
    }

    @OnNeverAskAgain({Manifest.permission.READ_CONTACTS, Manifest.permission.WRITE_CONTACTS})
    void onContactsNeverAskAgain() {
        Toast.makeText(this, R.string.permission_contacts_never_ask_again, Toast.LENGTH_SHORT).show();
    }

    private void showRationaleDialog(@StringRes int messageResId, final PermissionRequest request) {
        new AlertDialog.Builder(this)
                .setPositiveButton(R.string.button_allow, new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(@NonNull DialogInterface dialog, int which) {
                        request.proceed();
                    }
                })
                .setNegativeButton(R.string.button_deny, new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(@NonNull DialogInterface dialog, int which) {
                        request.cancel();
                    }
                })
                .setCancelable(false)
                .setMessage(messageResId)
                .show();
    }
}
```

### java辅助文件

```java
// This file was generated by PermissionsDispatcher. Do not modify!
package permissions.dispatcher.sample;

import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import java.lang.Override;
import java.lang.String;
import java.lang.ref.WeakReference;
import permissions.dispatcher.PermissionRequest;
import permissions.dispatcher.PermissionUtils;

final class MainActivityPermissionsDispatcher {
  private static final int REQUEST_SHOWCAMERA = 0;

  private static final String[] PERMISSION_SHOWCAMERA = new String[] {"android.permission.CAMERA"};

  private static final int REQUEST_SHOWCONTACTS = 1;

  private static final String[] PERMISSION_SHOWCONTACTS = new String[] {"android.permission.READ_CONTACTS","android.permission.WRITE_CONTACTS"};

  private MainActivityPermissionsDispatcher() {
  }

  static void showCameraWithPermissionCheck(@NonNull MainActivity target) {
    if (PermissionUtils.hasSelfPermissions(target, PERMISSION_SHOWCAMERA)) {
      target.showCamera();
    } else {
      if (PermissionUtils.shouldShowRequestPermissionRationale(target, PERMISSION_SHOWCAMERA)) {
        target.showRationaleForCamera(new MainActivityShowCameraPermissionRequest(target));
      } else {
        ActivityCompat.requestPermissions(target, PERMISSION_SHOWCAMERA, REQUEST_SHOWCAMERA);
      }
    }
  }

  static void showContactsWithPermissionCheck(@NonNull MainActivity target) {
    if (PermissionUtils.hasSelfPermissions(target, PERMISSION_SHOWCONTACTS)) {
      target.showContacts();
    } else {
      if (PermissionUtils.shouldShowRequestPermissionRationale(target, PERMISSION_SHOWCONTACTS)) {
        target.showRationaleForContact(new MainActivityShowContactsPermissionRequest(target));
      } else {
        ActivityCompat.requestPermissions(target, PERMISSION_SHOWCONTACTS, REQUEST_SHOWCONTACTS);
      }
    }
  }

  static void onRequestPermissionsResult(@NonNull MainActivity target, int requestCode,
      int[] grantResults) {
    switch (requestCode) {
      case REQUEST_SHOWCAMERA:
      if (PermissionUtils.verifyPermissions(grantResults)) {
        target.showCamera();
      } else {
        if (!PermissionUtils.shouldShowRequestPermissionRationale(target, PERMISSION_SHOWCAMERA)) {
          target.onCameraNeverAskAgain();
        } else {
          target.onCameraDenied();
        }
      }
      break;
      case REQUEST_SHOWCONTACTS:
      if (PermissionUtils.verifyPermissions(grantResults)) {
        target.showContacts();
      } else {
        if (!PermissionUtils.shouldShowRequestPermissionRationale(target, PERMISSION_SHOWCONTACTS)) {
          target.onContactsNeverAskAgain();
        } else {
          target.onContactsDenied();
        }
      }
      break;
      default:
      break;
    }
  }

  private static final class MainActivityShowCameraPermissionRequest implements PermissionRequest {
    private final WeakReference<MainActivity> weakTarget;

    private MainActivityShowCameraPermissionRequest(@NonNull MainActivity target) {
      this.weakTarget = new WeakReference<MainActivity>(target);
    }

    @Override
    public void proceed() {
      MainActivity target = weakTarget.get();
      if (target == null) return;
      ActivityCompat.requestPermissions(target, PERMISSION_SHOWCAMERA, REQUEST_SHOWCAMERA);
    }

    @Override
    public void cancel() {
      MainActivity target = weakTarget.get();
      if (target == null) return;
      target.onCameraDenied();
    }
  }

  private static final class MainActivityShowContactsPermissionRequest implements PermissionRequest {
    private final WeakReference<MainActivity> weakTarget;

    private MainActivityShowContactsPermissionRequest(@NonNull MainActivity target) {
      this.weakTarget = new WeakReference<MainActivity>(target);
    }

    @Override
    public void proceed() {
      MainActivity target = weakTarget.get();
      if (target == null) return;
      ActivityCompat.requestPermissions(target, PERMISSION_SHOWCONTACTS, REQUEST_SHOWCONTACTS);
    }

    @Override
    public void cancel() {
      MainActivity target = weakTarget.get();
      if (target == null) return;
      target.onContactsDenied();
    }
  }
}
```