---
title: "MacOS下Android程序反编译"
---

## 1. 反编译

[点击下载反编译文件](/assets/file/decompile.zip)

### 1.1 工具准备

反编译工具三件套：

1. apktool -- 将apk中的xml文件、图片、语言资源文件等反编译成原状态
2. dex2jar -- 将dex文件反编译成jar包文件
3. jdgui -- 把jar包文件转化成可读写的Java源文件

> 如果只需要提取资源文件，使用`apktool`即可  
> 若要看Java源代码，需要使用`dex2jar`以及`jdgui`

### 1.2 apktool

该步骤需要`apktool`工具，此工具有两个文件

- `apktool.jar`
- `apktool.sh`

**1.给apktool.sh可执行权限**

```shell
chmod a+x apktool.sh
```

**2.使用apktool.sh进行反编译**

```shell
./apktool.sh d com.hrhx.android.app_4.2.0_402002.apk
```

![decompile_apktool](/assets/images/android/decompile_apktool.png)

执行完成后，可以在当前目录下看到与apk名称相同的子目录，我们可以从这里提取出资源文件。
![decompile_apktool_result](/assets/images/android/decompile_apktool_result.png)

### 1.3 使用`dex2jar`和`jdgui`查看Java源代码
> 首先我们需要清除掉上一步反编译出来的临时文件夹，以免对后续操作产生影响。

**1.解压`dex2jar-20.0.zip`**
```shell
unzip dex2jar-2.0.zip
```

**2.解压apk,暴露出dex文件**
```shell
unzip com.hrhx.android.app_4.2.0_402002.apk -d apk
```
将apk解压到apk目录下，为了让脚本可以直接操作dex文件

**3.给d2j-dex2jar.sh可执行权限**
```shell
chmod a+x dex2jar-2.0/d2j-dex2jar.sh dex2jar-2.0/d2j_invoke.sh
```

**4.执行脚本进行反编译操作**
```shell
dex2jar-2.0/d2j-dex2jar.sh apk/classes.dex
```
执行完成后我们可以在当前目录下找到一个`classes-dex2jar.jar`文件

**5.使用jd-gui查看反编译出来的jar文件**
```shell
java -jar jd-gui-1.4.0.jar classes-dex2jar.jar
```

最后结果如下：
![decompile_jd](/assets/images/android/decompile_jd.png)

> 从反编译结果来看，乐固加固效果还不错。所以，就像本文excerpt所写:本文只是介绍入门级别的Android反编译教程，对于加固了的应用就不太好使了

## 2. Charles抓包工具

[Charles for mac](/assets/file/Charles.zip)
