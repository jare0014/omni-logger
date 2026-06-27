import os
import re
import sys

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
import json
import time
import base64
import urllib.parse
import webbrowser
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
import requests
import tkinter as tk
from tkinter import ttk, messagebox
import datetime

TOKEN_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "token.json")
FALLBACK_TOKEN_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "schedule-assistant-focus-timer",
    "token.json"
)

FITBIT_TOKEN_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fitbit_token.json")

# --- GOOGLE OAUTH ACCESS ---
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
            
    # Token expired, let's refresh
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
                    # Also support camelCase field foodDisplayName as fallback
                    name = (val_obj.get("foodDisplayName") or val_obj.get("foodName") or val_obj.get("name") or val_obj.get("title") or "").lower()
                    
                    # Google Health API nutrients list is an array of NutrientQuantity:
                    # [{"nutrient": "CAFFEINE", "quantity": {"grams": 0.15}}]
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
                        # Fallback for old map format
                        direct_caff = nutrients_list.get("caffeine", 0.0)
                        direct_alc = nutrients_list.get("alcohol", 0.0)
                        direct_protein = nutrients_list.get("protein", 0.0)
                        
                    # Calories value is stored under energy.kcal
                    energy_obj = val_obj.get("energy", {})
                    direct_energy = energy_obj.get("kcal", 0.0) if isinstance(energy_obj, dict) else energy_obj
                    
                    serving_obj = val_obj.get("serving", {})
                    amount = serving_obj.get("amount", 1.0) if isinstance(serving_obj, dict) else val_obj.get("amount", 1.0)
                    
                    if direct_caff > 0.0:
                        # Google Health API stores caffeine in grams, convert back to mg
                        caffeine_count += (direct_caff * 1000.0)
                    elif any(kw in name for kw in caffeine_kws):
                        caffeine_count += amount * 95.0
                        
                    if direct_alc > 0.0:
                        # Google Health API stores alcohol in grams
                        alcohol_count += direct_alc
                    elif any(kw in name for kw in alcohol_kws):
                        alcohol_count += amount * 14.0
                        
                    protein_count += direct_protein
                    calories_count += direct_energy
            
            if caffeine_count > 0.0:
                results["caffeine"] = round(caffeine_count)
            if alcohol_count > 0.0:
                results["alcohol"] = round(alcohol_count)
            if protein_count > 0.0:
                results["protein"] = round(protein_count)
            if calories_count > 0.0:
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
            if points:
                alc_count = 0.0
                for pt in points:
                    val_obj = pt.get("alcoholConsumption", pt.get("value", {}))
                    interval = val_obj.get("interval", {})
                    start_time_str = interval.get("startTime", "")
                    if not start_time_str:
                        continue
                    if day_start_iso <= start_time_str <= day_end_iso:
                        # Add raw grams of alcohol (standard drink defaults to 14.0g)
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
            if points:
                hyd_sum = 0.0
                for pt in points:
                    val_obj = pt.get("hydrationLog", pt.get("value", {}))
                    interval = val_obj.get("interval", {})
                    start_time_str = interval.get("startTime", "")
                    if not start_time_str:
                        continue
                    if day_start_iso <= start_time_str <= day_end_iso:
                        # Support milliliters field or amountConsumed.milliliters in v4
                        amount_consumed = val_obj.get("amountConsumed", {})
                        volume = amount_consumed.get("milliliters", 0.0) if isinstance(amount_consumed, dict) else val_obj.get("amount", val_obj.get("volume", 0.0))
                        hyd_sum += volume if "amountConsumed" in val_obj else (volume * 1000.0)
                results["hydration"] = round(hyd_sum)
    except Exception as e:
        print(f"Warning: Google Health hydration pull failed: {e}")
        
    return results


# --- FITBIT ACCESS & REFRESH ---
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
            
            if os.environ.get("FITBIT_CLIENT_ID"):
                print(f"JSON_OUTPUT: {json.dumps(creds)}")
            else:
                with open(FITBIT_TOKEN_PATH, "w", encoding="utf-8") as f:
                    json.dump(creds, f, indent=2)
        else:
            raise RuntimeError(f"Failed to refresh Fitbit token: {res.text}")
            
    return creds

def get_fitbit_data(creds, date_str):
    access_token = creds["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}
    
    date_dt = datetime.datetime.strptime(date_str, "%Y-%m-%d")
    yesterday_str = date_str  # Pull nutrition for the target date itself
    
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
        food_url = f"https://api.fitbit.com/1/user/-/foods/log/date/{yesterday_str}.json"
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


# --- NOTE HANDLERS ---
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
    # Default fallbacks
    return {
        "sleep": {"enabled": True, "key": "Sleep_hours", "destination": "frontmatter"},
        "hrv": {"enabled": True, "key": "HRV", "destination": "frontmatter"},
        "caffeine": {"enabled": True, "key": "caffeine", "destination": "frontmatter"},
        "alcohol": {"enabled": True, "key": "alcohol", "destination": "frontmatter"},
        "hydration": {"enabled": True, "key": "hydration", "destination": "frontmatter"}
    }


# --- TKINTER GUI ---
class CheckInApp(tk.Tk):
    def __init__(self, file_path, date_str):
        super().__init__()
        self.file_path = file_path
        self.date_str = date_str
        default_api = "google-health"
        if os.path.exists(FITBIT_TOKEN_PATH) or os.environ.get("FITBIT_CLIENT_ID"):
            default_api = "fitbit"
        self.api_type = os.environ.get("DATA_SOURCE_API", default_api).lower()
        
        self.title("Daily Check-In")
        self.geometry("380x555")
        self.resizable(False, False)
        
        # Dark Theme Palette
        self.bg_color = "#1e1e2e"
        self.fg_color = "#cdd6f4"
        self.accent_color = "#cba6f7"
        self.entry_bg = "#313244"
        self.entry_fg = "#f5e0dc"
        
        self.configure(bg=self.bg_color)
        
        loading_text = "Getting Fitbit data...\nPlease wait..." if self.api_type == "fitbit" else "Getting Google Health data...\nPlease wait..."
        
        self.loading_label = tk.Label(
            self, 
            text=loading_text, 
            fg=self.fg_color, 
            bg=self.bg_color, 
            font=("Helvetica", 14, "bold")
        )
        self.loading_label.pack(expand=True)
        
        threading.Thread(target=self.fetch_data, daemon=True).start()
        
    def fetch_data(self):
        try:
            if self.api_type == "fitbit":
                creds = load_fitbit_credentials()
                refreshed_creds = refresh_fitbit_token(creds)
                self.fitbit_data = get_fitbit_data(refreshed_creds, self.date_str)
            else:
                token = get_google_access_token()
                self.fitbit_data = get_google_health_data(token, self.date_str)
            
            self.after(0, self.render_form)
        except Exception as e:
            err_str = str(e)
            self.after(0, lambda: self.handle_fetch_error(err_str))
            
    def handle_no_data(self):
        self.loading_label.pack_forget()
        provider_name = "Fitbit" if self.api_type == "fitbit" else "Google Health"
        info_lbl = tk.Label(
            self, 
            text=f"{provider_name} Sync: Success,\nbut no sleep data found for today.\n\nOpening manual entry...", 
            fg="#f9e2af", 
            bg=self.bg_color, 
            font=("Helvetica", 11)
        )
        info_lbl.pack(expand=True)
        self.fitbit_data = {}
        self.after(2000, lambda: [info_lbl.pack_forget(), self.render_form()])
            
    def handle_fetch_error(self, err_msg):
        self.loading_label.pack_forget()
        provider_name = "Fitbit" if self.api_type == "fitbit" else "Google Health"
        err_lbl = tk.Label(
            self, 
            text=f"{provider_name} Sync Unavailable:\n{err_msg[:80]}\n\nLoading manual entry...", 
            fg="#f38ba8", 
            bg=self.bg_color, 
            font=("Helvetica", 11)
        )
        err_lbl.pack(expand=True)
        self.fitbit_data = {}
        self.after(3000, lambda: [err_lbl.pack_forget(), self.render_form()])
        
    def render_form(self):
        self.loading_label.pack_forget()
        try:
            with open(self.file_path, "r", encoding="utf-8") as f:
                content = f.read()
            self.note_content = content
            self.existing_fm = parse_frontmatter(content)
        except Exception as e:
            messagebox.showerror("Error", f"Could not read daily note: {e}")
            self.destroy()
            return
            
        sync_config = load_health_sync_config()
        
        # UI Header
        header = tk.Label(
            self, 
            text=f"Daily Check-In: {self.date_str}", 
            fg=self.accent_color, 
            bg=self.bg_color, 
            font=("Helvetica", 14, "bold"),
            pady=15
        )
        header.pack()
        
        # Grid frame
        grid_frame = tk.Frame(self, bg=self.bg_color)
        grid_frame.pack(padx=20, fill="both", expand=True)
        
        # Dynamically build fields list based on configuration
        fields = []
        
        # Sleep
        sleep_cfg = sync_config.get("sleep", {})
        if sleep_cfg.get("enabled", True):
            fields.append((sleep_cfg.get("key", "Sleep_hours"), "Sleep Hours (H:MM)", "Sleep_hours", "sleep"))
            fields.append(("wake_up", "Wake Up Time (H:MM)", "wake_up", "sleep"))
            
        # HRV
        hrv_cfg = sync_config.get("hrv", {})
        if hrv_cfg.get("enabled", True):
            fields.append((hrv_cfg.get("key", "HRV"), "Heart Rate Variability (ms)", "HRV", "hrv"))
            
        # Caffeine
        caff_cfg = sync_config.get("caffeine", {})
        if caff_cfg.get("enabled", True):
            fields.append((caff_cfg.get("key", "caffeine"), "Caffeine Count", "caffeine", "caffeine"))
            
        # Alcohol
        alc_cfg = sync_config.get("alcohol", {})
        if alc_cfg.get("enabled", True):
            fields.append((alc_cfg.get("key", "alcohol"), "Alcohol Count", "alcohol", "alcohol"))
            
        # Hydration
        hyd_cfg = sync_config.get("hydration", {})
        if hyd_cfg.get("enabled", True):
            fields.append((hyd_cfg.get("key", "hydration"), "Hydration/Water (ml)", "hydration", "hydration"))
            
        # Protein
        prot_cfg = sync_config.get("protein", {})
        if prot_cfg.get("enabled", False):
            fields.append((prot_cfg.get("key", "protein"), "Protein Intake (g)", "protein", "protein"))
            
        # Calories
        cal_cfg = sync_config.get("calories", {})
        if cal_cfg.get("enabled", False):
            fields.append((cal_cfg.get("key", "calories"), "Calories Intake (kcal)", "calories", "calories"))
            
        # Static check-in scores
        fields.append(("Sleep_score", "Sleep Score / Quality", None, "static"))
        fields.append(("Readiness", "Readiness Score", None, "static"))
        
        self.entries = {}
        for idx, (key, label_text, fitbit_key, category) in enumerate(fields):
            lbl = tk.Label(
                grid_frame, 
                text=label_text, 
                fg=self.fg_color, 
                bg=self.bg_color, 
                font=("Helvetica", 10),
                anchor="w"
            )
            lbl.grid(row=idx, column=0, sticky="ew", pady=5)
            
            entry = tk.Entry(
                grid_frame, 
                bg=self.entry_bg, 
                fg=self.entry_fg, 
                insertbackground=self.fg_color, 
                font=("Helvetica", 11),
                bd=0, 
                highlightthickness=1, 
                highlightcolor=self.accent_color, 
                highlightbackground="#45475a"
            )
            entry.grid(row=idx, column=1, sticky="ew", pady=5, padx=(10, 0))
            
            # Retrieve initial value based on category destination
            dest = "frontmatter"
            if category == "sleep" and key != "wake_up":
                dest = sync_config.get("sleep", {}).get("destination", "frontmatter")
            elif category == "sleep" and key == "wake_up":
                dest = sync_config.get("sleep", {}).get("destination", "frontmatter")
            elif category in sync_config:
                dest = sync_config.get(category, {}).get("destination", "frontmatter")
                
            start_val = ""
            if dest == "frontmatter" or category == "static":
                start_val = self.existing_fm.get(key, "")
            elif dest == "dataview":
                match = re.search(rf"^\s*{re.escape(key)}::\s*(.*?)\s*$", content, re.MULTILINE)
                start_val = match.group(1) if match else ""
            elif dest == "append-log":
                match = re.search(rf"^\s*-\s*\[health_sync\]\s*{re.escape(key)}:\s*(.*?)\s*$", content, re.MULTILINE)
                start_val = match.group(1) if match else ""
                
            if start_val == "-":
                start_val = ""
                
            if not start_val and fitbit_key and self.fitbit_data.get(fitbit_key) is not None:
                start_val = str(self.fitbit_data[fitbit_key])
                
            entry.insert(0, start_val)
            self.entries[key] = entry
            
        grid_frame.columnconfigure(1, weight=1)
        
        save_btn = tk.Button(
            self, 
            text="Save & Sync Note", 
            command=self.save_data, 
            bg="#a6e3a1", 
            fg="#11111b", 
            activebackground="#89dceb", 
            font=("Helvetica", 11, "bold"),
            bd=0, 
            pady=8
        )
        save_btn.pack(fill="x", padx=30, pady=20)
        
    def save_data(self):
        sync_config = load_health_sync_config()
        
        yaml_updates = {}
        dataview_updates = {}
        append_updates = {}
        
        for key, entry in self.entries.items():
            val = entry.get().strip()
            val_str = val if val else "-"
            
            dest = "frontmatter"
            # Default sleep / static variables mapping
            if key == "wake_up":
                dest = sync_config.get("sleep", {}).get("destination", "frontmatter")
            elif key in ["Sleep_score", "Readiness"]:
                dest = "frontmatter"
            else:
                for mKey, mConfig in sync_config.items():
                    if mConfig.get("key") == key:
                        dest = mConfig.get("destination", "frontmatter")
                        break
            
            if dest == "frontmatter":
                yaml_updates[key] = val_str
            elif dest == "dataview":
                dataview_updates[key] = val_str
            elif dest == "append-log":
                append_updates[key] = val_str
                
        try:
            updated_content = self.note_content
            if yaml_updates:
                updated_content = update_frontmatter(updated_content, yaml_updates)
            if dataview_updates:
                updated_content = update_dataview_fields(updated_content, dataview_updates)
            if append_updates:
                updated_content = append_to_bottom_log(updated_content, append_updates)
                
            with open(self.file_path, "w", encoding="utf-8") as f:
                f.write(updated_content)
                
            print("Successfully updated daily note with health check-in data.")
            self.destroy()
        except Exception as e:
            messagebox.showerror("Error", f"Failed to save note: {e}")

def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  Sync:   python google_health_pull.py <file_path>")
        sys.exit(1)
        
    arg = sys.argv[1]
    
    if arg == "--login":
        print("OAuth is handled directly in the Obsidian settings tab. Please configure it there.")
        sys.exit(0)
        
    if not os.path.exists(arg):
        print(f"Error: File not found: {arg}")
        sys.exit(1)
        
    filename = os.path.basename(arg)
    date_match = re.search(r"\d{4}-\d{2}-\d{2}", filename)
    if date_match:
        date_str = date_match.group(0)
    else:
        date_str = time.strftime("%Y-%m-%d")
        
    app = CheckInApp(arg, date_str)
    app.mainloop()

if __name__ == "__main__":
    main()
