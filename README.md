# Yorek's Blog

➠ [前往博客🚀🚀🚀](https://blog.yorek.xyz/) 

基于[Material for MkDocs V6.2.5](https://squidfunk.github.io/mkdocs-material/)

- mkdocs分支  
  博客的源文件，包括CNAME等  
- master分支  
  生成的网站源文件


1. 在mkdocs分支上进行blog的写作
2. 调用`serve.sh`脚本进行本地预览
3. 写作完毕后先提交到repo
4. 然后调用根目录的`deploy.sh`脚本进行发布，构建的产物将会push到master分支。

### 常见问题

1. 操作流程
    - fork项目或者随便怎么样
    - 安装python环境、pip之后跟随[Getting started](https://squidfunk.github.io/mkdocs-material/getting-started/)进行安装
    - 执行`mkdocs serve --dirtyreload`进行写作时的动态预览

2. FAQ

**若出现如下报错**：

```
Config value: 'plugins'. Error: The "git-revision-date-localized" plugin is not installed
```
请查阅对应repo上面的安装介绍[https://github.com/timvink/mkdocs-git-revision-date-localized-plugin](https://github.com/timvink/mkdocs-git-revision-date-localized-plugin)  
目前来看，安装即可`mkdocs-git-revision-date-localized-plugin`即可  

**下面的问题同样是插件问题**：
```
Config value: 'plugins'. Error: The "minify" plugin is not installed
```
执行`pip install mkdocs-minify-plugin`安装插件

**执行`mkdocs serve`时出错**：
```
ERROR   -  Error reading page 'android\3rd-library\glide1.md': 'NoneType' object has no attribute 'end'
...
markdown\htmlparser.py", line 95, in line_offset
    return re.match(r'([^\n]*\n){{{}}}'.format(self.lineno-1), self.rawdata).end()
AttributeError: 'NoneType' object has no attribute 'end'
```

仔细看堆栈时markdown插件报错，将其降级到3.2.1版本即可：
```shell
pip uninstall markdown
pip install -v markdown==3.2.1
```

**下面命令是常用的pip命令：**

```shell
## 列出所有安装的包
$ pip list
Package                                   Version
----------------------------------------- ----------
Babel                                     2.9.0
click                                     7.1.2
future                                    0.18.2
gitdb                                     4.0.5
GitPython                                 3.1.12
htmlmin                                   0.1.12
importlib-metadata                        3.4.0
Jinja2                                    2.11.2
joblib                                    1.0.0
jsmin                                     2.2.2
livereload                                2.6.3
lunr                                      0.5.8
Markdown                                  3.2.1
MarkupSafe                                1.1.1
mkdocs                                    1.1.2
mkdocs-git-revision-date-localized-plugin 0.8
mkdocs-material                           6.2.5
mkdocs-material-extensions                1.0.1
mkdocs-minify-plugin                      0.4.0
nltk                                      3.5
pip                                       21.0
Pygments                                  2.7.4
pymdown-extensions                        8.1
pytz                                      2020.5
PyYAML                                    5.3.1
regex                                     2020.11.13
setuptools                                47.1.0
six                                       1.15.0
smmap                                     3.0.4
tornado                                   6.1
tqdm                                      4.56.0
typing-extensions                         3.7.4.3
zipp                                      3.4.0

## 输出指定包的相关信息
$ pip show markdown
Name: Markdown
Version: 3.2.1
Summary: Python implementation of Markdown.
Home-page: https://Python-Markdown.github.io/
Author: Manfred Stienstra, Yuri takhteyev and Waylan limberg
Author-email: waylan.limberg@icloud.com
License: BSD License
Location: c:\users\liuya\appdata\local\programs\python\python37\lib\site-packages
Requires: setuptools
```
