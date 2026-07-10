import os
import requests
from supabase import create_client, Client

# --- 1. SUPABASE CONNECTION ---
# Pulling securely from your GitHub Secrets
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)

# --- 2. GOLF API CONFIGURATION ---
API_KEY = "SBNYQO6CROSCJ4IZ5PQEHESHGI"
API_HOST = "golf-course-api.p.rapidapi.com"
API_URL = "https://golf-course-api.p.rapidapi.com/search"

def fetch_calgary_courses():
    print("Fetching Calgary courses from external API...")
    
    querystring = {"location": "Calgary, AB"}
    headers = {
        "X-RapidAPI-Key": API_KEY,
        "X-RapidAPI-Host": API_HOST
    }
    
    try:
        response = requests.get(API_URL, headers=headers, params=querystring)
        response.raise_for_status() # Will flag an error if the key is rejected
        data = response.json()
        
        print(f"Successfully fetched {len(data)} courses. Ready to parse and inject to Supabase.")
        print(data) # Printing to the GitHub Action logs so we can see the exact formatting
        
        # NOTE: Once we verify the payload shape in the GitHub Action logs, 
        # we will activate the supabase.table("course_directory").insert() function here.
        
    except Exception as e:
        print(f"Error fetching data from API: {e}")

if __name__ == "__main__":
    fetch_calgary_courses()
