---
title: "关于Gradle的知识"
---

## Question
话题：关于Gradle的知识  
1、如何理解Gradle？Grade在Android的构建过程中有什么作用？  
2、实践如下问题。  

问题：我们都知道，Android中时常需要发布渠道包，需要将渠道信息附加到apk中，然后在程序启动的时候读取渠道信息。仍然拿[VirtualAPK](https://github.com/didi/VirtualAPK)来举例

动态指定一个渠道号（比如1001），那么构建的apk中，请在它的AndroidManifest.xml文件里面的application节点下面添加如下meta-data，请写一段Gradle脚本来自动完成：

```xml
<application android:allowBackup="false" android:supportsRtl="true">
        <meta-data android:name=“channel" android:value=“1001" />
</application>
```

要求：当通过如下命令来构建渠道包的时候，将渠道号自动添加到apk的manifest中。

```shell
./gradlew clean assembleRelease -P channel=1001
```

PS：禁止使用manifestPlaceholders

## Answer

!!! tip
    可以通过[assembleRelease时的编译子任务](/android/paid/zsxq/week22-android-studio-build/#gradlew)获取所有编译的子任务  
    在project afterEvaluate以后，找到处理manifest的那个task，然后再它的doLast后面通过Groovy xml API来直接修改构建生成的xml文件即可，至于用不用Gradle插件，其实原理都一样，这里直接写在build.gradle里面了。

```groovy
// app build.gradle
...

import groovy.xml.XmlUtil

project.afterEvaluate {
    android.applicationVariants.each {
        String variantName = it.name.capitalize()

        def mergeManifestTask = project.tasks.getByName("process${variantName}Manifest")
        mergeManifestTask.doLast { mm ->
            def manifest = mm.manifestOutputFile
            if (project.hasProperty("channel")) {
                addChannel(manifest)
            }
        }
    }
}

def addChannel(File manifest) {
    def channelNo = project.property("channel")

    def xml = new XmlParser().parse(manifest)
    xml.application[0].appendNode("meta-data", ['android:name': 'channel', 'android:value': channelNo])

    manifest.withPrintWriter("UTF-8") {
        XmlUtil.serialize(xml, it)
    }
}
```

## Link

[Gradle开发入门](/assets/file/Gradle开发入门.pdf)  
[Gradle从入门到实战 - Groovy基础](https://blog.csdn.net/singwhatiwanna/article/details/76084580)  
[全面理解Gradle - 执行时序](https://blog.csdn.net/singwhatiwanna/article/details/78797506)  
[全面理解Gradle - 定义Task](https://blog.csdn.net/singwhatiwanna/article/details/78898113)  

## One More Thing

这里简单说一下AGP里面相关流程，一个plugin项目是如何定义以及如何使用的。我们以[MethodTracer](https://github.com/YorekLiu/MethodTracer)插件为例。

**首先看 Plugin 入口的配置：**

<small>**plugins/src/main/resources/META-INF/gradle-plugins/method-trace.properties**</small>

```
implementation-class=xyz.yorek.plugin.mt.MethodTracePlugin
```

这里说明一下：

1. 插件入口配置都应该在 `/src/main/resources/META-INF/gradle-plugins/` 这个特定目录下。
2. 该目录下的文件名就是 apply plugin 时需要填写的插件名，且该目录下可以有多个文件来对应多个不同功能的插件。
3. 例子说明该插件入口类是 `xyz.yorek.plugin.mt.MethodTracePlugin`，且 apply plugin 时的名称应该是文件名 `method-trace`

**其次在看插件的实现类是如何注册transform的：**

这里的实现方式一般有两种：

1. 通过系统 API 来注册 transform。下面的例子就注册两个 transform，执行顺序为 BTransform > ATransform > TransformClassedWithDexBuilderForDebug  
    ```groovy
    class MethodTracePlugin implements Plugin<Project> {

        @Override
        void apply(Project project) {
            ...
            def android = project.getExtensions().getByType(AppExtension.class)
            def b = new SimpleBTransform()
            def a = new SimpleATransform()
            android.registerTransform(b)
            android.registerTransform(a)
        }
    }


    public class SimpleATransform extends Transform {

        public SimpleATransform() {
        }

        @Override
        public String getName() {
            return "SimpleATransform";
        }

        @Override
        public Set<QualifiedContent.ContentType> getInputTypes() {
            return TransformManager.CONTENT_CLASS;
        }

        @Override
        public Set<? super QualifiedContent.Scope> getScopes() {
            return TransformManager.SCOPE_FULL_PROJECT;
        }

        @Override
        public boolean isIncremental() {
            return true;
        }

        @Override
        public void transform(TransformInvocation transformInvocation) throws TransformException, InterruptedException, IOException {
            super.transform(transformInvocation);
            Log.w(getName(), "SimpleATransform registered by android.registerTransform ....... ");
        }
    }
    ```

2. 通过反射获取特定 Task 的 transfrom， 然后用我们的 transform wrap 原始的 transform。  
    ```groovy
    class MethodTracePlugin implements Plugin<Project> {
        @Override
        void apply(Project project) {
            project.afterEvaluate {
                android.applicationVariants.all { variant ->
                    MethodTraceTransform.inject(project, variant)
                }
            }
        }
    }

    class MethodTraceTransform extends ProxyTransformWrapper {
        static void inject(Project project, MethodTraceExtension configuration, def variant, List<Class<BaseClassVisitor>> visitorList) {
            String hackTransformTaskName = getTransformTaskName("", "", variant.name)
            String hackTransformTaskNameForWrapper = getTransformTaskName("", "Builder", variant.name)

            project.getGradle().getTaskGraph().addTaskExecutionGraphListener(new TaskExecutionGraphListener() {
                @Override
                void graphPopulated(TaskExecutionGraph taskGraph) {
                    for (Task task : taskGraph.getAllTasks()) {
                        if ((task.name.equalsIgnoreCase(hackTransformTaskName) || task.name.equalsIgnoreCase(hackTransformTaskNameForWrapper))
                                && !(((TransformTask) task).getTransform() instanceof MethodTraceTransform)) {
                            Field field = TransformTask.class.getDeclaredField("transform")
                            field.setAccessible(true)
                            field.set(task, new MethodTraceTransform(project, configuration, variant, task.transform, visitorList))
                            break
                        }
                    }
                }
            })
        }

        static private String getTransformTaskName(String customDexTransformName, String wrapperSuffix, String buildTypeSuffix) {
            if (customDexTransformName != null && customDexTransformName.length() > 0) {
                return customDexTransformName + "For${buildTypeSuffix}"
            }
            return "transformClassesWithDex${wrapperSuffix}For${buildTypeSuffix}"
        }
    }
    ```

**最后看 plugin 传到maven的地址**  

这一步决定了我们应用插件时 classpath 是如何填写的。  
比如上面的示例 MathodTracer 插件通过 jitpack 进行的打包，打完包之后告诉我地址为 `com.github.YorekLiu.MethodTracer:plugins:1.0.0`。  
因此，在应用插件时 classpath 就是 `com.github.YorekLiu.MethodTracer:plugins:1.0.0`。