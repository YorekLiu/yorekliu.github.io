---
title: "原型模式(Prototype)"
excerpt: "用原型实例指定创建对象的种类，并通过拷贝这些原型创建新的对象"
categories:
  - Design Patterns
tags:
  - Prototype
toc: true
toc_label: "目录"
toc_icon: "heart"
---

## 1. 定义及使用场景
用原型实例指定创建对象的种类，并通过拷贝这些原型创建新的对象。

使用场景：
1. 类初始化需要消耗非常多的资源，这个资源包括数据、硬件资源等，通过原型拷贝避免这些消耗
2. 通过new产生一个对象需要非常繁琐的数据准备或访问权限，这时可以使用原型模式
3. 一个对象需要提供给其他对象访问，而且各个调用者可能需要修改其值时，可以考虑使用原型模式拷贝多个对象供调用者使用，即保护性拷贝

需要注意的是，通过实现`Cloneable`接口的原型模式在调用`clone`函数构造实例并不一定比通过new操作速度快，只有当通过new构造对象较为耗时或者成本比较高时，通过clone方法才能获得效率上的提升。当然，实现原型模式也不一定非的要实现`Cloneable`接口，也有其他实现方式。
{: .notice }

注意引用类型的深浅拷贝问题
{: .notice--warning }

## 2. UML图
![Prototype]({{ basepath }}/assets/images/design-pattern/prototype.png)

- Client  
  客户端角色
- Prototype  
  抽象类或接口，声明具备clone的能力
- Prototype1  
  具体的原型类

## 3. 举个例子
文档中有文字和图片，在进行大的修改的之前，我们需要现保存一份副本。

```kotlin
/**
 * 文档类型，扮演的是Prototype1的角色
 * Cloneable代表Prototype
 */
class WordDocument() : Cloneable {
    var text: String = "";
    var images: ArrayList<String> = ArrayList()

    init {
        println(" ---------- WordDocument构造函数 ---------- ")
    }

    public override fun clone(): WordDocument {
        try {
            val doc = super.clone() as WordDocument
            doc.text = text
            doc.images = images.clone() as ArrayList<String>
            return doc
        } catch (exception: Exception) { }
        return WordDocument()
    }

    override fun toString(): String {
        return "WordDocument(text='$text', images=$images)"
    }

    fun print() {
        println(" ---------- WordDocument print start ---------- ")
        println(toString())
        println(" ---------- WordDocument print end ---------- ")
    }
}

fun main(args: Array<String>) {
    val originDoc = WordDocument()
    originDoc.text = "This is an article"
    originDoc.images.add("image 1")
    originDoc.images.add("image 2")
    originDoc.images.add("image 3")
    originDoc.images.add("image 4")
    originDoc.print()

    val doc2 = originDoc.clone()
    doc2.print()
    doc2.text = "This is an article (Edition 2)"
    doc2.images.add("image 5")
    doc2.print()

    originDoc.print()
}
```

输出结果如下
```text
---------- WordDocument构造函数 ----------
---------- WordDocument print start ----------
WordDocument(text='This is an article', images=[image 1, image 2, image 3, image 4])
---------- WordDocument print end ----------
---------- WordDocument print start ----------
WordDocument(text='This is an article', images=[image 1, image 2, image 3, image 4])
---------- WordDocument print end ----------
---------- WordDocument print start ----------
WordDocument(text='This is an article (Edition 2)', images=[image 1, image 2, image 3, image 4, image 5])
---------- WordDocument print end ----------
---------- WordDocument print start ----------
WordDocument(text='This is an article', images=[image 1, image 2, image 3, image 4])
---------- WordDocument print end ----------
```
