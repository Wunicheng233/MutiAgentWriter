#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Git操作工具：自动提交推送静态网站更新到GitHub

适配新结构：
- main 分支：项目源代码
- gh-pages 分支：静态网站内容（根目录）
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

    original_cwd = os.getcwd()
    original_branch = subprocess.check_output(
        ["git", "rev-parse", "--abbrev-ref", "HEAD"],
        text=True
    ).strip()

    # 检查是否有未提交的修改，如果有，先stash
    has_stashed = False
    result = subprocess.run(
        ["git", "status", "--porcelain"],
        capture_output=True, text=True
    )
    if result.stdout.strip():
        logger.info("📥 暂存当前未提交的修改...")
        result = subprocess.run(["git", "stash", "push", "-m", "auto-stash before gh-pages deploy"], capture_output=True, text=True)
        if result.returncode == 0:
            has_stashed = True

    try:
        # 切换到gh-pages分支
        logger.info("🔄 切换到gh-pages分支...")
        result = subprocess.run(["git", "checkout", "gh-pages"], capture_output=True, text=True)
        if result.returncode != 0:
            logger.error(f"切换到gh-pages分支失败: {result.stderr}")
            logger.error("请先确保gh-pages分支已存在")
            # 恢复stash
            if has_stashed:
                logger.info("📤 恢复暂存的修改...")
                subprocess.run(["git", "stash", "pop"], capture_output=True, text=True)
            return False

        # 删除旧的静态文件，但保留.git
        logger.info("🧹 清理旧静态文件...")
        for item in Path('.').iterdir():
            if item.name != '.git' and item.name != '.nojekyll':
                if item.is_dir():
                    shutil.rmtree(item)
                else:
                    os.remove(item)

        # 复制新的静态文件从static_export到根目录
        logger.info("📝 复制新静态文件...")
        for item in static_dir.iterdir():
            if item.name == '.git':
                continue
            if item.is_dir():
                shutil.copytree(item, Path('.') / item.name, dirs_exist_ok=True)
            else:
                shutil.copy2(item, Path('.') / item.name)

        # git add
        result = subprocess.run(["git", "add", "."], capture_output=True, text=True)
        if result.returncode != 0:
            logger.error(f"git add 失败: {result.stderr}")
            return False

        # 检查是否有变更
        result = subprocess.run(
            ["git", "status", "--porcelain"],
            capture_output=True, text=True
        )
        if not result.stdout.strip():
            logger.info("✅ 没有文件变更，不需要更新")
            # 切回原分支
            subprocess.run(["git", "checkout", original_branch], capture_output=True, text=True)
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
        result = subprocess.run(["git", "push", "origin", "gh-pages", "--force"], capture_output=True, text=True)
        if result.returncode != 0:
            logger.error(f"git push 失败: {result.stderr}")
            # 切回原分支
            subprocess.run(["git", "checkout", original_branch], capture_output=True, text=True)
            return False

        logger.info("✅ 静态网站已成功推送到GitHub，GitHub Pages会自动更新")
        logger.info("⌛ 等待2-5分钟后就能在网上看到最新版本了")

        # 切回原分支
        logger.info(f"🔙 切回{original_branch}分支...")
        result = subprocess.run(["git", "checkout", original_branch], capture_output=True, text=True)
        if result.returncode != 0:
            logger.error(f"切回{original_branch}失败: {result.stderr}")

        # 恢复之前stash的修改
        if has_stashed:
            logger.info("📤 恢复暂存的修改...")
            result = subprocess.run(["git", "stash", "pop"], capture_output=True, text=True)
            if result.returncode != 0:
                logger.warning(f"恢复stash警告: {result.stderr}")

        return True

    except Exception as e:
        logger.error(f"Git操作异常: {e}")
        # 尝试切回原分支
        try:
            subprocess.run(["git", "checkout", original_branch], capture_output=True, text=True)
        except:
            pass
        # 恢复stash
        if has_stashed:
            try:
                logger.info("📤 恢复暂存的修改...")
                subprocess.run(["git", "stash", "pop"], capture_output=True, text=True)
            except:
                pass
        return False
    finally:
        os.chdir(original_cwd)
