---
title: "Effective Java概述"
---

本书主要内容共有10个章共78条规则，每章都涉及软件设计的一个主要方面。且每个条目之间都有一定程度的独立性，这些条目将会互相之间交叉引用。  

**本书中大多数规则都源于少数几条基本规则：**

1. 清晰性和简洁性最为重要：模块的用户永远也不应该被模块的行为所迷惑
2. 模块要尽可能的小，但不要太小「本书中所使用的属于*模块*，是指任何可重用的软件组件，从单个的方法到包含多个包的复杂系统，都可以是一个模块」
3. 代码应该被重用，而不是被复制
4. 模块之间的依赖应该保持最小
5. 错误应该尽早被检查出来，最好是在编译时刻

### 以下是本文的目录结构

**[1. 创建和销毁对象](/effective-java/chapter1/)**  
&emsp;[1. 考虑使用静态工厂方法替代构造器](/effective-java/chapter1/#_1)  
&emsp;[2. 遇到多个构造器参数时考虑使用建造者模式](/effective-java/chapter1/#_2)  
&emsp;[3. 使用私有构造器或者枚举类型强化Singleton属性](/effective-java/chapter1/#singleton)  
&emsp;[4. 通过私有构造器强化不可实例化的能力](/effective-java/chapter1/#_3)  
&emsp;[5. 避免创建不必要的对象](/effective-java/chapter1/#_4)  
&emsp;[6. 消除过期对象的引用](/effective-java/chapter1/#_5)  
&emsp;[7. 避免使用终结方法](/effective-java/chapter1/#_6)  

**[2. 对所有对象都通用的方法](/effective-java/chapter2/)**  
&emsp;[8. 覆盖equals时请遵守通用约定](/effective-java/chapter2/#equals)  
&emsp;[9. 覆盖equals时总要覆盖hashCode](/effective-java/chapter2/#equalshashcode)  
&emsp;[10. 始终要覆盖toString](/effective-java/chapter2/#tostring)  
&emsp;[11. 谨慎地覆盖clone](/effective-java/chapter2/#clone)  
&emsp;[12. 考虑实现Comparable接口](/effective-java/chapter2/#comparable)

**[3. 类和接口](/effective-java/chapter3/)**  
&emsp;[13. 使类和成员的可访问性最小化](/effective-java/chapter3/#_1)  
&emsp;[14. 在公有类中使用访问方法而非公有域](/effective-java/chapter3/#_2)  
&emsp;[15. 使可变性最小化](/effective-java/chapter3/#_3)  
&emsp;[16. 复合优先于继承](/effective-java/chapter3/#_4)  
&emsp;[17. 要么为继承设计，并提供文档说明；要么就禁止继承](/effective-java/chapter3/#_5)  
&emsp;[18. 接口优先于抽象类](/effective-java/chapter3/#_6)  
&emsp;[19. 接口只用于定义类型](/effective-java/chapter3/#_7)  
&emsp;[20. 类层次优先于标签类](/effective-java/chapter3/#_8)  
&emsp;[21. 用函数对象表示策略](/effective-java/chapter3/#_9)  
&emsp;[22. 优先考虑静态成员类](/effective-java/chapter3/#_10)

**4. 泛型**  
&emsp;23. 不要在新代码中使用原生态类型  
&emsp;24. 消除非受检警告  
&emsp;25. 列表优先于数组  
&emsp;26. 优先考虑泛型  
&emsp;27. 优先考虑泛型方法  
&emsp;28. 利用有限制通配符来提升API的灵活性  
&emsp;29. 优先考虑类型安全的异构容器  

**5. 枚举和注解**  
&emsp;30. 用enum代替int常量  
&emsp;31. 用实例域代替序数  
&emsp;32. 用EnumSet代替位域  
&emsp;33. 用EnumMap代替序数索引  
&emsp;34. 用接口模拟可伸缩的枚举  
&emsp;35. 注解优先于命名模式  
&emsp;36. 坚持使用Override注解  
&emsp;37. 用标记接口定义类型  

**6. 方法**  
&emsp;38. 检查参数的有效性  
&emsp;39. 必要时进行保护性拷贝  
&emsp;40. 谨慎设计方法签名  
&emsp;41. 慎用重载  
&emsp;42. 慎用可变参数  
&emsp;43. 返回零长度的数组或集合，而不是null  
&emsp;44. 为所有导出的API元素编写文档注释  

**7. 通用程序设计**  
&emsp;45. 将局部变量的作用域最小化  
&emsp;46. for-each循环优先于传统的for循环  
&emsp;47. 了解和使用类库  
&emsp;48. 如果需要精确的答案，请避免使用float和double  
&emsp;49. 基本类型优先于装箱基本类型  
&emsp;50. 如果其他类型更合适，则尽量避免使用字符串  
&emsp;51. 当心字符串连接的性能  
&emsp;52. 通过接口引用对象  
&emsp;53. 接口优先于反射机制  
&emsp;54. 谨慎地使用native方法  
&emsp;55. 谨慎地进行优化  
&emsp;56. 遵守普遍接受的命名惯例  

**8. 异常**  
&emsp;57. 只针对异常的情况才使用异常  
&emsp;58. 对可恢复的情况使用受检异常，对编程错误使用运行时异常  
&emsp;59. 避免不必要地使用受检异常  
&emsp;60. 优先使用标准的异常  
&emsp;61. 抛出与抽象相对应的异常  
&emsp;62. 每个方法抛出的异常都要有文档  
&emsp;63. 在细节消息中包含能捕获故障的消息  
&emsp;64. 努力使失败保持原子性  
&emsp;65. 不要忽略异常  

**9. 并发**  
&emsp;66. 同步访问共享的可变数据  
&emsp;67. 避免过度同步  
&emsp;68. executor和task优先于线程  
&emsp;69. 并发工具类优先于wait和notify  
&emsp;70. 线程安全性的文档化   
&emsp;71. 慎用延迟初始化  
&emsp;72. 不要依赖于线程调度器  
&emsp;73. 避免使用线程组

**10. 序列化**  
&emsp;74. 谨慎地实现Serializable接口  
&emsp;75. 考虑使用自定义的序列化形式  
&emsp;76. 保护性地编写readObject方法  
&emsp;77. 对于实例控制，枚举类型优先于readResolve  
&emsp;78. 考虑用序列化代理代替序列化实例  
