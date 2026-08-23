# Note 文章同步

Note 是文章正文的唯一来源，Think 中 `source/_posts/note/` 下的文章由同步程序生成，不应直接修改。

## 发布一篇 Note

在 Note 的 Markdown 文件顶部添加 Front Matter：

```yaml
---
publish: true
title: TLS 与 SSL 原理
date: 2026-08-23
categories:
- 网络
tags:
- TLS
- HTTPS
toc: true
summary: TLS/SSL 协议、密钥协商与数据加密原理。
cover: .assets/TLS 与 SSL 原理/封面.png
---
```

其中 `publish: true` 和 `date` 是发布必填字段，`title` 默认使用文件名，`categories` 默认使用 Note 中的目录层级。`summary`、`cover`、`tags` 和 `toc` 均可省略。

本地图片继续遵循 Note 的目录规范：

```text
Note/网络/TLS 与 SSL 原理.md
Note/网络/.assets/TLS 与 SSL 原理/封面.png
```

同步时图片会复制到 Markdown 旁边的同名资源目录，正文和封面中的相对路径会自动改写：

```text
Think/source/_posts/note/网络/
├── TLS 与 SSL 原理.md
└── TLS 与 SSL 原理/
    └── 封面.png
```

## 同步命令

两个仓库同处一个父目录时执行：

```bash
npm run sync:notes
```

Note 位于其他目录时执行：

```bash
npm run sync:notes -- --note-dir /absolute/path/to/Note
```

预览变更但不写文件：

```bash
npm run sync:notes -- --dry-run
```

在 CI 中检查是否已经同步；发现差异时返回失败：

```bash
npm run sync:notes:check
```

同步完成后正常构建：

```bash
npm run build
```

## 删除与冲突保护

- 将 `publish` 改为 `false` 或删除源文件后，下次同步会删除对应的生成文章和图片
- 同步只管理清单中记录的文件，不会删除 Think 原有的手写文章
- 如果生成文章或图片在 Think 中被直接修改，同步会停止并提示冲突
- 确认需要用 Note 内容覆盖 Think 修改时，可以显式传入 `--force`
