---
title: "普通Android程序使用SystemProrities"
---

在Android平常开发中，有时候我们需要用到系统的属性。这些属性一般在ROM编译时会在`system/build.prop`这个位置


获取里面某个值，常见的方式有三种：  
1.通过`Runtime#exec`方式

```java
try {
    Process su = Runtime.getRuntime().exec("su");
} catch (IOException e) {
    e.printStackTrace();
}
```

2.通过反射调用`SystemProrities`的方法获取  
3.**推荐 在app内部创建该文件可以欺骗系统从而直接调用**

这里我们第三种方式，也就是我们推荐的方式  

操作过程如下：

## 1. 创建目录
在java目录下创建`android/os`目录，如下  
![system_prorities_project](/assets/images/android/system_prorities_project.png)

## 2. 创建文件并复制内容
在上面的目录下创建`SystemProperties.java`文件，内容如下

```java
package android.os;

/**
 * @author yorek
 */
public class SystemProperties {

    public static String get(final String key) {
        throw new RuntimeException("Stub!");
    }

    public static String get(final String key, final String def) {
        throw new RuntimeException("Stub!");
    }

    public static int getInt(final String key, final int def) {
        throw new RuntimeException("Stub!");
    }

    public static long getLong(final String key, final long def) {
        throw new RuntimeException("Stub!");
    }

    public static boolean getBoolean(final String key, final boolean def) {
        throw new RuntimeException("Stub!");
    }

    public static void set(final String key, final String val) {
        throw new RuntimeException("Stub!");
    }

    public static void addChangeCallback(final Runnable callback) {
        throw new RuntimeException("Stub!");
    }
}
```

以上就可以成功的使用`SystemProperties`进行获取系统内部的值了。
