#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
一键导出静态网站脚本
将所有小说导出为静态HTML，可以直接部署到GitHub Pages / Vercel等免费平台
"""

import os
import re
from pathlib import Path
from app import app, list_all_novels
from config import OUTPUTS_ROOT

OUTPUT_STATIC_DIR = Path("static_export")

def ensure_dir(path):
    path = Path(path)
    if not path.exists():
        path.mkdir(parents=True)

def extract_title(content):
    """从章节内容提取标题"""
    first_line = content.split('\n')[0].strip()
    # 去除 # 符号
    first_line = re.sub(r'^#\s*', '', first_line)
    return first_line

def get_novel_info(novel_dir_name):
    """获取小说信息和章节列表"""
    novel_dir = OUTPUTS_ROOT / novel_dir_name
    info_file = novel_dir / 'info.json'
    info = {
        'name': novel_dir_name,
        'description': '',
    }
    if info_file.exists():
        import json
        try:
            with open(info_file, 'r', encoding='utf-8') as f:
                loaded = json.load(f)
                info.update(loaded)
        except:
            pass

    # 获取所有章节
    chapter_files = novel_dir.glob('chapter_*.txt')
    # 按章节号数字排序，不是按字符串排序（修复chapter_17排在chapter_3前面的bug）
    chapter_files = sorted(chapter_files, key=lambda x: int(x.stem.split('_')[1]))
    chapters = []
    for f in chapter_files:
        num = int(f.stem.split('_')[1])
        with open(f, 'r', encoding='utf-8') as content_f:
            content = content_f.read()
            first_line = content.split('\n')[0].strip()
            title = extract_title(content)
            chapters.append({
                'num': num,
                'filename': f.name,
                'title': title
            })
    return info, chapters

def export_static():
    """导出所有小说为静态HTML"""
    print("🚀 开始导出静态网站...")

    # 创建输出目录
    ensure_dir(OUTPUT_STATIC_DIR)

    # 获取所有小说
    novels = list_all_novels()

    print(f"📚 找到 {len(novels)} 本小说")

    # 从Flask渲染生成HTML
    from flask import render_template

    # 导出首页
    print("📄 导出首页...")
    with app.app_context():
        html = render_template('index_multi.html', novels=novels)
        # 修正链接路径 - 静态导出需要相对路径
        for novel in novels:
            html = html.replace('href="/novel/' + novel['dir_name'] + '"',
                              'href="./' + novel['dir_name'] + '/index.html"')
        with open(OUTPUT_STATIC_DIR / 'index.html', 'w', encoding='utf-8') as f:
            f.write(html)

    # 导出每本小说的章节列表和阅读页
    with app.app_context():
        for novel in novels:
            novel_dir = OUTPUT_STATIC_DIR / novel['dir_name']
            ensure_dir(novel_dir)

            # 获取小说信息和章节列表
            info, chapters = get_novel_info(novel['dir_name'])
            print(f"📖 导出《{novel['name']}》，共 {len(chapters)} 章...")

            # 修正链接路径 - 静态导出需要相对路径
            html = render_template('novel_index.html', info=info, chapters=chapters, novel_dirname=novel['dir_name'])
            # Flask路由是 /read/novel/chapter，静态文件是 read/chapter
            html = html.replace('/read/' + novel['dir_name'] + '/', './read/')
            html = html.replace('href="/"', 'href="../index.html"')
            # 修正后缀名，把.txt改成.html
            html = html.replace('.txt', '.html')
            with open(novel_dir / 'index.html', 'w', encoding='utf-8') as f:
                f.write(html)

            # 导出每一章节
            read_dir = novel_dir / 'read'
            ensure_dir(read_dir)
            for i, chapter in enumerate(chapters):
                # 读取章节内容
                chapter_path = Path('outputs') / novel['dir_name'] / chapter['filename']
                with open(chapter_path, 'r', encoding='utf-8') as f:
                    content = f.read()

                # 计算上一章下一章
                prev_chapter = chapters[i-1] if i > 0 else None
                next_chapter = chapters[i+1] if i < len(chapters)-1 else None

                # 渲染阅读页
                html = render_template('reader.html',
                    content=content,
                    novel_name=novel['name'],
                    novel_dirname=novel['dir_name'],
                    chapters=chapters,
                    current_num=chapter['num'],
                    prev_chapter=prev_chapter,
                    next_chapter=next_chapter
                )

                # 修正链接路径为相对路径
                # 修正导航按钮链接
                html = html.replace('window.location.href=\'/novel/' + novel['dir_name'] + '\'',
                                   'window.location.href=\'../index.html\'')
                if prev_chapter:
                    prev_name = prev_chapter['filename'].replace('.txt', '.html')
                    html = html.replace('/read/' + novel['dir_name'] + '/' + prev_chapter['filename'],
                                       '../read/' + prev_name)
                if next_chapter:
                    next_name = next_chapter['filename'].replace('.txt', '.html')
                    html = html.replace('/read/' + novel['dir_name'] + '/' + next_chapter['filename'],
                                       '../read/' + next_name)
                # 修正目录链接
                html = html.replace('href="/novel/' + novel['dir_name'] + '"', 'href="../index.html"')
                html = html.replace('/read/' + novel['dir_name'] + '/', './')
                # 修正后缀名，把.txt改成.html
                html = html.replace('.txt', '.html')
                # 保存为.html文件
                html_filename = chapter['filename'].replace('.txt', '.html')
                with open(read_dir / html_filename, 'w', encoding='utf-8') as f:
                    f.write(html)

    # 创建CNAME文件（如果需要自定义域名）
    if not (OUTPUT_STATIC_DIR / 'CNAME').exists():
        with open(OUTPUT_STATIC_DIR / '.nojekyll', 'w') as f:
            f.write('')  # 告诉GitHub Pages不要使用Jekyll处理

    print(f"\n✅ 导出完成！输出目录: {OUTPUT_STATIC_DIR}")
    print(f"\n📋 部署指南：")
    print(f"   1. 将 {OUTPUT_STATIC_DIR} 目录里的所有文件上传到GitHub仓库")
    print(f"   2. 开启 GitHub Pages，选择 main 分支（或者 root 目录）")
    print(f"   3. 等待几分钟，你的网站就上线了！")
    print(f"   4. 之后每次生成新小说，重新运行这个脚本再推送即可")
    print(f"\n🌍 部署后你就能在全世界任何地方访问了！")

if __name__ == '__main__':
    export_static()
