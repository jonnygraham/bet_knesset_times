#!/bin/bash
set -eo pipefail

LOG_FILE="/home/pi/git/bet_knesset_times/shul_summary_cron.log"
PROMPT_FILE="/home/pi/git/bet_knesset_times/WEEKLY_SHUL_SUMMARY_PROMPT.md"
PREPARE_SCRIPT="/home/pi/git/bet_knesset_times/prepare_shul_context.py"
FALLBACK_SCRIPT="/home/pi/git/bet_knesset_times/shul_weekly_summary.py"

echo "==========================================" >> "$LOG_FILE"
echo "[$(date -Iseconds)] Starting weekly Shul summary workflow" >> "$LOG_FILE"

cd /home/pi/git/bet_knesset_times

# Step 1: Collect raw context data
echo "[$(date -Iseconds)] Fetching raw shul context..." >> "$LOG_FILE"
python3 "$PREPARE_SCRIPT" >> "$LOG_FILE" 2>&1

# Step 2: Run agy with Gemini 3.8 Flash (medium) using Antigravity subscription
echo "[$(date -Iseconds)] Invoking agy LLM agent..." >> "$LOG_FILE"
if /home/pi/.local/bin/agy --model gemini-3.8-flash-medium --dangerously-skip-permissions -p "$(cat "$PROMPT_FILE")" >> "$LOG_FILE" 2>&1; then
    echo "[$(date -Iseconds)] agy completed successfully." >> "$LOG_FILE"
else
    echo "[$(date -Iseconds)] agy encountered an error. Running deterministic fallback script..." >> "$LOG_FILE"
    python3 "$FALLBACK_SCRIPT" --send >> "$LOG_FILE" 2>&1
fi

echo "[$(date -Iseconds)] Finished weekly Shul summary workflow" >> "$LOG_FILE"
