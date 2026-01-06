#!/bin/bash

# 1. 添加所有更改
echo "📦 正在打包更改 (git add)..."
git add .

# 2. 提交更改
echo "💾 正在保存存档 (git commit)..."
# 获取当前时间作为提交信息的一部分
timestamp=$(date "+%Y-%m-%d %H:%M:%S")
git commit -m "Auto-deploy update: $timestamp"

# 3. 推送到服务器
echo "🚀 正在推送到 GitHub (git push)..."
# 尝试推送，如果失败则重试最多 3 次
max_retries=3
count=0

while [ $count -lt $max_retries ]; do
    git push
    if [ $? -eq 0 ]; then
        echo "✅ 部署成功！"
        echo "🌐 请访问 GitHub Pages 查看效果 (可能需要几分钟更新)"
        exit 0
    else
        echo "⚠️ 推送失败，正在重试 ($((count+1))/$max_retries)..."
        count=$((count+1))
        sleep 2
    fi
done

echo "❌ 推送失败，请检查网络或代理设置。"
read -p "按回车键退出..."
