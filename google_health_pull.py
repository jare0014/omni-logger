import os
import re
import sys
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

def get_google_access_token():
    token_path = TOKEN_PATH
    if not os.path.exists(token_path):
        token_path = FALLBACK_TOKEN_PATH
        
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
    date_dt = datetime.datetime.strptime(date_str, "%Y-%m-%d")
    
    # Start time is 12:00:00 PM of the previous day
    start_dt = date_dt - datetime.timedelta(days=1)
    start_dt = start_dt.replace(hour=12, minute=0, second=0, microsecond=0)
    
    # End time is 11:59:59.999 PM of the target day
    end_dt = date_dt.replace(hour=23, minute=59, second=59, microsecond=999999)
    
    start_iso = start_dt.isoformat() + "Z"
    end_iso = end_dt.isoformat() + "Z"
    
    url = f"https://www.googleapis.com/fitness/v1/users/me/sessions?activityType=72&startTime={start_iso}&endTime={end_iso}"
    
    headers = {"Authorization": f"Bearer {token}"}
    
    results = {
        "wake_up": None,
        "Sleep_hours": None,
        "HRV": None,
        "caffeine": None,
        "alcohol": None
    }
    
    try:
        res = requests.get(url, headers=headers, timeout=10)
        if res.status_code == 200:
            data = res.json()
            sessions = data.get("session", [])
            if sessions:
                main_sleep = sessions[0]
                max_duration = int(main_sleep.get("endTimeMillis", 0)) - int(main_sleep.get("startTimeMillis", 0))
                
                for s in sessions[1:]:
                    dur = int(s.get("endTimeMillis", 0)) - int(s.get("startTimeMillis", 0))
                    if dur > max_duration:
                        max_duration = dur
                        main_sleep = s
                        
                start_millis = int(main_sleep.get("startTimeMillis", 0))
                end_millis = int(main_sleep.get("endTimeMillis", 0))
                
                total_minutes = (end_millis - start_millis) // 60000
                hours = total_minutes // 60
                mins = total_minutes % 60
                results["Sleep_hours"] = f"{hours}:{mins:02d}"
                
                wake_up_dt = datetime.datetime.fromtimestamp(end_millis / 1000.0)
                results["wake_up"] = f"{wake_up_dt.hour}:{wake_up_dt.minute:02d}"
        else:
            raise RuntimeError(f"Google Fit API returned status {res.status_code}: {res.text}")
    except Exception as e:
        print(f"Error: Google Health sleep fetch failed: {e}")
        raise
        
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
        
        # Loading view
        self.loading_label = tk.Label(
            self, 
            text="Getting Google Health data...\nPlease wait...", 
            fg=self.fg_color, 
            bg=self.bg_color, 
            font=("Helvetica", 14, "bold")
        )
        self.loading_label.pack(expand=True)
        
        # Start fetch thread
        threading.Thread(target=self.fetch_data, daemon=True).start()
        
    def fetch_data(self):
        try:
            token = get_google_access_token()
            self.fitbit_data = get_google_health_data(token, self.date_str)
            self.after(0, self.render_form)
        except Exception as e:
            err_str = str(e)
            self.after(0, lambda: self.handle_fetch_error(err_str))
            
    def handle_fetch_error(self, err_msg):
        self.loading_label.pack_forget()
        err_lbl = tk.Label(
            self, 
            text=f"Google Health Sync Unavailable:\n{err_msg}\n\nLoading manual entry...", 
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
                
            # If blank, fallback to Fitbit fetched data
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
        print("Google OAuth is handled directly in the Obsidian settings tab. Please configure it there.")
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
