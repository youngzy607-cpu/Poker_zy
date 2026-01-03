@echo off
:: 设置编码为GBK以兼容中文Windows命令行
chcp 936 >nul
echo ==========================================
echo      德州扑克自动部署工具 (Windows版)
echo ==========================================
echo.

echo [1/3] 正在打包更改 (git add)...
git add .

echo [2/3] 正在保存存档 (git commit)...
set "timestamp=%date% %time%"
git commit -m "Auto-deploy update: %timestamp%"

echo [3/3] 正在推送到 GitHub (git push)...
:retry
git push
if %errorlevel% equ 0 (
    echo.
    echo [成功] 部署完成！
    echo 请访问 GitHub Pages 查看效果 (等待约1-2分钟)
    echo.
    pause
    exit
) else (
    echo.
    echo [失败] 推送失败，正在尝试重连...
    timeout /t 3
    goto retry
)