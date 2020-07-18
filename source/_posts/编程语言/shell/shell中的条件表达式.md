---
title: shell中的条件表达式
toc: true
date: 2020-07-18 18:47:13
categories:
- 编程语言 / shell
tags:
- shell
- bash
- if
---

头一次看到使用`[[ ]]` 作为条件判断的语法，查了下资料发现原来是`bash`针对字符串判断的拓展语法，当然并不是所有shell都支持的。

<!-- more -->

## if 语法

**if**

```bash
if condition
then
    command1 
    command2
    ...
    commandN 
fi
```

**if else**

```
if condition
then
    command1 
    command2
    ...
    commandN
else
    command
fi
```

**if else-if else**

```
if condition1
then
    command1
elif condition2 
then 
    command2
else
    commandN
fi
```

**单行**

```
if condition1; then command1; fi
```

## [ ] 方括号

bash 的内部命令，`[`和`test`是等同的。如果我们不用绝对路径指明，通常我们用的都是bash自带的命令。if/test结构中的左中括号是调用test的命令标识，右中括号是关闭条件判断的。这个命令把它的参数作为比较表达式或者作为文件测试，并且根据比较的结果来返回一个退出状态码。if/test结构中 并不是必须右中括号，但是新版的Bash中要求必须这样。

**一些注意事项**

- `[ ]`两个符号左右都要有空格分隔
- 内部操作符与操作变量之间要有空格：如 `[  "a"  =  "b"  ]`
- 字符串比较中，可以使用`==` `!=` `>` `<` 。 `>` `<` 需要写成`\>` `\<` 进行转义
- 正数比较中，只能使用`-eq`，`-gt`这种形式

- `[ ]` 中字符串或者`${}`变量尽量使用"" 双引号扩住，避免值未定义引用而出错的好办法

- `[ ]` 中可以使用 `–a` `–o` 进行逻辑运算

## [[ ]] 双方括号

`[[`是 bash 程序语言的关键字。并不是一个命令，`[[ ]]` 结构比`[ ]`结构更加通用。在`[[`和`]]`之间所有的字符都不会发生文件名扩展或者单词分割，但是会发生参数扩展、命令替换、引号移除。如果是` -f`这种的条件表达式不要加引号

使用`[[ … ]]`条件判断结构，而不是`[ … ]`，能够防止脚本中的许多逻辑错误。比如，`&&`、`||`、`<`和`>` 操作符能够正常存在于`[[ ]]`条件判断结构中，但是如果出现在`[ ]`结构中的话，会报错。

支持字符串的模式匹配，使用`=~`操作符时甚至支持shell的正则表达式。字符串比较时可以把右边的作为一个模式，而不仅仅是一个字符串，比如`[[ hello == hell? ]]`，结果为真。`[[ ]]` 中匹配字符串或通配符，不需要引号。

`bash`把双中括号中的表达式看作一个单独的元素，并返回一个退出状态码。

按优先级可以搭配如下表达式

```bash
( expression )             // 返回表达式的值
! expression               // 取返
expression1 && expression2 // 与表达式
expression1 || expression2 // 或表达式
```

**一些注意事项**

- `[[ ]]`两个符号左右都要有空格分隔

- 内部操作符与操作变量之间要有空格：如 `[[  "a" =  "b"  ]]`

- 字符串比较中，可以直接使用 `> <` 无需转义

- `[[ ]]` 中字符串或者`${}`变量尽量加入引号，如未使用`""` 双引号扩住的话，会进行模式和元字符匹配

**示例**

```bash
if [[ -f ${file} ]]; then
    cluster=`cat ${file}`
    if [[ ${cluster} == "hne-v" ]]; then
        conf="conf/app-hne.toml"
    elif [[ ${cluster} == "hnb-pre-v" ]]; then
        conf="conf/app-hnb-pre-v.toml"
    fi
fi
```
