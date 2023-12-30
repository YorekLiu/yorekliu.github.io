---
title: "Flutter状态管理——Provider"
---

## 1. 实现 ChangeNotifier

```dart
class CounterNotifier with ChangeNotifier {
  int _count = 0;
  int _count1 = 0;

  int get count => _count;

  int get count1 => _count1;

  increment() {
    _count++;
    notifyListeners();
  }

  increment1() {
    _count1++;
    notifyListeners();
  }
}
```

## 2. 监听数据变动

### 2.1 Consumer 监听 ChangeNotifier 所有变化

```dart
Consumer<CounterNotifier>(
    builder: (context, value, child) {
        return Expanded(
            child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: <Widget>[
                    Text('${value.count}'),
                    Text('${value.count1}'),
                    FlatButton(
                        onPressed: () {
                            _counter.increment1();
                        },
                        child: Text('Increment1')
                    ),
                ],
            ),
        );
    },
),
```

### 2.2 Selector 选择性监听 ChangeNotifier 中特定数据的变化

```dart
Selector<CounterNotifier, int>(
    selector: (_, notifier) => notifier.count1,
    builder: (context, value, child) {
        return Expanded(
            child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: <Widget>[
                    Text('${value.count}'),
                    Text('${value.count1}'),
                    FlatButton(
                        onPressed: () {
                            _counter.increment1();
                        },
                        child: Text('Increment1')
                    ),
                ],
            ),
        );
    },
),
```

### 2.3 context.watch 监听 ChangeNotifier 所有变化

### 2.4 context.read 读取 ChangeNotifier

### 2.5 Provider.of<T>(context) listen 时等价于 watch, 不 listen 时 等价于 read