---
title: "年轻人的第一个Flutter程序(3)"
---

本系列文章也会阶段性地release对应的apk供对照查看。apk都会发布在[release](https://github.com/YorekLiu/YLFlutterReady/releases)上。此外配合源码对应的tag一起食用，效果更加。      
本章代码tag为`chapter02`，配合[chapter02.apk](https://github.com/YorekLiu/YLFlutterReady/releases/download/chapter02/chapter02.apk)。  

本章的主要技术要点为

- 页面的跳转
- 表单的写法：`TextFormField`与`TextField`的差别
- Flutter中的数据库以及其他存储方式
- Flutter中的异步任务

老规矩，我们先上UI效果图：

![新建、编辑Task时的UI](/assets/images/flutter/flutter_demo_task_add_edit.png)

## 1. 页面的跳转  

[Navigation](https://flutter.io/docs/cookbook#navigation)

上面介绍了5个方面的内容：

1. 使用`Hero`完成共享元素动画
2. 使用`Navigator.push`和`Navigator.pop`进入、退出页面
3. 如何使用`Navigator.pushNamed`进入a named router
4. 接收页面返回的数据
5. 传递数据给新页面

这里使用到了2、4、5。  
在tab1中，点击FAB会创建新的Task，点击List可以编辑Task。所以需要将Task传递给新建/编辑页面。在新建/编辑完成后，需要告诉tab1结果，让tab1刷新页面。

我们看一下相关代码：

**task_list.dart**
```dart
// 进入编辑页面的回调，就是_navigateDetailOrAdd方法
typedef ShowDetailListener = void Function(BuildContext context, Task task);
// 在ListItem中通知_TaskListPageState进行刷新的回调，就是_refresh方法
typedef RefreshListener = void Function();

class _TaskListPageState extends State<TaskListPage> {

  // ShowDetailListener
  // 进入编辑页面，并接收编辑页面的返回结果
  _navigateDetailOrAdd(BuildContext context, Task task) async {
    final result = await Navigator.push(
      context,
      MaterialPageRoute(
        // 将task传入新页面
        builder: (context) => TaskDetailOrAddForm(task: task),
      )
    );

    // 返回结果为true，进行需要刷新
    if (result == true) {
      _refresh();
    }
  }

  // RefreshListener
  _refresh() {
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    ...
    return Scaffold(
      ...
      body: ... // _buildList,
      floatingActionButton: FloatingActionButton(
        // task参数传null，认为是新建
        onPressed: () => _navigateDetailOrAdd(context, null),
        ...
      ),
    );
  }

  Widget _buildList(List<Task> tasks) {
    return ListView.builder(
      itemCount: tasks.length,
      itemBuilder: (context, index) {
        final task = tasks[index];
        // 将进入编辑页面的回调方法和刷新回调方法传入TaskListItem
        return TaskListItem(task, _navigateDetailOrAdd, _refresh);
      },
    );
  }
}

class TaskListItem extends StatelessWidget {

  TaskListItem(this.task, this.navigateListener, this.refreshListener, {Key key})
    : super(key: key);

  final ShowDetailListener navigateListener;
  final RefreshListener refreshListener;
  final Task task;

  @override
  Widget build(BuildContext context) {
    return Card(
      ...
      child: Dismissible(
        ...
        child: InkWell(
          // task参数不为空，认为是编辑
          onTap: () => navigateListener(context, task),
          ...
        ),
      )
    );
  }
}
```

可以看出来，其实2、4、5核心代码就是这几行
```dart
// 进入下一页并等待返回值
_navigateDetailOrAdd(BuildContext context, Task task) async {
  final result = await Navigator.push(
    context,
    MaterialPageRoute(
      builder: (context) => TaskDetailOrAddForm(task: task),
    )
  );
}

// 带返回值返回上一页
Navigator.pop(context, true);
```
`MaterialPageRoute#build`返回的Widget就是要进入的Widget。  
需要传值给新页面，直接在new的时候传入就可以了。  
需要获取页面的返回值，`await`一下就有了，注意result可能为null。

`await`、`then`需要和`async`配合使用，具体说明见后文。

## 2. 表单

[Forms](https://flutter.io/docs/cookbook#forms)

上面介绍了5个方面的内容：

1. **表单`Form`及其校验**  
  依赖于`GlobalKey`，通过`GlobalKey.currentState.validate()`方法进行校验
2. **`TextField`、`TextFormField`的样式**  
  `TextField`是最通用的输入框控件；`TextFormField`封装了一个`TextField`，它提供了额外的功能比如校验等功能。  
  可以通过`decoration`属性进行添加hint、label、icon以及错误提示文字  
  hint就是Android中的hint，label类似Android中的TextInputLayout
3. **输入框的焦点：`autofocus`或`FocusNode`**  
  每一个可获得焦点的Widget都要分配一个`FocusNode`  
  通过`FocusScope.of(context).requestFocus(to)`移动焦点  
  通过`FocusScope.of(context).autofocus(to)`设置是否自动获得焦点  
4. **处理输入框文字变化：`onChanged`或`TextEditingController`**  
  `TextField`才有`onChanged`方法  
  `TextEditingController`中`text`获取字符串，`addListener`可以添加文字变化监听器
5. **获取输入框的值：`TextEditingController`**

我们这里使用到了`Form`、`TextFormField`、`autofocus`、`FocusNode`和`TextEditingController`。  

具体使用请看 **task_add_detail.dart**
```dart
class TaskDetailOrAddForm extends StatefulWidget {

  final Task task;

  TaskDetailOrAddForm({Key key, this.task}) : super(key: key);

  @override
  createState() => _TaskDetailOrAddFormState();
}

class _TaskDetailOrAddFormState extends State<TaskDetailOrAddForm> {

  // GlobalKey是Form的唯一标识，我们可以通过它进行表单的校验
  final _formKey = GlobalKey<FormState>();

  // TextEditingController可以为TextFormField提供初始值
  // 获取TextField/TextFormField值
  // 以及监听TextField/TextFormField的改变
  TextEditingController titleController;
  TextEditingController currentCountController;
  TextEditingController totalCountController;
  TextEditingController messageController;

  int deadline;

  // FocusNode可以用来获取焦点
  FocusNode currentFocusNode;
  FocusNode totalFocusNode;
  FocusNode messageFocusNode;

  @override
  void initState() {
    super.initState();
    // 初始化TextEditingController并提供初始值
    titleController = TextEditingController(text: widget.task?.title ?? "");
    currentCountController = TextEditingController(text: widget.task?.currentCount?.toString() ?? "0");
    totalCountController = TextEditingController(text: widget.task?.totalCount?.toString() ?? "");
    messageController = TextEditingController(text: widget.task?.message ?? "");

    // 如果传入的task没有deadline，那么默认为当前时间加七天的值
    deadline = widget.task?.deadline ?? DateTime.now().add(Duration(days: 7)).millisecondsSinceEpoch;

    // 初始化FocusNode
    currentFocusNode = FocusNode();
    totalFocusNode = FocusNode();
    messageFocusNode = FocusNode();
  }

  @override
  void dispose() {
    // 释放TextEditingController
    titleController.dispose();
    currentCountController.dispose();
    totalCountController.dispose();
    messageController.dispose();

    // 释放FocusNode
    currentFocusNode.dispose();
    totalFocusNode.dispose();
    messageFocusNode.dispose();

    super.dispose();
  }

  // 焦点转移
  _fieldFocusChange(BuildContext context, FocusNode from, FocusNode to) {
    // 将焦点转移到to所在的Widget上
    FocusScope.of(context).requestFocus(to);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        // 设置title
        title: Text(widget.task == null ? 'New Task' : ''),
        // AppBar右边放置一个保存按钮
        actions: <Widget>[
          IconButton(
            icon: const Icon(Icons.save),
            tooltip: '保存Task',
            onPressed: () => _saveTaskAndPop(context),
          )
        ],
      ),
      body: _buildForm(context)
    );
  }

  // 表单部分的构建
  Widget _buildForm(BuildContext context) {
    // 由于Form本身不带滚动特点，所以包裹一个SingleChildScrollView
    return SingleChildScrollView(
      child: Form(
        key: _formKey,   // 指定Form的key
        child: Center(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              _buildTitleForm(context),   // 标题部分
              Divider(
                height: 1.0,
                color: Colors.black26,
              ),                          // 分割线
              _buildCountForm(context),   // 已完成次数和总次数
              Divider(
                height: 1.0,
                color: Colors.black26,
              ),
              _buildDeadlineForm(context),// 截止日期
              Divider(
                height: 1.0,
                color: Colors.black26,
              ),
              _buildMessageForm(context), // 描述部分
            ],
          ),
        ),
      ),
    );
  }

  // 构建表单的标题
  Widget _buildTitleForm(BuildContext context) {
    return TextFormField(
      // 指定controller，其text值是TextFormField的默认值
      controller: titleController,
      style: Theme.of(context).textTheme.headline,
      // Form校验时，该部分如何进行检验
      // 如果校验不通过，返回一个提示字符串；否则不应该返回任何东西
      validator: (value) {
        if (value.isEmpty) {
          return '请输入标题';
        }
      },
      // 是否自动获取焦点
      autofocus: widget.task == null,
      // 软键盘右下角按钮的类型
      textInputAction: TextInputAction.next,
      // 软键盘右下角按钮的点击事件，在这里我们进行焦点的切换
      onFieldSubmitted: (text) => _fieldFocusChange(context, null, currentFocusNode),
      // decoration可以让我们添加hint、label、icon以及错误提示文字
      // hint就是Android中的hint，label就是Android中的TextInputLayout
      decoration: InputDecoration(
        border: InputBorder.none,
        hintText: '输入标题',
        hintStyle: Theme.of(context).textTheme.headline.copyWith(color: Colors.grey),
        contentPadding: const EdgeInsets.symmetric(horizontal: 56.0, vertical: 16.0),
      ),
    );
  }

  // 构建已完成次数、总次数
  Widget _buildCountForm(BuildContext context) {
    return Row(
      ...
      children: <Widget>[
        ...
        // Expanded相当于Android中的weight=1，继承至Flexible
        // 该控件只能在Row、Column、Flex中使用
        Expanded(
          child: TextFormField(
            controller: currentCountController,
            ...,
            // keyboardType用于指定软键盘的类型
            keyboardType: TextInputType.number,
            ...
            decoration: InputDecoration(
              ...
              // label就是Android中的TextInputLayout效果
              labelText: '已完成次数',
              ...
            ),
          ),
        ),
        Expanded(
          ...
        ),
      ],
    );
  }

  // 构建截止日期部分，点击可以弹出时间选择器，长按会弹出提示文字
  Widget _buildDeadlineForm(BuildContext context) {
    // Tooltip可以在长按的时候弹出提示文字
    return Tooltip(
      message: '设置Task截止时间',
      child: InkWell(
        onTap: () {
          // 弹出时间选择器，获得时间后刷新UI
          // 注意这个位置的then操作，在后面的异步部分会谈到
          showDatePicker(
            context: context,
            initialDate: DateTime.fromMillisecondsSinceEpoch(deadline),
            firstDate: DateTime(2016),
            lastDate: DateTime(2050)
          ).then((DateTime value) {
            setState(() {
              deadline = value.millisecondsSinceEpoch;
            });
          });
        },
        // UI上显示一个小icon以及一个格式化后的Text
        child: Container(
          height: 56.0,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: <Widget>[
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 16.0),
                child: Icon(Icons.timer_off, color: Colors.grey,),
              ),
              Text(
                formatDate(DateTime.fromMillisecondsSinceEpoch(deadline)),
                textAlign: TextAlign.start,
              ),
            ],
          ),
        )
      ),
    );
  }

  // 构建描述部分
  Widget _buildMessageForm(BuildContext context) {
    return Container(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Container(
            margin: const EdgeInsets.all(16.0),
            child: Icon(Icons.event_note, color: Colors.grey,),
          ),
          Expanded(
            child: TextFormField(
              ...
              // 最多显示10行
              maxLines: 10,
              // 软键盘右下角的按钮为done
              textInputAction: TextInputAction.done,
              ...
              // 点击软键盘上的done，调用保存方法
              onFieldSubmitted: (text) => _saveTaskAndPop(context),
              ...,
            ),
          )
        ],
      ),
    );
  }

  // 保存方法
  _saveTaskAndPop(BuildContext context) {
    // 如果Form校验成功，保存task到数据库，然后返回上一页，并传入result为true
    if (_formKey.currentState.validate()) {
      _saveTask(context);
      Navigator.pop(context, true);
    }
  }

  _saveTask(BuildContext context) async {
    ...
  }
}
```

## 3. 数据库以及其他存储方式  

Flutter中数据库以及其他存储方式和Android非常像：也有`File`、`SharedPreferences`以及`SQLite`。  

[Persistence](https://flutter.io/docs/cookbook#persistence)

上面包含了`File`、`SharedPreferences`两种方式。  

本节内容重点在`SQLite`。  
`SQLite`和`SharedPreferences`一样，也需要引入库，库名为[SQFlite](https://pub.dartlang.org/packages/sqflite)。  

它有以下特点：

- 支持事务和批处理
- open时自动版本管理
- insert/query/update/delete操作助手
- DB操作发生在后台

我们从Task的定义开始，看一下`SQFlite`的实际应用。  

首先，定义一些数据库公共的字段  
**common_field.dart**
```dart
final String columnId = '_id';
final String columnCreated = 'created';
final String columnUpdated = 'updated';
final String columnDeleted = 'deleted';
```

然后，定义task表的字段  
**task.dart**
```dart
import 'provider/common_field.dart';

final String tableTask = 'task';
final String columnTitle = 'title';
final String columnMessage = 'message';
final String columnTotalCount = 'total_count';      //  总次数
final String columnCurrentCount = 'current_count';  //  已完成次数
final String columnDeadline = 'deadline';


class Task{
  Task({this.title, this.message, this.totalCount, this.currentCount, this.deadline});

  // 将Task实例转换为Map类型，供insert/update时使用
  Map<String, dynamic> toMap() {
    var map = <String, dynamic> {
      columnCreated : created,
      columnUpdated : updated,
      columnDeleted : deleted,
      columnTitle: title,
      columnMessage : message,
      columnTotalCount : totalCount,
      columnCurrentCount : currentCount,
      columnDeadline : deadline
    };
    if (id != null) {
      map[columnId] = id;
    }
    return map;
  }

  // Task的静态构造方法，用于将query的结果转换为Task实例
  Task.fromMap(Map<String, dynamic> map) {
    id = map[columnId];
    created = map[columnCreated];
    updated = map[columnUpdated];
    deleted = map[columnDeleted];
    title = map[columnTitle];
    message = map[columnMessage];
    totalCount = map[columnTotalCount];
    currentCount = map[columnCurrentCount];
    deadline = map[columnDeadline];
  }

  // Task的全部字段
  int id;
  int created;
  int updated;
  int deleted;
  String title;
  String message;
  int totalCount;      //  总次数
  int currentCount;    //  已完成次数
  int deadline;
}
```

接着，为Task提供一些数据库操作的方法  
**task_provider.dart**
```dart
import 'package:sqflite/sqflite.dart';

import 'common_field.dart';
import 'record_provider.dart';
import '../task.dart';
import '../record.dart';

class TaskProvider {
  // 建表语句
  static final String createTable = '''
          create table $tableTask (
            $columnId integer primary key autoincrement,
            $columnCreated integer not null,
            $columnUpdated integer,
            $columnDeleted integer,
            $columnTitle text not null,
            $columnMessage text,
            $columnTotalCount integer not null,
            $columnCurrentCount integer not null,
            $columnDeadline integer not null)
          ''';

  // 新建Task，顺便插入Record，采用了事务
  static Future<int> insert(Database db, Task task) async {
    // 记录Task的创建时间
    task.created = DateTime.now().millisecondsSinceEpoch;

    int taskId;
    // 开启事务
    await db.transaction((txn) async {
      // 先插入task
      taskId = await txn.insert(tableTask, task.toMap());
      // 再创建Record并插入
      Record record = Record(
        taskId: taskId,
        delta: 0,
        fromValue: task.currentCount,
        toValue: task.currentCount,
      );
      await RecordProvider.insert(txn, record);
    });

    return taskId;
  }

  // 获取所有Task
  static Future<List<Task>> getTasks(dynamic dbOrTnx) async {
    List<Map> maps = await dbOrTnx.query(tableTask,
      where: "$columnDeleted is null");
    if (maps.length > 0) {
      return maps.map((map) => Task.fromMap(map)).toList();
    }
    return List();
  }

  // 获取所有Task，以及每条Task的所有Record
  static Future<Map<Task, List<Record>>> getTaskRecordsMap(Database db) async {
    Map<Task, List<Record>> result = Map();

    await db.transaction((txn) async {
      // 获取所有Task
      await TaskProvider.getTasks(txn).then((tasks) {
        // 对每条Task，获取对应的Record
        tasks.forEach((task) async {
          await RecordProvider.getRecordsByTaskId(txn, task.id).then((records) {
            // 保存到Map中
            result[task] = records;
          });
        });
      });
    });

    return result;
  }

  /// 更新Task，顺便插入Record
  static Future<int> update(Database db, Task task, int oldValue) async {
    task.updated = DateTime.now().millisecondsSinceEpoch;

    int taskId;
    // 开启事务
    await db.transaction((txn) async {
      // 先创建Record并插入
      Record record = Record(
        taskId: task.id,
        delta: task.currentCount - oldValue,
        fromValue: oldValue,
        toValue: task.currentCount,
      );
      await RecordProvider.insert(txn, record);
      // 再更新task
      taskId = await txn.update(tableTask, task.toMap(),
        where: "$columnId = ?", whereArgs: [task.id]);
    });
    return taskId;
  }
  ...
}
```

上面这部分代码出现了很多`dynamic`类型。  
`dynamic`类型在编译时可以认为它有任何属性、任何方法，但会在运行时会进行类型检查。如果调用的方法、属性运行时不能调到，才出错。  
拿上面的例子说，有一个获取所有Task的方法：
```dart
/// 获取所有Task
static Future<List<Task>> getTasks(dynamic dbOrTnx) async {
  await dbOrTnx.query(tableTask, where: "$columnDeleted is null");
  ...
}
```
dbOrTnx就是一个`dynamic`类型，这里调用了其`query`方法。这就要保证我们传入的dbOrTnx都要有`query`方法，且参数签名也要保持一致。  
幸运的是，在我们的程序中确实是这样。我们在下面两处位置调用了此方法：
```dart
// 1 在task_provider.dart的getTaskRecordsMap方法中，传入的参数是一个Transaction
static Future<Map<Task, List<Record>>> getTaskRecordsMap(Database db) async {
  await db.transaction((txn) async {
    // 获取所有Task
    await TaskProvider.getTasks(txn).then((tasks) {
      ...
    });
  });

  return result;
}

// 2 在task_list.dart中 传入的参数是Database
Future<List<Task>> getTasks() async {
  var db = await DBManager().db;
  return await TaskProvider.getTasks(db);
}
```
也就是说`Database`和`Transaction`都要有相同的`query`方法。  
*事实上，确实是这样。因为这两个类都实现了`DatabaseExecutor`类，而`query`是抽象类`DatabaseExecutor`中的方法😈*。

最后，我们看一下数据库的操作代码  
**dbmanager.dart**
```dart
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';

import '../provider/task_provider.dart';
import '../provider/record_provider.dart';

class DBManager {
  static final DBManager _instance = DBManager._internal();

  static Database _db;

  factory DBManager() => _instance;

  DBManager._internal();

  Future<Database> get db async {
    if (_db != null) {
      return _db;
    }
    _db = await initDb();

    return _db;
  }

  initDb() async {
    // Get a location using getDatabasesPath
    String databasesPath = await getDatabasesPath();
    String path = join(databasesPath, 'ready.db');

    // just for testing
//    await deleteDatabase(path);

    // open the database
    var db = await openDatabase(path, version: 1, onCreate: _onCreate);
    return db;
  }

  void _onCreate(Database db, int newVersion) async {
    await db.transaction((txn) async {
      // create table
      await txn.execute(TaskProvider.createTable);
      await txn.execute(RecordProvider.createTable);
    });
  }

  // Close the database
  Future close() async {
    var dbClient = await db;
    return dbClient.close();
  }
}
```
DBManager使用单例模式实现，关于dart中单例模式的实现：[https://stackoverflow.com/a/12649574/7440866](https://stackoverflow.com/a/12649574/7440866)  
首先通过`getDatabasesPath`获取数据库路径，然后使用`Path.join`拼接数据库文件得到一个具体数据库文件的路径。  
接着使用`openDatabase`打开数据库得到一个`Database`，最后通过这个`Database`就能进行各种数据库操作了。

另外，从数据库中加载到了数据之后如何展示出来呢，这就需要用到`FutureBuilder`了。  
`FutureBuilder`接收一个Future对象，当Future执行完毕后会调用builder的回调。如下面例子所示  

```dart
class _TaskListPageState extends State<TaskListPage> {

  // 获取数据的Future
  Future<List<Task>> getTasks() async {
    var db = await DBManager().db;
    return await TaskProvider.getTasks(db);
  }

  @override
  Widget build(BuildContext context) {
    final Widget body = FutureBuilder(
      future: getTasks(),
      builder: (context, snapshot) {
        // getTasks执行完毕，可以解析数据或处理异常
        if (snapshot.hasError) {
          return Center(child: Text(snapshot.error.toString()),);
        } else if (snapshot.data == null || snapshot.data.isEmpty) {
          return Center(child: Text("Are you Ready?"),);
        } else {
          return _buildList(snapshot.data);
        }
      },
    );

    return Scaffold(
      appBar: AppBar(
        brightness: Brightness.dark,
        title: Text('Ready'),
      ),
      body: body,
    );
  }

  Widget _buildList(List<Task> tasks) {
    return ListView.builder(
      itemCount: tasks.length,
      itemBuilder: (context, index) {
        final task = tasks[index];
        return TaskListItem(task, _navigateDetailOrAdd, _refresh);
      },
    );
  }
}
```

## 4. Flutter中的异步操作

> By default, Dart apps do all of their work on a single thread. In many cases, this model simplifies coding and is fast enough that it does not result in poor app performance or stuttering animations, often called “jank.”
>
> However, we may need to perform an expensive computation, such as parsing a very large JSON document. If this work takes more than 16 milliseconds, our users will experience jank.
>
> To avoid jank, we need to perform expensive computations like this in the background. On Android, this would mean scheduling work on a different thread. In Flutter, we can use a separate [Isolate](https://docs.flutter.io/flutter/dart-isolate/Isolate-class.html).
>
> [https://flutter.io/docs/cookbook/networking/background-parsing](https://flutter.io/docs/cookbook/networking/background-parsing)


[Asynchrony support](https://www.dartlang.org/guides/language/language-tour#asynchrony-support)  
[dart:async - asynchronous programming](https://www.dartlang.org/guides/libraries/library-tour#dartasync---asynchronous-programming)  

本节只讨论`Future`。与`Future`有关的有三个关键词`async`、`await`、`then`。

`Future`通常作为异步方法的返回值。当`Future`完成后，它的值就可以使用了。  

`await`被用来等待异步方法的结果，此时，代码所在的方法必须使用`async`修饰。
```dart
Future checkVersion() async {
  var version = await lookUpVersion();
  // Do something with version
}
```
还可以使用`try`、`catch`和`finally`来处理错误、完成清理工作。
```dart
try {
  version = await lookUpVersion();
} catch (e) {
  // React to inability to look up the version
} finally {
  // cleanup
}
```
在一个异步方法中可以多次使用`await`
```dart
var entrypoint = await findEntrypoint();
var exitCode = await runExecutable(entrypoint, args);
await flushThenExit(exitCode);
```
在`await`表达式中，表达式的结果通常是一个`Future`；如果不是，结果会自动包装成为一个`Future`。`Future`对象表示了返回一个对象的承诺。`await`表达式的值就是返回的对象。`await`表达式将会停止执行直到对象可以使用为止。  

**如果在使用await时编译报错，确保await是在async方法中**。如果`async`方法不会返回有用的值，那就返回`Future<void>`。

`then`可以使接下来的代码在`Future`完成后调用。和`await`起类似的效果。  
比如下面的`then`方法会串行执行三个异步方法，一个完成之后再执行下一个：
```dart
runUsingFuture() {
  // ...
  findEntryPoint().then((entryPoint) {
    return runExecutable(entryPoint, args);
  }).then(flushThenExit);
}
```
这等价于下面的`await`代码：
```dart
runUsingAsyncAwait() async {
  // ...
  var entryPoint = await findEntryPoint();
  var exitCode = await runExecutable(entryPoint, args);
  await flushThenExit(exitCode);
}
```

可以使用`then().catchError()`处理`Future`对象可能抛出的异常。这是`try-catch`的异步版本。
```dart
HttpRequest.getString(url).then((String result) {
  print(result);
}).catchError((e) {
  // Handle or ignore the error.
});
```

Important: Be sure to invoke `catchError()` on the result of `then()`—not on the result of the original Future. Otherwise, the `catchError()` can handle errors only from the original Future’s computation, but not from the handler registered by `then()`.


`then`方法返回一个`Future`，它可以执行多个异步任务以特定的顺序。如果使用`then`注册的回调返回一个`Future`，那么`then`会返回等效的`Future`。如果回到哦返回其他类型的值，`then`会用该值创建一个新的`Future`。
```dart
Future result = costlyQuery(url);
result
    .then((value) => expensiveWork(value))
    .then((_) => lengthyComputation())
    .then((_) => print('Done!'))
    .catchError((exception) {
  /* Handle exception... */
});
```
在上面的例子中，方法会以下面的顺序执行：

1. `costlyQuery()`
2. `expensiveWork()`
3. `lengthyComputation()`

上面是使用`await`实现的等价代码；
```dart
try {
  final value = await costlyQuery(url);
  await expensiveWork(value);
  await lengthyComputation();
  print('Done!');
} catch (e) {
  /* Handle exception... */
}
```

有时候我们的代码需要在一些异步任务全部执行完才能执行。这时我们可以使用`Future.wait()`静态方法实现。
```dart
Future deleteLotsOfFiles() async =>  ...
Future copyLotsOfFiles() async =>  ...
Future checksumLotsOfOtherFiles() async =>  ...

await Future.wait([
  deleteLotsOfFiles(),
  copyLotsOfFiles(),
  checksumLotsOfOtherFiles(),
]);
print('Done with all the long steps!');
```
