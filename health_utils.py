import os
import re
import sys
import json
import time
import base64
import datetime
import requests
import urllib.parse

if sys.platform == 'win32':
    py_dir = os.path.dirname(sys.executable)
    dlls_dir = os.path.join(py_dir, 'DLLs')
    if os.path.exists(dlls_dir):
        try:
            os.add_dll_directory(dlls_dir)
        except Exception:
            pass
    try:
        os.add_dll_directory(py_dir)
    except Exception:
        pass
    os.environ['PATH'] = dlls_dir + os.path.pathsep + py_dir + os.path.pathsep + os.environ.get('PATH', '')

TOKEN_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "token.json")
FITBIT_TOKEN_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fitbit_token.json")

def get_google_access_token():
    token_path = TOKEN_PATH
    if not os.path.exists(token_path):
        raise FileNotFoundError(
            f"Google Health token.json not found. Please authorize through Omni-Logger or Schedule Assistant settings first."
        )
        
    with open(token_path, "r", encoding="utf-8") as f:
        token_data = json.load(f)
        
    expiry_str = token_data.get("expiry")
    if expiry_str:
        cleaned_expiry = expiry_str.replace("Z", "")
        try:
            expiry_dt = datetime.datetime.fromisoformat(cleaned_expiry)
        except Exception:
            try:
                expiry_dt = datetime.datetime.strptime(cleaned_expiry.split('.')[0], "%Y-%m-%dT%H:%M:%S")
            except Exception:
                expiry_dt = datetime.datetime.utcnow() - datetime.timedelta(hours=1)
                
        now_dt = datetime.datetime.utcnow()
        if (expiry_dt - now_dt).total_seconds() > 60:
            return token_data.get("token")
            
    print(f"Google access token expired. Refreshing token at {token_path}...")
    url = token_data.get("token_uri", "https://oauth2.googleapis.com/token")
    
    payload = {
        "grant_type": "refresh_token",
        "client_id": token_data.get("client_id"),
        "client_secret": token_data.get("client_secret"),
        "refresh_token": token_data.get("refresh_token")
    }
    
    res = requests.post(url, data=payload, timeout=10)
    if res.status_code == 200:
        res_data = res.json()
        token_data["token"] = res_data["access_token"]
        if "expires_in" in res_data:
            new_expiry = datetime.datetime.utcnow() + datetime.timedelta(seconds=res_data["expires_in"])
            token_data["expiry"] = new_expiry.isoformat() + "Z"
            
        with open(token_path, "w", encoding="utf-8") as f:
            json.dump(token_data, f, indent=2)
            
        return token_data["token"]
    else:
        raise RuntimeError(f"Failed to refresh Google Health access token: {res.text}")

def load_fitbit_credentials():
    client_id = os.environ.get("FITBIT_CLIENT_ID")
    if client_id:
        return {
            "client_id": client_id,
            "client_secret": os.environ.get("FITBIT_CLIENT_SECRET"),
            "access_token": os.environ.get("FITBIT_ACCESS_TOKEN"),
            "refresh_token": os.environ.get("FITBIT_REFRESH_TOKEN"),
            "expiry_timestamp": float(os.environ.get("FITBIT_EXPIRY") or 0)
        }
        
    if os.path.exists(FITBIT_TOKEN_PATH):
        with open(FITBIT_TOKEN_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
            
    raise FileNotFoundError(
        "Fitbit credentials not found in environment or on disk. Please configure Fitbit in settings first."
    )

def refresh_fitbit_token(creds):
    current_time = time.time()
    expiry = creds.get("expiry_timestamp", 0)
    
    if current_time >= expiry - 60:
        client_id = creds["client_id"]
        client_secret = creds["client_secret"]
        refresh_token = creds["refresh_token"]
        
        encoded = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
        headers = {
            "Authorization": f"Basic {encoded}",
            "Content-Type": "application/x-www-form-urlencoded"
        }
        data = {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token
        }
        
        res = requests.post("https://api.fitbit.com/oauth2/token", headers=headers, data=data, timeout=10)
        if res.status_code == 200:
            res_data = res.json()
            creds["access_token"] = res_data["access_token"]
            creds["refresh_token"] = res_data["refresh_token"]
            creds["expiry_timestamp"] = time.time() + res_data["expires_in"]
            
            if not os.environ.get("FITBIT_CLIENT_ID"):
                with open(FITBIT_TOKEN_PATH, "w", encoding="utf-8") as f:
                    json.dump(creds, f, indent=2)
        else:
            raise RuntimeError(f"Failed to refresh Fitbit token: {res.text}")
            
    return creds

def parse_frontmatter(content):
    match = re.match(r"^---\r?\n(.*?)\r?\n---", content, re.DOTALL)
    if not match:
        return {}
    fm_text = match.group(1)
    fm_dict = {}
    for line in fm_text.splitlines():
        if ":" in line:
            parts = line.split(":", 1)
            key = parts[0].strip()
            val = parts[1].strip().strip('"').strip("'")
            fm_dict[key] = val
    return fm_dict

def update_frontmatter(content, updates):
    match = re.match(r"^---\r?\n(.*?)\r?\n---", content, re.DOTALL)
    if not match:
        return content
    fm_text = match.group(1)
    
    new_lines = []
    keys_updated = set()
    for line in fm_text.splitlines():
        if ":" in line:
            parts = line.split(":", 1)
            key = parts[0].strip()
            if key in updates:
                new_val = updates[key]
                if new_val is None or new_val == "" or new_val == "-":
                    new_lines.append(f"{key}:")
                else:
                    new_lines.append(f'{key}: "{new_val}"')
                keys_updated.add(key)
            else:
                new_lines.append(line)
        else:
            new_lines.append(line)
            
    for key, val in updates.items():
        if key not in keys_updated:
            if val is None or val == "" or val == "-":
                new_lines.append(f"{key}:")
            else:
                new_lines.append(f'{key}: "{val}"')
                
    new_fm_text = "\n".join(new_lines)
    return f"---\n{new_fm_text}\n---" + content[match.end():]

def update_dataview_fields(content, updates):
    fm_match = re.match(r"^---\r?\n.*?\r?\n---", content, re.DOTALL)
    if fm_match:
        fm_part = fm_match.group(0)
        body_part = content[fm_match.end():]
    else:
        fm_part = ""
        body_part = content
        
    for key, val in updates.items():
        pattern = re.compile(rf"^\s*{re.escape(key)}::.*$", re.MULTILINE)
        if pattern.search(body_part):
            body_part = pattern.sub(f"{key}:: {val}", body_part)
        else:
            body_part = body_part.rstrip() + f"\n{key}:: {val}\n"
            
    return fm_part + body_part

def append_to_bottom_log(content, updates):
    body_part = content
    log_entries = []
    for key, val in updates.items():
        log_entries.append(f"- [health_sync] {key}: {val}")
    
    if log_entries:
        git_start = body_part.find("<!--START_Antigravity_Git_Log-->")
        new_text = "\n" + "\n".join(log_entries) + "\n\n"
        if git_start != -1:
            body_part = body_part[:git_start] + new_text + body_part[git_start:]
        else:
            body_part = body_part.rstrip() + "\n" + new_text
            
    return body_part

def load_health_sync_config():
    config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data.json")
    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("healthSyncConfig", {})
        except Exception as e:
            print(f"Warning: Failed to load healthSyncConfig: {e}")
            
    return {
        "sleep": {"enabled": True, "key": "Sleep_hours", "destination": "frontmatter"},
        "hrv": {"enabled": True, "key": "HRV", "destination": "frontmatter"},
        "caffeine": {"enabled": True, "key": "caffeine", "destination": "frontmatter"},
        "alcohol": {"enabled": True, "key": "alcohol", "destination": "frontmatter"},
        "hydration": {"enabled": True, "key": "hydration", "destination": "frontmatter"}
    }

def get_google_health_data(token, date_str):
    headers = {"Authorization": f"Bearer {token}"}
    
    local_tz = datetime.datetime.now().astimezone().tzinfo
    date_dt = datetime.datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=local_tz)
    
    # Sleep session window (noon yesterday to noon today)
    start_dt = (date_dt - datetime.timedelta(days=1)).replace(hour=12, minute=0, second=0, microsecond=0)
    end_dt = date_dt.replace(hour=12, minute=0, second=0, microsecond=0)
    
    start_iso = start_dt.astimezone(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    end_iso = end_dt.astimezone(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    
    # Active day window (00:00:00 to 23:59:59 local on target day) for active logs
    day_start_dt = date_dt.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end_dt = date_dt.replace(hour=23, minute=59, second=59, microsecond=0)
    
    day_start_iso = day_start_dt.astimezone(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    day_end_iso = day_end_dt.astimezone(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    
    sleep_filter = f'sleep.interval.end_time >= "{start_iso}" AND sleep.interval.end_time < "{end_iso}"'
    sleep_url = f"https://health.googleapis.com/v4/users/me/dataTypes/sleep/dataPoints?filter={urllib.parse.quote(sleep_filter)}"
    
    results = {
        "wake_up": None,
        "Sleep_hours": None,
        "HRV": None,
        "caffeine": None,
        "alcohol": None,
        "hydration": None,
        "protein": None,
        "calories": None
    }
    
    print(f"Querying Google Health API from {start_iso} to {end_iso}...")
    
    # 1. Fetch Sleep
    try:
        res = requests.get(sleep_url, headers=headers, timeout=10)
        print(f"Sleep API Response Status: {res.status_code}")
        if res.status_code == 200:
            data = res.json()
            points = data.get("dataPoints", [])
            print(f"Sleep API returned {len(points)} data points.")
            if points:
                points.sort(key=lambda p: p.get("sleep", {}).get("interval", {}).get("endTime", ""), reverse=True)
                main_sleep = points[0].get("sleep", {})
                
                total_mins = int(main_sleep.get("summary", {}).get("minutesAsleep", 0))
                hours = total_mins // 60
                mins = total_mins % 60
                results["Sleep_hours"] = f"{hours}:{mins:02d}"
                
                end_time_str = main_sleep.get("interval", {}).get("endTime", "")
                if end_time_str:
                    if end_time_str.endswith("Z"):
                        end_time_str = end_time_str[:-1]
                    try:
                        dt = datetime.datetime.fromisoformat(end_time_str)
                        utc_ts = dt.replace(tzinfo=datetime.timezone.utc).timestamp()
                        local_dt = datetime.datetime.fromtimestamp(utc_ts)
                        results["wake_up"] = f"{local_dt.hour}:{local_dt.minute:02d}"
                    except Exception as e:
                        print(f"Warning: failed to parse end time: {e}")
        else:
            print(f"Warning: Google Health API Sleep endpoint returned status {res.status_code}: {res.text}")
    except Exception as e:
        print(f"Warning: Sleep pull failed: {e}")
        
    # 2. Fetch HRV
    try:
        next_dt = date_dt + datetime.timedelta(days=1)
        next_date_str = next_dt.strftime("%Y-%m-%d")
        hrv_filter = f'daily_heart_rate_variability.date >= "{date_str}" AND daily_heart_rate_variability.date < "{next_date_str}"'
        hrv_url = f"https://health.googleapis.com/v4/users/me/dataTypes/daily-heart-rate-variability/dataPoints?filter={urllib.parse.quote(hrv_filter)}"
        
        res = requests.get(hrv_url, headers=headers, timeout=10)
        if res.status_code == 200:
            data = res.json()
            points = data.get("dataPoints", [])
            if points:
                val = points[0].get("dailyHeartRateVariability", {}).get("averageHeartRateVariabilityMilliseconds", 0)
                if not val:
                    val = points[0].get("dailyHeartRateVariability", {}).get("deepSleepRootMeanSquareOfSuccessiveDifferencesMilliseconds", 0)
                results["HRV"] = round(val)
        else:
            print(f"Warning: Google Health API HRV endpoint returned status {res.status_code}: {res.text}")
    except Exception as e:
        print(f"Warning: HRV pull failed: {e}")
        
    # 3. Fetch Nutrition (Caffeine/Alcohol/Protein/Calories)
    try:
        nutrition_url = "https://health.googleapis.com/v4/users/me/dataTypes/nutrition-log/dataPoints"
        res = requests.get(nutrition_url, headers=headers, timeout=10)
        
        caffeine_kws = ["coffee", "espresso", "latte", "caffeine", "tea", "energy drink", "cappuccino", "macchiato", "cold brew"]
        alcohol_kws = ["beer", "wine", "whiskey", "vodka", "cider", "alcohol", "rum", "gin", "cocktail", "tequila", "sake", "champagne", "bourbon", "ipa", "ale", "stout", "liqueur"]
        
        caffeine_count = 0.0
        alcohol_count = 0.0
        protein_count = 0.0
        calories_count = 0.0
        
        if res.status_code == 200:
            data = res.json()
            points = data.get("dataPoints", [])
            for pt in points:
                val_obj = pt.get("nutritionLog", pt.get("value", {}))
                interval = val_obj.get("interval", {})
                start_time_str = interval.get("startTime", "")
                if not start_time_str:
                    continue
                # Local check to match target day
                if day_start_iso <= start_time_str <= day_end_iso:
                    name = (val_obj.get("foodDisplayName") or val_obj.get("foodName") or val_obj.get("name") or val_obj.get("title") or "").lower()
                    
                    nutrients_list = val_obj.get("nutrients", [])
                    direct_caff = 0.0
                    direct_alc = 0.0
                    direct_protein = 0.0
                    direct_energy = 0.0
                    
                    if isinstance(nutrients_list, list):
                        for item in nutrients_list:
                            n_type = item.get("nutrient", "")
                            qty = item.get("quantity", {}).get("grams", 0.0)
                            if n_type == "CAFFEINE":
                                direct_caff = qty
                            elif n_type == "ALCOHOL":
                                direct_alc = qty
                            elif n_type == "PROTEIN":
                                direct_protein = qty
                    else:
                        direct_caff = nutrients_list.get("caffeine", 0.0)
                        direct_alc = nutrients_list.get("alcohol", 0.0)
                        direct_protein = nutrients_list.get("protein", 0.0)
                        
                    energy_obj = val_obj.get("energy", {})
                    direct_energy = energy_obj.get("kcal", 0.0) if isinstance(energy_obj, dict) else energy_obj
                    
                    serving_obj = val_obj.get("serving", {})
                    amount = serving_obj.get("amount", 1.0) if isinstance(serving_obj, dict) else val_obj.get("amount", 1.0)
                    
                    if direct_caff > 0.0:
                        caffeine_count += (direct_caff * 1000.0)
                    elif any(kw in name for kw in caffeine_kws):
                        caffeine_count += amount * 95.0
                        
                    if direct_alc > 0.0:
                        alcohol_count += direct_alc
                    elif any(kw in name for kw in alcohol_kws):
                        alcohol_count += amount * 14.0
                        
                    protein_count += direct_protein
                    calories_count += direct_energy
            
            results["caffeine"] = round(caffeine_count)
            results["alcohol"] = round(alcohol_count)
            results["protein"] = round(protein_count)
            results["calories"] = round(calories_count)
        else:
            print(f"Warning: Google Health API nutrition-log status code: {res.status_code}: {res.text}")
    except Exception as e:
        print(f"Warning: Google Health nutrition sync failed: {e}")
        
    # 4. Fetch Alcohol Consumption logs specifically
    try:
        alc_url = "https://health.googleapis.com/v4/users/me/dataTypes/alcohol-consumption/dataPoints"
        res = requests.get(alc_url, headers=headers, timeout=10)
        if res.status_code == 200:
            data = res.json()
            points = data.get("dataPoints", [])
            alc_count = 0.0
            for pt in points:
                val_obj = pt.get("alcoholConsumption", pt.get("value", {}))
                interval = val_obj.get("interval", {})
                start_time_str = interval.get("startTime", "")
                if not start_time_str:
                    continue
                if day_start_iso <= start_time_str <= day_end_iso:
                    alc_count += val_obj.get("amount", 14.0)
            results["alcohol"] = round(alc_count + (results["alcohol"] or 0.0))
    except Exception as e:
        print(f"Warning: Google Health alcohol-consumption sync failed: {e}")
        
    # 5. Fetch Hydration
    try:
        hyd_url = "https://health.googleapis.com/v4/users/me/dataTypes/hydration-log/dataPoints"
        res = requests.get(hyd_url, headers=headers, timeout=10)
        if res.status_code == 200:
            data = res.json()
            points = data.get("dataPoints", [])
            hyd_sum = 0.0
            for pt in points:
                val_obj = pt.get("hydrationLog", pt.get("value", {}))
                interval = val_obj.get("interval", {})
                start_time_str = interval.get("startTime", "")
                if not start_time_str:
                    continue
                if day_start_iso <= start_time_str <= day_end_iso:
                    amount_consumed = val_obj.get("amountConsumed", {})
                    volume = amount_consumed.get("milliliters", 0.0) if isinstance(amount_consumed, dict) else val_obj.get("amount", val_obj.get("volume", 0.0))
                    hyd_sum += volume if "amountConsumed" in val_obj else (volume * 1000.0)
            results["hydration"] = round(hyd_sum)
    except Exception as e:
        print(f"Warning: Google Health hydration pull failed: {e}")
        
    return results

def get_fitbit_data(creds, date_str):
    access_token = creds["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}
    
    results = {
        "wake_up": None,
        "Sleep_hours": None,
        "HRV": None,
        "caffeine": None,
        "alcohol": None,
        "hydration": None,
        "protein": None,
        "calories": None
    }
    
    try:
        sleep_url = f"https://api.fitbit.com/1.2/user/-/sleep/date/{date_str}.json"
        res = requests.get(sleep_url, headers=headers, timeout=10)
        if res.status_code == 200:
            sleep_data = res.json()
            sleep_logs = sleep_data.get("sleep", [])
            if sleep_logs:
                main_sleep = None
                for log in sleep_logs:
                    if log.get("isMainSleep", True):
                        main_sleep = log
                        break
                if not main_sleep:
                    main_sleep = sleep_logs[0]
                
                min_asleep = main_sleep.get("minutesAsleep", 0)
                hours = int(min_asleep // 60)
                mins = int(min_asleep % 60)
                results["Sleep_hours"] = f"{hours}:{mins:02d}"
                
                end_time_str = main_sleep.get("endTime", "")
                if end_time_str and "T" in end_time_str:
                    time_part = end_time_str.split("T")[1][:5]
                    hours_str, mins_str = time_part.split(":")
                    results["wake_up"] = f"{int(hours_str)}:{mins_str}"
    except Exception as e:
        print(f"Warning: Sleep pull failed: {e}")
        
    try:
        hrv_url = f"https://api.fitbit.com/1/user/-/hrv/date/{date_str}.json"
        res = requests.get(hrv_url, headers=headers, timeout=10)
        if res.status_code == 200:
            hrv_data = res.json()
            hrv_logs = hrv_data.get("hrv", [])
            if hrv_logs:
                val_obj = hrv_logs[0].get("value", {})
                results["HRV"] = round(val_obj.get("dailyRmssd", val_obj.get("rmssd", 0)))
    except Exception as e:
        print(f"Warning: HRV pull failed: {e}")
        
    try:
        food_url = f"https://api.fitbit.com/1/user/-/foods/log/date/{date_str}.json"
        res = requests.get(food_url, headers=headers, timeout=10)
        if res.status_code == 200:
            food_data = res.json()
            
            caffeine_kws = ["coffee", "espresso", "latte", "caffeine", "tea", "energy drink", "cappuccino", "macchiato", "cold brew"]
            alcohol_kws = ["beer", "wine", "whiskey", "vodka", "cider", "alcohol", "rum", "gin", "cocktail", "tequila", "sake", "champagne", "bourbon", "ipa", "ale", "stout", "liqueur"]
            
            caffeine_count = 0.0
            alcohol_count = 0.0
            
            for log in food_data.get("foods", []):
                logged_food = log.get("loggedFood", {})
                name = logged_food.get("name", "").lower()
                amount = log.get("amount", 1.0)
                
                if any(kw in name for kw in caffeine_kws):
                    caffeine_count += amount
                elif any(kw in name for kw in alcohol_kws):
                    alcohol_count += amount
            
            results["caffeine"] = round(caffeine_count)
            results["alcohol"] = round(alcohol_count)
    except Exception as e:
        print(f"Warning: Nutrition logs pull failed: {e}")
        
    return results
