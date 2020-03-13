---
title: "解决问题的思路"
---

## 1. 画图让抽象问题形象化

### 1.1 (27)二叉树的镜像

> 请完成一个函数，输入一个二叉树，该函数输出它的镜像。

二叉树的镜像的特点如下图所示：

![两颗互为镜像的二叉树](/assets/images/leetcode/ci_binary_tree_27.png)

<center>两颗互为镜像的二叉树</center>

我们可以看出一棵树的镜像是这么生成的：先前序遍历这棵树的每个节点，如果遍历到的节点有子节点，就交换它的两个子节点。当交换完所有非叶节点的左、右子节点之后，就得到了树的镜像。  

```java
/**
 * 递归实现
 */
public BinaryTreeNode mirrorRecursively(BinaryTreeNode root) {
    if (root == null) {
        return null;
    }
    if (root.left == null && root.right == null) {
        return root;
    }

    BinaryTreeNode left = root.left;
    root.left = root.right;
    root.right = left;

    if (root.left != null) {
        mirrorRecursively(root.left);
    }
    if (root.right != null) {
        mirrorRecursively(root.right);
    }

    return root;
}

/**
 * 循环实现
 */
public BinaryTreeNode mirrorIteratively(BinaryTreeNode root) {
    if (root == null) {
        return null;
    }

    Stack<BinaryTreeNode> stack = new Stack<>();
    stack.push(root);

    while (!stack.isEmpty()) {
        BinaryTreeNode node = stack.pop();

        BinaryTreeNode temp = node.left;
        node.left = node.right;
        node.right = temp;

        if (node.left != null) {
            stack.push(node.left);
        }
        if (node.right != null) {
            stack.push(node.right);
        }
    }

    return root;
}
```

### 1.2 (28)对称的二叉树

> 请实现一个函数，用来判断一棵二叉树是不是对称的。如果一棵二叉树和它的镜像一样，那么它是对称的。

此题同[LC-101-Symmetric Tree](/leetcode/leetcode101-110/#101-symmetric-tree)

在下图所示的3棵树中，第一棵二叉树是对称的，另外两棵不是。  

![第一棵是对称的，另外两棵不是](/assets/images/leetcode/ci_binary_tree_28.png)

<center>第一棵是对称的，另外两棵不是</center>

我们可以先比较根节点，然后递归比较左子树的左节点与右子树的右节点、左子树的右节点与右子树的子节点。  

```java
public boolean isSymmetrical(BinaryTreeNode root) {
    return isSymmetrical(root, root);
}

private boolean isSymmetrical(BinaryTreeNode root1, BinaryTreeNode root2) {
    if (root1 == null && root2 == null) {
        return true;
    }

    if (root1 == null || root2 == null) {
        return false;
    }

    if (root1.value != root2.value) {
        return false;
    }

    return isSymmetrical(root1.left, root2.right) &&
            isSymmetrical(root1.right, root2.left);
}
```

### 1.3 (29)顺时针打印矩阵

> 输入一个矩阵，按照从外向里以顺时针的顺序依次打印出每一个数字

例如输入如下矩阵，依次打印出数字1	2	3	4	8	12	16 15	14 13	9	5	6	7	11 10

![](/assets/images/leetcode/ci_29.png)

此题同[LC-54-Spiral Matrix](/leetcode/leetcode51-60/#54-spiral-matrix)

这道题完全没有涉及复杂的数据结构或者高级的算法，看起来是一个很简单的问题。但实际上解决这个问题时会在代码中包含多个循环，而且需要判断多个边界条件。

总体上来说，我们可以每次循环打印一圈。循环可以开始的条件是`columns > start * 2 && rows > start * 2`。  
在每次循环中，要判断除第一条边之外的三条边是否可以打印，以及打印时循环开始、结束的值。  

```java
private void printMatrixClockwisely(int[][] numbers, int columns, int rows) {
    if (numbers == null || columns <= 0 || rows <= 0) {
        return;
    }

    int start = 0;

    while (columns > start * 2 && rows > start * 2) {
        printMatrixInCircle(numbers, columns, rows, start);
        start++;
    }
}

private void printMatrixInCircle(int[][] numbers, int columns, int rows, int start) {
    int endX = columns - 1 - start;
    int endY = rows - 1 - start;

    // 从左到右打印一行
    for (int i = start; i <= endX; i++) {
        int number = numbers[start][i];
        System.out.printf("%d\t", number);
    }

    // 从上到下打印一列
    if (start < endY) {
        for (int i = start + 1; i <= endY; i++) {
            int number = numbers[i][endX];
            System.out.printf("%d\t", number);
        }
    }

    // 从右到左打印一行
    if(start < endX && start < endY) {
        for(int i = endX - 1; i >= start; i--) {
            int number = numbers[endY][i];
            System.out.printf("%d\t", number);
        }
    }

    // 从下到上打印一行
    if(start < endX && start < endY - 1) {
        for(int i = endY - 1; i >= start + 1; i--) {
            int number = numbers[i][start];
            System.out.printf("%d\t", number);
        }
    }
}
```

## 2. 举例让抽象问题具体化  

### 2.1 (30)包含min函数的栈

> 定义栈的数据结构，请在该类型中实现一个能够得到栈的最小元素的min函数。在该栈中，调用min、push及pop的时间复杂度都是O(1)。

我们可以在栈的内部额外使用一个辅助栈，栈中同步保存每次进栈操作时栈中最小值。  

```java
class StackWithMin<E extends Comparable> extends Stack<E> {
    // 辅助栈
    private Stack<E> minStack = new Stack<>();

    public synchronized E min() {
        return minStack.peek();
    }

    @Override
    public synchronized E pop() {
        minStack.pop();
        return super.pop();
    }

    @Override
    public synchronized E peek() {
        return super.peek();
    }

    @Override
    public E push(E item) {
        if (minStack.isEmpty() || minStack.peek().compareTo(item) > 0) {
            minStack.push(item);
        } else {
            minStack.push(minStack.peek());
        }
        return super.push(item);
    }
}
```

### 2.2 (31)栈的压入、弹出序列

> 输入两个整数序列，第一个序列表示栈的压入顺序，请判断第二个序列是否为该栈的弹出顺序。假设压入栈的所有数字均不相等。例如序列1、2、3、4、5是某栈的压栈序列，序列4、5、3、2、1是该压栈序列对应的一个弹出序列，但4、3、5、1、2就不可能是该压栈序列的弹出序列。

我们可以找到判断一个序列是不是栈的弹出序列的规律：如果下一个弹出的数字刚好是栈顶数字，那么直接弹出；如果下一个弹出的数字不在栈顶，则把压栈序列中还没有入栈的数字压入辅助栈，直到把下一个需要弹出的数字压入栈顶为止；如果所有数字都压入栈后仍然没有找到下一个弹出的数字，那么该序列不可能是一个序列。

```java
private boolean isPopOrder(int[] push, int[] pop) {
    if (push == null || pop == null || push.length != pop.length) {
        return false;
    }

    final int length = pop.length;
    boolean possible = false;
    int pushIndex = 0;
    int popIndex = 0;

    Stack<Integer> stack = new Stack<>();

    while (popIndex < length) {
        // 当辅助栈的栈顶元素不是要弹出的元素
        // 先压入一些数字入栈
        while (stack.isEmpty() || stack.peek() != pop[popIndex]) {
            // 如果所有数字都压入辅助栈了，退出循环
            if (pushIndex == length) {
                break;
            }

            stack.push(push[pushIndex]);
            pushIndex++;
        }

        if (stack.peek() != pop[popIndex])
            break;

        stack.pop();
        popIndex++;
    }

    if (stack.isEmpty() && popIndex == length) {
        possible = true;
    }

    return possible;
}
```

### 2.3 (32)从上到下打印二叉树

#### 2.3.1 不分行从上到下打印二叉树

> 从上往下打印出二叉树的每个结点，同一层的结点按照从左到右的顺序打印。

该题就是一个二叉树的层序遍历问题。

```java
private void printFromTopToBottom(BinaryTreeNode root) {
    if (root == null) {
        return;
    }

    Queue<BinaryTreeNode> queue = new LinkedList<>();
    queue.offer(root);

    while (!queue.isEmpty()) {
        BinaryTreeNode node = queue.poll();

        System.out.printf("%d\t", node.value);
        if (node.left != null) {
            queue.offer(node.left);
        }
        if (node.right != null) {
            queue.offer(node.right);
        }
    }
}
```

!!! info "本题扩展"
    如何广度优先遍历一副有向图？同样也可以基于队列实现。树是图的一种特殊退化形式，从上到下按层遍历二叉树，从本质上来说就是广度优先遍历二叉树。

!!! info "举一反三"
    不管广度优先遍历一副有向图还是一棵树，都要用到队列。首先把起始节点(对树而言是根节点)放入队列。接下来每次从队列的头部取出一个节点，遍历这个节点之后就把它能达到的节点(对树而言是子节点)都依次放入队列。重复这个遍历过程，直到队列中的节点全部被遍历为止。

#### 2.3.2 分行从上到下打印二叉树

> 从上到下按层打印二叉树，同一层的结点按从左到右的顺序打印，每一层打印到一行。

此题同[LC-102-Binary Tree Level Order Traversal](/leetcode/leetcode101-110/#102-binary-tree-level-order-traversal)

在前面代码的基础上额外加两个变量：一个表示在当前层中还没有打印的节点数；另一个变量表示下一层节点的数目

```java
private void print(BinaryTreeNode root) {
    if (root == null) {
        return;
    }

    Queue<BinaryTreeNode> queue = new LinkedList<>();
    queue.offer(root);
    int nextLevel = 0;
    int toBePrinted = 1;

    while (!queue.isEmpty()) {
        BinaryTreeNode node = queue.poll();

        System.out.printf("%d\t", node.value);
        if (node.left != null) {
            queue.offer(node.left);
            nextLevel++;
        }
        if (node.right != null) {
            queue.offer(node.right);
            nextLevel++;
        }
        toBePrinted--;
        if (toBePrinted == 0) {
            System.out.println();
            toBePrinted = nextLevel;
            nextLevel = 0;
        }
    }
}
```

在上面的代码中toBePrinted表示在当前层中还没有打印的节点数，而变量nextLevel表示下一层的节点。

#### 2.3.3 之字形打印二叉树

> 请实现一个函数按照之字形顺序打印二叉树，即第一行按照从左到右的顺序打印，第二层按照从右到左的顺序打印，第三行再按照从左到右的顺序打印，其他行以此类推。

此题同[LC-103-Binary Tree Zigzag Level Order Traversal](/leetcode/leetcode101-110/#103-binary-tree-zigzag-level-order-traversal)

按之字形顺序打印二叉树需要两个栈。我们在打印某一层节点时，把下一层的子节点保存在对应的栈中。如果当前打印的是奇数层，则先保存左子节点再保存右子节点到第一个栈里；如果当前打印的是偶数层，则先保存右子节点再保存左子节点到第二个栈里。

```java
private void print(BinaryTreeNode root) {
    if (root == null) {
        return;
    }

    Stack<BinaryTreeNode>[] level2 = new Stack[2];
    level2[0] = new Stack<>();
    level2[1] = new Stack<>();
    int current = 0;
    int next = 1;

    level2[current].push(root);
    while (!level2[0].isEmpty() || !level2[1].isEmpty()) {
        BinaryTreeNode node = level2[current].pop();

        System.out.printf("%d ", node.value);
        if (current == 0) {
            if (node.left != null) {
                level2[next].push(node.left);
            }
            if (node.right != null) {
                level2[next].push(node.right);
            }
        } else {
            if (node.right != null) {
                level2[next].push(node.right);
            }
            if (node.left != null) {
                level2[next].push(node.left);
            }
        }

        if (level2[current].empty()) {
            System.out.println();
            current = 1 - current;
            next = 1 - next;
        }
    }
}
```

### 2.4 (33)二叉搜索树的后序遍历序列

> 输入一个整数数组，判断该数组是不是某二叉搜索树的后序遍历的结果。如果是则返回true，否则返回false。假设输入的数组的任意两个数字都互不相同。

根据二叉搜索树的特征以及树的后序遍历序列特征，我们可以写出下面的代码：

```java
private boolean verifySequenceOfBST(int[] sequence) {
    if (sequence == null || sequence.length == 0) {
        return false;
    }

    return verifySequenceOfBSTInner(sequence, 0, sequence.length - 1);
}

private boolean verifySequenceOfBSTInner(int[] sequence, int start, int end) {
    final int n = sequence.length;
    int root = sequence[n - 1];

    // 在二叉搜索树中左子树的结点小于根结点
    int i = start;
    for (; i < end - 1; i++) {
        if (sequence[i] > root)
            break;
    }

    // 在二叉搜索树中右子树的结点大于根结点
    int j = i;
    for(; j < end - 1; ++ j) {
        if(sequence[j] < root)
            return false;
    }

    // 判断左子树是不是二叉搜索树
    boolean left = true;
    if (i > start)
        left = verifySequenceOfBSTInner(sequence, start, i - 1);

    // 判断右子树是不是二叉搜索树
    boolean right = true;
    if (i < end)
        right = verifySequenceOfBSTInner(sequence, i, end - 1);

    return left && right;
}
```

!!! info "相关题目"
    输入一个整数数组，判断该数组是不是某二叉搜索树的前序遍历结果。  
    *这和前面问题的后序遍历很类似，只是在前序遍历得到的序列中，第一个数字是根节点的值。*

!!! info "举一反三"
    如果面试题要求处理一颗二叉树的遍历序列，则可以先找到二叉树的根节点，再基于根节点把整棵树的遍历序列拆分成左子树对应的子序列和右子树对应的子序列，接下来再递归地处理这两个子序列。本题和第七题“重建二叉树”应用的也是这种思路。

### 2.5 (34)二叉树中和为某一值的路径

> 输入一棵二叉树和一个整数，打印出二叉树中结点值的和为输入整数的所有路径。从树的根结点开始往下一直到叶结点所经过的结点形成一条路径。

在树的前中后序遍历方式中，只有前序遍历是首先访问根节点的。  
当用前序遍历的方式访问到某一节点时，我们把该节点添加到路径上，并累加该节点的值。如果当前节点不是叶节点，则继续访问它的子节点。如果该节点为叶节点，并且路径中节点值和刚好等于输入的整数，则当前路径符合要求，我们打印出来。当前节点访问结束后，递归函数自动回到它的父节点。因此，我们在函数退出之前要把路径上删除当前节点并减去当前节点的值，以确保父节点时路径刚好是从根节点到父节点。我们不难看出保存路径的数据结构是一个栈，因为路径要与递归调用状态一致，而递归调用的本质就是一个压栈和出栈的过程。  
这里我们并没有使用Stack而是一个List，因为Stack只能得到栈顶元素，而我们打印路径的时候需要得到路径上的所有节点，因此在代码实现的时候Stack不是最好的选择。

```java
private int currentSum = 0;

private void findPath(BinaryTreeNode root, int expectedSum) {
    if (root == null) {
        return;
    }

    currentSum = 0;
    findPath(root, expectedSum, new ArrayList<>());
}

private void findPath(BinaryTreeNode root, int expectedSum, List<Integer> path) {
    currentSum += root.value;
    path.add(root.value);

    // 如果是叶结点，并且路径上结点的和等于输入的值
    // 打印出这条路径
    boolean isLeaf = root.left == null && root.right == null;
    if (isLeaf && expectedSum == currentSum) {
        System.out.print("A path is found: ");
        for (Integer node: path) {
            System.out.printf("%d\t", node);
        }
        System.out.println();
    }

    // 如果不是叶结点，则遍历它的子结点
    if (root.left != null) {
        findPath(root.left, expectedSum, path);
    }
    if (root.right != null) {
        findPath(root.right, expectedSum, path);
    }

    // 在返回到父结点之前，在路径上删除当前结点，
    // 并在currentSum中减去当前结点的值
    currentSum -= root.value;
    path.remove(path.size() - 1);
}
```

## 3. 分解让复杂问题简单化

我们遇到复杂的大问题时，如果能够先把大问题分解成若干的简单小问题，然后再逐个解决这些小问题，则可能也会容易很多。  
在计算机领域有一类算法叫分治法，即“分而治之”，采用的就是各个击破的思想。我们把分解之后的小问题各个解决，然后把小问题的解决方案结合起来解决大问题。

### 3.1 (35)复杂链表的复制

> 请实现函数ComplexListNode clone(ComplexListNode head)，复制一个复杂链表。在复杂链表中，每个结点除了有一个next指针指向下一个结点外，还有一个sibling指向链表中的任意结点或者null。

![一个含有5个节点的复杂链表](/assets/images/leetcode/ci_list_node_35.png)

<center>一个含有5个节点的复杂链表</center>

**解法一：笨方法**  

首先复制原始链表上的每个节点，并用next链接起来；然后设置每个节点的sibling指针。  
对于一个含有n个节点的链表，由于定位每个节点的sibling都需要从链表头节点开始经过$O(n)$步才能找到，因此这种方法总的时间复杂度是$O(n^2)$。

**解法二：空间换时间**  
上述方法的时间主要花费在定位节点的sibling上面，我们试着在方面去进行优化。  
我们还是分为两步：第一步仍然是复制原始链表上的每个节点N创建N'，然后把每个节点N用next链接起来，同时把<N, N'\>的配对信息放到一个哈希表中；  
第二步还是设置复制链表的sibling。如果在原始链表中节点N的sibling指向节点S，那么在复制链表中，对应的N'应该指向S'。由于有了哈希表，我们可以用$O(1)$的时间根据S找到S'。  
这种方法相当于用空间换时间。该方法时间复杂度为$O(n)$，空间复杂度也为$O(n)$。

**解法三：不用辅助空间的情况下实现$O(n)$的时间效率**  
第一步仍然是根据原始链表的每个节点N创建对应的N'。这一次，我们把N'链接到N的后面。例子中的链表经过这一步之后的结构如下所示：  

![复制复杂链表的第一步](/assets/images/leetcode/ci_list_node_35_1.png)

<center>复制复杂链表的第一步</center>

第二步设置复制出来的节点的sibling。假设原始链表上的N的sibling指向节点S，那么其对应复制出来的N'是N的next指向的节点，同样S'也是S的next指向的节点。设置sibling之后的链表如图所示：

![复制复杂链表的第二步](/assets/images/leetcode/ci_list_node_35_2.png)

<center>复制复杂链表的第二步</center>

*注：如果原始链表上的节点N的sibling指向S，则其复制节点N'的sibling指向S的复制节点S'。*

第三步把这个长链表拆分为两个链表：奇数、偶数位置分别是原始链表和复制出来的链表。  

![复制复杂链表的第三步](/assets/images/leetcode/ci_list_node_35_3.png)

<center>复制复杂链表的第三步</center>

*注：把第二步得到的链表拆分成为两个链表，奇数位置上的节点组成原始链表，偶数位置上的节点组成复制出来的节点。*

```java
ComplexListNode clone(ComplexListNode head) {
    cloneNodes(head);
    connectSiblingNodes(head);
    return reconnectNodes(head);
}

private void cloneNodes(ComplexListNode head) {
    ComplexListNode node = head;
    while (node != null) {
        ComplexListNode cloned = new ComplexListNode(node.value);
        ComplexListNode.buildNodes(cloned, node.next, node.sibling);

        node.next = cloned;
        node = cloned.next;
    }
}

private void connectSiblingNodes(ComplexListNode head) {
    ComplexListNode node = head;
    while (node != null) {
        ComplexListNode cloned = node.next;
        if (node.sibling != null) {
            cloned.sibling = node.sibling.next;
        }

        node = cloned.next;
    }
}

private ComplexListNode reconnectNodes(ComplexListNode head) {
    ComplexListNode node = head;
    ComplexListNode clonedHead = null;
    ComplexListNode clonedNode = null;

    if (node != null) {
        clonedHead = clonedNode = node.next;
        node.next = clonedHead.next;
        node = node.next;
    }

    while (node != null) {
        clonedNode.next = node.next;
        clonedNode = clonedNode.next;

        node.next = clonedNode.next;
        node = node.next;
    }

    return clonedHead;
}
```

ComplexListNode辅助代码如下：

```java
private static class ComplexListNode {
    int                 value;
    ComplexListNode     next;
    ComplexListNode     sibling;

    ComplexListNode(int value) {
        this.value = value;
    }

    static void buildNodes(ComplexListNode node, ComplexListNode next, ComplexListNode sibling) {
        if (node != null) {
            node.next = next;
            node.sibling = sibling;
        }
    }

    static void printList(ComplexListNode head) {
        ComplexListNode node = head;
        while(node != null) {
            System.out.printf("The value of this node is: %d.\n", node.value);

            if(node.sibling != null)
                System.out.printf("The value of its sibling is: %d.\n", node.sibling.value);
            else
                System.out.print("This node does not have a sibling.\n");

            System.out.println();

            node = node.next;
        }
    }
}
```

### 3.2 (36)二叉搜索树与双向链表  

> 输入一棵二叉搜索树，将该二叉搜索树转换成一个排序的双向链表。要求不能创建任何新的结点，只能调整树中结点指针的指向。

如下图所示，左边的二叉搜索树经过转换之后变成右边的排序双向链表。  

![一颗二叉搜索树及转换之后的排序双向链表](/assets/images/leetcode/ci_binary_tree_36.png)

<center>一颗二叉搜索树及转换之后的排序双向链表</center>

```java
private BinaryTreeNode last;

private BinaryTreeNode convert(BinaryTreeNode root) {
    if (root == null || (root.left == null && root.right == null)) {
        return root;
    }

    last = null;
    convertNode(root);

    while (last != null && last.left != null) {
        last = last.left;
    }

    return last;
}

private void convertNode(BinaryTreeNode node) {
    if (node == null) {
        return;
    }

    BinaryTreeNode current = node;

    if (current.left != null) {
        convertNode(current.left);
    }

    current.left = last;
    if (last != null) {
        last.right = current;
    }

    last = current;

    if (node.right != null) {
        convertNode(node.right);
    }
}
```

在上面的代码中，我们用last指向已经转换好的链表的最后一个节点。当我们遍历到10的节点时，它的左子树都已经转换好了，因此last指向值为8的节点。接着把根节点链接到链表后，值为10的节点成了链表中的最后一个节点（新的值最大的节点），于是last指向了这个值为10的节点。接下来递归遍历右子树。我们把右子树中最左边的子节点，并把该节点和值为10的节点链接起来。

### 3.3 (37)序列化二叉树

> 请实现两个函数，分别用来序列化和反序列化二叉树。

如果二叉树的序列化是从根节点开始的，那么相应的反序列化在根节点的数值读出来的时候就可以开始了。因此，我们可以根据前序遍历的顺序来序列化二叉树，因为前序遍历是从根节点开始的。在遍历二叉树碰到空指针时，将这些空指针序列化为一个特殊的字符（如'$'）。这样就填满成为一个满二叉树了。

例如，下面的二叉树被序列化成为字符串“1,2,4,$,$,$,3,5,$,$,6,$,$”。

![一颗被序列化成字符串“1,2,4,$,$,$,3,5,$,$,6,$,$”的二叉树](/assets/images/leetcode/ci_binary_tree_37.png)

<center>一颗被序列化成字符串“1,2,4,$,$,$,3,5,$,$,6,$,$”的二叉树</center>

```java
private String serialize(BinaryTreeNode root) {
    StringBuilder stream = new StringBuilder();

    serializeInner(root, stream);

    return stream.toString();
}

private void serializeInner(BinaryTreeNode root, StringBuilder stream) {
    if (root == null) {
        stream.append("$,");
        return;
    }

    stream.append(root.value).append(",");
    serializeInner(root.left, stream);
    serializeInner(root.right, stream);
}


private int index = 0;
private BinaryTreeNode deserialize(String stream) {
    if (stream == null || stream.isEmpty()) {
        return null;
    }

    String[] chars = stream.split(",");
    index = 0 ;
    return deserializeInner(chars);
}

private BinaryTreeNode deserializeInner(String[] chars) {
    if (chars[index].equals("$")) {
        index++;
        return null;
    }
    BinaryTreeNode node = new BinaryTreeNode(Integer.parseInt(chars[index++]));
    node.left = deserializeInner(chars);
    node.right = deserializeInner(chars);

    return node;
}
```
总结序列化和反序列化的过程，就会发现我们都是把二叉树分解为3部分：根节点、左子树和右子树。我们在处理它的根节点之后再分别处理它的左右子树。这就是典型的把问题递归分解然后逐个解决的过程。

### 3.4 (38)字符串的排列

> 输入一个字符串，打印出该字符串中字符的所有排列。例如输入字符串abc，则打印出由字符a、b、c所能排列出来的所有字符串abc、acb、bac、bca、cab和cba。

我们可以考虑把这个复杂问题分解成小的问题。比如，我们把第一个字符串看成由两部分组成：第一部分是它的第一个字符；第二部分是后面的所有字符。  
我们求整个字符串的排列，可以看成两步。第一步求所有可能出现在第一个位置的字符，即把第一个字符和后面所有的字符交换。第二步固定第一个字符，求后面所有字符的排列。这时候我们仍然把后面的所有字符分为两部分：后面字符的第一个字符，以及这个字符之后的所有字符。然后把第一个字符逐一和它后面的字符交换。这就是典型的递归思路。  

此题同[LC-46-Permutations](/leetcode/leetcode41-50/#46-permutations)

```java
private void permutation(String str) {
    if (str == null) {
        return;
    }

    permutationInner(str.toCharArray(), 0);
}

private void permutationInner(char[] str, int begin) {
    if (begin == str.length - 1) {
        System.out.println(str);
    } else {
        for (int i = begin; i < str.length; i++) {
            // TODO swap method
            char temp = str[begin];
            str[begin] = str[i];
            str[i] = temp;

            permutationInner(str, begin + 1);

            // TODO swap method
            temp = str[begin];
            str[begin] = str[i];
            str[i] = temp;
        }
    }
}
```

!!! info "本题扩展"
    如果不是求字符的所有排列，而是求字符的所有组合，应该怎么办呢？  
    <cite>还是输入个字符a、b、c，则它们的组合有a、b、c、ab、ac、bc、abc。当交换字符串中的两个字符时，虽然能得到两个不同的排列，但却是同一个组合。比如ab和ba是不同的排列，但只算一个组合。  
    如果输入n个字符，则这n个字符能构成长度为1,2,...,n的组合。在求n个字符的长度为m（1≤m≤n）的组合的时候，我们把这n个字符分成两部分:第一个字符和其余的所有字符。如果组合里包含第一个字符，则下一步在剩余的字符里选取m-1个字符；如果组合里不包含第一个字符，则下一步在剩余的n-1个符里选取m个字符。也就是说，我们可以把求n个字符组成长度为m的组合的问题分解成两个子问题，分别求n-1个字符中长度为m-1的组合，以及求n-1个字符中长度为m的组合。这两个子问题都可以用递归的方式解决。</cite>

!!! info "相关题目"
    输入一个含有8个数字的数组，判断有没有可能把这8个数字分别放到正方体的8个顶点上，使得正方体上三组相对的面上的4个顶点的和都相等。  
    *这相当于先得到a1到a8这8个数字的所有排列，然后判断有没有某一个排列符合题目给定的条件，即a1+a2+a3+a4=a5+a6+a7+a8, a1+a3+a5+a7=a2+a4+a6+a8, a1+a2+a5+a6=a3+a4+a7+a8*  
    ![把8个数字放到正方体的8个顶点上](/assets/images/leetcode/ci_38_expand.png)  
    <center>把8个数字放到正方体的8个顶点上</center>

!!! info "相关题目"
    在8x8的国际象棋上摆放8个皇后，使其不能相互攻击，即任意两个皇后不得处在同一行、同一列或者同一条对角线上。图中的每个黑色格子表示一个皇后，这就是一种符合条件的摆放方法。请问总共有多少种符合条件的摆法？   
    *由于8个皇后的任意两个不能处在同一行，那么肯定是每一个皇后占据一行。于是我们可以定义一个数组ColumnIndex\[8\]，数组中第i个数字表示位于第i行的皇后的列号。先把数组ColumnIndex的8个数字分别用0~7初始化，然后对数组ColumnIndex进行全排列。因为我们用不同的数字初始化数组，所以任意两个皇后肯定不同列。只需判断每一个排列对应的8个皇后是不是在同一条对角线上，也就是对于数组的两个下标i和j，是否有i-j=ColumnIndex\[i\]-ColumnIndex\[j\]或者j-i=ColumnIndex\[i\]-ColumnIndex\[i\]*  
    ![8皇后问题](/assets/images/leetcode/ci_38_expand2.png)  
    <center>8皇后问题</center>

!!! info "举一反三"
    如果题目是按照一定要求摆放若干个数字，则可以先求出这些数字的所有排列，然后一一判断每个排列是不是满足题目的要求。