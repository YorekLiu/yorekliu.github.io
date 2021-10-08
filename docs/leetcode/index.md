---
title: "算法目录"
---

!!! tip
    剑指Offer(Code Interviews)简写CI  
    LeetCode简写LC  

建议初刷者先跟着《剑指Offer》把算法的整体脉络梳理一遍，掌握各种题目的常用解题 **套路**，做到整体思路的把控，形成自己的知识网络。后面再刷 LeetCode 就事半功倍了。

## 剑指Offer 第二版

| Question | Comment | topic |
| -------- | ------- | ----- |
| [(3)数组中重复的数字](/leetcode/code_interviews_1/#11-3) | [LC-41-First Missing Positive](/leetcode/leetcode41-50/#41-first-missing-positive) | Array |
| [(4)二维数组中的查找](/leetcode/code_interviews_1/#12-4) | [LC-74-Search a 2D Matrix](/leetcode/leetcode71-80/#74-search-a-2d-matrix)<br />选取左下角或右上角这种中间位置的数字开始，每次判断可以剔除一行或一列 | Array |
| [(5)替换空格](/leetcode/code_interviews_1/#21-5) | 统计空格个数确定新串长度，创建新串，开始复制 | String |
| [(6)从尾到头打印链表](/leetcode/code_interviews_1/#31-6) | 栈或递归 | Linked List |
| [(7)重建二叉树](/leetcode/code_interviews_1/#41-7) | [LC-105-Construct Binary Tree from Preorder and Inorder Traversal](/leetcode/leetcode101-110/#105-construct-binary-tree-from-preorder-and-inorder-traversal)<br />先在前序序列找到根节点，然后在中序序列中找到该节点，左边就是左子树，右边就是右子树 | Tree |
| [(8)二叉树的下一个节点](/leetcode/code_interviews_1/#42-8) |  | Tree |
| [(9)用两个栈实现队列](/leetcode/code_interviews_1/#51-9) | 相关题目：两个队列实现一个栈 | Stack Queue |
| [(10)斐波那契数列](/leetcode/code_interviews_1/#611-10) | 相关题目：青蛙跳台阶问题、矩形填充问题 | Recursion |
| [(11)旋转数组的最小数字](/leetcode/code_interviews_1/#621-11) | [LC-81-Search in Rotated Sorted Array II](/leetcode/leetcode81-90/#81-search-in-rotated-sorted-array-ii)<br />先二分查找，当lo=mid=hi时，需要进行顺序查找 | Binary Search |
| [(12)矩阵中的路径](/leetcode/code_interviews_1/#631-12) | [LC-79-Word Search](/leetcode/leetcode71-80/#79-word-search) | Backtracking |
| [(13)机器人的运动范围](/leetcode/code_interviews_1/#632-13) |  | Backtracking |
| [(14)剪绳子](/leetcode/code_interviews_1/#641-14) | Greedy：当n>=5时，我们尽可能多地剪长度为3的绳子；当剩下的绳子长度为4时，把绳子剪成两段长度为2的绳子 | Dynamic Programming Greedy |
| [(15)二进制中1的个数](/leetcode/code_interviews_1/#651-151) | **把一个整数减去1，再和原整数做位与运算，会把该整数最右边的1变成0**<br />相关题目：用一条语句判断一个整数是不是2的整数次方<br />相关题目：输入两个整数m和n，计算需要改变m的二进制表示中的多少位才能得到n | Bit Manipulation |
| [(16)数值的整数次方](/leetcode/code_interviews_3/#11-16) | [LC-50-Pow(x, n)](/leetcode/leetcode41-50/#50-powx-n) |  |
| [(17)打印1到最大的n位数](/leetcode/code_interviews_3/#12-171n) | 大数问题，可以使用全排列的思路 |  |
| [(18)删除链表的节点](/leetcode/code_interviews_3/#13-18) | $O(1)$ 时间内删除一个节点，可以采取复制节点值的方法<br />第二小题同[LC-82-Remove Duplicates from Sorted List II](/leetcode/leetcode81-90/#82-remove-duplicates-from-sorted-list-ii) | Linked List |
| [(19)正则表达式匹配](/leetcode/code_interviews_3/#14-19) | 字符‘.’表示任意一个字符，而‘*’表示它前面的字符可以出现任意次（含0次）<br />[LC-10-Regular Expression Matching](/leetcode/leetcode1-10/#10-regular-expression-matching) | Recursion |
| [(20)表示数值的字符串](/leetcode/code_interviews_3/#15-20) | [LC-65-Valid Number](/leetcode/leetcode61-70/#65-valid-number) |  |
| [(21)调整数组顺序使奇数位于偶数前面](/leetcode/code_interviews_3/#16-21) |  | Two Pointer |
| [(22)链表中倒数第k个结点](/leetcode/code_interviews_3/#21-22k) | [LC-19-Remove Nth Node From End of List](/leetcode/leetcode11-20/#19-remove-nth-node-from-end-of-list)<br />相关题目：求链表的中间节点。如果链表为奇数，返回中间节点；如果是偶数，则返回中间两个的任意一个。<br />举一反三：两个指针遍历链表 | Linked List |
| [(23)链表中环的入口结点](/leetcode/code_interviews_3/#22-23) | 使用两个指针 | Linked List |
| [(24)反转链表](/leetcode/code_interviews_3/#23-24) | 本题扩展：使用递归实现 | Linked List |
| [(25)合并两个排序的链表](/leetcode/code_interviews_3/#24-25) | [LC-21-Merge Two Sorted Lists](/leetcode/leetcode21-30/#21-merge-two-sorted-lists)<br />注意操作列表最好不要直接操作入参列表，所以合并的时候会创建一些节点 | Linked List |
| [(26)树的子结构](/leetcode/code_interviews_3/#25-26) | | Tree Recursion |
| [(27)二叉树的镜像](/leetcode/code_interviews_4/#11-27) | 交换左右子节点，并对左右子节点进行递归 | Tree Recursion |
| [(28)对称的二叉树](/leetcode/code_interviews_4/#12-28) | [LC-101-Symmetric Tree](/leetcode/leetcode101-110/#101-symmetric-tree)<br />先比较根节点，然后递归比较左子树的左节点与右子树的右节点、左子树的右节点与右子树的子节点 | Tree Recursion |
| [(29)顺时针打印矩阵](/leetcode/code_interviews_4/#13-29) | [LC-54-Spiral Matrix](/leetcode/leetcode51-60/#54-spiral-matrix)<br />注意边界条件的判断 | Array |
| [(30)包含min函数的栈](/leetcode/code_interviews_4/#21-30min) | 额外使用一个辅助栈，栈中同步保存每次进栈操作时栈中最小值 | Stack |
| [(31)栈的压入、弹出序列](/leetcode/code_interviews_4/#22-31) | 使用辅助栈 | Stack |
| [(32)从上到下打印二叉树](/leetcode/code_interviews_4/#23-32) | (2)[LC-102-Binary Tree Level Order Traversal](/leetcode/leetcode101-110/#102-binary-tree-level-order-traversal)<br />(3)[LC-103-Binary Tree Zigzag Level Order Traversal](/leetcode/leetcode101-110/#103-binary-tree-zigzag-level-order-traversal) | Tree |
| [(33)二叉搜索树的后序遍历序列](/leetcode/code_interviews_4/#24-33) | 二叉搜索树的特征、后序遍历序列特征<br />相关题目：输入一个整数数组，判断该数组是不是某二叉搜索树的前序遍历结果<br /> | Tree |
| [(34)二叉树中和为某一值的路径](/leetcode/code_interviews_4/#25-34) |  | Tree  Recursion |
| [(35)复杂链表的复制](/leetcode/code_interviews_4/#31-35) |  | Linked List |
| [(36)二叉搜索树与双向链表](/leetcode/code_interviews_4/#32-36) |  | Tree |
| [(37)序列化二叉树](/leetcode/code_interviews_4/#33-37) |  | Tree |
| [(38)字符串的排列](/leetcode/code_interviews_4/#34-38) | 全排列问题<br />[LC-46-Permutations](/leetcode/leetcode41-50/#46-permutations)<br />相关题目：[LC-51-N-Queens](/leetcode/leetcode51-60/#51-n-queens)、[LC-52-N-Queens II](/leetcode/leetcode51-60/#52-n-queens-ii) | Backtracking |
| [(39)数组中出现次数超过一半的数字](/leetcode/code_interviews_5/#11-39) | 利用快排思想求数组的中位数<br />利用数组的特点 | Array |
| [(40)最小的k个数](/leetcode/code_interviews_5/#12-40k) | 利用快排思想<br />直接利用最小堆<br />利用容量为k的最大堆，堆满后保存堆顶和值的较小者，这样每次都会挤出最大堆中最大值，而保留较小值 | Heap |
| [(41)数据流中的中位数](/leetcode/code_interviews_5/#13-41) | 使用最大堆和最小堆，中位数在最大堆和最小堆的堆顶中取得 | Heap |
| [(42)连续子数组的最大和](/leetcode/code_interviews_5/#14-42) | [LC-53-Maximum Subarray](/leetcode/leetcode51-60/#53-maximum-subarray)<br />如果某步累加的结果不是正数，那么这些累加是可以抛弃的；否则可正常进行累加 | Array Dynamic Programming |
| [(43)从1到n整数中1出现的次数](/leetcode/code_interviews_5/#15-431n1) |  | Dynamic Programming |
| [(44)数字序列中某一位的数字](/leetcode/code_interviews_5/#16-44) |  |  |
| [(45)把数组排成最小的数](/leetcode/code_interviews_5/#17-45) |  |  |
| [(46)把数字翻译成字符串](/leetcode/code_interviews_5/#18-46) |  | Recursion |
| [(47)礼物的最大价值](/leetcode/code_interviews_5/#19-47) | [LC-64-Minimum Path Sum](/leetcode/leetcode61-70/#64-minimum-path-sum) | Dynamic Programming |
| [(48)最长不含重复字符的子字符串](/leetcode/code_interviews_5/#110-48) | [LC-3-Longest Substring Without Repeating Characters](/leetcode/leetcode1-10/#3-longest-substring-without-repeating-characters) | Set |
| [(49)丑数](/leetcode/code_interviews_5/#21-49) | 根据丑数的定义，丑数应该是另一个丑数乘以2、3或者5的结果。 |  |
| [(50)第一个只出现一次的字符](/leetcode/code_interviews_5/#22-50) | 基于字符的ASCII码创建一个简单的哈希表数组 | Hash Table |
| [(51)数组中的逆序对](/leetcode/code_interviews_5/#23-51) |  | Merge Sort |
| [(52)两个链表的第一个公共节点](/leetcode/code_interviews_5/#24-52) | 两个指针，先在长链表上走上差值的步数，最后两个指针一起走 | Linked List |
| [(53)在排序数组中查找数字](/leetcode/code_interviews_6/#1-53) |  | Binary Search |
| [(54)二叉搜索树的第k个结点](/leetcode/code_interviews_6/#2-54k) | 树的中序遍历算法 | Tree |
| [(55)二叉树的深度](/leetcode/code_interviews_6/#3-55) | (1)[LC-104-Maximum Depth of Binary Tree](/leetcode/leetcode101-110/#104-maximum-depth-of-binary-tree)<br />(2)[LC-110-Balanced Binary Tree](/leetcode/leetcode101-110/#110-balanced-binary-tree)<br />判断是不是平衡二叉树可以采用后序遍历算法 | Tree<br />Recursion |
| [(56)数组中数字出现的次数](/leetcode/code_interviews_6/#4-56) | 任何一个数字异或它自己都等于0 | Bit Manipulation |
| [(57)和为s的数字](/leetcode/code_interviews_6/#5-57s) |  | Array |
| [(58)翻转字符串](/leetcode/code_interviews_6/#6-58) | 多次不同范围的翻转可以解决问题 | String |
| [(59)队列的最大值](/leetcode/code_interviews_6/#7-59) |  | Queue Deque |
| [(60)n个骰子的点数](/leetcode/code_interviews_6/#8-60n) |  |  |
| [(61)扑克牌的顺子](/leetcode/code_interviews_6/#9-61) |  |  |
| [(62)圆圈中最后剩下的数字](/leetcode/code_interviews_6/#10-62) | 数学解法：$f(n,m)=\begin{cases} 0 & n=1 \\ [f(n-1,m)+m]\%n & n>1 \end{cases}$ | Linked List |
| [(63)股票的最大利润](/leetcode/code_interviews_6/#11-63) | 保存目前数据中最小的数，用当前的数减去最小数得到当前利润，取当前利润和之前最大利润的最大值即可 |  |
| [(64)求1+2+…+n](/leetcode/code_interviews_6/#12-6412n) |  |  |
| [(65)不用加减乘除做加法](/leetcode/code_interviews_6/#13-65) | CPU加法器的实现：使用位运算<br />相关问题，交换两个变量的值：<br />1. a = a + b; b = a - b; a = a - b;<br />2. a = a ^ b; b = a ^ b; a = a ^ b; | Bit Manipulation |
| [(66)构建乘积数组](/leetcode/code_interviews_6/#14-66) |  |  |
| [(67)把字符串转换成整数](/leetcode/code_interviews_6/#15-67) | [LC-8-String to Integer (atoi)](/leetcode/leetcode1-10/#8-string-to-integer-atoi) | String |
| [(68)树中两个结点的最低公共祖先](/leetcode/code_interviews_6/#16-68) | 先求路径，然后在求最低公共祖先 | Tree |


## LeetCode

| Question | Comment | topic |
| -------- | ------- | ----- |
| [1. Two Sum](/leetcode/leetcode1-10/#1-two-sum) | 利用HashTable的性质 | Array  Hash Table |
| [2. Add Two Numbers](/leetcode/leetcode1-10/#2-add-two-numbers) |  | Linked List |
| [3. Longest Substring Without Repeating Characters](/leetcode/leetcode1-10/#3-longest-substring-without-repeating-characters) | [CI-(48)最长不含重复字符的子字符串](/leetcode/code_interviews_5/#110-48%E6%9C%80%E9%95%BF%E4%B8%8D%E5%90%AB%E9%87%8D%E5%A4%8D%E5%AD%97%E7%AC%A6%E7%9A%84%E5%AD%90%E5%AD%97%E7%AC%A6%E4%B8%B2) | String [Set |
| [4. Median of Two Sorted Arrays](/leetcode/leetcode1-10/#4-median-of-two-sorted-arrays) | 题目要求要$O(log(m+n))$的时间复杂度，所以只能二分递归查找 | Binary Search Divide and Conquer |
| [5. Longest Palindromic Substring](/leetcode/leetcode1-10/#5-longest-palindromic-substring) | 需要以i为end点，以max为标准进行扩展，判断max+1或max+2长度的字符串是不是回数 | String |
| [6. ZigZag Conversion](/leetcode/leetcode1-10/#6-zigzag-conversion) | 定义row个StringBuilder，遇到第0行或倒数第1行掉头，按顺序取字符即可 | String |
| [7. Reverse Integer](/leetcode/leetcode1-10/#7-reverse-integer) | 先处理无符号int，用long保存临时结果，每次累加后判断是不是溢出，最后加上符号 |  |
| [8. String to Integer (atoi)](/leetcode/leetcode1-10/#8-string-to-integer-atoi) | 先`trim()`清除头尾的空白字符串，然后判断第一位是不是符号位，然后在当前位是数字的情况下进行累加，每次累加完成后判断有没有溢出 | String |
| [9. Palindrome Number](/leetcode/leetcode1-10/#9-palindrome-number) |  |  |
| [10. Regular Expression Matching](/leetcode/leetcode1-10/#10-regular-expression-matching) |  |  |
| [11. Container With Most Water](/leetcode/leetcode11-20/#11-container-with-most-water) |  |  |
| [12. Integer to Roman](/leetcode/leetcode11-20/#12-integer-to-roman) |  |  |
| [13. Roman to Integer](/leetcode/leetcode11-20/#13-roman-to-integer) |  |  |
| [14. Longest Common Prefix](/leetcode/leetcode11-20/#14-longest-common-prefix) |  |  |
| [15. 3Sum](/leetcode/leetcode11-20/#15-3sum) |  |  |
| [16. 3Sum Closest](/leetcode/leetcode11-20/#16-3sum-closest) |  |  |
| [17. Letter Combinations of a Phone Number](/leetcode/leetcode11-20/#17-letter-combinations-of-a-phone-number) |  |  |
| [18. 4Sum](/leetcode/leetcode11-20/#18-4sum) |  |  |
| [19. Remove Nth Node From End of List](/leetcode/leetcode11-20/#19-remove-nth-node-from-end-of-list) |  |  |
| [20. Valid Parentheses](/leetcode/leetcode11-20/#20-valid-parentheses) |  |  |
| [21. Merge Two Sorted Lists](/leetcode/leetcode21-30/#21-merge-two-sorted-lists) |  |  |
| [22. Generate Parentheses](/leetcode/leetcode21-30/#22-generate-parentheses) |  |  |
| [23. Merge k Sorted Lists](/leetcode/leetcode21-30/#23-merge-k-sorted-lists) |  |  |
| [24. Swap Nodes in Pairs](/leetcode/leetcode21-30/#24-swap-nodes-in-pairs) |  |  |
| [25. Reverse Nodes in k-Group](/leetcode/leetcode21-30/#25-reverse-nodes-in-k-group) |  |  |
| [26. Remove Duplicates from Sorted Array](/leetcode/leetcode21-30/#26-remove-duplicates-from-sorted-array) |  |  |
| [27. Remove Element](/leetcode/leetcode21-30/#27-remove-element) |  |  |
| [28. Implement strStr()](/leetcode/leetcode21-30/#28-implement-strstr) |  |  |
| [29. Divide Two Integers](/leetcode/leetcode21-30/#29-divide-two-integers) |  |  |
| [30. Substring with Concatenation of All Words](/leetcode/leetcode21-30/#30-substring-with-concatenation-of-all-words) |  |  |
| [31. Next Permutation](/leetcode/leetcode31-40/#31-next-permutation) |  |  |
| [32. Longest Valid Parentheses](/leetcode/leetcode31-40/#32-longest-valid-parentheses) |  |  |
| [33. Search in Rotated Sorted Array](/leetcode/leetcode31-40/#33-search-in-rotated-sorted-array) |  |  |
| [34. Find First and Last Position of Element in Sorted Array](/leetcode/leetcode31-40/#34-find-first-and-last-position-of-element-in-sorted-array) |  |  |
| [35. Search Insert Position](/leetcode/leetcode31-40/#35-search-insert-position) |  |  |
| [36. Valid Sudoku](/leetcode/leetcode31-40/#36-valid-sudoku) |  |  |
| [37. Sudoku Solver](/leetcode/leetcode31-40/#37-sudoku-solver) |  |  |
| [38. Count and Say](/leetcode/leetcode31-40/#38-count-and-say) |  |  |
| [39. Combination Sum](/leetcode/leetcode31-40/#39-combination-sum) |  |  |
| [40. Combination Sum II](/leetcode/leetcode31-40/#40-combination-sum-ii) |  |  |
| [41. First Missing Positive](/leetcode/leetcode41-50/#41-first-missing-positive) |  |  |
| [42. Trapping Rain Water](/leetcode/leetcode41-50/#42-trapping-rain-water) |  |  |
| [43. Multiply Strings](/leetcode/leetcode41-50/#43-multiply-strings) |  |  |
| [44. Wildcard Matching](/leetcode/leetcode41-50/#44-wildcard-matching) |  |  |
| [45. Jump Game II](/leetcode/leetcode41-50/#45-jump-game-ii) |  |  |
| [46. Permutations](/leetcode/leetcode41-50/#46-permutations) |  |  |
| [47. Permutations II](/leetcode/leetcode41-50/#47-permutations-ii) |  |  |
| [48. Rotate Image](/leetcode/leetcode41-50/#48-rotate-image) |  |  |
| [49. Group Anagrams](/leetcode/leetcode41-50/#49-group-anagrams) |  |  |
| [50. Pow(x, n)](/leetcode/leetcode41-50/#50-powx-n) |  |  |
| [51. N-Queens](/leetcode/leetcode51-60/#51-n-queens) |  |  |
| [52. N-Queens II](/leetcode/leetcode51-60/#52-n-queens-ii) |  |  |
| [53. Maximum Subarray](/leetcode/leetcode51-60/#53-maximum-subarray) |  |  |
| [54. Spiral Matrix](/leetcode/leetcode51-60/#54-spiral-matrix) |  |  |
| [55. Jump Game](/leetcode/leetcode51-60/#55-jump-game) |  |  |
| [56. Merge Intervals](/leetcode/leetcode51-60/#56-merge-intervals) |  |  |
| [57. Insert Interval](/leetcode/leetcode51-60/#57-insert-interval) |  |  |
| [58. Length of Last Word](/leetcode/leetcode51-60/#58-length-of-last-word) |  |  |
| [59. Spiral Matrix II](/leetcode/leetcode51-60/#59-spiral-matrix-ii) |  |  |
| [60. Permutation Sequence](/leetcode/leetcode51-60/#60-permutation-sequence) |  |  |
| [61. Rotate List](/leetcode/leetcode61-70/#61-rotate-list) |  |  |
| [62. Unique Paths](/leetcode/leetcode61-70/#62-unique-paths) |  |  |
| [63. Unique Paths II](/leetcode/leetcode61-70/#63-unique-paths-ii) |  |  |
| [64. Minimum Path Sum](/leetcode/leetcode61-70/#64-minimum-path-sum) |  |  |
| [65. Valid Number](/leetcode/leetcode61-70/#65-valid-number) |  |  |
| [66. Plus One](/leetcode/leetcode61-70/#66-plus-one) |  |  |
| [67. Add Binary](/leetcode/leetcode61-70/#67-add-binary) |  |  |
| [68. Text Justification](/leetcode/leetcode61-70/#68-text-justification) |  |  |
| [69. Sqrt(x)](/leetcode/leetcode61-70/#69-sqrtx) |  |  |
| [70. Climbing Stairs](/leetcode/leetcode61-70/#70-climbing-stairs) |  |  |
| [71. Simplify Path](/leetcode/leetcode71-80/#71-simplify-path) |  |  |
| [72. Edit Distance](/leetcode/leetcode71-80/#72-edit-distance) |  |  |
| [73. Set Matrix Zeroes](/leetcode/leetcode71-80/#73-set-matrix-zeroes) |  |  |
| [74. Search a 2D Matrix](/leetcode/leetcode71-80/#74-search-a-2d-matrix) |  |  |
| [75. Sort Colors](/leetcode/leetcode71-80/#75-sort-colors) |  |  |
| [76. Minimum Window Substring](/leetcode/leetcode71-80/#76-minimum-window-substring) |  |  |
| [77. Combinations](/leetcode/leetcode71-80/#77-combinations) |  |  |
| [78. Subsets](/leetcode/leetcode71-80/#78-subsets) |  |  |
| [79. Word Search](/leetcode/leetcode71-80/#79-word-search) |  |  |
| [80. Remove Duplicates from Sorted Array II](/leetcode/leetcode71-80/#80-remove-duplicates-from-sorted-array-ii) |  |  |
| [81. Search in Rotated Sorted Array II](/leetcode/leetcode81-90/#81-search-in-rotated-sorted-array-ii) | [CI-(11)旋转数组的最小数字](/leetcode/code_interviews_1/#621-11) |  |
| [82. Remove Duplicates from Sorted List II](/leetcode/leetcode81-90/#82-remove-duplicates-from-sorted-list-ii) | [CI-18-2-删除链表中重复的结点](/leetcode/code_interviews_3/#132) |  |
| [83. Remove Duplicates from Sorted List](/leetcode/leetcode81-90/#83-remove-duplicates-from-sorted-list) |  |  |
| [84. Largest Rectangle in Histogram](/leetcode/leetcode81-90/#84-largest-rectangle-in-histogram) |  |  |
| [85. Maximal Rectangle](/leetcode/leetcode81-90/#85-maximal-rectangle) |  |  |
| [86. Partition List](/leetcode/leetcode81-90/#86-partition-list) |  |  |
| [87. Scramble String](/leetcode/leetcode81-90/#87-scramble-string) |  |  |
| [88. Merge Sorted Array](/leetcode/leetcode81-90/#88-merge-sorted-array) |  |  |
| [89. Gray Code](/leetcode/leetcode81-90/#89-gray-code) |  |  |
| [90. Subsets II](/leetcode/leetcode81-90/#90-subsets-ii) |  |  |
| [91. Decode Ways](/leetcode/leetcode91-100/#91-decode-ways) |  |  |
| [92. Reverse Linked List II](/leetcode/leetcode91-100/#92-reverse-linked-list-ii) |  |  |
| [93. Restore IP Addresses](/leetcode/leetcode91-100/#93-restore-ip-addresses) |  |  |
| [94. Binary Tree Inorder Traversal](/leetcode/leetcode91-100/#94-binary-tree-inorder-traversal) |  |  |
| [95. Unique Binary Search Trees II](/leetcode/leetcode91-100/#95-unique-binary-search-trees-ii) |  |  |
| [96. Unique Binary Search Trees](/leetcode/leetcode91-100/#96-unique-binary-search-trees) |  |  |
| [97. Interleaving String](/leetcode/leetcode91-100/#97-interleaving-string) |  |  |
| [98. Validate Binary Search Tree](/leetcode/leetcode91-100/#98-validate-binary-search-tree) |  |  |
| [99. Recover Binary Search Tree](/leetcode/leetcode91-100/#99-recover-binary-search-tree) |  |  |
| [100. Same Tree ](/leetcode/leetcode91-100/#100-same-tree) |  |  |
| [101. Symmetric Tree](/leetcode/leetcode101-110/#101-symmetric-tree) |  |  |
| [102. Binary Tree Level Order Traversal](/leetcode/leetcode101-110/#102-binary-tree-level-order-traversal) |  |  |
| [103. Binary Tree Zigzag Level Order Traversal](/leetcode/leetcode101-110/#103-binary-tree-zigzag-level-order-traversal) |  |  |
| [104. Maximum Depth of Binary Tree](/leetcode/leetcode101-110/#104-maximum-depth-of-binary-tree) |  |  |
| [105. Construct Binary Tree from Preorder and Inorder Traversal](/leetcode/leetcode101-110/#105-construct-binary-tree-from-preorder-and-inorder-traversal) |  |  |
| [106. Construct Binary Tree from Inorder and Postorder Traversal](/leetcode/leetcode101-110/#106-construct-binary-tree-from-inorder-and-postorder-traversal) |  |  |
| [107. Binary Tree Level Order Traversal II](/leetcode/leetcode101-110/#107-binary-tree-level-order-traversal-ii) |  |  |
| [108. Convert Sorted Array to Binary Search Tree](/leetcode/leetcode101-110/#108-convert-sorted-array-to-binary-search-tree) |  |  |
| [109. Convert Sorted List to Binary Search Tree](/leetcode/leetcode101-110/#109-convert-sorted-list-to-binary-search-tree) |  |  |
| [110. Balanced Binary Tree](/leetcode/leetcode101-110/#110-balanced-binary-tree) |  |  |
| [111. Minimum Depth of Binary Tree](/leetcode/leetcode111-120/#111-minimum-depth-of-binary-tree) |  |  |
| [112. Path Sum](/leetcode/leetcode111-120/#112-path-sum) |  |  |
| [113. Path Sum II](/leetcode/leetcode111-120/#113-path-sum-ii) |  |  |
| [114. Flatten Binary Tree to Linked List](/leetcode/leetcode111-120/#114-flatten-binary-tree-to-linked-list) |  |  |
| [115. Distinct Subsequences](/leetcode/leetcode111-120/#115-distinct-subsequences) |  |  |
| [116. Populating Next Right Pointers in Each Node](/leetcode/leetcode111-120/#116-populating-next-right-pointers-in-each-node) |  |  |
| [117. Populating Next Right Pointers in Each Node II](/leetcode/leetcode111-120/#117-populating-next-right-pointers-in-each-node-ii) |  |  |
| [118. Pascal’s Triangle](/leetcode/leetcode111-120/#118-pascals-triangle) |  |  |
| [119. Pascal’s Triangle II](/leetcode/leetcode111-120/#119-pascals-triangle-ii) |  |  |
| [120. Triangle](/leetcode/leetcode111-120/#120-triangle) |  |  |

## 常用技巧

### Java中的最大(小)堆

在Java中可以利用`PriorityQueue`实现最小堆、最大堆。注意类型需要实现`Comparable`接口或者在创建PriorityQueue时需要注入`Comparator`实现。  

```java
// 最小堆
PriorityQueue<Integer> minHeap = new PriorityQueue<Integer>();

// 最大堆
PriorityQueue<Integer> maxHeap = new PriorityQueue<Integer>(n, new Comparator<Integer>(){
    @Override
    public int compare(Integer o1, Integer o2) {
        return o2 - o1;
    }
});
// lambda实现
PriorityQueue<Integer> maxHeap = new PriorityQueue<Integer>(n, (o1, o2) -> o2 - o1);
```

### char ↔ int

- int i = ch;
- char ch = (char) i;

### 位运算

1. 把一个整数减去1，再和原整数做位与运算，会把该整数最右边的1变成0  
   这也可以判断一个数是不是2的整数次方
2. 位运算交换两个变量的值：a = a ^ b; b = a ^ b; a = a ^ b;
3. 任何一个数字异或它自己都等于0