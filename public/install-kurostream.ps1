# -------------------------------------------------------------------------
# KuroStream Windows Native Installer v2.0.0
# Silent App Mode · Custom Icon · Start Menu & Desktop · Clean Uninstaller
# -------------------------------------------------------------------------
$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$AppName      = "KuroStream"
$Version      = "2.0.0"
$Publisher    = "KuroStream Project"
$AppUrl       = "https://kurostream-m1.vercel.app"
$InstallDir   = Join-Path $env:LOCALAPPDATA "Programs\$AppName"
$DesktopDir   = [Environment]::GetFolderPath("Desktop")
$StartMenuDir = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\$AppName"

Clear-Host
Write-Host ""
Write-Host "  ================================================================" -ForegroundColor DarkCyan
Write-Host "    KUROSTREAM DESKTOP INSTALLER  v$Version  (Windows 10 / 11 x64)" -ForegroundColor White
Write-Host "  ================================================================" -ForegroundColor DarkCyan
Write-Host ""

try {
    # [1/5] Directory setup
    Write-Host "  [1/5] Preparing installation directory..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Force -Path $InstallDir   | Out-Null
    New-Item -ItemType Directory -Force -Path $StartMenuDir | Out-Null

    # [2/5] Write multi-size native Windows .ICO icon
    Write-Host "  [2/5] Extracting native KuroStream desktop icon..." -ForegroundColor Cyan
    $IconPath = Join-Path $InstallDir "KuroStream.ico"
    $IconBase64 = "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"
    [IO.File]::WriteAllBytes($IconPath, [Convert]::FromBase64String($IconBase64))

    # [3/5] Detect best Chromium/WebView browser for borderless App Mode
    Write-Host "  [3/5] Detecting GPU-accelerated runtime (Edge / Chrome / Brave)..." -ForegroundColor Cyan
    $CandidateBrowsers = @(
        "$env:ProgramFiles(x86)\Microsoft\Edge\Application\msedge.exe",
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "$env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe",
        "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
        "$env:ProgramFiles\BraveSoftware\Brave-Browser\Application\brave.exe",
        "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\Application\brave.exe"
    )
    $BrowserExe = $CandidateBrowsers | Where-Object { Test-Path $_ } | Select-Object -First 1

    # Write batch launcher (with silent fallback)
    $BatPath = Join-Path $InstallDir "KuroStream.bat"
    if ($BrowserExe) {
        Write-Host "        Found runtime: $BrowserExe" -ForegroundColor DarkGray
        $BatContent = @"
@echo off
start "" "$BrowserExe" --app=$AppUrl --enable-gpu-rasterization --enable-zero-copy --autoplay-policy=no-user-gesture-required --window-size=1400,880
exit /b 0
"@
    } else {
        Write-Host "        Using Windows default browser fallback" -ForegroundColor DarkGray
        $BatContent = @"
@echo off
start "" "$AppUrl"
exit /b 0
"@
    }
    Set-Content -Path $BatPath -Value $BatContent -Encoding ASCII

    # Write silent VBScript wrapper (zero black console flash!)
    $VbsPath = Join-Path $InstallDir "KuroStream.vbs"
    $VbsContent = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run Chr(34) & "$BatPath" & Chr(34), 0, False
"@
    Set-Content -Path $VbsPath -Value $VbsContent -Encoding ASCII

    # Write clean Uninstaller script
    $UninstallPs1 = Join-Path $InstallDir "Uninstall.ps1"
    $UninstallContent = @"
`$ErrorActionPreference = "SilentlyContinue"
Remove-Item -Path "$DesktopDir\$AppName.lnk" -Force
Remove-Item -Path "$StartMenuDir" -Recurse -Force
Remove-Item -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$AppName" -Force
Remove-Item -Path "HKCU:\Software\Classes\kurostream" -Recurse -Force
Start-Sleep -Milliseconds 300
Remove-Item -Path "$InstallDir" -Recurse -Force
Write-Host "KuroStream has been uninstalled." -ForegroundColor Green
"@
    Set-Content -Path $UninstallPs1 -Value $UninstallContent -Encoding UTF8

    # [4/5] Create Desktop & Start Menu shortcuts + Windows Registry integration
    Write-Host "  [4/5] Registering shortcuts, icon & Windows Apps entry..." -ForegroundColor Cyan
    $WshShell = New-Object -ComObject WScript.Shell
    $WScriptExe = "$env:WINDIR\System32\wscript.exe"

    $DesktopLnk = $WshShell.CreateShortcut((Join-Path $DesktopDir "$AppName.lnk"))
    $DesktopLnk.TargetPath = $WScriptExe
    $DesktopLnk.Arguments = "//nologo `"$VbsPath`""
    $DesktopLnk.WorkingDirectory = $InstallDir
    $DesktopLnk.IconLocation = "$IconPath,0"
    $DesktopLnk.Description = "KuroStream Desktop - Anime & Manga Platform"
    $DesktopLnk.Save()

    $StartLnk = $WshShell.CreateShortcut((Join-Path $StartMenuDir "$AppName.lnk"))
    $StartLnk.TargetPath = $WScriptExe
    $StartLnk.Arguments = "//nologo `"$VbsPath`""
    $StartLnk.WorkingDirectory = $InstallDir
    $StartLnk.IconLocation = "$IconPath,0"
    $StartLnk.Description = "KuroStream Desktop - Anime & Manga Platform"
    $StartLnk.Save()

    # Register in Windows Settings -> Apps & Features (HKCU, no Admin required)
    $UninstallReg = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$AppName"
    New-Item -Path $UninstallReg -Force | Out-Null
    Set-ItemProperty -Path $UninstallReg -Name "DisplayName" -Value "$AppName Desktop"
    Set-ItemProperty -Path $UninstallReg -Name "DisplayVersion" -Value $Version
    Set-ItemProperty -Path $UninstallReg -Name "Publisher" -Value $Publisher
    Set-ItemProperty -Path $UninstallReg -Name "DisplayIcon" -Value $IconPath
    Set-ItemProperty -Path $UninstallReg -Name "InstallLocation" -Value $InstallDir
    Set-ItemProperty -Path $UninstallReg -Name "UninstallString" -Value "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$UninstallPs1`""
    Set-ItemProperty -Path $UninstallReg -Name "NoModify" -Value 1 -Type DWord
    Set-ItemProperty -Path $UninstallReg -Name "NoRepair" -Value 1 -Type DWord

    # Register kurostream:// protocol handler
    $ProtoReg = "HKCU:\Software\Classes\kurostream"
    New-Item -Path "$ProtoReg\shell\open\command" -Force | Out-Null
    Set-ItemProperty -Path $ProtoReg -Name "(default)" -Value "URL:KuroStream Protocol"
    Set-ItemProperty -Path $ProtoReg -Name "URL Protocol" -Value ""
    Set-ItemProperty -Path "$ProtoReg\shell\open\command" -Name "(default)" -Value "`"$WScriptExe`" //nologo `"$VbsPath`" `"%1`""

    # [5/5] Launch KuroStream
    Write-Host "  [5/5] Launching KuroStream Desktop..." -ForegroundColor Green
    Write-Host ""
    Write-Host "  [OK] Installed to: $InstallDir" -ForegroundColor Green
    Write-Host "  [OK] Desktop & Start Menu shortcuts created with custom icon" -ForegroundColor Green
    Write-Host "  [OK] Added to Windows Installed Apps (clean uninstall supported)" -ForegroundColor Green
    Write-Host ""

    Start-Process -FilePath $WScriptExe -ArgumentList "//nologo `"$VbsPath`""
} catch {
    Write-Host ""
    Write-Host "  [ERROR] Installation encountered a problem: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  Fallback: Open $AppUrl directly in your browser or run KuroStream.bat." -ForegroundColor Yellow
}
