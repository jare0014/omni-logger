import os
import sys
import json
import urllib.parse
import requests
import datetime

# Add omni-logger path to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from health_utils import get_google_access_token

def query_thursday_nutrition():
    try:
        token = get_google_access_token()
        print("Successfully obtained Google Health OAuth Access Token.")
    except Exception as e:
        print(f"Failed to get OAuth token: {e}")
        return
        
    headers = {"Authorization": f"Bearer {token}"}
    
    # Thursday June 25, 2026
    start_iso = "2026-06-25T00:00:00Z"
    end_iso = "2026-06-25T23:59:59Z"
    
    # We will try both nutrition-log and regular nutrition filter formats to see what works
    nutrition_filter = f'nutrition_log.interval.start_time >= "{start_iso}" AND nutrition_log.interval.start_time < "{end_iso}"'
    url = f"https://health.googleapis.com/v4/users/me/dataTypes/nutrition-log/dataPoints?filter={urllib.parse.quote(nutrition_filter)}"
    
    print(f"\nQuerying: {url}\n")
    
    try:
        res = requests.get(url, headers=headers, timeout=15)
        print(f"Status Code: {res.status_code}")
        if res.status_code == 200:
            data = res.json()
            print("\nResponse JSON:")
            print(json.dumps(data, indent=2))
        else:
            print(f"Error Body: {res.text}")
            
            # Let's try querying without a filter to see all recent data points if any exist
            print("\nTrying raw query without date filter to check general availability...")
            raw_url = "https://health.googleapis.com/v4/users/me/dataTypes/nutrition-log/dataPoints"
            res_raw = requests.get(raw_url, headers=headers, timeout=15)
            print(f"Raw Query Status: {res_raw.status_code}")
            if res_raw.status_code == 200:
                print(json.dumps(res_raw.json(), indent=2))
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    query_thursday_nutrition()
