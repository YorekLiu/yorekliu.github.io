---
title: "Flutter状态管理——Provider"
---

Flutter 本身有比较原始的类，用于在包装一个类型，并且在其值发生改变的时候通知 UI 进行刷新，这就是 `ValueNotifier` 与 `ValueListenableBuilder` 了。当然，这里不赘述。

下面介绍一下 Flutter 状态管理库——Provider。

##  1. Provider 的使用 

添加依赖：

```shell
dart pub add provider
```

### 1.1 声明数据源

可以使用 `ChangeNotifierProvider` 包裹一个 child：

```dart
ChangeNotifierProvider<_LiveTemplatePageService>(
  create: (_) => _LiveTemplatePageService(
      service: context.read<LiveTemplateService>()),
  child: const _LiveTemplatePageInner(),
);
```

这里 `_LiveTemplatePageService` 是一个继承了 `ChangeNotifier` 的类

```dart
class _LiveTemplatePageService extends ChangeNotifier...
```

若有多个 `ChangeNotifierProvider`，可以使用 `MultiProvider`。

```dart
runApp(MultiProvider(
providers: [
    ChangeNotifierProvider<WindowService>(create: (_) => WindowService()),
    ChangeNotifierProvider<WorkspaceService>(create: (_) => WorkspaceService()..init()),
    ChangeNotifierProvider<SearchService>(create: (_) => SearchService()..init()),
    ChangeNotifierProvider<WriterService>(create: (_) => WriterService()..init()),
    ChangeNotifierProvider<SettingsService>(create: (_) => SettingsService()),
    ChangeNotifierProvider<LiveTemplateService>(create: (_) => LiveTemplateService()..init()),
    ChangeNotifierProvider<GitService>(create: (_) => GitService()..init()),
],
child: const Application(),
));
```

除了直接使用 `ChangeNotifierProvider` 之外，还可以通过 `Provider.value` 和  `ChangeNotifierProvider.value` 直接使用现有的值来作为数据源。

此外，还有 `ProxyProvider` 可以基于其他数据源提供对应的数据，这里面将原始数据做一层转换。

```dart
ProxyProvider<MathController, TextSelection>(
  create: (context) => const TextSelection.collapsed(offset: -1),
  update: (context, value, previous) => value.selection,
),
```

### 1.2 Provider 的使用

在使用上述方式声明了数据源之后，可以通过如下方式获取数据：

1. `Consumer` Widget  
    Consumer 在数据源变化时，都会得到刷新
2. `Selector` Widget
    Selector 可以选择监听数据源中的部份数据
3. `context.watch`、`context.read` 方法
    前两个方法等价于 `Provider.of` 方法，listen 参数为 true 时，等于 watch；为 false 时，等于 read。  
    watch 方法会在数据源发生变化时，自动获取到数据并完成后续的 rebuild 过程；read 方法仅会获取当时的数据一次，不会监听数据源的变化。
4. `context.select` 方法
    此方法同 `Selector` ，可以选择性监听数据源对应的数据变化。

## 2. Provider 原理浅析

Provider 底层还是基于 `InheritedWidget` 的相关机制。请看详细分析。

### 2.1 声明数据源

如 1.1 节中的声明后，最终生成的是一个 `InheritedProvider<T>` 类。其 build 时的代码如下：

```dart
@override
Widget buildWithChild(BuildContext context, Widget? child) {
  assert(
    builder != null || child != null,
    '$runtimeType used outside of MultiProvider must specify a child',
  );
  return _InheritedProviderScope<T?>(
    owner: this,
    // ignore: no_runtimetype_tostring
    debugType: kDebugMode ? '$runtimeType' : '',
    child: builder != null
        ? Builder(
            builder: (context) => builder!(context, child),
          )
        : child!,
  );
}
```

显然，这里就是创建了一个 `_InheritedProviderScope` 对象。该对象继承了 `InheritedWidget` 类，其 Element 也继承了 `InheritedElement` 类。

```dart
class _InheritedProviderScope<T> extends InheritedWidget {
  const _InheritedProviderScope({
    required this.owner,
    required this.debugType,
    required Widget child,
  })  : assert(null is T),
        super(child: child);

  final InheritedProvider<T> owner;
  final String debugType;

  @override
  bool updateShouldNotify(InheritedWidget oldWidget) {
    return false;
  }

  @override
  _InheritedProviderScopeElement<T> createElement() {
    return _InheritedProviderScopeElement<T>(this);
  }
}

class _InheritedProviderScopeElement<T> extends InheritedElement
    implements InheritedContext<T> ...
```

这下可以很明显的得到本节开头的结论：Provider 就是基于 `InheritedWidget` 的。

下面接着看 `_InheritedProviderScopeElement` 是如何实现的。

```dart
class _InheritedProviderScopeElement<T> extends InheritedElement
    implements InheritedContext<T> {
  _InheritedProviderScopeElement(_InheritedProviderScope<T> widget)
      : super(widget);

  static int _nextProviderId = 0;

  bool _shouldNotifyDependents = false;
  bool _debugInheritLocked = false;
  bool _isNotifyDependentsEnabled = true;
  bool _updatedShouldNotify = false;
  bool _isBuildFromExternalSources = false;
  // 这里不同的创建方式，生成的 delegate 实例也不同
  late final _DelegateState<T, _Delegate<T>> _delegateState =
      widget.owner._delegate.createState()..element = this;  
  late String _debugId;

  // 这个方法重写了，导致与默认的实现不一样。
  // 目前会沿着树依次往上查找，实现上类似于 context.findAncestorWidgetOfExactType()
  // 默认实现是直接保存在一个 Map 中，查找时根据 Type 返回
  @override
  InheritedElement? getElementForInheritedWidgetOfExactType<
      InheritedWidgetType extends InheritedWidget>() {
    InheritedElement? inheritedElement;

    // An InheritedProvider<T>'s update tries to obtain a parent provider of
    // the same type.
    visitAncestorElements((parent) {
      inheritedElement =
          parent.getElementForInheritedWidgetOfExactType<InheritedWidgetType>();
      return false;
    });
    return inheritedElement;
  }
```

在其 `updateDependencies` 方法，会判断 `aspect` 是不是由 `context.select` 传入的方法，若是将 `aspect` 保存到 `_Dependency` 对象中，然后保存到 `InheritedElement._dependents` 中。  
若 `apsect` 不是一个 `_SelectorAspect`，则保存一个 Object 到 `InheritedElement._dependents` 中。表示，对任何数据都感兴趣，不需要进行 selector。

`InheritedElement._dependents` 是一个 Map 对象，`getDependencies`、`setDependencies` 都是操作的这个 Map。Map 的 key 是一个个 Element，对应着一个个 `BuildContext`。所以，**同一个 `BuildContext` 上的 `aspect` 会进行覆盖**。

```dart
/// packages/flutter/lib/src/widgets/framework.dart
class InheritedElement extends ProxyElement {
  ...
  final Map<Element, Object?> _dependents = HashMap<Element, Object?>();

  @protected
  Object? getDependencies(Element dependent) {
    return _dependents[dependent];
  }

  @protected
  void updateDependencies(Element dependent, Object? aspect) {
    setDependencies(dependent, null);
  }

  @override
  void updated(InheritedWidget oldWidget) {
    if ((widget as InheritedWidget).updateShouldNotify(oldWidget)) {
      super.updated(oldWidget);
    }
  }
  ...
}


/// inherited_provider.dart
typedef _SelectorAspect<T> = bool Function(T value);

class _Dependency<T> {
  bool shouldClearSelectors = false;
  bool shouldClearMutationScheduled = false;
  final selectors = <_SelectorAspect<T>>[];
}

@override
void updateDependencies(Element dependent, Object? aspect) {
  final dependencies = getDependencies(dependent);
  // once subscribed to everything once, it always stays subscribed to everything
  if (dependencies != null && dependencies is! _Dependency<T>) {
    return;
  }

  if (aspect is _SelectorAspect<T>) {
    final selectorDependency =
        (dependencies ?? _Dependency<T>()) as _Dependency<T>;
    ...
    selectorDependency.selectors.add(aspect);
    setDependencies(dependent, selectorDependency);
  } else {
    // subscribes to everything
    setDependencies(dependent, const Object());
  }
}
```

`notifyDependent` 方法会判断保存的 selector，若有一个返回 true，则表示需要刷新。  
若没有保存 selector，则默认会刷新。
刷新会调用 `Element.didChangeDependencies` 方法，此方法内部会调用 `Element.markNeedsBuild` 方法。

```dart
@override
void notifyDependent(InheritedWidget oldWidget, Element dependent) {
  final dependencies = getDependencies(dependent);

  if (kDebugMode) {
    ProviderBinding.debugInstance.providerDidChange(_debugId);
  }

  var shouldNotify = false;
  if (dependencies != null) {
    if (dependencies is _Dependency<T>) {
      // select can never be used inside `didChangeDependencies`, so if the
      // dependent is already marked as needed build, there is no point
      // in executing the selectors.
      if (dependent.dirty) {
        return;
      }

      for (final updateShouldNotify in dependencies.selectors) {
        try {
          assert(() {
            _debugIsSelecting = true;
            return true;
          }());
          shouldNotify = updateShouldNotify(value);
        } finally {
          assert(() {
            _debugIsSelecting = false;
            return true;
          }());
        }
        if (shouldNotify) {
          break;
        }
      }
    } else {
      shouldNotify = true;
    }
  }

  if (shouldNotify) {
    dependent.didChangeDependencies();
  }
}
```

然后看看刷新相关的方法：

1. 在 `update` 时，记录 `_delegateState.willUpdateDelegate` 的返回值，后续用来控制 `notifyClients` 方法的调用与否。  
    直接与值打交道的 `_DelegateState` 会重写此方法，以控制后续刷新。一般情况下默认返回 false。
2. 调用 `super.update(newWidget)`，这里会先调用 `updated` 方法，然后调用 `rebuild(force: true)`。
3. 回到 `updated` 方法，这里的 `super` 是 `InheritedElement`，其 `updated` 会由 `(widget as InheritedWidget).updateShouldNotify(oldWidget)` 判断是否继续调用 `super.updated`。由于这里的 widget 是 `_InheritedProviderScope`，其 `updateShouldNotify` 方法直接返回了 false。所以 `super.updated` 什么也没做。  
    实际上 `InheritedElement` 的 `super.updated` 干的就是调用 `notifyClients` 方法。由于 `_InheritedProviderScopeElement` 默认不会 `notifyClients`，所以`_delegateState.willUpdateDelegate` 的返回值就用来控制是否 `notifyClients` 了。
4. `InheritedElement.notifyClients `方法会对保存的所有的 key，分别调用 `notifyDependent` 方法，这也就回到了上一个代码块的内容了。

```dart
@override
void update(_InheritedProviderScope<T> newWidget) {
  ...
  _isBuildFromExternalSources = true;
  _updatedShouldNotify =
      _delegateState.willUpdateDelegate(newWidget.owner._delegate);
  super.update(newWidget);
  _updatedShouldNotify = false;
}

@override
void updated(InheritedWidget oldWidget) {
  super.updated(oldWidget);
  if (_updatedShouldNotify) {
    notifyClients(oldWidget);
  }
}
```

???+ quote "_InheritedProviderScope 小结"
    _InheritedProviderScope 直接继承了 InheritedWidget。该类主要是对刷新机制做了一定的扩展。包括`_delegateState.willUpdateDelegate` 以及 `selector`。

### 2.2 使用数据源

#### 2.2.1 Consumer

Consumer 的实现非常简单，仅仅利用一下 `Provider.of` 方法即可。

```dart
class Consumer<T> extends SingleChildStatelessWidget {
  /// {@template provider.consumer.constructor}
  /// Consumes a [Provider<T>]
  /// {@endtemplate}
  Consumer({
    Key? key,
    required this.builder,
    Widget? child,
  }) : super(key: key, child: child);

  /// {@template provider.consumer.builder}
  /// Build a widget tree based on the value from a [Provider<T>].
  ///
  /// Must not be `null`.
  /// {@endtemplate}
  final Widget Function(
    BuildContext context,
    T value,
    Widget? child,
  ) builder;

  @override
  Widget buildWithChild(BuildContext context, Widget? child) {
    return builder(
      context,
      Provider.of<T>(context),
      child,
    );
  }
}
```

#### 2.2.2 Selector

Selector 在实现上也是利用了 `Provider.of` 方法。但在其 `build` 时，会判断是不是需要 rebuild，若不需要 rebuild 则返回 cache。  

判断规则如下：

1. 俩 `widget` 是否相等
2. 若有提供 `_shouldRebuild` 方法，则调用该方法来判断老值与新值是否等价
3. 若没有提供 `_shouldRebuild` 方法，则调用 `DeepCollectionEquality().equals` 方法判断新老值之间是否等价。这个方法支持 Set Map List Iterator 这些数据集合的深度比较（会拿出里面的元素进行比较），对于其他类型会由 DefaultEquality 进行比较，也就是调用 `==` 操作符。  

这个默认操作比较全面了，一般情况下，都不需要自己提供另外的 `_shouldRebuild` 方法。

```dart
class Selector<A, S> extends Selector0<S> {
  /// {@macro provider.selector}
  Selector({
    Key? key,
    required ValueWidgetBuilder<S> builder,
    required S Function(BuildContext, A) selector,
    ShouldRebuild<S>? shouldRebuild,
    Widget? child,
  }) : super(
          key: key,
          shouldRebuild: shouldRebuild,
          builder: builder,
          selector: (context) => selector(context, Provider.of(context)), // 🔔
          child: child,
        );
}

class Selector0<T> extends SingleChildStatefulWidget {
  /// Both `builder` and `selector` must not be `null`.
  Selector0({
    Key? key,
    required this.builder,
    required this.selector,
    ShouldRebuild<T>? shouldRebuild,
    Widget? child,
  })  : _shouldRebuild = shouldRebuild,
        super(key: key, child: child);

  /// A function that builds a widget tree from `child` and the last result of
  /// [selector].
  ///
  /// [builder] will be called again whenever the its parent widget asks for an
  /// update, or if [selector] return a value that is different from the
  /// previous one using [operator==].
  ///
  /// Must not be `null`.
  final ValueWidgetBuilder<T> builder;

  /// A function that obtains some [InheritedWidget] and map their content into
  /// a new object with only a limited number of properties.
  ///
  /// The returned object must implement [operator==].
  ///
  /// Must not be `null`
  final T Function(BuildContext) selector;

  final ShouldRebuild<T>? _shouldRebuild;

  @override
  _Selector0State<T> createState() => _Selector0State<T>();
}

class _Selector0State<T> extends SingleChildState<Selector0<T>> {
  T? value;
  Widget? cache;
  Widget? oldWidget;

  @override
  Widget buildWithChild(BuildContext context, Widget? child) {
    final selected = widget.selector(context);

    final shouldInvalidateCache = oldWidget != widget ||
        (widget._shouldRebuild != null &&
            widget._shouldRebuild!(value as T, selected)) ||
        (widget._shouldRebuild == null &&
            !const DeepCollectionEquality().equals(value, selected));
    if (shouldInvalidateCache) {
      value = selected;
      oldWidget = widget;
      cache = Builder(
        builder: (context) => widget.builder(
          context,
          selected,
          child,
        ),
      );
    }
    return cache!;
  }

  @override
  void debugFillProperties(DiagnosticPropertiesBuilder properties) {
    super.debugFillProperties(properties);
    properties.add(DiagnosticsProperty<T>('value', value));
  }
}
```

#### 2.2.3 context 扩展

`context.read`、`context.watch` 也是非常简单的直接使用了 `Provider.of` 方法。


```dart
extension ReadContext on BuildContext {
  T read<T>() {
    return Provider.of<T>(this, listen: false);
  }
}

extension WatchContext on BuildContext {
  T watch<T>() {
    return Provider.of<T>(this);
  }
}
```

至于 `selector`，则麻烦了一点。这里首先调用 `Provider._inheritedElementOf<T>(this)` 获取到目 T 所对应的 `_InheritedProviderScopeElement<T?>`。此方法的细节下面会谈到。

然后获取到老值 `selected`，调用 `dependOnInheritedElement` 方法。注意其参数 aspect，这就是上面说到的 `_SelectorAspect`，里面也是调用了 `DeepCollectionEquality().equals` 方法来比较老值与新值。

```dart
extension SelectContext on BuildContext {
  R select<T, R>(R Function(T value) selector) {
    ...
    final inheritedElement = Provider._inheritedElementOf<T>(this);
    try {
      final value = inheritedElement?.value;
      ...
      final selected = selector(value);

      if (inheritedElement != null) {
        dependOnInheritedElement(
          inheritedElement,
          aspect: (T? newValue) {
            if (newValue is! T) {
              throw ProviderNullException(T, widget.runtimeType);
            }

            return !const DeepCollectionEquality()
                .equals(selector(newValue), selected);
          },
        );
      } else {
        // tell Flutter to rebuild the widget when relocated using GlobalKey
        // if no provider were found before.
        dependOnInheritedWidgetOfExactType<_InheritedProviderScope<T?>>();
      }
      return selected;
    } finally {
      assert(() {
        _debugIsSelecting = false;
        return true;
      }());
    }
  }
}
```

然后看看 `dependOnInheritedElement` 方法的实现：

```dart
@override
InheritedWidget dependOnInheritedElement(InheritedElement ancestor, { Object? aspect }) {
  _dependencies ??= HashSet<InheritedElement>();
  _dependencies!.add(ancestor);
  ancestor.updateDependencies(this, aspect);
  return ancestor.widget as InheritedWidget;
}
```

这里将 `inheritedElement` 添加到了 `_dependencies` 集合中，在 `notifyClients` 方法中会调用到其 `didChangeDependencies` 方法。  
然后调用了 `inheritedElement.updateDependencies` 方法，将 aspect 保存到 `_dependents` Map 中，待后续刷新时调用以此判断是否需要刷新，详见 2.1 节。

这样，`context.select` 就完成了数据的选择过程，而不是数据源中的每个更新都会影响到自己的刷新。

#### 2.2.4 Provider.of

对数据源的使用，都离不来 `Provider.of` 方法。此方法的实现也比较简单，最后还是利用 `dependOnInheritedElement` 建立深层次的依赖关系。

```dart
/// provider.dart
static T of<T>(BuildContext context, {bool listen = true}) {
  ...
  // 1. 获取到对应的 _InheritedProviderScopeElement<T?>
  final inheritedElement = _inheritedElementOf<T>(context);

  // 2. 如果监听数据变化，则建立依赖
  if (listen) {
    // bind context with the element
    // We have to use this method instead of dependOnInheritedElement, because
    // dependOnInheritedElement does not support relocating using GlobalKey
    // if no provider were found previously.
    context.dependOnInheritedWidgetOfExactType<_InheritedProviderScope<T?>>();
  }

  // 3. 获取值并返回
  final value = inheritedElement?.value;

  if (_isSoundMode) {
    if (value is! T) {
      throw ProviderNullException(T, context.widget.runtimeType);
    }
    return value;
  }

  return value as T;
}
```

这里看看第一步，如何获取到对应的 `_InheritedProviderScopeElement<T?>`。  
这里会调用 `context.getElementForInheritedWidgetOfExactType` 获取到`_InheritedProviderScopeElement<T?>`。  
这个方法 `_InheritedProviderScopeElement` 自身也实现了，`Element` 类也实现了，具体是怎么获取的需要看 `context` 是什么类型。

```dart
static _InheritedProviderScopeElement<T?>? _inheritedElementOf<T>(
  BuildContext context,
) {
  ...
  final inheritedElement = context.getElementForInheritedWidgetOfExactType<
      _InheritedProviderScope<T?>>() as _InheritedProviderScopeElement<T?>?;

  if (inheritedElement == null && null is! T) {
    throw ProviderNotFoundException(T, context.widget.runtimeType);
  }

  return inheritedElement;
}

/// Element
@override
InheritedElement? getElementForInheritedWidgetOfExactType<T extends InheritedWidget>() {
  assert(_debugCheckStateIsActiveForAncestorLookup());
  final InheritedElement? ancestor = _inheritedElements == null ? null : _inheritedElements![T];
  return ancestor;
}
```

然后是第二步，看看 `context.dependOnInheritedWidgetOfExactType<_InheritedProviderScope<T?>>()` 如何实现监听。  
首先，还是先获取到对应的 Element，然后调用 `dependOnInheritedElement` 方法。此方法 2.2.3 节谈过。  

> 这里将 `inheritedElement` 添加到了 `_dependencies` 集合中，在 `notifyClients` 方法中会调用到其 `didChangeDependencies` 方法。  
> 然后调用了 `inheritedElement.updateDependencies` 方法，将 aspect 保存到 `_dependents` Map 中，待后> 续刷新时调用以此判断是否需要刷新，详见 2.1 节。
>
> 但由于此处传入的 aspect 为空，在 `_InheritedProviderScopeElement.updateDependencies` 会将一个 Object 对象保存起来，导致在 `notifyDependent` 方法时，不需要进行 selector 判断进而导致直接刷新。  
> 这也就契合了 Provider.of 当 listen 时会接受所有数据的目的了。

```dart
/// Element
@override
T? dependOnInheritedWidgetOfExactType<T extends InheritedWidget>({Object? aspect}) {
  assert(_debugCheckStateIsActiveForAncestorLookup());
  final InheritedElement? ancestor = _inheritedElements == null ? null : _inheritedElements![T];
  if (ancestor != null) {
    return dependOnInheritedElement(ancestor, aspect: aspect) as T;
  }
  _hadUnsatisfiedDependencies = true;
  return null;
}
```


## 3. 小结

`Provider` 组件基于 `InheritedWidget`，其扩展了一些刷新策略来控制组件刷新。

三个刷新策略：

1.   _InheritedProviderScope.updateShouldNotify
2. _InheritedProviderScope.updateDependencies 以及 _InheritedProviderScope.notifyDependent 里面的 select 机制，这是以 Element 为 Key 的来保存 selector 的。
3. _delegateState.willUpdateDelegate 

在使用上：  

- 可以使用 `context.watch` 或者 `Consumer` 来获取全部数据变动。  
- 也可以使用 `context.select` 或者 `Selector` 来获取特定数据变动；前者的实现逻辑深度依赖于 `_InheritedProviderScopeElement`，后者在自己的 Widget 中完成。  
- 还可以使用 `context.read` 读取数据，这不会监听数据变动。
