---
title: "Week6-关于Gradle的知识"
categories:
  - Android
tags:
  - Gradle
  - 知识星球
toc: true
toc_label: "目录"
toc_icon: "star"
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
> 核心思想：在project afterEvaluate以后，找到处理manifest的那个task，然后再它的doLast后面通过Groovy xml API来直接修改构建生成的xml文件即可，至于用不用Gradle插件，其实原理都一样，我直接写在build.gradle里面了。

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

[Gradle开发入门]({{ basepath }}/assets/file/Gradle开发入门.pdf){: .btn .btn--success}
