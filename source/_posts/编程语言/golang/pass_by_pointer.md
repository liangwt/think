title: go函数值传递深入理解
date: 2018/07/01 23:00:00
categories:
- 编程语言 / Go
tags:
- golang
- function
- paramater
- pointer

---

#### 通过传递指针改变原有值的例子

```go
package main

import (
	"fmt"
)

type Person struct {
	name string
	age  int
}

func main() {
	A := Person{
		name: "liang",
		age:  18,
	}
	Handler(&A)
	fmt.Println(A)
	//{wen 18}
}

func Handler(p *Person) {
	p.name = "wen"
}

```

我们知道函数或者方法通过传递指针，可以改变传入变量的值

如上，通过把`A`的指针传入`Handler(p *Person)`中，我们把A的`name`改成了"wen"

但是看下面这个例子：

#### 通过传递指针不能改变原有值的例子

```go
package main

import (
	"fmt"
)

type Person struct {
	name string
	age  int
}

func main() {
	A := Person{
		name: "liang",
		age:  18,
	}
	Handler(&A)
	fmt.Println(A)
	//{liang 18}
}

func Handler(p *Person) {
	p = &Person{
		name: "wen",
		age:  19,
	}
}
```

我们再次把`A`的地址传入`Handler()`中，并为其赋了一个新的person值，结果很明显，A的值并没有被改写，依旧是原来的值

<!-- more -->

#### 原因：函数的值传递

在golang里函数或者方法的参数永远是值传递，这句话正确的理解应该是：
- 如果是普通类型的参数，那么传递就是普通参数的**副本**
- 如果是引用类型的参数，那么传递的是参数指针地址的**副本**

理解这个值传递的关键，就在上面加粗的**副本**两个字，对于指针参数也是如此

所以第一个例子中，我们传入参数A的地址，`Handler()` 的参数复制A的地址，获得了A地址的另一份拷贝，无论是复制的新的指针还是原有指针它们都指向了A

![](https://cdn.showthink.cn/img/b373c093ly1fsuqslqchwj20g8076t8o.jpg)

如图，很明显我们可以通过`p`来改写`A`的属性，因为`p` 和 `&A`指向同一个变量


而第二个例子中，我们将`Handler()`中对p指向了另外一个地址，所以只是对`p`赋了新值，并没有对`&A`产生影响

![](https://cdn.showthink.cn/img/b373c093ly1fsuqzewy3bj20g80dujrm.jpg)


#### 验证以上说法

我们来写代码验证下以上说法

```go
package main

import (
	"fmt"
)

type Person struct {
	name string
	age  int
}

func main() {
	A := Person{
		name: "liang",
		age:  18,
	}
	//0xc42000a080
	fmt.Printf("%p\n", &A)
	Handler(&A)
	//0xc42000a080
	fmt.Printf("%p\n", &A)
}

func Handler(p *Person) {
	//0xc42000a080
	fmt.Printf("%p\n", p)
	p = &Person{
		name: "wen",
		age:  19,
	}
	//0xc42000a0a0
	fmt.Printf("%p\n", p)
}
```

可以看出来`&A`地址`0xc42000a080` 在调用`Handler()`前后是没有变化对，`Handler()`中`p`变量最开始也是接收到这个`0xc42000a080`值，但是随后对赋值，让`p`有了新值，所以也就失去对原有变量对引用

#### 联想: commonJS中模块导出的exports

commonJS使用

```js
module.exports.foo = foo
```

是可以导出模块的，但是使用

```js
exports = foo
```

是不行的，原因其实是因为

```js
var module = { exports: {} };
var exports = module.exports;
```

`exports`变量其实也是一个对`module.exports`的引用，重新赋值会导致`exports`失去原有变量的引用

而模块最后return出去的其实`module.exports`,所以对`exports`新赋值是不会被导出去的

##### CommonJS 模块导出方式

```js
//module.js
var x = 5
var foo = function (value){
    return x + value
}

//以下等价
module.exports.x = x
module.exports.foo = foo

exports.x = x
exports.foo = foo
```

##### CommonJS 模块导入方式
```js
example = require("./module.js")
console.log(example.x) // 5
consile.log(example.foo(1)) // 6
```

##### 说明：

exports 是对module.exports的引用，即 exports=module.exports

module.exports初始的时候置为{},exports也指向这个空对象。

require方能看到的只有module.exports这个对象，看不到exports对象，所以使用 exports = foo 是导不出去导，因为此时exports 已经和module.exports 没有关系了

> https://www.zhihu.com/question/26621212






