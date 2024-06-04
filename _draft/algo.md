---
title: 手搓算法小结
---

二分查找：需要注意循环条件、边界移动、返回值，有些题目还会在判断条件上做文章。

int累加溢出问题：
- 上溢出前置判断：`if (r > Integer.MAX_VALUE / 10 || (r == Integer.MAX_VALUE / 10 && digit > 7)) return 0;`
- 下溢出前置判断：`if (r < Integer.MIN_VALUE / 10 || (r == Integer.MIN_VALUE / 10 && pop < -8)) return 0;`
- 或者允许使用long存储的话，可以先计算，然后判断是否大于`Integer.MAX_VALUE`或者小于`Integer.MIN_VALUE`