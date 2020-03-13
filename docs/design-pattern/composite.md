---
title: "组合模式(Composite)"
---

## 1. 定义及使用场景

**将对象组合成树形结构以表示"部分-整体"的层次结构，使得用户对单个对象和组合对象的使用具有一致性**

使用场景：

- 表示对象的部分-整体层次结构时
- 从一个整体中能够独立出部分模块或功能的场景

> 组合模式分为两种：透明的组合模式与安全的组合模式  
> 
> - 透明的组合模式中，不管是叶子结点还是枝干节点都有相同的结构，因此必须在叶子节点的节点处理方法中进行判断。所以就不够安全了。  
> - 安全的组合模式中，Component接口不声明叶子结点不具备的方法，而是在Composite声明所有用来管理子类对象的方法。由于不够透明，所以叶子结点和枝干节点将不具有相同的接口，客户端的调用需要做对应的判断，带来了不便。

组合模式定义了包含基本对象和层次结构。基本对象可以被组合成为更复杂的组合对象，而这些组合对象又可以被组合，这样不断地递归下去，客户代码中，任何用到基本对象的地方都可以使用组合对象可。  
用户是不用关心到底是处理一个叶节点还是处理一个组合组件，也就用不着为定义组合而写一些选择判断语句了。  
组合模式让客户可以一致地使用组合结构和单个对象。

## 2. UML图

![组合模式UML图](/assets/images/design-pattern/composite.png)  
<center>组合模式UML图</center>

- Component  
  抽象根节点，为组合中的对象声明接口。
- Composite  
  非叶子节点，在Component接口中实现与子节点有关的操作。
- Leaf  
  在组合中表示叶子节点对象
- Client  
  客户类

## 3. 举个例子
操作系统中文件系统可以简单描述如下

```kotlin
abstract class Dir(var name: String) {
    protected val dirs = ArrayList<Dir>()

    abstract fun addDir(dir: Dir)

    abstract fun rmDir(dir: Dir)

    abstract fun clear()

    abstract fun print()

    abstract fun getFiles(): List<Dir>
}

class Folder(name: String) : Dir(name) {
    override fun addDir(dir: Dir) {
        dirs.add(dir)
    }

    override fun rmDir(dir: Dir) {
        dirs.remove(dir)
    }

    override fun clear() {
        dirs.clear()
    }

    override fun print() {
        print(name + "(")
        val iterator = dirs.iterator()

        while (iterator.hasNext()) {
            val dir = iterator.next()
            dir.print()
            if (iterator.hasNext()) {
                print(", ")
            }
        }
        print(")")
    }

    override fun getFiles(): List<Dir> = dirs
}

class File(name: String) : Dir(name) {
    override fun addDir(dir: Dir) {
        throw UnsupportedOperationException("File don't support this operation")
    }

    override fun rmDir(dir: Dir) {
        throw UnsupportedOperationException("File don't support this operation")
    }

    override fun clear() {
        throw UnsupportedOperationException("File don't support this operation")
    }

    override fun print() = print(name)

    override fun getFiles(): List<Dir> {
        throw UnsupportedOperationException("File don't support this operation")
    }
}

fun main(args: Array<String>) {
    val diskC = Folder("C")
    diskC.addDir(File("log.txt"))

    val dirWin = Folder("Windows")
    dirWin.addDir(File("explorer.exe"))
    diskC.addDir(dirWin)

    val dirPer = Folder("PerfLogs")
    dirPer.addDir(File("null.txt"))
    diskC.addDir(dirPer)

    val dirPro = Folder("Program File")
    dirPro.addDir(File("ftp.txt"))
    diskC.addDir(dirPro)

    diskC.print()
}
```

输出结果如下
```text
C(log.txt, Windows(explorer.exe), PerfLogs(null.txt), Program File(ftp.txt))
```

该实例是一种透明的组合模式，因为"不管是叶子结点还是枝干节点都有相同的结构"

## 4. 源码中的例子

Android源码中关于组合模式有一个非常经典实现，前面许多章节中我们所列举的一些源码中的设计模式实现都并非那么经典，因为在很多情况下会根据实际应用来调整一些设计模式的结构，所以，会造成很多给人感觉不是那么贴切的实现，但是在Android源码中关于组合模式这一块却很经典，我们几乎每天都会使用到，那就是View和ViewGroup的嵌套组合。

要回答这个问题，就要先了解View类与ViewGroup类的差别在哪，首先我们知道ViewGroup是继承于View类的。

```java
public abstract class ViewGroup extends View implements ViewParent, ViewManager {
    //......省略具体的逻辑代码......
}
```

从继承的角度来说ViewGroup拥有View类所有的非私有方法，既然如此，两者的差别就在于ViewGroup所实现的ViewParent和ViewManager接口上，而事实也是如此，ViewManager接口定义了`addView`、`removeView`等对子视图操作的方法。

```java
public interface ViewManager {
    public void addView(View view, ViewGroup.LayoutParams params);
    public void updateViewLayout(View view,ViewGroup.LayoutParams params);
    public void removeView(View view);
}
```

而ViewParent则定义了刷新容器的接口requestLayout和其他一些焦点事件的处理的接口。

```java
public interface ViewParent {
    public void requestLayout();
    
    public boolean isLayoutRequested();
     
    public void requestTransparentRegion(View child);
      
    public void invalidateChild(View child,Rect r);

    public ViewParent invalidateChildInParent(int[] location,Rect r);
        
    public ViewParent getParent();
         
    public void requestChildFocus(View child,View focused);
          
    //......省略—些不常用的方法......
}
```

其中有一些方法我们是比较常见的也经常会用到，如`requestLayout`、`bringChildToFront`等，ViewGroup除了所实现的这两个接口与View不一样外，还有重要的一点就是ViewGroup是抽象类，其将View中的`onLayout`方法重置为抽象方法，也就是说容器子类必须实现该方法来实现布局定位，我们知道View中的该方法是个空实现，因为对于一个普通的View来说该方法并没有什么实现价值，但是ViewGroup就不一样，要必须实现。除此之外，在View中比较重要的两个测绘流程的方法`onMeasure`和`onDraw`在ViewGroup中都没有被重写，相对于`onMeasure`方法，在ViewGroup中增加了一些计算子View的方法，如`measureChildren`、`measureChildrenWithMargins`等；而对于`onDraw`方法，ViewGroup定义了一个`dispatchDraw`方法来调用其每一个子View的`onDraw`方法，由此可见，ViewGroup真的就象一个容器一样，其职责只是负责对子元素的操作而非具体的个体行为。