import os
import sys
import json
import argparse
import requests
import datetime

# Add omni-logger path to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from health_utils import (
    get_google_access_token,
    load_health_sync_config
)

def post_food_to_api(food_id, amount, registry_path=None):
    # 1. Load go-to items registry
    json_path = registry_path
    if not json_path:
        json_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "health_go_to_items.json")
        
    if not os.path.exists(json_path):
        print(f"Error: {json_path} not found.")
        sys.exit(1)
        
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    items = {item["id"]: item for item in data.get("go_to_items", [])}
    if food_id not in items:
        print(f"Error: Food ID '{food_id}' not found in go-to items.")
        sys.exit(1)
        
    food = items[food_id]
    food_name = food["name"]
    health_type = food["health_connect_type"]
    nutrients = food.get("nutrients", {})
    alcohol_g = food.get("alcohol_g", 14.0)
    water_ml = food.get("water_ml", 250.0)
    
    print(f"Posting {amount} serving(s) of '{food_name}' via API...")
    
    # 2. Post to Google Health REST API
    try:
        token = get_google_access_token()
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        
        now_dt = datetime.datetime.now(datetime.timezone.utc)
        start_iso = (now_dt - datetime.timedelta(minutes=1)).strftime("%Y-%m-%dT%H:%M:%SZ")
        end_iso = now_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        
        # Calculate local timezone offset
        offset = datetime.datetime.now().astimezone().utcoffset()
        offset_seconds = int(offset.total_seconds()) if offset else 0
        offset_str = f"{offset_seconds}s"
        
        interval = {
            "startTime": start_iso,
            "endTime": end_iso,
            "startUtcOffset": offset_str,
            "endUtcOffset": offset_str
        }
        
        if health_type == "nutrition":
            nutrients_list = []
            for k, v in nutrients.items():
                nutrients_list.append({
                    "nutrient": k.upper(),
                    "quantity": {
                        "grams": float(v * amount)
                    }
                })
                
            payload = {
                "nutritionLog": {
                    "interval": interval,
                    "foodDisplayName": food_name,
                    "nutrients": nutrients_list,
                    "mealType": "SNACK"
                }
            }
            url = "https://health.googleapis.com/v4/users/me/dataTypes/nutrition-log/dataPoints"
        elif health_type == "alcohol_consumption":
            payload = {
                "alcoholConsumption": {
                    "interval": interval,
                    "amount": float(amount * alcohol_g)
                }
            }
            url = "https://health.googleapis.com/v4/users/me/dataTypes/alcohol-consumption/dataPoints"
        elif health_type == "hydration":
            payload = {
                "hydrationLog": {
                    "interval": interval,
                    "amountConsumed": {
                        "milliliters": float(amount * water_ml)
                    }
                }
            }
            url = "https://health.googleapis.com/v4/users/me/dataTypes/hydration-log/dataPoints"
        else:
            print(f"Unsupported health connect type: {health_type}")
            return
            
        res = requests.post(url, json=payload, headers=headers, timeout=15)
        if res.status_code in [200, 201]:
            print("Successfully logged via HealthAPI.")
        else:
            print(f"Warning: Google Health API returned status {res.status_code}: {res.text}")
    except Exception as e:
        print(f"Warning: Failed to post to Google Health API: {e}")
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--id", required=True, help="Food Item ID")
    parser.add_argument("--amount", type=float, default=1.0, help="Amount/servings")
    parser.add_argument("--registry", required=False, help="Path to registry JSON")
    args = parser.parse_args()
    
    post_food_to_api(args.id, args.amount, args.registry)
