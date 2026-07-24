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

def norm_key(k):
    return re.sub(r'[\s_]+', '', str(k).lower())

def update_frontmatter_generic(content, new_data):
    # Normalize key lookup dictionary for flexible matching against existing frontmatter
    key_map = {norm_key(k): (k, v) for k, v in new_data.items()}

    match = re.match(r"^---\r?\n(.*?)\r?\n---", content, re.DOTALL)
    if not match:
        fm_lines = ["---"]
        for nk, (orig_k, v) in key_map.items():
            if isinstance(v, (list, dict)):
                fm_lines.append(f"{orig_k}:")
                fm_lines.append(format_yaml_value(v, indent=2))
            else:
                fm_lines.append(f'{orig_k}: "{v}"')
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
            raw_key = parts[0].strip()
            nk = norm_key(raw_key)
            
            if nk in key_map:
                target_key, val = key_map[nk]
                if isinstance(val, (list, dict)):
                    new_lines.append(f"{raw_key}:")
                    new_lines.append(format_yaml_value(val, indent=2))
                else:
                    new_lines.append(f'{raw_key}: "{val}"')
                keys_updated.add(nk)
                idx += 1
                while idx < len(lines) and (lines[idx].startswith(" ") or lines[idx].startswith("-")):
                    idx += 1
                continue
        new_lines.append(line)
        idx += 1
        
    for nk, (orig_k, v) in key_map.items():
        if nk not in keys_updated:
            if isinstance(v, (list, dict)):
                new_lines.append(f"{orig_k}:")
                new_lines.append(format_yaml_value(v, indent=2))
            else:
                new_lines.append(f'{orig_k}: "{v}"')
                
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

def fetch_clipboard_image():
    import io
    import subprocess

    # 1. Try PIL ImageGrab
    try:
        from PIL import ImageGrab, Image
        data = ImageGrab.grabclipboard()
        if isinstance(data, Image.Image):
            buf = io.BytesIO()
            data.save(buf, format="PNG")
            return buf.getvalue(), "image/png"
        elif isinstance(data, list) and data:
            first = data[0]
            if os.path.exists(first) and first.lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.bmp')):
                mime = "image/png"
                if first.lower().endswith(('.jpg', '.jpeg')):
                    mime = "image/jpeg"
                elif first.lower().endswith('.webp'):
                    mime = "image/webp"
                elif first.lower().endswith('.bmp'):
                    mime = "image/bmp"
                with open(first, "rb") as f:
                    return f.read(), mime
    except Exception as e:
        print("PIL grabclipboard warning:", e)

    # 2. Try PowerShell System.Windows.Forms.Clipboard fallback
    try:
        temp_png = os.path.join(os.environ.get("TEMP", r"C:\Windows\Temp"), "omni_clipboard_temp.png")
        if os.path.exists(temp_png):
            try:
                os.remove(temp_png)
            except Exception:
                pass
        ps_cmd = f'Add-Type -AssemblyName System.Windows.Forms; $img = [System.Windows.Forms.Clipboard]::GetImage(); if ($img) {{ $img.Save("{temp_png.replace("\\", "/")}", [System.Drawing.Imaging.ImageFormat]::Png) }}'
        subprocess.run(["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_cmd], capture_output=True, timeout=5)
        if os.path.exists(temp_png):
            with open(temp_png, "rb") as f:
                img_bytes = f.read()
            try:
                os.remove(temp_png)
            except Exception:
                pass
            if img_bytes:
                return img_bytes, "image/png"
    except Exception as e:
        print("PowerShell clipboard fallback warning:", e)

    return None, "image/png"

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
            sys.stderr.write(f"Configuration Error: {e}\n")
            if self.headless:
                sys.exit(1)
            self.root = tk.Tk()
            self.root.attributes('-topmost', True)
            self.root.withdraw()
            messagebox.showerror("Configuration Error", str(e))
            self.root.destroy()
            sys.exit(1)
            
        if self.headless:
            # Headless execution
            self.process_image(self.image_path)
            return

        # Check clipboard before Tkinter initialization
        img_bytes, mime_type = fetch_clipboard_image()
        if img_bytes:
            print("Successfully retrieved image from clipboard!")

        # Hide root window
        self.root = tk.Tk()
        self.root.attributes('-topmost', True)
        self.root.withdraw()

        img_path = None
        if img_bytes is None:
            self.root.deiconify()
            self.root.lift()
            self.root.focus_force()
            img_path = filedialog.askopenfilename(
                parent=self.root,
                title=f"Select screenshot for {self.template_name}",
                filetypes=[("Image files", "*.png *.jpg *.jpeg *.webp *.bmp")]
            )
            self.root.withdraw()
            
            if not img_path:
                sys.stderr.write(f"No image found in clipboard or selected for {self.template_name}.\n")
                self.root.destroy()
                sys.exit(1)
            
        # Process image synchronously
        self.process_image(img_path, img_bytes, mime_type)
        if hasattr(self, 'root') and self.root:
            try:
                self.root.destroy()
            except Exception:
                pass
        
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
            
            # Query ListModels from Google API to get active models supported by key
            available_models = []
            try:
                list_url = f"https://generativelanguage.googleapis.com/v1beta/models?key={self.api_key}"
                res = requests.get(list_url, timeout=10)
                if res.status_code == 200:
                    for m in res.json().get("models", []):
                        name = m.get("name", "").replace("models/", "")
                        methods = m.get("supportedGenerationMethods", [])
                        if "generateContent" in methods:
                            available_models.append(name)
            except Exception as e:
                print(f"ListModels query warning: {e}")

            if not available_models:
                available_models = [
                    'gemini-2.5-flash',
                    'gemini-2.0-flash',
                    'gemini-1.5-flash-latest',
                    'gemini-1.5-flash',
                    'gemini-1.5-pro-latest'
                ]

            model_names = []
            for m in available_models:
                if 'flash' in m.lower() or 'lite' in m.lower():
                    if m not in model_names:
                        model_names.append(m)
            for m in available_models:
                if m not in model_names:
                    model_names.append(m)
            
            text_response = None
            errors_log = []
            
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
                        errors_log.append(f"{model_name} (status {res.status_code}): {res.text[:100]}")
                except Exception as e:
                    errors_log.append(f"{model_name}: {e}")
            
            if not text_response:
                raise RuntimeError("All available Gemini models failed: " + " | ".join(errors_log))
            
            clean_text = re.sub(r"^```(?:json)?\s*", "", text_response, flags=re.IGNORECASE)
            clean_text = re.sub(r"\s*```$", "", clean_text).strip()
            data = json.loads(clean_text)
            
            # Post-processing specifically for Lumosity nested scores validation
            if "lumosity" in str(self.meta.get("id", "")).lower() or self.template_name.lower() == "lumosity":
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
                
            print(f"Successfully extracted and saved {self.template_name} data to note!")
            print(json.dumps(data))
            sys.exit(0)
        except Exception as e:
            sys.stderr.write(f"Failed to extract {self.template_name} data: {e}\n")
            sys.exit(1)
            
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
