@echo off
REM Comprehensive QueueCTL Demo Script

echo.
echo ========================================================
echo  QueueCTL - Comprehensive Demo
echo ========================================================
echo.

REM Clean up old data
if exist data\queuectl.json del data\queuectl.json
if exist data\config.json del data\config.json

echo [Step 1] Enqueuing various jobs...
echo.
node bin\queuectl.js enqueue "{\"id\":\"success-1\",\"command\":\"echo Task completed successfully!\"}"
node bin\queuectl.js enqueue "{\"id\":\"success-2\",\"command\":\"echo Another successful task\"}"
node bin\queuectl.js enqueue "{\"id\":\"slow-job\",\"command\":\"timeout /t 3 /nobreak >nul && echo Slow job done\"}"
node bin\queuectl.js enqueue "{\"id\":\"fail-job\",\"command\":\"echo This will fail && exit 1\",\"max_retries\":2}"
node bin\queuectl.js enqueue "{\"id\":\"invalid-cmd\",\"command\":\"nonexistentcommand123\",\"max_retries\":1}"
echo.

echo [Step 2] Checking queue status...
echo.
node bin\queuectl.js status
echo.

echo [Step 3] Listing all pending jobs...
echo.
node bin\queuectl.js list --state pending
echo.

echo [Step 4] Configuration check...
echo.
node bin\queuectl.js config get
echo.

echo.
echo ========================================================
echo Setup complete! Jobs are ready for processing.
echo ========================================================
echo.
echo NEXT STEPS:
echo.
echo 1. Start workers in a NEW terminal window:
echo    cd "c:\Users\Mohith Pranav\Desktop\idea\flams"
echo    node bin\queuectl.js worker start --count 2
echo.
echo 2. Watch as workers process jobs (with retries for failed jobs)
echo.
echo 3. In THIS terminal, check status during processing:
echo    node bin\queuectl.js status
echo    node bin\queuectl.js list
echo    node bin\queuectl.js dlq list
echo.
echo 4. Stop workers with Ctrl+C (graceful shutdown)
echo.
echo ========================================================
echo.
pause
