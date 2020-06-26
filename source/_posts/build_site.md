---

title: 建站踩坑指南
date: 2018/04/25 20:46:25
categories:
- linux
tags:
- node
- linux
- redis
toc: true

---


本站搭建在腾讯云实例上，使用了docker构建了node、hexo、redis、mysql、php-fpm实例

其中大部分容器镜像为手动构建，并使用了docker-compose进行了容器编排

本文记录在搭建站点过程中的坑与解决方案

本站docker环境git地址：https://gitee.com/liangwt_admin/docker_env
本站博文git地址：https://gitee.com/liangwt_admin/hexo_blog


<!--more-->

### git将空文件夹加入到版本控制

git只对文件进行版本控制，当一个文件夹为空或者 将文件夹 `/logs/*` 写入`.gitignore` 中，会导致这个文件夹并不会被纳入版本控制
但是为了保持文件结构我们需要保留空文件夹
所以可以在空文件夹下创建一个`.gitkeep` 或 `.keep` 文件，并在`.gitignore` 加入`!.gitkeep`
这样就会把空文件夹加入到git中

### 腾讯安全组策略

腾讯云控制台可以设置安全组策略，其中一个默认策略并没有加入6973（redis默认）端口

![](https://ws1.sinaimg.cn/large/b373c093ly1fqp53ilmsbj20t00pg76r.jpg)

即使没有开放对应端口，tcp的syn 请求依旧能够打入机器，但是并不能建立连接，推测原因为腾讯云安全组策略为虚拟包过滤防火墙

```linux

root@VM-0-10-ubuntu:/data# netstat -catnp | grep :6379
tcp6       0      0 :::6379                 :::*                    LISTEN      19806/docker-proxy
tcp        0      1 172.21.0.10:42518       140.143.163.206:6379    SYN_SENT    22480/telnet
tcp6       0      0 :::6379                 :::*                    LISTEN      19806/docker-proxy
tcp        0      1 172.21.0.10:42518       140.143.163.206:6379    SYN_SENT    22480/telnet
tcp6       0      0 :::6379                 :::*                    LISTEN      19806/docker-proxy
tcp        0      1 172.21.0.10:42518       140.143.163.206:6379    SYN_SENT    22480/telnet
tcp6       0      0 :::6379                 :::*                    LISTEN      19806/docker-proxy
tcp        0      1 172.21.0.10:42518       140.143.163.206:6379    SYN_SENT    22480/telnet
```

### netstats 只显示tcp6

```linux
root@VM-0-10-ubuntu:/data# netstat -anpt
Active Internet connections (servers and established)
Proto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name
tcp        0      0 0.0.0.0:22              0.0.0.0:*               LISTEN      981/sshd
tcp        0    344 172.21.0.10:22          218.30.113.39:61883     ESTABLISHED 29283/sshd: ubuntu
tcp6       0      0 :::6379                 :::*                    LISTEN      19806/docker-proxy
tcp6       0      0 :::80                   :::*                    LISTEN      19795/docker-proxy
tcp6       0      0 :::443                  :::*                    LISTEN      19742/docker-proxy
```

发现redis只监听了tcp6端口，最后发现如下结论：
netstat 只是很真实的显示监听的端口而已，但是需要注意 ipv6 实际上在 Linux 上也支持 ipv4。

参考 http://www.cnblogs.com/wlzjdm/p/8684202.html