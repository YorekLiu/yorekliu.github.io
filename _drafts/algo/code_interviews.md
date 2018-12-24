---
title: "数据结构"
excerpt: "剑指Offer笔记1——数据结构"
categories:
  - Algorithm
tags:
  - Array
  - String
  - Linked list
  - Tree
  - Stack
  - Queue
toc: true
toc_label: "目录"
#last_modified_at: 2018-12-03T16:25:29+08:00
---

## 1. 数组

[Array](/tags/#array){: .btn .btn--inverse }  

### 1.1 (3)数组中重复的数字

#### 1.1.1 找出数组中重复的数字
在一个长度为n的数组里的所有数字都在0到n-1的范围内。数组中某些数字是重复的，但不知道有几个数字重复了，也不知道每个数字重复了几次。请找出数组中任意一个重复的数字。例如，如果输入长度为7的数组{2, 3, 1, 0, 2, 5, 3}，那么对应的输出是重复的数字2或者3。
{: .notice }

**解法一：先排序，后遍历**

排序后找到重复的数字是非常容易的事情，只需要从头到尾扫描排序后的数组就可以了。  
排序一个长度为n的数组需要O(nlogn)的时间

**解法二：哈希表**

从头到尾扫描，每扫到一个数字，可以用O(1)的时间判断哈希表中是否已经包含了该数字。如果没有包含，就把它加入哈希表。否则，就找到了重复数字。  
其时间复杂度为O(n)，空间复杂度也为O(n)

**解法三：利用数组的特点**

我们注意到数组中的数字都在0~n-1的范围内。如果数组中没有重复元素，那么数组排序后数字i将会出现在下标为i的位置。如果有重复的元素，那么有些位置可能存在多个数字，同时有些位置可能没有数字。

我们从头到尾遍历数组。当扫描到下标为i的数字时，首先比较这个数字(m)是不是i。如果是，则接着扫描下一个数字；如果不是，拿它和第m个数字进行比较。如果它和第m个数字相等，就找到了一个重复的数字(该数字在下标i和m的位置都出现了)。如果它和第m个数字不相等，就把第i个数字和第m个数字交换，把m放到属于它的位置。接下来再重复这个比较、交换的过程。  

```java
private int duplicate(int[] numbers, int length) {
    if (numbers == null || length == 0) {
        return -1;
    }

    for (int i = 0; i < length; i++) {
        if (numbers[i] < 0 || numbers[i] >= length) {
            return -1;
        }
    }

    for (int i = 0; i < length; i++) {
        while (numbers[i] != i) {
            if (numbers[i] == numbers[numbers[i]]) {
                return numbers[i];
            }

            // swap
            int t = numbers[i];
            numbers[i] = numbers[t];
            numbers[t] = t;
        }
    }

    return -1;
}
```

此题思想和[LeetCode—41—Next Permutation](/algorithm/leetcode41-50/#41-next-permutation)思想类似。

#### 1.1.2 不修改数组找出重复的数字
在一个长度为n+1的数组里的所有数字都在1到n的范围内，所以数组中至少有一个数字是重复的。请找出数组中任意一个重复的数字，但不能修改输入的数组。例如，如果输入长度为8的数组{2, 3, 5, 4, 3, 2, 6, 7}，那么对应的输出是重复的数字2或者3。
{: .notice }

**解法一：复制数组时排序**  
我们可以创建一个长度为n+1的辅助数组，然后逐一辅助原数组中的每个数字。在复制时，如果原数组中被复制的数字是m，则把它复制到辅助数组中下标为m的位置。这样就容易发现哪个数字是重复的。  
该方法时间复杂度为O(1)，空间复杂度为O(n)。

**解法二：利用题设**  

> 在一个长度为n+1的数组里的所有数字都在1到n的范围内，所以数组中至少有一个数字是重复的。  

由于所有的数字都在1~n的范围内，所以我们可以利用二分查找，在查找时统计一下某个区间里数字的数目。  
我们把1~n的数字从中间的数字m分为两部分，前面一半为1~m，后面一半为m+1~n。如果1~m的数字出现的次数超过m，那么这一半的区间里一定包含重复的数字；否则另一半区间里一定包含重复的数字。我们可以继续把包含重复数字的区间一分为二，直到找到一个重复的数字。  

该方法由于二分查找的特点，`countRange`方法会被调用O(logn)次，每次需要O(n)的时间，因此总时间复杂度是O(nlogn)，空间复杂度为O(1)。

```java
// 题设：n+1的数组里的所有数字都在1到n的范围内
// 可以换成好理解的：n的数组里的所有数字都在1到n-1的范围内
private int duplicate(int[] numbers, int length) {
    if (numbers == null || length == 0) {
        return -1;
    }

    for (int i = 0; i < length; i++) {
        if (numbers[i] < 0 || numbers[i] >= length) {
            return -1;
        }
    }

    // start、end是需要统计的数字的上下限
    int start = 1;
    int end = length - 1;
    int mid = 0;

    while (end >= start) {
        mid = ((end - start) >> 2) + start;

        int count = countRange(numbers, start, mid);

        if (start == end) {
            if (count > 1) {
                // 找到了，当前指向的值就是重复数字
                return start;
            } else {
                // 否则，没有重复数字
                break;
            }
        }

        // 如果区间内的出现的数字个数大于区间的长度，说明这个区间出现了重复数字
        if (count > (mid - start + 1)) {
            // 此时重复的值可能就是mid，所以end=mid
            end = mid;
        } else {
            // 如果该区间没有重复数字，那么mid肯定也不是，所以跳过mid
            start = mid + 1;
        }
    }

    return -1;
}

private int countRange(int[] numbers, int start, int end) {
    int count = 0;

    for (int i = 0; i < numbers.length; i++) {
        if (numbers[i] >= start && numbers[i] <= end) {
            count++;
        }
    }

    return count;
}
```

### 1.2 (4)二维数组中的查找

在一个二维数组中，每一行都按照从左到右递增的顺序排序，每一列都按照从上到下递增的顺序排序。请完成一个函数，输入这样的一个二维数组和一个整数，判断数组中是否含有该整数。
{: .notice }

下面就是一个示例数组。在其中查找7返回true，查找5返回false。

{% raw %}
1&nbsp;&nbsp;2&nbsp;&nbsp;8&nbsp;&nbsp;9  
2&nbsp;&nbsp;4&nbsp;&nbsp;9&nbsp;&nbsp;12  
4&nbsp;&nbsp;7&nbsp;&nbsp;10&nbsp;13  
6&nbsp;&nbsp;8&nbsp;&nbsp;11&nbsp;15  
{% endraw %}

我们利用每行每列都是递增的规律，可以整行、整列地缩减查找范围。  
首选选取数组右上角的数字。如果数字等于要查找的数字，则查找过程结束；如果该数字大于要查找的数字，说明要查找的数字位于该列左边，所以剔除这个数字所在的列；如果该数字小于要查找的数字，说明要查找的数字位于改行下方，所以剔除这个数字所在的行。这样每一步都可以缩小查找的方位，直到找到数字或查找结束。  

```java
boolean find(int[][] matrix, int rows, int columns, int number) {
    if (matrix == null || rows == 0 || columns == 0) {
        return false;
    }

    int row = 0;
    int col = columns - 1;
    while (row < rows && col >= 0) {
        if (matrix[row][col] == number) {
            return true;
        } else if (matrix[row][col] > number) {
            col--;
        } else {
            row++;
        }
    }

    return false;
}
```

在上面的代码中，我们选取的右上角的数字。同样，我们也可以选择左下角的数字，也可以逐步减小查找范围。其他两个角因为是最小值、最大值，无法逐步减小查找范围。
```java
int row = rows - 1;
int col = 0;
while (col < columns && row >= 0) {
    if (matrix[row][col] == number) {
        return true;
    } else if (matrix[row][col] > number) {
        row--;
    } else {
        col++;
    }
}
```

## 2. 字符串
[String](/tags/#string){: .btn .btn--inverse }  

### 2.1 (5)替换空格

请实现一个函数，把字符串中的每个空格替换成"%20"。例如输入“We are happy.”，则输出“We%20are%20happy.”。
{: .notice }

**解法一：顺序查找空格，找到后插入%20**  
假设字符串的长度为n。对于每个空格字符，需要移动和面O(n)个字符，对于含有O(n)个空格字符的字符串而言，总的时间效率是O(n^2)。

**解法二：计算空格个数，从后往前替换空格**  
我们可以先遍历一次字符串，统计出空格的总数，由此可以计算出新串的总长度。然后从字符串的后面开始复制和替换。  

```java
String replaceBlank(String str) {
    if (str == null || "".equals(str)) {
        return str;
    }

    // 统计空格的个数
    int spaceCount = 0;
    for (int i = 0; i < str.length(); i++) {
        if (str.charAt(i) == ' ') {
            spaceCount++;
        }
    }

    // 如果不包含空格，就可以直接返回原来的字符串
    if (spaceCount == 0) {
        return str;
    }

    // 申请新串，准备复制
    final int newStrLength = str.length() + spaceCount * 2;
    char[] result = new char[newStrLength];
    int index = newStrLength - 1;

    // 在原来的串上从后往前遍历
    for (int i = str.length() - 1; i >= 0; i--) {
        if (str.charAt(i) == ' ') {
            // 遇到一个空格，则在新串上填上%20
            result[index--] = '0';
            result[index--] = '2';
            result[index--] = '%';
        } else {
            // 复制原来的字符
            result[index--] = str.charAt(i);
        }
    }

    return new String(result);
}
```

也可以在Java中直接使用`StringBuilder`的特点解决此问题：
```java
String replaceBlank(String str) {
    if (str == null || "".equals(str)) {
        return str;
    }

    StringBuilder result = new StringBuilder();
    for (int i = 0; i < str.length(); i++) {
        char ch = str.charAt(i);
        if (ch == ' ') {
            result.append("%20");
        } else {
            result.append(ch);
        }
    }

    return result.toString();
}
```

**相关题目**    
有两个排序的数组A1和A2，内存在A1的末尾有足够多的剩余空间容纳A2。请实现一个函数，把A2中的所有数字插入A1中，并且所有的数字是排序的。  
推荐的方法是从尾到头比较A1和A2中的数字，并把较大的数字复制到A1中的合适位置。
{: .notice--info }

**举一反三**    
在合并两个数组时，如果从前往后复制每个数字需要重复移动数字多次，那么我们可以考虑从后往前复制，这样就能减少移动的次数，从而提高效率。
{: .notice--info }

## 3. 链表
[Linked list](/tags/#linked-list){: .btn .btn--inverse }  

### 3.1 (6)从尾到头打印链表

输入一个链表的头结点，从尾到头反过来打印出每个结点的值。
{: .notice }

通常打印只是一个只读操作，我们不希望打印时修改内容。  
此题如果想把链表中链接节点的指针反转过来，改变链表的方向，这样就太蠢了，而且也会改变原来链表的结构。  
我们可以想到遍历时使用`Stack`保存节点的值，然后全部出栈就可以了。

**解法一：利用栈**

```java
private void printListReversingly1(ListNode pHead) {
    ListNode p = pHead;

    Stack<Integer> stack = new Stack<>();

    while (p != null) {
        stack.push(p.value);
        p = p.next;
    }

    while (!stack.isEmpty()) {
        System.out.print(stack.pop() + "\t");
    }
}
```

既然想到了用栈实现，而递归本质上就是一个栈结构，所以我们也可以利用递归实现。  
要反过来输出链表，我们每访问一个节点时，先递归输出它后面的节点，再输出该节点自身，这样就实现了目的。

**解法二：递归**
```java
private void printListReversingly2(ListNode pHead) {
    if (pHead != null) {
        printListReversingly1(pHead.next);
        System.out.print(pHead.value + "\t");
    }
}
```

上面的代码看起来很简洁，但**当链表非常长的时候，就会导致函数调用的层级很深，从而导致函数调用栈溢出**。显然用栈基于循环实现的代码鲁棒性要好一点。  

## 4. 树
[Tree](/tags/#tree){: .btn .btn--inverse }  

树的逻辑结构很简单：除根节点之外的每个节点只有一个父节点，根节点没有父节点；除叶节点之外所有节点都有一个或多个子节点，叶节点没有子节点。父节点与子节点之间用指针链接。  

我们常提到的树是二叉树，通常二叉树有如下几种遍历方式。
- **前序遍历**：根左右，即先访问根节点，再访问左子节点，最后访问右子节点。  
  图中二叉树的前序遍历的顺序是，10、6、4、8、14、12、16
- **中序遍历**：左根右，即先访问左子节点，再访问根节点，最后访问右子节点。  
  图中二叉树的中序遍历的顺序是，4、6、8、10、12、14、16
- **后序遍历**：左右根，即先访问左子节点，再访问右子节点，最后访问根节点。  
  图中二叉树的中序遍历的顺序是，4、8、6、12、16、14、10

<figure style="width: 229px" class="align-center">
    <img src="/assets/images/leetcode/ci_binary_tree_sample.png">
    <figcaption>一个二叉树例子</figcaption>
</figure>

这三种遍历方式都有递归和循环2种实现方式，每种遍历的递归实现都比循环实现要简洁很多。我们应该对这3中遍历的6种实现方法都了如指掌。  

- **宽度优先遍历**：先访问树的第一层节点，再访问树的第二层节点……一直到访问到最下面一层节点。在同一层节点中，以从左到右的顺序依次访问。我们可以对包括二叉树在内的所有树进行宽度优先遍历。  
  图中二叉树的宽度优先遍历的顺序是，10、6、14、4、8、12、16

若设二叉树的深度为h，除第h层外，其它各层 (1～h-1) 的结点数都达到最大个数，第h层所有的结点都连续集中在最左边，这就是**完全二叉树**。
{: .notice }

二叉树有很多特例，**二叉搜索树**就是其中之一。  
在二叉搜索树中，左子节点总是小于或者等于根节点，而右子节点总是大于或者等于根节点。上图的二叉树就是一颗二叉搜索树。我们平均在O(logn)的时间内根据数值在二叉搜索树中找到一个节点。

二叉树的另外两个特例是**堆**和**红黑树**。  
堆分为最大堆和最小堆。在最大堆中根节点的值最大，在最小堆中根节点的值最小。有很多需要快速找到最大值或者最小值的问题都可以用堆解决。  
红黑树是把树中的节点定义为红、黑两种颜色，并通过规则确保从根节点到叶节点的最长路径的长度不超过最短路径的两倍。

### 4.1 (7)重建二叉树

输入某二叉树的前序遍历和中序遍历的结果，请重建出该二叉树。假设输入的前序遍历和中序遍历的结果中都不含重复的数字。  
例如输入前序遍历序列{1,2, 4, 7, 3, 5, 6, 8}和中序遍历序列{4, 7, 2, 1, 5, 3, 8, 6}，则重建下图所示的二叉树并输出它的头结点。
{: .notice }

前序+中序、后序+中序、层序+中序都可以重建二叉树，但是前序+后序不行。
{: .notice--primary }

<figure style="width: 151px" class="align-center">
    <img src="/assets/images/leetcode/ci_binary_tree_7.png">
    <figcaption>一个二叉树例子</figcaption>
</figure>

算法思路是先根据前序序列找到根节点，然后在中序序列中找到该节点，其左边的就是树的左子树，右边就是右子树。

```java
private BinaryTreeNode construct(int[] preorder, int[] inorder, int length) throws Exception{
    if (preorder == null || inorder == null || length <= 0) {
        return null;
    }

    return constructCore(preorder, 0, preorder.length - 1, inorder, 0, inorder.length - 1);
}

private BinaryTreeNode constructCore(
        int[] preorder, int startPreorder, int endPreorder,
        int[] inorder, int startInorder, int endInorder
) throws Exception {
    // 如果发生了这种情况，说明前中序子序列为空，那么肯定就是空节点了
    if (startInorder > endInorder || startPreorder > endPreorder) {
        return null;
    }

    // startPreorder即为根节点
    BinaryTreeNode root = new BinaryTreeNode(preorder[startPreorder]);

    boolean find = false;
    int i = startInorder;
    for (; i <= endInorder; i++) {
        if (inorder[i] == root.value) {
            find = true;
            // 由于在中序序列中i是根节点，所以i-startInorder的长度就是左子树的长度
            // 因此重建左子树时，左子树的前序序列范围就是startPreorder+1至startPreorder+1 + i-startInorder - 1 = startPreorder + i - startInorder
            // 左子树的中序序列范围就是startInorder至i - 1，没有什么好说的
            // 重建右子树时类似
            root.left = constructCore(
                preorder, startPreorder + 1, startPreorder + i - startInorder,
                inorder, startInorder, i - 1);
            root.right = constructCore(
                preorder, startPreorder + i - startInorder + 1, endPreorder,
                inorder, i + 1, endInorder);
        }
    }
    // 最后，如果根节点在中序序列中没有找到，那么肯定是无效的输入了
    if (!find) {
        throw new Exception("invalid input");
    }

    return root;
}
```

### 4.2 (8)二叉树的下一个节点

给定一棵二叉树和其中的一个结点，如何找出中序遍历顺序的下一个结点？树中的结点除了有两个分别指向左右子结点的指针以外，还有一个指向父结点的指针。
{: .notice }

下图中二叉树的中序遍历序列是{d, b, h, e, i, a, f, c, g}。

<figure style="width: 269px" class="align-center">
    <img src="/assets/images/leetcode/ci_binary_tree_8.png">
    <figcaption>一颗有9个节点的二叉树</figcaption>
</figure>

我们以上面这颗树为例分析如何找出二叉树的下一个节点。  
- *根*，如果一个节点有右子树：那么它的下一个节点就是它的右子树中的最左子节点。也就是说，从右子节点出发一直沿着指向左子节点的指针，我们就能找到它的下一个节点。
- *左*，如果一个节点没有右子树，同时节点是它父节点的左子节点，那么它的父节点就是要找的下一个节点。
- *右*，如果一个节点没有右子树，同时节点是它父节点的右子节点：我们需要沿着父节点一直向上，直到找到一个是它父节点的左子节点的节点。这个父节点就是我们要找的下一个节点。

```java
private ParentBinaryTreeNode getNext(ParentBinaryTreeNode node){
    if (node == null) {
        return null;
    }

    ParentBinaryTreeNode next = null;
    if (node.right != null) {
        // 情况1 从右子节点出发一直沿着指向左子节点的指针
        next = node.right;

        while (next.left != null) {
            next = next.left;
        }

        return next;
    } else if (node.parent != null) {
        // 情况2、3可以理解为同一种 2是3的一般情况
        next = node;

        // 沿着父节点一直向上，直到找到一个节点，它是父节点的左子节点
        // 即如果这个节点是父节点的右节点，那么继续寻找
        while (next.parent != null && next == next.parent.right) {
            next = next.parent;
        }

        // 最后这个父节点就是我们要找的下一个节点
        return next.parent;
    }

    return next;
}
```

## 5. 栈和队列
[Stack](/tags/#stack){: .btn .btn--inverse }  [Queue](/tags/#queue){: .btn .btn--inverse }  

栈的特点是后进先出，通常栈是一个不考虑排序的数据结构，我们需要O(n)时间才能找到栈中最大或者最小的元素。如果想要在O(1)时间内得到栈的最大值或最小值，则需要对栈做特殊的设计，详见(30)题“包含min函数的栈”。

队列的特点是先进先出。

栈和队列虽然是特点针锋相对的两个数据结构，但有意思的是他们却相互联系。

栈的常用操作为：
- `isEmpty`
- `peek`
- `pop`
- `push`

队列的常用操作为：
- `isEmpty`
- `peek`
- `poll`
- `offer`

### 5.1 (9)用两个栈实现队列

用两个栈实现一个队列。队列的声明如下，请实现它的两个函数appendTail和deleteHead，分别完成在队列尾部插入结点和在队列头部删除结点的功能。
{: .notice }

```java
class JQueue<T> {
    private Stack<T> stack1 = new Stack<>();
    private Stack<T> stack2 = new Stack<>();

    public void appendTail(T element) {
        stack1.push(element);
    }

    public T deleteHead() {
        if (stack2.isEmpty()) {
            while (!stack1.isEmpty()) {
                stack2.push(stack1.pop());
            }
        }

        if (stack2.isEmpty()) {
            return null;
        }

        return stack2.pop();
    }
}
```

插入元素的时候直接插入stack1即可。  
在删除队列的头部的时候，如果stack2为空，那么把stack1的`pop`依次`push`进stack2。这样操作后stack2中最上面就是最先进队列的，也就是我们要求的。


**相关题目**  
用两个队列实现一个栈。
{: .notice--info }

```java
/**
 * 相关题目
 * 用两个队列实现一个栈。
 */
class JStack<T> extends Stack<T>{
    private Queue<T> queue1 = new LinkedList<>();
    private Queue<T> queue2 = new LinkedList<>();

    @Override
    public T push(T item) {
        queue1.offer(item);
        return item;
    }

    @Override
    public synchronized T pop() {
        if (queue1.isEmpty()) {
            throw new EmptyStackException();
        }

        while (queue1.size() > 1) {
            queue2.offer(queue1.poll());
        }

        T item = queue1.poll();

        Queue<T> tmp = queue1;
        queue1 = queue2;
        queue2 = tmp;

        return item;
    }

    public static void main(String[] args) {
        Stack<Integer> stack = new JStack<>();

        stack.push(1);
        System.out.println(stack.pop());
        stack.push(2);
        stack.push(3);
        System.out.println(stack.pop());
        stack.push(4);
        System.out.println(stack.pop());
        System.out.println(stack.pop());

        // 输出 1 3 4 2
    }
}
```
