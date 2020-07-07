title: 理解BFC特性
date: 2018/05/25 10:35:25
categories:
- FRONTEND
tags:
- BFC
- CSS
- HTML

---

在解释BFC之前，先说一下文档流。

我们常说的文档流其实分为定位流、浮动流和普通流三种。而普通流其实就是指BFC中的FC。FC是formatting context的首字母缩写，直译过来是格式化上下文，它是页面中的一块渲染区域，有一套渲染规则，决定了其子元素如何布局，以及和其他元素之间的关系和作用。

常见的FC有BFC、IFC，还有GFC和FFC。BFC是block formatting context，也就是块级格式化上下文，是用于布局块级盒子的一块渲染区域

<!--more-->

### 触发 BFC
只要元素满足下面任一条件即可触发 BFC 特性：

- body 根元素
- 浮动元素：float 除 none 以外的值
- 绝对定位元素：position (absolute、fixed)
- display 为 inline-block、table-cells、flex 
- overflow 除了 visible 以外的值 (hidden、auto、scroll)


### BFC 特性及应用

- #### 同一个 BFC 下外边距会发生折叠

- #### BFC 可以包含浮动的元素（清除浮动）
  

我相信大家经常会遇到一个容器里有浮动元素，但是这个容器的高度却是0的场景，如下图：

看下面的例子：

```HTML
<div class="container">
  <div>Sibling</div>
  <div>Sibling</div>
</div>  
```
```CSS
.container {
  background-color: green;
}
 
.container div {
  float: left;
  background-color: lightgreen;
  margin: 10px;
}
```
结果：

![image](https://cdn.showthink.cn/img/demo2-2.jpg)

在上边的情形中，container是不会有高度的，因为它包含了浮动元素。通常我们解决这个问题的办法是利用一个伪元素去实现clear fix，但是现在我们有了更好的解决办法，即利用BFC，因为它够容纳浮动元素的。

我们现在让container形成BFC规则，结果如下：

```css
.container {
  overflow: hidden; /* creates block formatting context */
  background-color: green;
}
 
.container div {
  float: left;
  background-color: lightgreen;
  margin: 10px;
}
```
结果：

![image](https://cdn.showthink.cn/img/demo2-3.jpg)

- #### BFC 可以阻止元素被浮动元素覆盖

### 参考链接

- [理解CSS中的BFC(块级可视化上下文)](https://www.jianshu.com/p/fc1d61dace7b)
- [深入理解BFC](http://www.cnblogs.com/xiaohuochai/p/5248536.html)
- [布局概念 关于CSS-BFC深入理解](https://juejin.im/post/5909db2fda2f60005d2093db)