---
title: "组合模式(Composite)"
excerpt: '将对象组合成树形结构以表示"部分-整体"的层次结构，使得用户对单个对象和组合对象的使用具有一致性'
categories:
  - Design Patterns
tags:
  - Composite
toc: true
toc_label: "目录"
toc_icon: "heart"
last_modified_at: 2018-06-13T14:49:19+08:00
---

## 1. 定义及使用场景
将对象组合成树形结构以表示"部分-整体"的层次结构，使得用户对单个对象和组合对象的使用具有一致性

使用场景：
- 表示对象的部分-整体层次结构时
- 从一个整体中能够独立出部分模块或功能的场景

> 组合模式分为两种：透明的组合模式与安全的组合模式  
> 透明的组合模式中，不管是叶子结点还是枝干节点都有相同的结构，因此必须在叶子节点的节点处理方法中进行判断。所以就不够安全了。

## 2. UML图
![composite]({{ basepath }}/assets/images/design-pattern/composite.png)

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
{: .notice--success }
