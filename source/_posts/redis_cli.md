title: 使用golang写一个redis-cli
date: 2018/10/08 19:17:00
categories:
- BACKEND
tags:
- golang
- redis-cli
- protocol

---

### 0. redis通信协议
redis的客户端(redis-cli)和服务端(redis-server)的通信是建立在tcp连接之上， 两者之间数据传输的编码解码方式就是所谓的redis通信协议。所以，只要我们的redis-cli实现了这个协议的解析和编码，那么我们就可以完成所有的redis操作。

redis 协议设计的非常易读，也易于实现，关于具体的redis通信协议请参考：[通信协议（protocol）](http://redisdoc.com/topic/protocol.html)。后面我们在实现这个协议的过程中也会简单重复介绍一下具体实现

<!-- more -->

### 1. 建立tcp连接

redis客户端和服务端的通信是建立tcp连接之上，所以第一步自然是先建立连接

```go
package main

import (
	"flag"
	"log"
	"net"
)

var host string
var port string

func init() {
	flag.StringVar(&host, "h", "localhost", "hsot")
	flag.StringVar(&port, "p", "6379", "port")
}

func main() {
	flag.Parse()

	tcpAddr := &net.TCPAddr{IP: net.ParseIP(host), Port: port}
	conn, err := net.DialTCP("tcp", nil, tcpAddr)
	if err != nil {
		log.Println(err)
    }
    defer conn.Close()

	// to be continue
}

```
后续我们发送和接受数据便都可以使用`conn.Read()`和`conn.Write()`来进行了

### 2. 发送请求
发送请求第一个第一个字节是"*"，中间是包含命令本身的参数个数，后面跟着"\r\n" 。之后使用"$"加参数字节数量并使用"\r\n"结尾，然后紧跟参数内容同时也使用"\r\n"结尾。如执行 `SET key liangwt` 客户端发送的请求为"*3\r\n$3\r\nSET\r\n$3\r\nkey\r\n$7\r\nliangwt\r\n"

注意：

1. 命令本身也作为协议的其中一个参数来发送
2. \r\n 对应byte的十进制为 13 10

我们可以使用telnet测试下

```
wentao@bj:～/github.com/liangwt/redis-cli$ telnet 127.0.0.1 6379
Trying 127.0.0.1...
Connected to 127.0.0.1.
Escape character is '^]'.
*3
$3
SET
$3
key
$7
liangwt
+OK
```

先暂时忽略服务端的回复，通过telnet我们可以看出请求协议非常简单，所以对于请求协议的实现不做过多的介绍了，直接放代码(如下使用基于字符串拼接，只是为了更直观的演示，效率并不高，实际代码中我们使用bytes.Buffer来实现)

```go
func MultiBulkMarshal(args ...string) string {
	var s string
	s = "*"
	s += strconv.Itoa(len(args))
	s += "\r\n"

	// 命令所有参数
	for _, v := range args {
		s += "$"
		s += strconv.Itoa(len(v))
		s += "\r\n"
		s += v
		s += "\r\n"
	}

	return s
}
```

在实现了对命令和参数进行编码之后，我们便可以通过`conn.Write()`把数据推送到服务端

```go
func main() {
    // ....
	req := MultiBulkMarshal("SET", "key", "liangwt")
	_, err = conn.Write([]byte(req))
	if err != nil {
		log.Fatal(err)
	}
	// to be continue
}
```
### 3. 获取回复

我们首先实现通过tcp获取服务端返回值，就是上面提到过的`conn.Read()`。

```go
func main() {
    // ....
	p := make([]byte, 1024)
	_, err = conn.Read(p)
	if err != nil {
		log.Fatal(err)
	}
	// to be continue
}
```

### 4. 解析回复

我们拿到p之后我们就可以解析返回值了，redis服务端的回复是分为几种情况的
- 状态回复
- 错误回复
- 整数回复
- 批量回复
- 多条批量回复

我们把前四种单独看作一组，因为他们都是单一类型的返回值

我们把最后的多条批量回复看成单独的一组，因为它是包含前面几种类型的混合类型。而且你可以发现它和我们的请求协议是一样的

也正是基于以上的考虑我们创建两个函数来分别解析单一类型和混合类型，这样在解析混合类型中的某一类型时就只需要调用单一类型解析的函数即可

在解析具体协议前我们先实现一个是读取到\r\n为止的函数

```go
func ReadLine(p []byte) ([]byte, error) {
	for i := 0; i < len(p); i++ {
		if p[i] == '\r' {
			if p[i+1] != '\n' {
				return []byte{}, errors.New("format error")
			}
			return p[0:i], nil
		}
	}
	return []byte{}, errors.New("format error")
}
```

#### 第一种状态回复：
状态回复是一段以 "+" 开始， "\r\n" 结尾的单行字符串。如 SET 命令成功的返回值："+OK\r\n"

所以我们判断第一个字符是否等于 '+' 如果相等，则读取到\r\n

```go

func SingleUnMarshal(p []byte) ([]byte, int, error) {
	var (
		result []byte
		err    error
		length int
	)
	switch p[0] {
	case '+':
		result, err = ReadLine(p[1:])
		length = len(result) + 3
	}

	return result, length, err
}
```

注：我们在返回实际回复内容的同时也返回了整个回复的长度，方便后面解析多条批量回复时定位下一次的解析位置

#### 第二种错误回复：
错误回复的第一个字节是 "-"， "\r\n" 结尾的单行字符串。如执行 `SET key`缺少参数时返回值："-ERR wrong number of arguments for 'set' command\r\n"

错误回复和状态回复非常相似，解析方式也是一样到。所以我们只需添加一个case即可

```go
func SingleUnMarshal(p []byte) ([]byte, int, error) {
	var (
		result []byte
		err    error
		length int
	)
	switch p[0] {
	case '+', '-':
		result, err = ReadLine(p[1:])
		length = len(result) + 3
	}
	return result, length, err
}
```

#### 第三种整数回复：
整数回复的第一个字节是":"，中间是字符串表示的整数，"\r\n" 结尾的单行字符串。如执行`LLEN mylist`命令时返回 ":10\r\n"

整数回复也和上面两种是一样的，只不过返回的是字符串表示的十进制整数

```go
func SingleUnMarshal(p []byte) ([]byte, int, error) {
	var (
		result []byte
		err    error
		length int
	)
	switch p[0] {
	case '+', '-', ':':
		result, err = ReadLine(p[1:])
		length = len(result) + 3
	}
	return result, length, err
}
```
#### 第四种批量回复：

批量回复的第一个字节为 "$"，接下来是字符串表示的整数，它表示实际回复的长度，之后跟着一个 "\r\n"，再后面跟着的是实际回复数据，最末尾是另一个 "\r\n"。如`GET key` 命令的返回值："$7\r\nliangwt\r\n"

所以批量回复解析的实现：
- 读取第一行得到实际回复的长度
- 把字符串类型的长度转换成对应十进制整数
- 从第二行开始位置往下读对应长度

但是对于某些不存在的key，批量回复会将特殊值 -1 用作回复的长度值, 此时我们不需要继续往下读取实际回复。例如`GET NOT_EXIST_KEY` 返回值："$-1", 所以我们需要对此特殊情况判断，让函数返回一个空对象(nil)而不是空值("")

```go
func SingleUnMarshal(p []byte) ([]byte, int, error) {
	// ....
	case '$':
		n, err := ReadLine(p[1:])
		if err != nil {
			return []byte{}, 0, err
		}
		l, err := strconv.Atoi(string(n))
		if err != nil {
			return []byte{}, 0, err
		}
		if l == -1 {
			return nil, 0, nil
		}
		// +3 的原因 $ \r \n 三个字符
		result = p[len(n)+3 : len(n)+3+l]
		length = len(n) + 5 + l
	}
	return result, length, err
}
```

###### 思考：

为什么redis要使用提前告知字节数，然后往下读取指定长度的方式，而不是直接读取第二行到\r\n为止？

答案很明显：此方式可以让redis读取返回值时不受具体的返回内容影响，在按行读取的情况下，无论使用任何分割符都有可能导致redis在解析具体内容时把内容中的分割符当作时结尾，导致解析错误。 

思考一下这种情况：我们`SET key "liang\r\nwt"` ，那么当我们`GET key`时，服务端返回值为"$9\r\nliang\r\nwt\r\n" 完全规避了value中的\r\n影响

#### 第五种多条批量回复：

多条批量回复是由多个回复组成的数组，它的第一个字节为"*"， 后跟一个字符串表示的整数值， 这个值记录了多条批量回复所包含的回复数量， 再后面是一个"\r\n"。如`LRANGE mylist 0 -1`的返回值："*3\r\n$1\r\n3\r\n$1\r\n2\r\n$1\r\n1"。

所以多条批量回复解析的实现：

- 解析第一行数据获得字符串类型的回复数量
- 把字符串类型的长度转换成对应十进制整数
- 按照单条回复依次逐个解析，一共解析成上面得到的数量

在这里我们用到了单条解析时返回的字节长度length，通过这个长度我们可以很方便的知道下次单条解析的开始位置为上一次位置+length

在解析多条批量回复时需要注意两点：

第一，多条批量回复也可以是空白的（empty）。例如执行`LRANGE NOT_EXIST_KEY 0 -1` 服务端返回值"*0\r\n"。此时客户端返回的应该空数组[][]byte

第二，多条批量回复也可以是无内容的（null multi bulk reply)。例如执行`BLPOP key 1` 服务端返回值"*-1\r\n"。此时客户端返回的应该是nil


```go
func MultiUnMarsh(p []byte) ([][]byte, error) {
	if p[0] != '*' {
		return [][]byte{}, errors.New("format error")
	}
	n, err := ReadLine(p[1:])
	if err != nil {
		return [][]byte{}, err
	}
	l, err := strconv.Atoi(string(n))
	if err != nil {
		return [][]byte{}, err
	}
	// 多条批量回复也可以是空白的（empty)
	if l == 0 {
		return [][]byte{}, nil
	}

	// 无内容的多条批量回复（null multi bulk reply）也是存在的,
	// 客户端库应该返回一个 null 对象, 而不是一个空数组。
	if l == -1 {
		return nil, nil
	}
	result := make([][]byte, l)
	t := len(n) + 3
	for i := 0; i < l; i++ {
		ret, length, err := SingleUnMarshal(p[t:])
		if err != nil {
			return [][]byte{}, errors.New("format error")
		}
		result[i] = ret
		t += length
	}

	return result, nil
}
```

### 5. 命令行模式

一个可用的redis-cli自然是一个交互式的，用户输入指令然后输出返回值。在go中我们可以使用以下代码即可获得一个类似的交互式命令行

```go
func main() {
	// ....
	for {
		fmt.Printf("%s:%d>", host, port)

		bio := bufio.NewReader(os.Stdin)
		input, _, err := bio.ReadLine()
		if err != nil {
			log.Fatal(err)
		}
		fmt.Printf("%s\n", input)
	}
}
```
我们运行以上代码就可以实现

```sh
localhost:6379>set key liang
set key liang
localhost:6379>get key
get key
localhost:6379>
```

结合上我们的redis发送请求和解析请求即可完成整个redis-cli

```go
func main() {
    // ....
	for {
		fmt.Printf("%s:%d>", host, port)

		// 获取输入命令和参数
		bio := bufio.NewReader(os.Stdin)
		input, err := bio.ReadString('\n')
		if err != nil {
			log.Fatal(err)
		}
		fields := strings.Fields(input)

		// 编码发送请求
		req := MultiBulkMarshal(fields...)

		// 发送请求
		_, err = conn.Write([]byte(req))
		if err != nil {
			log.Fatal(err)
		}

		// 读取返回内容
		p := make([]byte, 1024)
		_, err = conn.Read(p)
		if err != nil {
			log.Fatal(err)
		}

		// 解析返回内容
		if p[0] == '*' {
			result, err := MultiUnMarsh(p)
		} else {
			result, _, err := SingleUnMarshal(p)
		}

    }
    // ....
}
```

### 6. 总结

到目前为止我们的cli程序已经全部完成，但其实还有很多不完美地方。但核心的redis协议解析已经完成，使用这个解析我们能完成任何的cli与服务器之间的交互

更详细的redis-cli实现可以参考我的github：[A Simaple redis cli - Rclient](https://github.com/liangwt/redis-cli)

也可以关注我的微博[@不会凉的凉凉](https://www.weibo.com/u/3010707603)与我交流