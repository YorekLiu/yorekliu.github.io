---
title: "git常用操作"
categories:
  - Android
tags:
  - git
---


- 删除本地tag  
  git tag -d <tag_name>

- 删除远程tag  
  git push origin :refs/tags/<tag_name>

- 本地分支push到远程新分支
  git push origin <local>:<master>

- 删除远程分支  
  git branch -r -d origin/branch-name
  git push origin :branch-name


由于题目限制不能使用x、/、%操作符。所以高票答案采取了位运算的思路。  
1.处理边界情况  
2.获取结果符号，将除数与被除数转为正数，后续操作可以不用关心符号问题  
3.对被除数进行进位，找出最接近除数的被除数进位，并相减；累计进位结果  
4.对第1步的剩余，循环进行第1步的操作  
5.返回带符号的结果  
**Note**:  
1.注意`Math.abs(Integer.MIN_VALUE)=Integer.MIN_VALUE`，所以在第二步中采取了`Math.abs((long) dividend)`操作  
2.返回结果时不要`return (int) sign * res;`，这里的「\*」违反了规则
{: .notice }

由于题目限制不能使用x、/、%操作符。所以高票答案采取了位运算的思路。  
1.处理边界情况  
2.获取结果符号，将除数与被除数转为正数，后续操作可以不用关心符号问题  
3.对被除数进行进位，找出最接近除数的被除数进位，并相减；累计进位结果  
4.对第1步的剩余，循环进行第1步的操作  
5.返回带符号的结果  
**Note**:  
1.注意`Math.abs(Integer.MIN_VALUE)=Integer.MIN_VALUE`，所以在第二步中采取了`Math.abs((long) dividend)`操作  
2.返回结果时不要`return (int) sign * res;`，这里的「\*」违反了规则
{: .notice--primary }

由于题目限制不能使用x、/、%操作符。所以高票答案采取了位运算的思路。  
1.处理边界情况  
2.获取结果符号，将除数与被除数转为正数，后续操作可以不用关心符号问题  
3.对被除数进行进位，找出最接近除数的被除数进位，并相减；累计进位结果  
4.对第1步的剩余，循环进行第1步的操作  
5.返回带符号的结果  
**Note**:  
1.注意`Math.abs(Integer.MIN_VALUE)=Integer.MIN_VALUE`，所以在第二步中采取了`Math.abs((long) dividend)`操作  
2.返回结果时不要`return (int) sign * res;`，这里的「\*」违反了规则
{: .notice--info }

由于题目限制不能使用x、/、%操作符。所以高票答案采取了位运算的思路。  
1.处理边界情况  
2.获取结果符号，将除数与被除数转为正数，后续操作可以不用关心符号问题  
3.对被除数进行进位，找出最接近除数的被除数进位，并相减；累计进位结果  
4.对第1步的剩余，循环进行第1步的操作  
5.返回带符号的结果  
**Note**:  
1.注意`Math.abs(Integer.MIN_VALUE)=Integer.MIN_VALUE`，所以在第二步中采取了`Math.abs((long) dividend)`操作  
2.返回结果时不要`return (int) sign * res;`，这里的「\*」违反了规则
{: .notice--warning }

由于题目限制不能使用x、/、%操作符。所以高票答案采取了位运算的思路。  
1.处理边界情况  
2.获取结果符号，将除数与被除数转为正数，后续操作可以不用关心符号问题  
3.对被除数进行进位，找出最接近除数的被除数进位，并相减；累计进位结果  
4.对第1步的剩余，循环进行第1步的操作  
5.返回带符号的结果  
**Note**:  
1.注意`Math.abs(Integer.MIN_VALUE)=Integer.MIN_VALUE`，所以在第二步中采取了`Math.abs((long) dividend)`操作  
2.返回结果时不要`return (int) sign * res;`，这里的「\*」违反了规则
{: .notice--success }

由于题目限制不能使用x、/、%操作符。所以高票答案采取了位运算的思路。  
1.处理边界情况  
2.获取结果符号，将除数与被除数转为正数，后续操作可以不用关心符号问题  
3.对被除数进行进位，找出最接近除数的被除数进位，并相减；累计进位结果  
4.对第1步的剩余，循环进行第1步的操作  
5.返回带符号的结果  
**Note**:  
1.注意`Math.abs(Integer.MIN_VALUE)=Integer.MIN_VALUE`，所以在第二步中采取了`Math.abs((long) dividend)`操作  
2.返回结果时不要`return (int) sign * res;`，这里的「\*」违反了规则
{: .notice--danger }

<figure style="width: 50%" class="align-center">
    <img src="/assets/images/android/remoteviews-custom-notification.png">
    <figcaption>自定义通知样式</figcaption>
</figure>

分段函数  

$$f(n,m)=\begin{cases} 0 & n=1 \\ [f(n-1,m)+m]\%n & n>1 \end{cases}$$

HTTPS原理简述: https://blog.csdn.net/iispring/article/details/51615631