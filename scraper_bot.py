import os
import requests
from supabase import create_client, Client

# --- 1. SUPABASE CONNECTION ---
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)

# --- 2. GOLF COURSE API CONFIGURATION ---
API_KEY = "SBNYQO6CROSCJ4IZ5PQEHESHGI"

def fetch_courses():
    print("Fetching courses directly from golfcourseapi.com...")
    
    # Using the exact Authorization format specified in the developer email
    headers = {
        "Authorization": f"Key {API_KEY}",
        "Accept": "application/json"
    }
    
    api_url = "https://api.golfcourseapi.com/v1/courses"
    params = {"city": "Calgary"}
    
    try:
        response = requests.get(api_url, headers=headers, params=params)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print("Error Details:", response.text)
            return
            
        data = response.json()
        print(f"✅ SUCCESS! Connected using 'Key' format.")
        print("Printing payload structure...")
        
        # Print the payload so we can map it to Supabase
        print(str(data)[:1500])
        
    except Exception as e:
        print(f"Critical Script Error: {e}")

if __name__ == "__main__":
    fetch_courses()
