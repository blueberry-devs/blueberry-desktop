@echo off
setlocal

set "TARGET=aarch64-linux-android"
set "OUT=src-tauri\binaries\music-server-%TARGET%"

if "%ANDROID_NDK_HOME%"=="" if not "%ANDROID_HOME%"=="" (
  for /f "delims=" %%d in ('dir /b /ad /o-n "%ANDROID_HOME%\ndk" 2^>nul') do if not defined ANDROID_NDK_HOME set "ANDROID_NDK_HOME=%ANDROID_HOME%\ndk\%%d"
)
if "%ANDROID_NDK_HOME%"=="" if exist "%LOCALAPPDATA%\Android\Sdk\ndk" (
  for /f "delims=" %%d in ('dir /b /ad /o-n "%LOCALAPPDATA%\Android\Sdk\ndk" 2^>nul') do if not defined ANDROID_NDK_HOME set "ANDROID_NDK_HOME=%LOCALAPPDATA%\Android\Sdk\ndk\%%d"
)
if "%ANDROID_NDK_HOME%"=="" (
  echo Android NDK was not found. Set ANDROID_NDK_HOME manually.
  exit /b 1
)

set "CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER=%ANDROID_NDK_HOME%\toolchains\llvm\prebuilt\windows-x86_64\bin\aarch64-linux-android35-clang.cmd"
set "CC_aarch64-linux-android=%ANDROID_NDK_HOME%\toolchains\llvm\prebuilt\windows-x86_64\bin\aarch64-linux-android35-clang.cmd"
set "CXX_aarch64-linux-android=%ANDROID_NDK_HOME%\toolchains\llvm\prebuilt\windows-x86_64\bin\aarch64-linux-android35-clang++.cmd"
set "AR_aarch64-linux-android=%ANDROID_NDK_HOME%\toolchains\llvm\prebuilt\windows-x86_64\bin\llvm-ar.exe"
set "RANLIB_aarch64-linux-android=%ANDROID_NDK_HOME%\toolchains\llvm\prebuilt\windows-x86_64\bin\llvm-ranlib.exe"

echo Building music-server for %TARGET%...
cargo build --manifest-path server\Cargo.toml --target %TARGET% --release
if errorlevel 1 exit /b %errorlevel%

copy /Y "server\target\%TARGET%\release\music-server" "%OUT%" >nul
if errorlevel 1 exit /b %errorlevel%

echo Android sidecar written to %OUT%
