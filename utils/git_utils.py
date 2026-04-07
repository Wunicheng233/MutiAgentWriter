#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Git操作工具：自动提交推送静态网站更新
"""

import subprocess
import os
from utils.logger import logger
from pathlib import Path


def auto_commit_push_static_site(commit_message: str = "Update novel website") -> bool:
    """
    自动提交推送静态网站更新到GitHub
    返回是否成功
    """
    static_dir = Path("static_export").resolve()

    if not static_dir.exists():
        logger.error(f"静态网站目录不存在: {static_dir}")
        return False

    original_cwd = os.getcwd()
    try:
        os.chdir(static_dir)

        # 检查是否是git仓库
        if not (static_dir / ".git").exists():
            logger.error("static_export不是git仓库，请先手动初始化：cd static_export && git init")
            logger.error("然后添加远程仓库：git remote add origin <your-github-repo-url>")
            return False

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
            logger.info("没有文件变更，不需要提交")
            return True

        # git commit
        result = subprocess.run(
            ["git", "commit", "-m", commit_message],
            capture_output=True, text=True
        )
        if result.returncode != 0:
            logger.warning(f"git commit 警告: {result.stderr}")

        # git push
        logger.info("正在推送到GitHub...")
        result = subprocess.run(["git", "push"], capture_output=True, text=True)
        if result.returncode != 0:
            logger.error(f"git push 失败: {result.stderr}")
            return False

        logger.info("✅ 静态网站已成功推送到GitHub，GitHub Pages会自动更新")
        logger.info("⌛ 等待2-5分钟后就能在网上看到最新版本了")
        return True

    except Exception as e:
        logger.error(f"Git操作异常: {e}")
        return False
    finally:
        os.chdir(original_cwd)
