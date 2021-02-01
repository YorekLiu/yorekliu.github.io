---
title: "04 | 内存优化（下）：内存优化这件事，应该从哪里着手？"
---

!!! note "极客时间——[Android开发高手课](https://time.geekbang.org/column/intro/142)"
    本博客上的这些内容全是CV自[Android开发高手课](https://time.geekbang.org/column/intro/142)的原始内容，外加Sample的个人练习小结。若CV这个行动让您感到不适，请移步即可。  

**内存优化探讨**

那要进行内存优化，应该从哪里着手呢？我通常会从设备分级、Bitmap 优化和内存泄漏这三个方面入手

1. 设备分级  
    **内存优化首先需要根据设备环境来综合考虑**，专栏上一期我提到过很多同学陷入的一个误区：“内存占用越少越好”。其实我们可以让高端设备使用更多的内存，做到针对设备性能的好坏使用不同的内存分配和回收策略。  
    当然这需要有一个良好的架构设计支撑，在架构设计时需要做到以下几点。
    - 设备分级。使用类似 [device-year-class]((https://github.com/facebook/device-year-class)) 的策略对设备分级，对于低端机用户可以关闭复杂的动画，或者是某些功能；使用 565 格式的图片，使用更小的缓存内存等。在现实环境下，不是每个用户的设备都跟我们的测试机一样高端，在开发过程我们要学会思考功能要不要对低端机开启、在系统资源吃紧的时候能不能做降级。
    - 缓存管理。我们需要有一套统一的缓存管理机制，可以适当地使用内存；当“系统有难”时，也要义不容辞地归还。我们可以使用 OnTrimMemory 回调，根据不同的状态决定释放多少内存。对于大项目来说，可能存在几十上百个模块，统一缓存管理可以更好地监控每个模块的缓存大小。
    - 进程模型。一个空的进程也会占用 10MB 的内存，而有些应用启动就有十几个进程，甚至有些应用已经从双进程保活升级到四进程保活，所以减少应用启动的进程数、减少常驻进程、有节操的保活，对低端机内存优化非常重要。
    - 安装包大小。安装包中的代码、资源、图片以及 so 库的体积，跟它们占用的内存有很大的关系。一个 80MB 的应用很难在 512MB 内存的手机上流畅运行。这种情况我们需要考虑针对低端机用户推出 4MB 的轻量版本，例如 Facebook Lite、今日头条极速版都是这个思路。  
    安装包中的代码、图片、资源以及 so 库的大小跟内存究竟有哪些关系？你可以参考下面的这个表格。    
    ![安装包中代码、图片、资源、so库的大小与内存的关系](/assets/images/android/memory_in_apk.png)  
    <center>安装包中代码、图片、资源、so库的大小与内存的关系</center>

2. Bitmap优化  
   Bitmap 内存一般占应用总内存很大一部分，所以做内存优化永远无法避开图片内存这个“永恒主题”。  
   即使把所有的 Bitmap 都放到 Native 内存，并不代表图片内存问题就完全解决了，这样做只是提升了系统内存利用率，减少了 GC 带来的一些问题而已。
    - 统一图片库  
       图片内存优化的前提是收拢图片的调用，这样我们可以做整体的控制策略。例如低端机使用 565 格式、更加严格的缩放算法，可以使用 Glide、Fresco 或者采取自研都可以。而且需要进一步将所有 Bitmap.createBitmap、BitmapFactory 相关的接口也一并收拢。
    - 统一监控  
       在统一图片库后就非常容易监控 Bitmap 的使用情况了，这里主要有三点需要注意。
           - 大图片监控。我们需要注意某张图片内存占用是否过大，例如长宽远远大于 View 甚至是屏幕的长宽。在开发过程中，如果检测到不合规的图片使用，应该立即弹出对话框提示图片所在的 Activity 和堆栈，让开发同学更快发现并解决问题。在灰度和线上环境下可以将异常信息上报到后台，我们可以计算有多少比例的图片会超过屏幕的大小，也就是图片的 **“超宽率”**。
           - 重复图片监控。重复图片指的是 Bitmap 的像素数据完全一致，但是有多个不同的对象存在。这个监控不需要太多的样本量，一般只在内部使用。下图是一个简单的例子，你可以看到两张图片的内容完全一样，通过解决这张重复图片可以节省 1MB 内存。
           - 图片总内存。通过收拢图片使用，我们还可以统计应用所有图片占用的内存，这样在线上就可以按不同的系统、屏幕分辨率等维度去分析图片内存的占用情况。**在 OOM 崩溃的时候，也可以把图片占用的总内存、Top N 图片的内存都写到崩溃日志中，帮助我们排查问题。**
  
    讲完设备分级和 Bitmap 优化，我们发现架构和监控需要两手抓，一个好的架构可以减少甚至避免我们犯错，而一个好的监控可以帮助我们及时发现问题。

3. 内存泄漏  
    - Java内存泄漏
    - OOM监控
    - Native内存监控
    - GC监控

总的来说，内存优化应该看以下方面：

- 设备分级：缓存管理、进程模型、安装包大小
- Bitmap优化，Native内存，统一图片库、统一监控  
- 内存泄漏：Java内存泄漏、OOM监控、Native内存监控、GC监控

## 课后作业

使用HAHA库快速判断内存中是否存在重复的图片，且将这些重复图片的PNG、堆栈等信息输出。

该作业可以参考微信开源的Matrix中的部分[DuplicatedBitmapAnalyzer.java](https://github.com/Tencent/matrix/blob/master/matrix/matrix-android/matrix-resource-canary/matrix-resource-canary-analyzer/src/main/java/com/tencent/matrix/resource/analyzer/DuplicatedBitmapAnalyzer.java)，效果更好。

自己的作业如下，需要借助`leakcanary-analayzer-1.6.2.jar`以及`leakcanary-watcher-1.6.2.jar`解析堆栈信息。

实践起来还是有一些问题：

- 对比之下，堆栈打印不准确
- 自己作业对比微信的，找出来的元素更多，应该是误报

```groove tab="build.gradle"
apply plugin: 'java'
apply plugin: 'kotlin'

version 1.0

dependencies {
    implementation fileTree(include: ['*.jar'], dir: 'libs')
    implementation "org.jetbrains.kotlin:kotlin-stdlib:$kotlin_version"
    implementation 'com.squareup.haha:haha:2.0.4'
    implementation rootProject.ext.dependencies.gson
}

jar {
    manifest {
        attributes 'Main-Class': 'com.ximalaya.ting.kid.bitmap.Main'
        attributes 'Manifest-Version': version
    }

    from {
        exclude 'META-INF/MANIFEST.MF'
        exclude 'META-INF/*.SF'
        exclude 'META-INF/*.DSA'
        exclude 'META-INF/*.RSA'
        configurations.runtimeClasspath.collect {
            it.isDirectory() ? it : zipTree(it)
        }
    }
}

// copy the jar to work directory
task buildAlloctrackJar(type: Copy, dependsOn: [build, jar]) {
    group = "buildTool"
    from('build/libs') {
        include '*.jar'
        exclude '*-javadoc.jar'
        exclude '*-sources.jar'
    }
    into(rootProject.file("tools"))
}
```

```java tab="Main.java"
package com.ximalaya.ting.kid.bitmap;

import java.io.File;

/**
 * Created by yorek.liu 2020/5/19
 *
 * @author yorek.liu
 * email yorek.liu@ximalaya.com
 */
public class Main {

    public static void main(String[] args) {
        if (args == null || args.length == 0) {
            System.err.println("hprof file path is empty");
            return;
        }

        String hprofFilePath = args[0];
        File hprofFile = new File(hprofFilePath);
        String hprofFileDir = hprofFile.getParent();
        String outputImageDir = hprofFileDir + File.separator + "images";

        String outputPath;
        if (args.length >= 2) {
            outputPath = args[1];
        } else {
            outputPath = hprofFileDir + File.separator + "duplicate_bitmap_output_" + System.currentTimeMillis() + ".txt";
        }

        File file = new File(outputImageDir);
        if (!file.exists()) {
            file.mkdir();
        }

        long ts = System.currentTimeMillis();

        DuplicateBitmapChecker duplicateBitmapChecker = new DuplicateBitmapChecker();
        duplicateBitmapChecker.init(hprofFilePath, outputImageDir, outputPath);
        duplicateBitmapChecker.parseHprof();

        long costs = System.currentTimeMillis() - ts;
        LogWrapper.INSTANCE.i("DuplicateBitmapChecker","costs " + costs + "ms");
    }
}
```

```kotlin tab="DuplicateBitmapChecker.kt"
package com.ximalaya.ting.kid.bitmap

import com.google.gson.GsonBuilder
import com.squareup.haha.perflib.*
import com.squareup.haha.perflib.io.MemoryMappedFileBuffer
import com.squareup.leakcanary.*
import java.io.File
import java.io.FileOutputStream
import java.io.OutputStreamWriter
import java.util.*

/**
 * Created by yorek.liu 2020/5/14
 *
 * @author yorek.liu
 * email yorek.liu@ximalaya.com
 */
private const val TAG = "DuplicateBitmapChecker"

class DuplicateBitmapChecker {

    private lateinit var mHprofFilePath: String
    private lateinit var mOutputDir: String
    private lateinit var mOutputFilePath: String

    fun init(hprofFilePath: String, outputDir: String, outputFilePath: String) {
        mHprofFilePath = hprofFilePath
        mOutputDir = outputDir
        mOutputFilePath = outputFilePath
    }

    fun parseHprof() {
        LogWrapper.i(TAG, "ready to parse hprof file: $mHprofFilePath")

        val hprofFile = File(mHprofFilePath)

        val buffer = MemoryMappedFileBuffer(hprofFile)
        val parser = HprofParser(buffer)
        val snapshot = parser.parse()
        snapshot.computeDominators()

        LogWrapper.i(TAG, "parse hprof file completed")

        val bitmapClasses = snapshot.findClasses("android.graphics.Bitmap")
        val heaps = snapshot.heaps

        LogWrapper.i(TAG, "bitmapClasses.size=${bitmapClasses.size}, heaps.size=${heaps.size}")

        val gson = GsonBuilder()
            .setPrettyPrinting()
            .disableHtmlEscaping()
            .create()

        val fileOutputStream = FileOutputStream(mOutputFilePath)
        val fileWriter = OutputStreamWriter(fileOutputStream)
        heaps.filter {
            it.name == "app" || it.name == "default"
        }.forEach { heap ->
            analyzeHeap(bitmapClasses, heap, snapshot).forEach { analyzerResult ->
                fileWriter.write(analyzerResult.toJson(gson))
            }
        }
        fileWriter.flush()
        fileWriter.close()
        fileOutputStream.close()

        LogWrapper.i(TAG, "save output to $mOutputFilePath")
        LogWrapper.i(TAG, "save outputImages to dir: $mOutputDir")
    }

    private fun analyzeHeap(bitmapClasses: MutableCollection<ClassObj>, heap: Heap, snapshot: Snapshot): List<AnalyzerResult> {
        val resultList = mutableListOf<AnalyzerResult>()
        bitmapClasses.forEach { bitmapClass ->
            val instances = bitmapClass.getHeapInstances(heap.id)
            LogWrapper.i(TAG, "======================================================")
            LogWrapper.i(TAG, "${instances.size} instances found in heap ${heap.name}")

            val hashCodeList = IntArray(instances.size) { 0 }
            val hashCode2InstanceMap = HashMap<Int, MutableList<Instance>>()
            LogWrapper.i(TAG, "calculating hashcode ...")
            for (i in instances.indices) {
                if (instances[i].distanceToGcRoot == Int.MAX_VALUE) {
                    continue
                }
                val hashCode = getHashCode(instances[i])
                hashCodeList[i] = hashCode
                var instanceList = hashCode2InstanceMap[hashCode]
                if (instanceList == null) {
                    instanceList = mutableListOf()
                    hashCode2InstanceMap[hashCode] = instanceList
                }
                instanceList.add(instances[i])
            }

            LogWrapper.i(TAG, "${hashCode2InstanceMap.size} bitmap instance found")
            hashCode2InstanceMap.values.forEachIndexed { index, instanceList ->
                if (instanceList.size == 0 || instanceList.size == 1) {
                    LogWrapper.i(TAG, "analyzing #$index: skip due to the size: ${instanceList.size}")
                    return@forEachIndexed
                }
                LogWrapper.i(TAG, "analyzing #$index ...")
                val analyzerResult = getAnalyzerResult(instanceList, snapshot)
                resultList.add(analyzerResult)
            }

            LogWrapper.i(TAG, "======================================================")
            LogWrapper.i(TAG, "")
        }

        return resultList
    }

    private fun getHashCode(instance: Instance): Int {
        val classInstanceValues = (instance as ClassInstance).values
        val buffer = fieldValue<ArrayInstance>(classInstanceValues, "mBuffer")
        return Arrays.hashCode(buffer.values)
    }

    private fun getAnalyzerResult(instanceList: List<Instance>, snapshot: Snapshot): AnalyzerResult {
        val instance = instanceList[0]
        val classInstanceValues = (instance as ClassInstance).values

        val buffer = fieldValue<ArrayInstance>(classInstanceValues, "mBuffer")
        val bitmapWidth = fieldValue<Int>(classInstanceValues, "mWidth")
        val bitmapHeight = fieldValue<Int>(classInstanceValues, "mHeight")

        val analyzerResult = AnalyzerResult()
        analyzerResult.duplicateCount = instanceList.size
        analyzerResult.bufferSize = buffer.size
        analyzerResult.width = bitmapWidth
        analyzerResult.height = bitmapHeight
        try {
            val method = buffer.javaClass.getDeclaredMethod("asRawByteArray", Int::class.java, Int::class.java)
            method.isAccessible = true
            val imageDataByteArray = method.invoke(buffer, 0, buffer.size) as ByteArray
            method.isAccessible = false
            analyzerResult.bufferHash = DigestUtil.getMD5String(imageDataByteArray)
            analyzerResult.imageOutput = getOutputImagePath(analyzerResult.bufferHash)
            ARGB8888_BitmapExtractor.outputImage(bitmapWidth, bitmapHeight, imageDataByteArray, analyzerResult.imageOutput)
        } catch (e: Exception) { }

        for (ins in instanceList) {
            val leakTrace = getLeakTrace(ins, snapshot)
            analyzerResult.stacks.add(leakTrace.parse())
        }

        return analyzerResult
    }

    private fun getLeakTrace(instance: Instance, snapshot: Snapshot): LeakTrace? {
        val noOpRefs = ExcludedRefs.builder().build()
        val heapAnalyzer = HeapAnalyzer(noOpRefs, AnalyzerProgressListener.NONE, emptyList())

        try {
            val method = heapAnalyzer.javaClass.getDeclaredMethod(
                "findLeakTrace",
                Long::class.java,
                Snapshot::class.java,
                Instance::class.java,
                Boolean::class.java
            )
            method.isAccessible = true
            val analyzerResult = method.invoke(
                heapAnalyzer,
                System.nanoTime(),
                snapshot,
                instance,
                false
            ) as AnalysisResult
            return analyzerResult.leakTrace
        } catch (e: java.lang.Exception) {
            e.printStackTrace()
            return null
        }
    }

    private fun <T> fieldValue(values: List<ClassInstance.FieldValue>, fieldName: String): T {
        for (fieldValue in values) {
            if (fieldValue.field.name == fieldName) {
                return fieldValue.value as T
            }
        }
        throw java.lang.IllegalArgumentException("Field $fieldName does not exists")
    }

    private fun getOutputImagePath(fileName: String): String {
        return "$mOutputDir${File.separator}$fileName.png"
    }
}
```

```kotlin tab="LogWrapper.kt"
package com.ximalaya.ting.kid.bitmap

/**
 * Created by yorek.liu 2020/5/14
 *
 * @author yorek.liu
 * email yorek.liu@ximalaya.com
' */
object LogWrapper {

    private var mLogPrint: LogPrint = JavaLogPrint()

//    init {
//        try {
//            Class.forName("android.os.Build")
//            if (Build.VERSION.SDK_INT != 0) {
//                mLogPrint = AndroidLogPrint()
//            }
//        } catch (ignored: ClassNotFoundException) {
//            ignored.exception.printStackTrace()
//        }
//
//        if (!::mLogPrint.isInitialized) {
//            mLogPrint = JavaLogPrint()
//        }
//    }

    fun i(tag: String, message: String) {
        mLogPrint.i(tag, message)
    }

    abstract class LogPrint {
        abstract fun i(tag: String, message: String)
    }

    class AndroidLogPrint: LogPrint() {
        override fun i(tag: String, message: String) {
//            Log.i(tag, message)
        }
    }

    class JavaLogPrint: LogPrint() {
        override fun i(tag: String, message: String) {
            println(message)
        }
    }
}
```

```kotlin tab="LeakTraceParser.kt"
package com.ximalaya.ting.kid.bitmap

import com.squareup.leakcanary.LeakTrace
import com.squareup.leakcanary.LeakTraceElement
import java.util.*

/**
 * Created by yorek.liu 2020/5/18
 *
 * @author yorek.liu
 * email yorek.liu@ximalaya.com
 */
fun LeakTrace?.parse(): List<String> {
    val list = mutableListOf<String>()

    this ?: return list

    for (element in elements) {
        list.add(element.parse())
    }

    return list
}

fun LeakTraceElement.parse(): String {
    val stringBuilder = StringBuilder()

    if (reference !== null && reference.type === LeakTraceElement.Type.STATIC_FIELD) {
        stringBuilder.append("static ")
    }
    if (holder === LeakTraceElement.Holder.ARRAY || holder === LeakTraceElement.Holder.THREAD) {
        stringBuilder.append(holder.name.toLowerCase(Locale.getDefault())).append(" ")
    }

    stringBuilder.append(className)
    if (reference !== null) {
        stringBuilder.append(" ").append(reference.displayName)
        if (reference.value != null) {
            val subStringStart = reference.value.indexOf("(") + 1
            val subStringEnd = reference.value.indexOf(")")
            val refValueHashcode = reference.value.subSequence(subStringStart, subStringEnd)
            stringBuilder.append("(").append(refValueHashcode).append(")")
        }
    }

//    if (extra !== null) {
//        stringBuilder.append(" ").append(extra)
//    }

    return stringBuilder.toString()
}
```

```java tab="DigestUtil.java"
package com.ximalaya.ting.kid.bitmap;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

public final class DigestUtil {
    private static final char[] HEX_DIGITS
            = {'0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'};

    public static String getMD5String(byte[] buffer) {
        try {
            final MessageDigest md = MessageDigest.getInstance("MD5");
            md.update(buffer);
            final byte[] resBytes = md.digest();
            return bytesToHexString(resBytes);
        } catch (NoSuchAlgorithmException e) {
            // Should not happen.
            throw new IllegalStateException(e);
        }
    }

    private static String bytesToHexString(byte[] bytes) {
        final StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            if (b >= 0 && b <= 15) {
                sb.append('0').append(HEX_DIGITS[b]);
            } else {
                sb.append(HEX_DIGITS[(b >> 4) & 0x0F]).append(HEX_DIGITS[b & 0x0F]);
            }
        }
        return sb.toString();
    }

    private DigestUtil() {
        throw new UnsupportedOperationException();
    }
}
```

```kotlin tab="AnalyzerResult.kt"
package com.ximalaya.ting.kid.bitmap

import com.google.gson.Gson

/**
 * Created by yorek.liu 2020/5/14
 *
 * @author yorek.liu
 * email yorek.liu@ximalaya.com
 */
class AnalyzerResult {
    var duplicateCount: Int = 0
    val stacks: MutableList<List<String>> = mutableListOf()
    var bufferHash: String = ""
    var imageOutput: String = ""
    var bufferSize: Int = 0
    var width: Int = 0
    var height: Int = 0

    fun toJson(gson: Gson): String {
        return gson.toJson(this)
    }
}
```

```java tab="BitmapExtractor.java"
class ARGB8888_BitmapExtractor {

    public static void outputImage(int width, int height, byte[] rgba, String pngFilePath) throws IOException {
        BufferedImage bufferedImage = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);

        for (int y = 0; y < height; y++) {
            int stride = y * width;
            for (int x = 0; x < width; x++) {
                int i = (stride + x) * 4;
                long rgb = 0;
                rgb |= ((long) rgba[i] & 0xff) << 16; // r
                rgb |= ((long) rgba[i + 1] & 0xff) << 8;  // g
                rgb |= ((long) rgba[i + 2] & 0xff);       // b
                rgb |= ((long) rgba[i + 3] & 0xff) << 24; // a
                bufferedImage.setRGB(x, y, (int) (rgb & 0xffffffffl));
            }
        }
        File outputFile = new File(pngFilePath);
        ImageIO.write(bufferedImage, "png", outputFile);
    }
}
```