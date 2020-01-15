---
title: "年轻人的第一个Flutter程序(4)"
---

本系列文章也会阶段性地release对应的apk供对照查看。apk都会发布在[release](https://github.com/YorekLiu/YLFlutterReady/releases)上。此外配合源码对应的tag一起食用，效果更加。  
本章代码tag为`chapter03`，配合[chapter03.apk](https://github.com/YorekLiu/YLFlutterReady/releases/download/chapter03/chapter03.apk)。  

本章的主要技术要点为

- TabBar的使用
- 嵌套滑动（可以实现带Header、Footer列表效果）
- 自定义View等

老规矩，我们先上UI效果图：

![tab2 UI效果](/assets/images/flutter/flutter_demo_tab2.png)

第一张图展示的是7天内完成任务的次数，第二张图是具体任务的完成情况（横坐标随便弄了下）。  

## 1. 关于TabBar

[Working with Tabs](https://flutter.io/docs/cookbook/design/tabs)    
<cite>上面就是官方对于Tab的Demo。</cite>  

我们可以看到，这部分有如下控件  

- `DefaultTabController`、`TabController`  
  顾名思义，就是用来控制Tab
- `TabBar`  
  AppBar下部用来容纳Tab指示器的控件
- `Tab`  
  在TabBar中具体的Tab指示器怎么显示
- `TabBarView`  
  Tab对应的内容

我们应用整个tab2也由以上控件构成。但是由于目前Flutter不支持动态添加Tab，所以只能在加载到数据后重新创建`TabController`，从而达到动态添加Tab的目的。  

Tab2整体布局代码如下：

```dart
class StatsPage extends StatefulWidget {
  @override
  createState() => _StatsPageState();
}

class _StatsPageState extends State<StatsPage> with TickerProviderStateMixin {

  TabController _tc;
  List<Widget> tabs = [];

  // 动态创建TabController
  TabController _makeNewTabController() => TabController(
    vsync: this,
    length: tabs.length,
    initialIndex: 0,
  );

  @override
  Widget build(BuildContext context) {
    print("build => ${this.runtimeType.toString()}");
    return FutureBuilder(
      future: getTaskRecordsMap(),
      builder: (context, snapshot) {
        if (snapshot.hasError)
          return Center(child: Text(snapshot.error.toString()),);
        else
          return _build(snapshot.data);
      }
    );
  }
  
  // 加载到数据后build UI
  _build(Map<Task, List<Record>> map) {
    // 无论有没有数据，都创建第一个Tab
    tabs = [Tab(text: "Overview")];
    // 取每个task的title作为Tab的text
    if (map != null) {
      tabs.addAll(map.keys.map((task) => Tab(text: task.title)));
    }
    _tc = _makeNewTabController();

    return Scaffold(
      appBar: AppBar(
        brightness: Brightness.light,  // brightness可以改变状态栏字符的颜色
        title: Text('Stats'),
        elevation: 1.0,
        backgroundColor: Theme.of(context).canvasColor,
        textTheme: Theme.of(context).textTheme,
        bottom: TabBar(
          controller: _tc,
          isScrollable: true,
          labelColor: Colors.black87,
          indicatorSize: TabBarIndicatorSize.label,
          indicatorColor: Colors.indigo,
          unselectedLabelColor: Colors.black38,
          tabs: tabs
        ),
      ),
      body: TabBarView(
        controller: _tc,
        children: _buildTabBarView(tabs.length, map),
      ),
    );
  }

  _buildTabBarView(int length, Map<Task, List<Record>> map) {
    List<Widget> widgets = [];
    // 创建一个StatsOverviewPage作为第一个Tab
    if (length > 0) {
      widgets.add(StatsOverviewPage(map));
    }
    if (map == null) {
      return widgets;
    }
    // 对于每个task都创建一个StatsDetailPage
    for (var iterator in map.entries) {
      widgets.add(StatsDetailPage(iterator.key, iterator.value,));
    }

    return widgets;
  }

  // 从数据库获取数据
  Future<Map<Task, List<Record>>> getTaskRecordsMap() async {
    var db = await DBManager().db;
    return await TaskProvider.getTaskRecordsMap(db);
  }
}
```

另外，为了让Tab之间切换不重新创建，我们需要在TabBarView中做一些处理：将TabBarView都抽出来，并继承至`StatefulWidget`，在对应的State上使用`AutomaticKeepAliveClientMixin`，然后实现wantKeepAlive方法即可。代码如下：

```dart
class StatsDetailPage extends StatefulWidget {
  ...
  @override
  createState() => _StatsDetailPageState();
}

class _StatsDetailPageState extends State<StatsDetailPage> with AutomaticKeepAliveClientMixin<StatsDetailPage> {

  @override
  bool get wantKeepAlive => true;

  @override
  Widget build(BuildContext context) {
    ...
  }
}
```

## 2. 嵌套滑动  

在Flutter中可以`CustomScrollView`实现嵌套滑动，另外利用该特点还可以实现带头、尾的列表。  
当然该类还有其他用途：[CustomScrollView class](https://docs.flutter.io/flutter/widgets/CustomScrollView-class.html)

具体代码在stats_page_overview.dart文件StatsOverviewPage类中，摘抄如下

```dart
return CustomScrollView(
      slivers: <Widget>[
        // 第一个Widget，这里充当头的作用
        SliverList(
          // 可以传入一个Widget数组，此处传入的是自定义的表格
          delegate: SliverChildListDelegate(
            [_buildChart("Overview (Weekly)", total.toString(), dataMap: dataMap)],
            addAutomaticKeepAlives: true,
            addRepaintBoundaries: true
          ),
        ),
        // 第二个Widget，列表的主体
        SliverGrid(
          gridDelegate: SliverGridDelegateWithMaxCrossAxisExtent(
            maxCrossAxisExtent: MediaQuery.of(context).size.width / 2,
            mainAxisSpacing: 0.0,
            crossAxisSpacing: 0.0,
            childAspectRatio: 2.0
          ),
          delegate: SliverChildBuilderDelegate(
              (context, index) {
              return _buildListItem(
                context,
                widget.map.keys.elementAt(index),
                widget.map.values.elementAt(index),
                dataMap.values.elementAt(index)
              );
            },
            childCount: dataMap.length
          ),
        ),
      ],
    );
```

上面这些代码就实现了本文开头第一张图的UI。  
另外，在创建图表的时候，还使用到了另外一个控件：AspectRatio，该控件可以用来使child的尺寸变成指定的比例。

## 3. 自定义View  

[How do I use a Canvas to draw/paint?](https://flutter.io/docs/get-started/flutter-for/android-devs#how-do-i-use-a-canvas-to-drawpaint)  
<cite>自定义View的示例</cite>

在上面的示例中我们可以看到，Flutter中自定义View通过`CustomPainter`来完成，它有两个重要方法：`paint`方法完成绘制工作，`shouldRepaint`决定是否需要重绘。  

自定义View，其实和Android中差不多，都有`Canvas`、`Paint`对象，可以通过它们画线、画矩形等。  

```dart
canvas.drawImageRect(
        image,
        Rect.fromLTWH(0.0, 0.0, image.width.toDouble(), image.height.toDouble()),
        Rect.fromLTWH(dx, dy, iconSize, iconSize),
        paint
      );

canvas.drawRect(Rect.fromLTRB(0.0, chartTop, size.width, chartBottom), paint);

canvas.drawLine(
  Offset(realChartLeft, realChartBaseLine - yStep * i),
  Offset(realChartRight, realChartBaseLine - yStep * i),
  paint
);
```

与Android不同的是，绘制文字比较麻烦，先将要绘制的文字和样式组成一个`TextSpan`，然后创建一个`TextPainter`，先`layout`最后就可以`paint`进行绘制了。  

```dart
var titleSpan = TextSpan(
      text: title,
      style: Theme.of(context).textTheme.subhead.copyWith(
        color: Colors.white70,
        fontWeight: FontWeight.w500
      )
    );
var textPainter = TextPainter(text: titleSpan, textAlign: TextAlign.left, textDirection: TextDirection.ltr);
textPainter.layout();
textPainter.paint(canvas, Offset(padding, padding));
```

`TextPainter.layout`方法会计算需要绘制的文本的视觉位置。在该方法调用之后，`paint`方法才会生效。此外，文字的`height`和`widget`在`layout`之后也可以从`TextPainter`中获取到。  