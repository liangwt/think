---

title: 窗口和iframe间的通讯postMessage
date: 2018/06/01 18:53:00
categories:
- 编程语言 / JavaScript
tags:
- postMessage
- Event
- HTML

---

#### 问题

1. 窗口间跨域数据传输
2. iframe与窗口间的跨域数据传输

html5引入的message的API可以更方便、有效、安全的解决这些难题。postMessage()方法允许来自不同源的脚本采用异步方式进行有限的通信，可以实现跨文本档、多窗口、跨域消息传递。

但postMessage()不能和服务端交换数据，只能在两个窗口（iframe）之间交换数据

<!-- more -->

#### 前提

postMessage是用于两个窗口（iframe）之间交换数据的，如果我们同时打开着百度和谷歌两个页面，是不是说这两者之间就可以通信了？No，no，no，事实并非如此，就算百度和谷歌俩页面有通信的意愿也不行。

两个窗口能通信的前提是:

1. 一个窗口以iframe的形式存在于另一个窗口
2. 或者一个窗口是从另一个窗口通过window.open()或者超链接的形式打开的（同样可以用window.opener获取源窗口)

换句话说，你要交换数据，必须能获取目标窗口(target window)的引用，不然两个窗口之间毫无联系，想通信也无能为力。

#### 使用方式

```js
otherWindow.postMessage(message, targetOrigin, [transfer]);
```
说明：

1. otherWindow是对接收方窗口的引用，一般可以是以下几种方式：

```js
window.frames[0].postMessage
document.getElementsByTagName('iframe')[0].contentWindow.postMessage
window.opener.postMessage
event.source.postMessage
window.open //返回的引用
```

2. message：顾名思义就是发送的数据内容，支持字符串、数字、json等几乎所有形式的数据

3. origin：字符串参数，指明目标窗口的源，协议+主机+端口号[+URL]，URL会被忽略，所以可以不写，这个参数是为了安全考虑，postMessage()方法只会将message传递给指定窗口，当然如果愿意也可以建参数设置为"*"，这样可以传递给任意窗口，如果要指定和当前窗口同源的话设置为"/"

#### 接受信息

接收方需要接受信息只需要监听message事件即可

```js
// 监听有没有数据发送过来
window.addEventListener('message', function(e) {
  console.log(e);
});
```

当然也可以使用onmessage，不过兼容性不好
```js
window.onmessage = function(e){
    console.log(e);
}
```

message Event的几个属性

1. data：顾名思义，是传递来的message

2. source：发送消息的window对象

    可以用于数据回传即`e.source.postmessage('get','*')`
    
3. origin：发送消息窗口的源（协议+主机+端口号）

    可以用于校验messgae是否来自允许域即
    ```js
    if(e.origin != "http://www.foo.com:80"){
        return false
    }
    ```
    也可用于回传到消息来源方
    ```js
    e.source.postmessage('get',e.origin)
    ```

#### 示例代码

1. window <-> iframe

```html
<!-- http://localhost:81/fish/index.html -->
<script type="text/javascript">
  // 页面加载完后才能获取dom节点（iframe）
  window.onload = function(){
    // 向目标源发送数据
    document.getElementsByTagName('iframe')[0].contentWindow.postMessage({"age":10}, 'http://localhost:8080');
  };

  // 监听有没有数据发送过来
  window.addEventListener('message', function(e) {
      console.log(e);
  });
</script>
<iframe src="http://localhost:8080/index.html"></iframe>
```

```html
<!-- http://localhost:8080/index.html -->
<script type="text/javascript">
  // 监听有没有数据发送过来
  window.addEventListener('message', function(e){
      // 判断数据发送方是否是可靠的地址
      if(e.origin !== 'http://localhost:81')
        return;
    // 打印数据格式
    console.log(e);
    // 回发数据
    e.source.postMessage('hello world', e.origin);
  }, false);
</script>
```

2. window <-> window

```html
<!-- http://localhost:81/fish/index.html -->
<script type="text/javascript">
  // 打开一个新的窗口
  var popup = window.open('http://localhost:8080/index.html');

  //新窗口必须加载完毕后才能收到messge事件，所以需要等待，也可设计成新窗口加载完毕后通知父窗口
  setTimeout(function() {
      // 当前窗口向目标源传数据
    popup.postMessage({"age":10}, 'http://localhost:8080');
  }, 1000);
</script>
```
```html
<!-- http://localhost:8080/index.html -->
<script type="text/javascript"> 
  // 设置监听，如果有数据传过来，则打印
  window.addEventListener('message', function(e) {
    console.log(e);
    console.log(e.source === window.opener);  // true
  });
</script>
```

