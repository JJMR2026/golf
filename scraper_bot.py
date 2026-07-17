import os
import requests
import time
from supabase import create_client, Client
from dotenv import load_dotenv

# Load variables from .env file (for Supabase credentials)
load_dotenv()

# --- 1. SUPABASE CONNECTION ---
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)

# --- 2. GOLF API CONFIGURATION ---
RAPIDAPI_KEY = "SBNYQO6CROSCJ4IZ5PQEHESHGI"
RAPIDAPI_HOST = "golf-course-api.p.rapidapi.com"

# --- 3. REGIONS (Canada First, then full US) ---
regions = [
    # Canada
    "AB", "BC", "SK", "MB", "ON", "QC", "NB", "NS", "PE", "NL", "YT", "NT", "NU",
    # USA
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
            # Using the state parameter to pull bulk courses safely
            api_url = f"https://golf-course-api.p.rapidapi.com/courses?state={region}&limit=100&page={page}"
            
            try:
                response = requests.get(api_url, headers=headers)
                
                if response.status_code == 429:
                    print("\n   ⚠️ API LIMIT REACHED! You have exhausted your daily requests.")
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
                        raw_tee_name = str(tee.get('name', 'Standard')).strip()
                        
                        # Parse gender for the unique constraint
                        gender = "Women" if any(w in raw_tee_name.lower() for w in ["women", "ladies", "red"]) else "Men"
                        
                        # Clean up tee name
                        tee_name = raw_tee_name.replace("(Women)", "").replace("(Men)", "").strip()
                        
                        try:
                            # Safely check if tee exists using the FULL unique constraint
                            existing = supabase.table('course_tees').select('id') \
                                .eq('course_name', course_name) \
                                .eq('tee_name', tee_name) \
                                .eq('gender', gender) \
                                .limit(1).execute()
                            
                            # ONLY inserts if it does not already exist
                            if len(existing.data) == 0:
                                holes = tee.get('holes', [])
                                pars = [h.get('par', 4) for h in holes]
                                yardages = [h.get('yardage', 0) for h in holes]
                                stroke_indexes = [h.get('stroke_index', 0) for h in holes]
                                
                                # PERFECT 9-HOLE DOUBLING LOGIC
                                if len(pars) == 9:
                                    pars = pars + pars
                                    yardages = yardages + yardages
                                    stroke_indexes = stroke_indexes + stroke_indexes
                                
                                # Standardize array length just in case API data is malformed
                                pars = (pars + [0]*18)[:18]
                                yardages = (yardages + [0]*18)[:18]
                                stroke_indexes = (stroke_indexes + [0]*18)[:18]

                                payload = {
                                    "course_name": course_name,
                                    "tee_name": tee_name,
                                    "gender": gender,
                                    "pars": pars,
                                    "yardages": yardages,
                                    "stroke_indexes": stroke_indexes,
                                    "course_rating": tee.get('course_rating', None),
                                    "slope_rating": tee.get('slope_rating', None) 
                                }
                                
                                supabase.table('course_tees').insert(payload).execute()
                                total_added += 1
                                print(f"   ⛳ Added: {course_name} | {tee_name} ({gender})")
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

    print(f"\n🎉 HARVEST COMPLETE! Successfully mapped {total_added} new tee boxes to Supabase.")

if __name__ == "__main__":
    harvest_courses()
