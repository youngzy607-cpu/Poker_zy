@echo off
echo Configuring Git path...
set "PATH=F:\Program Files\Git\cmd;%PATH%"
echo Start deploying...
git add .
git commit -m "Update"
git push
echo Done.
pause