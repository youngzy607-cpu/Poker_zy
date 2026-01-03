@echo off
echo Start deploying...
git add .
git commit -m "Update"
git push
echo Done.
pause