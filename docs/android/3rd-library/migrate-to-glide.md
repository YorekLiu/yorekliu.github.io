---
title: "杂记：从Picasso迁移至Glide"
---

!!! note "Glide系列文章目录"
    - [Glide1——Glide v4 的基本使用](/android/3rd-library/glide1/)
    - [Glide2——从源码的角度理解Glide三步的执行流程](/android/3rd-library/glide2/)
    - [Glide3——深入探究Glide缓存机制](/android/3rd-library/glide3/)
    - [Glide4——RequestBuilder中高级点的API以及Target](/android/3rd-library/glide4/)
    - [Glide5——Glide内置的transform以及自定义BitmapTransformation](/android/3rd-library/glide5/)
    - [Glide6——Glide利用AppGlideModule、LibraryGlideModule更改默认配置、扩展Glide功能；GlideApp与Glide的区别在哪？](/android/3rd-library/glide6/)
    - [Glide7——利用OkHttp、自定义Drawable、自定义ViewTarget实现带进度的图片加载功能](/android/3rd-library/glide7/)
    - [杂记：从Picasso迁移至Glide](/android/3rd-library/migrate-to-glide/)

---

不久前，我对项目中的图片库进行了迁移操作，整个过程的工程量不大，因为Glide和Picasso两者在语法上还是非常相似的。  

## 1. 注意点

所有的代码层面改动点在于：

1. Picasso加载时不需要传入`Context`对象；而Glide需要，且`Glide.with`方法还有不同的重载方法
2. 项目中大量使用了Picasso的`fit()`、`config(Bitmap.Config)`函数，而Glide中没有。所以在迁移前期，需要使用`GlideExtension`注解和`GlideOption`注解来为Glide添加对应的API，从而使迁移比较顺畅。此外，Glide的加载基本都会根据target的size来裁剪尺寸，所以`fit()`扩展方法在后续可以清理掉。至于`config(Bitmap.Config)`方法，可以保留一下，兼容一下老版本的实现。  
    ```java
    package com.ximalaya.ting.kid.glide;

    import android.graphics.Bitmap;

    import com.bumptech.glide.annotation.GlideExtension;
    import com.bumptech.glide.annotation.GlideOption;
    import com.bumptech.glide.load.DecodeFormat;
    import com.bumptech.glide.request.RequestOptions;

    @GlideExtension
    public class XmGlideExtension {

        private XmGlideExtension() {}

        @GlideOption
        public static RequestOptions config(RequestOptions options, Bitmap.Config config) {
            if (config == Bitmap.Config.RGB_565) {
                return options.format(DecodeFormat.PREFER_RGB_565);
            } else if (config == Bitmap.Config.ARGB_8888) {
                return options.format(DecodeFormat.PREFER_ARGB_8888);
            } else {
                return options;
            }
        }
    }
    ```

3. 项目中有使用Picasso的`tag()`方法来管理图片的加载，但在Glide中需要使用`Glide.with()`得到的`RequestManager`来管理，所以相关代码也需要理一下逻辑后进行改造。
4. Picasso中的`into(Target)`与Glide中的`into(Target)`方法的替换，这里需要费一点力，但是不费脑力，所以也不展开了。
5. 使用OkHttp代替默认的网络请求方式，这里Picasso也可以替换，但是就不展开了。这里看看Glide的方式，相关原理可以参考[Glide6——Glide利用AppGlideModule、LibraryGlideModule更改默认配置、扩展Glide功能；GlideApp与Glide的区别在哪？
](/android/3rd-library/glide6/)：
    ```java
    package com.ximalaya.ting.kid.glide;

    import android.content.Context;
    import android.support.annotation.NonNull;

    import com.bumptech.glide.Glide;
    import com.bumptech.glide.GlideBuilder;
    import com.bumptech.glide.Registry;
    import com.bumptech.glide.annotation.Excludes;
    import com.bumptech.glide.annotation.GlideModule;
    import com.bumptech.glide.integration.okhttp3.OkHttpLibraryGlideModule;
    import com.bumptech.glide.integration.okhttp3.OkHttpUrlLoader;
    import com.bumptech.glide.load.model.GlideUrl;
    import com.bumptech.glide.module.AppGlideModule;

    import java.io.InputStream;

    import okhttp3.OkHttpClient;

    @GlideModule
    @Excludes({OkHttpLibraryGlideModule.class})
    public class XmAppGlideModule extends AppGlideModule {
        @Override
        public void applyOptions(@NonNull Context context, @NonNull GlideBuilder builder) {
            super.applyOptions(context, builder);
        }

        @Override
        public void registerComponents(@NonNull Context context, @NonNull Glide glide, @NonNull Registry registry) {
            // OkHttpLibraryGlideModule
            OkHttpClient okHttpClient = XmGlideConfig.getInstance().getOkHttpClient();
            registry.replace(GlideUrl.class, InputStream.class, new OkHttpUrlLoader.Factory(okHttpClient));
        }
    }

    ```

## 2. 采坑点

在实践后，还是遇到了以下的一些坑，需要注意一下：

### 1. target的tag问题

由于很多位置在迁移的时候，只是将`Picasso.get()`换成了`GlideApp.with(xxx)`，而没有看上下文。所以会有Picasso加载正常，但是Glide加载就会报错的位置。比如下面就是替换后的代码：

```java
...
imgAvatar.setTag(i);
imgAvatar.setOnClickListener(mOnClickListener);
if (!TextUtils.isEmpty(child.getAvatar())) {
    GlideApp.with(getContext()).load(child.getAvatar()).error(R.drawable.bg_place_holder_circle).into(imgAvatar);
} else {
    imgAvatar.setImageResource(child.getSex() == Child.Sex.Female ? R.drawable.ic_avatar_default_female : R.drawable.ic_avatar_default_male);
}
...
```

我们知道，默认情况下，Glide中一个Request会保存到View的tag上，而这里在加载之前又设置了tag，导致Glide加载时发现tag不是Request，就会抛异常了：

**ViewTarget.java**

```java
  @Override
  @Nullable
  public Request getRequest() {
    Object tag = getTag();
    Request request = null;
    if (tag != null) {
      if (tag instanceof Request) {
        request = (Request) tag;
      } else {
        throw new IllegalArgumentException(
            "You must not call setTag() on a view Glide is targeting");
      }
    }
    return request;
  }
```

解决办法是调用`ViewTarget.setTagId(int tagId)`给`ViewTarget`设置一个默认的tagId，这样Request会通过`setTag(int key, final Object tag)`保存，而不是`setTag(final Object tag)`，这样就不会冲突了。

=== "java"

    ```java 
    ViewTarget.setTagId(R.id.glide_tag);
    ```

=== "xml"

    ```xml
    <?xml version="1.0" encoding="utf-8"?>
    <resources>
        <item name="glide_tag" type="id" />
    </resources>
    ```