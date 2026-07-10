import os
import requests
from supabase import create_client, Client

# --- 1. SUPABASE CONNECTION ---
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)

# --- 2. GOLF COURSE API CONFIGURATION ---
API_KEY = "SBNYQO6CROSCJ4IZ5PQEHESHGI"

def fetch_and_store_courses():
    print("Initiating GolfCourseAPI Harvest for Western Canada...")
    
    headers = {
        "Authorization": f"Key {API_KEY}",
        "Accept": "application/json"
    }
    
    api_url = "https://api.golfcourseapi.com/v1/courses"
    
    # Explicitly target Western Canadian provinces
    provinces = ["AB", "BC", "SK", "MB"]
    
    for prov in provinces:
        print(f"\n--- Fetching courses for {prov} ---")
        params = {"state": prov, "limit": 100}
        
        try:
            response = requests.get(api_url, headers=headers, params=params)
            
            if response.status_code != 200:
                print(f"API Error for {prov}:", response.text)
                continue
                
            data = response.json()
            courses = data.get('courses', [])
            print(f"📥 Downloaded {len(courses)} courses in {prov}. Commencing database injection...")
            
            for course in courses:
                course_name = course.get('course_name')
                if not course_name:
                    continue
                    
                print(f"⚙️ Processing: {course_name}")
                
                default_pars = []
                
                # 1. PARSE THE TEES & HOLES
                tees_dict = course.get('tees', {})
                for gender, tee_list in tees_dict.items():
                    for tee in tee_list:
                        tee_name = tee.get('tee_name', 'Default')
                        holes = tee.get('holes', [])
                        
                        pars = []
                        yardages = []
                        
                        for hole in holes:
                            pars.append(hole.get('par') if hole.get('par') is not None else '')
                            yardages.append(hole.get('yardage') if hole.get('yardage') is not None else '')
                            
                        # Pad to 18 holes to prevent front-end grid crashes
                        while len(pars) < 18:
                            pars.append('')
                            yardages.append('')
                            
                        if not default_pars:
                            default_pars = pars
                            
                        # 2. INJECT INTO COURSE_TEES TABLE
                        tee_formatted_name = f"{tee_name} ({gender.capitalize()})"
                        tee_data = {
                            "course_name": course_name,
                            "tee_name": tee_formatted_name,
                            "pars": pars[:18],
                            "yardages": yardages[:18]
                        }
                        
                        try:
                            existing_tee = supabase.table('course_tees').select('id').eq('course_name', course_name).eq('tee_name', tee_formatted_name).execute()
                            if not existing_tee.data:
                                supabase.table('course_tees').insert(tee_data).execute()
                        except Exception as e:
                            pass # Silently skip duplicates

                # 3. INJECT INTO COURSE_DIRECTORY TABLE
                dir_data = {
                    "course_name": course_name,
                    "pars": default_pars if default_pars else [''] * 18
                }
                
                try:
                    existing_dir = supabase.table('course_directory').select('course_name').eq('course_name', course_name).execute()
                    if not existing_dir.data:
                        supabase.table('course_directory').insert(dir_data).execute()
                except Exception as e:
                    pass
                    
        except Exception as e:
            print(f"🚨 Critical Script Error for {prov}: {e}")

    print("\n✅ Database injection complete for Western Canada!")

if __name__ == "__main__":
    fetch_and_store_courses()
