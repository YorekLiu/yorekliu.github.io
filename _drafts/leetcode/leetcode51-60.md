---
title: "LeetCode(6)"
excerpt: "LeetCode51-60总结"
categories:
  - Algorithm
tags:
  - LeetCode
  - Greedy
toc: true
toc_label: "目录"
#last_modified_at: 2018-12-03T16:25:29+08:00
---

<script type="text/javascript" async
  src="https://cdn.mathjax.org/mathjax/latest/MathJax.js?config=TeX-MML-AM_CHTML">
</script>

## 55. Jump Game

[Greedy](/tags/#greedy){: .btn .btn--inverse }  

Given an array of non-negative integers, you are initially positioned at the first index of the array.

Each element in the array represents your maximum jump length at that position.

Determine if you are able to reach the last index.

**Example 1:**

Input: [2,3,1,1,4]  
Output: true  
Explanation: Jump 1 step from index 0 to 1, then 3 steps to the last index.  
{: .notice }

**Example 2:**

Input: [3,2,1,0,4]  
Output: false  
Explanation: You will always arrive at index 3 no matter what. Its maximum
             jump length is 0, which makes it impossible to reach the last index.  
{: .notice }

**Solution**  

本题最好的解法是贪婪算法，从最右边开始，能到达终点的点就是最新的终点，这样一直判断完整个数组，最后判断最后一个终点是不是0即可。  
时间复杂度为$$O(n)$$，空间复杂度为$$O(1)$$。  

> 一个疑问是，如果确定了一个点是最新的终点，那么一旦无法从开始跳到该点，是否有回溯的可能。  
> 答案是没有必要回溯，因为假设存在这个一个点P，位于最新的终点与终点之间。如果位于最新终点之前的点可以到达点P，那么肯定可以到达最新的终点。所以，回溯在本题是没有必要的，本题只是求存不存在路径。

```java
class Solution {
    public boolean canJump(int[] nums) {
        final int n = nums.length;
        int last = n - 1;

        for (int i = n - 1; i >= 0; i--) {
            if (i + nums[i] >= last) {
                last = i;
            }
        }

        return last == 0;
    }
}
```
