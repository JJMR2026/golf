import requests
import time
import json
from supabase import create_client

# -- 1. CREDENTIALS --
SUPABASE_URL = "https://hksccpousgspagkqcjzd.supabase.co"
SUPABASE_KEY = "YOUR_SUPABASE_SERVICE_ROLE_KEY" # <-- Paste your secret key here
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

RAPIDAPI_KEY = "YOUR_RAPID_API_KEY" # <-- Paste your RapidAPI key here
RAPIDAPI_HOST = "golf-course-api.p.rapidapi.com"

# -- 2. REGIONS TO HARVEST --
regions = [
    "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT",
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", 
    "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", 
    "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", 
    "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
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
            
            try:
                response = requests.get(url, headers=headers)
                
                if response.status_code == 429:
                    print("\n   ⚠️ API LIMIT REACHED! You have exhausted your 50 daily requests.")
                    print(f"   🛑 Stopped at Region: {region}, Page: {page}.")
                    print(f"   🎉 HARVEST PAUSED. Successfully pushed {total_added} new tee boxes today.")
                    return 
                
                if response.status_code != 200:
                    print(f"   ❌ API Error {response.status_code}. Skipping {region}.")
                    break
                
                data = response.json()
                courses = data.get('data', [])
                
                if not courses or len(courses) == 0:
                    print(f"   ✅ No more courses found for {region}.")
                    has_more = False
                    break
                
                for course in courses:
                    course_name = str(course.get('name', 'Unknown')).strip()
                    tees = course.get('tees', [])
                    
                    for tee in tees:
                        tee_name = str(tee.get('name', 'Standard')).strip()
                        
                        try:
                            # Safely check if tee exists
                            existing = supabase.table('course_tees').select('id').eq('course_name', course_name).eq('tee_name', tee_name).limit(1).execute()
                            
                            # Check if the data list inside the response is empty
                            if len(existing.data) == 0:
                                holes = tee.get('holes', [])
                                pars = [h.get('par', 4) for h in holes]
                                yardages = [h.get('yardage', 0) for h in holes]
                                
                                while len(pars) < 18: pars.append("")
                                while len(yardages) < 18: yardages.append("")

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
                                print(f"   ⛳ Added: {course_name} ({tee_name})")
                            else:
                                pass # Silently skip duplicates
                                
                        except Exception as inner_e:
                            print(f"   ⚠️ Skipping {course_name} due to DB error: {inner_e}")
                            continue
                
                # Pagination Check
                meta = data.get('meta', {})
                current_page = int(meta.get('current_page', 1))
                last_page = int(meta.get('last_page', 1))
                
                if current_page >= last_page:
                    has_more = False
                else:
                    page += 1
                    
                time.sleep(1) # Prevent DDOSing RapidAPI
                
            except Exception as outer_e:
                print(f"   ❌ Fatal connection error: {outer_e}. Breaking loop.")
                has_more = False
                break

    print(f"\n🎉 CONTINENT HARVEST COMPLETE! Successfully mapped {total_added} new tee boxes to Supabase.")

if __name__ == "__main__":
    harvest_courses()
