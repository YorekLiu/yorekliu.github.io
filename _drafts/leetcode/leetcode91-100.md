---
title: "LeetCode(10)"
excerpt: "LeetCode91-100总结"
categories:
  - Algorithm
tags:
  - LeetCode
  - Dynamic Programming
  - Linked List
toc: true
toc_label: "目录"
# last_modified_at: 2019-06-28T02:05:15+08:00
---

<script type="text/javascript" async
  src="https://cdn.mathjax.org/mathjax/latest/MathJax.js?config=TeX-MML-AM_CHTML">
</script>

## 91. Decode Ways

[Dynamic Programming](/tags/#dynamic-programming){: .tag } 

A message containing letters from `A-Z` is being encoded to numbers using the following mapping:

'A' -> 1  
'B' -> 2  
...  
'Z' -> 26
{: .notice }

Given a **non-empty** string containing only digits, determine the total number of ways to decode it.

**Example 1:**

**Input:** "12"  
**Output:** 2  
**Explanation:** It could be decoded as "AB" (1 2) or "L" (12).
{: .notice }

**Example 2:**

**Input:** "226"  
**Output:** 3  
**Explanation:** It could be decoded as "BZ" (2 26), "VF" (22 6), or "BBF" (2 2 6).
{: .notice }

**Solution**  

对于任意的i，i的上一步可能是i-1（如果是1～9的数）也可能是i-2（10～26的数）  
所以动态规划可以求解，注意一下dp[0]的取值。  
Runtime 2 ms

```java
class Solution {
    public int numDecodings(String s) {
        if(s == null || s.length() == 0) {
            return 0;
        }
        int n = s.length();
        int[] dp = new int[n + 1];
        dp[0] = 1;
        dp[1] = s.charAt(0) != '0' ? 1 : 0;
        for(int i = 2; i <= n; i++) {
            int first = Integer.valueOf(s.substring(i - 1, i));
            int second = Integer.valueOf(s.substring(i - 2, i));
            if(first >= 1 && first <= 9) {
               dp[i] += dp[i - 1];  
            }
            if(second >= 10 && second <= 26) {
                dp[i] += dp[i - 2];
            }
        }
        return dp[n];
    }
}
```

## 92. Reverse Linked List II

[Linked List](/tags/#linked-list){: .tag } 

Reverse a linked list from position *m* to *n*. Do it in one-pass.

**Note:** 1 ≤ *m* ≤ *n* ≤ length of list.

**Example:**

**Input:** 1->2->3->4->5->NULL, *m* = 2, *n* = 4  
**Output:** 1->4->3->2->5->NULL  
{: .notice }

**Solution**  

此题可以理解为将后面的节点依次插入到前面的节点中，  
比如1->2->3->4->5->NULL，m指向2，n-m=2，也就是要插入两次  
第一次，将m后面的3插入到m前面，变成了：  
1->3->2->4->5->NULL，m还原到第二个节点，现在指向3，  
第二次，将m后面的后面的4插入到m前面，所以最后变成为  
1->4->3->2->5->NULL

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
    public ListNode reverseBetween(ListNode head, int m, int n) {
        if (--m == --n) return head;
        if (head == null || head.next == null) return head;
        
        ListNode h = new ListNode(0);
        h.next = head;
        
        ListNode p = h, m1 = p.next, q, n1;
        
        for (int i = 0; i < m; i++) {
             p = p.next;
             m1 = p.next;
        }
        
        q = m1;
        n1 = m1.next;
        
        for (int i = m; i < n; i++) {
            q.next = n1.next;
            n1.next = m1;
            p.next = n1;
            
            n1 = q.next;
            m1 = p.next;
        }
        
        return h.next;
    }
}
```