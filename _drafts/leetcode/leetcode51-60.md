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

## 51. N-Queens

[Backtracking](/tags/#backtracking){: .btn .btn--inverse }  

The *n*-queens puzzle is the problem of placing *n* queens on an *n*×*n* chessboard such that no two queens attack each other.  

<figure style="width: 33%" class="align-center">
    <img src="/assets/images/leetcode/question_51_8-queens.png">
</figure>

Given an integer *n*, return all distinct solutions to the *n*-queens puzzle.  

Each solution contains a distinct board configuration of the *n*-queens' placement, where `'Q'` and `'.'` both indicate a queen and an empty space respectively. 

**Example:**

**Input**: 4  
**Output**: [  
&emsp;[".&emsp;Q&emsp;.&emsp;.",  // Solution 1  
&emsp;&emsp;".&emsp;.&emsp;.&emsp;Q",  
&emsp;&emsp;"Q&emsp;.&emsp;.&emsp;.",  
&emsp;&emsp;".&emsp;.&emsp;Q&emsp;."],  
&emsp;[".&emsp;.&emsp;Q&emsp;.",  // Solution 2  
&emsp;&emsp;"Q&emsp;.&emsp;.&emsp;.",  
&emsp;&emsp;".&emsp;.&emsp;.&emsp;Q",  
&emsp;".&emsp;Q&emsp;.&emsp;."]  
]  
**Explanation**: There exist two distinct solutions to the 4-queens puzzle as shown above.
{: .notice }

**Solution**  

根据规则，任意两个皇后不能在同一行、同一列、同一对角线上。  
所以，可以定义行、两条对角线上的标志位，表示对应的线上是否存在皇后。然后我们每次在一行上的所有位置尝试放置皇后，放置成功则设置标志位，然后进行回溯算法，回溯完成后复位标志位。  
当放置完最后一个皇后时，这就是问题的一个解。

```java
class Solution {
    public List<List<String>> solveNQueens(int n) {
        List<List<String>> result = new ArrayList<>();
        if (n <= 0) return result;
        char[] solution = new char[n * n];
        Arrays.fill(solution, '.');
        solveNQueensInner(0, n, new boolean[n], new boolean[2 * n - 1], new boolean[2 * n - 1], solution, result);
        return result;
    }
    
    private void solveNQueensInner(int row, int n, boolean[] flags, boolean[] flags45, boolean[] flags135, char[] solution, List<List<String>> result) {
        if (row == n) {
            List<String> soluList = new ArrayList<String>(n);
            for (int i = 0; i < n; i++) {
                soluList.add(new String(solution, i * n, n));
            }
            result.add(soluList);
            return;
        }
        
        for (int i = 0; i < n; i++) {
            if (flags[i] || flags135[n - 1 + i - row] || flags45[row + i]) continue;
            flags[i] = flags135[n - 1 + i - row] = flags45[row + i] = true;
            solution[row * n + i] = 'Q';
            solveNQueensInner(row + 1, n, flags, flags45, flags135, solution, result);
            solution[row * n + i] = '.';
            flags[i] = flags135[n - 1 + i - row] = flags45[row + i] = false;
        }
    }
}
```

## 52. N-Queens II

[Backtracking](/tags/#backtracking){: .btn .btn--inverse }  

The *n*-queens puzzle is the problem of placing *n* queens on an *n*×*n* chessboard such that no two queens attack each other.  

<figure style="width: 33%" class="align-center">
    <img src="/assets/images/leetcode/question_51_8-queens.png">
</figure>

Given an integer *n*, return all distinct solutions to the *n*-queens puzzle.  

Each solution contains a distinct board configuration of the *n*-queens' placement, where `'Q'` and `'.'` both indicate a queen and an empty space respectively. 

**Example:**

**Input**: 4  
**Output**: 2  
**Explanation**: There are two distinct solutions to the 4-queens puzzle as shown below.  
[  
&emsp;[".&emsp;Q&emsp;.&emsp;.",  // Solution 1  
&emsp;&emsp;".&emsp;.&emsp;.&emsp;Q",  
&emsp;&emsp;"Q&emsp;.&emsp;.&emsp;.",  
&emsp;&emsp;".&emsp;.&emsp;Q&emsp;."],  
&emsp;[".&emsp;.&emsp;Q&emsp;.",  // Solution 2  
&emsp;&emsp;"Q&emsp;.&emsp;.&emsp;.",  
&emsp;&emsp;".&emsp;.&emsp;.&emsp;Q",  
&emsp;".&emsp;Q&emsp;.&emsp;."]  
]
{: .notice }

**Solution**  

解法流程和上面N-Queens类似，唯一不同的是，此时我们不需要保存的解，所以只需要只用标志位即可。

```java
class Solution {
    private int mCount;
    
    public int totalNQueens(int n) {
        if (n <= 0) return 0;
        totalNQueensInner(0, n, new boolean[n], new boolean[2 * n - 1], new boolean[2 * n - 1]);
        return mCount;
    }
    
    private void totalNQueensInner(int row, int n, boolean[] flags, boolean[] flags45, boolean[] flags135) {
        if (row == n) {
            mCount++;
            return;
        }
        
        for (int i = 0; i < n; i++) {
            if (flags[i] || flags135[n - 1 + i - row] || flags45[row + i]) continue;
            flags[i] = flags135[n - 1 + i - row] = flags45[row + i] = true;
            totalNQueensInner(row + 1, n, flags, flags45, flags135);
            flags[i] = flags135[n - 1 + i - row] = flags45[row + i] = false;
        }
    }
}
```

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
