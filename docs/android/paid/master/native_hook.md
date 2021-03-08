---
title: "35 | Native Hook 技术，天使还是魔鬼？"
---

!!! note "极客时间——[Android开发高手课](https://time.geekbang.org/column/intro/142)"
    本博客上的这些内容全是CV自[Android开发高手课](https://time.geekbang.org/column/intro/142)的原始内容，外加Sample的个人练习小结。若CV这个行动让您感到不适，请移步即可。  

## Native Hook 的不同流派

对于 Native Hook 技术，比较常见的有 GOT/PLT Hook、Trap Hook 以及 Inline Hook，下面逐个讲解这些 Hook 技术的实现原理和优劣比较。

### 1. GOT/PLT Hook