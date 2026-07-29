@echo off
REM Analyze music files and generate vectors for recommendations
REM Usage: analyze-music.bat C:\path\to\music C:\path\to\output

set ANALYZE_EXE=%~dp0..\target\release\analyze.exe

if "%~1"=="" (
    echo Usage: %0 ^<music-directory^> [output-directory]
    echo.
    echo Example: %0 "C:\Music" "C:\Users\rytp8\coding\music\resources"
    exit /b 1
)

set MUSIC_DIR=%~1
set OUTPUT_DIR=%~2

if "%OUTPUT_DIR%"=="" (
    set OUTPUT_DIR=%~dp0..\resources
)

echo Analyzing music in: %MUSIC_DIR%
echo Output directory: %OUTPUT_DIR%

"%ANALYZE_EXE%" --directory "%MUSIC_DIR%" --output "%OUTPUT_DIR%"

echo.
echo Done! Check %OUTPUT_DIR% for vectors.json, mbid-map.json, and mood-vectors.json
