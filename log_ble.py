import asyncio
import argparse
import struct
import hashlib
import base64
import os
import sys
import json
import re
from bleak import BleakClient

# Configure DLL path for Windows if running under python interpreter directly
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

# Add omni-logger path to sys.path to import writing helper utilities
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from health_utils import update_frontmatter, update_dataview_fields, append_to_bottom_log

class GenericBLEClient:
    def __init__(self, mac, command_uuid=None, response_uuid=None, handshake_key_b64=None):
        self.mac = mac
        self.command_uuid = command_uuid
        self.response_uuid = response_uuid
        self.handshake_key = base64.b64decode(handshake_key_b64) if handshake_key_b64 else None
        self.client = None
        self.seq = 100
        self.futures = {}

    def next_seq(self):
        self.seq = (self.seq + 1) % 65535
        return self.seq

    def notification_handler(self, sender, data):
        if len(data) < 3:
            return
        seq = int.from_bytes(data[0:2], byteorder='little')
        status = data[2]
        payload = data[3:] if len(data) > 3 else b''
        if seq in self.futures:
            try:
                self.futures[seq].set_result((status, payload))
            except asyncio.InvalidStateError:
                pass

    async def send_command(self, payload, timeout=5.0):
        seq = int.from_bytes(payload[0:2], byteorder='little')
        fut = asyncio.get_running_loop().create_future()
        self.futures[seq] = fut
        try:
            await self.client.write_gatt_char(self.command_uuid, payload, response=False)
            status, resp_payload = await asyncio.wait_for(fut, timeout=timeout)
            return status, resp_payload
        finally:
            self.futures.pop(seq, None)

    async def connect(self, run_handshake=False):
        print(f"Connecting to BLE device {self.mac}...")
        # Windows WinRT can cache stale GATT sessions — retry up to 3 times,
        # verifying is_connected after __aenter__ each time.
        for attempt in range(1, 4):
            settle = 1.5 + attempt * 0.5  # 2.0s, 2.5s, 3.0s
            self._cm = BleakClient(self.mac, timeout=20.0)
            try:
                self.client = await self._cm.__aenter__()
                await asyncio.sleep(settle)
                if self.client.is_connected:
                    print(f"Connected! (attempt {attempt}, settled {settle}s)")
                    break
                else:
                    print(f"Attempt {attempt}: __aenter__ returned but is_connected=False, retrying...")
                    await self._cm.__aexit__(None, None, None)
                    self._cm = None
                    self.client = None
                    await asyncio.sleep(1.0)
            except Exception as e:
                print(f"Attempt {attempt} failed: {e}")
                try:
                    await self._cm.__aexit__(None, None, None)
                except Exception:
                    pass
                self._cm = None
                self.client = None
                if attempt == 3:
                    raise
                await asyncio.sleep(2.0)
        else:
            raise Exception(f"Could not establish stable BLE connection to {self.mac} after 3 attempts.")

        if run_handshake:
            if not self.command_uuid or not self.response_uuid:
                raise Exception("Command and Response UUIDs are required for Lorax handshake.")

            print("Subscribing to notifications...")
            await self.client.start_notify(self.response_uuid, self.notification_handler)

            print("Sending initialization handshake packet...")
            init_cmd = bytes([0x00, 0x00, 0x27, 0x01, 0xC0, 0x03])
            try:
                await self.client.write_gatt_char(self.command_uuid, init_cmd, response=False)
                await asyncio.sleep(0.5)
            except Exception as e:
                print(f"Init command failed (non-fatal): {e}")

            # Limits check
            print("Checking protocol limits...")
            seq = self.next_seq()
            limits_cmd = struct.pack("<HB", seq, 0x02)
            status, resp = await self.send_command(limits_cmd)
            if status != 0:
                raise Exception(f"Get limits command rejected (status={status})")

            # Access seed
            print("Requesting challenge seed...")
            seq = self.next_seq()
            seed_cmd = struct.pack("<HB", seq, 0x00)
            status, resp = await self.send_command(seed_cmd)
            if status != 0 or len(resp) < 16:
                raise Exception(f"Failed to get seed: status {status}, len {len(resp)}")
            seed = resp[:16]

            # Auth Token
            combined = self.handshake_key + seed
            token = hashlib.sha256(combined).digest()[:16]

            # Unlock
            print("Sending unlock auth token...")
            seq = self.next_seq()
            unlock_cmd = struct.pack("<HB", seq, 0x01) + token
            status, resp = await self.send_command(unlock_cmd)
            if status != 0:
                raise Exception(f"Unlock rejected (status={status})")

            print("Handshake authenticated and unlocked successfully!")


    async def read_lorax_path(self, path):
        seq = self.next_seq()
        path_bytes = path.encode('ascii')
        payload = struct.pack("<HB", seq, 0x10) + struct.pack("<HH", 0, 125) + path_bytes
        status, resp = await self.send_command(payload)
        if status != 0:
            raise Exception(f"Read path {path} failed (status={status})")
        return resp

    async def read_standard_char(self, char_uuid):
        return await self.client.read_gatt_char(char_uuid)

    async def disconnect(self):
        if hasattr(self, '_cm') and self._cm:
            print("Disconnecting BLE device...")
            try:
                await self._cm.__aexit__(None, None, None)
            except Exception as e:
                print(f"Disconnect error: {e}")
            self._cm = None
            self.client = None

def parse_val(raw_bytes, parser):
    if not raw_bytes:
        return ""
    if parser == "uint32_le":
        return int.from_bytes(raw_bytes, byteorder='little')
    elif parser == "uint32_le_div_100":
        val = int.from_bytes(raw_bytes, byteorder='little')
        return round(val / 100)
    elif parser == "uint16_le":
        return int.from_bytes(raw_bytes, byteorder='little')
    elif parser == "float32_le":
        val = struct.unpack("<f", raw_bytes)[0]
        return round(val)
    elif parser == "string":
        return raw_bytes.decode('ascii', errors='ignore').replace('\x00', '').strip()
    elif parser == "hex":
        return raw_bytes.hex()
    return raw_bytes.hex()

async def run_sync(template_dir, file_path, mock=False):
    metadata_path = os.path.join(template_dir, "metadata.json")
    if not os.path.exists(metadata_path):
        print(f"Error: Template metadata not found at {metadata_path}")
        sys.exit(1)
        
    with open(metadata_path, "r", encoding="utf-8") as f:
        config = json.load(f)

    # ── Device credential resolution ──────────────────────────────────────────
    # If the template references a device by name, load credentials from the
    # local bluetooth_devices/ registry (gitignored, never synced).
    device_name = config.get("deviceName")
    if device_name:
        # Resolve plugin dir: two levels up from template_dir, then into
        # .obsidian/plugins/omni-logger/bluetooth_devices/
        # template_dir is typically <vault>/<ingredientsFolder>/<TemplateName>
        # Walk up to find the plugin dir by looking for bluetooth_devices/ sibling
        plugin_dir = os.path.join(
            os.path.dirname(os.path.abspath(__file__))
        )
        devices_dir = os.path.join(plugin_dir, "bluetooth_devices")
        device_file = os.path.join(devices_dir, f"{device_name}.json")
        
        if not os.path.exists(device_file):
            print(f"Error: Device '{device_name}' not found in bluetooth_devices/.")
            print(f"  Expected: {device_file}")
            print(f"  Use the Omni-Logger settings to pair the device first.")
            sys.exit(1)
            
        with open(device_file, "r", encoding="utf-8") as f:
            device_creds = json.load(f)
            
        # Merge device credentials into config
        config["macAddress"] = device_creds.get("address", "")
        config["useLoraxHandshake"] = device_creds.get("useLoraxHandshake", False)
        config["commandUuid"] = device_creds.get("commandUuid", "")
        config["responseUuid"] = device_creds.get("responseUuid", "")
        config["handshakeKeyBase64"] = device_creds.get("handshakeKeyBase64", "")
        print(f"Loaded device credentials for '{device_name}' from bluetooth_devices/.")
    # ──────────────────────────────────────────────────────────────────────────

    mac = config.get("macAddress")
    if not mac:
        print("Error: macAddress missing in template configuration.")
        sys.exit(1)

        
    use_lorax = config.get("useLoraxHandshake", False)
    cmd_uuid = config.get("commandUuid")
    resp_uuid = config.get("responseUuid")
    handshake_key_b64 = config.get("handshakeKeyBase64")
    
    metrics = config.get("metrics", [])
    if not metrics:
        print("Error: No metrics defined in template configuration.")
        sys.exit(1)
        
    results = {}
    if mock:
        print("Running in MOCK mode. Generating mock BLE data...")
        for metric in metrics:
            name = metric.get("name", "Unknown")
            key = metric.get("key")
            dest = metric.get("destination", "frontmatter")
            parser = metric.get("parser", "hex")
            if parser in ("uint32_le", "uint16_le", "float32_le"):
                val = 1000
                if os.path.exists(file_path):
                    try:
                        with open(file_path, "r", encoding="utf-8") as f:
                            txt = f.read()
                        m_db = re.search(rf"{re.escape(key)}:[ \t]*\"?(\d+)\"?", txt)
                        if m_db:
                            val = int(m_db.group(1)) + 5
                    except Exception as ex:
                        print(f"Mock read error: {ex}")
                results[key] = (val, dest)
            elif metric.get("type") == "first_time_trigger":
                val = "08:00"
                if os.path.exists(file_path):
                    try:
                        with open(file_path, "r", encoding="utf-8") as f:
                            txt = f.read()
                        m_db = re.search(rf"{re.escape(key)}:[ \t]*\"?([^\n\"]+)\"?", txt)
                        existing = m_db.group(1).strip() if m_db else ""
                        # Only preserve if it looks like a valid time (HH:MM)
                        if existing and re.match(r"^\d{1,2}:\d{2}$", existing):
                            val = existing
                    except Exception:
                        pass
                results[key] = (val, dest)
            elif parser == "uint32_le_div_100":
                results[key] = (85, dest)
            else:
                results[key] = ("mock_val", dest)
            print(f"Mocked metric '{name}' = {results[key][0]}")
    else:
        client = GenericBLEClient(mac, cmd_uuid, resp_uuid, handshake_key_b64)
        try:
            await client.connect(run_handshake=use_lorax)
            
            for metric in metrics:
                # first_time_trigger metrics are computed in post-processing, skip BLE read
                if metric.get("type") == "first_time_trigger":
                    continue
                name = metric.get("name", "Unknown")
                parser = metric.get("parser", "hex")
                
                print(f"Reading metric '{name}'...")
                if use_lorax:
                    path = metric.get("path")
                    if not path:
                        print(f"Warning: path missing for metric '{name}'. Skipping.")
                        continue
                    raw = await client.read_lorax_path(path)
                else:
                    char_uuid = metric.get("characteristicUuid")
                    if not char_uuid:
                        print(f"Warning: characteristicUuid missing for metric '{name}'. Skipping.")
                        continue
                    raw = await client.read_standard_char(char_uuid)
                    
                print(f"Raw bytes for '{name}': {raw.hex()}")
                val = parse_val(raw, parser)
                print(f"Parsed metric '{name}' = {val}")
                results[metric.get("key")] = (val, metric.get("destination", "frontmatter"))
                
            # Post-process first_time_trigger metrics
            for metric in metrics:
                if metric.get("type") == "first_time_trigger":
                    name = metric.get("name", "First Trigger")
                    key = metric.get("key")
                    dest = metric.get("destination", "frontmatter")
                    odom_key = metric.get("odometerKey")
                    
                    today_odom_tuple = results.get(odom_key)
                    if today_odom_tuple:
                        today_odom = today_odom_tuple[0]
                        yesterday_odom = None
                        try:
                            dir_name = os.path.dirname(file_path)
                            base_name = os.path.basename(file_path)
                            date_match = re.match(r"(\d{4}-\d{2}-\d{2})\.md", base_name)
                            if date_match:
                                from datetime import datetime, timedelta
                                curr_date = datetime.strptime(date_match.group(1), "%Y-%m-%d")
                                yest_date = curr_date - timedelta(days=1)
                                yest_file = os.path.join(dir_name, yest_date.strftime("%Y-%m-%d") + ".md")
                                if os.path.exists(yest_file):
                                    with open(yest_file, "r", encoding="utf-8") as f:
                                        yest_txt = f.read()
                                    yest_odom_match = re.search(rf"{re.escape(odom_key)}:[ \t]*\"?(\d+)\"?", yest_txt)
                                    if yest_odom_match:
                                        yesterday_odom = int(yest_odom_match.group(1))
                        except Exception as ex:
                            print(f"Warning: could not resolve yesterday's odometer for first trigger: {ex}")
                        
                        if yesterday_odom is not None and today_odom > yesterday_odom:
                            is_empty = True
                            if os.path.exists(file_path):
                                try:
                                    with open(file_path, "r", encoding="utf-8") as f:
                                        curr_txt = f.read()
                                    m_val = re.search(rf"{re.escape(key)}:[ \t]*\"?([^\n\"]+)\"?", curr_txt)
                                    if m_val and m_val.group(1).strip():
                                        is_empty = False
                                except Exception:
                                    pass
                            if is_empty:
                                from datetime import datetime
                                val = datetime.now().strftime("%H:%M")
                                print(f"First session detected! Writing '{key}' = {val}")
                                results[key] = (val, dest)
                
        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"Sync failed with error: {type(e).__name__}: {e}")
            sys.exit(1)
        finally:
            await client.disconnect()
        
    if not results:
        print("No metrics retrieved. Note updates skipped.")
        sys.exit(0)
        
    # Update Obsidian Daily Note File
    if not os.path.exists(file_path):
        print(f"Error: Daily note file not found at {file_path}")
        sys.exit(1)
        
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    yaml_updates = {}
    dataview_updates = {}
    append_updates = {}
    
    for key, (val, dest) in results.items():
        if dest == "frontmatter":
            yaml_updates[key] = str(val)
        elif dest == "dataview":
            dataview_updates[key] = str(val)
        elif dest == "append-log":
            append_updates[key] = str(val)
            
    updated_content = content
    if yaml_updates:
        updated_content = update_frontmatter(updated_content, yaml_updates)
    if dataview_updates:
        updated_content = update_dataview_fields(updated_content, dataview_updates)
    if append_updates:
        updated_content = append_to_bottom_log(updated_content, append_updates)
        
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(updated_content)
        
    print(f"Successfully updated daily note with BLE sync metrics: {list(results.keys())}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--template-dir", required=True, help="Custom template directory path")
    parser.add_argument("--file", required=True, help="Obsidian Daily Note File Path")
    parser.add_argument("--mock", action="store_true", help="Simulate BLE connection")
    args = parser.parse_args()
    
    asyncio.run(run_sync(args.template_dir, args.file, args.mock))
