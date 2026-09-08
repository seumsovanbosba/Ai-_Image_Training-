import urllib.request
import json
import os
import subprocess
import re

URL = os.environ.get('STITCH_MCP_URL', 'https://stitch.googleapis.com/mcp')
PROJECT_ID = '4917791142990613518'
TARGET_SCREEN_ID = '2bcebd3e660042bfb62296843b02042f'

def get_api_key():
    if os.environ.get('STITCH_API_KEY'):
        return os.environ['STITCH_API_KEY']
    # Fallback: read from local user mcp_config.json
    cfg_path = os.path.expanduser('~/.gemini/config/mcp_config.json')
    if os.path.exists(cfg_path):
        try:
            with open(cfg_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                key = data.get('mcpServers', {}).get('stitch', {}).get('headers', {}).get('X-Goog-Api-Key')
                if key:
                    return key
        except Exception:
            pass
    return None

def call_mcp(method, params=None, msg_id=1):
    api_key = get_api_key()
    headers = {'Content-Type': 'application/json'}
    if api_key:
        headers['X-Goog-Api-Key'] = api_key

    payload = {
        'jsonrpc': '2.0',
        'id': msg_id,
        'method': method,
        'params': params or {}
    }
    req = urllib.request.Request(URL, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

def call_tool(tool_name, arguments):
    return call_mcp('tools/call', {'name': tool_name, 'arguments': arguments})

def sanitize_filename(name):
    return re.sub(r'[^\w\-_\. ]', '_', name)

def download_file(url, out_path):
    print(f"Downloading {url} to {out_path} using curl.exe -L...")
    cmd = ['curl.exe', '-L', '-s', '-o', out_path, url]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"curl failed: {res.stderr}")
        urllib.request.urlretrieve(url, out_path)
    print(f"Downloaded {os.path.getsize(out_path)} bytes to {out_path}")

def main():
    out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'stitch', 'professional_ui_redesign')
    os.makedirs(out_dir, exist_ok=True)
    
    # 1. Get Project info
    print("Fetching project details...")
    proj_res = call_tool('get_project', {'name': f'projects/{PROJECT_ID}'})
    proj_data = {}
    if proj_res.get('result', {}).get('content'):
        try:
            proj_data = json.loads(proj_res['result']['content'][0]['text'])
            print(f"Project Title: {proj_data.get('title')}")
        except Exception:
            pass

    # 2. List all screens
    print("Listing screens in project...")
    list_res = call_tool('list_screens', {'projectId': PROJECT_ID})
    screens_list = []
    if list_res.get('result', {}).get('content'):
        try:
            screens_data = json.loads(list_res['result']['content'][0]['text'])
            screens_list = screens_data.get('screens', [])
            print(f"Found {len(screens_list)} screens in project:")
            for s in screens_list:
                s_id = s.get('name', '').split('/')[-1]
                print(f" - {s_id}: {s.get('title')}")
        except Exception as e:
            print(f"Error parsing screens list: {e}")

    # 3. Target screen
    print(f"\nFetching screen details for {TARGET_SCREEN_ID}...")
    screen_res = call_tool('get_screen', {'projectId': PROJECT_ID, 'screenId': TARGET_SCREEN_ID})
    screen_data = json.loads(screen_res['result']['content'][0]['text'])
    
    screen_title = screen_data.get('title', 'screen')
    clean_title = sanitize_filename(screen_title)
    screen_folder = os.path.join(out_dir, f"{clean_title}_{TARGET_SCREEN_ID[:8]}")
    os.makedirs(screen_folder, exist_ok=True)

    meta_path = os.path.join(screen_folder, 'metadata.json')
    with open(meta_path, 'w', encoding='utf-8') as f:
        json.dump(screen_data, f, indent=2)
    print(f"Saved screen metadata to {meta_path}")

    screenshot_info = screen_data.get('screenshot', {})
    screenshot_url = screenshot_info.get('downloadUrl')
    if screenshot_url:
        img_path = os.path.join(screen_folder, f"{clean_title}.png")
        download_file(screenshot_url, img_path)

    html_info = screen_data.get('htmlCode', {})
    html_url = html_info.get('downloadUrl')
    if html_url:
        html_path = os.path.join(screen_folder, f"{clean_title}.html")
        download_file(html_url, html_path)

    for s in screens_list:
        s_id = s.get('name', '').split('/')[-1]
        if s_id != TARGET_SCREEN_ID:
            print(f"\nFetching additional screen: {s_id} ({s.get('title')})...")
            s_res = call_tool('get_screen', {'projectId': PROJECT_ID, 'screenId': s_id})
            s_data = json.loads(s_res['result']['content'][0]['text'])
            s_title = sanitize_filename(s_data.get('title', s_id))
            s_folder = os.path.join(out_dir, f"{s_title}_{s_id[:8]}")
            os.makedirs(s_folder, exist_ok=True)
            with open(os.path.join(s_folder, 'metadata.json'), 'w', encoding='utf-8') as f:
                json.dump(s_data, f, indent=2)
            if s_data.get('screenshot', {}).get('downloadUrl'):
                download_file(s_data['screenshot']['downloadUrl'], os.path.join(s_folder, f"{s_title}.png"))
            if s_data.get('htmlCode', {}).get('downloadUrl'):
                download_file(s_data['htmlCode']['downloadUrl'], os.path.join(s_folder, f"{s_title}.html"))

if __name__ == '__main__':
    main()
