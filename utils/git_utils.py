#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Git操作工具：自动提交推送静态网站更新到GitHub

极简稳定方案：
- 使用 git worktree，gh-pages 分支永久放在 gh-pages/ 子目录
- 永远不需要切换当前分支，绝对不会弄丢你的outputs
- main 分支：项目源代码
- gh-pages/ 目录：gh-pages 分支内容，静态网站
"""

import subprocess
import os
import shutil
from utils.logger import logger
from pathlib import Path


def auto_commit_push_static_site(commit_message: str = "Update novel website") -> bool:
    """
    自动提交推送静态网站更新到GitHub gh-pages分支
    返回是否成功
    """
    static_dir = Path("static_export").resolve()

    if not static_dir.exists():
        logger.error(f"静态网站目录不存在: {static_dir}")
        return False

    project_root = Path(__file__).parent.parent.resolve()
    gh_pages_dir = project_root / "gh-pages"

    # 检查gh-pages工作树是否已经存在
    if not gh_pages_dir.exists():
        logger.info("🔧 初始化gh-pages工作树...")
        # 添加gh-pages分支作为工作树
        result = subprocess.run(
            ["git", "worktree", "add", "gh-pages", "origin/gh-pages"],
            capture_output=True, text=True
        )
        if result.returncode != 0:
            logger.error(f"初始化gh-pages工作树失败: {result.stderr}")
            logger.info("请先确保远程已有gh-pages分支，运行: git fetch origin gh-pages")
            return False

    try:
        # 只复制更新，不删除任何文件
        # 用户要求：流程中不涉及删除文件，避免意外丢失
        logger.info("📝 复制更新静态文件（不删除任何文件）...")
        for item in static_dir.iterdir():
            if item.name == '.git':
                continue
            dest = gh_pages_dir / item.name
            if item.is_dir():
                # 递归复制，覆盖已存在文件，保留其他文件
                shutil.copytree(item, dest, dirs_exist_ok=True)
            else:
                # 直接覆盖，保证是最新的
                shutil.copy2(item, dest)

        # git add
        os.chdir(gh_pages_dir)
        result = subprocess.run(["git", "add", "."], capture_output=True, text=True)
        if result.returncode != 0:
            logger.error(f"git add 失败: {result.stderr}")
            os.chdir(project_root)
            return False

        # 检查是否有变更
        result = subprocess.run(
            ["git", "status", "--porcelain"],
            capture_output=True, text=True
        )
        if not result.stdout.strip():
            logger.info("✅ 没有文件变更，不需要更新")
            os.chdir(project_root)
            return True

        # git commit
        result = subprocess.run(
            ["git", "commit", "-m", commit_message],
            capture_output=True, text=True
        )
        if result.returncode != 0:
            logger.warning(f"git commit 警告: {result.stderr}")

        # git push
        logger.info("🚀 正在推送到GitHub gh-pages分支...")
        result = subprocess.run(["git", "push", "origin", "gh-pages"], capture_output=True, text=True)
        if result.returncode != 0:
            logger.error(f"git push 失败: {result.stderr}")
            os.chdir(project_root)
            return False

        os.chdir(project_root)
        logger.info("✅ 静态网站已成功推送到GitHub，GitHub Pages会自动更新")
        logger.info("⌛ 等待2-5分钟后就能在网上看到最新版本了")
        return True

    except Exception as e:
        logger.error(f"Git操作异常: {e}")
        os.chdir(project_root)
        return False
