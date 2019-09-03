---
title: "博客特殊语法备忘"
toc: true
toc_label: "目录"
last_modified_at: 2019-07-26T10:38:19+08:00
---

<script type="text/javascript" async
  src="https://cdn.mathjax.org/mathjax/latest/MathJax.js?config=TeX-MML-AM_CHTML">
</script>

### 1. Notices

**notice**:  

由于题目限制不能使用x、/、%操作符。所以高票答案采取了位运算的思路。
{: .notice }

```markdown
由于题目限制不能使用x、/、%操作符。所以高票答案采取了位运算的思路。
{: .notice }
```

<p>&nbsp;</p>

**notice--primary**:  

由于题目限制不能使用x、/、%操作符。所以高票答案采取了位运算的思路。
{: .notice--primary }

```markdown
由于题目限制不能使用x、/、%操作符。所以高票答案采取了位运算的思路。
{: .notice--primary }
```

<p>&nbsp;</p>

**notice--info**:  

由于题目限制不能使用x、/、%操作符。所以高票答案采取了位运算的思路。
{: .notice--info }

```markdown
由于题目限制不能使用x、/、%操作符。所以高票答案采取了位运算的思路。
{: .notice--info }
```

<p>&nbsp;</p>

**notice--warning**:  

由于题目限制不能使用x、/、%操作符。所以高票答案采取了位运算的思路。
{: .notice--warning }

```markdown
由于题目限制不能使用x、/、%操作符。所以高票答案采取了位运算的思路。
{: .notice--warning }
```

<p>&nbsp;</p>

**notice--success**:  

由于题目限制不能使用x、/、%操作符。所以高票答案采取了位运算的思路。
{: .notice--success }

```markdown
由于题目限制不能使用x、/、%操作符。所以高票答案采取了位运算的思路。
{: .notice--success }
```

<p>&nbsp;</p>

**notice--danger**:  

由于题目限制不能使用x、/、%操作符。所以高票答案采取了位运算的思路。
{: .notice--danger }

```markdown
由于题目限制不能使用x、/、%操作符。所以高票答案采取了位运算的思路。
{: .notice--danger }
```

<p>&nbsp;</p>

**notice--question**:  

由于题目限制不能使用x、/、%操作符。所以高票答案采取了位运算的思路。
{: .notice--question }

```markdown
由于题目限制不能使用x、/、%操作符。所以高票答案采取了位运算的思路。
{: .notice--question }
```

### 2. Buttons

[Default Button Text](#link){: .btn}
[Light Outline Button](#link){: .btn .btn--light-outline}
[Inverse Button](#link){: .btn .btn--inverse}

```markdown
[Default Button Text](#link){: .btn}
[Light Outline Button](#link){: .btn .btn--light-outline}
[Inverse Button](#link){: .btn .btn--inverse}
```

### 3. Images

**不带描述、居中、实际宽度**

<img src="/assets/images/android/content-provider-overview.png" class="align-center">

```markdown
<img src="/assets/images/android/content-provider-overview.png" class="align-center">
```

<p>&nbsp;</p>

**普通带描边效果**:  

<figure style="width: 50%" class="align-center">
    <img src="/assets/images/android/final-architecture.png">
    <figcaption>图片宽度为显示区域的一半、有描边</figcaption>
</figure>

```markdown
<figure style="width: 50%" class="align-center">
    <img src="/assets/images/android/final-architecture.png">
    <figcaption>图片宽度为显示区域的一半、有描边</figcaption>
</figure>
```

<p>&nbsp;</p>

**普通不带描边效果**:

<figure style="width: 50%" class="align-center">
    <img src="/assets/images/android/final-architecture.png" style="border: none">
    <figcaption>图片宽度为显示区域的一半、无描边</figcaption>
</figure>

```markdown
<figure style="width: 50%" class="align-center">
    <img src="/assets/images/android/final-architecture.png" style="border: none">
    <figcaption>图片宽度为显示区域的一半、无描边</figcaption>
</figure>
```

<p>&nbsp;</p>

**两图**:  

<figure style="width: 80%" class="half align-center">
    <img src="/assets/images/android/final-architecture.png">
    <img src="/assets/images/android/final-architecture.png">
    <figcaption>两图、图片宽度为显示区域的0.8</figcaption>
</figure>

```markdown
<figure style="width: 80%" class="half align-center">
    <img src="/assets/images/android/final-architecture.png">
    <img src="/assets/images/android/final-architecture.png">
    <figcaption>两图、图片宽度为显示区域的0.8</figcaption>
</figure>
```

<p>&nbsp;</p>

**三图**:  

<figure style="width: 80%" class="third align-center">
    <img src="/assets/images/android/final-architecture.png">
    <img src="/assets/images/android/final-architecture.png">
    <img src="/assets/images/android/final-architecture.png">
    <figcaption>三图、图片宽度为显示区域的0.8</figcaption>
</figure>

```markdown
<figure style="width: 80%" class="third align-center">
    <img src="/assets/images/android/final-architecture.png">
    <img src="/assets/images/android/final-architecture.png">
    <img src="/assets/images/android/final-architecture.png">
    <figcaption>三图、图片宽度为显示区域的0.8</figcaption>
</figure>
```

### 4. Others

**分段函数**:  

$$f(n,m)=\begin{cases} 0 & n=1 \\ [f(n-1,m)+m]\%n & n>1 \end{cases}$$

```markdown
$$f(n,m)=\begin{cases} 0 & n=1 \\ [f(n-1,m)+m]\%n & n>1 \end{cases}$$
```

注意在文章开头加上如下代码：

```xml
<script type="text/javascript" async
  src="https://cdn.mathjax.org/mathjax/latest/MathJax.js?config=TeX-MML-AM_CHTML">
</script>
```

<p>&nbsp;</p>

**Table合并单元格**:  

<figcaption>ScaleType与默认的transform之间关系</figcaption>
<table>
  <thead>
    <tr>
      <th>ScaleType</th>
      <th>transform</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>CENTER_CROP</td>
      <td>optionalCenterCrop()</td>
    </tr>
    <tr>
      <td>CENTER_INSIDE</td>
      <td rowspan="2">optionalCenterInside()</td>
    </tr>
    <tr>
      <td>FIT_XY</td>
    </tr>
    <tr>
      <td>FIT_CENTER</td>
      <td rowspan="3">optionalFitCenter()</td>
    </tr>
    <tr>
      <td>FIT_START</td>
    </tr>
    <tr>
      <td>FIT_END</td>
    </tr>
    <tr>
      <td>CENTER</td>
      <td rowspan="2">&nbsp;</td>
    </tr>
    <tr>
      <td>MATRIX</td>
    </tr>
  </tbody>
</table>

```xml
<figcaption>ScaleType与默认的transform之间关系</figcaption>
<table>
  <thead>
    <tr>
      <th>ScaleType</th>
      <th>transform</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>CENTER_CROP</td>
      <td>optionalCenterCrop()</td>
    </tr>
    <tr>
      <td>CENTER_INSIDE</td>
      <td rowspan="2">optionalCenterInside()</td>
    </tr>
    <tr>
      <td>FIT_XY</td>
    </tr>
    <tr>
      <td>FIT_CENTER</td>
      <td rowspan="3">optionalFitCenter()</td>
    </tr>
    <tr>
      <td>FIT_START</td>
    </tr>
    <tr>
      <td>FIT_END</td>
    </tr>
    <tr>
      <td>CENTER</td>
      <td rowspan="2">&nbsp;</td>
    </tr>
    <tr>
      <td>MATRIX</td>
    </tr>
  </tbody>
</table>
```

<p>&nbsp;</p>

**调整字号**:  

<p>&nbsp;</p><font size="3"><b>Guideline</b></font>  

```markdown
<p>&nbsp;</p><font size="3"><b>Guideline</b></font>  
```

<p>&nbsp;</p>

**调整颜色**:  

<span style="color: #0092ca">变色</span>

```markdown
<span style="color: #0092ca">变色</span>
```

<p>&nbsp;</p>