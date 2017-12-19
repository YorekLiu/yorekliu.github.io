---
categories:
  - Android
  - Android杂记
tags:
  - FileUriExposedException
  - FileProvider
toc: true
toc_label: "目录"
toc_icon: "heart"
---

在Android 7.0及以上版本上，通过以下方式调用相机会报错android.os.FileUriExposedException
```java
imageUri = Uri.fromFile(mTmpImgFile);
intent.putExtra(MediaStore.EXTRA_OUTPUT, imageUri);
mContext.startActivityForResult(intent, CODE_CHOOSE_FROM_CAMERA);
```

出于安全的考虑，Google推荐采用FileProvider的方式来代替。
替换FileProvider只需要三步即可：
#1. 在res/xml/中指定可用文件
```
<!-- res/xml/filepaths.xml -->
<paths>
    <files-path name="my_images" path="images/"/>
    <files-path name="my_docs" path="docs/"/>
</paths>
```
<paths>节点必须包含有最少一个以下子节点：

| 子节点 | 描述 |
| :---- | :-- |
| <files-path name="name" path="path" /> | Context.getFilesDir() |
| <cache-path name="name" path="path" /> | getCacheDir() |
| <external-path name="name" path="path" /> | Environment.getExternalStorageDirectory() |
| <external-files-path name="name" path="path" /> | Context#getExternalFilesDir(String) |
| <external-cache-path name="name" path="path" /> | Context.getExternalCacheDir() |

配置`<external-path name="xxxx" path="."/>`可访问SD卡所有路径。


#2. 在AndroidManifest.xml中添加如下provider
```xml
<application
        android:name=".GlobalApplication"
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher1"
        android:label="@string/app_name"
        android:supportsRtl="true"
        android:theme="@style/AppTheme">
        .......
        <provider
            android:name="android.support.v4.content.FileProvider"
            android:authorities="yorek.com.solitaire.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/filepaths"/>
        </provider>
        ......
    </application>
```
meta-data中android:name固定为android.support.FILE_PROVIDER_PATHS，android:resource则为第一步中创建的xml文件

#3. 在代码中使用
在代码中使用时，要注意判断正在运行设备的版本号
```java
private void chooseFromCameraInternal() {
    Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
    Uri imageUri;
    if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.M) {
        imageUri = Uri.fromFile(mTmpImgFile);
    } else {    // support for N
        imageUri = FileProvider.getUriForFile(mContext, AUTHORITY, mTmpImgFile);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
    }       
    intent.putExtra(MediaStore.EXTRA_OUTPUT, imageUri);
    mContext.startActivityForResult(intent, CODE_CHOOSE_FROM_CAMERA);
}
```
注意这里的`AUTHORITY`填写上面AndroidManifest中的`android:authorities`值就好。
