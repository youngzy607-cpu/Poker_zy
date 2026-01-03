# 部署指南 (Deployment Guide)

由于当前环境检测到 `git` 命令不可用，无法自动推送代码。请按照以下步骤手动将项目部署到 GitHub，以便分享给他人体验。

## 1. 准备工作
确保您已安装 Git。如果尚未安装，请从 [git-scm.com](https://git-scm.com/) 下载并安装。

## 2. 初始化与提交 (Initialize & Commit)
在项目根目录 (`D:\Project_TRAE\德州扑克`) 打开终端（Terminal）或命令行，依次运行以下命令：

```bash
# 1. 初始化 Git 仓库
git init

# 2. 添加所有文件
git add .

# 3. 提交更改
git commit -m "Initial commit: v1.4 Mobile & Badges"
```

## 3. 推送到 GitHub (Push to Remote)
将本地代码推送到您的远程仓库：

```bash
# 1. 关联远程仓库
git remote add origin https://github.com/youngzy607-cpu/Poker_zy.git

# (如果提示 "remote origin already exists"，请改用下行命令)
# git remote set-url origin https://github.com/youngzy607-cpu/Poker_zy.git

# 2. 重命名分支为 main (如果当前不是 main)
git branch -M main

# 3. 推送到远程
git push -u origin main
```

## 4. 开启在线体验 (GitHub Pages)
为了让朋友们通过链接直接游玩，请配置 GitHub Pages：

1.  打开仓库页面：[https://github.com/youngzy607-cpu/Poker_zy](https://github.com/youngzy607-cpu/Poker_zy)
2.  点击顶部的 **Settings** (设置) 选项卡。
3.  在左侧菜单中找到并点击 **Pages**。
4.  在 **Build and deployment** > **Branch** 区域：
    *   选择 `main` 分支。
    *   文件夹保持 `/ (root)`。
    *   点击 **Save** (保存)。
5.  等待约 1-2 分钟，刷新页面。顶部会显示一个绿色的提示框，包含您的专属游戏链接（例如：`https://youngzy607-cpu.github.io/Poker_zy/`）。

## 5. 后续迭代 (Updates)
以后每次修改代码后，运行以下命令更新：

```bash
git add .
git commit -m "描述您的修改内容"
git push
```
