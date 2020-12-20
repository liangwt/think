---
title: intrusive list 
toc: true
date: 2020-12-20 15:13:54
categories:
- 数据结构与算法 / 数据结构
tags:
- 链表
- intrusive list 
- 数据结构
---

## 普通链表

正常的链表，节点包含存储的数据

```c
struct normal_list_node_t
{
   struct normal_list_node_t* pre;
   struct normal_list_node_t* nxt;
   void* val;
};
```

## intrusive list

所谓intrusive list，就是指不像上面说的那样将链表节点包在数据外面，而是将链表节点包在数据里面。

```c
struct intrusive_list_node_t
{
   struct intrusive_list_node_t* pre;
   struct intrusive_list_node_t* nxt;
};

typedef struct _data{
    int a;
    int b;
    struct intrusive_list_node_t node;
    int c;
} Data;
```



![普通链表](https://cdn.showthink.cn/img/list.drawio.png)

<!--more-->

## 由链表节点获取数据

对于**普通链表**，由链表节点获取数据很简单

```c
int main(){
    int* val = malloc(sizeof(int));
    *val = 1;
    
    // 普通节点获取数据
    struct normal_list_node_t* node =  malloc(sizeof(struct normal_list_node_t));
    node->val = val;
    assert(*val == *(int*)node->val);
}
```

对于**intrusive list**，已知链表节点，获取数据可以通过如下计算

```c
#define GET_ENTRY(ptr, type, member)\
    ((type *)((char *)(ptr)-(unsigned long)(&((type *)0)->member)))

int main(){
    Data* data  = (Data*)malloc(sizeof(Data));
    // Data的每个field是向上增长的
    printf("data : %p\n", data);
    printf("data->a : %p\n", &data->a);
    printf("data->p : %p\n", &data->b);

    assert(data == GET_ENTRY(&data->node, Data, node));
    
    return 0;
}
```

**参数：**

- ptr: `intrusive_list_node_t`的地址
- type: 包含这个`intrusive_list_node_t`的类型，对应上面的例子，就是`Data`
- member：这个`intrusive_list_node_t`类型变量在`Data`中的变量名，需要这个得到改变量的offset

**解释：**

- `(&((type *)0)->member)`：如果有个type类型的变量，它的地址是0，那type类型中的member变量的地址是多少，其实就是这个member变量距离所属的type类型变量的偏移量。

	> Data的每个field是向上增长的

- `member` 变量的地址（ptr），用ptr的地址减去ptr的偏移量，就得到了ptr所在的type变量的地址了，然后就可以获取type变量上的数据了

  

![image-20201220005304826](https://cdn.showthink.cn/img/intrusive_list.drawio.png)

## 附录

```c
#include <stdlib.h>
#include <stdio.h>
#include <assert.h>

#define GET_ENTRY(ptr, type, member)\
    ((type *)((char *)(ptr)-(unsigned long)(&((type *)0)->member)))

struct normal_list_node_t
{
   struct normal_list_node_t* pre;
   struct normal_list_node_t* nxt;
   void* val;
};

struct intrusive_list_node_t
{
   struct intrusive_list_node_t* pre;
   struct intrusive_list_node_t* nxt;
};

typedef struct _data{
    int a;
    int b;
    struct intrusive_list_node_t node;
    int c;
} Data;

int main(){
    int* val = malloc(sizeof(int));
    *val = 1;

    // 普通节点获取数据
    struct normal_list_node_t* node =  malloc(sizeof(struct normal_list_node_t));
    node->val = val;
    assert(*val == *(int*)node->val);

    Data* data  = (Data*)malloc(sizeof(Data));
    // Data的每个field是向上增长的
    printf("data : %p\n", data);
    printf("data->a : %p\n", &data->a);
    printf("data->p : %p\n", &data->b);

    assert(data == GET_ENTRY(&data->node, Data, node));
    
    return 0;
}
```

## 参考

- [Intrusive list](https://blog.goquxiao.com/posts/2013/07/06/intrusive-list/)