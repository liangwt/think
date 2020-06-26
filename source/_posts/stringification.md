title: 字符串化中双重宏定义的用法

date: 2018/10/08 19:17:00

categories:
- BACKEND
tags:
- c
- macro
- stringification

---


### 字符串化运算符 (#)

使用# 你可以定义一个字符串常量的宏。当一个宏参数使用#开头，预处理器会把文本原有当内容当作是一个字符串常量替换。

例如：

```c
#define WARN_IF(EXP) \
do { if (EXP) \
     fprintf (stderr, "Warning: " #EXP "\n"); } \
while (0)

WARN_IF (x == 0);
==> do { if (x == 0)
    fprintf (stderr, "Warning: " "x == 0" "\n"); } while (0);
```
EXP在if中被按照普通的方式替换， 在fprintf中按照字符串的方式被替换，
但是，如果说我们
```c
#define x XXX
```
在这种情况下，if 条件中的x会被正确的展开。而fprintf中，因为使用字符串化符号，所以x依旧是"x==0"

所以最后结果会变成

```c
#define x XXX
#define WARN_IF(EXP) \
do { if (EXP) \
     fprintf (stderr, "Warning: " #EXP "\n"); } \
while (0)

WARN_IF (x == 0);
==> do { if (x == 0)
    fprintf (stderr, "Warning: " "x == 0" "\n"); } while (0);
    
==> do { if (XXX == 0)
    fprintf (stderr, "Warning: " "x == 0" "\n"); } while (0);

```

<!-- more -->

### 双重宏

如果你想字符串化一个宏的结果值，你必须定义双重宏

例如：

```c
#define xstr(s) str(s)
#define str(s) #s
#define foo 4
str (foo)
  ==> "foo"
  
xstr (foo)
  ==> xstr (4)
  ==> str (4)
  ==> "4"
```
上面例子中，第一个`str(foo)`因为是符合字符串化条件，所以foo的宏并没有被替换

第二个例子`xstr (foo)`由于不符合条件所以进行foo的宏被替换为了`4`而后`str(4)`被处理为"4"

### 转义

字符串其实并不是简单的在代码两边加上双引号，预处理器会对字符串中的反斜线(\)和引号（" 和 ')进行转义，使之成为一个有效的c语言字符串

例如：
```
#define x (p = 'foo\n')
#define y (p = "foo\n")
x
  ==> "p = \"foo\\n\"
y
  ==> "p = \'foo\n\'
```

### 空白

开头和结尾的空白都会被忽略
对于字符串中间的空白只会有一个
对于注释在字符串化之前都已经被空白替换，所以不会在字符串化的结果中出现

### 字符

在宏中没有办法实现字符
