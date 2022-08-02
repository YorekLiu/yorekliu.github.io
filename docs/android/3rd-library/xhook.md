---
title: "最常用的PLT Hook框架：xHook"  
tags:
  - xHook
  - plt
  - got
---

## 1. Native Hook流派介绍

PLT Hook是属于Native Hook的一种流派。Native流派可以分为三大类：

1. **GOT/PLT Hook**  
   GOT/PLT Hook 主要是用于替换某个 SO 的外部调用，通过将外部函数调用跳转成我们的目标函数。GOT/PLT Hook 可以说是一个非常经典的 Hook 方法，它非常稳定，可以达到部署到生产环境的标准。
2. **Trap Hook**  
   Trap Hook也可以称为断点Hook，其原理类似于调试器，可以Hook函数内部的调用。兼容性非常好，但是效率比较低，不适合Hook调用非常频繁的函数。
3. **Inline Hook**  
   Inline Hook也可以Hook函数内部的调用，它直接将函数开始（Prologue）处的指令更替为跳转指令，使得原函数直接跳转到 Hook 的目标函数函数，并保留原函数的调用接口以完成后续再调用回来的目的。  
   与 GOT/PLT Hook 相比，Inline Hook 可以不受 GOT/PLT 表的限制，几乎可以 Hook 任何函数。不过其实现十分复杂。

对于三种流派，更详细的文章可以参考张绍文老师的《[Native Hook 技术，天使还是魔鬼？](/android/paid/master/native_hook/)》。

## 2. PLT Hook

PLT Hook的原理，xHook也出了一篇Wiki来解释：《[Android PLT hook 概述](https://github.com/iqiyi/xHook/blob/master/docs/overview/android_plt_hook_overview.zh-CN.md)》

### 2.1 GOT与PLT

GOT与ELF的可以各用一句话来简单描述：  

- GOT是一个存储外部库函数的表
- PLT则是由代码片段组成的，每个代码片段都跳转到GOT表中的一个具体的函数调用

关于ELF文件的链接过程，在上面提到的两篇文章中都有讲述，这里简单回顾一下：

1. 外部函数调用在在编译期是无法知道的，编译器会引用 GOT 表来替代直接引用绝对地址。只有重定位后才会得到，GOT 自己本身将会包含函数引用的绝对地址。
2. 外部函数func在编译时会转为func@plt，并在PLT表中插入一条记录。PLT表中都是一段段可执行代码，这里面会跳到GOT表中进行解析，解析完毕后动态链接器会将这个实际地址填入GOT中。
3. 当第一次调用发生后，之后再调用函数 func 就高效简单很多。程序仍然会先调用 PLT，然后 PLT 也会跳到 GOT 中。GOT此时由于已经又了实际地址，可以直接指向 func，这样就高效的完成了函数调用。

这里也有一篇文章来介绍PLT与GOT之间的执行过程：[GOT表和PLT表](https://www.jianshu.com/p/0ac63c3744dd)。

### 2.2 PLT HOOK 原理

我们知道外部函数在调用时会经过PLT表到GOT表，这个步骤我们称之为重定位。重定位信息会位于`.rel(a).plt`、`.rel(a).dyn`、`.rel(a).android`这些section中。对于具体的so文件，可以使用`readelf -r`来判别。

动态链接器在处理重定位时，会查找所需符号的地址，将这个绝对地址填入到`.rel(a)xxx`中所指明的目标地址中，这些目标地址一般存在于`.got`中。

所以，我们只需要在`rel(a).xx` section中找到要hook方法的地址，将这个地址填上一个新的地址，这样就完成了hook的过程了。

在验证hook原理时，我们可以使用`readelf`工具直接从so文件中解析出目标方法的地址，下面通过一段粗暴的示例方法来演示。

## 3. 简单Hook例子

`libmemory.so`中有一些`__android_log_print`语句，我们可以将这个函数hook到自己的实现里面。手动验证流程如下：

1. 运行程序，待`libmemory.so`加载后，使用`cat /proc/<pid>/maps`找出lib的基地址：

   ```shell
   generic_arm64:/ # cat /proc/16421/maps | grep libmemory.so
   79c9c36000-79c9c38000 r-xp 00000000 fc:00 22304                          /data/app/xyz.yorek.performance-7kQtjiBxYXwZPhM3EOdAag==/lib/arm64/libmemory.so
   79c9c38000-79c9c39000 r--p 00001000 fc:00 22304                          /data/app/xyz.yorek.performance-7kQtjiBxYXwZPhM3EOdAag==/lib/arm64/libmemory.so
   79c9c39000-79c9c3a000 rw-p 00001000 fc:00 22304                          /data/app/xyz.yorek.performance-7kQtjiBxYXwZPhM3EOdAag==/lib/arm64/libmemory.so
   ```  

   一般情况下，第一行的第一个地址（0x79c9c36000）就是基地址，记为`base_addr`。

2. 使用`~/readelf -r libmemory.so`命令在重定位section中找出代替换函数的地址：
   
   ```shell
   $ ~/readelf -r libmemory.so | grep __android_log_print
   0000000000002b68  0000000600000402 R_AARCH64_JUMP_SLOT    0000000000000000 __android_log_print + 0
   ```

   这里的`0x0000000000002b68`就是函数的地址，记为`func_addr`。

3. 将`base_addr`、`func_addr`两个值设置到[示例程序](https://github.com/YorekLiu/APMSample/blob/master/app/src/main/java/xyz/yorek/performance/tools/case/PLTHookCaseUIWidgetProvider.kt)的两个输入框中，然后点击Hook按钮。这样，`libmemory.so`中的`__android_log_print`函数就被hook到了。

4. 在App中回到内存优化示例，依次点击线程模型下面的两个按钮。发现logcat中的输出被替换了，这就验证了hook的效果。
    ```shell
    2022-07-26 18:42:49.978 16421-16421/xyz.yorek.performance I/AppJNI: What r u taking about?
    ...
    ```

代码片段如下：

<small>[**app/src/main/cpp/AppJNI.cpp**](https://github.com/YorekLiu/APMSample/blob/master/app/src/main/cpp/AppJNI.cpp)</small>

```c++
#pragma PLTHook
#define PAGE_START(addr) ((addr) & PAGE_MASK)
#define PAGE_END(addr)   (PAGE_START(addr + sizeof(uintptr_t) - 1) + PAGE_SIZE)
#define PAGE_COVER(addr) (PAGE_END(addr) - PAGE_START(addr))

int my_log_print(int prio, const char* tag, const char* fmt, ...) {
    return __android_log_print(ANDROID_LOG_INFO, "AppJNI", "What r u taking about?");
}

void hook(uintptr_t base_addr, int32_t address)
{
    uintptr_t  addr;
    void* new_func = (void *) my_log_print;

    addr = base_addr + address;

    //add write permission
    mprotect((void *)PAGE_START(addr), PAGE_COVER(addr), PROT_READ | PROT_WRITE);

    //replace the function address
    *(void **)addr = new_func;

    //clear instruction cache
    __builtin___clear_cache(static_cast<char *>((void *) PAGE_START(addr)),
                            static_cast<char *>((void *) PAGE_END(addr)));
}

extern "C"
JNIEXPORT void JNICALL
Java_xyz_yorek_performance_tools_case_PLTHookCaseUIWidgetProvider_hook(JNIEnv *env, jobject thiz,
                                                                       jlong base_addr,
                                                                       jint address) {
    hook(base_addr, address);
}
```

可见，PLT hook的核心原理似乎有点简单？那么，掌握了核心科技的我们来看看，xHook是怎么样成为工业级的PLT Hook框架的。

## 4. ELF格式 & xHook源码解析

[iqiyi/xHook](https://github.com/iqiyi/xHook)

在上面的一步中，我们粗暴的实现了hook的功能。  
注意到，在获取函数的地址时，我们使用了`readelf`工具来协助我们。但是，在代码中我们就得依照ELF文件格式来解析出我们需要的地址了。这就免不了需要了解下ELF文件的格式。  
不过光说格式有点枯燥，我们可以010Editor，下载ELF.bt来解析so文件，最后对照着代码来看看xHook了做了些什么。

???+ success "一句话理解xHook"  
    首先，我们还是通过读取`/proc/self/maps`文件来依次获取到已加载的so库的基地址以及so文件名。对每个加载的so，进行正则匹配，判断出是不是我们需要hook的so。  
    若是需要处理的so，我们从得到的基地值中进行ELF文件的读取，并解析出我们关系的一些数据。  
    其次，我们获取从符号表（函数也是一种符号）中信息在字符串section找到与目标符号匹配的项，记住其索引。  
    最后，我们在`rel(a).plt`、`rel(a).dyn`以及`rel(a).android`这几个section中通过索引来判断是不是目标函数，若是则将其地址进行替换即可。
    
在下面的内容中，我们将以通过手动解析出`libmemory.so`里面的`__android_print_log`地址为例，来看看ELF文件格式以及xHook的流程。

### 4.1 xHook准备工作

下面是xHook的一些API。

```c
// 日志等级提高到debug级别
xhook_enable_debug(1);
// 开启段错误保护机制
xhook_enable_sigsegv_protection(1); 
// 注册要需要hook的so里面的__android_log_print方法
xhook_register(".*/.*\\.so$", "__android_log_print", my_log_print, nullptr); 
// 开始同步hook，0表示同步，1表示异步
xhook_refresh(0);
```

这里的准备工作我想主要说说xHook的段错误保护机制（SFP，segmentation fault protection）。

函数`xhook_enable_sigsegv_protection`只是置了一个标志位，在`xhook_refresh`时，会根据此标示位调用`xh_core_add_sigsegv_handler`函数。  

后者会使用`sigaction`操作注册`SIGSEGV`信号的signal handler，handler所对应的函数为`xh_core_sigsegv_handler`。这样，当有`SIGSEGV`信号发生时，`xh_core_sigsegv_handler`函数就可以处理到。
```c
static int xh_core_add_sigsegv_handler()
{
    struct sigaction act;

    if(!xh_core_sigsegv_enable) return 0;
    
    if(0 != sigemptyset(&act.sa_mask)) return (0 == errno ? XH_ERRNO_UNKNOWN : errno);
    act.sa_handler = xh_core_sigsegv_handler;
    
    if(0 != sigaction(SIGSEGV, &act, &xh_core_sigsegv_act_old))
        return (0 == errno ? XH_ERRNO_UNKNOWN : errno);

    return 0;
}
```

???+ tips "sigaction"  
    `sigaction`操作可以捕获所设定的一些信号。这个linux机制在Android中有相当多的应用，比如[native crash的捕获](https://mp.weixin.qq.com/s/g-WzYF3wWAljok1XjPoo7w?)、以及[捕获当前应用信息并以ANR格式输出](https://github.com/Tencent/matrix/blob/master/matrix/matrix-android/matrix-trace-canary/src/main/java/com/tencent/matrix/trace/tracer/SignalAnrTracer.java#L330)等。

`xh_core_sigsegv_handler`函数在执行时会判断`xh_core_sigsegv_flag`变量的值，如果为1则调用`siglongjmp`函数跳转到指定地方继续执行，这样就相当于吃掉了这个异常。否则，调用老的信号处理器处理这个信号。

```c
static void xh_core_sigsegv_handler(int sig)
{
    (void)sig;
    
    if(xh_core_sigsegv_flag)
        siglongjmp(xh_core_sigsegv_env, 1);
    else
        sigaction(SIGSEGV, &xh_core_sigsegv_act_old, NULL);
}
```

`xh_core_sigsegv_flag`变量的赋值是在容易发生段错误的两个地方——从内存中检查ELF文件头、实施Hook时，也就是说这个机制只会吃掉这两个特定位置的段错误。下面是检查ELF文件头的代码：

```c
static int xh_core_check_elf_header(uintptr_t base_addr, const char *pathname)
{
    if(!xh_core_sigsegv_enable)
    {
        return xh_elf_check_elfheader(base_addr);
    }
    else
    {
        int ret = XH_ERRNO_UNKNOWN;
        
        xh_core_sigsegv_flag = 1;
        if(0 == sigsetjmp(xh_core_sigsegv_env, 1))
        {
            ret = xh_elf_check_elfheader(base_addr);
        }
        else
        {
            ret = XH_ERRNO_SEGVERR;
            XH_LOG_WARN("catch SIGSEGV when check_elfheader: %s", pathname);
        }
        xh_core_sigsegv_flag = 0;
        return ret;
    }
}
```

这个位置就涉及到了两个函数间的调用——`sigsetjmp()`以及`siglongjmp()`。  

`sigsetjmp()`会保存目前堆栈环境，然后将目前的地址作一个记号，而在程序其他地方调用`siglongjmp()`时便会直接跳到这个记号位置，然后还原堆栈，继续程序的执行。 
当`sigsetjmp()`返回0时代表已经做好记号上，若返回非0则代表由`siglongjmp()`跳转回来。 

说完了xHook的段错误保护机制，下面正式进入hook的环节。

### 4.2 Hook流程

我们来到了`xh_core_refresh_impl`这个函数，该函数才是hook的起始函数。

首先依然是我们熟悉的cat `/proc/self/maps`操作，读取每行的数据，并以格式化的方式解析我们需要的字段：

```c
if(NULL == (fp = fopen("/proc/self/maps", "r")))
{
  XH_LOG_ERROR("fopen /proc/self/maps failed");
  return;
}

while(fgets(line, sizeof(line), fp))
{
  // PRIxPTR在64位系统是lx，32位是x
  // %x表示已16进制读取，带*表示忽略，%n的值不计入sscanf的返回值
  // 以下面这行为例
  // 79c9c36000-79c9c38000 r-xp 00000000 fc:00 22304     /data/app/xyz.yorek.performance-7kQtjiBxYXwZPhM3EOdAag==/lib/arm64/libmemory.so
  // 这里取得base_addr=0x79c9c36000 perm=r-xp offset=00000000 
  // pathname_pos指向如下位置，但是不计入sscanf的返回值，所以这个例子就是返回3
  // 79c9c36000-79c9c38000 r-xp 00000000 fc:00 22304     /data/app/xyz.yorek.performance-7kQtjiBxYXwZPhM3EOdAag==/lib/arm64/libmemory.so
  //                                                ^
  if(sscanf(line, "%"PRIxPTR"-%*lx %4s %lx %*x:%*x %*d%n", &base_addr, perm, &offset, &pathname_pos) != 3) continue;
  ...
}
```

紧接着，下面就对取到的数据做了一些判断，过滤掉了一些非so文件的行。同时，单个so文件里面有多个`PT_LOAD`的segment的话，也会有多条mmap记录，这里找出了具备可执行权限且offset为0的这一行，做进一步的处理。

```c
// do not touch the shared memory
if (perm[3] != 'p') continue;

// Ignore permission PROT_NONE maps
if (perm[0] == '-' && perm[1] == '-' && perm[2] == '-')
   continue;

//get pathname
while(isspace(line[pathname_pos]) && pathname_pos < (int)(sizeof(line) - 1))
   pathname_pos += 1;
if(pathname_pos >= (int)(sizeof(line) - 1)) continue;
pathname = line + pathname_pos;
pathname_len = strlen(pathname);
if(0 == pathname_len) continue;
if(pathname[pathname_len - 1] == '\n')
{
   pathname[pathname_len - 1] = '\0';
   pathname_len -= 1;
}
if(0 == pathname_len) continue;
if('[' == pathname[0]) continue;

// Find non-executable map, we need record it. Because so maps can begin with
// an non-executable map.
if (perm[2] != 'x') {
   prev_offset = offset;
   prev_base_addr = base_addr;
   memcpy(prev_perm, perm, sizeof(prev_perm));
   strcpy(prev_pathname, pathname);
   continue;
}

// Find executable map if offset == 0, it OK,
// or we need check previous map for base address.
if (offset != 0) {
   if (strcmp(prev_pathname, pathname) || prev_offset != 0 || prev_perm[0] != 'r') {
       continue;
   }
   // The previous map is real begin map
   base_addr = prev_base_addr;
}
```

这里我们得到了so文件的基地址，但是这个地址不一定精确，具体还要看第一个`PT_LOAD`里面的offset。前者减去后者才是so文件真正的基地址，这个在后面会看到。  

`xh_core_refresh_impl`函数的后面会判断`pathname`是不是可以匹配上待hook的so名称，若匹配得上，则对此时的基地址进行ELF文件头的检查。检查通过之后，会对这个ELF进行hook操作。

这里我们看看ELF文件头应该满足什么样的格式，我们直接看64位的：

=== "xHook"

    ```c
    int xh_elf_check_elfheader(uintptr_t base_addr)
    {
       ElfW(Ehdr) *ehdr = (ElfW(Ehdr) *)base_addr;
 
       //check magic
       if(0 != memcmp(ehdr->e_ident, ELFMAG, SELFMAG)) return XH_ERRNO_FORMAT;
 
       //check class (64/32)
    #if defined(__LP64__)
       if(ELFCLASS64 != ehdr->e_ident[EI_CLASS]) return XH_ERRNO_FORMAT;
    #else
       if(ELFCLASS32 != ehdr->e_ident[EI_CLASS]) return XH_ERRNO_FORMAT;
    #endif
 
       //check endian (little/big)
       if(ELFDATA2LSB != ehdr->e_ident[EI_DATA]) return XH_ERRNO_FORMAT;
 
       //check version
       if(EV_CURRENT != ehdr->e_ident[EI_VERSION]) return XH_ERRNO_FORMAT;
 
       //check type
       if(ET_EXEC != ehdr->e_type && ET_DYN != ehdr->e_type) return XH_ERRNO_FORMAT;
 
       //check machine
    #if defined(__arm__)
       if(EM_ARM != ehdr->e_machine) return XH_ERRNO_FORMAT;
    #elif defined(__aarch64__)
       if(EM_AARCH64 != ehdr->e_machine) return XH_ERRNO_FORMAT;
    #elif defined(__i386__)
       if(EM_386 != ehdr->e_machine) return XH_ERRNO_FORMAT;
    #elif defined(__x86_64__)
       if(EM_X86_64 != ehdr->e_machine) return XH_ERRNO_FORMAT;
    #else
       return XH_ERRNO_FORMAT;
    #endif
 
       //check version
       if(EV_CURRENT != ehdr->e_version) return XH_ERRNO_FORMAT;
 
       return 0;
    }
    ```

=== "Elf64_Ehdr"

    ```c
    #define ET_NONE 0
    #define ET_REL 1
    #define ET_EXEC 2
    #define ET_DYN 3
    #define ET_CORE 4
    ...

    #define EI_CLASS 4
    #define EI_DATA 5
    #define EI_VERSION 6
    #define EI_OSABI 7
    #define EI_PAD 8
    #define ELFMAG0 0x7f
    #define ELFMAG1 'E'
    #define ELFMAG2 'L'
    #define ELFMAG3 'F'
    #define ELFMAG "\177ELF"
    #define SELFMAG 4
    #define ELFCLASSNONE 0
    #define ELFCLASS32 1
    #define ELFCLASS64 2
    #define ELFCLASSNUM 3
    #define ELFDATANONE 0
    #define ELFDATA2LSB 1
    #define ELFDATA2MSB 2
    #define EV_NONE 0
    #define EV_CURRENT 1
    ...

    #if defined(__LP64__)
    #define ElfW(type) Elf64_ ## type
    #else
    #define ElfW(type) Elf32_ ## type
    #endif

    #define EI_NIDENT 16
    // 字段含义可以看右边tab截图
    typedef struct elf64_hdr {
      unsigned char e_ident[EI_NIDENT];
      Elf64_Half e_type;
      Elf64_Half e_machine;
      Elf64_Word e_version;
      Elf64_Addr e_entry;
      Elf64_Off e_phoff;      // PHT段开始的offset
      Elf64_Off e_shoff;      // SHT段开始的offset
      Elf64_Word e_flags;
      Elf64_Half e_ehsize;    // elf64_hdr占的byte数
      Elf64_Half e_phentsize; // PHT占的byte数
      Elf64_Half e_phnum;     // PHT个数
      Elf64_Half e_shentsize; // SHT占的byte数
      Elf64_Half e_shnum;     // SHT个数
      Elf64_Half e_shstrndx;  // .shstrtab在SHT中的index
    } Elf64_Ehdr;
    ```

=== "libmemory.so二进制"  
    ![libmemory.so二进制](/assets/images/linux/elf_header.webp)

显然，我们知道这里检查了ELF文件头里面包含的魔数(\177ELF)、Class位数、小端对齐等信息，通过了这些检验后，这段地址里面mmap的可能就是一个ELF文件了。  

ELF文件头里面还有其他的一些信息，比如PHT(Program header table)、SHT(section header table)这两大部分开始的offset、内部的个数等。后面用到的时候再说。

下面看看hook操作`xh_core_hook_impl()`的实现。这会首先调用`xh_elf_init`方法完成整个ELF的解析，然后根据so名称进行名单匹配并调用`xh_elf_hook`进行进一步的hook。

```c
static void xh_core_hook_impl(xh_core_map_info_t *mi)
{
    //init
    if(0 != xh_elf_init(&(mi->elf), mi->base_addr, mi->pathname)) return;
    
    //hook
    ...
    int ignore;
    TAILQ_FOREACH(hi, &xh_core_hook_info, link) //find hook info
    {
        if(...)
        {
            ignore = 0;
            ...

            if(0 == ignore)
                xh_elf_hook(&(mi->elf), hi->symbol, hi->new_func, hi->old_func);
        }
    }
}
```

这里的重头戏就是`xh_elf_init`函数了，还是多方对照看看到底解析出了什么东西。

#### 4.2.1 ELF格式解析

首先重制了`xh_elf_t`变量，这是xHook用来保存elf信息的结构体。然后记录了so文件的路径、elf文件mmap之后的绝对地址、elf header的起始地址、program header table的起始地址了（也同时是第一个PHT的起始位置）。

```c
int xh_elf_init(xh_elf_t *self, uintptr_t base_addr, const char *pathname)
{
    if(0 == base_addr || NULL == pathname) return XH_ERRNO_INVAL;

    //always reset
    memset(self, 0, sizeof(xh_elf_t));
    
    self->pathname = pathname;
    self->base_addr = (ElfW(Addr))base_addr;
    self->ehdr = (ElfW(Ehdr) *)base_addr;
    self->phdr = (ElfW(Phdr) *)(base_addr + self->ehdr->e_phoff); //segmentation fault sometimes

    ...
}
```

=== "基本类型定义"

    ```c
    typedef __u64 Elf64_Addr;
    typedef __u16 Elf64_Half;
    typedef __s16 Elf64_SHalf;
    typedef __u64 Elf64_Off;
    typedef __s32 Elf64_Sword;
    typedef __u32 Elf64_Word;
    typedef __u64 Elf64_Xword;
    typedef __s64 Elf64_Sxword;
    ```

=== "Elf64_Phdr"

    ```c
    // program table header
    typedef struct elf64_phdr {
      Elf64_Word p_type;
      Elf64_Word p_flags;
      Elf64_Off p_offset;
      Elf64_Addr p_vaddr;
      Elf64_Addr p_paddr;
      Elf64_Xword p_filesz;
      Elf64_Xword p_memsz;
      Elf64_Xword p_align;
    } Elf64_Phdr;
    ```

接下来就要寻找到第一个`p_type`为`PT_LOAD(0x01)`类型的segment了，并将其`p_vaddr`作为被减数，其差为真正的基地址。

=== "xHook源码"

    ```c
    int xh_elf_init(xh_elf_t *self, uintptr_t base_addr, const char *pathname)
    {
       ...
        //find the first load-segment with offset 0
        ElfW(Phdr) *phdr0 = xh_elf_get_first_segment_by_type_offset(self, PT_LOAD, 0);
        if(NULL == phdr0)
        {
            XH_LOG_ERROR("Can NOT found the first load segment. %s", pathname);
            return XH_ERRNO_FORMAT;
        }
    
    #if XH_ELF_DEBUG
        if(0 != phdr0->p_vaddr)
            XH_LOG_DEBUG("first load-segment vaddr NOT 0 (vaddr: %p). %s",
                         (void *)(phdr0->p_vaddr), pathname);
    #endif
    
        //save load bias addr
        if(self->base_addr < phdr0->p_vaddr) return XH_ERRNO_FORMAT;
        self->bias_addr = self->base_addr - phdr0->p_vaddr;
        ...
    }
    
    static ElfW(Phdr) *xh_elf_get_first_segment_by_type_offset(xh_elf_t *self, ElfW(Word) type, ElfW(Off) offset)
    {
        ElfW(Phdr) *phdr;
        
        for(phdr = self->phdr; phdr < self->phdr + self->ehdr->e_phnum; phdr++)
        {
            if(phdr->p_type == type && phdr->p_offset == offset)
            {
                return phdr;
            }
        }
        return NULL;
    }
    ```

=== "二进制"  
    这里第一段`PT_LOAD`的segment的`p_vaddr`为0。

    ![elf_pht](/assets/images/linux/elf_pht.webp)

确定基地址之后，马上又会解析`p_type`为`PT_DYNAMIC(0x02)`的segment。从这个segment中，我们可以知道各个section的起始位置。  
`Elf64_Dyn`是一个占16byte的结构体，第一个8byte是类型，第二个8byte是地址值(ptr)或者是简单的值(val)。  

`readelf -d`命令可以帮助我们理解dynamic部分的解析结果。

=== "xHook"

    ```c
    //parse dynamic-segment
    self->dyn          = (ElfW(Dyn) *)(self->bias_addr + dhdr->p_vaddr);
    self->dyn_sz       = dhdr->p_memsz;
    ElfW(Dyn) *dyn     = self->dyn;
    ElfW(Dyn) *dyn_end = self->dyn + (self->dyn_sz / sizeof(ElfW(Dyn)));
    uint32_t  *raw;
    for(; dyn < dyn_end; dyn++)
    {
        switch(dyn->d_tag) //segmentation fault sometimes
        {
        case DT_NULL:
            //the end of the dynamic-section
            dyn = dyn_end;
            break;
        case DT_STRTAB:
            {
                self->strtab = (const char *)(self->bias_addr + dyn->d_un.d_ptr);
                if((ElfW(Addr))(self->strtab) < self->base_addr) return XH_ERRNO_FORMAT;
                break;
            }
        case DT_SYMTAB:
            {
                self->symtab = (ElfW(Sym) *)(self->bias_addr + dyn->d_un.d_ptr);
                if((ElfW(Addr))(self->symtab) < self->base_addr) return XH_ERRNO_FORMAT;
                break;
            }
        case DT_PLTREL:
            //use rel or rela?
            self->is_use_rela = (dyn->d_un.d_val == DT_RELA ? 1 : 0);
            break;
        case DT_JMPREL:
            {
                self->relplt = (ElfW(Addr))(self->bias_addr + dyn->d_un.d_ptr);
                if((ElfW(Addr))(self->relplt) < self->base_addr) return XH_ERRNO_FORMAT;
                break;
            }
        case DT_PLTRELSZ:
            self->relplt_sz = dyn->d_un.d_val;
            break;
        case DT_REL:
        case DT_RELA:
            {
                self->reldyn = (ElfW(Addr))(self->bias_addr + dyn->d_un.d_ptr);
                if((ElfW(Addr))(self->reldyn) < self->base_addr) return XH_ERRNO_FORMAT;
                break;
            }
        case DT_RELSZ:
        case DT_RELASZ:
            self->reldyn_sz = dyn->d_un.d_val;
            break;
        case DT_ANDROID_REL:
        case DT_ANDROID_RELA:
            {
                self->relandroid = (ElfW(Addr))(self->bias_addr + dyn->d_un.d_ptr);
                if((ElfW(Addr))(self->relandroid) < self->base_addr) return XH_ERRNO_FORMAT;
                break;
            }
        case DT_ANDROID_RELSZ:
        case DT_ANDROID_RELASZ:
            self->relandroid_sz = dyn->d_un.d_val;
            break;
        case DT_HASH:
            {
                //ignore DT_HASH when ELF contains DT_GNU_HASH hash table
                if(1 == self->is_use_gnu_hash) continue;

                raw = (uint32_t *)(self->bias_addr + dyn->d_un.d_ptr);
                if((ElfW(Addr))raw < self->base_addr) return XH_ERRNO_FORMAT;
                self->bucket_cnt  = raw[0];
                self->chain_cnt   = raw[1];
                self->bucket      = &raw[2];
                self->chain       = &(self->bucket[self->bucket_cnt]);
                break;
            }
        case DT_GNU_HASH:
            {
                // d_un.p_ptr=0x648
                raw = (uint32_t *)(self->bias_addr + dyn->d_un.d_ptr);
                if((ElfW(Addr))raw < self->base_addr) return XH_ERRNO_FORMAT;
                self->bucket_cnt  = raw[0];  // 0x648位置的第一个32位是0x02
                self->symoffset   = raw[1];  // 0x13
                self->bloom_sz    = raw[2];  // 0x04
                self->bloom_shift = raw[3];  // 0x1a
                self->bloom       = (ElfW(Addr) *)(&raw[4]);  // 地址是0x658
                self->bucket      = (uint32_t *)(&(self->bloom[self->bloom_sz]));
                self->chain       = (uint32_t *)(&(self->bucket[self->bucket_cnt]));
                self->is_use_gnu_hash = 1;
                break;
            }
        default:
            break;
        }
    }
    ```

=== "Elf64_Dyn"

    ```c
    typedef __u64 Elf64_Addr;
    typedef __u64 Elf64_Xword;
    typedef __s64 Elf64_Sxword;
    
    typedef struct {
      Elf64_Sxword d_tag;
      union {
        Elf64_Xword d_val;
        Elf64_Addr d_ptr;
      } d_un;
    } Elf64_Dyn;
    
    
    ```

=== "二进制"
    
    ELF文件分为链接视图与执行视图，我们010Editor直接查看的是文件本身。执行时data的offset以`p_vaddr`为准，读取文件时以`p_offset`为准。

    ![elf_dynamic](/assets/images/linux/elf_dynamic.webp)

=== "readelf"  

    ```shell
    $ ~/readelf -d libmemory.so
    Dynamic section at offset 0x1938 contains 28 entries:
    Tag                Type           Name/Value
    0x0000000000000001 (NEEDED)       Shared library: [libxhook.so]
    0x0000000000000001 (NEEDED)       Shared library: [liblog.so]
    0x0000000000000001 (NEEDED)       Shared library: [libm.so]
    0x0000000000000001 (NEEDED)       Shared library: [libdl.so]
    0x0000000000000001 (NEEDED)       Shared library: [libc.so]
    0x000000000000000e (SONAME)       Library soname: [libmemory.so]
    0x000000000000001e (FLAGS)        BIND_NOW
    0x000000006ffffffb (FLAGS_1)      NOW
    0x0000000000000007 (RELA)         0xb08
    0x0000000000000008 (RELASZ)       120 (bytes)
    0x0000000000000009 (RELAENT)      24 (bytes)
    0x000000006ffffff9 (RELACOUNT)    3
    0x0000000000000017 (JMPREL)       0xb80
    0x0000000000000002 (PLTRELSZ)     552 (bytes)
    0x0000000000000003 (PLTGOT)       0x2b08
    0x0000000000000014 (PLTREL)       RELA
    0x0000000000000006 (SYMTAB)       0x2f8
    0x000000000000000b (SYMENT)       24 (bytes)
    0x0000000000000005 (STRTAB)       0x7a4
    0x000000000000000a (STRSZ)        865 (bytes)
    0x000000006ffffef5 (GNU_HASH)     0x648
    0x0000000000000004 (HASH)         0x6ac
    0x000000000000001a (FINI_ARRAY)   0x2928
    0x000000000000001c (FINI_ARRAYSZ) 16 (bytes)
    0x000000006ffffff0 (VERSYM)       0x5c8
    0x000000006ffffffe (VERNEED)      0x604
    0x000000006fffffff (VERNEEDNUM)   2
    0x0000000000000000 (NULL)         0x0
    ```

下面是以libmemory.so为例，看看各个tag代表的含义。

| tag名 | tag值 | 含义 | value值 |
| ----- | ---- | ---- | ------ |
| DT_NEEDED | 0x01 | 依赖项 | 0x0336，对应着字符串libxhook.so |
| DT_SONAME | 0x0e | so名称 | 0x0354 | 
| DT_RELA | 0x07 | 重定位表rela.dyn的位置 | 0x0b08 |
| DT_RELASZ | 0x08 | 重定位表rela.dyn的byte数 | 0x78，也就是120个byte |
| DT_JMPREL | 0x17 | rel.plt段的位置 | 0xb80 |
| DT_PLTRELSZ | 0x02 | rel.plt的byte数 | 552个byte |
| DT_PLTREL | 0x14 | 使用rela还是rel，前者比后者多一个字段`r_addend` | 0x07，如果是这个值表示使用rela |
| DT_SYMTAB | 0x06 | 符号表的位置 | 0x2f8 |
| DT_STRTAB | 0x05 | 字符串表的位置 | 0x7a4 |
| DT_HASH | 0x04 | 动态链接hash表的位置 | 0x6ac |
| DT_GNU_HASH | 0x6ffffef5 | GNU hash表的位置，如果先遇到了这个type，则使用这种hash方式 | 0x648 |
| DT_REL | 0x11 | 重定位表rel.dyn的位置 | / |
| DT_RELSZ | 0x12 | 重定位表rel.dyn的byte数 | / |
| DT_ANDROID_REL | 0x6000000f | 重定位表rel.android的位置 | / |
| DT_ANDROID_RELSZ | 0x60000010 | 重定位表rel.android的byte数 | / |
| DT_ANDROID_RELA | 0x60000011 | 重定位表rela.android的位置 | / |
| DT_ANDROID_RELASZ | 0x60000012 | 重定位表rela.android的byte数 | / |

这里说明一下解析流程中的一些环节：

1. 对于0x01、0x0e这两种类型，后面8个byte为字符串池的相对地址。我们解析出类型0x05（字符串池）时得到了字符串池的起始地址，将这两个地址相加就得到了一个地址，这个地址在so中查找出来一个字符串。  
 比如拿第一个type来说，其值为0x0336（小端对齐），字符串池起始地址为0x07a4，两者相加为0xada。0xada在文件中的就对应着一个字符串的开始地址，字符串以'\0'结束。  
 ![elf_strtab](/assets/images/linux/elf_strtab.webp)
2. 在so中到底使用rel还是rela来解析重定位信息，需要看`DT_PLTREL`类型的值。这个位置确定了处理so的各个重定位信息时以什么样的结构处理。

`xh_elf_init`函数后面就是对`rel(a).android`区域以及对获取到的一些变量的检查工作了，这里不是重点。  

至此ELF文件的初始化过程完成了。这里检查了第一个`PT_LOAD`类型的segment来获取到真正的基地址；然后通过`PT_DYNAMIC`类型的segment里面的偏移量解析出了各个表的一些值并保存了起来。  
下面我们来看看后续的hook操作。

#### 4.2.2 Hook操作

在`xh_elf_hook`函数中我们首先会根据要hook的符号在符号表中进行查找，找到后返回其index。然后在各个重定位区域中遍历，依据某种与index的关系来进行运算匹配，匹配上之后修改其结构中的地址为新函数的地址。

```c
int xh_elf_hook(xh_elf_t *self, const char *symbol, void *new_func, void **old_func)
{
    uint32_t                        symidx;
    ...
    
    //find symbol index by symbol name
    if(0 != (r = xh_elf_find_symidx_by_name(self, symbol, &symidx))) return 0;
    
    //replace for .rel(a).plt
    if(0 != self->relplt)
    {
        xh_elf_plain_reloc_iterator_init(&plain_iter, self->relplt, self->relplt_sz, self->is_use_rela);
        while(NULL != (rel_common = xh_elf_plain_reloc_iterator_next(&plain_iter)))
        {
            if(0 != (r = xh_elf_find_and_replace_func(self,
                                                      (self->is_use_rela ? ".rela.plt" : ".rel.plt"), 1,
                                                      symbol, new_func, old_func,
                                                      symidx, rel_common, &found))) return r;
            if(found) break;
        }
    }

    //replace for .rel(a).dyn
    if(0 != self->reldyn)
    {
        xh_elf_plain_reloc_iterator_init(&plain_iter, self->reldyn, self->reldyn_sz, self->is_use_rela);
        while(NULL != (rel_common = xh_elf_plain_reloc_iterator_next(&plain_iter)))
        {
            if(0 != (r = xh_elf_find_and_replace_func(self,
                                                      (self->is_use_rela ? ".rela.dyn" : ".rel.dyn"), 0,
                                                      symbol, new_func, old_func,
                                                      symidx, rel_common, NULL))) return r;
        }
    }

    //replace for .rel(a).android
    if(0 != self->relandroid)
    {
        xh_elf_packed_reloc_iterator_init(&packed_iter, self->relandroid, self->relandroid_sz, self->is_use_rela);
        while(NULL != (rel_common = xh_elf_packed_reloc_iterator_next(&packed_iter)))
        {
            if(0 != (r = xh_elf_find_and_replace_func(self,
                                                      (self->is_use_rela ? ".rela.android" : ".rel.android"), 0,
                                                      symbol, new_func, old_func,
                                                      symidx, rel_common, NULL))) return r;
        }
    }
    
    return 0;
}
```

首先还是看看查找过程，这里由于已经确定了使用.gnu.hash的方式，会首先使用GNU hash查找，然后在直接在符号表中查找。

```c
static int xh_elf_find_symidx_by_name(xh_elf_t *self, const char *symbol, uint32_t *symidx)
{
    if(self->is_use_gnu_hash)
        return xh_elf_gnu_hash_lookup(self, symbol, symidx);
    else
        return xh_elf_hash_lookup(self, symbol, symidx);
}

static int xh_elf_gnu_hash_lookup(xh_elf_t *self, const char *symbol, uint32_t *symidx)
{
    if(0 == xh_elf_gnu_hash_lookup_def(self, symbol, symidx)) return 0;
    if(0 == xh_elf_gnu_hash_lookup_undef(self, symbol, symidx)) return 0;
    return XH_ERRNO_NOTFND;
}
```

GNU hash里面的算法稍显复杂，里面涉及到了布隆过滤器。简单来说，就是通过布隆过滤器看看输入symbol有没有可能在符合要求，若又可能满足要求，则进行进一步的判断。  
这部分更详细的理解可以查看[从实例分析ELF格式的.gnu.hash区与glibc的符号查找](https://blog.51cto.com/u_15127634/3273122)。

```c
static int xh_elf_gnu_hash_lookup_def(xh_elf_t *self, const char *symbol, uint32_t *symidx)
{
    uint32_t hash = xh_elf_gnu_hash((uint8_t *)symbol);
    
    static uint32_t elfclass_bits = sizeof(ElfW(Addr)) * 8;
    size_t word = self->bloom[(hash / elfclass_bits) % self->bloom_sz];
    size_t mask = 0
        | (size_t)1 << (hash % elfclass_bits)
        | (size_t)1 << ((hash >> self->bloom_shift) % elfclass_bits);

    //if at least one bit is not set, this symbol is surely missing
    if((word & mask) != mask) return XH_ERRNO_NOTFND;

    //ignore STN_UNDEF
    uint32_t i = self->bucket[hash % self->bucket_cnt];
    if(i < self->symoffset) return XH_ERRNO_NOTFND;
    
    //loop through the chain
    while(1)
    {
        XH_LOG_DEBUG("xh_elf_gnu_hash_lookup_def symbol=%s pathname=%s", symbol, self->pathname);
        const char     *symname = self->strtab + self->symtab[i].st_name;
        const uint32_t  symhash = self->chain[i - self->symoffset];
        
        if((hash | (uint32_t)1) == (symhash | (uint32_t)1) && 0 == strcmp(symbol, symname))
        {
            *symidx = i;
            XH_LOG_INFO("found %s at symidx: %u (GNU_HASH DEF)\n", symbol, *symidx);
            return 0;
        }
        
        //chain ends with an element with the lowest bit set to 1
        if(symhash & (uint32_t)1) break;
        
        i++;
    }
    
    return XH_ERRNO_NOTFND;
}
```

如果在上面的步骤中没有找到的话，会接在符号表中查找中查找，也就是`xh_elf_gnu_hash_lookup_undef`函数。我们要找的示例中的`__android_log_print`是在这里找到的。  

=== "xHook"

    ```c
    static int xh_elf_gnu_hash_lookup_undef(xh_elf_t *self, const char *symbol, uint32_t *symidx)
    {
        uint32_t i;
        
        // self->symoffset=0x13，也就是19个
        // self->strtab也就是指字符串池，指向的地址是0x7a4
        // self->symtab是一个ElfW(Sym)结构，在64位下是Elf64_Sym，结构体定义如右边，指向的地址是0x2f8
        for(i = 0; i < self->symoffset; i++)
        {
            // self->symtab[i].st_name指的是相对于字符串池的地址，因此symname就是一个个符号的名字了
            const char *symname = self->strtab + self->symtab[i].st_name;
            // 比较名字，若匹配记下索引并返回
            if(0 == strcmp(symname, symbol))
            {
                *symidx = i;
                XH_LOG_INFO("found %s at symidx: %u (GNU_HASH UNDEF)\n", symbol, *symidx);
                return 0;
            }
        }
        return XH_ERRNO_NOTFND;
    }
    ```

=== "Elf64_Sym"  

    ```c
    typedef struct elf64_sym {
      Elf64_Word st_name;  // __u32
      unsigned char st_info;  // 8
      unsigned char st_other; // 8
      Elf64_Half st_shndx; // __u16
      Elf64_Addr st_value; // __u64
      Elf64_Xword st_size; // __u64
    } Elf64_Sym; // 总计192bit=24byte
    ```

=== "二进制"  

    ![elf_symtab](/assets/images/linux/elf_symtab.webp)

    
从0x2f8开始，每24个byte作为一个`Elf64_Sym`结构体，`st_name`字段占4个byte，我们拿这个值加上字符串池的基地址开始解析出字符串。  
解析到图中`C9 01 00 00 ...`部分的时候，0x01c9+0x7a4=0x96d。我们发现对应的字符串就是`__android_log_print`字符串，这就是我们想要的东西。此时index为6，记下这里的6，我们后面进行hook时还要判断这个数。

hook的时候，对于三个`rel(a)`重定位区域，实际上执行的操作都比较类似。只不过对于特定类型，在进行检查的时候标志位有点不同。   
在`xh_elf_find_and_replace_func`函数中先进行了一些检查，检查完毕后累加获得目标符号在内存中的地址，最后调用了`xh_elf_find_and_replace_func`函数进行真正的hook。实际上我们简单例子中的代码，就是来自于这里的最后一步。

=== "xHook"

    ```c
    static int xh_elf_find_and_replace_func(xh_elf_t *self, const char *section,
                                            int is_plt, const char *symbol,
                                            void *new_func, void **old_func,
                                            uint32_t symidx, void *rel_common,
                                            int *found)
    {
        ElfW(Rela)    *rela;
        ElfW(Rel)     *rel;
        ElfW(Addr)     r_offset;
        size_t         r_info;
        size_t         r_sym;
        size_t         r_type;
        ElfW(Addr)     addr;
        int            r;
    
        if(NULL != found) *found = 0;
        
        if(self->is_use_rela)
        {
            rela = (ElfW(Rela) *)rel_common;
            r_info = rela->r_info;
            r_offset = rela->r_offset;
        }
        else
        {
            rel = (ElfW(Rel) *)rel_common;
            r_info = rel->r_info;
            r_offset = rel->r_offset;
        }
    
        //check sym
        // #define XH_ELF_R_SYM(info)  ELF64_R_SYM(info)
        // #define ELF64_R_SYM(i) ((i) >> 32)
        r_sym = XH_ELF_R_SYM(r_info); // r_info >> 32
        if(r_sym != symidx) return 0;
    
        //check type
        // #define XH_ELF_R_TYPE(info) ELF64_R_TYPE(info)
        // #define ELF64_R_TYPE(i) ((i) & 0xffffffff)
        r_type = XH_ELF_R_TYPE(r_info); // r_info & 0xffffffff
        // #define XH_ELF_R_GENERIC_JUMP_SLOT R_AARCH64_JUMP_SLOT
        // #define XH_ELF_R_GENERIC_GLOB_DAT  R_AARCH64_GLOB_DAT
        // #define XH_ELF_R_GENERIC_ABS       R_AARCH64_ABS64
        // #define R_AARCH64_ABS64                 257
        // #define R_AARCH64_GLOB_DAT              1025    /* Create GOT entry.  */
        // #define R_AARCH64_JUMP_SLOT             1026    /* Create PLT entry.  */
        if(is_plt && r_type != XH_ELF_R_GENERIC_JUMP_SLOT) return 0;
        if(!is_plt && (r_type != XH_ELF_R_GENERIC_GLOB_DAT && r_type != XH_ELF_R_GENERIC_ABS)) return 0;
    
        //we found it
        XH_LOG_INFO("found %s at %s offset: %p\n", symbol, section, (void *)r_offset);
        if(NULL != found) *found = 1;
    
        //do replace
        addr = self->bias_addr + r_offset;
        if(addr < self->base_addr) return XH_ERRNO_FORMAT;
        if(0 != (r = xh_elf_replace_function(self, symbol, addr, new_func, old_func)))
        {
            XH_LOG_ERROR("replace function failed: %s at %s\n", symbol, section);
            return r;
        }
    
        return 0;
    }
    ```

=== "Elf64_Rel(a)"  
    
    ```c
    typedef struct elf64_rela {
      Elf64_Addr r_offset;
      Elf64_Xword r_info;
      Elf64_Sxword r_addend;
    } Elf64_Rela;  // 64 * 3 bit = 24 byte

    typedef struct elf64_rel {
      Elf64_Addr r_offset;
      Elf64_Xword r_info;
    } Elf64_Rel;
    ```

=== "二进制"  
    
    ![elf_rela_plt](/assets/images/linux/elf_rela_plt.webp)

我们从`.rel(a).plt`区域开始一个个比对，在我们的示例中`rela.plt`的起始位置是在0xb80，`Elf64_Rela`结构体占24个byte。所以每24个byte为一个单元，依次比较这个单元中第二个8byte的数据。  

我们首先要找的就是`xx xx xx xx 06 00 00 00`这样的数据，找到了之后比较前面的4个byte是不是0x0402也就是1026。幸运的是，我们找到了，这就是我们要hook的位置了。示例中这个单元开始的地址是`0xC58`，可见上面tab的二进制分页。

然后我们取这个单元的第一个8byte作为函数的相对地址`r_offset`，加上这个ELF文件在mmap之后的基地址，这个地址就成了我们替换函数的地址了。  
示例中，这个符号的相对地址就是`0x2b68`。不过这个数字我们似乎很熟悉，在全文搜索`2b68`后我们发现，这就是我们使用`readelf -r`读出来的`__android_log_print`的地址。🤔

很多疑问似乎都得到了解决，我们通过手动解析ELF文件，得到了想要得到的东西，也深入了解了一下ELF文件的构造。

最后，有了ELF文件的基地址以及目标函数的相对地址之后，下面的`xh_elf_find_and_replace_func`基本与Hook例子中的如出一辙。  
但是在Hook例子中有些东西没有说，这里说一下。

1. 内存访问权限：我们可以从maps返回的内容判断有哪些权限。执行hook时需要有写入权限，这个权限可以使用`mprotect`来完成权限的修改，执行hook后最好还原一下权限。注意修改内存访问权限时，只能以“页”为单位。
2. 指令缓存：.got 和 .data 的 section 类型是 PROGBITS，也就是执行代码。处理器可能会对这部分数据做缓存。修改内存地址后，我们需要清除处理器的指令缓存，让处理器重新从内存中读取这部分指令。方法是调用 `__builtin___clear_cache`。这里的参数也是以页为单位。

```c
static int xh_elf_replace_function(xh_elf_t *self, const char *symbol, ElfW(Addr) addr, void *new_func, void **old_func)
{
    void         *old_addr;
    unsigned int  old_prot = 0;
    unsigned int  need_prot = PROT_READ | PROT_WRITE;
    int           r;

    //already replaced?
    //here we assume that we always have read permission, is this a problem?
    if(*(void **)addr == new_func) return 0;

    //get old prot
    if(0 != (r = xh_util_get_addr_protect(addr, self->pathname, &old_prot)))
    {
        XH_LOG_ERROR("get addr prot failed. ret: %d", r);
        return r;
    }
    
    if(old_prot != need_prot)
    {
        //set new prot
        if(0 != (r = xh_util_set_addr_protect(addr, need_prot)))
        {
            XH_LOG_ERROR("set addr prot failed. ret: %d", r);
            return r;
        }
    }
    
    //save old func
    old_addr = *(void **)addr;
    if(NULL != old_func) *old_func = old_addr;

    //replace func
    *(void **)addr = new_func; //segmentation fault sometimes

    if(old_prot != need_prot)
    {
        //restore the old prot
        if(0 != (r = xh_util_set_addr_protect(addr, old_prot)))
        {
            XH_LOG_WARN("restore addr prot failed. ret: %d", r);
        }
    }
    
    //clear cache
    xh_util_flush_instruction_cache(addr);

    XH_LOG_INFO("XH_HK_OK %p: %p -> %p %s %s\n", (void *)addr, old_addr, new_func, symbol, self->pathname);
    return 0;
}
```

至此，hook过程就完全结束了。  

## 5. 小结

我们hook demo出发，完成了对xHook核心原理的梳理，也对ELF文件的执行过程、文件格式做了一定的了解。  

在xHook中，我们在ELF的 `PT_LOAD` segment 中断定出ELF在内存中的基地址。通过解析 `PT_DYNAMIC` segment，得到了各个 section 的位置，然后我们结合`.gnu.hash`、`.strtab`、`.symtab` section，找到了目标 symbol 的索引index。然后在`.rel(a).plt`、`.rel(a).dyn`、`.rel(a).android`区域中进行对index进行一番运算、检查，最后找到了目标symbol的地址。最后依据地址，进行了最后的hook操作。  

PLT Hook听上去似乎很高端，在研究了一下ELF文件格式以及链接、执行过程之后，发现原理也还挺简单的。

[^1]:[man readelf](https://man7.org/linux/man-pages/man1/readelf.1.html)
[^2]:[Native Hook 技术，天使还是魔鬼？](/android/paid/master/native_hook/)
[^3]:[Android PLT hook 概述](https://github.com/iqiyi/xHook/blob/master/docs/overview/android_plt_hook_overview.zh-CN.md)
[^4]:[GOT表和PLT表](https://www.jianshu.com/p/0ac63c3744dd)
[^5]:[native crash的捕获](https://mp.weixin.qq.com/s/g-WzYF3wWAljok1XjPoo7w?)
[^6]:[Matrix-SignalAnrTracer：通过发送SIGQUIT信号使ANR日志主动生成](https://github.com/Tencent/matrix/blob/master/matrix/matrix-android/matrix-trace-canary/src/main/java/com/tencent/matrix/trace/tracer/SignalAnrTracer.java#L330)
[^7]:[从实例分析ELF格式的.gnu.hash区与glibc的符号查找](https://blog.51cto.com/u_15127634/3273122)