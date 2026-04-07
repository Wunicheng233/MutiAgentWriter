"""
多本小说阅读Web服务器
自动扫描outputs目录下的所有小说，每本小说一个子文件夹
支持手机访问，响应式布局
"""

from flask import Flask, render_template, send_from_directory
from pathlib import Path
import re
import json
from config import OUTPUTS_ROOT

app = Flask(__name__)
app.config['SECRET_KEY'] = 'novel-reading-secret'


def list_all_novels():
    """列出所有outputs目录下的小说，每本小说一个子文件夹"""
    novels = []
    for novel_dir in OUTPUTS_ROOT.iterdir():
        if not novel_dir.is_dir():
            continue
        # 检查是否有info.json（小说信息）
        info_file = novel_dir / 'info.json'
        info = {
            'name': novel_dir.name,
            'description': '',
            'chapter_count': 0
        }
        if info_file.exists():
            try:
                with open(info_file, 'r', encoding='utf-8') as f:
                    loaded = json.load(f)
                    info.update(loaded)
            except:
                pass
        # 统计章节数
        chapters = list(novel_dir.glob('chapter_*.txt'))
        info['chapter_count'] = len(chapters)
        info['dir_name'] = novel_dir.name
        novels.append(info)

    # 按创建时间排序，最新的在前面
    novels.sort(key=lambda x: x.get('created_at', ''), reverse=True)
    return novels


def get_novel_chapters(novel_dir: Path):
    """获取一本小说的所有章节"""
    chapters = []
    for f in novel_dir.glob('chapter_*.txt'):
        match = re.match(r'chapter_(\d+)\.txt', f.name)
        if match:
            chapter_num = int(match.group(1))
            # 读取第一行获取标题
            title = f'第{chapter_num}章'
            try:
                with open(f, 'r', encoding='utf-8') as file:
                    first_line = file.readline().strip()
                    if first_line:
                        title = first_line
            except:
                pass
            chapters.append({
                'num': chapter_num,
                'title': title,
                'filename': f.name
            })

    chapters.sort(key=lambda x: x['num'])
    return chapters


def read_file_content(novel_dir: Path, filename: str):
    """读取小说文件内容"""
    file_path = novel_dir / filename
    if not file_path.exists():
        return None
    with open(file_path, 'r', encoding='utf-8') as f:
        return f.read()


@app.route('/')
def index():
    """首页 - 列出所有小说"""
    novels = list_all_novels()
    return render_template('index_multi.html', novels=novels)


@app.route('/novel/<novel_dirname>')
def novel_index(novel_dirname):
    """小说目录页 - 显示该小说的所有章节"""
    novel_dir = OUTPUTS_ROOT / novel_dirname
    if not novel_dir.exists():
        return "小说不存在", 404

    # 读取小说信息
    info_file = novel_dir / 'info.json'
    info = {
        'name': novel_dirname,
        'description': ''
    }
    if info_file.exists():
        try:
            with open(info_file, 'r', encoding='utf-8') as f:
                info = json.load(f)
        except:
            pass

    chapters = get_novel_chapters(novel_dir)
    return render_template('novel_index.html', info=info, chapters=chapters, novel_dirname=novel_dirname)


@app.route('/read/<novel_dirname>/<filename>')
def read(novel_dirname, filename):
    """阅读页面"""
    novel_dir = OUTPUTS_ROOT / novel_dirname
    content = read_file_content(novel_dir, filename)
    if content is None:
        return "文件不存在", 404

    chapters = get_novel_chapters(novel_dir)
    current_num = None

    prev_chapter = None
    next_chapter = None

    match = re.match(r'chapter_(\d+)\.txt', filename)
    if match:
        current_num = int(match.group(1))
        for c in chapters:
            if c['num'] == current_num - 1:
                prev_chapter = c
            if c['num'] == current_num + 1:
                next_chapter = c

    # 读取小说信息
    info_file = novel_dir / 'info.json'
    info = {
        'name': novel_dirname
    }
    if info_file.exists():
        try:
            with open(info_file, 'r', encoding='utf-8') as f:
                info = json.load(f)
        except:
            pass

    return render_template('reader.html',
                         novel_name=info.get('name'),
                         content=content,
                         novel_dirname=novel_dirname,
                         filename=filename,
                         current_num=current_num,
                         prev_chapter=prev_chapter,
                         next_chapter=next_chapter,
                         chapters=chapters)


if __name__ == '__main__':
    PORT = 5001
    print("=" * 60)
    print("📖 多Agent小说创作系统 - 阅读器")
    print("=" * 60)
    print(f"输出根目录: {OUTPUTS_ROOT}")
    print(f"本地访问: http://127.0.0.1:{PORT}")
    print(f"局域网访问: http://192.168.43.143:{PORT}（手机可通过这个地址访问）")
    print("=" * 60)
    app.run(host='0.0.0.0', port=PORT, debug=True)
