---

title: 深入了解bufio 包
date: 2018/03/08 20:46:25
categories:
- 编程语言 / Go
tags:
- golang
- bufio
toc: true

---


_最近用golang写了一个处理文件的脚本，由于其中涉及到了文件读写，开始使用golang中的 io 包，后来发现golang 中提供了一个bufio的包，使用这个包可以大幅提高文件读写的效率，于是在网上搜索同样的文件读写为什么bufio 要比io 的读写更快速呢？根据网上的资料和阅读源码，以下来详细解释下bufio的高效如何实现的。_


> bufio包实现了有缓冲的I/O。它包装一个io.Reader或io.Writer接口对象，创建另一个也实现了该接口，且同时还提供了缓冲和一些文本I/O的帮助函数的对象。


<!-- more -->


以上为官方包的介绍，在其中我们能了解到的信息如下：

- bufio 是通过缓冲来提高效率

    简单的说就是，把文件读取进缓冲（内存）之后再读取的时候就可以避免文件系统的io 从而提高速度。同理，在进行写操作时，先把文件写入缓冲（内存），然后由缓冲写入文件系统。看完以上解释有人可能会表示困惑了，直接把 内容->文件 和 内容->缓冲->文件相比， 缓冲区好像没有起到作用嘛。其实缓冲区的设计是为了存储多次的写入，最后一口气把缓冲区内容写入文件。下面会详细解释

- bufio 封装了io.Reader或io.Writer接口对象，并创建另一个也实现了该接口的对象

    io.Reader或io.Writer 接口实现read() 和 write() 方法，对于实现这个接口的对象都是可以使用这两个方法的

### bufio 包实现原理

![](https://ws1.sinaimg.cn/large/b373c093ly1fn82cq841bj20jl0dw0ta.jpg)


### bufio 源码分析

-  Reader对象

    bufio.Reader 是bufio中对io.Reader 的封装

    ```go
    // Reader implements buffering for an io.Reader object.
    type Reader struct {
        buf          []byte
        rd           io.Reader // reader provided by the client
        r, w         int       // buf read and write positions
        err          error
        lastByte     int
        lastRuneSize int
    }
    ```
    bufio.Read(p []byte) 相当于读取大小len(p)的内容，思路如下：

    1. 当缓存区有内容的时，将缓存区内容全部填入p并清空缓存区
    2. 当缓存区没有内容的时候且len(p)>len(buf),即要读取的内容比缓存区还要大，直接去文件读取即可
    3. 当缓存区没有内容的时候且len(p)<len(buf),即要读取的内容比缓存区小，缓存区从文件读取内容充满缓存区，并将p填满（此时缓存区有剩余内容）
    4. 以后再次读取时缓存区有内容，将缓存区内容全部填入p并清空缓存区（此时和情况1一样）

    以下是源码

    ```go
    // Read reads data into p.
    // It returns the number of bytes read into p.
    // The bytes are taken from at most one Read on the underlying Reader,
    // hence n may be less than len(p).
    // At EOF, the count will be zero and err will be io.EOF.
    func (b *Reader) Read(p []byte) (n int, err error) {
        n = len(p)
        if n == 0 {
            return 0, b.readErr()
        }
        if b.r == b.w {
            if b.err != nil {
                return 0, b.readErr()
            }
            if len(p) >= len(b.buf) {
                // Large read, empty buffer.
                // Read directly into p to avoid copy.
                n, b.err = b.rd.Read(p)
                if n < 0 {
                    panic(errNegativeRead)
                }
                if n > 0 {
                    b.lastByte = int(p[n-1])
                    b.lastRuneSize = -1
                }
                return n, b.readErr()
            }
            // One read.
            // Do not use b.fill, which will loop.
            b.r = 0
            b.w = 0
            n, b.err = b.rd.Read(b.buf)
            if n < 0 {
                panic(errNegativeRead)
            }
            if n == 0 {
                return 0, b.readErr()
            }
            b.w += n
        }

        // copy as much as we can
        n = copy(p, b.buf[b.r:b.w])
        b.r += n
        b.lastByte = int(b.buf[b.r-1])
        b.lastRuneSize = -1
        return n, nil
    }
    ```
    说明：

    1. reader内部通过维护一个r, w 即读入和写入的位置索引来判断是否缓存区内容被全部读出

- Writer对象

    bufio.Writer 是bufio中对io.Writer 的封装
    ```go
    // Writer implements buffering for an io.Writer object.
    type Writer struct {
        err error
        buf []byte
        n   int
        wr  io.Writer
    }
    ```
    
    bufio.Write(p []byte) 的思路如下

    1. 判断buf中可用容量是否可以放下 p 
    2. 如果能放下，直接把p拼接到buf后面，即把内容放到缓冲区
    3. 如果缓冲区的可用容量不足以放下，且此时缓冲区是空的，直接把p写入文件即可
    3. 如果缓冲区的可用容量不足以放下，且此时缓冲区有内容，则用p把缓冲区填满，把缓冲区所有内容写入文件，并清空缓冲区
    4. 判断p的剩余内容大小能否放到缓冲区，如果能放下（此时和步骤1情况一样）则把内容放到缓冲区
    5. 如果p的剩余内容依旧大于缓冲区，（注意此时缓冲区是空的，情况和步骤2一样）则把p的剩余内容直接写入文件

    以下是源码
    
    ```go
    // Write writes the contents of p into the buffer.
    // It returns the number of bytes written.
    // If nn < len(p), it also returns an error explaining
    // why the write is short.
    func (b *Writer) Write(p []byte) (nn int, err error) {
        for len(p) > b.Available() && b.err == nil {
            var n int
            if b.Buffered() == 0 {
                // Large write, empty buffer.
                // Write directly from p to avoid copy.
                n, b.err = b.wr.Write(p)
            } else {
                n = copy(b.buf[b.n:], p)
                b.n += n
                b.flush()
            }
            nn += n
            p = p[n:]
        }
        if b.err != nil {
            return nn, b.err
        }
        n := copy(b.buf[b.n:], p)
        b.n += n
        nn += n
        return nn, nil
    }
    ```

    说明：
    
    1. b.wr 存储的是一个io.writer对象，实现了Write()的接口，所以可以使用b.wr.Write(p) 将p的内容写入文件
    2. b.flush() 会将缓存区内容写入文件，当所有写入完成后，因为缓存区会存储内容，所以需要手动flush()到文件
    3. b.Available() 为buf可用容量，等于len(buf) - n 
    4. 下图解释的是其中一种情况，即缓存区有内容，剩余p大于缓存区
    
        ![](https://ws1.sinaimg.cn/large/b373c093ly1fn83ex6p10j20mq0jbweq.jpg)

    