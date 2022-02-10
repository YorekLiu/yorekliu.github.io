---
title: "Matrix-ASM插桩插件解析"
---

matrix-plugin插件有两个功能模块：

1. `trace`：给每个需要插桩的方法分配唯一的方法id，并在方法的进出口插入一段代码，为TraceCanary模块分析实际问题提供数据支撑。
2. `removeUnusedResources`：在合成apk之前移除apkchecker检测出来的没有用到的资源清单，可以自动化的减少最终包体积大小。

## 1. AGP的入口

程序都有`main`方法作为程序的入口方法，那么Android Gradle Plugin(AGP)的入口在哪里呢。  

其实AGP的入口文件也比较固定，位于`src/main/resources/META-INF/gradle-plugins`目录下。在`matrix-gradle-plugin`的对应目录下我们发现了一个文件：`com.tencent.matrix-plugin.properties`。  
`.properties`是文件的后缀名，因此这个文件的名称就是`com.tencent.matrix-plugin`。我们在应用插件的时候，填上这个名字就行了。

我们在sample中印证一下，看看在sample中是如何应用matrix-plugin的：`apply plugin: 'com.tencent.matrix-plugin'`。

`*.properties`里面的写法也很固定：`implementation-class=com.tencent.matrix.plugin.MatrixPlugin`。这表示了这个Plugin真正的实现类是`com.tencent.matrix.plugin.MatrixPlugin`。

因此，我们可以直奔`MatrixPlugin`类看里面的实现了。  

???+ warning "注意"  
    有些库会提供多个插件，实现上只需要在`src/main/resources/META-INF/gradle-plugins`目录下放多个`.properties`文件，每个文件指定自己的实现类即可。

## 2. MatrixPlugin

自定义的插件需要实现了`Plugin`接口，并在`apply`方法里面完成要做的事情。

在`MatrixPlugin`中干了两件事。

1. 首先是在项目的配置阶段通过`project.extensions.create(name, type)`方法将插件的自定义配置项以对应的type创建并保存起来，之后可以通过`project.name`获取到对应的配置项。
2. 其次在项目配置完毕的回调`project.afterEvaluate`（这个回调会在tasks执行之前进行执行）中，将要执行任务的插入到task链中并设置依赖关系。这样随着构建任务的一个个执行，会执行到我们的代码。  
  对`MatrixPlugin`的两个子功能模块来说，这一步实现的方式有一点区别。`trace`模块因为是对所有有效的方法进行插桩，需要在proguard等任务完成之后在执行，而这个时序不太好通过依赖关系进行确定，因此选择了hook了class打包成dex的这一过程，最终达到了先插桩后打dex的目的。而`removeUnusedResources`只需要在将所有资源打包成apk之前执行即可。这两个子模块将会分开讨论。

<small>**src/main/groovy/com/tencent/matrix/plugin/MatrixPlugin.groovy**</small>

```groovy
class MatrixPlugin implements Plugin<Project> {
    private static final String TAG = "Matrix.MatrixPlugin"

    @Override
    void apply(Project project) {
        // 创建并保存自定义配置项
        project.extensions.create("matrix", MatrixExtension)
        project.matrix.extensions.create("trace", MatrixTraceExtension)
        project.matrix.extensions.create("removeUnusedResources", MatrixDelUnusedResConfiguration)
        if (!project.plugins.hasPlugin('com.android.application')) {
            throw new GradleException('Matrix Plugin, Android Application plugin required')
        }

        project.afterEvaluate {
            def android = project.extensions.android
            def configuration = project.matrix
            android.applicationVariants.all { variant ->

                // 注入trace模块
                if (configuration.trace.enable) {
                    com.tencent.matrix.trace.transform.MatrixTraceTransform.inject(project, configuration.trace, variant.getVariantData().getScope())
                }

                // 创建RemoveUnusedResourcesTask并设置依赖项
                if (configuration.removeUnusedResources.enable) {
                    if (Util.isNullOrNil(configuration.removeUnusedResources.variant) || variant.name.equalsIgnoreCase(configuration.removeUnusedResources.variant)) {
                        Log.i(TAG, "removeUnusedResources %s", configuration.removeUnusedResources)
                        RemoveUnusedResourcesTask removeUnusedResourcesTask = project.tasks.create("remove" + variant.name.capitalize() + "UnusedResources", RemoveUnusedResourcesTask)
                        removeUnusedResourcesTask.inputs.property(RemoveUnusedResourcesTask.BUILD_VARIANT, variant.name)
                        project.tasks.add(removeUnusedResourcesTask)
                        // RemoveUnusedResourcesTask依赖于packageApplication，即packageApplication先执行
                        removeUnusedResourcesTask.dependsOn variant.packageApplication
                        // assemble依赖于RemoveUnusedResourcesTask，即RemoveUnusedResourcesTask先执行
                        // 也就是说，执行顺序为packageApplication -> RemoveUnusedResourcesTask -> assemble
                        variant.assemble.dependsOn removeUnusedResourcesTask
                    }
                }
            }
        }
    }
}
```

## 3. MatrixTraceTransform

在上面`MatrixPlugin`的代码中可以看到，对于`trace`模块调用了`MatrixTraceTransform#inject`方法。  

在该方法中会遍历task，找到指定名称的task，替换里面的transform对象为`MatrixTraceTransform`对象。

<small>**src/main/java/com/tencent/matrix/trace/transform/MatrixTraceTransform.java**</small>

```java
public static void inject(Project project, MatrixTraceExtension extension, VariantScope variantScope) {
    ...
    try {
        String[] hardTask = getTransformTaskName(extension.getCustomDexTransformName(), variant.getName());
        for (Task task : project.getTasks()) {
            for (String str : hardTask) {
                if (task.getName().equalsIgnoreCase(str) && task instanceof TransformTask) {
                    TransformTask transformTask = (TransformTask) task;
                    Log.i(TAG, "successfully inject task:" + transformTask.getName());
                    Field field = TransformTask.class.getDeclaredField("transform");
                    field.setAccessible(true);
                    field.set(task, new MatrixTraceTransform(config, transformTask.getTransform()));
                    break;
                }
            }
        }
    } catch (Exception e) {
        Log.e(TAG, e.toString());
    }
}

private static String[] getTransformTaskName(String customDexTransformName, String buildTypeSuffix) {
    if (!Util.isNullOrNil(customDexTransformName)) {
        return new String[]{customDexTransformName + "For" + buildTypeSuffix};
    } else {
        String[] names = new String[]{
                "transformClassesWithDexBuilderFor" + buildTypeSuffix,
                "transformClassesWithDexFor" + buildTypeSuffix,
        };
        return names;
    }
}
```

`extension.getCustomDexTransformName()`一般没有配置，以release版本为例，所以最终要hook的task为`transformClassesWithDexBuilderForRelease`以及`transformClassesWithDexForRelease`，对应的transform为`DexTransform`。

采用注册方式添加的transform，会生成一个对应的Task。Task的名称生成规则可以参考`TransformManager`的这段代码：

```java
String taskName = scope.getTaskName(getTaskNamePrefix(transform));

@NonNull
private static String getTaskNamePrefix(@NonNull Transform transform) {
    StringBuilder sb = new StringBuilder(100);
    sb.append("transform");

    Iterator<ContentType> iterator = transform.getInputTypes().iterator();
    // there's always at least one
    sb.append(capitalize(iterator.next().name().toLowerCase(Locale.getDefault())));
    while (iterator.hasNext()) {
        sb.append("And").append(capitalize(
                iterator.next().name().toLowerCase(Locale.getDefault())));
    }

    sb.append("With").append(capitalize(transform.getName())).append("For");

    return sb.toString();
}

//////////////////
@Override
@NonNull
public String getTaskName(@NonNull String prefix) {
    return getTaskName(prefix, "");
}

@Override
@NonNull
public String getTaskName(@NonNull String prefix, @NonNull String suffix) {
    return prefix + StringHelper.capitalize(getVariantOutputData().getFullName()) + suffix;
}
//////////////////
```

当然，Matrix plugin是借壳的，所以task名称还是被hook的task名。  

此外，自定义transform还有几个要素，即实现其`getInputTypes`、`getOutputTypes`、`getScopes`、`getName`、`isIncremental`以及最重要的`transform`方法。换句话说，自定义transform需要指定什么范围的什么输入，经过怎么样的transform，最后输出什么。

在`MatrixTraceTransform#transform`方法中，先执行了自己要做的事情，然后再调用了原始的transform方法进行后续的操作。

```java
@Override
public void transform(TransformInvocation transformInvocation) throws TransformException, InterruptedException, IOException {
    super.transform(transformInvocation);
    long start = System.currentTimeMillis();
    try {
        doTransform(transformInvocation); // hack
    } catch (ExecutionException e) {
        e.printStackTrace();
    }
    long cost = System.currentTimeMillis() - start;
    long begin = System.currentTimeMillis();
    origTransform.transform(transformInvocation);
    long origTransformCost = System.currentTimeMillis() - begin;
    Log.i("Matrix." + getName(), "[transform] cost time: %dms %s:%sms MatrixTraceTransform:%sms", System.currentTimeMillis() - start, origTransform.getClass().getSimpleName(), origTransformCost, cost);
}
```

下面，我们的重点就来到了`doTransform`方法中。这里matrix分为了三个小步骤：

1. 混淆处理过程：将编译生成的mapping文件进行解析，保存到`MappingCollector`中；将内置黑名单以及配置的黑名单(blackListFile)利用`MappingCollector`进行混淆，利于后面在处理时直接进行匹配，这些黑名单（不需要进行插桩的类或者包）保存到`blackSet`中；解析配置的baseMethodMapFile文件，并利用`MappingCollector`进行混淆后，保存到`collectedMethodMap`文件中。最后收集所有目录和jar中的文件到`dirInputOutMap`和`jarInputOutMap`中，这个过程需要注意处理增量的情况。
   ```java
    long start = System.currentTimeMillis();

    List<Future> futures = new LinkedList<>();

    final MappingCollector mappingCollector = new MappingCollector();
    final AtomicInteger methodId = new AtomicInteger(0);
    final ConcurrentHashMap<String, TraceMethod> collectedMethodMap = new ConcurrentHashMap<>();

    futures.add(executor.submit(new ParseMappingTask(mappingCollector, collectedMethodMap, methodId)));

    Map<File, File> dirInputOutMap = new ConcurrentHashMap<>();
    Map<File, File> jarInputOutMap = new ConcurrentHashMap<>();
    Collection<TransformInput> inputs = transformInvocation.getInputs();

    for (TransformInput input : inputs) {

        for (DirectoryInput directoryInput : input.getDirectoryInputs()) {
            futures.add(executor.submit(new CollectDirectoryInputTask(dirInputOutMap, directoryInput, isIncremental)));
        }

        for (JarInput inputJar : input.getJarInputs()) {
            futures.add(executor.submit(new CollectJarInputTask(inputJar, isIncremental, jarInputOutMap, dirInputOutMap)));
        }
    }

    for (Future future : futures) {
        future.get();
    }
    futures.clear();

    Log.i(TAG, "[doTransform] Step(1)[Parse]... cost:%sms", System.currentTimeMillis() - start);
   ```

2. 遍历`dirInputOutMap`和`jarInputOutMap`中的所有class文件的所有非抽象方法，在方法结尾时判断该方法是不是空方法、是不是get/set方法、是不是默认或匿名构造方法、以及是不是黑名单方法，这些方法属于被过滤掉的方法；而其他方法将会被插桩。这两种类型的方法会被记录下来，分别保存在`app/build/outputs/mapping/debug/ignoreMethodMapping.txt`、`app/build/outputs/mapping/debug/methodMapping.txt`中。这一步是ASM实现的，但是只有一些判断逻辑，只读入了文件，不涉及到字节码的插入以及生成文件的回写，代码位于`MethodCollector`中。
   ```java
    start = System.currentTimeMillis();
    MethodCollector methodCollector = new MethodCollector(executor, mappingCollector, methodId, config, collectedMethodMap);
    methodCollector.collect(dirInputOutMap.keySet(), jarInputOutMap.keySet());
    Log.i(TAG, "[doTransform] Step(2)[Collection]... cost:%sms", System.currentTimeMillis() - start);
   ```

3. 这一步真正实现了字节码的插入功能。由于操作了字节码，所以需要将操作后的文件写入到指定位置，功能上最为复杂。这里我们着重分析一下。
   ```java
    start = System.currentTimeMillis();
    MethodTracer methodTracer = new MethodTracer(executor, mappingCollector, config, methodCollector.getCollectedMethodMap(), methodCollector.getCollectedClassExtendMap());
    methodTracer.trace(dirInputOutMap, jarInputOutMap);
    Log.i(TAG, "[doTransform] Step(3)[Trace]... cost:%sms", System.currentTimeMillis() - start);
   ```

src与jar，插桩过程这两个目录上的操作比较相似，这里与较为简单的src为例进行说明。

<small>**src/main/java/com/tencent/matrix/trace/MethodTracer.java**</small>

```java
public void trace(Map<File, File> srcFolderList, Map<File, File> dependencyJarList) throws ExecutionException, InterruptedException {
    List<Future> futures = new LinkedList<>();
    traceMethodFromSrc(srcFolderList, futures);
    traceMethodFromJar(dependencyJarList, futures);
    for (Future future : futures) {
        future.get();
    }
    futures.clear();
}

private void traceMethodFromSrc(Map<File, File> srcMap, List<Future> futures) {
    if (null != srcMap) {
        for (Map.Entry<File, File> entry : srcMap.entrySet()) {
            futures.add(executor.submit(new Runnable() {
                @Override
                public void run() {
                    innerTraceMethodFromSrc(entry.getKey(), entry.getValue());
                }
            }));
        }
    }
}
```

可以看到，重点在`innerTraceMethodFromSrc`方法中。该方法会使用ASM操作输入目录中的不含R、Manifest、BuildConfig关键词的所有class文件，然后将操作结果写到指定的output；当然，被过滤掉的文件也需要写到指定的output，只是不需要经过ASM操作而已。

```java
private void innerTraceMethodFromSrc(File input, File output) {

    ArrayList<File> classFileList = new ArrayList<>();
    if (input.isDirectory()) {
        listClassFiles(classFileList, input);
    } else {
        classFileList.add(input);
    }

    for (File classFile : classFileList) {
        InputStream is = null;
        FileOutputStream os = null;
        try {
            final String changedFileInputFullPath = classFile.getAbsolutePath();
            final File changedFileOutput = new File(changedFileInputFullPath.replace(input.getAbsolutePath(), output.getAbsolutePath()));
            if (!changedFileOutput.exists()) {
                changedFileOutput.getParentFile().mkdirs();
            }
            changedFileOutput.createNewFile();

            if (MethodCollector.isNeedTraceFile(classFile.getName())) {
                is = new FileInputStream(classFile);
                ClassReader classReader = new ClassReader(is);
                ClassWriter classWriter = new ClassWriter(ClassWriter.COMPUTE_MAXS);
                ClassVisitor classVisitor = new TraceClassAdapter(Opcodes.ASM5, classWriter);
                classReader.accept(classVisitor, ClassReader.EXPAND_FRAMES);
                is.close();

                if (output.isDirectory()) {
                    os = new FileOutputStream(changedFileOutput);
                } else {
                    os = new FileOutputStream(output);
                }
                os.write(classWriter.toByteArray());
                os.close();
            } else {
                FileUtil.copyFileUsingStream(classFile, changedFileOutput);
            }
        } catch (Exception e) {
            Log.e(TAG, "[innerTraceMethodFromSrc] input:%s e:%s", input.getName(), e);
            try {
                Files.copy(input.toPath(), output.toPath(), StandardCopyOption.REPLACE_EXISTING);
            } catch (Exception e1) {
                e1.printStackTrace();
            }
        } finally {
            try {
                is.close();
                os.close();
            } catch (Exception e) {
                // ignore
            }
        }
    }
}
```

我们可以发现，在上面这段代码中，使用了ASM的代码就是如下几句，都是些通用代码，其中ClassVisitor是需要自己实现的代码。此外，如果你有多个ClassVisitor，还可以将它们通过构造函数串在一起，达到多个CV同时处理的目的。

```java
ClassReader classReader = new ClassReader(is);
ClassWriter classWriter = new ClassWriter(ClassWriter.COMPUTE_MAXS);
ClassVisitor classVisitor = new TraceClassAdapter(Opcodes.ASM5, classWriter);
classReader.accept(classVisitor, ClassReader.EXPAND_FRAMES);
```

下面的重点就来到了`TraceClassAdapter`类中，看看其中的奥秘：

```java
private class TraceClassAdapter extends ClassVisitor {

    private String className;
    private boolean isABSClass = false;
    private boolean hasWindowFocusMethod = false;
    private boolean isActivityOrSubClass;
    private boolean isNeedTrace;

    TraceClassAdapter(int i, ClassVisitor classVisitor) {
        // i是指ASM的版本号，此处为5
        super(i, classVisitor);
    }

    /**
     * 遍历到类的header时被调用
     * version – the class version.
     * access – the class's access flags (see Opcodes). This parameter also indicates if the class is deprecated.
     * name – the internal name of the class (see getInternalName).
     * signature – the signature of this class. May be null if the class is not a generic one, and does not extend or implement generic classes or interfaces.
     * me – the internal of name of the super class (see getInternalName). For interfaces, the super class is Object. May be null, but only for the Object class.
     * interfaces – the internal names of the class's interfaces (see getInternalName). May be null.
     */
    @Override
    public void visit(int version, int access, String name, String signature, String superName, String[] interfaces) {
        super.visit(version, access, name, signature, superName, interfaces);
        this.className = name;
        this.isActivityOrSubClass = isActivityOrSubClass(className, collectedClassExtendMap);
        this.isNeedTrace = MethodCollector.isNeedTrace(configuration, className, mappingCollector);
        if ((access & Opcodes.ACC_ABSTRACT) > 0 || (access & Opcodes.ACC_INTERFACE) > 0) {
            this.isABSClass = true;
        }
    }

    /**
     * 遍历到方法时被调用
     * access – the method's access flags (see Opcodes). This parameter also indicates if the method is synthetic and/or deprecated.
     * name – the method's name.
     * desc – the method's descriptor (see Type).
     * signature – the method's signature. May be null if the method parameters, return type and exceptions do not use generic types.
     * exceptions – the internal names of the method's exception classes (see getInternalName). May be null.
     */
    @Override
    public MethodVisitor visitMethod(int access, String name, String desc,
                                        String signature, String[] exceptions) {
        if (isABSClass) {
            return super.visitMethod(access, name, desc, signature, exceptions);
        } else {
            if (!hasWindowFocusMethod) {
                hasWindowFocusMethod = MethodCollector.isWindowFocusChangeMethod(name, desc);
            }
            MethodVisitor methodVisitor = cv.visitMethod(access, name, desc, signature, exceptions);
            return new TraceMethodAdapter(api, methodVisitor, access, name, desc, this.className,
                    hasWindowFocusMethod, isActivityOrSubClass, isNeedTrace);
        }
    }

    /**
     * 类遍历结束时被调用
     */
    @Override
    public void visitEnd() {
        if (!hasWindowFocusMethod && isActivityOrSubClass && isNeedTrace) {
            insertWindowFocusChangeMethod(cv, className);
        }
        super.visitEnd();
    }
}
```

在上面的代码中我们可以发现，ASM的API设计使用了访问者模式，正如类名的后缀Visitor。此外，ASM每遍历到一个东西，都会调用Visitor里面的对应的visit方法。我们在这里面可以使用Java代码做逻辑判断，判断到需要插入字节码的时候，使用ASM提供的API进行插入。  

上面的代码意思就是访问到类时，判断是不是Activity及其子类，判断是否需要插桩，判断是否是抽象类。  
访问到方法时，如果是抽象类，则不做处理。如果遇到了`onWindowFocusChanged`方法，则设置标志位；不管有没有遇到，都会交给`TraceMethodAdapter`进行后续处理。  
最后，如果类没有遇到`onWindowFocusChanged`方法且是Activity或子类且需要插桩，则使用ASM API插入这么一段代码：

```java
private void insertWindowFocusChangeMethod(ClassVisitor cv, String classname) {
    // public void onWindowFocusChanged (boolean)
    MethodVisitor methodVisitor = cv.visitMethod(Opcodes.ACC_PUBLIC, TraceBuildConstants.MATRIX_TRACE_ON_WINDOW_FOCUS_METHOD,
            TraceBuildConstants.MATRIX_TRACE_ON_WINDOW_FOCUS_METHOD_ARGS, null, null);
    // {
    methodVisitor.visitCode();
    // this
    methodVisitor.visitVarInsn(Opcodes.ALOAD, 0);
    // boolean
    methodVisitor.visitVarInsn(Opcodes.ILOAD, 1);
    // super.onWindowFocusChanged(boolean)
    methodVisitor.visitMethodInsn(Opcodes.INVOKESPECIAL, TraceBuildConstants.MATRIX_TRACE_ACTIVITY_CLASS, TraceBuildConstants.MATRIX_TRACE_ON_WINDOW_FOCUS_METHOD,
            TraceBuildConstants.MATRIX_TRACE_ON_WINDOW_FOCUS_METHOD_ARGS, false);
    // com/tencent/matrix/trace/core/AppMethodBeat.at(this, boolean)
    traceWindowFocusChangeMethod(methodVisitor, classname);
    // 返回语句
    methodVisitor.visitInsn(Opcodes.RETURN);
    methodVisitor.visitMaxs(2, 2);
    methodVisitor.visitEnd();
}
```

上面这段代码可能看着头疼，因为这涉及到了字节码的层面。不过也不用太担心，我们可以在AS上下载`ASM Bytecode Viewer`插件，先写号要插桩的代码，然后使用此插件查看ASM的对应写法，可以增加效率。

最后，我们看看`TraceMethodAdapter`是如何处理方法的。其实熟悉了字节码之后，看下面的代码非常简单，具体意思贴在注释中了。

```java
private class TraceMethodAdapter extends AdviceAdapter {

    private final String methodName;
    private final String name;
    private final String className;
    private final boolean hasWindowFocusMethod;
    private final boolean isNeedTrace;
    private final boolean isActivityOrSubClass;

    protected TraceMethodAdapter(int api, MethodVisitor mv, int access, String name, String desc, String className,
                                    boolean hasWindowFocusMethod, boolean isActivityOrSubClass, boolean isNeedTrace) {
        super(api, mv, access, name, desc);
        TraceMethod traceMethod = TraceMethod.create(0, access, className, name, desc);
        this.methodName = traceMethod.getMethodName();
        this.hasWindowFocusMethod = hasWindowFocusMethod;
        this.className = className;
        this.name = name;
        this.isActivityOrSubClass = isActivityOrSubClass;
        this.isNeedTrace = isNeedTrace;

    }

    @Override
    protected void onMethodEnter() {
        // 插入 void com/tencent/matrix/trace/core/AppMethodBeat.i(int)
        TraceMethod traceMethod = collectedMethodMap.get(methodName);
        if (traceMethod != null) {
            traceMethodCount.incrementAndGet();
            mv.visitLdcInsn(traceMethod.id);
            mv.visitMethodInsn(INVOKESTATIC, TraceBuildConstants.MATRIX_TRACE_CLASS, "i", "(I)V", false);
        }
    }

    @Override
    protected void onMethodExit(int opcode) {
        TraceMethod traceMethod = collectedMethodMap.get(methodName);
        if (traceMethod != null) {
            if (hasWindowFocusMethod && isActivityOrSubClass && isNeedTrace) {
                TraceMethod windowFocusChangeMethod = TraceMethod.create(-1, Opcodes.ACC_PUBLIC, className,
                        TraceBuildConstants.MATRIX_TRACE_ON_WINDOW_FOCUS_METHOD, TraceBuildConstants.MATRIX_TRACE_ON_WINDOW_FOCUS_METHOD_ARGS);
                if (windowFocusChangeMethod.equals(traceMethod)) {
                    // com/tencent/matrix/trace/core/AppMethodBeat.at(this, boolean)
                    traceWindowFocusChangeMethod(mv, className);
                }
            }

            traceMethodCount.incrementAndGet();
            // 插入 void com/tencent/matrix/trace/core/AppMethodBeat.o(int)
            mv.visitLdcInsn(traceMethod.id);
            mv.visitMethodInsn(INVOKESTATIC, TraceBuildConstants.MATRIX_TRACE_CLASS, "o", "(I)V", false);
        }
    }
}
```

???+ success "小结"  
    看完整个trace模块，我们会发现，其实插桩入门真的很简单。  
    transform的注入流程、src/jar包中class文件的读写、以及ASM的流程都可以套用。只是ClassVisitor需要自己写，而这部分的代码又可以参考`ASM Bytecode Viewer`插件。  
    后面我将以自己在Github开源的`MethodTracer`插件为例子，说说他是怎么实现的。

## 4. RemoveUnusedResourcesTask

`RemoveUnusedResourcesTask`的任务是在打包后以ZIP形式读取老包，按照[ApkChecker](https://github.com/Tencent/matrix/wiki/Matrix-Android-ApkChecker)在打包时检测出来的没有用到的资源列表（该检测任务的代码在`matrix/matrix-android/matrix-apk-canary/src/main/java/com/tencent/matrix/apk/model/task/UnusedResourcesTask.java`，里面的其他相关代码也非常具有参考价值）以及其他配置项，选择性的复制里面的项目到新包，然后签名等任务。  
这个任务针对的是apk，我们在分析`MatrixPlugin`的代码时提到了其Task之间的依赖关系可以推理出这一点。

???+ error "RemoveUnusedResourcesTask 与 shrinkResources 的区别？"  
    shrinkResources对资源的自动移除，指的是将没有用到的资源替换为占位的非常小的资源，但是不会彻底从资源库中进行删除；此外，也没有处理resources.arsc文件。至于为什么Google没有解决这两个问题，原因可以参考[包体积优化——shrinkResources](/android/paid/master/package_2/#shrinkresources)。  
    而RemoveUnusedResourcesTask则会物理删除这些资源文件。

回到`RemoveUnusedResourcesTask`的具体实现，这是一个Task。Task执行时会从`@TaskAction`修饰的方法开始执行。

<small>**src/main/groovy/com/tencent/matrix/plugin/task/RemoveUnusedResourcesTask.groovy**</small>

```groovy
public class RemoveUnusedResourcesTask extends DefaultTask {
    @TaskAction
    void removeResources() {
        // variantName的值在MatrixPlugin中就进行了设置
        String variantName = this.inputs.properties.get(BUILD_VARIANT);
        Log.i(TAG, "variant %s, removeResources", variantName);

        project.extensions.android.applicationVariants.all { variant ->
            if (variant.name.equalsIgnoreCase(variantName)) {
                variant.outputs.forEach { output ->
                    // apk包的地址
                    String unsignedApkPath = output.outputFile.getAbsolutePath();
                    Log.i(RemoveUnusedResourcesTask.TAG, "original apk file %s", unsignedApkPath);
                    long startTime = System.currentTimeMillis();
                    removeUnusedResources(unsignedApkPath, project.getBuildDir().getAbsolutePath() + "/intermediates/symbols/${variant.name}/R.txt", variant.variantData.variantConfiguration.signingConfig);
                    Log.i(RemoveUnusedResourcesTask.TAG, "cost time %f s" , (System.currentTimeMillis() - startTime) / 1000.0f );
                }
            }
        }
    }
}
```

`removeResources`方法的作用是获取到apk包的地址、拼凑出R.txt文件的地址、签名配置，最后调用`removeUnusedResources`方法开始移除资源。这个方法比较长，我们分段看一下。

首先是获取了一些自定义配置项，然后做了一些 sanity check。

```java
void removeUnusedResources(String originalApk, String rTxtFile, SigningConfig signingConfig) {
    ZipOutputStream zipOutputStream = null;
    boolean needSign = project.extensions.matrix.removeUnusedResources.needSign;
    boolean shrinkArsc = project.extensions.matrix.removeUnusedResources.shrinkArsc;
    String apksigner = project.extensions.matrix.removeUnusedResources.apksignerPath;
    if (needSign) {
        if (Util.isNullOrNil(apksigner)) {
            throw new GradleException("need sign apk but apksigner not found!");
        } else if (! new File(apksigner).exists()) {
            throw new GradleException( "need sign apk but apksigner " + apksigner + " was not exist!");
        } else if (signingConfig == null) {
            throw new GradleException("need sign apk but signingConfig not found!");
        }
    }
    ...
}
```

接着获取unusedResources和ignoreRes，并在unusedResources中剔除需要忽略的资源。这样剩下的都是需要一个个删除的资源了。

```java
File inputFile = new File(originalApk);
Set<String> ignoreRes = project.extensions.matrix.removeUnusedResources.ignoreResources;
for (String res : ignoreRes) {
    ignoreResources.add(Util.globToRegexp(res));
}
Set<String> unusedResources = project.extensions.matrix.removeUnusedResources.unusedResources;
Iterator<String> iterator = unusedResources.iterator();
String res = null;
while (iterator.hasNext()) {
    res = iterator.next();
    if (ignoreResource(res)) {
        iterator.remove();
        Log.i(TAG, "ignore unused resources %s", res);
    }
}
Log.i(TAG, "unused resources count:%d", unusedResources.size());
```

接下来，在apk目录下创建_shrinked后缀的apk空文件，作为处理后的apk。然后调用`readResourceTxtFile`方法读取r.txt文件并将里面的资源信息、样式信息保存到各自的map中。

```java
String outputApk = inputFile.getParentFile().getAbsolutePath() + "/" + inputFile.getName().substring(0, inputFile.getName().indexOf('.')) + "_shrinked.apk";

File outputFile = new File(outputApk);
if (outputFile.exists()) {
    Log.w(TAG, "output apk file %s is already exists! It will be deleted anyway!", outputApk);
    outputFile.delete();
    outputFile.createNewFile();
}

ZipFile zipInputFile = new ZipFile(inputFile);

zipOutputStream = new ZipOutputStream(new FileOutputStream(outputFile));

Map<String, Integer> resourceMap = new HashMap();
Map<String, Pair<String, Integer>[]> styleableMap = new HashMap();
File resTxtFile = new File(rTxtFile);
readResourceTxtFile(resTxtFile, resourceMap, styleableMap);
```

`readResourceTxtFile`方法会解析R.txt文件，该文件中的数据格式可能有两种：

1. 资源数据，每一行代表一个资源，这些数据保存到了`resourceMap`中。  
    key为资源名（`R.dimen.vip_text_size_small`），value为id值：
    ```txt
    int dimen vip_text_size_small 0x7f070468
    int drawable _50200_rd_attachment_item_save_selector 0x7f080006
    int styleable ActionBar_titleTextStyle 28
    ```

2. 样式数据，多行表示，数据保存在`styleableMap`中。  
    key为资源名（`R.styleable.AVLoadingIndicatorView`），value为子资源名与id值的二元组数组（
    [`R.styleable.AVLoadingIndicatorView_indicator` -> 0, `R.styleable.AVLoadingIndicatorView_indicator_color` -> 1]）。
    ```txt
    int[] styleable AVLoadingIndicatorView { 0x7f0401f3, 0x7f0401fc }
    int styleable AVLoadingIndicatorView_indicator 0
    int styleable AVLoadingIndicatorView_indicator_color 1
    ```

回到主干上，在解析完R.txt文件并将解析结果保存到两个map后，就可以先将`unusedResources`对应的资源从`resourceMap`中进行移除。等待后面回写R.txt文件时，`unusedResources`就不会出现在R.txt中了。同时，使用`removeResources`保存要删除的资源名与对应的id。

```java
Map<String, Integer> removeResources = new HashMap<>();
for (String resName : unusedResources) {
    // 这里的ignoreResource判断都是false，因为前面的操作已经将所有需要过滤的都过滤掉了
    if (!ignoreResource(resName)) {
        removeResources.put(resName, resourceMap.remove(resName));
    }
}
```

下面开始真正的执行remove操作了。这里的思路是遍历APK这个ZIP文件的每一项：

1. 如果该项是以res/开头的，说明是资源文件。根据ZipEntry的名称拼出对应的资源名，如果该资源名需要被删除，则不添加到output的APK包中；否则，如果不需要被删除，则添加到output的APK中。
2. 如果自定义配置中配置了需要签名，则META-INF/目录都忽略，不需要执行复制的操作。因为output的APK在后面的签名环节会生成这些内容。
3. 如果需要删除resources.arsc中的没有用到的资源项。则会将输入的APK中的这个ZipEntry解压到本地，然后使用`ArscReader`读取并从中移除没有用到的资源项，操作完成后写回到resources_shrinked.arsc文件中，并将这个文件添加到output的APK中。这样就达到了删除resources.arsc中的没有用到的资源项的目的。当然，这一步的操作比较繁琐，需要对arsc文件了解非常深，这里限于篇幅不做过多讨论。

```java
for (ZipEntry zipEntry : zipInputFile.entries()) {
    if (zipEntry.name.startsWith("res/")) {
        // 第一步，操作资源文件
        String resourceName = entryToResouceName(zipEntry.name);
        if (!Util.isNullOrNil(resourceName)) {
            if (removeResources.containsKey(resourceName)) {
                Log.i(TAG, "remove unused resource %s", resourceName);
                continue;
            } else {
                addZipEntry(zipOutputStream, zipEntry, zipInputFile);
            }
        } else {
            addZipEntry(zipOutputStream, zipEntry, zipInputFile);
        }
    } else {
        if (needSign && zipEntry.name.startsWith("META-INF/")) {
            // 第二步，META-INF签名文件
            continue;
        } else {
            if (shrinkArsc && zipEntry.name.equalsIgnoreCase("resources.arsc") && unusedResources.size() > 0) {
                // 第三步，处理resources.arsc文件
                File srcArscFile = new File(inputFile.getParentFile().getAbsolutePath() + "/resources.arsc");
                File destArscFile = new File(inputFile.getParentFile().getAbsolutePath() + "/resources_shrinked.arsc");
                if (srcArscFile.exists()) {
                    srcArscFile.delete();
                    srcArscFile.createNewFile();
                }
                unzipEntry(zipInputFile, zipEntry, srcArscFile);

                ArscReader reader = new ArscReader(srcArscFile.getAbsolutePath());
                ResTable resTable = reader.readResourceTable();
                for (String resName : removeResources.keySet()) {
                    ArscUtil.removeResource(resTable, removeResources.get(resName), resName);
                }
                ArscWriter writer = new ArscWriter(destArscFile.getAbsolutePath());
                writer.writeResTable(resTable);
                Log.i(TAG, "shrink resources.arsc size %f KB", (srcArscFile.length() - destArscFile.length()) / 1024.0);
                addZipEntry(zipOutputStream, zipEntry, destArscFile);
            } else {
                addZipEntry(zipOutputStream, zipEntry, zipInputFile);
            }
        }
    }
}
```

这样，我们得到了一个处理之后的APK文件，下面就是对其进行签名的操作了。签名完成之后，将老包备份为xxx_back.apk，新包重命名为老包的名称。这样操作之后，不会影响该task之后的打包流程，对其他流程来说是没有任何感知的。

```java
Log.i(TAG, "shrink apk size %f KB", (inputFile.length() - outputFile.length()) / 1024.0);
if (needSign) {
    Log.i(TAG, "resign apk...");
    ProcessBuilder processBuilder = new ProcessBuilder();
    processBuilder.command(apksigner, "sign", "-v",
            "--ks", signingConfig.storeFile.getAbsolutePath(),
            "--ks-pass", "pass:" + signingConfig.storePassword,
            "--key-pass", "pass:" + signingConfig.keyPassword,
            "--ks-key-alias", signingConfig.keyAlias,
            outputFile.getAbsolutePath());
    //Log.i(TAG, "%s", processBuilder.command());
    Process process = processBuilder.start();
    process.waitFor();
    if (process.exitValue() != 0) {
        throw new GradleException(process.getErrorStream().text);
    }
}
String backApk = inputFile.getParentFile().getAbsolutePath() + "/" + inputFile.getName().substring(0, inputFile.getName().indexOf('.')) + "_back.apk";
inputFile.renameTo(new File(backApk));
outputFile.renameTo(new File(originalApk));
```

最后，清理一下样式资源文件，并将留下来的资源、样式重新写回到R.txt中。在这一步中，一个样式资源只要有一个子项被用到，都不会被剔除。

```java
//modify R.txt to delete the removed resources
if (!removeResources.isEmpty()) {
    Iterator<String> styleableItera =  styleableMap.keySet().iterator();
    while (styleableItera.hasNext()) {
        String styleable = styleableItera.next();
        Pair<String, Integer>[] attrs = styleableMap.get(styleable);
        int i = 0;
        for (i = 0; i < attrs.length; i++) {
            if (!removeResources.containsValue(attrs[i].right)) {
                break
            }
        }
        if (attrs.length > 0 && i == attrs.length) {
            Log.i(TAG, "removed styleable " + styleable);
            styleableItera.remove();
        }
    }
    //Log.d(TAG, "styleable %s", styleableMap.keySet().size());
    String newResTxtFile = resTxtFile.getParentFile().getAbsolutePath() + "/" + resTxtFile.getName().substring(0, resTxtFile.getName().indexOf('.')) + "_shrinked.txt";
    shrinkResourceTxtFile(newResTxtFile, resourceMap, styleableMap);

    //Other plugins such as "Tinker" may depend on the R.txt file, so we should not modify R.txt directly .
    //new File(newResTxtFile).renameTo(resTxtFile);
}
```

上面就是`RemoveUnusedResourcesTask`在清理资源时的逻辑。我们发现，除了`ArscReader`这一块需要深入研究一下之外，逻辑总体上还是非常清晰的。`ArscReader`这一块代码在单独的`matrix-arscutil`模块中，有需求可以参考一下。  

`RemoveUnusedResourcesTask`依赖的输入源[`ApkChecker`](https://github.com/Tencent/matrix/wiki/Matrix-Android-ApkChecker)在做包体积大小监控中的规则监控时，非常好用，可以帮助我们分析出具体的包增长的原因。后面有空了，也将分析一下ApkChecker中的各种Task的实现原理。