; -------------------------------------------------------------
; KuroStream Windows Setup Wizard - Inno Setup 6 Script (v2.0.0)
; Generates native Windows installer: KuroStream-Setup-2.0.0.exe
; -------------------------------------------------------------

#define MyAppName "KuroStream"
#define MyAppVersion "2.0.0"
#define MyAppPublisher "KuroStream Project"
#define MyAppURL "https://kurostream-m1.vercel.app"

[Setup]
AppId={{E68A8D2F-1348-4C8E-98DF-BC4B01A61337}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={localappdata}\Programs\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=..\dist-installer
OutputBaseFilename=KuroStream-Setup-{#MyAppVersion}
SetupIconFile=..\public\kurostream.ico
UninstallDisplayIcon={app}\kurostream.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
DisableProgramGroupPage=auto

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: checkedonce
Name: "startmenuicon"; Description: "Create a Start Menu shortcut"; GroupDescription: "{cm:AdditionalIcons}"; Flags: checkedonce
Name: "protocol"; Description: "Register kurostream:// deep links"; GroupDescription: "Windows Integrations"; Flags: checkedonce

[Files]
Source: "..\dist\*"; DestDir: "{app}\dist"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\electron\*"; DestDir: "{app}\electron"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\public\kurostream.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "launch-kurostream.bat"; DestDir: "{app}"; DestName: "KuroStream.bat"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\KuroStream.bat"; IconFilename: "{app}\kurostream.ico"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\KuroStream.bat"; IconFilename: "{app}\kurostream.ico"; Tasks: desktopicon

[Registry]
Root: HKCU; Subkey: "Software\Classes\kurostream"; ValueType: string; ValueData: "URL:KuroStream Protocol"; Flags: uninsdeletekey; Tasks: protocol
Root: HKCU; Subkey: "Software\Classes\kurostream"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""; Tasks: protocol
Root: HKCU; Subkey: "Software\Classes\kurostream\shell\open\command"; ValueType: string; ValueData: """{app}\KuroStream.bat"" ""%1"""; Tasks: protocol

[Run]
Filename: "{app}\KuroStream.bat"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: shellexec postinstall nowait skipifsilent
