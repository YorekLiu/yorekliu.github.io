---
title: "Glide v4 源码解析（三）"
excerpt: "深入探究Glide缓存机制"
categories:
  - Android
tags:
  - Glide
header:
  overlay_image: /assets/images/android/glide_logo.png
  overlay_filter: rgba(126, 202, 286, 0.6)
toc: true
toc_label: "目录"
# last_modified_at: 2019-05-06T11:26:12+08:00
---

本系列文章参考3.7.0版本的[guolin - Glide最全解析](https://blog.csdn.net/sinyu890807/column/info/15318)，并按此思路结合4.9.0版本源码以及使用文档进行更新。  
➟ [Glide v4.9.0](https://github.com/bumptech/glide/tree/v4.9.0)  
➟ [中文使用文档](https://muyangmin.github.io/glide-docs-cn/)  
{: .notice--info }

在上一篇文章中比较详细地介绍了`Glide.with(xx).load(xx).into(xx)`中的很多过程，虽然看完之后理得不是特别清楚。但是没关系，这篇文章开始会一个方面一个方面地进行总结。  

本篇文章主要讨论的就是Glide中的缓存问题。Glide缓存机制的流程图如下：

<figure style="width: 100%" class="align-center">
    <img src="/assets/images/android/glide-cache-flow-chart.png">
    <figcaption>Glide缓存流程图</figcaption>
</figure>

从图中可以看出，Glide的资源状态可以分为三种：

1. active状态资源  
  > `Engine.load`方法上的注释写到：  
  > Active resources are those that have been provided to at least one request and have not yet been released. Once all consumers of a resource have released that resource, the resource then goes to cache. If the resource is ever returned to a new consumer from cache, it is re-added to the active resources. If the resource is evicted from the cache, its resources are recycled and re-used if possible and the resource is discarded. There is no strict requirement that consumers release their resources so active resources are held weakly.  
  >
  > 提供给一个或以上请求且没有被释放的资源被称为active资源。一旦所有的消费者都释放了该资源，该资源就会被放入memory cache中。如果有请求将资源从memory cache中取出，它会被重新添加到active资源中。如果一个资源从memory cache中移除，其本身会被discard，其内部拥有的资源将会回收或者在可能的情况下重用。并没有严格要求消费者一定要释放它们的资源，所以active资源会以弱引用的方式保持。

2. 内存缓存
3. 磁盘缓存。包括data和resource两种不同的缓存，其区别在于  
   - data资源指原始的没有修改过的资源文件  
   - resource资源指获取采样后、transformed后资源文件

下面开始一边过源码，一遍印证上面的图。

Glide的memory cache和disk cache在Glide创建的时候就确定了。  
代码在`GlideBuilder.build(Context)`方法里面。值得一提的是，Glide是单例实现的，在上一章 [1.1节 getRetriever(Context)](/android/glide2/#11-getretrievercontext) 中我们分析时贴了对应的代码。

memory cache和disk cache在Glide创建时相关代码如下：

**GlideBuilder.java**

```java
@NonNull
Glide build(@NonNull Context context) {
  if (memoryCache == null) {
    memoryCache = new LruResourceCache(memorySizeCalculator.getMemoryCacheSize());
  }

  if (diskCacheFactory == null) {
    diskCacheFactory = new InternalCacheDiskCacheFactory(context);
  }

  if (engine == null) {
    engine =
        new Engine(
            memoryCache,
            diskCacheFactory,
            ...);
  }

  return new Glide(
      ...
      memoryCache,
      ...);
}
```

memoryCache和diskCacheFactory如果没有没有在任何`GlideMode`中进行设置的话，会有一个默认的实现。大部分情况下，我们使用这个默认实现就很好了。  

## 1. memoryCache介绍

memoryCache发生存取操作是在Engine中，但是我们看到memoryCache还被放入了Glide实例中。这是因为Glide实现了`ComponentCallbacks2`接口，在Glide创建完成后，其实例被注册了该接口。这样在内存紧张的时候，可以通知memoryCache释放内存。

**Glide.java**

```java
@Override
public void onTrimMemory(int level) {
  trimMemory(level);
}

public void trimMemory(int level) {
  // Engine asserts this anyway when removing resources, fail faster and consistently
  Util.assertMainThread();
  // memory cache needs to be trimmed before bitmap pool to trim re-pooled Bitmaps too. See #687.
  memoryCache.trimMemory(level);
  bitmapPool.trimMemory(level);
  arrayPool.trimMemory(level);
}
```

memoryCache是一个使用LRU(least recently used)算法实现的内存缓存类`LruResourceCache`，继承至`LruCache`类，实现了`MemoryCache`接口。  
`LruCache`定义了LRU相关的操作，而`MemoryCache`定义的是内存缓存相关的操作。`LruResourceCache`其相关代码如下：

```java
public class LruResourceCache extends LruCache<Key, Resource<?>> implements MemoryCache {
  ...
  @Override
  protected int getSize(@Nullable Resource<?> item) {
    if (item == null) {
      return super.getSize(null);
    } else {
      return item.getSize();
    }
  }

  @SuppressLint("InlinedApi")
  @Override
  public void trimMemory(int level) {
    if (level >= android.content.ComponentCallbacks2.TRIM_MEMORY_BACKGROUND) {
      // Entering list of cached background apps
      // Evict our entire bitmap cache
      clearMemory();
    } else if (level >= android.content.ComponentCallbacks2.TRIM_MEMORY_UI_HIDDEN
        || level == android.content.ComponentCallbacks2.TRIM_MEMORY_RUNNING_CRITICAL) {
      // The app's UI is no longer visible, or app is in the foreground but system is running
      // critically low on memory
      // Evict oldest half of our bitmap cache
      trimToSize(getMaxSize() / 2);
    }
  }
}
```

`LruCache`的实现主要靠`LinkedHashMap`的一个构造参数：`accessOrder`。  
当该参数为true时，每次调用`LinkedHashMap`的`get(key)`或`getOrDefault(key, defaultValue)`方法都会触发`afterNodeAccess(Object)`方法，此方法会将对应的node移动到链表的末尾。也就是说`LinkedHashMap`末尾的数据是最近“最多”使用的。  
而`LruCache`清除内存时都会调用`trimToSize(size)`方法时，会从头到尾进行清理，这样LRU的特点就体现出来了。  

相关代码如下：

**LruCache.java**  

```java
public class LruCache<T, Y> {
  private final Map<T, Y> cache = new LinkedHashMap<>(100, 0.75f, true);
  ...
  public void clearMemory() {
    trimToSize(0);
  }

  protected synchronized void trimToSize(long size) {
    Map.Entry<T, Y> last;
    Iterator<Map.Entry<T, Y>> cacheIterator;
    while (currentSize > size) {
      // 👏👏👏 果然是从头到尾进行遍历的
      cacheIterator  = cache.entrySet().iterator();
      last = cacheIterator.next();
      final Y toRemove = last.getValue();
      currentSize -= getSize(toRemove);
      final T key = last.getKey();
      cacheIterator.remove();
      onItemEvicted(key, toRemove);
    }
  }

  private void evict() {
    trimToSize(maxSize);
  }
}

```

**LinkedHashMap.java**

```java
public class LinkedHashMap<K,V>
    extends HashMap<K,V>
    implements Map<K,V>
{
    public LinkedHashMap(int initialCapacity,
                         float loadFactor,
                         boolean accessOrder) {
        super(initialCapacity, loadFactor);
        this.accessOrder = accessOrder;
    }

    public V get(Object key) {
        Node<K,V> e;
        if ((e = getNode(hash(key), key)) == null)
            return null;
        if (accessOrder)
            afterNodeAccess(e);
        return e.value;
    }

    /**
     * {@inheritDoc}
     */
    public V getOrDefault(Object key, V defaultValue) {
       Node<K,V> e;
       if ((e = getNode(hash(key), key)) == null)
           return defaultValue;
       if (accessOrder)
           afterNodeAccess(e);
       return e.value;
    }

    void afterNodeAccess(Node<K,V> e) { // move node to last
        LinkedHashMapEntry<K,V> last;
        if (accessOrder && (last = tail) != e) {
            LinkedHashMapEntry<K,V> p =
                (LinkedHashMapEntry<K,V>)e, b = p.before, a = p.after;
            p.after = null;
            if (b == null)
                head = a;
            else
                b.after = a;
            if (a != null)
                a.before = b;
            else
                last = b;
            if (last == null)
                head = p;
            else {
                p.before = last;
                last.after = p;
            }
            tail = p;
            ++modCount;
        }
    }
}
```

## 2. diskCacheFactory介绍

diskCacheFactory顾名思义就是创建DiskCache的Factory，该接口的定义如下：

**DiskCache.java**

```java
public interface DiskCache {

  interface Factory {
    /** 250 MB of cache. */
    int DEFAULT_DISK_CACHE_SIZE = 250 * 1024 * 1024;
    String DEFAULT_DISK_CACHE_DIR = "image_manager_disk_cache";

    DiskCache build();
  }

  interface Writer {
    boolean write(@NonNull File file);
  }

  File get(Key key);

  void put(Key key, Writer writer);

  void delete(Key key);

  void clear();
}
```

可以看出`DiskCache.Factory`的`build()`方法会创建出一个我们需要的`DiskCache`。  
所以，我们跟着Glide默认实现的`InternalCacheDiskCacheFactory`类看一下创建出了什么样的`DiskCache`：

**InternalCacheDiskCacheFactory.java**

```java
public final class InternalCacheDiskCacheFactory extends DiskLruCacheFactory {

  public InternalCacheDiskCacheFactory(Context context) {
    this(context, DiskCache.Factory.DEFAULT_DISK_CACHE_DIR,
        DiskCache.Factory.DEFAULT_DISK_CACHE_SIZE);
  }

  public InternalCacheDiskCacheFactory(Context context, long diskCacheSize) {
    this(context, DiskCache.Factory.DEFAULT_DISK_CACHE_DIR, diskCacheSize);
  }

  public InternalCacheDiskCacheFactory(final Context context, final String diskCacheName,
                                       long diskCacheSize) {
    super(new CacheDirectoryGetter() {
      @Override
      public File getCacheDirectory() {
        File cacheDirectory = context.getCacheDir();
        if (cacheDirectory == null) {
          return null;
        }
        if (diskCacheName != null) {
          return new File(cacheDirectory, diskCacheName);
        }
        return cacheDirectory;
      }
    }, diskCacheSize);
  }
}
```

显然，根据上面接口中的定义以及此处第三个构造器中的代码可以看出，默认会创建一个位于250M大小的路径为`/data/data/{package}/cache/image_manager_disk_cache/`的缓存目录。

下面接着`InternalCacheDiskCacheFactory`的父类`DiskLruCacheFactory`的相关代码：

**DiskLruCacheFactory.java**

```java
public class DiskLruCacheFactory implements DiskCache.Factory {
  private final long diskCacheSize;
  private final CacheDirectoryGetter cacheDirectoryGetter;

  /**
   * Interface called out of UI thread to get the cache folder.
   */
  public interface CacheDirectoryGetter {
    File getCacheDirectory();
  }
  ...
  public DiskLruCacheFactory(CacheDirectoryGetter cacheDirectoryGetter, long diskCacheSize) {
    this.diskCacheSize = diskCacheSize;
    this.cacheDirectoryGetter = cacheDirectoryGetter;
  }

  @Override
  public DiskCache build() {
    File cacheDir = cacheDirectoryGetter.getCacheDirectory();

    if (cacheDir == null) {
      return null;
    }

    if (!cacheDir.mkdirs() && (!cacheDir.exists() || !cacheDir.isDirectory())) {
      return null;
    }

    return DiskLruCacheWrapper.create(cacheDir, diskCacheSize);
  }
}
```

`DiskLruCacheFactory.build()`方法会返回一个`DiskLruCacheWrapper`类的实例，从命名来看磁盘缓存也确实是LRU算法的。我们眼见为实：

**DiskLruCacheWrapper.java**

```java
public class DiskLruCacheWrapper implements DiskCache {
  private static final String TAG = "DiskLruCacheWrapper";

  private static final int APP_VERSION = 1;
  private static final int VALUE_COUNT = 1;
  private static DiskLruCacheWrapper wrapper;

  private final SafeKeyGenerator safeKeyGenerator;
  private final File directory;
  private final long maxSize;
  private final DiskCacheWriteLocker writeLocker = new DiskCacheWriteLocker();
  private DiskLruCache diskLruCache;

  @SuppressWarnings("deprecation")
  public static DiskCache create(File directory, long maxSize) {
    return new DiskLruCacheWrapper(directory, maxSize);
  }

  @Deprecated
  @SuppressWarnings({"WeakerAccess", "DeprecatedIsStillUsed"})
  protected DiskLruCacheWrapper(File directory, long maxSize) {
    this.directory = directory;
    this.maxSize = maxSize;
    this.safeKeyGenerator = new SafeKeyGenerator();
  }

  private synchronized DiskLruCache getDiskCache() throws IOException {
    if (diskLruCache == null) {
      diskLruCache = DiskLruCache.open(directory, APP_VERSION, VALUE_COUNT, maxSize);
    }
    return diskLruCache;
  }

  @Override
  public File get(Key key) {
    String safeKey = safeKeyGenerator.getSafeKey(key);
    File result = null;
    try {
      final DiskLruCache.Value value = getDiskCache().get(safeKey);
      if (value != null) {
        result = value.getFile(0);
      }
    } catch (IOException e) {
      ...
    }
    return result;
  }
  ...
}
```

里面果然wrap了一个`DiskLruCache`，该类主要是为`DiskLruCache`提供了一个根据`Key`生成key的`SafeKeyGenerator`以及写锁`DiskCacheWriteLocker`。  

**注意**：Glide中使用的LruCache与[Bitmap的缓存与加载](/android/Bitmap%E7%9A%84%E7%BC%93%E5%AD%98%E4%B8%8E%E5%8A%A0%E8%BD%BD/#21-lrucache)一文中提到的不一样；Glide使用的DiskLruCache虽然与文章中提到的DiskLruCache有一定的渊源，但不等同。
{: .notice--warning }

OK，现在DiskCache的实现都准备好了，现在看看会在哪里调用factory的`build()`方法了。  
在本文的开头，我们看到了`diskCacheFactory`只会传入`Engine`中。在`Engine`的构造方法中会被包装成为一个`LazyDiskCacheProvider`，在被需要的时候调用`getDiskCache()`方法，这样就会调用factory的`build()`方法返回一个`DiskCache`了。

**Engine.LazyDiskCacheProvider**

```java
private static class LazyDiskCacheProvider implements DecodeJob.DiskCacheProvider {

  private final DiskCache.Factory factory;
  private volatile DiskCache diskCache;

  LazyDiskCacheProvider(DiskCache.Factory factory) {
    this.factory = factory;
  }
  ...
  @Override
  public DiskCache getDiskCache() {
    if (diskCache == null) {
      synchronized (this) {
        if (diskCache == null) {
          diskCache = factory.build();
        }
        if (diskCache == null) {
          diskCache = new DiskCacheAdapter();
        }
      }
    }
    return diskCache;
  }
}
```

而`LazyDiskCacheProvider`又会在`Engine`后面的初始化流程中传入`DecodeJobFactory`。在`DecodeJobFactory`创建`DecodeJob`时会传进去。  
`DecodeJob`自身会保存起来，在资源加载完毕并展示后，会进行缓存的存放。同时，`DecodeJob`也会在`DecodeHelper`初始化时，设置进去，供`ResourceCacheGenerator`、`DataCacheGenerator`读取缓存，供`SourceGenerator`写入缓存。

## 3. ActiveResources

在正式开始讨论缓存流程时，还是要先介绍一下`ActiveResources`的一些源码。  
`ActiveResources`在`Engine`的构造器中被创建。`ActiveResources`构建完成后，会启动一个后台优先级级别的线程，在该线程中会执行`cleanReferenceQueue()`方法，在方法中会一直循环清除ReferenceQueue中的已经被GC的Resource。

**ActiveResources.java**  

```java
final class ActiveResources {
  private final boolean isActiveResourceRetentionAllowed;
  private final Executor monitorClearedResourcesExecutor;
  @VisibleForTesting
  final Map<Key, ResourceWeakReference> activeEngineResources = new HashMap<>();
  private final ReferenceQueue<EngineResource<?>> resourceReferenceQueue = new ReferenceQueue<>();

  private volatile boolean isShutdown;

  ActiveResources(boolean isActiveResourceRetentionAllowed) {
    this(
        isActiveResourceRetentionAllowed,
        java.util.concurrent.Executors.newSingleThreadExecutor(
            new ThreadFactory() {
              @Override
              public Thread newThread(@NonNull final Runnable r) {
                return new Thread(
                    new Runnable() {
                      @Override
                      public void run() {
                        Process.setThreadPriority(Process.THREAD_PRIORITY_BACKGROUND);
                        r.run();
                      }
                    },
                    "glide-active-resources");
              }
            }));
  }

  @VisibleForTesting
  ActiveResources(
      boolean isActiveResourceRetentionAllowed, Executor monitorClearedResourcesExecutor) {
    this.isActiveResourceRetentionAllowed = isActiveResourceRetentionAllowed;
    this.monitorClearedResourcesExecutor = monitorClearedResourcesExecutor;

    monitorClearedResourcesExecutor.execute(
        new Runnable() {
          @Override
          public void run() {
            cleanReferenceQueue();
          }
        });
  }

  @SuppressWarnings("WeakerAccess")
  @Synthetic void cleanReferenceQueue() {
    while (!isShutdown) {
      try {
        ResourceWeakReference ref = (ResourceWeakReference) resourceReferenceQueue.remove();
        cleanupActiveReference(ref);

        // This section for testing only.
        DequeuedResourceCallback current = cb;
        if (current != null) {
          current.onResourceDequeued();
        }
        // End for testing only.
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
      }
    }
  }
}
```

`cleanupActiveReference`方法马上会说。现在先来看看`ActiveResources`的保存、删除的方法，这两个方法分别是`activate`、`deactivate`。可以看到，这两个方法实现都很简单。`activate`方法会将参数封装成为一个`ResourceWeakReference`，然后放入map中，如果对应的key之前有值，那么调用之前值的`reset`方法进行清除。`deactivate`方法先在map中移除，然后调用resource的`reset`方法进行清除。

```java
synchronized void activate(Key key, EngineResource<?> resource) {
  ResourceWeakReference toPut =
      new ResourceWeakReference(
          key, resource, resourceReferenceQueue, isActiveResourceRetentionAllowed);

  ResourceWeakReference removed = activeEngineResources.put(key, toPut);
  if (removed != null) {
    removed.reset();
  }
}

synchronized void deactivate(Key key) {
  ResourceWeakReference removed = activeEngineResources.remove(key);
  if (removed != null) {
    removed.reset();
  }
}
```

`ResourceWeakReference`继承至`WeakReference`，只是保存了Resource的一些属性，此外添加了一个`reset`方法用来清理资源：

```java
@VisibleForTesting
static final class ResourceWeakReference extends WeakReference<EngineResource<?>> {
  @SuppressWarnings("WeakerAccess") @Synthetic final Key key;
  @SuppressWarnings("WeakerAccess") @Synthetic final boolean isCacheable;

  @Nullable @SuppressWarnings("WeakerAccess") @Synthetic Resource<?> resource;

  @Synthetic
  @SuppressWarnings("WeakerAccess")
  ResourceWeakReference(
      @NonNull Key key,
      @NonNull EngineResource<?> referent,
      @NonNull ReferenceQueue<? super EngineResource<?>> queue,
      boolean isActiveResourceRetentionAllowed) {
    super(referent, queue);
    this.key = Preconditions.checkNotNull(key);
    this.resource =
        referent.isCacheable() && isActiveResourceRetentionAllowed
            ? Preconditions.checkNotNull(referent.getResource()) : null;
    isCacheable = referent.isCacheable();
  }

  void reset() {
    resource = null;
    clear();
  }
}
```

值得注意的是，这里的构造方法中调用了`super(referent, queue)`。这样如果referent被GC了，就会被放入queue中。而`ActiveResources.cleanReferenceQueue()`方法会一直尝试从queue中获取被GC的resource，然后调用其`cleanupActiveReference`方法。  
此方法在Resource被GC后会调用，同时在`ActiveResources.get(key)`方法中也会调用：

```java
@Synthetic
void cleanupActiveReference(@NonNull ResourceWeakReference ref) {
  // Fixes a deadlock where we normally acquire the Engine lock and then the ActiveResources lock
  // but reverse that order in this one particular test. This is definitely a bit of a hack...
  synchronized (listener) {
    synchronized (this) {
      activeEngineResources.remove(ref.key);
      // 如果是GC后调用，此时ref.resource肯定为null
      if (!ref.isCacheable || ref.resource == null) {
        return;
      }
      // 走到这，表示是在get方法中被调用，此时会恢复原来的resource
      EngineResource<?> newResource =
          new EngineResource<>(ref.resource, /*isCacheable=*/ true, /*isRecyclable=*/ false);
      newResource.setResourceListener(ref.key, listener);
      // 回调Engine的onResourceReleased方法
      // 这会导致此资源从active变成memory cache状态
      listener.onResourceReleased(ref.key, newResource);
    }
  }
}
```

## 4. 缓存加载、存放过程
