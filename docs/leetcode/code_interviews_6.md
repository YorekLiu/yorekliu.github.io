---
title: "面试中的各项能力"
---

## 1. (53)在排序数组中查找数字  

### 1.1 数字在排序数组中出现的次数

> 统计一个数字在排序数组中出现的次数。例如输入排序数组{1, 2, 3, 3, 3, 3, 4, 5}和数字3，由于3在这个数组中出现了4次，因此输出4。

利用二分查找分别查找第一个k和最后一个k。它们的时间复杂度都是$O(logn)$，因此总的时间复杂度也只有$O(longn)$。

```java
private int getNumberOfK(int[] data, int k) {
    if (data == null || data.length == 0)
        return 0;

    int firstK = getFirstK(data, k, 0, data.length - 1);
    int lastK = getLastK(data, k, 0, data.length - 1);

    if (firstK > -1 && lastK > -1)
        return lastK - firstK + 1;

    return 0;
}

private int getFirstK(int[] data, int k, int start, int end) {
    if (start > end) {
        return -1;
    }

    int middle = (start + end) >> 1;

    if (data[middle] == k) {
        if (middle == 0 || data[middle - 1] != k) {
            return middle;
        } else {
            end = middle - 1;
        }
    } else if (data[middle] < k) {
        start = middle + 1;
    } else {
        end = middle - 1;
    }

    return getFirstK(data, k, start, end);
}

private int getLastK(int[] data, int k, int start, int end) {
    if (start > end) {
        return -1;
    }

    int middle = (start + end) >> 1;

    if (data[middle] == k) {
        if (middle == data.length - 1 || data[middle + 1] != k) {
            return middle;
        } else {
            start = middle + 1;
        }
    } else if (data[middle] < k) {
        start = middle + 1;
    } else {
        end = middle - 1;
    }

    return getLastK(data, k, start, end);
}
```

### 1.2 0到n-1中缺失的数字

> 一个长度为n-1的递增排序数组中的所有数字都是唯一的，并且每个数字都在范围0到n-1之内。在范围0到n-1的n个数字中有且只有一个数字不在该数组中，请找出这个数字。

这个问题有一个直观的解决方案。我们可以先用公式n(n-1)/2求出数字0\~n-1的所有数字之和，记为$s_1$。接着求出数组中所有数字的和，记为$s_2$。那个不在数组中的数字就是$s_1-s_2$的差。这种解法需要$O(n)$的时间求数组中所有数字的和。显然，该解法没有有效利用数组是递增排序的这一特点。  
因为0\~n-1这些数字在数组中是排序的，因此数组中开始的一些数字与它们的下标相同。也就是说，0在下标为0的位置，1在下标为1的位置，以此类推。如果不在数组中的那个数字记为m，那么所有比m小的数字的下标都与它们的值相同。  
由于m不在数组中，那么m+1处在下标为m的位置，m+2处在下标为m+1的位置，以此类推。**我们发现m正好是数组中第一个数值和下标不相等的下标，因此这个问题转换成在排序数组中找出第一个值和下标不相等的元素**。  
我们可以基于二分查找的算法用如下过程查找：如果中间元素的值和下标相等，那么下一轮查找只需要查找右半边；如果中间元素的值和下标不相等，并且它前面一个元素和它的下标相等，这意味着这个中间的数字正好是第一个值和下标不相等的元素，它的下标就是在数组中不存在的数字；如果中间元素的值和下标不相等，并且它前面一个元素和它的下标不相等，这意味着下一轮查找我们只需要在左半边查找即可。

```java
private int getMissingNumber(int[] data) {
    if (data == null || data.length == 0)
        return -1;

    final int n = data.length;
    int start = 0;
    int end = n - 1;
    int middle;

    while (end >= start) {
        middle = (start + end) >> 1;
        if (data[middle] != middle) {
            if (middle == 0 || data[middle - 1] == middle - 1) {
                return middle;
            }
            end = middle - 1;
        } else {
            start = middle + 1;
        }
    }

    if (start == n) {
        return n;
    }

    // 无效的输入，比如数组不是按要求排序的，
    // 或者有数字不在0到n-1范围之内
    return -1;
}
```

### 1.3 数组中数值和下标相等的元素

> 假设一个单调递增的数组里的每个元素都是整数并且是唯一的。请编程实现一个函数找出数组中任意一个数值等于其下标的元素。例如，在数组{-3, -1, 1, 3, 5}中，数字3和它的下标相等。

我们很容易就能想到最直观的解法：从头到尾依次扫描数组中的数字，并逐一检验数字是不是和下标相等。显然，这种算法的时间复杂度是$O(n)$由于数组是单调递增排序的，因此我们可以尝试用二分查找算法来进行优化。假设我们某一步抵达数组中的第i个数字。如果我们很幸运，该数字的值刚好也是i，那么我们就找到了一个数字和其下标相等。  
那么当数字的值和下标不相等的时候该怎么办呢？假设数字的值为m。我们先考虑m大于i的情形，即数字的值大于它的下标。由于数组中的所有数字都唯一并且单调递增，那么对于任意大于0的k，位于下标i+k的数字的值大于或等于m+k。另外，因为m>i，所以m+k>i+k因此，位于下标i+k的数字的值一定大于它的下标。这意味着如果第i个数字的值大于i，那么它右边的数字都大于对应的下标，我们都可以忽略。下一轮查找我们只需要从它左边的数字中查找即可。  
数字的值m小于它的下标i的情形和上面类似。它左边的所有数字的值都小于对应的下标，我们也可以忽略  
由于我们在每一步查找时都可以把查找的范围缩小一半，这是典型的二分查找的过程。下面是基于二分查找的参考代码:

```java
private int getNumberSameAsIndex(int[] data) {
    if (data == null || data.length == 0)
        return -1;

    final int n = data.length;
    int start = 0;
    int end = n - 1;

    int middle;

    while (end >= start) {
        middle = (start + end) >> 1;
        if (data[middle] == middle) {
            return middle;
        } else if (data[middle] > middle) {
            end = middle - 1;
        } else {
            start = middle + 1;
        }
    }

    return -1;
}
```

## 2. (54)二叉搜索树的第k个结点

> 给定一棵二叉搜索树，请找出其中的第k大的结点。例如，在图中的二叉搜索树里，按节点数值大小顺序，第三大节点的值是4。

![第三大节点是4](/assets/images/leetcode/ci_54.png)

<center>第三大节点是4</center>

本题就是考察二叉树的中序遍历算法。  

```java
private int index;
private BinaryTreeNode kthNode(BinaryTreeNode root, int k) {
    if (root == null || k == 0) {
        return null;
    }
    index = 0;
    return kthNodeCore(root, k);

}

private BinaryTreeNode kthNodeCore(BinaryTreeNode root, int k) {
    BinaryTreeNode result = null;

    if (root.left != null)
        result = kthNodeCore(root.left, k);

    if (result == null) {
        index++;
        if (index == k) {
            result = root;
        }
    }

    if (result == null && root.right != null) {
        result = kthNodeCore(root.right, k);
    }

    return result;
}
```

## 3. (55)二叉树的深度

### 3.1 二叉树的深度

> 输入一棵二叉树的根结点，求该树的深度。从根结点到叶结点依次经过的结点（含根、叶结点）形成树的一条路径，最长路径的长度为树的深度。

此题同[LC-104-Maximum Depth of Binary Tree](/leetcode/leetcode101-110/#104-maximum-depth-of-binary-tree)

我们还可以从另外一个角度来理解树的深度。如果一棵树只有一个节点，那么它的深度为1。如果根节点只有左子树而没有右子树，那么树的深度应该是其左子树的深度加1；同样，如果根节点只有右子树而没有左子树，那么树的深度应该是其右子树的深度加1。如果既有右子树又有左子树，那么该树的深度就是其左、右子树深度的较大值再加1。  

```java
private int treeDepth(BinaryTreeNode root) {
    if (root == null) {
        return 0;
    }

    int left = treeDepth(root.left);
    int right = treeDepth(root.right);

    return Math.max(left, right) + 1;
}
```

### 3.2 平衡二叉树  

> 输入一棵二叉树的根结点，判断该树是不是平衡二叉树。如果某二叉树中任意结点的左右子树的深度相差不超过1，那么它就是一棵平衡二叉树。

此题同[LC-110-Balanced Binary Tree](/leetcode/leetcode101-110/#110-balanced-binary-tree)

**简单解法**  
有了求二叉树的深度的经验之后再解决这个问题，我们很容易就能想到一种思路:在遍历树的每个节点的时候，调用函数`treeDepth`得到它的左、右子树的深度。如果每个节点的左、右子树的深度相差都不超过1，那么按照定义它就是一棵平衡二叉树。这种思路对应的代码如下:

```java
private boolean isBalanced1(BinaryTreeNode root) {
    if (root == null) {
        return true;
    }

    int left = treeDepth(root.left);
    int right = treeDepth(root.right);

    if (Math.abs(left - right) > 1) {
        return false;
    }

    return isBalanced1(root.left) && isBalanced1(root.right);
}

private int treeDepth(BinaryTreeNode root) {
    if (root == null) {
        return 0;
    }

    int left = treeDepth(root.left);
    int right = treeDepth(root.right);

    return Math.max(left, right) + 1;
}
```

上面的代码固然简洁，但我们也要注意到由于一个节点会被重复遍历多次，这种思路的时间效率不高。毫无疑问，重复遍历同一个节点会影响性能。接下来我们寻找不需要重复遍历的算法。

**每个节点只遍历一次**  
如果我们用后序遍历的方式遍历二叉树的每个节点，那么在遍历到一个节点之前我们就已经遍历了它的左、右子树。只要在遍历每个节点的时候记录它的深度（某一节点的深度等于它到叶节点的路径的长度），我们就可以一边遍历一边判断每个节点是不是平衡的。下面是这种思路的参考代码:

```java
private boolean isBalanced2(BinaryTreeNode root) {
    if (root == null) {
        return true;
    }

    return isBalanced2Core(root) >= 0;
}

/**
  * 返回值大于等于0表示是平衡的 否则不平衡
  */
private int isBalanced2Core(BinaryTreeNode root) {
    if (root == null) {
        return 0;
    }

    int left = isBalanced2Core(root.left);
    int right = isBalanced2Core(root.right);

    if (left >= 0 && right >= 0) {
        int diff = Math.abs(left - right);
        if (diff <= 1) {
            return Math.max(left, right) + 1;
        }
    }

    return -1;
}
```

## 4. (56)数组中数字出现的次数  

### 4.1 数组中只出现一次的两个数字  

> 一个整型数组里除了两个数字之外，其他的数字都出现了两次。请写程序找出这两个只出现一次的数字。要求时间复杂度是O(n)，空间复杂度是O(1)。

我们可以先考虑这个数组中只有一个数字出现了一次，其他数字出现了两次，怎么找出这个数字？  
这两道题目都在强调一个（或两个）数字只出现一次，其他数字出现两次。这有什么意义呢？**我们想到异或运算的一个性质：任何一个数字异或它自己都等于0**。 也就是说，如果我们从头到尾依次异或数组中的每个数字，那么最终的结果刚好是那个只出现一次的数字，因为那些成对出现两次的数字全部在异或中抵消了。  
想明白怎么解决这个简单的问题之后，我们再回到原始的问题，看看能不能运用相同的思路。我们试着把原数组分成两个子数组，使得每个子数组包含一个只出现一次的数字，而其他数字都成对出现两次。如果能够这样拆分成两个数组，那么我们就可以按照前面的办法分别找出两个只出现一次的数字了。  
我们还是从头到尾依次异或数组中的每个数字，那么最终得到的结果就是两个只出现一次的数字的异或结果，因为其他数字都出现了两次，在异或中全部抵消了。由于这两个数字肯定不一样，那么异或的结果肯定不为0，也就是说，在这个结果数字的二进制表示中至少有一位为1。我们在结果数字中找到第一个为1的位的位置，记为第n位。现在我们以第n位是不是1为标准把原数组中的数字分成两个子数组，第一个子数组中每个数字的第n位都是1，而第二个子数组中每个数字的第n位都是0。由于我们分组的标准是数字中的某一位是1还是0，那么出现了两次的数字肯定被分配到同一个子数组。因为两个相同的数字的任意一位都是相同的，我们不可能把两个相同的数字分配到两个子数组中去，于是我们已经把原数组分成了两个子数组，每个子数组都包含一个只出现一次的数字，而其他数字都出现了两次。我们已经知道如何在数组中找出唯一一个只出现一次的数字，因此，到此为止所有的问题都已经解决了。  
举个例子，假设输入数组{2, 4, 3, 6, 3, 2, 5, 5}。当我们依次对数组中的每个数字进行异或运算之后，得到的结果用二进制表示是0010。异或得到的结果中的倒数第二位是1，于是我们根据数字的倒数第二位是不是1将该数组分为两个子数组。第一个子数组{2, 3, 6, 3, 2}中所有数字的倒数第二位都是1，而第二个子数组{4, 5, 5}中所有数字的倒数第二位都是0。接下来只要分别对这两个子数组求异或，就能找出第一个子数组中只出现一次的数字是6，而第二个子数组中只出现一次的数字是4。

```java
private Pair<Integer, Integer> findNumsAppearOnce(int[] data) {
    if (data == null || data.length == 0)
        return new Pair<>(-1, -1);

    int xor = 0;
    for (int num : data) {
        xor ^= num;
    }

    // 找到xor从右边数起第一个是1的位
    int index = 0;
    while ((xor & 1) == 0) {
        xor >>= 1;
        index++;
    }

    xor = 0;
    int xor2 = 0;
    for (int num : data) {
        if (isBit1(num, index)) {
            xor ^= num;
        } else {
            xor2 ^= num;
        }
    }

    return new Pair<>(xor, xor2);
}

// 判断数字num的第index位是不是1
private boolean isBit1(int num, int index) {
    num >>= index;
    return (num & 1) == 1;
}
```

### 4.2 数组中唯一只出现一次的数字

> 在一个数组中除了一个数字只出现一次之外，其他数字都出现了三次。请找出那个只出现一次的数字。

如果我们把题目稍微改一改，那么就会容易很多：如果数组中的数字除一个只出现一次之外，其他数字都出现了两次。我们可以用XOR异或位运算解决这个简化的问题。由于两个相同的数字的异或结果是0，我们把数组中所有数字异或的结果就是那个唯一只出现一次的数字。  
可惜这种思路不能解决这里的问题，因为三个相同的数字的异或结果还是该数字。尽管我们这里不能应用异或运算，我们还是可以沿用位运算的思路。如果一个数字出现三次，那么它的二进制表示的每一位（0或者1）也出现三次。如果把所有出现三次的数字的二进制表示的每一位都分别加起来，那么每一位的和都能被3整除。  
我们把数组中所有数字的二进制表示的每一位都加起来。如果某一位的和能被3整除，那么那个只出现一次的数字二进制表示中对应的那一位是0；否则就是1。

```java
private int findNumsAppearOnce(int[] data) {
    if (data == null || data.length == 0) {
        return -1;
    }

    int[] bits = new int[32];

    for (int i = 0; i < data.length; i++) {
        int bitMask = 1;
        for (int j = 31; j >= 0; j--) {
            int bit = data[i] & bitMask;
            if (bit != 0)
                bits[j] += 1;
            bitMask <<= 1;
        }
    }

    int result = 0;
    for (int i = 0; i < 32; i++) {
        result <<= 1;
        result += bits[i] % 3;
    }

    return result;
}
```

这种解法的时间效率是$O(n)$。我们需要一个长度为32的辅助数组存储二进制表示的每一位的和。由于数组的长度是固定的，因此空间效率是$O(1)$。该解法比其他两种直观的解法效率都要高:

- 我们很容易就能从 **排序** 的数组中找到只出现一次的数字，但排序需要$O(nlogn)$时间；
- 我们也可以用一个 **哈希表** 来记录数组中每个数字出现的次数，但这个哈希表需要$O(n)$的空间。

## 5. (57)和为s的数字  

### 5.1 和为s的两个数字

> 输入一个递增排序的数组和一个数字s，在数组中查找两个数，使得它们的和正好是s。如果有多对数字的和等于s，输出任意一对即可。

我们先在数组中选择两个数字，如果它们的和等于输入的s，那么我们就找到了要找的两个数字。如果和小于s呢？我们希望两个数字的和再大一点。由于数组已经排好序了，我们可以考虑选择较小的数字后面的数字。因为排在后面的数字要大一些，那么两个数字的和也要大一些，就有可能等于输入的数字s了。同样，当两个数字的和大于输入的数字的时候，我们可以选择较大数字前面的数字，因为排在数组前面的数字要小一些。

```java
private Pair<Integer, Integer> findNumbersWithSum(int[] data, int sum) {
    if (data == null || data.length == 0) {
        return null;
    }

    final int n = data.length;
    int left = 0;
    int right = n - 1;

    while (right > left) {
        int tmpSum = data[left] + data[right];
        if (tmpSum == sum) {
            return new Pair<>(data[left], data[right]);
        } else if (tmpSum > sum) {
            right--;
        } else {
            left++;
        }
    }

    return null;
}
```

该算法的时间复杂度是$O(n)$。

### 5.2 为s的连续正数序列

> 输入一个正数s，打印出所有和为s的连续正数序列（至少含有两个数）。例如输入15，由于1+2+3+4+5=4+5+6=7+8=15，所以结果打印出3个连续序列1～5、4～6和7～8。

有了解决前面问题的经验，我们也考虑用两个数small和big分别表示序列的最小值和最大值。首先把small初始化为1，big初始化为2。如果从small到big的序列的和大于s，则可以从序列中去掉较小的值，也就是增大small的值。如果从small到big的序列的和小于s，则可以增大big，让这个序列包含更多的数字。因为这个序列至少要有两个数字，我们一直增加small到(1+s)/2为止。

```java
private void FindContinuousSequence(int sum) {
    if (sum < 3)
        return;

    int small = 1;
    int big = 2;
    int middle = (sum + 1) >> 1;
    int curSum = small + big;

    while (small < middle) {
        if (curSum == sum) {
            printResult(small, big);
        }

        while (curSum > sum && small < middle) {
            curSum -= small;
            small++;
            if (curSum == sum) {
                printResult(small, big);
            }
        }

        big++;
        curSum += big;
    }
}

private void printResult(int from, int to) {
    for (int i = from; i <= to; i++)
        System.out.printf("%d ", i);
    System.out.println();
}
```

在上述代码中，求连续序列的和应用了一个小技巧。通常我们可以用循环求一个连续序列的和，但考虑到每次操作之后的序列和操作之前的序列相比大部分数字都是一样的，只是增加或者减少了一个数字，因此我们可以在前一个序列的和的基础上求操作之后的序列的和。这样可以减少很多不必要的运算，从而提高代码的效率。

## 6. (58)翻转字符串

### 6.1 翻转单词顺序

> 输入一个英文句子，翻转句子中单词的顺序，但单词内字符的顺序不变。为简单起见，标点符号和普通字母一样处理。例如输入字符串"I am a student. "，则输出"student. a am I"。

翻转两次字符串即可，第一次翻转整个句子，第二次翻转句子中的每个单词。  

```java
private String reverseSentence(String data) {
    if (data == null || data.length() == 0) {
        return data;
    }

    final int n = data.length();
    char[] reversed = data.toCharArray();
    reverse(reversed, 0, n - 1);

    int begin = 0, end = 0;

    while (begin < n) {
        if (reversed[begin] == ' ') {
            begin++;
            end++;
        } else if (end == n || reversed[end] == ' ') {
            reverse(reversed, begin, end - 1);
            begin = end++;
        } else {
            end++;
        }
    }

    return new String(reversed);
}

private void reverse(char[] data, int start, int end) {
    if (data == null || data.length == 0) return;

    while (end > start) {
        char tmp = data[end];
        data[end] = data[start];
        data[start] = tmp;

        start++;
        end--;
    }
}
```

### 6.2 左旋转字符串  

> 字符串的左旋转操作是把字符串前面的若干个字符转移到字符串的尾部。请定义一个函数实现字符串左旋转操作的功能。比如输入字符串"abcdefg"和数字2，该函数将返回左旋转2位得到的结果"cdefgab"。

我们可以先把前面n个数翻转，再翻转其余的数，最后翻转整个字符串即可。 

比如拿"abcdefg"和数字2为例：  
ab cdefg -> ba gfedc -> cdefg ab

```java
private String leftRotateString(String data, int num) {
    if (data == null || data.length() == 0 || data.length() < num) {
        return data;
    }

    final int n = data.length();
    char[] result = data.toCharArray();

    // 翻转字符串的前面n个字符
    reverse(result, 0, num - 1);
    // 翻转字符串的后面部分
    reverse(result, num, n - 1);
    // 翻转整个字符串
    reverse(result, 0, n - 1);

    return new String(result);
}

private void reverse(char[] data, int start, int end) {
    if (data == null || data.length == 0) return;

    while (end > start) {
        char tmp = data[end];
        data[end] = data[start];
        data[start] = tmp;

        start++;
        end--;
    }
}
```

## 7. (59)队列的最大值

### 7.1 滑动窗口的最大值  

> 给定一个数组和滑动窗口的大小，请找出所有滑动窗口里的最大值。例如，如果输入数组{2, 3, 4, 2, 6, 2, 5, 1}及滑动窗口的大小3，那么一共存在6个滑动窗口，它们的最大值分别为{4, 4, 6, 6, 6, 5}。

对于长度为n的数组，滑动窗口大小为k的输入来说，蛮力法的时间复杂度为$O(nk)$。所以不推荐。  

在下面代码中，deque是一个两端开口的队列，用来保存有可能是滑动窗口最大值的数字的下标。在存入一个数字的下标之前，首先要判断队列里已有数字是否小于待存入的数字。如果已有的数字小于待存入的数字，那么这些数字已经不可能是滑动窗口的最大值，因此它们将会被依次从队列的尾部删除。同时，如果队列头部的数字已经从窗口里滑出，那么滑出的数字也需要从队列的头部删除由于队列的头部和尾部都有可能删除数字，这也是需要两端开口的队列的原因。  
这种方法的时间复杂是$O(n)$。


```java
private int[] maxInWindows(int[] num, int size) {
    if (num == null || num.length == 0 || size <= 0 || num.length < size) {
        return null;
    }

    int resultLength = num.length - size + 1;
    int[] result = new int[resultLength];
    int index = 0;

    Deque<Integer> deque = new ArrayDeque<>();

    for (int i = 0; i < size; i++) {
        while (!deque.isEmpty() && num[i] >= num[deque.peekLast()])
            deque.pollLast();
        deque.offer(i);
    }

    for (int i = size; i < num.length; i++) {
        result[index++] = num[deque.peek()];

        while (!deque.isEmpty() && num[i] >= num[deque.peekLast()])
            deque.pollLast();
        while (!deque.isEmpty() && deque.peek() <= (i - size))
            deque.poll();

        deque.offer(i);
    }
    result[index++] = num[deque.peek()];

    return result;
}
```

### 7.2 队列的最大值  

> 请定义一个队列并实现函数max得到队列里的最大值，要求函数max、push_back和pop_front的时间复杂度都是O(1)

如前所述，滑动窗口可以看成一个队列，因此上题的解法可以用来实现带max函数的队列。

```java
private class InternalData {
    int number;
    int index;

    InternalData(int number, int index) {
        this.number = number;
        this.index = index;
    }
}

private Deque<InternalData> max = new ArrayDeque<>();
private Deque<InternalData> data = new ArrayDeque<>();
private int currentIndex;

private void push_back(int number) {
    while (!max.isEmpty() && number >= max.peekLast().number)
        max.pollLast();

    InternalData internalData = new InternalData(number, currentIndex);
    data.offer(internalData);
    max.offer(internalData);

    currentIndex++;
}

private int pop_front() {
    if (max.isEmpty()) {
        throw new IllegalStateException("queue is empty");
    }

    if (max.peek().index == data.peek().index)
        max.poll();

    return data.poll().number;
}

private int max() {
    if (max.isEmpty()) {
        throw new IllegalStateException("queue is empty");
    }

    return max.peek().number;
}
```

## 8. (60)n个骰子的点数

> 把n个骰子扔在地上，所有骰子朝上一面的点数之和为s。输入n，打印出s的所有可能的值出现的概率。

骰子一共有6个面，每个面上都有一个点数，对应的是1~6之间的一个数字。所以n个骰子的点数和的最小值为n，最大值为6n。另外，根据排列组合的知识，我们还知道n个骰子的所有点数的排列数为6^n。要解决这个问题，我们需要先统计出每个点数出现的次数，然后把每个点数出现的次数除以6\^n，就能求出每个点数出现的概率。

**解法一：基于递归求骰子点数，时间效率不够高**  
现在我们考虑如何统计每个点数出现的次数。要想求出n个骰子的点数和，可以先把n个骰子分为两堆：第一堆只有一个；另一堆有n-1个。单独的那一个有可能出现1~6的点数。我们需要计算1\~6的每一种点数和剩下的n-1个骰子来计算点数和。接下来把剩下的n-1个骰子仍然分成两堆:第一堆只有一个；第二堆有n-2个。我们把上一轮那个单独骰子的点数和这一轮单独骰子的点数相加，再和剩下的n-2个骰子来计算点数和。分析到这里，我们不难发现这是一种递归的思路，递归结束的条件就是最后只剩下一个骰子。  
我们可以定义一个长度为6n-n+1的数组，将和为s的点数出现的次数保存到数组的第s-n个元素里。基于这种思路，我们可以写出如下代码:  

```java
final int MAX_VALUE = 6;

private void printProbability1(int n) {
    if (n < 1)
        return;

    int[] probabilities = new int[n * MAX_VALUE - n + 1];

    probability(n, probabilities);

    int total = (int) Math.pow(MAX_VALUE, n);
    for (int i = n; i <= n * MAX_VALUE; i++) {
        System.out.printf("%d: %d/%d\n", i, probabilities[i - n], total);
    }
}

private void probability(int n, int[] probabilities) {
    for (int i = 1; i <= MAX_VALUE; i++) {
        probability(n, n, i, probabilities);
    }
}

private void probability(int original, int current, int sum, int[] probabilities) {
    if (current == 1) {
        probabilities[sum - original]++;
    } else {
        for (int i = 1; i <= MAX_VALUE; i++) {
            probability(original, current - 1, i + sum, probabilities);
        }
    }
}
```

上面的思路很简洁，实现起来也容易。但是基于递归的实现，它有很多计算是重复的，从而导致当number变大时性能慢得让人不能接受。  

**基于循环求骰子点数，时间性能好**  
可以换一种思路来解决这个问题。我们可以考虑用两个数组来存储骰子点数的每个总数出现的次数。在一轮循环中，第一个数组中的第n个数字表示骰子和为n出现的次数。在下一轮循环中，我们加上一个新的骰子，此时和为n的骰子出现的次数应该等于上一轮循环中骰子点数和为n-1、n-2、n-3、n-4、n-5与n-6的次数的总和，所以我们把另一个数组的第n个数字设为前一个数组对应的第n-1、n-2、n-3、n-4、n-5与n-6个数字之和。基于这种思路，我们可以写出如下代码:

```java
private void printProbability2(int n) {
    if (n < 1)
        return;

    int[][] probabilities = new int[2][n * MAX_VALUE + 1];
    int flag = 0;

    for (int i = 1; i <= MAX_VALUE; i++)
        probabilities[flag][i] = 1;

    for (int k = 2; k <= n; k++) {
        for (int i = 0; i < k; i++)
            probabilities[1 - flag][i] = 0;

        for (int i = k; i <= MAX_VALUE * k; i++) {
            probabilities[1 - flag][i] = 0;

            for (int j = 1; j <= i && j <= MAX_VALUE; j++)
                probabilities[1 - flag][i] += probabilities[flag][i - j];
        }

        flag = 1 - flag;
    }

    int total = (int) Math.pow(MAX_VALUE, n);
    for (int i = n; i <= MAX_VALUE * n; i++) {
        System.out.printf("%d: %d/%d\n", i, probabilities[flag][i], total);
    }
}
```

在上述代码中，我们定义了两个数组probabilities[0]和probabilities[1]来存储骰子的点数之和。在一轮循环中，一个数组的第n项等于另一个数组的第n-1、n-2、n-3、n-4、n-5及n-6项的和。在下一轮循环中，我们交换这两个数组（通过改变变量flag实现）再重复这一计算过程。

## 9. (61)扑克牌的顺子

> 从扑克牌中随机抽5张牌，判断是不是一个顺子，即这5张牌是不是连续的。2～10为数字本身，A为1，J为11，Q为12，K为13，而大、小王可以看成任意数字。

我们可以把5张牌看成由5个数字组成的数组。大、小王是特殊的数字，我们不妨把它们都定义为0，这样就能和其他扑克牌区分开来了。  
接下来我们分析怎样判断5个数字是不是连续的，最直观的方法是把数组排序。值得注意的是，由于0可以当成任意数字，我们可以用0去补满数组中的空缺。如果排序之后的数组不是连续的，即相邻的两个数字相隔若干个数字，那么只要我们有足够的0可以补满这两个数字的空缺，这个数组实际上还是连续的。举个例子，数组排序之后为{0, 1, 3, 4, 5}，在1和3之间空缺了一个2，刚好我们有一个0，也就是我们可以把它当成2去填补这个空缺。  
于是我们需要做3件事情：首先把数组排序；其次统计数组中0的个数；最后统计排序之后的数组中相邻数字之间的空缺总数。如果空缺的总数小于或者等于0的个数，那么这个数组就是连续的；反之则不连续。  
最后我们还需要注意一点:如果数组中的非0数字重复出现，则该数组不是连续的。换成扑克牌的描述方式就是:如果一副牌里含有对子，则不可能是顺子。  

```java
private boolean isContinuous(int[] numbers) {
    if (numbers == null || numbers.length != 5) {
        return false;
    }

    final int length = numbers.length;

    Arrays.sort(numbers);

    int numberOfZero = 0;
    for (int i = 0; i < length && numbers[i] == 0; i++) {
        numberOfZero++;
    }

    int numberOfGap = 0;
    int small = numberOfZero;
    int big = small + 1;

    while (big < length) {
        if (numbers[small] == numbers[big])
            return false;

        int gap = numbers[big] - numbers[small] - 1;
        numberOfGap += gap;

        small = big;
        big++;
    }

    return numberOfGap <= numberOfZero;
}
```

为了让代码显得简洁，上述代码调用`Arrays.sort`进行排序。可能有人担心时间复杂度是$O(nlogn)$，这还不够快。由于扑克牌的值出现在0~13之间，我们可以定义一个长度为14的哈希表，这样在$O(n)$时间内就能完成排序。通常我们认为不同级别的时间复杂度只有当n足够大的时候才有意义。由于本题中数组的长度是固定的，只有5张牌，那么$O(n)$和$O(nlogn)$不会有多少区别，我们可以选用简洁易懂的方法来实现算法。

## 10. (62)圆圈中最后剩下的数字  

> 0, 1, …, n-1这n个数字排成一个圆圈，从数字0开始每次从这个圆圈里删除第m个数字。求出这个圆圈里剩下的最后一个数字。

**解法一：用环形链表模拟圆圈**  

此方法时间复杂度为$O(mn)$，空间复杂度为$O(n)$。

```java
private int lastRemaining1(int n, int m) {
    if (n <= 0 || m <= 0) {
        return -1;
    }

    ListNode head = new ListNode(0);
    ListNode p = head;
    for (int i = 1; i < n; i++) {
        p.next = new ListNode(i);
        p = p.next;
    }
    p.next = head;

    while (p.next != p) {
        for (int i = 0; i < m - 1; i++) {
            p = p.next;
        }

        p.next = p.next.next;
    }

    return p.value;
}
```

**解法二：利用数学解法**  
令方程$f(n,m)$表示每次在n个数字0,1,…,n-1中删除第m个数后最后剩下的数字，也就是要求的结果。(m-1)%n为第一次被删除的数字，记为k。  

在删除k之后剩下的n-1个数字为0,1,…,k-1,k+1,…,n-1，且下一次删除的数字从k+1开始计数。相当于在剩下的序列中，k+1排在最前面，从而序列变成k+1,…,n-1,0,1,…k-1。由于这个序列的规律和最初的序列不一样（最初的序列是从0开始的连续序列），所以记该函数为$f(n-1,m)$。由于这两个需求最终结果一定是同一个数字，即$f(n,m)=f(n-1,m)$。

接下来我们把剩下的n-1数进行映射，使其形成0~n-2的序列。  
k+1 -> 0  
k+2 -> 1  
…  
n-1 -> n-k-2  
0   -> n-k-1  
1   -> n-k  
…  
k-1 -> n-2

可以得到一个映射$p,p(x)=(x-k-1)\%n$。其逆映射为$p^{-1}(x)=(x+k+1)\%n$。

所以$f(n-1,m)=p^{-1}[f(n-1,m)]=[f(n-1,m)+k+1]\%n$  
代入k得$f(n,m)=f(n-1,m)=[f(n-1,m)+m]\%n$

所以，我们可以得到下面这个递推公式  

$$
f(n,m)=\begin{cases} 0 & n=1 \\ [f(n-1,m)+m]\%n & n>1 \end{cases}
$$

```java
private int lastRemaining2(int n, int m) {
    if (n <= 0 || m <= 0)
        return -1;

    int last = 0;
    for (int i = 2; i <= n; i++)
        last = (last + m) % i;

    return last;
}
```

此方法时间复杂度为$O(n)$，空间复杂度为$O(1)$。

## 11. (63)股票的最大利润

> 假设把某股票的价格按照时间先后顺序存储在数组中，请问买卖交易该股票可能获得的利润是多少？例如一只股票在某些时间节点的价格为{9, 11, 8, 5, 7, 12, 16, 14}。如果我们能在价格为5的时候买入并在价格为16时卖出，则能收获最大的利润11。

使用min保存前面的数据中最小的数，用当前的数减去最小数得到当前利润，取当前利润和之前最大利润的最大值即可。

```java
private int maxDiff(int[] numbers) {
    if (numbers == null || numbers.length <= 1) {
        return 0;
    }

    int min = numbers[0];
    int maxDiff = numbers[1] - min;

    for (int i = 2; i < numbers.length; i++) {
        if (numbers[i - 1] < min) {
            min = numbers[i - 1];
        }

        int curDiff = numbers[i] - min;

        if (curDiff > maxDiff) {
            maxDiff = curDiff;
        }
    }

    return maxDiff;
}
```

## 12. (64)求1+2+…+n

> 求1+2+…+n，要求不能使用乘除法、for、while、if、else、switch、case等关键字及条件判断语句（A?B:C）。

!!! warning
    本题在C语言中有几种解法，但在Java中不适用。  
    下面采取了递归的方式，并用短路与(&&)操作符判断递归终止。

```java
private int solution(int n) {
    int sum = n;

    // n大于0时进行递归操作  
    // 后面的>0只是为了使后半部分构成一个布尔表达式
    // 前面的boolean flag并无实际用途，只是为了让编译通过
    boolean flag = (n > 0) && ((sum += solution(n - 1)) > 0);

    return sum;
}
```

## 13. (65)不用加减乘除做加法

> 写一个函数，求两个整数之和，要求在函数体内不得使用＋、－、×、÷四则运算符号。

该题就是CPU中加法器的原理。  

首先我们可以分析人们是如何做十进制加法的，比如是如何得出5+17=22这个结果的。实际上，我们可以分成三步进行：第一步只做各位相加不进位，此时相加的结果是12（个位数5和7相加不要进位是2，十位数0和1相加结果是1）；第二步做进位，5+7中有进位，进位的值是10；第三步把前面两个结果加起来，12+10的结果是22，刚好5+17=22我们一直在想，求两数之和四则运算都不能用，那还能用什么？对数字做运算，除四则运算之外，也就只剩下位运算了。位运算是针对ニ进制的，我们就以二进制再来分析一下前面的“三步走”策略对二进制是不是也适用。  
5的二进制是101，17的二进制是10001。我们还是试着把计算分成三步:第一步各位相加但不计进位，得到的结果是10100（最后一位两个数都是1，相加的结果是二进制的10。这一步不计进位，因此结果仍然是0）；第二步记下进位，在这个例子中只在最后一位相加时产生一个进位，结果是二进制的10；第三步把前两步的结果相加，得到的结果是10110，转换成十进制正好是22。由此可见“三步走”策略对二进制也是适用的。  
接下来我们试着把二进制的加法用位运算来替代。第一步不考虑进位对每一位相加。0加0、1加1的结果都是0，0加1、1加0的结果都是1我们注意到，这和异或的结果是一样的。对异或而言，0和0、1和1的异或结果是0，而0和1、1和0的异或结果是1。接着考虑第二步进位，对0加0、0加1、1加0而言，都不会产生进位，只有1加1时，会向前产生一个进位。此时我们可以想象成两个数先做位与运算，然后再向左移动一位。只有两个数都是1的时候，位与得到的结果是1，其余都是0。第三步把前两个步骤的结果相加。第三步相加的过程依然是重复前面两步，直到不产生进位为止。

```java
private int add(int num1, int num2) {
    int sum, carry;

    do {
        sum = num1 ^ num2;
        carry = (num1 & num2) << 1;

        num1 = sum;
        num2 = carry;
    } while (num2 != 0);

    return num1;
}
```

!!! info "相关问题"
    不使用新的变量，交换两个变量的值。比如有两个变量a、b，我们希望交换它们的值。有两种不同的方式：  
    基于加减法：  
    a = a + b; b = a - b; a = a - b;  
    基于异或运算：  
    a = a ^ b; b = a ^ b; a = a ^ b;

## 14. (66)构建乘积数组

> 给定一个数组A[0, 1, …, n-1]，请构建一个数组B[0, 1, …, n-1]，其中B中的元素B[i] =A[0]×A[1]×… ×A[i-1]×A[i+1]×…×A[n-1]。不能使用除法。

如果没有不能使用除法的限制，则可以用公式$\begin{matrix} \prod_{j=0}^{n-1} A[j]/A[i] \end{matrix}$求得$B[i]$。在使用除法时，要特别注意$A[i]$等于0的情况。

现在要求不能使用除法，只能用其他方法。一种直观的解法是用连乘n-1个数字得到$B[i]$。显然这种方法需要$O(n^2)$的时间构建整个数组B。  

好在还有更高效的算法。可以把$B[i]=A[0] \times A[1] \times \cdots \times A[i-1] \times A[i+1] \times \cdots \times A[n-1]$看成$A[0] \times A[1] \times \cdots \times A[i-1]$和$A[i+1] \times \cdots \times A[n-1]$两部分的乘积。因此，数组B可以用一个矩阵来创建（见下图）。在图中，$B[i]$为矩阵中第i行所有元素的乘积。

![把数组B看成由一个矩阵来创建](/assets/images/leetcode/ci_66.png)

<center>把数组B看成由一个矩阵来创建</center>

不妨定义$C[i]=A[0] \times A[1] \times \cdots \times A[i-1]$，$D[i]=A[i+1] \times \cdots \times A[n-1]$。$C[i]$可以用自上而下的顺序计算出来，即$C[i]=C[i-1] \times A[i-1]$。类似的，$D[i]$也可以用自下而上的顺序计算出来，即$D[i]=D[i+1] \times A[i+1]$。

显然这种思路的时间复杂度是$O(n)$，这比蛮力法更高效。

```java
private void buildProductionArray(double[] input, double[] output) {
    if (input == null || output == null) {
        return;
    }

    int length1 = input.length;
    int length2 = output.length;

    if (length1 != length2 || length2 <= 1) {
        return;
    }

    output[0] = 1;
    for (int i = 1; i < length1; i++)
        output[i] = output[i - 1] * input[i - 1];

    double temp = 1.0;
    for (int i = length1 - 2; i >= 0; i--) {
        temp *= input[i + 1];
        output[i] *= temp;
    }
}
```

## 15. (67)把字符串转换成整数

> 请你写一个函数StrToInt，实现把字符串转换成整数这个功能。当然，不能使用atoi或者其他类似的库函数。

此题同[LC-8-String to Integer (atoi)](/leetcode/leetcode1-10/#8-string-to-integer-atoi)

代码粘贴如下：

```java
class Solution {
    public int myAtoi(String str) {
        if (str == null) return 0;

        str = str.trim();
        int i = 0;
        int sign = 1;

        if (i < str.length() && (str.charAt(i) == '+' || str.charAt(i) == '-')) {
            sign = str.charAt(i++) == '+' ? 1 : -1;
        }

        long result = 0;
        while (i < str.length() && Character.isDigit(str.charAt(i))) {
            result = 10 * result + (sign * (str.charAt(i++) - '0'));
            if (result >= Integer.MAX_VALUE) return Integer.MAX_VALUE;
            if (result <= Integer.MIN_VALUE) return Integer.MIN_VALUE;
        }

        return (int) result;
    }
}
```

## 16. (68)树中两个结点的最低公共祖先

> 输入两个树结点，求它们的最低公共祖先。

先求根节点到所给节点的路径，然后问题转化为求两个链表的最后一个公共节点问题。  

```java
private TreeNode getLastCommonParent(TreeNode root, TreeNode node1, TreeNode node2) {
    if (root == null || node1 == null || node2 == null) {
        return null;
    }

    List<TreeNode> path1 = new ArrayList<>();
    getNodePath(root, node1, path1);

    List<TreeNode> path2 = new ArrayList<>();
    getNodePath(root, node2, path2);

    return getLastCommonNode(path1, path2);
}

private boolean getNodePath(TreeNode root, TreeNode node, List<TreeNode> path) {
    if (root == node) {
        return true;
    }

    path.add(root);

    boolean found = false;
    for (int i = 0; !found && i < root.children.size(); i++) {
        found = getNodePath(root.children.get(i), node, path);
    }

    if (!found) {
        path.remove(path.size() - 1);
    }

    return found;
}

private TreeNode getLastCommonNode(List<TreeNode> path1, List<TreeNode> path2) {
    int i = 0, j = 0;

    TreeNode last = null;
    while (i < path1.size() && j < path2.size()) {
        if (path1.get(i) == path2.get(j)) {
            last = path1.get(i);
        }
        i++;
        j++;
    }

    return last;
}
```