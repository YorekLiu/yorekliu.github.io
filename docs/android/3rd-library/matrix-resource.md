---
title: "Matrix-ResourceCanary解析"
tags:
  - matrix
  - apm
  - hprof
---

!!! tip "Wiki"  
    [Matrix - ResourceCanary](https://github.com/Tencent/matrix/wiki/Matrix-Android-ResourceCanary)  
    [Matrix - ApkChecker](https://github.com/Tencent/matrix/wiki/Matrix-Android-ApkChecker)  

**ResourceCanary 的设计目标是准确的检测 Activity 泄露**，检测泄露需要 hprof 文件，**而该文件还可以用来进行冗余 Bitmap 的检测**。此外，考虑到有人工分析 hprof 文件的情况，需要将用户生成的 hprof 文件上传到服务端，而这个文件通常比较大，所以我们需要对 **hprof 进行裁剪。** hprof 文件的分析过程可以放到服务器端。

另外，ResourceCanary 里面还提供了一个 Activity 级别泄露解决方案 **ActivityLeakFixer** ：它可以解决 IME 泄露问题；以及在 Activity 销毁时清除所有 View 的 Drawable、Listener 等，这样泄露的就是空壳了。  
同理我们还可以自己弄一个 Fragment 级别的方案，注意一下可能会有坑。然后这个类实在是没有什么值得展开说的，下面不展开了。

除了 ResourceCanary 之外，Matrix 中还有另外一个神器 RemoveUnusedResourcesTask —— 在 build 时删除被 ApkChecker 检测出来的无用资源。我们知道assets、drawable等里面的无用资源是没有办法完全删掉，但是这个插件是可以删掉的。  

ApkChecker 与 RemoveUnusedResourcesTask，已经单独拎出来进行了说明，可以查看下面文章：

- [Matrix-ApkChecker：安装包分析检测工具](/android/3rd-library/matrix-apk-checker)
- [Matrix-ASM插桩插件解析：RemoveUnusedResourcesTask](/android/3rd-library/matrix-trace-plugin/#4-removeunusedresourcestask)

因此，本篇文章的重点就是 ResourceCanary 的本体。

## 1. ResourcesCanary

ResourcesCanary 在设计时就主要关注两个部分：  

1. 内存泄露的检测，以及 hprof 文件的裁剪与上报  
2. 服务端对 hprof 文件进行的内存泄露引用链检测，以及重复 Bitmap 数据检测  
    
### 关于内存泄露检测

与常用的 LeakCanary 组件相比，ResourcesCanary 在内存泄露检测方面做了一些优化，来减少误报的几率。

> LeakCanary:  
> 
> - VM并没有提供强制触发GC的API，通过System.gc()或Runtime.getRuntime().gc()只能“建议”系统进行GC，如果系统忽略了我们的GC请求，可回收的对象就不会被加入ReferenceQueue  
> - 将可回收对象加入ReferenceQueue需要等待一段时间，LeakCanary采用延时100ms的做法加以规避，但似乎并不绝对管用
> 
> ResourcesCanary:
> 
> - 增加一个一定能被回收的“哨兵”对象，用来确认系统确实进行了GC
> - 直接通过WeakReference.get()来判断对象是否已被回收，避免因延迟导致误判

主要意思就是说，通过在 GC 前临时创建一个哨兵对象，GC 后判断哨兵对象是否仍然存活，来确定是否已经发生了 GC 动作。

这个想法似乎很好，但是在2021年的一次更新中，去掉了这个优点：

```java
//            final WeakReference<Object[]> sentinelRef = new WeakReference<>(new Object[1024 * 1024]); // alloc big object
            triggerGc();
//            if (sentinelRef.get() != null) {
//                // System ignored our gc request, we will retry later.
//                MatrixLog.d(TAG, "system ignore our gc request, wait for next detection.");
//                return Status.RETRY;
//            }
```

原因是 minor gc 可能不会使哨兵对象回收，得 full gc 才可以。如果 minor gc 回收不了哨兵对象的话，会使后面的内存泄露检测无法进行，这就会导致漏报。漏报比误报要严重。  
关于取消哨兵机制的原因，详细可以查看[Matrix-issues#585](https://github.com/Tencent/matrix/issues/585#issuecomment-850234705)。

由于哨兵机制失效，导致 ResourcesCanary 需要以 1 min 的间隔进行轮询，如果某项泄露累计检测到了10次，则触发内存泄露。  

### 关于 hprof 裁剪

下面再说说在确定发生了内存泄露之后，需要 dump hprof 文件并进行下一步处理的流程。

ResourcesCanary 提供了多种内存泄露检测模式：

```java
public enum DumpMode {
  NO_DUMP, // report only
  AUTO_DUMP, // auto dump hprof
  MANUAL_DUMP, // notify only
  SILENCE_ANALYSE, // dump and analyse hprof when screen off
  FORK_DUMP, // fork dump hprof immediately
  FORK_ANALYSE, // fork dump and analyse hprof immediately
  LAZY_FORK_ANALYZE, // fork dump immediately but analyze hprof until the screen is off
}
```

- NO_DUMP：直接对内存泄露阶段检测到的泄露项名称进行上报，不进行引用链的分析，自然就不需要dump hprof。
- AUTO_DUMP：检测到内存泄露之后，先dump并到子进程中进行hprof文件裁剪，最后将泄露项名称、裁剪后的hprof等信息打成zip进行上报
- MANUAL_DUMP：检测到内存泄露之后，发送通知。用户点击通知之后进行dump、分析。这里dump与分析都是发生在fork出来的进程中。
- SILENCE_ANALYSE：锁屏时进行dump、分析
- FORK_DUMP：fork出子进程，在子进程中进行dump，然后进行裁剪上报。
- FORK_ANALYSE：先 fork dump，然后在fork出来的进程中进行分析。
- LAZY_FORK_ANALYZE：先 fork dump，然后在锁屏时进行分析。

ResourcesCanary 提供的内存泄露检测机制比较多，但都是几种基本功能的组合：

1. 是否需要dump hprof
    - Debug接口直接dump
    - 利用COW机制的fork dump
2. 是否需要在客户端进行hprof文件的分析：
    - 不需要客户端分析（dump后裁剪hprof文件，带文件进行上报）
    - 需要客户端分析：
        - 使用HAHA分析
        - 使用native代码分析


关于fork dump以及hprof文件裁剪，之前也出过一篇文章解释了这些流程：[剖析hprof文件的两种主要裁剪流派](/android/3rd-library/hprof-shrink/)  
关于ResourcesCanary中使用c++代码分析hprof文件的过程，只要理解了hprof文件格式，也不难理解。hprof文件格式在上面这篇文章中也有说明。

现在现在回过头来看看 ResourcesCanary ，绝大多数知识我们都比较熟悉了。唯一没有说明的点在于如何从 hprof 文件中解析出一个对象的引用链。

### 关于引用链分析

内存泄露引用链分析以及重复Bitmap检测功能都依赖于对hprof文件内容的进一步解析。

在这之前我们已经介绍过了hprof文件的裁剪功能，想必我们对hprof文件的格式有了一些了解，后面的内容就是如何从hprof的数据中找到我们想要的对象引用链数据。

我们这里假设各位读者已经知道了hprof文件的基本格式（当然，没有了解过的可以先简要看看[剖析hprof文件的两种主要裁剪流派——HPROF文件格式](/android/3rd-library/hprof-shrink/#2-hprof)，知晓一下里面数据是如何存放的）。  
我们再假设，已知了一个Activity是泄露的，想要找到这个对象的引用链。那么，可以进行如下操作：

1. 先通过 Activity 的全名在 STRING Record (也就是字符串池)中找到对应的 string id
2. 通过 string id 在 LOAD CLASS Record 中找到对应的class id。有了泄露 Activity 的 class id 之后，在堆数据区的子 tag INSTANCE DUMP 中用 activity class id 找出该Activity类的所有实例信息。  
   当然，我们可以通过判断WeakReference里面的Activity是否存在，来获取到内存泄露发生时的Activity对象。这样可以避免对全量的Activity实例做引用链分析，可以减少排查范围。
3. 我们从 GC Root 这些对象出发（这些对象会在HEAP DUMP/HEAP DUMP SEGMENT Record中，以子tag ROOT_xxx 打头），在子 tag CLASS DUMP 中遍历 GC Roots 的class id 以及所有的 static fields、instance fields。
   > static fields由field string id、type、value组成，当static fields会在类型是Object时，value直接是object id，这点比较方便。  
   > instance fields只包含field string id以及type，具体对象里面的instance fields具体值，需要从子tag INSTANCE DUMP 中进行解析。
4. 然后依据 GC Root class id，在子 tag INSTANCE DUMP 找出该 GC Root 类型的所有实例信息。  
   > 对于具体的实例来说，一条引用路径就是对象 A 里面的 static field 或者 instance field B 对应的对象引用了对象 A；对象 B 里面的 static field 或者 instance field C 引用了 B。这样引用链就形成了。
5. 对所有的 GC Root 对象，依次遍历实例所有的 static field 和 instance field，看看 field object id 是不是对应的上 activity object id。若对应的上，说明这就找到了一条引用链；若对应不上，则继续对该实例里面的field object进行一样的操作，直到找不到可以进行下一步的对象，又或者是找到了目标对象。这一步骤可以使用广度优先算法来实现。

上面的操作简要的描述了一下引用链分析的思路。

实际上在Matrix中，会判断`DestroyedActivityInfo#mActivityRef`这个弱引用的`referent`存不存在来断定该对象对应的Activity是否已经被回收。  
所以，Matrix会先找到`DestroyedActivityInfo`对应的字符串ID，通过字符串ID找到class id，通过class id找到所有的 instance，然后对instance里面的数据进行上面这个过滤。

```java
public class DestroyedActivityInfo {
    public final String mKey;
    public final String mActivityName;

    public final WeakReference<Activity> mActivityRef;
    public int mDetectedCount = 0;
    ...
}
```

Matrix中分析hprof文件的代码在[matrix/matrix-android/matrix-hprof-analyzer/lib/main/analyzer.cpp](https://github.com/Tencent/matrix/blob/master/matrix/matrix-android/matrix-hprof-analyzer/lib/main/analyzer.cpp)。

下面我们看一下matrix中的实践部分，hprof解析的代码就不贴出来了，但是代码中提及的结构里面存的数据会表明出来。

**<small>matrix-resource-canary/matrix-resource-canary-android/src/main/cpp/memory_util/memory_util.cpp</small>**

```c++
static std::optional<std::vector<LeakChain>>
execute_analyze(const char *hprof_path, const char *reference_key) {
    ...
    const int hprof_fd = open(hprof_path, O_RDONLY);
    ...
    HprofAnalyzer::SetErrorListener(analyzer_error_listener);
    HprofAnalyzer analyzer(hprof_fd);

    ...
    return analyzer.Analyze([reference_key](const HprofHeap &heap) {
        // 从hprof中获取到类com.tencent.matrix.resource.analyzer.model.DestroyedActivityInfo的class id
        // 实际上也是先从字符串池中找到字符串id，然后通过字符串id在LOAD CLASS中找到class id
        const object_id_t leak_ref_class_id = unwrap_optional(
                heap.FindClassByName(
                        "com.tencent.matrix.resource.analyzer.model.DestroyedActivityInfo"),
                return std::vector<object_id_t>());
        std::vector<object_id_t> leaks;
        // 获取到DestroyedActivityInfo类的所有实例id，来源是INSTANCE DUMP或者OBJECT ARRAY DUMP
        for (const object_id_t leak_ref: heap.GetInstances(leak_ref_class_id)) {
            // 获取到DestroyedActivityInfo#mKey的值，这是一个字符串对象，所以保存的是对象id
            // 字符串对象的value数组是一个基本类型数组，值会保存在PRIMITIVE ARRAY DUMP中
            const object_id_t key_string_id = unwrap_optional(
                    heap.GetFieldReference(leak_ref, "mKey"), continue);
            // 从INSTANCE DUMP中获取到字符串对象的数据，解析出value所对应的object id
            // 然后在PRIMITIVE ARRAY DUMP中进行解析，最后得到字符串的字面量
            const std::string &key_string = unwrap_optional(
                    heap.GetValueFromStringInstance(key_string_id), continue);
            // 如果解析出来的mKey的字面量不是发生泄露的那个Activity，则过滤掉
            if (key_string != reference_key)
                continue;
            // 获取到DestroyedActivityInfo#mActivityRef的值，这是一个弱引用
            const object_id_t weak_ref = unwrap_optional(
                    heap.GetFieldReference(leak_ref, "mActivityRef"), continue);
            // 获取到mActivityRef.referent的值，加入到leaks集合中
            const object_id_t leak = unwrap_optional(
                    heap.GetFieldReference(weak_ref, "referent"), continue);
            leaks.emplace_back(leak);
        }
        return leaks;
    });
}
```

上面这段代码的操作主要就是获取到发生泄露的Activity的object id，然后将这些object id保存到集合leaks中，最后调用`analyzer.Analyze`进行引用链的解析。

**<small>matrix-hprof-analyzer/lib/main/analyzer.cpp</small>**

```c++
std::vector<LeakChain>
HprofAnalyzerImpl::Analyze(
      const std::function<std::vector<object_id_t>(const HprofHeap &)> &leak_finder) {
  internal::heap::Heap heap;
  internal::reader::Reader reader(reinterpret_cast<const uint8_t *>(data_), data_size_);
  parser_->Parse(reader, heap, exclude_matcher_group_);
  // leak_finder(HprofHeap(new HprofHeapImpl(heap)))得到的就是leaks集合
  return Analyze(heap, leak_finder(HprofHeap(new HprofHeapImpl(heap))));
}

std::vector<LeakChain> HprofAnalyzerImpl::Analyze(const internal::heap::Heap &heap,
                                                const std::vector<object_id_t> &leaks) {
  const auto chains = ({
      const HprofHeap hprof_heap(new HprofHeapImpl(heap));
      // 解析出leaks的引用链数组
      internal::analyzer::find_leak_chains(heap, leaks);
  });
  // 将原始的引用链数组转为LeakChain对象
  std::vector<LeakChain> result;
  for (const auto&[_, chain]: chains) {
      const std::optional<LeakChain> leak_chain = BuildLeakChain(heap, chain);
      if (leak_chain.has_value()) result.emplace_back(leak_chain.value());
  }
  return std::move(result);
}
```

我们最后看看`internal::analyzer::find_leak_chains`是如何完成引用链解析的。这个过程使用了广度优先算法，从GC ROOT开始遍历所有的对象，直到找到对象。

首先造一个简单例子来指明几个字段的含义：

```java
class A {
  private B b;
}
```

这描述的就是一条引用，其中referrer是A对象，referent是B对象，reference是instance类型、名称是b。

- referent：被引用者
- referrer：引用者
- reference：引用对象，里面包含引用类型（static、instance、array element）、引用者名称的string id

**<small>matrix-hprof-analyzer/lib/analyzer/analyzer.cpp</small>**

```c++
std::map<heap::object_id_t, std::vector<std::pair<heap::object_id_t, std::optional<heap::reference_t>>>>
find_leak_chains(const heap::Heap &heap, const std::vector<heap::object_id_t> &tracked) {

  /* Use Breadth-First Search algorithm to find all the references to tracked objects. */

  std::map<heap::object_id_t, std::vector<std::pair<heap::object_id_t, std::optional<heap::reference_t>>>> ret;

  for (const auto &leak: tracked) {
      // 保存对象id->ref_node_t的映射
      std::map<heap::object_id_t, ref_node_t> traversed;
      // 双端队列，BFS算法用到的结构
      std::deque<ref_node_t> waiting;

      // 从GC Root出发，构建引用链
      for (const heap::object_id_t gc_root: heap.GetGcRoots()) {
          ref_node_t node = {
                  .referent_id = gc_root,
                  .super = std::nullopt,
                  .depth = 0
          };
          traversed[gc_root] = node;
          // 将所有的GC Roots加入到waiting中
          waiting.push_back(node);
      }

      bool found = false;
      while (!waiting.empty()) {
          // waiting的队头数据
          const ref_node_t node = waiting.front();
          waiting.pop_front();
          const heap::object_id_t referrer_id = node.referent_id;
          // 判断整个hprof中是否存在引用者为referrer_id的引用关系
          // 这些引用关系构建时依靠于CLASS DUMP里面的static field、INSTANCE DUMP里面的值以及OBJECT ARRAY DUMP里面的值
          if (heap.GetLeakReferenceGraph().count(referrer_id) == 0) continue;
          // 依次遍历这些引用关系
          for (const auto &[referent, reference]: heap.GetLeakReferenceGraph().at(referrer_id)) {
              try {
                  // 这里判断深度是为了获取最短引用路径
                  // 如果traversed.at(referent)没有取到数据，会抛出out_of_range异常
                  if (traversed.at(referent).depth <= node.depth + 1) continue;
              } catch (const std::out_of_range &) {}
              // 构建下一层的引用链，super是用来溯源用的
              ref_node_t next_node = {
                      .referent_id = referent,
                      .super = ref_super_t{
                              .referrer_id = referrer_id,
                              .reference = reference
                      },
                      .depth = node.depth + 1
              };
              traversed[referent] = next_node;
              // 如果两个对象相等，说明找到了一条引用路径，此时跳转到traverse_complete，进行溯源
              if (leak == referent) {
                  found = true;
                  goto traverse_complete;
              } else {
                  waiting.push_back(next_node);
              }
          }
      }
      traverse_complete:
      if (found) {
          ret[leak] = std::vector<std::pair<heap::object_id_t, std::optional<heap::reference_t>>>();
          std::optional<heap::object_id_t> current = leak;
          std::optional<heap::reference_t> current_reference = std::nullopt;
          // 进行溯源，完成之后ret[leak]里面保存的是从leak开始，到GC ROOT结束的引用链
          while (current != std::nullopt) {
              ret[leak].push_back(std::make_pair(current.value(), current_reference));
              const auto &super = traversed.at(current.value()).super;
              if (super.has_value()) {
                  current = super.value().referrer_id;
                  current_reference = super.value().reference;
              } else {
                  current = std::nullopt;
              }
          }
          // 对这条引用链进行翻转，使其从GC ROOT开始
          std::reverse(ret[leak].begin(), ret[leak].end());
      }
  }

  return std::move(ret);
}
```

### 重复Bitmap检测

由于我们可以从hprof文件中得到所有Bitmap的快照信息，所以我们也可以检测里面的`mBuffer`字段的值，对所有Bitmap的`mBuffer`进行计算，就可以算出有那些重复的Bitmap。

实际上SquareUp有一个[HAHA](https://github.com/square/haha)(Headless Android Heap Analyzer)库，可以帮助我们忽略解析hprof的过程。基于这个库，我们可以很方面的直接做各种二次开发。

这个代码位于[matrix-resource-canary/matrix-resource-canary-analyzer-cli/src/main/java/com/tencent/matrix/resource/analyzer/DuplicatedBitmapAnalyzer.java](https://github.com/Tencent/matrix/blob/master/matrix/matrix-android/matrix-resource-canary/matrix-resource-canary-analyzer-cli/src/main/java/com/tencent/matrix/resource/analyzer/DuplicatedBitmapAnalyzer.java)，实现原理不难，就不进行深入解读了。

但是需要注意一点，`Bitmap#mBuffer`在Android 8及以上就不存在于Java Heap中了，所以这个方案有API限制。