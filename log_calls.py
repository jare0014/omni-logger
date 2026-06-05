import os
import re
import sys
import json
import base64
import threading
import requests
import tkinter as tk
from tkinter import filedialog, messagebox

def get_gemini_key():
    # 1. Check environment variables first
    env_key = os.environ.get("GEMINI_API_KEY")
    if env_key:
        return env_key

    # 2. Check local data.json settings file
    data_json_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data.json")
    if os.path.exists(data_json_path):
        try:
            with open(data_json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            key = data.get("geminiApiKey")
            if key and key.strip():
                return key.strip()
        except Exception:
            pass

    # 3. Check legacy fitbit_credentials.json
    creds_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fitbit_credentials.json")
    if os.path.exists(creds_path):
        try:
            with open(creds_path, "r", encoding="utf-8") as f:
                creds = json.load(f)
            key = creds.get("gemini_api_key")
            if key and key.strip():
                return key.strip()
        except Exception:
            pass

    # 4. Check schedule assistant data.json as a fallback
    try:
        vault_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        sa_data_path = os.path.join(vault_dir, ".obsidian", "plugins", "schedule-assistant-focus-timer", "data.json")
        if os.path.exists(sa_data_path):
            with open(sa_data_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            key = data.get("geminiApiKey")
            if key and key.strip():
                return key.strip()
    except Exception:
        pass

    raise FileNotFoundError("Gemini API Key not found in environment, omni-logger/data.json, or schedule-assistant-focus-timer/data.json. Please configure the key in Obsidian settings.")

def update_note_calls(content, calls_dict):
    keys = ["calls-08am", "calls-09am", "calls-10am", "calls-11am", "calls-12pm", "calls-01pm", "calls-02pm", "calls-03pm", "calls-04pm"]
    
    # Check if any call keys are already in the file
    has_keys = any(f"{k}::" in content for k in keys)
    
    if has_keys:
        # Replace individual lines
        for k in keys:
            val = calls_dict.get(k, 0)
            pattern = rf"{k}::\s*\d*"
            content = re.sub(pattern, f"{k}:: {val}", content)
    else:
        # Append a new block at the bottom
        block_lines = [""]
        for k in keys:
            val = calls_dict.get(k, 0)
            block_lines.append(f"{k}:: {val}")
        content = content.rstrip() + "\n" + "\n".join(block_lines) + "\n"
        
    return content

class CallsLogger:
    def __init__(self, file_path):
        self.file_path = file_path
        
        # Hide root window
        self.root = tk.Tk()
        self.root.withdraw()
        
        try:
            self.api_key = get_gemini_key()
        except Exception as e:
            messagebox.showerror("Configuration Error", str(e))
            self.root.destroy()
            return
            
        # 1. Check clipboard first
        from PIL import ImageGrab, Image
        import io
        
        img_bytes = None
        mime_type = "image/png"
        
        try:
            clipboard_data = ImageGrab.grabclipboard()
            if isinstance(clipboard_data, Image.Image):
                use_clipboard = messagebox.askyesno(
                    "Clipboard Image Found", 
                    "An image was found in your clipboard. Do you want to process it?"
                )
                if use_clipboard:
                    buf = io.BytesIO()
                    clipboard_data.save(buf, format="PNG")
                    img_bytes = buf.getvalue()
            elif isinstance(clipboard_data, list) and clipboard_data:
                first_file = clipboard_data[0]
                if os.path.exists(first_file) and first_file.lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.bmp')):
                    use_clipboard = messagebox.askyesno(
                        "Clipboard Image File Found", 
                        f"Copied image file '{os.path.basename(first_file)}' found in clipboard. Do you want to process it?"
                    )
                    if use_clipboard:
                        with open(first_file, "rb") as f:
                            img_bytes = f.read()
                        if first_file.lower().endswith(('.jpg', '.jpeg')):
                            mime_type = "image/jpeg"
                        elif first_file.lower().endswith('.webp'):
                            mime_type = "image/webp"
                        elif first_file.lower().endswith('.bmp'):
                            mime_type = "image/bmp"
        except Exception as e:
            print(f"Error checking clipboard: {e}")

        img_path = None
        if img_bytes is None:
            img_path = filedialog.askopenfilename(
                title="Select Work Call Log Screenshot",
                filetypes=[("Image files", "*.png *.jpg *.jpeg *.webp *.bmp")]
            )
            
            if not img_path:
                # User cancelled
                self.root.destroy()
                return
            
        # 2. Show loading window
        self.loading_win = tk.Toplevel(self.root)
        self.loading_win.title("Processing OCR")
        self.loading_win.geometry("320x130")
        self.loading_win.configure(bg="#1e1e2e")
        self.loading_win.resizable(False, False)
        
        # Ensure the window knows its own size before calculating
        self.loading_win.update_idletasks()

        # Get window dimensions and screen dimensions
        width = self.loading_win.winfo_width()
        height = self.loading_win.winfo_height()
        screen_width = self.loading_win.winfo_screenwidth()
        screen_height = self.loading_win.winfo_screenheight()

        # Calculate center coordinates
        x = (screen_width // 2) - (width // 2)
        y = (screen_height // 2) - (height // 2)

        # Apply the geometry placement
        self.loading_win.geometry(f'{width}x{height}+{x}+{y}')
        
        lbl = tk.Label(
            self.loading_win, 
            text="Extracting Call Log data...\nPlease wait while Gemini analyzes screenshot.", 
            fg="#cdd6f4", 
            bg="#1e1e2e", 
            font=("Helvetica", 11, "bold"),
            pady=20
        )
        lbl.pack(expand=True)
        self.loading_win.update()
        
        # 3. Process in background thread
        threading.Thread(target=self.process_image, args=(img_path, img_bytes, mime_type), daemon=True).start()
        self.root.mainloop()
        
    def process_image(self, img_path, img_bytes=None, mime_type="image/png"):
        try:
            if img_bytes is not None:
                img_data = base64.b64encode(img_bytes).decode("utf-8")
            else:
                # Read and encode image
                with open(img_path, "rb") as f:
                    img_data = base64.b64encode(f.read()).decode("utf-8")
                    
                mime_type = "image/png"
                if img_path.lower().endswith(".jpg") or img_path.lower().endswith(".jpeg"):
                    mime_type = "image/jpeg"
                elif img_path.lower().endswith(".webp"):
                    mime_type = "image/webp"
                elif img_path.lower().endswith(".bmp"):
                    mime_type = "image/bmp"
                
            prompt = """
            You are a call log analyzer. Examine this phone call logs screenshot and count the number of outgoing and incoming call entries (excluding entries that are clearly not work-related if indicated, otherwise count all calls shown) grouped by hourly blocks from 8 AM to 4 PM for the target day.
            
            Map each call to the hour of its timestamp:
            - 8:00 AM - 8:59 AM -> calls-08am
            - 9:00 AM - 9:59 AM -> calls-09am
            - 10:00 AM - 10:59 AM -> calls-10am
            - 11:00 AM - 11:59 AM -> calls-11am
            - 12:00 PM - 12:59 PM -> calls-12pm
            - 1:00 PM - 1:59 PM -> calls-01pm
            - 2:00 PM - 2:59 PM -> calls-02pm
            - 3:00 PM - 3:59 PM -> calls-03pm
            - 4:00 PM - 4:59 PM -> calls-04pm
            
            Return your findings STRICTLY in a JSON format matching this schema:
            {
              "calls-08am": <integer_count>,
              "calls-09am": <integer_count>,
              "calls-10am": <integer_count>,
              "calls-11am": <integer_count>,
              "calls-12pm": <integer_count>,
              "calls-01pm": <integer_count>,
              "calls-02pm": <integer_count>,
              "calls-03pm": <integer_count>,
              "calls-04pm": <integer_count>
            }
            Ensure no other text is returned besides the JSON.
            """
            
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={self.api_key}"
            headers = {"Content-Type": "application/json"}
            payload = {
                "contents": [
                    {
                        "parts": [
                            {"text": prompt},
                            {
                                "inlineData": {
                                    "mimeType": mime_type,
                                    "data": img_data
                                }
                            }
                        ]
                    }
                ],
                "generationConfig": {
                    "responseMimeType": "application/json"
                }
            }
            
            res = requests.post(url, headers=headers, json=payload, timeout=30)
            if res.status_code != 200:
                raise RuntimeError(f"Gemini API returned error: {res.text}")
                
            res_data = res.json()
            text_response = res_data["candidates"][0]["content"]["parts"][0]["text"].strip()
            
            # Parse output JSON
            calls_dict = json.loads(text_response)
            
            # Verify and update daily note
            with open(self.file_path, "r", encoding="utf-8") as f:
                content = f.read()
                
            updated_content = update_note_calls(content, calls_dict)
            with open(self.file_path, "w", encoding="utf-8") as f:
                f.write(updated_content)
                
            self.after_main(lambda: messagebox.showinfo("Success", "Successfully extracted and saved call counts to daily note!"))
        except Exception as e:
            self.after_main(lambda: messagebox.showerror("OCR Error", f"Failed to extract call logs: {e}"))
        finally:
            self.after_main(self.root.destroy)
            
    def after_main(self, fn):
        self.root.after(0, fn)

def main():
    if len(sys.argv) < 2:
        print("Usage: python log_calls.py <file_path>")
        sys.exit(1)
    file_path = sys.argv[1]
    CallsLogger(file_path)

if __name__ == "__main__":
    main()