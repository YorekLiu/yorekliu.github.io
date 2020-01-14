---
title: "Jenkins for android"
---

Jenkins在CentOS以及MacOS上搭建了好几次，遇到了一些问题。这里主要记录MacOS上的搭建过程。


## 1. Jenkins的搭建

在MacOS上可以直接下载Jenkins的pkg安装包，然后就能直接在网页上打开了。  
也可以只下载jenkins.war，然后放到tomcat上。

笔者采用的是第二种方法。

### 1.1 下载tomcat

tomcat版本为 *8.5.32*  
下载地址：[https://tomcat.apache.org/download-80.cgi](https://tomcat.apache.org/download-80.cgi)  
选择8.5.32 -> Binary Distributions -> Core -> tar.gz

将下载好的文件移动到`/usr/local/`目录下，然后就地解压

```shell
sudo mv ~/Downloads/apache-tomcat-8.5.32.tar.gz /usr/local/
sudo tar -zxvf apache-tomcat-8.5.32.tar.gz
```

这样就将tomcat解压了当前目录的apache-tomcat-8.5.32文件夹中。

最后将Tomcat文件夹link到`/Libray`下

```shell
sudo ln -s apache-tomcat-8.5.32/ /Library/Tomcat
```

最后为了方便开关tomcat，可以把Tomcat下面的`startup.sh`和`shutdown.sh`脚本link一份到`~/.`

```shell
cd
sudo ln -s /Library/Tomcat/bin/startup.sh .
sudo ln -s /Library/Tomcat/bin/shutdown.sh .
```

这样每次启动或关闭的时候，只需要执行`~/startup.sh`或`~/shutdown.sh`即可。

### 1.2 下载Jenkins
前往[https://jenkins.io/download/](https://jenkins.io/download/)  
选择下载 Long-term Support (LTS) ->  Download Jenkins 2.121.2 for -> Generic Java package (.war)  
最后我们会得到一个jenkins.war文件  
显然，笔者的版本是 *2.121.2*  

下载完成后，需要将`jenkins.war`复制到Tomcat的`webapps`下面。

```shell
mv ~/Downloads/jenkins.war /Library/Tomcat/webapps/
```

## 2. Jenkins设置

打开`http://localhost:8080/jenkins/`即可看到jenkins的初始化页面。
按照提示，`sudo vi ~/.jenkins/secrets/initialAdminPassword`打开文件，复制密码。

回车进入下一步，这里我们要安装Jenkins插件。我们直接选择`Select plugins to install`选项，然后去掉所有默认勾选的插件，继续进行下一步。  
因为有些插件在该步骤没有安装选项，我们后续直接在Jenkins的Manage Plugins页面一次性安装完。

创建管理员用户后就可以进入Jenkins主界面了。下面就是我们的重头戏

### 2.1 安装Jenkins插件
![jenkins_plugins_1](/assets/images/android/jenkins_plugins_1.png)

如图，我们选择`Manage Jenkins` -> `Manage Plugins`

在Available Tab中搜索并勾选如下插件后，点击下方`Install without restart`按钮一次性安装完毕。  
已安装的插件可以在Installed Tab中查看。

需要用到的插件列表
- Branch API Plugin
- build-name-setter
- Date Parameter Plugin
- description setter plugin
- Git Parameter Plug-In
- Gradle Plugin
- OWASP Markup Formatter Plugin
- PostBuildScript Plugin
- Dingding[钉钉] Plugin(可选，构建通知发送到钉钉群)
- Email Extension Plugin(可选，构建通过邮件发送)

插件会自动安装依赖插件。

### 2.2 Jenkins其他配置
**Manage Jenkins -> Configure System**  
`# of executors` -- 由于个人使用，且配置在自己的电脑上，所以填了`1`  
`Global properties -> Environment variables`  
![jenkins_env_var](/assets/images/android/jenkins_env_var.png)  
环境变量填了`ANDROID_HOME`和`PYTHON`的环境变量  
> 关于`ANDROID_HOME`，如果要放到服务器上，可以在[https://developer.android.com/studio/#downloads](https://developer.android.com/studio/#downloads)下载`Command line tools only`的编译工具。编译时如果缺少对应的工具，会自动进行下载。但是，此工具不会自动同意对应的licenses，所以我们可以把自用的licenses复制一份到服务器的${ANDROID_HOME}/licenses中。

**Manage Jenkins -> Configure Global Security**  
这里只需要修改`Markup Formatter -> Markup Formatter`，将`Plain text`修改成`Safe HTML`即可。  
![jenkins_markup_formatter](/assets/images/android/jenkins_markup_formatter.png)  

**Manage Jenkins -> Global Tool Configuration**  
![jenkins_global_tool_config](/assets/images/android/jenkins_global_tool_config.png)  
`JDK`和`Gradle`如果是自用的，可以直接选择Android Studio里面的内置的JDK和Gradle。如果放到服务器上，JDK和Gradle可以下载好放到指定位置或者选择`Install automatically`。  
git是内置的，不需要管。

至此，Jenkins的环境配置已经完成，下面我们将`New Item`了。

## 3. New Item
回到首页，点击`New Item`  
![jenkins_new_item](/assets/images/android/jenkins_new_item.png)  

新建一个名为`test`的`Freestyle project`的项目。如果要复制其他项目的配置，可以Copy from 项目名。  
![jenkins_new_freestyle](/assets/images/android/jenkins_new_freestyle.png)  

具体配置截图如下
[![jenkins_item_config](/assets/images/android/jenkins_item_config.png)](/assets/images/android/jenkins_item_config.png)

### 3.1 General -> This project is parameterized

此部分参数会在执行编译命令时传递给Android项目  

- `APP_NAME`  
**需要在项目gradle.properties中配置**，打包归档时会归档到对应的目录下  
- `GIT_TAG`  
编译哪个branch或tag的代码  
- `BUILD_TYPE`  
  **需要在项目gradle.properties中配置**，编译类型，是debug还是release  
- `IS_JENKINS`  
**需要在项目gradle.properties中配置**，分区是JENKINS编译还是Android Studio手动编译  
- `BUILD_TIME`  
**需要在项目gradle.properties中配置**，当前编译时间  
- `ENABLE_ABIFILTERS`  
*根据项目需要配置*，若使用，**需要在项目gradle.properties中配置**。为了使用模拟器，加上了这个选项  
- `READY_RELEASE`  
*是否准备发布。可选择dev或release分支。若为dev分支，会先自动合并dev分支到release分支，然后走release的代码。若为release分支，则会自动合并release分支到master，且会根据配置打tag。打包发版时勾选。* 后面配置的shell脚本会读取该值，进行一些git操作。  
- `TAG_NAME`、`TAG_MESSAGE`  
*READY_RELEASE为true时填写*。后面配置的shell脚本会读取该值，进行一些git操作。

配置后在编译开始的页面显示如下  
![jenkins_build_with_params](/assets/images/android/jenkins_build_with_params.png)

### 3.2 Source Code Management -> Git

- `Repository URL`  
填上项目git地址，Jenkins会检测git库的状态，如果一些OK，没有任何红字出现，如果下方出现了红字，just f**king google it。
- `Branch Specifier (blank for 'any')`  
填上第一步定义的变量`$GIT_TAG`

### 3.3 Build Environment -> Set Build Name

- `Set Build Name`  
填上 #${BUILD_NUMBER}_${BUILD_TYPE}

设置后，build的名字就会变成「#1_release」、「#2_debug」这样的名字

### 3.4 Build
- `Gradle Version`  
选择在`Manage Jenkins -> Global Tool Configuration`里面配置过的gradle版本。
- `Tasks`  
执行的编译命令。Jenkins在每次编译时，并不会删掉原来的代码重新拉取。所以我们要先`clean`一下，然后在执行真正的编译命令。同时我们可以将此次编译的commit id作为参数传入工程。所以这样填写`-PGIT_COMMIT=${GIT_COMMIT} clean assemble${BUILD_TYPE}`  
此外注意展开`Advanced`，勾选`Pass all job parameters as Project properties`。不然在3.1节中配置的参数不会传递给工程。  
一切正常时，可以从具体build的`Console Output`中查找到对应的日志  
`[bikedai] $ "/Applications/Android Studio.app/Contents/gradle/gradle-4.4/bin/gradle" -PTAG_MESSAGE= -PGIT_TAG=origin/dev -PAPP_NAME=bikedai -PBUILD_TYPE=debug -PIS_JENKINS=true -PBUILD_TIME=20180818-111553 -PENABLE_ABIFILTERS=true -PREADY_RELEASE=false -PTAG_NAME=v -PGIT_COMMIT=fa4aa05312a629d2747aa3cc7c8e6ee52e01cd9d clean assembledebug`
- `Execute shell`  
编译完成后执行shell命令。  
示例操作为  
1.根据APP_NAME、BUILD_TIME创建对应的归档目录  
2.将生成的apk文件移动到此目录  
3.使用python的myqr库，根据文件在tomcat中的地址，生成二维码，存放到apk同级目录下  
4.判断是否勾选了`READY_RELEASE`选项  
4.1.如果是  
4.1.1.判断是否是编译的dev分支，如果是，合并dev分支到release分支  
4.2.合并release分支到master分支  
5.打上tag  

shell如下  
```shell
mkdir -p ../files/${APP_NAME}/${BUILD_TIME}
mv ${APP_NAME}-${BUILD_TYPE}-${BUILD_TIME}.apk ../files/${APP_NAME}/${BUILD_TIME}

/usr/local/bin/myqr http://192.168.1.89:8080/${APP_NAME}/${BUILD_TIME}/${APP_NAME}-${BUILD_TYPE}-${BUILD_TIME}.apk -n jenkins_app.png -v 1 -l L -d ../files/${APP_NAME}/${BUILD_TIME}

if [ "${READY_RELEASE}" == true ];then
    if [ "${GIT_TAG}" == "origin/dev" ];then
        git co dev
        git co release
        git merge dev
        git push origin release
    fi
    git co master
    git merge release
    git push origin master
    git tag -a "${TAG_NAME}" -m "${TAG_MESSAGE}"
    git push --tags
    git co release
fi
```

### 3.5 Post-build Actions
**钉钉通知器配置**  
`jenkins URL`  
- 填写jenkins的url  
`钉钉access token`  
- 在钉钉群添加机器人，复制webhook里面access_token的value。**注意，只需要token，不需要全部的链接**

**Set build description**  
`Description`  
- build完成后的描述文字，这里写了一段html文本，显示了一个apk下载二维码以及下载链接。

html文本如下  
```html
<img src='http://192.168.1.89:8080/${APP_NAME}/${BUILD_TIME}/jenkins_app.png' width="200" height="200"> <br> <a href='http://192.168.1.89:8080/${APP_NAME}/${BUILD_TIME}/${APP_NAME}-${BUILD_TYPE}-${BUILD_TIME}.apk'>点击下载${APP_NAME}-${BUILD_TYPE}-${BUILD_TIME}.apk</a>
```

至此，Jenkins的配置已经完成了。下面我们还需要改造一下android客户端的代码，以及设置一下tomcat

## 4. android客户端代码修改
### 4.1 修改gradle.properties文件
在文件中增加5个变量定义：  

```gradle
ENABLE_ABIFILTERS=false
IS_JENKINS=false
BUILD_TYPE=Debug
APP_NAME=bikedai

BUILD_TIME=notime
```

### 4.2 添加jenkins-build.gradle
在项目根目录下新建gradle脚本文件，在打包时向manifest文件中插入打包参数的meta-data  
这里选了三个打包参数`IS_JENKINS`、`GIT_TAG`、``GIT_COMMIT`、`BUILD_TIME`  

```gradle
import groovy.xml.XmlUtil

project.afterEvaluate {
    android.applicationVariants.all { variant ->
        variant.outputs.all { output ->
            output.processManifest.doLast {
                // Stores the path to the maifest.
                def manifest = new File("$manifestOutputDirectory/AndroidManifest.xml")
                addProperties2Meta(manifest, "IS_JENKINS")
                addProperties2Meta(manifest, "GIT_TAG")
                addProperties2Meta(manifest, "GIT_COMMIT")
                addProperties2Meta(manifest, "BUILD_TIME")
            }
        }
    }
}

def addProperties2Meta(File manifest, String properties) {
    if (!project.hasProperty(properties)) {
        return
    }
    def value = project.property(properties)

    def xml = new XmlParser().parse(manifest)
    xml.application[0].appendNode("meta-data", ['android:name': properties, 'android:value': value])

    manifest.withPrintWriter("UTF-8") {
        XmlUtil.serialize(xml, it)
    }
}

// -----------------------------------------------------------------------------------------
// build script
android {
    applicationVariants.all { variant ->
        variant.outputs.all { output ->
            def newName
            def timeNow
            if ("true" == IS_JENKINS) {
                // Jenkins编译
                newName = APP_NAME + '-' + variant.buildType.name + '-' + BUILD_TIME + '.apk'
                outputFileName = new File("../../../../..", newName)
            } else {
                // Android Studio编译
                timeNow = new Date().format("yyyyMMddHHmm")
                newName = APP_NAME + "-v" + variant.versionName + '-' + variant.buildType.name + '-' + timeNow + '.apk'
                outputFileName = newName
            }
        }
    }
}
// -----------------------------------------------------------------------------------------
```
我们可以在app中获取这些meta-data，便于debug  
![debug](/assets/images/android/jenkins_build_info.jpeg)


### 4.3 修改app/build.gradle文件

```gradle
...
apply from: '../jenkins-build.gradle'

android {
    defaultConfig {
        ...
        if ("true" == ENABLE_ABIFILTERS) {
            ndk {
                abiFilters 'armeabi'
            }
        }
        ...
    }
}
```

### 5 万事具备
在上面的设置中，我们将jenkins编译时生成的文件拷贝到了一个目录，这个目录是一个静态资源目录。  
我们还需要设置一点点东西。

```shell
cd ~/.jenkins/workspace/
ln -s /Library/Tomcat/webapps/ROOT/ files
```

将`Tomcat/webapps/ROOT/`链接至`~/.jenkins/workspace/files`
这样jenkins可以方便的将build出来的包mv到Tomcat中

然后在Tomcat中设置此目录是可以直接访问的。

```shell
cd /usr/local/apache-tomcat-8.5.32/
vi conf/server.xml
```

找到`Host`节点，在里面增加如下配置  
`<Context path="" docBase="/usr/local/apache-tomcat-8.5.32/webapps/ROOT" reloadable="true" />`

```xml
<?xml version="1.0" encoding="UTF-8"?>

<Server port="8005" shutdown="SHUTDOWN">
  ...
  <Service name="Catalina">
    ...
    <Engine name="Catalina" defaultHost="localhost">
      ...
      <Host name="localhost"  appBase="webapps"
            unpackWARs="true" autoDeploy="true">

        <!-- add -->
        <Context path="" docBase="/usr/local/apache-tomcat-8.5.32/webapps/ROOT" reloadable="true" />

        <Valve className="org.apache.catalina.valves.AccessLogValve" directory="logs"
               prefix="localhost_access_log" suffix=".txt"
               pattern="%h %l %u %t &quot;%r&quot; %s %b" />
      </Host>
    </Engine>
  </Service>
</Server>
```
