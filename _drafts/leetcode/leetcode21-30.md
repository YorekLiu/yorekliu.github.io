---
title: "LeetCode(3)"
excerpt: "LeetCode21-30总结"
categories:
  - Algorithm
tags:
  - LeetCode
  - Linked List
  - String
  - Backtracking
  - Divide and Conquer
  - Heap
  - Array
  - Two Pointers
toc: true
toc_label: "目录"
toc_icon: "heart"
#last_modified_at: 2018-09-01T11:59:25+08:00
---

## 21. Merge Two Sorted Lists

[Linked List](/tags/#linked-list){: .btn .btn--inverse }

Merge two sorted linked lists and return it as a new list. The new list should be made by splicing together the nodes of the first two lists.

**Example:**

Input: 1->2->4, 1->3->4  
Output: 1->1->2->3->4->4
{: .notice }

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
    public ListNode mergeTwoLists(ListNode l1, ListNode l2) {
        ListNode result = new ListNode(0), p = l1, q = l2, m = result;

        while (p != null || q != null) {
            if (p == null) {
                m.next = q;
                return result.next;
            }
            if (q == null) {
                m.next = p;
                return result.next;
            }
            if (p.val < q.val) {
                m.next = new ListNode(p.val);
                p = p.next;
            } else {
                m.next = new ListNode(q.val);
                q = q.next;
            }
            m = m.next;
        }

        return result.next;
    }
}
```

当两个list不同时为空时进行合并操作  
1.如果一个链表为空，那么直接链上另一个链表并返回即可  
2.否则，比较剩余的两链表头节点的数值大小，将较小者插入列表  
**列表操作最好不要直接操作入参列表**
{: .notice--success }

## 22. Generate Parentheses

[String](/tags/#string){: .btn .btn--inverse } [Backtracking](/tags/#backtracking){: .btn .btn--inverse }

Given n pairs of parentheses, write a function to generate all combinations of well-formed parentheses.

For example, given n = 3, a solution set is:

```
[
  "((()))",
  "(()())",
  "(())()",
  "()(())",
  "()()()"
]
```

**Brute Force**  
```java
class Solution {
    public List<String> generateParenthesis(int n) {
        List<String> result = new ArrayList();
        generateAll(new char[2 * n], 0, result);
        return result;
    }

    private void generateAll(char[] cur, int pos, List<String> result) {
        if (pos == cur.length) {
            if (isValid(cur)) {
                result.add(new String(cur));
            }
        } else {
            cur[pos] = '(';
            generateAll(cur, pos + 1, result);
            cur[pos] = ')';
            generateAll(cur, pos + 1, result);
        }
    }

    private boolean isValid(char[] cur) {
        int match = 0;
        for (char ch : cur) {
            if (ch == '(') match++;
            if (ch == ')') match--;
            if (match < 0) return false;
        }
        return match == 0;
    }
}
```

暴力破解法的要点在于递归，递归时分别给当前字符串加上左括号或右括号。  
当括号添加完成后判断是否满足条件。
{: .notice--success }

**Backtracking**  
```java
class Solution {
    public List<String> generateParenthesis(int n) {
        List<String> result = new ArrayList();
        generateAll("", 0, 0, n, result);
        return result;
    }

    private void generateAll(String cur, int open, int close, int n, List<String> result) {
        if (cur.length() == 2 * n) {
            result.add(cur);
            return;
        }

        if (open < n)
            generateAll(cur + "(", open + 1, close, n , result);
        if (close < open)
            generateAll(cur + ")", open, close + 1, n , result);
    }
}
```

回溯法在暴力破解法的基础上进行了改进：不直接添加左右括号，而是判断当前位置能不能为左右括号  。具体表现为：  
1.`open < n`表明左括号还没有放完，可以继续放  
2.`close < open`表明右括号比左括号少，可以放右括号  
这样保证了括号的正确性，因此只要能够达到长度，必定是合法的括号。
{: .notice--success }

## 23. Merge k Sorted Lists

[Linked List](/tags/#linked-list){: .btn .btn--inverse } [Divide and Conquer](/tags/#divide-and-conquer){: .btn .btn--inverse }
[Heap](/tags/#heap){: .btn .btn--inverse }

Merge k sorted linked lists and return it as one sorted list. Analyze and describe its complexity.

**Example:**  

Input:  
[  
&emsp;1->4->5,  
&emsp;1->3->4,  
&emsp;2->6  
]  
Output: 1->1->2->3->4->4->5->6    
{: .notice }


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
    public ListNode mergeKLists(ListNode[] lists) {
        if (lists.length == 0) return null;
        if (lists.length == 1) return lists[0];

        ListNode result = lists[0];
        for (int i = 1; i < lists.length; i++) {
            result = merge2List(result, lists[i]);
        }
        return result;
    }

    private ListNode merge2List(ListNode l1, ListNode l2) {
        ListNode result = new ListNode(0), p = result;

        while (l1 != null || l2 != null) {
            if (l1 == null) {
                p.next = l2;
                break;
            } else if (l2 == null) {
                p.next = l1;
                break;
            } else {
                if (l1.val <= l2.val) {
                    p.next = new ListNode(l1.val);
                    l1 = l1.next;
                } else {
                    p.next = new ListNode(l2.val);
                    l2 = l2.next;
                }
            }
            p = p.next;
        }

        return result.next;
    }
}
```

此题使用#21的思路，将链表两两进行合并，这样问题就退化了。
{: .notice--success }

## 24. Swap Nodes in Pairs

[Linked List](/tags/#linked-list){: .btn .btn--inverse }

Given a linked list, swap every two adjacent nodes and return its head.

**Example:**  

Given 1->2->3->4, you should return the list as 2->1->4->3.
{: .notice }

**Note:**
- Your algorithm should use only constant extra space.
- You may **not** modify the values in the list's nodes, only nodes itself may be changed.

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
    public ListNode swapPairs(ListNode head) {
        ListNode result = new ListNode(0), p, q, m, n = result;
        result.next = p = q = m = head;

        while (n != null && n.next != null && n.next.next != null) {
            p = n.next;
            q = p.next;
            m = q.next;

            n.next = q;
            q.next = p;
            p.next = m;

            n = p;
        }

        return result.next;
    }
}
```

此题要求将链表节点两两交换，比较简单。
{: .notice--success }

## 25. Reverse Nodes in k-Group

[Linked List](/tags/#linked-list){: .btn .btn--inverse }

Given a linked list, reverse the nodes of a linked list *k* at a time and return its modified list.

*k* is a positive integer and is less than or equal to the length of the linked list. If the number of nodes is not a multiple of *k* then left-out nodes in the end should remain as it is.

**Example:**  

Given this linked list: `1->2->3->4->5`  
For k = 2, you should return: `2->1->4->3->5`  
For k = 3, you should return: `3->2->1->4->5`
{: .notice }

**Note:**
- Only constant extra memory is allowed.
- You may not alter the values in the list's nodes, only nodes itself may be changed.

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
    public ListNode reverseKGroup(ListNode head, int k) {
        ListNode begin;
        if (head==null || head.next ==null || k==1)
    	    return head;
        ListNode dummyhead = new ListNode(-1);
        dummyhead.next = head;
        begin = dummyhead;
        int i=0;
        while (head != null){
            i++;
            if (i%k == 0){
                begin = reverse(begin, head.next);
                head = begin.next;
            } else {
                head = head.next;
            }
        }
        return dummyhead.next;
    }

    public ListNode reverse(ListNode begin, ListNode end){
        ListNode curr = begin.next;
        ListNode next, first;
        ListNode prev = begin;
        first = curr;
        while (curr!=end){
            next = curr.next;
            curr.next = prev;
            prev = curr;
            curr = next;
        }
        begin.next = prev;
        first.next = curr;
        return first;
    }
}
```

此题要求将链表进行k组逆序，基本知识点是单列表的逆序问题。  
注意逆序时，每组头尾节点的处理。  
{: .notice--success }

**单链表的逆序**
```java
public ListNode reverseKGroup(ListNode head, int k) {
    ListNode pre = null, next = null;

    while (head != null) {
        next = head.next;
        head.next = pre;
        pre = head;
        head = next;
    }

    return pre;
}
```

## 26. Remove Duplicates from Sorted Array

[Array](/tags/#array){: .btn .btn--inverse } [Two Pointers](/tags/#two-pointers){: .btn .btn--inverse }

Given a sorted array nums, remove the duplicates in-place such that each element appear only once and return the new length.

Do not allocate extra space for another array, you must do this by modifying the input array in-place with O(1) extra memory.

**Example 1:**  

Given nums = [1,1,2],  
Your function should return length = 2, with the first two elements of nums being 1 and 2 respectively.  
It doesn't matter what you leave beyond the returned length.
{: .notice }

**Example 2:**  

Given nums = [0,0,1,1,1,2,2,3,3,4],  
Your function should return length = 5, with the first five elements of nums being modified to 0, 1, 2, 3, and 4 respectively.  
It doesn't matter what values are set beyond the returned length.
{: .notice }

**Clarification:**  
Confused why the returned value is an integer but your answer is an array?

Note that the input array is passed in by reference, which means modification to the input array will be known to the caller as well.

Internally you can think of this:
```java
// nums is passed in by reference. (i.e., without making a copy)
int len = removeDuplicates(nums);

// any modification to nums in your function would be known by the caller.
// using the length returned by your function, it prints the first len elements.
for (int i = 0; i < len; i++) {
    print(nums[i]);
}
```

```java
class Solution {
    public int removeDuplicates(int[] nums) {    
        if (nums.length <= 1) {
            return nums.length;
        }

        int len = 1, pre = nums[0];
        for (int i = 1; i < nums.length; i++) {
            if (nums[i] == pre) {
                continue;
            } else {
                pre = nums[i];
                len++;
                nums[len - 1] = nums[i];
            }
        }

        return len;
    }
}
```

比较简单的问题，我们只需要在统计有效长度时顺便将当前有效长度的下标数据中塞入i当前的值即可。
{: .notice--success }

## 27. Remove Element

[Array](/tags/#array){: .btn .btn--inverse } [Two Pointers](/tags/#two-pointers){: .btn .btn--inverse }

Given an array nums and a value val, remove all instances of that value in-place and return the new length.

Do not allocate extra space for another array, you must do this by modifying the input array in-place with O(1) extra memory.

The order of elements can be changed. It doesn't matter what you leave beyond the new length.

**Example 1:**  

Given nums = [3,2,2,3], val = 3,  
Your function should return length = 2, with the first two elements of nums being 2.  
It doesn't matter what you leave beyond the returned length.
{: .notice }

**Example 2:**  

Given nums = [0,1,2,2,3,0,4,2], val = 2,  
Your function should return length = 5, with the first five elements of nums containing 0, 1, 3, 0, and 4.  
Note that the order of those five elements can be arbitrary.  
It doesn't matter what values are set beyond the returned length.
{: .notice }

**Clarification:**  
Confused why the returned value is an integer but your answer is an array?

Note that the input array is passed in by reference, which means modification to the input array will be known to the caller as well.

Internally you can think of this:
```java
// nums is passed in by reference. (i.e., without making a copy)
int len = removeElement(nums, val);

// any modification to nums in your function would be known by the caller.
// using the length returned by your function, it prints the first len elements.
for (int i = 0; i < len; i++) {
    print(nums[i]);
}
```

```java
class Solution {
    public int removeElement(int[] nums, int val) {
        Arrays.sort(nums);

        int begin = -1, end = -1;
        for (int i = 0; i < nums.length; i++) {
            if (nums[i] == val) {
                if (begin == -1) {
                    begin = i;
                }
                end = i;
            } else if (begin != -1) {
                break;
            }
        }

        if (begin == -1) return nums.length;

        int gap = end - begin + 1;

        for (int i = 0; i < nums.length - end - 1 && begin + gap + i < nums.length; i++) {
            nums[begin + i] = nums[begin + gap + i];
        }

        return nums.length - gap;
    }
}
```

首先将数组排序，找出val在数组中出现的开始、结束坐标。将结束坐标后的数据移动依次往前排即可。
{: .notice--success }

## 28. Implement strStr()

[String](/tags/#string){: .btn .btn--inverse } [Two Pointers](/tags/#two-pointers){: .btn .btn--inverse }

Implement strStr().

Return the index of the first occurrence of needle in haystack, or -1 if needle is not part of haystack.

**Example 1:**  

Input: haystack = "hello", needle = "ll"  
Output: 2
{: .notice }

**Example 2:**  

Input: haystack = "aaaaa", needle = "bba"  
Output: -1
{: .notice }

**Clarification:**  
What should we return when `needle` is an empty string? This is a great question to ask during an interview.

For the purpose of this problem, we will return 0 when `needle` is an empty string. This is consistent to C's `strstr()` and Java's `indexOf()`.

```java
class Solution {
    public int strStr(String haystack, String needle) {
        if (needle == null || needle.length() == 0 || "".equals(needle)) {
            return 0;
        }

        int index = 0, length = needle.length();
        char ch = needle.charAt(index);

        for (int i = 0; i < haystack.length(); i++) {
            if (ch == haystack.charAt(i)) {
                // matched, go on
                if (index + 1 < length) {
                    ch = needle.charAt(++index);
                } else {
                    // full match
                    return i - length + 1;
                }
            } else if (index != 0) {
                // part match, go back
                i -= index;
                index = 0;
                ch = needle.charAt(index);
            }
        }

        return -1;
    }
}
```

首先取needle的第0个字符，在`haystack`中找到第0个匹配字符  
1.如果匹配，继续读`needle`下一个字符，直到`needle`被读完，此时已经找到匹配结果了。  
2.如果第0个字符不匹配，且index不为0，说明`needle`的头部匹配，此时将i回退到当时的后一位（根据模式匹配算法，应该可以优化，不太确定），继续开始匹配。
{: .notice--success }
