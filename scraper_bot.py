import os
import requests
import time
from supabase import create_client, Client

# Try to load .env for local testing, but silently pass in GitHub Actions
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

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

def get_saved_state():
    """Pulls the cursor position from Supabase so we don't start at 'AB' Page 1 every day."""
    try:
        res = supabase.table('harvester_state').select('*').eq('id', 1).execute()
        if res.data and len(res.data) > 0:
            return res.data[0].get('region_index', 0), res.data[0].get('page', 1)
    except Exception as e:
        print(f"⚠️ State fetch error: {e}")
    return 0, 1

def save_state(region_idx, page):
    """Saves the cursor position so tomorrow's run starts exactly here."""
    try:
        supabase.table('harvester_state').upsert({
            'id': 1,
            'region_index': region_idx,
            'page': page
        }).execute()
    except Exception as e:
        print(f"⚠️ Failed to save state: {e}")

def harvest_courses():
    headers = {
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": RAPIDAPI_HOST
    }

    total_added = 0
    start_region_idx, start_page = get_saved_state()

    print(f"🔄 Resuming harvest from Region: {regions[start_region_idx]}, Page: {start_page}")

    # Start the loop exactly where we left off yesterday
    for i in range(start_region_idx, len(regions)):
        region = regions[i]
        print(f"\n📡 Starting Harvest for Region: {region}")
        
        # If this is the region we resumed on, start at the saved page. Otherwise, start fresh at page 1.
        page = start_page if i == start_region_idx else 1
        has_more = True

        while has_more:
            print(f"   -> Fetching page {page}...")
            api_url = f"https://golf-course-api.p.rapidapi.com/courses?state={region}&limit=100&page={page}"
            
            try:
                response = requests.get(api_url, headers=headers)
                
                # --- RATE LIMIT DETECTED ---
                if response.status_code == 429:
                    print("\n   ⚠️ API LIMIT REACHED! You have exhausted your daily requests.")
                    print(f"   🛑 Stopped at Region: {region}, Page: {page}.")
                    print(f"   🎉 HARVEST PAUSED. Successfully pushed {total_added} new tee boxes today.")
                    save_state(i, page) # Save exact spot for tomorrow
                    return 
                
                if response.status_code != 200:
                    print(f"   ❌ API Error {response.status_code}. Skipping {region}.")
                    break
                
                data = response.json()
                courses = data.get('data', [])
                
                # --- REGION COMPLETE ---
                if not courses or len(courses) == 0:
                    print(f"   ✅ No more courses found for {region}.")
                    has_more = False
                    save_state(i + 1, 1) # Move cursor to the next region, page 1
                    break
                
                for course in courses:
                    course_name = str(course.get('name', 'Unknown')).strip()
                    tees = course.get('tees', [])
                    
                    for tee in tees:
                        raw_tee_name = str(tee.get('name', 'Standard')).strip()
                        gender = "Women" if any(w in raw_tee_name.lower() for w in ["women", "ladies", "red"]) else "Men"
                        tee_name = raw_tee_name.replace("(Women)", "").replace("(Men)", "").strip()
                        
                        try:
                            existing = supabase.table('course_tees').select('id') \
                                .eq('course_name', course_name) \
                                .eq('tee_name', tee_name) \
                                .eq('gender', gender) \
                                .limit(1).execute()
                            
                            if len(existing.data) == 0:
                                holes = tee.get('holes', [])
                                pars = [h.get('par', 4) for h in holes]
                                yardages = [h.get('yardage', 0) for h in holes]
                                stroke_indexes = [h.get('stroke_index', 0) for h in holes]
                                
                                if len(pars) == 9:
                                    pars = pars + pars
                                    yardages = yardages + yardages
                                    stroke_indexes = stroke_indexes + stroke_indexes
                                
                                pars = (pars + [0]*18)[:18]
                                yardages = (yardages + [0]*18)[:18]
                                stroke_indexes = (stroke_indexes + [0]*18)[:18]
                                
                                # FIX: Calculate total yardage for your specific column
                                calculated_total_yardage = sum(yardages)

                                payload = {
                                    "course_name": course_name,
                                    "tee_name": tee_name,
                                    "gender": gender,
                                    "course_rating": tee.get('course_rating', None),
                                    "slope_rating": tee.get('slope_rating', None),
                                    "total_yardage": calculated_total_yardage, # MATCHES YOUR DB COLUMN
                                    "pars": pars,
                                    "yardages": yardages,
                                    "stroke_indexes": stroke_indexes
                                }
                                
                                supabase.table('course_tees').insert(payload).execute()
                                total_added += 1
                                print(f"   ⛳ Added: {course_name} | {tee_name} ({gender})")
                            else:
                                pass 
                                
                        except Exception as inner_e:
                            print(f"   ⚠️ Skipping {course_name} due to DB error: {inner_e}")
                            continue
                
                # --- ADVANCE PAGE AND SAVE ---
                meta = data.get('meta', {})
                current_page = int(meta.get('current_page', 1))
                last_page = int(meta.get('last_page', 1))
                
                if current_page >= last_page:
                    has_more = False
                    save_state(i + 1, 1) # Move cursor to next region
                else:
                    page += 1
                    save_state(i, page) # Backup state mid-region in case of a crash
                    
                time.sleep(1) 
                
            except Exception as outer_e:
                print(f"   ❌ Fatal connection error: {outer_e}. Breaking loop.")
                save_state(i, page)
                has_more = False
                break

    print(f"\n🎉 HARVEST COMPLETE! Successfully mapped {total_added} new tee boxes to Supabase.")
    # If the loop finishes naturally, reset to 0 to start checking for updates again someday
    save_state(0, 1)

if __name__ == "__main__":
    harvest_courses()
