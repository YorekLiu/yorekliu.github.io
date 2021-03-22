---
title: "Matrix-IOCanary解析"
---

!!! tip "Wiki"  
    [Matrix - IOCanary](https://github.com/Tencent/matrix/wiki/Matrix-Android-IOCanary)

**目前 IOCanary 部分兼容到了 Android P**

在前面总纲中提到了，IOCanary分为四个检测场景：**主线程I/O、读写Buffer过小、重复读、Closeable泄漏监控**。至于为什么是这四个场景，可以查看[如何监控线上I/O操作](/android/paid/master/io_3/#_1)以及上面[matrix wiki](https://github.com/Tencent/matrix/wiki/Matrix-Android-IOCanary)中的相关部分。

**上面四个场景中，前面三个可以采用native hook的方式收集I/O信息，在`close`操作时计算并上报。后者可以借`StrictMode`的东风，这是Android系统底层自带的监控，通过简单的hook可以将`CloseGuard#reporter`替换成自己的实现，然后在其`report`函数中完成上报即可。**

关于Native Hook的一些知识，可以查看张绍文老师的[Native Hook](/android/paid/master/native_hook/)这篇文章。Matrix使用的native hook方案目前是爱奇艺的 [xHook](https://github.com/iqiyi/xHook) 方案，属于 PLT hook。

在Android中I/O的操作最终都会通过native层的`open`、`read`、`write`以及`close`函数。所以，我们只需要hook这几个函数，然后获取到与函数相关的入参、返回值等，基于这些信息我们就可以进行I/O操作的检测。最后检测完成之后进行上报。这部分内容可以参考[Matrix I/O —— 原理简述](https://github.com/Tencent/matrix/wiki/Matrix-Android-IOCanary#%E4%B8%80%E5%8E%9F%E7%90%86%E7%AE%80%E8%BF%B0)以及[Matrix I/O —— Hook方案介绍](https://github.com/Tencent/matrix/wiki/Matrix-Android-IOCanary#%E4%BA%8C%E6%94%B6%E9%9B%86%E6%96%87%E4%BB%B6-io-%E6%93%8D%E4%BD%9C%E4%BF%A1%E6%81%AFhook-%E6%96%B9%E6%A1%88%E7%AE%80%E4%BB%8B)

I/O 监控流程图如下：

![matrix_io_loop](/assets/images/android/ioloop.webp)

上面通过 Native Hook 可以检测到 **主线程I/O、读写Buffer过小、重复读** 的问题。还有一项 **Closeable泄漏监控** 可以通过 Java Hook的方式，具体实现可以查看 [Matrix I/O —— Closeable Leak 监控](https://github.com/Tencent/matrix/wiki/Matrix-Android-IOCanary#closeable-leak-%E7%9B%91%E6%8E%A7)。

Matrix 官方 Wiki 对于 IOCanary 的原理进行了详细的说明，通过文档我们就知道了大致的实现方向。下面我们通过代码对 Wiki 中的内容进行印证。 *Talk is cheap, show me the code.*

## 1. IOCanaryPlugin

我们首先看看 IOCanaryPlugin 的初始化、`start`、`stop`等函数，发现实现很简单，基本都代理给了 IOCanaryCore 这个类。

**<small>matrix/matrix-android/matrix-io-canary/src/main/java/com/tencent/matrix/iocanary/IOCanaryPlugin.java</small>**

```java
public class IOCanaryPlugin extends Plugin {
    private static final String TAG = "Matrix.IOCanaryPlugin";

    private final IOConfig     mIOConfig;
    private IOCanaryCore mCore;

    public IOCanaryPlugin(IOConfig ioConfig) {
        mIOConfig = ioConfig;
    }

    @Override
    public void init(Application app, PluginListener listener) {
        super.init(app, listener);
        IOCanaryUtil.setPackageName(app);
        mCore = new IOCanaryCore(this);
    }

    @Override
    public void start() {
        super.start();
        mCore.start();
    }

    @Override
    public void stop() {
        super.stop();
        mCore.stop();
    }

    public IOConfig getConfig() {
        return mIOConfig;
    }
    ...
}
```

在 IOCanaryCore 中会根据 IOConfig 的配置项进行四个场景的 hook；同时该类还作为四个场景检测出来的问题的 reporter 传递给 hooker。下面是配置 hook 相关的代码，由 `IOCanaryCore#start` 进行调用：

**<small>matrix/matrix-android/matrix-io-canary/src/main/java/com/tencent/matrix/iocanary/core/IOCanaryCore.java</small>**

```java
private void initDetectorsAndHookers(IOConfig ioConfig) {
    assert ioConfig != null;

    if (ioConfig.isDetectFileIOInMainThread()
        || ioConfig.isDetectFileIOBufferTooSmall()
        || ioConfig.isDetectFileIORepeatReadSameFile()) {
        IOCanaryJniBridge.install(ioConfig, this);
    }

    //if only detect io closeable leak use CloseGuardHooker is Better
    if (ioConfig.isDetectIOClosableLeak()) {
        mCloseGuardHooker = new CloseGuardHooker(this);
        mCloseGuardHooker.hook();
    }
}
```

我们可以看到，对于 **主线程I/O、读写Buffer过小、重复读** 这三种 native hook 的场景，由 `IOCanaryJniBridge` 进行进一步的 hook，而 **Closeable泄漏监控** 则由 `CloseGuardHooker` 进行具体的 hook。

## 2. IOCanaryJniBridge

### 2.1 hook流程

IOCanaryJniBridge 负责三种需要 native hook 的检测场景。在 `IOCanaryJniBridge#install` 操作中，会先加载对应的 so，然后根据配置启动 detector 并设置对应的上报阈值，最后调用 `doHook` 这个 native 方法进行 native 层面的 hook。

```java
public static void install(IOConfig config, OnJniIssuePublishListener listener) {
    MatrixLog.v(TAG, "install sIsTryInstall:%b", sIsTryInstall);
    if (sIsTryInstall) {
        return;
    }

    //load lib
    if (!loadJni()) {
        MatrixLog.e(TAG, "install loadJni failed");
        return;
    }

    //set listener
    sOnIssuePublishListener = listener;

    try {
        //set config
        if (config != null) {
            if (config.isDetectFileIOInMainThread()) {
                enableDetector(DetectorType.MAIN_THREAD_IO);
                // ms to μs
                setConfig(ConfigKey.MAIN_THREAD_THRESHOLD, config.getFileMainThreadTriggerThreshold() * 1000L);
            }

            if (config.isDetectFileIOBufferTooSmall()) {
                enableDetector(DetectorType.SMALL_BUFFER);
                setConfig(ConfigKey.SMALL_BUFFER_THRESHOLD, config.getFileBufferSmallThreshold());
            }

            if (config.isDetectFileIORepeatReadSameFile()) {
                enableDetector(DetectorType.REPEAT_READ);
                setConfig(ConfigKey.REPEAT_READ_THRESHOLD, config.getFileRepeatReadThreshold());
            }
        }

        //hook
        doHook();

        sIsTryInstall = true;
    } catch (Error e) {
        MatrixLog.printErrStackTrace(TAG, e, "call jni method error");
    }
}

private static boolean loadJni() {
    if (sIsLoadJniLib) {
        return true;
    }

    try {
        System.loadLibrary("io-canary");
    } catch (Exception e) {
        MatrixLog.e(TAG, "hook: e: %s", e.getLocalizedMessage());
        sIsLoadJniLib = false;
        return false;
    }

    sIsLoadJniLib = true;
    return true;
}

/**
  *  enum DetectorType {
  *    kDetectorMainThreadIO = 0,
  *    kDetectorSmallBuffer,
  *    kDetectorRepeatRead
  *  };
  */
private static final class DetectorType {
    static final int MAIN_THREAD_IO = 0;
    static final int SMALL_BUFFER = 1;
    static final int REPEAT_READ = 2;
}
private static native void enableDetector(int detectorType);

/**
  * enum IOCanaryConfigKey {
  *    kMainThreadThreshold = 0,
  *    kSmallBufferThreshold,
  *    kRepeatReadThreshold,
  * };
  */
private static final class ConfigKey {
    static final int MAIN_THREAD_THRESHOLD = 0;
    static final int SMALL_BUFFER_THRESHOLD = 1;
    static final int REPEAT_READ_THRESHOLD = 2;
}

private static native void setConfig(int key, long val);

private static native boolean doHook();
```

上面的 DetectorType 以及 ConfigKey 的值的定义，与注释中定义在 C 层的枚举一致； `config.getFileXX`获取到的默认值，也与 C 层的默认值一致。如果在 Java 层修改了 detector 的触发阈值， 那么 C 层检测时会以自定义的值为准。

注意到 IOCanaryJniBridge 中还有一个私有静态类 JavaContext 以及一个私有静态方法 getJavaContext，这两个东西是给 C++ 部分进行调用的。该类中有两个参数 threadName 以及 stack，这会作为底层 detector 进行判断的参数，同时上报 IO 问题时也会带上这两个参数。

```java
private static final class JavaContext {
    private final String stack;
    private final String threadName;

    private JavaContext() {
        stack = IOCanaryUtil.getThrowableStack(new Throwable());
        threadName = Thread.currentThread().getName();
    }
}

/**
    * 声明为private，给c++部分调用！！！不要干掉！！！
    * @return
    */
private static JavaContext getJavaContext() {
    try {
        return new JavaContext();
    } catch (Throwable th) {
        MatrixLog.printErrStackTrace(TAG, th, "get javacontext exception");
    }

    return null;
}
```

上面就是 Java 层的主要代码，下面我们看看 native 层干的事情，native 层的入口位于 io_canary_jni.cc 中。在加载 so 时，首先被调用的就是 `JNI_OnLoad` 方法。  

在 `JNI_OnLoad` 方法会持有 Java 层一些方法、成员变量的句柄，供后续使用。相关代码以及对应关系如下：

**<small>matrix/matrix-android/matrix-io-canary/src/main/cpp/io_canary_jni.cc</small>**

```c++
namespace iocanary {
    static jclass kJavaBridgeClass;
    static jmethodID kMethodIDOnIssuePublish;

    static jclass kJavaContextClass;
    static jmethodID kMethodIDGetJavaContext;
    static jfieldID kFieldIDStack;
    static jfieldID kFieldIDThreadName;

    static jclass kIssueClass;
    static jmethodID kMethodIDIssueConstruct;

    static jclass kListClass;
    static jmethodID kMethodIDListConstruct;
    static jmethodID kMethodIDListAdd;

    extern "C" {

        JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM *vm, void *reserved){
            __android_log_print(ANDROID_LOG_DEBUG, kTag, "JNI_OnLoad");
            kInitSuc = false;

            // 获取Java层一些方法、成员变脸的句柄
            if (!InitJniEnv(vm)) {
                return -1;
            }

            // 设置上报回调为OnIssuePublish函数
            iocanary::IOCanary::Get().SetIssuedCallback(OnIssuePublish);

            kInitSuc = true;
            __android_log_print(ANDROID_LOG_DEBUG, kTag, "JNI_OnLoad done");
            return JNI_VERSION_1_6;
        }

        static bool InitJniEnv(JavaVM *vm) {
            kJvm = vm;
            JNIEnv* env = NULL;
            if (kJvm->GetEnv((void**)&env, JNI_VERSION_1_6) != JNI_OK){
                __android_log_print(ANDROID_LOG_ERROR, kTag, "InitJniEnv GetEnv !JNI_OK");
                return false;
            }

            jclass temp_cls = env->FindClass("com/tencent/matrix/iocanary/core/IOCanaryJniBridge");
            if (temp_cls == NULL)  {
                __android_log_print(ANDROID_LOG_ERROR, kTag, "InitJniEnv kJavaBridgeClass NULL");
                return false;
            }
            // IOCanaryJniBridge
            kJavaBridgeClass = reinterpret_cast<jclass>(env->NewGlobalRef(temp_cls));

            jclass temp_java_context_cls = env->FindClass("com/tencent/matrix/iocanary/core/IOCanaryJniBridge$JavaContext");
            if (temp_java_context_cls == NULL)  {
                __android_log_print(ANDROID_LOG_ERROR, kTag, "InitJniEnv kJavaBridgeClass NULL");
                return false;
            }
            // IOCanaryJniBridge$JavaContext
            kJavaContextClass = reinterpret_cast<jclass>(env->NewGlobalRef(temp_java_context_cls));
            // IOCanaryJniBridge$JavaContext.stack
            kFieldIDStack = env->GetFieldID(kJavaContextClass, "stack", "Ljava/lang/String;");
            // IOCanaryJniBridge$JavaContext.threadName
            kFieldIDThreadName = env->GetFieldID(kJavaContextClass, "threadName", "Ljava/lang/String;");
            if (kFieldIDStack == NULL || kFieldIDThreadName == NULL) {
                __android_log_print(ANDROID_LOG_ERROR, kTag, "InitJniEnv kJavaContextClass field NULL");
                return false;
            }

            // IOCanaryJniBridge#onIssuePublish
            kMethodIDOnIssuePublish = env->GetStaticMethodID(kJavaBridgeClass, "onIssuePublish", "(Ljava/util/ArrayList;)V");
            if (kMethodIDOnIssuePublish == NULL) {
                __android_log_print(ANDROID_LOG_ERROR, kTag, "InitJniEnv kMethodIDOnIssuePublish NULL");
                return false;
            }

            // IOCanaryJniBridge#getJavaContext
            kMethodIDGetJavaContext = env->GetStaticMethodID(kJavaBridgeClass, "getJavaContext", "()Lcom/tencent/matrix/iocanary/core/IOCanaryJniBridge$JavaContext;");
            if (kMethodIDGetJavaContext == NULL) {
                __android_log_print(ANDROID_LOG_ERROR, kTag, "InitJniEnv kMethodIDGetJavaContext NULL");
                return false;
            }

            jclass temp_issue_cls = env->FindClass("com/tencent/matrix/iocanary/core/IOIssue");
            if (temp_issue_cls == NULL)  {
                __android_log_print(ANDROID_LOG_ERROR, kTag, "InitJniEnv kIssueClass NULL");
                return false;
            }
            // IOIssue
            kIssueClass = reinterpret_cast<jclass>(env->NewGlobalRef(temp_issue_cls));

            // IOIssue#init
            kMethodIDIssueConstruct = env->GetMethodID(kIssueClass, "<init>", "(ILjava/lang/String;JIJJIJLjava/lang/String;Ljava/lang/String;I)V");
            if (kMethodIDIssueConstruct == NULL) {
                __android_log_print(ANDROID_LOG_ERROR, kTag, "InitJniEnv kMethodIDIssueConstruct NULL");
                return false;
            }

            jclass list_cls = env->FindClass("java/util/ArrayList");
            // ArrayList
            kListClass = reinterpret_cast<jclass>(env->NewGlobalRef(list_cls));
            // ArrayList#init
            kMethodIDListConstruct = env->GetMethodID(list_cls, "<init>", "()V");
            // ArrayList#add
            kMethodIDListAdd = env->GetMethodID(list_cls, "add", "(Ljava/lang/Object;)Z");

            return true;
        }
    }
```

| C++ | Java |
| --- | ---- |
| kJavaBridgeClass | IOCanaryJniBridge |
| kMethodIDOnIssuePublish | IOCanaryJniBridge#onIssuePublish |
| kJavaContextClass | IOCanaryJniBridge$JavaContext |
| kMethodIDGetJavaContext | IOCanaryJniBridge#getJavaContext |
| kFieldIDStack | IOCanaryJniBridge$JavaContext.stack |
| kFieldIDThreadName | IOCanaryJniBridge$JavaContext.threadName |
| kIssueClass | IOIssue |
| kMethodIDIssueConstruct | IOIssue#init |
| kListClass | ArrayList |
| kMethodIDListConstruct | ArrayList#init |
| kMethodIDListAdd | ArrayList#add |

然后在 Java层 中会进行调用 native 层的 `enableDetector` 以及 `setConfig` 函数，后者这个方法就不说了。`enableDetector` 函数会向 IOCanary 这个单例对象中添加对应的 detector 实例。

```c++
// matrix/matrix-android/matrix-io-canary/src/main/cpp/io_canary_jni.cc
JNIEXPORT void JNICALL
Java_com_tencent_matrix_iocanary_core_IOCanaryJniBridge_enableDetector(JNIEnv *env, jclass type, jint detector_type) {
    iocanary::IOCanary::Get().RegisterDetector(static_cast<DetectorType>(detector_type));
}

// matrix/matrix-android/matrix-io-canary/src/main/cpp/core/io_canary.cc
void IOCanary::RegisterDetector(DetectorType type) {
        switch (type) {
            case DetectorType::kDetectorMainThreadIO:
                detectors_.push_back(new FileIOMainThreadDetector());
                break;
            case DetectorType::kDetectorSmallBuffer:
                detectors_.push_back(new FileIOSmallBufferDetector());
                break;
            case DetectorType::kDetectorRepeatRead:
                detectors_.push_back(new FileIORepeatReadDetector());
                break;
            default:
                break;
        }
    }
```

上面出现的三个 Detector 就是对应三种场景的了，我们后面分析具体检测算法的时候再讨论。下面再看看 Java 调用的 doHook 方法，在该方法的实现中，会调用 xHook 来 hook 对应 so 的对应函数。  

至于 hook 点如何确定，可以查看[Hook方案介绍](https://github.com/Tencent/matrix/wiki/Matrix-Android-IOCanary#%E4%BA%8C%E6%94%B6%E9%9B%86%E6%96%87%E4%BB%B6-io-%E6%93%8D%E4%BD%9C%E4%BF%A1%E6%81%AFhook-%E6%96%B9%E6%A1%88%E7%AE%80%E4%BB%8B)，方案中以 Android M 版本为例子，介绍了 hook 点的确定。M 版本上还是比较好确定的。

hook 相关代码如下：

**<small>matrix/matrix-android/matrix-io-canary/src/main/cpp/io_canary_jni.cc</small>**

```C
const static char* TARGET_MODULES[] = {
    "libopenjdkjvm.so",
    "libjavacore.so",
    "libopenjdk.so"
};
const static size_t TARGET_MODULE_COUNT = sizeof(TARGET_MODULES) / sizeof(char*);
...
JNIEXPORT jboolean JNICALL
Java_com_tencent_matrix_iocanary_core_IOCanaryJniBridge_doHook(JNIEnv *env, jclass type) {
    __android_log_print(ANDROID_LOG_INFO, kTag, "doHook");

    for (int i = 0; i < TARGET_MODULE_COUNT; ++i) {
        const char* so_name = TARGET_MODULES[i];
        __android_log_print(ANDROID_LOG_INFO, kTag, "try to hook function in %s.", so_name);

        void* soinfo = xhook_elf_open(so_name);
        if (!soinfo) {
            __android_log_print(ANDROID_LOG_WARN, kTag, "Failure to open %s, try next.", so_name);
            continue;
        }

        xhook_hook_symbol(soinfo, "open", (void*)ProxyOpen, (void**)&original_open);
        xhook_hook_symbol(soinfo, "open64", (void*)ProxyOpen64, (void**)&original_open64);

        bool is_libjavacore = (strstr(so_name, "libjavacore.so") != nullptr);
        if (is_libjavacore) {
            if (xhook_hook_symbol(soinfo, "read", (void*)ProxyRead, (void**)&original_read) != 0) {
                __android_log_print(ANDROID_LOG_WARN, kTag, "doHook hook read failed, try __read_chk");
                if (xhook_hook_symbol(soinfo, "__read_chk", (void*)ProxyReadChk, (void**)&original_read_chk) != 0) {
                    __android_log_print(ANDROID_LOG_WARN, kTag, "doHook hook failed: __read_chk");
                    xhook_elf_close(soinfo);
                    return JNI_FALSE;
                }
            }

            if (xhook_hook_symbol(soinfo, "write", (void*)ProxyWrite, (void**)&original_write) != 0) {
                __android_log_print(ANDROID_LOG_WARN, kTag, "doHook hook write failed, try __write_chk");
                if (xhook_hook_symbol(soinfo, "__write_chk", (void*)ProxyWriteChk, (void**)&original_write_chk) != 0) {
                    __android_log_print(ANDROID_LOG_WARN, kTag, "doHook hook failed: __write_chk");
                    xhook_elf_close(soinfo);
                    return JNI_FALSE;
                }
            }
        }

        xhook_hook_symbol(soinfo, "close", (void*)ProxyClose, (void**)&original_close);

        xhook_elf_close(soinfo);
    }

    __android_log_print(ANDROID_LOG_INFO, kTag, "doHook done.");
    return JNI_TRUE;
}
```

在上面的代码中，分别 hook libopenjdkjvm.so、libjavacore.so、libopenjdk.so 中的 `open`、`open64`、`close`函数，此外还会额外 hook libjavacore.so 的 `read`、`__read_chk`、`write`、`__write_chk` 的方法。这样打开、读写、关闭全流程都可以 hook 到了。hook 之后，调用被 hook 的函数都会先被 matrix 拦截处理。  

???+ note "xHook使用流程"
    此外，我们还可以看到 xHook 的使用是非常简单的，流程如下：  

    1. 调用 `xhook_elf_open` 打开对应的 so  
    2. 调用 `xhook_hook_symbol` hook 对应的方法  
    3. 调用 `xhook_elf_close` close 资源，防止资源泄漏  
    4. 如果需要还原 hook，也是调用 `xhook_hook_symbol` 进行 hook 点的还原

### 2.2 检测流程

native 部分的检测流程会分别在 `open`、`read`、`write` 时收集对应信息，然后在 `close` 时进行统一分析并上报。因此，前面三个操作的逻辑比较简单、清晰。

#### 2.2.1 open

matrix IO 模块目前只检测主线的 IO 问题，当 open 等操作执行成功时，才会进入统计、检测流程。  

在 open 操作中，会将入参与出参一起作为参数向下层传递，这里的返回值 ret 实际上是指文件描述符 fd。

```C
/**
 *  Proxy for open: callback to the java layer
 */
//todo astrozhou 解决非主线程打开，主线程操作问题
int ProxyOpen(const char *pathname, int flags, mode_t mode) {
    if(!IsMainThread()) {
        return original_open(pathname, flags, mode);
    }

    int ret = original_open(pathname, flags, mode);

    if (ret != -1) {
        DoProxyOpenLogic(pathname, flags, mode, ret);
    }

    return ret;
}

int ProxyOpen64(const char *pathname, int flags, mode_t mode) {
    if(!IsMainThread()) {
        return original_open64(pathname, flags, mode);
    }

    int ret = original_open64(pathname, flags, mode);

    if (ret != -1) {
        DoProxyOpenLogic(pathname, flags, mode, ret);
    }

    return ret;
}
```

在捕获到 open 操作后，下面就转入了 IOCanary 的处理逻辑了。在 `DoProxyOpenLogic` 函数中，首先调用 Java 层的 IOCanaryJniBridge#getJavaContext 方法获取当前的上下文环境 JavaContext，然后将 Java 层的 JavaContext 转为 C 层的 java_context；最后调用了 IOCanary#OnOpen 方法。

```C
static void DoProxyOpenLogic(const char *pathname, int flags, mode_t mode, int ret) {
    JNIEnv* env = NULL;
    kJvm->GetEnv((void**)&env, JNI_VERSION_1_6);
    if (env == NULL || !kInitSuc) {
        __android_log_print(ANDROID_LOG_ERROR, kTag, "ProxyOpen env null or kInitSuc:%d", kInitSuc);
    } else {
        jobject java_context_obj = env->CallStaticObjectMethod(kJavaBridgeClass, kMethodIDGetJavaContext);
        if (NULL == java_context_obj) {
            return;
        }

        jstring j_stack = (jstring) env->GetObjectField(java_context_obj, kFieldIDStack);
        jstring j_thread_name = (jstring) env->GetObjectField(java_context_obj, kFieldIDThreadName);

        char* thread_name = jstringToChars(env, j_thread_name);
        char* stack = jstringToChars(env, j_stack);
        JavaContext java_context(GetCurrentThreadId(), thread_name == NULL ? "" : thread_name, stack == NULL ? "" : stack);
        free(stack);
        free(thread_name);

        iocanary::IOCanary::Get().OnOpen(pathname, flags, mode, ret, java_context);

        env->DeleteLocalRef(java_context_obj);
        env->DeleteLocalRef(j_stack);
        env->DeleteLocalRef(j_thread_name);
    }
}
```

IOCanary#OnOpen 代理调用了 IOInfoCollector#OnOpen 方法。在后者的实现中，会以 fd 为 key， pathname、java_context 等值组成的对象 IOInfo 作为 value，保存到 info_map_ 这个 map 中。 IOInfo 这个对象里面的字段很多，包含了 IOCanary 对 IO 问题检测的各方面所需的字段，具体里面有什么我们下面遇到再说。 IOCanary#OnOpen 代码如下：

```C++
// matrix/matrix-android/matrix-io-canary/src/main/cpp/core/io_canary.cc
void IOCanary::OnOpen(const char *pathname, int flags, mode_t mode,
                        int open_ret, const JavaContext& java_context) {
    collector_.OnOpen(pathname, flags, mode, open_ret, java_context);
}

// matrix/matrix-android/matrix-io-canary/src/main/cpp/core/io_info_collector.cc
void IOInfoCollector::OnOpen(const char *pathname, int flags, mode_t mode
        , int open_ret, const JavaContext& java_context) {
    //__android_log_print(ANDROID_LOG_DEBUG, kTag, "OnOpen fd:%d; path:%s", open_ret, pathname);

    if (open_ret == -1) {
        return;
    }

    if (info_map_.find(open_ret) != info_map_.end()) {
        //__android_log_print(ANDROID_LOG_WARN, kTag, "OnOpen fd:%d already in info_map_", open_ret);
        return;
    }

    std::shared_ptr<IOInfo> info = std::make_shared<IOInfo>(pathname, java_context);
    info_map_.insert(std::make_pair(open_ret, info));
}
```

至此，open 流程相关的代码我们梳理了一下，就是以 open 操作中的 fd 为 key，对应的 IOInfo 为 value 保存到哈希表中备用。


#### 2.2.2 read/write

read 操作 hook 了 `read`、`__read_chk` 两个函数，函数定义如下：

```C
// read() attempts to read up to count bytes from file descriptor fd into the buffer starting at buf.
ssize_t read(int fd, void *buf, size_t count);

// The interface __read_chk() shall function in the same way as the interface read(), except that __read_chk() shall check for buffer overflow before computing a result. If an overflow is anticipated, the function shall abort and the program calling it shall exit.
// 
// The parameter buflen specifies the size of the buffer buf. If nbytes exceeds buflen, the function shall abort, and the program calling it shall exit.
// 
// The __read_chk() function is not in the source standard; it is only in the binary standard.
ssize_t __read_chk(int fd, void * buf, size_t nbytes, size_t buflen);
```

因此，读写操作的 buffer_size 都应该对应第三个参数才是。  

接着，我们看看代理函数。在读的代理函数中，依旧是只处理主线程的调用。这里面 ret 表示的是本次操作中读取到的字节长度，同时还记录本次读的操作耗时 read_cost_us。收集到入参、出参以及耗时这五项参数后，作为入参调用 IOCanary#OnRead 函数。

**<small>matrix/matrix-android/matrix-io-canary/src/main/cpp/io_canary_jni.cc</small>**

```C
/**
  *  Proxy for read: callback to the java layer
  */
ssize_t ProxyRead(int fd, void *buf, size_t size) {
    if(!IsMainThread()) {
        return original_read(fd, buf, size);
    }

    int64_t start = GetTickCountMicros();

    size_t ret = original_read(fd, buf, size);

    long read_cost_us = GetTickCountMicros() - start;

    //__android_log_print(ANDROID_LOG_DEBUG, kTag, "ProxyRead fd:%d buf:%p size:%d ret:%d cost:%d", fd, buf, size, ret, read_cost_us);

    iocanary::IOCanary::Get().OnRead(fd, buf, size, ret, read_cost_us);

    return ret;
}

ssize_t ProxyReadChk(int fd, void* buf, size_t count, size_t buf_size) {
    if(!IsMainThread()) {
        return original_read_chk(fd, buf, count, buf_size);
    }

    int64_t start = GetTickCountMicros();

    ssize_t ret = original_read_chk(fd, buf, count, buf_size);

    long read_cost_us = GetTickCountMicros() - start;

    //__android_log_print(ANDROID_LOG_DEBUG, kTag, "ProxyRead fd:%d buf:%p size:%d ret:%d cost:%d", fd, buf, size, ret, read_cost_us);

    iocanary::IOCanary::Get().OnRead(fd, buf, count, ret, read_cost_us);

    return ret;
}
```

在 IOCanary#OnRead 函数中，还是代理调用了 IOInfoCollector#OnRead 函数：

```C++
void IOCanary::OnRead(int fd, const void *buf, size_t size,
                        ssize_t read_ret, long read_cost) {
    collector_.OnRead(fd, buf, size, read_ret, read_cost);
}

void IOInfoCollector::OnRead(int fd, const void *buf, size_t size,
                            ssize_t read_ret, long read_cost) {

    if (read_ret == -1 || read_cost < 0) {
        return;
    }

    if (info_map_.find(fd) == info_map_.end()) {
            //__android_log_print(ANDROID_LOG_DEBUG, kTag, "OnRead fd:%d not in info_map_", fd);
        return;
    }

    CountRWInfo(fd, FileOpType::kRead, size, read_cost);
}
```

如果 fd 在 map 中，也就是说如果 open 时被捕获到了，那么才会进入 CountRWInfo 这个函数。CountRWInfo 会记录 IOInfo 所代表的文件的累计读写操作次数、累计buffer size、累计操作耗时、单次读写最大耗时、当前连续读写操作耗时、最大连续读写操作耗时、本次操作时间戳、最大操作buffer size、操作类型这些数据，具体看下面代码即可，一目了然。

**<small>matrix/matrix-android/matrix-io-canary/src/main/cpp/core/io_info_collector.cc</small>**

```C++
void IOInfoCollector::CountRWInfo(int fd, const FileOpType &fileOpType, long op_size, long rw_cost) {
    if (info_map_.find(fd) == info_map_.end()) {
        return;
    }

    // 获取系统的当前时间，单位微秒(us)
    const int64_t now = GetSysTimeMicros();

    // 累计读写操作次数累加
    info_map_[fd]->op_cnt_ ++;
    // 累计buffer size
    info_map_[fd]->op_size_ += op_size;
    // 累计文件读写耗时
    info_map_[fd]->rw_cost_us_ += rw_cost;

    // 单次文件读写最大耗时
    if (rw_cost > info_map_[fd]->max_once_rw_cost_time_μs_) {
        info_map_[fd]->max_once_rw_cost_time_μs_ = rw_cost;
    }

    //__android_log_print(ANDROID_LOG_DEBUG, kTag, "CountRWInfo rw_cost:%d max_once_rw_cost_time_:%d current_continual_rw_time_:%d;max_continual_rw_cost_time_:%d; now:%lld;last:%lld",
        //      rw_cost, info_map_[fd]->max_once_rw_cost_time_μs_, info_map_[fd]->current_continual_rw_time_μs_, info_map_[fd]->max_continual_rw_cost_time_μs_, now, info_map_[fd]->last_rw_time_ms_);

    // 连续读写耗时，若两次操作超过阈值（8000us，约为一帧耗时16.6667ms的一半），则不累计
    if (info_map_[fd]->last_rw_time_μs_ > 0 && (now - info_map_[fd]->last_rw_time_μs_) < kContinualThreshold) {
        info_map_[fd]->current_continual_rw_time_μs_ += rw_cost;
    } else {
        info_map_[fd]->current_continual_rw_time_μs_ = rw_cost;
    }

    // 最大连续读写耗时
    if (info_map_[fd]->current_continual_rw_time_μs_ > info_map_[fd]->max_continual_rw_cost_time_μs_) {
        info_map_[fd]->max_continual_rw_cost_time_μs_ = info_map_[fd]->current_continual_rw_time_μs_;
    }
    // 本次读写记录的时间戳
    info_map_[fd]->last_rw_time_μs_ = now;

    // 最大读写操作buffer size
    if (info_map_[fd]->buffer_size_ < op_size) {
        info_map_[fd]->buffer_size_ = op_size;
    }

    // 读写操作类型
    if (info_map_[fd]->op_type_ == FileOpType::kInit) {
        info_map_[fd]->op_type_ = fileOpType;
    }
}
```

我们可以看到 read 时就将对 IOInfo 里面的字段进行了赋值。实际上对 write 操作的统计也和 read 操作类似，最后也是调用的 CountRWInfo 函数对写操作进行统计，这里不做更多赘述。

#### 2.2.3 close















### open

**io_canary_jni.cc**  
ret = {path_name, flags, mode}  // ret: fd
{path_name, flags, mode, ret}  
{path_name, flags, mode, ret, java_context} // java_context: call java method, and converted fields to native

**io_canary.cc**  
IOInfoCollectore::OnOpen  
info_map_: {ret, IOInfo(path_name, java_context)}

### read

**io_canary_jni.cc**  
ret = {fd, buf, size}  // ret: ssize_t  
{fd, buf, size, ret, read_cost_us}  

**io_canary.cc**  
IOInfoCollectore::OnRead  
IOInfoCollector::CountRWInfo(fd, kRead, size, read_cost_us) // 记录：累计读写操作次数、累计buffer size、累计操作耗时、单次读写最大耗时、当前连续读写操作耗时、最大连续读写操作耗时、本次操作时间戳、最大操作buffer size、操作类型

???+ question "__read_chk中buffer_size为什么要取count而不是buf_size"  
    等后面上报的时候查查到底是什么含义

### write

**io_canary_jni.cc**  
ret = {fd, buf, size}  // ret: ssize_t  
{fd, buf, size, ret, write_cost_us}  

**io_canary.cc**  
IOInfoCollectore::OnWrite  
IOInfoCollector::CountRWInfo(fd, kWrite, size, write_cost_us) // 记录：累计读写操作次数、累计buffer size、累计操作耗时、单次读写最大耗时、当前连续读写操作耗时、最大连续读写操作耗时、本次操作时间戳、最大操作buffer size、操作类型

???+ question "__write_chk中buffer_size为什么要取count而不是buf_size"  
    等后面上报的时候查查到底是什么含义

### close

**io_canary_jni.cc**  
ret = {fd} 

**io_canary.cc**  
IOInfo info = IOInfoCollectore::OnClose(fd, ret)  // 记录：IOInfo从open到close的整个耗时、查询path_name的文件大小  
IOCanary::OfferFileIOInfo(info)  // 生产者消费者模式，offer之后会在IOCanary::Detect中获取到，然后提交给detector进行检测  
detector->Detect(_env, *file_io_info, published_issues)  
issued_callback_(published_issues)  
上报到IOCanaryJniBridge#onIssuePublish方法  

### main_thread_detector  

在主线程中：
1. 单次读写超过13ms，置type=1
2. 连续读写超过500ms，置type |= 2

将检测结果保存到repeat_read_cnt_中

### small_buffer_detector

操作次数大于20次 且 平均操作buff_size小于4096 且 连续读写耗时大于等于13ms

### repeat_read_detector

没有发现操作记录且最大连续读写耗时小于13ms则直接return；否则以path_name作为key保存记录  
若当前文件操作为写操作，则清空key对应的栈。  
构造RepeatReadInfo对象，若key对应的数组为空栈，直接push后结束  
否则检查当前时间与栈顶元素的构造时间进行比较，若时间只差超过17ms，则说明不构成重复读操作，清除栈。  
否则从栈中找到与当前对象相等的info，累加重复读标志；  
若找不到相等对象，则压入栈；**否则检查重复读次数是否超过阈值（5），若超过则进行上报**。

### Closeable泄漏监控

hook `dalvik.system.CloseGuard#reporter`，动态代理其`report`方法。



## 3. CloseGuardHooker