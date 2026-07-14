import requests
import time
import json
from supabase import create_client

# -- SUPABASE CREDENTIALS --
SUPABASE_URL = "https://hksccpousgspagkqcjzd.supabase.co"
SUPABASE_KEY = "YOUR_SUPABASE_SERVICE_ROLE_KEY" # Replace with your Supabase Key
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# -- API CREDENTIALS --
RAPIDAPI_KEY = "YOUR_RAPID_API_KEY" # Replace with your API key
RAPIDAPI_HOST = "golf-course-api.p.rapidapi.com"

# All 13 Canadian Provinces/Territories and 50 US States
regions = [
    # Canada
    "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT",
    # United States
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", 
    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", 
    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", 
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", 
    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
]

def harvest_courses():
    headers = {
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": RAPIDAPI_HOST
    }

    total_added = 0

    for region in regions:
        print(f"\n📡 Starting Harvest for Region: {region}")
        page = 1
        has_more = True

        while has_more:
            print(f"   -> Fetching page {page}...")
            url = f"https://golf-course-api.p.rapidapi.com/courses?state={region}&limit=100&page={page}"
            
            response = requests.get(url, headers=headers)
            
            # Stop the script entirely if the daily API limit is triggered
            if response.status_code == 429:
                print("   ⚠️ API Limit Reached! You have exhausted your daily requests.")
                print(f"   🛑 Stopping script at region {region}, page {page}.")
                print(f"   🎉 HARVEST PAUSED. Added {total_added} tee boxes today.")
                return 
            elif response.status_code != 200:
                print(f"   ❌ API Error: {response.status_code}. Stopping {region}.")
                break
                
            data = response.json()
            courses = data.get('data', [])
            
            if not courses:
                print(f"   ✅ No more courses found for {region}.")
                has_more = False
                break
                
            for course in courses:
                course_name = course.get('name', 'Unknown')
                tees = course.get('tees', [])
                
                for tee in tees:
                    tee_name = tee.get('name', 'Standard')
                    
                    # Prevent duplicates
                    existing = supabase.table('course_tees').select('*').eq('course_name', course_name).eq('tee_name', tee_name).execute()
                    
                    if not existing.data:
                        # Extract hole data safely
                        holes = tee.get('holes', [])
                        pars = [h.get('par', 4) for h in holes]
                        yardages = [h.get('yardage', 0) for h in holes]
                        
                        # Pad arrays to 18 if the API returned 9
                        while len(pars) < 18:
                            pars.append("")
                        while len(yardages) < 18:
                            yardages.append("")

                        # Truncate to strictly 18 if the API returned 27
                        pars = pars[:18]
                        yardages = yardages[:18]

                        payload = {
                            "course_name": course_name,
                            "tee_name": tee_name,
                            "pars": pars,
                            "yardages": yardages
                        }
                        
                        supabase.table('course_tees').insert(payload).execute()
                        total_added += 1

            # Check pagination
            meta = data.get('meta', {})
            current_page = meta.get('current_page', 1)
            last_page = meta.get('last_page', 1)
            
            if current_page >= last_page:
                has_more = False
            else:
                page += 1
                
            # 1-second delay to safely respect general API rate constraints
            time.sleep(1)

    print(f"\n🎉 HARVEST COMPLETE! Successfully mapped {total_added} new tee boxes to Supabase.")

if __name__ == "__main__":
    harvest_courses()
