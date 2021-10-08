---
title: "Bitmap的缓存与加载"
---

来自官方的建议：[Loading Large Bitmaps Efficiently](https://developer.android.com/topic/performance/graphics/load-bitmap.html)

> **Note**: There are several libraries that follow best practices for loading images. You can use these libraries in your app to load images in the most optimized manner. We recommend the [Glide](https://github.com/bumptech/glide) library, which loads and displays images as quickly and smoothly as possible. Other popular image loading libraries include [Picasso](http://square.github.io/picasso/) from Square and [Fresco](https://github.com/facebook/fresco) from Facebook. These libraries simplify most of the complex tasks associated with bitmaps and other types of images on Android.

总的来说，就是使用上面这些图片加载库可以最简化你的操作。

> On Android 2.3.3 (API level 10) and lower, the backing pixel data for a Bitmap is stored in native memory. It is separate from the Bitmap itself, which is stored in the Dalvik heap. The pixel data in native memory is not released in a predictable manner, potentially causing an application to briefly exceed its memory limits and crash. From Android 3.0 (API level 11) through Android 7.1 (API level 25), the pixel data is stored on the Dalvik heap along with the associated Bitmap. In Android 8.0 (API level 26), and higher, the Bitmap pixel data is stored in the native heap.  
> <cite>[Managing Bitmap Memory](https://developer.android.google.cn/topic/performance/graphics/manage-memory)</cite>
>  
> 2.3.3 (API level 10)以及更低版本，像素数据存储在native内存上；而Bitmap对象存储在Dalvik堆上。像素数据没有以一种可预测的方式来释放，所以需要我们手动release。  
> 3.0 (API level 11) 到 Android 7.1 (API level 25)，像素数据和Bitmap对象都存储在Dalvik堆上。可以不动手动release了。  
> 8.0 (API level 26)以及更高版本，像素数据存储在native堆上了。

## 1 Bitmap的加载

`BitmapFactory`提供了一些加载图片的方法(`decodeByteArray()`、`decodeFile()`、`decodeResource()`)从不同类型的文件中加载`Bitmap`对象。这些方法会尝试申请`bitmap`所需要的内存，因此容易导致`OutOfMemory`异常。

> 一张Bitmap在内存中的占用为：图片宽 * 图片高 * 图片格式  
> 
> | 图片格式 (Bitmap.Config) | 占用内存 | 100*100图片占用内存大小 |  
> | ---------------------- | ------- | --------------------- |  
> | ALPHA_8 | 1 Byte | 100 \* 100 \* 1 = 10000 Byte |  
> | ARGB_4444 | 2 Byte | 100 \* 100 \* 2 = 20000 Byte |  
> | ARGB_8888 | 4 Byte | 100 \* 100 \* 4 = 40000 Byte |  
> | RGB_565 | 2 Byte | 100 \* 100 \* 2 = 20000 Byte |  
> 
> 当然，图片的最终内存占用还与图片所在文件夹(density)以及设备的屏幕密度(targetDensity)相关，缩放比scale = targetDensity / density  
> 
> e.g.   
> 设备屏幕密度为440，以ARGB_8888加载，位于*drawable-hdpi*中的400*400的图片，内存占用为  
> ((int) (400 * (440 / 240) + 0.5)) ^ 2 * 4 = 2149156 Byte  
> 
> 设备屏幕密度为440，以ARGB_8888加载，位于*drawable-xhdpi*中的400*400的图片，内存占用为  
> ((int) (400 * (440 / 320) + 0.5)) ^ 2 * 4 = 1210000 Byte  
> 
> 因此，**图片占用内存大小和手机的密度成正比，所在文件夹密度成反比**
> 
> 对应文件夹密度可以查表[不同像素密度的配置限定符](/android/framework/%E6%80%A7%E8%83%BD%E4%BC%98%E5%8C%96/#513)

我们可以采用`BitmapFactory.Options`来设置decode的配置。在decode前将`inJustDecodeBounds`属性设置为`true`，虽然将会返回`null`的`bitmap`，但是可以得到`outWidth`、`outHeight`以及`outMimeType`。这样我们可以在创建(以及申请内存)前获得图片的像素尺寸和类型。

```java
BitmapFactory.Options options = new BitmapFactory.Options();
options.inJustDecodeBounds = true;
BitmapFactory.decodeResource(getResources(), R.id.myimage, options);
int imageHeight = options.outHeight;
int imageWidth = options.outWidth;
String imageType = options.outMimeType;
```

除非我们完全相信图片所占用的内存可以满足，在decode之前检查像素可以避免`java.lang.OutOfMemory`异常。

### 1.1 采样率压缩
设置`BitmapFactory.Options`中的`inSampleSize`可以采样到缩略图。

`inSampleSize`的取值应该是2的指数，比如1、2、4等等；少于1，其作用相当于1。如果`inSampleSize`为2，那么采样后的图片宽高均为原图的1/2，也就是占用内存大小为原图的1/4。

采样率的计算代码如下：
```java
public static int calculateInSampleSize(
            BitmapFactory.Options options, int reqWidth, int reqHeight) {
    // Raw height and width of image
    final int height = options.outHeight;
    final int width = options.outWidth;
    int inSampleSize = 1;

    if (height > reqHeight || width > reqWidth) {

        final int halfHeight = height / 2;
        final int halfWidth = width / 2;

        // Calculate the largest inSampleSize value that is a power of 2 and keeps both
        // height and width larger than the requested height and width.
        while ((halfHeight / inSampleSize) >= reqHeight
                && (halfWidth / inSampleSize) >= reqWidth) {
            inSampleSize *= 2;
        }
    }

    return inSampleSize;
}
```

使用上面的方法时，现将`inJustDecodeBounds`设置为`true`计算采样率，然后使用`inSampleSize`并将`inJustDecodeBounds`设置为`false`。
```java
public static Bitmap decodeSampledBitmapFromResource(Resources res, int resId,
        int reqWidth, int reqHeight) {

    // First decode with inJustDecodeBounds=true to check dimensions
    final BitmapFactory.Options options = new BitmapFactory.Options();
    options.inJustDecodeBounds = true;
    BitmapFactory.decodeResource(res, resId, options);

    // Calculate inSampleSize
    options.inSampleSize = calculateInSampleSize(options, reqWidth, reqHeight);

    // Decode bitmap with inSampleSize set
    options.inJustDecodeBounds = false;
    return BitmapFactory.decodeResource(res, resId, options);
}
```

最后，将一个大图加载到100*100大小的ImageView里面可以这么写：
```java
mImageView.setImageBitmap(
    decodeSampledBitmapFromResource(getResources(), R.drawable.myimage, 100, 100));
```

### 1.2 封装好的大图片加载类
```java
/**
 * 压缩Image至指定的大小
 * Created by yorek on 5/10/17.
 */
public class ImageSampler {

    private static final String TAG = "ImageSampler";

    public static Bitmap sample(InputStream input, int reqWidth, int reqHeight) {
        final BitmapFactory.Options options = new BitmapFactory.Options();
        options.inJustDecodeBounds = true;

        decodeStream(input, null, options);

        options.inSampleSize = calcSampleSize(options, reqWidth, reqHeight);
        options.inJustDecodeBounds = false;

        Bitmap bitmap = BitmapFactory.decodeStream(input, null, options);

        try {
            if (input != null) {
                input.close();
            }
        } catch (IOException e) {
            Log.e(TAG, "error in input.close() : " + e.getMessage());
            return null;
        }

        return bitmap;
    }

    public static Bitmap sample(String fileName, int reqWidth, int reqHeight) {
        final BitmapFactory.Options options = new BitmapFactory.Options();
        options.inJustDecodeBounds = true;

        BitmapFactory.decodeFile(fileName, options);

        options.inSampleSize = calcSampleSize(options, reqWidth, reqHeight);
        options.inJustDecodeBounds = false;

        return BitmapFactory.decodeFile(fileName, options);
    }

    public static Bitmap sample(FileDescriptor fileDescriptor, int reqWidth, int reqHeight) {
        final BitmapFactory.Options options = new BitmapFactory.Options();
        options.inJustDecodeBounds = true;

        BitmapFactory.decodeFileDescriptor(fileDescriptor, null, options);

        options.inSampleSize = calcSampleSize(options, reqWidth, reqHeight);
        options.inJustDecodeBounds = false;

        return BitmapFactory.decodeFileDescriptor(fileDescriptor, null, options);
    }

    public static Bitmap sample(Resources resources, int resId, int reqWidth, int reqHeight) {
        final BitmapFactory.Options options = new BitmapFactory.Options();
        options.inJustDecodeBounds = true;

        BitmapFactory.decodeResource(resources, resId, options);

        options.inSampleSize = calcSampleSize(options, reqWidth, reqHeight);
        options.inJustDecodeBounds = false;

        return BitmapFactory.decodeResource(resources, resId, options);
    }

    private static int calcSampleSize(BitmapFactory.Options options, int reqWidth, int reqHeight) {
        if (reqWidth == 0 || reqHeight == 0) {
            return 1;
        }

        // Raw height and width of image
        final int height = options.outHeight;
        final int width = options.outWidth;
        int inSampleSize = 1;

        if (height > reqHeight || width > reqWidth) {

            final int halfHeight = height / 2;
            final int halfWidth = width / 2;

            // Calculate the largest inSampleSize value that is a power of 2 and keeps both
            // height and width larger than the requested height and width.
            while ((halfHeight / inSampleSize) >= reqHeight
                    && (halfWidth / inSampleSize) >= reqWidth) {
                inSampleSize *= 2;
            }
        }

        Log.i(TAG, "inSampleSize = " + inSampleSize +", [outWidth, outHeight] = ["
            + height + ", " + width + "], [reqWidth, reqHeight] = [" + reqWidth + ", " + reqHeight + "]");
        return inSampleSize;
    }
}
```

### 1.3 质量压缩

质量压缩只要靠`Bitmap.compress(CompressFormat format, int quality, OutputStream stream)`这个方法。quality取值为0-100，取值越高表示图片的质量越高。当然，PNG格式时会忽略质量。

将Bitmap保存到磁盘中也是使用的该方法。

```java
@Nullable
public static File saveBitmap(
        @NonNull Bitmap bitmap,
        @NonNull Bitmap.CompressFormat format,
        @IntRange(from = 0, to = 100) int quality,
        @NonNull File destFile,
        boolean recycle
) {
    ByteArrayOutputStream baos = new ByteArrayOutputStream();
    bitmap.compress(format, quality, baos);
    try {
        FileOutputStream fos = new FileOutputStream(destFile);
        fos.write(baos.toByteArray());
        fos.flush();
        fos.close();
        if (recycle && !bitmap.isRecycled()) {
            bitmap.recycle();
        }
        return destFile;
    } catch (IOException e) {
        e.printStackTrace();
    }

    return null;
}
```

### 1.4 尺寸压缩

尺寸压缩就是将一张Bitmap等比缩放，然后Canvas绘制后，先获取二进制数组，然后写入到本地。

```java
public static void scale(@NonNull Bitmap bitmap, @NonNull File file, float scale) {
    final int bWidth = bitmap.getWidth();
    final int bHeight = bitmap.getHeight();
    final int newWidth = (int) (bWidth * scale);
    final int newHeight = (int) (bHeight * scale);

    Bitmap result = Bitmap.createBitmap(newWidth, newHeight, Bitmap.Config.ARGB_8888);
    Canvas canvas = new Canvas(result);
    RectF rect = new RectF(0, 0, newWidth, newHeight);
    canvas.drawBitmap(bitmap, null, rect, null);

    saveBitmap(result, Bitmap.CompressFormat.JPEG, 100, file, false);
}
```

## 2 Bitmap的缓存

来自官方的建议：[https://developer.android.com/topic/performance/graphics/cache-bitmap.html](https://developer.android.com/topic/performance/graphics/cache-bitmap.html)



Bitmap的加载顺序：内存 -> 磁盘 -> 网络获取  
Bitmap的写入顺序：网络 -> 内存 -> 磁盘

目前常用的缓存算法是LRU(Least Recently Used)，也就是最近最少使用算法。它的核心思想是当缓存满时，会优先淘汰那些最近最少使用的缓存对象。

采用LRU算法的缓存有两种：`LruCache`以及`DiskLruCache`，前者用于实现内存缓存，后者充当了存储设备缓存。

### 2.1 LruCache
`LruCache`是Android 3.1提供的一个缓存类，通过v4兼容包可以兼容早期的Android版本。

`LruCache`是一个泛类型，它内部采用了一个[LinkedHashMap](/java/java-collections/#4-linkedhashmap)以强引用的方式存储外界的缓存对象，其提供了`get`和`put`方法来完成缓存的获取和添加操作。当缓存满时，它会按照算法移除缓存对象，然后添加新的缓存对象。

`LruCache`的实现比较简单
```java
public class LruCache<K, V> {
    private final LinkedHashMap<K, V> map;

    /** Size of this cache in units. Not necessarily the number of elements. */
    private int size;
    private int maxSize;

    private int putCount;
    private int createCount;
    private int evictionCount;
    private int hitCount;
    private int missCount;

    /**
     * @param maxSize for caches that do not override {@link #sizeOf}, this is
     *     the maximum number of entries in the cache. For all other caches,
     *     this is the maximum sum of the sizes of the entries in this cache.
     */
    public LruCache(int maxSize) {
        if (maxSize <= 0) {
            throw new IllegalArgumentException("maxSize <= 0");
        }
        this.maxSize = maxSize;
        this.map = new LinkedHashMap<K, V>(0, 0.75f, true);
    }

    /**
     * Sets the size of the cache.
     *
     * @param maxSize The new maximum size.
     */
    public void resize(int maxSize) {
        if (maxSize <= 0) {
            throw new IllegalArgumentException("maxSize <= 0");
        }

        synchronized (this) {
            this.maxSize = maxSize;
        }
        trimToSize(maxSize);
    }

    /**
     * Returns the value for {@code key} if it exists in the cache or can be
     * created by {@code #create}. If a value was returned, it is moved to the
     * head of the queue. This returns null if a value is not cached and cannot
     * be created.
     */
    public final V get(K key) {
        if (key == null) {
            throw new NullPointerException("key == null");
        }

        V mapValue;
        synchronized (this) {
            mapValue = map.get(key);
            if (mapValue != null) {
                hitCount++;
                return mapValue;
            }
            missCount++;
        }

        /*
         * Attempt to create a value. This may take a long time, and the map
         * may be different when create() returns. If a conflicting value was
         * added to the map while create() was working, we leave that value in
         * the map and release the created value.
         */

        V createdValue = create(key);
        if (createdValue == null) {
            return null;
        }

        synchronized (this) {
            createCount++;
            mapValue = map.put(key, createdValue);

            if (mapValue != null) {
                // There was a conflict so undo that last put
                map.put(key, mapValue);
            } else {
                size += safeSizeOf(key, createdValue);
            }
        }

        if (mapValue != null) {
            entryRemoved(false, key, createdValue, mapValue);
            return mapValue;
        } else {
            trimToSize(maxSize);
            return createdValue;
        }
    }

    /**
     * Caches {@code value} for {@code key}. The value is moved to the head of
     * the queue.
     *
     * @return the previous value mapped by {@code key}.
     */
    public final V put(K key, V value) {
        if (key == null || value == null) {
            throw new NullPointerException("key == null || value == null");
        }

        V previous;
        synchronized (this) {
            putCount++;
            size += safeSizeOf(key, value);
            previous = map.put(key, value);
            if (previous != null) {
                size -= safeSizeOf(key, previous);
            }
        }

        if (previous != null) {
            entryRemoved(false, key, previous, value);
        }

        trimToSize(maxSize);
        return previous;
    }

    /**
     * Remove the eldest entries until the total of remaining entries is at or
     * below the requested size.
     *
     * @param maxSize the maximum size of the cache before returning. May be -1
     *            to evict even 0-sized elements.
     */
    public void trimToSize(int maxSize) {
        while (true) {
            K key;
            V value;
            synchronized (this) {
                if (size < 0 || (map.isEmpty() && size != 0)) {
                    throw new IllegalStateException(getClass().getName()
                            + ".sizeOf() is reporting inconsistent results!");
                }

                if (size <= maxSize || map.isEmpty()) {
                    break;
                }

                Map.Entry<K, V> toEvict = map.entrySet().iterator().next();
                key = toEvict.getKey();
                value = toEvict.getValue();
                map.remove(key);
                size -= safeSizeOf(key, value);
                evictionCount++;
            }

            entryRemoved(true, key, value, null);
        }
    }

    /**
     * Removes the entry for {@code key} if it exists.
     *
     * @return the previous value mapped by {@code key}.
     */
    public final V remove(K key) {
        if (key == null) {
            throw new NullPointerException("key == null");
        }

        V previous;
        synchronized (this) {
            previous = map.remove(key);
            if (previous != null) {
                size -= safeSizeOf(key, previous);
            }
        }

        if (previous != null) {
            entryRemoved(false, key, previous, null);
        }

        return previous;
    }

    /**
     * Called for entries that have been evicted or removed. This method is
     * invoked when a value is evicted to make space, removed by a call to
     * {@link #remove}, or replaced by a call to {@link #put}. The default
     * implementation does nothing.
     *
     * <p>The method is called without synchronization: other threads may
     * access the cache while this method is executing.
     *
     * @param evicted true if the entry is being removed to make space, false
     *     if the removal was caused by a {@link #put} or {@link #remove}.
     * @param newValue the new value for {@code key}, if it exists. If non-null,
     *     this removal was caused by a {@link #put}. Otherwise it was caused by
     *     an eviction or a {@link #remove}.
     */
    protected void entryRemoved(boolean evicted, K key, V oldValue, V newValue) {}

    /**
     * Called after a cache miss to compute a value for the corresponding key.
     * Returns the computed value or null if no value can be computed. The
     * default implementation returns null.
     *
     * <p>The method is called without synchronization: other threads may
     * access the cache while this method is executing.
     *
     * <p>If a value for {@code key} exists in the cache when this method
     * returns, the created value will be released with {@link #entryRemoved}
     * and discarded. This can occur when multiple threads request the same key
     * at the same time (causing multiple values to be created), or when one
     * thread calls {@link #put} while another is creating a value for the same
     * key.
     */
    protected V create(K key) {
        return null;
    }

    private int safeSizeOf(K key, V value) {
        int result = sizeOf(key, value);
        if (result < 0) {
            throw new IllegalStateException("Negative size: " + key + "=" + value);
        }
        return result;
    }

    /**
     * Returns the size of the entry for {@code key} and {@code value} in
     * user-defined units.  The default implementation returns 1 so that size
     * is the number of entries and max size is the maximum number of entries.
     *
     * <p>An entry's size must not change while it is in the cache.
     */
    protected int sizeOf(K key, V value) {
        return 1;
    }

    /**
     * Clear the cache, calling {@link #entryRemoved} on each removed entry.
     */
    public final void evictAll() {
        trimToSize(-1); // -1 will evict 0-sized elements
    }

    /**
     * For caches that do not override {@link #sizeOf}, this returns the number
     * of entries in the cache. For all other caches, this returns the sum of
     * the sizes of the entries in this cache.
     */
    public synchronized final int size() {
        return size;
    }

    /**
     * For caches that do not override {@link #sizeOf}, this returns the maximum
     * number of entries in the cache. For all other caches, this returns the
     * maximum sum of the sizes of the entries in this cache.
     */
    public synchronized final int maxSize() {
        return maxSize;
    }

    /**
     * Returns the number of times {@link #get} returned a value that was
     * already present in the cache.
     */
    public synchronized final int hitCount() {
        return hitCount;
    }

    /**
     * Returns the number of times {@link #get} returned null or required a new
     * value to be created.
     */
    public synchronized final int missCount() {
        return missCount;
    }

    /**
     * Returns the number of times {@link #create(Object)} returned a value.
     */
    public synchronized final int createCount() {
        return createCount;
    }

    /**
     * Returns the number of times {@link #put} was called.
     */
    public synchronized final int putCount() {
        return putCount;
    }

    /**
     * Returns the number of values that have been evicted.
     */
    public synchronized final int evictionCount() {
        return evictionCount;
    }

    /**
     * Returns a copy of the current contents of the cache, ordered from least
     * recently accessed to most recently accessed.
     */
    public synchronized final Map<K, V> snapshot() {
        return new LinkedHashMap<K, V>(map);
    }

    @Override public synchronized final String toString() {
        int accesses = hitCount + missCount;
        int hitPercent = accesses != 0 ? (100 * hitCount / accesses) : 0;
        return String.format("LruCache[maxSize=%d,hits=%d,misses=%d,hitRate=%d%%]",
                maxSize, hitCount, missCount, hitPercent);
    }
}
```

下面说说`LruCache`的基本操作:
```java
// 初始化
int maxMemory = (int) (Runtime.getRuntime().maxMemory() / 1024);
int cacheSize = maxMemory / 8;
LruCache<String, Bitmap> mMemoryCache = new LruCache<String, Bitmap>(cacheSize) {
    @Override
    protected int sizeOf(String key, Bitmap bitmap) {
        return bitmap.getRowBytes() * bitmap.getHeight() / 1024;
    }
};

// 获取
mMemoryCache.get(key);

// 添加
mMemoryCache.put(key, bitmap);

// 删除
mMemoryCache.remove(key);
```

### 2.2 DiskLruCache
`DiskLruCache`用于实现存储设备缓存，即磁盘缓存，它通过将缓存对象写入文件系统从而实现缓存的效果。`DiskLruCache`得到了Android官方的支持，但是它不属于Android SDK的一部分。

[https://android.googlesource.com/platform/libcore/+/jb-mr2-release/luni/src/main/java/libcore/io/DiskLruCache.java](https://android.googlesource.com/platform/libcore/+/jb-mr2-release/luni/src/main/java/libcore/io/DiskLruCache.java)

#### 2.2.1 DiskLruCache的创建
DiskLruCache的创建是通过`open`方法创建的，下面是其方法签名
```java
public static DiskLruCache open(File directory, int appVersion, int valueCount, long maxSize)
```

这四个参数的含义如下：

 - directory  
   数据的缓存地址
 - appVersion  
   当前应用程序的版本号，每当版本号改变，缓存路径下存储的所有数据都会被清除掉
 - valueCount  
   同一个key可以对应多少个缓存文件，基本都是传1
 - maxSize  
   最多可以缓存多少字节的数据

考虑到如果手机没有SD卡或者SD卡被移除了，我们需要返回内置存储。所以需要一个方法来返回缓存目录：
```java
// Creates a unique subdirectory of the designated app cache directory. Tries to use external
// but if not mounted, falls back on internal storage.
public static File getDiskCacheDir(Context context, String uniqueName) {
    // Check if media is mounted or storage is built-in, if so, try and use external cache dir
    // otherwise use internal cache dir
    final String cachePath =
            Environment.MEDIA_MOUNTED.equals(Environment.getExternalStorageState()) ||
                    !isExternalStorageRemovable() ? getExternalCacheDir(context).getPath() :
                            context.getCacheDir().getPath();

    return new File(cachePath + File.separator + uniqueName);
}
```

#### 2.2.2 DiskLruCache的写入
写入的操作是借助DiskLruCache.Editor这个类完成的。通过该类的`edit`方法来获取`Editor`对象，如果这个缓存正在被编辑，那么`edit`会返回`null`。
```java
public Editor edit(String key) throws IOException
```


当然我们不能直接把url作为key，因为url里面可能有特殊字符，这样可能会出现无法命名文件等问题。因此，我们需要把url进行MD5编码：
```java
public String hashKeyFromUrl(String key) {  
    String cacheKey;  
    try {  
        final MessageDigest mDigest = MessageDigest.getInstance("MD5");  
        mDigest.update(key.getBytes());  
        cacheKey = bytesToHexString(mDigest.digest());  
    } catch (NoSuchAlgorithmException e) {  
        cacheKey = String.valueOf(key.hashCode());  
    }  
    return cacheKey;  
}  

private String bytesToHexString(byte[] bytes) {  
    StringBuilder sb = new StringBuilder();  
    for (int i = 0; i < bytes.length; i++) {  
        String hex = Integer.toHexString(0xFF & bytes[i]);  
        if (hex.length() == 1) {  
            sb.append('0');  
        }  
        sb.append(hex);  
    }  
    return sb.toString();  
}  
```

有了`DiskLruCache.Editor`的实例之后，我们可以调用它的`newOutputStream()`方法来创建一个输出流，然后把它传入到网络下载图片的流中就能实现下载并写入缓存的功能了。

注意`newOutputStream()`方法接收一个index参数，由于前面在设置valueCount的时候指定的是1，所以这里index传0就可以了。在写入操作执行完之后，我们还需要调用一下commit()方法进行提交才能使写入生效，调用abort()方法的话则表示回退此次操作。

#### 2.2.3 DiskLruCache的读取
和写入操作类似，通过`DiskLruCache#get`操作得到一个`Snapshot`对象，然后可以获得缓存文件的文件输入流，最后decode成`Bitmap`。

```java
public synchronized Snapshot get(String key) throws IOException
```

下面是`DiskLruCache`读取`Bitmap`的例子：
```java
String key = hashKeyForDisk(imageUrl);  
DiskLruCache.Snapshot snapShot = mDiskLruCache.get(key);  
if (snapShot != null) {  
    FileInputStream is = (FileInputStream) snapShot.getInputStream(0);
    FileDescriptor fileDescriptor = FileInputStream.getFD();
    Bitmap bitmap = ImageResizer.resize(fileDescriptor, reqWidth, reqHeight);
    mImage.setImageBitmap(bitmap);  
}  
```

`DiskLruCache`除了上面的方法以外，还有`remove`和`delete`方法用于磁盘的缓存的删除操作。`remove`会移除`key`对应的缓存，而`delete`会删除所有的磁盘缓存。
```java
public synchronized boolean remove(String key) throws IOException
public void delete() throws IOException
```

---
**参考文献**

- [Android DiskLruCache完全解析，硬盘缓存的最佳方案](http://blog.csdn.net/guolin_blog/article/details/28863651)
