#!/bin/bash
# 小说阅读器后台启动脚本
# 执行后即使电脑熄屏也能持续运行

# 进入项目目录
cd /Users/nobody1/Desktop/project/writer

# 使用nohup在后台运行，输出日志到server.log
nohup conda run -n novel_agent python app.py > server.log 2>&1 &

# 保存进程ID
echo $! > server.pid

echo "✅ 小说阅读器已启动，后台运行中"
echo "📖 访问地址: http://$(hostname -I | awk '{print $1}'):5001"
echo "🗒️  查看日志: tail -f /Users/nobody1/Desktop/project/writer/server.log"
echo "🛑 停止服务: bash /Users/nobody1/Desktop/project/writer/stop_server.sh"
