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

def log_biometrics_to_note(file_path, date_str):
    default_api = "google-health"
    if os.path.exists(FITBIT_TOKEN_PATH) or os.environ.get("FITBIT_CLIENT_ID"):
        default_api = "fitbit"
    api_type = os.environ.get("DATA_SOURCE_API", default_api).lower()

    # 1. Fetch data
    print(f"Fetching biometric data for {date_str} via {api_type}...")
    try:
        if api_type == "fitbit":
            creds = load_fitbit_credentials()
            refreshed_creds = refresh_fitbit_token(creds)
            data = get_fitbit_data(refreshed_creds, date_str)
        else:
            token = get_google_access_token()
            data = get_google_health_data(token, date_str)
    except Exception as e:
        print(f"Error fetching biometric data: {e}")
        sys.exit(1)

    hrv = data.get("HRV")

    if hrv is None:
        print("Warning: No HRV data resolved from API.")
        return

    # 2. Get configuration
    sync_config = load_health_sync_config()
    hrv_cfg = sync_config.get("hrv", {"enabled": True, "key": "HRV", "destination": "frontmatter"})
    
    if not hrv_cfg.get("enabled", True):
        print("HRV sync is disabled in configuration.")
        return

    key = hrv_cfg.get("key", "HRV")
    dest = hrv_cfg.get("destination", "frontmatter")

    # Build updates map
    updates = {key: str(hrv)}

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

    print(f"Successfully logged HRV ({hrv}) to {dest} in daily note.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Log biometric data to daily note.")
    parser.add_argument("--file", required=True, help="Obsidian Daily Note File Path")
    parser.add_argument("--date", help="Target date YYYY-MM-DD (defaults to today)")
    args = parser.parse_args()

    date_val = args.date
    if not date_val:
        date_val = datetime.date.today().strftime("%Y-%m-%d")

    log_biometrics_to_note(args.file, date_val)
