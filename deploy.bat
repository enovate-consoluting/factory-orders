@echo off
echo Step 1: Testing build locally...
call test-build.bat
if %errorlevel% neq 0 (
    echo Build failed! Fix errors before deploying.
    exit /b 1
)

echo Step 2: Adding changes to git...
git add .

echo Step 3: Committing changes...
set /p message="Enter commit message: "
git commit -m "%message%"

echo Step 4: Pushing to GitHub (this will trigger Vercel deployment)...
git push origin main

echo Deployment initiated! Check Vercel dashboard for status.
pause