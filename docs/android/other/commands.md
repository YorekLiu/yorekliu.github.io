---
title: "Android开发常见命令"
---

## 1. Linux相关

|  位置  | 说明 |
| :- | :-- |
| /sys/devices/system/cpu/ | CPU相关信息目录，可正则匹配"CPU[0-9]+"得知设备有几个核 |
| /sys/devices/system/cpu/possible | CPU核心数。输出类似于“0-7”，也就是8个核 |
| /sys/devices/system/cpu/<br/>cpu<index\>/cpufreq/scaling_cur_freq | CPU通过软件设置的频率，一般与cpuinfo_cur_freq一致 |
| /sys/devices/system/cpu/<br/>cpu<index\>/cpufreq/cpuinfo_max_freq | CPU最大频率，关于cpufreq目录下面的文件，可以参考[Linux动态频率调节系统CPUFreq之一：概述](https://blog.csdn.net/gjy211/article/details/52223181) |
| /proc/<pid\>/stat | 进程相关信息，包括PID、进程名、状态、CPU时间片等 |
| /proc/<pid\>/task/ | 目录里面是所有线程的相关信息 |
| /proc/<pid\>/task/<tid\>/stat | 线程相关信息，同进程信息 |
| /proc/<pid\>/limits | 获取进程一些限制，比如文件描述符限制等 |
| /proc/<pid\>/fd/ | 目录下面是已打开的文件描述符的链接，可查询到打开的文件路径 |
| /proc/meminfo | 内存相关信息，总内存、没有分配的内存、可用内存、缓存等 |
| /proc/<pid\>/maps | 当前已经映射了的内存和它们的访问权限 |
| /proc/<pid\>/smaps | 进程每个mapping的内存消耗，包括RSS PSS等 |
| /proc/<pid\>/status | 虚拟内存使用大小、FD数、线程数、上下文切换次数等信息 |
| /proc/filesystems | 系统识别的文件系统列表 |

??? note "/proc/pid/stat信息如下" 
    样本:  
    10966 (terycanary.test) S 699 699 0 0 -1 1077952832 6187 0 0 0 22 2 0 0 20 0 17 0 9087400 5414273024
        24109 18446744073709551615 421814448128 421814472944 549131058960 0 0 0 4612 1 1073775864
        1 0 0 17 7 0 0 0 0 0 421814476800 421814478232 422247952384 549131060923 549131061022 549131061022
        549131063262 0
    
    字段:  
        - pid:  进程ID.  
        - comm: task_struct结构体的进程名  
        - state: 进程状态, 此处为S  
        - ppid: 父进程ID （父进程是指通过fork方式, 通过clone并非父进程）  
        - pgrp: 进程组ID  
        - session: 进程会话组ID  
        - tty_nr: 当前进程的tty终点设备号  
        - tpgid: 控制进程终端的前台进程号  
        - flags: 进程标识位, 定义在include/linux/sched.h中的PF_*, 此处等于1077952832  
        - minflt:  次要缺页中断的次数, 即无需从磁盘加载内存页. 比如COW和匿名页  
        - cminflt: 当前进程等待子进程的minflt  
        - majflt: 主要缺页中断的次数, 需要从磁盘加载内存页. 比如map文件  
        - majflt: 当前进程等待子进程的majflt  
        - utime: 该进程处于用户态的时间, 单位jiffies, 此处等于166114  
        - stime: 该进程处于内核态的时间, 单位jiffies, 此处等于129684  
        - cutime: 当前进程等待子进程的utime  
        - cstime: 当前进程等待子进程的utime  
        - priority: 进程优先级, 此次等于10.  
        - nice: nice值, 取值范围[19, -20], 此处等于-10  
        - num_threads: 线程个数, 此处等于221  
        - itrealvalue: 该字段已废弃, 恒等于0  
        - starttime: 自系统启动后的进程创建时间, 单位jiffies, 此处等于2284  
        - vsize: 进程的虚拟内存大小, 单位为bytes  
        - rss: 进程独占内存+共享库, 单位pages, 此处等于93087  
        - rsslim: rss大小上限  
    
    说明:  
    第10~17行主要是随着时间而改变的量；  
    内核时间单位, sysconf(_SC_CLK_TCK)一般地定义为jiffies(一般地等于10ms)  
    starttime: 此值单位为jiffies, 结合/proc/stat的btime, 可知道每一个线程启动的时间点  
    1500827856 + 2284/100 = 1500827856, 转换成北京时间为2017/7/24 0:37:58  
    第四行数据很少使用,只说一下该行第7至9个数的含义:  
    signal: 即将要处理的信号, 十进制, 此处等于6660   
    blocked: 阻塞的信号, 十进制  
    sigignore: 被忽略的信号, 十进制, 此处等于36088
        

## 2. ADB相关