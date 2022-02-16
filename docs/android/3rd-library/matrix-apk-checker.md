---
title: "Matrix-ApkChecker：安装包分析检测工具"
---

!!! tip "Wiki"  
    [Matrix Android ApkChecker](https://github.com/Tencent/matrix/wiki/Matrix-Android-ApkChecker)  


## 1. ApkChecker介绍

**Matrix** 是微信终端自研和正在使用的一套APM（Application Performance Management）系统。 **Matrix-ApkChecker** 作为Matrix系统的一部分，是针对android安装包的分析检测工具，根据一系列设定好的规则检测apk是否存在特定的问题，并输出较为详细的检测结果报告，用于分析排查问题以及版本追踪。Matrix-ApkChecker以一个jar包的形式提供使用，通过命令行执行 java -jar ApkChecker.jar 即可运行。

Matrix-ApkChecker 当前主要包含以下功能：

| 功能名 | 作用 | 描述 |
| ----- | --- | ---- |
| UnzipTask | 做一些前置的准备工作 | 解压文件，反混淆类名、反混淆资源，统计包中各个文件的大小 |
| ManifestAnalyzeTask | 读取manifest的信息 | 从AndroidManifest.xml中读取apk的全局信息，如包名、最小sdk、目标sdk、版本号 |
| ShowFileSizeTask | 按文件大小排序列出apk中包含的文件 | 列出超过一定大小的文件，可按文件后缀过滤，并且按文件大小排序 |
| MethodCountTask | 统计方法数 | 统计dex包含的方法数，并支持将输出结果按照类名(class)或者包名(package)来分组 |
| CountRTask | 统计apk中包含的R类以及R类中的field count | 编译之后，代码中对资源的引用都会优化成int常量，除了R.styleable之外，其他的R类其实都可以删除 |
| CountClassTask | 统计类的数量 | 按照包名统计dex中类的数量 |
| ResProguardCheckTask | 检查是否经过了资源混淆(AndResGuard) | 检查apk是否经过了资源混淆，推荐使用资源混淆来进一步减小apk的大小 |
| FindNonAlphaPngTask | 搜索不含alpha通道的png文件 | 对于不含alpha通道的png文件，可以转成jpg格式来减少文件的大小 |
| MultiLibCheckTask | 检查是否包含多个ABI版本的动态库 | so文件的大小可能会在apk文件大小中占很大的比例，可以考虑在apk中只包含一个ABI版本的动态库 |
| MultiSTLCheckTask | 检查是否有多个动态库静态链接了STL | 如果有多个动态库都依赖了STL，应该采用动态链接的方式而非多个动态库都去静态链接STL |
| UncompressedFileTask | 搜索未经压缩的文件类型 | 某个文件类型的所有文件都没有经过压缩，可以考虑是否需要压缩 |
| DuplicatedFileTask | 搜索冗余的文件 | 对于两个内容完全相同的文件，应该去冗余 |
| UnusedResourceTask | 搜索apk中包含的无用资源 | apk中未经使用到的资源，应该予以删除 |
| UnusedAssetsTask | 搜索apk中包含的无用assets文件 | apk中未经使用的assets文件，应该予以删除 |
| UnStrippedSoCheckTask | 搜索apk中未经裁剪的动态库文件 | 动态库经过裁剪之后，文件大小通常会减小很多 |

在[Matrix Android ApkChecker](https://github.com/Tencent/matrix/wiki/Matrix-Android-ApkChecker)中有简单介绍各个Task的实现原理，我们这里也对照着代码简单的过一下。

## 2. 各个Task的实现原理

各个具体的Task都是继承至`ApkTask`，该类有两个主要的方法`init`方法和`call`方法。前者主要做一些变量初始化工作，后者是真正进行检测的位置。`call`方法将会在线程池中进行执行。

### 2.1 UnzipTask

> 输入的Apk文件首先会经过UnzipTask处理，解压到指定目录，在这一步还会做一些全局的准备工作，包括反混淆类名（读取mapping.txt）、反混淆资源(读取resMapping.txt)、统计文件大小等。

在`UnzipTask#call`方法中可以很清楚的看到整个流程。值得一提的是，在读取mapping.txt、resMapping.txt之后，会将混淆的map保存到全局的config中，以备后用。此外，在解压的过程中，还会保存zip的每一项的大小以及混淆前后的文件名。

**<small>src/main/java/com/tencent/matrix/apk/model/task/UnzipTask.java</small>**

```java
...
// 注意下这个位置，这里面可以自定义输出格式，如果采用的是mm.json，那么对应出来的类应该是MMTaskJsonResult
// 如果是mm.html，那么对应出来的类是MMTaskHtmlResult
TaskResult taskResult = TaskResultFactory.factory(getType(), TASK_RESULT_TYPE_JSON, config);
...

// apk的总大小
((TaskJsonResult) taskResult).add("total-size", inputFile.length());

// 读取混淆结果文件并保存起来
readMappingTxtFile();
config.setProguardClassMap(proguardClassMap);
readResMappingTxtFile();
config.setResguardMap(resguardMap);

// 逐项解压文件，并对文件名尝试进行反混淆
Enumeration entries = zipFile.entries();
JsonArray jsonArray = new JsonArray();
String outEntryName = "";
while (entries.hasMoreElements()) {
    ZipEntry entry = (ZipEntry) entries.nextElement();
    outEntryName = writeEntry(zipFile, entry);
    if (!Util.isNullOrNil(outEntryName)) {
        JsonObject fileItem = new JsonObject();
        // 保存文件名-文件大小到json array中
        fileItem.addProperty("entry-name", outEntryName);
        fileItem.addProperty("entry-size", entry.getCompressedSize());
        jsonArray.add(fileItem);
        // 保存文件名、大小、反混淆前后的文件名到map
        entrySizeMap.put(outEntryName, Pair.of(entry.getSize(), entry.getCompressedSize()));
        entryNameMap.put(entry.getName(), outEntryName);
    }
}

// 保存map到全局的配置中
config.setEntrySizeMap(entrySizeMap);
config.setEntryNameMap(entryNameMap);
// 添加json array到输出中
((TaskJsonResult) taskResult).add("entries", jsonArray);
taskResult.setStartTime(startTime);
taskResult.setEndTime(System.currentTimeMillis());
return taskResult;
```

注意上面的`TaskResultFactory.factory(getType(), TASK_RESULT_TYPE_JSON, config)`这段代码。示例代码采用的是mm.json这种自定义的格式，所以这段代码返回的类型是`MMTaskJsonResult`。  
在`MMTaskJsonResult`中将会针对部分类型的输出做进一步的格式化操作，所以导致从结果文件反推代码，有点对不上的问题。但是我们先抓主要事情，我们在这里不介绍该类里面的一些额外的格式化操作。  
此外，由于html结果展示上更加清晰，所以我们分析按照json分析，展示结果的时候贴出来的是html格式的。

该部分的输出例子如下：

![apkchecker unzip](/assets/images/android/apk_checker_unzip.jpg)  
<center><small>UnzipTask输出</small></center>

### 2.2 ManifestAnalyzeTask

> 用于读取AndroidManifest.xml中的信息，如：packageName、verisonCode、clientVersion等。  
> 实现方法：利用ApkTool中的 AXmlResourceParser 来解析二进制的AndroidManifest.xml文件，并且可以反混淆出AndroidManifest.xml中引用的资源名称。

该Task的主要实现依托于另外一个`ManifestParser`类中。`ManifestParser`会使用`apktool-lib-2.4.0.jar`中的`AXmlResourceParser`类来解析二进制的AndroidManifest.xml文件，此外Parser还通过解析apk中的`resources.arsc`以及apkchecker内置的`android-framework.jar`中的`resources.arsc`这两个资源，完成xml中资源id至资源名的反混淆。

???+ tip "apktool"  
    这里的apktool和我们用来反编译apk的资源文件的apktool，是同一个东西。

<small>**src/main/java/com/tencent/matrix/apk/model/task/ManifestAnalyzeTask.java**</small>

```java
@Override
public TaskResult call() throws TaskExecuteException {
    try {
        ManifestParser manifestParser = null;
        if (!FileUtil.isLegalFile(arscFile)) {
            manifestParser = new ManifestParser(inputFile);
        } else {
            manifestParser = new ManifestParser(inputFile, arscFile);
        }
        TaskResult taskResult = TaskResultFactory.factory(getType(), TASK_RESULT_TYPE_JSON, config);
        if (taskResult == null) {
            return null;
        }
        long startTime = System.currentTimeMillis();
        JsonObject jsonObject = manifestParser.parse();
        Log.d(TAG, jsonObject.toString());
        ((TaskJsonResult) taskResult).add("manifest", jsonObject);
        taskResult.setStartTime(startTime);
        taskResult.setEndTime(System.currentTimeMillis());
        return taskResult;
    } catch (Exception e) {
        throw new TaskExecuteException(e.getMessage(), e);
    }
}
```

<small>**src/main/java/com/tencent/matrix/apk/model/task/util/ManifestParser.java**</small>

```java
public ManifestParser(File manifestFile) {
    if (manifestFile != null) {
        this.manifestFile = manifestFile;
    }
    resourceParser = ApkResourceDecoder.createAXmlParser();
}

public ManifestParser(File manifestFile, File arscFile) throws IOException, AndrolibException {
    if (manifestFile != null) {
        this.manifestFile = manifestFile;
    }
    resourceParser = ApkResourceDecoder.createAXmlParser(arscFile);
}

public JsonObject parse() throws Exception {

    FileInputStream inputStream = null;
    try {
        inputStream = new FileInputStream(manifestFile);
        try {
            resourceParser.open(inputStream);
            int token = resourceParser.nextToken();

            while (token != XmlPullParser.END_DOCUMENT) {
                token = resourceParser.next();
                if (token == XmlPullParser.START_TAG) {
                    handleStartElement();
                } else if (token == XmlPullParser.TEXT) {
                    handleElementContent();
                } else if (token == XmlPullParser.END_TAG) {
                    handleEndElement();
                }
            }
        } finally {
            resourceParser.close();
            if (inputStream != null) {
                inputStream.close();
            }
        }
    } catch (Exception e) {
        throw e;
    }


    return result;
}
```

`ManifestParser`调用`AXmlResourceParser`解析AndroidManifest.xml的方式是PULL解析的方式，解析完毕之后返回给上层的就是manifest文件的json表示了。然后`ManifestAnalyzeTask`将这个json作为返回值进行返回。  
当然，MMTaskJsonResult也会该Task做了定制化的输出，摘除了包名、版本号等信息。  

该部分的输出例子如下：

![apkchecker manifest analyze](/assets/images/android/apk_checker_manifest_analyze.jpg)  
<center><small>ManifestAnalyzeTask输出</small></center>

### 2.3 ShowFileSizeTask

> 根据文件大小以及文件后缀名来过滤出超过指定大小的文件，并按照升序或降序排列结果。  
> 实现方法：直接利用UnzipTask中统计的文件大小来过滤输出结果。

<small>**src/main/java/com/tencent/matrix/apk/model/task/ShowFileSizeTask.java**</small>

```java
@Override
public TaskResult call() throws TaskExecuteException {
    try {
        TaskResult taskResult = TaskResultFactory.factory(getType(), TASK_RESULT_TYPE_JSON, config);
        if (taskResult == null) {
            return null;
        }

        long startTime = System.currentTimeMillis();

        // UnzipTask解压时，就保存了每一项的名称以及其大小，这里直接拿来用
        Map<String, Pair<Long, Long>> entrySizeMap = config.getEntrySizeMap();
        if (!entrySizeMap.isEmpty()) {                                                          //take advantage of the result of UnzipTask.
            for (Map.Entry<String, Pair<Long, Long>> entry : entrySizeMap.entrySet()) {
                final String suffix = getSuffix(entry.getKey());
                Pair<Long, Long> size = entry.getValue();
                // 如果该项的大小超过了设定的阈值
                if (size.getFirst() >= downLimit * ApkConstants.K1024) {
                    // 没有设置指定项 或者 指定项包含该项，则记录下来
                    if (filterSuffix.isEmpty() || filterSuffix.contains(suffix)) {
                        entryList.add(Pair.of(entry.getKey(), size.getFirst()));
                    } else {
                        Log.d(TAG, "file: %s, filter by suffix.", entry.getKey());
                    }
                } else {
                    Log.d(TAG, "file:%s, size:%d B, downlimit:%d KB", entry.getKey(), size.getFirst(), downLimit);
                }
            }
        }

        // 将输出结果按照配置进行排序
        Collections.sort(entryList, new Comparator<Pair<String, Long>>() {
            @Override
            public int compare(Pair<String, Long> entry1, Pair<String, Long> entry2) {
                long file1Len = entry1.getSecond();
                long file2Len = entry2.getSecond();
                if (file1Len < file2Len) {
                    if (order.equals(JobConstants.ORDER_ASC)) {
                        return -1;
                    } else {
                        return 1;
                    }
                } else if (file1Len > file2Len) {
                    if (order.equals(JobConstants.ORDER_DESC)) {
                        return -1;
                    } else {
                        return 1;
                    }
                } else {
                    return 0;
                }
            }
        });

        // 输出结果
        JsonArray jsonArray = new JsonArray();
        for (Pair<String, Long> sortFile : entryList) {
            JsonObject fileItem = new JsonObject();
            fileItem.addProperty("entry-name", sortFile.getFirst());
            fileItem.addProperty("entry-size", sortFile.getSecond());
            jsonArray.add(fileItem);
        }
        ((TaskJsonResult) taskResult).add("files", jsonArray);
        taskResult.setStartTime(startTime);
        taskResult.setEndTime(System.currentTimeMillis());
        return taskResult;
    } catch (Exception e) {
        throw new TaskExecuteException(e.getMessage(), e);
    }
}
```

ShowFileSizeTask的过程比较简单，下面是输出例子：

![apkchecker show file size](/assets/images/android/apk_checker_show_file_size.jpg)  
<center><small>ShowFileSizeTask输出</small></center>

### 2.4 MethodCountTask

> 可以统计出各个Dex中的方法数，并按照类名或者包名来分组输出结果。  
> 实现方法：利用google开源的 com.android.dexdeps 类库来读取dex文件，统计方法数。

com.android.dexdeps的google仓库可以看这里[dexdeps](https://android.googlesource.com/platform/dalvik.git/+/master/tools/dexdeps/)。

在`MethodCountTask`中，最主要的方法就是将dex文件作为参数构造出`DexData`，然后调用`DexData#getMethodRefs`和`DexData#getExternalReferences`获取dex里面所有方法的引用以及所有外部类的引用。最后按照方法所在的类的类名是否在外部类数组中，来将所有的方法划分为内部类方法以及外部类方法两大类。

这里的外部类的意思是：外部类没有被本dex里面的东西所引用。

我们先看看核心的`countDex`方法的实现：

<small>**src/main/java/com/tencent/matrix/apk/model/task/MethodCountTask.java**</small>

```java
private void countDex(RandomAccessFile dexFile) throws IOException {
    classInternalMethod.clear();
    classExternalMethod.clear();
    pkgInternalRefMethod.clear();
    pkgExternalMethod.clear();
    DexData dexData = new DexData(dexFile);
    dexData.load();
    // 获取dex中所有方法
    MethodRef[] methodRefs = dexData.getMethodRefs();
    // 获取dex中所有的外部引用类
    ClassRef[] externalClassRefs = dexData.getExternalReferences();
    Map<String, String> proguardClassMap = config.getProguardClassMap();
    String className = null;
    // 先反混淆处理
    for (ClassRef classRef : externalClassRefs) {
        className = ApkUtil.getNormalClassName(classRef.getName());
        if (proguardClassMap.containsKey(className)) {
            className = proguardClassMap.get(className);
        }
        if (className.indexOf('.') == -1) {
            continue;
        }
        classExternalMethod.put(className, 0);
    }
    // 以方法的维度，来讲方法划分到内部、外部两个维度
    for (MethodRef methodRef : methodRefs) {
        className = ApkUtil.getNormalClassName(methodRef.getDeclClassName());
        if (proguardClassMap.containsKey(className)) {
            className = proguardClassMap.get(className);
        }
        if (!Util.isNullOrNil(className)) {
            if (className.indexOf('.') == -1) {
                continue;
            }
            if (classExternalMethod.containsKey(className)) {
                classExternalMethod.put(className, classExternalMethod.get(className) + 1);
            } else if (classInternalMethod.containsKey(className)) {
                classInternalMethod.put(className, classInternalMethod.get(className) + 1);
            } else {
                classInternalMethod.put(className, 1);
            }
        }
    }

    //remove 0-method referenced class
    Iterator<String> iterator = classExternalMethod.keySet().iterator();
    while (iterator.hasNext()) {
        if (classExternalMethod.get(iterator.next()) == 0) {
            iterator.remove();
        }
    }
}
```

理解了`countDex`，下面再来看看`call`方法：

```java
@Override
public TaskResult call() throws TaskExecuteException {
    try {
        TaskResult taskResult = TaskResultFactory.factory(getType(), TASK_RESULT_TYPE_JSON, config);
        if (taskResult == null) {
            return null;
        }
        long startTime = System.currentTimeMillis();
        JsonArray jsonArray = new JsonArray();
        for (int i = 0; i < dexFileList.size(); i++) {
            RandomAccessFile dexFile = dexFileList.get(i);
            countDex(dexFile);
            dexFile.close();
            // 统计内部方法、外部方法的总数
            int totalInternalMethods = sumOfValue(classInternalMethod);
            int totalExternalMethods = sumOfValue(classExternalMethod);
            JsonObject jsonObject = new JsonObject();
            jsonObject.addProperty("dex-file", dexFileNameList.get(i));

            // 输出内部类的结果：按照类的维度输出结果，还是按照包的维度输出结果
            if (JobConstants.GROUP_CLASS.equals(group)) {
                List<String> sortList = sortKeyByValue(classInternalMethod);
                JsonArray classes = new JsonArray();
                for (String className : sortList) {
                    JsonObject classObj = new JsonObject();
                    classObj.addProperty("name", className);
                    classObj.addProperty("methods", classInternalMethod.get(className));
                    classes.add(classObj);
                }
                jsonObject.add("internal-classes", classes);
            } else if (JobConstants.GROUP_PACKAGE.equals(group)) {
                String packageName;
                for (Map.Entry<String, Integer> entry : classInternalMethod.entrySet()) {
                    packageName = ApkUtil.getPackageName(entry.getKey());
                    if (!Util.isNullOrNil(packageName)) {
                        if (!pkgInternalRefMethod.containsKey(packageName)) {
                            pkgInternalRefMethod.put(packageName, entry.getValue());
                        } else {
                            pkgInternalRefMethod.put(packageName, pkgInternalRefMethod.get(packageName) + entry.getValue());
                        }
                    }
                }
                List<String> sortList = sortKeyByValue(pkgInternalRefMethod);
                JsonArray packages = new JsonArray();
                for (String pkgName : sortList) {
                    JsonObject pkgObj = new JsonObject();
                    pkgObj.addProperty("name", pkgName);
                    pkgObj.addProperty("methods", pkgInternalRefMethod.get(pkgName));
                    packages.add(pkgObj);
                }
                jsonObject.add("internal-packages", packages);
            }
            jsonObject.addProperty("total-internal-classes", classInternalMethod.size());
            jsonObject.addProperty("total-internal-methods", totalInternalMethods);

            // 输出外部类的结果：按照类的维度输出结果，还是按照包的维度输出结果
            if (JobConstants.GROUP_CLASS.equals(group)) {
                List<String> sortList = sortKeyByValue(classExternalMethod);
                JsonArray classes = new JsonArray();
                for (String className : sortList) {
                    JsonObject classObj = new JsonObject();
                    classObj.addProperty("name", className);
                    classObj.addProperty("methods", classExternalMethod.get(className));
                    classes.add(classObj);
                }
                jsonObject.add("external-classes", classes);

            } else if (JobConstants.GROUP_PACKAGE.equals(group)) {
                String packageName = "";
                for (Map.Entry<String, Integer> entry : classExternalMethod.entrySet()) {
                    packageName = ApkUtil.getPackageName(entry.getKey());
                    if (!Util.isNullOrNil(packageName)) {
                        if (!pkgExternalMethod.containsKey(packageName)) {
                            pkgExternalMethod.put(packageName, entry.getValue());
                        } else {
                            pkgExternalMethod.put(packageName, pkgExternalMethod.get(packageName) + entry.getValue());
                        }
                    }
                }
                List<String> sortList = sortKeyByValue(pkgExternalMethod);
                JsonArray packages = new JsonArray();
                for (String pkgName : sortList) {
                    JsonObject pkgObj = new JsonObject();
                    pkgObj.addProperty("name", pkgName);
                    pkgObj.addProperty("methods", pkgExternalMethod.get(pkgName));
                    packages.add(pkgObj);
                }
                jsonObject.add("external-packages", packages);

            }
            jsonObject.addProperty("total-external-classes", classExternalMethod.size());
            jsonObject.addProperty("total-external-methods", totalExternalMethods);
            jsonArray.add(jsonObject);
        }
        ((TaskJsonResult) taskResult).add("dex-files", jsonArray);
        taskResult.setStartTime(startTime);
        taskResult.setEndTime(System.currentTimeMillis());
        return taskResult;
    } catch (Exception e) {
        throw new TaskExecuteException(e.getMessage(), e);
    }
}
```

当然，这个task也会经过MMTaskJsonResult的重新处理，下面是输出例子：

![apkchecker method count](/assets/images/android/apk_checker_method_count.jpg)  
<center><small>MethodCountTask输出</small></center>

### 2.5 CountRTask  

> 可以统计R类以及R类的中的field数目  
> 实现方法：同样是利用 com.android.dexdeps 类库来读取dex文件，找出R类以及field数目。

该类里面的操作也是依赖于dexdeps类库，原理类似于上面的统计方法。这里就不做额外的介绍了。

<small>**src/main/java/com/tencent/matrix/apk/model/task/CountRTask.java**</small>

```java
@Override
public TaskResult call() throws TaskExecuteException {
    try {
        TaskResult taskResult = TaskResultFactory.factory(type, TaskResultFactory.TASK_RESULT_TYPE_JSON, config);
        long startTime = System.currentTimeMillis();
        Map<String, String> classProguardMap = config.getProguardClassMap();
        for (RandomAccessFile dexFile : dexFileList) {
            DexData dexData = new DexData(dexFile);
            dexData.load();
            dexFile.close();
            ClassRef[] defClassRefs = dexData.getInternalReferences();
            for (ClassRef classRef : defClassRefs) {
                String className = ApkUtil.getNormalClassName(classRef.getName());
                if (classProguardMap.containsKey(className)) {
                    className = classProguardMap.get(className);
                }
                String pureClassName = getOuterClassName(className);
                if (pureClassName.endsWith(".R") || "R".equals(pureClassName)) {
                    if (!classesMap.containsKey(pureClassName)) {
                        classesMap.put(pureClassName, classRef.getFieldArray().length);
                    } else {
                        classesMap.put(pureClassName, classesMap.get(pureClassName) + classRef.getFieldArray().length);
                    }
                }
            }
        }

        JsonArray jsonArray = new JsonArray();
        long totalSize = 0;
        Map<String, String> proguardClassMap = config.getProguardClassMap();
        for (Map.Entry<String, Integer> entry : classesMap.entrySet()) {
            JsonObject jsonObject = new JsonObject();
            if (proguardClassMap.containsKey(entry.getKey())) {
                jsonObject.addProperty("name", proguardClassMap.get(entry.getKey()));
            } else {
                jsonObject.addProperty("name", entry.getKey());
            }
            jsonObject.addProperty("field-count", entry.getValue());
            totalSize += entry.getValue();
            jsonArray.add(jsonObject);
        }
        ((TaskJsonResult) taskResult).add("R-count", jsonArray.size());
        ((TaskJsonResult) taskResult).add("Field-counts", totalSize);

        ((TaskJsonResult) taskResult).add("R-classes", jsonArray);
        taskResult.setStartTime(startTime);
        taskResult.setEndTime(System.currentTimeMillis());
        return taskResult;
    } catch (Exception e) {
        throw new TaskExecuteException(e.getMessage(), e);
    }
}
```

这个task会经过MMTaskJsonResult的重新处理，下面是输出例子：

![apkchecker r count](/assets/images/android/apk_checker_r_count.jpg)  
<center><small>CountRTask输出</small></center>

### 2.6 CountClassTask

统计类的数量。原理与上面的类似，也是依赖于dexdeps读取dex文件，输出时可以按照包名进行输出。

这里直接贴代码：

<small>**src/main/java/com/tencent/matrix/apk/model/task/CountClassTask.java**</small>

```java
@Override
public TaskResult call() throws TaskExecuteException {
    try {
        TaskResult taskResult = TaskResultFactory.factory(type, TaskResultFactory.TASK_RESULT_TYPE_JSON, config);
        long startTime = System.currentTimeMillis();
        Map<String, String> classProguardMap = config.getProguardClassMap();
        JsonArray dexFiles = new JsonArray();

        for (int i = 0; i < dexFileList.size(); i++) {
            RandomAccessFile dexFile = dexFileList.get(i);
            DexData dexData = new DexData(dexFile);
            dexData.load();
            dexFile.close();
            ClassRef[] defClassRefs = dexData.getInternalReferences();
            Set<String> classNameSet = new HashSet<>();
            for (ClassRef classRef : defClassRefs) {
                String className = ApkUtil.getNormalClassName(classRef.getName());
                if (classProguardMap.containsKey(className)) {
                    className = classProguardMap.get(className);
                }
                if (className.indexOf('.') == -1) {
                    continue;
                }
                classNameSet.add(className);
            }
            JsonObject jsonObject = new JsonObject();
            jsonObject.addProperty("dex-file", dexFileNameList.get(i));
            Log.d(TAG, "dex %s, classes %s", dexFileNameList.get(i), classNameSet.toString());

            Map<String, Set<String>> packageClass = new HashMap<>();
            if (JobConstants.GROUP_PACKAGE.equals(group)) {
                String packageName = "";
                for (String clazzName : classNameSet) {
                    packageName = ApkUtil.getPackageName(clazzName);
                    if (!Util.isNullOrNil(packageName)) {
                        if (!packageClass.containsKey(packageName)) {
                            packageClass.put(packageName, new HashSet<String>());
                        }
                        packageClass.get(packageName).add(clazzName);
                    }
                }
                JsonArray packages = new JsonArray();
                for (Map.Entry<String, Set<String>> pkg : packageClass.entrySet()) {
                    JsonObject pkgObj = new JsonObject();
                    pkgObj.addProperty("package", pkg.getKey());
                    JsonArray classArray = new JsonArray();
                    for (String clazz : pkg.getValue()) {
                        classArray.add(clazz);
                    }
                    pkgObj.add("classes", classArray);
                    packages.add(pkgObj);
                }
                jsonObject.add("packages", packages);
            }
            dexFiles.add(jsonObject);
        }

        ((TaskJsonResult) taskResult).add("dex-files", dexFiles);
        taskResult.setStartTime(startTime);
        taskResult.setEndTime(System.currentTimeMillis());
        return taskResult;
    } catch (Exception e) {
        throw new TaskExecuteException(e.getMessage(), e);
    }
}
```

这个task会经过MMTaskJsonResult的重新处理，下面是输出例子：

![apkchecker class count](/assets/images/android/apk_checker_class_count.jpg)  
<center><small>CountClassTask输出</small></center>

### 2.7 ResProguardCheckTask

> 可以判断apk是否经过了资源混淆  
> 实现方法：资源混淆之后的res文件夹会重命名成r，直接判断是否存在文件夹r即可判断是否经过了资源混淆。

这里的资源混淆指的是[AndResGuard](https://mp.weixin.qq.com/s/6YUJlGmhf1-Q-5KMvZ_8_Q)插件，非常好用，强烈推荐。

AndResGuard插件在混淆资源时，有一个可选项`keepRoot`，可以选择是否将res目录混淆成r目录。  

`ResProguardCheckTask`在检测时，会首先检查是否存在r目录。若存在，则说明资源混淆过了；否则会检查res目录下的目录是否是短目录名，若是则也说明是混淆过了的。

<small>**src/main/java/com/tencent/matrix/apk/model/task/ResProguardCheckTask.java**</small>

```java
@Override
public TaskResult call() throws TaskExecuteException {
    // r目录
    File resDir = new File(inputFile, ApkConstants.RESOURCE_DIR_PROGUARD_NAME);
    try {
        TaskResult taskResult = TaskResultFactory.factory(getType(), TASK_RESULT_TYPE_JSON, config);
        if (taskResult == null) {
            return null;
        }
        long startTime = System.currentTimeMillis();
        // 检查r目录
        if (resDir.exists() && resDir.isDirectory()) {
            Log.i(TAG, "find resource directory " + resDir.getAbsolutePath());
            ((TaskJsonResult) taskResult).add("hasResProguard", true);
        } else {
            // 检查res目录下面是否是短目录名
            resDir = new File(inputFile, ApkConstants.RESOURCE_DIR_NAME);
            if (resDir.exists() && resDir.isDirectory()) {
                File[] dirs = resDir.listFiles();
                boolean hasProguard = true;
                for (File dir : dirs) {
                    if (dir.isDirectory() && !fileNamePattern.matcher(dir.getName()).matches()) {
                        hasProguard = false;
                        Log.i(TAG, "directory " + dir.getName() + " has a non-proguard name!");
                        break;
                    }
                }
                ((TaskJsonResult) taskResult).add("hasResProguard", hasProguard);
            } else {
                throw new TaskExecuteException(TAG + "---No resource directory found!");
            }
        }
        taskResult.setStartTime(startTime);
        taskResult.setEndTime(System.currentTimeMillis());
        return taskResult;
    } catch (Exception e) {
        throw new TaskExecuteException(e.getMessage(), e);
    }
}
```

这个task不会经过MMTaskJsonResult的处理，下面是输出例子：

![apkchecker res proguard check](/assets/images/android/apk_checker_res_proguard_check.jpg)  
<center><small>ResProguardCheckTask输出</small></center>

### 2.8 FindNonAlphaPngTask

> 可以检测出apk中非透明的png文件  
> 实现方法：通过 java.awt.BufferedImage 类读取png文件并判断是否有alpha通道。  

非透明png可以转为jpg来减少文件大小。

`FindNonAlphaPngTask`的主要逻辑就是找到资源目录，遍历调用`findNonAlphaPng`。我们直接看这个方法：

<small>**src/main/java/com/tencent/matrix/apk/model/task/FindNonAlphaPngTask.java**</small>

```java
private void findNonAlphaPng(File file) throws IOException {
    if (file != null) {
        if (file.isDirectory()) {
            File[] files = file.listFiles();
            // 递归调用
            for (File tempFile : files) {
                findNonAlphaPng(tempFile);
            }
        } else if (file.isFile() && file.getName().endsWith(ApkConstants.PNG_FILE_SUFFIX) && !file.getName().endsWith(ApkConstants.NINE_PNG)) {
            // 如果文件是.png后缀且不是.9.png后缀的图片
            BufferedImage bufferedImage = ImageIO.read(file);
            // 使用java.awt.BufferedImage的API判断有没有透明通道
            if (bufferedImage != null && bufferedImage.getColorModel() != null && !bufferedImage.getColorModel().hasAlpha()) {
                // 获取资源的相对目录
                String filename = file.getAbsolutePath().substring(inputFile.getAbsolutePath().length() + 1);
                // 进行反混淆处理
                if (entryNameMap.containsKey(filename)) {
                    filename = entryNameMap.get(filename);
                }
                long size = file.length();
                // 获取文件大小并判断是否超过了阈值
                if (entrySizeMap.containsKey(filename)) {
                    size = entrySizeMap.get(filename).getFirst();
                }
                if (size >= downLimitSize * ApkConstants.K1024) {
                    // 超过阈值就保存起来，等待上报
                    nonAlphaPngList.add(Pair.of(filename, file.length()));
                }
            }
        }
    }
}
```

上面的逻辑还是很清晰的，下面看看输出的示例：

![apkchecker find non alpha png](/assets/images/android/apk_checker_find_non_alpha_png.jpg)  
<center><small>FindNonAlphaPngTask输出</small></center>

### 2.9 MultiLibCheckTask

> 可以判断apk中是否有针对多个ABI的so  
> 实现方法：直接判断lib文件夹下是否包含多个目录。

so文件的大小可能会在apk文件大小中占很大的比例，可以考虑在apk中只包含一个ABI版本的动态库。

`MultiLibCheckTask`会检查`lib`目录下有多少个子目录，一个子目录就单标一个ABI版本的动态库。若不超过一个子目录，则表示检测通过。

<small>**src/main/java/com/tencent/matrix/apk/model/task/MultiLibCheckTask.java**</small>

```java
@Override
public TaskResult call() throws TaskExecuteException {
    try {
        TaskResult taskResult = TaskResultFactory.factory(getType(), TASK_RESULT_TYPE_JSON, config);
        if (taskResult == null) {
            return null;
        }
        long startTime = System.currentTimeMillis();
        JsonArray jsonArray = new JsonArray();
        if (libDir.exists() && libDir.isDirectory()) {
            File[] dirs = libDir.listFiles();
            for (File dir : dirs) {
                if (dir.isDirectory()) {
                    jsonArray.add(dir.getName());
                }
            }
        }
        ((TaskJsonResult) taskResult).add("lib-dirs", jsonArray);
        if (jsonArray.size() > 1) {
            ((TaskJsonResult) taskResult).add("multi-lib", true);
        } else {
            ((TaskJsonResult) taskResult).add("multi-lib", false);
        }
        taskResult.setStartTime(startTime);
        taskResult.setEndTime(System.currentTimeMillis());
        return taskResult;
    } catch (Exception e) {
        throw new TaskExecuteException(e.getMessage(), e);
    }
}
```

上面的逻辑还是很清晰的，下面看看输出的示例：

![apkchecker multi lib check](/assets/images/android/apk_checker_multi_lib_check.jpg)  
<center><small>MultiLibCheckTask输出</small></center>

### 2.10 MultiSTLCheckTask

> 可以检测apk中的so是否静态链接STL  
> 实现方法：通过nm工具来读取so的符号表，如果出现 std:: 即表示so静态链接了STL。

如果有多个动态库都依赖了STL，应该采用动态链接的方式而非多个动态库都去静态链接STL。

在config文件中我们配置了`--toolnm`参数，将其指向了`sdk/ndk-bundle/toolchains/arm-linux-androideabi-4.9/prebuilt/darwin-x86_64/bin/arm-linux-androideabi-nm`。在检测时通过`ProcessBuilder`来执行命令行命令，然后读取输出，判断输出中是否含有std::字符串。

相当于在Terminal中执行这样的代码：

```shell
<nm_path> -D -C <so_path> | grep "T std::"
```

`MultiSTLCheckTask`代码如下：

<small>**src/main/java/com/tencent/matrix/apk/model/task/MultiSTLCheckTask.java**</small>

```java
@Override
public TaskResult call() throws TaskExecuteException {
    try {
        TaskResult taskResult = TaskResultFactory.factory(getType(), TASK_RESULT_TYPE_JSON, config);
        if (taskResult == null) {
            return null;
        }
        long startTime = System.currentTimeMillis();
        List<File> libFiles = new ArrayList<>();
        JsonArray jsonArray = new JsonArray();
        // 收集lib目录下所有的so文件
        if (libDir.exists() && libDir.isDirectory()) {
            File[] dirs = libDir.listFiles();
            for (File dir : dirs) {
                if (dir.isDirectory()) {
                    File[] libs = dir.listFiles();
                    for (File libFile : libs) {
                        if (libFile.isFile() && libFile.getName().endsWith(ApkConstants.DYNAMIC_LIB_FILE_SUFFIX)) {
                            libFiles.add(libFile);
                        }
                    }
                }
            }
        }
        // 调用isStlLinked方法进行检测
        for (File libFile : libFiles) {
            if (isStlLinked(libFile)) {
                Log.i(TAG, "lib: %s has stl link", libFile.getName());

                jsonArray.add(libFile.getName());
            }
        }
        ((TaskJsonResult) taskResult).add("stl-lib", jsonArray);
        if (jsonArray.size() > 1) {
            ((TaskJsonResult) taskResult).add("multi-stl", true);
        } else {
            ((TaskJsonResult) taskResult).add("multi-stl", false);
        }
        taskResult.setStartTime(startTime);
        taskResult.setEndTime(System.currentTimeMillis());
        return taskResult;
    } catch (Exception e) {
        throw new TaskExecuteException(e.getMessage(), e);
    }
}

private boolean isStlLinked(File libFile) throws IOException, InterruptedException {
    // nm -D -C *.so
    ProcessBuilder processBuilder = new ProcessBuilder(toolnmPath, "-D", "-C", libFile.getAbsolutePath());
    Process process = processBuilder.start();
    BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
    String line = reader.readLine();
    while (line != null) {
        String[] columns = line.split(" ");
        Log.d(TAG, "%s", line);
        // 检测 T std:: 字符串样式，若出现，表示静态链接了stl
        if (columns.length >= 3 && columns[1].equals("T") && columns[2].startsWith("std::")) {
            return true;
        }
        line = reader.readLine();
    }
    reader.close();
    process.waitFor();
    return false;
}
```

下面看看输出的示例：

![apkchecker multi stl check](/assets/images/android/apk_checker_multi_stl_check.jpg)  
<center><small>MultiSTLCheckTask输出</small></center>

### 2.11 UncompressedFileTask

> 可以检测出未经压缩的文件类型  
> 实现方法：直接利用UnzipTask中统计的各个文件的压缩前和压缩后的大小，判断压缩前和压缩后大小是否相等。

`UncompressedFileTask`可以指定要检测的文件类型。检测过程依赖于UnzipTask在解压时保存的每一项的size以及compressedSize。  

Zip存储时可以是STORED、DEFLATED两种方式，前面这种方式只是不压缩的存储，所以这种方式下size等于compressedSize。

`UncompressedFileTask`会先将所有文件以文件后缀名进行归类并计算总的size、compressedSize，然后再逐个比较两者值是否一致，不一致的会保存结果。

<small>**src/main/java/com/tencent/matrix/apk/model/task/UncompressedFileTask.java**</small>

```java
@Override
public TaskResult call() throws TaskExecuteException {
    try {
        TaskResult taskResult = TaskResultFactory.factory(type, TaskResultFactory.TASK_RESULT_TYPE_JSON, config);
        if (taskResult == null) {
            return null;
        }
        long startTime = System.currentTimeMillis();
        JsonArray jsonArray = new JsonArray();
        Map<String, Pair<Long, Long>> entrySizeMap = config.getEntrySizeMap();
        if (!entrySizeMap.isEmpty()) {                                                          //take advantage of the result of UnzipTask.
            for (Map.Entry<String, Pair<Long, Long>> entry : entrySizeMap.entrySet()) {
                final String suffix = getSuffix(entry.getKey());
                Pair<Long, Long> size = entry.getValue();
                if (filterSuffix.isEmpty() || filterSuffix.contains(suffix)) {
                    if (!uncompressSizeMap.containsKey(suffix)) {
                        uncompressSizeMap.put(suffix, size.getFirst());
                    } else {
                        uncompressSizeMap.put(suffix, uncompressSizeMap.get(suffix) + size.getFirst());
                    }
                    if (!compressSizeMap.containsKey(suffix)) {
                        compressSizeMap.put(suffix, size.getSecond());
                    } else {
                        compressSizeMap.put(suffix, compressSizeMap.get(suffix) + size.getSecond());
                    }
                } else {
                    Log.d(TAG, "file: %s, filter by suffix.", entry.getKey());
                }
            }
        }

        for (String suffix : uncompressSizeMap.keySet()) {
            if (uncompressSizeMap.get(suffix).equals(compressSizeMap.get(suffix))) {
                JsonObject fileItem = new JsonObject();
                fileItem.addProperty("suffix", suffix);
                fileItem.addProperty("total-size", uncompressSizeMap.get(suffix));
                jsonArray.add(fileItem);
            }
        }
        ((TaskJsonResult) taskResult).add("files", jsonArray);
        taskResult.setStartTime(startTime);
        taskResult.setEndTime(System.currentTimeMillis());
        return taskResult;
    } catch (Exception e) {
        throw new TaskExecuteException(e.getMessage(), e);
    }
}
```

由于示例app使用了AndResGuard进行资源混淆，且配置了对图片格式的压缩。所以输出结果显示，只有`resources.arsc`没有被压缩。

![apkchecker uncompressed file ](/assets/images/android/apk_checker_uncompressed_file.jpg)  
<center><small>UncompressedFileTask输出</small></center>

### 2.12 DuplicatedFileTask

> 可以检测出冗余的文件  
> 实现方法：通过比较文件的MD5是否相等来判断文件内容是否相同。  

冗余文件应该只保留一份。

<small>**src/main/java/com/tencent/matrix/apk/model/task/DuplicateFileTask.java**</small>

```java
@Override
public TaskResult call() throws TaskExecuteException {
    TaskResult taskResult = null;
    try {
        taskResult = TaskResultFactory.factory(getType(), TaskResultFactory.TASK_RESULT_TYPE_JSON, config);
        long startTime = System.currentTimeMillis();
        JsonArray jsonArray = new JsonArray();

        // 计算zip中每个文件的md5
        computeMD5(inputFile);

        // 按照文件大小进行排序
        Collections.sort(fileSizeList, new Comparator<Pair<String, Long>>() {
            @Override
            public int compare(Pair<String, Long> entry1, Pair<String, Long> entry2) {
                long file1Len = entry1.getSecond();
                long file2Len = entry2.getSecond();
                if (file1Len < file2Len) {
                    return 1;
                } else if (file1Len > file2Len) {
                    return -1;
                } else {
                    return 0;
                }
            }
        });

        // 如果同一个md5值的文件有多个，则上报这些文件
        for (Pair<String, Long> entry : fileSizeList) {
            if (md5Map.get(entry.getFirst()).size() > 1) {
                JsonObject jsonObject = new JsonObject();
                jsonObject.addProperty("md5", entry.getFirst());
                jsonObject.addProperty("size", entry.getSecond());
                JsonArray jsonFiles = new JsonArray();
                for (String filename : md5Map.get(entry.getFirst())) {
                    jsonFiles.add(filename);
                }
                jsonObject.add("files", jsonFiles);
                jsonArray.add(jsonObject);
            }
        }
        ((TaskJsonResult) taskResult).add("files", jsonArray);
        taskResult.setStartTime(startTime);
        taskResult.setEndTime(System.currentTimeMillis());
    } catch (Exception e) {
        throw new TaskExecuteException(e.getMessage(), e);
    }
    return taskResult;
}

private void computeMD5(File file) throws NoSuchAlgorithmException, IOException {
    if (file != null) {
        if (file.isDirectory()) {
            File[] files = file.listFiles();
            for (File resFile : files) {
                computeMD5(resFile);
            }
        } else {
            MessageDigest msgDigest = MessageDigest.getInstance("MD5");
            BufferedInputStream inputStream = new BufferedInputStream(new FileInputStream(file));
            byte[] buffer = new byte[512];
            int readSize = 0;
            long totalRead = 0;
            while ((readSize = inputStream.read(buffer)) > 0) {
                msgDigest.update(buffer, 0, readSize);
                totalRead += readSize;
            }
            inputStream.close();
            if (totalRead > 0) {
                final String md5 = Util.byteArrayToHex(msgDigest.digest());
                String filename = file.getAbsolutePath().substring(inputFile.getAbsolutePath().length() + 1);
                if (entryNameMap.containsKey(filename)) {
                    filename = entryNameMap.get(filename);
                }
                if (!md5Map.containsKey(md5)) {
                    md5Map.put(md5, new ArrayList<String>());
                    if (entrySizeMap.containsKey(filename)) {
                        fileSizeList.add(Pair.of(md5, entrySizeMap.get(filename).getFirst()));
                    } else {
                        fileSizeList.add(Pair.of(md5, totalRead));
                    }
                }
                md5Map.get(md5).add(filename);
            }
        }
    }
}
```

这个Task的逻辑比较简单，下面是输出示例：

![apkchecker duplicated file ](/assets/images/android/apk_checker_duplicated_file.jpg)  
<center><small>DuplicatedFileTask输出</small></center>

### 2.13 UnusedResourceTask

> 可以检测出apk中未使用的资源，对于getIdentifier获取的资源可以加入白名单  
> 实现方法：  
> 1. 过读取R.txt获取apk中声明的所有资源得到declareResourceSet；   
> 2. 通过读取smali文件中引用资源的指令（包括通过reference和直接通过资源id引用资源）得出class中引用的资源classRefResourceSet；  
> 3. 通过ApkTool解析res目录下的xml文件、AndroidManifest.xml 以及 resource.arsc 得出资源之间的引用关系；  
> 4. 根据上述几步得到的中间数据即可确定出apk中未使用到的资源。

1. `readMappingTxtFile` 读取mapping文件 使用`rclassProguardMap`保存代码引用格式的混淆前后的资源名  
   > com.tencent.mm.R.l.aRW ->  com.tencent.mm.R.string.fade_in_property_anim
2. `readResourceTxtFile` 读取R文件  
   使用`resourceDefMap`保存普通资源的资源值、资源名  
   > 0x7f010001 -> R.anim.anim  
   使用`styleableMap`保存styleable类型的资源值、资源名列表  
   > R.styleable.AVLoadingIndicatorView -> [0x7f0401f3、0x7f0401fc]
3. 将所有`resourceDefMap`中的资源名另存到`unusedResSet`中，**这是待删除的资源池了，后面的操作过程中将会从里面移除用到的资源**  
4. `decodeCode` 反编译dex文件到smali文件，按照特定语法格式进行匹配，找出里面引用资源的指令（包括通过reference和直接通过资源id引用资源）。  
   遇到资源id时，通过`resourceDefMap`得到对应的资源名；遇到styleable资源名时，通过`styleableMap`得到资源值列表，然后通过`resourceDefMap`得到资源名；普通资源直接保存名字。处理过后的资源名都保存到`resourceRefSet`中。**这些资源就是程序真正引用的资源了。**  
5. `decodeResources` 解析res目录下的xml文件、AndroidManifest.xml以及resources.arsc文件。  
    xml中的遇到的资源保存到`fileResMap`，这里面key是一个资源的名称R.layout.xx，value是所遇到的资源的名称R.color.xxx；values目录下的xml遇到的资源以及AndroidManifest.xml中的资源保存到`valuesReferences`中，类似于R.color.xxx。  
    `fileResMap`的kv经过反混淆之后，保存到了`nonValueReferences`中。`valuesReferences`中的值经过反混淆之后，保存到了`resourceRefSet`中。在之前，代码中所引用的资源也保存到了这里，因此，这个集合里面的资源都是有效的。  
    接着，将会遍历`resourceRefSet`中的资源a，如果`nonValueReferences`中包含了这个资源a，则从`unusedResSet`中将删除被这个资源所引用的资源集合b。对b会继续这么递归下去。**这个意思就是如果资源a是有效的，那么a所引用的资源集合b也是有效的，将有效的资源从全量资源池中进行移除，那么全量资源池中剩下的就需要被删除了**  
    到了这里后，`resourceRefSet`里面的值都是有效值；`unusedResSet`里面的值都是待移除的值；但是这里还没有处理白名单问题。    
    最后，处理白名单，遍历`unusedResSet`，如果是白名单里面的值，添加到`resourceRefSet`中；同时也会从`nonValueReferences`中寻找这个资源的子资源，添加到`resourceRefSet`中。
6. 最后调用`unusedResSet.removeAll(resourceRefSet)`，将白名单集合从`unusedResSet`中进行移除。上报`unusedResSet`集合即可。


这部分逻辑有点绕，我们一步步看代码：

第一步：读取mapping文件

<small>**src/main/java/com/tencent/matrix/apk/model/task/UnusedResourcesTask.java**</small>

```java
try {
    TaskResult taskResult = TaskResultFactory.factory(type, TaskResultFactory.TASK_RESULT_TYPE_JSON, config);
    long startTime = System.currentTimeMillis();
    readMappingTxtFile();
    readResourceTxtFile();
    unusedResSet.addAll(resourceDefMap.values());
    Log.i(TAG, "find resource declarations %d items.", unusedResSet.size());
    decodeCode();
    Log.i(TAG, "find resource references in classes: %d items.", resourceRefSet.size());
    decodeResources();
    Log.i(TAG, "find resource references %d items.", resourceRefSet.size());
    unusedResSet.removeAll(resourceRefSet);
    Log.i(TAG, "find unused references %d items", unusedResSet.size());
    Log.d(TAG, "find unused references %s", unusedResSet.toString());
    JsonArray jsonArray = new JsonArray();
    for (String name : unusedResSet) {
        jsonArray.add(name);
    }
    ((TaskJsonResult) taskResult).add("unused-resources", jsonArray);
    taskResult.setStartTime(startTime);
    taskResult.setEndTime(System.currentTimeMillis());
    return taskResult;
} catch (Exception e) {
    throw new TaskExecuteException(e.getMessage(), e);
}

private void readMappingTxtFile() throws IOException {
    // com.tencent.mm.R$string -> com.tencent.mm.R$l:
    //      int fade_in_property_anim -> aRW

    if (mappingTxt != null) {
        BufferedReader bufferedReader = new BufferedReader(new FileReader(mappingTxt));
        String line = bufferedReader.readLine();
        boolean readRField = false;
        String beforeClass = "", afterClass = "";
        try {
            while (line != null) {
                if (!line.startsWith(" ")) {
                    String[] pair = line.split("->");
                    if (pair.length == 2) {
                        beforeClass = pair[0].trim();
                        afterClass = pair[1].trim();
                        afterClass = afterClass.substring(0, afterClass.length() - 1);
                        if (!Util.isNullOrNil(beforeClass) && !Util.isNullOrNil(afterClass) && ApkUtil.isRClassName(ApkUtil.getPureClassName(beforeClass))) {
                            Log.d(TAG, "before:%s,after:%s", beforeClass, afterClass);
                            readRField = true;
                        } else {
                            readRField = false;
                        }
                    } else {
                        readRField = false;
                    }
                } else {
                    if (readRField) {
                        String[] entry = line.split("->");
                        if (entry.length == 2) {
                            String key = entry[0].trim();
                            String value = entry[1].trim();
                            if (!Util.isNullOrNil(key) && !Util.isNullOrNil(value)) {
                                String[] field = key.split(" ");
                                if (field.length == 2) {
                                    Log.d(TAG, "%s -> %s", afterClass.replace('$', '.') + "." + value, ApkUtil.getPureClassName(beforeClass).replace('$', '.') + "." + field[1]);
                                    rclassProguardMap.put(afterClass.replace('$', '.') + "." + value, ApkUtil.getPureClassName(beforeClass).replace('$', '.') + "." + field[1]);
                                }
                            }
                        }
                    }
                }
                line = bufferedReader.readLine();
            }
        } finally {
            bufferedReader.close();
        }
    }
}
```

第二步：读取R文件 

```java
private void readResourceTxtFile() throws IOException {
    BufferedReader bufferedReader = new BufferedReader(new FileReader(resourceTxt));
    String line = bufferedReader.readLine();
    try {
        while (line != null) {
            String[] columns = line.split(" ");
            if (columns.length >= 4) {
                final String resourceName = "R." + columns[1] + "." + columns[2];
                if (!columns[0].endsWith("[]") && columns[3].startsWith("0x")) {
                    if (columns[3].startsWith("0x01")) {
                        Log.d(TAG, "ignore system resource %s", resourceName);
                    } else {
                        final String resId = parseResourceId(columns[3]);
                        if (!Util.isNullOrNil(resId)) {
                            // 0x7f010001 R.anim.anim
                            resourceDefMap.put(resId, resourceName);
                        }
                    }
                } else {
                    //    int[] styleable AVLoadingIndicatorView { 0x7f0401f3, 0x7f0401fc }
                    //    int styleable AVLoadingIndicatorView_indicator 0
                    //    int styleable AVLoadingIndicatorView_indicator_color 1
                    Log.d(TAG, "ignore resource %s", resourceName);
                    if (columns[0].endsWith("[]") && columns.length > 5) {
                        // 0x7f0401f3 0x7f0401fc
                        Set<String> attrReferences = new HashSet<String>();
                        for (int i = 4; i < columns.length; i++) {
                            if (columns[i].endsWith(",")) {
                                attrReferences.add(columns[i].substring(0, columns[i].length() - 1));
                            } else {
                                attrReferences.add(columns[i]);
                            }
                        }
                        // R.styleable.AVLoadingIndicatorView : 0x7f0401f3、0x7f0401fc
                        styleableMap.put(resourceName, attrReferences);
                    }
                }
            }
            line = bufferedReader.readLine();
        }
    } finally {
        bufferedReader.close();
    }
}
```

第三步：初始化待移除资源池  

```java
unusedResSet.addAll(resourceDefMap.values());
```

第四步：找出代码中的资源引用

```java
private void decodeCode() throws IOException {
    for (String dexFileName : dexFileNameList) {
        DexBackedDexFile dexFile = DexFileFactory.loadDexFile(new File(inputFile, dexFileName), Opcodes.forApi(15));

        BaksmaliOptions options = new BaksmaliOptions();
        List<? extends ClassDef> classDefs = Ordering.natural().sortedCopy(dexFile.getClasses());

        for (ClassDef classDef : classDefs) {
            String[] lines = ApkUtil.disassembleClass(classDef, options);
            if (lines != null) {
                readSmaliLines(lines);
            }
        }

    }
}

/*
    1. const

    const v6, 0x7f0c0061

    2. sget

    sget v6, Lcom/tencent/mm/R$string;->chatting_long_click_menu_revoke_msg:I
    sget v1, Lcom/tencent/mm/libmmui/R$id;->property_anim:I

    3. sput

    sput-object v0, Lcom/tencent/mm/plugin_welab_api/R$styleable;->ActionBar:[I   //define resource in R.java

    4. array-data

    :array_0
    .array-data 4
        0x7f0a0022
        0x7f0a0023
    .end array-data
*/
private void readSmaliLines(String[] lines) {
    if (lines == null) {
        return;
    }
    boolean arrayData = false;
    for (String line : lines) {
        line = line.trim();
        if (!Util.isNullOrNil(line)) {
            if (line.startsWith("const")) {
                String[] columns = line.split(" ");
                if (columns.length >= 3) {
                    final String resId = parseResourceId(columns[2].trim());
                    if (!Util.isNullOrNil(resId) && resourceDefMap.containsKey(resId)) {
                        resourceRefSet.add(resourceDefMap.get(resId));
                    }
                }
            } else if (line.startsWith("sget")) {
                String[] columns = line.split(" ");
                if (columns.length >= 3) {
                    final String resourceRef = parseResourceNameFromProguard(columns[2].trim());
                    if (!Util.isNullOrNil(resourceRef)) {
                        Log.d(TAG, "find resource reference %s", resourceRef);
                        if (styleableMap.containsKey(resourceRef)) {
                            //reference of R.styleable.XXX
                            for (String attr : styleableMap.get(resourceRef)) {
                                resourceRefSet.add(resourceDefMap.get(attr));
                            }
                        } else {
                            resourceRefSet.add(resourceRef);
                        }
                    }
                }
            } else if (line.startsWith(".array-data 4")) {
                arrayData = true;
            } else if (line.startsWith(".end array-data")) {
                arrayData = false;
            } else  {
                if (arrayData) {
                    String[] columns = line.split(" ");
                    if (columns.length > 0) {
                        final String resId = parseResourceId(columns[0].trim());
                        if (!Util.isNullOrNil(resId) && resourceDefMap.containsKey(resId)) {
                            Log.d(TAG, "array field resource, %s", resId);
                            resourceRefSet.add(resourceDefMap.get(resId));
                        }
                    }
                }
            }
        }
    }
}
```

第五步：找出资源中的引用  

```java
private void decodeResources() throws IOException, InterruptedException, AndrolibException, XmlPullParserException {
    File manifestFile = new File(inputFile, ApkConstants.MANIFEST_FILE_NAME);
    File arscFile = new File(inputFile, ApkConstants.ARSC_FILE_NAME);
    File resDir = new File(inputFile, ApkConstants.RESOURCE_DIR_NAME);
    if (!resDir.exists()) {
        resDir = new File(inputFile, ApkConstants.RESOURCE_DIR_PROGUARD_NAME);
    }

    Map<String, Set<String>> fileResMap = new HashMap<>();
    Set<String> valuesReferences = new HashSet<>();

    ApkResourceDecoder.decodeResourcesRef(manifestFile, arscFile, resDir, fileResMap, valuesReferences);

    Map<String, String> resguardMap = config.getResguardMap();

    // 反混淆资源的过程
    for (String resource : fileResMap.keySet()) {
        Set<String> result = new HashSet<>();
        for (String resName : fileResMap.get(resource)) {
            if (resguardMap.containsKey(resName)) {
                result.add(resguardMap.get(resName));
            } else {
                result.add(resName);
            }
        }
        if (resguardMap.containsKey(resource)) {
            nonValueReferences.put(resguardMap.get(resource), result);
        } else {
            nonValueReferences.put(resource, result);
        }
    }

    // 也是反混淆
    for (String resource : valuesReferences) {
        if (resguardMap.containsKey(resource)) {
            resourceRefSet.add(resguardMap.get(resource));
        } else {
            resourceRefSet.add(resource);
        }
    }

    for (String resource : resourceRefSet) {
        readChildReference(resource);
    }

    for (String resource : unusedResSet) {
        if (ignoreResource(resource)) {
            resourceRefSet.add(resource);
            ignoreChildResource(resource);
        }
    }
}
```

第六步：收尾并上报

```java
unusedResSet.removeAll(resourceRefSet);
Log.i(TAG, "find unused references %d items", unusedResSet.size());
Log.d(TAG, "find unused references %s", unusedResSet.toString());
JsonArray jsonArray = new JsonArray();
for (String name : unusedResSet) {
    jsonArray.add(name);
}
((TaskJsonResult) taskResult).add("unused-resources", jsonArray);
taskResult.setStartTime(startTime);
taskResult.setEndTime(System.currentTimeMillis());
return taskResult;
```

这一个Task的流程最为复杂，有时间的可以边debug边理解过程。示例如下：

![apkchecker unused resource](/assets/images/android/apk_checker_unused_resource.jpg)  
<center><small>UnusedResourceTask输出</small></center>

### 2.14 UnusedAssetsTask

> 可以检测出apk中未使用的assets文件  
> 实现方法：搜索smali文件中引用字符串常量的指令，判断引用的字符串常量是否某个assets文件的名称

这里的方法与上面一个Task非常像，反编译dex文件到smali之后，判断引用的字符串常量是否某个assets文件的名称。

这里我们直接看核心判断代码就行，其他的部分大同小异：

<small>**src/main/java/com/tencent/matrix/apk/model/task/UnusedAssetsTask.java**</small>

```java
private void readSmaliLines(String[] lines) {
    if (lines == null) {
        return;
    }
    for (String line : lines) {
        line = line.trim();
        if (!Util.isNullOrNil(line) && line.startsWith("const-string")) {
            String[] columns = line.split(",");
            if (columns.length == 2) {
                String assetFileName = columns[1].trim();
                assetFileName = assetFileName.substring(1, assetFileName.length() - 1);
                if (!Util.isNullOrNil(assetFileName)) {
                    for (String path : assetsPathSet) {
                        if (assetFileName.endsWith(path)) {
                            assetRefSet.add(path);
                        }
                    }
                }
            }
        }
    }
}
```

示例如下：

![apkchecker unused asset](/assets/images/android/apk_checker_unused_asset.jpg)  
<center><small>UnusedAssetTask输出</small></center>

### 2.15 UnStrippedSoCheckTask

> 可以检测出apk中未经裁剪的动态库文件  
> 实现方法：使用nm工具读取动态库文件的符号表，若输出结果中包含no symbols字样则表示该动态库已经过裁剪

???+ tip "MacOS"  
    MacOS自带了nm命令，可以直接使用nm

该Task的逻辑很简单，直接上代码

<small>**src/main/java/com/tencent/matrix/apk/model/task/UnStrippedSoCheckTask.java**</small>  

```java
@Override
public TaskResult call() throws TaskExecuteException {
    try {
        TaskResult taskResult = TaskResultFactory.factory(getType(), TASK_RESULT_TYPE_JSON, config);
        if (taskResult == null) {
            return null;
        }
        long startTime = System.currentTimeMillis();
        List<File> libFiles = new ArrayList<>();
        JsonArray jsonArray = new JsonArray();
        if (libDir.exists() && libDir.isDirectory()) {
            File[] dirs = libDir.listFiles();
            for (File dir : dirs) {
                if (dir.isDirectory()) {
                    File[] libs = dir.listFiles();
                    for (File libFile : libs) {
                        if (libFile.isFile() && libFile.getName().endsWith(ApkConstants.DYNAMIC_LIB_FILE_SUFFIX)) {
                            libFiles.add(libFile);
                        }
                    }
                }
            }
        }
        for (File libFile : libFiles) {
            if (!isSoStripped(libFile)) {
                Log.i(TAG, "lib: %s is not stripped", libFile.getName());

                jsonArray.add(libFile.getName());
            }
        }
        ((TaskJsonResult) taskResult).add("unstripped-lib", jsonArray);
        taskResult.setStartTime(startTime);
        taskResult.setEndTime(System.currentTimeMillis());
        return taskResult;
    } catch (Exception e) {
        throw new TaskExecuteException(e.getMessage(), e);
    }
}

private boolean isSoStripped(File libFile) throws IOException, InterruptedException {
    ProcessBuilder processBuilder = new ProcessBuilder(toolnmPath, libFile.getAbsolutePath());
    Process process = processBuilder.start();
    BufferedReader reader = new BufferedReader(new InputStreamReader(process.getErrorStream()));
    String line = reader.readLine();
    boolean result = false;
    if (!Util.isNullOrNil(line)) {
        Log.d(TAG, "%s", line);
        String[] columns = line.split(":");
        if (columns.length == 3 && columns[2].trim().equalsIgnoreCase("no symbols")) {
            result = true;
        }
    }
    reader.close();
    process.waitFor();
    return result;
}
```

示例如下：

![apkchecker unstripped so](/assets/images/android/apk_checker_unstripped_so.jpg)  
<center><small>UnstrippedSoCheckTask输出</small></center>

## 3. 小节

我们发现，在`UnusedResourceTask`、`UnusedAssetsTask`等Task中常常需要读取asrc文件以及反编译dex文件，从中提取一些信息。而且，很多包体积优化功能可以先解包然后重新打包。这为我们做类似的事提供了很多方向。

AndResGuard以及Matrix插件中的`RemoveUnusedResourcesTask`干的也是这样的事，后面我们再探一下AndResGuard。

此外，但ApkChecker只是提供了检查的功能，对于检测出来的问题，我们仍需要进一步探索一下自动化优化的解决方案。