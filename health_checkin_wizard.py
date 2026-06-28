import os
import sys
import time
import datetime
import threading
import tkinter as tk
from tkinter import ttk, messagebox

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
        self.geometry("380x240")
        self.resizable(False, False)
        
        # Center the window on the screen
        self.update_idletasks()
        width = self.winfo_width()
        height = self.winfo_height()
        screen_width = self.winfo_screenwidth()
        screen_height = self.winfo_screenheight()
        x = (screen_width // 2) - (width // 2)
        y = (screen_height // 2) - (height // 2)
        self.geometry(f'{width}x{height}+{x}+{y}')
        
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
            font=("Helvetica", 12, "bold")
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
            
    def handle_fetch_error(self, err_msg):
        self.loading_label.pack_forget()
        provider_name = "Fitbit" if self.api_type == "fitbit" else "Google Health"
        err_lbl = tk.Label(
            self, 
            text=f"{provider_name} Sync Unavailable:\n{err_msg[:80]}\n\nLoading manual entry...", 
            fg="#f38ba8", 
            bg=self.bg_color, 
            font=("Helvetica", 10)
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
            
        header = tk.Label(
            self, 
            text=f"Daily Check-In: {self.date_str}", 
            fg=self.accent_color, 
            bg=self.bg_color, 
            font=("Helvetica", 12, "bold"),
            pady=15
        )
        header.pack()
        
        grid_frame = tk.Frame(self, bg=self.bg_color)
        grid_frame.pack(padx=20, fill="both", expand=True)
        
        fields = [
            ("Sleep_score", "Sleep Score / Quality", None, "static"),
            ("Readiness", "Readiness Score", None, "static")
        ]
        
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
            
            start_val = self.existing_fm.get(key, "")
            if start_val == "-":
                start_val = ""
                
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
        
        for key in ["Sleep_score", "Readiness"]:
            entry = self.entries.get(key)
            if entry:
                val = entry.get().strip()
                val_str = val if val else "-"
                yaml_updates[key] = val_str
                
        api_mappings = [
            ("sleep", "Sleep_hours", "Sleep_hours"),
            ("sleep", "wake_up", "wake_up"),
            ("hrv", "HRV", "HRV"),
            ("caffeine", "caffeine", "caffeine"),
            ("alcohol", "alcohol", "alcohol"),
            ("hydration", "hydration", "hydration"),
            ("protein", "protein", "protein"),
            ("calories", "calories", "calories")
        ]
        
        for category, fitbit_key, default_note_key in api_mappings:
            cfg = sync_config.get(category, {})
            if category == "sleep" or cfg.get("enabled", True if category in ["hrv", "caffeine", "alcohol", "hydration"] else False):
                note_key = cfg.get("key", default_note_key) if category != "sleep" or fitbit_key == "Sleep_hours" else default_note_key
                if fitbit_key == "wake_up" and category == "sleep":
                    note_key = "wake_up"
                
                val = self.fitbit_data.get(fitbit_key)
                if val is not None:
                    dest = cfg.get("destination", "frontmatter")
                    val_str = str(val)
                    if dest == "frontmatter":
                        yaml_updates[note_key] = val_str
                    elif dest == "dataview":
                        dataview_updates[note_key] = val_str
                    elif dest == "append-log":
                        append_updates[note_key] = val_str
                
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
        print("  python health_checkin_wizard.py <file_path> [date_str]")
        sys.exit(1)
        
    file_path = sys.argv[1]
    date_str = sys.argv[2] if len(sys.argv) > 2 else datetime.date.today().strftime("%Y-%m-%d")
    
    app = CheckInApp(file_path, date_str)
    app.mainloop()

if __name__ == "__main__":
    main()
