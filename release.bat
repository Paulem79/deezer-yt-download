@echo off
set /p TAG="Enter version tag (e.g., v1.0.0): "

if "%TAG%"=="" (
    echo Error: No tag provided
    exit /b 1
)

echo Creating tag %TAG%...
git tag %TAG%

echo Pushing tag %TAG% to origin...
git push origin %TAG%

echo Done! Tag %TAG% has been pushed.
pause

