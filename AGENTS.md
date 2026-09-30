# Agent 项目说明

## 从 Note 同步发布文章

`../Note` 是从 Note 仓库发布文章时的唯一内容来源。Think 中 `source/_posts/note/` 下的文章及 `.note-sync-manifest.json` 中对应的记录均为自动生成内容，不要直接修改。

发布或更新 Note 文章时，按照以下流程操作：

1. 在 Note 仓库中编辑 Markdown 源文件。
2. 在文章顶部添加 YAML Front Matter，其中 `publish: true` 和固定的 `date` 为必填项。`title` 默认使用文件名，`categories` 默认使用文章在 Note 中的目录层级；`summary`、`cover`、`tags` 和 `toc` 可以省略。
3. 本地图片等文章资源按照以下结构存放在文章旁边：

   ```text
   Note/<分类>/<文章>.md
   Note/<分类>/.assets/<文章>/<资源文件>
   ```

   在 Front Matter 或 Markdown 中使用 `.assets/<文章>/<资源文件>` 引用资源。同步脚本会将资源复制到生成文章旁边，并自动改写引用路径。
4. 在 Think 仓库根目录执行同步：

   ```bash
   npm run sync:notes
   ```

   默认从同级目录中的 `../Note` 读取文章。如果 Note 位于其他位置，执行：

   ```bash
   npm run sync:notes -- --note-dir /Note/仓库的绝对路径
   ```

5. 完成同步后执行检查：

   ```bash
   npm run sync:notes:check
   npm run build
   npm test
   ```

其他可用模式：

- 只预览同步结果、不写入文件：`npm run sync:notes -- --dry-run`
- 检查是否存在尚未同步的内容：`npm run sync:notes:check`
- 只有用户明确要求使用 Note 内容覆盖 Think 中被手动修改的生成文件时，才能使用 `--force`

如果从文章中删除 `publish` 或将其设置为 `false`，下次同步会删除清单中记录的对应生成文章和资源，但不得删除 Think 原有的手写文章。

提交同步文章时，需要分别检查并提交两个仓库：

- Note：提交 Markdown 源文件及对应资源
- Think：提交生成的 Markdown、对应资源及 `.note-sync-manifest.json`

不要把 Note 中无关的草稿或其他文件带入提交。

更多说明参见 `docs/note-sync.md` 和 `scripts/sync-notes.js`。

## 发布 Think 网站

线上地址为 `https://liangwt.github.io/think/`。默认发布方式是 `.github/workflows/pages.yml` 中的 GitHub Pages 工作流；代码推送到 `master` 后会自动触发构建和发布。

以下生成目录或文件不得提交：

- `public/`
- `db.json`
- `node_modules/`
- `.deploy*/`

### 发布前检查

1. 如果 Note 内容发生变化，先完成上面的文章同步流程。Note 中的源文章和资源需要单独提交、推送；不要与 Think 的生成文件混为一个仓库提交。
2. 在 Think 仓库根目录执行：

   ```bash
   npm run sync:notes:check
   npm test
   npm run clean
   npm run build
   ```

3. 检查 `git status` 和暂存区差异，只提交本次涉及的源码、配置、生成文章及同步清单。保留用户尚未提交的其他修改。
4. 将 Think 提交推送到 `origin/master`：

   ```bash
   git push origin master
   ```

### GitHub Pages 自动发布过程

推送 `master` 后，GitHub Actions 会自动执行：

1. 检出 `master` 分支代码
2. 配置 GitHub Pages
3. 使用 Node.js 24 和 npm 缓存
4. 执行 `npm ci`
5. 执行 `npm run build`
6. 将 `public/` 上传为 Pages 构建产物
7. 将构建产物发布到 `github-pages` 环境

### 发布后验证

推送后先确认 GitHub Actions 中名为 `Pages` 的工作流执行成功，然后访问：

```text
https://liangwt.github.io/think/
```

GitHub Pages 和浏览器缓存可能会短暂显示上一个版本。判断发布失败前，应先确认线上对应的提交版本，或等待片刻后强制刷新重试。

### 手动发布与回滚

项目仍保留 `npm run deploy`，它会把生成结果推送到 `gh-pages` 分支，但这是备用的旧发布路径。正常发布时不要执行该命令，除非用户明确要求手动发布到 `gh-pages`；同时使用它和 Pages Actions 会形成两套相互竞争的发布流程。

如果线上版本需要回滚，应在 `master` 上撤销有问题的提交并推送撤销结果，让同一个 Pages 工作流重新发布。不要直接修改 `gh-pages` 分支或 `public/` 生成文件。
