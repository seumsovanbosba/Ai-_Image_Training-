import urllib.request
import json
import os
import sys

URL = os.environ.get('STITCH_MCP_URL', 'https://stitch.googleapis.com/mcp')

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
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        print(f"HTTPError {e.code}: {e.read().decode('utf-8')}")
        raise
    except Exception as e:
        print(f"Error: {e}")
        raise

def call_tool(tool_name, arguments):
    return call_mcp('tools/call', {'name': tool_name, 'arguments': arguments})

if __name__ == '__main__':
    tools_resp = call_mcp('tools/list')
    tools = tools_resp.get('result', {}).get('tools', [])
    print(f"Available tools ({len(tools)}):")
    for t in tools:
        print(f"- {t.get('name')}: {t.get('description', '')[:100]}...")
        if 'inputSchema' in t:
            print("  Input schema keys:", list(t['inputSchema'].get('properties', {}).keys()))
