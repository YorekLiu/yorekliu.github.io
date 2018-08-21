---
title: "LeetCode(2)"
excerpt: "LeetCode11-20总结"
categories:
  - Algorithm
tags:
  - LeetCode
  - Array
  - Two Pointers
  - String
toc: true
toc_label: "目录"
toc_icon: "heart"
#last_modified_at: 2018-08-20T17:10:19+08:00
---

## 11. Container With Most Water

[Array](/tags/#array){: .btn .btn--inverse } [Two Pointers](/tags/#two-pointers){: .btn .btn--inverse }

Given n non-negative integers a1, a2, ..., an , where each represents a point at coordinate (i, ai). n vertical lines are drawn such that the two endpoints of line i is at (i, ai) and (i, 0). Find two lines, which together with x-axis forms a container, such that the container contains the most water.

**Note**: You may not slant the container and n is at least 2.

![question_11](/assets/images/leetcode/question_11.jpg)  
The above vertical lines are represented by array [1,8,6,2,5,4,8,3,7]. In this case, the max area of water (blue section) the container can contain is 49.

**Example:**

Input: [1,8,6,2,5,4,8,3,7]  
Output: 49
{: .notice }

```java
class Solution {
    public int maxArea(int[] height) {
        int n = height.length, i = 0, j = n - 1, max = 0;

        while (j > i) {
            max = Math.max(max, Math.min(height[i], height[j]) * (j - i));
            if (height[i] < height[j]) {
                i++;
            } else {
                j--;
            }
        }

        return max;
    }
}
```

可以常规暴力破解法；也可以使用`Two Pointer Approach`解法，从两头开始遍历，每次移动高度小的一端即可。
{: .notice--success }

## 12. Integer to Roman

[String](/tags/#string){: .btn .btn--inverse }

Roman numerals are represented by seven different symbols: `I`, `V`, `X`, `L`, `C`, `D` and `M`.  

| Symbol | Value |
| ------ | ----- |
| I | 1 |
| V | 5 |
| X | 10 |
| L | 50 |
| C | 100 |
| D | 500 |
| M | 1000 |

For example, two is written as `II` in Roman numeral, just two one's added together. Twelve is written as, `XII`, which is simply `X` + `II`. The number twenty seven is written as `XXVII`, which is `XX` + `V` + `II`.  

Roman numerals are usually written largest to smallest from left to right. However, the numeral for four is not `IIII`. Instead, the number four is written as `IV`. Because the one is before the five we subtract it making four. The same principle applies to the number nine, which is written as `IX`. There are six instances where subtraction is used:
- `I` can be placed before `V` (5) and `X` (10) to make 4 and 9.
- `X` can be placed before `L` (50) and `C` (100) to make 40 and 90.
- `C` can be placed before `D` (500) and `M` (1000) to make 400 and 900.

Given an integer, convert it to a roman numeral. Input is guaranteed to be within the range from 1 to 3999.

**Example 1:**

Input: 3  
Output: "III"
{: .notice }

**Example 2:**

Input: 4  
Output: "IV"
{: .notice }

**Example 3:**

Input: 9  
Output: "IX"
{: .notice }

**Example 4:**

Input: 58  
Output: "LVIII"  
Explanation: C = 100, L = 50, XXX = 30 and III = 3.
{: .notice }

**Example 5:**

Input: 1994  
Output: "MCMXCIV"  
Explanation: M = 1000, CM = 900, XC = 90 and IV = 4.
{: .notice }

```java
class Solution {
    public String intToRoman(int num) {
        String[] keys = {"M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I"};
        int[] values = {1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1};

        StringBuilder result = new StringBuilder();
        for (int i = 0; i < values.length; i++) {
            while (num >= values[i]) {
                num -= values[i];
                result.append(keys[i]);
            }
        }

        return result.toString();
    }
}
```

该问题比较讨巧，我们可以把所有可能的希腊字母和对应的阿拉伯数字列举出来，然后从高到底依次去减。
{: .notice--success }

## 13. Roman to Integer

[String](/tags/#string){: .btn .btn--inverse }

Roman numerals are represented by seven different symbols: `I`, `V`, `X`, `L`, `C`, `D` and `M`.  

| Symbol | Value |
| ------ | ----- |
| I | 1 |
| V | 5 |
| X | 10 |
| L | 50 |
| C | 100 |
| D | 500 |
| M | 1000 |

For example, two is written as `II` in Roman numeral, just two one's added together. Twelve is written as, `XII`, which is simply `X` + `II`. The number twenty seven is written as `XXVII`, which is `XX` + `V` + `II`.  

Roman numerals are usually written largest to smallest from left to right. However, the numeral for four is not `IIII`. Instead, the number four is written as `IV`. Because the one is before the five we subtract it making four. The same principle applies to the number nine, which is written as `IX`. There are six instances where subtraction is used:
- `I` can be placed before `V` (5) and `X` (10) to make 4 and 9.
- `X` can be placed before `L` (50) and `C` (100) to make 40 and 90.
- `C` can be placed before `D` (500) and `M` (1000) to make 400 and 900.

Given a roman numeral, convert it to an integer. Input is guaranteed to be within the range from 1 to 3999.

**Example 1:**

Input: "III"  
Output: 3
{: .notice }

**Example 2:**

Input: "IV"  
Output: 4
{: .notice }

**Example 3:**

Input: "IX"  
Output: 9
{: .notice }

**Example 4:**

Input: "LVIII"  
Output: 58  
Explanation: C = 100, L = 50, XXX = 30 and III = 3.
{: .notice }

**Example 5:**

Input: "MCMXCIV"  
Output: 1994  
Explanation: M = 1000, CM = 900, XC = 90 and IV = 4.
{: .notice }

```java
class Solution {
    public int romanToInt(String s) {
        String[] keys = {"M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I"};
        int[] values = {1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1};

        int sum = 0;
        for (int i = 0; i < values.length; i++) {
            while (s.startsWith(keys[i])) {
                s = s.substring(keys[i].length());
                sum += values[i];
            }
        }

        return sum;
    }
}
```

该问题与上一道题相似，也是比较讨巧，我们可以把所有可能的希腊字母和对应的阿拉伯数字列举出来，然后每次裁掉已经加过的字符。
{: .notice--success }
