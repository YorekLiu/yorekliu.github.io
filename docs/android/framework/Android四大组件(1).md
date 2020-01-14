---
title: "Activity"
---

Android四大组件分别是Activity、Service、ContentProvider以及BroadcastReceiver。其中，Activity是使用最频繁的一个组件，可以翻译为界面。当然，我们常见的界面除了Activity，还有Window(这里指悬浮窗，类似于360的悬浮球)、Dialog以及Toast。Android中所有的视图都是通过Window来呈现的。

此外，Fragment也是常用的一个容器，关于Fragment，可以查看[Android四大组件(4)](/android/framework/Android%E5%9B%9B%E5%A4%A7%E7%BB%84%E4%BB%B6(4)/)，两者一起看能更好的了解彼此。

本章的主要内容有：Activity生命周期、启动模式、IntentFilter匹配规则。

英语好的同学可以阅读[google官方文档](https://developer.android.com/reference/android/app/Activity.html)，讲的更细。

## 1 Activity的生命周期

Activity的生命周期分为两个部分：正常情况、异常情况。
所谓正常情况就是指在用户的参与下经历的生命周期的改变；而异常情况是指Activity因RAM不足被LMK杀死或者由于的Configuration(比如横竖屏切换、语言改变等)改变导致Activity销毁重构。

### 1.1 正常情况下Activity的生命周期

如图，是正常情况下Activity所经历的生命周期。  

![activity_lifecycle](/assets/images/android/activity_lifecycle.png)

各个生命周期方法解释如下：

1. `onCreate`：当Activity第一次创建的时候调用。在这里，我们做一些初始化工作：加载布局、初始化Activity所需要的数据等。
2. `onRestart`：Activity重新启动。当Activity从不可见重新变成可见状态时，此方法会被调用。
3. `onStart`：表示Activity正在启动，当Activity正在变成可见状态时会被调用。
4. `onResume`：表示Activity已经可见了，且出现在前台可与用户进行交互。
5. `onPause`：Activity正在停止。此时可以提交未保存的数据、停止动画或其他可能消耗CPU资源的操作。在此方法中不能执行耗时操作，因为下一个Activity不会调用onResume直到该方法执行完。
6. `onStop`：Activity即将停止，当Activity不在可见时调用，因为另一个Activity已经调用了onResume，并且覆盖了这个Activity。
7. `onDestroy`：Activity即将被销毁。

在Activity的生命周期中有三个关键的循环：

- **完整生命周期**：`onCreate` ~ `onDestory`  
  我们可以在onCreate中初始化所有数据，在onDestroy中释放。比如后台下载数据的线程。
- **可见生命周期**：`onStart` ~ `onStop`  
  在此期间，用户可以看到Activity在屏幕上，但是并不在前台，因此也不能与用户进行交互。在着两个方法里可以维护需要展示给用户的资源。比如在onStart里面注册BroadcastReceiver，在onStop里面unregister。onStart、onStop会根据Activity对用户的显示、隐藏可以调用多次。
- **前台生命周期**：`onResume` ~ `onPause`  
  在此期间，Activity在所有其他activity的上面，可以与用户进行交互。
  一个activity可以频繁的经历resumed和paused状态，比如设备休眠，activity的结果返回了，接收到了新的intent等等。因此，在这两个方法里面的代码应该要非常轻量。

**如果Activity A启动B，那么A和B的生命周期的生命周期调用顺序怎么样呢？**
```java
A: onPause() called
B: onCreate() called with: savedInstanceState = [null]
B: onStart() called
B: onResume() called
A: onStop() called
```
很显然，Android系统只允许一个Activity出现在前台，因此会先执行A的onPause方法使A退出前台，然后在执行B启动过程使其出现在前台，最后在调用A的onStop方法。

### 1.2 异常情况下Activity的生命周期

#### 1.2.1 资源发生了改变

在默认情况下，系统配置改变将会导致当前的activity被销毁，该activity会经历正常的生命周期方法，`onPause`、`onStop`、`onDestroy`会被调用。如果此activity在前台或者用户可见，此activity会在onDestroy调用后被重新创建。

由于activity是异常终止的，所以系统会调用`onSaveInstanceState(Bundle)`保存当前activity的状态，当activity被重新创建后，会调用`onRestoreInstanceState`；此外重新创建时Bundle也会传入`onCreate`方法中。

!!! info
    `onSaveInstanceState`将会调用在`onStop`之前，与`onPause`没有固定的时序关系。  
    `onRestoreInstanceState`在`onStart`与`onPostCreate`之间被调用。`onPostCreate`在`onResume`之前调用。

另外，在资源改变导致重新创建时，系统自动为我们做了一些恢复工作。具体某个特定的View能够为我们恢复哪些数据，可以查看View的这两个方法。

**上面我们提到，在默认情况下，系统配置改变将会导致当前的activity被销毁重建，那怎么阻止该过程的发生呢？**

我们可以通过配置activity的configChanges属性达到目的。比如我们不想屏幕旋转时重新创建，可以在activity添加`android:configChanges="orientation"`，如果我们想指定多个值，可以通过或操作"\|"连接起来，比如"mcc\|mnc"  

[点击查看activity的所有配置以及解释](https://developer.android.com/guide/topics/manifest/activity-element)

> **横竖屏切换生命周期？**
>
> 网上流传的横屏切换回竖屏生命周期执行两次，我看到了就觉得比较可疑。然后自己试验了下，也找了资料。现在完全不是这么回事了。
>
> 1. 只设置`configChanges="orientation"`和不设置这个属性，Activity都会销毁重建  
> 2. 设置`configChanges="orientation|keyboardHidden"`，Android 2.3版本不会重建，超过该版本会重建  
> 3. 设置`configChanges="orientation|screenSize"`时，在Android 4.0以上不会重建  

下面是不设置时的，横屏切换回竖屏、竖屏切换回横屏时的生命周期执行顺序：

`onPause`/`onSaveInstanceState` -> `onStop` -> `onDestory` -> `onCreate` -> `onStart` -> `onRestoreInstanceState` -> `onResume`

注意这里`onSaveInstanceState`将会调用在`onStop`之前，与`onPause`没有固定的时序关系。

#### 1.2.2 内存不足导致低优先级的activity被杀死

这种情况下activity的数据存储、恢复的过程和1完全一样。当系统资源不足时，系统会按照activity的优先级顺序来杀死目标Activity所在的进程。Activity的优先级从高到低，可以分来三种：

1. 前台Activity —— 正在和用户进行交互，处于running状态
2. 可见但非前台 —— 比如Activity弹出了一个对话框
3. 后台Activity —— 已经执行了onStop
4. 未持有Activity和其他组件(Service和BroadcastReceiver)的 **空进程**

> 因此，后台工作不适合脱离四大组件而独自运行，这样容易被杀死。比较好的方式是将后台任务放入Service中，这样能保证进程有一定的优先级。

!!! tip
    **进程优先级** 可以查看[进程保活中关于进程优先级的译文](/android/paid/zsxq/week16-keep-app-alive/#11)。

## 2 Activity的启动模式

本节的主要内容有：Activity的LaunchMode以及Flags

!!! info
    参考资料：[Understand Tasks and Back Stack](https://developer.android.com/guide/components/activities/tasks-and-back-stack)

**注意：** 有些启动模式只能在manifest文件中进行描述，没有对应的flags；同样，有些启动模式也只能在flags中进行描述，manifest文件中不能。

任务栈分为前台任务栈和后台任务栈，后台任务栈中的activity处于暂停状态，用户可以通过操作将后台任务栈再次调回前台。  
可以使用`adb shell dumpsys activity`查看任务栈信息，信息在`Running activities (most recent first)`这一栏中。

### 2.1 LaunchMode

manifest文件有四种启动模式：standard、singleTop、singleTask、singleInstance

- `standard`  
  默认的启动模式。每次启动activity都会创建一个新的实例，不管该实例是否已经存在。被启动的activity会运行在启动该activity的任务栈中。一个任务栈可以有多个activity实例。  
  > 所以使用非Activity类型的Context启动一个standard Activity就会报错，解决该问题的办法是为待启动的Activity指定`FLAG_ACTIVITY_NEW_TASK`，这样启动的时候就会为它准备一个新的任务栈，这样待启动Activity实际上是以`singleTask`模式启动的。
- `singleTop`  
  栈顶复用模式。如果Activity已经位于任务栈的栈顶，那么Activity不会重新创建，同时其`onNewIntent`方法会被回调。
- `singleTask`  
  栈内复用模式。这是一种单实例模式，只要Activity在一个栈中存在，多起启动该Activity都不会重新创建实例，和`singleTop`一样，系统会回调其`onNewIntent`方法。同时，位于该Activity上面的Activity都会被出栈，所以该启动模式具有`FLAG_ACTIVITY_CLEAR_TOP`效果。
- `singleInstance`  
  单实例模式。加强版的`singleTask`，它具有`singleTask`的一些特点，此外，还强调了一点：具有该模式的Activity会单独的位于一个任务栈中。该任务栈名称和包名一样，也就是可以有多个任务栈的taskAffinity是相同的。

无论Activity是在新Task中启动，还是在启动它的Activity所在的Task中启动，“返回”按钮始终会将用户带到上一个Activity。但是，如果启动launchMode指定为`singleTask`的Activity，则如果在后台Task中存在该Activity的实例，则将整个Task带到前台。此时，回退栈的顶部会包含被带入前台的Task中的所有活动。下图说明了这种情况。

![回退栈与singleTask](/assets/images/android/diagram_backstack_singletask_multiactivity.png)

### 2.2 Activity的Flags

Activity中有些Flags可以影响Activity的启动模式，有些则可以影响Activity的运行状态。`launchMode`指定的属性可以被flags覆盖。

下面主要说说常见的几个标记位：

- `FLAG_ACTIVITY_NEW_TASK`  
   为Activity指定"singleTask"启动模式
- `FLAG_ACTIVITY_SINGLE_TOP`  
   为Activity指定"singleTop"启动模式
- `FLAG_ACTIVITY_CLEAR_TOP`  
   启动此Activity时，同一任务栈中所有位于它上面的Activity都会出栈。此Activity会调用`onNewIntent`还是重新创建与其自身启动模式有关。如果此Activity启动模式是standard，则会finish然后re-created；如果是其他的启动模式，则会调用当前实例的`onNewIntent`方法。  
   与`FLAG_ACTIVITY_NEW_TASK`连用会使目标Activity出现在栈顶，这在有些时候是非常好用的，比如从通知栏运行Activity。
- `FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS`  
   包含有此标记的Activity不会出现在历史Activity中，也可以使用`android:excludeFromRecents="true"`属性

> Activity的启动方式有两种：  
> - 通过指定activity节点的`launchMode`属性  
> - 通过startActivity中Intent的`addFlags`方法添加标志位  
> 
> 两种方式的区别：  
> 1. 后者优先级会高于前者，即两种方式同时存在时，以后者为准  
> 2. 两种方式可使用范围不同，比如前者无法给Activity设置`FLAG_ACTIVITY_CLEAR_TOP`标识，后者无法为Activity指定`singleInstance`模式。

### 2.3 其他管理Task的方式

#### 2.3.1 taskAffinity

在activity中有一个属性可以标记该activity运行在哪个任务栈中，这个属性就是`android:taskAffinity`。`android:taskAffinity`必须为字符串，且中间必须含有包名分隔符`"."`。默认情况下，activity运行在应用包名的任务栈中，所以`android:taskAffinity`的值要与包名不同。

该属性主要用在下面两个方面：

- 当启动Activity的Intent包含`FLAG_ACTIVITY_NEW_TASK`时  
  默认情况下，新Activity将启动到启动它的Activity的任务栈中。但是，如果传递给`startActivity()`的intent包含`FLAG_ACTIVITY_NEW_TASK`标志，系统会查找另一个任务栈以容纳新Activity。一般情况下，这是一项新的任务栈。但是，它不一定是。如果已经存在与新Activity具有相同affinity的任务栈，则会将Activity启动到该任务栈中。如果没有，系统会创建新的任务栈。  
- 当Activity的`allowTaskReparenting`设置为`true`时  
  `allowTaskReparenting`属性的意思是，当下次进入前台时，是否允许此Activity从启动它的task移动到与affinity一样的task。  
  假设有两个应用A和B，应用A中的ActivityA启动了应用B中带有`allowTaskReparenting`属性的ActivityP，然后按HOME键回到桌面，进入B应用，会发现出现的是ActivityP，而不是应用B的主ActivityB。

#### 2.3.2 清除回退栈

如果用户长时间离开Task，系统将清除任务栈中除根Activity之外的所有Activity。当用户再次返回任务栈时，仅恢复根Activity。系统会以这种方式运行，是因为在很长一段时间之后，用户可能已经放弃了之前正在做的事情，并且返回任务栈以开始新的操作。

有如下的方式可以更改该操作：

`alwaysRetainTaskState`  
在一个任务栈的根Activity上将该属性设置为`true`，上面描述的行为就不会发生了。任务栈中所有的Activity都会保留，即使过了很长时间。

`clearTaskOnLaunch`  
在一个任务栈的根Activity上将该属性设置为`true`，只要用户重新回到任务栈，任务栈会清除到只有根Activity。换句话说，它与`alwaysRetainTaskState`相反。即使在离开任务栈片刻之后，用户也始终会返回到初始状态的任务栈。

`finishOnTaskLaunch`  
该属性与`clearTaskOnLaunch`类似，不同点在于该属性作用于单独的Activity上，而不是整个任务栈。它还能使包括根Activity在内的任何Activity消失。当该属性设置为`true`，Activity仍然是当前任务栈的一部分，如果用户离开然后返回任务栈，则它不再存在了。

## 3 IntentFilter的匹配规则

!!! success
    关于[PendingIntent](/android/framework/RemoteViews/#13-pendingintent)在RemoteViews的文章中有介绍。

intent-filter在AndroidManifest.xml中的写法

```xml
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <action android:name="android.intent.action.EDIT" />
    <action android:name="android.intent.action.PICK" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="vnd.android.cursor.dir/vnd.google.note" />
</intent-filter>
```

IntentFilter用在Activity的隐式调用上。IntentFilter中的过滤信息主要有action、category以及data。
只有一个Intent完全匹配上了action、category、data，才算匹配成功。一个Activity可以有多个intent-filter，只要一个Intent匹配成功了任何一组intent-filter就算成功匹配。

IntentFilter的匹配规则代码如下：

```java
// frameworks/base/core/java/android/content/IntentFilter.java
public final int match(String action, String type, String scheme,
            Uri data, Set<String> categories, String logTag) {
        if (action != null && !matchAction(action)) {
            return NO_MATCH_ACTION;
        }

        int dataMatch = matchData(type, scheme, data);
        if (dataMatch < 0) {
            return dataMatch;
        }

        String categoryMismatch = matchCategories(categories);
        if (categoryMismatch != null) {
            return NO_MATCH_CATEGORY;
        }
        return dataMatch;
    }
```

> 总结一下总的匹配规则：
> 
> 1. action的匹配规则要求Intent中的action必须存在且必须和过滤规则中某个action相同
> 2. category的匹配规则要求Intent中如果含有category，那么Intent中所有的category都必须和过滤规则中的某个category相同。
> 3. data的匹配规则要求Intent中必须含有data数据，并且data数据能够完全匹配过滤规则中的某个data。

### 3.1 action的匹配规则

action的匹配规则是指Intent中的action必须和intent-filter中的action匹配。一个过滤规则中可以有多个action，只要Intent中的action能够和intent-filter中任何一个action相同即可匹配成功。因此，Intent中如果没有指定action，那么匹配失败。

**action的匹配规则要求Intent中的action必须存在且必须和过滤规则中某个action相同**

```java
    private final ArrayList<String> mActions;

    public final boolean matchAction(String action) {
        return hasAction(action);
    }

    public final boolean hasAction(String action) {
        return action != null && mActions.contains(action);
    }
```

### 3.2 category的匹配规则

**category的匹配规则要求Intent中如果含有category，那么Intent中所有的category都必须和过滤规则中的某个category相同。**

如果没有添加category，系统在startActivity或者startActivityForResult时会默认加上"android.intent.category.DEFAULT"这个category，所以为了我们的Activity可以接受隐式调用，需要在intent-filter中指定"android.intent.category.DEFAULT"这个category。

```java
    private ArrayList<String> mCategories = null;

    public final String matchCategories(Set<String> categories) {
        if (categories == null) {
            return null;
        }

        Iterator<String> it = categories.iterator();

        if (mCategories == null) {
            return it.hasNext() ? it.next() : null;
        }

        while (it.hasNext()) {
            final String category = it.next();
            if (!mCategories.contains(category)) {
                return category;
            }
        }

        return null;
    }
```

### 3.3 [data的匹配规则](https://developer.android.com/guide/topics/manifest/data-element.html)

```xml
<data android:scheme="string"
      android:host="string"
      android:port="string"
      android:path="string"
      android:pathPattern="string"
      android:pathPrefix="string"
      android:mimeType="string" />
```

data结构有点复杂。先说一下data的结构：data由mimeType和URI两部分组成。
mimeType指媒体类型，比如image/jpeg、image/png、audio/mpeg4-generic和video/*等。mimeType在Android framework的匹配是大小写敏感的，所以mimeType应该要使用小写字母。
而URI包含的数据由很多部分组成:
`<scheme>://<host>:<port>[<path>|<pathPrefix>|<pathPattern>]`

- scheme：URI的模式，比如http、file、content等。缺少该部分，整个URI无效。
- host：URI的主机名。缺少该部分，整个URI无效。
- port：端口号，仅当URI中指定了scheme和host时，port才是有意义的。
- path、pathPrefix、pathPattern：路径信息，必须以"/"开头。path表示完整信息；pathPattern也表示完成信息，但是它可以包含通配符"*"，"*"表示0或多个前一个字符，".*"表示匹配0或者多个任意字符。注意，由于正则表达式的规范，"*"要被转义成"\*"；pathPrefix表示路径的前缀信息。

过滤规则中如果没有写URI，则有一个默认值：content:和file:。即Intent中的URI的scheme部分必须是content或者file才能匹配。
此外，如果Intent要指定完整的data，必须使用`setDataAndType`方法，而不能调用`setData`和`setType`，着两个方法会清除对方的值。
在同一个<intent-filter>节点下所有的<data>标签都作用与同一个filter，因此下面两种写法是等价的：

```xml
<intent-filter . . . >
    <data android:scheme="something" android:host="project.example.com" />
    . . .
</intent-filter>

<intent-filter . . . >
    <data android:scheme="something" />
    <data android:host="project.example.com" />
    . . .
</intent-filter>
```
data的匹配规则和action类似，**它要求Intent中必须含有data数据，并且data数据能够完全匹配过滤规则中的某个data。**
```java
    public final int matchData(String type, String scheme, Uri data) {
        final ArrayList<String> types = mDataTypes;
        final ArrayList<String> schemes = mDataSchemes;

        int match = MATCH_CATEGORY_EMPTY;

        if (types == null && schemes == null) {
            return ((type == null && data == null)
                ? (MATCH_CATEGORY_EMPTY+MATCH_ADJUSTMENT_NORMAL) : NO_MATCH_DATA);
        }

        if (schemes != null) {
            if (schemes.contains(scheme != null ? scheme : "")) {
                match = MATCH_CATEGORY_SCHEME;
            } else {
                return NO_MATCH_DATA;
            }

            final ArrayList<PatternMatcher> schemeSpecificParts = mDataSchemeSpecificParts;
            if (schemeSpecificParts != null && data != null) {
                match = hasDataSchemeSpecificPart(data.getSchemeSpecificPart())
                        ? MATCH_CATEGORY_SCHEME_SPECIFIC_PART : NO_MATCH_DATA;
            }
            if (match != MATCH_CATEGORY_SCHEME_SPECIFIC_PART) {
                // If there isn't any matching ssp, we need to match an authority.
                final ArrayList<AuthorityEntry> authorities = mDataAuthorities;
                if (authorities != null) {
                    int authMatch = matchDataAuthority(data);
                    if (authMatch >= 0) {
                        final ArrayList<PatternMatcher> paths = mDataPaths;
                        if (paths == null) {
                            match = authMatch;
                        } else if (hasDataPath(data.getPath())) {
                            match = MATCH_CATEGORY_PATH;
                        } else {
                            return NO_MATCH_DATA;
                        }
                    } else {
                        return NO_MATCH_DATA;
                    }
                }
            }
            // If neither an ssp nor an authority matched, we're done.
            if (match == NO_MATCH_DATA) {
                return NO_MATCH_DATA;
            }
        } else {
            // Special case: match either an Intent with no data URI,
            // or with a scheme: URI.  This is to give a convenience for
            // the common case where you want to deal with data in a
            // content provider, which is done by type, and we don't want
            // to force everyone to say they handle content: or file: URIs.
            if (scheme != null && !"".equals(scheme)
                    && !"content".equals(scheme)
                    && !"file".equals(scheme)) {
                return NO_MATCH_DATA;
            }
        }

        if (types != null) {
            if (findMimeType(type)) {
                match = MATCH_CATEGORY_TYPE;
            } else {
                return NO_MATCH_TYPE;
            }
        } else {
            // If no MIME types are specified, then we will only match against
            // an Intent that does not have a MIME type.
            if (type != null) {
                return NO_MATCH_TYPE;
            }
        }

        return match + MATCH_ADJUSTMENT_NORMAL;
    }
```

最后，通过隐式启动Activity时，如果没有Activity能够匹配我们的隐式Intent，我们startActivity就会报错。
我们有两种方法解决：  
1. 可以使用PackageManager或者Intent的`resolveActivity`方法，如果没有匹配的Activity则会返回null。（Intent的该方法是基于PackageManager的同名方法的。）  
2. 可以使用PackageManager的`queryIntentActivities`方法，该方法会返回所有成功匹配的Activity信息，而不是resolveActivity的最佳匹配。
  注意下PackageManager的第二个参数，这里要传入MATCH_DEFAULT_ONLY这个参数，这个参数的意义在于匹配声明了"android.intent.category.DEFAULT"的Activity，不然匹配上的Activity不一定可以成功启动。

```java
    // PackageManager
    public abstract ResolveInfo resolveActivity(Intent intent,
            @ResolveInfoFlags int flags);
    public abstract List<ResolveInfo> queryIntentActivities(Intent intent,
            @ResolveInfoFlags int flags);

    // Intent
    public ComponentName resolveActivity(PackageManager pm) {
        if (mComponent != null) {
            return mComponent;
        }

        ResolveInfo info = pm.resolveActivity(
            this, PackageManager.MATCH_DEFAULT_ONLY);
        if (info != null) {
            return new ComponentName(
                    info.activityInfo.applicationInfo.packageName,
                    info.activityInfo.name);
        }

        return null;
    }
```
