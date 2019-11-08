---
title: "面试总结"
excerpt: "面试总结"
toc: true
toc_label: "目录"
---

## 牛咖(Uki)

kotlin 

**1、object单例是怎么实现的**  
```kotlin
object Singleton {
    fun getString(): String {
        return "aaaa"
    }
}
```

反编译之后的Java代码：

```java
import kotlin.Metadata;
import org.jetbrains.annotations.NotNull;

@Metadata(
   mv = {1, 1, 15},
   bv = {1, 0, 3},
   k = 1,
   d1 = {"\u0000\u0012\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0002\b\u0002\n\u0002\u0010\u000e\n\u0000\bÆ\u0002\u0018\u00002\u00020\u0001B\u0007\b\u0002¢\u0006\u0002\u0010\u0002J\u0006\u0010\u0003\u001a\u00020\u0004¨\u0006\u0005"},
      d2 = {"LSingleton;", "", "()V", "getString", "", "real-interview-test"}
)
public final class Singleton {
   public static final Singleton INSTANCE;

   @NotNull
   public final String getString() {
      return "aaaa";
   }

   private Singleton() {
   }

   static {
      Singleton var0 = new Singleton();
      INSTANCE = var0;
   }
}
```

在static代码块中执行了单例的初始化，是一个饥汉单例模式

**2、kotlin反射用过吗**  
可以调用Java里面的反射，此时基本和Java没有什么区别，除了获取对象的class需要使用.javaClass

下面是反射修改属性的Java/Kotlin代码片段：
```java
public static void disableShiftMode(BottomNavigationView view) {
    try {
        Field mMenuViewField = view.getClass().getDeclaredField("mMenuView");
        mMenuViewField.setAccessible(true);
        BottomNavigationMenuView menuView = (BottomNavigationMenuView) mMenuViewField.get(view);
        mMenuViewField.setAccessible(false);
            
        Field shiftingMode = menuView.getClass().getDeclaredField("mShiftingMode");
        shiftingMode.setAccessible(true);
        shiftingMode.setBoolean(menuView, false);
        shiftingMode.setAccessible(false);
        ...
    } catch (NoSuchFieldException e) {
        Log.e("BNVHelper", "Unable to get shift mode field", e);
    } catch (IllegalAccessException e) {
        Log.e("BNVHelper", "Unable to change value of shift mode", e);
    }
}
```
```kotlin
fun disableShiftMode(view: BottomNavigationView) {
    try {
        val mMenuViewField = view.javaClass.getDeclaredField("mMenuView")
        mMenuViewField.isAccessible = true
        val mMenuView = mMenuViewField.get(view) as BottomNavigationMenuView
        mMenuViewField.isAccessible = false

        val mShiftingModeField = mMenuView.javaClass.getDeclaredField("mShiftingMode")
        mShiftingModeField.isAccessible = true
        mShiftingModeField.setBoolean(mMenuView, false)
        mShiftingModeField.isAccessible = false
        ...
    } catch (ex: NoSuchFieldException) {
        Log.e("BNVKHelper", "Unable to get shift mode field", ex)
    } catch (ex: IllegalAccessException) {
        Log.e("BNVKHelper", "Unable to change value of shift mode", ex)
    }
}
```

注意`getField`与`getDeclaredField`的区别。

**3、kotlin中空安全的理解；定义一个变量不可空，反射调用置为空会报错吗？置为空后，再调用是否会报错？变量定义为可空时呢？**  
- 变量定义为可空，没什么好说的，不会报错。
- 变量定义为不可空，反射置为空不会报错，调用会报错

```kotlin
class Nullable {
    private val text: String? = null

    fun getTextLength() = text?.length
}

class NonNull {
    private val text: String = "123"

    fun getTextLength() = text.length
}

fun main() {
    val nullable = Nullable()
    println(nullable.getTextLength())
    setField(nullable, "text", "0123456789")
    println(nullable.getTextLength())
    setField(nullable, "text", null)
    println(nullable.getTextLength())

    val nonNull = NonNull()
    println(nullable.getTextLength())
    setField(nonNull, "text", "0123456789")
    println(nonNull.getTextLength())
    setField(nonNull, "text", null)
    println(nonNull.getTextLength())
}

fun setField(target: Any, field: String, value: Any?) {
    val field = target.javaClass.getDeclaredField(field)
    field.isAccessible = true
    field.set(target, value)
    field.isAccessible = false
}
```

输出

```
null
10
null
null
10
Exception in thread "main" java.lang.NullPointerException
	at NonNull.getTextLength(Nullable.kt:12)
	at NullableKt.main(Nullable.kt:28)
	at NullableKt.main(Nullable.kt)

Process finished with exit code 1
```

**4、接口的定义与Java有什么不同？完全兼容吗？**  
完全兼容，有什么问题？

**5、扩展函数怎么写？是怎么实现的？**  
```kotlin
@file:JvmName(name = "StringEx")

fun String.appendWorld(): String {
    val text = "${this} world"
    println(text)
    return text
}
```
```java
public final class StringEx {
   @NotNull
   public static final String appendWorld(@NotNull String $this$appendWorld) {
      Intrinsics.checkParameterIsNotNull($this$appendWorld, "$this$appendWorld");
      String text = $this$appendWorld + " world";
      boolean var2 = false;
      System.out.println(text);
      return text;
   }
}
```

**6、kotlin怎么比较两个变量的值是否相等？==在java与kotlin中的区别？kotlin怎么判断地址是否相等？**  

== 判断两个值是否相等  
=== 判断地址是否相等

| Expression | Translated to |
| ---------- | ------------- |
| a == b | a?.equals(b) ?: (b === null) |
| a != b | !(a?.equals(b) ?: (b === null)) |

**7、?.运算是怎么实现的**  
三目运算符
```kotlin
fun getTextLength() = text?.length
```
```java
@org.jetbrains.annotations.Nullable
public final Integer getTextLength() {
   String var10000 = this.text;
   return var10000 != null ? var10000.length() : null;
}
```

**8、val和var是怎么实现的**  
val翻译成final修饰的  
var没有特别的修饰

java

**1、内存模型**  
  深入理解Java虚拟机前三章  
**2、String常量池，Integer缓存、自动拆箱装箱有关**  
```java
String a = "123";
String b = new String("123");
String c = "123";
String d = new String(b);
String e = String.valueOf(123);
String g = new String("123");
String h = String.valueOf("123");

System.out.println("String >>>>>>>>>>>>>>>>>> ");
System.out.println(a == b);  // false
System.out.println(a == c);  // true
System.out.println(a == d);  // false
System.out.println(b == d);  // false
System.out.println(a == e);  // false
System.out.println(b == e);  // false
System.out.println(b == g);  // false
System.out.println(a == h);  // true
System.out.println();

Integer a1 = 1;
Integer b1 = new Integer(1);
int c1 = 1;
Integer d1 = new Integer(c1);
Integer e1 = Integer.valueOf(1);
Integer f1 = 1;
Integer g1 = new Integer(1);

System.out.println("Integer 1 >>>>>>>>>>>>>>>>>> ");
System.out.println(a1 == b1);  // false
System.out.println(a1 == c1);  // true
System.out.println(a1 == d1);  // false
System.out.println(b1 == d1);  // false
System.out.println(a1 == e1);  // true
System.out.println(b1 == e1);  // false
System.out.println(a1 == f1);  // true
System.out.println(b1 == g1);  // false
System.out.println();

Integer a2 = 200;
Integer b2 = new Integer(200);
int c2 = 200;
Integer d2 = new Integer(c2);
Integer e2 = Integer.valueOf(200);
Integer f2 = 200;
Integer g2 = new Integer(200);

System.out.println("Integer 2 >>>>>>>>>>>>>>>>>> ");
System.out.println(a2 == b2);  // false
System.out.println(a2 == c2);  // true
System.out.println(a2 == d2);  // false
System.out.println(b2 == d2);  // false
System.out.println(a2 == e2);  // false
System.out.println(b2 == e2);  // false
System.out.println(a2 == f2);  // false
System.out.println(c2 == d2);  // true
System.out.println(b2 == g2);  // false
System.out.println();
```

android  

**1、内存泄露**  
**2、Handler导致的内存泄露原理以及解决办法？非得要普通的内部类的情况下，可以不泄露吗？**  
**3、Activity与Service的区别**
**4、Service的启动能在任何时候吗？Activity关闭5s后能启动吗？**  
Activity关闭5s后可以启动

|       | startActivity | startService | bindService | sendBroadcast | registerReceiver |
|       | ------------- | ------------ | ----------- | ------------- | ---------------- |
| Application | - | √ | √ | √ | √ |
| Activity | √ | √ | √ | √ | √ |
| Service | - | √ | √ | √ | √ |
| BroadcastReceiver | - | √ | x | √ | - |
| ContentProvider | - | √ | √ | √ | √ |

上表中"√"表示是允许的，"x"表示不允许，而"-"则是有条件的。

- 对于Activity的启动而言，非Activity的Context启动时必须带上`INTENT_NEW_TASK`的flag。  
- 对于在BroadcastReceiver，在启动其他组件时
   1. 不允许`bindService`，原因是因为此时的context实际上是`ReceiverRestrictedContext`对象，see [ActivityThread.java#3041](http://androidxref.com/7.1.2_r36/xref/frameworks/base/core/java/android/app/ActivityThread.java#3041)  
   2. 注册广播接收器，只能注册null，用于获取粘性广播。否则是不允许的
   ```java
   class ReceiverRestrictedContext extends ContextWrapper {
       ReceiverRestrictedContext(Context base) {
           super(base);
       }
   
       @Override
       public Intent registerReceiver(BroadcastReceiver receiver, IntentFilter filter) {
           return registerReceiver(receiver, filter, null, null);
       }
   
       @Override
       public Intent registerReceiver(BroadcastReceiver receiver, IntentFilter filter,
               String broadcastPermission, Handler scheduler) {
           if (receiver == null) {
               // Allow retrieving current sticky broadcast; this is safe since we
               // aren't actually registering a receiver.
               return super.registerReceiver(null, filter, broadcastPermission, scheduler);
           } else {
               throw new ReceiverCallNotAllowedException(
                       "BroadcastReceiver components are not allowed to register to receive intents");
           }
       }

       @Override
       public Intent registerReceiverAsUser(BroadcastReceiver receiver, UserHandle user,
               IntentFilter filter, String broadcastPermission, Handler scheduler) {
           if (receiver == null) {
               // Allow retrieving current sticky broadcast; this is safe since we
               // aren't actually registering a receiver.
               return super.registerReceiverAsUser(null, user, filter, broadcastPermission, scheduler);
           } else {
               throw new ReceiverCallNotAllowedException(
                       "BroadcastReceiver components are not allowed to register to receive intents");
           }
       }

       @Override
       public boolean bindService(Intent service, ServiceConnection conn, int flags) {
           throw new ReceiverCallNotAllowedException(
                   "BroadcastReceiver components are not allowed to bind to services");
       }
   }
   ```

**4、Service能执行耗时操作吗？IntentService三个事务依次到达，怎么执行？Service会多次创建吗？**  
**5、事件分发的场景**  
  在一个FrameLayout中，有一个大的TextView和一个小一点的Button
  - **TextView盖到Button上面**，点击Button位置区域，Button能响应吗？  
  - 怎么样才能让Button不响应点击事件？  
  - Button不设置点击事件，此时还能响应吗？  
  - **Button盖到TextView上面**，点击Button区域，Button能够响应。此时，有办法让TextView变个色吗？  

  点击Button后，ScrollView还能滑动吗？为什么？
  - 可以。点击Button后，手指滑动一定的距离时（一个TouchSlop），ScrollView会在onInterceptTouchEvent方法中返回true，这样ScrollView自己就会处理后续的事件了。

**6、绘制View时onDraw空实现，能绘制出来吗？如何变个色？**  
  可以绘制背景、前景，自身的content不能绘制  
  变色直接设置background即可

**7、invadilate会全部刷新吗？**  
  不会全部刷新，invalidate只会刷新自己，调用自己的onDraw方法  
  requestLayout方法也只会刷新自己，调用自己的onMeasure、onLayout方法
  
**8、事件的最顶端来自哪里？**  
  Activity接收事件源自于Window，所以向上肯定是WindowManagerService

**9、invadilate中View的最顶端**   
**10、Activity PhoneWindow DecorView三者关系**  
**11、为什么叫做setContentView**  
**12、Activity A启动B、B关闭回到A时 A、B的生命周期**  
**13、Activity四种启动模式，启动一系列Activity，分析一下栈里面的情况**  
**14、自己实现一个微信的侧滑返回 怎么实现**  
**15、RxJava常用操作符，flatMap map区别**  

git 

1、git push -f之后可以找回被覆盖的提交吗 如何找回

算法

1、判断一个数组是不是回文数  
2、判断一个数学表达式是否合法  
3、判断一个json字符串是否合法  

## xmly

一面：Android  

1. 自我介绍（每一面打头的问题）
2. 自定义View需要实现哪几个方法？如果在一个match_parent的FrameLayout中放一个自定义View，那么onMeasure方法中measureSpec是什么值？
3. 下面这个图，底部导航栏中间的按钮是怎么实现的（突出、且会旋转）？  
   面试官：了解Drawable的子类吗，旋转通过RotateDrawable实现。  
   我：Drawable我一般通过xml来写，实际上View动画中rotate动画就会被解析成为[RotateDrawable](http://androidxref.com/7.1.2_r36/xref/frameworks/base/graphics/java/android/graphics/drawable/DrawableInflater.java#136)
   <figure style="width: 50%" class="align-center">
     <img src="/assets/images/other/other1.jpeg">
   </figure>  

4. 事件分发：在一个FrameLayout中有一个普通的View，点击普通View，FrameLayout会收到DOWN之后的事件吗？假如给View设置了OnTouchListener，OnTouchListener优先级会比View的onTouchEvent方法高吗？
5. 随口一问：msg.target是什么东西？异步任务执行完毕后如何回到主线程更新UI？  
   Handler，实际上RxJava切换到Android主线程也是通过主线程的Handler来实现的  
6. 四大组件：Activity被系统杀死，如何保存、恢复数据（onSaveInstanceState onRestoreInstanceState）？onRestoreInstanceState在什么时候调用？onSaveInstanceState在什么场景下会被调用？A启动B之后，A会调用吗？  
  一个播放音频的Service，如何设计才能在锁屏后还能继续播放？我提到了前台Service（喜马拉雅打开App就会有一个前台Service），这是仅次于前台进程的优先级，一般情况下都是OK的，如果还是被杀了，那真的没有任何办法了。  
7. 如果内存资源不足了，应用能知道吗？  
  我提到，registerComponentCallbacks，然后说了一下Glide也会监听这个，LruCache会在收到onTrimMemory的时候释放缓存；随便说了一下LruCache的实现原理——LinkedHashMap
8. 四种引用？而且面试官提到，SoftReference会在内存不足的时候自动释放，所以上面一问也可以这样。
9. AIDL：AIDL是如何实现跨进程通信的？  
   “基于Binder”  
   Binder又是如何实现跨进程通信的？我们知道跨进程不能传输任何对象，那么BpBinder是如何传到Client的？
10. 线程池的原理
11. 三方库：  
   Retrofit的原理：顺便说了一下注解以及注解处理器annotationProcessor/kapt  
   OkHttp中Interceptor与NetworkInterceptor的区别  
   RxJava背压  
12. 性能优化，这个问的太广了，也比较欠缺，简历上不该写这个：  
  性能优化的工具？  
  遇到过性能优化的场景？
  具体的性能优化方法（我提到了几个经常说的，比如布局优化：扁平化布局、include、merge、ViewStub，渲染优化等，他打断了我，问我有没有观测过具体优化了多少，有没有一个量化的指标。其实这些优化作用都很小。然后就过了此题）
13. Jetpack用了多少？ViewModel起了一个什么作用，扮演一个什么角色？
14. 最后随便让我选一个擅长的三方库或者领域，讲讲。  
   “Glide吧”  
   “我知道你很熟，换一个”  
   “EventBus吧”  
   然后我讲了几句，就说行了行了。最后让我说一下EventBus的缺点，他说缺点就是调试性差，遇到问题没法打印堆栈等等
15. 最后问了下Shell排序
16. 你有什么想问的

二面：产品技术线Leader  

主要就是聊了一下职业生涯、为什么离职等等乱七八糟的，技术题就两道：

1. LeetCode-31-Next Permutation [https://leetcode.com/problems/next-permutation/](https://leetcode.com/problems/next-permutation/)
2. 手写二分查找

三面：Android职能线Leader，对着我的简历一行一行往下问

1. 先看了一下好人好信，体验了一下，提出了一个ViewPager+RecyclerView中手势误触的问题：左右滑稍微不水平，就会拉出SwipeRefreshLayout，问我如何优化
2. 还是好人好信的Tab3，那个Coordi
3. Object中 == 与 equals方法的区别  
4. hashCode与equals方法的联系
5. Java中集合类有哪几类？  
   Set、List、Map。  
   Set、List有公共的基类吗？  
   Set、List有什么区别（考定义）？  
   List和Map常用的类？  
   HashTable和ConcurrentHashMap的区别在哪？
6. 跨进程的几种方式？为什么AIDL是最常用的？  
7. 线程池有哪几种常用的？它们的区别是什么？线程池的原理是什么？线程池的执行机制（核心线程——队列——非核心线程这种）？核心线程会超时吗？非核心线程会超时吗？
8. wait与sleep的区别？它们都会消耗CPU资源吗？
9. EventBus有什么缺点？我答了一面面试官告诉我的，不好调试巴拉巴拉。面试官：怎么解决？我。。。。反问面试官，不用EventBus的话，有什么高级的技术吗？面试官：回调不行吗？我：行，从工程的角度来讲，确实是非常好的选择。面试官：对啊，你设计的时候就得考虑这种问题。
10. 还是问了一下性能优化，我还是和一面一样说了，在说到Bitmap时，还向他科普了一下Glide的生命周期控制。这条技能挺薄弱的，不该写
11. 注解分为哪些（应该是问的元注解）？我说到了@Retention的三种SOURCE、CLASS、RUNTIME以及对应的处理方式。  
  那么CLASS注解一般和什么一起联用？Java字节码插桩技术：AspectJ、ASM、ReDex等
12. 知道哪些热修复？Tinker热修复的原理？热修复如何修复资源文件？插件化的原理？插件化如何处理资源文件id冲突的问题？
13. 你认为Kotlin好在哪里？
14. Flutter好在哪里？