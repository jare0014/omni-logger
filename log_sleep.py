import os
import sys
import json
import argparse
import datetime

# Add omni-logger path to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from health_utils import (
    get_google_access_token,
    load_fitbit_credentials,
    refresh_fitbit_token,
    get_google_health_data,
    get_fitbit_data,
    parse_frontmatter,
    update_frontmatter,
    update_dataview_fields,
    append_to_bottom_log,
    load_health_sync_config,
    TOKEN_PATH,
    FITBIT_TOKEN_PATH
)

def log_sleep_to_note(file_path, date_str):
    default_api = "google-health"
    if os.path.exists(FITBIT_TOKEN_PATH) or os.environ.get("FITBIT_CLIENT_ID"):
        default_api = "fitbit"
    api_type = os.environ.get("DATA_SOURCE_API", default_api).lower()

    # 1. Fetch data
    print(f"Fetching sleep data for {date_str} via {api_type}...")
    try:
        if api_type == "fitbit":
            creds = load_fitbit_credentials()
            refreshed_creds = refresh_fitbit_token(creds)
            data = get_fitbit_data(refreshed_creds, date_str)
        else:
            token = get_google_access_token()
            data = get_google_health_data(token, date_str)
    except Exception as e:
        print(f"Error fetching sleep data: {e}")
        sys.exit(1)

    sleep_hours = data.get("Sleep_hours")
    wake_up = data.get("wake_up")

    if not sleep_hours:
        print("Warning: No sleep duration data resolved from API.")
        return

    # 2. Get configuration
    sync_config = load_health_sync_config()
    sleep_cfg = sync_config.get("sleep", {"enabled": True, "key": "Sleep_hours", "destination": "frontmatter"})
    
    if not sleep_cfg.get("enabled", True):
        print("Sleep sync is disabled in configuration.")
        return

    key = sleep_cfg.get("key", "Sleep_hours")
    dest = sleep_cfg.get("destination", "frontmatter")

    # Build updates map
    updates = {key: sleep_hours}
    if wake_up:
        updates["wake_up"] = wake_up

    # 3. Apply updates to the note
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    if dest == "frontmatter":
        content = update_frontmatter(content, updates)
    elif dest == "dataview":
        content = update_dataview_fields(content, updates)
    elif dest == "append-log":
        content = append_to_bottom_log(content, updates)

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"Successfully logged sleep ({sleep_hours}, wake-up {wake_up}) to {dest} in daily note.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Log sleep data to daily note.")
    parser.add_argument("--file", required=True, help="Obsidian Daily Note File Path")
    parser.add_argument("--date", help="Target date YYYY-MM-DD (defaults to today)")
    args = parser.parse_args()

    date_val = args.date
    if not date_val:
        date_val = datetime.date.today().strftime("%Y-%m-%d")

    log_sleep_to_note(args.file, date_val)
