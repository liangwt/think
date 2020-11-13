---
title: 【go源码】channel原理
toc: true
date: 2020-11-13 23:43:15
categories:
- 编程语言 / Go
tags:
- go 源码
- channle
---
## **`channel`结构**

位置 `src/runtime/chan.go`

```go
type hchan struct {
	qcount   uint           // 当前队列中剩余元素个数
	dataqsiz uint           // 环形队列长度，即可以存放的元素个数
	buf      unsafe.Pointer // 环形队列指针
	elemsize uint16         // 每个元素的大小
	closed   uint32	        // 标识关闭状态
	elemtype *_type         // 元素类型
	sendx    uint           // 队列下标，指示元素写入时存放到队列中的位置
	recvx    uint           // 队列下标，指示元素从队列的该位置读出
	recvq    waitq          // 等待读消息的goroutine队列
	sendq    waitq          // 等待写消息的goroutine队列
	lock mutex              // 互斥锁，chan不允许并发读写
}
```

```go
type waitq struct {
	first *sudog
	last  *sudog
}
```

```go
type sudog struct {
	// The following fields are protected by the hchan.lock of the
	// channel this sudog is blocking on. shrinkstack depends on
	// this for sudogs involved in channel ops.

	g *g

	next *sudog
	prev *sudog
	elem unsafe.Pointer // data element (may point to stack)

	// The following fields are never accessed concurrently.
	// For channels, waitlink is only accessed by g.
	// For semaphores, all fields (including the ones above)
	// are only accessed when holding a semaRoot lock.

	acquiretime int64
	releasetime int64
	ticket      uint32

	// isSelect indicates g is participating in a select, so
	// g.selectDone must be CAS'd to win the wake-up race.
	isSelect bool

	parent   *sudog // semaRoot binary tree
	waitlink *sudog // g.waiting list or semaRoot
	waittail *sudog // semaRoot
	c        *hchan // channel
}
```

## 初始化

![img](https://cdn.showthink.cn/img/1460000019204881.png)

## 发送

```go
ch <- 3
```

发送操作被编译后实际执行的代码位于`src/runtime/chan.go`

```go
func chansend(c *hchan, ep unsafe.Pointer, block bool, callerpc uintptr) bool {
 	// ... 
}
```

### 1、锁定整个通道结构

![image-20201109234159121](https://cdn.showthink.cn/img/image-20201109234159121.png)

在锁定完后，会判断通道是否已经关闭。

```go
lock(&c.lock)

if c.closed != 0 {
  unlock(&c.lock)
  panic(plainError("send on closed channel"))
}
```

### 2、数据发送

数据发送会面临三种情况

#### 情况1: 直接发送

**条件：**

1. recvq链表上存在等待的接收者

2. 缓冲队列为空（此时一定是空的，因为仅有`buf`为空时，接收者才会被阻塞）

> 接收者被阻塞时，会将接收者放到recvq的链表中（详见数据接收）
>
> ![](https://cdn.showthink.cn/img/image-20201110001229682-20201110001331078-20201110001537902-20201110232333391.png)

通过 [`runtime.send`](https://github.com/golang/go/blob/e35876ec6591768edace6c6f3b12646899fd1b11/src/runtime/chan.go#L270) 直接将数据发送给阻塞的接收者；

```go
if sg := c.recvq.dequeue(); sg != nil {
  // Found a waiting receiver. We pass the value we want to send
  // directly to the receiver, bypassing the channel buffer (if any).
  send(c, sg, ep, func() { unlock(&c.lock) }, 3)
  return true
}
```

![image-20201110001436328](https://cdn.showthink.cn/img/image-20201110001436328.png)

发送数据时会调用 [`runtime.send`](https://github.com/golang/go/blob/e35876ec6591768edace6c6f3b12646899fd1b11/src/runtime/chan.go#L270)，该函数的执行可以分成两个部分：

1. 调用 [`runtime.sendDirect`](https://github.com/golang/go/blob/e35876ec6591768edace6c6f3b12646899fd1b11/src/runtime/chan.go#L313) 函数将发送的数据直接拷贝到 `x = <-c` 表达式中变量 `x` 所在的内存地址上；
2. 调用 [`runtime.goready`](https://github.com/golang/go/blob/64c22b70bf00e15615bb17c29f808b55bc339682/src/runtime/proc.go#L313) 将等待接收数据的 Goroutine 标记成可运行状态 `Grunnable` 并把该 Goroutine 放到发送方所在的处理器的 `runnext` 上等待执行，该处理器在下一次调度时就会立刻唤醒数据的接收方；

```go
// send processes a send operation on an empty channel c.
// The value ep sent by the sender is copied to the receiver sg.
// The receiver is then woken up to go on its merry way.
// Channel c must be empty and locked.  send unlocks c with unlockf.
// sg must already be dequeued from c.
// ep must be non-nil and point to the heap or the caller's stack.
func send(c *hchan, sg *sudog, ep unsafe.Pointer, unlockf func(), skip int) {
	// ...
	if sg.elem != nil {
		sendDirect(c.elemtype, sg, ep)
		sg.elem = nil
	}
	gp := sg.g
	unlockf()
	gp.param = unsafe.Pointer(sg)
	if sg.releasetime != 0 {
		sg.releasetime = cputicks()
	}
	goready(gp, skip+1)
}
```

#### 情况2: 写缓冲区

**条件：**

1. recvq没有接收者在等待
2. 缓冲区容量还没有满（对于无缓冲channel肯定不满足）

```go
if c.qcount < c.dataqsiz {
  // Space is available in the channel buffer. Enqueue the element to send.
  qp := chanbuf(c, c.sendx)
  typedmemmove(c.elemtype, qp, ep)
  c.sendx++
  if c.sendx == c.dataqsiz {
    c.sendx = 0
  }
  c.qcount++
  unlock(&c.lock)
  return true
}
```

**计算该写入的位置**

因为`sendx`记录的就是写入的位置，再结合`hchan`的`elemsize`（每个元素的大小）即可计算内存的指针

```go
// chanbuf(c, i) is pointer to the i'th slot in the buffer.
func chanbuf(c *hchan, i uint) unsafe.Pointer {
	return add(c.buf, uintptr(i)*uintptr(c.elemsize))
}
```

**数据copy**

```go
 typedmemmove(c.elemtype, qp, ep)
```

**增加索引**

给发送的位置++，`buf` 是一个循环数组，所以当 `sendx` 等于 `dataqsiz` 时就会重新回到数组开始的位置

```go
c.sendx++
if c.sendx == c.dataqsiz {
  c.sendx = 0
}
c.qcount++
```

#### 情况3: 阻塞

**条件：**

1. 缓冲区容量已经满了

![image-20201110232305427](https://cdn.showthink.cn/img/image-20201110232305427.png)

**创建一个链表节点`sudog`并设置相关的值**

```go
// Block on the channel. Some receiver will complete our operation for us.
gp := getg()
mysg := acquireSudog()
mysg.releasetime = 0
if t0 != 0 {
  mysg.releasetime = -1
}
// No stack splits between assigning elem and enqueuing mysg
// on gp.waiting where copystack can find it.
mysg.elem = ep
mysg.waitlink = nil
mysg.g = gp
mysg.isSelect = false
mysg.c = c
gp.waiting = mysg
gp.param = nil
```

![image-20201110232839103](https://cdn.showthink.cn/img/image-20201110232839103.png)

把链表的接到sendq的尾部

```go
c.sendq.enqueue(mysg)
```

![image-20201110232722059](https://cdn.showthink.cn/img/image-20201110232722059.png)

**将此`goroutine`休眠并等待唤醒**

```go
gopark(chanparkcommit, unsafe.Pointer(&c.lock), waitReasonChanSend, traceEvGoBlockSend, 2)
```

对于一个正在运行的goroutine来说，它被运行在一个M（内核线程）上

![image-20201110233654468](https://cdn.showthink.cn/img/image-20201110233654468.png)

当执行gopark后，正在运行的groutine 被标记为waiting状态，随后与M进行分离。P 会从runQ中取一个新的G放到M上去运行

![image-20201110233943438](https://cdn.showthink.cn/img/image-20201110233943438.png)

## 读取

```go
i <- ch
i, ok <- ch
```

发送操作被编译后实际执行的代码位于`src/runtime/chan.go`

```go
// entry points for <- c from compiled code
//go:nosplit
func chanrecv1(c *hchan, elem unsafe.Pointer) {
	chanrecv(c, elem, true)
}

//go:nosplit
func chanrecv2(c *hchan, elem unsafe.Pointer) (received bool) {
	_, received = chanrecv(c, elem, true)
	return
}

func chanrecv(c *hchan, ep unsafe.Pointer, block bool) (selected, received bool) {
  /// ...
}
```

### 1、锁定

在锁定完成后会判断channel是否已经关闭，如果已经关闭并且buf的中已经不存在任何数据，则直接返回

```go
lock(&c.lock)

if c.closed != 0 && c.qcount == 0 {
  unlock(&c.lock)
  if ep != nil {
    typedmemclr(c.elemtype, ep)
  }
  return true, false
}
```

### 2、数据发送

#### 情况1: 有sendq等待

**条件：**

1. sendq有等待的goroutine

2. buf为满或nil（此时一定是满的或者是无缓冲channel，因为只有满的才会有发送者阻塞在`sendq`）

通过调用 [`runtime.recv`](https://github.com/golang/go/blob/e35876ec6591768edace6c6f3b12646899fd1b11/src/runtime/chan.go#L556) 函数接收数据

```go
if sg := c.sendq.dequeue(); sg != nil {
  // Found a waiting sender. If buffer is size 0, receive value
  // directly from sender. Otherwise, receive from head of queue
  // and add sender's value to the tail of the queue (both map to
  // the same buffer slot because the queue is full).
  recv(c, sg, ep, func() { unlock(&c.lock) }, 3)
  return true, true
}
```

此时，接收数据分为有缓冲队列和无缓冲队列两种情况。

- 对于无缓冲队列
  - 直接把等待发送的gorountine数据复制到目标地址
  - 唤醒等待的goroutine
- 对于有缓冲队列
  - 取出缓冲头部的数据复制到目标地址
  - 把等待发送的gorountine数据复制到缓冲区
  - 唤醒等待的goroutine

```go
func recv(c *hchan, sg *sudog, ep unsafe.Pointer, unlockf func(), skip int) {
	if c.dataqsiz == 0 {
		if ep != nil {
			// copy data from sender
			recvDirect(c.elemtype, sg, ep)
		}
	} else {
		// Queue is full. Take the item at the
		// head of the queue. Make the sender enqueue
		// its item at the tail of the queue. Since the
		// queue is full, those are both the same slot.
		qp := chanbuf(c, c.recvx)
		// copy data from queue to receiver
		if ep != nil {
			typedmemmove(c.elemtype, ep, qp)
		}
		// copy data from sender to queue
		typedmemmove(c.elemtype, qp, sg.elem)
		c.recvx++
		if c.recvx == c.dataqsiz {
			c.recvx = 0
		}
		c.sendx = c.recvx // c.sendx = (c.sendx+1) % c.dataqsiz
	}
	sg.elem = nil
	gp := sg.g
	unlockf()
	gp.param = unsafe.Pointer(sg)
	if sg.releasetime != 0 {
		sg.releasetime = cputicks()
	}
	goready(gp, skip+1)
}
```

![有sendq等待](https://cdn.showthink.cn/img/send_driect.gif)

#### 情况2: 只有缓冲区

**条件：**

1. 没有等待发送的goroutine（上面判断过了）
2. 有缓冲区

**要做的操作：**

1. 把读取指针（recvx）指向的数据复制到目标地址
2. 移动读取指针（recvx）
3. 减少缓冲区文件计数（qcount）

```go
if c.qcount > 0 {
  // Receive directly from queue
  qp := chanbuf(c, c.recvx)

  if ep != nil {
    typedmemmove(c.elemtype, ep, qp)
  }
  typedmemclr(c.elemtype, qp)
  c.recvx++
  if c.recvx == c.dataqsiz {
    c.recvx = 0
  }
  c.qcount--
  unlock(&c.lock)
  return true, true
}
```

#### 情况3: 阻塞

**条件：**

1. 缓冲队列为空（上一步判断的）或者没有缓冲区

在正常的接收场景中，我们会使用 [`runtime.sudog`](https://github.com/golang/go/blob/895b7c85addfffe19b66d8ca71c31799d6e55990/src/runtime/runtime2.go#L342) 结构体将当前 Goroutine 包装成一个处于等待状态的 Goroutine 并将其加入到接收队列中。

完成入队之后，上述代码还会调用 [`runtime.goparkunlock`](https://github.com/golang/go/blob/cfe3cd903f018dec3cb5997d53b1744df4e53909/src/runtime/proc.go#L309) 函数立刻触发 Goroutine 的调度，让出处理器的使用权并等待调度器的调度。

![阻塞](https://cdn.showthink.cn/img/block.gif)

## 参考

- [Understanding Channels](https://speakerdeck.com/kavya719/understanding-channels?slide=43)
- [6.4 Channel](https://draveness.me/golang/docs/part3-runtime/ch06-concurrency/golang-channel/#64-channel)