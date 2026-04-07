#!/bin/bash
# 停止小说阅读器后台服务

if [ -f /Users/nobody1/Desktop/project/writer/server.pid ]; then
    PID=$(cat /Users/nobody1/Desktop/project/writer/server.pid)
    kill $PID
    rm /Users/nobody1/Desktop/project/writer/server.pid
    echo "✅ 小说阅读器已停止"
else
    echo "❌ 没有找到运行中的服务PID文件"
fi
