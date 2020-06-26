---

title: Shell扩展(Shell Expansions)-参数扩展(Shell Parameter Expansion)
date: 2019/05/13 16:52:00
toc: true
categories:
- BACKEND
tags:
- shell
- parameter expansion
- php

---

## 从一个脚本开始

在php-docker中可以发现一个`docker-php-entrypoint.sh`脚本，内容如下

```sh
#!/bin/sh
set -e

# first arg is `-f` or `--some-option`
if [ "${1#-}" != "$1" ]; then
	set -- php-fpm "$@"
fi

exec "$@"
```

简单解释一下这个脚本涉及到的几个知识点，并引出本文要介绍的Shell Parameter Expansion概念

<!-- more -->

### 特殊变量$@

`$@` 属于shell脚本中几个特殊参数中的一个，代表了传递给脚本的所有参数，同时还有其他一些特殊变量可以参考文档[Special Parameters](https://tiswww.case.edu/php/chet/bash/bashref.html#Special-Parameters)

我这里列举如下

变量  | 含义 
---|---
$0 | 当前脚本的文件名
$n | 传递给脚本或函数的参数。n 是一个数字，表示第几个参数。例如，第一个参数是$1，第二个参数是$2。
$# | 传递给脚本或函数的参数个数。
$* | 传递给脚本或函数的所有参数："$1", "$2", "$3"， 每个变量是独立的。
$@ | 传递给脚本或函数的所有参数："$1 $2 $3"，代表
$? | 上个命令的退出状态，或函数的返回值。
$$ | 当前Shell进程ID。对于 Shell 脚本，就是这些脚本所在的进程ID。

#### 注：`$*` 和 `$@` 的区别

`$*` 和 `$@` 都表示传递给函数或脚本的所有参数，不被双引号(" ")包含时，都以"$1" "$2" … "$n" 的形式输出所有参数。

但是当它们被双引号(" ")包含时
- `"$*"` 会将所有的参数作为一个整体，以"$1 $2 … $n"的形式输出所有参数；
- `"$@"` 会将各个参数分开，以"$1" "$2" … "$n" 的形式输出所有参数。

### shell，exec与source

#### sh

使用`$ sh script.sh`执行脚本时，当前shell是父进程，生成一个子shell进程，在子shell中执行脚本。脚本执行完毕，退出子shell，回到当前shell。

`$ ./script.sh`与`$ sh script.sh`等效。

#### source

使用`$ source script.sh`方式，在当前上下文中执行脚本，不会生成新的进程。脚本执行完毕，回到当前shell。

`$ . script.sh`与`$ source script.sh`等效。

#### exec方式

使用exec command方式，会用command进程替换当前shell进程，并且保持PID不变。执行完毕，直接退出，不回到之前的shell环境。

### set

set 属于shell内置命令，参考文档[#Modifying-Shell-Behavior](https://tiswww.case.edu/php/chet/bash/bashref.html#Modifying-Shell-Behavior)

当单独执行set命令时会显示所有的环境变量和 Shell 函数

直接使用`set`+prams 可以为当前环境设置参数,例如

```
$ set a b c
$ echo $1
a
$ echo $2
b
$ echo $3
c
```

#### set -e

在"set -e"之后出现的代码，一旦出现了返回值非零，整个脚本就会立即退出，用于保证代码安全性

#### set --

其实`--`是一个单独的shell特性，和set无关，它代表了一个命令的选项（options）已经结束，后面的都已经是这个命令的参数了，例如：

```
grep -- -v file
```

如果你想搜索file中的字符串'-v'，直接`grep '-v' file`或是其他方法都是导致`-v`被识别为grep的选项，当加入`--`代表选项已经没有了，-v被理解为第一个参数，file被理解为第二个参数，于是就可以在file搜索'-v'了

对于`set --` 也是一样`--`标志着set的选项已经结束，后面的都是set的参数了。

为什么要这么写呢？很明显是为了防止set后面设置的变量里含有`-`导致被解释为set自身的选项，如`set -- -e`这种情况

### 结论

所以最开始的`set -- php-fpm "$@"`就可以解释为：把当前环境的参数设置成 `php-fpm $@` 即 `$@ = php-fpm $@`

对于那句`if [ "${1#-}" != "$1" ]`我们在下面展开讲解，根据注释我们可以知道它判断的是：传入这个脚本的第一个参数是不是`-f` or `--some-option`这种类型

所以总结一下：

当我们`sh docker-php-entrypoint.sh -F`即直接在脚本后面使用`-`加参数时，实际执行的是`php-fpm -F`

当我们`sh docker-php-entrypoint.sh ls -a`即直接在脚本后面直接执行命令时，实际执行的就是传入的命令`ls -a`

下面进入本文的主题

## 参数扩展(Shell Parameter Expansion)

在shell中可以使用花括号`${}`包裹参数来防止紧跟在参数后面的字符串被当作参数变量名的一部分，所以最基本的参数展开就是`${parameter}`。

### 间接参数扩展${!parameter}

其中引用的参数并不是parameter而是parameter的实际的值

```
parameter="var"
var="hello"
echo ${!parameter}

hello
```

### 空参数处理

下面的几种形式如`${parameter:-word}`是判断parameter为unset**或者**parameter=NULL来执行后续的扩展操作，即`(!isSet(parameter) || parameter==NULL)`

当忽略冒号后的结果`${parameter:-}` ,判断parameter存在**且**不为NULL，即`(isSet(parameter) && parameter != NULL)`

当忽略冒号`${parameter-word}`则只判断parameter是否存在，也就是parameter可以为NULL，即`isSet(parameter)`


- ${parameter:-word}

当parameter未设置或者为空则替换成word

```sh
set a b 

echo ${3:-word}   # word
echo ${1:-word}   # a

echo ${par:-word} # word
par=c
echo ${par:-word} # c
```

- ${parameter:=word}

同上。也就是给parameter一个默认参数，所以位置参数和特殊参数不能以这种方式分配。即不能${3:=world}

```sh
set a b 

echo ${3:=word}   # -bash: $3: cannot assign in this way
echo ${1:=word}   # a

echo ${par:=word} # word
par=c
echo ${par:=word} # c
```

- ${parameter:?word}

当变量 parameter 未设置或为空，shell 也是可交互时，进行报错并且退出。如果 shell 不可交互，则发生变量替换。

```
set a b 

echo ${3:?word}   # -bash: 3: word
echo $?           # 1 说明错误
echo ${1:?word}   # a

echo ${par:?word} # -bash: par: word
par=c
echo ${par:?word} # c
```

- ${parameter:+word}

如果 parameter 为空或未设置，那么就什么都不做。不然使用 word 进行替换。

```
set a b 

echo ${3:+word}   # 空
echo ${1:+word}   # word

echo ${par:+word} # 空
par=c
echo ${par:+word} # word
```

### 变量切片

- ${parameter:offset}
- ${parameter:offset:length}

和大部分编程语言字符串切片一样，offset代表偏移值，length代表字符长度，需要注意的有以下几点

1. **起始位置为0**，截取的字符串包含第一个
2. 当不指定length时，会截取到字符串结尾

```sh
string=01234567890abcdefgh
echo ${string: 1}           # 1234567890abcdefgh
echo ${string: 1: 2}        # 12
```

3. 当offset小于0时，代表从尾部开始计算偏移值，**开始值为-1**，同时冒号和offset之间至少有**一个空格**避免歧义

```sh
string=01234567890abcdefgh
echo ${string: -2}         # gh
echo ${string:-2}          # 01234567890abcdefgh 没有空格被解释成了:-
echo ${string: -3:2}       # fg
```

4. 当length小于0时，代表的从尾部开始计算的偏移值而不是字符长度，所以表达式拓展为offset到length直接的字符，注意此时是**不包括**length这个字符的。

```sh
string=01234567890abcdefgh
echo ${string: -7:-2}      # bcdef
```

5. 如果参数为@，结果是位置参数的偏移值加长度，注意此时**起始计数为1**(注意和上面区分)，如果offset为负值，则代表从尾部计数，length不能为负数

```sh
string=01234567890abcdefgh
set -- 1 2 3 4 5 6 7 8 9 0 a b c d e f g h
echo ${string:7}          # 890abcdefgh
echo ${@:7}               # 7 8 9 0 a b c d e f g h 注意和上面的区别

echo ${@: 0}              # 1 2 3 4 5 6 7 8 9 0 a b c d e f g h
echo ${@: 1}              # 1 2 3 4 5 6 7 8 9 0 a b c d e f g h 和上面结果一样

echo ${string: -7}        # bcdefgh
echo ${@: -7}             # b c d e f g h

echo ${@:7:-2}            # bash: -2: substring expression < 0
```

6. 如果参数为下标是`@`或者`*`的数组，表达式被扩展为从${parameter[offset]}往后length的长度的数组。负数的offset代表从尾部开始计数。length不能为负数

```sh
array=(0 1 2 3 4 5 6 7 8 9 0 a b c d e f g h)
echo ${array[@]:7}        # 7 8 9 0 a b c d e f g h
echo ${array[@]:7:2}      # 7 8

echo ${array[@]: -7:2}    # b c
echo ${array[@]: -7:-2}   # bash: -2: substring expression < 0
```

#### 总结：

除了位置参数是按1开始从头计算偏移值，其他都是按0开始计算偏移值的，从尾部都是按-1开始计算偏移值的

### 参数查找

- ${!prefix*}
- ${!prefix@}

1. shell将其展为所有以prefix开头为的变量。需要注意的是，当表达式被双引号包裹时，@会扩展成独立的几个变量，而*则会扩展成变量组合而成的字符串

```sh
var1=abc
var2=def

$ for v in ${!var@};do echo $v;done; 
var1
var2

$ for v in ${!var*};do echo $v;done;
var1
var2

# 以上两种情况没有区别

for v in "${!var*}";do echo $v;done;
var1 var2

for v in "${!var@}";do echo $v;done;
var1
var2

# @的被拓展成了两个变量
```

- ${!name[@]}
- ${!name[*]}

1. 如果name是一个数组，表达式会被扩展为数组的index(键)

```sh
arr=(a b c d e f g h)
echo ${!arr[@]}      # 0 1 2 3 4 5 6 7
```

2. 如果name不是数组，当name已经被设置的时候，表达式被拓展为0，未被设置时被拓展为null

```sh
echo ${!string[*]}  # 为空

string=01234567890abcdefgh
echo ${!string[@]}  # 0
```

3. 在被双引号包裹的时候，@的表现和上面一样。会将变量拓展成独立的几个变量

```sh
$ arr=(a b c d e f g h)

$ for i in  "${!arr[*]}";do echo $i; done;
0 1 2 3 4 5 6 7

$ for i in  "${!arr[@]}";do echo $i; done;
0
1
2
3
4
5
6
7

```

### 计算字符串的长度

- `{%raw%} ${#parameter} {%endraw%} `

如果parameter是字符串，表达式扩展为字符串的长度

如果parameter是*或者@，表达式扩展为参数的个数

如果parameter是一个数组名，并且下标为*或者@，表达式扩展为数组的元素个数
 
```sh
set a b
echo ${#@}   # 2

echo ${#1}   # 1

par=c
echo ${#par} # 1

arr=(1 2 3)
echo ${#arr[@]} # 3
```

### 参数删除

- ${parameter#word}
- ${parameter##word}

若变量内容从**头**开始的数据符合“关键字”，则将符合的最短(使用#)或者最长(使用##)数据删除

1. 其中word是可以使用sh中的[模式匹配](https://tiswww.case.edu/php/chet/bash/bashref.html#Pattern-Matching)，如`*`、`?`等

```sh
set -- ab-cd-ef ef-gh-ij

echo ${1#-}     # ab-cd-ef 只会从头部开始匹配，开头没有-所以就不会匹配上

echo ${1#*-}    # cd-ef
echo ${1##*-}   # ef   ##会匹配最长的数据
```

2. 如果parameter是@或者*，则会对位置参数的每一个进行配合和删除操作，最后的结果是改变之后的参数列表

```sh
set -- ab-cd-ef ef-gh-ij

echo ${@#*-}   # cd-ef gh-ij
echo ${@##*-}  # ef ij
```

3. 如果parameter是一个数组名，并且下标为*或者@，则匹配和删除的操作会应用到每一个数组元素中，最后的结果是改变之后的数组列表

```sh
arr=(--a --b --c)
echo ${arr[@]#-}    # -a -b -c
```

- ${parameter%word}
- ${parameter%%word}

整体逻辑和上面的`${parameter#word}`、`${parameter##word}`差别不大，只是这两者是从**尾**开始匹配关键字

```sh
set -- abcd-- efgh--
echo ${1%-}         # abcd-
echo ${1%%-}        # abcd-
echo ${1%-?}        # abcd 

echo ${@%-}         # abcd- efgh-

arr=(a-- b-- c--)
echo ${arr[@]%-}    # a- b- c-
```

字符移除可以实现一些很常见的操作：

1. 获取文件名，文件后缀

```sh
FILENAME=linux_bash.sh
echo ${FILENAME%.*}    # linux_bash
echo ${FILENAME##*.}   # sh
```

2. 获取文件路径，或者获取文件名

```sh
FILENAME=/home/somebody/linux_bash.sh

echo ${FILENAME##*/}   # linux_bash.sh
echo ${FILENAME%/*}    # /home/somebody
```

3. 如上面介绍的`docker-php-entrypoint.sh`，判断某字符串是否以某字符开头

```sh
$ OPT='-option'

$ if [ ${OPT#-} != ${OPT} ];
> then
>     echo "start with -"
> else
>     echo "not start with -"
> fi

start with -
```

### 参数替换

- ${parameter/pattern/string}

将parameter中出现的第一个pattern替换为string。

其中：

1. pattern可以使用`*`、`?`、`[]`等通配符
```sh
string=abceddabceddabcedd

echo ${string/d?a/f}  # abcefbceddabcedd 只替换了第一个dda
echo ${string/d*a/f}  # abcefbcedd       替换了ddabcedda
```

2. 如果pattern使用`/`开头, 将会用string替换所有符合的匹配项

```sh
string=abceddabceddabcedd

echo ${string//d?a/f}  # abcefbcefbcedd 第二个dda也被替换成了f
```

3. 如果pattern使用`#`开头, 将会用string替换开头的匹配项，这个就是默认的表现 

4. 如果pattern使用`%`开头, 将会用sting替换结尾处的一个匹配项

```sh
string=abceddabceddabcedd

echo ${string/%d?a/f}  # abceddabceddabcedd 注意此时并未匹配到最后一个dda，原因未知

echo ${string/%dd/f}   # abceddabceddabcef 替换了尾部的dd
```

5. 如果string是空，那么匹配项会被删除，并忽略pattern后面的`/`

```sh
string=abceddabceddabcedd
echo ${string/dd/}    # abceabceddabcedd 删除了第一个dd
```
6. 如果通过[Shopt Builtin](https://tiswww.case.edu/php/chet/bash/bashref.html#The-Shopt-Builtin)开启了大小写不敏感，那么则可以按照忽略大小写来匹配

7. 如果参数是@或者*，将会对每一个位置参数进行匹配替换操作

```sh
set -- abc abd abe
echo ${@/a/f}          # fbc fbd fbe
```

8. 如果参数是数组且以@或者*作为参数，则对数组每一个元素进行匹配替换操作

```sh
arr=(abc abd abe)
echo ${arr[@]/a/f}     # fbc fbd fbe
```

### 大小写修改

- ${parameter^pattern}
- ${parameter^^pattern}
- ${parameter,pattern}
- ${parameter,,pattern}

注：此操作仅适用于bash4.0往上版本

这些拓展用于修改字符串中的大小写。pattern表示的是匹配的模式，对于能匹配项会进行大小写转换(此处表示不理解)

1. 小写转大写: `^`会把开头的小写字母转换成大写，`^^`会转换所有小写成大写

```sh
par='abc'

echo ${par^}   # Abc
echo ${par^^}  # ABC
```

2. 大写转小写: `,`会把开头的大写转换成小写，`,,`会把所以大写转换成小写

```sh
par='ABC'

echo ${par,}   # aBC
echo ${par,,}  # abc
```

3. 参数是@或者*，会对每一个位置参数进行转换

```sh
set -- ABC DEF HIJ
echo ${@,}          # aBC dEF hIJ
echo ${@,,}         # abc def hij
```

4. 对于下标是@或者*的数组，大小写转换会应用于每一个数组元素

```sh
arr=(ABC DEF HIJ)

echo ${arr[@],}     # aBC dEF hIJ
echo ${arr[@],,}    # abc def hij
```

### 变量操作

- ${parameter@operator}

注：此操作仅适用于bash4.0往上版本

此拓展根据操作符(operator)执行参数转换或者，操作符如下

- Q

将字符串使用引号包裹

```sh
par='abc def'
echo ${par@Q}   # 'abc def'
```

- E

对于使用反斜线`\`后的字符一律按转义处理

```bash
# 对于双引号包裹的字符串
par="abc\"u"

echo ${par}    # abc"u 按照转义解释
echo ${par@E}  # abc"u 按照转义解释

# 对于双引号包裹的字符串
par="abc\'u"

echo ${par}   # abc\'u 此时单引号不需要转义，所以展示了\
echo ${par@E} # abc'u  E操作，继续按照转义来解释了\

```

- P

如果parameter含有[prompt string](https://tiswww.case.edu/php/chet/bash/bashref.html#Controlling-the-Prompt)时，按照prompt解释（默认按照字符串解释）

```sh
par="\@-abcd-\u"

echo ${par}    # \@-abcd-\u
echo ${par@P}  # 05:09 AM-abcd-I have no name!
```

- A

拓展成参数赋值的语句

```sh
a=2
par=$a+1

echo ${par}   # 2+1
echo ${par@A} # par='2+1' 此时$a已经被解释成实际值了
```

- a

由参数属性值组成的字符串

- 对于`@`和`*`，此操作会对每一个位置参数进行处理

- 对于下标为`@`或`*`的数组，此操作会对每一个数组元素进行处理

### 参考：

- [Bash Reference Manual#Shell-Expansions](https://tiswww.case.edu/php/chet/bash/bashref.html#Shell-Expansions)
- [shell，exec，source执行脚本的区别](https://www.jianshu.com/p/dd7956aec097)
- [whats-set-progname-means-in-shell-script](https://stackoverflow.com/questions/20088290/whats-set-progname-means-in-shell-script)
- [Shell 中的命令替换及参数扩展](https://linux.cn/article-9163-1.html)