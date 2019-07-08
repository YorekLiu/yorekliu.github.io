---
title: "LeetCode(10)"
excerpt: "LeetCode91-100总结"
categories:
  - Algorithm
tags:
  - LeetCode
  - Dynamic Programming
  - Linked List
  - Backtracking
  - Tree
  - Stack
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

## 93. Restore IP Addresses

[String](/tags/#string){: .tag } [Backtracking](/tags/#backtracking){: .tag }

Given a string containing only digits, restore it by returning all possible valid IP address combinations.

**Example:**

**Input:** "25525511135"  
**Output:** ["255.255.11.135", "255.255.111.35"]  
{: .notice }

**Solution**  

回溯法求解耗时 4 ms：

```java
class Solution {
    public List<String> restoreIpAddresses(String s) {
        List<String> result = new ArrayList<>();
        if (s == null || s.length() < 4 || s.length() > 12) {
            return result;
        }
        
        restoreIpAddressesInner(s, 0, new ArrayList<>(), result);
        
        return result;
    }
    
    private void restoreIpAddressesInner(String s, int index, List<String> solu, List<String> result) {
        if (index == 4 && s.length() == 0) {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 4; i++) {
                sb.append(solu.get(i));
                if (i != 3) {
                    sb.append(".");
                }
            }
            result.add(sb.toString());
            return;
        }
        
        for (int i = 1; i <= Math.min(3, s.length()); i++) {
            String temp = s.substring(0, i);
            Integer value = Integer.parseInt(temp);
            if (value >= 0 && value <= 255 && temp.length() == String.valueOf(value).length()) {
                solu.add(temp);
                restoreIpAddressesInner(s.substring(i), index + 1, solu, result);
                solu.remove(solu.size() - 1);
            }
        }
    }
}
```

下面的推荐解法耗时 2 ms：

```java
class Solution {
    public List<String> restoreIpAddresses(String s) {
        List<String> result = new ArrayList<>();
        if (s == null || s.length() < 4 || s.length() > 12) {
            return result;
        }

        final int n = s.length();

        for (int a = 1; a <= 3; a++) {
            for (int b = a + 1; b <= a + 3; b++) {
                for (int c = b + 1; c <= b + 3; c++) {
                    for (int d = c + 1; d <= c + 3; d++) {
                        if (d != n) continue;
                        int A = Integer.parseInt(s.substring(0, a));
                        int B = Integer.parseInt(s.substring(a, b));
                        int C = Integer.parseInt(s.substring(b, c));
                        int D = Integer.parseInt(s.substring(c, d));
                        String candidate = A + "." + B + "." + C + "." + D;
                        if (A <= 255 && B <= 255 && C <= 255 && D <= 255 && candidate.length() == n + 3) {
                            result.add(candidate);
                        }
                    }
                }
            }
        }

        return result;
    }
}
```

## 94. Binary Tree Inorder Traversal

[Stack](/tags/#stack){: .tag } [Tree](/tags/#tree){: .tag }

Given a binary tree, return the inorder traversal of its nodes' values.

**Example:**

**Input:**   
&nbsp;&nbsp;1  
&nbsp;&nbsp;&nbsp;&nbsp;\  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;2  
&nbsp;&nbsp;&nbsp;&nbsp;/  
&nbsp;&nbsp;&nbsp;3  
**Output:** [1,3,2] 
{: .notice }

**Follow up:** Recursive solution is trivial, could you do it iteratively?

**Solution**  

树的前、中、后序遍历算法以及层序遍历算法在[剑指offer第二版——树](/algorithm/code_interviews/#4-%E6%A0%91)中都有解释以及算法实现，本题就是考察中序遍历。

下面分别是递归以及循环实现：

**递归实现**

递归实现 Runtime 0 ms

```java
/**
 * Definition for a binary tree node.
 * public class TreeNode {
 *     int val;
 *     TreeNode left;
 *     TreeNode right;
 *     TreeNode(int x) { val = x; }
 * }
 */
class Solution {
    public List<Integer> inorderTraversal(TreeNode root) {
        List<Integer> result = new ArrayList<>();
        
        if (root == null) 
            return result;
        
        inorderInner(root, result);
        
        return result;
    }
    
    private void inorderInner(TreeNode root, List<Integer> result) {
        if (root.left != null)
            inorderInner(root.left, result);
        
        result.add(root.val);
        
        if (root.right != null)
            inorderInner(root.right, result);
    }
}
```

**循环实现**

循环实现 Runtime 1 ms，注意一下左子树回溯的情况，避免死循环。

```java
/**
 * Definition for a binary tree node.
 * public class TreeNode {
 *     int val;
 *     TreeNode left;
 *     TreeNode right;
 *     TreeNode(int x) { val = x; }
 * }
 */
class Solution {
    public List<Integer> inorderTraversal(TreeNode root) {
        List<Integer> result = new ArrayList<>();
        
        if (root == null) 
            return result;
        
        Stack<TreeNode> stack = new Stack<>();
        stack.push(root);
        
        while (!stack.isEmpty()) {
            TreeNode node = stack.peek();
            
            while (node != null) {
                stack.push(node.left);
                node = stack.peek();
            }
            
            stack.pop();
            
            if (!stack.isEmpty()) {
                node = stack.pop();
                result.add(node.val);

                stack.push(node.right);
            }
        }
        
        return result;
    }
}
```