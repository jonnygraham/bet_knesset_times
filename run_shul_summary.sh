#!/bin/bash
set -euo pipefail

LOG_FILE="/home/pi/git/bet_knesset_times/shul_summary_cron.log"
SCRIPT="/home/pi/git/bet_knesset_times/shul_weekly_summary.py"

echo "==========================================" >> "$LOG_FILE"
echo "[$(date -Iseconds)] Starting weekly Shul summary generation" >> "$LOG_FILE"

cd /home/pi/git/bet_knesset_times
python3 "$SCRIPT" --send >> "$LOG_FILE" 2>&1

echo "[$(date -Iseconds)] Finished weekly Shul summary generation" >> "$LOG_FILE"
