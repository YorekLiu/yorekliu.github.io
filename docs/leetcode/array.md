---
title: "Array"
---

## 832. Flipping an Image

Given a binary matrix `A`, we want to flip the image horizontally, then invert it, and return the resulting image.

To flip an image horizontally means that each row of the image is reversed.  For example, flipping `[1, 1, 0]` horizontally results in `[0, 1, 1]`.

To invert an image means that each `0` is replaced by `1`, and each `1` is replaced by `0`. For example, inverting `[0, 1, 1]` results in `[1, 0, 0]`.

**Example 1:**

> Input: [[1,1,0],[1,0,1],[0,0,0]]  
> Output: [[1,0,0],[0,1,0],[1,1,1]]  
> Explanation: First reverse each row: [[0,1,1],[1,0,1],[0,0,0]].  
> Then, invert the image: [[1,0,0],[0,1,0],[1,1,1]]  

**Example 2:**

> Input: [[1,1,0,0],[1,0,0,1],[0,1,1,1],[1,0,1,0]]  
> Output: [[1,1,0,0],[0,1,1,0],[0,0,0,1],[1,0,1,0]]  
> Explanation: First reverse each row: [[0,0,1,1],[1,0,0,1],[1,1,1,0],[0,1,0,1]].  
> Then invert the image: [[1,1,0,0],[0,1,1,0],[0,0,0,1],[1,0,1,0]]  

**Notes:**

1. `1 <= A.length = A[0].length <= 20`
2. `0 <= A[i][j] <= 1`

```java
class Solution {
    public int[][] flipAndInvertImage(int[][] A) {
        for (int i = 0; i < A.length; i++) {
            for (int j = 0, k = A.length - 1; j <= k; j++, k--) {
                if (j == k) {
                    A[i][j] ^= 1;
                } else if (A[i][j] == A[i][k]) {
                    A[i][j] ^= 1;
                    A[i][k] ^= 1;
                }
            }
        }

        return A;
    }
}
```

> 每行上对称位置
> 
> - 如果输入值相同，那么两个位置都要异或
> - 如果输入值不同，那么不做处理  
>
> 如果刚好是奇数中最中间的那个值，直接异或即可
> 注意方法返回值，for循环中第二个变量的定义需不需要加类型

## 561. Array Partition I

Given an array of **2n** integers, your task is to group these integers into n pairs of integer, say (a1, b1), (a2, b2), ..., (an, bn) which makes sum of min(ai, bi) for all i from 1 to n as large as possible.

**Example 1:**

> Input: [1,4,3,2]  
> Output: 4  
> Explanation: n is 2, and the maximum sum of pairs is 4 = min(1, 2) + min(3, 4).  

**Note:**

1. n is a positive integer, which is in the range of [1, 10000].
2. All the integers in the array will be in the range of [-10000, 10000].

```java
/** 方法一：桶排序的思想 */
class Solution {
    public int arrayPairSum(int[] nums) {
        int[] bucket = new int[20001];

        for (int i = 0; i < nums.length; i++) {
            bucket[nums[i] + 10000]++;
        }

        int total = 0;
        boolean odd = true;
        for (int i = 0; i < bucket.length; i++) {
            while (bucket[i] > 0) {
                if (odd) {
                    total += i - 10000;
                }
                odd = !odd;
                bucket[i]--;
            }
        }

        return total;
    }
}

/** 方法二：先排序在求和 */
class Solution {
    public int arrayPairSum(int[] nums) {
        Arrays.sort(nums);

        int total = 0;
        for (int i = 0; i < nums.length; i += 2) {
            total += nums[i];
        }

        return total;
    }
}
```

> 此题思路是先从小到大排序，然后取一对中的第一个。

## 766. Toeplitz Matrix

A matrix is Toeplitz if every diagonal from top-left to bottom-right has the same element.

Now given an `M x N` matrix, return `True` if and only if the matrix is Toeplitz.

**Example 1:**

> Input: matrix = [[1,2,3,4],[5,1,2,3],[9,5,1,2]]  
> Output: True  
> Explanation:  
> 1234  
> 5123  
> 9512  
> In the above grid, the diagonals are "[9]", "[5, 5]", "[1, 1, 1]", "[2, 2, 2]", "[3, 3]", "[4]", and in each diagonal all elements are the same, so the answer is True.

**Example 2:**

> Input: matrix = [[1,2],[2,2]]  
> Output: False  
> Explanation:  
> The diagonal "[1, 2]" has different elements.  

**Note:**

1. matrix will be a 2D array of integers.
2. matrix will have a number of rows and columns in range [1, 20].
3. matrix[i][j] will be integers in range [0, 99].

```java
class Solution {
    public boolean isToeplitzMatrix(int[][] matrix) {
        for (int i = 0; i < matrix.length - 1; i++)
            for (int j = 0; j < matrix[0].length - 1; j++)
                if (matrix[i][j] != matrix[i + 1][j + 1]) return false;
        return true;
    }
}
```

> 1. 矩阵的行列不一定相等  
> 2. 托普利兹矩阵的解法不一定要一次性将一条斜线上的值全部遍历出来，可以分为多次判断

## 566. Reshape the Matrix

In MATLAB, there is a very useful function called 'reshape', which can reshape a matrix into a new one with different size but keep its original data.

You're given a matrix represented by a two-dimensional array, and two **positive** integers r and c representing the **row** number and column number of the wanted reshaped matrix, respectively.

The reshaped matrix need to be filled with all the elements of the original matrix in the same row-traversing order as they were.

If the 'reshape' operation with given parameters is possible and legal, output the new reshaped matrix; Otherwise, output the original matrix.

**Example 1:**  

> Input:   
> nums =   
> [[1,2],  
>  [3,4]]  
> r = 1, c = 4  
> Output:   
> [[1,2,3,4]]  
> Explanation: The row-traversing of nums is [1,2,3,4]. The new reshaped matrix is a 1 * 4 matrix, fill it row by row by using the previous list.  

**Example 2:**  

> Input:   
> nums =   
> [[1,2],  
>  [3,4]]  
> r = 2, c = 4  
> Output:   
> [[1,2],  
>  [3,4]]  
> Explanation: There is no way to reshape a 2 * 2 matrix to a 2 * 4 matrix. So output the original matrix.  

**Note:**

1. The height and width of the given matrix is in range [1, 100].
2. The given r and c are all positive.

```java
class Solution {
    public int[][] matrixReshape(int[][] nums, int r, int c) {
        final int R = nums.length;
        final int C = nums[0].length;
        if (r * c != R * C) return nums;

        int[][] result = new int[r][c];
        int position;
        int tempi, tempj;
        for (int i = 0; i < r; i++)
            for (int j = 0; j < c; j++) {
                position = i * c + j;
                result[i][j] = nums[position / C][position % C];
            }
        return result;
    }
}
```

> 本质上还是一个矩阵的坐标转换问题  
> 还有一种简单方式，先将二维数组转为一位数组，然后直接按顺序取即可

## 485. Max Consecutive Ones

Given a binary array, find the maximum number of consecutive 1s in this array.

**Example 1:**  

> Input: [1,1,0,1,1,1]  
> Output: 3  
> Explanation: The first two digits or the last three digits are consecutive 1s.  
>     The maximum number of consecutive 1s is 3.  

**Note:**

1. The input array will only contain 0 and 1.
2. The length of input array is a positive integer and will not exceed 10,000

```java
class Solution {
    public int findMaxConsecutiveOnes(int[] nums) {
        int cnt = 0;
        int maxCnt = 0;
        for (int i = 0; i < nums.length; i++) {
            if (nums[i] == 1) {
                cnt++;
                maxCnt = maxCnt < cnt ? cnt : maxCnt;
            } else {
                cnt = 0;
            }
        }
        return maxCnt;
    }
}
```

> 注意审题，是要找出连续的1的个数。

## 448. Find All Numbers Disappeared in an Array

Given an array of integers where 1 ≤ a[i] ≤ n (n = size of array), some elements appear twice and others appear once.

Find all the elements of [1, n] inclusive that do not appear in this array.

**Example:**  

> Input:  
> [4,3,2,7,8,2,3,1]  
> Output:  
> [5,6]  

```java
class Solution {
    public List<Integer> findDisappearedNumbers(int[] nums) {
        int[] buckets = new int[nums.length];
        for (int num : nums) {
            buckets[num - 1]++;
        }

        List<Integer> result = new ArrayList<Integer>();
        for (int i = 0; i < nums.length; i++)
            if (buckets[i] == 0)
                result.add(i + 1);

        return result;
    }
}
```

> 桶排序，然后桶里没有元素的就是缺少的元素。

## 717. 1-bit and 2-bit Characters

We have two special characters. The first character can be represented by one bit `0`. The second character can be represented by two bits (`10` or `11`).

Now given a string represented by several bits. Return whether the last character must be a one-bit character or not. The given string will always end with a zero.

**Example 1:**

> Input:   
> bits = [1, 0, 0]  
> Output: True  
> Explanation:   
> The only way to decode it is two-bit character and one-bit character. So the last character is one-bit character.  

**Example 2:**  

> Input:   
> bits = [1, 1, 1, 0]  
> Output: False  
> Explanation:   
> The only way to decode it is two-bit character and two-bit character. So the last character is NOT one-bit character.  

**Note:**

1. `1 <= len(bits) <= 1000.`
2. `bits[i]` is always `0` or `1`.

```java
class Solution {
    public boolean isOneBitCharacter(int[] bits) {
        int i;
        for (i = 0; i < bits.length; i++) {
            if (bits[i] == 0) {
                if (i == bits.length - 1) return true;
                continue;
            } else {
                i++;
            }
        }
        return false;
    }
}
```

> 如果值是1，那么必须前进两位。当且仅当在最后一位上停下来时才算成功。

## 830. Positions of Large Groups

In a string `S` of lowercase letters, these letters form consecutive groups of the same character.

For example, a string like `S = "abbxxxxzyy"` has the groups `"a"`, `"bb"`, `"xxxx"`, `"z"` and `"yy"`.

Call a group large if it has 3 or more characters.  We would like the starting and ending positions of every large group.

The final answer should be in lexicographic order.

**Example 1:**  

> Input: "abbxxxxzzy"  
> Output: [[3,6]]  
> Explanation: "xxxx" is the single large group with starting  3 and ending positions 6.  

**Example 2:**

> Input: "abc"  
> Output: []  
> Explanation: We have "a","b" and "c" but no large group.  

**Example 3:**

> nput: "abcdddeeeeaabbbcd"  
> utput: [[3,5],[6,9],[12,14]]  

**Note:** : `1 <= S.length <= 1000`

```java
class Solution {
    public List<List<Integer>> largeGroupPositions(String S) {
        List<List<Integer>> result = new ArrayList<List<Integer>>();
        int index = 0, first = 0;
        char tmp = ' ';
        List<Integer> pair;
        for (int i = 0; i < S.length(); i++) {
            if (S.charAt(i) != tmp) {
                if (index >= 3) {
                    pair = new ArrayList<Integer>(2);
                    pair.add(first);
                    pair.add(i - 1);
                    result.add(pair);
                }
                tmp = S.charAt(i);
                first = i;
                index = 1;
            } else {
                index++;
                if (i == S.length() - 1 && index >= 3) {
                    pair = new ArrayList<Integer>(2);
                    pair.add(first);
                    pair.add(i);
                    result.add(pair);
                }
            }
        }

        return result;
    }
}
```

> 注意字符串最后是一个large group的情况

## 349. Intersection of Two Arrays

- Array  
- Two Pointers
- Set

Given two arrays, write a function to compute their intersection.

**Example 1:**

> Input: nums1 = [1,2,2,1], nums2 = [2,2]  
> Output: [2]

**Example 2:**

> Input: nums1 = [4,9,5], nums2 = [9,4,9,8,4]  
> Output: [9,4]

**Note:**

- Each element in the result must be unique.
- The result can be in any order.

**解法一：利用Set的特点，时间复杂度为O(n)**

```java
class Solution {
    public int[] intersection(int[] nums1, int[] nums2) {
        if (nums1 == null || nums1.length == 0 || nums2 == null || nums2.length == 0) {
            return new int[0];
        }

        Set<Integer> set = new HashSet<>(nums1.length);
        Set<Integer> intersect = new HashSet<>();
        
        for (int i : nums1) {
            set.add(i);
        }
        for (int i : nums2) {
            if (set.contains(i)) {
                intersect.add(i);
            }
        }
        
        int[] result = new int[intersect.size()];
        int i = 0;
        for (int item : intersect) {
            result[i++] = item;
        }
        
        return result;
    }
}
```

**解法二：先排序，后two pointers，时间复杂度为O(nlogn)**  

时间复杂度主要是因为排了序，所以慢了点。

```java
class Solution {
    public int[] intersection(int[] nums1, int[] nums2) {
        if (nums1 == null || nums1.length == 0 || nums2 == null || nums2.length == 0) {
            return new int[0];
        }

        Arrays.sort(nums1);
        Arrays.sort(nums2);
        
        final int n = nums1.length;
        final int m = nums2.length;
        
        List<Integer> result = new ArrayList<>();
        int i = 0, j = 0;
        while (i < n && j < m) {
            if (nums1[i] < nums2[j]) {
                i++;
            } else if (nums1[i] > nums2[j]) {
                j++;
            } else {
                int tmp = nums1[i];
                result.add(tmp);
                i++;
                j++;
                while (i < n && nums1[i] == tmp) { i++; }
                while (j < m && nums2[j] == tmp) { j++; }
            }
        }
        
        int[] res = new int[result.size()];
        for (i = 0; i < res.length; i++) {
            res[i] = result.get(i);
        }
        return res;
    }
}
```