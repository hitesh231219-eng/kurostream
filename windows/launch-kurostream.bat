@echo off
title KuroStream Desktop Launcher v2.0
setlocal EnableDelayedExpansion

set "APP_URL=https://kurostream-m1.vercel.app"
set "BROWSER_CMD="

if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    set "BROWSER_CMD=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
) else if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    set "BROWSER_CMD=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
) else if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    set "BROWSER_CMD=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    set "BROWSER_CMD=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
) else if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
    set "BROWSER_CMD=%LocalAppData%\Google\Chrome\Application\chrome.exe"
) else if exist "%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe" (
    set "BROWSER_CMD=%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe"
) else if exist "%LocalAppData%\BraveSoftware\Brave-Browser\Application\brave.exe" (
    set "BROWSER_CMD=%LocalAppData%\BraveSoftware\Brave-Browser\Application\brave.exe"
)

if defined BROWSER_CMD (
    start "" "!BROWSER_CMD!" --app=%APP_URL% --enable-gpu-rasterization --enable-zero-copy --autoplay-policy=no-user-gesture-required --window-size=1400,880
) else (
    start "" "%APP_URL%"
)

exit /b 0
