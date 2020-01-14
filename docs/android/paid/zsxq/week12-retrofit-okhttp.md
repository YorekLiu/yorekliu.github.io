---
title: "OkHttp和Retrofit的作用以及两者之间的联系"
---

???+ question "OkHttp和Retrofit的作用以及两者之间的联系"

OkHttp是由Square公司开发的一个处理网络请求的第三方库，用于替代`HttpUrlConnection`和Apache的`HttpClient`。它支持get请求和post请求，支持基于HTTP的文件上传和下载，支持缓存响应数据减少重复的网络请求，支持使用连接池以降低响应延迟问题（如果HTTP/2不可用）等。  
Retrofit也是Square公司开发的针对Android网络请求的框架，其实质是对OkHttp的封装，使用面向接口的方式进行网络请求，利用动态生成的代理类封装了网络接口。Retrofit使用注解描述HTTP请求，使网络接口集中在一起，简洁明了、方便管理。

> **关于HttpClient**:  
> [在 Android 6.0 中，我们取消了对 Apache HTTP 客户端的支持](https://developer.android.com/about/versions/marshmallow/android-6.0-changes#behavior-apache-http-client)。 从 Android 9 开始，默认情况下该内容库已从 bootclasspath 中移除且不可用于应用。  
> 要继续使用 Apache HTTP 客户端，以 Android 9 及更高版本为目标的应用可以向其 AndroidManifest.xml 添加以下内容：  
> `<uses-library android:name="org.apache.http.legacy" android:required="false"/>`  
> 注：拥有最低 SDK 版本 23 或更低版本的应用需要 android:required="false" 属性，因为在 API 级别低于 24 的设备上，org.apache.http.legacy库不可用。 （在这些设备上，Apache HTTP 类在 bootclasspath 中提供。）  
> 作为使用运行时 Apache 库的替代，应用可以在其 APK 中绑定自己的 org.apache.http 库版本。 如果进行此操作，您必须将该库重新打包（使用一个类似 Jar Jar 的实用程序）以避免运行时中提供的类存在类兼容性问题。  

更详细的资料可以查阅：  
- [OkHttp3源码解析](/android/3rd-library/okhttp/)  
- [Retrofit2源码解析](/android/3rd-library/retrofit/)  
- [注解的定义及解析](/android/other/annotation/)