---
title: "剖析hprof文件的两种主要裁剪流派"  
tags:
  - hprof
  - KOOM
  - Matrix
  - Shark
  - Probe
---

## 1. 前言

HPROF文件在解决Java内存泄露以及OOM问题上提供了非常大的帮助，但是HPROF文件是非常大的，基本与堆内存占用呈一次线性关系。  

所以HPROF文件在上传到服务器时，一般需要经过裁剪、压缩等工作。比如一个 100MB 的文件裁剪后一般只剩下 30MB 左右，使用 7zip 压缩最后小于 10MB，增加了文件上传的成功率[^1]。

裁剪分为两大流派：  

1. dump之后，对文件进行读取并裁剪的流派：比如Shark、微信的Matrix等
2. dump时直接对数据进行实时裁剪，需要hook数据的写入过程：比如美团的Probe、快手的KOOM等

下面是原始的HPROF经过各种裁剪方案，最后压缩后的文件大小。

|       | 原始大小 | 裁剪后 | zip后 | 备注 |
| ----- | ------- | ----- | ---- | ---- |
| Shark | 154MB | 154MB | 6M | |
| Matrix | 154MB | 26M | 7M | |
| KOOM | 154MB | 17M | 3M | 裁剪后的文件需要还原 |

可以看到，HPROF文件的裁剪、压缩过程在上报之前还是非常有必要的。

## 2. HPROF文件格式

Android中的HPROF文件基于Java，但是比Java多了一些TAG，内容相较而言更加丰富。

HPROF文件总体由header和若干个record组成，每个record第一个字节TAG表示了该record的类型。

record 我们主要了解一下这些类型：

- **STRING(0x01)**  
  字符串池，每一条记录包含字符串ID以及字符串文本
- **LOAD CLASS(0x02)**  
  已经加载过的类，每条记录包含类的序号id（从1开始自增）、类对象的ID、堆栈序号、类名的string ID
- **HEAP DUMP(0x0c) & HEAP DUMP SEGMENT(0x1c)**  
  两者都是堆信息，格式也都相同，处理时一般一并处理了。里面含有多个子TAG，每个子TAG第一个字节表示其类型

HEAP DUMP、HEAP DUMP SEGMENT里面包含了多个子TAG，这里举出我们需要关心的一些子TAG：

- **CLASS DUMP(0x20)**  
  表示了该class里面的字段、superclass等信息  
- **INSTANCE DUMP(0x21)**  
  表示了该类的实例信息，这块信息里面记录了实例以及引用信息，是我们 **一定要保留的内容**
- **OBJECT ARRAY DUMP(0x22)**  
  顾名思义，就是对象数组的信息
- **PRIMITIVE ARRAY DUMP(0x23)**  
  基本类型数组信息，这是我们需要 **裁剪掉的的内容**。这部分内容占比非常大，且对于我们分析内存泄露引用链没有作用，但是对于分析OOM还有有帮助的。
- **HEAP DUMP INFO(0xfe)**  
  Android特有的TAG，表明了这块内存空间是位于App、Image还是Zygote Space。在KOOM中，会根据的Space的类型，进行INSTANCE DUMP、OBJECT ARRAY DUMP的裁剪，所以KOOM的裁剪率更高。

jdk hprof文件格式可以参考：[Binary Dump Format (format=b)](https://hg.openjdk.java.net/jdk8/jdk8/jdk/raw-file/tip/src/share/demo/jvmti/hprof/manual.html#mozTocId848088)  

Android hprof文件格式没有找到直观的，只能从源码中进行推断：  

- [TAG定义](https://cs.android.com/android/platform/superproject/+/master:art/runtime/hprof/hprof.cc;l=86;drc=cd0c21a6cbe3785385bd04fab39cf11139bca5ef)  
- [hprof生成过程](https://cs.android.com/android/platform/superproject/+/master:art/runtime/hprof/hprof.cc;l=507;drc=cd0c21a6cbe3785385bd04fab39cf11139bca5ef)

header格式如下，共31byte：

| | 格式 版本号 | 0x00 | identifier大小 | timestamp |
| - | --------- | - | - | - |
| 占byte数 | 18 byte | 1 byte | 4 byte | 8 byte |
| 16进制示例 | 4A 41 56 41 20 50 52 4F 46 49 4C 45 20 31 2E 30 2E 33 | 00 | 00 00 00 04 | 00 00 01 81 A3 25 DD 52 |
| 含义 | JAVA PROFILE 1.0.3 |  | 4 | 1656299576658 |

每条record可以分为公共的部分以及body，公共的部分为9byte：

| | TAG | 相较于header里面时间戳的时间 | body长度{n} | body |
| - | --------- | - | - | - |
| 占byte数 | 1 byte | 4 byte | 4 byte | n byte |
| 16进制示例 | 01 | 00 00 00 00 | 00 00 00 10 | 00 40 05 9D 24 24 64 65 6C 65 67 61 74 65 5F 30 |
| 含义 | TAG值为1 | time为0 | body有16字节 | 表示ID为0x0040059d，文本为$$delegate_0的字符串 |

在上面record的例子中，由于TAG为01，所以body的解析按照STRING来。  
STRING由4byte的ID以及后面的字符串组成，ID的byte数由header中的identifier大小决定，所以取4个byte为0x0040059d。剩下的16-4=12个byte（24 24 64 65 6C 65 67 61 74 65 5F 30）解码成UTF8即为$$delegate_0。

其他类型的Record，我们按照固有格式，也能对应解析出来。  

下面以Matrix和快手KOOM方案为例，来了解一下具体的两种裁剪方案，看看两者的异同。

## 3. Matrix裁剪方案

Matrix裁剪方案代表的是典型的先dump后裁剪的流派，该流派中规中矩，没有native hook这种黑科技，兼容性较好。但是DUMP过程可能会比较久，会对用户体验影响比较大，而且也容易引发二次崩溃。

该方案源码可见[HprofBufferShrinker.java](https://github.com/Tencent/matrix/blob/master/matrix/matrix-android/matrix-resource-canary/matrix-resource-canary-android/src/main/java/com/tencent/matrix/resource/hproflib/HprofBufferShrinker.java)

Matrix裁剪时，首先利用HprofReader来解析hprof文件，然后分别调用HprofInfoCollectVisitor、HprofKeptBufferCollectVisitor、HprofBufferShrinkVisitor这三个Visitor来完成hprof的裁剪流程，最后通过HprofWriter重写hprof。这是一个典型的访问者模式[^2]了：

```java
is = new FileInputStream(hprofIn);
os = new BufferedOutputStream(new FileOutputStream(hprofOut));
final HprofReader reader = new HprofReader(new BufferedInputStream(is));
reader.accept(new HprofInfoCollectVisitor());
// Reset.
is.getChannel().position(0);
reader.accept(new HprofKeptBufferCollectVisitor());
// Reset.
is.getChannel().position(0);
reader.accept(new HprofBufferShrinkVisitor(new HprofWriter(os)));
```

### 3.1 HprofInfoCollectVisitor

首先看看HprofInfoCollectVisitor。顾名思义，该类主要起收集信息的作用：

- 访问到header时：记录identifier的byte数  
  ```java
  @Override
  public void visitHeader(String text, int idSize, long timestamp) {
      mIdSize = idSize;
      mNullBufferId = ID.createNullID(idSize);
  }
  ```
- 访问String时：保存Bitmap类及其mBuffer、mRecycled字段的字符串id，保存String类及其value字段的字符串id  
  ```java
  @Override
  public void visitStringRecord(ID id, String text, int timestamp, long length) {
      if (mBitmapClassNameStringId == null && "android.graphics.Bitmap".equals(text)) {
          mBitmapClassNameStringId = id;
      } else if (mMBufferFieldNameStringId == null && "mBuffer".equals(text)) {
          mMBufferFieldNameStringId = id;
      } else if (mMRecycledFieldNameStringId == null && "mRecycled".equals(text)) {
          mMRecycledFieldNameStringId = id;
      } else if (mStringClassNameStringId == null && "java.lang.String".equals(text)) {
          mStringClassNameStringId = id;
      } else if (mValueFieldNameStringId == null && "value".equals(text)) {
          mValueFieldNameStringId = id;
      }
  }
  ```
- 访问LOAD CLASS时，根据字符串id匹配并保存Bitmap类、String类的id
  ```java
  @Override
  public void visitLoadClassRecord(int serialNumber, ID classObjectId, int stackTraceSerial, ID classNameStringId, int timestamp, long length) {
      if (mBmpClassId == null && mBitmapClassNameStringId != null && mBitmapClassNameStringId.equals(classNameStringId)) {
          mBmpClassId = classObjectId;
      } else if (mStringClassId == null && mStringClassNameStringId != null && mStringClassNameStringId.equals(classNameStringId)) {
          mStringClassId = classObjectId;
      }
  }
  ```
- 访问HEAP DUMP、HEAP DUMP SEGMENT的CLASS DUMP时：根据两个类的id进行匹配，保存Bitmap、String类里面的instance fields（可以理解为字段）
  ```java
  @Override
  public HprofHeapDumpVisitor visitHeapDumpRecord(int tag, int timestamp, long length) {
      return new HprofHeapDumpVisitor(null) {
          @Override
          public void visitHeapDumpClass(ID id, int stackSerialNumber, ID superClassId, ID classLoaderId, int instanceSize, Field[] staticFields, Field[] instanceFields) {
              if (mBmpClassInstanceFields == null && mBmpClassId != null && mBmpClassId.equals(id)) {
                  mBmpClassInstanceFields = instanceFields;
              } else if (mStringClassInstanceFields == null && mStringClassId != null && mStringClassId.equals(id)) {
                  mStringClassInstanceFields = instanceFields;
              }
          }
      };
  }
  ```

该类收集的信息主要是Bitmap.mBuffer和String.value，这两个字段都是基本类型数组，后面是可以剔除的。  
当然，这里注意一下Bitmap.mBuffer在Android 8.0及以后就不在Java Heap中了[^3]。

### 3.2 HprofKeptBufferCollectVisitor

HprofKeptBufferCollectVisitor保存了Bitmap的buffer id数据、String的value id数据，以及基本类型数据的id -> 值之间的映射关系：

- 访问到子TAG INSTANCE DUMP时：根据之前访问CLASS DUMP时保存的字段信息，解析出感兴趣的值。  
    - 若是Bitmap对象，且mRecycled不为true，则保存bufferId到mBmpBufferIds  
    - 若是String对象，保存valueId到mStringValueIds  
  ```java
  @Override
  public void visitHeapDumpInstance(ID id, int stackId, ID typeId, byte[] instanceData) {
      try {
          if (mBmpClassId != null && mBmpClassId.equals(typeId)) {
              ID bufferId = null;
              Boolean isRecycled = null;
              final ByteArrayInputStream bais = new ByteArrayInputStream(instanceData);
              for (Field field : mBmpClassInstanceFields) {
                  final ID fieldNameStringId = field.nameId;
                  final Type fieldType = Type.getType(field.typeId);
                  if (fieldType == null) {
                      throw new IllegalStateException("visit bmp instance failed, lost type def of typeId: " + field.typeId);
                  }
                  if (mMBufferFieldNameStringId.equals(fieldNameStringId)) {
                      bufferId = (ID) IOUtil.readValue(bais, fieldType, mIdSize);
                  } else if (mMRecycledFieldNameStringId.equals(fieldNameStringId)) {
                      isRecycled = (Boolean) IOUtil.readValue(bais, fieldType, mIdSize);
                  } else if (bufferId == null || isRecycled == null) {
                      IOUtil.skipValue(bais, fieldType, mIdSize);
                  } else {
                      break;
                  }
              }
              bais.close();
              final boolean reguardAsNotRecycledBmp = (isRecycled == null || !isRecycled);
              if (bufferId != null && reguardAsNotRecycledBmp && !bufferId.equals(mNullBufferId)) {
                  mBmpBufferIds.add(bufferId);
              }
          } else if (mStringClassId != null && mStringClassId.equals(typeId)) {
              ID strValueId = null;
              final ByteArrayInputStream bais = new ByteArrayInputStream(instanceData);
              for (Field field : mStringClassInstanceFields) {
                  final ID fieldNameStringId = field.nameId;
                  final Type fieldType = Type.getType(field.typeId);
                  if (fieldType == null) {
                      throw new IllegalStateException("visit string instance failed, lost type def of typeId: " + field.typeId);
                  }
                  if (mValueFieldNameStringId.equals(fieldNameStringId)) {
                      strValueId = (ID) IOUtil.readValue(bais, fieldType, mIdSize);
                  } else if (strValueId == null) {
                      IOUtil.skipValue(bais, fieldType, mIdSize);
                  } else {
                      break;
                  }
              }
              bais.close();
              if (strValueId != null && !strValueId.equals(mNullBufferId)) {
                  mStringValueIds.add(strValueId);
              }
          }
      } catch (Throwable thr) {
          throw new RuntimeException(thr);
      }
  }
  ```

- 访问到子TAG PRIMITIVE ARRAY DUMP时，保存数组对象id与对应的byte[] elements到mBufferIdToElementDataMap中备用
  ```java
  @Override
  public void visitHeapDumpPrimitiveArray(int tag, ID id, int stackId, int numElements, int typeId, byte[] elements) {
      mBufferIdToElementDataMap.put(id, elements);
  }
  ```

- hprof文件解析结束时，根据基本数据类型数组id在不在mBmpBufferIds中过滤mBufferIdToElementDataMap，这样留下来的都是Bitmap里面的buffer数据了。  
  然后将剩下的数据做md5，根据md5判断Bitmap像素数据是否有重复，若有重复，保存 重复id -> 重复id 和 此次id -> 重复id 这两组kv关系到mBmpBufferIdToDeduplicatedIdMap中。
  ```java
  @Override
  public void visitEnd() {
      final Set<Map.Entry<ID, byte[]>> idDataSet = mBufferIdToElementDataMap.entrySet();
      final Map<String, ID> duplicateBufferFilterMap = new HashMap<>();
      for (Map.Entry<ID, byte[]> idDataPair : idDataSet) {
          final ID bufferId = idDataPair.getKey();
          final byte[] elementData = idDataPair.getValue();
          if (!mBmpBufferIds.contains(bufferId)) {
              // Discard non-bitmap buffer.
              continue;
          }
          final String buffMd5 = DigestUtil.getMD5String(elementData);
          final ID mergedBufferId = duplicateBufferFilterMap.get(buffMd5);
          if (mergedBufferId == null) {
              duplicateBufferFilterMap.put(buffMd5, bufferId);
          } else {
              mBmpBufferIdToDeduplicatedIdMap.put(mergedBufferId, mergedBufferId);
              mBmpBufferIdToDeduplicatedIdMap.put(bufferId, mergedBufferId);
          }
      }
      // Save memory cost.
      mBufferIdToElementDataMap.clear();
  }
  ```

这一步操作的结果保存在mStringValueIds、mBmpBufferIdToDeduplicatedIdMap中。前者表示字符串value的id集合，后者用来将Bitmap的buffer进行去重处理。

### 3.3 HprofBufferShrinkVisitor

HprofBufferShrinkVisitor毫无疑问是真正进行裁剪的步骤了。  

对于需要进行裁剪的数据，可以直接return处理，这样文件重新写入的时候这部分数据就不会进行写入了，这与ASM中的操作一样，两者也都是访问者模式的设计风格。

- 在访问子TAG INSTANCE DUMP时：若是Bitmap对象，解析出bufferId后看看是不是有可以重用的数据（mBmpBufferIdToDeduplicatedIdMap），若有则替换。**所以Matrix并没有完全剔除Bitmap里面的buffer数据**。而且一般来说，裁剪时INSTANCE DUMP可以完全忽略，这里Matrix为了剔除重复的buffer数据，才处理了这部分数据。  
  ```java
  @Override
  public void visitHeapDumpInstance(ID id, int stackId, ID typeId, byte[] instanceData) {
      try {
          if (typeId.equals(mBmpClassId)) {
              ID bufferId = null;
              int bufferIdPos = 0;
              final ByteArrayInputStream bais = new ByteArrayInputStream(instanceData);
              for (Field field : mBmpClassInstanceFields) {
                  final ID fieldNameStringId = field.nameId;
                  final Type fieldType = Type.getType(field.typeId);
                  if (fieldType == null) {
                      throw new IllegalStateException("visit instance failed, lost type def of typeId: " + field.typeId);
                  }
                  if (mMBufferFieldNameStringId.equals(fieldNameStringId)) {
                      bufferId = (ID) IOUtil.readValue(bais, fieldType, mIdSize);
                      break;
                  } else {
                      bufferIdPos += IOUtil.skipValue(bais, fieldType, mIdSize);
                  }
              }
              if (bufferId != null) {
                  final ID deduplicatedId = mBmpBufferIdToDeduplicatedIdMap.get(bufferId);
                  if (deduplicatedId != null && !bufferId.equals(deduplicatedId) && !bufferId.equals(mNullBufferId)) {
                      modifyIdInBuffer(instanceData, bufferIdPos, deduplicatedId);
                  }
              }
          }
      } catch (Throwable thr) {
          throw new RuntimeException(thr);
      }
      super.visitHeapDumpInstance(id, stackId, typeId, instanceData);
  }

  private void modifyIdInBuffer(byte[] buf, int off, ID newId) {
      final ByteBuffer bBuf = ByteBuffer.wrap(buf);
      bBuf.position(off);
      bBuf.put(newId.getBytes());
  }
  ```

- 在访问到子TAG PRIMITIVE ARRAY DUMP时，只保留重复的Bitmap bufferId所对应的数据以及String的value数据。  
  ```java
  @Override
  public void visitHeapDumpPrimitiveArray(int tag, ID id, int stackId, int numElements, int typeId, byte[] elements) {
      final ID deduplicatedID = mBmpBufferIdToDeduplicatedIdMap.get(id);
      // Discard non-bitmap or duplicated bitmap buffer but keep reference key.
      // 为null的情况：不是buffer数据；或者是独一份的buffer数据
      // ID不相等的情况：buffer A与buffer B md5一致，但保留起来的是A，这里id却为B，因此B应该要被替换为A，B的数据要被删除
      if (deduplicatedID == null || !id.equals(deduplicatedID)) {
          // 该id不是String value的id，也就是说字符串的文字应该得到保留
          if (!mStringValueIds.contains(id)) {
              return;
          }
      }
      super.visitHeapDumpPrimitiveArray(tag, id, stackId, numElements, typeId, elements);
  }
  ```
???+ success "结论"
    综上来看，Matrix方案裁剪hprof文件时，裁剪的是HEAP_DUMP、HEAP_DUMP_SEGMENT里面的PRIMITIVE_ARRAY_DUMP段。该方案仅仅会保存字符串的数据以及重复的那一份Bitmap的buffer数据，其他基本类型数组会被剔除。

## 4. KOOM裁剪方案

???+ tip "美团Probe与快手KOOM"
    因为没有找到美团Probe[^4]的开源代码，所以这里探讨一下类似的快手开源的KOOM里面的hprof裁剪方案。  
    这两种方案在hprof数据裁剪时机上相识，都是hook了数据的io过程，在写入时对数据流进行裁剪，一步到位。且快手的KOOM在DUMP时采取了fork的形式，利用了Copy-On-Write(COW)机制，对主进程的影响更小。

KOOM方案仅仅针对HEAP DUMP、HEAP DUMP SEGMENT进行处理。没有Matrix那种保留Bitmap buffer以及String value的意思。

KOOM在dump时会传入文件路径，在文件open的hook回调中根据文件路径进行匹配，匹配成功之后记录下文件的fd。在内容写入时匹配fd，这样就可以精准拿到hprof写入时的内容了。  

KOOM中fork and dump以及PLT Hook的方法这里不进行述说，我们直接看对应的裁剪的代码：[/koom-java-leak/src/main/cpp/hprof_strip.cpp](https://github.com/KwaiAppTeam/KOOM/blob/master/koom-java-leak/src/main/cpp/hprof_strip.cpp#L554)

hprof文件的write过程分为多次，以record为单位，每次写入都是一个record。所以这里匹配TAG时直接取第一个byte。

```c++
ssize_t HprofStrip::HookWriteInternal(int fd, const void *buf, ssize_t count) {
  if (fd != hprof_fd_) {
    return write(fd, buf, count);
  }

  // 每次hook_write，初始化重置
  reset();

  const unsigned char tag = ((unsigned char *)buf)[0];
  // 删除掉无关record tag类型匹配，只匹配heap相关提高性能
  switch (tag) {
    case HPROF_TAG_HEAP_DUMP:
    case HPROF_TAG_HEAP_DUMP_SEGMENT: {
      // 略过Record的通用部分，直接准备解析body
      ProcessHeap(
          buf,
          HEAP_TAG_BYTE_SIZE + RECORD_TIME_BYTE_SIZE + RECORD_LENGTH_BYTE_SIZE,
          count, heap_serial_num_, 0);
      heap_serial_num_++;
    } break;
    default:
      break;
  }

  ...
}
```

这里调用了`ProcessHeap`函数进行进一步的解析，所有的解析过程都发生在这里，遇到不需要的TAG时会通过调整first_index的值略过这一部分，然后继续调用`ProcessHeap`函数解析后面的子TAG。略过的子TAG如下：

```c++
int HprofStrip::ProcessHeap(const void *buf, int first_index, int max_len,
                            int heap_serial_no, int array_serial_no) {
  if (first_index >= max_len) {
    return array_serial_no;
  }

  const unsigned char subtag = ((unsigned char *)buf)[first_index];
  switch (subtag) {
    /**
     * __ AddU1(heap_tag);
     * __ AddObjectId(obj);
     *
     */
    case HPROF_ROOT_UNKNOWN:
    case HPROF_ROOT_STICKY_CLASS:
    case HPROF_ROOT_MONITOR_USED:
    case HPROF_ROOT_INTERNED_STRING:
    case HPROF_ROOT_DEBUGGER:
    case HPROF_ROOT_VM_INTERNAL: {
      array_serial_no = ProcessHeap(
          buf, first_index + HEAP_TAG_BYTE_SIZE + OBJECT_ID_BYTE_SIZE, max_len,
          heap_serial_no, array_serial_no);
    } break;

    case HPROF_ROOT_JNI_GLOBAL: {
      /**
       *  __ AddU1(heap_tag);
       *  __ AddObjectId(obj);
       *  __ AddJniGlobalRefId(jni_obj);
       *
       */
      array_serial_no =
          ProcessHeap(buf,
                      first_index + HEAP_TAG_BYTE_SIZE + OBJECT_ID_BYTE_SIZE +
                          JNI_GLOBAL_REF_ID_BYTE_SIZE,
                      max_len, heap_serial_no, array_serial_no);
    } break;

      /**
       * __ AddU1(HPROF_CLASS_DUMP);
       * __ AddClassId(LookupClassId(klass));
       * __ AddStackTraceSerialNumber(LookupStackTraceSerialNumber(klass));
       * __ AddClassId(LookupClassId(klass->GetSuperClass().Ptr()));
       * __ AddObjectId(klass->GetClassLoader().Ptr());
       * __ AddObjectId(nullptr);    // no signer
       * __ AddObjectId(nullptr);    // no prot domain
       * __ AddObjectId(nullptr);    // reserved
       * __ AddObjectId(nullptr);    // reserved
       * __ AddU4(0); 或 __ AddU4(sizeof(mirror::String)); 或 __ AddU4(0); 或 __
       * AddU4(klass->GetObjectSize());  // instance size
       * __ AddU2(0);  // empty const pool
       * __ AddU2(dchecked_integral_cast<uint16_t>(static_fields_reported));
       * static_field_writer(class_static_field, class_static_field_name_fn);
       */
    case HPROF_CLASS_DUMP: {
      /**
       *  u2
          size of constant pool and number of records that follow:
              u2
              constant pool index
              u1
              type of entry: (See Basic Type)
              value
              value of entry (u1, u2, u4, or u8 based on type of entry)
       */
      int constant_pool_index =
          first_index + HEAP_TAG_BYTE_SIZE /*tag*/
          + CLASS_ID_BYTE_SIZE + STACK_TRACE_SERIAL_NUMBER_BYTE_SIZE +
          CLASS_ID_BYTE_SIZE /*super*/ + CLASS_LOADER_ID_BYTE_SIZE +
          OBJECT_ID_BYTE_SIZE    // Ignored: Signeres ID.
          + OBJECT_ID_BYTE_SIZE  // Ignored: Protection domain ID.
          + OBJECT_ID_BYTE_SIZE  // RESERVED.
          + OBJECT_ID_BYTE_SIZE  // RESERVED.
          + INSTANCE_SIZE_BYTE_SIZE;
      int constant_pool_size =
          GetShortFromBytes((unsigned char *)buf, constant_pool_index);
      constant_pool_index += CONSTANT_POOL_LENGTH_BYTE_SIZE;
      for (int i = 0; i < constant_pool_size; ++i) {
        unsigned char type = ((
            unsigned char *)buf)[constant_pool_index +
                                 CONSTANT_POLL_INDEX_BYTE_SIZE /*pool index*/];
        constant_pool_index += CONSTANT_POLL_INDEX_BYTE_SIZE /*poll index*/
                               + BASIC_TYPE_BYTE_SIZE /*type*/ +
                               GetByteSizeFromType(type);
      }

      /**
       * u2 Number of static fields:
           ID
           static field name string ID
           u1
           type of field: (See Basic Type)
           value
           value of entry (u1, u2, u4, or u8 based on type of field)
       */

      int static_fields_index = constant_pool_index;
      int static_fields_size =
          GetShortFromBytes((unsigned char *)buf, static_fields_index);
      static_fields_index += STATIC_FIELD_LENGTH_BYTE_SIZE;
      for (int i = 0; i < static_fields_size; ++i) {
        unsigned char type =
            ((unsigned char *)
                 buf)[static_fields_index + STRING_ID_BYTE_SIZE /*ID*/];
        static_fields_index += STRING_ID_BYTE_SIZE /*string ID*/ +
                               BASIC_TYPE_BYTE_SIZE /*type*/
                               + GetByteSizeFromType(type);
      }

      /**
       * u2
         Number of instance fields (not including super class's)
              ID
              field name string ID
              u1
              type of field: (See Basic Type)
       */
      int instance_fields_index = static_fields_index;
      int instance_fields_size =
          GetShortFromBytes((unsigned char *)buf, instance_fields_index);
      instance_fields_index += INSTANCE_FIELD_LENGTH_BYTE_SIZE;
      instance_fields_index +=
          (BASIC_TYPE_BYTE_SIZE + STRING_ID_BYTE_SIZE) * instance_fields_size;

      array_serial_no = ProcessHeap(buf, instance_fields_index, max_len,
                                    heap_serial_no, array_serial_no);
    }

    break;

    /////////////////////////////// 重要的解析过程放在后面
    ...

    case HPROF_ROOT_FINALIZING:                // Obsolete.
    case HPROF_ROOT_REFERENCE_CLEANUP:         // Obsolete.
    case HPROF_UNREACHABLE:                    // Obsolete.
    case HPROF_PRIMITIVE_ARRAY_NODATA_DUMP: {  // Obsolete.
      array_serial_no = ProcessHeap(buf, first_index + HEAP_TAG_BYTE_SIZE,
                                    max_len, heap_serial_no, array_serial_no);
    } break;

    default:
      break;
  }
  return array_serial_no;
}
```

在上面的代码中我们发现，KOOM对CLASS DUMP没有做任何操作，只是顺着格式略过了这个TAG，然后进行后面子TAG的解析了。  

下面我们看看KOOM对 INSTANCE DUMP、OBJECT ARRAY DUMP、PRIMITIVE ARRAY DUMP以及HEAP DUMP INFO的处理。

- 首先是HEAP DUMP INFO，在上述几种子TAG的DUMP过程中，如果heap类型发生变化，则会先插入这一条record。所以我们最新的这条记录就知道当前处于哪种heap中。[>>> 详见](https://cs.android.com/android/platform/superproject/+/master:art/runtime/hprof/hprof.cc;l=1139;drc=cd0c21a6cbe3785385bd04fab39cf11139bca5ef)  
  在DUMP过程中，环境切换的次数还是比较多的，也就意味着HEAP DUMP INFO这条子TAG会有多次，所以针对这部分裁剪也是比较有效的。  
  `strip_index_list_pair_`是一个一维数组，偶数位记录的是要裁剪区间的起始位置，奇数位是结束区间。`strip_bytes_sum_`记录的是裁剪数据的总byte数。所以，**KOOM裁剪掉了system(Zygote、Image)空间的整条HEAP DUMP INFO记录**  
  ```c++
  // Android.
  case HPROF_HEAP_DUMP_INFO: {
  const unsigned char heap_type =
      ((unsigned char *)buf)[first_index + HEAP_TAG_BYTE_SIZE + 3];
  is_current_system_heap_ =
      (heap_type == HPROF_HEAP_ZYGOTE || heap_type == HPROF_HEAP_IMAGE);

  if (is_current_system_heap_) {
      strip_index_list_pair_[strip_index_ * 2] = first_index;
      strip_index_list_pair_[strip_index_ * 2 + 1] =
          first_index + HEAP_TAG_BYTE_SIZE /*TAG*/
          + HEAP_TYPE_BYTE_SIZE            /*heap type*/
          + STRING_ID_BYTE_SIZE /*string id*/;
      strip_index_++;
      strip_bytes_sum_ += HEAP_TAG_BYTE_SIZE    /*TAG*/
                          + HEAP_TYPE_BYTE_SIZE /*heap type*/
                          + STRING_ID_BYTE_SIZE /*string id*/;
  }

  array_serial_no = ProcessHeap(buf,
                                  first_index + HEAP_TAG_BYTE_SIZE /*TAG*/
                                      + HEAP_TYPE_BYTE_SIZE /*heap type*/
                                      + STRING_ID_BYTE_SIZE /*string id*/,
                                  max_len, heap_serial_no, array_serial_no);
  } break;
  ```

- 然后看看INSTANCE DUMP。如果是system space，整条子TAG全部裁掉。所以，**KOOM也裁剪掉了system(Zygote、Image)空间的整条INSTANCE DUMP记录**  
  ```c++
      /**
     *__ AddU1(HPROF_INSTANCE_DUMP);
     * __ AddObjectId(obj);
     * __ AddStackTraceSerialNumber(LookupStackTraceSerialNumber(obj));
     * __ AddClassId(LookupClassId(klass));
     *
     * __ AddU4(0x77777777);//length
     *
     * ***
     */
  case HPROF_INSTANCE_DUMP: {
    int instance_dump_index =
        first_index + HEAP_TAG_BYTE_SIZE + OBJECT_ID_BYTE_SIZE +
        STACK_TRACE_SERIAL_NUMBER_BYTE_SIZE + CLASS_ID_BYTE_SIZE;
    int instance_size =
        GetIntFromBytes((unsigned char *)buf, instance_dump_index);

    // 裁剪掉system space
    if (is_current_system_heap_) {
      strip_index_list_pair_[strip_index_ * 2] = first_index;
      strip_index_list_pair_[strip_index_ * 2 + 1] =
          instance_dump_index + U4 /*占位*/ + instance_size;
      strip_index_++;

      strip_bytes_sum_ +=
          instance_dump_index + U4 /*占位*/ + instance_size - first_index;
    }

    array_serial_no =
        ProcessHeap(buf, instance_dump_index + U4 /*占位*/ + instance_size,
                    max_len, heap_serial_no, array_serial_no);
  } break;
  ```

- 其次，看看OBJECT ARRAY DUMP的情况。如果是system space，也是整条子TAG全部裁掉。所以，**KOOM也裁剪掉了system(Zygote、Image)空间的整条OBJECT ARRAY DUMP记录**  
  ```c++
    /**
     * __ AddU1(HPROF_OBJECT_ARRAY_DUMP);
     * __ AddObjectId(obj);
     * __ AddStackTraceSerialNumber(LookupStackTraceSerialNumber(obj));
     * __ AddU4(length);
     * __ AddClassId(LookupClassId(klass));
     *
     * // Dump the elements, which are always objects or null.
     * __ AddIdList(obj->AsObjectArray<mirror::Object>().Ptr());
     */
  case HPROF_OBJECT_ARRAY_DUMP: {
    int length = GetIntFromBytes((unsigned char *)buf,
                                 first_index + HEAP_TAG_BYTE_SIZE +
                                     OBJECT_ID_BYTE_SIZE +
                                     STACK_TRACE_SERIAL_NUMBER_BYTE_SIZE);

    // 裁剪掉system space
    if (is_current_system_heap_) {
      strip_index_list_pair_[strip_index_ * 2] = first_index;
      strip_index_list_pair_[strip_index_ * 2 + 1] =
          first_index + HEAP_TAG_BYTE_SIZE + OBJECT_ID_BYTE_SIZE +
          STACK_TRACE_SERIAL_NUMBER_BYTE_SIZE + U4 /*Length*/
          + CLASS_ID_BYTE_SIZE + U4 /*Id*/ * length;
      strip_index_++;

      strip_bytes_sum_ += HEAP_TAG_BYTE_SIZE + OBJECT_ID_BYTE_SIZE +
                          STACK_TRACE_SERIAL_NUMBER_BYTE_SIZE + U4 /*Length*/
                          + CLASS_ID_BYTE_SIZE + U4 /*Id*/ * length;
    }

    array_serial_no =
        ProcessHeap(buf,
                    first_index + HEAP_TAG_BYTE_SIZE + OBJECT_ID_BYTE_SIZE +
                        STACK_TRACE_SERIAL_NUMBER_BYTE_SIZE + U4 /*Length*/
                        + CLASS_ID_BYTE_SIZE + U4 /*Id*/ * length,
                    max_len, heap_serial_no, array_serial_no);
  } break;
  ```

- 最后看看PRIMITIVE ARRAY DUMP的情况，这里情况略有不同。**对于system space，仍然是裁掉整个TAG；对于app space，保留了数组的metadata（类型、长度），方便回填**
  ```c++
    /**
     *
     * __ AddU1(HPROF_PRIMITIVE_ARRAY_DUMP);
     * __ AddClassStaticsId(klass);
     * __ AddStackTraceSerialNumber(LookupStackTraceSerialNumber(klass));
     * __ AddU4(java_heap_overhead_size - 4);
     * __ AddU1(hprof_basic_byte);
     * for (size_t i = 0; i < java_heap_overhead_size - 4; ++i) {
     *      __ AddU1(0);
     * }
     *
     * // obj is a primitive array.
     * __ AddU1(HPROF_PRIMITIVE_ARRAY_DUMP);
     * __ AddObjectId(obj);
     * __ AddStackTraceSerialNumber(LookupStackTraceSerialNumber(obj));
     * __ AddU4(length);
     * __ AddU1(t);
     * // Dump the raw, packed element values.
     * if (size == 1) {
     *      __ AddU1List(reinterpret_cast<const
     * uint8_t*>(obj->GetRawData(sizeof(uint8_t), 0)), length); } else if
     * (size == 2) {
     *      __ AddU2List(reinterpret_cast<const
     * uint16_t*>(obj->GetRawData(sizeof(uint16_t), 0)), length); } else if
     * (size == 4) {
     *      __ AddU4List(reinterpret_cast<const
     * uint32_t*>(obj->GetRawData(sizeof(uint32_t), 0)), length); } else if
     * (size == 8) {
     *      __ AddU8List(reinterpret_cast<const
     * uint64_t*>(obj->GetRawData(sizeof(uint64_t), 0)), length);
     * }
     */
  case HPROF_PRIMITIVE_ARRAY_DUMP: {
    int primitive_array_dump_index = first_index + HEAP_TAG_BYTE_SIZE /*tag*/
                                     + OBJECT_ID_BYTE_SIZE +
                                     STACK_TRACE_SERIAL_NUMBER_BYTE_SIZE;
    int length =
        GetIntFromBytes((unsigned char *)buf, primitive_array_dump_index);
    primitive_array_dump_index += U4 /*Length*/;

    // 裁剪掉基本类型数组，无论是否在system space都进行裁剪
    // 区别是数组左坐标，app space时带数组元信息（类型、长度）方便回填
    if (is_current_system_heap_) {
      strip_index_list_pair_[strip_index_ * 2] = first_index;
    } else {
      strip_index_list_pair_[strip_index_ * 2] =
          primitive_array_dump_index + BASIC_TYPE_BYTE_SIZE /*value type*/;
    }
    array_serial_no++;

    int value_size = GetByteSizeFromType(
        ((unsigned char *)buf)[primitive_array_dump_index]);
    primitive_array_dump_index +=
        BASIC_TYPE_BYTE_SIZE /*value type*/ + value_size * length;

    // 数组右坐标
    strip_index_list_pair_[strip_index_ * 2 + 1] = primitive_array_dump_index;

    // app space时，不修改长度因为回填数组时会补齐
    if (is_current_system_heap_) {
      strip_bytes_sum_ += primitive_array_dump_index - first_index;
    }
    strip_index_++;

    array_serial_no = ProcessHeap(buf, primitive_array_dump_index, max_len,
                                  heap_serial_no, array_serial_no);
  } break;
  ```

???+ success "KOOM裁剪了什么"  
    裁剪时KOOM会根据堆类型进行裁剪：  

    - 针对system space（Zygote Space、Image Space）：会裁剪PRIMITIVE_ARRAY_DUMP、HEAP_DUMP_INFO、INSTANCE_DUMP和OBJECT_ARRAY_DUMP这4个子TAG，会删除这四个子TAG的全部内容（包函子TAG全都会删除）。  
    - 针对app space：会处理PRIMITIVE_ARRAY_DUMP这一块数据，但会保留metadata，方便回填。  
    
    这样裁剪率相较于Matrix方案会更高。

最后，我们看看回写的过程。首先是更新record里面的长度记录，实际上3个space都发生过裁剪行为。`strip_bytes_sum_`记录的是裁剪数据的总byte数。

```c++
// 根据裁剪掉的zygote space和image space更新length
int record_length;
if (tag == HPROF_TAG_HEAP_DUMP || tag == HPROF_TAG_HEAP_DUMP_SEGMENT) {
  record_length = GetIntFromBytes((unsigned char *)buf,
                                  HEAP_TAG_BYTE_SIZE + RECORD_TIME_BYTE_SIZE);
  record_length -= strip_bytes_sum_;
  int index = HEAP_TAG_BYTE_SIZE + RECORD_TIME_BYTE_SIZE;
  ((unsigned char *)buf)[index] =
      (unsigned char)(((unsigned int)record_length & 0xff000000u) >> 24u);
  ((unsigned char *)buf)[index + 1] =
      (unsigned char)(((unsigned int)record_length & 0x00ff0000u) >> 16u);
  ((unsigned char *)buf)[index + 2] =
      (unsigned char)(((unsigned int)record_length & 0x0000ff00u) >> 8u);
  ((unsigned char *)buf)[index + 3] =
      (unsigned char)((unsigned int)record_length & 0x000000ffu);
}
```

然后是写入body数据，这块数据根据`strip_index_list_pair_`记录可以轻松操作。正如之前说的：`strip_index_list_pair_`是一个一维数组，偶数位记录的是要裁剪区间的起始位置，奇数位是结束区间。

```c++
size_t total_write = 0;
int start_index = 0;
for (int i = 0; i < strip_index_; i++) {
  // 将裁剪掉的区间，通过写时过滤掉
  void *write_buf = (void *)((unsigned char *)buf + start_index);
  auto write_len = (size_t)(strip_index_list_pair_[i * 2] - start_index);
  if (write_len > 0) {
    total_write += FullyWrite(fd, write_buf, write_len);
  } else if (write_len < 0) {
    __android_log_print(ANDROID_LOG_ERROR, LOG_TAG,
                        "HookWrite array i:%d writeLen<0:%zu", i, write_len);
  }
  start_index = strip_index_list_pair_[i * 2 + 1];
}
auto write_len = (size_t)(count - start_index);
if (write_len > 0) {
  void *write_buf = (void *)((unsigned char *)buf + start_index);
  total_write += FullyWrite(fd, write_buf, count - start_index);
}
```

## 5. 总结

- Matrix方案裁剪的是HEAP_DUMP、HEAP_DUMP_SEGMENT里面的PRIMITIVE_ARRAY_DUMP段。该方案仅仅会保存字符串的数据以及重复的那一份Bitmap的buffer数据，其他基本类型数组会被剔除。
- 裁剪时KOOM会根据堆类型进行裁剪：  
    - 针对system space（Zygote Space、Image Space）：会裁剪PRIMITIVE_ARRAY_DUMP、HEAP_DUMP_INFO、INSTANCE_DUMP和OBJECT_ARRAY_DUMP这4个子TAG，会删除这四个子TAG的全部内容（包函子TAG全都会删除）。  
    - 针对app space：会处理PRIMITIVE_ARRAY_DUMP这一块数据，但会保留metadata，方便回填。

|  | 是否HOOK | 裁剪过程 | 裁剪率 | 是否需要回填 |
| - |  ---- | --- | -- | -- |
| Matrix | 不需要 | 先DUMP后裁剪 | 一般 | 不需要 |
| KOOM | PLT HOOK | 边DUMP边裁剪 | 更好 | 需要 |


[^1]:[Android开发高手课：04 | 内存优化（下）：内存优化这件事，应该从哪里着手？](/android/paid/master/memory_2)
[^2]:[访问者模式(Visitor)](/design-pattern/visitor/)
[^3]:[Bitmap的缓存与加载](/android/framework/Bitmap%E7%9A%84%E7%BC%93%E5%AD%98%E4%B8%8E%E5%8A%A0%E8%BD%BD/)
[^4]:[美团Probe](https://tech.meituan.com/2019/11/14/crash-oom-probe-practice.html)