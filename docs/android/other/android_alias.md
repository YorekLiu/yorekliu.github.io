---
title: "Android马甲包的那些事儿"
---

制作Android马甲包最简单的方式就是使用 **productFlavors** 机制。  

本文就是在productFlavors机制的基础上制作的马甲包，每个马甲只需要

1. 在`build.gradle`文件中配置一下包名、各种key、签名文件
2. 配置启动页、logo、app名等资源
3. 配置服务器域名、微信分享回调Activity等代码

此外，代码、资源文件等全部都天然支持差异化功能。

## 1. 原理

如下面代码所示，我们在`build.gradle`中使用productFlavors机制可以创建两个flavor——hdd以及jinyouzi，这样在Build Variant中就可以通过hddDebug、hddRelease、jinyouziDebug、jinyouziRelease来编译对应马甲的debug、release包。

**注意，在此文章中hdd是基线包，jinyouzi是马甲包。**

```gradle
android {
    defaultConfig {
        applicationId "com.xxx.xxxxxxx.app"

        flavorDimensions "product"
    }

    productFlavors{
        hdd {
            dimension "product"
        }

        jinyouzi {
            dimension "product"
        }
    }
}
```

配置了flavor之后，我们在app/src下面可以创建与main目录同级的hdd、jinyouzi目录。这两个目录中的资源文件、代码在编译对应的flavor时可以加入编译。也就是说hdd = ['src/main', 'src/hdd']，jinyouzi = ['src/main', 'src/jinyouzi']。

- 对于资源文件来说，flavor下的资源会“覆盖”main下面的资源，也就是flavor的优先级高——不知道官方怎么称呼，我借用Android系统开发中的名词，称之为`overlay`机制。  

    > 其实这点与apk的编译流程有关，在[Shrink, obfuscate, and optimize your app - Merge duplicate resources](https://developer.android.com/studio/build/shrink-code#merge-resources)中有提到：  
    > Gradle merges duplicate resources in the following cascading priority order:  
    > Gradle 会按以下级联优先顺序合并重复资源：  
    > Dependencies → Main → Build flavor → Build type  
    > 依赖项 → 主资源 → 构建flavor → 构建类型  
    > For example, if a duplicate resource appears in both your main resources and a build flavor, Gradle selects the one in the build flavor.  
    > 
    > 例如，如果某个重复资源同时出现在主资源和构建flavor中，Gradle 会选择构建flavor中的重复资源。  
    > 该文章的中文翻译在[Android Studio build过程 - ProGuard & R8](/android/paid/zsxq/week22-android-studio-build/#proguard-r8)一文中有翻译。

- 对于代码文件来说，如果flavor和main下有代码文件名称一样，编译时会报错。所以需要把各个flavor有差异的文件放到各个flavor下，而不是main下。  

**这就是马甲包的资源、代码管理的关键点。** 这段关键点一头雾水没关系，后面具体配置的时候就会体会到。

![添加flavor后app的目录层次](/assets/images/android/android_alias_flavor_dir.png)


此外，**各个flavor原本就能配置不同的applicationId、版本号、友盟统计分享等key以及签名文件等**，具体代码在后面会谈到。


## 2. 具体需求

我们先下面会从以下几个方面说明实际需求需要修改的位置：

1. applicationId、版本号
2. 资源文件
3. 各种key的配置
4. 代码文件
5. 签名配置


### 2.1 applicationId、版本号

applicationId、版本号可以在flavors中直接进行配置：

**build.gradle**
```gradle
android {
    ...
    productFlavors{
        hdd {
            dimension "product"
            applicationId "com.xxx.xxxxxxx.app"
            versionCode 100080
            versionName "1.0.8"
        }

        jinyouzi {
            dimension "product"
            applicationId "com.xxx.flavor.app"
            versionCode 101030
            versionName "1.1.3"
        }
    }
}
```

applicationId在AndroidManifest.xml中也需要使用到，这个在第2.3小节中一起介绍。

### 2.2 资源文件

利用productFlavors机制，可以为每个flavor创建不同的文件目录。  
各个flavor的logo、启动页、app_name等可以放到对应flavor的文件目录中。这样就达到了马甲包的UI效果——换个皮肤。  

在文本中，由于hdd是基线，jinyouzi是基于hdd的马甲，因此只需要在jinyouzi中放置需要更改的hdd中对应文件就可以起到覆盖基线资源的效果。

<figure class="half">
    <img src="/assets/images/android/android_alias_res_dir_baseline.png">
    <img src="/assets/images/android/android_alias_res_dir_flavor.png">
    <figcaption>基线与马甲res资源目录对比</figcaption>
</figure>

对于drawable、mipmap资源而言，文件会替换基线的文件。  
对于values里面的资源而言，资源不是简单粗暴的文件覆盖，而是每一项具体资源的覆盖。我们只需要在jinyouzi中新增对应的strings、color就可以了。

比如jinyouzi中的 **colors.xml**
```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimaryDark">#F1964A</color>
    <color name="colorTextPrimary">#ffffff</color>
    <color name="colorTextSecond">#ffffff</color>
    <color name="colorControlNormal">#FFFFFF</color>
    <color name="colorTabIndicatorLightBackground">@color/fffd850a</color>
    <color name="colorTabIndicatorDarkBackground">@color/white</color>
    <color name="colorTabSelected">#FFFFFF</color>
    <color name="colorTabNormal">#ffdddddd</color>
</resources>
```

jinyouzi中的 **strings.xml**  
```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">jinyouxi</string>

    <string name="we_chat_name">jinyouzi_wechat_name</string>
    <string name="we_chat_id" translatable="false">jinyouzi_wechat_id</string>
</resources>
```

!!! success
    同一个资源id，马甲包有就用马甲包的，否则用基线的。


### 2.3 各种key的配置

这里的key配置包括友盟统计、微信分享等key的传统意义上的key配置，还包括AndroidManifest上的客制化配置。    

此处的配置主要体现在`build.gradle`以及`Androidmanifest.xml`文件中。  

先上一段配置完全的`build.gradle`文件，*其中私密信息使用xxx代替*:  
**build.gradle**
```gradle
android {
    compileSdkVersion rootProject.ext.compileSdkVersion
    buildToolsVersion rootProject.ext.buildToolsVersion

    defaultConfig {
        applicationId "com.xxx.xxxxxxx.app"
        minSdkVersion rootProject.ext.minSdkVersion
        targetSdkVersion rootProject.ext.targetSdkVersion

        flavorDimensions "product"

        multiDexEnabled true
        testInstrumentationRunner "android.support.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        hdd {
            keyAlias 'xxxx'
            keyPassword 'xxxxxxx'
            storeFile file('../hdd.jks')
            storePassword 'xxxxxxx'
        }

        flavor {
            keyAlias 'xxxxx'
            keyPassword 'xxxxxxx'
            storeFile file('../flavor.jks')
            storePassword 'xxxxxxx'
        }
    }

    productFlavors{
        hdd {
            dimension "product"
            applicationId "com.xxx.xxxxxxx.app"
            versionCode 100080
            versionName "1.0.8"
            def qq_id = 1000xxxxxx
            buildConfigField('String', 'BUGLY_ID', '"xxxxxxx"')
            buildConfigField('String', 'UMCONFIGURE_ID', '"xxxxxxx"')
            buildConfigField('String', 'QQ_SHARE_ID', "\"$qq_id\"")
            buildConfigField('String', 'QQ_SHARE_SECRET', '"xxxxxxx"')
            buildConfigField('String', 'WX_SHARE_ID', '"xxxxxxx"')
            buildConfigField('String', 'WX_SHARE_SECRET', '"xxxxxxx"')
            manifestPlaceholders = [
                    schema : "hdd",
                    qq_id : qq_id
            ]
            signingConfig signingConfigs.hdd
        }

        jinyouzi {
            dimension "product"
            applicationId "com.xxx.flavor.app"
            versionCode 101030
            versionName "1.1.3"
            def qq_id = 1000xxxxxx
            buildConfigField('String', 'BUGLY_ID', '"xxxxxxx"')
            buildConfigField('String', 'UMCONFIGURE_ID', '"xxxxxxx"')
            buildConfigField('String', 'QQ_SHARE_ID', "\"$qq_id\"")
            buildConfigField('String', 'QQ_SHARE_SECRET', '"xxxxxxx"')
            buildConfigField('String', 'WX_SHARE_ID', '"xxxxxxx"')
            buildConfigField('String', 'WX_SHARE_SECRET', '"xxxxxxx"')
            manifestPlaceholders = [
                    schema : "jinyouzi",
                    qq_id : qq_id
            ]
            signingConfig signingConfigs.flavor
        }
    }

    buildTypes {
        debug {
            zipAlignEnabled false
            shrinkResources false
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'

            signingConfig release.signingConfig
        }
        release {
            zipAlignEnabled true
            shrinkResources true
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

在上面的配置中，我们为各个flavor定义了不同的

- applicationId
- 版本号
- Bugly ID
- 友盟ID
- QQ分享Key
- 微信分享Key
- 应用scheme
- 签名文件

对于配置中的Bugly ID、友盟ID、QQ分享Key、微信分享Key等，使用了`buildConfigField`来定义，这样编译的时候会在`BuildConfig.java`文件中生成对应的配置：

**BuildConfig.java**
```java
/**
 * Automatically generated file. DO NOT MODIFY
 */
package com.hdd.android.app;

public final class BuildConfig {
  public static final boolean DEBUG = Boolean.parseBoolean("true");
  public static final String APPLICATION_ID = "com.xxx.flavor.app";
  public static final String BUILD_TYPE = "debug";
  public static final String FLAVOR = "jinyouzi";
  public static final int VERSION_CODE = 101030;
  public static final String VERSION_NAME = "1.1.3";
  // Fields from product flavor: jinyouzi
  public static final String BUGLY_ID = "xxxxxxx";
  public static final String QQ_SHARE_ID = "xxxxxxx";
  public static final String QQ_SHARE_SECRET = "xxxxxxx";
  public static final String UMCONFIGURE_ID = "xxxxxxx";
  public static final String WX_SHARE_ID = "xxxxxxx";
  public static final String WX_SHARE_SECRET = "xxxxxxx";
}
```

在代码中就可以这样直接使用了:  

**HddApplication.kt**
```kotlin
package com.hdd.android.app

...

class HddApplication : Application() {

    init {
        PlatformConfig.setWeixin(BuildConfig.WX_SHARE_ID, BuildConfig.WX_SHARE_SECRET)
        PlatformConfig.setQQZone(BuildConfig.QQ_SHARE_ID, BuildConfig.QQ_SHARE_SECRET)
    }

    override fun attachBaseContext(base: Context) {
        super.attachBaseContext(base)
        MultiDex.install(base)
        Beta.installTinker()
    }

    override fun onCreate() {
        super.onCreate()
        initConfig()
    }

    private fun initConfig() {
        application = this

        Bugly.init(this, BuildConfig.BUGLY_ID, BuildConfig.DEBUG)

        //友盟    参数5:Push推送业务的secret,否则传空。
        UMConfigure.setLogEnabled(BuildConfig.DEBUG)
        UMConfigure.init(
            application,
            BuildConfig.UMCONFIGURE_ID,
            null,
            UMConfigure.DEVICE_TYPE_PHONE,
            null
        )
    }

    companion object {
        lateinit var application: Application
            private set
    }
}
```

还可以通过resValue、meta-data方式来实现上面功能。  
resValue编译时会产生对应的资源文件。  
meta-data方式通过动态替换AndriodManifest中的meta-data，然后在程序中获取实现。

另外因为QQ分享Key以及应用scheme需要在`AndroidManifest.xml`中配置对应的值，所以这里使用了manifestPlaceholders。
```xml
manifestPlaceholders = [
        schema : "hdd",
        qq_id : qq_id
]
```
在这配置的值可以在`AndroidManifest.xml`中直接使用。此外applicationId也天生支持在`AndroidManifest.xml`使用。

我们看看如何在`AndroidManifest.xml`中进行相关配置：  
**AndroidManifest.xml**
```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest package="com.xxx.xxxxxxx.app">

    <application
        android:name=".HddApplication"...>

        <activity
            android:name=".core.splash.SplashActivity"
            android:screenOrientation="portrait"
            android:theme="@style/SplashTheme">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
            <intent-filter>
                <action android:name="android.intent.action.VIEW"/>
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <!-- 配置scheme -->
                <data android:scheme="${schema}" />
            </intent-filter>
        </activity>

        <!-- 微信分享 -->
        <activity
            android:name="${applicationId}.wxapi.WXEntryActivity"
            android:configChanges="keyboardHidden|orientation|screenSize"
            android:exported="true"
            android:theme="@android:style/Theme.Translucent.NoTitleBar" />
        <!-- QQ分享 -->
        <activity
            android:name="com.tencent.tauth.AuthActivity"
            android:launchMode="singleTask"
            android:noHistory="true" >
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />

                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <!-- 配置qq_id -->
                <data android:scheme="tencent${qq_id}" />
            </intent-filter>
        </activity>

        <!-- 配置FileProvider -->
        <provider
            android:name="android.support.v4.content.FileProvider"
            android:authorities="${applicationId}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths" />
        </provider>

    </application>

</manifest>
```

总结一下上面的`AndroidManifest.xml`代码：

- applicationId在微信分享回调页面、FileProvider两处位置要配置。  
- manifestPlaceholders中scheme配置到SplashActivity上，qq_id配置到QQ分享AuthActivity上

!!! danger
    QQ分享配置需要注意，qq_id定义的是int类型。所以QQ_SHARE_ID配置为`"\"$qq_id\""`。且AndroidManifest中对应的scheme也将为正确的tencent1000xxxxxx。

微信分享回调Activity必须是应用实际包名目录下的wxapi子目录中的WXEntryActivity文件，任意更改目录都不会收到微信分享回调。  
比如在在hdd马甲下配置微信分享回调，需要在`com.xxx.xxxxxxx.app.wxapi`下创建WXEntryActivity文件。  
jinyouzi马甲下配置，则需要在`com.xxx.flavor.app.wxapi`下创建。  
**这部分代码写到对应flavor目录下。**

![在flavor中配置微信分享回调](/assets/images/android/android_alias_flavor_wxapi.png)

当然，合理利用activity-alias能更漂亮的完成微信回调WXEntryActivity的配置，比如说：

```xml
<!-- 微信分享 -->
<activity
    android:name="anydir.WXEntryActivity"
    android:configChanges="keyboardHidden|orientation|screenSize"
    android:exported="true"
    android:theme="@android:style/Theme.Translucent.NoTitleBar" />
<activity-alias
    android:name="${applicationId}.wxapi.WXEntryActivity"
    android:exported="true"
    android:launchMode="singleTask"
    android:targetActivity="anydir.WXEntryActivity"
    android:taskAffinity="com.tencent.mm" />
```


### 2.4 代码文件
代码文件处理方式就多样了，可以通过2.2小节类似的原理，还可以使用静态工厂方法根据包名构造出不同的类。我们还是说前者吧。

这里拿域名来距离，由于基线的域名是配置在代码中的常量。为了尽可能不修改代码，同时满足马甲包不同域名的要求，所以马甲包也是配置在代码中的，且配置文件所在的包、配置文件的类名以及其包含的public字段名、方法名都必须保持一致。

基线域名配置:  
app/src/**hdd**/java/com/xxx/xxxxxxx/app/http/HttpConfig.kt
```kotlin
package com.xxx.xxxxxxx.app.http

import com.xxx.xxxxxxx.app.BuildConfig

object HttpConfig {
    const val DOMAIN_SIT = "https://xxxxxx.xxxxx.com/"
    const val DOMAIN_UAT = "http://xxxxxx.test.xxxxx.com/"
    val DOMAIN = if (BuildConfig.DEBUG) DOMAIN_UAT else DOMAIN_SIT

    const val DOMAIN_H5_SIT = "https://xxxxxx.xxxxxx.com/"
    const val DOMAIN_H5_UAT = "http://xxxxxx.test.xxxxxx.com/"
    val DOMAIN_H5 = if (BuildConfig.DEBUG) DOMAIN_H5_UAT else DOMAIN_H5_SIT
}
```

马甲包域名配置:  
app/src/**jinyouzi**/java/com/xxx/xxxxxxx/app/http/HttpConfig.kt

```kotlin
package com.xxx.xxxxxxx.app.http

import com.xxx.xxxxxxx.app.BuildConfig

object HttpConfig {
  const val DOMAIN_SIT = "https://yyyyyy.yyyyy.com/"
  const val DOMAIN_UAT = "http://yyyyyy.test.yyyyy.com/"
  val DOMAIN = if (BuildConfig.DEBUG) DOMAIN_UAT else DOMAIN_SIT

  const val DOMAIN_H5_SIT = "https://yyyyyy.yyyyyy.com/"
  const val DOMAIN_H5_UAT = "http://yyyyyy.test.yyyyyy.com/"
  val DOMAIN_H5 = if (BuildConfig.DEBUG) DOMAIN_H5_UAT else DOMAIN_H5_SIT
}
```

**Note:** 由于其他代码使用HttpConfig时会通过基线包名import，所以马甲的HttpConfig文件package以及其他可供外部代码使用的域、方法等入口需要与基线保持一致，以免编译报错。  
除入口外，各个马甲内部可以自由扩展，但与基线代码交互时一定要走入口，避免直接交互。

### 2.5 签名配置
其实在[2.3 各种key的配置中](#23-key)的`build.gradle`中已经贴出了该部分代码。下面说明一下。  
我们知道可以给每个flavor单独配置signingConfig，但是这种配置在debug包时会用Android默认的debug签名。大部分情况OK，除了测试环境微信分享。  

不能忍，所以我们解决一下，让各个马甲的debug、release签名保持一致。

关键代码如下，具体可以查看最上面的`build.gradle`代码:
```gradle
buildTypes {
    debug {
        ...
        signingConfig release.signingConfig
    }
}
```

将debug的签名配置显示指定为release的配置，而release的配置在各个flavor中，这样就完成了统一。
