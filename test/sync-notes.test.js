'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { syncNotes } = require('../scripts/sync-notes');

async function createWorkspace() {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'think-note-sync-'));
    const noteDir = path.join(root, 'Note');
    const thinkDir = path.join(root, 'Think');
    await fs.mkdir(noteDir, { recursive: true });
    await fs.mkdir(thinkDir, { recursive: true });
    await fs.writeFile(path.join(thinkDir, '_config.yml'), 'root: /think/\n');

    return {
        root,
        noteDir,
        thinkDir,
        postsDir: path.join(thinkDir, 'source/_posts/note'),
        manifestFile: path.join(thinkDir, '.note-sync-manifest.json')
    };
}

test('syncs published notes, front matter, and article assets', async t => {
    const workspace = await createWorkspace();
    t.after(() => fs.rm(workspace.root, { recursive: true, force: true }));

    const category = path.join(workspace.noteDir, '网络');
    const assetDirectory = path.join(category, '.assets', 'TLS 原理');
    await fs.mkdir(assetDirectory, { recursive: true });
    await fs.writeFile(path.join(assetDirectory, '封面.png'), 'image-bytes');
    await fs.writeFile(path.join(category, 'TLS 原理.md'), `---
publish: true
title: TLS 原理
date: 2026-08-23
tags:
- TLS
summary: TLS 摘要
cover: .assets/TLS 原理/封面.png
---
![封面](.assets/TLS 原理/封面.png)

## 正文
`);
    await fs.writeFile(path.join(category, '草稿.md'), '不应同步');

    const first = await syncNotes({
        projectRoot: workspace.thinkDir,
        noteDir: workspace.noteDir,
        postsDir: workspace.postsDir,
        manifestFile: workspace.manifestFile
    });

    assert.equal(first.published, 1);
    assert.equal(first.changed, true);
    const generated = await fs.readFile(path.join(workspace.postsDir, '网络', 'TLS 原理.md'), 'utf8');
    assert.match(generated, /categories:\n\s+- 网络/);
    assert.match(generated, /summary: TLS 摘要/);
    assert.match(generated, /cover: 封面\.png/);
    assert.match(generated, /!\[封面\]\(封面\.png\)/);
    assert.match(generated, /note_source: 网络\/TLS 原理\.md/);
    assert.equal(await fs.readFile(path.join(workspace.postsDir, '网络', 'TLS 原理', '封面.png'), 'utf8'), 'image-bytes');

    const second = await syncNotes({
        projectRoot: workspace.thinkDir,
        noteDir: workspace.noteDir,
        postsDir: workspace.postsDir,
        manifestFile: workspace.manifestFile
    });
    assert.equal(second.changed, false);
});

test('removes only previously managed articles when publish is disabled', async t => {
    const workspace = await createWorkspace();
    t.after(() => fs.rm(workspace.root, { recursive: true, force: true }));

    const article = path.join(workspace.noteDir, '文章.md');
    await fs.writeFile(article, '---\npublish: true\ndate: 2026-08-23\n---\n正文\n');
    const options = {
        projectRoot: workspace.thinkDir,
        noteDir: workspace.noteDir,
        postsDir: workspace.postsDir,
        manifestFile: workspace.manifestFile
    };
    await syncNotes(options);

    const manual = path.join(workspace.postsDir, '手写文章.md');
    await fs.writeFile(manual, '保留');
    await fs.writeFile(article, '---\npublish: false\ndate: 2026-08-23\n---\n正文\n');
    const result = await syncNotes(options);

    assert.equal(result.removed, 1);
    assert.equal(await fs.readFile(manual, 'utf8'), '保留');
    await assert.rejects(fs.access(path.join(workspace.postsDir, '文章.md')));
});

test('refuses to overwrite edits made to generated Think articles', async t => {
    const workspace = await createWorkspace();
    t.after(() => fs.rm(workspace.root, { recursive: true, force: true }));

    const article = path.join(workspace.noteDir, '文章.md');
    const options = {
        projectRoot: workspace.thinkDir,
        noteDir: workspace.noteDir,
        postsDir: workspace.postsDir,
        manifestFile: workspace.manifestFile
    };
    await fs.writeFile(article, '---\npublish: true\ndate: 2026-08-23\n---\n正文\n');
    await syncNotes(options);
    await fs.appendFile(path.join(workspace.postsDir, '文章.md'), 'Think 侧修改');

    await assert.rejects(syncNotes(options), /was modified in Think/);
});

test('requires a stable date for published notes', async t => {
    const workspace = await createWorkspace();
    t.after(() => fs.rm(workspace.root, { recursive: true, force: true }));
    await fs.writeFile(path.join(workspace.noteDir, '文章.md'), '---\npublish: true\n---\n正文\n');

    await assert.rejects(syncNotes({
        projectRoot: workspace.thinkDir,
        noteDir: workspace.noteDir,
        postsDir: workspace.postsDir,
        manifestFile: workspace.manifestFile
    }), /must define a date/);
});

test('ignores ordinary Markdown files that begin with a horizontal rule', async t => {
    const workspace = await createWorkspace();
    t.after(() => fs.rm(workspace.root, { recursive: true, force: true }));
    await fs.writeFile(path.join(workspace.noteDir, '普通笔记.md'), '---\n\n## 普通正文\n\n字段: 值\n');

    const result = await syncNotes({
        projectRoot: workspace.thinkDir,
        noteDir: workspace.noteDir,
        postsDir: workspace.postsDir,
        manifestFile: workspace.manifestFile
    });

    assert.equal(result.published, 0);
});
