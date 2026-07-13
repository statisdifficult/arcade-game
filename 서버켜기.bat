@echo off
cd /d "%~dp0server"
if not exist node_modules call npm install
node index.js
pause
