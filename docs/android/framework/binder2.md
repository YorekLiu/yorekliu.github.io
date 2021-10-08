---
title: "Binder深入理解——罗老师系列"
---

本博客Binder系列：

1. [Binder简介](/android/paid/zsxq/week11-binder/)
2. [Binder深入理解——以MediaService为例](/android/framework/binder1-mediaservice/)，基于[Android深入浅出之Binder机制](http://www.cnblogs.com/innost/archive/2011/01/09/1931456.html)
3. [Binder深入理解——罗老师系列](/android/framework/binder2/)，基于[Android进程间通信（IPC）机制Binder简要介绍和学习计划](https://blog.csdn.net/luoshengyang/article/details/6618363)

---

## 1 [Service Manager是如何成为守护进程的](https://blog.csdn.net/luoshengyang/article/details/6621566)  

本节着重介绍组件Service Manager，它是整个Binder机制的守护进程，用来管理开发者创建的各种Server，并且向Client提供查询Server远程接口的功能。  

既然Service Manager组件是用来管理Server并且向Client提供查询Server远程接口的功能，那么，Service Manager就必然要和Server以及Client进行通信了。我们知道，Service Manger、Client和Server三者分别是运行在独立的进程当中，这样它们之间的通信也属于进程间通信了，而且也是采用Binder机制进行进程间通信，因此，Service Manager在充当Binder机制的守护进程的角色的同时，也在充当Server的角色，然而，它是一种特殊的Server，下面我们将会看到它的特殊之处。

在第2.1.8-BnServiceManager中，我们简单谈到了这部分内容，本节会进行更加深入的讲解。  

本章kernel源码地址为[https://android.googlesource.com/kernel/goldfish.git](https://android.googlesource.com/kernel/goldfish.git)，分支名为[android-goldfish-2.6.29](https://android.googlesource.com/kernel/goldfish.git/+/android-goldfish-2.6.29)

Service Manager的main函数有三个功能：

1. 打开Binder设备文件
2. 告诉Binder驱动程序自己是Binder上下文管理者，即守护线程
3. 进入无穷循环，充当Server的角色，等待Client的请求

**frameworks/base/cmds/servicemanager/service_manager.c**

```c
int main(int argc, char **argv)
{
    struct binder_state *bs;
    void *svcmgr = BINDER_SERVICE_MANAGER;

    bs = binder_open(128*1024);

    if (binder_become_context_manager(bs)) {
        LOGE("cannot become context manager (%s)\n", strerror(errno));
        return -1;
    }

    svcmgr_handle = svcmgr;
    binder_loop(bs, svcmgr_handler);
    return 0;
}
```

`binder_state`结构体描述如下：

**frameworks/base/cmds/servicemanager/binder.c**
```c
struct binder_state
{
    int fd;               // 打开/dev/binder设备文件描述符
    void *mapped;         // 设备文件/dev/binder映射到进程控件的起始地址
    unsigned mapsize;     // 上述内存映射空间的大小
};
```

宏`BINDER_SERVICE_MANAGER`定义在 **frameworks/base/cmds/servicemanager/binder.h** 中

```c
#define BINDER_SERVICE_MANAGER ((void*) 0)
```

它表示Service Manager的句柄为0。Binder通信机制使用句柄来代表远程接口，这个句柄的意义和Windows编程中用到的句柄是差不多的概念。  
前面说到，Service Manager在充当守护进程的同时，它充当Server的角色，当它作为远程接口使用时，它的句柄值便为0，这就是它的特殊之处，其余的Server的远程接口句柄值都是一个大于0，而且由Binder驱动程序自动进行分配的。

`main`函数首先执行`binder_open`打开Binder设备文件：

```c
struct binder_state *binder_open(unsigned mapsize)
{
    struct binder_state *bs;

    bs = malloc(sizeof(*bs));
    if (!bs) {
        errno = ENOMEM;
        return 0;
    }

    bs->fd = open("/dev/binder", O_RDWR);
    if (bs->fd < 0) {
        fprintf(stderr,"binder: cannot open device (%s)\n",
                strerror(errno));
        goto fail_open;
    }

    bs->mapsize = mapsize;
    bs->mapped = mmap(NULL, mapsize, PROT_READ, MAP_PRIVATE, bs->fd, 0);
    if (bs->mapped == MAP_FAILED) {
        fprintf(stderr,"binder: cannot map device (%s)\n",
                strerror(errno));
        goto fail_map;
    }

        /* TODO: check version */

    return bs;

fail_map:
    close(bs->fd);
fail_open:
    free(bs);
    return 0;
}
```

通过文件操作函数`open`来打开/dev/binder设备文件。  
设备文件/dev/binder是在Binder驱动程序模块初始化的时候创建的，我们先看一下这个设备文件的创建过程。  
先可以看到模块初始化入口`binder_init`：

**kernel/drivers/staging/android/binder.c**

```c
static struct file_operations binder_fops = {
	.owner = THIS_MODULE,
	.poll = binder_poll,
	.unlocked_ioctl = binder_ioctl,
	.mmap = binder_mmap,
	.open = binder_open,
	.flush = binder_flush,
	.release = binder_release,
};

static struct miscdevice binder_miscdev = {
	.minor = MISC_DYNAMIC_MINOR,
	.name = "binder",
	.fops = &binder_fops
};

static int __init binder_init(void)
{
	int ret;

	binder_proc_dir_entry_root = proc_mkdir("binder", NULL);
	if (binder_proc_dir_entry_root)
		binder_proc_dir_entry_proc = proc_mkdir("proc", binder_proc_dir_entry_root);
	ret = misc_register(&binder_miscdev);
	if (binder_proc_dir_entry_root) {
		create_proc_read_entry("state", S_IRUGO, binder_proc_dir_entry_root, binder_read_proc_state, NULL);
		create_proc_read_entry("stats", S_IRUGO, binder_proc_dir_entry_root, binder_read_proc_stats, NULL);
		create_proc_read_entry("transactions", S_IRUGO, binder_proc_dir_entry_root, binder_read_proc_transactions, NULL);
		create_proc_read_entry("transaction_log", S_IRUGO, binder_proc_dir_entry_root, binder_read_proc_transaction_log, &binder_transaction_log);
		create_proc_read_entry("failed_transaction_log", S_IRUGO, binder_proc_dir_entry_root, binder_read_proc_transaction_log, &binder_transaction_log_failed);
	}
	return ret;
}
```

创建设备文件的地方在`misc_register`函数里。`binder_init`函数的其他逻辑主要是在/proc目录创建各种Binder相关的文件，供用户访问。  

从设备文件的操作方法`binder_fops`可以看出，前面的`binder_open`函数执行语句`open("/dev/binder", O_RDWR)`就进入Binder驱动程序的`binder_open`函数了。

```c
static int binder_open(struct inode *nodp, struct file *filp)
{
	struct binder_proc *proc;

	if (binder_debug_mask & BINDER_DEBUG_OPEN_CLOSE)
		printk(KERN_INFO "binder_open: %d:%d\n", current->group_leader->pid, current->pid);

	proc = kzalloc(sizeof(*proc), GFP_KERNEL);
	if (proc == NULL)
		return -ENOMEM;
	get_task_struct(current);
	proc->tsk = current;
	INIT_LIST_HEAD(&proc->todo);
	init_waitqueue_head(&proc->wait);
	proc->default_priority = task_nice(current);
	mutex_lock(&binder_lock);
	binder_stats.obj_created[BINDER_STAT_PROC]++;
	hlist_add_head(&proc->proc_node, &binder_procs);
	proc->pid = current->group_leader->pid;
	INIT_LIST_HEAD(&proc->delivered_death);    // 2
	filp->private_data = proc;                 // 1
	mutex_unlock(&binder_lock);

	if (binder_proc_dir_entry_proc) {
		char strbuf[11];
		snprintf(strbuf, sizeof(strbuf), "%u", proc->pid);
		remove_proc_entry(strbuf, binder_proc_dir_entry_proc);
		create_proc_read_entry(strbuf, S_IRUGO, binder_proc_dir_entry_proc, binder_read_proc_proc, proc);
	}

	return 0;
}
```

这个函数的主要作用是创建一个struct`binder_proc`数据结构来保存打开设备文件/dev/binder的进程的上下文信息，并且将这个进程上下文信息保存在打开文件结构struct`file`的私有数据成员变量`private_data`中。这样，在执行其它文件操作时，就通过打开文件结构struct`file`来取回这个进程上下文信息了。这个进程上下文信息同时还会保存在一个全局哈希表`binder_procs`中，驱动程序内部使用。

```c
static HLIST_HEAD(binder_procs);
```

结构体`binder_proc`的定义如下，rb_root表示红黑树：

```c
struct binder_proc {
	struct hlist_node proc_node;
	struct rb_root threads;          // 保存binder_proc进程内用于处理用户请求的线程，最大数量由max_threads决定
	struct rb_root nodes;            // 保存binder_proc进程内的Binder实体
	// 下面两个都表示保存binder_proc进程内的Binder引用，即引用的其它进程的Binder实体
	struct rb_root refs_by_desc;     // 以句柄为key值
	struct rb_root refs_by_node;     // 以引用的实体节点的地址值为key值
	int pid;
	struct vm_area_struct *vma;
	struct task_struct *tsk;
	struct files_struct *files;
	struct hlist_node deferred_work_node;
	int deferred_work;
	void *buffer;                    // 表示要映射的物理内存在内核空间中的起始位置
	// 内核使用的虚拟地址与进程使用的虚拟地址之间的差值
	// 即如果某个物理页面在内核空间中对应的虚拟地址是addr的话
	// 那么这个物理页面在进程空间对应的虚拟地址就为addr + user_buffer_offset
	ptrdiff_t user_buffer_offset;

	struct list_head buffers;
	struct rb_root free_buffers;
	struct rb_root allocated_buffers;
	size_t free_async_space;

	struct page **pages;             // struct page是用来描述物理页面的数据结构
	size_t buffer_size;              // 要映射的内存的大小
	uint32_t buffer_free;
	struct list_head todo;
	wait_queue_head_t wait;
	struct binder_stats stats;
	struct list_head delivered_death;
	int max_threads;
	int requested_threads;
	int requested_threads_started;
	int ready_threads;
	long default_priority;
};
```

这样设备文件/dev/binder就打开了，接着是对打开的设备文件进行内存映射操作`mmap(NULL, mapsize, PROT_READ, MAP_PRIVATE, bs->fd, 0)`，对应Binder驱动程序的`binder_mmap`操作：

```c
static int binder_mmap(struct file *filp, struct vm_area_struct *vma)
{
	int ret;
	struct vm_struct *area;
	struct binder_proc *proc = filp->private_data;
	const char *failure_string;
	struct binder_buffer *buffer;

	if ((vma->vm_end - vma->vm_start) > SZ_4M)
		vma->vm_end = vma->vm_start + SZ_4M;

	if (binder_debug_mask & BINDER_DEBUG_OPEN_CLOSE)
		printk(KERN_INFO
			"binder_mmap: %d %lx-%lx (%ld K) vma %lx pagep %lx\n",
			proc->pid, vma->vm_start, vma->vm_end,
			(vma->vm_end - vma->vm_start) / SZ_1K, vma->vm_flags,
			(unsigned long)pgprot_val(vma->vm_page_prot));

	if (vma->vm_flags & FORBIDDEN_MMAP_FLAGS) {
		ret = -EPERM;
		failure_string = "bad vm_flags";
		goto err_bad_arg;
	}
	vma->vm_flags = (vma->vm_flags | VM_DONTCOPY) & ~VM_MAYWRITE;

	if (proc->buffer) {
		ret = -EBUSY;
		failure_string = "already mapped";
		goto err_already_mapped;
	}

	area = get_vm_area(vma->vm_end - vma->vm_start, VM_IOREMAP);
	if (area == NULL) {
		ret = -ENOMEM;
		failure_string = "get_vm_area";
		goto err_get_vm_area_failed;
	}
	proc->buffer = area->addr;
	proc->user_buffer_offset = vma->vm_start - (uintptr_t)proc->buffer;

#ifdef CONFIG_CPU_CACHE_VIPT
	if (cache_is_vipt_aliasing()) {
		while (CACHE_COLOUR((vma->vm_start ^ (uint32_t)proc->buffer))) {
			printk(KERN_INFO "binder_mmap: %d %lx-%lx maps %p bad alignment\n", proc->pid, vma->vm_start, vma->vm_end, proc->buffer);
			vma->vm_start += PAGE_SIZE;
		}
	}
#endif
	proc->pages = kzalloc(sizeof(proc->pages[0]) * ((vma->vm_end - vma->vm_start) / PAGE_SIZE), GFP_KERNEL);
	if (proc->pages == NULL) {
		ret = -ENOMEM;
		failure_string = "alloc page array";
		goto err_alloc_pages_failed;
	}
	proc->buffer_size = vma->vm_end - vma->vm_start;

	vma->vm_ops = &binder_vm_ops;
	vma->vm_private_data = proc;

	if (binder_update_page_range(proc, 1, proc->buffer, proc->buffer + PAGE_SIZE, vma)) {
		ret = -ENOMEM;
		failure_string = "alloc small buf";
		goto err_alloc_small_buf_failed;
	}
	buffer = proc->buffer;
	INIT_LIST_HEAD(&proc->buffers);
	list_add(&buffer->entry, &proc->buffers);
	buffer->free = 1;
	binder_insert_free_buffer(proc, buffer);
	proc->free_async_space = proc->buffer_size / 2;
	barrier();
	proc->files = get_files_struct(current);
	proc->vma = vma;

	/*printk(KERN_INFO "binder_mmap: %d %lx-%lx maps %p\n", proc->pid, vma->vm_start, vma->vm_end, proc->buffer);*/
	return 0;

err_alloc_small_buf_failed:
	kfree(proc->pages);
	proc->pages = NULL;
err_alloc_pages_failed:
	vfree(proc->buffer);
	proc->buffer = NULL;
err_get_vm_area_failed:
err_already_mapped:
err_bad_arg:
	printk(KERN_ERR "binder_mmap: %d %lx-%lx %s failed %d\n", proc->pid, vma->vm_start, vma->vm_end, failure_string, ret);
	return ret;
}
```

函数首先通过`filp->private_data`得到在打开设备文件/dev/binder时创建的struct`binder_proc`结构。内存映射信息放在`vma`参数中。  

注意，这里的`vma`的数据类型是struct`vm_area_struct`，它表示的是一块连续的虚拟地址空间区域，在函数变量声明的地方，我们还看到有一个类似的结构体struct`vm_struct`，这个数据结构也是表示一块连续的虚拟地址空间区域，那么，**这两者的区别是什么呢？**  
在Linux中，struct`vm_area_struct`表示的虚拟地址是给进程使用的，而struct`vm_struct`表示的虚拟地址是给内核使用的，它们对应的物理页面都可以是不连续的。struct`vm_area_struct`表示的地址空间范围是0~3G，而struct`vm_struc`t表示的地址空间范围是(3G + 896M + 8M) ~ 4G。  
struct`vm_struct`表示的地址空间范围为什么不是3G~4G呢？原来，**3G ~ (3G + 896M)范围的地址是用来映射连续的物理页面的，这个范围的虚拟地址和对应的实际物理地址有着简单的对应关系，即对应0~896M的物理地址空间。而(3G + 896M) ~ (3G + 896M + 8M)是安全保护区域（例如，所有指向这8M地址空间的指针都是非法的）**，因此struct`vm_struct`使用(3G + 896M + 8M) ~ 4G地址空间来映射非连续的物理页面。

> 有关Linux的内存管理知识，可以参考罗老师的[Android学习启动篇](https://blog.csdn.net/luoshengyang/article/details/6557518)一文提到的《Understanding the Linux Kernel》一书中的第8章。

这里为什么会同时使用进程虚拟地址空间和内核虚拟地址空间来映射同一个物理页面呢？这就是Binder进程间通信机制的精髓所在了。**同一个物理页面，一方映射到进程虚拟地址空间，一方面映射到内核虚拟地址空间，这样，进程和内核之间就可以减少一次内存拷贝了，提到了进程间通信效率**。举个例子如，Client要将一块内存数据传递给Server，一般的做法是，Client将这块数据从它的进程空间拷贝到内核空间中，然后内核再将这个数据从内核空间拷贝到Server的进程空间，这样，Server就可以访问这个数据了。但是在这种方法中，执行了两次内存拷贝操作，而采用我们上面提到的方法，只需要把Client进程空间的数据拷贝一次到内核空间，然后Server与内核共享这个数据就可以了，整个过程只需要执行一次内存拷贝，提高了效率。

`binder_mmap`的原理讲完了，这个函数的逻辑就好理解了。再解释一下Binder驱动程序管理这个内存映射地址空间的方法，即是如何管理buffer ~ (buffer + buffer_size)这段地址空间的，这个地址空间被划分为一段一段来管理，每一段是结构体struct `binder_buffer`来描述：

```c
struct binder_buffer {
	struct list_head entry; /* free and allocated entries by addesss */
	struct rb_node rb_node; /* free entry by size or allocated entry */
				/* by address */
	unsigned free : 1;
	unsigned allow_user_free : 1;
	unsigned async_transaction : 1;
	unsigned debug_id : 29;

	struct binder_transaction *transaction;

	struct binder_node *target_node;
	size_t data_size;
	size_t offsets_size;
	uint8_t data[0];
};
```

每一个`binder_buffer`通过其成员`entry`按从低址到高地址连入到struct `binder_proc`中的`buffers`表示的链表中去，同时，每一个`binder_buffer`又分为正在使用的和空闲的，通过`free`成员变量来区分，空闲的`binder_buffer`通过成员变量`rb_node`连入到struct `binder_proc`中的`free_buffers`表示的红黑树中去，正在使用的`binder_buffer`通过成员变量`rb_node`连入到struct `binder_proc`中的`allocated_buffers`表示的红黑树中去。这样做当然是为了方便查询和维护这块地址空间了，这一点我们可以从其它的代码中看到，等遇到的时候我们再分析。

现在回到`binder_mmap`函数，首先是对参数作一些健康体检（sanity check），例如，要映射的内存大小不能超过SIZE_4M，即4M，回到service_manager.c中的main 函数，这里传进来的值是128 * 1024个字节，即128K。通过健康体检后，调用`get_vm_area`函数获得一个空闲的`vm_struct`区间，并初始化`proc`结构体的`buffer`、`user_buffer_offset`、`pages`和`buffer_size`成员变量，接着调用`binder_update_page_range`来为虚拟地址空间proc->buffer ~ proc->buffer + PAGE_SIZE分配一个空闲的物理页面，同时这段地址空间使用一个`binder_buffer`来描述，分别插入到`proc->buffers`链表和`proc->free_buffers`红黑树中去，最后，还初始化了proc结构体的`free_async_space`、`files`和`vma`三个成员变量。

我们进入`binder_update_page_range`看一下Binder驱动程序是如何实现把一个物理页面同时映射到内核空间和进程空间去的。  

```c
static int binder_update_page_range(struct binder_proc *proc, int allocate,
	void *start, void *end, struct vm_area_struct *vma)
{
	void *page_addr;
	unsigned long user_page_addr;
	struct vm_struct tmp_area;
	struct page **page;
	struct mm_struct *mm;

	if (binder_debug_mask & BINDER_DEBUG_BUFFER_ALLOC)
		printk(KERN_INFO "binder: %d: %s pages %p-%p\n",
		       proc->pid, allocate ? "allocate" : "free", start, end);

	if (end <= start)
		return 0;

	if (vma)
		mm = NULL;
	else
		mm = get_task_mm(proc->tsk);

	if (mm) {
		down_write(&mm->mmap_sem);
		vma = proc->vma;
	}

	if (allocate == 0)
		goto free_range;

	if (vma == NULL) {
		printk(KERN_ERR "binder: %d: binder_alloc_buf failed to "
		       "map pages in userspace, no vma\n", proc->pid);
		goto err_no_vma;
	}

	for (page_addr = start; page_addr < end; page_addr += PAGE_SIZE) {
		int ret;
		struct page **page_array_ptr;
		page = &proc->pages[(page_addr - proc->buffer) / PAGE_SIZE];

		BUG_ON(*page);
		*page = alloc_page(GFP_KERNEL | __GFP_ZERO);
		if (*page == NULL) {
			printk(KERN_ERR "binder: %d: binder_alloc_buf failed "
			       "for page at %p\n", proc->pid, page_addr);
			goto err_alloc_page_failed;
		}
		tmp_area.addr = page_addr;
		tmp_area.size = PAGE_SIZE + PAGE_SIZE /* guard page? */;
		page_array_ptr = page;
		ret = map_vm_area(&tmp_area, PAGE_KERNEL, &page_array_ptr);
		if (ret) {
			printk(KERN_ERR "binder: %d: binder_alloc_buf failed "
			       "to map page at %p in kernel\n",
			       proc->pid, page_addr);
			goto err_map_kernel_failed;
		}
		user_page_addr =
			(uintptr_t)page_addr + proc->user_buffer_offset;
		ret = vm_insert_page(vma, user_page_addr, page[0]);
		if (ret) {
			printk(KERN_ERR "binder: %d: binder_alloc_buf failed "
			       "to map page at %lx in userspace\n",
			       proc->pid, user_page_addr);
			goto err_vm_insert_page_failed;
		}
		/* vm_insert_page does not seem to increment the refcount */
	}
	if (mm) {
		up_write(&mm->mmap_sem);
		mmput(mm);
	}
	return 0;

free_range:
	for (page_addr = end - PAGE_SIZE; page_addr >= start;
	     page_addr -= PAGE_SIZE) {
		page = &proc->pages[(page_addr - proc->buffer) / PAGE_SIZE];
		if (vma)
			zap_page_range(vma, (uintptr_t)page_addr +
				proc->user_buffer_offset, PAGE_SIZE, NULL);
err_vm_insert_page_failed:
		unmap_kernel_range((unsigned long)page_addr, PAGE_SIZE);
err_map_kernel_failed:
		__free_page(*page);
		*page = NULL;
err_alloc_page_failed:
		;
	}
err_no_vma:
	if (mm) {
		up_write(&mm->mmap_sem);
		mmput(mm);
	}
	return -ENOMEM;
}
```

这个函数既可以分配物理页面，也可以用来释放物理页面，通过allocate参数来区别，这里我们只关注分配物理页面的情况。要分配物理页面的虚拟地址空间范围为(start ~ end)，函数前面的一些检查逻辑就不看了，直接看中间的for循环：

```c
for (page_addr = start; page_addr < end; page_addr += PAGE_SIZE) {
  int ret;
  struct page **page_array_ptr;
  page = &proc->pages[(page_addr - proc->buffer) / PAGE_SIZE];

  BUG_ON(*page);
  *page = alloc_page(GFP_KERNEL | __GFP_ZERO);
  if (*page == NULL) {
    printk(KERN_ERR "binder: %d: binder_alloc_buf failed "
           "for page at %p\n", proc->pid, page_addr);
    goto err_alloc_page_failed;
  }
  tmp_area.addr = page_addr;
  tmp_area.size = PAGE_SIZE + PAGE_SIZE /* guard page? */;
  page_array_ptr = page;
  ret = map_vm_area(&tmp_area, PAGE_KERNEL, &page_array_ptr);
  if (ret) {
    printk(KERN_ERR "binder: %d: binder_alloc_buf failed "
           "to map page at %p in kernel\n",
           proc->pid, page_addr);
    goto err_map_kernel_failed;
  }
  user_page_addr =
    (uintptr_t)page_addr + proc->user_buffer_offset;
  ret = vm_insert_page(vma, user_page_addr, page[0]);
  if (ret) {
    printk(KERN_ERR "binder: %d: binder_alloc_buf failed "
           "to map page at %lx in userspace\n",
           proc->pid, user_page_addr);
    goto err_vm_insert_page_failed;
  }
  /* vm_insert_page does not seem to increment the refcount */
}
```

首先是调用`alloc_page`来分配一个物理页面，这个函数返回一个struct `page`物理页面描述符，根据这个描述的内容初始化好`struct vm_struct tmp_area`结构体，然后通过`map_vm_area`将这个物理页面插入到`tmp_area`描述的内核空间去，接着通过page_addr + proc->user_buffer_offset获得进程虚拟空间地址，并通过`vm_insert_page`函数将这个物理页面插入到进程地址空间去，参数`vma`代表了要插入的进程的地址空间。

这样Service Manager的主函数中`binder_open`已经完成了功能，下面看看`binder_become_context_manager`函数如何让Service Manager成为守护线程的。  

**frameworks/base/cmds/servicemanager/binder.c**
```c
int binder_become_context_manager(struct binder_state *bs)
{
    return ioctl(bs->fd, BINDER_SET_CONTEXT_MGR, 0);
}
```

这里通过调用`ioctl`文件操作函数来通知Binder驱动程序自己是守护进程，命令号是`BINDER_SET_CONTEXT_MGR`，没有参数。  
`BINDER_SET_CONTEXT_MGR`的定义在kernel中，为`#define	BINDER_SET_CONTEXT_MGR		_IOW('b', 7, int)`。

然后就进入了Binder驱动程序的`binder_ioctl`函数（**why??**），这里我们只关注`BINDER_SET_CONTEXT_MGR`。

> From: [https://www.jianshu.com/p/49830c3473b7](https://www.jianshu.com/p/49830c3473b7)  
> ioctl是Linux中常见的系统调用，它用于对底层设备的一些特性进行控制的用户态接口，应用程序在调用ioctl进行设备控制时，最后会调用到设备注册struct file_operations结构体对象时的unlocked_ioctl或者compat_ioctl两个钩子上，具体是调用哪个钩子判断标准如下：  
> compat_ioctl : 32位的应用运行在64位的内核上，这个钩子被调用。  
> unlocked_ioctl: 64位的应用运行在64位的内核或者32位的应用运行在32位的内核上，则调用这个钩子。  
> Binder做为Android中进程间高效通信的核心组件，其底层是以misc设备驱动的形式实现的，但它本身并没有实现read,write操作，所有的控制都是通过ioctl操作来实现。在Binder驱动的struct file_operations定义中可见，它的compat_ioctl和unlocked_ioctl两个钩子的的实现都是对应到binder_ioctl上的。

```c
static long binder_ioctl(struct file *filp, unsigned int cmd, unsigned long arg)
{
	int ret;
	struct binder_proc *proc = filp->private_data;
	struct binder_thread *thread;
	unsigned int size = _IOC_SIZE(cmd);
	void __user *ubuf = (void __user *)arg;

	/*printk(KERN_INFO "binder_ioctl: %d:%d %x %lx\n", proc->pid, current->pid, cmd, arg);*/

	ret = wait_event_interruptible(binder_user_error_wait, binder_stop_on_user_error < 2);
	if (ret)
		return ret;

	mutex_lock(&binder_lock);
	thread = binder_get_thread(proc);
	if (thread == NULL) {
		ret = -ENOMEM;
		goto err;
	}

	switch (cmd) {
	...
	case BINDER_SET_CONTEXT_MGR:
		if (binder_context_mgr_node != NULL) {
			printk(KERN_ERR "binder: BINDER_SET_CONTEXT_MGR already set\n");
			ret = -EBUSY;
			goto err;
		}
		if (binder_context_mgr_uid != -1) {
			if (binder_context_mgr_uid != current->cred->euid) {
				printk(KERN_ERR "binder: BINDER_SET_"
				       "CONTEXT_MGR bad uid %d != %d\n",
				       current->cred->euid,
				       binder_context_mgr_uid);
				ret = -EPERM;
				goto err;
			}
		} else
			binder_context_mgr_uid = current->cred->euid;
		binder_context_mgr_node = binder_new_node(proc, NULL, NULL);
		if (binder_context_mgr_node == NULL) {
			ret = -ENOMEM;
			goto err;
		}
		binder_context_mgr_node->local_weak_refs++;
		binder_context_mgr_node->local_strong_refs++;
		binder_context_mgr_node->has_strong_ref = 1;
		binder_context_mgr_node->has_weak_ref = 1;
		break;
	...
	default:
		ret = -EINVAL;
		goto err;
	}
	ret = 0;
err:
	if (thread)
		thread->looper &= ~BINDER_LOOPER_STATE_NEED_RETURN;
	mutex_unlock(&binder_lock);
	wait_event_interruptible(binder_user_error_wait, binder_stop_on_user_error < 2);
	if (ret && ret != -ERESTARTSYS)
		printk(KERN_INFO "binder: %d:%d ioctl %x %lx returned %d\n", proc->pid, current->pid, cmd, arg, ret);
	return ret;
}
```

继续分析这个函数之前，又要解释两个数据结构了，一个是`struct binder_thread`结构体，顾名思久，它表示一个线程，这里就是执行`binder_become_context_manager`函数的线程了。  

```c
struct binder_thread {
	struct binder_proc *proc;      // 该线程所属的进程
	struct rb_node rb_node;        // 链入binder_proc中threads红黑树的节点
	int pid;
	int looper;                    // 线程状态，枚举值如下
	struct binder_transaction *transaction_stack;  // 线程正在处理的事务
	struct list_head todo;         // 发往该线程的数据列表
  // 操作结果返回码
	uint32_t return_error; /* Write failed, return error code in read buf */
	uint32_t return_error2; /* Write failed, return error code in read */
		/* buffer. Used when sending a reply to a dead process that */
		/* we are also waiting on */
	wait_queue_head_t wait;        // 用来阻塞线程等待某个事件的发生
	struct binder_stats stats;     // 用来保存一些统计信息
};

// 线程状态枚举值
enum {
	BINDER_LOOPER_STATE_REGISTERED  = 0x01,
	BINDER_LOOPER_STATE_ENTERED     = 0x02,
	BINDER_LOOPER_STATE_EXITED      = 0x04,
	BINDER_LOOPER_STATE_INVALID     = 0x08,
	BINDER_LOOPER_STATE_WAITING     = 0x10,
	BINDER_LOOPER_STATE_NEED_RETURN = 0x20
}
```

另外一个数据结构是`struct binder_node`，它表示一个binder实体

```c
struct binder_node {
	int debug_id;
	struct binder_work work;
	// rb_node和dead_node组成一个联合体。
	// 如果这个Binder实体还在正常使用
	// 则使用rb_node来连入proc->nodes所表示的红黑树的节点
	// 这棵红黑树用来组织属于这个进程的所有Binder实体；
	//
	// 如果这个Binder实体所属的进程已经销毁
	// 而这个Binder实体又被其它进程所引用
	// 则这个Binder实体通过dead_node进入到一个哈希表中去存放。
	union {
		struct rb_node rb_node;
		struct hlist_node dead_node;
	};
	struct binder_proc *proc;    // 表示这个Binder实例所属于进程
	struct hlist_head refs;      // 所有引用了该Binder实体的Binder引用连接起来构成一个链表
	// 以下三个表示Binder实体的引用计数
	int internal_strong_refs;
	int local_weak_refs;
	int local_strong_refs;
	void __user *ptr;            // Binder实体在用户空间的地址附加数据
	void __user *cookie;         // Binder实体在用户空间的附加数据
	unsigned has_strong_ref : 1;
	unsigned pending_strong_ref : 1;
	unsigned has_weak_ref : 1;
	unsigned pending_weak_ref : 1;
	unsigned has_async_transaction : 1;
	unsigned accept_fds : 1;
	int min_priority : 8;
	struct list_head async_todo;
};
```

介绍完两个struct之后，回到`binder_ioctl`函数中，首先是通过`filp->private_data`获得`proc`变量，接着通过`binder_get_thread`函数获得线程信息，我们来看一下这个函数：

```c
static struct binder_thread *binder_get_thread(struct binder_proc *proc)
{
	struct binder_thread *thread = NULL;
	struct rb_node *parent = NULL;
	struct rb_node **p = &proc->threads.rb_node;

	while (*p) {
		parent = *p;
		thread = rb_entry(parent, struct binder_thread, rb_node);

		if (current->pid < thread->pid)
			p = &(*p)->rb_left;
		else if (current->pid > thread->pid)
			p = &(*p)->rb_right;
		else
			break;
	}
	if (*p == NULL) {
		thread = kzalloc(sizeof(*thread), GFP_KERNEL);
		if (thread == NULL)
			return NULL;
		binder_stats.obj_created[BINDER_STAT_THREAD]++;
		thread->proc = proc;
		thread->pid = current->pid;
		init_waitqueue_head(&thread->wait);
		INIT_LIST_HEAD(&thread->todo);
		rb_link_node(&thread->rb_node, parent, p);
		rb_insert_color(&thread->rb_node, &proc->threads);
		thread->looper |= BINDER_LOOPER_STATE_NEED_RETURN;
		thread->return_error = BR_OK;
		thread->return_error2 = BR_OK;
	}
	return thread;
}
```

这里把当前线程current的pid作为键值，在进程`proc->threads`表示的红黑树中进行查找，看是否已经为当前线程创建过了`binder_thread`信息。在这个场景下，由于当前线程是第一次进到这里，所以肯定找不到，即`*p == NULL`成立，于是，就为当前线程创建一个线程上下文信息结构体`binder_thread`，并初始化相应成员变量，并插入到`proc->threads`所表示的红黑树中去，下次要使用时就可以从proc中找到了。注意，这里的`thread->looper |= BINDER_LOOPER_STATE_NEED_RETURN`。

回到`binder_ioctl`函数，继续往下面，有两个全局变量`binder_context_mgr_node`和`binder_context_mgr_uid`，它定义如下：

```c
static struct binder_node *binder_context_mgr_node;
static uid_t binder_context_mgr_uid = -1;
```

`binder_context_mgr_node`用来表示Service Manager实体，`binder_context_mgr_uid`表示Service Manager守护进程的uid。  
在这个场景下，由于当前线程是第一次进到这里，所以`binder_context_mgr_node`为NULL，`binder_context_mgr_uid`为-1，于是初始化`binder_context_mgr_uid`为`current->cred->euid`，这样，当前线程就成为Binder机制的守护进程了，并且通过`binder_new_node()`为Service Manager创建Binder实体：

```c
static struct binder_node *
binder_new_node(struct binder_proc *proc, void __user *ptr, void __user *cookie)
{
	struct rb_node **p = &proc->nodes.rb_node;
	struct rb_node *parent = NULL;
	struct binder_node *node;

	while (*p) {
		parent = *p;
		node = rb_entry(parent, struct binder_node, rb_node);

		if (ptr < node->ptr)
			p = &(*p)->rb_left;
		else if (ptr > node->ptr)
			p = &(*p)->rb_right;
		else
			return NULL;
	}

	node = kzalloc(sizeof(*node), GFP_KERNEL);
	if (node == NULL)
		return NULL;
	binder_stats.obj_created[BINDER_STAT_NODE]++;
	rb_link_node(&node->rb_node, parent, p);
	rb_insert_color(&node->rb_node, &proc->nodes);
	node->debug_id = ++binder_last_id;
	node->proc = proc;
	node->ptr = ptr;
	node->cookie = cookie;
	node->work.type = BINDER_WORK_NODE;
	INIT_LIST_HEAD(&node->work.entry);
	INIT_LIST_HEAD(&node->async_todo);
	if (binder_debug_mask & BINDER_DEBUG_INTERNAL_REFS)
		printk(KERN_INFO "binder: %d:%d node %d u%p c%p created\n",
		       proc->pid, current->pid, node->debug_id,
		       node->ptr, node->cookie);
	return node;
}
```

注意，这里传进来的`ptr`和`cookie`均为`NULL`。函数首先检查`proc->nodes`红黑树中是否已经存在以`ptr`为键值的`node`，如果已经存在，就返回NULL。在这个场景下，由于当前线程是第一次进入到这里，所以肯定不存在，于是就新建了一个`ptr`为`NULL`的`binder_node`，并且初始化其它成员变量，并插入到`proc->nodes`红黑树中去。

`binder_new_node`返回到`binder_ioctl`函数后，就把新建的`binder_node`指针保存在`binder_context_mgr_node`中了，紧接着，又初始化了`binder_context_mgr_node`的引用计数值。

这样，`BINDER_SET_CONTEXT_MGR`命令就执行完毕了。`binder_ioctl`函数返回之前，执行了下面语句：

```c
if (thread)
		thread->looper &= ~BINDER_LOOPER_STATE_NEED_RETURN;
```

回忆上面执行binder_get_thread时，`thread->looper |= BINDER_LOOPER_STATE_NEED_RETURN`，执行了这条语句后，`thread->looper = 0`。

回到Service Manager的main函数中，下一步就是调用`binder_loop`函数。

```c
void binder_loop(struct binder_state *bs, binder_handler func)
{
    int res;
    struct binder_write_read bwr;
    unsigned readbuf[32];

    bwr.write_size = 0;
    bwr.write_consumed = 0;
    bwr.write_buffer = 0;

    readbuf[0] = BC_ENTER_LOOPER;
    binder_write(bs, readbuf, sizeof(unsigned));

    for (;;) {
        bwr.read_size = sizeof(readbuf);
        bwr.read_consumed = 0;
        bwr.read_buffer = (unsigned) readbuf;

        res = ioctl(bs->fd, BINDER_WRITE_READ, &bwr);

        if (res < 0) {
            LOGE("binder_loop: ioctl failed (%s)\n", strerror(errno));
            break;
        }

        res = binder_parse(bs, 0, readbuf, bwr.read_consumed, func);
        if (res == 0) {
            LOGE("binder_loop: unexpected reply?!\n");
            break;
        }
        if (res < 0) {
            LOGE("binder_loop: io error %d %s\n", res, strerror(errno));
            break;
        }
    }
}
```

首先是通过`binder_write`函数执行`BC_ENTER_LOOPER`命令告诉Binder驱动程序，Service Manager要进入循环了。接下来在循环中调用了`ioctl(bs->fd, BINDER_WRITE_READ, &bwr)`。  
这里又要介绍一下设备文件/dev/binder文件操作函数`ioctl`的操作码`BINDER_WRITE_READ`了，首先看定义：

```c
#define BINDER_WRITE_READ   		_IOWR('b', 1, struct binder_write_read)
```

这个io操作码有一个参数，形式为`struct binder_write_read`：

```c
struct binder_write_read {
	signed long	write_size;	/* bytes to write */
	signed long	write_consumed;	/* bytes consumed by driver */
	unsigned long	write_buffer;
	signed long	read_size;	/* bytes to read */
	signed long	read_consumed;	/* bytes consumed by driver */
	unsigned long	read_buffer;
};
```

用户空间程序和Binder驱动程序交互大多数都是通过`BINDER_WRITE_READ`命令的，`write_bufffer`和`read_buffer`所指向的数据结构还指定了具体要执行的操作，`write_bufffer`和`read_buffer`所指向的结构体是`struct binder_transaction_data`：

```c
struct binder_transaction_data {
	/* The first two are only used for bcTRANSACTION and brTRANSACTION,
	 * identifying the target and contents of the transaction.
	 */
	union {
		size_t	handle;	/* target descriptor of command transaction */
		void	*ptr;	/* target descriptor of return transaction */
	} target;
	void		*cookie;	/* target object cookie */
	unsigned int	code;		/* transaction command */

	/* General information about the transaction. */
	unsigned int	flags;
	pid_t		sender_pid;
	uid_t		sender_euid;
	size_t		data_size;	/* number of bytes of data */
	size_t		offsets_size;	/* number of bytes of offsets */

	/* If this transaction is inline, the data immediately
	 * follows here; otherwise, it ends with a pointer to
	 * the data buffer.
	 */
	union {
		struct {
			/* transaction data */
			const void	*buffer;
			/* offsets from buffer to flat_binder_object structs */
			const void	*offsets;
		} ptr;
		uint8_t	buf[8];
	} data;
};
```

有一个联合体`target`，当这个`BINDER_WRITE_READ`命令的目标对象是本地Binder实体时，就使用`ptr`来表示这个对象在本进程中的地址，否则就使用`handle`来表示这个Binder实体的引用。只有目标对象是Binder实体时，`cookie`成员变量才有意义，表示一些附加数据，由Binder实体来解释这个附加数据。`code`表示要对目标对象请求的命令代码，有很多请求代码，这里就不列举了，在这个场景中，就是`BC_ENTER_LOOPER`了，用来告诉Binder驱动程序， Service Manager要进入循环了。其余的请求命令代码可以参考kernel/common/drivers/staging/android/binder.h文件中定义的两个枚举类型`BinderDriverReturnProtocol`和`BinderDriverCommandProtocol`。  
`flags`成员变量表示事务标志：

```c
enum transaction_flags {
	TF_ONE_WAY	= 0x01,	/* this is a one-way call: async, no return */
	TF_ROOT_OBJECT	= 0x04,	/* contents are the component's root object */
	TF_STATUS_CODE	= 0x08,	/* contents are a 32-bit status code */
	TF_ACCEPT_FDS	= 0x10,	/* allow replies with file descriptors */
};
```

`sender_pid`和`sender_euid`表示发送者进程的pid和euid。  
`data_size`表示data.buffer缓冲区的大小，`offsets_size`表示data.offsets缓冲区的大小。  

这里需要解释一下`data`成员变量，命令的真正要传输的数据就保存在`data.buffer`缓冲区中，前面的成员变量都是一些用来描述数据的特征的。`data.buffer`所表示的缓冲区数据分为两类，一类是普通数据，Binder驱动程序不关心，一类是Binder实体或者Binder引用，这需要Binder驱动程序介入处理。为什么呢？想想，如果一个进程A传递了一个Binder实体或Binder引用给进程B，那么，Binder驱动程序就需要介入维护这个Binder实体或者引用的引用计数，防止B进程还在使用这个Binder实体时，A却销毁这个实体，这样的话，B进程就会crash了。所以在传输数据时，如果数据中含有Binder实体和Binder引用，就需要告诉Binder驱动程序它们的具体位置，以便Binder驱动程序能够去维护它们。`data.offsets`的作用就在这里了，它指定在`data.buffer`缓冲区中，所有Binder实体或者引用的偏移位置。每一个Binder实体或者引用，通过`struct flat_binder_object`来表示：

```c
/*
 * This is the flattened representation of a Binder object for transfer
 * between processes.  The 'offsets' supplied as part of a binder transaction
 * contains offsets into the data where these structures occur.  The Binder
 * driver takes care of re-writing the structure type and data as it moves
 * between processes.
 */
struct flat_binder_object {
	/* 8 bytes for large_flat_header. */
	unsigned long		type;
	unsigned long		flags;

	/* 8 bytes of data. */
	union {
		void		*binder;	/* local object */
		signed long	handle;		/* remote object */
	};

	/* extra data associated with local object */
	void			*cookie;
};
```

`type`表示Binder对象的类型，它取值如下所示：

```c
enum {
	BINDER_TYPE_BINDER	= B_PACK_CHARS('s', 'b', '*', B_TYPE_LARGE),
	BINDER_TYPE_WEAK_BINDER	= B_PACK_CHARS('w', 'b', '*', B_TYPE_LARGE),
	BINDER_TYPE_HANDLE	= B_PACK_CHARS('s', 'h', '*', B_TYPE_LARGE),
	BINDER_TYPE_WEAK_HANDLE	= B_PACK_CHARS('w', 'h', '*', B_TYPE_LARGE),
	BINDER_TYPE_FD		= B_PACK_CHARS('f', 'd', '*', B_TYPE_LARGE),
};
```

`flags`表示Binder对象的标志，该域只对第一次传递Binder实体时有效，因为此刻驱动需要在内核中创建相应的实体节点，有些参数需要从该域取出。  
最后，`binder`表示这是一个Binder实体，`handle`表示这是一个Binder引用，当这是一个Binder实体时，`cookie`才有意义，表示附加数据，由进程自己解释。

数据结构分析完了，回到`binder_loop`函数中，首先是执行`BC_ENTER_LOOPER`命令：

```c
readbuf[0] = BC_ENTER_LOOPER;
binder_write(bs, readbuf, sizeof(unsigned));
```

进入到`binder_write`函数中

```c
int binder_write(struct binder_state *bs, void *data, unsigned len)
{
    struct binder_write_read bwr;
    int res;
    bwr.write_size = len;
    bwr.write_consumed = 0;
    bwr.write_buffer = (unsigned) data;
    bwr.read_size = 0;
    bwr.read_consumed = 0;
    bwr.read_buffer = 0;
    res = ioctl(bs->fd, BINDER_WRITE_READ, &bwr);
    if (res < 0) {
        fprintf(stderr,"binder_write: ioctl failed (%s)\n",
                strerror(errno));
    }
    return res;
}
```

注意这里的`binder_write_read`变量bwr，`write_size`大小为4，表示`write_buffer`缓冲区大小为4，它的内容是一个`BC_ENTER_LOOPER`命令协议号，`read_buffer`为空。接着又是调用`ioctl`函数进入到Binder驱动程序的`binder_ioctl`函数，这里我们也只是关注`BC_ENTER_LOOPER`相关的逻辑：

```c
case BINDER_WRITE_READ: {
  struct binder_write_read bwr;
  if (size != sizeof(struct binder_write_read)) {
    ret = -EINVAL;
    goto err;
  }
  if (copy_from_user(&bwr, ubuf, sizeof(bwr))) {
    ret = -EFAULT;
    goto err;
  }
  if (binder_debug_mask & BINDER_DEBUG_READ_WRITE)
    printk(KERN_INFO "binder: %d:%d write %ld at %08lx, read %ld at %08lx\n",
           proc->pid, thread->pid, bwr.write_size, bwr.write_buffer, bwr.read_size, bwr.read_buffer);
  if (bwr.write_size > 0) {
    ret = binder_thread_write(proc, thread, (void __user *)bwr.write_buffer, bwr.write_size, &bwr.write_consumed);
    if (ret < 0) {
      bwr.read_consumed = 0;
      if (copy_to_user(ubuf, &bwr, sizeof(bwr)))
        ret = -EFAULT;
      goto err;
    }
  }
  if (bwr.read_size > 0) {
    ret = binder_thread_read(proc, thread, (void __user *)bwr.read_buffer, bwr.read_size, &bwr.read_consumed, filp->f_flags & O_NONBLOCK);
    if (!list_empty(&proc->todo))
      wake_up_interruptible(&proc->wait);
    if (ret < 0) {
      if (copy_to_user(ubuf, &bwr, sizeof(bwr)))
        ret = -EFAULT;
      goto err;
    }
  }
  if (binder_debug_mask & BINDER_DEBUG_READ_WRITE)
    printk(KERN_INFO "binder: %d:%d wrote %ld of %ld, read return %ld of %ld\n",
           proc->pid, thread->pid, bwr.write_consumed, bwr.write_size, bwr.read_consumed, bwr.read_size);
  if (copy_to_user(ubuf, &bwr, sizeof(bwr))) {
    ret = -EFAULT;
    goto err;
  }
  break;
}
```

在这段代码开始的时候调用了`binder_get_thread`，从`proc`中直接获取到了`binder_thread`，不需要重新创建(代码没有贴出来)。  

正式开始分析上面的代码：首先是通过`copy_from_user(&bwr, ubuf, sizeof(bwr))`语句把用户传递进来的参数转换成`struct binder_write_read`结构体，并保存在本地变量`bwr`中，这里可以看出`bwr.write_size`等于4，于是进入`binder_thread_write`函数，这里我们只关注`BC_ENTER_LOOPER`相关的代码：

```c
int
binder_thread_write(struct binder_proc *proc, struct binder_thread *thread,
		    void __user *buffer, int size, signed long *consumed)
{
	uint32_t cmd;
	void __user *ptr = buffer + *consumed;
	void __user *end = buffer + size;

	while (ptr < end && thread->return_error == BR_OK) {
		if (get_user(cmd, (uint32_t __user *)ptr))
			return -EFAULT;
		ptr += sizeof(uint32_t);
		if (_IOC_NR(cmd) < ARRAY_SIZE(binder_stats.bc)) {
			binder_stats.bc[_IOC_NR(cmd)]++;
			proc->stats.bc[_IOC_NR(cmd)]++;
			thread->stats.bc[_IOC_NR(cmd)]++;
		}
		switch (cmd) {
		...
		case BC_ENTER_LOOPER:
			if (binder_debug_mask & BINDER_DEBUG_THREADS)
				printk(KERN_INFO "binder: %d:%d BC_ENTER_LOOPER\n",
				       proc->pid, thread->pid);
			if (thread->looper & BINDER_LOOPER_STATE_REGISTERED) {
				thread->looper |= BINDER_LOOPER_STATE_INVALID;
				binder_user_error("binder: %d:%d ERROR:"
					" BC_ENTER_LOOPER called after "
					"BC_REGISTER_LOOPER\n",
					proc->pid, thread->pid);
			}
			thread->looper |= BINDER_LOOPER_STATE_ENTERED;
			break;
		...
		default:
			printk(KERN_ERR "binder: %d:%d unknown command %d\n", proc->pid, thread->pid, cmd);
			return -EINVAL;
		}
		*consumed = ptr - buffer;
	}
	return 0;
}
```

回忆前面执行`binder_become_context_manager`到`binder_ioctl`时，调用`binder_get_thread`函数创建的`thread->looper`值为0，所以这里执行完`BC_ENTER_LOOPER`时，`thread->looper`值就变为`BINDER_LOOPER_STATE_ENTERED`了，表明当前线程进入循环状态了。

回到`binder_ioctl`函数，由于`bwr.read_size == 0`，`binder_thread_read`函数就不会被执行了，这样，`binder_ioctl`的任务就完成了。

回到`binder_loop`函数，进入for循环：

```c
for (;;) {
    bwr.read_size = sizeof(readbuf);
    bwr.read_consumed = 0;
    bwr.read_buffer = (unsigned) readbuf;

    res = ioctl(bs->fd, BINDER_WRITE_READ, &bwr);

    if (res < 0) {
        LOGE("binder_loop: ioctl failed (%s)\n", strerror(errno));
        break;
    }

    res = binder_parse(bs, 0, readbuf, bwr.read_consumed, func);
    if (res == 0) {
        LOGE("binder_loop: unexpected reply?!\n");
        break;
    }
    if (res < 0) {
        LOGE("binder_loop: io error %d %s\n", res, strerror(errno));
        break;
    }
}
```

又是执行一个`ioctl`命令，注意，这里的`bwr`参数各个成员的值：

```c
bwr.write_size = 0;
bwr.write_consumed = 0;
bwr.write_buffer = 0;
readbuf[0] = BC_ENTER_LOOPER;
bwr.read_size = sizeof(readbuf);
bwr.read_consumed = 0;
bwr.read_buffer = (unsigned) readbuf;
```

再次进入到`binder_ioctl`函数，此时`bwr.write_size`等于0，于是不会执行`binder_thread_write`函数，`bwr.read_size`等于32，于是进入到`binder_thread_read`函数：

```c
static int
binder_thread_read(struct binder_proc *proc, struct binder_thread *thread,
	void  __user *buffer, int size, signed long *consumed, int non_block)
{
	void __user *ptr = buffer + *consumed;
	void __user *end = buffer + size;

	int ret = 0;
	int wait_for_proc_work;

	if (*consumed == 0) {
		if (put_user(BR_NOOP, (uint32_t __user *)ptr))
			return -EFAULT;
		ptr += sizeof(uint32_t);
	}

retry:
	wait_for_proc_work = thread->transaction_stack == NULL && list_empty(&thread->todo);

	if (thread->return_error != BR_OK && ptr < end) {
		if (thread->return_error2 != BR_OK) {
			if (put_user(thread->return_error2, (uint32_t __user *)ptr))
				return -EFAULT;
			ptr += sizeof(uint32_t);
			if (ptr == end)
				goto done;
			thread->return_error2 = BR_OK;
		}
		if (put_user(thread->return_error, (uint32_t __user *)ptr))
			return -EFAULT;
		ptr += sizeof(uint32_t);
		thread->return_error = BR_OK;
		goto done;
	}


	thread->looper |= BINDER_LOOPER_STATE_WAITING;
	if (wait_for_proc_work)
		proc->ready_threads++;
	mutex_unlock(&binder_lock);
	if (wait_for_proc_work) {
		if (!(thread->looper & (BINDER_LOOPER_STATE_REGISTERED |
					BINDER_LOOPER_STATE_ENTERED))) {
			binder_user_error("binder: %d:%d ERROR: Thread waiting "
				"for process work before calling BC_REGISTER_"
				"LOOPER or BC_ENTER_LOOPER (state %x)\n",
				proc->pid, thread->pid, thread->looper);
			wait_event_interruptible(binder_user_error_wait, binder_stop_on_user_error < 2);
		}
		binder_set_nice(proc->default_priority);
		if (non_block) {
			if (!binder_has_proc_work(proc, thread))
				ret = -EAGAIN;
		} else
			ret = wait_event_interruptible_exclusive(proc->wait, binder_has_proc_work(proc, thread));
	} else {
		if (non_block) {
			if (!binder_has_thread_work(thread))
				ret = -EAGAIN;
		} else
			ret = wait_event_interruptible(thread->wait, binder_has_thread_work(thread));
	}
	...
}
```

传入的参数`*consumed == 0`，于是写入一个值`BR_NOOP`到参数`ptr`指向的缓冲区中去，即用户传进来的`bwr.read_buffer`缓冲区。这时候，`thread->transaction_stack == NULL`，并且`thread->todo`列表也是空的，这表示当前线程没有事务需要处理，于是`wait_for_proc_work`为true，表示要去查看proc是否有未处理的事务。当前`thread->return_error == BR_OK`，这是前面创建binder_thread时初始化设置的。于是继续往下执行，设置thread的状态为`BINDER_LOOPER_STATE_WAITING`，表示线程处于等待状态。调用`binder_set_nice`函数设置当前线程的优先级别为`proc->default_priority`，这是因为thread要去处理属于proc的事务，因此要将此thread的优先级别设置和proc一样。在这个场景中，proc也没有事务处理，即`binder_has_proc_work(proc, thread)`为false。如果文件打开模式为非阻塞模式，即`non_block`为true，那么函数就直接返回-EAGAIN，要求用户重新执行`ioctl`；否则的话，就通过当前线程就通过`wait_event_interruptible_exclusive`函数进入休眠状态，等待请求到来再唤醒了。

至此，我们就从源代码一步一步地分析完Service Manager是如何成为Android进程间通信（IPC）机制Binder守护进程的了。  
总结一下，Service Manager是成为Android进程间通信（IPC）机制Binder守护进程的过程是这样的：  
1.&nbsp;打开/dev/binder文件：`open("/dev/binder", O_RDWR);`  
2.&nbsp;建立128K内存映射：`mmap(NULL, mapsize, PROT_READ, MAP_PRIVATE, bs->fd, 0);`  
3.&nbsp;通知Binder驱动程序它是守护进程：`binder_become_context_manager(bs);`  
4.&nbsp;进入循环等待请求的到来：`binder_loop(bs, svcmgr_handler);`  
在这个过程中，在Binder驱动程序中建立了一个`struct binder_proc`结构、一个`struct binder_thread`结构和一个`struct binder_node`结构，这样，Service Manager就在Android系统的进程间通信机制Binder担负起守护进程的职责了。

## 2 [Binder中的Server和Client获得Service Manager接口之路](https://blog.csdn.net/luoshengyang/article/details/6627260)

**上一节介绍了Service Manager是如何成为Binder机制的守护进程的。既然作为守护进程，Service Manager的职责当然就是为Server和Client服务了。那么，Server和Client如何获得Service Manager接口，进而享受它提供的服务呢？本文将简要分析Server和Client获得Service Manager的过程。**

我们知道，Service Manager在Binder机制中既充当守护进程的角色，同时它也充当着Server角色，然而它又与一般的Server不一样。对于普通的Server来说，Client如果想要获得Server的远程接口，那么必须通过Service Manager远程接口提供的getService接口来获得，这本身就是一个使用Binder机制来进行进程间通信的过程。而对于Service Manager这个Server来说，Client如果想要获得Service Manager远程接口，却不必通过进程间通信机制来获得，因为Service Manager远程接口是一个特殊的Binder引用，它的引用句柄一定是0。

获取Service Manager远程接口的函数是`defaultServiceManager()`，声明在 **frameworks/base/include/binder/IServiceManager.h**

```c
sp<IServiceManager> defaultServiceManager();
```

实现在：**frameworks/base/include/binder/IServiceManager.cpp**

```c
sp<IServiceManager> defaultServiceManager()
{
    if (gDefaultServiceManager != NULL) return gDefaultServiceManager;

    {
        AutoMutex _l(gDefaultServiceManagerLock);
        if (gDefaultServiceManager == NULL) {
            gDefaultServiceManager = interface_cast<IServiceManager>(
                                                                     ProcessState::self()->getContextObject(NULL));
        }
    }

    return gDefaultServiceManager;
}
```

 `gDefaultServiceManagerLock`和`gDefaultServiceManager`是全局变量，定义在 **frameworks/base/libs/binder/Static.cpp** 文件中：

 ```c
Mutex gDefaultServiceManagerLock;
sp<IServiceManager> gDefaultServiceManager;
 ```

从这个函数可以看出，`gDefaultServiceManager`是单例模式，调用`defaultServiceManager`函数时，如果`gDefaultServiceManager`已经创建，则直接返回，否则通过`interface_cast<IServiceManager>(ProcessState::self()->getContextObject(NULL))`来创建一个，并保存在`gDefaultServiceManager`全局变量中。

在继续介绍`interface_cast<IServiceManager>(ProcessState::self()->getContextObject(NULL))`的实现之前，先来看一个类图，这能够帮助们了解Service Manager远程接口的创建过程。

[![Service Manager UML图](/assets/images/android/binder_service_manager.png)](/assets/images/android/binder_service_manager.png)

在2.1节已经解释过这个图了。这里在重述一遍：`BpServiceManager`类继承了`BpInterface<IServiceManager>`类，`BpInterface`是一个模板类，它定义在 **frameworks/base/include/binder/IInterface.h** 文件中：

```c
template<typename INTERFACE>
class BpInterface : public INTERFACE, public BpRefBase
{
public:
    BpInterface(const sp<IBinder>& remote);

protected:
    virtual IBinder*            onAsBinder();
};
```

`IServiceManager`类继承了`IInterface`类，而`IInterface`类和`BpRefBase`类又分别继承了`RefBase`类。在`BpRefBase`类中，有一个成员变量`mRemote`，它的类型是`IBinder*`，实现类为`BpBinder`，它表示一个`Binder`引用，引用句柄值保存在`BpBinder`类的`mHandle`成员变量中。`BpBinder`类通过`IPCThreadState`类来和`Binder`驱动程序并互，而`IPCThreadState`又通过它的成员变量`mProcess`来打开`/dev/binder`设备文件，`mProcess`成员变量的类型为`ProcessState`。`ProcessState`类打开设备`/dev/binder`之后，将打开文件描述符保存在`mDriverFD`成员变量中，以供后续使用。

我们很早以前就知道了`interface_cast<IServiceManager>(ProcessState::self()->getContextObject(NULL))`其实就等价于`new BpServiceManager(new BpBinder(0));`。  

这样，Service Manager远程接口就创建完成了，它本质上是一个`BpServiceManager`，包含了一个句柄值为0的`Binder`引用。  

在Android系统的Binder机制中，Server和Client拿到这个Service Manager远程接口之后怎么用呢？  
对Server来说，就是调用`IServiceManager::addService`这个接口来和Binder驱动程序交互了，即调用`BpServiceManager::addService`。而`BpServiceManager::addService`又会调用通过其基类`BpRefBase`的成员函数`remote`获得原先创建的`BpBinder`实例，接着调用`BpBinder::transact`成员函数。在`BpBinder::transact`函数中，又会调用`IPCThreadState::transact`成员函数，这里就是最终与Binder驱动程序交互的地方了。回忆一下前面的类图，`IPCThreadState`有一个`PorcessState`类型的成中变量`mProcess`，而`mProcess`有一个成员变量`mDriverFD`，它是设备文件/dev/binder的打开文件描述符，因此，`IPCThreadState`就相当于间接在拥有了设备文件/dev/binder的打开文件描述符，于是，便可以与Binder驱动程序交互了。  
对Client来说，就是调用`IServiceManager::getService`这个接口来和Binder驱动程序交互了。具体过程上述Server使用Service Manager的方法是一样的，这里就不再累述了。

## 3 [Service Manager在Server的启动中是如何为Server提供服务的](https://blog.csdn.net/luoshengyang/article/details/6629298)

还是以MediaPlayerService来分析。首先，看一下MediaPlayerService的类图，以便我们理解下面要描述的内容。

[![MediaPlayerService](/assets/images/android/binder_media_player_service.png)](/assets/images/android/binder_media_player_service.png)

从前面的分析以及上图中可以看出`MediaPlayerService`继承至`BnMediaPlayerService`，这里的Bn是指Binder Native，用来处理Client请求的。 `BnMediaPlayerService`继承至`BnInterface<IServiceManager>`，和`BpInterface`一样，`BnInterface`也是一个模板类：

**frameworks/base/include/binder/IInterface.h**

```c
template<typename INTERFACE>
class BpInterface : public INTERFACE, public BpRefBase
{
public:
    BpInterface(const sp<IBinder>& remote);

protected:
    virtual IBinder*            onAsBinder();
};
```

这是一个多继承的类，`BnMediaPlayerService`实际是继承了`IMediaPlayerService`和`BBinder`类。`IMediaPlayerService`和`BBinder`类又分别继承了`IInterface`和`IBinder`类，`IInterface`和`IBinder`类又同时继承了`RefBase`类。

实际上，从2.1节可以知道，`BnMediaPlayerService`并不是直接接收到Client处发送过来的请求，而是使用了`IPCThreadState`接收Client处发送过来的请求，而`IPCThreadState`又借助了`ProcessState`类来与`Binder`驱动程序交互。`IPCThreadState`接收到了Client处的请求后，就会调用`BBinder`类的`transact`函数，并传入相关参数，`BBinder`类的`transact`函数最终调用`BnMediaPlayerService`类的`onTransact`函数，于是，就开始真正地处理Client的请求了。

下面正式进入本节主题，看看`MediaPlayerService`是如何启动的。

大部分内容同第2.1节，所以一些代码不再重复贴出。

首先看frameworks/base/media/mediaserver/main_mediaserver.cpp的`main`函数。第一句代码就是

```c
sp<ProcessState> proc(ProcessState::self());
```

`ProcessState::self()`的作用就是返回一个全局唯一的`ProcessState`实例`gProcess`，该变量定义在：

**frameworks/base/libs/binder/Static.cpp**

```c
Mutex gProcessMutex;
sp<ProcessState> gProcess;
```

`ProcessState`的构造函数有两个关键的地方：
1. 通过`open_driver`函数打开Binder设备/dev/binder，并在打开设备文件描述符保存在成员变量`mDriverFD`中
2. 通过`mmap`来把设备文件/dev/binder映射到内存中

在`open_driver`函数中通过`open`文件操作函数来打开/dev/binder设备文件，然后再调用`ioctl`文件控制函数来分别执行`BINDER_VERSION`和`BINDER_SET_MAX_THREADS`两个命令来和Binder驱动程序进行交互。前者用于获得当前Binder驱动程序的版本号；后者用于通知Binder驱动程序，MediaPlayerService最多可同时启动15个线程来处理Client端的请求。  

先看看`open`函数，`open`在Binder驱动程序中的实现，参考前面内容。打开/dev/binder设备文件后，Binder驱动程序就为MediaPlayerService进程创建了一个`struct binder_proc`结构体实例来维护MediaPlayerService进程上下文相关信息。

然后就是`ioctl`文件操作函数执行`BINDER_VERSION`命令的过程：

```c
status_t result = ioctl(fd, BINDER_VERSION, &vers);
```

该函数最终会进入Binder驱动程序的`binder_ioctl`函数中，我们只关注`BINDER_VERSION`相关的部分逻辑：

```c
case BINDER_VERSION:
  if (size != sizeof(struct binder_version)) {
    ret = -EINVAL;
    goto err;
  }
  if (put_user(BINDER_CURRENT_PROTOCOL_VERSION, &((struct binder_version *)ubuf)->protocol_version)) {
    ret = -EINVAL;
    goto err;
  }
  break;
```

很简单，只是将`BINDER_CURRENT_PROTOCOL_VERSION`写入到传入的参数arg指向的用户缓冲区中去就返回了。  
BINDER_CURRENT_PROTOCOL_VERSION是一个宏：

```c
/* This is the current protocol version. */
#define BINDER_CURRENT_PROTOCOL_VERSION 7
```

这里为什么要把`ubuf`转换成`struct binder_version`之后，再通过其`protocol_version`成员变量再来写入呢，转了一圈，最终内容还是写入到`ubuf`中。我们看一下`struct binder_version`的定义就会明白：

```c
/* Use with BINDER_VERSION, driver fills in fields. */
struct binder_version {
	/* driver protocol version -- increment with incompatible change */
	signed long	protocol_version;
};
```

从注释中可以看出来，这里是考虑到兼容性，因为以后很有可能不是用`signed long`来表示版本号。

这里有一个重要的地方要注意的是，由于这里是打开设备文件/dev/binder之后，第一次进入到`binder_ioctl`函数，因此，这里调用`binder_get_thread`的时候，就会为当前线程创建一个`struct binder_thread`结构体变量来维护线程上下文信息。  

接下来再看`ioctl`文件操作函数执行`BINDER_SET_MAX_THREADS`命令的过程：

```c
result = ioctl(fd, BINDER_SET_MAX_THREADS, &maxThreads);
```

`binder_ioctl`里`BINDER_SET_MAX_THREADS`相关的部分：

```c
case BINDER_SET_MAX_THREADS:
  if (copy_from_user(&proc->max_threads, ubuf, sizeof(proc->max_threads))) {
    ret = -EINVAL;
    goto err;
  }
  break;
```

这里实现也是非常简单，只是简单地把用户传进来的参数保存在`proc->max_threads`中就完毕了。  

注意，这里再调用`binder_get_thread`函数的时候，就可以在`proc->threads`中找到当前线程对应的`struct binder_thread`结构了，因为前面已经创建好并保存在`proc->threads`红黑树中。

回到`ProcessState`的构造函数中，下面通过`mmap`函数来把设备文件`/dev/binder`映射到内存中，宏`BINDER_VM_SIZE`定义在：

**frameworks/base/libs/binder/ProcessState.cpp**

```c
#define BINDER_VM_SIZE ((1*1024*1024) - (4096 *2))
```

`mmap`函数调用完成之后，Binder驱动程序就为当前进程预留了`BINDER_VM_SIZE`大小的内存空间了。  

这样，`ProcessState`全局唯一变量`gProcess`就创建完毕了，回到main_mediaserver.cpp文件中的main函数，下一步是调用`defaultServiceManager`函数来获得Service Manager的远程接口，这一步在上一节中有详细描述。  

再接下来就进入到`MediaPlayerService::instantiate`函数把`MediaPlayerService`添加到Service Manger中去了。  

**frameworks/base/media/libmediaplayerservice/MediaPlayerService.cpp**

```c
void MediaPlayerService::instantiate() {
    defaultServiceManager()->addService(
                                        String16("media.player"), new MediaPlayerService());
}
```

我们重点看一下`IServiceManger::addService`的过程，这有助于我们加深对Binder机制的理解。  

前面我们提到`defaultServiceManager`返回的实际上是个`BpServiceManager`，因此，我们看一下`BpServiceManger::addService`实现。  

**frameworks/base/include/binder/IServiceManager.cpp**

```c
virtual status_t addService(const String16& name, const sp<IBinder>& service)
{
    Parcel data, reply;
    data.writeInterfaceToken(IServiceManager::getInterfaceDescriptor());
    data.writeString16(name);
    data.writeStrongBinder(service);
    status_t err = remote()->transact(ADD_SERVICE_TRANSACTION, data, &reply);
    return err == NO_ERROR ? reply.readInt32() : err;
}
```

`Parcel`类是用来于序列化进程间通信数据用的。  

先看这一句的调用：

```c
data.writeInterfaceToken(IServiceManager::getInterfaceDescriptor());
```

`IServiceManager::getInterfaceDescriptor()`返回的是一个字符串，即`android.os.IServiceManager`。我们看一下`Parcel::writeInterfaceToken`的实现：

**frameworks/base/libs/binder/Parcel.cpp**
```c
// Write RPC headers.  (previously just the interface token)
status_t Parcel::writeInterfaceToken(const String16& interface)
{
    writeInt32(IPCThreadState::self()->getStrictModePolicy() |
               STRICT_MODE_PENALTY_GATHER);
    // currently the interface identification token is just its name as a string
    return writeString16(interface);
}
```

它的作用是写入一个整数和一个字符串到`Parcel`中去。

再来看下面的调用`data.writeString16(name);`，这里又是写入一个字符串到`Parcel`中，也就是`media.player`。  
然后`data.writeStrongBinder(service);`，这里写入一个Binder对象到Parcel去。我们重点看一下这个函数的实现，因为它涉及到进程间传输Binder实体的问题，比较复杂，需要重点关注，同时，也是理解Binder机制的一个重点所在。注意，这里的`service`参数是一个MediaPlayerService对象。  

```c
status_t Parcel::writeStrongBinder(const sp<IBinder>& val)
{
    return flatten_binder(ProcessState::self(), val, this);
}
```

这里的`flatten_binder`函数，与前面提到Binder驱动程序中表示传输中的一个binder对象的数据结构`struct flat_binder_object`有一定关系。我们接着看此数据结构以及`flatten_binder`函数：

```c
/*
 * This is the flattened representation of a Binder object for transfer
 * between processes.  The 'offsets' supplied as part of a binder transaction
 * contains offsets into the data where these structures occur.  The Binder
 * driver takes care of re-writing the structure type and data as it moves
 * between processes.
 */
struct flat_binder_object {
	/* 8 bytes for large_flat_header. */
	unsigned long		type;
	unsigned long		flags;

	/* 8 bytes of data. */
	union {
		void		*binder;	/* local object */
		signed long	handle;		/* remote object */
	};

	/* extra data associated with local object */
	void			*cookie;
};

enum {
	FLAT_BINDER_FLAG_PRIORITY_MASK = 0xff,
	FLAT_BINDER_FLAG_ACCEPTS_FDS = 0x100,
};

status_t flatten_binder(const sp<ProcessState>& proc,
    const sp<IBinder>& binder, Parcel* out)
{
    flat_binder_object obj;

    obj.flags = 0x7f | FLAT_BINDER_FLAG_ACCEPTS_FDS;
    // binder即为MediaPlayerService实例，因此，不为空
    if (binder != NULL) {
        // MediaPlayerService继承自BBinder类，它是一个本地Binder实体
        // 因此binder->localBinder返回一个BBinder指针，所以不为空
        IBinder *local = binder->localBinder();
        if (!local) {
            BpBinder *proxy = binder->remoteBinder();
            if (proxy == NULL) {
                LOGE("null proxy");
            }
            const int32_t handle = proxy ? proxy->handle() : 0;
            obj.type = BINDER_TYPE_HANDLE;
            obj.handle = handle;
            obj.cookie = NULL;
        } else {
			// 所以走这里
            obj.type = BINDER_TYPE_BINDER;
            obj.binder = local->getWeakRefs();
            obj.cookie = local;
        }
    } else {
        obj.type = BINDER_TYPE_BINDER;
        obj.binder = NULL;
        obj.cookie = NULL;
    }

    return finish_flatten_binder(binder, obj, out);
}
```

首先是初始化`flat_binder_object`的`flags`：`obj.flags = 0x7f | FLAT_BINDER_FLAG_ACCEPTS_FDS;`。  
0x7f表示处理本Binder实体请求数据包的线程的最低优先级，`FLAT_BINDER_FLAG_ACCEPTS_FDS`表示这个Binder实体可以接受文件描述符，Binder实体在收到文件描述符时，就会在本进程中打开这个文件。

传进来的`binder`即为`MediaPlayerService::instantiate`函数中new出来的MediaPlayerService实例，因此，不为空。又由于MediaPlayerService继承自BBinder类，它是一个本地Binder实体，因此`binder->localBinder`返回一个BBinder指针，而且肯定不为空，于是执行下面语句设置了`flat_binder_obj`的其他成员变量：

```c
obj.type = BINDER_TYPE_BINDER;
obj.binder = local->getWeakRefs();
obj.cookie = local;
```

注意，指向这个Binder实体地址的指针local保存在flat_binder_obj的成员变量`cookie`中。

在函数的最后调用了`finish_flatten_binder`来将这个flat_binder_obj写入到Parcel中去：

```c
inline static status_t finish_flatten_binder(
    const sp<IBinder>& binder, const flat_binder_object& flat, Parcel* out)
{
    return out->writeObject(flat, false);
}
```

`Parcel::writeObject`实现如下：

```c
status_t Parcel::writeObject(const flat_binder_object& val, bool nullMetaData)
{
    const bool enoughData = (mDataPos+sizeof(val)) <= mDataCapacity;
    const bool enoughObjects = mObjectsSize < mObjectsCapacity;
    if (enoughData && enoughObjects) {
restart_write:
        *reinterpret_cast<flat_binder_object*>(mData+mDataPos) = val;

        // Need to write meta-data?
        if (nullMetaData || val.binder != NULL) {
            // 记录这个flat_binder_obj在Parcel里面的偏移位置
            mObjects[mObjectsSize] = mDataPos;
            acquire_object(ProcessState::self(), val, this);
            mObjectsSize++;
        }

        // remember if it's a file descriptor
        if (val.type == BINDER_TYPE_FD) {
            mHasFds = mFdsKnown = true;
        }

        return finishWrite(sizeof(flat_binder_object));
    }

    if (!enoughData) {
        const status_t err = growData(sizeof(val));
        if (err != NO_ERROR) return err;
    }
    if (!enoughObjects) {
        size_t newSize = ((mObjectsSize+2)*3)/2;
        size_t* objects = (size_t*)realloc(mObjects, newSize*sizeof(size_t));
        if (objects == NULL) return NO_MEMORY;
        mObjects = objects;
        mObjectsCapacity = newSize;
    }

    goto restart_write;
}
```

这里除了把flat_binder_obj写到Parcel里面之内，还要记录这个flat_binder_obj在Parcel里面的偏移位置：`mObjects[mObjectsSize] = mDataPos;`。

这里如果进程间传输的数据间带有Binder对象的时候，Binder驱动程序需要作进一步的处理，以维护各个Binder实体的一致性，下面我们将会看到Binder驱动程序是怎么处理这些Binder对象的。

回到`BpServiceManager::addService`函数中，调用下面语句：

```c
status_t err = remote()->transact(ADD_SERVICE_TRANSACTION, data, &reply);
```

`remote()`返回的就是BpBinder指针。在`BpBinder::transact`函数中又调用了`IPCThreadState::transact`进执行实际的操作。  
注意，这里的mHandle为0，code为ADD_SERVICE_TRANSACTION。ADD_SERVICE_TRANSACTION是上面以参数形式传进来的，那mHandle为什么是0呢？因为这里表示的是Service Manager远程接口，它的句柄值一定是0。

下面接着看`IPCThreadState::transact`：

```c
// flags是一个默认值为0的参数，上面没有传相应的实参进来，因此，这里就为0
status_t IPCThreadState::transact(int32_t handle,
                                  uint32_t code, const Parcel& data,
                                  Parcel* reply, uint32_t flags)
{
    status_t err = data.errorCheck();

    flags |= TF_ACCEPT_FDS;

    IF_LOG_TRANSACTIONS() {
        TextOutput::Bundle _b(alog);
        alog << "BC_TRANSACTION thr " << (void*)pthread_self() << " / hand "
        << handle << " / code " << TypeCode(code) << ": "
        << indent << data << dedent << endl;
    }

    if (err == NO_ERROR) {
        LOG_ONEWAY(">>>> SEND from pid %d uid %d %s", getpid(), getuid(),
                   (flags & TF_ONE_WAY) == 0 ? "READ REPLY" : "ONE WAY");
        // 首先调用此函数准备好一个struct binder_transaction_data结构体变量
        // 这个是后面要传输给Binder驱动程序的
        err = writeTransactionData(BC_TRANSACTION, flags, handle, code, data, NULL);
    }

    if (err != NO_ERROR) {
        if (reply) reply->setError(err);
        return (mLastError = err);
    }

    // (flags & TF_ONE_WAY) == 0为true
    if ((flags & TF_ONE_WAY) == 0) {
        // 并且reply不为空
        if (reply) {
            // 执行这条路径
            err = waitForResponse(reply);
        } else {
            Parcel fakeReply;
            err = waitForResponse(&fakeReply);
        }

        IF_LOG_TRANSACTIONS() {
            TextOutput::Bundle _b(alog);
            alog << "BR_REPLY thr " << (void*)pthread_self() << " / hand "
            << handle << ": ";
            if (reply) alog << indent << *reply << dedent << endl;
            else alog << "(none requested)" << endl;
        }
    } else {
        err = waitForResponse(NULL, NULL);
    }

    return err;
}
```

函数首先调用`writeTransactionData`函数准备好一个`struct binder_transaction_data`结构体变量，这个是等一下要传输给Binder驱动程序的。`struct binder_transaction_data`的定义在本章中有解释。这里为了方便描述，将`struct binder_transaction_data`的定义再次列出来：

```c
struct binder_transaction_data {
	/* The first two are only used for bcTRANSACTION and brTRANSACTION,
	 * identifying the target and contents of the transaction.
	 */
	union {
		size_t	handle;	/* target descriptor of command transaction */
		void	*ptr;	/* target descriptor of return transaction */
	} target;
	void		*cookie;	/* target object cookie */
	unsigned int	code;		/* transaction command */

	/* General information about the transaction. */
	unsigned int	flags;
	pid_t		sender_pid;
	uid_t		sender_euid;
	size_t		data_size;	/* number of bytes of data */
	size_t		offsets_size;	/* number of bytes of offsets */

	/* If this transaction is inline, the data immediately
	 * follows here; otherwise, it ends with a pointer to
	 * the data buffer.
	 */
	union {
		struct {
			/* transaction data */
			const void	*buffer;
			/* offsets from buffer to flat_binder_object structs */
			const void	*offsets;
		} ptr;
		uint8_t	buf[8];
	} data;
};
```

`writeTransactionData`函数如下：

```c
// cmd为BC_TRANSACTION
status_t IPCThreadState::writeTransactionData(int32_t cmd, uint32_t binderFlags,
                                              int32_t handle, uint32_t code, const Parcel& data, status_t* statusBuffer)
{
    binder_transaction_data tr;

    tr.target.handle = handle;
    tr.code = code;
    tr.flags = binderFlags;

    const status_t err = data.errorCheck();
    if (err == NO_ERROR) {
        // 来初始化本地变量tr
        tr.data_size = data.ipcDataSize();
        tr.data.ptr.buffer = data.ipcData();
        tr.offsets_size = data.ipcObjectsCount()*sizeof(size_t);
        tr.data.ptr.offsets = data.ipcObjects();
    } else if (statusBuffer) {
        tr.flags |= TF_STATUS_CODE;
        *statusBuffer = err;
        tr.data_size = sizeof(status_t);
        tr.data.ptr.buffer = statusBuffer;
        tr.offsets_size = 0;
        tr.data.ptr.offsets = NULL;
    } else {
        return (mLastError = err);
    }

    // 将tr的内容保存在IPCThreadState的成员变量mOut中
    mOut.writeInt32(cmd);
    mOut.write(&tr, sizeof(tr));

    return NO_ERROR;
}
```

`tr.data.ptr.buffer`里面的内容相当于：

```c
writeInt32(IPCThreadState::self()->getStrictModePolicy() |
               STRICT_MODE_PENALTY_GATHER);
writeString16("android.os.IServiceManager");
writeString16("media.player");
writeStrongBinder(new MediaPlayerService());
```

其中包含了一个Binder实体MediaPlayerService，因此需要设置tr.offsets_size就为1，tr.data.ptr.offsets就指向了这个MediaPlayerService的地址在tr.data.ptr.buffer中的偏移量。

回到`IPCThreadState::transact`函数中，接下去看，`(flags & TF_ONE_WAY) == 0`为true，并且reply不为空，所以最终进入到`waitForResponse(reply)`这条路径来。`waitForResponse`函数里面主要调用了`talkWithDriver`来和Binder驱动程序进行交互。  

```c
// doReceive默认值为true
status_t IPCThreadState::talkWithDriver(bool doReceive)
{
    LOG_ASSERT(mProcess->mDriverFD >= 0, "Binder driver is not opened");

    binder_write_read bwr;

    // Is the read buffer empty?
    // 显然needRead也为true
    const bool needRead = mIn.dataPosition() >= mIn.dataSize();

    // We don't want to write anything if we are still reading
    // from data left in the input buffer and the caller
    // has requested to read the next data.
    const size_t outAvail = (!doReceive || needRead) ? mOut.dataSize() : 0;

    // 设置bwr的write值，Binder驱动程序会进行write操作
    bwr.write_size = outAvail;
    bwr.write_buffer = (long unsigned int)mOut.data();

    // This is what we'll read.
    // doReceive和needRead都为true，因此设置了bwr的read相关值
    // 这样Binder驱动程序就会进行read操作了
    if (doReceive && needRead) {
        bwr.read_size = mIn.dataCapacity();
        bwr.read_buffer = (long unsigned int)mIn.data();
    } else {
        bwr.read_size = 0;
    }

    IF_LOG_COMMANDS() {
        TextOutput::Bundle _b(alog);
        if (outAvail != 0) {
            alog << "Sending commands to driver: " << indent;
            const void* cmds = (const void*)bwr.write_buffer;
            const void* end = ((const uint8_t*)cmds)+bwr.write_size;
            alog << HexDump(cmds, bwr.write_size) << endl;
            while (cmds < end) cmds = printCommand(alog, cmds);
            alog << dedent;
        }
        alog << "Size of receive buffer: " << bwr.read_size
        << ", needRead: " << needRead << ", doReceive: " << doReceive << endl;
    }

    // Return immediately if there is nothing to do.
    if ((bwr.write_size == 0) && (bwr.read_size == 0)) return NO_ERROR;

    bwr.write_consumed = 0;
    bwr.read_consumed = 0;
    status_t err;
    do {
        IF_LOG_COMMANDS() {
            alog << "About to read/write, write size = " << mOut.dataSize() << endl;
        }
#if defined(HAVE_ANDROID_OS)
        // 让Binder驱动程序进行BINDER_WRITE_READ操作
        if (ioctl(mProcess->mDriverFD, BINDER_WRITE_READ, &bwr) >= 0)
            err = NO_ERROR;
        else
            err = -errno;
#else
        err = INVALID_OPERATION;
#endif
        IF_LOG_COMMANDS() {
            alog << "Finished read/write, write size = " << mOut.dataSize() << endl;
        }
    } while (err == -EINTR);

    IF_LOG_COMMANDS() {
        alog << "Our err: " << (void*)err << ", write consumed: "
        << bwr.write_consumed << " (of " << mOut.dataSize()
        << "), read consumed: " << bwr.read_consumed << endl;
    }

    // Binder驱动程序执行完了BINDER_WRITE_READ操作
    // 根据读写情况进行清除操作
    if (err >= NO_ERROR) {
        if (bwr.write_consumed > 0) {
            if (bwr.write_consumed < (ssize_t)mOut.dataSize())
                mOut.remove(0, bwr.write_consumed);
            else
                mOut.setDataSize(0);
        }
        if (bwr.read_consumed > 0) {
            mIn.setDataSize(bwr.read_consumed);
            mIn.setDataPosition(0);
        }
        IF_LOG_COMMANDS() {
            TextOutput::Bundle _b(alog);
            alog << "Remaining data size: " << mOut.dataSize() << endl;
            alog << "Received commands from driver: " << indent;
            const void* cmds = mIn.data();
            const void* end = mIn.data() + mIn.dataSize();
            alog << HexDump(cmds, mIn.dataSize()) << endl;
            while (cmds < end) cmds = printReturnCommand(alog, cmds);
            alog << dedent;
        }
        return NO_ERROR;
    }

    return err;
}
```

这里doReceive和needRead均为1，因此，这里告诉Binder驱动程序，先执行write操作，再执行read操作，下面我们将会看到。  

最后，通过`ioctl(mProcess->mDriverFD, BINDER_WRITE_READ, &bwr)`进行到Binder驱动程序的binder_ioctl函数，BINDER_WRITE_READ部分代码在2.2节中出现过，这里不在累述。

`binder_ioctl`函数首先是将用户传进来的参数拷贝到本地变量`struct binder_write_read bwr`中去。这里`bwr.write_size > 0`为true，因此，进入到binder_thread_write函数中，我们只关注BC_TRANSACTION部分的逻辑：

```c
int
binder_thread_write(struct binder_proc *proc, struct binder_thread *thread,
		    void __user *buffer, int size, signed long *consumed)
{
	uint32_t cmd;
	void __user *ptr = buffer + *consumed;
	void __user *end = buffer + size;

	while (ptr < end && thread->return_error == BR_OK) {
		if (get_user(cmd, (uint32_t __user *)ptr))
			return -EFAULT;
		ptr += sizeof(uint32_t);
		if (_IOC_NR(cmd) < ARRAY_SIZE(binder_stats.bc)) {
			binder_stats.bc[_IOC_NR(cmd)]++;
			proc->stats.bc[_IOC_NR(cmd)]++;
			thread->stats.bc[_IOC_NR(cmd)]++;
		}
		switch (cmd) {
		...
		case BC_TRANSACTION:
		case BC_REPLY: {
			struct binder_transaction_data tr;
			// 将参数拷贝在本地变量tr中
			if (copy_from_user(&tr, ptr, sizeof(tr)))
				return -EFAULT;
			ptr += sizeof(tr);
			// 调用此函数进一步处理
			binder_transaction(proc, thread, &tr, cmd == BC_REPLY);
			break;
		}
		...
		default:
			printk(KERN_ERR "binder: %d:%d unknown command %d\n", proc->pid, thread->pid, cmd);
			return -EINVAL;
		}
		*consumed = ptr - buffer;
	}
	return 0;
}
```

首先将用户传进来的参数（主要是`bwr.write_buffer`）拷贝在本地变量`struct binder_transaction_data tr`中去，接着调用`binder_transaction`函数进一步处理：

```c
static void
binder_transaction(struct binder_proc *proc, struct binder_thread *thread,
struct binder_transaction_data *tr, int reply)
{
	struct binder_transaction *t;
	struct binder_work *tcomplete;
	size_t *offp, *off_end;
	struct binder_proc *target_proc;
	struct binder_thread *target_thread = NULL;
	struct binder_node *target_node = NULL;
	struct list_head *target_list;
	wait_queue_head_t *target_wait;
	struct binder_transaction *in_reply_to = NULL;
	struct binder_transaction_log_entry *e;
	uint32_t return_error;

	......
	// reply为0，因为cmd=BC_TRANSACTION，不等于BC_REPLY
	if (reply) {
		......
	} else {
		// tr->target.handle也为0
		if (tr->target.handle) {
			......
		} else {
			// 初始化
			target_node = binder_context_mgr_node;
			if (target_node == NULL) {
				return_error = BR_DEAD_REPLY;
				goto err_no_context_mgr_node;
			}
		}
		......
		// 初始化
		target_proc = target_node->proc;
		if (target_proc == NULL) {
			return_error = BR_DEAD_REPLY;
			goto err_dead_binder;
		}
		......
	}
	if (target_thread) {
		......
	} else {
		// 初始化
		target_list = &target_proc->todo;
		target_wait = &target_proc->wait;
	}

	......
	// 分配了一个待处理事务t和一个待完成工作项tcomplete，并执行初始化工作
	/* TODO: reuse incoming transaction for reply */
	t = kzalloc(sizeof(*t), GFP_KERNEL);
	if (t == NULL) {
		return_error = BR_FAILED_REPLY;
		goto err_alloc_t_failed;
	}
	......

	tcomplete = kzalloc(sizeof(*tcomplete), GFP_KERNEL);
	if (tcomplete == NULL) {
		return_error = BR_FAILED_REPLY;
		goto err_alloc_tcomplete_failed;
	}

	......

	if (!reply && !(tr->flags & TF_ONE_WAY))
		t->from = thread;
	else
		t->from = NULL;
	t->sender_euid = proc->tsk->cred->euid;
	t->to_proc = target_proc;
	t->to_thread = target_thread;
	t->code = tr->code;
	t->flags = tr->flags;
	t->priority = task_nice(current);
	// 在Service Manager的进程空间中分配一块内存保存用户传入的参数
	t->buffer = binder_alloc_buf(target_proc, tr->data_size,
		tr->offsets_size, !reply && (t->flags & TF_ONE_WAY));
	if (t->buffer == NULL) {
		return_error = BR_FAILED_REPLY;
		goto err_binder_alloc_buf_failed;
	}
	t->buffer->allow_user_free = 0;
	t->buffer->debug_id = t->debug_id;
	t->buffer->transaction = t;
	t->buffer->target_node = target_node;
	// 由于现在target_node要被使用了，增加它的引用计数
	if (target_node)
		binder_inc_node(target_node, 1, 0, NULL);

	offp = (size_t *)(t->buffer->data + ALIGN(tr->data_size, sizeof(void *)));
	// 保存参数到Service Manager的进程空间中
	if (copy_from_user(t->buffer->data, tr->data.ptr.buffer, tr->data_size)) {
		......
		return_error = BR_FAILED_REPLY;
		goto err_copy_data_failed;
	}
	if (copy_from_user(offp, tr->data.ptr.offsets, tr->offsets_size)) {
		......
		return_error = BR_FAILED_REPLY;
		goto err_copy_data_failed;
	}
	......

	// 用来处理传输数据中的Binder对象了
	// 此处type为BINDER_TYPE_BINDER类型
	off_end = (void *)offp + tr->offsets_size;
	for (; offp < off_end; offp++) {
		struct flat_binder_object *fp;
		......
		fp = (struct flat_binder_object *)(t->buffer->data + *offp);
		switch (fp->type) {
		case BINDER_TYPE_BINDER:
		case BINDER_TYPE_WEAK_BINDER: {
			struct binder_ref *ref;
			// 由于是第一次在Binder驱动程序中传输这个MediaPlayerService，
			// 调用binder_get_node函数查询这个Binder实体时，会返回空
			// 于是binder_new_node在proc中新建一个，下次就可以直接使用了。
			struct binder_node *node = binder_get_node(proc, fp->binder);
			if (node == NULL) {
				node = binder_new_node(proc, fp->binder, fp->cookie);
				if (node == NULL) {
					return_error = BR_FAILED_REPLY;
					goto err_binder_new_node_failed;
				}
				node->min_priority = fp->flags & FLAT_BINDER_FLAG_PRIORITY_MASK;
				node->accept_fds = !!(fp->flags & FLAT_BINDER_FLAG_ACCEPTS_FDS);
			}
			if (fp->cookie != node->cookie) {
				......
				goto err_binder_get_ref_for_node_failed;
			}
			// 为MediaPlayerService创建一个引用
			ref = binder_get_ref_for_node(target_proc, node);
			if (ref == NULL) {
				return_error = BR_FAILED_REPLY;
				goto err_binder_get_ref_for_node_failed;
			}
			// 注意此时type变成了xxx_HANDLE，handle改为了ref->desc
			// 因为fp最终要传给Service Manager，而SM只能通过句柄值来引用这个Binder实体
			if (fp->type == BINDER_TYPE_BINDER)
				fp->type = BINDER_TYPE_HANDLE;
			else
				fp->type = BINDER_TYPE_WEAK_HANDLE;
			fp->handle = ref->desc;
			// 通过此方法增加引用计数，防止这个引用还在使用过程当中就被销毁
			binder_inc_ref(ref, fp->type == BINDER_TYPE_HANDLE, &thread->todo);
			......

		} break;
		......
		}
	}

	if (reply) {
		......
	} else if (!(t->flags & TF_ONE_WAY)) {
		BUG_ON(t->buffer->async_transaction != 0);
		// 这些值后面会用到
		t->need_reply = 1;
		t->from_parent = thread->transaction_stack;
		thread->transaction_stack = t;
	} else {
		......
	}
	// 待处理事务加入到target_list列表中去
	// 然后把待完成工作项加入到本线程的todo等待执行列表之中
	t->work.type = BINDER_WORK_TRANSACTION;
	list_add_tail(&t->work.entry, target_list);
	tcomplete->type = BINDER_WORK_TRANSACTION_COMPLETE;
	list_add_tail(&tcomplete->entry, &thread->todo);
	// 目标进程有待处理任务了，于是唤醒它
	if (target_wait)
		wake_up_interruptible(target_wait);
	return;
    ......
}
```

这里传进来的参数reply为0，tr->target.handle也为0。因此，target_proc、target_thread、target_node、target_list和target_wait的值分别为：

```c
target_node = binder_context_mgr_node;
target_proc = target_node->proc;
target_list = &target_proc->todo;
target_wait = &target_proc->wait;
```

接着，分配了一个待处理事务t和一个待完成工作项tcomplete，并执行初始化工作：

```c
/* TODO: reuse incoming transaction for reply */
t = kzalloc(sizeof(*t), GFP_KERNEL);
if (t == NULL) {
  return_error = BR_FAILED_REPLY;
  goto err_alloc_t_failed;
}
......

tcomplete = kzalloc(sizeof(*tcomplete), GFP_KERNEL);
if (tcomplete == NULL) {
  return_error = BR_FAILED_REPLY;
  goto err_alloc_tcomplete_failed;
}

......

if (!reply && !(tr->flags & TF_ONE_WAY))
  t->from = thread;
else
  t->from = NULL;
t->sender_euid = proc->tsk->cred->euid;
t->to_proc = target_proc;
t->to_thread = target_thread;
t->code = tr->code;
t->flags = tr->flags;
t->priority = task_nice(current);
t->buffer = binder_alloc_buf(target_proc, tr->data_size,
  tr->offsets_size, !reply && (t->flags & TF_ONE_WAY));
if (t->buffer == NULL) {
  return_error = BR_FAILED_REPLY;
  goto err_binder_alloc_buf_failed;
}
t->buffer->allow_user_free = 0;
t->buffer->debug_id = t->debug_id;
t->buffer->transaction = t;
t->buffer->target_node = target_node;
if (target_node)
  binder_inc_node(target_node, 1, 0, NULL);

offp = (size_t *)(t->buffer->data + ALIGN(tr->data_size, sizeof(void *)));

if (copy_from_user(t->buffer->data, tr->data.ptr.buffer, tr->data_size)) {
  ......
  return_error = BR_FAILED_REPLY;
  goto err_copy_data_failed;
}
if (copy_from_user(offp, tr->data.ptr.offsets, tr->offsets_size)) {
  ......
  return_error = BR_FAILED_REPLY;
  goto err_copy_data_failed;
}
```

注意，这里的事务t是要交给target_proc处理的，在这个场景之下，就是Service Manager了。因此，下面的语句就是Service Manager的进程空间中分配一块内存来保存用户传进入的参数了。

```c
t->buffer = binder_alloc_buf(target_proc, tr->data_size,
  tr->offsets_size, !reply && (t->flags & TF_ONE_WAY));

if (copy_from_user(t->buffer->data, tr->data.ptr.buffer, tr->data_size)) {
  ......
  return_error = BR_FAILED_REPLY;
  goto err_copy_data_failed;
}
if (copy_from_user(offp, tr->data.ptr.offsets, tr->offsets_size)) {
  ......
  return_error = BR_FAILED_REPLY;
  goto err_copy_data_failed;
}
```

由于现在target_node要被使用了，增加它的引用计数：

```c
if (target_node)
  binder_inc_node(target_node, 1, 0, NULL);
```

接下去的for循环，就是用来处理传输数据中的Binder对象了。在我们的场景中，有一个类型为BINDER_TYPE_BINDER的Binder实体MediaPlayerService：

```c
struct flat_binder_object *fp;
if (*offp > t->buffer->data_size - sizeof(*fp) ||
    t->buffer->data_size < sizeof(*fp) ||
    !IS_ALIGNED(*offp, sizeof(void *))) {
  binder_user_error("binder: %d:%d got transaction with "
    "invalid offset, %zd\n",
    proc->pid, thread->pid, *offp);
  return_error = BR_FAILED_REPLY;
  goto err_bad_offset;
}
fp = (struct flat_binder_object *)(t->buffer->data + *offp);
switch (fp->type) {
case BINDER_TYPE_BINDER:
case BINDER_TYPE_WEAK_BINDER: {
  struct binder_ref *ref;
  struct binder_node *node = binder_get_node(proc, fp->binder);
  if (node == NULL) {
    node = binder_new_node(proc, fp->binder, fp->cookie);
    if (node == NULL) {
      return_error = BR_FAILED_REPLY;
      goto err_binder_new_node_failed;
    }
    node->min_priority = fp->flags & FLAT_BINDER_FLAG_PRIORITY_MASK;
    node->accept_fds = !!(fp->flags & FLAT_BINDER_FLAG_ACCEPTS_FDS);
  }
  if (fp->cookie != node->cookie) {
    binder_user_error("binder: %d:%d sending u%p "
      "node %d, cookie mismatch %p != %p\n",
      proc->pid, thread->pid,
      fp->binder, node->debug_id,
      fp->cookie, node->cookie);
    goto err_binder_get_ref_for_node_failed;
  }
  ref = binder_get_ref_for_node(target_proc, node);
  if (ref == NULL) {
    return_error = BR_FAILED_REPLY;
    goto err_binder_get_ref_for_node_failed;
  }
  if (fp->type == BINDER_TYPE_BINDER)
    fp->type = BINDER_TYPE_HANDLE;
  else
    fp->type = BINDER_TYPE_WEAK_HANDLE;
  fp->handle = ref->desc;
  binder_inc_ref(ref, fp->type == BINDER_TYPE_HANDLE, &thread->todo);
  if (binder_debug_mask & BINDER_DEBUG_TRANSACTION)
    printk(KERN_INFO "        node %d u%p -> ref %d desc %d\n",
           node->debug_id, node->ptr, ref->debug_id, ref->desc);
} break;
```

由于是第一次在Binder驱动程序中传输这个MediaPlayerService，调用`binder_get_node`函数查询这个Binder实体时，会返回空，于是`binder_new_node`在proc中新建一个，下次就可以直接使用了。  
现在，由于要把这个Binder实体MediaPlayerService交给target_proc，也就是Service Manager来管理，也就是说Service Manager要引用这个MediaPlayerService了，于是通过`binder_get_ref_for_node`为MediaPlayerService创建一个引用，并且通过`binder_inc_ref`来增加这个引用计数，防止这个引用还在使用过程当中就被销毁。注意，到了这里的时候，t->buffer中的flat_binder_obj的type已经改为BINDER_TYPE_HANDLE，handle已经改为ref->desc，跟原来不一样了，因为这个flat_binder_obj是最终是要传给Service Manager的，而Service Manager只能够通过句柄值来引用这个Binder实体。

最后，在for循环结束后，把待处理事务加入到target_list列表中去，然后把待完成工作项加入到本线程的todo等待执行列表之中：

```c
list_add_tail(&t->work.entry, target_list);
...
list_add_tail(&tcomplete->entry, &thread->todo);
```

这样目标进程有待处理的任务了，于是唤醒它：

```c
if (target_wait)
	wake_up_interruptible(target_wait);
```

这里就是要唤醒Service Manager进程了。回忆一下前面2.2节最后的内容。Service Manager在`binder_thread_read`函数中用`wait_event_interruptible`进入休眠状态。  

这里我们先忽略一下Service Manager被唤醒之后的场景，继续MedaPlayerService的启动过程，然后再回来。

回到binder_ioctl函数，`bwr.read_size > 0`为true，于是进入binder_thread_read函数：

```c
static int
binder_thread_read(struct binder_proc *proc, struct binder_thread *thread,
	void  __user *buffer, int size, signed long *consumed, int non_block)
{
	void __user *ptr = buffer + *consumed;
	void __user *end = buffer + size;

	int ret = 0;
	int wait_for_proc_work;

	if (*consumed == 0) {
		if (put_user(BR_NOOP, (uint32_t __user *)ptr))
			return -EFAULT;
		ptr += sizeof(uint32_t);
	}

retry:
	// 在前面的binder_transaction函数中我们看到了下面俩都不为空，所以wait_for_proc_work=false
	wait_for_proc_work = thread->transaction_stack == NULL && list_empty(&thread->todo);
	...
	if (wait_for_proc_work)
		proc->ready_threads++;
	mutex_unlock(&binder_lock);
	if (wait_for_proc_work) {
	...
	} else {
		if (non_block) {
			if (!binder_has_thread_work(thread))
				ret = -EAGAIN;
		} else
			// 由于todo不为空，因此binder_has_thread_work为true
			// 所以不会进入睡眠，继续往下面执行
			ret = wait_event_interruptible(thread->wait, binder_has_thread_work(thread));
	}
	mutex_lock(&binder_lock);
	if (wait_for_proc_work)
		proc->ready_threads--;
	thread->looper &= ~BINDER_LOOPER_STATE_WAITING;

	...

	while (1) {
		uint32_t cmd;
		struct binder_transaction_data tr;
		struct binder_work *w;
		struct binder_transaction *t = NULL;

		// thread->todo不为空
		if (!list_empty(&thread->todo))
			// 进入这里，w的type在binder_transaction函数中进行了设置
			// 为BINDER_WORK_TRANSACTION_COMPLETE
			w = list_first_entry(&thread->todo, struct binder_work, entry);
		else if (!list_empty(&proc->todo) && wait_for_proc_work)
			w = list_first_entry(&proc->todo, struct binder_work, entry);
		else {
			if (ptr - buffer == 4 && !(thread->looper & BINDER_LOOPER_STATE_NEED_RETURN)) /* no data added */
				goto retry;
			break;
		}

		if (end - ptr < sizeof(tr) + 4)
			break;

		switch (w->type) {
		...
		case BINDER_WORK_TRANSACTION_COMPLETE: {
			cmd = BR_TRANSACTION_COMPLETE;
			if (put_user(cmd, (uint32_t __user *)ptr))
				return -EFAULT;
			ptr += sizeof(uint32_t);

			binder_stat_br(proc, thread, cmd);
			if (binder_debug_mask & BINDER_DEBUG_TRANSACTION_COMPLETE)
				printk(KERN_INFO "binder: %d:%d BR_TRANSACTION_COMPLETE\n",
				       proc->pid, thread->pid);
            // 将w从thread->todo中删除
			list_del(&w->entry);
			kfree(w);
			binder_stats.obj_deleted[BINDER_STAT_TRANSACTION_COMPLETE]++;
		} break;
		...
		}

		if (!t)
			continue;

		...

done:
	...
	return 0;
}
```

这里，`thread->transaction_stack`和`thread->todo`均不为空，于是`wait_for_proc_work`为false，由于`binder_has_thread_work`的时候，返回true，这里因为thread->todo不为空，因此，线程虽然调用了`wait_event_interruptible`，但是不会睡眠，于是继续往下执行。

由于thread->todo不为空，执行下列语句：

```c
if (!list_empty(&thread->todo))
  w = list_first_entry(&thread->todo, struct binder_work, entry);
```

w->type为BINDER_WORK_TRANSACTION_COMPLETE，这是在上面的binder_transaction函数设置的，于是执行：

```c
switch (w->type) {
...
case BINDER_WORK_TRANSACTION_COMPLETE: {
  cmd = BR_TRANSACTION_COMPLETE;
  if (put_user(cmd, (uint32_t __user *)ptr))
    return -EFAULT;
  ptr += sizeof(uint32_t);

  binder_stat_br(proc, thread, cmd);
  if (binder_debug_mask & BINDER_DEBUG_TRANSACTION_COMPLETE)
    printk(KERN_INFO "binder: %d:%d BR_TRANSACTION_COMPLETE\n",
           proc->pid, thread->pid);

  list_del(&w->entry);
  kfree(w);
  binder_stats.obj_deleted[BINDER_STAT_TRANSACTION_COMPLETE]++;
} break;
```

这里就将w从thread->todo删除了。由于这里t为空，重新执行while循环，这时由于已经没有事情可做了，最后就返回到binder_ioctl函数中。注意，在`binder_thread_read`中一共往用户传进来的缓冲区buffer写入了两个整数，分别是BR_NOOP和BR_TRANSACTION_COMPLETE。  

`binder_ioctl`函数返回到用户空间之前，把数据消耗情况拷贝回用户空间中：

```c
if (copy_to_user(ubuf, &bwr, sizeof(bwr))) {
	ret = -EFAULT;
	goto err;
}
```

最后返回到`IPCThreadState::talkWithDriver`函数中，执行下面语句：

```c
if (err >= NO_ERROR) {
    if (bwr.write_consumed > 0) {
        if (bwr.write_consumed < (ssize_t)mOut.dataSize())
            mOut.remove(0, bwr.write_consumed);
        else
            mOut.setDataSize(0);
    }
    if (bwr.read_consumed > 0) {
        mIn.setDataSize(bwr.read_consumed);
        mIn.setDataPosition(0);
    }
    ...
    return NO_ERROR;
}
```

首先是把`mOut`清空：`mOut.setDataSize(0)`，然后设置已经读取的内容的大小：`mIn.setDataSize(bwr.read_consumed); mIn.setDataPosition(0);`。  
然后返回到`IPCThreadState::waitForResponse`函数中。在`IPCThreadState::waitForResponse`函数，先是从mIn读出一个整数，这个便是BR_NOOP了，这是一个空操作，什么也不做。然后继续进入`IPCThreadState::talkWithDriver`函数中。

这时候，下面语句执行后：

```c
const bool needRead = mIn.dataPosition() >= mIn.dataSize();
```

needRead为false，因为在mIn中，尚有一个整数BR_TRANSACTION_COMPLETE未读出。  

然后执行下面这句：

```c
const size_t outAvail = (!doReceive || needRead) ? mOut.dataSize() : 0;
```

outAvail等于0。因此，最后bwr.write_size和bwr.read_size均被赋值为0，`IPCThreadState::talkWithDriver`函数什么也不做，直接返回到`IPCThreadState::waitForResponse`函数中。在`IPCThreadState::waitForResponse`函数，又继续从mIn读出一个整数，这个便是BR_TRANSACTION_COMPLETE：

```c
switch (cmd) {
case BR_TRANSACTION_COMPLETE:
       if (!reply && !acquireResult) goto finish;
       break;
......
}
```

reply不为NULL，因此，IPCThreadState::waitForResponse的循环没有结束，继续执行，又进入到IPCThreadState::talkWithDrive中。  
这次，needRead就为true了，而outAvail仍为0，所以bwr.read_size不为0，bwr.write_size为0。于是通过`ioctl(mProcess->mDriverFD, BINDER_WRITE_READ, &bwr)`进入到Binder驱动程序中的binder_ioctl函数中。由于bwr.write_size为0，bwr.read_size不为0，这次直接就进入到`binder_thread_read`函数中。这时候，`thread->transaction_stack`不等于0，但是`thread->todo`为空，所以`binder_has_thread_work(thread)`为false，于是线程就通过`wait_event_interruptible(thread->wait, binder_has_thread_work(thread))`来唤醒。  

现在，我们可以回到Service Manager被唤醒的过程了。我们接着2.2节的后面继续描述。此时，Service Manager正在`binder_thread_read`函数中调用`wait_event_interruptible_exclusive`进入休眠状态。上面被MediaPlayerService启动后进程唤醒后，继续执行`binder_thread_read`函数：

```c
static int
binder_thread_read(struct binder_proc *proc, struct binder_thread *thread,
				   void  __user *buffer, int size, signed long *consumed, int non_block)
{
	void __user *ptr = buffer + *consumed;
	void __user *end = buffer + size;

	int ret = 0;
	int wait_for_proc_work;

	if (*consumed == 0) {
		if (put_user(BR_NOOP, (uint32_t __user *)ptr))
			return -EFAULT;
		ptr += sizeof(uint32_t);
	}

retry:
	wait_for_proc_work = thread->transaction_stack == NULL && list_empty(&thread->todo);

	......

	if (wait_for_proc_work) {
		......
		if (non_block) {
			if (!binder_has_proc_work(proc, thread))
				ret = -EAGAIN;
		} else
			ret = wait_event_interruptible_exclusive(proc->wait, binder_has_proc_work(proc, thread));
	} else {
		......
	}

	......
	// 被唤醒后进入while循环开始处理事务
	while (1) {
		uint32_t cmd;
		struct binder_transaction_data tr;
		struct binder_work *w;
		struct binder_transaction *t = NULL;

		if (!list_empty(&thread->todo))
			w = list_first_entry(&thread->todo, struct binder_work, entry);
		else if (!list_empty(&proc->todo) && wait_for_proc_work)
			// 来到了这里:wait_for_proc_work=1 & proc->todo不为空
			w = list_first_entry(&proc->todo, struct binder_work, entry);
		else {
			if (ptr - buffer == 4 && !(thread->looper & BINDER_LOOPER_STATE_NEED_RETURN)) /* no data added */
				goto retry;
			break;
		}

		if (end - ptr < sizeof(tr) + 4)
			break;

		switch (w->type) {
		case BINDER_WORK_TRANSACTION: {
			// 获得事务项
			t = container_of(w, struct binder_transaction, work);
									  } break;
		......
		}

		if (!t)
			continue;

		BUG_ON(t->buffer == NULL);
		// 将事务项t中的数据拷贝到本地局部变量tr中去了
		if (t->buffer->target_node) {
			struct binder_node *target_node = t->buffer->target_node;
			tr.target.ptr = target_node->ptr;
			tr.cookie =  target_node->cookie;
			......
			cmd = BR_TRANSACTION;
		} else {
			......
		}
		tr.code = t->code;
		tr.flags = t->flags;
		tr.sender_euid = t->sender_euid;

		if (t->from) {
			struct task_struct *sender = t->from->proc->tsk;
			tr.sender_pid = task_tgid_nr_ns(sender, current->nsproxy->pid_ns);
		} else {
			tr.sender_pid = 0;
		}

		tr.data_size = t->buffer->data_size;
		tr.offsets_size = t->buffer->offsets_size;
		// Binder进程间通信机制的精髓
		tr.data.ptr.buffer = (void *)t->buffer->data + proc->user_buffer_offset;
		tr.data.ptr.offsets = tr.data.ptr.buffer + ALIGN(t->buffer->data_size, sizeof(void *));

		// tr的内容拷贝到用户传进来的缓冲区去了，指针ptr指向这个用户缓冲区的地址
		if (put_user(cmd, (uint32_t __user *)ptr))
			return -EFAULT;
		ptr += sizeof(uint32_t);
		if (copy_to_user(ptr, &tr, sizeof(tr)))
			return -EFAULT;
		ptr += sizeof(tr);

		......
		// 由于已经处理了这个事务，要把它从todo列表中删除
		list_del(&t->work.entry);
		t->buffer->allow_user_free = 1;
		if (cmd == BR_TRANSACTION && !(t->flags & TF_ONE_WAY)) {
			t->to_parent = thread->transaction_stack;
			t->to_thread = thread;
			thread->transaction_stack = t;
		} else {
			t->buffer->transaction = NULL;
			kfree(t);
			binder_stats.obj_deleted[BINDER_STAT_TRANSACTION]++;
		}
		break;
	}

done:

    ......
	return 0;
}
```

Service Manager被唤醒之后，就进入while循环开始处理事务了。这里`wait_for_proc_work`等于1，并且`proc->todo`不为空，所以从`proc->todo`列表中得到第一个工作项：`w = list_first_entry(&proc->todo, struct binder_work, entry);`。  

从上面的描述中，我们知道，这个工作项的类型为BINDER_WORK_TRANSACTION，于是通过下面语句得到事务项：`t = container_of(w, struct binder_transaction, work);`。  

接着就是把事务项t中的数据拷贝到本地局部变量`struct binder_transaction_data tr`中去了：

```c
if (t->buffer->target_node) {
	struct binder_node *target_node = t->buffer->target_node;
	tr.target.ptr = target_node->ptr;
	tr.cookie =  target_node->cookie;
	......
	cmd = BR_TRANSACTION;
} else {
	......
}
tr.code = t->code;
tr.flags = t->flags;
tr.sender_euid = t->sender_euid;

if (t->from) {
	struct task_struct *sender = t->from->proc->tsk;
	tr.sender_pid = task_tgid_nr_ns(sender, current->nsproxy->pid_ns);
} else {
	tr.sender_pid = 0;
}

tr.data_size = t->buffer->data_size;
tr.offsets_size = t->buffer->offsets_size;
tr.data.ptr.buffer = (void *)t->buffer->data + proc->user_buffer_offset;
tr.data.ptr.offsets = tr.data.ptr.buffer + ALIGN(t->buffer->data_size, sizeof(void *));
```

**这里有一个非常重要的地方，是Binder进程间通信机制的精髓所在：**

```c
tr.data.ptr.buffer = (void *)t->buffer->data + proc->user_buffer_offset;
tr.data.ptr.offsets = tr.data.ptr.buffer + ALIGN(t->buffer->data_size, sizeof(void *));
```

t->buffer->data所指向的地址是内核空间的，现在要把数据返回给Service Manager进程的用户空间，而Service Manager进程的用户空间是不能访问内核空间的数据的，所以这里要作一下处理。怎么处理呢？我们在学面向对象语言的时候，对象的拷贝有深拷贝和浅拷贝之分，深拷贝是把另外分配一块新内存，然后把原始对象的内容搬过去，浅拷贝是并没有为新对象分配一块新空间，而只是分配一个引用，而个引用指向原始对象。 **Binder机制用的是类似浅拷贝的方法，通过在用户空间分配一个虚拟地址，然后让这个用户空间虚拟地址与t->buffer->data这个内核空间虚拟地址指向同一个物理地址，这样就可以实现浅拷贝了。** 怎么样用户空间和内核空间的虚拟地址同时指向同一个物理地址呢？请参考2.2节，那里有详细描述。这里只要将t->buffer->data加上一个偏移值proc->user_buffer_offset就可以得到t->buffer->data对应的用户空间虚拟地址了。调整了tr.data.ptr.buffer的值之后，不要忘记也要一起调整tr.data.ptr.offsets的值。

接着就是把tr的内容拷贝到用户传进来的缓冲区去了，指针ptr指向这个用户缓冲区的地址：

```c
if (put_user(cmd, (uint32_t __user *)ptr))
    return -EFAULT;
ptr += sizeof(uint32_t);
if (copy_to_user(ptr, &tr, sizeof(tr)))
    return -EFAULT;
ptr += sizeof(tr);
```

这里可以看出，这里只是对作`tr.data.ptr.buffer`和`tr.data.ptr.offsets`的内容作了浅拷贝。  
最后，由于已经处理了这个事务，要把它从todo列表中删除：

```c
list_del(&t->work.entry);
t->buffer->allow_user_free = 1;
if (cmd == BR_TRANSACTION && !(t->flags & TF_ONE_WAY)) {
    t->to_parent = thread->transaction_stack;
    t->to_thread = thread;
    thread->transaction_stack = t;
} else {
    t->buffer->transaction = NULL;
    kfree(t);
    binder_stats.obj_deleted[BINDER_STAT_TRANSACTION]++;
}
```

注意，这里的`cmd == BR_TRANSACTION && !(t->flags & TF_ONE_WAY)`为true，表明这个事务虽然在驱动程序中已经处理完了，但是它仍然要等待Service Manager完成之后，给驱动程序一个确认，也就是需要等待回复，于是把当前事务t放在`thread->transaction_stack`队列的头部；如果`cmd == BR_TRANSACTION && !(t->flags & TF_ONE_WAY)`为false，那就不需要等待回复了，直接把事务t删掉。

这个while最后通过一个break跳了出来，最后返回到`binder_ioctl`函数中：

```c
if (bwr.read_size > 0) {
    ret = binder_thread_read(proc, thread, (void __user *)bwr.read_buffer, bwr.read_size, &bwr.read_consumed, filp->f_flags & O_NONBLOCK);
    if (!list_empty(&proc->todo))
        wake_up_interruptible(&proc->wait);
    if (ret < 0) {
        if (copy_to_user(ubuf, &bwr, sizeof(bwr)))
            ret = -EFAULT;
        goto err;
    }
}
```

从`binder_thread_read`返回来后，再看看`proc->todo`是否还有事务等待处理，如果是，就把睡眠在`proc->wait`队列的线程唤醒来处理。最后，把本地变量`struct binder_write_read bwr`的内容拷贝回到用户传进来的缓冲区中，就返回了。

然后就回到用户空间中的`binder.c`中的`binder_loop`了：

```c
void binder_loop(struct binder_state *bs, binder_handler func)
{
    int res;
    struct binder_write_read bwr;
    unsigned readbuf[32];

    bwr.write_size = 0;
    bwr.write_consumed = 0;
    bwr.write_buffer = 0;

    readbuf[0] = BC_ENTER_LOOPER;
    binder_write(bs, readbuf, sizeof(unsigned));

    for (;;) {
        bwr.read_size = sizeof(readbuf);
        bwr.read_consumed = 0;
        bwr.read_buffer = (unsigned) readbuf;

        res = ioctl(bs->fd, BINDER_WRITE_READ, &bwr);

        if (res < 0) {
            LOGE("binder_loop: ioctl failed (%s)\n", strerror(errno));
            break;
        }

        res = binder_parse(bs, 0, readbuf, bwr.read_consumed, func);
        if (res == 0) {
            LOGE("binder_loop: unexpected reply?!\n");
            break;
        }
        if (res < 0) {
            LOGE("binder_loop: io error %d %s\n", res, strerror(errno));
            break;
        }
    }
}
```

返回来的数据都放在readbuf中，接着调用binder_parse进行解析：

```c
int binder_parse(struct binder_state *bs, struct binder_io *bio,
                 uint32_t *ptr, uint32_t size, binder_handler func)
{
    int r = 1;
    uint32_t *end = ptr + (size / 4);

    while (ptr < end) {
        uint32_t cmd = *ptr++;
        ...
        switch(cmd) {
        ...
        case BR_TRANSACTION: {
            // 首先把从Binder驱动程序读出来的数据保存在txn中
            struct binder_txn *txn = (void *) ptr;
            if ((end - ptr) * sizeof(uint32_t) < sizeof(struct binder_txn)) {
                LOGE("parse: txn too small!\n");
                return -1;
            }
            binder_dump_txn(txn);
            if (func) {
                unsigned rdata[256/4];
                struct binder_io msg;
                struct binder_io reply;
                int res;
                // 调用bio_init来初始化reply变量
                bio_init(&reply, rdata, sizeof(rdata), 4);
                // 调用bio_init_from_txn来初始化msg变量
                bio_init_from_txn(&msg, txn);
                // 调用func进行处理，对应svcmgr_handler函数
                res = func(bs, txn, &msg, &reply);
                // 告诉Binder驱动完成了任务
                binder_send_reply(bs, &reply, txn->data, res);
            }
            ptr += sizeof(*txn) / sizeof(uint32_t);
            break;
        }
        ...
        default:
            LOGE("parse: OOPS %d\n", cmd);
            return -1;
        }
    }

    return r;
}
```

首先把从Binder驱动程序读出来的数据转换为一个`struct binder_txn`结构体，保存在txn本地变量中，`struct binder_txn`定义在frameworks/base/cmds/servicemanager/binder.h文件中，此外函数中还用到了另外一个数据结构`struct binder_io`，也定义在其中：

```c
struct binder_txn
{
    void *target;
    void *cookie;
    uint32_t code;
    uint32_t flags;

    uint32_t sender_pid;
    uint32_t sender_euid;

    uint32_t data_size;
    uint32_t offs_size;
    void *data;
    void *offs;
};

struct binder_io
{
    char *data;            /* pointer to read/write from */
    uint32_t *offs;        /* array of offsets */
    uint32_t data_avail;   /* bytes available in data buffer */
    uint32_t offs_avail;   /* entries available in offsets array */

    char *data0;           /* start of data buffer */
    uint32_t *offs0;       /* start of offsets buffer */
    uint32_t flags;
    uint32_t unused;
};
```

接下来，调用`bio_init`来初始化reply变量：

```c
void bio_init(struct binder_io *bio, void *data,
              uint32_t maxdata, uint32_t maxoffs)
{
    uint32_t n = maxoffs * sizeof(uint32_t);

    if (n > maxdata) {
        bio->flags = BIO_F_OVERFLOW;
        bio->data_avail = 0;
        bio->offs_avail = 0;
        return;
    }

    bio->data = bio->data0 = data + n;
    bio->offs = bio->offs0 = data;
    bio->data_avail = maxdata - n;
    bio->offs_avail = maxoffs;
    bio->flags = 0;
}
```

接着又调用`bio_init_from_txn`来初始化msg变量：

```c
void bio_init_from_txn(struct binder_io *bio, struct binder_txn *txn)
{
    bio->data = bio->data0 = txn->data;
    bio->offs = bio->offs0 = txn->offs;
    bio->data_avail = txn->data_size;
    bio->offs_avail = txn->offs_size / 4;
    bio->flags = BIO_F_SHARED;
}
```

最后，真正进行处理的函数是从参数中传进来的函数指针`func`，这里就是定义在frameworks/base/cmds/servicemanager/service_manager.c文件中的`svcmgr_handler`函数：

```c
int svcmgr_handler(struct binder_state *bs,
                   struct binder_txn *txn,
                   struct binder_io *msg,
                   struct binder_io *reply)
{
    struct svcinfo *si;
    uint16_t *s;
    unsigned len;
    void *ptr;
    uint32_t strict_policy;

//    LOGI("target=%p code=%d pid=%d uid=%d\n",
//         txn->target, txn->code, txn->sender_pid, txn->sender_euid);

    if (txn->target != svcmgr_handle)
        return -1;

    // Equivalent to Parcel::enforceInterface(), reading the RPC
    // header with the strict mode policy mask and the interface name.
    // Note that we ignore the strict_policy and don't propagate it
    // further (since we do no outbound RPCs anyway).
    strict_policy = bio_get_uint32(msg);
    s = bio_get_string16(msg, &len);
    if ((len != (sizeof(svcmgr_id) / 2)) ||
        memcmp(svcmgr_id, s, sizeof(svcmgr_id))) {
        fprintf(stderr,"invalid id %s\n", str8(s));
        return -1;
    }

    switch(txn->code) {
    ...
    case SVC_MGR_ADD_SERVICE:
        s = bio_get_string16(msg, &len);
        ptr = bio_get_ref(msg);
        if (do_add_service(bs, s, len, ptr, txn->sender_euid))
            return -1;
        break;
    ...
    }

    bio_put_uint32(reply, 0);
    return 0;
}
```

回忆一下，在`BpServiceManager::addService`时，传给Binder驱动程序的参数为：

```c
writeInt32(IPCThreadState::self()->getStrictModePolicy() |
               STRICT_MODE_PENALTY_GATHER);
writeString16("android.os.IServiceManager");
writeString16("media.player");
writeStrongBinder(new MediaPlayerService());
```

这里的语句：

```c
strict_policy = bio_get_uint32(msg);
s = bio_get_string16(msg, &len);
s = bio_get_string16(msg, &len);
ptr = bio_get_ref(msg);
```

就是依次把它们读取出来了，这里，我们只要看一下bio_get_ref的实现。先看一个数据结构`struct binder_obj`的定义：

```c
struct binder_object
{
    uint32_t type;
    uint32_t flags;
    void *pointer;
    void *cookie;
};
```

这个结构体就是对应`struct flat_binder_obj`的。

接着看`bio_get_ref`实现：

```c
void *bio_get_ref(struct binder_io *bio)
{
    struct binder_object *obj;

    obj = _bio_get_obj(bio);
    if (!obj)
        return 0;

    if (obj->type == BINDER_TYPE_HANDLE)
        return obj->pointer;

    return 0;
}
```

`_bio_get_obj`这个函数就不跟进去看了，它的作用就是从binder_io中取得第一个还没取获取过的binder_object。在这个场景下，就是我们最开始传过来代表MediaPlayerService的flat_binder_obj了，这个原始的flat_binder_obj的type为BINDER_TYPE_BINDER，binder为指向MediaPlayerService的弱引用的地址。  
在前面我们说过，在Binder驱动驱动程序里面，会把这个flat_binder_obj的type改为BINDER_TYPE_HANDLE，handle改为一个句柄值。这里的handle值就等于obj->pointer的值。

回到`svcmgr_handler`函数，调用`do_add_service`进一步处理：

```c
int do_add_service(struct binder_state *bs,
                   uint16_t *s, unsigned len,
                   void *ptr, unsigned uid)
{
    struct svcinfo *si;
//    LOGI("add_service('%s',%p) uid=%d\n", str8(s), ptr, uid);

    if (!ptr || (len == 0) || (len > 127))
        return -1;

    if (!svc_can_register(uid, s)) {
        LOGE("add_service('%s',%p) uid=%d - PERMISSION DENIED\n",
             str8(s), ptr, uid);
        return -1;
    }

    si = find_svc(s, len);
    if (si) {
        if (si->ptr) {
            LOGE("add_service('%s',%p) uid=%d - ALREADY REGISTERED\n",
                 str8(s), ptr, uid);
            return -1;
        }
        si->ptr = ptr;
    } else {
        // 将Binder实体的引用保存早struct svcinfo中，然后插入到链表svclist的头部
        si = malloc(sizeof(*si) + (len + 1) * sizeof(uint16_t));
        if (!si) {
            LOGE("add_service('%s',%p) uid=%d - OUT OF MEMORY\n",
                 str8(s), ptr, uid);
            return -1;
        }
        si->ptr = ptr;
        si->len = len;
        memcpy(si->name, s, (len + 1) * sizeof(uint16_t));
        si->name[len] = '\0';
        si->death.func = svcinfo_death;
        si->death.ptr = si;
        si->next = svclist;
        svclist = si;
    }

    binder_acquire(bs, ptr);
    binder_link_to_death(bs, ptr, &si->death);
    return 0;
}
```

这个函数的实现很简单，就是把MediaPlayerService这个Binder实体的引用写到一个`struct svcinfo`结构体中，主要是它的名称和句柄值，然后插入到链接svclist的头部去。这样，Client来向Service Manager查询服务接口时，只要给定服务名称，Service Manger就可以返回相应的句柄值了。

这个函数执行完成后，返回到svcmgr_handler函数，函数的最后，将一个错误码0写到reply变量中去，表示一切正常：`bio_put_uint32(reply, 0);`。  

`svcmgr_handler`函数执行完成后，返回到`binder_parse`函数中，执行下面语句：

```c
binder_send_reply(bs, &reply, txn->data, res);
```

该函数从名字就可以看出来，它将告诉Binder驱动程序，已经完成了任务：

```c
void binder_send_reply(struct binder_state *bs,
                       struct binder_io *reply,
                       void *buffer_to_free,
                       int status)
{
    struct {
        uint32_t cmd_free;
        void *buffer;
        uint32_t cmd_reply;
        struct binder_txn txn;
    } __attribute__((packed)) data;

    data.cmd_free = BC_FREE_BUFFER;
    data.buffer = buffer_to_free;
    data.cmd_reply = BC_REPLY;
    data.txn.target = 0;
    data.txn.cookie = 0;
    data.txn.code = 0;
    if (status) {
        data.txn.flags = TF_STATUS_CODE;
        data.txn.data_size = sizeof(int);
        data.txn.offs_size = 0;
        data.txn.data = &status;
        data.txn.offs = 0;
    } else {
        data.txn.flags = 0;
        data.txn.data_size = reply->data - reply->data0;
        data.txn.offs_size = ((char*) reply->offs) - ((char*) reply->offs0);
        data.txn.data = reply->data0;
        data.txn.offs = reply->offs0;
    }
    binder_write(bs, &data, sizeof(data));
}
```

从这里可以看出，`binder_send_reply`告诉Binder驱动程序执行`BC_FREE_BUFFER`和`BC_REPLY`命令，前者释放之前在`binder_transaction`分配的空间，地址为`buffer_to_free`，`buffer_to_free`这个地址是Binder驱动程序把自己在内核空间用的地址转换成用户空间地址再传给Service Manager的，所以Binder驱动程序拿到这个地址后，知道怎么样释放这个空间；后者告诉MediaPlayerService，它的addService操作已经完成了，错误码是0，保存在`data.txn.data`中。

再来看上面函数最后调用的`binder_write`函数：

```c
int binder_write(struct binder_state *bs, void *data, unsigned len)
{
    struct binder_write_read bwr;
    int res;
    bwr.write_size = len;
    bwr.write_consumed = 0;
    bwr.write_buffer = (unsigned) data;
    bwr.read_size = 0;
    bwr.read_consumed = 0;
    bwr.read_buffer = 0;
    res = ioctl(bs->fd, BINDER_WRITE_READ, &bwr);
    if (res < 0) {
        fprintf(stderr,"binder_write: ioctl failed (%s)\n",
                strerror(errno));
    }
    return res;
}
```

这里可以看出，只有写操作，没有读操作，即read_size为0。  

这里又是一个`ioctl`的BINDER_WRITE_READ操作。直入到驱动程序的`binder_ioctl`函数后，执行BINDER_WRITE_READ命令，这里就不累述了。  
最后，从`binder_ioctl`执行到`binder_thread_write`函数，我们首先看第一个命令`BC_FREE_BUFFER`：

```c
int
binder_thread_write(struct binder_proc *proc, struct binder_thread *thread,
					void __user *buffer, int size, signed long *consumed)
{
	uint32_t cmd;
	void __user *ptr = buffer + *consumed;
	void __user *end = buffer + size;
 
	while (ptr < end && thread->return_error == BR_OK) {
		if (get_user(cmd, (uint32_t __user *)ptr))
			return -EFAULT;
		ptr += sizeof(uint32_t);
		if (_IOC_NR(cmd) < ARRAY_SIZE(binder_stats.bc)) {
			binder_stats.bc[_IOC_NR(cmd)]++;
			proc->stats.bc[_IOC_NR(cmd)]++;
			thread->stats.bc[_IOC_NR(cmd)]++;
		}
		switch (cmd) {
		......
		case BC_FREE_BUFFER: {
			void __user *data_ptr;
			struct binder_buffer *buffer;
			// 获得要删除的Buffer的用户空间地址
			if (get_user(data_ptr, (void * __user *)ptr))
				return -EFAULT;
			ptr += sizeof(void *);
			// 找到data_ptr地址对应的struct binder_buffer信息
			buffer = binder_buffer_lookup(proc, data_ptr);
			if (buffer == NULL) {
				binder_user_error("binder: %d:%d "
					"BC_FREE_BUFFER u%p no match\n",
					proc->pid, thread->pid, data_ptr);
				break;
			}
			if (!buffer->allow_user_free) {
				binder_user_error("binder: %d:%d "
					"BC_FREE_BUFFER u%p matched "
					"unreturned buffer\n",
					proc->pid, thread->pid, data_ptr);
				break;
			}
			if (binder_debug_mask & BINDER_DEBUG_FREE_BUFFER)
				printk(KERN_INFO "binder: %d:%d BC_FREE_BUFFER u%p found buffer %d for %s transaction\n",
				proc->pid, thread->pid, data_ptr, buffer->debug_id,
				buffer->transaction ? "active" : "finished");
 
			if (buffer->transaction) {
				buffer->transaction->buffer = NULL;
				buffer->transaction = NULL;
			}
			if (buffer->async_transaction && buffer->target_node) {
				BUG_ON(!buffer->target_node->has_async_transaction);
				if (list_empty(&buffer->target_node->async_todo))
					buffer->target_node->has_async_transaction = 0;
				else
					list_move_tail(buffer->target_node->async_todo.next, &thread->todo);
			}
			// 释放这块内存
			binder_transaction_buffer_release(proc, buffer, NULL);
			binder_free_buf(proc, buffer);
			break;
							 }
 
		......
		*consumed = ptr - buffer;
	}
	return 0;
}
```

首先通过看这个语句：`get_user(data_ptr, (void * __user *)ptr)`，这个是获得要删除的Buffer的用户空间地址，接着通过下面这个语句来找到这个地址对应的`struct binder_buffer`信息：

```c
buffer = binder_buffer_lookup(proc, data_ptr);
```

因为这个空间是前面在`binder_transaction`里面分配的，所以这里一定能找到。最后，就可以释放这块内存了：

```c
binder_transaction_buffer_release(proc, buffer, NULL);
binder_free_buf(proc, buffer);
```

再来看另外一个命令BC_REPLY：

```c
case BC_TRANSACTION:
case BC_REPLY: {
    struct binder_transaction_data tr;

    if (copy_from_user(&tr, ptr, sizeof(tr)))
        return -EFAULT;
    ptr += sizeof(tr);
    binder_transaction(proc, thread, &tr, cmd == BC_REPLY);
    break;
}
```

又再次进入到`binder_transaction`函数：

```c
// 此处reply=1
static void
binder_transaction(struct binder_proc *proc, struct binder_thread *thread,
struct binder_transaction_data *tr, int reply)
{
	struct binder_transaction *t;
	struct binder_work *tcomplete;
	size_t *offp, *off_end;
	struct binder_proc *target_proc;
	struct binder_thread *target_thread = NULL;
	struct binder_node *target_node = NULL;
	struct list_head *target_list;
	wait_queue_head_t *target_wait;
	struct binder_transaction *in_reply_to = NULL;
	struct binder_transaction_log_entry *e;
	uint32_t return_error;

	......

	if (reply) {
		// 把处理完的事务取回来，存放在本地变量中
		in_reply_to = thread->transaction_stack;
		if (in_reply_to == NULL) {
			......
			return_error = BR_FAILED_REPLY;
			goto err_empty_call_stack;
		}
		binder_set_nice(in_reply_to->saved_priority);
		if (in_reply_to->to_thread != thread) {
			.......
			goto err_bad_call_stack;
		}
		thread->transaction_stack = in_reply_to->to_parent;
		// 可以通过in_reply_to得到最终发出这个事务请求的线程
		target_thread = in_reply_to->from;
		if (target_thread == NULL) {
			return_error = BR_DEAD_REPLY;
			goto err_dead_binder;
		}
		if (target_thread->transaction_stack != in_reply_to) {
			......
			return_error = BR_FAILED_REPLY;
			in_reply_to = NULL;
			target_thread = NULL;
			goto err_dead_binder;
		}
		// 可以通过in_reply_to得到最终发出这个事务请求的进程
		target_proc = target_thread->proc;
	} else {
		......
	}
	if (target_thread) {
		e->to_thread = target_thread->pid;
		// 得到target_list和target_wait
		target_list = &target_thread->todo;
		target_wait = &target_thread->wait;
	} else {
		......
	}

	/* TODO: reuse incoming transaction for reply */
	t = kzalloc(sizeof(*t), GFP_KERNEL);
	if (t == NULL) {
		return_error = BR_FAILED_REPLY;
		goto err_alloc_t_failed;
	}


	tcomplete = kzalloc(sizeof(*tcomplete), GFP_KERNEL);
	if (tcomplete == NULL) {
		return_error = BR_FAILED_REPLY;
		goto err_alloc_tcomplete_failed;
	}
 
	if (!reply && !(tr->flags & TF_ONE_WAY))
		t->from = thread;
	else
		t->from = NULL;
	t->sender_euid = proc->tsk->cred->euid;
	t->to_proc = target_proc;
	t->to_thread = target_thread;
	t->code = tr->code;
	t->flags = tr->flags;
	t->priority = task_nice(current);
	t->buffer = binder_alloc_buf(target_proc, tr->data_size,
		tr->offsets_size, !reply && (t->flags & TF_ONE_WAY));
	if (t->buffer == NULL) {
		return_error = BR_FAILED_REPLY;
		goto err_binder_alloc_buf_failed;
	}
	t->buffer->allow_user_free = 0;
	t->buffer->debug_id = t->debug_id;
	t->buffer->transaction = t;
	t->buffer->target_node = target_node;       // NULL
	if (target_node)
		binder_inc_node(target_node, 1, 0, NULL);
 
	offp = (size_t *)(t->buffer->data + ALIGN(tr->data_size, sizeof(void *)));
 
	if (copy_from_user(t->buffer->data, tr->data.ptr.buffer, tr->data_size)) {
		binder_user_error("binder: %d:%d got transaction with invalid "
			"data ptr\n", proc->pid, thread->pid);
		return_error = BR_FAILED_REPLY;
		goto err_copy_data_failed;
	}
	if (copy_from_user(offp, tr->data.ptr.offsets, tr->offsets_size)) {
		binder_user_error("binder: %d:%d got transaction with invalid "
			"offsets ptr\n", proc->pid, thread->pid);
		return_error = BR_FAILED_REPLY;
		goto err_copy_data_failed;
	}

    ......

	if (reply) {
		BUG_ON(t->buffer->async_transaction != 0);
		// pop传入的transaction
		binder_pop_transaction(target_thread, in_reply_to);
	} else if (!(t->flags & TF_ONE_WAY)) {
		......
	} else {
		......
	}
	t->work.type = BINDER_WORK_TRANSACTION;
	// target_list就是MPS主线程的thread->todo队列
	list_add_tail(&t->work.entry, target_list);
	tcomplete->type = BINDER_WORK_TRANSACTION_COMPLETE;
	// thread->todo是指SM中用来回复IServiceManager::addService请求的线程
	list_add_tail(&tcomplete->entry, &thread->todo);
	// 唤醒MPS的主线程
	if (target_wait)
		wake_up_interruptible(target_wait);
	return;
    ......
}
```

注意，这里的入参reply为1，我们忽略掉其它无关代码。

在前面Service Manager正在`binder_thread_read`函数中被MediaPlayerService启动后进程唤醒后，在最后会把当前处理完的事务放在`thread->transaction_stack`中：

```c
if (cmd == BR_TRANSACTION && !(t->flags & TF_ONE_WAY)) {
	t->to_parent = thread->transaction_stack;
	t->to_thread = thread;
	thread->transaction_stack = t;
}
```

所以这里首先是把它这个binder_transaction取回来，并且放在本地变量in_reply_to中：`in_reply_to = thread->transaction_stack;`

接着就可以通过in_reply_to得到最终发出这个事务请求的线程和进程：

```c
target_thread = in_reply_to->from;
target_proc = target_thread->proc;
```

然后得到target_list和target_wait：

```c
target_list = &target_thread->todo;
target_wait = &target_thread->wait;
```

接下来到for循环前面的代码之前已经分析过了，但是需要注意的是：这里target_node为NULL，因此，t->buffer->target_node也为NULL。

函数本来有一个for循环，用来处理数据中的Binder对象，这里由于没有Binder对象，所以就略过了。到了下面这句代码：

```c
binder_pop_transaction(target_thread, in_reply_to);
```

看看这个方法做了什么：

```c
static void
binder_pop_transaction(
	struct binder_thread *target_thread, struct binder_transaction *t)
{
	if (target_thread) {
		BUG_ON(target_thread->transaction_stack != t);
		BUG_ON(target_thread->transaction_stack->from != target_thread);
		target_thread->transaction_stack =
			target_thread->transaction_stack->from_parent;
		t->from = NULL;
	}
	t->need_reply = 0;
	if (t->buffer)
		t->buffer->transaction = NULL;
	kfree(t);
	binder_stats.obj_deleted[BINDER_STAT_TRANSACTION]++;
}
```

上面这个方法最终删掉了`t`也就是传入的`in_reply_to`。  

回到`binder_transaction`函数：

```c
t->work.type = BINDER_WORK_TRANSACTION;
list_add_tail(&t->work.entry, target_list);
tcomplete->type = BINDER_WORK_TRANSACTION_COMPLETE;
list_add_tail(&tcomplete->entry, &thread->todo);
```

前面一样，分别把t和tcomplete分别放在target_list和thread->todo队列中，这里的target_list指的就是最初调用`IServiceManager::addService`的MediaPlayerService的Server主线程的的thread->todo队列了，而thread->todo指的是Service Manager中用来回复`IServiceManager::addService`请求的线程。  

最后，唤醒等待在`target_wait`队列上的线程了，就是最初调用`IServiceManager::addService`的`MediaPlayerService`的Server主线程了，它最后在`binder_thread_read`函数中睡眠在`thread->wait`上，就是这里的`target_wait`了：

```c
if (target_wait)
	wake_up_interruptible(target_wait);
```

这样，Service Manger回复调用`IServiceManager::addService`请求就算完成了，重新回到`frameworks/base/cmds/servicemanager/binder.c`文件中的`binder_loop`函数等待下一个Client请求的到来。事实上，Service Manger回到`binder_loop`函数再次执行ioctl函数时候，又会再次进入到`binder_thread_read`函数。这时个会发现`thread->todo`不为空，这是因为刚才我们调用了`list_add_tail(&tcomplete->entry, &thread->todo);`。  

把一个工作项`tcompelete`放在了在`thread->todo`中，这个`tcompelete`的type为`BINDER_WORK_TRANSACTION_COMPLETE`，因此，Binder驱动程序会执行下面操作：

```c
case BINDER_WORK_TRANSACTION_COMPLETE: {
			cmd = BR_TRANSACTION_COMPLETE;
			if (put_user(cmd, (uint32_t __user *)ptr))
				return -EFAULT;
			ptr += sizeof(uint32_t);

			binder_stat_br(proc, thread, cmd);
			if (binder_debug_mask & BINDER_DEBUG_TRANSACTION_COMPLETE)
				printk(KERN_INFO "binder: %d:%d BR_TRANSACTION_COMPLETE\n",
				       proc->pid, thread->pid);

			list_del(&w->entry);
			kfree(w);
			binder_stats.obj_deleted[BINDER_STAT_TRANSACTION_COMPLETE]++;
		} break;
```

`binder_loop`函数执行完这个ioctl调用后，才会在下一次调用ioctl进入到Binder驱动程序进入休眠状态，等待下一次Client的请求。

上面讲到调用`IServiceManager::addService`的MediaPlayerService的Server主线程被唤醒了，于是，重新执行`binder_thread_read`函数。  

```c
static int
binder_thread_read(struct binder_proc *proc, struct binder_thread *thread,
				   void  __user *buffer, int size, signed long *consumed, int non_block)
{
	void __user *ptr = buffer + *consumed;
	void __user *end = buffer + size;
 
	int ret = 0;
	int wait_for_proc_work;
 
	if (*consumed == 0) {
		if (put_user(BR_NOOP, (uint32_t __user *)ptr))
			return -EFAULT;
		ptr += sizeof(uint32_t);
	}
 
retry:
	wait_for_proc_work = thread->transaction_stack == NULL && list_empty(&thread->todo);
 
	......
 
	if (wait_for_proc_work) {
		......
	} else {
		if (non_block) {
			if (!binder_has_thread_work(thread))
				ret = -EAGAIN;
		} else
			ret = wait_event_interruptible(thread->wait, binder_has_thread_work(thread));
	}
	
	......
 
	while (1) {
		uint32_t cmd;
		struct binder_transaction_data tr;
		struct binder_work *w;
		struct binder_transaction *t = NULL;
 
		if (!list_empty(&thread->todo))
			// 走这个分支
			w = list_first_entry(&thread->todo, struct binder_work, entry);
		else if (!list_empty(&proc->todo) && wait_for_proc_work)
			w = list_first_entry(&proc->todo, struct binder_work, entry);
		else {
			if (ptr - buffer == 4 && !(thread->looper & BINDER_LOOPER_STATE_NEED_RETURN)) /* no data added */
				goto retry;
			break;
		}
 
		......
 
		switch (w->type) {
		case BINDER_WORK_TRANSACTION: {
			t = container_of(w, struct binder_transaction, work);
									  } break;
		......
		}
 
		if (!t)
			continue;
 
		BUG_ON(t->buffer == NULL);
		if (t->buffer->target_node) {
			......
		} else {
			tr.target.ptr = NULL;
			tr.cookie = NULL;
			cmd = BR_REPLY;
		}
		tr.code = t->code;
		tr.flags = t->flags;
		tr.sender_euid = t->sender_euid;
 
		if (t->from) {
			......
		} else {
			tr.sender_pid = 0;
		}
 
		tr.data_size = t->buffer->data_size;
		tr.offsets_size = t->buffer->offsets_size;
		tr.data.ptr.buffer = (void *)t->buffer->data + proc->user_buffer_offset;
		tr.data.ptr.offsets = tr.data.ptr.buffer + ALIGN(t->buffer->data_size, sizeof(void *));
 
		if (put_user(cmd, (uint32_t __user *)ptr))
			return -EFAULT;
		ptr += sizeof(uint32_t);
		if (copy_to_user(ptr, &tr, sizeof(tr)))
			return -EFAULT;
		ptr += sizeof(tr);
 
		......
 
		list_del(&t->work.entry);
		t->buffer->allow_user_free = 1;
		if (cmd == BR_TRANSACTION && !(t->flags & TF_ONE_WAY)) {
			......
		} else {
			t->buffer->transaction = NULL;
			kfree(t);
			binder_stats.obj_deleted[BINDER_STAT_TRANSACTION]++;
		}
		break;
	}
 
done:
	......
	return 0;
}
```

在函数的while循环中，从`thread->todo`得到`w`，`w->type`为`BINDER_WORK_TRANSACTION`，于是，得到`t`。从上面可以知道，Service Manager反回了一个0回来，写在`t->buffer->data`里面，现在把`t->buffer->data`加上`proc->user_buffer_offset`，得到用户空间地址，保存在`tr.data.ptr.buffer`里面，这样用户空间就可以访问这个返回码了。由于cmd不等于BR_TRANSACTION，这时就可以把t删除掉了，因为以后都不需要用了。  

执行完这个函数后，就返回到`binder_ioctl`函数，执行下面语句，把数据返回给用户空间：

```c
if (copy_to_user(ubuf, &bwr, sizeof(bwr))) {
    ret = -EFAULT;
    goto err;
}
```

接着返回到用户空间`IPCThreadState::talkWithDriver`函数，最后返回到`IPCThreadState::waitForResponse`函数，最终执行到下面语句：

```c
status_t IPCThreadState::waitForResponse(Parcel *reply, status_t *acquireResult)
{
	int32_t cmd;
	int32_t err;
 
	while (1) {
		if ((err=talkWithDriver()) < NO_ERROR) break;
		
		......
 
		cmd = mIn.readInt32();
 
		......
 
		switch (cmd) {
		......
		case BR_REPLY:
			{
				binder_transaction_data tr;
				err = mIn.read(&tr, sizeof(tr));
				LOG_ASSERT(err == NO_ERROR, "Not enough command data for brREPLY");
				if (err != NO_ERROR) goto finish;
 
				if (reply) {
					if ((tr.flags & TF_STATUS_CODE) == 0) {
						reply->ipcSetDataReference(
							reinterpret_cast<const uint8_t*>(tr.data.ptr.buffer),
							tr.data_size,
							reinterpret_cast<const size_t*>(tr.data.ptr.offsets),
							tr.offsets_size/sizeof(size_t),
							freeBuffer, this);
					} else {
						......
					}
				} else {
					......
				}
			}
			goto finish;
 
		......
		}
	}
 
finish:
	......
	return err;
}
```

注意，这里的tr.flags等于0，这个是在上面`binder_send_reply`函数里设置的。最终把结果保存在reply了：

```c
reply->ipcSetDataReference(
       reinterpret_cast<const uint8_t*>(tr.data.ptr.buffer),
       tr.data_size,
       reinterpret_cast<const size_t*>(tr.data.ptr.offsets),
       tr.offsets_size/sizeof(size_t),
       freeBuffer, this);
```

从这里层层返回，最后回到`MediaPlayerService::instantiate`函数中。

至此，`IServiceManager::addService`终于执行完毕了。这个过程非常复杂，但是如果我们能够深刻地理解这一过程，将能很好地理解Binder机制的设计思想和实现过程。这里，对`IServiceManager::addService`过程中MediaPlayerService、ServiceManager和BinderDriver之间的交互作一个小结：

![IServiceManager::addService的时序图](/assets/images/android/binder_service_manager_add_service_sequence.png)

回到frameworks/base/media/mediaserver/main_mediaserver.cpp文件中的main函数，接下去还要执行下面两个函数：

```c
ProcessState::self()->startThreadPool();
IPCThreadState::self()->joinThreadPool();
```

首先看`ProcessState::startThreadPool`函数的实现：

```c
void ProcessState::startThreadPool()
{
    AutoMutex _l(mLock);
    if (!mThreadPoolStarted) {
        mThreadPoolStarted = true;
        spawnPooledThread(true);
    }
}
```

调用了`spwanPooledThread`：

```c
void ProcessState::spawnPooledThread(bool isMain)
{
    if (mThreadPoolStarted) {
        int32_t s = android_atomic_add(1, &mThreadPoolSeq);
        char buf[32];
        sprintf(buf, "Binder Thread #%d", s);
        LOGV("Spawning new pooled thread, name=%s\n", buf);
        sp<Thread> t = new PoolThread(isMain);
        t->run(buf);
    }
}
```

这里主要是创建一个线程，PoolThread继续Thread类，Thread类定义在frameworks/base/libs/utils/Threads.cpp文件中，其run函数最终调用子类的threadLoop函数，这里即为`PoolThread::threadLoop`函数：

```c
virtual bool threadLoop()
{
    IPCThreadState::self()->joinThreadPool(mIsMain);
    return false;
}
```

这里和frameworks/base/media/mediaserver/main_mediaserver.cpp文件中的main函数一样，最终都是调用了`IPCThreadState::joinThreadPool`函数，它们两个都是true，一个参数是true，一个是默认值true。我们来看一下这个函数的实现：

```c
void IPCThreadState::joinThreadPool(bool isMain)
{
	LOG_THREADPOOL("**** THREAD %p (PID %d) IS JOINING THE THREAD POOL\n", (void*)pthread_self(), getpid());
 
	mOut.writeInt32(isMain ? BC_ENTER_LOOPER : BC_REGISTER_LOOPER);
 
	......
 
	status_t result;
	do {
		int32_t cmd;
 
		.......
 
		// now get the next command to be processed, waiting if necessary
		result = talkWithDriver();
		if (result >= NO_ERROR) {
			size_t IN = mIn.dataAvail();
			if (IN < sizeof(int32_t)) continue;
			cmd = mIn.readInt32();
			......
			}
 
			result = executeCommand(cmd);
		}
 
		......
	} while (result != -ECONNREFUSED && result != -EBADF);
 
	.......
 
	mOut.writeInt32(BC_EXIT_LOOPER);
	talkWithDriver(false);
}
```

这个函数最终是在一个无穷循环中，通过调用`talkWithDriver`函数来和Binder驱动程序进行交互，实际上就是调用`talkWithDriver`来等待Client的请求，然后再调用`executeCommand`来处理请求，而在`executeCommand`函数中，最终会调用`BBinder::transact`来真正处理Client的请求：

```c
status_t IPCThreadState::executeCommand(int32_t cmd)
{
	BBinder* obj;
	RefBase::weakref_type* refs;
	status_t result = NO_ERROR;
 
	switch (cmd) {
	......
 
	case BR_TRANSACTION:
		{
			binder_transaction_data tr;
			result = mIn.read(&tr, sizeof(tr));
			
			......
 
			Parcel reply;
			
			......
 
			if (tr.target.ptr) {
				sp<BBinder> b((BBinder*)tr.cookie);
				const status_t error = b->transact(tr.code, buffer, &reply, tr.flags);
				if (error < NO_ERROR) reply.setError(error);
 
			} else {
				const status_t error = the_context_object->transact(tr.code, buffer, &reply, tr.flags);
				if (error < NO_ERROR) reply.setError(error);
			}
 
			......
		}
		break;
 
	.......
	}
 
	if (result != NO_ERROR) {
		mLastError = result;
	}
 
	return result;
}
```

接下来再看一下`BBinder::transact`的实现：

```c
status_t BBinder::transact(
    uint32_t code, const Parcel& data, Parcel* reply, uint32_t flags)
{
    data.setDataPosition(0);
 
    status_t err = NO_ERROR;
    switch (code) {
        case PING_TRANSACTION:
            reply->writeInt32(pingBinder());
            break;
        default:
            err = onTransact(code, data, reply, flags);
            break;
    }
 
    if (reply != NULL) {
        reply->setDataPosition(0);
    }
 
    return err;
}
```

最终会调用`onTransact`函数来处理。在这个场景中，`BnMediaPlayerService`继承了`BBinder`类，并且重载了`onTransact`函数，因此，这里实际上是调用了`BnMediaPlayerService::onTransact`函数，这个函数定义在frameworks/base/libs/media/libmedia/IMediaPlayerService.cpp文件中：

```c
status_t BnMediaPlayerService::onTransact(
	uint32_t code, const Parcel& data, Parcel* reply, uint32_t flags)
{
	switch(code) {
		case CREATE_URL: {
			......
						 } break;
		case CREATE_FD: {
			......
						} break;
		case DECODE_URL: {
			......
						 } break;
		case DECODE_FD: {
			......
						} break;
		case CREATE_MEDIA_RECORDER: {
			......
									} break;
		case CREATE_METADATA_RETRIEVER: {
			......
										} break;
		case GET_OMX: {
			......
					  } break;
		default:
			return BBinder::onTransact(code, data, reply, flags);
	}
}
```

至此，我们就以MediaPlayerService为例，完整地介绍了Android系统进程间通信Binder机制中的Server启动过程。Server启动起来之后，就会在一个无穷循环中等待Client的请求了。

## 4 [Client如何获得Server的远程接口](https://blog.csdn.net/luoshengyang/article/details/6633311)

我们将深入到Binder驱动程序源代码去分析Client是如何通过Service Manager的getService接口中来获得Server远程接口的。Client只有获得了Server的远程接口之后，才能进一步调用Server提供的服务。

我们接着上面一节进行分析，此时Service Manager和MediaPlayerService已经启动完毕，Service Manager现在等待Client的请求。  

这里，我们要举例子说明的Client便是MediaPlayer了，它声明和实现在frameworks/base/include/media/mediaplayer.h和frameworks/base/media/libmedia/mediaplayer.cpp文件中。MediaPlayer继承于IMediaDeathNotifier类，这个类声明和实现在frameworks/base/include/media/IMediaDeathNotifier.h和frameworks/base/media/libmedia//IMediaDeathNotifier.cpp文件中，里面有一个静态成员函数getMeidaPlayerService，它通过IServiceManager::getService接口来获得MediaPlayerService的远程接口。

在介绍`IMediaDeathNotifier::getMediaPlayerService()`函数之前，我们先了解一下这个函数。  
在2.3节中我们知道，获取Service Manager远程接口时，最终是获得了一个BpServiceManager对象的IServiceManager接口。类似地，我们要获得MediaPlayerService的远程接口，实际上就是要获得一个称为BpMediaPlayerService对象的IMediaPlayerService接口。现在，我们就先来看一下BpMediaPlayerService的类图（2.3节中的是BnMediaPlayerService的类图）：

[![BpMediaPlayerService](/assets/images/android/binder_bp_media_player_service.png)](/assets/images/android/binder_bp_media_player_service.png)

从这个类图可以看到，BpMediaPlayerService继承于BpInterface<IMediaPlayerService>类，即BpMediaPlayerService继承了IMediaPlayerService类和BpRefBase类，这两个类又分别继续了RefBase类。BpRefBase类有一个成员变量mRemote，它的类型为IBinder，实际是一个BpBinder对象。BpBinder类使用了IPCThreadState类来与Binder驱动程序进行交互，而IPCThreadState类有一个成员变量mProcess，它的类型为ProcessState，IPCThreadState类借助ProcessState类来打开Binder设备文件/dev/binder，因此，它可以和Binder驱动程序进行交互。

BpMediaPlayerService的构造函数有一个参数impl，它的类型为const sp<IBinder>&，从上面的描述中，这个实际上就是一个BpBinder对象。这样，要创建一个BpMediaPlayerService对象，首先就要有一个BpBinder对象。再来看BpBinder类的构造函数，它有一个参数handle，类型为int32_t，这个参数的意义就是请求MediaPlayerService这个远程接口的进程对MediaPlayerService这个Binder实体的引用了。因此，获取MediaPlayerService这个远程接口的本质问题就变为从Service Manager中获得MediaPlayerService的一个句柄了。

现在，我们就来看一下`IMediaDeathNotifier::getMeidaPlayerService`的实现：

```c
// establish binder interface to MediaPlayerService
/*static*/const sp<IMediaPlayerService>&
IMediaDeathNotifier::getMediaPlayerService()
{
    LOGV("getMediaPlayerService");
    Mutex::Autolock _l(sServiceLock);
    if (sMediaPlayerService.get() == 0) {
        // 获得SM的远程接口
        sp<IServiceManager> sm = defaultServiceManager();
        sp<IBinder> binder;
        // 在while循环中通过sm->getService获得MPS
        do {
            // 相当于binder = new BpBinder(handle);
            binder = sm->getService(String16("media.player"));
            if (binder != 0) {
                break;
             }
             LOGW("Media player service not published, waiting...");
             usleep(500000); // 0.5 s
        } while(true);

        if (sDeathNotifier == NULL) {
        sDeathNotifier = new DeathNotifier();
    }
    binder->linkToDeath(sDeathNotifier);
    // 相当于sMediaPlayerService = new BpMediaPlayerService(new BpBinder(handle))
    sMediaPlayerService = interface_cast<IMediaPlayerService>(binder);
    }
    LOGE_IF(sMediaPlayerService == 0, "no media player service!?");
    return sMediaPlayerService;
}
```

函数首先通过`defaultServiceManager`函数来获得Service Manager的远程接口，这个函数我们在上面分析过，相当于是

```c
sp<IServiceManager> sm = new BpServiceManager(new BpBinder(0));
```

接下去的while循环是通过`sm->getService`接口来不断尝试获得名称为“media.player”的Service，即MediaPlayerService。  
为什么要通过这无穷循环来得MediaPlayerService呢？因为这时候MediaPlayerService可能还没有启动起来，所以这里如果发现取回来的binder接口为NULL，就睡眠0.5秒，然后再尝试获取，这是获取Service接口的标准做法。

我们来看一下`BpServiceManager::getService`的实现：

```c
class BpServiceManager : public BpInterface<IServiceManager>
{
public:
    ...
    virtual sp<IBinder> getService(const String16& name) const
    {
        unsigned n;
        for (n = 0; n < 5; n++){
            sp<IBinder> svc = checkService(name);
            if (svc != NULL) return svc;
            LOGI("Waiting for sevice %s...\n", String8(name).string());
            sleep(1);
        }
        return NULL;
    }

    virtual sp<IBinder> checkService( const String16& name) const
    {
        Parcel data, reply;
        data.writeInterfaceToken(IServiceManager::getInterfaceDescriptor());
        data.writeString16(name);
        remote()->transact(CHECK_SERVICE_TRANSACTION, data, &reply);
        return reply.readStrongBinder();
    }
    ...
};
```

`BpServiceManager::getService`通过`BpServiceManager::checkService`执行操作。  

在`BpServiceManager::checkService`函数中，首先是通过`Parcel::writeInterfaceToken`往data写入一个RPC头，这个我们在2.4节中已经介绍过了，就是写往data里面写入了一个整数和一个字符串“android.os.IServiceManager”，Service Manager来处理CHECK_SERVICE_TRANSACTION请求之前，会先验证一下这个RPC头，看看是否正确。接着再往data写入一个字符串name，这里就是“media.player”了。回忆一下2.4节中，那里已经往Service Manager中注册了一个名字为“media.player”的MediaPlayerService。

这里的`remote()`就是一个`BpBinder`，所以就进入到`BpBinder::transact`函数中了，这里又继续调用`IPCThreadState::transact`函数中。  
首先调用`writeTransactionData`写入要传输的数据到`mOut`中，这里`struct binder_transaction_data tr`里面的内容：handle = 0, code = CHECK_SERVICE_TRANSACTION, cmd = BC_TRANSACTION, data里面的数据分别为：

```c
writeInt32(IPCThreadState::self()->getStrictModePolicy() | STRICT_MODE_PENALTY_GATHER);
writeString16("android.os.IServiceManager");
writeString16("media.player");
```

这是在`BpServiceManager::checkService`函数里面写进去的，其中前两个是RPC头，Service Manager在收到这个请求时会验证这两个参数是否正确，这点前面也提到了。`IPCThread->getStrictModePolicy`默认返回0，`STRICT_MODE_PENALTY_GATHER`定义为：

```c
// Note: must be kept in sync with android/os/StrictMode.java's PENALTY_GATHER
#define STRICT_MODE_PENALTY_GATHER 0x100
```

我们不关心这个参数的含义，这不会影响我们分析下面的源代码，有兴趣的读者可以研究一下。这里要注意的是，要传输的参数不包含有Binder对象，因此`tr.offsets_size = 0`。要传输的参数最后写入到IPCThreadState的成员变量mOut中，包括cmd和tr两个数据。

回到`IPCThreadState::transact`函数中，由于`(flags & TF_ONE_WAY) == 0`为true，即这是一个同步请求，并且`reply != NULL`，最终调用：`err = waitForResponse(reply);`。进入到`waitForResponse`函数中：

```c
status_t IPCThreadState::waitForResponse(Parcel *reply, status_t *acquireResult)
{
    int32_t cmd;
    int32_t err;
    
    while (1) {
        if ((err=talkWithDriver()) < NO_ERROR) break;
        err = mIn.errorCheck();
        if (err < NO_ERROR) break;
        if (mIn.dataAvail() == 0) continue;
        
        cmd = mIn.readInt32();
        
        IF_LOG_COMMANDS() {
            alog << "Processing waitForResponse Command: "
            << getReturnString(cmd) << endl;
        }
        
        switch (cmd) {
            case BR_TRANSACTION_COMPLETE:
                if (!reply && !acquireResult) goto finish;
                break;
                
            case BR_DEAD_REPLY:
                err = DEAD_OBJECT;
                goto finish;
                
            case BR_FAILED_REPLY:
                err = FAILED_TRANSACTION;
                goto finish;
                
            case BR_ACQUIRE_RESULT:
            {
                LOG_ASSERT(acquireResult != NULL, "Unexpected brACQUIRE_RESULT");
                const int32_t result = mIn.readInt32();
                if (!acquireResult) continue;
                *acquireResult = result ? NO_ERROR : INVALID_OPERATION;
            }
                goto finish;
                
            case BR_REPLY:
            {
                binder_transaction_data tr;
                err = mIn.read(&tr, sizeof(tr));
                LOG_ASSERT(err == NO_ERROR, "Not enough command data for brREPLY");
                if (err != NO_ERROR) goto finish;
                
                if (reply) {
                    if ((tr.flags & TF_STATUS_CODE) == 0) {
                        reply->ipcSetDataReference(
                                                    reinterpret_cast<const uint8_t*>(tr.data.ptr.buffer),
                                                    tr.data_size,
                                                    reinterpret_cast<const size_t*>(tr.data.ptr.offsets),
                                                    tr.offsets_size/sizeof(size_t),
                                                    freeBuffer, this);
                    } else {
                        err = *static_cast<const status_t*>(tr.data.ptr.buffer);
                        freeBuffer(NULL,
                                    reinterpret_cast<const uint8_t*>(tr.data.ptr.buffer),
                                    tr.data_size,
                                    reinterpret_cast<const size_t*>(tr.data.ptr.offsets),
                                    tr.offsets_size/sizeof(size_t), this);
                    }
                } else {
                    freeBuffer(NULL,
                                reinterpret_cast<const uint8_t*>(tr.data.ptr.buffer),
                                tr.data_size,
                                reinterpret_cast<const size_t*>(tr.data.ptr.offsets),
                                tr.offsets_size/sizeof(size_t), this);
                    continue;
                }
            }
                goto finish;
                
            default:
                err = executeCommand(cmd);
                if (err != NO_ERROR) goto finish;
                break;
        }
    }
    
finish:
    if (err != NO_ERROR) {
        if (acquireResult) *acquireResult = err;
        if (reply) reply->setError(err);
        mLastError = err;
    }
    
    return err;
}
```

这个函数通过`IPCThreadState::talkWithDriver`与驱动程序进行交互：

```c
status_t IPCThreadState::talkWithDriver(bool doReceive)
{
    LOG_ASSERT(mProcess->mDriverFD >= 0, "Binder driver is not opened");
    
    binder_write_read bwr;
    
    // Is the read buffer empty?
    const bool needRead = mIn.dataPosition() >= mIn.dataSize();
    
    // We don't want to write anything if we are still reading
    // from data left in the input buffer and the caller
    // has requested to read the next data.
    const size_t outAvail = (!doReceive || needRead) ? mOut.dataSize() : 0;
    
    bwr.write_size = outAvail;
    bwr.write_buffer = (long unsigned int)mOut.data();
    
    // This is what we'll read.
    if (doReceive && needRead) {
        bwr.read_size = mIn.dataCapacity();
        bwr.read_buffer = (long unsigned int)mIn.data();
    } else {
        bwr.read_size = 0;
    }
    
    // Return immediately if there is nothing to do.
    if ((bwr.write_size == 0) && (bwr.read_size == 0)) return NO_ERROR;
    
    bwr.write_consumed = 0;
    bwr.read_consumed = 0;
    status_t err;
    do {
        if (ioctl(mProcess->mDriverFD, BINDER_WRITE_READ, &bwr) >= 0)
            err = NO_ERROR;
        else
            err = -errno;
    } while (err == -EINTR);
    
    if (err >= NO_ERROR) {
        if (bwr.write_consumed > 0) {
            if (bwr.write_consumed < (ssize_t)mOut.dataSize())
                mOut.remove(0, bwr.write_consumed);
            else
                mOut.setDataSize(0);
        }
        if (bwr.read_consumed > 0) {
            mIn.setDataSize(bwr.read_consumed);
            mIn.setDataPosition(0);
        }

        return NO_ERROR;
    }
    
    return err;
}
```

这里`doReceive`默认值为true，`needRead`显然为true，所以`outAvail`大于0，即`bwr.write_size > 0`；`bwr.read_size = mIn.dataCapacity()`显然大于0。  
函数最后通过`ioctl(mProcess->mDriverFD, BINDER_WRITE_READ, &bwr)`进入到Binder驱动程序的`binder_ioctl`函数中。  
`BINDER_WRITE_READ`相关代码在已经在本文中贴出很多次了，这里略过。  
因为`bwr.write_size`是大于0的，因此进入`binder_thread_write`函数中，我们关注`BC_TRANSACTION`相关的逻辑（这部分也贴出过很多次了）。  

函数中先把用户传出来的参数拷贝到本地变量`struct binder_transaction_data br`中，也就是前面在`IPCThreadState::writeTransactionData`写入的内容。接着进入到`binder_transaction`函数中。

在该函数中，这里的参数reply = 0，表示这是一个BC_TRANSACTION命令。  
前面我们提到，传给驱动程序的handle值为0，即这里的`tr->target.handle = 0`，表示请求的目标Binder对象是Service Manager，因此有以下赋值：

```c
target_node = binder_context_mgr_node;
target_proc = target_node->proc;
target_list = &target_proc->todo;
target_wait = &target_proc->wait;
```

其中binder_context_mgr_node是在Service Manager通知Binder驱动程序它是守护过程时创建的。

接着创建一个待完成事项tcomplete，它的类型为struct binder_work，这是等一会要保存在当前线程的todo队列去的，表示当前线程有一个待完成的事务。紧跟着创建一个待处理事务t，它的类型为struct binder_transaction，这是等一会要存在到Service Manager的todo队列去的，表示Service Manager当前有一个事务需要处理。同时，最后这个待处理事务t也要存放在当前线程的待完成事务transaction_stack列表中去。

```c
t->from_parent = thread->transaction_stack;
thread->transaction_stack = t;
```

最后，Service Manager有事情可做了，就要唤醒它了：`wake_up_interruptible(target_wait);`。

前面我们提到，此时Service Manager正在等待Client的请求，也就是Service Manager此时正在进入到Binder驱动程序的binder_thread_read函数中，并且休眠在target->wait上，详情在2.2节。

这里，我们暂时忽略Service Manager被唤醒之后的情景，继续看当前线程的执行。  
函数`binder_transaction`执行完成之后，就一路返回到`binder_ioctl`函数里去了。函数`binder_ioctl`从`binder_thread_write`函数调用处返回后，发现`bwr.read_size`大于0，于是就进入到`binder_thread_read`函数去了。

```c
static int
binder_thread_read(struct binder_proc *proc, struct binder_thread *thread,
				   void  __user *buffer, int size, signed long *consumed, int non_block)
{
	void __user *ptr = buffer + *consumed;
	void __user *end = buffer + size;
 
	int ret = 0;
	int wait_for_proc_work;
 
	if (*consumed == 0) {
		if (put_user(BR_NOOP, (uint32_t __user *)ptr))
			return -EFAULT;
		ptr += sizeof(uint32_t);
	}
 
retry:
	wait_for_proc_work = thread->transaction_stack == NULL && list_empty(&thread->todo);
 
	......
	
	if (wait_for_proc_work) {
		......
	} else {
		if (non_block) {
			if (!binder_has_thread_work(thread))
				ret = -EAGAIN;
		} else
			ret = wait_event_interruptible(thread->wait, binder_has_thread_work(thread));
	}
 
	......
 
	while (1) {
		uint32_t cmd;
		struct binder_transaction_data tr;
		struct binder_work *w;
		struct binder_transaction *t = NULL;
 
		if (!list_empty(&thread->todo))
			w = list_first_entry(&thread->todo, struct binder_work, entry);
		else if (!list_empty(&proc->todo) && wait_for_proc_work)
			w = list_first_entry(&proc->todo, struct binder_work, entry);
		else {
			if (ptr - buffer == 4 && !(thread->looper & BINDER_LOOPER_STATE_NEED_RETURN)) /* no data added */
				goto retry;
			break;
		}
 
		if (end - ptr < sizeof(tr) + 4)
			break;
 
		switch (w->type) {
		......
		case BINDER_WORK_TRANSACTION_COMPLETE: {
			cmd = BR_TRANSACTION_COMPLETE;
			if (put_user(cmd, (uint32_t __user *)ptr))
				return -EFAULT;
			ptr += sizeof(uint32_t);
 
			binder_stat_br(proc, thread, cmd);
			if (binder_debug_mask & BINDER_DEBUG_TRANSACTION_COMPLETE)
				printk(KERN_INFO "binder: %d:%d BR_TRANSACTION_COMPLETE\n",
				proc->pid, thread->pid);
 
			list_del(&w->entry);
			kfree(w);
			binder_stats.obj_deleted[BINDER_STAT_TRANSACTION_COMPLETE]++;
											   } break;
		......
		}
 
		if (!t)
			continue;
 
		......
	}
 
done:
	......
	return 0;
}
```

在`binder_thread_read`函数中首先是写入一个操作码BR_NOOP到用户传进来的缓冲区中去。

回忆一下上面的binder_transaction函数，这里的`thread->transaction_stack`不为NULL，并且`thread->todo`也不为空，所以线程不会进入休眠状态。  
进入while循环中，首先是从`thread->todo`队列中取回待处理事项w，w的类型为BINDER_WORK_TRANSACTION_COMPLETE，这也是在`binder_transaction`函数里面设置的。对BINDER_WORK_TRANSACTION_COMPLETE的处理也很简单，只是把一个操作码BR_TRANSACTION_COMPLETE写回到用户传进来的缓冲区中去。这时候，用户传进来的缓冲区就包含两个操作码了，分别是BR_NOOP和BINDER_WORK_TRANSACTION_COMPLETE。

`binder_thread_read`执行完之后，返回到`binder_ioctl`函数中，将操作结果写回到用户空间中去：

```c
if (copy_to_user(ubuf, &bwr, sizeof(bwr))) {
	ret = -EFAULT;
	goto err;
}
```

最后就返回到`IPCThreadState::talkWithDriver`函数中了。从`ioctl(mProcess->mDriverFD, BINDER_WRITE_READ, &bwr) >= 0`返回后，首先是清空之前写入Binder驱动程序的内容：

```c
if (bwr.write_consumed > 0) {
     if (bwr.write_consumed < (ssize_t)mOut.dataSize())
          mOut.remove(0, bwr.write_consumed);
     else
          mOut.setDataSize(0);
}
```

接着是设置从Binder驱动程序读取的内容：

```c
if (bwr.read_consumed > 0) {
     mIn.setDataSize(bwr.read_consumed);
     mIn.setDataPosition(0);
}
```

然后就返回到`IPCThreadState::waitForResponse`函数。  
`IPCThreadState::waitForResponse`函数的处理也很简单，就是处理刚才从Binder驱动程序读入内容了。从前面的分析中，我们知道，从Binder驱动程序读入的内容就是两个整数了，分别是BR_NOOP和BR_TRANSACTION_COMPLETE。对BR_NOOP的处理很简单，正如它的名字所示，什么也不做；而对BR_TRANSACTION_COMPLETE的处理，就分情况了，如果这个请求是异步的，那个整个BC_TRANSACTION操作就完成了，如果这个请求是同步的，即要等待回复的，也就是reply不为空，那么还要继续循环通过`IPCThreadState::talkWithDriver`进入到Binder驱动程序中去等待BC_TRANSACTION操作的处理结果。  

这里属于后一种情况，于是再次通过`IPCThreadState::talkWithDriver`进入到Binder驱动程序的`binder_ioctl`函数中。不过这一次在`binder_ioctl`函数中，`bwr.write_size`等于0，而`bwr.read_size`大于0，于是再次进入到`binder_thread_read`函数中。这时候`thread->transaction_stack`仍然不为NULL，不过`thread->todo`队列已经为空了，因为前面我们已经处理过`thread->todo`队列的内容了，于是就通过下面语句进入休眠状态了，等待Service Manager的唤醒：

```c
ret = wait_event_interruptible(thread->wait, binder_has_thread_work(thread));
```

现在，我们终于可以回到Service Manager被唤醒之后的过程了。前面我们说过，Service Manager此时正在`binder_thread_read`函数中休眠中：

```c
static int
binder_thread_read(struct binder_proc *proc, struct binder_thread *thread,
				   void  __user *buffer, int size, signed long *consumed, int non_block)
{
	void __user *ptr = buffer + *consumed;
	void __user *end = buffer + size;
 
	int ret = 0;
	int wait_for_proc_work;
 
	if (*consumed == 0) {
		if (put_user(BR_NOOP, (uint32_t __user *)ptr))
			return -EFAULT;
		ptr += sizeof(uint32_t);
	}
 
retry:
	wait_for_proc_work = thread->transaction_stack == NULL && list_empty(&thread->todo);
 
	......
 
	if (wait_for_proc_work) {
		......
		if (non_block) {
			if (!binder_has_proc_work(proc, thread))
				ret = -EAGAIN;
		} else
			ret = wait_event_interruptible_exclusive(proc->wait, binder_has_proc_work(proc, thread));
	} else {
		......
	}
	
	......
 
	while (1) {
		uint32_t cmd;
		struct binder_transaction_data tr;
		struct binder_work *w;
		struct binder_transaction *t = NULL;
 
		if (!list_empty(&thread->todo))
			w = list_first_entry(&thread->todo, struct binder_work, entry);
		else if (!list_empty(&proc->todo) && wait_for_proc_work)
			w = list_first_entry(&proc->todo, struct binder_work, entry);
		else {
			if (ptr - buffer == 4 && !(thread->looper & BINDER_LOOPER_STATE_NEED_RETURN)) /* no data added */
				goto retry;
			break;
		}
 
		if (end - ptr < sizeof(tr) + 4)
			break;
 
		switch (w->type) {
		case BINDER_WORK_TRANSACTION: {
			t = container_of(w, struct binder_transaction, work);
									  } break;
		......
		}
 
		if (!t)
			continue;
 
		BUG_ON(t->buffer == NULL);
		if (t->buffer->target_node) {
			struct binder_node *target_node = t->buffer->target_node;
			tr.target.ptr = target_node->ptr;
			tr.cookie =  target_node->cookie;
			t->saved_priority = task_nice(current);
			if (t->priority < target_node->min_priority &&
				!(t->flags & TF_ONE_WAY))
				binder_set_nice(t->priority);
			else if (!(t->flags & TF_ONE_WAY) ||
				t->saved_priority > target_node->min_priority)
				binder_set_nice(target_node->min_priority);
			cmd = BR_TRANSACTION;
		} else {
			......
		}
		tr.code = t->code;
		tr.flags = t->flags;
		tr.sender_euid = t->sender_euid;
 
		if (t->from) {
			struct task_struct *sender = t->from->proc->tsk;
			tr.sender_pid = task_tgid_nr_ns(sender, current->nsproxy->pid_ns);
		} else {
			......
		}
 
		tr.data_size = t->buffer->data_size;
		tr.offsets_size = t->buffer->offsets_size;
		tr.data.ptr.buffer = (void *)t->buffer->data + proc->user_buffer_offset;
		tr.data.ptr.offsets = tr.data.ptr.buffer + ALIGN(t->buffer->data_size, sizeof(void *));
 
		if (put_user(cmd, (uint32_t __user *)ptr))
			return -EFAULT;
		ptr += sizeof(uint32_t);
		if (copy_to_user(ptr, &tr, sizeof(tr)))
			return -EFAULT;
		ptr += sizeof(tr);
 
		......
 
		list_del(&t->work.entry);
		t->buffer->allow_user_free = 1;
		if (cmd == BR_TRANSACTION && !(t->flags & TF_ONE_WAY)) {
			t->to_parent = thread->transaction_stack;
			t->to_thread = thread;
			thread->transaction_stack = t;
		} else {
			......
		}
		break;
	}
 
done:
 
	*consumed = ptr - buffer;
	......
	return 0;
}
```

这里就是从语句中唤醒了：

```c
ret = wait_event_interruptible_exclusive(proc->wait, binder_has_proc_work(proc, thread));
```

Service Manager唤醒过来看，继续往下执行，进入到while循环中。首先是从proc->todo中取回待处理事项w。这个事项w的类型是BINDER_WORK_TRANSACTION，这是上面调用binder_transaction的时候设置的，于是通过w得到待处理事务t：  

```c
t = container_of(w, struct binder_transaction, work);
```

接下来的内容，就把cmd和t->buffer的内容拷贝到用户传进来的缓冲区去了，这里就是Service Manager从用户空间传进来的缓冲区了：

```c
if (put_user(cmd, (uint32_t __user *)ptr))
	return -EFAULT;
ptr += sizeof(uint32_t);
if (copy_to_user(ptr, &tr, sizeof(tr)))
	return -EFAULT;
ptr += sizeof(tr);
```

注意，这里先是把t->buffer的内容拷贝到本地变量tr中，再拷贝到用户空间缓冲区去。关于t->buffer内容的拷贝，请参考2.4节，它的一个关键地方是Binder驱动程序和Service Manager守护进程共享了同一个物理内存的内容，拷贝的只是这个物理内存在用户空间的虚拟地址回去：

```c
tr.data.ptr.buffer = (void *)t->buffer->data + proc->user_buffer_offset;
tr.data.ptr.offsets = tr.data.ptr.buffer + ALIGN(t->buffer->data_size, sizeof(void *));
```

然后，对于Binder驱动程序这次操作来说，这个事项就算是处理完了，就要从todo队列中删除：

```c
list_del(&t->work.entry);
```

紧接着，还不慌删除这个事务，因为它还要等待Service Manager处理完成后，再进一步处理，因此，放在thread->transaction_stack队列中：

```c
// cmd为BR_TRANSACTION， t->flags也不为TF_ONE_WAY，所以走这个分支
if (cmd == BR_TRANSACTION && !(t->flags & TF_ONE_WAY)) {
    t->to_parent = thread->transaction_stack;
    t->to_thread = thread;
    thread->transaction_stack = t;
}
```

注意上面写入的cmd = BR_TRANSACTION，告诉Service Manager守护进程，它要做什么事情，后面我们会看到相应的分析。  

这样，`binder_thread_read`函数就处理完了，回到`binder_ioctl`函数中，同样是操作结果写回到用户空间的缓冲区中去：

```c
if (copy_to_user(ubuf, &bwr, sizeof(bwr))) {
    ret = -EFAULT;
    goto err;
}
```

最后就从framework中`binder.c`文件`binder_loop`函数的`res = ioctl(bs->fd, BINDER_WRITE_READ, &bwr);`语句中返回了。接着就调用`binder_parse`函数分析从Binder驱动程序里面读取出来的数据，这里cmd为BR_TRANSACTION。因此，我们这只需要关注BR_TRANSACTION相关的逻辑：

```c
int binder_parse(struct binder_state *bs, struct binder_io *bio,
				 uint32_t *ptr, uint32_t size, binder_handler func)
{
	int r = 1;
	uint32_t *end = ptr + (size / 4);
 
	while (ptr < end) {
		uint32_t cmd = *ptr++;
		switch(cmd) {
		......
		case BR_TRANSACTION: {
			struct binder_txn *txn = (void *) ptr;
			......
			if (func) {
				unsigned rdata[256/4];
				struct binder_io msg;
				struct binder_io reply;
				int res;
 
				bio_init(&reply, rdata, sizeof(rdata), 4);
				bio_init_from_txn(&msg, txn);
				res = func(bs, txn, &msg, &reply);
				binder_send_reply(bs, &reply, txn->data, res);
			}
			ptr += sizeof(*txn) / sizeof(uint32_t);
			break;
							 }
		......
		default:
			LOGE("parse: OOPS %d\n", cmd);
			return -1;
		}
	}
 
	return r;
} 
```

这里用到的两个数据结构`struct binder_txn`和`struct binder_io`可以参考2.4节，这里就不复述了。  

接下来调用`bio_init`初始化`reply`变量，调用`bio_init_from_txn`来初始化`msg`变量。真正进行处理的函数是从参数中传进来的函数指针func，也就是对应的`svcmgr_handler`函数。  

```c
int svcmgr_handler(struct binder_state *bs,
                   struct binder_txn *txn,
                   struct binder_io *msg,
                   struct binder_io *reply)
{
    struct svcinfo *si;
    uint16_t *s;
    unsigned len;
    void *ptr;
    uint32_t strict_policy;
 
//    LOGI("target=%p code=%d pid=%d uid=%d\n",
//         txn->target, txn->code, txn->sender_pid, txn->sender_euid);
 
    if (txn->target != svcmgr_handle)
        return -1;
 
    // Equivalent to Parcel::enforceInterface(), reading the RPC
    // header with the strict mode policy mask and the interface name.
    // Note that we ignore the strict_policy and don't propagate it
    // further (since we do no outbound RPCs anyway).
    strict_policy = bio_get_uint32(msg);
    s = bio_get_string16(msg, &len);
    if ((len != (sizeof(svcmgr_id) / 2)) ||
        memcmp(svcmgr_id, s, sizeof(svcmgr_id))) {
        fprintf(stderr,"invalid id %s\n", str8(s));
        return -1;
    }
 
    switch(txn->code) {
    case SVC_MGR_GET_SERVICE:
    case SVC_MGR_CHECK_SERVICE:
        s = bio_get_string16(msg, &len);
        ptr = do_find_service(bs, s, len);
        if (!ptr)
            break;
        bio_put_ref(reply, ptr);
        return 0;
 
    ......
    }
    default:
        LOGE("unknown code %d\n", txn->code);
        return -1;
    }
 
    bio_put_uint32(reply, 0);
    return 0;
}
```

这里， Service Manager要处理的code是SVC_MGR_CHECK_SERVICE，这是在前面的`BpServiceManager::checkService`函数里面设置的。  
回忆一下，在`BpServiceManager::checkService`时，传给Binder驱动程序的参数为：

```c
writeInt32(IPCThreadState::self()->getStrictModePolicy() | STRICT_MODE_PENALTY_GATHER);  
writeString16("android.os.IServiceManager");  
writeString16("media.player");  
```

在下面的代码中，会验证一下传进来的第二个参数，即"android.os.IServiceManager"是否正确，这个是验证RPC头，注释已经说得很清楚了。

```c
strict_policy = bio_get_uint32(msg);  
s = bio_get_string16(msg, &len);  
s = bio_get_string16(msg, &len);
```

最后，就是调用`do_find_service`函数查找是存在名称为"media.player"的服务了。回忆一下2.4节中，MediaPlayerService已经把一个名称为"media.player"的服务注册到Service Manager中，所以这里一定能找到。我们看看do_find_service这个函数：

```c
void *do_find_service(struct binder_state *bs, uint16_t *s, unsigned len)
{
    struct svcinfo *si;
    si = find_svc(s, len);
 
//    LOGI("check_service('%s') ptr = %p\n", str8(s), si ? si->ptr : 0);
    if (si && si->ptr) {
        return si->ptr;
    } else {
        return 0;
    }
}
```

这里又调用了`find_svc`函数在svclist列表中查找对应名称的svcinfo：

```c
struct svcinfo *find_svc(uint16_t *s16, unsigned len)
{
    struct svcinfo *si;
 
    for (si = svclist; si; si = si->next) {
        if ((len == si->len) &&
            !memcmp(s16, si->name, len * sizeof(uint16_t))) {
            return si;
        }
    }
    return 0;
}
```

然后返回到`do_find_service`函数中。回忆一下2.4节的分析，这里的si->ptr就是指MediaPlayerService这个Binder实体在Service Manager进程中的句柄值了。  

回到`svcmgr_handler`函数中，调用`bio_put_ref`函数将这个Binder引用写回到reply参数。我们看看`bio_put_ref`的实现：

```c
void bio_put_ref(struct binder_io *bio, void *ptr)
{
    struct binder_object *obj;

    if (ptr)
        obj = bio_alloc_obj(bio);
    else
        obj = bio_alloc(bio, sizeof(*obj));

    if (!obj)
        return;

    obj->flags = 0x7f | FLAT_BINDER_FLAG_ACCEPTS_FDS;
    obj->type = BINDER_TYPE_HANDLE;
    obj->pointer = ptr;
    obj->cookie = 0;
}
```

这里很简单，就是把一个类型为`BINDER_TYPE_HANDLE`的`binder_object`写入到reply缓冲区中去。这里的`binder_object`就是相当于是`flat_binder_obj`了，具体可以参考2.4节。

再回到`svcmgr_handler`函数中，最后，还写入一个0值到reply缓冲区中，表示操作结果码：`bio_put_uint32(reply, 0)`。  
回到`binder_parse`函数，调用`binder_send_reply`函数将操作结果反馈给Binder驱动程序：

```c
void binder_send_reply(struct binder_state *bs,
                       struct binder_io *reply,
                       void *buffer_to_free,
                       int status)
{
    struct {
        uint32_t cmd_free;
        void *buffer;
        uint32_t cmd_reply;
        struct binder_txn txn;
    } __attribute__((packed)) data;
 
    data.cmd_free = BC_FREE_BUFFER;
    data.buffer = buffer_to_free;
    data.cmd_reply = BC_REPLY;
    data.txn.target = 0;
    data.txn.cookie = 0;
    data.txn.code = 0;
    if (status) {
        data.txn.flags = TF_STATUS_CODE;
        data.txn.data_size = sizeof(int);
        data.txn.offs_size = 0;
        data.txn.data = &status;
        data.txn.offs = 0;
    } else {
        data.txn.flags = 0;
        data.txn.data_size = reply->data - reply->data0;
        data.txn.offs_size = ((char*) reply->offs) - ((char*) reply->offs0);
        data.txn.data = reply->data0;
        data.txn.offs = reply->offs0;
    }
    binder_write(bs, &data, sizeof(data));
}
```

注意，这里的status参数是`svcmgr_handler`的返回值为0。从这里可以看出，`binder_send_reply`告诉Binder驱动程序执行`BC_FREE_BUFFER`和`BC_REPLY`命令，前者释放之前在`binder_transaction`分配的空间，地址为`buffer_to_free`，`buffer_to_free`这个地址是Binder驱动程序把自己在内核空间用的地址转换成用户空间地址再传给Service Manager的，所以Binder驱动程序拿到这个地址后，知道怎么样释放这个空间；后者告诉Binder驱动程序，它的SVC_MGR_CHECK_SERVICE操作已经完成了,要查询的服务的句柄值也是保存在data.txn.data，操作结果码是0，也是保存在data.txn.data中。  
函数的最后执行了`binder_write`操作：

```c
int binder_write(struct binder_state *bs, void *data, unsigned len)
{
    struct binder_write_read bwr;
    int res;
    bwr.write_size = len;
    bwr.write_consumed = 0;
    bwr.write_buffer = (unsigned) data;
    bwr.read_size = 0;
    bwr.read_consumed = 0;
    bwr.read_buffer = 0;
    res = ioctl(bs->fd, BINDER_WRITE_READ, &bwr);
    if (res < 0) {
        fprintf(stderr,"binder_write: ioctl failed (%s)\n",
                strerror(errno));
    }
    return res;
}
```

这里可以看出，只有写操作，没有读操作，即read_size为0。  
这里又是一个ioctl的BINDER_WRITE_READ操作。直入到驱动程序的binder_ioctl函数后，执行BINDER_WRITE_READ命令，这里就不累述了。  
最后，从`binder_ioctl`执行到`binder_thread_write`函数，首先是执行BC_FREE_BUFFER命令，这个命令的执行在2.4节中说过了，这里就不再累述了。  

我们重点关注BC_REPLY命令的执行：

```c
int  
binder_thread_write(struct binder_proc *proc, struct binder_thread *thread,  
                    void __user *buffer, int size, signed long *consumed)  
{  
    uint32_t cmd;  
    void __user *ptr = buffer + *consumed;  
    void __user *end = buffer + size;  
  
    while (ptr < end && thread->return_error == BR_OK) {  
        if (get_user(cmd, (uint32_t __user *)ptr))  
            return -EFAULT;  
        ptr += sizeof(uint32_t);  
        if (_IOC_NR(cmd) < ARRAY_SIZE(binder_stats.bc)) {  
            binder_stats.bc[_IOC_NR(cmd)]++;  
            proc->stats.bc[_IOC_NR(cmd)]++;  
            thread->stats.bc[_IOC_NR(cmd)]++;  
        }  
        switch (cmd) {  
        ......  
        case BC_TRANSACTION:  
        case BC_REPLY: {  
            struct binder_transaction_data tr;  
  
            if (copy_from_user(&tr, ptr, sizeof(tr)))  
                return -EFAULT;  
            ptr += sizeof(tr);  
            binder_transaction(proc, thread, &tr, cmd == BC_REPLY);  
            break;  
                       }  
  
        ......  
        *consumed = ptr - buffer;  
    }  
    return 0;  
} 
```

又再次进入到`binder_transaction`函数：

```c
static void
binder_transaction(struct binder_proc *proc, struct binder_thread *thread,
struct binder_transaction_data *tr, int reply)
{
	struct binder_transaction *t;
	struct binder_work *tcomplete;
	size_t *offp, *off_end;
	struct binder_proc *target_proc;
	struct binder_thread *target_thread = NULL;
	struct binder_node *target_node = NULL;
	struct list_head *target_list;
	wait_queue_head_t *target_wait;
	struct binder_transaction *in_reply_to = NULL;
	struct binder_transaction_log_entry *e;
	uint32_t return_error;
 
	......
 
	if (reply) {
		in_reply_to = thread->transaction_stack;
		if (in_reply_to == NULL) {
			......
			return_error = BR_FAILED_REPLY;
			goto err_empty_call_stack;
		}
		......
		thread->transaction_stack = in_reply_to->to_parent;
		target_thread = in_reply_to->from;
		......
		target_proc = target_thread->proc;
	} else {
		......
	}
	if (target_thread) {
		e->to_thread = target_thread->pid;
		target_list = &target_thread->todo;
		target_wait = &target_thread->wait;
	} else {
		......
	}
	
 
	/* TODO: reuse incoming transaction for reply */
	t = kzalloc(sizeof(*t), GFP_KERNEL);
	if (t == NULL) {
		return_error = BR_FAILED_REPLY;
		goto err_alloc_t_failed;
	}
	binder_stats.obj_created[BINDER_STAT_TRANSACTION]++;
 
	tcomplete = kzalloc(sizeof(*tcomplete), GFP_KERNEL);
	if (tcomplete == NULL) {
		return_error = BR_FAILED_REPLY;
		goto err_alloc_tcomplete_failed;
	}
	......
 
	if (!reply && !(tr->flags & TF_ONE_WAY))
		t->from = thread;
	else
		t->from = NULL;
	t->sender_euid = proc->tsk->cred->euid;
	t->to_proc = target_proc;
	t->to_thread = target_thread;
	t->code = tr->code;
	t->flags = tr->flags;
	t->priority = task_nice(current);
	t->buffer = binder_alloc_buf(target_proc, tr->data_size,
		tr->offsets_size, !reply && (t->flags & TF_ONE_WAY));
	if (t->buffer == NULL) {
		return_error = BR_FAILED_REPLY;
		goto err_binder_alloc_buf_failed;
	}
	t->buffer->allow_user_free = 0;
	t->buffer->debug_id = t->debug_id;
	t->buffer->transaction = t;
	t->buffer->target_node = target_node;
	if (target_node)
		binder_inc_node(target_node, 1, 0, NULL);
 
	offp = (size_t *)(t->buffer->data + ALIGN(tr->data_size, sizeof(void *)));
 
	if (copy_from_user(t->buffer->data, tr->data.ptr.buffer, tr->data_size)) {
		binder_user_error("binder: %d:%d got transaction with invalid "
			"data ptr\n", proc->pid, thread->pid);
		return_error = BR_FAILED_REPLY;
		goto err_copy_data_failed;
	}
	if (copy_from_user(offp, tr->data.ptr.offsets, tr->offsets_size)) {
		binder_user_error("binder: %d:%d got transaction with invalid "
			"offsets ptr\n", proc->pid, thread->pid);
		return_error = BR_FAILED_REPLY;
		goto err_copy_data_failed;
	}
	......
 
	off_end = (void *)offp + tr->offsets_size;
	for (; offp < off_end; offp++) {
		struct flat_binder_object *fp;
		......
		fp = (struct flat_binder_object *)(t->buffer->data + *offp);
		switch (fp->type) {
		......
		case BINDER_TYPE_HANDLE:
		case BINDER_TYPE_WEAK_HANDLE: {
			struct binder_ref *ref = binder_get_ref(proc, fp->handle);
			if (ref == NULL) {
				......
				return_error = BR_FAILED_REPLY;
				goto err_binder_get_ref_failed;
			}
			if (ref->node->proc == target_proc) {
				......
			} else {
				struct binder_ref *new_ref;
				new_ref = binder_get_ref_for_node(target_proc, ref->node);
				if (new_ref == NULL) {
					return_error = BR_FAILED_REPLY;
					goto err_binder_get_ref_for_node_failed;
				}
				fp->handle = new_ref->desc;
				binder_inc_ref(new_ref, fp->type == BINDER_TYPE_HANDLE, NULL);
				......
			}
		} break;
 
		......
		}
	}
 
	if (reply) {
		BUG_ON(t->buffer->async_transaction != 0);
		binder_pop_transaction(target_thread, in_reply_to);
	} else if (!(t->flags & TF_ONE_WAY)) {
		......
	} else {
		......
	}
 
	t->work.type = BINDER_WORK_TRANSACTION;
	list_add_tail(&t->work.entry, target_list);
	tcomplete->type = BINDER_WORK_TRANSACTION_COMPLETE;
	list_add_tail(&tcomplete->entry, &thread->todo);
	if (target_wait)
		wake_up_interruptible(target_wait);
	return;
 
    ......
}
```

这次进入`binder_transaction`函数的情形和上面介绍的binder_transaction函数的情形基本一致，只是这里的proc、thread和target_proc、target_thread调换了角色，这里的proc和thread指的是Service Manager进程，而target_proc和target_thread指的是刚才请求SVC_MGR_CHECK_SERVICE的进程。  

那么，这次是如何找到target_proc和target_thread呢。首先，我们注意到，这里的reply等于1，其次，上面我们提到，Binder驱动程序在唤醒Service Manager，告诉它有一个事务t要处理时，事务t虽然从Service Manager的todo队列中删除了，但是仍然保留在transaction_stack中。因此，这里可以从thread->transaction_stack找回这个等待回复的事务t，然后通过它找回target_proc和target_thread

```c
in_reply_to = thread->transaction_stack;
target_thread = in_reply_to->from;
target_list = &target_thread->todo;
target_wait = &target_thread->wait;
```

再接着往下看，由于Service Manager返回来了一个Binder引用，所以这里要处理一下，就是中间的for循环了。这是一个BINDER_TYPE_HANDLE类型的Binder引用，这是前面设置的。先把`t->buffer->data`的内容转换为一个`struct flat_binder_object`对象fp，这里的fp->handle值就是这个Service在Service Manager进程里面的引用值了。接通过调用binder_get_ref函数得到Binder引用对象`struct binder_ref`类型的对象ref：

```c
struct binder_ref *ref = binder_get_ref(proc, fp->handle);
```

这里一定能找到，因为前面MediaPlayerService执行`IServiceManager::addService`的时候把自己添加到Service Manager的时候，会在Service Manager进程中创建这个Binder引用，然后把这个Binder引用的句柄值返回给Service Manager用户空间。

这里面的ref->node->proc不等于target_proc，因为这个Binder实体是属于创建MediaPlayerService的进程的，而不是请求这个服务的远程接口的进程的，因此，这里调用`binder_get_ref_for_node`函数为这个Binder实体在target_proc创建一个引用：

```c
struct binder_ref *new_ref;
new_ref = binder_get_ref_for_node(target_proc, ref->node);
```

然后增加引用计数：

```c
binder_inc_ref(new_ref, fp->type == BINDER_TYPE_HANDLE, NULL);
```

这样，返回数据中的Binder对象就处理完成了。注意，这里会把fp->handle的值改为在target_proc中的引用值：

```c
fp->handle = new_ref->desc;
```

这里就相当于是把t->buffer->data里面的Binder对象的句柄值改写了。因为这是在另外一个不同的进程里面的Binder引用，所以句柄值当然要用新的了。这个值最终是要拷贝回target_proc进程的用户空间去的。再往下看：

```c
if (reply) {
     BUG_ON(t->buffer->async_transaction != 0);
     binder_pop_transaction(target_thread, in_reply_to);
} else if (!(t->flags & TF_ONE_WAY)) {
     ......
} else {
     ......
}
```

这里reply等于1，执行`binder_pop_transaction`函数把当前事务in_reply_to从target_thread->transaction_stack队列中删掉，这是上次调用`binder_transaction`函数的时候设置的，现在不需要了，所以把它删掉。 

再往后的逻辑就跟前面执行`binder_transaction`函数时候一样了，这里不再介绍。最后的结果就是唤醒请求SVC_MGR_CHECK_SERVICE操作的线程：

```c
if (target_wait)
    wake_up_interruptible(target_wait);
```

这样，Service Manger回复调用SVC_MGR_CHECK_SERVICE请求就算完成了，重新回到frameworks/base/cmds/servicemanager/binder.c文件中的binder_loop函数等待下一个Client请求的到来。事实上，Service Manger回到binder_loop函数再次执行ioctl函数时候，又会再次进入到binder_thread_read函数。这时个会发现thread->todo不为空，这是因为刚才我们调用了`list_add_tail(&tcomplete->entry, &thread->todo);`把一个工作项tcompelete放在了在thread->todo中，这个tcompelete的type为BINDER_WORK_TRANSACTION_COMPLETE，因此，Binder驱动程序会执行下面操作：

```c
switch (w->type) {  
case BINDER_WORK_TRANSACTION_COMPLETE: {  
    cmd = BR_TRANSACTION_COMPLETE;  
    if (put_user(cmd, (uint32_t __user *)ptr))  
        return -EFAULT;  
    ptr += sizeof(uint32_t);  
  
    list_del(&w->entry);  
    kfree(w);  
      
    } break;  
    ......  
}  
```

binder_loop函数执行完这个ioctl调用后，才会在下一次调用ioctl进入到Binder驱动程序进入休眠状态，等待下一次Client的请求。
上面讲到调用请求SVC_MGR_CHECK_SERVICE操作的线程被唤醒了，于是，重新执行binder_thread_read函数，马上执行的就是while循环。在while循环中，从thread->todo得到w，w->type为BINDER_WORK_TRANSACTION，于是，得到t。从上面可以知道，Service Manager返回来了一个Binder引用和一个结果码0回来，写在t->buffer->data里面，现在把t->buffer->data加上proc->user_buffer_offset，得到用户空间地址，保存在tr.data.ptr.buffer里面，这样用户空间就可以访问这个数据了。由于cmd不等于BR_TRANSACTION，这时就可以把t删除掉了，因为以后都不需要用了。  

执行完这个函数后，就返回到binder_ioctl函数，执行下面语句，把数据返回给用户空间：

```c
if (copy_to_user(ubuf, &bwr, sizeof(bwr))) {  
    ret = -EFAULT;  
    goto err;  
}
```

接着返回到用户空间`IPCThreadState::talkWithDriver`函数，最后返回到`IPCThreadState::waitForResponse`函数，最终执行到下面语句：

```c
status_t IPCThreadState::waitForResponse(Parcel *reply, status_t *acquireResult)  
{  
    int32_t cmd;  
    int32_t err;  
  
    while (1) {  
        if ((err=talkWithDriver()) < NO_ERROR) break;  
          
        ......  
  
        cmd = mIn.readInt32();  
  
        ......  
  
        switch (cmd) {  
        ......  
        case BR_REPLY:  
            {  
                binder_transaction_data tr;  
                err = mIn.read(&tr, sizeof(tr));  
                LOG_ASSERT(err == NO_ERROR, "Not enough command data for brREPLY");  
                if (err != NO_ERROR) goto finish;  
  
                if (reply) {  
                    // tr.flags为0
                    if ((tr.flags & TF_STATUS_CODE) == 0) {  
                        reply->ipcSetDataReference(  
                            reinterpret_cast<const uint8_t*>(tr.data.ptr.buffer),  
                            tr.data_size,  
                            reinterpret_cast<const size_t*>(tr.data.ptr.offsets),  
                            tr.offsets_size/sizeof(size_t),  
                            freeBuffer, this);  
                    } else {  
                        ......
                    }  
                } else {  
                    ...... 
                }  
            }  
            goto finish;  
  
        ......  
        }  
    }  
  
finish:  
    ......  
    return err;  
}  
```

这里的tr.flags等于0，这个是在上面的binder_send_reply函数里设置的。接着就把结果保存在reply了：

```c
reply->ipcSetDataReference(  
       reinterpret_cast<const uint8_t*>(tr.data.ptr.buffer),  
       tr.data_size,  
       reinterpret_cast<const size_t*>(tr.data.ptr.offsets),  
       tr.offsets_size/sizeof(size_t),  
       freeBuffer, this);  
```

我们简单看一下`Parcel::ipcSetDataReference`函数的实现：

```c
void Parcel::ipcSetDataReference(const uint8_t* data, size_t dataSize,
    const size_t* objects, size_t objectsCount, release_func relFunc, void* relCookie)
{
    freeDataNoInit();
    mError = NO_ERROR;
    mData = const_cast<uint8_t*>(data);
    mDataSize = mDataCapacity = dataSize;
    //LOGI("setDataReference Setting data size of %p to %lu (pid=%d)\n", this, mDataSize, getpid());
    mDataPos = 0;
    LOGV("setDataReference Setting data pos of %p to %d\n", this, mDataPos);
    mObjects = const_cast<size_t*>(objects);
    mObjectsSize = mObjectsCapacity = objectsCount;
    mNextObjectHint = 0;
    mOwner = relFunc;
    mOwnerCookie = relCookie;
    scanForFds();
}
```

上面提到，返回来的数据中有一个Binder引用，因此，这里的mObjectSize等于1，这个Binder引用对应的位置记录在mObjects成员变量中。

从这里层层返回，最后回到`BpServiceManager::checkService`函数的`remote()->transact(CHECK_SERVICE_TRANSACTION, data, &reply)`后，下面一行代码是

```c
return reply.readStrongBinder();
```

我们看一下其实现：

```c
sp<IBinder> Parcel::readStrongBinder() const
{
    sp<IBinder> val;
    unflatten_binder(ProcessState::self(), *this, &val);
    return val;
}
```

这里调用了`unflatten_binder`函数来构造一个Binder对象：

```c
status_t unflatten_binder(const sp<ProcessState>& proc,
    const Parcel& in, sp<IBinder>* out)
{
    const flat_binder_object* flat = in.readObject(false);
    
    if (flat) {
        switch (flat->type) {
            case BINDER_TYPE_BINDER:
                *out = static_cast<IBinder*>(flat->cookie);
                return finish_unflatten_binder(NULL, *flat, in);
            case BINDER_TYPE_HANDLE:
                *out = proc->getStrongProxyForHandle(flat->handle);
                return finish_unflatten_binder(
                    static_cast<BpBinder*>(out->get()), *flat, in);
        }        
    }
    return BAD_TYPE;
}
```

这里的flat->type是BINDER_TYPE_HANDLE，因此调用`ProcessState::getStrongProxyForHandle`函数：

```c
sp<IBinder> ProcessState::getStrongProxyForHandle(int32_t handle)
{
    sp<IBinder> result;
 
    AutoMutex _l(mLock);
 
    handle_entry* e = lookupHandleLocked(handle);
 
    if (e != NULL) {
        // We need to create a new BpBinder if there isn't currently one, OR we
        // are unable to acquire a weak reference on this current one.  See comment
        // in getWeakProxyForHandle() for more info about this.
        IBinder* b = e->binder;
        if (b == NULL || !e->refs->attemptIncWeak(this)) {
            b = new BpBinder(handle); 
            e->binder = b;
            if (b) e->refs = b->getWeakRefs();
            result = b;
        } else {
            // This little bit of nastyness is to allow us to add a primary
            // reference to the remote proxy when this team doesn't have one
            // but another team is sending the handle to us.
            result.force_set(b);
            e->refs->decWeak(this);
        }
    }
 
    return result;
}
```

这里我们可以看到，ProcessState会把使用过的Binder远程接口（BpBinder）缓存起来，这样下次从Service Manager那里请求得到相同的句柄（Handle）时就可以直接返回这个Binder远程接口了，不用再创建一个出来。这里是第一次使用，因此，e->binder为空，于是创建了一个BpBinder对象。

最后，函数返回到`IMediaDeathNotifier::getMediaPlayerService`这里，从这个语句返回：`binder = sm->getService(String16("media.player"));`。这就相当于`binder = new BpBinder(handle)`。  

最后函数调用`sMediaPlayerService = interface_cast<IMediaPlayerService>(binder);`，这就等价于`sMediaPlayerService = new BpMediaPlayerService(new BpBinder(handle))`。最终，我们得到了一个`BpMediaPlayerService`对象，达到了我们的目标。  

有了这个BpMediaPlayerService这个远程接口之后，MediaPlayer就可以调用MediaPlayerService的服务了。

Framework里面的Binder总算把自个完全整懵了。Java层的Binder可以参考[IPC机制——Binder](/android/framework/IPC机制/#33-binder)。