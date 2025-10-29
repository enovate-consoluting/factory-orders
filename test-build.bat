@echo off
echo Testing production build...
npm run build
if %errorlevel% neq 0 (
    echo BUILD FAILED! Fix errors before pushing.
    pause
    exit /b 1
)
echo BUILD SUCCESSFUL! Safe to deploy.
pause