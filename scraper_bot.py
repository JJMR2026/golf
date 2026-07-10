import os
import requests
from supabase import create_client, Client

# 1. Connect to your Supabase Database
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)

def fetch_calgary_courses():
    print("Fetching Calgary courses from external API...")
    
    # 2. We will plug your RapidAPI Golf Course key in here next
    # url = "https://golf-course-api.p.rapidapi.com/search"
    # querystring = {"location":"Calgary, AB"}
    # headers = {"X-RapidAPI-Key": "YOUR_EXTERNAL_API_KEY"}
    
    # response = requests.get(url, headers=headers, params=querystring)
    # data = response.json()
    
    print("Script ran successfully. Ready for API Key.")

if __name__ == "__main__":
    fetch_calgary_courses()
