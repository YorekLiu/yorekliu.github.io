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
