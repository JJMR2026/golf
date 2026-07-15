// --- DATABASE INITIALIZATION ---
const SUPABASE_URL = "https://hksccpousgspagkqcjzd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_KLpYENB7bIa_8SkAWN90uA_12BcxJKC"; 

let supabaseClient = null;
try {
    if (typeof supabase !== 'undefined') {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
} catch (e) { console.error(e); }

// --- GLOBAL STATE ---
let currentUser = null;
let currentHoleCount = 18;
let currentHoleOffset = 0;
let currentCoursePars = Array(18).fill("");
let currentYardages = Array(18).fill("");
let currentPlayHole = 0;
let roundData = Array.from({length: 18}, () => ({ 
    score: "", putts: "", fir: "", firAdv: [], gir: "", girAdv: [], 
    drive: "", driveException: "", drops: 0, dropsAdv: [], sandSave: "", 
    puttDist: "", driveClub: "", appClub: "", appDist: "" 
}));
let practiceSessionData = [];

// --- INITIALIZATION ---
window.initializeApp = async function() {
    // 1. Auth/State Load
    try {
        if (supabaseClient) {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (session) { 
                currentUser = session.user; 
                document.getElementById('auth-overlay').style.display = 'none'; 
                window.loadLocalState(); 
            }
        }
        if (localStorage.getItem('golf_guest_mode') === 'true') {
            document.getElementById('auth-overlay').style.display = 'none'; 
            window.loadLocalState();
        }
    } catch(e) {}

    // 2. DOM Setup
    window.buildGrid();
    window.updatePlayModeUI();
};

// --- DATA SAVING & SAFTEY ---
window.saveCourseTemplate = async function() {
    if (!currentUser || currentUser.email !== 'jordanrohel@yahoo.ca') return alert("Unauthorized.");
    
    const courseName = document.getElementById('current-course-display').innerText.trim();
    if (!courseName || courseName.includes("NO COURSE")) return alert("Invalid course name.");
    
    let teeName = prompt("Confirm Tee Name to save (or overwrite):");
    if (!teeName) return;

    try {
        await supabaseClient.from('course_tees').delete().eq('course_name', courseName).eq('tee_name', teeName);
        const { error } = await supabaseClient.from('course_tees').insert([{
            course_name: courseName, tee_name: teeName, pars: currentCoursePars, yardages: currentYardages
        }]);
        if (error) throw error;
        alert("✅ Par/Yardage overrides saved for " + courseName);
    } catch(e) { alert("❌ Error: " + e.message); }
};

window.checkActiveRoundSafeguard = function() {
    let hasData = roundData.some(h => h.score !== "" || h.putts !== "" || h.fir !== "");
    if (hasData) {
        return confirm("⚠️ Active round detected. This action will permanently delete your current scorecard. Proceed?");
    }
    return true;
};

// --- PLAY MODE UI ---
window.updatePlayModeUI = function() {
    // 1. Shrink Header
    const title = document.querySelector('h1');
    if(title) { title.style.fontSize = '14px'; title.style.marginBottom = '5px'; }

    // 2. Set Hole
    const par = currentCoursePars[currentPlayHole]; 
    const state = roundData[currentPlayHole]; 
    
    document.getElementById('play-hole-title').innerText = `HOLE ${currentPlayHole + 1}`; 
    document.getElementById('play-par-title').innerText = `PAR ${par || '-'} • ${currentYardages[currentPlayHole] || '-'} YDS`;
    
    // 3. Navigation Controls (Injected dynamically)
    let navHtml = `
        <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
            <button class="nav-btn" onclick="window.changePlayHole(-1)">◀ Prev</button>
            <button class="nav-btn" onclick="window.changePlayHole(1)">Next ▶</button>
        </div>
    `;
    
    const container = document.getElementById('play-mode-container');
    const navTop = document.getElementById('play-nav-top');
    const navBot = document.getElementById('play-nav-bot');
    
    if(!navTop) {
        const top = document.createElement('div'); top.id = 'play-nav-top'; top.innerHTML = navHtml;
        container.prepend(top);
    }
    if(!navBot) {
        const bot = document.createElement('div'); bot.id = 'play-nav-bot'; bot.innerHTML = navHtml;
        container.appendChild(bot);
    }

    // 4. Update Inputs
    document.getElementById('play-score').value = state.score;
    // ... [Rest of existing logic for inputs] ...

    // 5. Admin Trigger (Only if logged in)
    let tmplBtn = document.getElementById('admin-save-template-btn');
    if (currentUser && currentUser.email === 'jordanrohel@yahoo.ca') {
        if(!tmplBtn) {
            tmplBtn = document.createElement('button');
            tmplBtn.id = 'admin-save-template-btn';
            tmplBtn.innerText = '💾 ADMIN: SAVE PARS/YDS';
            tmplBtn.onclick = window.saveCourseTemplate;
            container.appendChild(tmplBtn);
        }
        tmplBtn.style.display = 'block';
    }

    // 6. Persistence
    localStorage.setItem('golf_last_hole', currentPlayHole);
    window.saveLocalState();
};

window.changePlayHole = function(dir) { 
    let endIndex = currentHoleOffset + currentHoleCount; 
    let next = currentPlayHole + dir;
    if (next >= currentHoleOffset && next < endIndex) {
        currentPlayHole = next;
        window.updatePlayModeUI();
    }
};

// --- INITIALIZE ---
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.initializeApp();
        let lastHole = localStorage.getItem('golf_last_hole');
        if (lastHole) currentPlayHole = parseInt(lastHole);
    });
} else {
    window.initializeApp();
}
