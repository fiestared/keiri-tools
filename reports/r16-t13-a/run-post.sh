#!/bin/bash
cd /Users/masahiroyasu/Scripts/keiri-tools-astra-r16-t13-a || exit 2
export PLAYWRIGHT_PATH=/Users/masahiroyasu/Scripts/x-bot/node_modules/playwright/index.js
./run_tests.sh > reports/r16-t13-a/post-tests.log 2>&1
rc=$?
printf '%s\n' "$rc" > reports/r16-t13-a/post-tests.rc
