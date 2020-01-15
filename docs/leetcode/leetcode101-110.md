---
title: "LeetCode(101-110)"
---

## 101. Symmetric Tree

- Tree 
- Depth-first Search 
- Breadth-first Search 

> Given a binary tree, check whether it is a mirror of itself (ie, symmetric around its center).
> 
> For example, this binary tree `[1,2,2,3,4,4,3]` is symmetric:
> 
> <img src="/assets/images/leetcode/question_101_example_1.png" style="border: none">
> 
> But the following `[1,2,2,null,3,null,3]` is not:
> 
> <img src="/assets/images/leetcode/question_101_example_2.png" style="border: none">

**Note:**
Bonus points if you could solve it both recursively and iteratively.

此题同[CI-(28)对称的二叉树](/leetcode/code_interviews_4/#12-28)

**Solution**  

Runtime 0 ms

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
    public boolean isSymmetric(TreeNode root) {
        if (root == null) return true;
        
        return isSymmetric(root.left, root.right);
    }
    
    public boolean isSymmetric(TreeNode p, TreeNode q) {
        if (p == null && q == null) return true;
        if (p == null || q == null) return false;
        
        if (p.val != q.val) return false;
        
        return isSymmetric(p.left, q.right) && isSymmetric(p.right, q.left);
    }
}
```

## 102. Binary Tree Level Order Traversal

- Tree 
- Breadth-first Search 

> Given a binary tree, return the *level* order traversal of its nodes' values. (ie, from left to right, level by level).
> 
> For example:
> Given binary tree `[3,9,20,null,null,15,7]`,
> 
> <img src="/assets/images/leetcode/question_102_example.png" style="border: none">
> 
> return its level order traversal as:
> 
> [  
> &nbsp;&nbsp;&nbsp;&nbsp;[3],  
> &nbsp;&nbsp;&nbsp;&nbsp;[9,20],  
> &nbsp;&nbsp;&nbsp;&nbsp;[15,7]  
> ]

此题同[CI-32(2)-分行从上到下打印二叉树](/leetcode/code_interviews_4/#232)

**Solution**  

Runtime 1 ms

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
    public List<List<Integer>> levelOrder(TreeNode root) {
        List<List<Integer>> result = new ArrayList<>();
        if (root == null) return result;
        
        List<Integer> level = new ArrayList<>();
        Queue<TreeNode> queue = new LinkedList<>();
        
        queue.offer(root);
        int nextLevel = 0, current = 1;
        
        while (!queue.isEmpty()) {
            TreeNode node = queue.poll();
            
            if (node.left != null) {
                queue.offer(node.left);
                nextLevel++;
            }
            if (node.right != null) {
                queue.offer(node.right);
                nextLevel++;
            }
            
            level.add(node.val);
            if (--current == 0) {
                current = nextLevel;
                nextLevel = 0;
                result.add(new ArrayList<>(level));
                level.clear();
            }
        }
        
        return result;
    }
}
```

## 103. Binary Tree Zigzag Level Order Traversal

- Stack 
- Tree 
- Breadth-first Search 

> Given a binary tree, return the *zigzag level order* traversal of its nodes' values. (ie, from left to right, then right to left for the next level and alternate between).
> 
> For example:
> Given binary tree `[3,9,20,null,null,15,7]`,
> 
> <img src="/assets/images/leetcode/question_102_example.png" style="border: none">
> 
> return its level order traversal as:
> 
> [  
> &nbsp;&nbsp;&nbsp;&nbsp;[3],  
> &nbsp;&nbsp;&nbsp;&nbsp;[20,9],  
> &nbsp;&nbsp;&nbsp;&nbsp;[15,7]  
> ]

此题同[CI-32(3)-之字形打印二叉树](/leetcode/code_interviews_4/#233)

**Solution**  

按之字形顺序打印二叉树需要两个栈。我们在打印某一层节点时，把下一层的子节点保存在对应的栈中。如果当前打印的是奇数层，则先保存左子节点再保存右子节点到第一个栈里；如果当前打印的是偶数层，则先保存右子节点再保存左子节点到第二个栈里。

Runtime 1 ms

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
    public List<List<Integer>> zigzagLevelOrder(TreeNode root) {
        List<List<Integer>> result = new ArrayList<>();
        if (root == null) return result;
        
        List<Integer> level = new ArrayList<>();
        Stack<TreeNode>[] stack = new Stack[2];
        stack[0] = new Stack<>();
        stack[1] = new Stack<>();
        
        int index = 0;
        stack[index].push(root);
        
        while (!stack[index].isEmpty()) {
            TreeNode node = stack[index].pop();
            
            if (index == 0) {
                if (node.left != null) {
                    stack[1 - index].push(node.left);
                }
                if (node.right != null) {
                    stack[1 - index].push(node.right);
                }
            } else {
                if (node.right != null) {
                    stack[1 - index].push(node.right);
                }
                if (node.left != null) {
                    stack[1 - index].push(node.left);
                }
            }
            
            level.add(node.val);
            if (stack[index].isEmpty()) {
                index = 1 - index;
                result.add(new ArrayList<>(level));
                level.clear();
            }
        }
        
        return result;
    }
}
```

## 104. Maximum Depth of Binary Tree

- Tree 
- Depth-first Search 

> Given a binary tree, find its maximum depth.
> 
> The maximum depth is the number of nodes along the longest path from the root node down to the farthest leaf node.

**Note:** A leaf is a node with no children.

**Example:**  

> Given binary tree `[3,9,20,null,null,15,7]`,
> 
> <img src="/assets/images/leetcode/question_104_example.png" style="border: none">
> 
> return its depth = 3.

此题同[CI-55(1)-二叉树的深度](/leetcode/code_interviews_6/#31)

**Solution**  

Runtime 0 ms

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
    public int maxDepth(TreeNode root) {
        if (root == null) return 0;
        if (root.left == null && root.right == null) return 1;
        
        return Math.max(maxDepth(root.left), maxDepth(root.right)) + 1;
    }
}
```

## 105. Construct Binary Tree from Preorder and Inorder Traversal

- Tree 
- Depth-first Search 

> Given preorder and inorder traversal of a tree, construct the binary tree.
> 
> **Note:**  
> You may assume that duplicates do not exist in the tree.
> 
> For example, given
> 
> preorder = [3,9,20,15,7]  
> inorder = [9,3,15,20,7]
> 
> Return the following binary tree:
> 
> <img src="/assets/images/leetcode/question_104_example.png" style="border: none">


此题同[CI-7-重建二叉树](/leetcode/code_interviews_1/#41-7)

**Solution**  

算法思路是先根据前序序列找到根节点，然后在中序序列中找到该节点，其左边的就是树的左子树，右边就是右子树。由于每次都需要在中序中查找节点，所以这里采用了一个Map保存中序的值-索引，这样是一种空间换时间的解法。

Runtime 2 ms, faster than 96.74%. Memory Usage 39.8 MB, less than 14.34%.

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
    public TreeNode buildTree(int[] preorder, int[] inorder) {
        Map<Integer, Integer> inMap = new HashMap<>(inorder.length);
        
        for (int i = 0; i < inorder.length; i++) {
            inMap.put(inorder[i], i);
        }
        
        return buildTreeRecursion(
            preorder, 0, preorder.length - 1,
            inMap, 0, inorder.length - 1
        );
    }
    
    private TreeNode buildTreeRecursion(int[] preorder, int preStart, int preEnd, Map<Integer, Integer> inMap, int inStart, int inEnd) {
        if (preStart > preEnd || inStart > inEnd) return null;
        
        TreeNode root = new TreeNode(preorder[preStart]);
        if (preStart == preEnd && inStart == inEnd) return root;
        
        int i = inMap.get(root.val);
        
        root.left = buildTreeRecursion(
            preorder, preStart + 1, preStart + i - inStart,
            inMap, inStart, i - 1
        );
        root.right = buildTreeRecursion(
            preorder, preStart + i - inStart + 1, preEnd,
            inMap, i + 1, inEnd
        );
        
        return root;
    }
}
```

## 106. Construct Binary Tree from Inorder and Postorder Traversal

- Tree 
- Depth-first Search 

> Given inorder and postorder traversal of a tree, construct the binary tree.
> 
> **Note:**  
> You may assume that duplicates do not exist in the tree.
> 
> For example, given
> 
> inorder = [9,3,15,20,7]  
> postorder = [9,15,7,20,3]
> 
> 
> Return the following binary tree:
> 
> <img src="/assets/images/leetcode/question_104_example.png" style="border: none">

**Solution**  

算法思路是先根据后序序列中从后往前找到根节点，然后在中序序列中找到该节点，其左边的就是树的左子树，右边就是右子树。由于每次都需要在中序中查找节点，所以这里采用了一个Map保存中序的值-索引，这样是一种空间换时间的解法。

Runtime 2 ms, faster than 92.72%. Memory Usage 40.1 MB, less than 15.75%.

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
    public TreeNode buildTree(int[] inorder, int[] postorder) {
        Map<Integer, Integer> inMap = new HashMap<>(inorder.length);
        for (int i = 0; i < inorder.length; i++) {
            inMap.put(inorder[i], i);
        }
        
        return buildTree(
            inMap, 0, inorder.length - 1,
            postorder, 0, postorder.length - 1);
    }
    
    private TreeNode buildTree(Map<Integer, Integer> inMap, int inStart, int inEnd, int[] postorder, int postStart, int postEnd) {
        if (inStart > inEnd || postStart > postEnd) return null;
        
        TreeNode root = new TreeNode(postorder[postEnd]);
        
        if (inStart == inEnd && postStart == postEnd) return root;
        
        int i = inMap.get(root.val);
        root.left = buildTree(
            inMap, inStart, i - 1,
            postorder, postStart, postStart + i - inStart - 1);
        root.right = buildTree(
            inMap, i + 1, inEnd,
            postorder, postStart + i - inStart, postEnd - 1);
        return root;
    }
}
```

## 107. Binary Tree Level Order Traversal II

- Tree 
- Breadth-first Search 

> Given a binary tree, return the *bottom-up level order* traversal of its nodes' values. (ie, from left to right, level by level  from leaf to root).
> 
> For example:
> Given binary tree `[3,9,20,null,null,15,7]`,
> 
> <img src="/assets/images/leetcode/question_102_example.png" style="border: none">
> 
> 
> return its level order traversal as:
> 
> [  
> &nbsp;&nbsp;&nbsp;&nbsp;[15,7],  
> &nbsp;&nbsp;&nbsp;&nbsp;[9,20],  
> &nbsp;&nbsp;&nbsp;&nbsp;[3]  
> ]

**Solution**  

在[LC-102-Binary Tree Level Order Traversal](/leetcode/leetcode101-110/#102-binary-tree-level-order-traversal)的基础上，将每层的结果插入到链头即可。所以，结果采用LinkedList保存。

Runtime 1 ms

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
    public List<List<Integer>> levelOrderBottom(TreeNode root) {
        List<Integer> level = new ArrayList<>();
        List<List<Integer>> result = new LinkedList<>();
        Queue<TreeNode> queue = new LinkedList<>();
        
        if (root == null) return result;
        
        int current = 1, nextLevel = 0;
        queue.offer(root);
        
        while (!queue.isEmpty()) {
            TreeNode node = queue.poll();
            
            if (node.left != null) {
                queue.offer(node.left);
                nextLevel++;
            }
            if (node.right != null) {
                queue.offer(node.right);
                nextLevel++;
            }
            
            level.add(node.val);
            if (--current == 0) {
                current = nextLevel;
                nextLevel = 0;
                result.add(0, new ArrayList<>(level));
                level.clear();
            }
        }
        
        return result;
    }
}
```

## 108. Convert Sorted Array to Binary Search Tree

- Tree 
- Depth-first Search 

> Given an array where elements are sorted in ascending order, convert it to a height balanced BST.
> 
> For this problem, a height-balanced binary tree is defined as a binary tree in which the depth of the two subtrees of every node never differ by more than 1.

**Example:**

> Given the sorted array: [-10,-3,0,5,9],  
> One possible answer is: [0,-3,9,-10,null,5], which represents the following height balanced BST:  
> <img src="/assets/images/leetcode/question_108_example.png" style="border: none">

**Solution**  

该题比较简单，需要注意的是，要按照实例给的规律来生成平衡的二叉搜索树。

Runtime 1 ms

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
    public TreeNode sortedArrayToBST(int[] nums) {
        if (nums == null || nums.length == 0) return null;
        
        return buildTree(nums, 0, nums.length - 1);
    }
    
    private TreeNode buildTree(int[] nums, int start, int end) {
        if (start > end) return null;
        
        int mid = start + ((end - start + 1) >>> 1);
        TreeNode root = new TreeNode(nums[mid]);
        
        root.left = buildTree(nums, start, mid - 1);
        root.right = buildTree(nums, mid + 1, end);
        
        return root;
    }
}
```

## 109. Convert Sorted List to Binary Search Tree

- Linked List 
- Depth-first Search 

> Given a singly linked list where elements are sorted in ascending order, convert it to a height balanced BST.
> 
> For this problem, a height-balanced binary tree is defined as a binary tree in which the depth of the two subtrees of every node never differ by more than 1.

**Example:**

> Given the sorted array: [-10,-3,0,5,9],  
> One possible answer is: [0,-3,9,-10,null,5], which represents the following height balanced BST:  
> <img src="/assets/images/leetcode/question_108_example.png" style="border: none">

**Solution**  

可以先将链表转换为一个数组，然后用上一题的解法——将不熟悉的东西转化为熟悉的东西。  
然而，这么做肯定不是此题的本意。此题的要点就是在一个区间内找到中间的节点，然后递归，所以可以使用双指针的思路。一个慢指针，每次走一步；一个快指针，每次都两步。当快指针走完后，慢指针就在中间位置了。

Runtime 1 ms

```java
/**
 * Definition for singly-linked list.
 * public class ListNode {
 *     int val;
 *     ListNode next;
 *     ListNode(int x) { val = x; }
 * }
 */
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
    public TreeNode sortedListToBST(ListNode head) {
        if (head == null) return null;
        
        List<Integer> nums = new ArrayList<>();
        while (head != null) {
            nums.add(head.val);
            head = head.next;
        }
        
        return buildTree(nums, 0, nums.size() - 1);
    }
    
    private TreeNode buildTree(List<Integer> nums, int start, int end) {
        if (start > end) return null;
        
        int mid = start + ((end - start + 1) >>> 1);
        TreeNode root = new TreeNode(nums.get(mid));
        
        if (start == mid - 1) {
            root.left = new TreeNode(nums.get(start));
        } else {
            root.left = buildTree(nums, start, mid - 1);
        }
        if (mid + 1 == end) {
            root.right = new TreeNode(nums.get(end));
        } else {
            root.right = buildTree(nums, mid + 1, end);
        }
        
        return root;
    }
}
```

## 110. Balanced Binary Tree

- Tree 
- Depth-first Search 

> Given a binary tree, determine if it is height-balanced.
> 
> For this problem, a height-balanced binary tree is defined as a binary tree in which the depth of the two subtrees of *every* node never differ by more than 1.

**Example 1:**

> Given the following tree `[3,9,20,null,null,15,7]`:
>  
> <img src="/assets/images/leetcode/question_102_example.png" style="border: none">
> 
> return true.

**Example 2:**  

> Given the following tree `[1,2,2,3,3,null,null,4,4]`:
>  
> <img src="/assets/images/leetcode/question_110_example.png" style="border: none">
> 
> return false.

此题同[CI-55(2)-平衡二叉树](/leetcode/code_interviews_6/#32)

**Solution**  

自底向上的递归解法。

Runtime 1 ms

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
    public boolean isBalanced(TreeNode root) {
        return depth(root) != -1;
    }
    
    private int depth(TreeNode root) {
        if (root == null) return 0;
        
        int left = depth(root.left);
        if (left == -1) return left;
        
        int right = depth(root.right);
        if (right == -1) return right;

        if (Math.abs(left - right) <= 1) {
            return Math.max(left, right) + 1;
        } else {
            return -1;
        }
    }
}
```