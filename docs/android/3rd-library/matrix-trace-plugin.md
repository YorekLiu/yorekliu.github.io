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
                        removeUnusedResourcesTask.dependsOn variant.packageApplication
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