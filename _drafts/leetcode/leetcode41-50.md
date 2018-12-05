---
title: "LeetCode(5)"
excerpt: "LeetCode41-50总结"
categories:
  - Algorithm
tags:
  - LeetCode
  - Array
toc: true
toc_label: "目录"
#last_modified_at: 2018-12-03T16:25:29+08:00
---

## 41. Next Permutation

[Array](/tags/#array){: .btn .btn--inverse }  

Given an unsorted integer array, find the smallest missing positive integer.

**Example 1:**

Input: [1,2,0]  
Output: 3  
{: .notice }

**Example 2:**  
Input: [3,4,-1,1]  
Output: 2
{: .notice }

**Example 3:**

Input: [7,8,9,11,12]  
Output: 1
{: .notice }

**Note:**
Your algorithm should run in `O(n)` time and uses constant extra space.


**Solution**  
```java
class Solution {
    public int firstMissingPositive(int[] nums) {        
        for (int i = 0; i < nums.length; i++) {
            while (nums[i] > 0 && nums[i] <= nums.length && nums[nums[i] - 1] != nums[i]) {
                swap(nums, nums[i] - 1, i);
            }
        }

        for (int i = 0; i < nums.length; i++) {
            if (nums[i] != i + 1)
                return i + 1;
        }

        return nums.length + 1;
    }

    private void swap(int[] nums, int i, int j) {
        int t = nums[i];
        nums[i] = nums[j];
        nums[j] = t;
    }
}
```

我们将nums[i]放置到nums[i]-1这个位置(比如将num[i]=3放置到下标为2的位置)，然后遍历一遍就可以得出答案。
{: .notice--success }
