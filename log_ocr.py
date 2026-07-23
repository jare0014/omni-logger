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
import base64
import threading
import requests
import argparse
import tkinter as tk
from tkinter import filedialog, messagebox

def get_gemini_key():
    env_key = os.environ.get("GEMINI_API_KEY")
    if env_key:
        return env_key

    plugin_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Check for .env file in plugin or parent directories
    for search_dir in [plugin_dir, os.path.dirname(plugin_dir), os.path.dirname(os.path.dirname(plugin_dir))]:
        env_path = os.path.join(search_dir, ".env")
        if os.path.exists(env_path):
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    for line in f:
                        if line.strip().startswith("GEMINI_API_KEY="):
                            parts = line.strip().split("=", 1)
                            key = parts[1].strip().strip('"').strip("'")
                            if key:
                                return key
            except Exception:
                pass

    data_json_path = os.path.join(plugin_dir, "data.json")
    if os.path.exists(data_json_path):
        try:
            with open(data_json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            key = data.get("geminiApiKey")
            if key and key.strip():
                return key.strip()
        except Exception:
            pass

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

    raise FileNotFoundError("Gemini API Key not found. Please configure the key in Obsidian settings or a local .env file.")

def format_yaml_value(val, indent=2):
    lines = []
    if isinstance(val, list):
        for item in val:
            if isinstance(item, dict):
                first = True
                for k, v in item.items():
                    if first:
                        lines.append(f"{' ' * (indent - 2)}- {k}: {v}")
                        first = False
                    else:
                        lines.append(f"{' ' * indent}{k}: {v}")
            else:
                lines.append(f"{' ' * (indent - 2)}- {item}")
    elif isinstance(val, dict):
        for k, v in val.items():
            lines.append(f"{' ' * indent}{k}: {v}")
    return "\n".join(lines)

def update_frontmatter_generic(content, new_data):
    match = re.match(r"^---\r?\n(.*?)\r?\n---", content, re.DOTALL)
    if not match:
        fm_lines = ["---"]
        for k, v in new_data.items():
            if isinstance(v, (list, dict)):
                fm_lines.append(f"{k}:")
                fm_lines.append(format_yaml_value(v, indent=2))
            else:
                fm_lines.append(f'{k}: "{v}"')
        fm_lines.append("---")
        return "\n".join(fm_lines) + "\n\n" + content
        
    fm_text = match.group(1)
    lines = fm_text.splitlines()
    new_lines = []
    keys_updated = set()
    
    idx = 0
    while idx < len(lines):
        line = lines[idx]
        if line.strip() and not line.startswith(" ") and not line.startswith("-") and ":" in line:
            parts = line.split(":", 1)
            key = parts[0].strip()
            if key in new_data:
                val = new_data[key]
                if isinstance(val, (list, dict)):
                    new_lines.append(f"{key}:")
                    new_lines.append(format_yaml_value(val, indent=2))
                else:
                    new_lines.append(f'{key}: "{val}"')
                keys_updated.add(key)
                idx += 1
                while idx < len(lines) and (lines[idx].startswith(" ") or lines[idx].startswith("-")):
                    idx += 1
                continue
        new_lines.append(line)
        idx += 1
        
    for k, v in new_data.items():
        if k not in keys_updated:
            if isinstance(v, (list, dict)):
                new_lines.append(f"{k}:")
                new_lines.append(format_yaml_value(v, indent=2))
            else:
                new_lines.append(f'{k}: "{v}"')
                
    new_fm_text = "\n".join(new_lines)
    return f"---\n{new_fm_text}\n---" + content[match.end():]

def update_dataview_generic(content, new_data):
    lines = content.splitlines()
    keys_updated = set()
    
    for idx in range(len(lines)):
        line_strip = lines[idx].strip()
        for k, v in new_data.items():
            if line_strip.startswith(f"{k}::"):
                lines[idx] = f"{k}:: {v}"
                keys_updated.add(k)
                
    missing_keys = [k for k in new_data.keys() if k not in keys_updated]
    if missing_keys:
        header_idx = -1
        for idx, l in enumerate(lines):
            if "### Work Logs" in l:
                header_idx = idx
                break
        if header_idx == -1:
            for idx, l in enumerate(lines):
                if "## 🪵 Log" in l or "## 🪵 Logs" in l:
                    header_idx = idx
                    break
                
        insert_lines = [f"{k}:: {new_data[k]}" for k in missing_keys]
            
        if header_idx != -1:
            lines.insert(header_idx + 1, "")
            for line in reversed(insert_lines):
                lines.insert(header_idx + 2, line)
        else:
            lines.append("")
            lines.append("### Work Logs")
            lines.extend(insert_lines)
            
    return "\n".join(lines) + ("\n" if content.endswith("\n") else "")

def update_append_log_generic(content, new_data):
    lines = content.rstrip().splitlines()
    lines.append("")
    for k, v in new_data.items():
        lines.append(f"{k}: {v}")
    return "\n".join(lines) + "\n"

class OCRLogger:
    def __init__(self, template_dir, file_path, image_path=None):
        self.template_dir = template_dir
        self.file_path = file_path
        self.image_path = image_path
        self.headless = image_path is not None
        
        # Load Template Metadata
        meta_path = os.path.join(template_dir, "metadata.json")
        if not os.path.exists(meta_path):
            raise FileNotFoundError(f"Template metadata.json not found in {template_dir}")
            
        with open(meta_path, "r", encoding="utf-8") as f:
            self.meta = json.load(f)
            
        self.template_name = self.meta.get("name", "Generic OCR")
        self.destination = self.meta.get("destination", "frontmatter")
        
        # Load Prompt
        self.prompt = self.meta.get("prompt", "")
        prompt_txt_path = os.path.join(template_dir, "system_prompt.txt")
        if os.path.exists(prompt_txt_path):
            with open(prompt_txt_path, "r", encoding="utf-8") as f:
                self.prompt = f.read().strip()
                
        if not self.prompt:
            self.prompt = "Extract all parameters from this image. Return strictly in JSON format."

        try:
            self.api_key = get_gemini_key()
        except Exception as e:
            if self.headless:
                print(f"Configuration Error: {e}")
                sys.exit(1)
            # Show popup if not headless
            self.root = tk.Tk()
            self.root.withdraw()
            messagebox.showerror("Configuration Error", str(e))
            self.root.destroy()
            return
            
        if self.headless:
            # Headless execution
            self.process_image(self.image_path)
            return

        # Hide root window
        self.root = tk.Tk()
        self.root.withdraw()
        
        # Check clipboard
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
                title=f"Select screenshot for {self.template_name}",
                filetypes=[("Image files", "*.png *.jpg *.jpeg *.webp *.bmp")]
            )
            
            if not img_path:
                self.root.destroy()
                return
            
        # Show loading window
        self.loading_win = tk.Toplevel(self.root)
        self.loading_win.title("Processing OCR")
        self.loading_win.geometry("320x130")
        self.loading_win.configure(bg="#1e1e2e")
        self.loading_win.resizable(False, False)
        self.loading_win.update_idletasks()

        width = self.loading_win.winfo_width()
        height = self.loading_win.winfo_height()
        screen_width = self.loading_win.winfo_screenwidth()
        screen_height = self.loading_win.winfo_screenheight()

        x = (screen_width // 2) - (width // 2)
        y = (screen_height // 2) - (height // 2)
        self.loading_win.geometry(f'{width}x{height}+{x}+{y}')
        
        lbl = tk.Label(
            self.loading_win, 
            text=f"Extracting {self.template_name} data...\nPlease wait while Gemini analyzes screenshot.", 
            fg="#cdd6f4", 
            bg="#1e1e2e", 
            font=("Helvetica", 11, "bold"),
            pady=20
        )
        lbl.pack(expand=True)
        self.loading_win.update()
        
        # Process in thread
        threading.Thread(target=self.process_image, args=(img_path, img_bytes, mime_type), daemon=True).start()
        self.root.mainloop()
        
    def process_image(self, img_path, img_bytes=None, mime_type="image/png"):
        try:
            if img_bytes is not None:
                img_data = base64.b64encode(img_bytes).decode("utf-8")
            else:
                with open(img_path, "rb") as f:
                    img_data = base64.b64encode(f.read()).decode("utf-8")
                    
                mime_type = "image/png"
                if img_path.lower().endswith(".jpg") or img_path.lower().endswith(".jpeg"):
                    mime_type = "image/jpeg"
                elif img_path.lower().endswith(".webp"):
                    mime_type = "image/webp"
                elif img_path.lower().endswith(".bmp"):
                    mime_type = "image/bmp"
            
            model_names = ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash']
            text_response = None
            last_err = None
            
            for model_name in model_names:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={self.api_key}"
                headers = {"Content-Type": "application/json"}
                payload = {
                    "contents": [
                        {
                            "parts": [
                                {"text": self.prompt},
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
                
                try:
                    res = requests.post(url, headers=headers, json=payload, timeout=30)
                    if res.status_code == 200:
                        res_data = res.json()
                        text_response = res_data["candidates"][0]["content"]["parts"][0]["text"].strip()
                        break
                    else:
                        last_err = RuntimeError(f"Gemini API model {model_name} failed with status {res.status_code}: {res.text}")
                except Exception as e:
                    last_err = e
            
            if not text_response:
                raise last_err
            
            data = json.loads(text_response)
            
            # Post-processing specifically for Lumosity nested scores validation
            if self.meta.get("id") == "lumosity" or self.template_name.lower() == "lumosity":
                raw_scores = data.get("scores", [])
                scores = []
                for s in raw_scores:
                    if s and s.get("score") is not None:
                        try:
                            sc_val = int(float(str(s.get("score"))))
                            if sc_val > 0:
                                scores.append(s)
                        except (ValueError, TypeError):
                            pass
                data["scores"] = scores
            
            with open(self.file_path, "r", encoding="utf-8") as f:
                content = f.read()
                
            if self.destination == 'frontmatter':
                updated_content = update_frontmatter_generic(content, data)
            elif self.destination == 'dataview':
                updated_content = update_dataview_generic(content, data)
            else:
                updated_content = update_append_log_generic(content, data)
                
            with open(self.file_path, "w", encoding="utf-8") as f:
                f.write(updated_content)
                
            if self.headless:
                print(f"Successfully extracted and saved {self.template_name} data to note!")
                print(json.dumps(data))
                sys.exit(0)
            else:
                self.after_main(lambda: messagebox.showinfo("Success", f"Successfully extracted and saved {self.template_name} data to note!"))
        except Exception as e:
            if self.headless:
                print(f"Failed to extract {self.template_name} data: {e}")
                sys.exit(1)
            else:
                self.after_main(lambda: messagebox.showerror("OCR Error", f"Failed to extract {self.template_name} data: {e}"))
        finally:
            if not self.headless:
                self.after_main(self.root.destroy)
            
    def after_main(self, fn):
        self.root.after(0, fn)

def main():
    parser = argparse.ArgumentParser(description="Generic OCR Image log parsing script.")
    parser.add_argument('--template-dir', required=True, help="Path to custom template configuration folder")
    parser.add_argument('--file', required=True, help="Path to Daily Note markdown file to update")
    parser.add_argument('--image', help="Optional path to the image file to process (headless mode)")
    
    args = parser.parse_args()
    OCRLogger(args.template_dir, args.file, args.image)

if __name__ == "__main__":
    main()
