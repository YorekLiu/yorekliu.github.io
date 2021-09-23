---
title: "16 | 网络优化（中）：复杂多变的移动网络该如何优化？"
---

!!! tip "极客时间——[Android开发高手课](https://time.geekbang.org/column/intro/142)"
    本栏目内容源于[Android开发高手课](https://time.geekbang.org/column/intro/142)，外加Sample的个人练习小结。本栏目内的内容将会持续混合着博主个人的收集到的知识点。若本栏目内容令人不适，请移步原始课程。  

在 PC 互联网时代，网络优化已经是一项非常复杂的工作。对于移动网络来说，弱网络、网络切换、网络劫持这些问题更加突出，网络优化这项工作也变得更加艰巨。

那作为一名移动开发者，面对复杂多变的移动网络我们该如何去优化呢？可能也有人会说，我只要用好 AFNetworking/OkHttp 这些成熟网络库就可以了，并不需要额外去做什么优化。那你确定你真的能用好这些网络库吗？它们内部是怎样实现的、有哪些差异点、哪个网络库更好呢？

虽然我们可能只是客户端 App 开发人员，但在关于网络优化还是可以做很多事情的，很多大型的应用也做了很多的实践。今天我们一起来看一下，如何让我们的应用在各种的网络条件下都能“快人一步”。

## 移动端优化

回想上一期我给出的网络架构图，一个数据包从手机出发要经过无线网络、核心网络以及外部网络（互联网），才能到达我们的服务器。那整个网络请求的速度会跟哪些因素有关呢？

![network_2_1](/assets/images/android/master/network_2_1.png)

从上面这张图上看，客户端网络库实现、服务器性能以及网络链路的质量都是影响网络请求速度的因素。下面我们先从客户端的网络库说过，看看应该如何进行网络优化。

### 1. 何为网络优化

在讲怎么去优化网络之前，我想先明确一下所谓的网络优化，究竟指的是什么？在我看来，核心内容有以下三个：

- **速度**。在网络正常或者良好的时候，怎样更好地利用带宽，进一步提升网络请求速度。
- **弱网络**。移动端网络复杂多变，在出现网络连接不稳定的时候，怎样最大程度保证网络的连通性。
- **安全**。网络安全不容忽视，怎样有效防止被第三方劫持、窃听甚至篡改。

除了这三个问题，我们可能还会关心网络请求造成的耗电、流量问题，这两块内容我们在后面会统一地讲，今天就不再展开。

那对于速度、弱网络以及安全的优化，又该从哪些方面入手呢？首先你需要先搞清楚一个网络请求的整个过程。

![network_2_2](/assets/images/android/master/network_2_2.png)

从图上看到，整个网络请求主要分为几个步骤，而整个请求的耗时可以细分到每一个步骤里面。

- **DNS 解析**。通过 DNS 服务器，拿到对应域名的 IP 地址。在这个步骤，我们比较关注 DNS 解析耗时情况、运营商 LocalDNS 的劫持、DNS 调度这些问题。
- **创建连接**。跟服务器建立连接，这里包括 TCP 三次握手、TLS 密钥协商等工作。多个 IP/ 端口该如何选择、是否要使用 HTTPS、能否可以减少甚至省下创建连接的时间，这些问题都是我们优化的关键。
- **发送 / 接收数据**。在成功建立连接之后，就可以愉快地跟服务器交互，进行组装数据、发送数据、接收数据、解析数据。我们关注的是，如何根据网络状况将带宽利用好，怎么样快速地侦测到网络延时，在弱网络下如何调整包大小等问题。
- **关闭连接**。连接的关闭看起来非常简单，其实这里的水也很深。这里主要关注主动关闭和被动关闭两种情况，一般我们都希望客户端可以主动关闭连接。

所谓的网络优化，就是围绕速度、弱网络、安全这三个核心内容，减少每一个步骤的耗时，打造快速、稳定且安全的高质量网络。

### 2. 何为网络库

在实际的开发工作中，我们很少会像《UNIX 网络编程》那样直接去操作底层的网络接口，一般都会使用网络库。Square 出品的[OkHttp](https://github.com/square/okhttp)是目前最流行的 Android 网络库，它还被 Google 加入到 Android 系统内部，为广大开发者提供网络服务。

那网络库究竟承担着一个什么样的角色呢？在我看来，它屏蔽了下层复杂的网络接口，让我们可以更高效地使用网络请求。

![network_2_3](/assets/images/android/master/network_2_3.png)

如上图所示，一个网络库的核心作用主要有以下三点：

- **统一编程接口**。无论是同步还是异步请求，接口都非常简单易用。同时我们可以统一做策略管理，统一进行流解析（JSON、XML、Protocol Buffers）等。
- **全局网络控制**。在网络库内部我们可以做统一的网络调度、流量监控以及容灾管理等工作。
- **高性能**。既然我们把所有的网络请求都交给了网络库，那网络库是否实现高性能就至关重要。既然要实现高性能，那我会非常关注速度，CPU、内存、I/O 的使用，以及失败率、崩溃率、协议的兼容性等方面。

不同的网络库实现差别很大，比较关键有这几个模块：

![network_2_4](/assets/images/android/master/network_2_4.png)

那网络库实现到底哪家强？接下来我们一起来对比 OkHttp、Chromium 的[Cronet](https://chromium.googlesource.com/chromium/src/+/master/components/cronet/)以及微信[Mars](https://github.com/Tencent/mars)这三个网络库的内部实现。

### 高质量网络库

据我了解业内的[蘑菇街](https://www.infoq.cn/article/mogujie-app-chromium-network-layer?useSponsorshipSuggestions=true%2F)、头条、UC 浏览器都在 Chromium 网络库上做了二次开发，而微信 Mars 在弱网络方面做了大量优化，拼多多、虎牙、链家、美丽说这些应用都在使用 Mars。

下面我们一起来对比一下各个网络库的核心实现。对于参与网络库相关工作来说，我的经验还算是比较丰富的。在微信的时候曾经参与过 Mars 的开发，目前也在基于 Chromium 网络库做二次开发。

![network_2_5](/assets/images/android/master/network_2_5.png)

为什么我从来没使用过 OkHttp？主要因为它并不支持跨平台，对于大型应用来说跨平台是非常重要的。我们不希望所有的优化 Android 和 iOS 都要各自去实现一套，不仅浪费人力而且还容易出问题。

对于 Mars 来说，它是一个跨平台的 Socket 层解决方案，并不支持完整的 HTTP 协议，所以 Mars 从严格意义上来讲并不是一个完整的网络库。但是它在弱网络和连接上做了大量的优化，并且支持长连接。关于 Mars 的网络多优化的更多细节，你可以参考[Wiki](https://github.com/Tencent/mars/wiki)右侧的文章列表。

[![network_2_5](/assets/images/android/master/network_2_6.png)](/assets/images/android/master/network_2_6.png)

Chromium 网络库作为标准的网络库，基本上可以说是找不到太大的缺点。而且我们可以享受 Google 后续网络优化的成果，类似 TLS 1.3、QUIC 支持等。

但是它针对弱网络场景没有做太多定制的优化，也不支持长连接。事实上目前我在 Chromium 网络库的二次开发主要工作也是补齐弱网络优化与长连接这两个短板。

## 大网络平台

对于大公司来说，我们不能只局限在客户端网络库的双端统一上。网络优化不仅仅是客户端的事情，所以我们有了统一的网络中台，它负责提供前后台一整套的网络解决方案。

阿里的[ACCS](https://www.infoq.cn/article/taobao-mobile-terminal-access-gateway-infrastructure)、蚂蚁的[mPaaS](https://mp.weixin.qq.com/s/nz8Z3Uj9840KHluWjwyelw)、携程的[网络服务](https://www.infoq.cn/article/how-ctrip-improves-app-networking-performance)都是公司级的网络中台服务，这样所有的网络优化可以让整个集团的所有接入应用受益。

下图是 mPaaS 的网络架构图，所有网络请求都会先经过统一的接入层，再转发到业务服务器。这样我们可以在业务服务器无感知的情况下，在接入层做各种各样的网络优化。

![network_2_7](/assets/images/android/master/network_2_7.png)

### 1. HTTPDNS

DNS 的解析是我们网络请求的第一项工作，默认我们使用运营商的 LocalDNS 服务。这块耗时在 3G 网络下可能是 200～300ms，4G 网络也需要 100ms。

解析慢并不是默认 LocalDNS 最大的“原罪”，它还存在一些其他问题：

- **稳定性**。UDP 协议，无状态，容易域名劫持（难复现、难定位、难解决），每天至少几百万个域名被劫持，一年至少十次大规模事件。
- **准确性**。LocalDNS 调度经常出现不准确，比如北京的用户调度到广东 IP，移动的运营商调度到电信的 IP，跨运营商调度会导致访问慢，甚至访问不了。
- **及时性**。运营商可能会修改 DNS 的 TTL，导致 DNS 修改生效延迟。不同运营商的服务实现不一致，我们也很难保证 DNS 解析的耗时。

为了解决这些问题，就有了 HTTPDNS。简单来说自己做域名解析的工作，通过 HTTP 请求后台去拿到域名对应的 IP 地址，直接解决上述所有问题。

微信有自己部署的 NEWDNS，阿里云和腾讯云也有提供自己的 HTTPDNS 服务。对于大网络平台来说，我们会有统一的 HTTPDNS 服务，并将它和运维系统打通。在传统的 DNS 基础上，还会增加精准的流量调度、网络拨测 / 灰度、网络容灾等功能。

![network_2_8](/assets/images/android/master/network_2_8.png)

关于 HTTPDNS 的更多知识，你可以参考百度的[《DNS 优化》](https://mp.weixin.qq.com/s/iaPtSF-twWz-AN66UJUBDg)。对客户端来说，我们可以通过预请求的方法，提前拿到一批域名的 IP，不过这里需要注意 IPv4 与 IPv6 协议栈的选择问题。

### 2. 连接复用

在 DNS 解析之后，我们来到了创建连接这个环节。创建连接要经过 TCP 三次握手、TLS 密钥协商，连接建立的代价是非常大的。这里我们主要的优化思路是复用连接，这样不用每次请求都重新建立连接。

在前面我就讲过连接管理，网络库并不会立刻把连接释放，而是放到连接池中。这时如果有另一个请求的域名和端口是一样的，就直接拿出连接池中的连接进行发送和接收数据，少了建立连接的耗时。

这里我们利用 HTTP 协议里的 keep-alive，而 HTTP/2.0 的多路复用则可以进一步的提升连接复用率。它复用的这条连接支持同时处理多条请求，所有请求都可以并发在这条连接上进行。

![network_2_9](/assets/images/android/master/network_2_9.png)

虽然 H2 十分强大，不过这里还有两个问题需要解决。一个是同一条 H2 连接只支持同一个域名，一个是后端支持 HTTP/2.0 需要额外的改造。这个时候我们只需要在统一接入层做改造，接入层将数据转换到 HTTP/1.1 再转发到对应域名的服务器。

![network_2_10](/assets/images/android/master/network_2_10.png)

这样所有的服务都不用做任何改造就可以享受 HTTP/2.0 的所有优化，不过这里需要注意的是 H2 的多路复用在本质上依然是同一条 TCP 连接，如果所有的域名的请求都集中在某一条连接中，在网络拥塞的时候容易出现 TCP 队首阻塞问题。

对于客户端网络库来说，无论 OkHttp 还是 Chromium 网络库对于 HTTP/2.0 的连接，同一个域名只会保留一条连接。对于一些第三方请求，特别是文件下载以及视频播放这些场景可能会遇到对方服务器单连接限速的问题。在这种情况下我们可以通过修改网络库实现，也可以简单的通过禁用 HTTP/2.0 协议解决。

### 3. 压缩与加密

#### 压缩

讲完连接，我们再来看看发送和接收的优化。我第一时间想到的还是减少传输的数据量，也就是我们常说的数据压缩。首先对于 HTTP 请求来说，数据主要包括三个部分：

- 请求 URL
- 请求 header
- 请求 body

对于 header 来说，如果使用 HTTP/2.0 连接本身的[头部压缩](https://imququ.com/post/header-compression-in-http2.html)技术，因此需要压缩的主要是请求 URL 和请求 body。

对于请求 URL 来说，一般会带很多的公共参数，这些参数大部分都是不变的。这样不变的参数客户端只需要上传一次即可，其他请求我们可以在接入层中进行参数扩展。

对于请求 body 来说，一方面是数据通信协议的选择，在网络传输中目前最流行的两种数据序列化方式是 JSON 和 Protocol Buffers。正如我之前所说的一样，Protocol Buffers 使用起来更加复杂一些，但在数据压缩率、序列化与反序列化速度上面都有很大的优势。

另外一方面是压缩算法的选择，通用的压缩算法主要是如 gzip，Google 的[Brotli](https://github.com/google/brotli)或者 Facebook 的[Z-standard](https://github.com/facebook/zstd)都是压缩率更高的算法。其中如果 Z-standard 通过业务数据样本训练出适合的字典，是目前压缩率表现最好的算法。但是各个业务维护字典的成本比较大，这个时候我们的大网络平台的统一接入层又可以大显神威了。

![network_2_11](/assets/images/android/master/network_2_11.png)

例如我们可以抽样 1% 的请求数据用来训练字典，字典的下发与更新都由统一接入层负责，业务并不需要关心。

当然针对特定数据我们还有其他的压缩方法，例如针对图片我们可以使用 webp、hevc、[SharpP](https://mp.weixin.qq.com/s/JcBNT2aKTmLXRD9zIOPe6g)等压缩率更高的格式。另外一方面，基于 AI 的[图片超清化](http://imgtec.eetrend.com/d6-imgtec/blog/2017-08/10143.html)也是一大神器，QQ 空间通过这个技术节约了大量的带宽成本。

#### 安全

数据安全也是网络重中之重的一个环节，在大网络平台中我们都是基于 HTTPS 的 HTTP/2 通道，已经有了 TLS 加密。如果大家不熟悉 TLS 的基础知识，可以参考微信后台一个小伙伴写的[《TLS 协议分析》](https://blog.helong.info/blog/2015/09/07/tls-protocol-analysis-and-crypto-protocol-design/)。

但是 HTTPS 带来的代价也是不小的，它需要 2-RTT 的协商成本，在弱网络下时延不可接受。同时后台服务解密的成本也十分高昂，在大型企业中需要单独的集群来做这个事情。

HTTPS 的优化有下面几个思路：

- **连接复用率**。通过多个域名共用同一个 HTTP/2 连接、长连接等方式提升连接复用率。
- **减少握手次数**。TLS 1.3可以实现 0-RTT 协商，事实上在 TLS 1.3 release 之前，微信的[mmtls](https://mp.weixin.qq.com/s/tvngTp6NoTZ15Yc206v8fQ)、Facebook 的[fizz](https://mp.weixin.qq.com/s?__biz=MzI4MTY5NTk4Ng==&mid=2247489465&idx=1&sn=a54e3fe78fc559458fa47104845e764b&source=41#wechat_redirect)、阿里的 SlightSSL 都已在企业内部大规模部署。
- **性能提升**。使用 ecc 证书代替 RSA，服务端签名的性能可以提升 4～10 倍，但是客户端校验性能降低了约 20 倍，从 10 微秒级降低到 100 微秒级。另外一方面可以通过 Session Ticket 会话复用，节省一个 RTT 耗时。

使用 HTTPS 之后，整个通道是不是就一定高枕无忧呢？如果客户端设置了代理，TLS 加密的数据可以被解开并可能被利用 。这个时候我们可以在客户端将“[证书锁定](https://sec.xiaomi.com/article/48)”（Certificate Pinning），为了老版本兼容和证书替换的灵活性，建议锁定根证书。

我们也可以对传输内容做二次加密，这块在统一接入层实现，业务服务器也同样无需关心这个流程。需要注意的是二次加密会增加客户端与服务器的处理耗时，我们需要在安全性与性能之间做一个取舍。

![network_2_12](/assets/images/android/master/network_2_12.png)

### 4. 其他优化

关于网络优化的手段还有很多，一些方案可能是需要用钱堆出来的，比如部署跨国的专线、加速点，多 IDC 就近接入等。

除此之外，使用[CDN 服务](https://toutiao.io/posts/6gb8ih/preview)、[P2P 技术](https://mp.weixin.qq.com/s?__biz=MzI4MTY5NTk4Ng==&mid=2247489182&idx=1&sn=e892855fd315ed2f1395f05b765f9c4e&source=41#wechat_redirect)也是比较常用的手段，特别在直播这类场景。总的来说，网络优化我们需要综合用户体验、带宽成本以及硬件成本等多个因素来考虑。

下面为你献上一张高质量网络的全景大图。

[![network_2_13](/assets/images/android/master/network_2_13.png)](/assets/images/android/master/network_2_13.png)

## QUIC 与 IPv6

今天已经讲得很多了，可能还有小伙伴比较关心最近一些比较前沿的技术，我简单讲一下 QUIC 和 IPv6。

### 1. QUIC

QUIC 协议由 Google 在 2013 年实现，在 2018 年基于 QUIC 协议的 HTTP 更被确认为[HTTP/3](https://zh.wikipedia.org/wiki/HTTP/3)。在连接复用中我说过 HTTP/2 + TCP 会存在队首阻塞的问题，基于 UDP 的 QUIC 才是终极解决方案。

如下图所示，你可以把 QUIC 简单理解为 HTTP/2.0 + TLS 1.3 + UDP。

![network_2_14](/assets/images/android/master/network_2_14.png)

事实上，它还有着其他的很多优势：

- **灵活控制拥塞协议**。如果想对 TCP 内部的拥塞控制算法等模块进行优化和升级，整体周期是相对较长的。对于 UDP 来说，我们不需要操作系统支持，随时可改，例如可以直接使用 Google 的[BBR 算法](https://queue.acm.org/detail.cfm?id=3022184)。
- **“真”连接复用**。不仅解决了队首阻塞的问题，在客户端网络切换的时候也不需要重连，用户使用 App 的体验会更加流畅。

既然 QUIC 那么好，为什么我们在生产环境没有全部切换成 QUIC 呢？那是因为有很多坑还没有踩完，目前发现的主要问题还有：

- **创建连接成功率**。主要是 UDP 的穿透性问题，NAT 局域网路由、交换机、防火墙等会禁止 UDP 443 通行，目前 QUIC 在国内建连的成功率大约在 95% 左右。
- **运营商支持**。运营商针对 UDP 通道支持不足，表现也不稳定。例如 QoS 限速丢包，有些小的运营商甚至还直接不支持 UDP 包。

尽管有这样那样的问题，但是 QUIC 一定是未来。当然，通过大网络平台的统一接入层，我们业务基本无需做什么修改。目前据我了解，[腾讯](https://archstat.com/infoQ/archSummit/2018%E6%9E%B6%E6%9E%84%E5%B8%88%E5%90%88%E9%9B%86/AS%E6%B7%B1%E5%9C%B32018-%E3%80%8AQUIC%E5%8D%8F%E8%AE%AE%E5%9C%A8%E8%85%BE%E8%AE%AF%E7%9A%84%E5%AE%9E%E8%B7%B5%E5%92%8C%E4%BC%98%E5%8C%96%E3%80%8B-%E7%BD%97%E6%88%90.pdf)、[微博](https://github.com/thinkpiggy/qcon2018ppt/blob/master/QUIC%E5%9C%A8%E6%89%8B%E6%9C%BA%E5%BE%AE%E5%8D%9A%E4%B8%AD%E7%9A%84%E5%BA%94%E7%94%A8%E5%AE%9E%E8%B7%B5.pdf)、[阿里](https://mp.weixin.qq.com/s/QhaFKuxTf3mrbF-eWIkZTw)都在内部逐步加大 QUIC 的流量，具体细节可以参考我给出的链接。

### 2. IPv6

运维人员都会深深的感觉到 IP 资源的珍贵，而致力于解决这个问题的 IPv6 却在中国一直非常沉寂。根据[《2017 年 IPV6 支持度报告》](https://www.ipv6ready.org.cn/public/download/ipv6.pdf)，在中国只有 0.38% 的用户使用 v6。

![network_2_15](/assets/images/android/master/network_2_15.png)

IPv6 不仅针对 IoT 技术，对万物互联的时代有着非常大的意义。而且它对网络性能也有正向的作用，在印度经过我们测试，使用 IPv6 网络相比 IPv4 连接耗时可以降低 10%～20%。推行 IPv6 后，无穷无尽的 IP 地址意味着可以告别各种 NAT，P2P、QUIC 的连接也不再是问题。

在过去的一年，无论是[阿里云](https://mp.weixin.qq.com/s/RXICO_3W2cxTYk0UV40GLQ)还是[腾讯云](https://mp.weixin.qq.com/s/ufV7mZWHPfLNE1-QxWmEfQ)都做了大量 IPv6 的工作。当然主要也是接入层的改造，尽量不需要业务服务做太多修改。

## 总结

移动技术发展到今天，跨终端和跨技术栈的联合优化会变得越来越普遍。有的时候我们需要跳出客户端开发的视角，从更高的维度去思考整个大网络平台。当然网络优化的水还是非常深的，有时候我们需要对协议层也有比较深入的研究，也要经常关注国外的一些新的研究成果。

2018 年随着工信部发布《推进互联网协议第六版（IPv6）规模部署行动计划》的通知，所有的云提供商需要在 2020 年完成 IPv6 的支持。QUIC 在 2018 年被定为 HTTP/3 草案，同时 3GPP 也将 QUIC 列入 5G 核心网协议第二阶段标准（3GPP Release 16）。

随着 5G、QUIC 与 IPv6 未来在中国的普及，网络优化永不止步，它们将推动我们继续努力去做更多尝试，让用户可以有更好的网络体验。

## 课后作业

网络优化是一个很大的话题，在课后你还需要进一步扩展学习。除了今天文章里给出的链接，这里还提供一些参考资料给你：

- [微信客户端怎样应对弱网络](https://github.com/WeMobileDev/article/blob/master/%E5%BE%AE%E4%BF%A1%E5%AE%A2%E6%88%B7%E7%AB%AF%E6%80%8E%E6%A0%B7%E5%BA%94%E5%AF%B9%E5%BC%B1%E7%BD%91%E7%BB%9C.pdf)
- [阿里亿级日活网关通道架构演进](http://img.bigdatabugs.com/ArchSummit%E5%8C%97%E4%BA%AC-%E3%80%8A%E9%98%BF%E9%87%8C%E4%BA%BF%E7%BA%A7%E6%97%A5%E6%B4%BB%E7%BD%91%E5%85%B3%E9%80%9A%E9%81%93%E6%9E%B6%E6%9E%84%E6%BC%94%E8%BF%9B%E3%80%8B-%E6%B4%AA%E6%B5%B7%EF%BC%88%E5%AD%A4%E6%98%9F%EF%BC%89@www.bigDataBugs.com.pdf)
- [阿里巴巴 HTTP 2.0 实践及无线通信协议的演进之路](https://github.com/aozhimin/awesome-iOS-resource/blob/master/Conferences/%E9%98%BF%E9%87%8C%E5%B7%B4%E5%B7%B4HTTP%202.0%E5%AE%9E%E8%B7%B5%E5%8F%8A%E6%97%A0%E7%BA%BF%E9%80%9A%E4%BF%A1%E5%8D%8F%E8%AE%AE%E7%9A%84%E6%BC%94%E8%BF%9B%E4%B9%8B%E8%B7%AF.pdf)