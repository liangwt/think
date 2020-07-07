---

title: 几种对象创建方式和原型链
date: 2018/06/03 21:00:00
toc: true
categories:
- 编程语言 / JavaScript
tags:
- javascript
- object
- prototype

---

除了直接用对象字面量{ ... }创建一个对象外，还可以使用new 构造函数funciton name(){...} 来创建对象

注意，如果不写new，这就是一个普通函数，它返回undefined。但是，如果写了new，它就变成了一个构造函数，它绑定的this指向新创建的对象，并默认返回this，也就是说，不需要在最后写return this


#### 工厂模式
```js
function createPerson1(name, job) {
    var o = new Object()
    o.name = name
    o.job = job
    o.sayName = function () {
        console.log(this.name)
    }
    return o
}
var person1 = new createPerson1('Jiang', 'student')
var person2 = new createPerson1('X', 'Doctor')
```

<!--more-->


##### 缺点:

不能知道一个对象的类型

```js
console.log(typeof person1) // object
```

#### 构造函数模式

```js
function person2(name, job) {
    this.name = name
    this.job = job
    this.sayName = function () {
        console.log(this.name)
    }
}

var person3 = new person2('Jiang', 'student')
var person4 = new person2('X', 'doctor')
```

##### 缺点

Jiang和X各自的name不同，这是对的，否则我们无法区分谁是谁了。

Jiang和X各自的sayName是一个函数，但它们是两个不同的函数，虽然函数名称和代码都是相同的！

使用构造函数创建对象，每个方法都要在每个实例上重新创建一次，即sayName()在每一个对象中都存在


#### 原型模式

##### 原型链背景知识

![image](https://cdn.showthink.cn/img/1.png)

因为JavaScript对每个创建的对象都会设置一个原型，指向它的原型对象。

```js
person1.prototype-->Person.prototype-->Object.prototype-->null
```

当我们用obj.xxx访问一个对象的属性时，JavaScript引擎先在当前对象上查找该属性，如果没有找到，就到其原型对象上找，如果还没有找到，就一直上溯到Object.prototype对象，最后，如果还没有找到，就只能返回undefined。

```js
function Person3() {

}
Person3.prototype.name = 'Jiang'
Person3.prototype.job = 'student'
person3.prototype.sayName = function () {
    console.log(this.name)
}
person5 = new Person3()
```

##### 更简单的原型模式写法

```js
function Person4() {

}
Person4.prototype = {
    name: 'Jiang',
    job: 'student',
    sayName: function () {
        console.log(this.name)
    }
}
person6 = new Person4()
```

##### 优化

- Person.prototypeconstructor属性

Person.prototype 等于了一个对象字面量所以会导致.constructor不再指向Person4

如果需要这个属性可以手动添加

```js
Person4.prototype = {
    constructor: Person4,
    name: 'Jiang',
    job: 'student',
    sayName: function () {
        console.log(this.name)
    }
}
```
- Person.prototypeconstructor枚举性

此时的constuctor属性是可以枚举的，默认的constructor是不可以枚举的，所以也可以单独设置

```js
Object.defineProperty(Person4.prototype,'constructor', {
    enumerable: false,
    value:Person4
})

```
sayName()只在第一次初始化的时候创建，之后就不会被创建了


##### 原形链缺点：

- 原型的所有属性都是被所有实例所共享的

对于不同实例函数确实是需要共享的，但是对于基本属性是不需要共享的

一个实例改变某个饮用类型的属性值，其他实例也会被改变

#### 组合使用构造函数模式和原型模式

最广泛使用，使用此模式可以让每个实例都会有自己的一份实例属性副本，但同时又共享着对方法的引用

```js
function Person5(name, job){
    //属性
    this.name = name
    this.job = job
}
Person5.prototype.sayName = function(){
    console.log(this.name)
}

var person9 = new Person5('Jiang','student')
var person10 = new Person5('X','doctor')

```

#### 动态原型模式

通过在初始化的时候判断某方法是否存在来决定是否有添加到对象原型中

```js
function Person6(name, job){
    this.name = name
    this.job = job
    
    if(this.sayName !== 'function'){
        Person6.prototype.sayName = function(){
            console.log(this.name)
        }
    }
}

var person11 = new Person6('Jiang', 'student')
var person12 = new Person6('x', 'doctor')
```

#### 参考

- [JavaScript创建对象的七种方式](https://xxxgitone.github.io/2017/06/10/JavaScript%E5%88%9B%E5%BB%BA%E5%AF%B9%E8%B1%A1%E7%9A%84%E4%B8%83%E7%A7%8D%E6%96%B9%E5%BC%8F/)
- [一篇文章看懂_proto_和prototype的关系及区别](https://xxxgitone.github.io/2017/06/08/%E4%B8%80%E7%AF%87%E6%96%87%E7%AB%A0%E7%9C%8B%E6%87%82-proto-%E5%92%8Cprototype%E7%9A%84%E5%85%B3%E7%B3%BB%E5%8F%8A%E5%8C%BA%E5%88%AB/)
- [创建对象](https://www.liaoxuefeng.com/wiki/001434446689867b27157e896e74d51a89c25cc8b43bdb3000/0014344997235247b53be560ab041a7b10360a567422a78000)

