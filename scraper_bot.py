import os
import requests
from supabase import create_client, Client

# --- 1. SUPABASE CONNECTION ---
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)

# --- 2. GOLF COURSE API CONFIGURATION ---
API_KEY = "SBNYQO6CROSCJ4IZ5PQEHESHGI"
api_url = "https://api.golfcourseapi.com/v1/courses"
params = {"city": "Calgary"}

def test_api_auth():
    print("Testing multiple Authorization headers against golfcourseapi.com...")
    
    # The 4 standard ways APIs accept keys
    auth_methods = [
        {"name": "Bearer Token", "headers": {"Authorization": f"Bearer {API_KEY}", "Accept": "application/json"}},
        {"name": "X-API-Key", "headers": {"x-api-key": API_KEY, "Accept": "application/json"}},
        {"name": "Direct Auth", "headers": {"Authorization": API_KEY, "Accept": "application/json"}},
        {"name": "APIKey Header", "headers": {"apikey": API_KEY, "Accept": "application/json"}}
    ]
    
    success = False
    
    for method in auth_methods:
        print(f"\n--- Trying {method['name']} ---")
        try:
            response = requests.get(api_url, headers=method["headers"], params=params)
            print(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                print(f"✅ SUCCESS! The '{method['name']}' format was accepted.")
                print("Printing payload structure...")
                # Print first 1500 chars to review the JSON schema for mapping
                print(str(response.json())[:1500])
                success = True
                break
            else:
                print(f"❌ Failed: {response.text}")
                
        except Exception as e:
            print(f"Request Error: {e}")
            
    if not success:
        print("\n🚨 ALL AUTH METHODS FAILED. 🚨")
        print("The key 'SBNYQO6CROSCJ4IZ5PQEHESHGI' is fundamentally being rejected.")
        print("Please log into your API dashboard to verify the key is active.")

if __name__ == "__main__":
    test_api_auth()
