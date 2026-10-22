#!/bin/bash
set -euo pipefail

LOG_FILE="/home/pi/git/bet_knesset_times/weekly_flyer_cron.log"
PROMPT_FILE="/home/pi/git/bet_knesset_times/WEEKLY_FLYER_PROMPT.md"

echo "==========================================" >> "$LOG_FILE"
echo "[$(date -Iseconds)] Starting weekly Shabbat flyer generation" >> "$LOG_FILE"

cd /home/pi
/home/pi/.local/bin/agy --model gemini-3.8-flash-medium --dangerously-skip-permissions -p "$(cat "$PROMPT_FILE")" >> "$LOG_FILE" 2>&1

echo "[$(date -Iseconds)] Finished weekly Shabbat flyer generation" >> "$LOG_FILE"
