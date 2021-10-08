---
title: "LeetCode(21-30)"
---

## 21. Merge Two Sorted Lists

- Linked List

> Merge two sorted linked lists and return it as a new list. The new list should be made by splicing together the nodes of the first two lists.

**Example:**

> Input: 1->2->4, 1->3->4  
> Output: 1->1->2->3->4->4

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


## 22. Generate Parentheses

- String 
- Backtracking

> Given n pairs of parentheses, write a function to generate all combinations of well-formed parentheses.
> 
> For example, given n = 3, a solution set is:
> 
> ```
> [
>   "((()))",
>   "(()())",
>   "(())()",
>   "()(())",
>   "()()()"
> ]
> ```

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

回溯法在暴力破解法的基础上进行了改进：不直接添加左右括号，而是判断当前位置能不能为左右括号。
具体表现为：  

1. `open < n`表明左括号还没有放完，可以继续放  
2. `close < open`表明右括号比左括号少，可以放右括号  

这样保证了括号的正确性，因此只要能够达到长度，必定是合法的括号。

## 23. Merge k Sorted Lists

- Linked List 
- Divide and Conquer
- Heap

> Merge k sorted linked lists and return it as one sorted list. Analyze and describe its complexity.

**Example:**  

> Input:  
> [  
> &emsp;1->4->5,  
> &emsp;1->3->4,  
> &emsp;2->6  
> ]  
> Output: 1->1->2->3->4->4->5->6    

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

## 24. Swap Nodes in Pairs

- Linked List

> Given a linked list, swap every two adjacent nodes and return its head.

**Example:**  

Given 1->2->3->4, you should return the list as 2->1->4->3.

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

## 25. Reverse Nodes in k-Group

- Linked List

> Given a linked list, reverse the nodes of a linked list *k* at a time and return its modified list.
> 
> *k* is a positive integer and is less than or equal to the length of the linked list. If the number of nodes is not a multiple of *k* then left-out nodes in the end should remain as it is.

**Example:**  

> Given this linked list: `1->2->3->4->5`  
> For k = 2, you should return: `2->1->4->3->5`  
> For k = 3, you should return: `3->2->1->4->5`

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

- Array 
- Two Pointers

> Given a sorted array nums, remove the duplicates in-place such that each element appear only once and return the new length.
> 
> Do not allocate extra space for another array, you must do this by modifying the input array in-place with O(1) extra memory.

**Example 1:**  

> Given nums = [1,1,2],  
> Your function should return length = 2, with the first two elements of nums being 1 and 2 respectively.  
> It doesn't matter what you leave beyond the returned length.

**Example 2:**  

> Given nums = [0,0,1,1,1,2,2,3,3,4],  
> Your function should return length = 5, with the first five elements of nums being modified to 0, 1, 2, 3, and 4 respectively.  
> It doesn't matter what values are set beyond the returned length.

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

## 27. Remove Element

- Array 
- Two Pointers

> Given an array nums and a value val, remove all instances of that value in-place and return the new length.
> 
> Do not allocate extra space for another array, you must do this by modifying the input array in-place with O(1) extra memory.
> 
> The order of elements can be changed. It doesn't matter what you leave beyond the new length.

**Example 1:**  

> Given nums = [3,2,2,3], val = 3,  
> Your function should return length = 2, with the first two elements of nums being 2.  
> It doesn't matter what you leave beyond the returned length.

**Example 2:**  

> Given nums = [0,1,2,2,3,0,4,2], val = 2,  
> Your function should return length = 5, with the first five elements of nums containing 0, 1, 3, 0, and 4.  
> Note that the order of those five elements can be arbitrary.  
> It doesn't matter what values are set beyond the returned length.

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

## 28. Implement strStr()

- String 
- Two Pointers

> Implement strStr().
> 
> Return the index of the first occurrence of needle in haystack, or -1 if needle is not part of haystack.

**Example 1:**  

> Input: haystack = "hello", needle = "ll"  
> Output: 2

**Example 2:**  

> Input: haystack = "aaaaa", needle = "bba"  
> Output: -1

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

KMP算法：  
首先取needle的第0个字符，在`haystack`中找到第0个匹配字符  
1.如果匹配，继续读`needle`下一个字符，直到`needle`被读完，此时已经找到匹配结果了。  
2.如果第0个字符不匹配，且index不为0，说明`needle`的头部匹配，此时将i回退到当时的后一位，继续开始匹配。


## 29. Divide Two Integers

- Binary Search

> Given two integers `dividend` and `divisor`, divide two integers without using multiplication, division and mod operator.
> 
> Return the quotient after dividing `dividend` by `divisor`.
> 
> The integer division should truncate toward zero.

**Example 1:**  

> Input: dividend = 10, divisor = 3  
> Output: 3

**Example 2:**  

> Input: dividend = 7, divisor = -3  
> Output: -2

**Note:**  

- Both dividend and divisor will be 32-bit signed integers.
- The divisor will never be 0.
- Assume we are dealing with an environment which could only store integers within the 32-bit signed integer range: [−2^31,  2^31 − 1]. For the purpose of this problem, assume that your function returns 2^31 − 1 when the division result overflows.

**Code:**  
```java
class Solution {
    public int divide(int dividend, int divisor) {
        if (divisor == 0 || (dividend == Integer.MIN_VALUE && divisor == -1)) {
            return Integer.MAX_VALUE;
        }
        int sign = ((dividend < 0) ^ (divisor < 0)) ? -1 : 1;
        long dvd = Math.abs((long) dividend);
        long dvs = Math.abs((long) divisor);
        long res = 0;

        while (dvd >= dvs) {
            long tmp = dvs, multi = 1;
            while (dvd >= (tmp << 1)) {
                tmp <<= 1;
                multi <<= 1;
            }
            dvd -= tmp;
            res += multi;
        }

        return sign == 1 ? (int) res : (int) -res;
    }
}
```

由于题目限制不能使用x、/、%操作符。所以高票答案采取了位运算的思路。  
1.处理边界情况  
2.获取结果符号，将除数与被除数转为正数，后续操作可以不用关心符号问题  
3.对被除数进行进位，找出最接近除数的被除数进位，并相减；累计进位结果  
4.对第1步的剩余，循环进行第1步的操作  
5.返回带符号的结果  
**Note**:  
1.注意`Math.abs(Integer.MIN_VALUE)=Integer.MIN_VALUE`，所以在第二步中采取了`Math.abs((long) dividend)`操作  
2.返回结果时不要`return (int) sign * res;`，这里的「\*」违反了规则

## 30. Substring with Concatenation of All Words

- Hash Table 
- Two Pointers 
- String

> You are given a string, s, and a list of words, words, that are all of the same length. Find all starting indices of substring(s) in s that is a concatenation of each word in words exactly once and without any intervening characters.

**Example 1:**  

> Input:  
>   s = "barfoothefoobarman",  
>   words = ["foo","bar"]  
> Output: [0,9]  
> Explanation: Substrings starting at index 0 and 9 are "barfoor" and "foobar" respectively.  
> The output order does not matter, returning [9,0] is fine too.

**Example 2:**  

> Input:  
>   s = "wordgoodstudentgoodword",  
>   words = ["word","student"]  
> Output: []

**Code:**  
```java
class Solution {
    public List<Integer> findSubstring(String s, String[] words) {
        // cuz words in words are same length, we cut s into substrings with "len" length;
        // this problem converted to LC438.

        List<Integer> res = new ArrayList<>();
        if(words == null || words.length == 0) return res;

        int distinctWordCount = 0;
        Map<String, Integer> wordDict = new HashMap<>();
        for(String word : words) {
            wordDict.put(word, wordDict.getOrDefault(word, 0) + 1);
            if(wordDict.get(word) == 1) distinctWordCount++;
        }

        int len = words[0].length();
        for(int k = 0; k < len; k++) { // sustrings in consideration [k, s.length())
            Map<String, Integer> map = new HashMap<>(); // can't operate on wordDict, cuz, diff k share wordDict
            int count = 0;
            for(int i = k, j = k; j <= s.length() - len; j += len) { // word by word, so, increment is "len"

                if((j - i) / len >= words.length) { // if the sliding window exceed the length limit; similar to j-i > p.length() in LC438
                    String rmvWord = s.substring(i, i + len);
                    if(wordDict.containsKey(rmvWord)) { // only care word existed in words[]
                        map.put(rmvWord, map.get(rmvWord) - 1);
                        if(map.get(rmvWord) == wordDict.get(rmvWord) - 1) count--; // disrupt the meet
                    }
                    i += len;
                }

                String addWord = s.substring(j, j + len);
                if(wordDict.containsKey(addWord)) {
                    map.put(addWord, map.getOrDefault(addWord, 0) + 1);
                    if(map.get(addWord) == wordDict.get(addWord)) count++; // get a new meet
                }

                if(count == distinctWordCount) res.add(i);
            }
        }

        return res;
    }
}
```

本题要求找出与所有单词串联的子字符串。words中的关键词可能会重复。  
1.首先记录每个关键词的次数以及去重后的关键词个数  
2.按关键词的长度进行扩充区间；在此过程中，每扩充区间后判断新增加的子串是否是关键词串  
3.若为关键词串，则在临时表中加1，同时判断该关键词是否已经处理完毕  
4.若所有关键词处理完毕，则是一种结果，记录到List中  
5.每次扩充区间前，判断滑动窗口是否达到了长度的上限  
5.1.若达到了，窗口进行滑动，同时判断滑过的字符串是否是关键词  
5.2.若是，将此关键词在临时表以及其他地方记录复位。