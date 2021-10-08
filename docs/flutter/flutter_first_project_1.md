---
title: "年轻人的第一个Flutter程序(1)"
---

## 1. 前言
本系列文章记录了一个Android程序员初次尝试Flutter时的经历。在作者在阅读过一遍官方文档之后，耗时5天(从11.19到11.24)撸出一个Demo。此Demo没有什么高深的东西，都是一些Flutter原生控件的组合，但是内容涵盖了大部分基础内容，特别适合入门。  
作者会以Demo中的内容为引，列出对涉及到知识的理解以及对应的出处，从而串起Flutter基础知识的脉络。

本文侧重讲解开发知识，不重要的准备工作直接略过。  
因此，整个Flutter开发准备部分直接查看[Flutter-Get started](https://flutter.io/docs/get-started/install)，看完[第3小节-Test drive](https://flutter.io/docs/get-started/test-drive)就OK，此处就不做过多累述。  
另外，作者采用的IDE是Android Studio，毕竟是个Android程序员。

今天正好Flutter1.0正式发布，本文会基于此进行。  

想看最新内容可以查看英文官网[https://flutter.io/](https://flutter.io/)  
另外Flutter还有[Flutter中文网](https://flutterchina.club/)  

## 2. 关于程序
本程序源码会发布在GitHub-[YorekLiu/YLFlutterReady](https://github.com/YorekLiu/YLFlutterReady)上，并可在[release](https://github.com/YorekLiu/YLFlutterReady/releases)中找到对应的apk文件，对照文章一起看还是挺愉快的。  

由于作者没有苹果开发者账号，所以不能真机调试苹果设备。但是，Demo开发过程中都采用的iOS设备。跨平台还是稳稳的。

口说无凭，先上iPhone X上的演示图。

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
 - 自定义View等
4. 其他
 - sqlite数据库
 - FutureBuild等

其他dart/flutter语法、库等在实战中遇到会解释。

## 3. Hello, World!
我们正式开始Flutter之旅。  

在Flutter开发准备部分[第3小节-Test drive](https://flutter.io/docs/get-started/test-drive)完成后，我们已经创建了一个示例程序，接下来的开发会在此工程上。

首先，我们看一下示例程序的代码，代码里面注释有删改：

```dart
import 'package:flutter/material.dart';

// 应用入口方法，Dart2中new关键词可以省略
// runApp里传入的是应用根Widget
void main() => runApp(new MyApp());


// StatelessWidget与StatefulWidget的区别 1️⃣
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
        // App主题色色板
        // 另外原注释还介绍了部分热加载的触发点
        // 在IntelliJ中按Run > Flutter Hot Reload就可以热加载了
        // 或者直接保存文件也可以触发
        primarySwatch: Colors.blue,
      ),
      home: new MyHomePage(title: 'Flutter Demo Home Page'),
    );
  }
}

class MyHomePage extends StatefulWidget {
  MyHomePage({Key key, this.title}) : super(key: key);

  // 程序的首页，整个屏幕都由其显示
  // 既然它是StatefulWidget，那么肯定会有一个对应的State，这个State就是下面的_MyHomePageState

  // 继承StatefulWidget的类一般只是保存父Widget传来的值，供对应的State使用
  // 在Widget子类中的字段要用final修饰

  final String title;

  @override
  _MyHomePageState createState() => new _MyHomePageState();
}

class _MyHomePageState extends State<MyHomePage> {
  int _counter = 0;

  void _incrementCounter() {
    setState(() {
      // 调用setState方法通知Flutter framework
      // framework将会重新运行下方的build方法来显示更新后的值
      _counter++;
    });
  }

  @override
  Widget build(BuildContext context) {
    // 当setState方法调用的时候，build方法都会重新运行
    // Flutter framework已经进行了优化，来更快的重新运行build方法
    // 因此当我们需要更新的时候，rebuild任何Widget都可以，而不是单独改变Widget。

    return new Scaffold(
      appBar: new AppBar(
        // 使用MyHomePage中保存的title作为AppBar的title
        title: new Text(widget.title),
      ),
      body: new Center(
        // Center可以让子Widget在父Widget中居中显示
        child: new Column(
          // Column相当于竖直的线性布局
          // 默认情况下，自身宽会适应子布局的宽，自身高为父布局的高
          //
          // 在Flutter Inspector中选择"Toggle Debug Paint"，可以看到每一个Widget的线框
          //
          // Column有一些属性可以控制自身的尺寸以及如何摆放子元素。比如这里的mainAxisAlignment
          // 关于Column、Row的mainAxisAlignment、crossAxisAlignment 2️⃣
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
        // FAB的点击会触发`_incrementCounter`方法，从而刷新UI
        onPressed: _incrementCounter,
        tooltip: 'Increment',
        child: new Icon(Icons.add),
      ),
    );
  }
}
```
上面程序很简单，整个页面由最上面的AppBar、一个body、一个FAB组成。body中有两个Text竖直排列，并整体居中。  
点击FAB会增加计数器，并触发页面的刷新，从而导致body中Text的刷新。这就是整个程序的功能了。

除此之外，我们也可以注意到Flutter的布局机制：**万物皆Widget，一层裹一层**。

>The core of Flutter’s layout mechanism is widgets. In Flutter, almost everything is a widget—even layout models are widgets. The images, icons, and text that you see in a Flutter app are all widgets. But things you don’t see are also widgets, such as the rows, columns, and grids that arrange, constrain, and align the visible widgets.


[Flutter’s approach to layout](https://flutter.io/docs/development/ui/layout#flutters-approach-to-layout)  （引经据典都会以此种形式呈现）

### 3.1 StatelessWidget与StatefulWidget的区别

[Stateful and stateless widgets](https://flutter.io/docs/development/ui/interactive#stateful-and-stateless-widgets)

下面是从官方文档摘抄的内容：  
> A stateless widget has no internal state to manage. Icon, IconButton, and Text are examples of stateless widgets, which subclass StatelessWidget.
>
> A stateful widget is dynamic. The user can interact with a stateful widget (by typing into a form, or moving a slider, for example), or it changes over time (perhaps a data feed causes the UI to update). Checkbox, Radio, Slider, InkWell, Form, and TextField are examples of stateful widgets, which subclass StatefulWidget.


简单的来说，

- StatefulWidget表示可以与用户进行交互或者随着时间的推移可以发生变化的控件
- StatelessWidget只是简单的展示控件

从上面的例子可以看出，创建StatefulWidget控件比创建StatelessWidget要多一个类，写起来比较蛋疼，因为它们互相引用。  

这里作者创建了一个live template，输入`stateful`就可以创建模板代码。  
复制下面的代码，在`Preferences  -> Editor -> Live Templates`中选择Dart分类，粘贴进去就可以使用了
```xml
<template name="stateful" value="class $CLASS_NAME$ extends StatefulWidget {&#10;  @override&#10;  _$CLASS_NAME$State createState() =&gt; _$CLASS_NAME$State();&#10;}&#10;&#10;class _$CLASS_NAME$State extends State&lt;$CLASS_NAME$&gt; {&#10;  @override&#10;  Widget build(BuildContext context) {&#10;    // TODO: implement build&#10;    return null;&#10;  }&#10;}" description="Generate StatefulWidget" toReformat="false" toShortenFQNames="true">
  <variable name="CLASS_NAME" expression="" defaultValue="" alwaysStopAt="true" />
  <context>
    <option name="DART" value="true" />
  </context>
</template>
```

效果如下：

<iframe width="320" height="283" src="/assets/videos/flutter/flutter_live_template_stateful.mp4" frameborder="0" allowfullscreen></iframe>


### 3.2 Column、Row

[Aligning widgets](https://flutter.io/docs/development/ui/layout#aligning-widgets)
上面这个链接里面的内容展示了Flutter布局的思想。总的来说是通过Column、Row以及Stack等几种控件统筹全局。

我们还是说下Column、Row布局的特点吧。从下面的图片中可以看出，Row相当于水平方向的线性布局，Column相当于竖直方向的线性布局。  

![row-diagram.png](/assets/images/flutter/row-diagram.png)  ![column-diagram.png](/assets/images/flutter/column-diagram.png)

Row和Column都有mainAxisAlignment和crossAxisAlignment两个属性控制其子布局在对应方向上的显示  

对于Row来说，因为它是水平方向的，所以

- mainAxisAlignment控制其子布局在水平方向的显示
- crossAxisAlignment控制竖直方向的显示

对于Column来说，因为它是竖直方向的，所以

- mainAxisAlignment控制竖直方向的显示
- crossAxisAlignment控制水平方向的显示

mainAxisAlignment和crossAxisAlignment有很多枚举值，表1举出了所有的枚举值以及对应的效果。

<center>**Table 1.** MainAxisAlignment、MainAxisSize、CrossAxisAlignment的所有枚举值</center>  

| 枚举值 | 效果 |
| :--- | :- |
| **MainAxisAlignment** | **控制子布局在主轴方向上的布局** |
| start | 使子Widget尽量靠近主轴的起始位置，**默认值** |
| end | 使子Widget尽量靠近主轴的末尾位置 |
| center | 使子Widget尽量居中 |
| spaceBetween | 将空白均匀地分布在子Widget之间<br />比如2个子Widget，那么布局效果为Widget-Space-Widget |
| spaceAround | Widget周围留白一样，即Widget之间的Space等于开头+结尾的Space<br />比如2个子Widget，那么布局效果为1Space-Widget-1Space-1Space-Widget-1Space<br />比如3个子Widget，那么布局效果为1Space-Widget-1Space-1Space-Widget-1Space-1Space-Widget-1Space |
| spaceEvenly | Widget之间的Space等于开头、结尾的Space<br />比如2个子Widget，那么布局效果为1Space-Widget-1Space-Widget-1Space |
| **MainAxisSize** | **控制子布局在主轴上的Size** |
| min | 使主轴上空闲空间最少，受限于传入的布局约束 |
| max | 使主轴上空闲空间最大，受限于传入的布局约束，**默认值** |
| **CrossAxisAlignment** | **控制子布局在交叉轴方向上的布局** |
| start | 与MainAxisAlignment.start类似 |
| end | 与MainAxisAlignment.end类似 |
| center | 与MainAxisAlignment.center类似，**默认值** |
| stretch | 使子Widget布满整个交叉轴 |
| baseline | 使子Widget基线对齐。如果主轴是竖直的，那么该值会以start处理 |

表格看的不够直观，以Column为例上图，分别展示三个属性的效果。  

![Column中MainAxisAlignment取start、end、center、spaceBetween、spaceAround、spaceEvenly值时的效果](/assets/images/flutter/column_main_axis_align.jpg)

<center>Column中MainAxisAlignment取start、end、center、spaceBetween、spaceAround、spaceEvenly值时的效果</center>

![Column中MainAxisSize取min、max值时的效果](/assets/images/flutter/column_main_axis_size.png)

<center>Column中MainAxisSize取min、max值时的效果</center>

![Column中CrossAxisAlignment取start、end、center、stretch、baseline值时的效果](/assets/images/flutter/column_cross_axis_align.png)

<center>Column中CrossAxisAlignment取start、end、center、stretch、baseline值时的效果</center>

在下一章，我们将基于现有工程进行「年轻人的第一个Flutter程序」。Flutter, Ready？
