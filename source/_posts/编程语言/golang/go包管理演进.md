---
title: go包管理演进
date: 2020-06-26 18:39:11
toc: true
categories:
- 编程语言 / Go
tags:
- golang
- package
---

## GOPATH

**项目代码路径**：**必须**放在`$GOPATH/src`

**go get下载路径：**`$GOPATH/src`

**go build搜索路径：**按照`import path`去搜索`package`

1. `$GOROOT/src`
2. `$GOPATH/src`

<!--more-->

---

## vendor

**项目代码路径**：**必须**放在`$GOPATH/src`

**go get下载路径：**`$GOPATH/src`

**go build搜索路径：**按照`import path`去搜索`package`

1. `$(pwd)/vendor`
2. `$GOROOT/src`
3. `$GOPATH/src`

> 注：因此可以给第三方包管理工具提供一种使用vendor的方式

---

## go mod
> Go 1.11 Modules
> https://github.com/golang/go/wiki/Modules

### module mode（推荐）

**项目代码路径**：任意

**条件：**如果要构建的源码目录不在以`GOPATH/src`为根的目录体系下，且包含`go.mod`文件(**两个条件缺一不可**)

> 注：在1.3版本往后，只要有`go.mod`文件就开启`module mode`，即使是在`GOPATH`路径下

**go.mod搜索路径：**当前目录、当前目录的父目录、父目录的父目录…等，所找到的第一个`go.mod`文件对应的`module`即为`main module`

**go get下载路径：**`$GOPATH/pkg/mod`

> go tool 默认下载module的地址是[https://proxy.golang.org](https://proxy.golang.org/)，并且会通过[https://sum.golang.org](https://sum.golang.org/)，校验下载模块的sum值
>
> - 如果你有私有代码，请配置`GOPRIVATE` 变量 (例如 `go env -w GOPRIVATE=*.corp.com,github.com/secret/repo`)，或者是更细粒度的`GONOPROXY` 或 `GONOSUMDB`  来支持上述操作。具体参考[documentation](https://golang.org/cmd/go/#hdr-Module_configuration_for_non_public_modules) 

**go build搜索路径：**

1. **仅**在此目录下`$GOPATH/pkg/mod`搜索，**不会**搜索`GOPATH`和`vendor`目录

**go build -mod=vendor搜索路径：**

1. **仅**在此目录下`vendor`目录搜索，**不会**搜索`GOPATH`和`$GOPATH/pkg/mod`

### GOPATH mode

**项目代码路径**：**必须**放在`$GOPATH/src`

**go get下载路径：**`$GOPATH/src`

**go build搜索路径：**按照`import path`去搜索`package`

1. `$(pwd)/vendor`
2. `$GOROOT/src`
3. `$GOPATH/src`