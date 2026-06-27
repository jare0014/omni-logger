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
    
    start_dt = (date_dt - datetime.timedelta(days=1)).replace(hour=12, minute=0, second=0, microsecond=0)
    end_dt = date_dt.replace(hour=12, minute=0, second=0, microsecond=0)
    
    start_iso = start_dt.astimezone(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    end_iso = end_dt.astimezone(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    
    sleep_filter = f'sleep.interval.end_time >= "{start_iso}" AND sleep.interval.end_time < "{end_iso}"'
    sleep_url = f"https://health.googleapis.com/v4/users/me/dataTypes/sleep/dataPoints?filter={urllib.parse.quote(sleep_filter)}"
    
    results = {
        "wake_up": None,
        "Sleep_hours": None,
        "HRV": None,
        "caffeine": None,
        "alcohol": None
    }
    
    print(f"Querying Google Health API from {start_iso} to {end_iso}...")
    
    # 1. Fetch Sleep
    res = requests.get(sleep_url, headers=headers, timeout=10)
    print(f"Sleep API Response Status: {res.status_code}")
    if res.status_code == 200:
        data = res.json()
        points = data.get("dataPoints", [])
        print(f"Sleep API returned {len(points)} data points.")
        if points:
            # Sort points by end_time descending
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
        raise RuntimeError(f"Google Health API Sleep endpoint returned status {res.status_code}: {res.text}")
        
    # 2. Fetch HRV
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
        
    return results


# --- FITBIT ACCESS & REFRESH ---
def load_fitbit_credentials():
    # 1. Environment variables (Stateless execution inside Obsidian plugin)
    client_id = os.environ.get("FITBIT_CLIENT_ID")
    if client_id:
        return {
            "client_id": client_id,
            "client_secret": os.environ.get("FITBIT_CLIENT_SECRET"),
            "access_token": os.environ.get("FITBIT_ACCESS_TOKEN"),
            "refresh_token": os.environ.get("FITBIT_REFRESH_TOKEN"),
            "expiry_timestamp": float(os.environ.get("FITBIT_EXPIRY") or 0)
        }
        
    # 2. Local token file (manual/testing mode)
    if os.path.exists(FITBIT_TOKEN_PATH):
        with open(FITBIT_TOKEN_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
            
    raise FileNotFoundError(
        "Fitbit credentials not found in environment or on disk. Please configure Fitbit in settings first."
    )

def refresh_fitbit_token(creds):
    current_time = time.time()
    expiry = creds.get("expiry_timestamp", 0)
    
    # Refresh token if within 60 seconds of expiration
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
            
            # Save updated credentials
            if os.environ.get("FITBIT_CLIENT_ID"):
                # Output to stdout so parent JS plugin can swallow updated credentials into secure keychain
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
    yesterday_dt = date_dt - datetime.timedelta(days=1)
    yesterday_str = yesterday_dt.strftime("%Y-%m-%d")
    
    results = {
        "wake_up": None,
        "Sleep_hours": None,
        "HRV": None,
        "caffeine": None,
        "alcohol": None
    }
    
    # 1. Fetch Sleep
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
                
                # Sleep Hours (H:MM)
                min_asleep = main_sleep.get("minutesAsleep", 0)
                hours = int(min_asleep // 60)
                mins = int(min_asleep % 60)
                results["Sleep_hours"] = f"{hours}:{mins:02d}"
                
                # Wake Up (endTime format YYYY-MM-DDTHH:MM:SS.000)
                end_time_str = main_sleep.get("endTime", "")
                if end_time_str and "T" in end_time_str:
                    time_part = end_time_str.split("T")[1][:5]
                    hours_str, mins_str = time_part.split(":")
                    results["wake_up"] = f"{int(hours_str)}:{mins_str}"
        else:
            print(f"Fitbit Sleep API status code: {res.status_code}, Body: {res.text}")
    except Exception as e:
        print(f"Warning: Sleep pull failed: {e}")
        
    # 2. Fetch HRV
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
        
    # 3. Fetch Nutrition (yesterday)
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


# --- FRONTMATTER HANDLERS ---
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
        self.geometry("380x520")
        self.resizable(False, False)
        
        # Dark Theme Palette
        self.bg_color = "#1e1e2e"
        self.fg_color = "#cdd6f4"
        self.accent_color = "#cba6f7"
        self.entry_bg = "#313244"
        self.entry_fg = "#f5e0dc"
        
        self.configure(bg=self.bg_color)
        
        loading_text = "Getting Fitbit data...\nPlease wait..." if self.api_type == "fitbit" else "Getting Google Health data...\nPlease wait..."
        
        # Loading view
        self.loading_label = tk.Label(
            self, 
            text=loading_text, 
            fg=self.fg_color, 
            bg=self.bg_color, 
            font=("Helvetica", 14, "bold")
        )
        self.loading_label.pack(expand=True)
        
        # Start fetch thread
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
            
            if not self.fitbit_data.get("Sleep_hours"):
                self.after(0, self.handle_no_data)
            else:
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
        # Load note content and parse existing frontmatter
        try:
            with open(self.file_path, "r", encoding="utf-8") as f:
                content = f.read()
            self.note_content = content
            self.existing_fm = parse_frontmatter(content)
        except Exception as e:
            messagebox.showerror("Error", f"Could not read daily note: {e}")
            self.destroy()
            return
            
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
        
        # Field variables setup
        self.entries = {}
        fields = [
            ("wake_up", "Wake Up Time (H:MM)", "wake_up"),
            ("Sleep_hours", "Sleep Hours (H:MM)", "Sleep_hours"),
            ("HRV", "Heart Rate Variability (ms)", "HRV"),
            ("caffeine", "Caffeine Count (Previous Day)", "caffeine"),
            ("alcohol", "Alcohol Count (Previous Day)", "alcohol"),
            ("Sleep_score", "Sleep Score / Quality", None),
            ("Readiness", "Readiness Score", None)
        ]
        
        for idx, (key, label_text, fitbit_key) in enumerate(fields):
            # Label
            lbl = tk.Label(
                grid_frame, 
                text=label_text, 
                fg=self.fg_color, 
                bg=self.bg_color, 
                font=("Helvetica", 10),
                anchor="w"
            )
            lbl.grid(row=idx, column=0, sticky="ew", pady=6)
            
            # Entry box
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
            entry.grid(row=idx, column=1, sticky="ew", pady=6, padx=(10, 0))
            
            # Determine starting value
            start_val = self.existing_fm.get(key, "")
            if start_val == "-":
                start_val = ""
                
            # If blank, fallback to Fitbit/Google Fit fetched data
            if not start_val and fitbit_key and self.fitbit_data.get(fitbit_key) is not None:
                start_val = str(self.fitbit_data[fitbit_key])
                
            entry.insert(0, start_val)
            self.entries[key] = entry
            
        grid_frame.columnconfigure(1, weight=1)
        
        # Save Button
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
        updates = {}
        for key, entry in self.entries.items():
            val = entry.get().strip()
            updates[key] = val if val else "-"
            
        try:
            updated_content = update_frontmatter(self.note_content, updates)
            with open(self.file_path, "w", encoding="utf-8") as f:
                f.write(updated_content)
            print("Successfully updated daily note frontmatter with check-in data.")
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
        
    # Extract date from daily note filename (format: YYYY-MM-DD.md)
    filename = os.path.basename(arg)
    date_match = re.search(r"\d{4}-\d{2}-\d{2}", filename)
    if date_match:
        date_str = date_match.group(0)
    else:
        date_str = time.strftime("%Y-%m-%d")
        
    # Launch Tkinter GUI on main thread
    app = CheckInApp(arg, date_str)
    app.mainloop()

if __name__ == "__main__":
    main()
