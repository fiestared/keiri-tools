#!/bin/bash
export PLAYWRIGHT_PATH=/Users/masahiroyasu/Scripts/x-bot/node_modules/playwright/index.js
./run_tests.sh > review/r16-t8-a/full-tests.log 2>&1
rc=$?
printf '%s\n' "$rc" > review/r16-t8-a/full-tests.rc
exit "$rc"
