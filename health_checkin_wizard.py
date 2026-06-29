import os
import sys
import datetime
import argparse

# Add omni-logger path to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from health_utils import (
    get_google_access_token,
    load_fitbit_credentials,
    refresh_fitbit_token,
    get_google_health_data,
    get_fitbit_data,
    update_frontmatter,
    update_dataview_fields,
    append_to_bottom_log,
    load_health_sync_config,
    FITBIT_TOKEN_PATH
)

def main():
    parser = argparse.ArgumentParser(description="Silent health data sync to daily note.")
    parser.add_argument("file_path", help="Absolute path to the Obsidian daily note file.")
    parser.add_argument("date_str", nargs="?", default=datetime.date.today().strftime("%Y-%m-%d"),
                        help="Date to pull data for (YYYY-MM-DD). Defaults to today.")
    args = parser.parse_args()

    file_path = args.file_path
    date_str = args.date_str

    if not os.path.exists(file_path):
        print(f"Error: Daily note not found at {file_path}")
        sys.exit(1)

    # Determine API source
    api_type = os.environ.get("DATA_SOURCE_API", "").lower()
    if not api_type:
        api_type = "fitbit" if (os.path.exists(FITBIT_TOKEN_PATH) or os.environ.get("FITBIT_CLIENT_ID")) else "google-health"

    print(f"[Health Sync] Pulling {api_type} data for {date_str}...")

    health_data = {}
    try:
        if api_type == "fitbit":
            creds = load_fitbit_credentials()
            refreshed_creds = refresh_fitbit_token(creds)
            health_data = get_fitbit_data(refreshed_creds, date_str)
        else:
            token = get_google_access_token()
            health_data = get_google_health_data(token, date_str)
        print(f"[Health Sync] Fetched {len(health_data)} metric(s).")
    except Exception as e:
        print(f"[Health Sync] API fetch failed: {e}. Skipping API data.")

    sync_config = load_health_sync_config()

    api_mappings = [
        ("sleep",     "Sleep_hours", "Sleep_hours"),
        ("sleep",     "wake_up",     "wake_up"),
        ("hrv",       "HRV",         "HRV"),
        ("caffeine",  "caffeine",    "caffeine"),
        ("alcohol",   "alcohol",     "alcohol"),
        ("hydration", "hydration",   "hydration"),
        ("protein",   "protein",     "protein"),
        ("calories",  "calories",    "calories"),
    ]

    yaml_updates = {}
    dataview_updates = {}
    append_updates = {}

    for category, data_key, default_note_key in api_mappings:
        cfg = sync_config.get(category, {})
        enabled_default = category in ("sleep", "hrv", "caffeine", "alcohol", "hydration")
        if not cfg.get("enabled", enabled_default):
            continue

        note_key = cfg.get("key", default_note_key)
        # wake_up always uses its own key regardless of sleep config key
        if data_key == "wake_up":
            note_key = "wake_up"

        val = health_data.get(data_key)
        if val is None:
            continue

        dest = cfg.get("destination", "frontmatter")
        if dest == "frontmatter":
            yaml_updates[note_key] = str(val)
        elif dest == "dataview":
            dataview_updates[note_key] = str(val)
        elif dest == "append-log":
            append_updates[note_key] = str(val)

    if not yaml_updates and not dataview_updates and not append_updates:
        print("[Health Sync] No data to write. Done.")
        sys.exit(0)

    try:
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

        written = list(yaml_updates) + list(dataview_updates) + list(append_updates)
        print(f"[Health Sync] Updated daily note: {written}")
    except Exception as e:
        print(f"[Health Sync] Failed to write note: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
