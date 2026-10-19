@echo off
setlocal enabledelayedexpansion

REM ==============================================================
REM Batch file to push SEE Content Connector to GitHub
REM Follows instructions from README.md
REM ==============================================================

REM Set the GitHub repository URL
set "GIT_REPO=https://github.com/nguyenquocminhtrading-design/see-content-connector.git"

REM Optional: allow override via first argument
if not "%~1"=="" set "GIT_REPO=%~1"

echo.
echo ==============================================================
echo SEE Content Connector - GitHub Push Helper
echo ==============================================================
echo.

REM Check if we are in a git repository
if exist .git (
    echo .git folder found. Assuming existing repository.
) else (
    echo Initializing new git repository...
    git init
    if errorlevel 1 (
        echo [!ERROR!] Failed to initialize git repository.
        echo Make sure git is installed and in your PATH.
        pause
        exit /b 1
    )
)

echo.
echo Adding all files...
git add .
if errorlevel 1 (
    echo [!ERROR!] Failed to add files.
    pause
    exit /b 1
)

echo.
echo Committing...
git commit -m "feat: complete see content connector with self-healing token engine and render blueprint"
if errorlevel 1 (
    echo [!ERROR!] Failed to commit. Maybe nothing to commit or user name/email not set.
    echo Hint: set git config user.name and user.email.
    pause
    exit /b 1
)

echo.
echo Renaming current branch to main...
git branch -M main
if errorlevel 1 (
    echo [!ERROR!] Failed to rename branch to main.
    pause
    exit /b 1
)

echo.
echo Adding remote origin...
git remote add origin %GIT_REPO%
if errorlevel 1 (
    echo [!WARNING!] Remote origin may already exist. Trying to set URL...
    git remote set-url origin %GIT_REPO%
    if errorlevel 1 (
        echo [!ERROR!] Failed to add or set remote origin.
        pause
        exit /b 1
    )
)

echo.
echo Pushing to origin main...
git push -u origin main
if errorlevel 1 (
    echo [!ERROR!] Failed to push to GitHub.
    echo Possible causes:
    echo   - Repository URL incorrect or access denied.
    echo   - Need to authenticate (Personal Access Token).
    echo   - Ensure you have permission to push to this repo.
    pause
    exit /b 1
)

echo.
echo ==============================================================
echo Push completed successfully!
echo ==============================================================
endlocal
pause