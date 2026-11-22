#!/usr/bin/env python3
"""
Uploads compiled build artifacts (e.g. Android .APK) to GoFile
and exports the download link to GitHub Actions step summaries and release artifacts.
"""

import json
import os
import subprocess
import sys
import urllib.request

def upload_file_to_gofile(file_path: str) -> str:
    if not os.path.isfile(file_path):
        print(f"[Error] File not found: {file_path}", file=sys.stderr)
        sys.exit(1)

    file_size_mb = os.path.getsize(file_path) / (1024 * 1024)
    file_name = os.path.basename(file_path)
    print(f"==> Preparing upload for: {file_name} ({file_size_mb:.2f} MB)")

    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    
    # 1. Fetch available servers from GoFile
    try:
        req = urllib.request.Request("https://api.gofile.io/servers", headers=headers)
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
    except Exception as e:
        print(f"[Warning] Failed to fetch servers from GoFile API: {e}", file=sys.stderr)
        data = {}

    servers = [s['name'] for s in data.get('data', {}).get('servers', [])]
    if not servers:
        # Fallback to known active servers
        servers = ['store3', 'store-na-phx-1', 'store-na-phx-3', 'store-eu-par-4', 'store-eu-par-1']
    
    print(f"==> Available GoFile servers ({len(servers)}): {servers[:4]}...")

    # 2. Upload file
    download_url = None
    for server in servers:
        upload_endpoint = f"https://{server}.gofile.io/contents/uploadfile"
        print(f"==> Uploading to {upload_endpoint}...")
        try:
            # Use curl for reliable multipart streaming of large binaries
            cmd = [
                "curl", "-s", "--max-time", "300",
                "-F", f"file=@{file_path}",
                upload_endpoint
            ]
            raw_output = subprocess.check_output(cmd).decode()
            res = json.loads(raw_output)
            if res.get("status") == "ok" and "data" in res and "downloadPage" in res["data"]:
                download_url = res["data"]["downloadPage"]
                print(f"\n=======================================================")
                print(f"  [SUCCESS] GoFile Upload Complete!")
                print(f"  Download Page: {download_url}")
                print(f"=======================================================\n")
                break
            else:
                print(f"  Server {server} returned: {res.get('status')} - {res.get('data')}")
        except Exception as err:
            print(f"  Upload error on {server}: {err}")

    if not download_url:
        print("[Error] All GoFile server upload attempts failed.", file=sys.stderr)
        return ""

    # 3. Save download link to output file
    out_dir = os.path.dirname(file_path)
    if out_dir:
        link_file = os.path.join(out_dir, "gofile_link.txt")
        try:
            with open(link_file, "w") as f:
                f.write(download_url.strip() + "\n")
            print(f"Saved link to {link_file}")
        except Exception as e:
            print(f"Could not write {link_file}: {e}")

    # 4. Append to GITHUB_STEP_SUMMARY if running inside GitHub Actions
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path and os.path.exists(summary_path):
        try:
            with open(summary_path, "a") as f:
                f.write(f"\n## 📱 Android APK Ready for Download\n\n")
                f.write(f"- **GoFile Direct Download**: [{download_url}]({download_url})\n")
                f.write(f"- **File Name**: `{file_name}`\n")
                f.write(f"- **File Size**: `{file_size_mb:.2f} MB`\n")
                f.write(f"- **Platform**: Android 7.0+ (API 24 to 35)\n\n")
        except Exception as e:
            print(f"Could not write step summary: {e}")

    return download_url

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "dist-android/KuroStream-Debug-2.0.0.apk"
    upload_file_to_gofile(target)
