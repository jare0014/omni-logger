import asyncio
import json
import sys
from bleak import BleakScanner

async def main():
    try:
        # Discover BLE devices for 5.0 seconds
        devices = await BleakScanner.discover(timeout=5.0)
        
        # Deduplicate and clean device info
        result = []
        seen_addresses = set()
        for d in devices:
            if d.address not in seen_addresses:
                seen_addresses.add(d.address)
                name = d.name if d.name else "Unknown"
                result.append({
                    "name": name,
                    "address": d.address
                })
        
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    asyncio.run(main())
