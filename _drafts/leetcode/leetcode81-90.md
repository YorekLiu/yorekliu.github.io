---
title: "LeetCode(9)"
excerpt: "LeetCode81-90总结"
categories:
  - Algorithm
tags:
  - LeetCode
  - Binary Search
  - Dynamic Programming
  - Linked List
  - Array
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

## 82. Remove Duplicates from Sorted List II

[Linked List](/tags/#linked-list){: .tag } 

Given a sorted linked list, delete all nodes that have duplicate numbers, leaving only *distinct* numbers from the original list.

**Example 1:**

**Input:** 1->2->3->3->4->4->5  
**Output:** 1->2->5
{: .notice }

**Example 2:**

**Input:** 1->1->1->2->3  
**Output:** 2->3
{: .notice }

**Solution**  

此题同[CI-18-2-删除链表中重复的结点](/algorithm/code_interviews_3/#132-%E5%88%A0%E9%99%A4%E9%93%BE%E8%A1%A8%E4%B8%AD%E9%87%8D%E5%A4%8D%E7%9A%84%E7%BB%93%E7%82%B9)

Runtime 1 ms

```java
/**
 * Definition for singly-linked list.
 * public class ListNode {
 *     int val;
 *     ListNode next;
 *     ListNode(int x) { val = x; }
 * }
 */
class Solution {
    public ListNode deleteDuplicates(ListNode head) {
        if (head == null || head.next == null) {
            return head;
        }
        
        // create a head node
        ListNode h = new ListNode(0);
        h.next = head;
        
        ListNode t = h, p = t.next, q = p.next;
        
        while (q != null) {
            if (p.val == q.val) {
                while (q != null && p.val == q.val) {
                    p = p.next;
                    q = q.next;
                }
                t.next = q;
                if (q != null) {
                    q = q.next;
                    p = p.next;
                }
            } else {
                q = q.next;
                p = p.next;
                t = t.next;
            }
        }
        
        return h.next;
    }
}
```

## 83. Remove Duplicates from Sorted List

[Linked List](/tags/#linked-list){: .tag } 

Given a sorted linked list, delete all duplicates such that each element appear only *once*.

**Example 1:**

**Input:** 1->1->2  
**Output:** 1->2
{: .notice }

**Example 2:**

**Input:** 1->1->2->3->3  
**Output:** 1->2->3
{: .notice }

**Solution**  

Runtime 0 ms

```java
/**
 * Definition for singly-linked list.
 * public class ListNode {
 *     int val;
 *     ListNode next;
 *     ListNode(int x) { val = x; }
 * }
 */
class Solution {
    public ListNode deleteDuplicates(ListNode head) {
        if (head == null || head.next == null) return head;
        
        ListNode q = head, p = q.next;
        
        while (p != null) {
            if (q.val == p.val) {
                q.next = p.next;
                p.next = null;
                p = q.next;
            } else {
                q = q.next;
                p = p.next;
            }
        }
        
        return head;
    }
}
```

## 84. Largest Rectangle in Histogram

[Array](/tags/#array){: .tag } [Stack](/tags/#stack){: .tag } 

Given *n* non-negative integers representing the histogram's bar height where the width of each bar is 1, find the area of largest rectangle in the histogram.

<figure style="width: 50%" class="half align-center">
    <img src="/assets/images/leetcode/question_84_1.png">
    <img src="/assets/images/leetcode/question_84_2.png">
    <figcaption>1. Above is a histogram where width of each bar is 1, given height = `[2,1,5,6,2,3]`.<br />2. The largest rectangle is shown in the shaded area, which has area = `10` unit.</figcaption>
</figure>

**Example:**

**Input:** [2,1,5,6,2,3]  
**Output:** 10
{: .notice }

**Solution**  

对任意的i，从左边往前找到第一个小于当前高度的bar，其下标记为lessFromLeft[i]，若没有找到，则设为-1。  
同样，对于任意的i，从右边往后找到第一个小于当前高度的bar，其下标记为lessFromRight[i]，若没有找到，则设为n。  
(lessFromRight[i] - lessFromLeft[i] - 1)表示的就是当前i的解，图解如下图：

<figure style="width: 40%" class="align-center">
    <img src="/assets/images/leetcode/question_84_3.png">
    <figcaption>(lessFromRight[i] - lessFromLeft[i] - 1)的意义</figcaption>
</figure>

这样就容易理解为什么lessFromLeft[i]的默认值为-1，lessFromRight[i]的默认值为n了。

Runtime 2 ms

```java
class Solution {
    public int largestRectangleArea(int[] height) {
        if (height == null || height.length == 0) {
            return 0;
        }
        int[] lessFromLeft = new int[height.length]; // idx of the first bar the left that is lower than current
        int[] lessFromRight = new int[height.length]; // idx of the first bar the right that is lower than current
        lessFromRight[height.length - 1] = height.length;
        lessFromLeft[0] = -1;

        for (int i = 1; i < height.length; i++) {
            int p = i - 1;

            while (p >= 0 && height[p] >= height[i]) {
                p = lessFromLeft[p];
            }
            lessFromLeft[i] = p;
        }

        for (int i = height.length - 2; i >= 0; i--) {
            int p = i + 1;

            while (p < height.length && height[p] >= height[i]) {
                p = lessFromRight[p];
            }
            lessFromRight[i] = p;
        }

        int maxArea = 0;
        for (int i = 0; i < height.length; i++) {
            maxArea = Math.max(maxArea, height[i] * (lessFromRight[i] - lessFromLeft[i] - 1));
        }

        return maxArea;
    }
}
```

## 85. Maximal Rectangle

[Dynamic Programming](/tags/#dynamic-programming){: .tag }

Given a 2D binary matrix filled with 0's and 1's, find the largest rectangle containing only 1's and return its area.

**Example:**

**Input:**  
[  
&emsp;&emsp;&emsp;["1","0","1","0","0"],  
&emsp;&emsp;&emsp;["1","0","1","1","1"],  
&emsp;&emsp;&emsp;["1","1","1","1","1"],  
&emsp;&emsp;&emsp;["1","0","0","1","0"]  
]  
**Output:** 6
{: .notice }

**Solution: [Dynamic Programming](https://leetcode.com/problems/maximal-rectangle/discuss/29054/Share-my-DP-solution)**  

Solution比较难理解。总体来说可以采用DP解法，一行一行遍历。对某一个具体的坐标，有如下解：  

$$f(i, j)=[right(i,j) - left(i,j)] * height(i,j)$$

其中：

- $$height(i,j)$$表示上方连续的1的个数
- $$left(i, j)$$表示对任意k∈[j, i]，使得height[k] >= height[i]成立的最左边的索引j
- $$right(i, j)$$表示对任意k∈[i, j]，使得height[k] >= height[i]成立的最右边的索引j

这样一来，$$left$$和$$right$$就能表示包含当前点的、且高为$$height$$的矩形的边界。

[Solution解题过程](/assets/images/leetcode/question_85_solution.png)

Runtime 7 ms

```java
class Solution {
    public int maximalRectangle(char[][] matrix) {
        if (matrix == null || matrix.length == 0) return 0;
        
        final int M = matrix.length;
        final int N = matrix[0].length;
        int[] left = new int[N];
        int[] right = new int[N];
        int[] height = new int[N];
        int max = Integer.MIN_VALUE;
        Arrays.fill(right, N);
        
        for (int i = 0; i < M; i++) {
            int curL = 0, curR = N;
            // right
            for (int j = N - 1; j >= 0; j--) {
                if (matrix[i][j] == '1') {
                    right[j] = Math.min(right[j], curR);
                } else {
                    right[j] = N;
                    curR = j;
                }
            }
            
            for (int j = 0; j < N; j++) {
                if (matrix[i][j] == '1') {
                    // height
                    height[j]++;
                    // left
                    left[j] = Math.max(left[j], curL);
                } else {
                    // height
                    height[j] = 0;
                    // left
                    left[j] = 0;
                    curL = j + 1;
                }
                
                max = Math.max(max, (right[j] - left[j]) * height[j]);
            }
        }
        
        return max;
    }
}
```

## 86. Partition List

[Linked List](/tags/#linked-list){: .tag }

Given a linked list and a value *x*, partition it such that all nodes less than *x* come before nodes greater than or equal to *x*.

You should preserve the original relative order of the nodes in each of the two partitions.

**Example:**

**Input:** head = 1->4->3->2->5->2, x = 3  
**Output:** 1->2->2->4->3->5
{: .notice }

**Solution**  

本题要求将值小于x的节点放置到值大于等于x的节点之前，同时要保持相对位置不变。实际上就是一个链表的插入问题。

我们可以使用指针p表示可以插入的位置，使用指针q来表示待插入的节点。q遍历时判断是否需要插入，以及往后找到第一个可以待插入的节点，插入到p.next上。注意插入完成后，重置指针时考虑`[3,1,2], x=3`的情况。

[解题过程](/assets/images/leetcode/question_86_solution.png)

Runtime 0 ms

```java
/**
 * Definition for singly-linked list.
 * public class ListNode {
 *     int val;
 *     ListNode next;
 *     ListNode(int x) { val = x; }
 * }
 */
class Solution {
    public ListNode partition(ListNode h, int x) {
        if (h == null || h.next == null) {
            return h;
        }
        
        ListNode head = new ListNode(0);
        head.next = h;
        
        ListNode p = head, q = head.next;
        
        while (q != null) {
            if(q.val < x) {
                p = p.next;
                q = q.next;
            } else {
                ListNode t = q;
                while (q != null && q.val >= x) {
                    t = q;
                    q = q.next;
                }
                if (q != null) {
                    ListNode t1 = p.next, t2 = q.next;
                    p.next = q;
                    q.next = t1;
                    t.next = t2;
                    p = p.next;
                    q = t;
                }
            }
        }
        
        return head.next;
    }
}
```