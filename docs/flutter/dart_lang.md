---
title: "Dart 语法特性速览"
tags:
  - dart
---

Dart 基础语法同其他高级语法类似，这里列出一些相较而言值得一提的语法特性。

### 1. 类相关

!!! abstract ""
    Dart 中所有的 class 都是隐式接口（[Implicit interfaces](https://dart.cn/language/classes#implicit-interfaces)），这也就意味着所有的 class 都可以被实现。

#### 1.1 [mixin/with](https://dart.cn/language/mixins)

Dart 语法中有一个独特的 mixin 类，被该关键词修饰的类中的所有变量、函数都可以被其他类通过 with 的方式进行 **混入**。

虽然 Dart 也不能多继承，但是通过这种形式，实际上达到了多继承的目的。

mixin 类中也可以有抽象方法。

=== "with 多个类"

    ```dart hl_lines="1"
    class Maestro extends Person with Musical, Aggressive, Demented {
      Maestro(String maestroName) {
        name = maestroName;
        canConduct = true;
      }
    }
    ```

=== "抽象方法"

    ```dart hl_lines="2 13"
    mixin Musician {
      void playInstrument(String instrumentName); // Abstract method.
    
      void playPiano() {
        playInstrument('Piano');
      }
      void playFlute() {
        playInstrument('Flute');
      }
    }
    
    class Virtuoso with Musician { 
      void playInstrument(String instrumentName) { // Subclass must define.
        print('Plays the $instrumentName beautifully');
      }  
    }
    ```

=== "on ：mixin 也可以有超类"

    ```dart hl_lines="7"
    class Musician {
      musicianMethod() {
        print('Playing music!');
      }
    }
    
    mixin MusicalPerformer on Musician {
      perfomerMethod() {
        print('Performing music!');
        super.musicianMethod();
      }
    }
    
    class SingerDancer extends Musician with MusicalPerformer { }
    
    main() {
      SingerDance().performerMethod();
    }
    ```

=== "mixin class ：既是 mixin 又是 class"

    ```dart hl_lines="1"
    mixin class Musician {
      // ...
    }
    
    class Novice with Musician { // Use Musician as a mixin
      // ...
    }
    
    class Novice extends Musician { // Use Musician as a class
      // ...
    }
    ```

#### 1.2 关于方法

Dart 中方法参数的花样比较多，包含默认值、[可选位置参数](https://dart.cn/codelabs/dart-cheatsheet#optional-positional-parameters)、[命名参数](https://dart.cn/codelabs/dart-cheatsheet#named-parameters)等。

参数默认值要与后面两者连用，可选位置参数是方法参数中用 **[]** 包裹起来的部分，命名参数是 **{}** 包裹起来的部分。

```dart
void main() {
  print(func());
  print(func("Sohpia"));

  print(fun());
  print(fun(name: "Sohpia"));
}

String func([String name = "World"]) {
  return "func $name";
}

String fun({String name = "World"}) {
  return "fun $name";
}
```

命名参数默认情况应该是可选的，所以允许为空，或提供默认值；若不允许为空，且在调用时必须传入值，可以显式使用 `required` 进行标记。

```dart hl_lines="1"
static ToastRecord show({required String message, Duration? duration}) {
  duration ??= const Duration(seconds: 2);
  final record = ToastRecord(message: message, duration: duration);

  _singleton._toastWidget.showToast(record: record);

  return record;
}
```

##### 1.2.1 构造方法

除开常规的构造方法之外，有额外两种构造方法：

1. [命名构造方法](https://dart.cn/codelabs/dart-cheatsheet#named-constructors)
2. 通过 `factory` 关键词修饰的[工厂构造方法](https://dart.cn/codelabs/dart-cheatsheet#factory-constructors)

命名构造方法在实现时需要需要给所有未初始化的变量赋值，而工厂构造方法则需要构造出对应的对象。  

工厂构造方法能够返回其子类、null 对象，甚至抛出异常。

```dart hl_lines="8 9"
class Color {
  int red;
  int green;
  int blue;
  
  Color(this.red, this.green, this.blue);

  Color.black(): red = 0, green = 0, blue = 0;
  factory Color.black() => Color(0, 0, 0);
}
```

#### 1.3 [扩展方法](https://dart.cn/language/extension-methods)、扩展变量、[别名](https://dart.cn/language/typedefs)

Dart 也支持扩展方法、变量，使用 `extension` 关键词。

```dart
extension FileExtension on FileSystemEntity {
  String get name {
    return path.split(Platform.pathSeparator).last;
  }
}

typedef NotNullCallback<T extends Object> = void Function(T it);
extension KtOperator<T extends Object> on T? {
  void let(NotNullCallback<T> callback) {
    if (this != null) {
      callback.call(this!);
    }
  }
}
```

Dart 也支持未命名扩展，未命名扩展仅在本 library 中可见，这样可以规避  API 冲突问题。

```dart
extension on String {
  bool get isBlank => trim().isEmpty;
}
```

使用 `typedef` 关键词可以给一个类型起别名，在可以使一个复杂的方法声明变得更易读。

### 2. [错误处理](https://dart.cn/language/error-handling)

Dart 的错误处理可以用这些关键词来进行描述：

常规的 try、catch、finally，以及独特的on、rethrow。

`on` 用来处理特定类型的异常，`rethrow` 则用来重新抛出异常。

```dart
try {
  breedMoreLlamas();
} on OutOfLlamasException {
  // A specific exception
  buyMoreLlamas();
} on Exception catch (e) {
  // Anything else that is an exception
  print('Unknown exception: $e');
} catch (e) {
  // No specified type, handles all
  print('Something really unknown: $e');
  rethrow;
}
```

`catch` 块支持一个参数`(e)`和两个参数`(e, s)`，e 表示 exception，s 表示 StackTrace。

```dart
try {
  // ···
} on Exception catch (e) {
  print('Exception details:\n $e');
} catch (e, s) {
  print('Exception details:\n $e');
  print('Stack trace:\n $s');
}
```

### 3. 其他操作符

#### 3.1 [级联操作符](https://dart.cn/language/operators#cascade-notation) ..

级联操作符(Cascade notation)可以用来对一个对象进行多次操作，下面两段代码就是等价的：

级联操作符

```dart
var paint = Paint()
  ..color = Colors.black
  ..strokeCap = StrokeCap.round
  ..strokeWidth = 5.0;
```

非级联

```dart
var paint = Paint();
paint.color = Colors.black;
paint.strokeCap = StrokeCap.round;
paint.strokeWidth = 5.0;
```

#### 3.1 [扩展操作符](https://dart.cn/language/collections#spread-operators) ...

扩展操作符(Spread operators)用于集合操作，其作用是将被修饰集合中的元素依次放入到新集合中。

```dart
var list = [1, 2, 3];
var list2 = [0, ...list];  // 0, 1, 2, 3
assert(list2.length == 4);
```
