@echo off
echo ========================================
echo Uploading Portal Files to Server
echo ========================================
echo.
echo Opening WinSCP/PSFTP for upload...
echo Server: 203.0.113.2
echo Port: 2973
echo User: speed4you
echo.
echo AFTER LOGIN, upload these files:
echo   server-deploy\frontend\dist\* 
echo     ^> /var/www/html/portal\
echo.
echo   server-deploy\backend\* 
echo     ^> /home/speed4you/isp-portal-backend\
echo.
echo Press any key to open FileZilla or WinSCP...
pause > nul
start "" "C:\Program Files\FileZilla FTP\FileZilla.exe" "sftp://speed4you@203.0.113.2:2973"