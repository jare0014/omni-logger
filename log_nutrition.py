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

def log_nutrition_to_note(file_path, date_str):
    default_api = "google-health"
    if os.path.exists(FITBIT_TOKEN_PATH) or os.environ.get("FITBIT_CLIENT_ID"):
        default_api = "fitbit"
    api_type = os.environ.get("DATA_SOURCE_API", default_api).lower()

    # 1. Fetch data
    print(f"Fetching nutrition metrics for {date_str} via {api_type}...")
    try:
        if api_type == "fitbit":
            creds = load_fitbit_credentials()
            refreshed_creds = refresh_fitbit_token(creds)
            data = get_fitbit_data(refreshed_creds, date_str)
        else:
            token = get_google_access_token()
            data = get_google_health_data(token, date_str)
    except Exception as e:
        print(f"Error fetching nutrition data: {e}")
        sys.exit(1)

    # 2. Get configuration
    sync_config = load_health_sync_config()

    # Map categories to API data keys and defaults
    categories = {
        "calories": {"key": "calories", "default_note_key": "calories", "val": data.get("calories")},
        "protein": {"key": "protein", "default_note_key": "protein", "val": data.get("protein")},
        "caffeine": {"key": "caffeine", "default_note_key": "caffeine", "val": data.get("caffeine")},
        "alcohol": {"key": "alcohol", "default_note_key": "alcohol", "val": data.get("alcohol")},
        "hydration": {"key": "hydration", "default_note_key": "hydration", "val": data.get("hydration")}
    }

    yaml_updates = {}
    dataview_updates = {}
    append_updates = {}

    for cat_name, info in categories.items():
        cfg = sync_config.get(cat_name, {"enabled": True if cat_name in ["caffeine", "alcohol", "hydration"] else False, "key": info["default_note_key"], "destination": "frontmatter"})
        if not cfg.get("enabled", False):
            continue

        val = info["val"]
        if val is None:
            continue

        note_key = cfg.get("key", info["default_note_key"])
        dest = cfg.get("destination", "frontmatter")
        val_str = str(val)

        if dest == "frontmatter":
            yaml_updates[note_key] = val_str
        elif dest == "dataview":
            dataview_updates[note_key] = val_str
        elif dest == "append-log":
            append_updates[note_key] = val_str

    # 3. Apply updates to the note if any exist
    if not yaml_updates and not dataview_updates and not append_updates:
        print("No enabled nutrition metrics retrieved from API.")
        return

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    if yaml_updates:
        content = update_frontmatter(content, yaml_updates)
    if dataview_updates:
        content = update_dataview_fields(content, dataview_updates)
    if append_updates:
        content = append_to_bottom_log(content, append_updates)

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"Successfully logged nutrition metrics to daily note.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Log nutrition metrics to daily note.")
    parser.add_argument("--file", required=True, help="Obsidian Daily Note File Path")
    parser.add_argument("--date", help="Target date YYYY-MM-DD (defaults to today)")
    args = parser.parse_args()

    date_val = args.date
    if not date_val:
        date_val = datetime.date.today().strftime("%Y-%m-%d")

    log_nutrition_to_note(args.file, date_val)
