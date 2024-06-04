---
title: "Flutter 文本编辑器——记自研 Markdown 编辑器 MooD"
tags:
  - Flutter  
  - Flutter Desktop
---

## 1. Markdown 语法检测与展示

Flutter 自身有一个官方出的 `markdown` 库，可以用来解析 markdown 文本并生成 html 文本。基于此库，诞生了其他一些第三方的开箱即用的库。  
但是这些库不是以实时编辑并渲染为目的的，所以在性能或者其他方面，达不到想要的效果。  
因此这里以 TextField 为基础，实现了一个轻量级的 markdown 语法解析的编辑器。

Flutter 中富文本支持比较原始：

1. 对于 `Text`，可以使用 `Text.rich`，接受 `InlineSpan` 作为参数。这适用于展示固定的文本
2. 对于 `TextField`，可以自定义 `TextEditingController`，通过重写其 `buildTextSpan` 方法来将 String 转为 `TextSpan`。

InlineSpan 有两个最终的实现类 ：TextSpan 和 WidgetSpan。TextSpan 用来对文本设置各种样式；而 WidgetSpan 则用来在文本中展示 Widget。

TextSpan 的构造器如下：

```dart
  const TextSpan({
    this.text,
    this.children,
    super.style,
    this.recognizer,
    MouseCursor? mouseCursor,
    this.onEnter,
    this.onExit,
    this.semanticsLabel,
    this.locale,
    this.spellOut,
  })

  final String? text;
  final List<InlineSpan>? children;
  final GestureRecognizer? recognizer;
```

其重点的属性解释如下：

- style ：文本的样式，也会自动应用到 children 中
- text ：文本
- children ：是一个 InlineSpan 数组，这也意味着里面可以放 TextSpan 或者 WidgetSpan；而 TextSpan 又可以放TextSpan 或者 WidgetSpan，这也就意味着可以套娃——利用递归算法分段处理文本，添加到 children 中。
- recognizer ：顾名思义，可以识别手势。常见的例子就是使用 `TapGestureRecognizer` 为特定文本添加一个点击事件。

利用好 children 属性，我们很容易就可以将一段文字根据自己的规则转为富文本，如下面的例子。

<figure class="align-center" style="width: 400px">
  <img src="/assets/images/flutter/image.png"/>
  <figcaption>富文本套娃实例</figcaption>
</figure>

这里首先将整段文本根据一定的规则转为3个部分，这 3 部分就组成的根 TextSpan 的 children。然后这 3 个
部分也可以根据各自的规则，继续将自身的文本转为各自的 children 或者 text。这就是一个递归的过程。
 
当然，在这个应用中，由于 Markdown 语法的特别之处，可以将整个文本先划为不同的 block，然后在不同的 block 中进行各种 inline 语法的检测。  

首先是 block 的检测，这里主要检测代码块、引用块、列表以及各级标题。  
首先把这些语法的正则表达式用 `|` 连接成一个字符串，对整个文本进行匹配，这样就将文本化成一个个的匹配块或者未匹配块。  

对匹配到的文本块逐个与各 `BlockSyntax` 进行二次匹配，这样可以得到具体的 `BlockSyntax`，进而为此文本块的文本样式加上 `BlockSyntax` 所定义的样式。  
特别的，对于代码块来说，实时高亮耗时比较高，且代码里面也不需要检测其他 markdown 语法，所以调用了 `formatInlineSyntax` 方法，将代码块转为一个 `InlineSpan`。  
同时，对代码块以及引用块，由于会有背景色的需求，这里会将文本的范围以及颜色保存起来，供 `CustomPainter` 绘制使用。

其他的文本块则需要调用 `handleInline` 方法，进行进一步的 inline 语法检测。

```dart
class MarkdownTextEngine {
  ...
  TextSpan parseText(String text, TextStyle? style, bool useMarkdownStyles) {
    ...
    final children = handle(_context, text, style);

    return TextSpan(style: style, children: children);
  }

  List<InlineSpan> handle(BuildContext context, String text, TextStyle? parentStyle) {
    final List<InlineSpan> textSpanChildren = <InlineSpan>[];

    int consumed = 0;
    _blockPattern!.allMatches(text).forEach((match) {
      if (match.start >= consumed) {
        // [consumed, match.start) is not matched
        textSpanChildren.add(
            TextSpan(style: parentStyle, children: handleInline(text.substring(consumed, match.start), parentStyle)));
        consumed = match.start;

        // [match.start, match.end) is matched
        String matched = match.group(0)!;
        consumed = match.end;
        final BlockSyntax? syntax = _blockSyntaxBulk!.getSyntaxWithMatchedText(matched, text);
        if (syntax == null) return;
        // check continue match
        if (syntax.continueMatch) {
          consumed = syntax.onContinueMatch(text, consumed);
        }
        matched = text.substring(match.start, consumed);

        final style = parentStyle?.merge(syntax.solveStyle(matched)) ?? syntax.solveStyle(matched);
        bool isDecorationBlockSyntax = syntax is DecorationBlockSyntax;

        if (isDecorationBlockSyntax) {
          _codeBlockOffsets.add((match.start, consumed, syntax.color));
        }
        if (syntax is CodeBlockMatcher || syntax is FencedCodeBlockMatcher) {
          textSpanChildren.add(TextSpan(style: style, children: [formatInlineSyntax(matched, style, null)]));
        } else {
          textSpanChildren.add(TextSpan(style: style, children: handleInline(matched, style)));
        }
      }
    });
    // [consumed, length) is not matched
    if (consumed < text.length) {
      textSpanChildren.add(
          TextSpan(style: parentStyle, children: handleInline(text.substring(consumed), parentStyle)));
      consumed = text.length;
    }

    return textSpanChildren;
  }
```

对于 inline 语法检测，同样也定义了一些诸如内连代码块、粗体、斜体、图片、引用之类的语法检测器。  
整体操作也类似于上面 block，依旧是检测语法，然后合并样式。最后将一小段一小段的文本转为 `InlineSpan`，作为 children 的一部分。

```dart
  List<InlineSpan> handleInline(String text, TextStyle? parentStyle) {
    final List<InlineSpan> textSpanChildren = <InlineSpan>[];
    text.splitMapJoin(
      _inlinePattern!,
      onMatch: (Match match) {
        // inline syntax
        String matched = match.group(0)!;

        final Syntax? syntax =
        _inlineSyntaxBulk!.getSyntaxWithMatchedText(matched, text);

        if (syntax == null) return '';
        OnLinkTap? onLinkTap;
        if (syntax is TapInlineSyntax) {
          onLinkTap = syntax.onLinkTap;
        }

        final style = parentStyle?.merge(syntax.solveStyle(matched)) ?? syntax.solveStyle(matched);
        textSpanChildren.add(formatInlineSyntax(matched, style, onLinkTap));

        return '';
      },
      onNonMatch: (String nonMatch) {
        // normal text
        final style = parentStyle;
        textSpanChildren.add(formatInlineSyntax(nonMatch, style, null));

        return '';
      },
    );

    return textSpanChildren;
  }
```

最后的 `formatInlineSyntax` 部分是比较简单的，将文本、样式、可能的点击事件组成一个 `TextSpan` 即可。  
不过情况在涉及到搜索高亮时，有一点点麻烦。

```dart
  InlineSpan formatInlineSyntax(
      String textToBeStyled,
      TextStyle? style,
      OnLinkTap? onLinkTap,
      ) {
    if (showSearchResult) {
      return formatWhileSearching(textToBeStyled, style, onLinkTap);
    } else {
      return TextSpan(
          text: textToBeStyled,
          style: style,
          recognizer:
          _buildRecognizerFromOnTapLink(onLinkTap, text, textToBeStyled));
    }
  }

  TapGestureRecognizer? _buildRecognizerFromOnTapLink(
      OnLinkTap? onLinkTap, String text, String link) {
    if (onLinkTap == null) {
      return null;
    }
    final recognizer = TapGestureRecognizer()
      ..onTap = () => onLinkTap(text, link);
    _tapGestureRecognizerList.add(recognizer);
    return recognizer;
  }
```

在处理搜索高亮情况时，也是需要将高亮的 style 合并到已有的 style 上，这里主要是需要考虑搜索结果的区间与一小段一小段文本的情况。好在，需要高亮搜索结果时，所有 TextSpan 的生成都在这，所以可以统计到已经处理的文本长度，这样与搜索结果区间的比较也可以办到了。

```dart
  TextSpan formatWhileSearching(
      String textToBeStyled,
      TextStyle? style,
      OnLinkTap? onLinkTap,
      ) {
    int textStart = buildingTextLength;
    buildingTextLength = textStart + textToBeStyled.length;
    int textEnd = buildingTextLength;

    TextSpan textSpan;

    if (matchingIndex >= matchList.length) {
      // 所有匹配项都处理过了
      textSpan = TextSpan(text: textToBeStyled, style: style);
    } else {
      // 还有要处理的匹配项
      final match = matchList[matchingIndex];
      int matchStart = match.start;
      int matchEnd = match.end;
      if (textStart <= matchStart && matchStart < textEnd) {
        // matchStart落在了text中，需要处理
        if (matchEnd <= textEnd) {
          // 完全消耗了
          // [textStart, matchStart) [matchStart, matchEnd) [matchEnd, textEnd)
          textSpan = TextSpan(
            children: [
              TextSpan(
                text: text.substring(textStart, matchStart),
                style: style,
                recognizer: _buildRecognizerFromOnTapLink(
                    onLinkTap, text, textToBeStyled),
              ),
              TextSpan(
                  text: text.substring(matchStart, matchEnd),
                  style: style?.merge(_searchMatchedStyle)),
            ],
            recognizer:
            _buildRecognizerFromOnTapLink(onLinkTap, text, textToBeStyled),
          );
          matchingIndex++;

          // 继续递归调用，处理[matchEnd, textEnd)还能消费匹配的情况
          buildingTextLength -= (textEnd - matchEnd);
          textSpan.children!.add(formatWhileSearching(
              text.substring(matchEnd, textEnd), style, onLinkTap));
        } else {
          // 部分消耗
          // [textStart, matchStart) [matchStart, textEnd)
          // [0, matchStart - textStart) [matchStart - textStart)
          textSpan = TextSpan(
            children: [
              TextSpan(
                  text: text.substring(textStart, matchStart), style: style),
              TextSpan(
                  text: text.substring(matchStart, textEnd),
                  style: style?.merge(_searchMatchedStyle)),
            ],
            recognizer:
            _buildRecognizerFromOnTapLink(onLinkTap, text, textToBeStyled),
          );
          // 由于是部分消耗，消费下当前匹配结果的值
          matchList[matchingIndex] = SearchMatch(
              start: textEnd,
              end: matchEnd,
              input: match.input,
              pattern: match.pattern);
        }
      } else {
        // 左区间不匹配，不需要处理
        textSpan = TextSpan(
          text: textToBeStyled,
          style: style,
          recognizer:
          _buildRecognizerFromOnTapLink(onLinkTap, text, textToBeStyled),
        );
      }
    }

    return textSpan;
  }
```

## 2. Block 背景色的实现

![mood_block_background](/assets/images/flutter/mood_block_background.png)

为了实现给一块块的文本上背景色这个功能，起初是想利用 WidgetSpan，在里面套一个 Container 即可解决。

实践起来发现，对于 Block 本身来说，效果是可以达到的。但是对于 Block 后面的文本，会出现在 WidgetSpan 的下方，这种重叠无法通过调整参数来解决。怀疑是 Flutter 没法处理这种竖直方向上的混排问题导致。

无可奈何，只能尝试利用 CustomPainter 自行绘制背景色。在上面一节解析 markdown 语法时，我们已经保存了 Block 的区间以及对应的颜色，所以自绘的关键就是如何通过文本区间计算出坐标。  

这里可以可以先通过 `context.visitChildElements` 找到 `TextField` 里面的 `EditableText`，进而可以通过 key 获取到 `EditableTextState`。然后获取其 `RenderEditable`，调用 `getEndpointsForSelection` 就能获取对应文本的坐标了。  
这个思路在实现很多文本操作时都非常有用。

下面是关键代码：

```dart
CustomPaint(
  painter: _WriterBackgroundPaint(
    context: context,
    controller: markdownTextFieldController,
    scrollController: scrollController,
  ),
  isComplex: true,
  willChange: true,
  child: TextField(
    controller: markdownTextFieldController,
    ...

class _WriterBackgroundPaint extends CustomPainter {
  final BuildContext context;
  final MarkdownTextFieldController controller;
  final ScrollController scrollController;

  EditableTextState? _editableTextState;
  late Paint _paint;

  _WriterBackgroundPaint(
      {required this.context,
      required this.controller,
      required this.scrollController})
      : super(repaint: scrollController) {
    _paint = Paint()
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.fill;
  }

  @override
  void paint(Canvas canvas, Size size) {
    ensureEditableTextState();
    _paintBlockColor(canvas, size);
  }

  void _paintBlockColor(Canvas canvas, Size size) {
    final list = controller.codeBlockOffsets;
    if (list.isEmpty) return;

    for (var element in list) {
      var (top, bottom) = _calcTextRectTopBottom(
          TextSelection(baseOffset: element.$1, extentOffset: element.$2));
      if (bottom < 0 || top > size.height) continue;
      var rect =
          Rect.fromLTRB(0, max(top, 0), size.width, min(bottom, size.height));
      _paint.color = element.$3;
      canvas.drawRRect(
          RRect.fromRectAndRadius(rect, const Radius.circular(4)), _paint);
    }
  }

  void ensureEditableTextState() {
    if (_editableTextState == null || !_editableTextState!.mounted) {
      _editableTextState = TextFieldOperator.findEditableTextState(context);
    }
  }

  @override
  bool shouldRepaint(covariant _WriterBackgroundPaint oldDelegate) {
    return true;
  }

  (double, double) _calcTextRectTopBottom(TextSelection selection) {
    final RenderEditable renderBox = _editableTextState!.renderEditable;

    final selectionEndpoints = renderBox.getEndpointsForSelection(selection);

    final lineHeight = renderBox.preferredLineHeight;
    const offset = 4.0;

    return (
      selectionEndpoints.first.point.dy - lineHeight + offset,
      selectionEndpoints.last.point.dy + offset
    );
  }
}
```

## 3. 文本操作  

文本编辑器在处理文本操作时需要使用到现成的一些 API：

1. 使用 `TextEditingController.selection` 获取选中的文本的范围。  
    由于 `TextSelection` 继承了 `TextRange`，所以用的最多的还是 `TextRange` 的 `start` 以及 `end` 属性。若两个属性相等，则表示处于收缩(collapsed)状态。  
2.  `TextEditingController` 继承了 `ValueNotifier<TextEditingValue>`；`EditableTextState.textEditingValue` 也是 `TextEditingValue` 类型。实际上，想直接操作文本，就直接修改此变量即可。这样方式更可控，使用底层源码中提炼出来的一些 public API，可能会出现意想不到的一些情况。
3. 正则表达式：这里使用了相当多的正则表达式来检索与处理文本，且 app 内的搜索也是使用的内置的正则表达式来完成的。在测试时发现，内置的文本搜索算法比手搓的要快3倍左右，同时支持大小写等参数。实际例子太多了，就不一一列举了。

这是打开新文件场景下，`TextFieldController` 填充文本的代码。

```dart
final selection = markdownTextFieldController.selection;
markdownTextFieldController.value =
    markdownTextFieldController.value.copyWith(
  text: content,
  selection: selection.isCollapsed
      ? selection
      : TextSelection.collapsed(offset: selection.extentOffset),
);
```

这是其他文本操作场景下的代码，新增、删除、修改都可以通过这个方法实现，这段代码含义就是将 `selection` 表示的文本替换成 `data`，替换后将 selection 置为 `afterSelection`：

```dart
static void replaceSelection(BuildContext context, String data, {TextSelection? selection, TextSelection? afterSelection, bool Function(EditableText)? where}) {print
  EditableTextState? state = getEditableTextState(context, where: where);
  if (state == null) {
    return;
  }

  selection ??= state.textEditingValue.selection;
  final textEditingValue = state.textEditingValue;

  final TextEditingValue collapsedTextEditingValue = textEditingValue.copyWith();
  final newValue = collapsedTextEditingValue.replaced(selection, data);
  state.updateEditingValue(newValue);
  
  afterSelection?.let((it) {
    state.textEditingValue.copyWith(
      selection: it
    );
  });
}
```

## 4. Desktop 相关

### 4.1 快捷键

快捷键的配置可以配置在 `MaterialApp` 的 `shortcuts`、`actions` 属性上，也可以通过 `Shortcuts`、`Actions` Widget 来配置。

shortcuts 配置的是 组合键——Intent 的 map，而 actions 则需要定义具体的 Intent 如何响应。

???+ tip "不同平台快捷键的不同"
    Windows 平台的 Ctrl 键使用 control 属性；MacOS 平台的 command 键使用 meta 属性。

由于快捷键在触发时会依次向上查找对应的 Action，而内置的一些 Action 都在非常顶层的位置，所以我们通常可以通过重新定义 `Actions` 来达到优先响应的目的。  
比如这里就通过了这样的方式，达到了拦截 `TextField` 粘贴事件的目的：

```dart
Widget wrapKeyboard(
    {required BuildContext context, required Widget child}) {
  final pasteTextAction = {
    PasteTextIntent: CallbackAction<PasteTextIntent>(onInvoke: (intent) {
      ClipboardImage.handlePaste().then((value) {
        if (value == null) {
          TextFieldOperator.findEditableTextState(context)
              ?.pasteText(SelectionChangedCause.keyboard);
        } else {
          TextFieldOperator.saveInsertImage(context, value.$1!,
              format: ClipboardImage.getHumanFriendlyFileFormat(value.$2));
          return null;
        }
      });
      return;
    }),
  };

  return Actions(
    actions: pasteTextAction,
    child: TextField(...),
  );
}
```

### 4.2 菜单

由于 MacOS 有顶部菜单栏，这里可以使用 `PlatformMenuBar`、`PlatformMenu`、`PlatformMenuItemGroup` 以及 `PlatformMenuItem` 组合达到这一目的。但该功能仅在 MacOS 上生效，需要提前判断一下平台，然后决定裹不裹。

`PlatformMenuBar` 下每一个 `PlatformMenu` 表示一个菜单 Tab。  
`PlatformMenu` 的子元素可以是`PlatformMenuItemGroup` 或者 `PlatformMenuItem`。由于 `PlatformMenu` 的子元素里面的每一个元素间都会有一个分割线，所以就需要 `PlatformMenuItemGroup` 达到菜单分组的目的。

此外，由于这里面的 API 没有选不选中的状态，所以考虑用文字`✓`间接达到目的。

```dart
enum MenuSelection { about, togglePreview, project }

class MacOSMenu extends StatefulWidget {
  const MacOSMenu({super.key, required this.child});

  final Widget child;

  @override
  State<MacOSMenu> createState() => _MacOSMenuState();
}

class _MacOSMenuState extends State<MacOSMenu> {
  @override
  Widget build(BuildContext context) {
    return PlatformMenuBar(
      menus: [
        _appMenu(),
        _fileMenu(),
        _editMenu(),
        _viewMenu(),
        _windowMenu(),
        _helpMenu(),
      ],
      child: widget.child,
    );
  }

  PlatformMenu _viewMenu() {
    return PlatformMenu(label: L10n.t.view, menus: [
      PlatformMenuItemGroup(members: [
        PlatformMenu(label: L10n.t.theme, menus: _themeMenus(context)),
      ]),
      PlatformMenuItemGroup(members: [
        PlatformMenuItem(
          label: L10n.t.toggle_preview,
          onSelected: () {
            handleSelection(context, MenuSelection.togglePreview);
          },
        ),
      ]),
    ]);
  }

  List<PlatformMenuItem> _themeMenus(BuildContext context) {
    String getLabel(bool isChecked, String label) {
      return "${isChecked ? '✓' : '   '} $label";
    }

    final settingsService = context.read<SettingsService>();
    String currentTheme =
    settingsService.getString(SettingsConfig.kItemTheme)!;
    return [
      PlatformMenuItem(
        label: getLabel(currentTheme == SettingsConfig.kThemeLight, L10n.t.light),
        onSelected: () {
          SettingsService().setString(
              SettingsConfig.kItemTheme, SettingsConfig.kThemeLight);
          setState(() {});
        },
      ),
      PlatformMenuItem(
        label: getLabel(currentTheme == SettingsConfig.kThemeDark, L10n.t.dark),
        onSelected: () {
          SettingsService().setString(
              SettingsConfig.kItemTheme, SettingsConfig.kThemeDark);
          setState(() {});
        },
      ),
      PlatformMenuItem(
        label: getLabel(currentTheme == SettingsConfig.kThemeAuto, L10n.t.auto),
        onSelected: () {
          SettingsService().setString(
              SettingsConfig.kItemTheme, SettingsConfig.kThemeAuto);
          setState(() {});
        },
      ),
    ];
  }
  ...
}
```

### 4.3 上下文菜单 Context Menu

目前 Flutter 有两种菜单的 API

1. 通过 `showMenu` 的方式  
    ```dart
    static void _showMenu(BuildContext context, TapDownDetails event, String sourcePath) {
      showMenu(
        context: context,
        position: RelativeRect.fromLTRB(
          event.globalPosition.dx,
          event.globalPosition.dy,
          event.globalPosition.dx,
          event.globalPosition.dy,
        ),
        items: <PopupMenuEntry>[
          PopupMenuItem(child: const ListTile(leading: Icon(Icons.text_snippet_outlined, size: 20,), title: Text('新建文件')), onTap: () => _createFile(context, sourcePath),),
          PopupMenuItem(child: const ListTile(leading: Icon(Icons.folder_open_rounded, size: 20,), title: Text('新建文件夹')), onTap: () => _createDir(context, sourcePath),),
          PopupMenuItem(child: const ListTile(leading: Icon(Icons.edit_outlined, size: 20,), title: Text('重命名')), onTap: () => _rename(context, sourcePath),),
          PopupMenuItem(child: const ListTile(leading: Icon(Icons.delete_outline_rounded, size: 20,), title: Text('删除')), onTap: () => _delete(context, sourcePath),),
        ],
      );
    ```

2. 通过 `MenuAnchor` 的方式，这种方式是新引入的，可以支持子菜单 `SubmenuButton`。但是在使用上复杂一点，需要搭配 `MenuController` 来使用：
```dart
class _FileTabsState extends State<FileTabs> {
  final MenuController _menuController = MenuController();
  late final _FileTabContextMenus _menus = _FileTabContextMenus(context: context);

  @override
  Widget build(BuildContext context) {
    return MenuAnchor(
      controller: _menuController,
      menuChildren: _menus.menuItemButtons(hovered),
      child: ReorderableListView.builder(
          ...
          itemBuilder: (_, index) {
            final file = openedFiles[index];
            return _fileTab(context, file, index, selected == file,
                textChangedMap[file] != null);
          },
        ),
      ),
    );
  }

  Widget _fileTab(BuildContext context, File file, int index, bool isSelected,
      bool fileChanged) {
    return ReorderableDragStartListener(
      ...
      child: InkWell(
        onSecondaryTapDown: (e) => onOpenContextMenu(context, e, file),
        child: ...
      ),
    );
  }

  void onOpenContextMenu(BuildContext context, TapDownDetails details, File file) {
    _menus._file = file;
    final renderBox = context.findRenderObject() as RenderBox?;
    var offset = details.localPosition;
    renderBox?.let((it) {
      final ancestor = this.context.findRenderObject() as RenderBox?;
      offset = renderBox.localToGlobal(details.localPosition, ancestor: ancestor);
    });
    _menuController.open(position: offset);
  }

class _FileTabContextMenus {
  _FileTabContextMenus({required this.context});

  final BuildContext context;

  File? _file;
  File get file => _file!;

  List<Widget> menuItemButtons(File? file) {
    _file = file;

    final shortcut = Platform.isWindows 
      ? const SingleActivator(LogicalKeyboardKey.keyW, control: true) 
      : const SingleActivator(LogicalKeyboardKey.keyW, meta: true);

    return [
      MenuItemButton(onPressed: onClose, shortcut: shortcut, child: Text(L10n.t.close),),
      ...
      const Divider(),
      SubmenuButton(
        menuChildren: [
          MenuItemButton(onPressed: () => copyText(this.file.name), child: Text(L10n.t.copy_file_name)),
          MenuItemButton(onPressed: () => copyText(this.file.path), child: Text(L10n.t.copy_relative_path)),
          MenuItemButton(onPressed: () => copyText(this.file.absolute.path), child: Text(L10n.t.copy_absolute_path)),
        ],
        child: Text(L10n.t.copy_path_and_reference),
      ),
    ];
  }
}
```