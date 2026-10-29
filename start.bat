@echo off
rem HEXLE local launcher: starts PHP's built-in server and opens the game in your browser.
cd /d "%~dp0"
where php >nul 2>nul || (
  echo PHP was not found on PATH. Install PHP 8.1+ ^(or Laravel Herd^) and try again.
  pause
  exit /b 1
)
if not exist private mkdir private
echo HEXLE running at http://127.0.0.1:8790/  -  close this window to stop it.
start "" http://127.0.0.1:8790/

rem Use PHP's own config when it already has SQLite (Herd, XAMPP...); otherwise load the bundled extensions.
php -m 2>nul | findstr /i /b "pdo_sqlite" >nul && goto plain
for /f "delims=" %%i in ('where php') do (set "PHPDIR=%%~dpi" & goto ext)
:ext
php -d extension_dir="%PHPDIR%ext" -d extension=pdo_sqlite -d extension=mbstring -S 127.0.0.1:8790 -t httpdocs
goto :eof
:plain
php -S 127.0.0.1:8790 -t httpdocs
