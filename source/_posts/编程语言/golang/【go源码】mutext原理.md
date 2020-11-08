---
title: 【go源码】mutext原理.md
toc: true
date: 2020-11-08 14:29:51
categories:
- 编程语言 / Go
tags:
- go 源码
- mutex
- 同步
---

## **`Mutex`结构**

```go
type Mutex struct {
  state int32
  sema  uint32
}
```

 `state` 表示当前互斥锁的状态，而 `sema` 是用于控制锁状态的信号量。

## `state`位含义

```go
const (
  mutexLocked = 1 << iota // mutex is locked
  mutexWoken  //2
  mutexStarving //4
  mutexWaiterShift = iota //3
)
                                                                                             
32                                               3             2             1             0 
 |                                               |             |             |             | 
 |                                               |             |             |             | 
 v-----------------------------------------------v-------------v-------------v-------------+ 
 |                                               |             |             |             v 
 |                 waitersCount                  |mutexStarving| mutexWoken  | mutexLocked | 
 |                                               |             |             |             | 
 +-----------------------------------------------+-------------+-------------+-------------+                                                                                                              
```

在默认情况下，互斥锁的所有状态位都是 `0`，`int32` 中的不同位分别表示了不同的状态：

- `mutexLocked` — 表示互斥锁的锁定状态；
- `mutexWoken` — 表示从正常模式被从唤醒；
- `mutexStarving` — 当前的互斥锁进入饥饿状态；
- `waitersCount` — 当前互斥锁上等待的 Goroutine 个数；

<!-- more -->

## Lock原理

### 互斥锁的两种模式

> 互斥锁有两种模式：正常模式和饥饿模式。
>
> 在正常模式下，所有等待锁的goroutine按照**FIFO**顺序等待。唤醒的goroutine不会直接拥有锁，而是会和新请求锁的goroutine竞争锁的拥有。新请求锁的goroutine具有优势：它正在CPU上执行，而且可能有好几个，所以刚刚唤醒的goroutine有很大可能在锁竞争中失败。在这种情况下，这个被唤醒的goroutine会加入到等待队列的前面。 如果一个等待的goroutine超过1ms没有获取锁，那么它将会把锁转变为饥饿模式。
>
> 在饥饿模式下，锁的所有权将从unlock的gorutine直接交给交给等待队列中的第一个。新来的goroutine将不会尝试去获得锁，即使锁看起来是unlock状态, 也不会去尝试自旋操作，而是放在等待队列的尾部。
>
> 如果一个等待的goroutine获取了锁，并且满足一以下其中的任何一个条件：(1)它是队列中的最后一个；(2)它等待的时候小于1ms。它会将锁的状态转换为正常状态。
>
> 正常模式有很好的性能表现，饥饿模式也是非常重要的，因为它能阻止尾部延迟的现象。

### 状态1：m.state == 0

如果当前 state == 0, 肯定是没人上锁，也没人等待。这时只要把`state`的 `mutexLocked`位置1即可，以上使用cas操作

```go
if atomic.CompareAndSwapInt32(&m.state, 0, mutexLocked) {
  return
}
```

### 状态2：符合自旋条件

对于符合条件的场景将使用自旋来进行抢锁，但如果当前处于饥饿模式禁止自旋。根据实现原理，此时活跃的 goroutine 要直接进入 park 的队列

```go
for {
  // 第一个条件是state已被锁，但是不是饥饿状态。如果时饥饿状态，自旋时没有用的，锁的拥有权直接交给了等待队列的第一个。
  // 第二个条件是还可以自旋，多核、压力不大并且在一定次数内可以自旋， 具体的条件可以参考`sync_runtime_canSpin`的实现。
  // 如果满足这两个条件，不断自旋来等待锁被释放、或者进入饥饿状态、或者不能再自旋。
  if old&(mutexLocked|mutexStarving) == mutexLocked && runtime_canSpin(iter) {
    // 自旋的过程中如果发现state还没有设置woken标识，则设置它的woken标识， 并标记自己为被唤醒。
    if !awoke && old&mutexWoken == 0 && old>>mutexWaiterShift != 0 &&
    	atomic.CompareAndSwapInt32(&m.state, old, old|mutexWoken) {
      awoke = true
    }
    runtime_doSpin()
    iter++
    old = m.state
    continue
  }
  // ... 使用信号量抢锁逻辑
}
```

### 状态3：使用信号量抢锁

对于不符合自旋条件的状态，开始尝试使用信号量抢锁，主要分为两个步骤，先记录开始抢锁时的`state` 记做 `old`，然后根据不同情况计算如果抢锁成功之后的`state`值，最后通过cas更新

#### 1、计算互斥锁的最新状态

**计算1**

如果old state状态不是饥饿状态, new state 设置锁， 尝试通过CAS获取锁

如果old state状态是饥饿状态, 则不设置new state的锁，因为饥饿状态下锁直接转给等待队列的第一个.

```go
if old&mutexStarving == 0 {
  new |= mutexLocked
}
```

**计算2**

如果此时的old的值 `mutexLocked`不是1，或者是饥饿模式，说明有人己经锁上了，需要把`waitersCount`++

```go
if old&(mutexLocked|mutexStarving) != 0 {
  new += 1 << mutexWaiterShift
}
```

**计算3**

如果当前goroutine已经处于饥饿状态， 并且old state的已被加锁
将new state的状态标记为饥饿状态, 将锁转变为饥饿状态

```go
if starving && old&mutexLocked != 0 {
	new |= mutexStarving
}
```

#### 2、更新互斥锁的状态并获取锁

```go
for {
  // ... 自旋
  // ... 设置new新值

  // 通过CAS设置new state值.
  // 注意new的锁标记不一定是true, 也可能只是标记一下锁的state是饥饿状态.
  if atomic.CompareAndSwapInt32(&m.state, old, new) {
    // ... 获取锁逻辑
  } else { // 如果CAS不成功，重新获取锁的state, 从for循环开始处重新开始
    old = m.state
  }
}
```

**设锁成功**

state的新值锁标记不一定是true，  如果old state的状态是未被锁状态，并且锁不处于饥饿状态, 那么当前goroutine已经获取了锁的拥有权，跳出循环

```go
for {
  // ... 自旋
  // ... 设置new新值

  if atomic.CompareAndSwapInt32(&m.state, old, new) {
    // 成功获取锁逻辑
    if old&(mutexLocked|mutexStarving) == 0 {
      break
    }

    // ...
  } else { // 如果CAS不成功，重新获取锁的state, 从for循环开始处重新开始
    old = m.state
  }
}
```

**使用信号量并让goroutine休眠**

对于被唤醒的goroutine，会被放到信号量等待的队首。对于新来的goroutine，会被放到信号量等待的队尾。信号量会按照FIFO的方式唤醒goroutine

> 并不意味着在队首被唤醒时就一定能拿到锁，它需要和当前正在请求锁的goroutine一起竞争。
>
> 所以才会设计出饥饿模式，在饥饿模式下，新的goroutine不会竞争，因此可以保证队首的goroutine在被唤醒时一定能拿到锁

```go
for {
  // ... 自旋
  // ... 设置new新值

  if atomic.CompareAndSwapInt32(&m.state, old, new) {
    // ... 成功获取锁逻辑
    // 设置/计算本goroutine的等待时间
    queueLifo := waitStartTime != 0
    if waitStartTime == 0 {
      waitStartTime = runtime_nanotime()
    }

    // 既然未能获取到锁， 那么就使用sleep原语阻塞本goroutine
    // 如果是新来的goroutine,queueLifo=false, 加入到等待队列的尾部，耐心等待
    // 如果是唤醒的goroutine, queueLifo=true, 加入到等待队列的头部
    runtime_SemacquireMutex(&m.sema, queueLifo)

    // ... 
  } else { // 如果CAS不成功，重新获取锁的state, 从for循环开始处重新开始
    old = m.state
  }
}
```

**唤醒之后**

1. `runtime_SemacquireMutex` 被唤醒了有两种情况，如果老的 old 就是饥饿的，那么自己一定是唯一被唤醒，一定能抢到锁的，waiter 减一，如果自己是最后一个 waiter 或是饥饿时间小于 starvationThresholdNs 那么清除 mutexStarving 标记位后退出
2. 如果老的不是饥饿模式，那么 awoke 置 true，重新竞争

```go
for {
  // ... 自旋
  // ... 设置new新值

  if atomic.CompareAndSwapInt32(&m.state, old, new) {
    // ... 成功获取锁逻辑
    // ... 设置/计算本goroutine的等待时间
    // ... 信号量休眠
    
    // sleep之后，此goroutine被唤醒
    
    // 计算当前goroutine是否已经处于饥饿状态.
    starving = starving || runtime_nanotime()-waitStartTime > starvationThresholdNs
    // 得到当前的锁状态
    old = m.state

    // 如果当前的state已经是饥饿状态
    // 那么锁应该处于Unlock状态，那么应该是锁被直接交给了本goroutine
    if old&mutexStarving != 0 {

      // 如果当前的state已被锁，或者已标记为唤醒， 或者等待的队列中不为空,
      // 那么state是一个非法状态
      if old&(mutexLocked|mutexWoken) != 0 || old>>mutexWaiterShift == 0 {
        throw("sync: inconsistent mutex state")
      }

      // 当前goroutine用来设置锁，并将等待的goroutine数减1.
      delta := int32(mutexLocked - 1<<mutexWaiterShift)

      // 如果本goroutine是最后一个等待者，或者它并不处于饥饿状态，
      // 那么我们需要把锁的state状态设置为正常模式.
      if !starving || old>>mutexWaiterShift == 1 {
        // 退出饥饿模式
        delta -= mutexStarving
      }

      // 设置新state, 因为已经获得了锁，退出、返回
      atomic.AddInt32(&m.state, delta)
      break
    }

    // 如果当前的锁是正常模式，本goroutine被唤醒，自旋次数清零，从for循环开始处重新开始
    awoke = true
    iter = 0
  } else { // 如果CAS不成功，重新获取锁的state, 从for循环开始处重新开始
    old = m.state
  }
}
```

当然在唤醒之后还需要计算是不是已经达到了饥饿模式的触发条件，如果时间超过的1ms则设置变量 starving = true，这样下次计算new state的时候就会把饥饿位标置了(计算2)

## UnLock原理

### 步骤1：原子操作

如果state不是处于锁的状态, 那么就是Unlock根本没有加锁的mutex, panic

```go
new := atomic.AddInt32(&m.state, -mutexLocked)
if (new+mutexLocked)&mutexLocked == 0 {
  throw("sync: unlock of unlocked mutex")
}
```

### 步骤2：通知其他goroutine

在哪种情况需要通知其他goroutine呢，当然是new != 0时

```go
if new != 0 {
  // Outlined slow path to allow inlining the fast path.
  // To hide unlockSlow during tracing we skip one extra frame when tracing GoUnblock.
  m.unlockSlow(new)
}
```

#### 步骤2.1：对于饥饿模式，使用信号量释放锁

```go
if new&mutexStarving == 0 {
	// ... 正常模式
} else {
  // 饥饿模式下， 直接将锁的拥有权传给等待队列中的第一个 (true 参数)
  // 注意此时state的mutexLocked还没有加锁，唤醒的goroutine会设置它。
  // 在此期间，如果有新的goroutine来请求锁， 因为mutex处于饥饿状态， mutex还是被认为处于锁状态，
  // 新来的goroutine不会把锁抢过去
  runtime_Semrelease(&m.sema, true, 1)
}
```

####  步骤2.2：正常模式下，cas state

为什么是 for 循环？原因在于，上一步原子操作后，很可能有第三方刚好获得锁了，那么 for 里面的 CAS 肯定会失败，所以需要循环试

```go
if new&mutexStarving == 0 {
  old := new
  for {
    // 如果 old&(mutexLocked|mutexWoken) != 0 说明要么有人获得了锁，
    // 要么己经有 woken 的 goroutine 了，也不用去唤醒
    if old>>mutexWaiterShift == 0 || old&(mutexLocked|mutexWoken|mutexStarving) != 0 {
      return
    }
   	
    // 设置新的state, 这里通过信号量会唤醒一个阻塞的goroutine去获取锁.
    new = (old - 1<<mutexWaiterShift) | mutexWoken
    if atomic.CompareAndSwapInt32(&m.state, old, new) {
      runtime_Semrelease(&m.sema, false, 1)
      return
    }
    old = m.state
  }
} else {
  // ... 饥饿模式
}
```

## 拓展

### go中的底层同步机制

#### 1 cas、atomic

cas(Compare And Swap)和原子运算是其他同步机制的基础， 在runtime/asm_xxx.s(xxx代表系统架构，比如amd64)中实现。amd64架构的系统中， 主要通过两条汇编语句来实现，一个是**LOCK**、一个是**CMPXCHG**。

**LOCK**是一个指令前缀，其后必须跟一条“读-改-写”的指令，比如INC、XCHG、CMPXCHG等。 这条指令对CPU缓存的访问将是排他的。

**CMPXCHG**是完成CAS动作的指令。 把LOCK和CMPXCHG一起使用，就达到了原子CAS的功能。

atomic操作也是通过**LOCK**和其他算术操作（**XADD**、**ORB**等）组合来实现。

#### 2 自旋锁

Golang中的自旋锁用来实现其他类型的锁，自旋锁的作用和互斥量类似，不同点在于， 它不是通过休眠来使进程阻塞，而是在获得锁之前一直处于忙等状态（自旋），从而避免了进程（或者

和自旋锁相关的函数有sync_runtime_canSpin和sync_runtime_doSpin， 前者用来判断当前是否可以进行自旋，后者执行自旋操作。二者通常一起使用。

sync_runtime_canSpin函数中在以下四种情况返回false

1. 已经执行了很多次
2. 是单核CPU
3. 没有其他正在运行的P
4. 当前**P**的**G**队列为空

条件1避免长时间自旋浪费CPU的情况。

条件2、3用来保证除了当前在运行的Goroutine之外，还有其他Goroutine在运行。

条件4是避免自旋锁等待的条件是由当前**P**的其他**G**来触发，这样会导致在自旋变得没有意义，因为条件永远无法触发。

`sync_runtime_doSpin`会调用procyield函数，该函数也是汇编语言实现。 函数内部循环调用**PAUSE**指令。**PAUSE**指令什么都不做，但是会消耗CPU时间，在执行**PAUSE**指令时， CPU不会对他做不必要的优化。

#### 3 信号量

按照runtime/sema.go中的注释：

```text
Think of them as a way to implement sleep and wakeup
```

Golang中的sema，提供了休眠和唤醒Goroutine的功能。

**semacquire **函数首先检查信号量是否为0：如果大于0，让信号量减一，返回； 如果等于0，就调用`goparkunlock`函数，把当前Goroutine放入该sema的等待队列，并把他设为等待状态。

**semrelease** 函数首先让信号量加一，然后检查是否有正在等待的Goroutine： 如果没有，直接返回；如果有，调用`goready`函数唤醒一个Goroutine。

## 参考

- [Golang同步机制的实现](https://ga0.github.io/golang/2015/10/11/golang-sync.html)

- [sync.mutex 源代码分析](https://colobu.com/2018/12/18/dive-into-sync-mutex/)
- [GO: sync.Mutex 的实现与演进](https://www.jianshu.com/p/ce1553cc5b4f)

















