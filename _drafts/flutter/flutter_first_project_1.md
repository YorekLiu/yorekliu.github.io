---
title: "年轻人的第一个Flutter程序(1)"
excerpt: "结合官方文档，从0开始一个Flutter程序，力求每个要点给到出处"
categories:
  - Flutter
tags:
  - Flutter
toc: true
toc_label: "目录"
toc_icon: "quote-left"
#last_modified_at: 2018-08-20T17:10:19+08:00
---

## 1. 前言
本系列文章记录了一个Android程序员初次尝试Flutter时的经历。在作者在阅读过一遍官方文档之后，耗时5天(从11.19到11.24)撸出一个Demo。此Demo没有什么高深的东西，都是一些Flutter原生控件的组合，但是内容涵盖了大部分基础内容，特别适合入门。  
作者会以Demo中的内容为引，列出对涉及到知识的理解以及对应的出处，从而串起Flutter基础知识的脉络。

本文侧重讲解开发知识，不重要的准备工作直接略过。  
因此，整个Flutter开发准备部分直接查看[Flutter-Get started](https://flutter.io/docs/get-started/install)，看完[第3小节-Test drive](https://flutter.io/docs/get-started/test-drive)就OK，此处就不做过多赘述。  
另外，作者采用的IDE是Android Studio，毕竟是个Android程序员。
{: .notice--success }

## 2. 关于Demo
本Demo源码会发布在GitHub-[YorekLiu/YLFlutterReady](https://github.com/YorekLiu/YLFlutterReady)上，并可在[release](https://github.com/YorekLiu/YLFlutterReady/releases)中找到对应的apk文件，对照文章一起看还是挺愉快的。  

由于作者没有苹果开发者账号，所以不能真机调试苹果设备。但是，Demo开发过程中都采用的iOS设备。跨平台还是稳稳的。
{: .notice--warning }

口说无凭，先上iPhone X上的Demo演示图。

![flutter_demo](/assets/images/flutter/flutter_demo.jpg)

此Demo共分为3个大页面，每个页面UI要点分布为
1. Tab1
 - 底部导航栏
 - 可滑动删除的列表
 - Card、Container、InkWell、Column、Row、Expand等基本Widget的应用
2. 表单(第二个界面)
 - TextFormField、ToolTip等Widget的使用
 - Form的校验
3. Tab2
 - 顶部导航栏的使用
 - 多个可滑动控件一起使用
 - 自定义View

其他dart/flutter语法、库等在实战中遇到会解释。

## 3. Hello, World!
我们正式开始Flutter之旅。  

在Flutter开发准备部分[第3小节-Test drive](https://flutter.io/docs/get-started/test-drive)完成后，我们已经创建了一个示例程序，接下来的开发会在此工程上。

首先，我们看一下示例程序的代码，代码里面注释有删改：

```dart
import 'package:flutter/material.dart';

// 应用入口方法 1️⃣
// runApp里传入的是应用根View
void main() => runApp(new MyApp());


// StatelessWidget与StatefulWidget的区别 2️⃣
class MyApp extends StatelessWidget {
  // StatelessWidget中最重要的方法——此方法决定Widget显示什么
  @override
  Widget build(BuildContext context) {
    return new MaterialApp(
      // title在Android上决定了多任务界面上App的名称
      // 而在iOS上没任何用处，iOS平台上以CFBundleDisplayName为准
      // 来源在WidgetsApp.title的注释上
      title: 'Flutter Demo',
      theme: new ThemeData(
        // This is the theme of your application.
        //
        // Try running your application with "flutter run". You'll see the
        // application has a blue toolbar. Then, without quitting the app, try
        // changing the primarySwatch below to Colors.green and then invoke
        // "hot reload" (press "r" in the console where you ran "flutter run",
        // or press Run > Flutter Hot Reload in IntelliJ). Notice that the
        // counter didn't reset back to zero; the application is not restarted.
        primarySwatch: Colors.blue,
      ),
      home: new MyHomePage(title: 'Flutter Demo Home Page'),
    );
  }
}

class MyHomePage extends StatefulWidget {
  MyHomePage({Key key, this.title}) : super(key: key);

  // This widget is the home page of your application. It is stateful, meaning
  // that it has a State object (defined below) that contains fields that affect
  // how it looks.

  // This class is the configuration for the state. It holds the values (in this
  // case the title) provided by the parent (in this case the App widget) and
  // used by the build method of the State. Fields in a Widget subclass are
  // always marked "final".

  final String title;

  @override
  _MyHomePageState createState() => new _MyHomePageState();
}

class _MyHomePageState extends State<MyHomePage> {
  int _counter = 0;

  void _incrementCounter() {
    setState(() {
      // This call to setState tells the Flutter framework that something has
      // changed in this State, which causes it to rerun the build method below
      // so that the display can reflect the updated values. If we changed
      // _counter without calling setState(), then the build method would not be
      // called again, and so nothing would appear to happen.
      _counter++;
    });
  }

  @override
  Widget build(BuildContext context) {
    // This method is rerun every time setState is called, for instance as done
    // by the _incrementCounter method above.
    //
    // The Flutter framework has been optimized to make rerunning build methods
    // fast, so that you can just rebuild anything that needs updating rather
    // than having to individually change instances of widgets.
    return new Scaffold(
      appBar: new AppBar(
        // Here we take the value from the MyHomePage object that was created by
        // the App.build method, and use it to set our appbar title.
        title: new Text(widget.title),
      ),
      body: new Center(
        // Center is a layout widget. It takes a single child and positions it
        // in the middle of the parent.
        child: new Column(
          // Column is also layout widget. It takes a list of children and
          // arranges them vertically. By default, it sizes itself to fit its
          // children horizontally, and tries to be as tall as its parent.
          //
          // Invoke "debug paint" (press "p" in the console where you ran
          // "flutter run", or select "Toggle Debug Paint" from the Flutter tool
          // window in IntelliJ) to see the wireframe for each widget.
          //
          // Column has various properties to control how it sizes itself and
          // how it positions its children. Here we use mainAxisAlignment to
          // center the children vertically; the main axis here is the vertical
          // axis because Columns are vertical (the cross axis would be
          // horizontal).
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            new Text(
              'You have pushed the button this many times:',
            ),
            new Text(
              '$_counter',
              style: Theme.of(context).textTheme.display1,
            ),
          ],
        ),
      ),
      floatingActionButton: new FloatingActionButton(
        onPressed: _incrementCounter,
        tooltip: 'Increment',
        child: new Icon(Icons.add),
      ), // This trailing comma makes auto-formatting nicer for build methods.
    );
  }
}
```
