---

title: commonJS 中的模块导出与导入
date: 2018/05/07 14:00:00
toc: true
categories:
- 编程语言 / JavaScript
tags:
- node
- javascript
- commonJS

---

### 模块导出方式

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

### 模块导入方式
```js
example = require("./module.js")
console.log(example.x) // 5
consile.log(example.foo(1)) // 6
```

<!--more-->


### 说明：

exports 是对module.exports的引用，即 exports=module.exports

module.exports初始的时候置为{},exports也指向这个空对象。

require方能看到的只有module.exports这个对象，看不到exports对象，所以使用 exports = foo 是导不出去导，因为此时exports 已经和module.exports 没有关系了

> https://www.zhihu.com/question/26621212


