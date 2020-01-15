---
title: "LeetCode(71-80)"
---

## 71. Simplify Path

- Stack 
- Deque 

> Given an **absolute path** for a file (Unix-style), simplify it. Or in other words, convert it to the **canonical path**.
> 
> In a UNIX-style file system, a period `.` refers to the current directory. Furthermore, a double period `..` moves the directory up a level. For more information, see: [Absolute path vs relative path in Linux/Unix](https://www.linuxnix.com/abslute-path-vs-relative-path-in-linuxunix/)
> 
> Note that the returned canonical path must always begin with a slash `/`, and there must be only a single slash `/` between two directory names. The last directory name (if it exists) must not end with a trailing `/`. Also, the canonical path must be the shortest string representing the absolute path.

**Example 1:**

> **Input:** "/home/"  
> **Output:** "/home"  
> **Explanation:** Note that there is no trailing slash after the last directory name.  

**Example 2:**

> **Input:** "/../"  
> **Output:** "/"  
> **Explanation:** Going one level up from the root directory is a no-op, as the root level is the highest level you can go.  

**Example 3:**

> **Input:** "/home//foo/"  
> **Output:** "/home/foo"  
> **Explanation:** In the canonical path, multiple consecutive slashes are replaced by a single one.

**Example 4:**

> **Input:** "/a/./b/../../c/"  
> **Output:** "/c"  

**Example 5:**

> **Input:** "/a/../../b/../c//.//"  
> **Output:** "/c"  

**Example 6:**

> **Input:** "/a//b////c/d//././/.."  
> **Output:** "/a/b/c"  

**Solution**  

可以使用栈的思路解决，首先将输入的路径按照`"/"`分解，`""`（由两个`//`生成）或者`"."`直接忽略，遇到`".."`则pop，其他情况则push。这样最后Stack的进栈顺序就是所求的规范路径。  
考虑到最后需要用到Stack的进栈顺序，所以这里使用了双端队列`Deque`。

Runtime 4ms。

```java
class Solution {
    public String simplifyPath(String path) {
        Deque<String> deque = new ArrayDeque<>();
        String[] splits = path.split("/");
        for (String str : splits) {
            switch (str) {
                case ".":
                case "":
                    break;
                    
                case "..":
                    if (!deque.isEmpty()) {
                        deque.pollLast();
                    }
                    break;
                    
                default:
                    deque.offer(str);
            }
        }
        
        StringBuilder sb = new StringBuilder("/");
        while (!deque.isEmpty()) {
            sb.append(deque.poll());
            if (!deque.isEmpty()) {
                sb.append("/");
            }
        }
        
        return sb.toString();
    }
}
```

## 72. Edit Distance

- Dynamic Programming 

> Given two words *word1* and *word2*, find the minimum number of operations required to convert *word1* to *word2*.
> 
> You have the following 3 operations permitted on a word:
> 
> 1. Insert a character
> 2. Delete a character
> 3. Replace a character

**Example 1:**

> **Input:** word1 = "horse", word2 = "ros"  
> **Output:** 3  
> **Explanation:**  
> horse -> rorse (replace 'h' with 'r')  
> rorse -> rose (remove 'r')  
> rose -> ros (remove 'e')  

**Example 2:**

> **Input:** word1 = "intention", word2 = "execution"  
> **Output:** 5  
> **Explanation:**  
> intention -> inention (remove 't')  
> inention -> enention (replace 'i' with 'e')  
> enention -> exention (replace 'n' with 'x')  
> exention -> exection (replace 'n' with 'c')  
> exection -> execution (insert 'u')

**Solution**  

此题本质上是一个DP问题，但是比较难理解:(  用例子试一下会好理解一点点  

首先我们定义`dp[i][j]`是将`word1[0..i)`转变为`word2[0..j)`的最少操作次数。  
**初始情况**：将一个字符串变成空字符串，最少操作（删除）次数就是字符串的长度，因此`dp[i][o] = i`、`dp[0][j] = j`。  
**一般情况**：将`word1[0..i)`转变为`word2[0..j)`需要将问题划分为子问题。假如我们知道了怎样将将`word1[0..i - 1)`转变为`word2[0..j - 1)`（也就是知道了`dp[i - 1][j - 1]`）：

- 如果`word1[i - 1] == word2[j - 1]`，那么不需要额外的操作，因此`dp[i][j] = dp[i - 1][j - 1]`
- 如果`word1[i - 1] != word2[j - 1]`，那么我们Insert、Delete、Replace一个字符串达到目的

   1. 如果`word1[0..i) + word2[j - 1] = word2[0..j)`，将`word2[j - 1]`**Insert**到`word1[0..i)`中即可  
      因此`dp[i][j] = dp[i][j - 1] + 1`
   2. 如果`word1[0..i - 1) = word2[0..j)`,**Delete**`word1[i - 1]`即可  
      因此`dp[i][j] = dp[i - 1][j] + 1`
   3. 否则用`word2[j - 1]`**Replace**`word1[i - 1]`  
      因此`dp[i][j] = dp[i - 1][j - 1] + 1`  

  所以，当`word1[i - 1] != word2[j - 1]`时，`dp[i][j]`是上面三种情况的最小值。

下面的代码是优化了空间复杂度的解法。Runtime 3ms。

```java
class Solution {
    public int minDistance(String word1, String word2) {
        final int m = word1.length();
        final int n = word2.length();
        int[] dp = new int[n + 1];
        int lt = 0;
        
        for (int j = 1; j <= n; j++) {
            dp[j] = j;
        }
        
        for (int i = 1; i <= m; i++) {
            lt = dp[0];
            dp[0] = i;
            for (int j = 1; j <= n; j++) {
                int currentDp;
                if (word1.charAt(i - 1) == word2.charAt(j - 1)) {
                    currentDp = lt;
                } else {
                    currentDp = Math.min(lt, Math.min(dp[j], dp[j - 1])) + 1;
                }
                lt = dp[j];
                dp[j] = currentDp;
            }
        }
        
        return dp[n];
    }
}
```

## 73. Set Matrix Zeroes

- Array 

> Given a *m* x *n* matrix, if an element is 0, set its entire row and column to 0. Do it [in-place](https://en.wikipedia.org/wiki/In-place_algorithm).

**Example 1:**

> **Input:**  
> [  
> &emsp;&emsp;[1,1,1],  
> &emsp;&emsp;[1,0,1],  
> &emsp;&emsp;[1,1,1]  
> ]  
> **Output:**  
> [  
> &emsp;&emsp;[1,0,1],  
> &emsp;&emsp;[0,0,0],  
> &emsp;&emsp;[1,0,1]  
> ]  

**Example 2:**

> **Input:**  
> [  
> &emsp;&emsp;[0,1,2,0],  
> &emsp;&emsp;[3,4,5,2],  
> &emsp;&emsp;[1,3,1,5]  
> ]  
> **Output:**  
> [  
> &emsp;&emsp;[0,0,0,0],  
> &emsp;&emsp;[0,4,5,0],  
> &emsp;&emsp;[0,3,1,0]  
> ]

**Follow up:**

- A straight forward solution using $O(mn)$ space is probably a bad idea.
- A simple improvement uses $O(m + n)$ space, but still not the best solution.
- Could you devise a constant space solution?

**Solution**  

此题的关键就是先记录下矩阵中为0的点的坐标，然后在对这些坐标进行操作。

1. 所以，直接了当的做法就是弄一个相同大小的二维数组来记录点的坐标$O(mn)$。
2. 既然每一个点所在的行列都会在稍后被设置为0，那么我们只需要记录某行某列是否需要被设置就行了，空间复杂度为$O(m+n)$。
3. 可以将矩阵的第一行、第一列视为解法2的辅助数组，但是matrix[0][0]是第一行和第一列共同的，所以额外使用一个常量记录matrix[0][0]表示不了的另外一行/列，因此为$O(1)$。

下面的代码是$O(m+n)$的解法。Runtime 1ms。

```java
class Solution {
    public void setZeroes(int[][] matrix) {
        if (matrix == null || matrix.length == 0 || matrix[0].length == 0) {
            return;
        }
        
        final int r = matrix.length;
        final int c = matrix[0].length;
        boolean[] rp = new boolean[r];
        boolean[] cp = new boolean[c];
        
        for (int i = 0; i < r; i++) {
            for (int j = 0; j < c; j++) {
                if (matrix[i][j] == 0) {
                    rp[i] = true;
                    cp[j] = true;
                }
            }
        }
        
        for (int i = 0; i < r; i++) {
            for (int j = 0; j < c; j++) {
                if (rp[i] || cp[j]) {
                    matrix[i][j] = 0;
                }
            }
        }
    }
}
```

## 74. Search a 2D Matrix

- Binary Search 

> Write an efficient algorithm that searches for a value in an *m* x *n* matrix. This matrix has the following properties:
> 
> - Integers in each row are sorted from left to right.
> - The first integer of each row is greater than the last integer of the previous row.

**Example 1:**

> **Input:**  
> matrix = [  
> &emsp;&emsp;[1,1,1],  
> &emsp;&emsp;[1,0,1],  
> &emsp;&emsp;[1,1,1]  
> ]  
> target = 3  
> **Output:** true  

**Example 2:**

> **Input:**  
> matrix = [  
> &emsp;&emsp;[0,1,2,0],  
> &emsp;&emsp;[3,4,5,2],  
> &emsp;&emsp;[1,3,1,5]  
> ]  
> target = 13  
> **Output:** false

**Solution**  

此题同[CI-(4)二维数组中的查找](/leetcode/code_interviews_1/#12-4)

我们利用每行每列都是递增的规律，可以整行、整列地缩减查找范围。  
首选选取数组右上角的数字。如果数字等于要查找的数字，则查找过程结束；如果该数字大于要查找的数字，说明要查找的数字位于该列左边，所以剔除这个数字所在的列；如果该数字小于要查找的数字，说明要查找的数字位于改行下方，所以剔除这个数字所在的行。这样每一步都可以缩小查找的方位，直到找到数字或查找结束。  
同样，我们也可以选择左下角的数字，也可以逐步减小查找范围。其他两个角因为是最小值、最大值，无法逐步减小查找范围。

Runtime 0ms。

```java
class Solution {
    public boolean searchMatrix(int[][] matrix, int target) {
        if (matrix == null || matrix.length == 0) return false;
        
        final int R = matrix.length;
        final int C = matrix[0].length;
        
        int r = 0;
        int c = C - 1;
        
        while (c >= 0 && r < R) {
            if (matrix[r][c] == target) {
                return true;
            } else if (matrix[r][c] > target) {
                c--;
            } else if (matrix[r][c] < target) {
                r++;
            }
        }
        
        return false;
    }
}
```

## 75. Sort Colors

- Two Pointers 

> Given an array with *n* objects colored red, white or blue, sort them [in-place](https://en.wikipedia.org/wiki/In-place_algorithm) so that objects of the same color are adjacent, with the colors in the order red, white and blue.
> 
> Here, we will use the integers 0, 1, and 2 to represent the color red, white, and blue respectively.

**Note:** You are not suppose to use the library's sort function for this problem.

**Example:**

> **Input:** [2,0,2,1,1,0]  
> **Output:** [0,0,1,1,2,2]  

**Follow up:**

- A rather straight forward solution is a two-pass algorithm using counting sort.  
  First, iterate the array counting number of 0's, 1's, and 2's, then overwrite array with total number of 0's, then 1's and followed by 2's.
- Could you come up with a one-pass algorithm using only constant space?

**Solution**  

从前往后遍历数组，把数字2从末尾开始摆放，把数字0从开头开始摆放。

Runtime 0ms。

```java
class Solution {
    public void sortColors(int[] nums) {
        if (nums == null || nums.length <= 1) return;
        
        final int N = nums.length;
        int zero = 0, two = N - 1;
        
        for (int i = 0; i <= two; i++) {
            while (i < two && nums[i] == 2) {
                swap(nums, i, two--);
            }
            while (i > zero && nums[i] == 0) {
                swap(nums, i, zero++);
            }
        }
    }
    
    private void swap(int[] nums, int i, int j) {
        int temp = nums[i];
        nums[i] = nums[j];
        nums[j] = temp;
    }
}
```

## 76. Minimum Window Substring

- Two Pointers 
- Hash Table 

> Given a string S and a string T, find the minimum window in S which will contain all the characters in T in complexity O(n).

**Example:**

> **Input:** S = "ADOBECODEBANC", T = "ABC"  
> **Output:** "BANC"  

**Note:**

- If there is no such window in S that covers all characters in T, return the empty string `""`.
- If there is such window, you are guaranteed that there will always be only one unique minimum window in S.

**Solution**  

大多数子串问题都可以使用hashmap + two pointers求解。

Runtime 1ms。

```java
class Solution {
    public String minWindow(String s, String t) {
        final int[] map = new int[128];
        for (char ch : t.toCharArray()) {
            map[ch]++;
        }
        
        int begin, end, head;
        begin = end = head = 0;
        int distance = Integer.MAX_VALUE;
        int count = t.length();
        
        while (end < s.length()) {
            if (map[s.charAt(end++)]-- > 0) count--;
            while (count == 0) {
                if (end - begin < distance) {
                    distance = end - begin;
                    head = begin;
                }
                if (map[s.charAt(begin++)]++ == 0) count++;
            }
        }
        
        return distance == Integer.MAX_VALUE ? "" : s.substring(head, head + distance);
    }
}
```

## 77. Combinations

- Backtracking 

> Given two integers *n* and *k*, return all possible combinations of *k* numbers out of 1 ... *n*.

**Example:**

> **Input:** n = 4, k = 2  
> **Output:**  
> [  
> &emsp;&emsp;[2,4],  
> &emsp;&emsp;[3,4],  
> &emsp;&emsp;[2,3],  
> &emsp;&emsp;[1,2],  
> &emsp;&emsp;[1,3],  
> &emsp;&emsp;[1,4],  
> ]  

**Solution**  

这个问题很简单，全排列的模版直接上就可以了。

Runtime 1ms。

```java
class Solution {
    public List<List<Integer>> combine(int n, int k) {
        if (k <= 0 || k > n) return null;

        List<List<Integer>> result = new ArrayList<>(); // C{n}{k}
        combineInner(0, n - k, k, new ArrayList<>(k), result);

        return result;
    }

    private void combineInner(int from, int to, int count, List<Integer> tmp, List<List<Integer>> result) {
        if (0 == count) {
            result.add(new ArrayList<>(tmp));
            return;
        }

        for (int i = from; i <= to; i++) {
            tmp.add(i + 1);
            combineInner(i + 1, to + 1, count - 1, tmp, result);
            tmp.remove(tmp.size() - 1);
        }
    }
}
```

## 78. Subsets

- Backtracking 

> Given a set of **distinct** integers, *nums*, return all possible subsets (the power set).

**Note:** The solution set must not contain duplicate subsets.

**Example:**

> **Input:** nums = [1,2,3]  
> **Output:**  
> [  
> &emsp;&emsp;[3],  
> &emsp;&emsp;[1],  
> &emsp;&emsp;[2],  
> &emsp;&emsp;[1,2,3],  
> &emsp;&emsp;[1,3],  
> &emsp;&emsp;[2,3],  
> &emsp;&emsp;[1,2],  
> &emsp;&emsp;[]  
> ]

**Solution**  

这个问题很简单，全排列的模版直接上也可以。

Runtime 0ms。

```java
class Solution {
    public List<List<Integer>> subsets(int[] nums) {
        List<List<Integer>> result = new ArrayList<>();
        
        subsetsInner(nums, 0, new ArrayList<>(), result);
        
        return result;
    }
    
    private void subsetsInner(int[] nums, int index, List<Integer> solution, List<List<Integer>> result) {
        result.add(new ArrayList<>(solution));
        
        for (int i = index; i < nums.length; i++) {
            solution.add(nums[i]);
            subsetsInner(nums, i + 1, solution, result);
            solution.remove(solution.size() - 1);
        }
    }
}
```

## 79. Word Search

- Backtracking 

> Given a 2D board and a word, find if the word exists in the grid.
> 
> The word can be constructed from letters of sequentially adjacent cell, where "adjacent" cells are those horizontally or vertically neighboring. The same letter cell may not be used more than once.

**Example:**

> board =  
> [  
> &emsp;&emsp;['A','B','C','E'],  
> &emsp;&emsp;['S','F','C','S'],  
> &emsp;&emsp;['A','D','E','E']  
> ]  
> Given word = "**ABCCED**", return **true**.  
> Given word = "**SEE**", return **true**.  
> Given word = "**ABCB**", return **false**.  

**Solution**  

此题同[CI-(12)矩阵中的路径](/leetcode/code_interviews_1/#631-12)

这是一个可以用回溯法解决的典型题。首先，在矩阵中任选一个格子ch作为路径的起点。如果路径上第i个字符刚好是ch，那么到相邻的格子寻找路径上的第i+1个字符。除矩阵边界上的格子之外，其他格子都有4个相邻的格子。重复这个过程，直到路径上的所有字符都在矩阵中找到相应的位置。
由于回溯法的递归特性，路径可以看成一个栈。当在矩阵中定位了路径中前n个字符的位置之后，在与第n个字符对应的格子的周围都没有找到第n+1个字符，这时候只好在路径上回到第n-1的字符，重新定位第n个字符。
由于路径不能重复进入矩阵的格子，所以还需要定义和字符矩阵大小一样的布尔值矩阵，用来识别路径是否已经进入了某个格子。

Runtime 3ms。

```java
class Solution {
    public boolean exist(char[][] board, String word) {
        if (board == null || board.length == 0 || word == null || word.length() == 0) {
            return false;
        }
        
        final int ROW = board.length;
        final int COL = board[0].length;
        boolean[][] visited = new boolean[ROW][COL];
        char[] words = word.toCharArray();
        
        for (int i = 0; i < ROW; i++) {
            for (int j = 0; j < COL; j++) {
                if (board[i][j] == words[0]) {
                    visited[i][j] = true;
                    if (search(board, visited, words, 1, i, j, ROW, COL)) return true;
                    visited[i][j] = false;
                }
            }
        }
        
        return false;
    }
    
    private boolean search(char[][] board, boolean[][] visited, char[] word, int index, int i, int j, final int row, final int col) {
        if (index == word.length) return true;
        
        return trySearch(board, visited, word, index, i, j - 1, row, col) ||
            trySearch(board, visited, word, index, i - 1, j, row, col) ||
            trySearch(board, visited, word, index, i, j + 1, row, col) ||
            trySearch(board, visited, word, index, i + 1, j, row, col);
    }
    
    private boolean trySearch(char[][] board, boolean[][] visited, char[] word, int index, int i, int j, final int row, final int col) {
        if (i < 0 || j < 0 || i >= row || j >= col) return false;
        if (!(!visited[i][j] && board[i][j] == word[index])) return false;
        
        boolean result = false;
        if (!visited[i][j] && board[i][j] == word[index]) {
            visited[i][j] = true;
            result = search(board, visited, word, index + 1, i, j, row, col);
            visited[i][j] = false;
        }
        return result;
    }
}
```

## 80. Remove Duplicates from Sorted Array II

- Array 
- Two Pointers 

> Given a sorted array *nums*, remove the duplicates `in-place` such that duplicates appeared at most twice and return the new length.
> 
> Do not allocate extra space for another array, you must do this by **modifying the input array** `in-place` with O(1) extra memory.

**Example 1:** 

> Given nums = [1,1,1,2,2,3],  
> Your function should return length = 5, with the first five elements of nums being 1, 1, 2, 2 and 3 respectively.  
> It doesn't matter what you leave beyond the returned length.

**Example 2:**

> Given nums = [0,0,1,1,1,1,2,3,3],  
> Your function should return length = 7, with the first seven elements of nums being modified to 0, 0, 1, 1, 2, 3 and 3 respectively.  
> It doesn't matter what values are set beyond the returned length.

**Clarification:**

Confused why the returned value is an integer but your answer is an array?

Note that the input array is passed in by **reference**, which means modification to the input array will be known to the caller as well.

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

**Solution**  

Similar Questions: [LC-26-Remove Duplicates from Sorted Array](/leetcode/leetcode21-30/#26-remove-duplicates-from-sorted-array)

两题思路基本一致，唯一不同的是，此题需要跨一个数字进行比较。

Runtime 0ms。

```java
class Solution {
    public int removeDuplicates(int[] nums) {
        if (nums == null || nums.length == 0) {
            return 0;
        }
        
        final int N = nums.length;
        
        if (N <= 2) return N;
        
        int begin = 0, end = 2, length = 2;
        
        while (end < N) {
            if (nums[begin] != nums[end]) {
                nums[length++] = nums[end++];
                begin++;
            } else {
                end++;
            }
        }
        
        return length;
    }
}
```