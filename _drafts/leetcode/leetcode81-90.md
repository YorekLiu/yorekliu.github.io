---
title: "LeetCode(9)"
excerpt: "LeetCode81-90总结"
categories:
  - Algorithm
tags:
  - LeetCode
  - Binary Search
toc: true
toc_label: "目录"
# last_modified_at: 2019-06-18T10:19:55+08:00
---

<script type="text/javascript" async
  src="https://cdn.mathjax.org/mathjax/latest/MathJax.js?config=TeX-MML-AM_CHTML">
</script>

## 81. Search in Rotated Sorted Array II

[Binary Search](/tags/#binary-search){: .tag } 

Suppose an array sorted in ascending order is rotated at some pivot unknown to you beforehand.

(i.e., `[0,0,1,2,2,5,6]` might become `[2,5,6,0,0,1,2]`).

You are given a target value to search. If found in the array return `true`, otherwise return `false`.

**Example 1:**

**Input:** nums = [2,5,6,0,0,1,2], target = 0  
**Output:** true
{: .notice }

**Example 2:**

**Input:** nums = [2,5,6,0,0,1,2], target = 3  
**Output:** false
{: .notice }

**Follow up:**

- This is a follow up problem to [Search in Rotated Sorted Array](/algorithm/leetcode31-40/#33-search-in-rotated-sorted-array), where `nums` may contain duplicates.
- Would this affect the run-time complexity? How and why?

**Solution**  

此题与[CI-(11)旋转数组的最小数字](/algorithm/code_interviews/#621-11%E6%97%8B%E8%BD%AC%E6%95%B0%E7%BB%84%E7%9A%84%E6%9C%80%E5%B0%8F%E6%95%B0%E5%AD%97)非常类似。  
也就是说在[Search in Rotated Sorted Array](/algorithm/leetcode31-40/#33-search-in-rotated-sorted-array)基础上考虑一种特殊情况：`{1, 0, 1, 1, 1}`和`{1, 1, 1, 0, 1}`。在这两个数组中最小数字为别位于左右半区。所以上面的算法一定会失败一种情况。因此，当lo，mid，hi对应的数字都相等时，我们必须采用顺序查找。

Runtime 1 ms

```java
class Solution {
    public boolean search(int[] nums, int target) {
        final int N = nums.length;
        
        int lo = 0, hi = N - 1;
        int mid;
        
        while (lo < hi) {
            mid = (lo + hi) >>> 1;
            
            if (nums[mid] == nums[lo] && nums[lo] == nums[hi]) {
                lo = searchInOrder(nums, lo, hi);
                break;
            }
            
            if (nums[mid] > nums[hi]) {
                lo = mid + 1;
            } else {
                hi = mid;
            }
        }
        
        int pivot = lo;
        lo = 0;
        hi = N - 1;
        while (lo <= hi) {
            mid = (lo + hi) >>> 1;
            int realMid = (mid + pivot) % N;
            if (nums[realMid] == target) {
                return true;
            } else if (nums[realMid] > target) {
                hi = mid - 1;
            } else {
                lo = mid + 1;
            }
        }
        
        return false;
    }
    
    private int searchInOrder(int[] nums, int start, int end) {
        for (int i = start + 1; i <= end; i++) {
            if (nums[i - 1] > nums[i]) {
                return i;
            }
        }

        return start;
    }
}
```
