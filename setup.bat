@echo off
setlocal
cd /d "%~dp0"
title Prepy setup
echo.
echo ===== Prepy setup =====
echo Folder: %CD%
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [X] Node.js is not installed. Install the LTS version from https://nodejs.org then run this file again.
  pause
  exit /b 1
)
for /f %%v in ('node -v') do echo [OK] Node.js %%v

echo.
echo Installing packages (takes 1-3 minutes)...
call npm install
if errorlevel 1 (
  echo [X] npm install failed. Copy the error above into the Claude chat.
  pause
  exit /b 1
)
echo [OK] Packages installed

if not exist ".env.local" (
  copy ".env.example" ".env.local" >nul
  echo [OK] Created .env.local - paste your API key into it
) else (
  echo [OK] .env.local already exists
)

where git >nul 2>nul
if errorlevel 1 (
  echo [!] Git not found. Install it from https://git-scm.com to use GitHub.
  goto vscode
)
if exist ".git" (
  echo [OK] Git repository already set up
  goto vscode
)
git init -b main >nul
git add .
git commit -m "feat: Prepy MVP (resume and JD parsing, fit map, prep kit, practice with voice)" >nul 2>nul
if errorlevel 1 (
  echo [!] Git repo created, but the first commit needs your name and email. Run these once, then commit:
  echo     git config --global user.name "Your Name"
  echo     git config --global user.email "you@example.com"
  echo     git commit -m "feat: Prepy MVP"
) else (
  echo [OK] Git repository created with the first commit on branch main
)

:vscode
echo.
where code >nul 2>nul
if errorlevel 1 (
  echo [!] The 'code' command was not found. Open VS Code, then File - Open Folder - %CD%
) else (
  call code "%CD%" "%CD%\.env.local"
  echo [OK] Opened the project in VS Code
)

echo.
echo ===== Next steps =====
echo 1. Get a free Gemini key at https://aistudio.google.com/apikey then paste it after GEMINI_API_KEY= in .env.local and save.
echo 2. In the VS Code terminal (Ctrl + `), run:  npm run dev
echo 3. Open http://localhost:3000 in Chrome or Edge.
echo 4. To work with Claude Code, run:  claude   (in the same terminal)
echo.
pause
