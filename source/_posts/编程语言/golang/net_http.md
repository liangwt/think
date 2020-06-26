title: 深入了解net/http
date: 2018/03/08 20:46:25
categories:
- 编程语言 / Go
tags:
- golang
- net/http
- Handler


---

> http包提供了HTTP客户端和服务端的实现。

### 最简单Web服务
```go
package main

import (
	"fmt"
	"log"
	"net/http"
)

func main() {
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Println("hello")
	})
	log.Fatal(http.ListenAndServe("localhost:8000", nil))
}
```

<!-- more -->

我们先分析下面这个函数
- func ListenAndServe(addr string, handler Handler) error
    - addr 参数很明显就是监听的host和端口
    - handler 参数是一个满足Handler 接口的对象

我们首先来了解下Handler类型
其定义如下
```go
type Handler interface {
    ServeHTTP(ResponseWriter, *Request)
}
```

也就是说凡是实现了`ServeHTTP(ResponseWriter, *Request)` 方法的类型都是满足Handler接口的，所以我们可以用下面的方式来实现一个web服务

（上面的说法并不严谨，我会在最后讲述使用http.HandlerFunc()进行类型转换来实现满足Handler接口的方法）

```go
import (
	"fmt"
	"log"
	"net/http"
)

type myHandler struct {
}

func (h myHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch r.URL.Path {
	case "/":
		fmt.Println("hello")
	default:
		w.WriteHeader(http.StatusNotFound)
		fmt.Fprintf(w, "not found: %s\n", r.URL)
	}
}
func main() {
	handler := myHandler{}
	log.Fatal(http.ListenAndServe("localhost:8000", handler))
}
```

可能有人注意到了我们在最开始写的，最简单的web服务中的`http.ListenAndServe("localhost:8000", nil)`我们向第二个参数传递的是`nil`，并不满足http.Handler接口，这个问题我们留到下面去解答

### http.ServeMux 
> ServeMux类型是HTTP请求的多路转接器。它会将每一个接收的请求的URL与一个注册模式的列表进行匹配，并调用和URL最匹配的模式的处理器。

上面的例子中`myHandler.ServeHTTP()`实际上既实现了路由分配又实现了逻辑处理。在大多数情况下，我们更希望不同的路由交由不同的方法来处理，所以http包中引入了ServeMux类型来帮助我们实现路由分配

#### 用法

```go
type myHandler struct {
}

func (h myHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintln(w, "hello world")
}
func main() {
	handler := myHandler{}
	mux := http.NewServeMux()
	mux.Handle("/", handler)
	log.Fatal(http.ListenAndServe("localhost:8000", mux))
}
```

#### ServeMux的结构

```go
type ServeMux struct {
    mu sync.RWMutex   //锁，由于请求涉及到并发处理，因此这里需要一个锁机制
    m  map[string]muxEntry  // 路由规则，一个string对应一个mux实体，这里的string就是注册的路由表达式
    hosts bool // 是否在任意的规则中带有host信息
}
type muxEntry struct {
    explicit bool   // 是否精确匹配
    h        Handler // 这个路由表达式对应哪个handler
    pattern  string  //匹配字符串
}
```

可以注意到`muxEntry`中的`h`的类型为实现Handler接口结构的对象

#### 路由解析实现思路

通过ServeMux可以看到实际的路由规则记录在ServeMux.m 中，这个属性是一个`map[string]muxEntry` 类型，string记录都是路由，muxEntry里包含实际的handler

通过`http.ListenAndServe("localhost:8000", mux)`很容易想到ServeMux实现了也实现了Handler接口(拥有ServerHTTP()方法)

所以实现路由解析的原理为

- ListenAndServe() 调用ServeMux中的ServerHTTP()
- ServeMux中的ServerHTTP()方法会根据路由去map[string]muxEntry中找到对应的muxEntry，然后调用muxEntry中的 h.ServerHTTP()

源码入下
```go
func (mux *ServeMux) ServeHTTP(w ResponseWriter, r *Request) {
    if r.RequestURI == "*" {
        w.Header().Set("Connection", "close")
        w.WriteHeader(StatusBadRequest)
        return
    }
    h, _ := mux.Handler(r)
    h.ServeHTTP(w, r)
}
func (mux *ServeMux) Handler(r *Request) (h Handler, pattern string) {
    if r.Method != "CONNECT" {
        if p := cleanPath(r.URL.Path); p != r.URL.Path {
            _, pattern = mux.handler(r.Host, p)
            return RedirectHandler(p, StatusMovedPermanently), pattern
        }
    }    
    return mux.handler(r.Host, r.URL.Path)
}

func (mux *ServeMux) handler(host, path string) (h Handler, pattern string) {
    mux.mu.RLock()
    defer mux.mu.RUnlock()

    // Host-specific pattern takes precedence over generic ones
    if mux.hosts {
        h, pattern = mux.match(host + path)
    }
    if h == nil {
        h, pattern = mux.match(path)
    }
    if h == nil {
        h, pattern = NotFoundHandler(), ""
    }
    return
}
```
#### 添加handler

通过上面路由解析的原理可以了解：据用户请求的URL和路由器里面存储的map去匹配，当匹配到之后返回存储的handler，调用这个handler的ServeHTTP接口就可以执行到相应的函数了。

而将URL和handler 添加到map中则需要使用`func (mux *ServeMux) Handle(pattern string, handler Handler)`

看上面用法也可以很容易理解 mux.Handle("/", handler) Handle() 函数将URL:"/" 添加到了map的键，将对应的handler 添加到了muxEntry结构中

### http.HandlerFunc()

还记得上面的说法：凡是实现了`ServeHTTP(ResponseWriter, *Request)` 方法的类型都是满足Handler接口的。但实际开发中我们会发现大部分handler 并没有实现ServeHTTP() 的函数，而是如下的一种方式

```go
type myHandler struct {
}

func (h myHandler) index(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintln(w, "hello world")
}
func (h myHandler) News(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintln(w, "news one")
}
func main() {
	h := myHandler{}
	mux := http.NewServeMux()
	mux.Handle("/", http.HandlerFunc(h.index))
	mux.Handle("/news", http.HandlerFunc(h.News))
	log.Fatal(http.ListenAndServe("localhost:8000", mux))
}
```

`http.HandlerFunc(h.index)`在这里并不是函数调用，而是强制的类型转换

```go
type HandlerFunc func(ResponseWriter, *Request)

// ServeHTTP calls f(w, r).
func (f HandlerFunc) ServeHTTP(w ResponseWriter, r *Request) {
    f(w, r)
}
```
即我们调用了`HandlerFunc(f)`,强制类型转换f成为HandlerFunc类型，这样f就拥有了ServeHTTP方法。

### mux.HandleFunc()

因为像上面`http.HandlerFunc()` 方式是非常普遍的，所以下面两个是等价的

```go
mux.HandleFunc("/", h.index)
mux.Handle("/news", http.HandlerFunc(h.News))
```

### http.HandleFunc()

注意和上面的`http.HandlerFunc()`进行区分，前者是实现了Handler接口的类型，可使用强制类型转换`http.HandlerFunc(f)` 让f拥有ServeHTTP方法。

后者是为默认的ServeMux：DefaultServeMux注册路由和handler

`http.ListenAndServe("localhost:8000", nil)`中第二参数为nil时，http.Serve()便使用DefaultServeMuxz作为处理的handler

### Go代码的执行流程

通过对http包的分析之后，现在让我们来梳理一下整个的代码执行过程。
首先调用Http.HandleFunc
按顺序做了几件事：

1. 调用了DefaultServeMux的HandleFunc
2. 调用了DefaultServeMux的Handle
3. 往DefaultServeMux的map[string]muxEntry中增加对应的handler和路由规则

其次调用`http.ListenAndServe(":9090", nil)`
按顺序做了几件事情：
1. 实例化Server
2. 调用Server的ListenAndServe()
3. 调用net.Listen("tcp", addr)监听端口
4. 启动一个for循环，在循环体中Accept请求
5. 对每个请求实例化一个Conn，并且开启一个goroutine为这个请求进行服务go c.serve()
6. 读取每个请求的内容w, err := c.readRequest()
7. 判断handler是否为空，如果没有设置handler（这个例子就没有设置handler），handler就设置为DefaultServeMux
8. 调用handler的ServeHttp
9. 在这个例子中，下面就进入到DefaultServeMux.ServeHttp
10. 根据request选择handler，并且进入到这个handler的ServeHTTP
	`mux.handler(r).ServeHTTP(w, r)`
11. 选择handler：
   - 判断是否有路由能满足这个request（循环遍历ServerMux的muxEntry）
   - 如果有路由满足，调用这个路由handler的ServeHttp
   - 如果没有路由满足，调用NotFoundHandler的ServeHttp

### 参考资料

- 《go web 编程》 - 3.4 Go的http包详解
- golang http.handler接口详解 http://blog.csdn.net/secretx/article/details/51556648