---
title: "LeetCode(4)"
excerpt: "LeetCode31-40总结"
categories:
  - Algorithm
tags:
  - LeetCode
  - Array
  - String
  - Dynamic Programming
toc: true
toc_label: "目录"
#last_modified_at: 2018-08-20T17:10:19+08:00
---

## 31. Next Permutation

[Array](/tags/#array){: .btn .btn--inverse }

Implement next permutation, which rearranges numbers into the lexicographically next greater permutation of numbers.

If such arrangement is not possible, it must rearrange it as the lowest possible order (ie, sorted in ascending order).

The replacement must be in-place and use only constant extra memory.

Here are some examples. Inputs are in the left-hand column and its corresponding outputs are in the right-hand column.

`1,2,3` → `1,3,2`  
`3,2,1` → `1,2,3`  
`1,1,5` → `1,5,1`  


**Solution**  
```java
class Solution {
    public void nextPermutation(int[] nums) {
        int i = nums.length - 2;

        while (i >= 0 && (nums[i + 1] <= nums[i])) {
            i--;
        }

        if (i >= 0) {
            int j = nums.length - 1;
            while (j >= 0 && (nums[j] <= nums[i])) {
                j--;
            }
            swap(nums, i, j);
        }
        reverse(nums, i + 1);
    }

    private void swap(int[] nums, int i, int j) {
        int k = nums[i];
        nums[i] = nums[j];
        nums[j] = k;
    }

    private void reverse(int[] nums, int start) {
        int end = nums.length - 1;
        while (end > start) {
            swap(nums, start, end);
            start++;
            end--;
        }
    }
}
```

![question_31.gif](/assets/images/leetcode/question_31.gif){: .align-center }

首先从尾部开始查找，找到第一个递减(从尾部看)的元素i  
从i往尾部查找，找到第一个大于i的元素j，交换i,j  
将nums从i+1开始，反转
{: .notice--success }


## 32. Longest Valid Parentheses

[String](/tags/#string){: .btn .btn--inverse } [Dynamic Programming](/tags/#dynamic-programming){: .btn .btn--inverse }

Given a string containing just the characters '(' and ')', find the length of the longest valid (well-formed) parentheses substring.

**Example 1:**

Input: "(()"  
Output: 2  
Explanation: The longest valid parentheses substring is "()"
{: .notice }

**Example 2:**  

Input: ")()())"  
Output: 4  
Explanation: The longest valid parentheses substring is "()()"  
{: .notice }

**Solution**

**Approach 1: Using Dynamic Programming**

```java
class Solution {
    public int longestValidParentheses(String s) {
        final int N = s.length();
        int[] dp = new int[N];
        int longest = 0;

        for (int i = 1; i < N; i++) {
            if (s.charAt(i) == ')') {
                if (s.charAt(i - 1) == '(') {
                    dp[i] = ((i >= 2) ? dp[i - 2] : 0) + 2;
                } else { // s.charAt(i - 1) == ')'
                    if (i - dp[i - 1] > 0 && s.charAt(i - dp[i - 1] - 1) == '(') {
                        dp[i] = dp[i - 1] + (i - dp[i - 1] >= 2 ? dp[i - dp[i - 1] - 2] : 0) + 2;
                    }
                }
                longest = Math.max(longest, dp[i]);
            }
        }

        return longest;
    }
}
```

采用动态规划算法，在遇到')'时开始计算阶段的值(当前下标记为i)，最后取阶段值和最大值的较大者。  
而难题在于如何用上一个阶段的结果得出这个阶段的结果。我们可以分为两种情况讨论：  
1、i-1为'('时，此时我们只需要将i-2的dp值加上'()'的长度2即可。  
2、i-1为')'时，dp[i-1]的值就表示了上一个阶段的值，所以i-dp[i-1]就得到了上个阶段起始的坐标。这里我们只要关心i-dp[i-1]-1是'('的情况，因为'('才能和s[i]=')'匹配。因此，dp[i] = dp[i - 1] + dp[i - dp[i - 1] - 2] + 2。
{: .notice--success }

**Approach 2: Using Stack**

```java
class Solution {
    public int longestValidParentheses(String s) {
        final int N = s.length();
        Stack<Integer> stack = new Stack<>();
        int longest = 0;

        stack.push(-1);
        for (int i = 0; i < N; i++) {
            if (s.charAt(i) == '(') {
                stack.push(i);
            } else {
                stack.pop();
                if (stack.isEmpty()) {
                    stack.push(i);
                } else {
                    longest = Math.max(longest, i - stack.peek());
                }
            }
        }

        return longest;
    }
}
```

经中此篇如此高深，难道你当真懂得？  
经中此篇如此高深，我的确不懂!
{: .notice--warning }

不过在讨论区的高票答案也是Stack解法，理解起来简单多了。两者核心思想应该是一致的。  
**Approach 2.2: Using Stack**

```java
class Solution {
    public int longestValidParentheses(String s) {
        Stack<Integer> stack = new Stack<>();
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '(') stack.push(i);
            else if (!stack.empty() && s.charAt(stack.peek()) == '(') stack.pop();  
            else stack.push(i);
        }
        if (stack.empty()) return s.length();
        int res = 0, high = s.length();

        while (!stack.empty()) {
            int low = stack.pop();
            res = Math.max(res, high - low - 1);
            high = low;
        }
        return Math.max(res, high);
    }
}
```

将匹配不成功的索引push进栈，元素处理完后，栈中元素就是合法元素的临界点。两两之间都是合法的元素集合。直接其计算长度取较大者即可。
{: .notice--success }

**Approach 3: Without extra space**

```java
public class Solution {
    public int longestValidParentheses(String s) {
        int left = 0, right = 0, maxlength = 0;
        for (int i = 0; i < s.length(); i++) {
            if (s.charAt(i) == '(') {
                left++;
            } else {
                right++;
            }
            if (left == right) {
                maxlength = Math.max(maxlength, 2 * right);
            } else if (right >= left) {
                left = right = 0;
            }
        }
        left = right = 0;
        for (int i = s.length() - 1; i >= 0; i--) {
            if (s.charAt(i) == '(') {
                left++;
            } else {
                right++;
            }
            if (left == right) {
                maxlength = Math.max(maxlength, 2 * left);
            } else if (left >= right) {
                left = right = 0;
            }
        }
        return maxlength;
    }
}
```

## 33. Search in Rotated Sorted Array

[Array](/tags/#array){: .btn .btn--inverse } [Binary Search](/tags/#binary-search){: .btn .btn--inverse }

Suppose an array sorted in ascending order is rotated at some pivot unknown to you beforehand.

(i.e., `[0,1,2,4,5,6,7]` might become `[4,5,6,7,0,1,2]`).

You are given a target value to search. If found in the array return its index, otherwise return `-1`.

You may assume no duplicate exists in the array.

Your algorithm's runtime complexity must be in the order of O(log n).

**Example 1:**

Input: nums = [4,5,6,7,0,1,2], target = 0  
Output: 4
{: .notice }

**Example 2:**

Input: nums = [4,5,6,7,0,1,2], target = 3  
Output: -1
{: .notice }

**Solution**  
```java
class Solution {
    public int search(int[] nums, int target) {
        final int N = nums.length;
        int lo = 0, hi = nums.length - 1;

        while (lo < hi) {
            int mid = (lo + hi) / 2;
            if (nums[mid] > nums[hi])
                lo = mid + 1;
            else
                hi = mid;
        }

        int pivot = lo;

        lo = 0;
        hi = nums.length - 1;
        while (lo <= hi) {
            int mid = (lo + hi) / 2;
            int realMid = (mid + pivot) % N;
            if (nums[realMid] == target) return realMid;
            if (nums[realMid] < target)
                lo = mid + 1;
            else
                hi = mid - 1;
        }

        return -1;
    }
}
```

题目要求`O(log n)`的时间复杂度，因此需要用到二分查找算法。  
首先二分查找pivot的下标，然后二分查找target。
{: .notice--success }
