%homepath%\.config\sync-dapp-cheddar.bat
if errorlevel 1 echo **** SYNC FAILED ****
if errorlevel 1 pause
if errorlevel 1 goto END

:END

