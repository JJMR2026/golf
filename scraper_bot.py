import os
import requests
from supabase import create_client, Client

# Initialize Environment Variables passed from GitHub Actions
GOLF_API_KEY = os.environ.get("GOLF_API_KEY")
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if not all([GOLF_API_KEY, SUPABASE_URL, SUPABASE_KEY]):
    print("❌ Missing required secrets. Exiting.")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def harvest_courses():
    # 1. Pop the top search term off the queue
    queue_res = supabase.table('api_search_queue').select('*').limit(1).execute()
    
    if not queue_res.data:
        print("✅ Queue is completely empty. All terms have been searched!")
        return

    target = queue_res.data[0]
    term = target['search_term']
    term_id = target['id']
    
    print(f"🔍 Harvesting courses for: '{term}'")

    # 2. Hit the GolfCourseAPI
    headers = {'Authorization': f'Key {GOLF_API_KEY}'}
    search_url = "https://api.golfcourseapi.com/v1/search"
    
    try:
        response = requests.get(search_url, headers=headers, params={"search_query": term}, timeout=10)
        
        if response.status_code == 429:
            print("⚠️ API Rate limit hit. Exiting cleanly. Will retry tomorrow.")
            return
            
        response.raise_for_status()
        courses = response.json().get("courses", [])
        
        added_count = 0
        
        for course in courses:
            # Enforce Canadian tracks only
            location = course.get("location", {})
            country = str(location.get("country", "")).strip().upper()
            if country != "CANADA":
                continue
                
            club_name = course.get("club_name", "").upper().strip()
            course_name = course.get("course_name", "").upper().strip()
            full_name = f"{club_name} - {course_name}" if course_name and course_name != club_name else club_name
            
            # Extract 18-hole par layout
            tees = course.get("tees", {})
            valid_holes = None
            
            for gender in ['male', 'female']:
                for tee in tees.get(gender, []):
                    if tee.get('number_of_holes') == 18 and 'holes' in tee:
                        holes_list = tee['holes']
                        if len(holes_list) == 18:
                            valid_holes = [h.get('par', 4) for h in holes_list]
                            break
                if valid_holes:
                    break
            
            if valid_holes:
                # Format for Supabase Postgres Array
                pars_array = "{" + ",".join(map(str, valid_holes)) + "}"
                
                # Upsert into database (ignores duplicates thanks to the UNIQUE constraint)
                db_res = supabase.table('course_directory').upsert({
                    "course_name": full_name,
                    "pars": pars_array
                }, on_conflict="course_name").execute()
                
                added_count += 1
                
        print(f"✅ Extracted and processed {added_count} Canadian layouts for '{term}'.")
        
        # 3. Delete the term from the queue so it doesn't run again tomorrow
        supabase.table('api_search_queue').delete().eq('id', term_id).execute()
        print(f"🗑️ Removed '{term}' from queue.")
        
    except Exception as e:
        print(f"❌ Error during harvest: {e}")

if __name__ == "__main__":
    harvest_courses()
