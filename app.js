// --- DATABASE INITIALIZATION WITH FALLBACKS ---
const SUPABASE_URL = "https://hksccpousgspagkqcjzd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_KLpYENB7bIa_8SkAWN90uA_12BcxJKC"; 

let supabaseClient = null;

try {
    if (typeof supabase !== 'undefined') {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
        console.warn("Supabase library not detected. App running in offline/guest mode only.");
    }
} catch (e) {
    console.error("Supabase failed to initialize:", e);
}

if (typeof Chart !== 'undefined') {
    Chart.defaults.color = '#9ca3af'; 
    Chart.defaults.borderColor = '#2a2a2a';
}

// --- GLOBAL VARIABLES ---
let currentUser = null;
let currentHoleCount = 18;
let currentHoleOffset = 0;
let currentCoursePars = Array(18).fill("");
let currentYardages = Array(18).fill("");
let currentPlayHole = 0;

let roundData = Array.from({length: 18}, () => ({ 
    score: "", putts: "", fir: "", firAdv: [], gir: "", girAdv: [], 
    drive: "", driveException: "", drops: 0, dropsAdv: [], sandSave: "", 
    driveClub: "", appClub: "", appDist: ""
}));

let masterAnalyticsData = [];
let availableTees = [];
let selectedTee = null;
let activeModalRoundId = null;
let modalCoursePars = Array(18).fill("");
let modalRoundData = Array.from({length: 18}, () => ({ 
    id: null, score: "", putts: "", fir: "", gir: "", drive: "", drops: 0, sandSave: "" 
}));

let trendChart = null;
let statDetailChartObj = null;
let scorePieChart = null;
let penaltyPieChartObj = null;
let accuracyChart = null;
let parScoringChart = null;

let currentFilteredRounds = [];
let roundWeather = { temp: null, wind: null };
let dismissedWarnings = [];
let currentStatKey = null;
let currentStatTitle = null;

const themes = {
    dark: { bg: '#050505', card: '#121212', border: '#2a2a2a', accent: '#10b981', hover: '#059669', text: '#f3f4f6', muted: '#9ca3af', cell: '#1a1a1a', cellBorder: '#333' },
    light: { bg: '#f3f4f6', card: '#ffffff', border: '#d1d5db', accent: '#10b981', hover: '#059669', text: '#111827', muted: '#6b7280', cell: '#f9fafb', cellBorder: '#e5e7eb' },
    masters: { bg: '#022c16', card: '#064e3b', border: '#065f46', accent: '#fde047', hover: '#eab308', text: '#f3f4f6', muted: '#9ca3af', cell: '#022c16', cellBorder: '#065f46' },
    midnight: { bg: '#0f172a', card: '#1e293b', border: '#334155', accent: '#38bdf8', hover: '#0ea5e9', text: '#f8fafc', muted: '#94a3b8', cell: '#0f172a', cellBorder: '#334155' },
    sunset: { bg: '#1a0b1c', card: '#2d1b30', border: '#4a2c4f', accent: '#f97316', hover: '#d97706', text: '#fff1f2', muted: '#e1adba', cell: '#1a0b1c', cellBorder: '#4a2c4f' }
};

window.applyTheme = function(themeName) {
    if(!themes[themeName]) themeName = 'dark';
    const t = themes[themeName];
    const root = document.querySelector(':root');
    
    if(root) {
        root.style.setProperty('--bg-color', t.bg); 
        root.style.setProperty('--card-bg', t.card);
        root.style.setProperty('--border-color', t.border); 
        root.style.setProperty('--accent-green', t.accent);
        root.style.setProperty('--text-main', t.text); 
        root.style.setProperty('--text-muted', t.muted);
        root.style.setProperty('--cell-bg', t.cell); 
        root.style.setProperty('--cell-border', t.cellBorder);
    }
    
    const metaTheme = document.getElementById('meta-theme-color');
    if(metaTheme) metaTheme.setAttribute('content', t.bg);
    localStorage.setItem('golf_theme', themeName);
    
    const selector = document.getElementById('theme-selector');
    if (selector) selector.value = themeName;
};

let savedTheme = localStorage.getItem('golf_theme') || 'dark'; 
window.applyTheme(savedTheme);

window.initializeApp = async function() {
    try {
        if (supabaseClient) {
            const { data: { session }, error } = await supabaseClient.auth.getSession();
            if (error) throw error;
            if (session) currentUser = session.user; 
        }
    } catch (error) {
        console.warn("Auth check bypassed/offline:", error.message);
    }

    if (currentUser) {
        localStorage.removeItem('golf_guest_mode'); 
        document.getElementById('auth-overlay').style.display = 'none'; 
        window.loadLocalState(); 
        window.processOfflineQueue();
        
        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'PASSWORD_RECOVERY') { 
                document.getElementById('auth-overlay').style.display = 'none'; 
                window.openSettings(); 
                document.getElementById('settings-msg').innerText = "Security token authenticated."; 
            } else if (event === 'SIGNED_IN' && session) { 
                currentUser = session.user; 
                localStorage.removeItem('golf_guest_mode'); 
                document.getElementById('auth-overlay').style.display = 'none'; 
                window.loadLocalState(); 
                window.buildGrid(); 
                window.processOfflineQueue(); 
            } else if (event === 'SIGNED_OUT') { 
                currentUser = null; 
                if (localStorage.getItem('golf_guest_mode') !== 'true') {
                    document.getElementById('auth-overlay').style.display = 'flex'; 
                }
            }
        });
    } else if (localStorage.getItem('golf_guest_mode') === 'true') {
        document.getElementById('auth-overlay').style.display = 'none'; 
        window.loadLocalState(); 
    } else {
        document.getElementById('auth-overlay').style.display = 'flex'; 
    }

    let lastHole = localStorage.getItem('golf_last_hole');
    if (lastHole) currentPlayHole = parseInt(lastHole);
    
    window.buildGrid();
    window.updatePlayModeUI();
};

window.handleAuth = async function(type) {
    const cleanInput = document.getElementById('auth-nickname').value.trim().replace(/\s+/g, '').toLowerCase(); 
    const email = cleanInput.includes('@') ? cleanInput : cleanInput + "@golf.local"; 
    const passInput = document.getElementById('auth-password').value.trim();
    const btn = document.getElementById(type === 'signup' ? 'signup-btn' : 'login-btn');
    
    if (!supabaseClient) {
        alert("Database connection failed. Please check your internet connection or adblocker.");
        return;
    }

    const originalText = btn.innerText; 
    btn.innerText = "⏳..."; 
    btn.disabled = true;

    try { 
        let res;
        if (type === 'signup') {
            res = await supabaseClient.auth.signUp({ email: email, password: passInput });
        } else {
            res = await supabaseClient.auth.signInWithPassword({ email: email, password: passInput });
        }
        if (res.error) throw res.error; 
        
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            currentUser = session.user;
            localStorage.removeItem('golf_guest_mode');
            document.getElementById('auth-overlay').style.display = 'none';
            window.loadLocalState();
            window.buildGrid();
            window.processOfflineQueue();
        }
    } catch (e) { 
        const errEl = document.getElementById('auth-error');
        if (errEl) {
            errEl.style.color = "#ef4444"; 
            errEl.innerText = e.message; 
        } else alert(e.message);
    } finally { 
        btn.innerText = originalText; 
        btn.disabled = false; 
    }
};

window.handleForgotPassword = async function() {
    const cleanInput = document.getElementById('auth-nickname').value.trim().replace(/\s+/g, ''); 
    const email = cleanInput.includes('@') ? cleanInput : cleanInput.toLowerCase() + "@golf.local";
    
    if (!email || !email.includes('@') || email.includes('@golf.local')) {
        return alert("Recovery mapping requires a valid verification email structure.");
    }
    if (!supabaseClient) return alert("Database connection unavailable.");

    try { 
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname }); 
        if (error) throw error; 
        document.getElementById('auth-error').style.color = "var(--accent-green)"; 
        document.getElementById('auth-error').innerText = "Recovery link routed."; 
    } catch (e) { 
        document.getElementById('auth-error').style.color = "#ef4444"; 
        document.getElementById('auth-error').innerText = e.message; 
    }
};

window.changePassword = async function() { 
    if (!supabaseClient) return;
    const { error } = await supabaseClient.auth.updateUser({ password: document.getElementById('new-password').value }); 
    document.getElementById('settings-msg').innerText = error ? "❌ " + error.message : "✅ Updated."; 
};

window.logOut = async function() { 
    localStorage.removeItem('golf_guest_mode'); 
    localStorage.removeItem('golf_round_state'); 
    localStorage.removeItem('golf_last_hole');
    if (supabaseClient) await supabaseClient.auth.signOut(); 
    location.reload(); 
};

window.openSettings = function() { 
    document.getElementById('password-change-section').style.display = currentUser ? 'block' : 'none'; 
    let harvesterSec = document.getElementById('admin-harvester-section');
    if(harvesterSec) harvesterSec.style.display = (currentUser && currentUser.email === 'jordanrohel@yahoo.ca') ? 'block' : 'none';
    document.getElementById('settings-overlay').style.display = 'flex'; 
};

window.continueAsGuest = function() { 
    try {
        currentUser = null; 
        localStorage.setItem('golf_guest_mode', 'true'); 
        document.getElementById('auth-overlay').style.display = 'none'; 
        window.loadLocalState(); 
        window.buildGrid(); 
        window.updatePlayModeUI();
    } catch (e) {
        alert("Failed to initiate guest mode: " + e.message);
    }
};

window.switchView = function(viewId, btn) { 
    document.querySelectorAll('.view-container').forEach(el => el.classList.remove('active')); 
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active')); 
    document.querySelectorAll('.bottom-nav button').forEach(el => el.classList.remove('active'));
    
    document.getElementById(viewId).classList.add('active'); 
    if(btn) btn.classList.add('active'); 
    
    if(viewId === 'view-history') window.fetchHistory(); 
    if(viewId === 'view-analytics') window.loadAnalyticsData(); 
    if(viewId === 'view-range') window.renderClubDistancesUI();
};

window.switchAnalyticsTab = function(tab, btn) { 
    document.querySelectorAll('#view-analytics > .card > div[id^="analytics-tab-"]').forEach(el => el.style.display = 'none'); 
    document.querySelectorAll('.analytics-tabs button').forEach(el => el.classList.remove('active')); 
    document.getElementById('analytics-tab-' + tab).style.display = 'block'; 
    btn.classList.add('active'); 
};

// --- NEW SEAMLESS START ROUND TRANSITION ---
window.startRound = function() {
    const searchCard = document.getElementById('search-card');
    if (searchCard) searchCard.style.display = 'none';
    window.togglePlayMode(true);
    window.saveLocalState();
};

window.checkHarvesterStatus = async function() {
    document.getElementById('settings-overlay').style.display = 'none';
    document.getElementById('insight-detail-title').innerText = "HARVESTER LAYER LOG";
    document.getElementById('insight-detail-content').innerHTML = "⏳ Pinging database...";
    document.getElementById('insight-modal').style.display = 'flex';
    
    if (!supabaseClient) {
        document.getElementById('insight-detail-content').innerHTML = "❌ Database Offline.";
        return;
    }

    try {
        const { data, error } = await supabaseClient.from('course_tees').select('course_name').limit(10000);
        if(error) throw error;
        
        let grouped = {};
        data.forEach(t => { 
            let c = t.course_name.trim().toUpperCase(); 
            grouped[c] = (grouped[c] || 0) + 1; 
        });
        
        let html = `<b>Total Tee Boxes Indexed:</b> ${data.length}<br><b>Unique Courses Indexed:</b> ${Object.keys(grouped).length}<br><br>`;
        html += `<div style="height:200px; overflow-y:auto; background:var(--cell-bg); padding:10px; border-radius:8px; border:1px solid var(--border-color); font-size:12px;">`;
        
        let sorted = Object.keys(grouped).sort((a,b) => grouped[b] - grouped[a]);
        
        sorted.forEach(c => {
            let pct = Math.min(100, (grouped[c] / 6) * 100);
            html += `
                <div style="margin-bottom:8px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                        <span>${c}</span>
                        <span>${grouped[c]} Tees</span>
                    </div>
                    <div style="width:100%; height:6px; background:var(--card-bg); border-radius:3px; overflow:hidden;">
                        <div style="width:${pct}%; height:100%; background:var(--accent-green);"></div>
                    </div>
                </div>`;
        });
        
        html += `</div>`;
        document.getElementById('insight-detail-content').innerHTML = html;
    } catch(e) { 
        document.getElementById('insight-detail-content').innerHTML = "❌ Error fetching status: " + e.message; 
    }
};

// --- STATIC CLUB DISTANCES ENGINE ---
window.renderClubDistancesUI = function() {
    let bag = window.getMyBag();
    let savedDistancesStr = localStorage.getItem('golf_club_distances');
    let savedDistances = savedDistancesStr ? JSON.parse(savedDistancesStr) : {};
    
    let listContainer = document.getElementById('club-distances-list');
    if (!listContainer) return;
    
    let html = "";
    bag.forEach(club => {
        let val = savedDistances[club] || "";
        html += `
            <div style="display: flex; justify-content: space-between; align-items: center; background: var(--cell-bg); padding: 10px 15px; border-radius: 8px; border: 1px solid var(--border-color);">
                <span style="font-weight: bold; font-size: 14px;">${club}</span>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <input type="number" class="club-dist-input" data-club="${club}" value="${val}" placeholder="Yds" style="width: 70px; text-align: right; background: rgba(0,0,0,0.3); border: 1px solid var(--cell-border); padding: 8px; border-radius: 6px; color: var(--text-main); font-weight: bold;">
                    <span style="font-size: 11px; color: var(--text-muted);">YDS</span>
                </div>
            </div>
        `;
    });
    
    listContainer.innerHTML = html;
};

window.saveClubDistances = function() {
    let savedDistancesStr = localStorage.getItem('golf_club_distances');
    let savedDistances = savedDistancesStr ? JSON.parse(savedDistancesStr) : {};
    
    document.querySelectorAll('.club-dist-input').forEach(input => {
        let club = input.getAttribute('data-club');
        let dist = parseInt(input.value);
        if (!isNaN(dist) && dist > 0) {
            savedDistances[club] = dist;
        } else {
            delete savedDistances[club];
        }
    });
    
    localStorage.setItem('golf_club_distances', JSON.stringify(savedDistances));
    alert("✅ Distances saved. The app will now auto-suggest clubs based on these yardages.");
};

window.getSmartClubRecommendation = function(targetDistance) {
    if (!targetDistance || targetDistance <= 0) return "";
    let bag = window.getMyBag();
    let savedDistancesStr = localStorage.getItem('golf_club_distances');
    let clubDistances = savedDistancesStr ? JSON.parse(savedDistancesStr) : {};

    let closestClub = ""; 
    let minDiff = 999;
    
    for (const club of bag) {
        let avgDist = parseInt(clubDistances[club]);
        if (!isNaN(avgDist) && avgDist > 0) {
            let diff = Math.abs(avgDist - targetDistance);
            if (diff < minDiff) { 
                minDiff = diff; 
                closestClub = club; 
            }
        }
    }
    return closestClub;
};

// --- WEATHER ENGINE ---
window.fetchWeatherForCourse = function(courseName) {
    const display = document.getElementById('weather-display'); 
    display.innerText = "🌤️ Locating course for weather...";
    
    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(courseName + ' Golf')}&format=json&limit=1`, { 
        headers: { 'User-Agent': 'GolfScorecardApp/1.0' } 
    })
    .then(res => res.json())
    .then(data => {
        if (data && data.length > 0) {
            window.fetchWeatherByCoords(data[0].lat, data[0].lon, display, courseName);
        } else {
            fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(courseName)}&format=json&limit=1`, { 
                headers: { 'User-Agent': 'GolfScorecardApp/1.0' } 
            })
            .then(res => res.json())
            .then(data2 => {
                if (data2 && data2.length > 0) {
                    window.fetchWeatherByCoords(data2[0].lat, data2[0].lon, display, courseName);
                } else {
                    display.innerText = "⚠️ Weather unavailable";
                }
            }).catch(() => { display.innerText = "⚠️ Weather unavailable"; });
        }
    }).catch(() => { display.innerText = "⚠️ Weather unavailable"; });
};

window.fetchWeatherByCoords = async function(lat, lon, display, courseName) {
    try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`);
        const data = await res.json();
        
        if(data.current_weather) {
            let windAngle = data.current_weather.winddirection; 
            const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]; 
            const dir = dirs[Math.round((((windAngle % 360) + 360) % 360) / 45) % 8];
            
            roundWeather.temp = data.current_weather.temperature + "°C"; 
            roundWeather.wind = `${data.current_weather.windspeed}km/h ${dir}`;
            
            display.innerText = `⛅ ${roundWeather.temp} | 💨 ${roundWeather.wind}`;
            window.saveLocalState();
        }
    } catch(e) { 
        display.innerText = "⚠️ Weather unavailable"; 
    }
};

// --- STATE MANAGEMENT ---
window.saveLocalState = function() { 
    const el = document.getElementById('current-course-display'); 
    if (!el) return; 
    
    localStorage.setItem('golf_round_state', JSON.stringify({ 
        courseName: el.innerText.trim(), 
        holeCount: currentHoleCount, 
        holeOffset: currentHoleOffset, 
        pars: currentCoursePars, 
        yardages: currentYardages, 
        roundData: roundData, 
        weather: roundWeather, 
        dismissedWarnings: dismissedWarnings
    })); 
    localStorage.setItem('golf_last_hole', currentPlayHole);
};

window.loadLocalState = function() { 
    const saved = localStorage.getItem('golf_round_state'); 
    if(saved) { 
        try { 
            const s = JSON.parse(saved); 
            document.getElementById('current-course-display').innerText = s.courseName; 
            document.getElementById('current-course-display').style.color = 'var(--accent-green)'; 
            
            currentHoleCount = s.holeCount || 18; 
            currentHoleOffset = s.holeOffset || 0;
            currentCoursePars = s.pars || Array(18).fill(""); 
            currentYardages = s.yardages || Array(18).fill(""); 
            
            roundData = s.roundData || Array.from({length: 18}, () => ({ 
                score: "", putts: "", fir: "", firAdv: [], gir: "", girAdv: [], 
                drive: "", driveException: "", drops: 0, dropsAdv: [], sandSave: "", 
                driveClub: "", appClub: "", appDist: "" 
            })); 
            
            roundWeather = s.weather || roundWeather; 
            dismissedWarnings = s.dismissedWarnings || [];
            
            if(roundWeather.temp) {
                document.getElementById('weather-display').innerText = `⛅ ${roundWeather.temp} | 💨 ${roundWeather.wind}`; 
            }
            
            let btn18 = document.getElementById('btn-18-holes');
            let btn9 = document.getElementById('btn-9-holes');
            if(btn18) btn18.classList.toggle('active', currentHoleCount === 18); 
            if(btn9) btn9.classList.toggle('active', currentHoleCount === 9); 
            
            let toggleBox = document.getElementById('front-back-toggle');
            let topToggleBox = document.getElementById('top-front-back-toggle');
            
            if (currentHoleCount === 9) { 
                if(toggleBox) toggleBox.style.display = 'inline-flex'; 
                if(topToggleBox) topToggleBox.style.display = 'inline-flex';
                
                let bFront = document.getElementById('btn-front-9');
                let bBack = document.getElementById('btn-back-9');
                let btf = document.getElementById('btn-top-front-9');
                let btb = document.getElementById('btn-top-back-9');
                
                if(bFront) bFront.classList.toggle('active', currentHoleOffset === 0); 
                if(bBack) bBack.classList.toggle('active', currentHoleOffset === 9); 
                if(btf) btf.classList.toggle('active', currentHoleOffset === 0);
                if(btb) btb.classList.toggle('active', currentHoleOffset === 9);
            } else { 
                if(toggleBox) toggleBox.style.display = 'none'; 
                if(topToggleBox) topToggleBox.style.display = 'none';
            }
            
            if(s.courseName && s.courseName !== 'NO COURSE' && s.courseName !== 'NO COURSE SELECTED' && s.courseName !== 'MANUAL SCORECARD (SEARCH TO FETCH)') {
                document.getElementById('search-card').style.display = 'none'; 
                window.togglePlayMode(true);
            }
        } catch(e) {
            console.error("Local state load error", e);
        } 
    } 
};
window.processOfflineQueue = async function() {
    if (!supabaseClient) return;
    const queueStr = localStorage.getItem('golf_offline_queue');
    
    if (queueStr && currentUser) {
        try {
            const queue = JSON.parse(queueStr);
            for (const round of queue) { 
                const { data: roundHeader, error: hErr } = await supabaseClient.from('logged_rounds').insert([round.header]).select('id').single(); 
                if (hErr) throw hErr; 
                
                await supabaseClient.from('hole_scores').insert(round.holes.map(h => ({ ...h, round_id: roundHeader.id }))); 
            }
            localStorage.removeItem('golf_offline_queue'); 
            window.fetchHistory(); 
            window.loadAnalyticsData(); 
            console.log("Offline queue synced successfully.");
        } catch (e) { 
            console.error("Failed to sync offline queue", e); 
        }
    }
};

window.checkActiveRoundSafeguard = function() {
    let hasData = roundData.some(h => h.score !== "" || h.putts !== "" || h.fir !== "" || h.gir !== "");
    if (hasData) {
        return confirm("⚠️ Active round detected. This action will permanently delete your current scorecard. Proceed?");
    }
    return true;
};

// FIX 1 & 2: Rewritten search handler to be fully robust and fix the dropdown clicking bug.
let searchTimeout = null;
const searchInputEl = document.getElementById('course-search-input');
if (searchInputEl) {
    searchInputEl.addEventListener('input', e => {
        const query = e.target.value.trim().toLowerCase(); 
        const dropdown = document.getElementById('search-dropdown'); 
        clearTimeout(searchTimeout);
        
        if (query.length < 2) { 
            dropdown.classList.remove('active'); 
            return; 
        }
        
        searchTimeout = setTimeout(async () => { 
            if (!supabaseClient) return;
            try { 
                const broadSearch = query.substring(0, 4);
                const { data, error } = await supabaseClient.from('course_tees').select('course_name').ilike('course_name', `%${broadSearch}%`).limit(1000); 
                if(error) throw error;
                
                const cleanQuery = query.replace(/\s+/g, '');
                const uniqueCourses = [];
                data.forEach(item => {
                    let c = item.course_name.trim();
                    if (c.replace(/\s+/g, '').toLowerCase().includes(cleanQuery)) {
                        if (!uniqueCourses.includes(c)) uniqueCourses.push(c);
                    }
                });
                
                let limitCourses = uniqueCourses.slice(0, 10);
                if (limitCourses.length > 0) { 
                    dropdown.innerHTML = limitCourses.map(c => `<li onmousedown="window.selectCourseFromDropdown('${c.replace(/'/g, "\\'")}')">${c.toUpperCase()}</li>`).join(''); 
                    dropdown.classList.add('active'); 
                } else { 
                    dropdown.classList.remove('active'); 
                }
            } catch(err) { 
                console.error(err); 
            } 
        }, 300); 
    });

    searchInputEl.addEventListener('keypress', function(e) { 
        if (e.key === 'Enter') { 
            e.preventDefault(); 
            document.getElementById('search-dropdown').classList.remove('active'); 
            window.fetchCourseDetails(); 
        } 
    });
}

window.selectCourseFromDropdown = function(courseName) {
    const searchInput = document.getElementById('course-search-input');
    if (searchInput) {
        searchInput.value = courseName;
    }
    document.getElementById('search-dropdown').classList.remove('active');
    window.fetchCourseDetails();
};

window.getMyBag = function() {
    let clubs = [];
    document.querySelectorAll('.bag-club:checked').forEach(cb => {
        clubs.push(cb.value);
    });
    
    if (clubs.length === 0) {
        clubs = ["Driver", "3 Wood", "5 Hybrid", "6 Iron", "7 Iron", "8 Iron", "9 Iron", "Pitching Wedge", "Gap Wedge", "56 Degree"];
    }
    return clubs;
};

window.populateClubDropdowns = function() {
    let bag = window.getMyBag();
    let driveSelect = document.getElementById('play-drive-club');
    let appSelect = document.getElementById('play-approach-club');
    
    if (driveSelect && appSelect) {
        let currentDrive = driveSelect.value;
        let currentApp = appSelect.value;
        
        let html = '<option value="">Club...</option>';
        bag.forEach(c => {
            html += `<option value="${c}">${c}</option>`;
        });
        
        driveSelect.innerHTML = html;
        appSelect.innerHTML = html;
        
        if (bag.includes(currentDrive)) driveSelect.value = currentDrive;
        if (bag.includes(currentApp)) appSelect.value = currentApp;
    }
};

window.adjustStat = function(field, amount) {
    let el = document.getElementById(`play-${field}`); 
    if(!el) return;
    let current = parseInt(el.value);
    
    if(isNaN(current)) {
        current = (field === 'score' ? parseInt(currentCoursePars[currentPlayHole]) || 4 : 2);
    }
    
    let next = current + amount; 
    if(next < 0) next = 0; 
    el.value = next; 
    window.syncPlayToState(field, next);
};

window.adjustDrop = function(amount) {
    let cVal = parseInt(roundData[currentPlayHole].drops) || 0; 
    let next = cVal + amount; 
    if(next < 0) next = 0;
    
    roundData[currentPlayHole].drops = next; 
    let pd = document.getElementById('play-drops-display');
    if(pd) pd.value = next;
    
    const gridCell = document.getElementById(`grid-drops-${currentPlayHole}`); 
    if(gridCell) { 
        gridCell.innerText = next === 0 ? '-' : next; 
        gridCell.style.color = next > 0 ? '#ef4444' : 'var(--text-muted)'; 
    }
    
    let dropMenu = document.getElementById('drop-sub-menu');
    if(dropMenu) dropMenu.style.display = next === 0 ? 'none' : 'flex'; 
    window.saveLocalState();
};

window.toggleDropType = function(type) {
    let adv = roundData[currentPlayHole].dropsAdv || []; 
    let index = adv.indexOf(type);
    
    if (index > -1) {
        adv.splice(index, 1);
    } else {
        adv.push(type);
    }
    
    roundData[currentPlayHole].dropsAdv = adv; 
    
    ['WATER', 'OB', 'LOST', 'UNPLAYABLE'].forEach(id => { 
        const btn = document.getElementById(`drop-${id.toLowerCase()}`); 
        if(btn) {
            if (adv.indexOf(id) > -1) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }
    }); 
    
    window.saveLocalState();
};

window.setPlayToggle = function(type, status) {
    let current = roundData[currentPlayHole][type]; 
    let nextStatus = (current === status) ? "" : status;
    
    roundData[currentPlayHole][type] = nextStatus; 
    roundData[currentPlayHole][type + 'Adv'] = []; 
    
    const gridCell = document.getElementById(`grid-${type}-${currentPlayHole}`);
    if(gridCell) { 
        let uiText = nextStatus === "" ? "-" : nextStatus.toUpperCase();
        gridCell.innerText = uiText; 
        if (nextStatus === 'hit') {
            gridCell.classList.add('hit');
        } else {
            gridCell.classList.remove('hit');
        }
    }
    
    window.updatePlayModeUI(); 
    window.saveLocalState();
};

window.toggleAdv = function(type, val) {
    let arr = roundData[currentPlayHole][type + 'Adv'] || []; 
    let index = arr.indexOf(val);
    
    if (index > -1) {
        arr.splice(index, 1);
    } else {
        arr.push(val);
    }
    
    roundData[currentPlayHole][type + 'Adv'] = arr; 
    window.updatePlayModeUI(); 
    window.saveLocalState();
};

window.cycleSand = function() {
    let s = roundData[currentPlayHole].sandSave; 
    let next = (s === "") ? "1" : (s === "1" ? "2" : (s === "2" ? "3+" : ""));
    roundData[currentPlayHole].sandSave = next;
    
    const gridCell = document.getElementById(`grid-sandSave-${currentPlayHole}`);
    if(gridCell) { 
        gridCell.innerText = next === "" ? "-" : next; 
        if (next === "1") {
            gridCell.classList.add('hit');
        } else {
            gridCell.classList.remove('hit');
        }
    }
    
    window.updatePlayModeUI(); 
    window.saveLocalState();
};

window.syncPlayToState = function(field, val) {
    roundData[currentPlayHole][field] = val;
    
    const gridInput = document.getElementById(`grid-${field}-${currentPlayHole}`); 
    if(gridInput) gridInput.value = val;
    
    if (field === 'drive') {
        let holeYards = parseInt(currentYardages[currentPlayHole]); 
        let driveYards = parseInt(val);
        if (!isNaN(holeYards) && !isNaN(driveYards)) { 
            let remaining = holeYards - driveYards; 
            if (remaining > 0) { 
                roundData[currentPlayHole]['appDist'] = remaining; 
                let rec = window.getSmartClubRecommendation(remaining); 
                if (rec) roundData[currentPlayHole]['appClub'] = rec; 
            } 
        }
    }
    window.saveLocalState(); 
    window.updatePlayModeUI();
};

window.syncGridToState = function(idx, field, val) {
    roundData[idx][field] = val;
    
    if(currentPlayHole === idx) { 
        const pInput = document.getElementById(`play-${field}`); 
        if(pInput) pInput.value = val; 
    }
    
    let strokes = 0; 
    let parSum = 0; 
    let endIndex = currentHoleOffset + currentHoleCount;
    
    for(let i=currentHoleOffset; i<endIndex; i++) { 
        let s = parseInt(roundData[i].score); 
        let p = parseInt(currentCoursePars[i]) || 4; 
        if(s > 0) { 
            strokes += s; 
            parSum += p; 
        } 
    }
    
    let relToPar = strokes - parSum; 
    let relStr = relToPar > 0 ? `+${relToPar}` : (relToPar === 0 ? 'E' : relToPar);
    let paceScoreEl = document.getElementById('pace-score-display');
    if(paceScoreEl) paceScoreEl.innerText = `Strokes: ${strokes} (${window.getRelativeParString(strokes, parSum)})`; 
    
    window.saveLocalState();
};

window.togglePlayMode = function(isPlayMode) { 
    document.getElementById('btn-play-mode').className = isPlayMode ? 'view-toggle-btn primary' : 'view-toggle-btn'; 
    document.getElementById('btn-grid-mode').className = !isPlayMode ? 'view-toggle-btn primary' : 'view-toggle-btn'; 
    document.getElementById('grid-mode-container').style.display = isPlayMode ? 'none' : 'block'; 
    document.getElementById('play-mode-container').style.display = isPlayMode ? 'flex' : 'none'; 
    
    let topNav = document.getElementById('play-mode-top-nav');
    if (topNav) topNav.style.display = isPlayMode ? 'flex' : 'none';

    let adminBtn = document.getElementById('admin-save-template-btn');
    if (adminBtn) {
        adminBtn.style.display = (!isPlayMode && currentUser && currentUser.email === 'jordanrohel@yahoo.ca') ? 'block' : 'none';
    }

    if(isPlayMode) window.updatePlayModeUI(); 
};

window.changePlayHole = function(dir) { 
    let endIndex = currentHoleOffset + currentHoleCount; 
    currentPlayHole = Math.max(currentHoleOffset, Math.min((endIndex - 1), currentPlayHole + dir)); 
    window.updatePlayModeUI(); 
};

window.setHoleCount = function(count) { 
    if (!window.checkActiveRoundSafeguard()) return;
    
    currentHoleCount = count; 
    
    let btn18 = document.getElementById('btn-18-holes');
    let btn9 = document.getElementById('btn-9-holes');
    
    if (btn18 && btn9) {
        if (count === 18) {
            btn18.classList.add('active');
            btn9.classList.remove('active');
        } else {
            btn18.classList.remove('active');
            btn9.classList.add('active');
        }
    }
    
    let toggleBox = document.getElementById('front-back-toggle');
    let topToggleBox = document.getElementById('top-front-back-toggle');
    
    if (count === 9) { 
        if (toggleBox) toggleBox.style.display = 'inline-flex'; 
        if (topToggleBox) topToggleBox.style.display = 'inline-flex';
        currentHoleOffset = 0; 
        
        let bf = document.getElementById('btn-front-9');
        let bb = document.getElementById('btn-back-9');
        let btf = document.getElementById('btn-top-front-9');
        let btb = document.getElementById('btn-top-back-9');
        
        if (bf && bb) { bf.classList.add('active'); bb.classList.remove('active'); }
        if (btf && btb) { btf.classList.add('active'); btb.classList.remove('active'); }
    } else { 
        if (toggleBox) toggleBox.style.display = 'none'; 
        if (topToggleBox) topToggleBox.style.display = 'none';
        currentHoleOffset = 0; 
    }
    
    currentPlayHole = currentHoleOffset; 
    window.buildGrid(); 
    window.updatePlayModeUI(); 
    window.saveLocalState(); 
};

window.setNineSide = function(side) {
    if (!window.checkActiveRoundSafeguard()) return;
    
    let bf = document.getElementById('btn-front-9');
    let bb = document.getElementById('btn-back-9');
    let btf = document.getElementById('btn-top-front-9');
    let btb = document.getElementById('btn-top-back-9');
    
    if (side === 'front') { 
        currentHoleOffset = 0; 
        if (bf && bb) { bf.classList.add('active'); bb.classList.remove('active'); }
        if (btf && btb) { btf.classList.add('active'); btb.classList.remove('active'); }
    } else { 
        currentHoleOffset = 9; 
        if (bf && bb) { bf.classList.remove('active'); bb.classList.add('active'); }
        if (btf && btb) { btf.classList.remove('active'); btb.classList.add('active'); }
    }
    
    currentPlayHole = currentHoleOffset; 
    window.buildGrid(); 
    window.updatePlayModeUI(); 
    window.saveLocalState(); 
};

window.jumpToPlayMode = function(index) { 
    currentPlayHole = index; 
    window.togglePlayMode(true); 
};

window.updatePlayModeUI = function() {
    window.populateClubDropdowns();

    const par = currentCoursePars[currentPlayHole]; 
    const state = roundData[currentPlayHole]; 
    const yds = currentYardages[currentPlayHole] || '-';

    let totPar = 0;
    let totScore = 0;
    let currPar = 0;
    let endIndex = currentHoleOffset + currentHoleCount;
    
    for (let i = currentHoleOffset; i < endIndex; i++) { 
        let s = parseInt(roundData[i].score); 
        let p = parseInt(currentCoursePars[i]); 
        
        if (!isNaN(p)) {
            totPar += p;
        }
        
        if (s > 0) { 
            totScore += s; 
            currPar += (!isNaN(p) ? p : 4); 
        } 
    }
    
    let relToPar = totScore - currPar; 
    let relStr = relToPar > 0 ? `+${relToPar}` : (relToPar === 0 ? 'E' : relToPar);
    
    let paceScoreEl = document.getElementById('pace-score-display');
    if (paceScoreEl) {
        paceScoreEl.innerText = `Strokes: ${totScore} (${relStr})`; 
    }

    if (state.score === "") {
        let bag = window.getMyBag();
        if (par == 4 || par == 5) { 
            if (state.driveClub === "") { 
                let dClubs = [];
                masterAnalyticsData.forEach(r => {
                    (r.hole_scores || []).forEach(h => {
                        if (h.par == par && h.drive_club && bag.includes(h.drive_club)) {
                            dClubs.push(h.drive_club);
                        }
                    });
                });
                state.driveClub = dClubs.length ? dClubs.sort((a,b) => dClubs.filter(v => v===a).length - dClubs.filter(v => v===b).length).pop() : (bag.includes("Driver") ? "Driver" : ""); 
            } 
        }
        if (par == 3) { 
            if (state.appClub === "") { 
                let aClubs = [];
                masterAnalyticsData.forEach(r => {
                    (r.hole_scores || []).forEach(h => {
                        if (h.par == 3 && h.approach_club && bag.includes(h.approach_club)) {
                            aClubs.push(h.approach_club);
                        }
                    });
                });
                state.appClub = aClubs.length ? aClubs.sort((a,b) => aClubs.filter(v => v===a).length - aClubs.filter(v => v===b).length).pop() : (bag.includes("7 Iron") ? "7 Iron" : ""); 
            } 
            state.fir = "hit"; 
            const fCell = document.getElementById(`grid-fir-${currentPlayHole}`); 
            if (fCell) {
                fCell.innerText = "HIT"; 
                fCell.classList.add('hit');
            }
        }
    }

    let holeTitle = document.getElementById('play-hole-title');
    if (holeTitle) {
        holeTitle.innerText = `HOLE ${currentPlayHole + 1}`; 
    }
    
    let parTitle = document.getElementById('play-par-title');
    if (parTitle) {
        parTitle.innerText = `PAR ${par || '-'} • ${yds} YDS`;
    }
    
    let playScore = document.getElementById('play-score');
    if (playScore) {
        playScore.value = state.score; 
    }
    
    let playPutts = document.getElementById('play-putts');
    if (playPutts) {
        playPutts.value = state.putts; 
    }
    
    let playDrive = document.getElementById('play-drive');
    if (playDrive) {
        playDrive.value = state.drive; 
    }
    
    let playDriveClub = document.getElementById('play-drive-club');
    if (playDriveClub) {
        playDriveClub.value = state.driveClub || ""; 
    }
    
    let playAppClub = document.getElementById('play-approach-club');
    if (playAppClub) {
        playAppClub.value = state.appClub || ""; 
    }
    
    let sBtn = document.getElementById('sand-cycle-btn');
    if (sBtn) {
        if (state.sandSave === "1") { 
            sBtn.innerText = "1 STROKE (SAVE)"; 
            sBtn.className = "adv-btn active"; 
            sBtn.style.background = "var(--accent-green)"; 
            sBtn.style.color = "#000"; 
        } else if (state.sandSave === "2") { 
            sBtn.innerText = "2 STROKES"; 
            sBtn.className = "adv-btn active"; 
            sBtn.style.background = "#ef4444"; 
            sBtn.style.color = "#fff"; 
        } else if (state.sandSave === "3+") { 
            sBtn.innerText = "3+ STROKES"; 
            sBtn.className = "adv-btn active"; 
            sBtn.style.background = "#ef4444"; 
            sBtn.style.color = "#fff"; 
        } else { 
            sBtn.innerText = "0 (NONE)"; 
            sBtn.className = "adv-btn"; 
            sBtn.style.background = "rgba(0,0,0,0.4)"; 
            sBtn.style.color = "var(--text-muted)"; 
        }
    }

    let dropsVal = parseInt(state.drops) || 0; 
    let dropsDisp = document.getElementById('play-drops-display');
    if (dropsDisp) {
        dropsDisp.value = dropsVal;
    }
    
    let dropSub = document.getElementById('drop-sub-menu');
    if (dropsVal > 0) { 
        if (dropSub) {
            dropSub.style.display = 'flex'; 
        }
        let adv = state.dropsAdv || []; 
        ['WATER', 'OB', 'LOST', 'UNPLAYABLE'].forEach(id => { 
            const btn = document.getElementById(`drop-${id.toLowerCase()}`); 
            if (btn) {
                if (adv.indexOf(id) > -1) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            }
        }); 
    } else { 
        if (dropSub) {
            dropSub.style.display = 'none'; 
        }
    }

    ['fir', 'gir'].forEach(type => {
        let hb = document.getElementById(`${type}-hit-btn`); 
        let mb = document.getElementById(`${type}-miss-btn`); 
        let hitSubMenu = document.getElementById(`${type}-hit-sub-menu`);
        let missSubMenu = document.getElementById(`${type}-miss-sub-menu`); 
        let advArr = state[type + 'Adv'] || [];
        let stateVal = state[type];
        
        if (hb) hb.classList.toggle('active', stateVal === 'hit');
        if (mb) mb.classList.toggle('active', stateVal === 'miss');
        
        if (hitSubMenu) {
            hitSubMenu.style.display = stateVal === 'hit' ? 'flex' : 'none';
            document.querySelectorAll(`#${type}-hit-sub-menu .sub-hit`).forEach(btn => {
                let val = btn.innerText.trim().toUpperCase();
                btn.classList.toggle('active', advArr.indexOf(val) > -1);
            });
        }

        if (missSubMenu) { 
            missSubMenu.style.display = stateVal === 'miss' ? 'flex' : 'none'; 
            document.querySelectorAll(`#${type}-miss-sub-menu .sub-miss`).forEach(btn => { 
                let val = btn.id.split('-').pop().toUpperCase(); 
                btn.classList.toggle('active', advArr.indexOf(val) > -1);
            }); 
        }
    });
    
    let dBlock = document.getElementById('play-fir-block'); 
    if (dBlock) { 
        document.querySelectorAll('#play-fir-block button, #play-fir-block input, #play-fir-block select').forEach(el => {
            el.disabled = (par == 3);
        }); 
        dBlock.style.opacity = (par == 3) ? '0.3' : '1'; 
    }

    localStorage.setItem('golf_last_hole', currentPlayHole);
};

window.saveCourseTemplate = async function() {
    if (!currentUser || currentUser.email !== 'jordanrohel@yahoo.ca') {
        return alert("Unauthorized. Admin access required.");
    }
    
    const courseName = document.getElementById('current-course-display').innerText.trim();
    if (!courseName || courseName === 'NO COURSE SELECTED' || courseName === 'MANUAL SCORECARD (SEARCH TO FETCH)') {
        return alert("⚠️ Please provide a valid Course Name.");
    }
    
    let teeName = "";
    let setupTeeInput = document.getElementById('setup-tee');
    
    if (setupTeeInput && setupTeeInput.value) {
        teeName = setupTeeInput.value.trim();
    }
    
    if (!teeName && selectedTee) {
        teeName = selectedTee.tee_name.trim();
    }
    
    if (!teeName) {
        teeName = prompt("Confirm the name of the Tee Box to save or overwrite:");
    }
    
    if (!teeName) {
        return;
    }

    const btn = document.getElementById('admin-save-template-btn');
    const origText = btn.innerText; 
    btn.innerText = "⏳ PUSHING TO DATABASE..."; 
    btn.disabled = true;

    try {
        if (!supabaseClient) {
            throw new Error("Database offline.");
        }
        
        await supabaseClient.from('course_tees').delete().eq('course_name', courseName).eq('tee_name', teeName);
        
        const { error } = await supabaseClient.from('course_tees').insert([{ 
            course_name: courseName, 
            tee_name: teeName, 
            pars: currentCoursePars, 
            yardages: currentYardages 
        }]);
        
        if (error) {
            throw error;
        }
        
        alert("✅ Par/Yardage overrides explicitly saved for " + courseName);
    } catch(e) { 
        alert("❌ Error saving template: " + e.message); 
    } finally { 
        btn.innerText = origText; 
        btn.disabled = false; 
    }
};

window.fetchCourseDetails = async function() {
    if (!window.checkActiveRoundSafeguard()) return;
    
    const searchInput = document.getElementById('course-search-input');
    if (!searchInput) return;
    
    const query = searchInput.value.trim(); 
    if(!query) return;
    
    const fetchBtn = document.getElementById('fetch-course-btn'); 
    const originalText = fetchBtn ? fetchBtn.innerText : "Fetch";
    if (fetchBtn) {
        fetchBtn.innerText = "⏳..."; 
        fetchBtn.disabled = true; 
    }
    
    const apiStatus = document.getElementById('api-status');
    if (apiStatus) apiStatus.innerText = "Loading...";

    if (!supabaseClient) {
        if (apiStatus) apiStatus.innerText = "⚠️ Offline mode. Type course and hit Start Round.";
        if (fetchBtn) {
            fetchBtn.innerText = originalText; 
            fetchBtn.disabled = false;
        }
        return;
    }

    try {
        const broadSearch = query.substring(0, 4);
        let { data: teeData, error } = await supabaseClient.from('course_tees').select('*').ilike('course_name', `%${broadSearch}%`).limit(1000); 
        
        if (error) throw error;

        if (teeData && teeData.length > 0) {
            let cleanQuery = query.replace(/\s+/g, '').toUpperCase();
            
            let matchedCourse = teeData.find(t => (t.course_name || "").trim().replace(/\s+/g, '').toUpperCase() === cleanQuery);
            
            if (!matchedCourse) {
                matchedCourse = teeData.find(t => (t.course_name || "").trim().replace(/\s+/g, '').toUpperCase().includes(cleanQuery));
            }
            
            if (matchedCourse) {
                const fetchedCourseName = (matchedCourse.course_name || "").trim();
                availableTees = teeData.filter(t => (t.course_name || "").trim() === fetchedCourseName);
                window.fetchWeatherForCourse(fetchedCourseName);
                
                let parsedPars = availableTees[0].pars; 
                if (typeof parsedPars === 'string') { 
                    try { 
                        parsedPars = JSON.parse(parsedPars.replace(/{/g, '[').replace(/}/g, ']')); 
                    } catch(e){} 
                }
                currentCoursePars = Array.isArray(parsedPars) ? [...parsedPars] : Array(18).fill(""); 
                
                let y = availableTees[0].yardages;
                if (typeof y === 'string') { 
                    try { 
                        if (y === "null" || y === "") {
                            y = Array(18).fill(""); 
                        } else {
                            y = JSON.parse(y.replace(/{/g, '[').replace(/}/g, ']')); 
                        }
                    } catch(e) { 
                        y = Array(18).fill(""); 
                    } 
                }
                currentYardages = Array.isArray(y) && y.length > 0 ? [...y] : Array(18).fill(""); 
                
                roundData = Array.from({length: 18}, () => ({ 
                    score: "", putts: "", fir: "", firAdv: [], gir: "", girAdv: [], 
                    drive: "", driveException: "", drops: 0, dropsAdv: [], 
                    sandSave: "", driveClub: "", appClub: "", appDist: "" 
                }));
                
                dismissedWarnings = [];
                
                const display = document.getElementById('current-course-display');
                if (display) {
                    display.innerText = fetchedCourseName.toUpperCase(); 
                    display.style.color = 'var(--accent-green)';
                }
                
                window.populateTeeDropdown(); 
                if (apiStatus) apiStatus.innerText = ""; 
                window.buildGrid(); 
                window.updatePlayModeUI(); 
                window.saveLocalState(); 
                return;
            }
        }
    } catch(e) { 
        console.error("Course fetch failed:", e); 
    } finally { 
        if (fetchBtn) {
            fetchBtn.innerText = originalText; 
            fetchBtn.disabled = false; 
        }
    }
    
    const display = document.getElementById('current-course-display');
    if (display) {
        display.innerText = query.toUpperCase(); 
        display.style.color = 'var(--accent-green)'; 
    }
    if (apiStatus) apiStatus.innerText = "ℹ️ Course not found. Please enter pars manually.";
    
    currentCoursePars = Array(18).fill(""); 
    currentYardages = Array(18).fill(""); 
    availableTees = []; 
    
    window.populateTeeDropdown(); 
    window.buildGrid(); 
    window.updatePlayModeUI(); 
    window.saveLocalState();
};

window.populateTeeDropdown = function() {
    const select = document.getElementById('tee-select'); 
    if (!select) return;
    
    const setupContainer = document.getElementById('course-setup-container');
    if (setupContainer) {
        setupContainer.style.display = 'block';
    }
    
    let displayTees = availableTees;
    // Apply Womens Tee filter logic
    const hideWomens = document.getElementById('hide-womens-tees');
    if (hideWomens && hideWomens.checked) {
        displayTees = displayTees.filter(t => {
            const n = (t.tee_name || "").toUpperCase();
            return !n.includes("WOMEN") && !n.includes("LADIES") && n !== "RED"; 
        });
    }

    const colorOrder = { 'Black': 1, 'Blue': 2, 'White': 3, 'Silver': 4, 'Red': 5 };
    
    displayTees.sort((a, b) => {
        let yardA = 0, yardB = 0;
        try { 
            let yaArr = typeof a.yardages === 'string' ? JSON.parse(a.yardages.replace(/{/g, '[').replace(/}/g, ']')) : a.yardages; 
            if (Array.isArray(yaArr)) yardA = yaArr.reduce((sum, val) => sum + (parseInt(val) || 0), 0); 
        } catch(e) {}
        
        try { 
            let ybArr = typeof b.yardages === 'string' ? JSON.parse(b.yardages.replace(/{/g, '[').replace(/}/g, ']')) : b.yardages; 
            if (Array.isArray(ybArr)) yardB = ybArr.reduce((sum, val) => sum + (parseInt(val) || 0), 0); 
        } catch(e) {}
        
        if (yardA > 0 && yardB > 0 && yardA !== yardB) return yardB - yardA;
        
        let ca = colorOrder[(a.tee_name || "").trim()] || 99; 
        let cb = colorOrder[(b.tee_name || "").trim()] || 99; 
        return ca - cb;
    });
    
    select.innerHTML = '<option value="">-- Select a Tee --</option>' + displayTees.map(t => {
        let yTotal = 0;
        try { 
            let yArr = typeof t.yardages === 'string' ? JSON.parse(t.yardages.replace(/{/g, '[').replace(/}/g, ']')) : t.yardages; 
            if (Array.isArray(yArr)) yTotal = yArr.reduce((sum, val) => sum + (parseInt(val) || 0), 0); 
        } catch(e) {}
        
        let cr = t.course_rating ? t.course_rating : '-';
        let sr = t.slope_rating ? t.slope_rating : '-';
        let gender = t.gender || 'Men';
        let teeName = (t.tee_name || "").trim();
        
        return `<option value="${t.id}">${teeName} ${yTotal > 0 ? yTotal + ' yds ' : ''}(${sr}/${cr}) for ${gender}</option>`;
    }).join('') + '<option value="new">+ Add New Tee Manually</option>';
    
    if (typeof window.handleTeeChange === 'function') {
        window.handleTeeChange();
    }
};

window.toggleWomensTees = function(isChecked) {
    localStorage.setItem('golf_hide_womens', isChecked ? 'true' : 'false');
    window.populateTeeDropdown();
};

// Initialize checkbox state based on local storage
document.addEventListener('DOMContentLoaded', () => {
    const hideWomens = document.getElementById('hide-womens-tees');
    if (hideWomens) {
        hideWomens.checked = localStorage.getItem('golf_hide_womens') === 'true';
    }
});

window.handleTeeChange = function() {
    const select = document.getElementById('tee-select');
    if (!select) return;
    
    const val = select.value;
    const manualSetup = document.getElementById('manual-tee-setup-container');
    if (manualSetup) {
        manualSetup.style.display = (val === 'new') ? 'block' : 'none';
    }
    
    if (val === 'new' || val === '') {
        selectedTee = null;
        currentCoursePars = Array(18).fill("");
        currentYardages = Array(18).fill("");
    } else if (availableTees && availableTees.length > 0) {
        selectedTee = availableTees.find(t => t.id == val);
        if (selectedTee) {
            let p = selectedTee.pars;
            if (typeof p === 'string') {
                try { 
                    p = JSON.parse(p.replace(/{/g, '[').replace(/}/g, ']')); 
                } catch(e) { 
                    p = Array(18).fill(""); 
                }
            }
            currentCoursePars = Array.isArray(p) ? [...p] : Array(18).fill("");
            
            let y = selectedTee.yardages;
            if (typeof y === 'string') {
                try { 
                    y = JSON.parse(y.replace(/{/g, '[').replace(/}/g, ']')); 
                } catch(e) { 
                    y = Array(18).fill(""); 
                }
            }
            currentYardages = Array.isArray(y) ? [...y] : Array(18).fill("");
        }
    }
    
    window.buildGrid();
    window.updatePlayModeUI();
    window.saveLocalState();
};

window.buildGrid = function() {
    const grid = document.getElementById('scorecard-grid'); 
    if(!grid) return;
    
    grid.innerHTML = ''; 
    grid.style.gridTemplateColumns = `70px repeat(${currentHoleCount}, 48px)`; 
    
    const rows = [
        { label: 'HOLE', type: 'header' }, { label: 'PAR', type: 'par' }, 
        { label: 'YDS', type: 'yardage' }, { label: 'SCORE', type: 'score' }, 
        { label: 'PUTTS', type: 'putts' }, { label: 'FIR', type: 'fir' }, 
        { label: 'GIR', type: 'gir' }, { label: 'DRIVE', type: 'drive' }, 
        { label: 'DROPS', type: 'drops' }, { label: 'SAND', type: 'sandSave' }
    ];
    
    let endIndex = currentHoleOffset + currentHoleCount;
    
    if (!roundData || roundData.length < 18) {
        roundData = Array.from({length: 18}, () => ({ 
            score: "", putts: "", fir: "", firAdv: [], gir: "", girAdv: [], 
            drive: "", driveException: "", drops: 0, dropsAdv: [], 
            sandSave: "", driveClub: "", appClub: "", appDist: "" 
        }));
    }

    rows.forEach(row => {
        const labelCell = document.createElement('div'); 
        labelCell.className = 'row-label'; 
        labelCell.innerText = row.label; 
        grid.appendChild(labelCell);
        
        for (let i = currentHoleOffset; i < endIndex; i++) {
            const cell = document.createElement('div');
            
            let pVal = currentCoursePars[i] !== undefined && currentCoursePars[i] !== null ? currentCoursePars[i] : '';
            let yVal = currentYardages[i] !== undefined && currentYardages[i] !== null ? currentYardages[i] : '';
            let cellData = roundData[i] || {};
            
            if (row.type === 'header') { 
                cell.className = 'cell hole-header'; 
                cell.innerHTML = `<button type="button" onclick="window.jumpToPlayMode(${i})" style="width:100%;height:100%;background:transparent;border:none;color:var(--text-muted);font-weight:bold;cursor:pointer;padding:0;">${i + 1}</button>`; 
            } else if (row.type === 'par') { 
                cell.className = 'cell'; 
                cell.innerHTML = `<input type="number" id="par-input-${i}" inputmode="numeric" min="3" max="6" value="${pVal}" onchange="window.updatePar(${i}, this.value)">`; 
            } else if (row.type === 'yardage') { 
                cell.className = 'cell'; 
                cell.innerHTML = `<input type="number" inputmode="numeric" value="${yVal}" onchange="currentYardages[${i}] = this.value; window.updatePlayModeUI(); window.saveLocalState();">`; 
            } else if (row.type === 'score' || row.type === 'putts' || row.type === 'drive') { 
                cell.className = row.type === 'drive' ? 'cell drive-cell' : 'cell'; 
                cell.id = row.type === 'drive' ? `drive-container-${i}` : ''; 
                let val = cellData[row.type] !== undefined ? cellData[row.type] : '';
                cell.innerHTML = `<input type="number" id="grid-${row.type}-${i}" inputmode="numeric" value="${val}" onchange="window.syncGridToState(${i}, '${row.type}', this.value)">`; 
            } else if (row.type === 'drops') { 
                cell.className = 'cell'; 
                let cVal = parseInt(cellData.drops) || 0; 
                cell.innerHTML = `<button type="button" class="toggle-btn" style="${cVal > 0 ? 'color:#ef4444;' : ''}" id="grid-drops-${i}" onclick="window.toggleGridDrops(${i})">${cVal === 0 ? '-' : cVal}</button>`; 
            } else { 
                cell.className = 'cell'; 
                let cVal = cellData[row.type] || ''; 
                let btnText = "-";
                if (row.type === 'sandSave') {
                    btnText = cVal === "" ? "-" : cVal;
                } else {
                    if (cVal === 'hit') btnText = 'HIT';
                    else if (cVal === 'miss') btnText = 'MISS';
                    else if (cVal === 'drv grn') btnText = 'DRV GRN';
                    else if (cVal === 'under') btnText = 'UNDER';
                }
                
                let isHit = (cVal === 'hit' || cVal === '1' || cVal === 'drv grn' || cVal === 'under');
                cell.innerHTML = `<button type="button" class="toggle-btn ${isHit ? 'hit' : ''}" id="grid-${row.type}-${i}" onclick="window.toggleGridHit(${i}, '${row.type}')">${btnText}</button>`; 
            }
            grid.appendChild(cell);
        }
    });
    if (typeof window.updateDriveDistances === 'function') window.updateDriveDistances();
};

window.toggleGridDrops = function(index) { 
    let cVal = parseInt(roundData[index].drops) || 0; 
    let newVal = cVal >= 10 ? 0 : cVal + 1; 
    roundData[index].drops = newVal; 
    
    if (newVal === 0) {
        roundData[index].dropsAdv = [];
    }
    
    const btn = document.getElementById(`grid-drops-${index}`); 
    if (btn) { 
        btn.innerText = newVal === 0 ? "-" : newVal; 
        btn.style.color = newVal > 0 ? "#ef4444" : "var(--text-muted)"; 
    } 
    
    if (currentPlayHole === index) {
        window.updatePlayModeUI(); 
    }
    window.saveLocalState(); 
};

window.toggleGridHit = function(index, type) { 
    const btn = document.getElementById(`grid-${type}-${index}`); 
    if (!btn) return;
    
    let ns = "";
    
    if (type === 'sandSave') { 
        let cur = btn.innerText; 
        ns = cur === "-" ? "1" : (cur === "1" ? "2" : (cur === "2" ? "3+" : "")); 
        btn.innerText = ns === "" ? "-" : ns; 
    } else { 
        let cur = btn.innerText;
        if (cur === "-") ns = "hit";
        else if (cur === "HIT") ns = "miss";
        else ns = "";
        btn.innerText = ns === "" ? "-" : ns.toUpperCase(); 
    }
    
    if (ns === 'hit' || ns === '1') {
        btn.classList.add('hit'); 
    } else {
        btn.classList.remove('hit'); 
    }
    
    roundData[index][type] = ns === "-" ? "" : ns; 
    
    if (currentPlayHole === index) {
        window.updatePlayModeUI(); 
    }
    window.saveLocalState(); 
};

window.attemptSubmitRound = function() {
    let endIndex = currentHoleOffset + currentHoleCount; 
    let missingHoles = [];
    
    for (let i = currentHoleOffset; i < endIndex; i++) { 
        if (roundData[i].score === "") {
            missingHoles.push(i + 1); 
        }
    }
    
    if (missingHoles.length > 0 && missingHoles.length < currentHoleCount) {
        let mBox = document.getElementById('incomplete-holes-list'); 
        if (mBox) {
            mBox.innerHTML = missingHoles.map(h => `<button type="button" class="adv-btn" style="background:#b45309; color:#fff; border-color:#b45309; padding: 10px; font-size: 14px; min-width: 80px;" onclick="document.getElementById('incomplete-modal').style.display='none'; window.jumpToPlayMode(${h-1});">Hole ${h}</button>`).join('');
        }
        let iModal = document.getElementById('incomplete-modal');
        if (iModal) {
            iModal.style.display = 'flex';
        }
    } else { 
        window.forceSubmitRound(); 
    }
};

window.forceSubmitRound = async function() {
    let iModal = document.getElementById('incomplete-modal');
    if (iModal) {
        iModal.style.display = 'none';
    }
    
    if (!currentUser) { 
        if (confirm("Guest Round Complete!\n\nSince you are not logged in, this scorecard cannot be saved to the permanent History dashboard.\n\nClear your local scorecard to start a new round?")) { 
            localStorage.removeItem('golf_round_state'); 
            location.reload(); 
        } 
        return; 
    }
    
    const courseName = document.getElementById('current-course-display').innerText.trim();
    if (!courseName || courseName === 'NO COURSE SELECTED' || courseName === 'MANUAL SCORECARD (SEARCH TO FETCH)') {
        return alert("⚠️ Please fetch a valid course.");
    }
    
    const teeVal = document.getElementById('tee-select').value; 
    let teeName = null; 
    let rType = document.getElementById('round-type-select').value;
    
    if (teeVal === 'new') { 
        let sTee = document.getElementById('setup-tee');
        if (sTee) teeName = sTee.value.trim(); 
        if (teeName && supabaseClient) { 
            try { 
                await supabaseClient.from('course_tees').insert([{ 
                    course_name: courseName, tee_name: teeName, pars: currentCoursePars, yardages: currentYardages 
                }]); 
            } catch(e) {} 
        } 
    } else if (selectedTee) { 
        teeName = (selectedTee.tee_name || "").trim(); 
    }

    let finalTeeName = teeName + (rType !== 'Regular' ? ' [' + rType + ']' : '');
    let totalScore = 0; 
    let totalPutts = 0; 
    const holesPayload = []; 
    let missingCheck = []; 
    let endIndex = currentHoleOffset + currentHoleCount;

    for (let i = currentHoleOffset; i < endIndex; i++) {
        const s = parseInt(roundData[i].score); 
        let p = parseInt(currentCoursePars[i]) || 4;
        
        if (!isNaN(s)) {
            totalScore += s; 
            let validPutts = roundData[i].putts !== "" ? parseInt(roundData[i].putts) : null;
            let validDrive = roundData[i].drive !== "" ? parseInt(roundData[i].drive) : null;

            if (validPutts !== null) totalPutts += validPutts;
            
            if (roundData[i].putts === "" || roundData[i].gir === "" || (p > 3 && roundData[i].fir === "") || (p > 3 && roundData[i].drive === "" && (!roundData[i].driveException || roundData[i].driveException === ""))) { 
                missingCheck.push(i+1); 
            }

            holesPayload.push({ 
                user_id: currentUser.id, hole_number: i + 1, par: parseInt(currentCoursePars[i]) || null, 
                score: s, putts: validPutts, fir: roundData[i].fir || null, fir_adv: (roundData[i].firAdv || []).join(','), 
                gir: roundData[i].gir || null, gir_adv: (roundData[i].girAdv || []).join(','),
                drive_distance: validDrive, drive_exception: roundData[i].driveException || null, 
                drops: parseInt(roundData[i].drops) || 0, drops_adv: (roundData[i].dropsAdv || []).join(','),
                sand_save: roundData[i].sandSave || null, drive_club: roundData[i].driveClub || null, approach_club: roundData[i].appClub || null
            });
        }
    }
    
    if (holesPayload.length === 0) return alert("⚠️ No scores entered.");
    if (missingCheck.length > 0) { 
        if (!confirm(`⚠️ You are missing some stats (Putts/FIR/GIR/Drive) on the following holes:\n\nHole(s): ${missingCheck.join(', ')}\n\nSubmit scorecard anyway?`)) return; 
    }

    const submitBtn = document.getElementById('submit-round-btn'); 
    const originalBtnText = submitBtn ? submitBtn.innerText : "COMPLETE ROUND";
    
    if (submitBtn) { 
        submitBtn.innerText = "⏳ SAVING..."; 
        submitBtn.disabled = true; 
    }

    let crToSave = selectedTee ? selectedTee.course_rating : null;
    let srToSave = selectedTee ? selectedTee.slope_rating : null;

    try {
        if (!supabaseClient) throw new Error("Offline");
        
        const { data: roundHeader, error: headerError } = await supabaseClient.from('logged_rounds').insert([{ 
            user_id: currentUser.id, course_name: courseName, total_score: totalScore, total_putts: totalPutts, 
            tee_name: finalTeeName, weather_temp: roundWeather.temp, weather_wind: roundWeather.wind,
            course_rating: crToSave, slope_rating: srToSave
        }]).select('id').single();
        
        if (headerError) throw headerError;
        
        await supabaseClient.from('hole_scores').insert(holesPayload.map(h => ({ ...h, round_id: roundHeader.id })));
        
        alert("✅ Round logged!"); 
        localStorage.removeItem('golf_round_state'); 
        window.fetchCourseDetails(); 
    } catch(e) { 
        console.error(e); 
        const queueStr = localStorage.getItem('golf_offline_queue'); 
        let queue = queueStr ? JSON.parse(queueStr) : [];
        
        queue.push({ 
            header: { 
                user_id: currentUser.id, course_name: courseName, total_score: totalScore, total_putts: totalPutts, 
                tee_name: finalTeeName, weather_temp: roundWeather.temp, weather_wind: roundWeather.wind,
                course_rating: crToSave, slope_rating: srToSave
            }, 
            holes: holesPayload 
        });
        
        localStorage.setItem('golf_offline_queue', JSON.stringify(queue));
        alert("📶 Network Offline.\n\nRound saved to your local device. It will automatically upload to the cloud the next time you open the app online.");
        localStorage.removeItem('golf_round_state'); 
        location.reload();
    } finally { 
        if (submitBtn) { 
            submitBtn.innerText = originalBtnText; 
            submitBtn.disabled = false; 
        } 
    }
};
window.fetchHistory = function() {
    if (!currentUser || !supabaseClient) return;
    
    supabaseClient.from('logged_rounds').select('*, hole_scores(*)').eq('user_id', currentUser.id).order('date_played', { ascending: false }).then(({data}) => {
        if (!data || data.length === 0) { 
            let hList = document.getElementById('history-list');
            if (hList) {
                hList.innerHTML = '<div class="empty-state">No arrays found.</div>'; 
            }
            return; 
        }
        
        const activeTabBtn = document.querySelector('#view-history .analytics-tabs button.active');
        const filterType = activeTabBtn ? (activeTabBtn.innerText.includes('Range') ? 'RANGE' : (activeTabBtn.innerText.includes('Sim') ? 'SIM' : 'REAL')) : 'REAL';
        window.renderHistoryList(data, filterType);
    });
};

window.filterHistoryList = function(type, btn) {
    document.querySelectorAll('#view-history .analytics-tabs button').forEach(el => {
        el.classList.remove('active');
    }); 
    
    if (btn) {
        btn.classList.add('active');
    }
    
    if (!supabaseClient) return;
    
    supabaseClient.from('logged_rounds').select('*, hole_scores(*)').eq('user_id', currentUser.id).order('date_played', { ascending: false }).then(({data}) => { 
        if (data) {
            window.renderHistoryList(data, type); 
        }
    });
};

window.renderHistoryList = function(allData, type) {
    let data = allData.filter(r => { 
        let tName = r.tee_name || ""; 
        if (type === 'RANGE') return tName.includes('[RANGE]'); 
        if (type === 'SIM') return tName.includes('[SIM]'); 
        return !tName.includes('[RANGE]') && !tName.includes('[SIM]'); 
    });
    
    const tbody = document.getElementById('history-list'); 
    if (!tbody) return;
    
    if (data.length === 0) { 
        tbody.innerHTML = '<div class="empty-state">No saved records here.</div>'; 
        return; 
    }
    
    let html = "";
    const grouped = data.reduce((acc, round) => { 
        const year = new Date(round.date_played).getUTCFullYear(); 
        if (!acc[year]) acc[year] = []; 
        acc[year].push(round); 
        return acc; 
    }, {});
    
    Object.keys(grouped).sort((a,b) => b-a).forEach((year, index) => {
        const rounds = grouped[year];
        html += `<details class="year-folder" ${index === 0 ? 'open' : ''}><summary>${year} Season <span style="font-size:12px; font-weight:normal; color:var(--text-muted);">${rounds.length} Rounds</span></summary><div class="folder-content">`;
        
        rounds.forEach(r => {
            const holesPlayed = r.hole_scores ? r.hole_scores.filter(h => h.score && h.score > 0).length : 0;
            let cName = (r.course_name || "Unknown").replace(/'/g, "\\'").replace(/"/g, '&quot;');
            let wTemp = (r.weather_temp || "").replace(/'/g, "\\'").replace(/"/g, '&quot;');
            let wWind = (r.weather_wind || "").replace(/'/g, "\\'").replace(/"/g, '&quot;');
            
            html += `<div class="history-item" onclick="window.openHistoryModal('${r.id}', '${cName}', '${r.date_played}', ${r.total_score}, ${holesPlayed}, '${wTemp}', '${wWind}')">
                <div><strong>${(r.course_name || "Unknown").toUpperCase()}</strong><br><span style="font-size:12px;color:var(--text-muted)">${r.date_played}</span></div>
                <div style="text-align:right;"><strong style="color:var(--accent-green);font-size:18px;">${r.total_score}</strong></div>
            </div>`;
        });
        
        html += `</div></details>`;
    });
    tbody.innerHTML = html;
};

window.openHistoryModal = async function(id, name, date, score, holesPlayed, temp, wind) {
    let tEl = document.getElementById('modal-course-title'); 
    if (tEl) tEl.innerText = name; 
    
    let sEl = document.getElementById('modal-total-score'); 
    if (sEl) sEl.innerText = score; 
    
    let wEl = document.getElementById('modal-weather'); 
    if (wEl) wEl.innerText = temp ? `⛅ ${temp}` : ''; 
    
    let windEl = document.getElementById('modal-wind-dir'); 
    if (windEl) windEl.innerText = wind ? `💨 ${wind}` : '';
    
    let dEl = document.getElementById('modal-course-date'); 
    if (dEl) dEl.innerText = date;
    
    activeModalRoundId = id; 
    
    let hMod = document.getElementById('history-modal');
    if (hMod) hMod.style.display = 'flex'; 
    
    let gMod = document.getElementById('modal-scorecard-grid');
    if (gMod) gMod.innerHTML = '⏳ Loading...';
    
    if (holesPlayed === 0) { 
        if (gMod) {
            gMod.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-muted);">Bulk imported rounds do not contain hole-by-hole data.</div>'; 
        }
        return; 
    }
    
    if (!supabaseClient) return;
    
    const { data } = await supabaseClient.from('hole_scores').select('*').eq('round_id', id).order('hole_number', { ascending: true });
    
    let startHole = 0, endHole = 18;
    if (data && data.length > 0 && data.length < 18) { 
        let firstHole = data[0].hole_number; 
        if (firstHole > 9) { 
            startHole = 9; 
            endHole = 18; 
        } else { 
            startHole = 0; 
            endHole = 9; 
        } 
    }
    
    let viewHoles = endHole - startHole;
    
    modalCoursePars = Array(viewHoles).fill(""); 
    modalRoundData = Array.from({length: viewHoles}, () => ({ 
        id: null, 
        score: "", 
        putts: "", 
        fir: "", 
        gir: "", 
        drive: "", 
        drops: 0, 
        sandSave: "" 
    }));
    
    if (data) {
        data.forEach(h => { 
            const i = h.hole_number - 1 - startHole; 
            if (i >= 0 && i < viewHoles) { 
                modalCoursePars[i] = h.par || ""; 
                modalRoundData[i] = {
                    id: h.id,
                    score: h.score || "",
                    putts: h.putts !== null ? h.putts : "",
                    fir: h.fir || "",
                    firAdv: h.fir_adv ? h.fir_adv.split(',') : [],
                    gir: h.gir || "",
                    girAdv: h.gir_adv ? h.gir_adv.split(',') : [],
                    drive: h.drive_distance || "",
                    drops: h.drops || 0,
                    dropsAdv: h.drops_adv ? h.drops_adv.split(',') : [],
                    sandSave: h.sand_save || ""
                }; 
            }
        });
    }
    window.buildModalGrid(viewHoles, startHole);
};

window.buildModalGrid = function(holesCount, startOffset) {
    const grid = document.getElementById('modal-scorecard-grid'); 
    if (!grid) return;
    
    grid.innerHTML = ''; 
    grid.style.gridTemplateColumns = `70px repeat(${holesCount}, 48px)`; 
    
    const rows = [
        { label: 'HOLE', type: 'header' }, { label: 'PAR', type: 'par' }, 
        { label: 'SCORE', type: 'score' }, { label: 'PUTTS', type: 'putts' }, 
        { label: 'FIR', type: 'fir' }, { label: 'GIR', type: 'gir' }, 
        { label: 'DRIVE', type: 'drive' }, { label: 'DROPS', type: 'drops' }, 
        { label: 'SAND', type: 'sandSave' }
    ];
    
    rows.forEach(r => {
        const lc = document.createElement('div'); 
        lc.className = 'row-label'; 
        lc.innerText = r.label; 
        grid.appendChild(lc);
        
        for (let i = 0; i < holesCount; i++) {
            const c = document.createElement('div'); 
            c.className = 'cell';
            
            if (r.type === 'header') { 
                c.className = 'cell hole-header'; 
                c.innerText = i + 1 + startOffset; 
            } else if (r.type === 'par') {
                c.innerHTML = `<input type="number" value="${modalCoursePars[i]}" onchange="modalCoursePars[${i}] = this.value">`;
            } else if (['score','putts','drive'].includes(r.type)) {
                c.innerHTML = `<input type="number" value="${modalRoundData[i][r.type]}" onchange="modalRoundData[${i}]['${r.type}'] = this.value">`;
            } else if (r.type === 'drops') { 
                let cVal = parseInt(modalRoundData[i].drops) || 0; 
                c.innerHTML = `<button type="button" class="toggle-btn" style="${cVal > 0 ? 'color:#ef4444;' : ''}" onclick="window.toggleModalDrops(this, ${i})">${cVal === 0 ? '-' : cVal}</button>`; 
            } else { 
                let v = modalRoundData[i][r.type]; 
                let t = r.type === 'sandSave' ? (v === 'yes' ? 'SAVE' : (v === 'no' ? 'MISS' : (v === 'stuck' ? 'STUCK' : '-'))) : (v === 'hit' ? 'HIT' : (v === 'miss' ? 'MISS' : '-')); 
                let isHit = false;
                if (v === 'hit' || v === 'yes' || v === '1') isHit = true;
                c.innerHTML = `<button type="button" class="toggle-btn ${isHit ? 'hit' : ''}" onclick="window.toggleModalHit(this, ${i}, '${r.type}')">${t}</button>`; 
            }
            grid.appendChild(c);
        }
    });
    
    let delBtn = document.getElementById('modal-delete-btn');
    if (delBtn) {
        delBtn.onclick = () => window.deleteActiveRound(activeModalRoundId); 
    }
    
    let saveBtn = document.getElementById('modal-save-btn');
    if (saveBtn) {
        saveBtn.onclick = () => window.saveModalChanges(activeModalRoundId, holesCount);
    }
};

window.toggleModalDrops = function(btn, i) { 
    let cVal = parseInt(modalRoundData[i].drops) || 0; 
    let newVal = cVal >= 4 ? 0 : cVal + 1; 
    modalRoundData[i].drops = newVal; 
    btn.innerText = newVal === 0 ? "-" : newVal; 
    btn.style.color = newVal > 0 ? "#ef4444" : "var(--text-muted)"; 
};

window.toggleModalHit = function(b, i, t) { 
    let ns = "";
    
    if (t === 'sandSave') {
        let cur = b.innerText; 
        ns = cur === "-" ? "1" : (cur === "1" ? "2" : (cur === "2" ? "3+" : "")); 
        b.innerText = ns === "" ? "-" : ns;
    } else {
        let cur = b.innerText;
        if (cur === "-") ns = "hit";
        else if (cur === "HIT") ns = "miss";
        else ns = "";
        b.innerText = ns === "" ? "-" : ns.toUpperCase();
    }
    
    if (ns === 'hit' || ns === '1') {
        b.classList.add('hit'); 
    } else {
        b.classList.remove('hit'); 
    }
    
    modalRoundData[i][t] = ns === "-" ? "" : ns; 
};

window.closeHistoryModal = function() { 
    let hm = document.getElementById('history-modal');
    if (hm) hm.style.display = 'none'; 
    activeModalRoundId = null; 
};

window.saveModalChanges = async function(id, holesCount) {
    if (!id) return; 
    
    let tScore = 0; 
    let tPutts = 0; 
    
    const saveBtn = document.getElementById('modal-save-btn'); 
    if (!saveBtn) return;
    
    const originalText = saveBtn.innerText; 
    saveBtn.innerText = "⏳ Saving..."; 
    saveBtn.disabled = true;
    
    try {
        if (!supabaseClient) throw new Error("Database offline.");
        
        for (let i = 0; i < holesCount; i++) { 
            const hd = modalRoundData[i]; 
            const s = parseInt(hd.score); 
            
            if (!isNaN(s)) {
                tScore += s; 
            }
            if (!isNaN(parseInt(hd.putts))) {
                tPutts += parseInt(hd.putts);
            }
            
            if (hd.id) {
                await supabaseClient.from('hole_scores').update({ 
                    par: parseInt(modalCoursePars[i]) || null, 
                    score: s || null, 
                    putts: hd.putts !== "" ? parseInt(hd.putts) : null, 
                    fir: hd.fir || null, 
                    gir: hd.gir || null, 
                    drive_distance: parseInt(hd.drive) || null, 
                    drops: parseInt(hd.drops) || 0, 
                    sand_save: hd.sandSave || null 
                }).eq('id', hd.id);
            }
        }
        
        await supabaseClient.from('logged_rounds').update({ 
            total_score: tScore, 
            total_putts: tPutts 
        }).eq('id', id); 
        
        alert("✅ Updated."); 
        window.fetchHistory(); 
        window.closeHistoryModal(); 
        window.loadAnalyticsData();
    } catch(e) { 
        console.error(e); 
        alert("❌ Error saving changes."); 
    } finally { 
        saveBtn.innerText = originalText; 
        saveBtn.disabled = false; 
    }
};

window.deleteActiveRound = async function(id) { 
    if (id && confirm("Delete round?")) { 
        if (!supabaseClient) return; 
        await supabaseClient.from('logged_rounds').delete().eq('id', id); 
        alert("🗑️ Deleted."); 
        window.fetchHistory(); 
        window.closeHistoryModal(); 
        window.loadAnalyticsData(); 
    } 
};

// --- ANALYTICS & MATH GLOBAL ENGINE ---
window.getRelativeParString = function(score, par) { 
    if (par === 0 || score === 0) return ""; 
    let diff = score - par; 
    return diff > 0 ? `(+${diff})` : (diff === 0 ? `(E)` : `(${diff})`); 
};

window.calculateHandicap = function(allRounds) {
    // Explicitly ignore Simulator, Range, AND Short Course / Executive rounds
    let validRounds = allRounds.filter(r => 
        !(r.tee_name && r.tee_name.includes('[SIM]')) && 
        !(r.tee_name && r.tee_name.includes('[RANGE]')) &&
        !(r.tee_name && r.tee_name.includes('[EXEC]'))
    ).slice(0, 20);

    const n = validRounds.length; 
    
    if (n < 3) return "--.-";
    
    let diffs = validRounds.map(r => {
        let holesLogged = r.hole_scores ? r.hole_scores.filter(h => h.score > 0).length : 18;
        let is9HoleRound = holesLogged <= 9;
        
        let scoreToUse = r.total_score;
        let crToUse = r.course_rating;
        let srToUse = r.slope_rating;

        if (crToUse && srToUse) {
            // Dynamic scaling: Prevent 9-hole rating math crashes
            if (is9HoleRound && crToUse > 50) {
                // You played 9 holes, but the rating is for 18. Double your score to match.
                scoreToUse = r.total_score * 2;
            } else if (!is9HoleRound && crToUse < 50) {
                // You played 18 holes, but the rating is for a 9-hole course. Double the rating.
                crToUse = crToUse * 2;
            }
            return ((scoreToUse - crToUse) * 113 / srToUse);
        } else {
            // Fallback math for legacy rounds without rating/slope stored
            let parSum = r.hole_scores ? r.hole_scores.reduce((sum, h) => sum + (h.par || 0), 0) : (is9HoleRound ? 36 : 72);
            return (scoreToUse - parSum) * 0.96;
        }
    }).sort((a,b) => a-b);
    
    let countToUse = 1, adj = 0;
    
    if (n === 3) { countToUse = 1; adj = -2.0; } 
    else if (n === 4) { countToUse = 1; adj = -1.0; } 
    else if (n === 5) { countToUse = 1; adj = 0; } 
    else if (n === 6) { countToUse = 2; adj = -1.0; } 
    else if (n >= 7 && n <= 8) { countToUse = 2; adj = 0; } 
    else if (n >= 9 && n <= 11) { countToUse = 3; adj = 0; } 
    else if (n >= 12 && n <= 14) { countToUse = 4; adj = 0; } 
    else if (n >= 15 && n <= 16) { countToUse = 5; adj = 0; } 
    else if (n >= 17 && n <= 18) { countToUse = 6; adj = 0; } 
    else if (n === 19) { countToUse = 7; adj = 0; } 
    else if (n === 20) { countToUse = 8; adj = 0; }
    
    const avg = (diffs.slice(0, countToUse).reduce((a,b) => a+b, 0) / countToUse) + adj; 
    return Math.max(0, (Math.round(avg * 10) / 10)).toFixed(1);
};

window.calculateHcpHistory = function(rounds) {
    let chrono = [...rounds].reverse(); 
    let history = [];
    
    for (let i = 0; i < chrono.length; i++) { 
        let windowRounds = chrono.slice(Math.max(0, i - 19), i + 1).reverse(); 
        history.push({ 
            date: chrono[i].date_played, 
            hcp: window.calculateHandicap(windowRounds) 
        }); 
    } 
    return history;
};

window.pearsonCorrelation = function(x, y) {
    let n = x.length; 
    if (n === 0) return 0;
    
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    
    for (let i = 0; i < n; i++) { 
        sumX += x[i]; 
        sumY += y[i]; 
        sumXY += x[i]*y[i]; 
        sumX2 += x[i]*x[i]; 
        sumY2 += y[i]*y[i]; 
    }
    
    let num = (n * sumXY) - (sumX * sumY); 
    let den = Math.sqrt(((n * sumX2) - (sumX * sumX)) * ((n * sumY2) - (sumY * sumY)));
    
    if (den === 0) return 0; 
    return num / den;
};

window.updateTrophyRoom = function(fRounds) {
    let lowScores = []; 
    let minScore = 999; 
    let longDrives = []; 
    let maxDrive = 0; 
    let lowPuttsList = []; 
    let minPutts = 999; 
    let mostFirsList = []; 
    let maxFir = 0;

    fRounds.forEach(r => {
        let dStr = r.date_played ? new Date(r.date_played).toLocaleDateString(undefined, {month:'short', day:'numeric'}) : "Unknown";
        let holesPlayed = r.hole_scores ? r.hole_scores.filter(h => h.score > 0).length : 0;
        
        if (holesPlayed >= 18) {
            let coursePar = r.hole_scores.reduce((sum, h) => sum + (h.par || 0), 0);
            
            if (r.total_score > 0) { 
                if (r.total_score < minScore) { 
                    minScore = r.total_score; 
                    lowScores = [{c: (r.course_name||"").trim(), d: dStr, p: coursePar}]; 
                } else if (r.total_score === minScore) { 
                    lowScores.push({c: (r.course_name||"").trim(), d: dStr, p: coursePar}); 
                } 
            }
            
            let truePutts = 0; 
            let hp = 0;
            
            r.hole_scores.forEach(h => { 
                if (h.putts !== null && h.putts > 0) { 
                    truePutts += h.putts; 
                    hp++; 
                } 
            });
            
            if (hp >= 18 && truePutts > 0) { 
                if (truePutts < minPutts) { 
                    minPutts = truePutts; 
                    lowPuttsList = [{c: (r.course_name||"").trim(), d: dStr}]; 
                } else if (truePutts === minPutts) { 
                    lowPuttsList.push({c: (r.course_name||"").trim(), d: dStr}); 
                } 
            }
            
            let firs = r.hole_scores.filter(h => h.fir === 'hit' || h.fir === 'drv grn').length;
            if (firs > maxFir) { 
                maxFir = firs; 
                mostFirsList = [{c: (r.course_name||"").trim(), d: dStr}]; 
            } else if (firs === maxFir && firs > 0) { 
                mostFirsList.push({c: (r.course_name||"").trim(), d: dStr}); 
            }
        }
    });

    const tBox = document.getElementById('trophy-room-box'); 
    if (!tBox) return;
    
    const tStyle = "flex: 1; min-width: 120px; background: rgba(0,0,0,0.2); border: 1px solid var(--border-color); border-radius: 8px; padding: 15px; text-align: center;";
    let displayScore = minScore === 999 ? '--' : `${minScore} <span style="font-size:14px; opacity:0.8;">${window.getRelativeParString(minScore, lowScores[0] ? lowScores[0].p : 72)}</span>`;
    
    tBox.innerHTML = `
        <div style="width: 100%; font-size: 14px; font-weight: bold; color: var(--accent-green); text-transform: uppercase; margin-bottom: 5px;">🏆 Trophy Room (18-Holes)</div>
        <div style="${tStyle}">
            <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: bold; margin-bottom: 5px;">Low Round</div>
            <div style="font-size: 24px; color: var(--accent-green); font-weight: bold;">${displayScore}</div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 5px; line-height: 1.4;">${lowScores.length ? `<strong>${lowScores[0].c}</strong><br><span style="opacity:0.6">${lowScores[0].d}</span>` : '--'}</div>
        </div>
        <div style="${tStyle}">
            <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: bold; margin-bottom: 5px;">Fewest Putts</div>
            <div style="font-size: 24px; color: var(--accent-green); font-weight: bold;">${minPutts === 999 ? '--' : minPutts}</div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 5px; line-height: 1.4;">${lowPuttsList.length ? `<strong>${lowPuttsList[0].c}</strong><br><span style="opacity:0.6">${lowPuttsList[0].d}</span>` : '--'}</div>
        </div>
        <div style="${tStyle}">
            <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: bold; margin-bottom: 5px;">Most FIRs</div>
            <div style="font-size: 24px; color: var(--accent-green); font-weight: bold;">${maxFir}</div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 5px; line-height: 1.4;">${mostFirsList.length ? `<strong>${mostFirsList[0].c}</strong><br><span style="opacity:0.6">${mostFirsList[0].d}</span>` : '--'}</div>
        </div>
    `;
};

window.generateInsights = function(fRounds) {
    if (fRounds.length === 0) return "Gathering data...";
    
    let insights = [];
    let recentRounds = fRounds.slice(0, 5);
    
    const agg = (arr) => {
        let stats = { p3:0, p3c:0, p4:0, p4c:0, p5:0, p5c:0, putts:0, hp:0, f9s:0, f9p:0, b9s:0, b9p:0, sOpp:0, sHit:0, wind:[], temp:[], sc:[] };
        
        arr.forEach(r => {
            if (r.weather_temp && r.weather_wind && r.total_score > 0) {
                let t = parseInt(String(r.weather_temp).replace('°C', '')); 
                let w = parseInt(String(r.weather_wind).replace('km/h', '')); 
                let par = r.hole_scores ? r.hole_scores.reduce((sum, h) => sum + (h.par || 0), 0) : 72;
                
                if (!isNaN(t) && !isNaN(w)) { 
                    stats.temp.push(t); 
                    stats.wind.push(w); 
                    stats.sc.push(r.total_score - par); 
                }
            }
            
            if (!r.hole_scores) return;
            
            r.hole_scores.forEach(h => {
                if (h.score && h.par) { 
                    let d = h.score - h.par; 
                    
                    if (h.par === 3) { stats.p3 += d; stats.p3c++; } 
                    if (h.par === 4) { stats.p4 += d; stats.p4c++; } 
                    if (h.par === 5) { stats.p5 += d; stats.p5c++; } 
                    
                    if (h.hole_number <= 9) { 
                        stats.f9s += h.score; 
                        stats.f9p += h.par; 
                    } else { 
                        stats.b9s += h.score; 
                        stats.b9p += h.par; 
                    }
                }
                
                if (h.putts !== null && h.putts > 0) { 
                    stats.putts += h.putts; 
                    stats.hp++; 
                }
                
                if (h.gir === 'miss' && h.score && h.par) { 
                    stats.sOpp++; 
                    if (h.score <= h.par) {
                        stats.sHit++; 
                    }
                }
            }); 
        });
        return stats;
    };

    let glob = agg(fRounds);
    let rec = agg(recentRounds);

    if (glob.hp > 0 && rec.hp > 0 && fRounds.length > 3) { 
        let gAvg = (glob.putts / glob.hp); 
        let rAvg = (rec.putts / rec.hp); 
        let diff = rAvg - gAvg;
        
        if (diff > 0.2) {
            insights.push(`<div class="insight-btn" onclick="window.openInsightDetail('Scoring Leak')"><span style="font-size:18px;">🔴</span><div><b>Putting Slump:</b> You are averaging ${rAvg.toFixed(1)} putts/hole over your last 5 rounds, worse than your overall ${gAvg.toFixed(1)} avg.</div></div>`); 
        } else if (diff < -0.2) {
            insights.push(`<div class="insight-btn" onclick="window.openInsightDetail('Scoring Strength')"><span style="font-size:18px;">🟢</span><div><b>Putting Heat:</b> You are averaging ${rAvg.toFixed(1)} putts/hole recently, beating your global ${gAvg.toFixed(1)} avg.</div></div>`); 
        }
    }
    
    let avgs = [];
    if (glob.p3c > 0) avgs.push({type: 'Par 3s', val: glob.p3/glob.p3c}); 
    if (glob.p4c > 0) avgs.push({type: 'Par 4s', val: glob.p4/glob.p4c}); 
    if (glob.p5c > 0) avgs.push({type: 'Par 5s', val: glob.p5/glob.p5c});
    
    if (avgs.length > 0) { 
        avgs.sort((a,b) => b.val - a.val); 
        insights.push(`<div class="insight-btn" onclick="window.openInsightDetail('Scoring Leak')"><span style="font-size:18px;">🔴</span><div><b>Scoring Leak:</b> Your weakest holes are <b>${avgs[0].type}</b> (+${avgs[0].val.toFixed(1)} to par).</div></div>`); 
    }
    
    if (glob.f9p > 0 && glob.b9p > 0) {
        let f9Avg = glob.f9s - glob.f9p; 
        let b9Avg = glob.b9s - glob.b9p;
        if (b9Avg > f9Avg + 1) {
            insights.push(`<div class="insight-btn" onclick="window.openInsightDetail('Stamina Fade')"><span style="font-size:18px;">🔴</span><div><b>Stamina Fade:</b> You average +${b9Avg.toFixed(1)} on the Back 9 compared to +${f9Avg.toFixed(1)} on the Front 9.</div></div>`); 
        }
    }

    if (insights.length === 0) return "Gathering more round data to generate your performance insights..."; 
    return `<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:10px;">${insights.join('')}</div>`;
};

window.openInsightDetail = function(title) {
    document.getElementById('insight-detail-title').innerText = title.toUpperCase();
    document.getElementById('insight-modal').style.display = 'flex';
    document.getElementById('insight-detail-content').innerHTML = `
        <p>This insight was triggered by a deviation in your recent scoring data compared to your historical baseline.</p>
        <p>In the future, clicking this module will link directly to targeted YouTube drills and practice plans designed specifically to address this metric.</p>
    `;
};

window.updateAnalytics = function() {
    try {
        let actCrs = []; 
        document.querySelectorAll('.course-cb:checked').forEach(cb => { 
            actCrs.push(cb.value.replace(/&quot;/g, '"').replace(/&#39;/g, "'")); 
        });
        
        let actYrs = []; 
        document.querySelectorAll('.year-cb:checked').forEach(cb => { actYrs.push(cb.value); });
        
        let actMonths = []; 
        document.querySelectorAll('.month-cb:checked').forEach(cb => { actMonths.push(cb.value); });
        
        let actPars = []; 
        document.querySelectorAll('.par-cb:checked').forEach(cb => { actPars.push(cb.value); });
        
        let actHoles = []; 
        document.querySelectorAll('.hole-cb:checked').forEach(cb => { actHoles.push(cb.value); });

        if (actCrs.length === 0) { 
            masterAnalyticsData.forEach(r => { 
                let c = (r.course_name || "").trim(); 
                if (!actCrs.includes(c)) actCrs.push(c); 
            }); 
        }
        
        if (actYrs.length === 0) { 
            masterAnalyticsData.forEach(r => { 
                let y = r.date_played ? new Date(r.date_played).getUTCFullYear().toString() : new Date().getUTCFullYear().toString(); 
                if (!actYrs.includes(y)) actYrs.push(y); 
            }); 
        }
        
        if (actMonths.length === 0) actMonths = ["1","2","3","4","5","6","7","8","9","10","11","12"];
        if (actPars.length === 0) actPars = ["3","4","5","6"];
        if (actHoles.length === 0) { 
            for(let i=1; i<=18; i++) actHoles.push(i.toString()); 
        }

        let tfEl = document.getElementById('filter-timeframe'); 
        const timeframe = tfEl ? tfEl.value : 'season'; 
        
        let hfEl = document.getElementById('filter-hole-count'); 
        const holeFilter = hfEl ? hfEl.value : 'all'; 
        
        let fRounds = masterAnalyticsData.filter(r => { 
            if (!actCrs.includes((r.course_name || "").trim())) return false; 
            
            const d = r.date_played ? new Date(r.date_played) : new Date(); 
            if (timeframe === 'season' && d.getUTCFullYear().toString() !== new Date().getUTCFullYear().toString()) return false;
            if (timeframe !== 'season' && timeframe !== 'full' && !actYrs.includes(d.getUTCFullYear().toString())) return false; 
            
            if (r.hole_scores && r.hole_scores.length > 0) {
                const playedHoles = r.hole_scores.filter(h => h.score && h.score > 0).length; 
                if (holeFilter === '18' && playedHoles < 18) return false;
                if (holeFilter === '9' && (playedHoles < 9 || playedHoles >= 18)) return false; 
            }
            return true; 
        });
        
        currentFilteredRounds = fRounds;
        const t = document.getElementById('analytics-data-table');
        
        if (fRounds.length === 0) { 
            if (t) t.innerHTML = `<tbody><tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-muted);">No logs match selected filters.</td></tr></tbody>`; 
            if (typeof window.renderCharts === 'function') window.renderCharts([], [], []);
            
            let aiBox = document.getElementById('ai-insights-box'); 
            if (aiBox) aiBox.innerHTML = "Not enough data.";
            
            let hcpBox = document.getElementById('hcp-display'); 
            if (hcpBox) hcpBox.innerText = "--.-";
            
            let trBox = document.getElementById('trophy-room-box'); 
            if (trBox) trBox.innerHTML = "";
            return; 
        }

        if (timeframe.startsWith('last')) { 
            fRounds = fRounds.slice(0, parseInt(timeframe.replace('last', ''))); 
        }
        
        let hcDisplay = document.getElementById('hcp-display');
        if (hcDisplay && typeof window.calculateHandicap === 'function') { 
            hcDisplay.innerText = window.calculateHandicap(fRounds); 
        }
        
        if (typeof window.renderCharts === 'function') { 
            window.renderCharts(fRounds, actHoles, actPars); 
        }
        
        if (typeof window.generateInsights === 'function') { 
            let aiBox = document.getElementById('ai-insights-box'); 
            if (aiBox) aiBox.innerHTML = window.generateInsights(fRounds); 
        }
        
        if (typeof window.updateTrophyRoom === 'function') { 
            window.updateTrophyRoom(fRounds); 
        }
        
        let s = { hio:0, alb:0, egl:0, brd:0, par:0, bog:0, dbl:0, tpl:0, qd:0, putts:0, pHP:0, drp:0, fH:0, fT:0, gH:0, gT:0, ssH:0, ssT:0 }; 
        let totalStrokes = 0; 
        let totalHolesCount = 0;
        
        fRounds.forEach(r => { 
            let th = r.hole_scores || []; 
            th.forEach(h => { 
                if (!h.score) return; 
                
                totalStrokes += h.score; 
                totalHolesCount++; 
                
                if (h.par) { 
                    const d = h.score - h.par; 
                    if(d === -1) s.brd++; 
                    else if(d === 0) s.par++; 
                    else if(d === 1) s.bog++; 
                }
                
                if (h.putts !== null && h.putts > 0) { 
                    s.putts += h.putts; 
                    s.pHP++; 
                } 
                
                if (h.drops) s.drp += h.drops; 
                
                if (h.fir == 'hit' || h.fir == 'miss' || h.fir == 'drv grn') { 
                    s.fT++; 
                    if(h.fir == 'hit' || h.fir == 'drv grn') s.fH++; 
                } 
                
                if (h.gir == 'hit' || h.gir == 'miss' || h.gir == 'under') { 
                    s.gT++; 
                    if(h.gir == 'hit' || h.gir == 'under') s.gH++; 
                } 
                
                if (h.sand_save === '1' || h.sand_save === 'yes') { 
                    s.ssT++; 
                    s.ssH++; 
                } else if(h.sand_save === '2' || h.sand_save === '3+') { 
                    s.ssT++; 
                }
            }) 
        });
        
        const cA = (tot) => ((tot / totalHolesCount) * 18).toFixed(1); 
        const cP = (tot) => ((tot / totalHolesCount) * 100).toFixed(1) + '%';
        
        if (t) {
            t.innerHTML = `
            <thead>
                <tr>
                    <th>Metric</th>
                    <th>Total</th>
                    <th>Avg / 18</th>
                    <th>Hole %</th>
                </tr>
            </thead>
            <tbody>
                <tr style="background:rgba(0,0,0,0.2); color:var(--accent-green);">
                    <td colspan="4" style="text-align:left; font-size:12px;">SCORING</td>
                </tr>
                <tr onclick="window.openStatGraph('Hole Score', 'score')">
                    <td>Total Score</td>
                    <td>${totalStrokes}</td>
                    <td>${cA(totalStrokes)}</td>
                    <td>-</td>
                </tr>
                <tr onclick="window.openStatGraph('Birdie', 'birdies')">
                    <td>Birdie</td>
                    <td>${s.brd}</td>
                    <td>${cA(s.brd)}</td>
                    <td>${cP(s.brd)}</td>
                </tr>
                <tr onclick="window.openStatGraph('Par', 'pars')">
                    <td>Par</td>
                    <td>${s.par}</td>
                    <td>${cA(s.par)}</td>
                    <td>${cP(s.par)}</td>
                </tr>
                <tr onclick="window.openStatGraph('Bogey', 'bogeys')">
                    <td>Bogey</td>
                    <td>${s.bog}</td>
                    <td>${cA(s.bog)}</td>
                    <td>${cP(s.bog)}</td>
                </tr>
                <tr style="background:rgba(0,0,0,0.2); color:var(--accent-green); border-top: 2px solid var(--border-color);">
                    <td colspan="4" style="text-align:left; font-size:12px;">EXECUTION</td>
                </tr>
                <tr onclick="window.openStatGraph('Putts', 'putts')">
                    <td>Putts</td>
                    <td>${s.putts}</td>
                    <td>${s.pHP > 0 ? ((s.putts / s.pHP) * 18).toFixed(1) : '0.0'}</td>
                    <td>-</td>
                </tr>
                <tr onclick="window.openStatGraph('FIR %', 'fir')">
                    <td>FIR</td>
                    <td>${s.fH} / ${s.fT}</td>
                    <td>-</td>
                    <td>${s.fT > 0 ? ((s.fH / s.fT) * 100).toFixed(1) + '%' : '0.0%'}</td>
                </tr>
                <tr onclick="window.openStatGraph('GIR %', 'gir')">
                    <td>GIR</td>
                    <td>${s.gH} / ${s.gT}</td>
                    <td>-</td>
                    <td>${s.gT > 0 ? ((s.gH / s.gT) * 100).toFixed(1) + '%' : '0.0%'}</td>
                </tr>
                <tr onclick="window.openStatGraph('Drops', 'drops')">
                    <td>Drops (Penalty)</td>
                    <td>${s.drp}</td>
                    <td>${cA(s.drp)}</td>
                    <td>-</td>
                </tr>
            </tbody>`;
        }
    } catch(err) {
        console.error("Analytics Crash Detected: ", err);
        const t = document.getElementById('analytics-data-table');
        if (t) t.innerHTML = `<tbody><tr><td colspan="4" style="color:#ef4444; padding:20px; text-align:center;">❌ Analytics Sync Error: ${err.message}</td></tr></tbody>`;
    }
};

window.loadAnalyticsData = async function() {
    if (!currentUser) { 
        let t = document.getElementById('analytics-data-table');
        if (t) t.innerHTML = '<tbody><tr><td colspan="4" style="text-align:center; padding: 20px; color: var(--text-muted);">Please log in to view Analytics.</td></tr></tbody>'; 
        return; 
    }
    
    let savedTime = localStorage.getItem('golf_filter_timeframe'); 
    if (savedTime) {
        let fTime = document.getElementById('filter-timeframe');
        if (fTime) fTime.value = savedTime;
    }
    
    let savedHole = localStorage.getItem('golf_filter_hole_count'); 
    if (savedHole) {
        let fHole = document.getElementById('filter-hole-count');
        if (fHole) fHole.value = savedHole;
    }
    
    const table = document.getElementById('analytics-data-table'); 
    if (table) table.innerHTML = '<tbody><tr><td colspan="4" style="text-align:center; padding: 20px; color: var(--text-muted);">⏳ Crunching...</td></tr></tbody>';
    
    if (!supabaseClient) {
        if (table) table.innerHTML = `<tbody><tr><td colspan="4" style="text-align:center;color:#ef4444; padding: 20px;">❌ Database Offline. Analytics unavailable.</td></tr></tbody>`;
        return;
    }

    try {
        const { data, error } = await supabaseClient.from('logged_rounds').select('*, hole_scores(*)').eq('user_id', currentUser.id).order('date_played', { ascending: false });
        if (error) throw error; 
        
        masterAnalyticsData = data || []; 
        window.populateFilters(); 
        window.forceSyncFilters(); 
        window.updateAnalytics(); 
    } catch(err) { 
        if (table) table.innerHTML = `<tbody><tr><td colspan="4" style="text-align:center;color:#ef4444; padding: 20px;">❌ Dev Error: ${err.message}</td></tr></tbody>`; 
    }
};

window.populateFilters = function() {
    let uC = []; 
    masterAnalyticsData.forEach(r => { 
        let c = (r.course_name || "").trim(); 
        if (!uC.includes(c)) uC.push(c); 
    }); 
    uC.sort();
    
    let clBox = document.getElementById('course-checkbox-list');
    if (clBox) {
        clBox.innerHTML = `<label class="checkbox-container"><input type="checkbox" id="cb-all-courses" autocomplete="off" checked onchange="window.checkGroupToggles('.course-cb', 'cb-all-courses', 'course-btn-text', 'Course')"> <strong>All Courses</strong></label><hr style="width: 100%; border: 0; border-top: 1px solid var(--border-color); margin: 5px 0;">` + uC.map(c => `<label class="checkbox-container"><input type="checkbox" class="course-cb" value="${c.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}" autocomplete="off" checked onchange="window.checkGroupToggles('.course-cb', 'cb-all-courses', 'course-btn-text', 'Course')"> ${c}</label>`).join('');
    }
    
    let uY = []; 
    masterAnalyticsData.forEach(r => { 
        let y = r.date_played ? new Date(r.date_played).getUTCFullYear().toString() : new Date().getUTCFullYear().toString(); 
        if (!uY.includes(y)) uY.push(y); 
    }); 
    uY.sort((a,b)=>b-a);
    
    let yBox = document.getElementById('year-checkbox-list');
    if (yBox) {
        yBox.innerHTML = `<label class="checkbox-container"><input type="checkbox" id="cb-all-years" autocomplete="off" checked onchange="window.checkGroupToggles('.year-cb', 'cb-all-years', 'year-btn-text', 'Year')"> <strong>All Years</strong></label><hr style="width: 100%; border: 0; border-top: 1px solid var(--border-color); margin: 5px 0;">` + uY.map(y => `<label class="checkbox-container"><input type="checkbox" class="year-cb" value="${y}" autocomplete="off" checked onchange="window.checkGroupToggles('.year-cb', 'cb-all-years', 'year-btn-text', 'Year')"> ${y}</label>`).join('');
    }
};

window.toggleGroupToggles = function(mainCb, childClass, btnTextId, defaultText) { 
    document.querySelectorAll(childClass).forEach(b => { b.checked = mainCb.checked; }); 
    window.updateAnalytics(); 
};

window.checkGroupToggles = function(childClass, mainId, btnTextId, defaultText) { 
    const cbs = Array.from(document.querySelectorAll(childClass)); 
    let allChecked = true; 
    let checkedCount = 0;
    
    cbs.forEach(b => { 
        if (!b.checked) allChecked = false;
        else checkedCount++; 
    });
    
    let mBox = document.getElementById(mainId);
    if (mBox) mBox.checked = allChecked; 
    
    let btnTextEl = document.getElementById(btnTextId);
    if (btnTextEl) btnTextEl.innerText = allChecked ? `All ${defaultText}s` : (checkedCount === 1 ? `1 ${defaultText}` : `${checkedCount} ${defaultText}s`); 
    
    window.updateAnalytics(); 
};

window.toggleFilterDropdown = function(id) { 
    const el = document.getElementById(id); 
    if (el) el.style.display = el.style.display === 'flex' ? 'none' : 'flex'; 
};

window.forceSyncFilters = function() {
    document.querySelectorAll('.multi-select-dropdown input[type="checkbox"]').forEach(cb => { cb.checked = true; });
    
    let monthBtn = document.getElementById('month-btn-text'); 
    if (monthBtn) monthBtn.innerText = 'All Months'; 
    
    let yearBtn = document.getElementById('year-btn-text'); 
    if (yearBtn) yearBtn.innerText = 'All Years';
    
    let courseBtn = document.getElementById('course-btn-text'); 
    if (courseBtn) courseBtn.innerText = 'All Courses'; 
    
    let parBtn = document.getElementById('par-btn-text'); 
    if (parBtn) parBtn.innerText = 'All Pars'; 
    
    let holeBtn = document.getElementById('hole-btn-text'); 
    if (holeBtn) holeBtn.innerText = 'All Holes';
};

window.renderCharts = function(filteredRounds, actHoles, actPars) {
    const tCtx = document.getElementById('scoringTrendChart'); 
    const pC = document.getElementById('scoringPieChart'); 
    const pCtx = document.getElementById('penaltyPieChart'); 
    const aCtx = document.getElementById('accuracyChart'); 
    const psCtx = document.getElementById('parScoringChart');
    
    if (trendChart) trendChart.destroy(); 
    if (scorePieChart) scorePieChart.destroy(); 
    if (penaltyPieChartObj) penaltyPieChartObj.destroy(); 
    if (accuracyChart) accuracyChart.destroy(); 
    if (parScoringChart) parScoringChart.destroy();
    if (window.droppedShotsPieChartObj) window.droppedShotsPieChartObj.destroy();
    
    if (filteredRounds.length === 0) return;
    
    const chartData = [...filteredRounds].reverse(); 
    
    // NEW: Find all active trend metric pills
    let activeMetrics = [];
    document.querySelectorAll('.trend-metric-cb:checked').forEach(cb => {
        activeMetrics.push(cb.value);
    });
    
    let baseScores = [];
    let metricData = {
        hcp: [], putts: [], fir: [], gir: [], acc: [], scram: [], sand: [],
        birdies: [], pars: [], bogeys: [], drops: []
    };
    
    let hcpHist = window.calculateHcpHistory(filteredRounds); 
    metricData.hcp = [...hcpHist].reverse().map(h => h.hcp === "--.-" ? null : parseFloat(h.hcp));

    let tpBrd = 0, tpPar = 0, tpBog = 0, tpDbl = 0;
    let bogDblHoles = {3:0, 4:0, 5:0}; // Tracks where bogeys happen most
    let dW = 0, dOB = 0, dL = 0, dU = 0; // Tracks penalty types
    
    let fL = 0, fR = 0, fS = 0, fTotMiss = 0; 
    let gL = 0, gR = 0, gS = 0, gLg = 0, gTotMiss = 0;
    
    let accLabels = [], firData = [], girData = [];
    let p3T = 0, p3C = 0, p4T = 0, p4C = 0, p5T = 0, p5C = 0;

    chartData.forEach(r => { 
        let targetHoles = r.hole_scores || []; 
        let filteredHoles = [];
        
        targetHoles.forEach(h => { 
            if (actHoles.includes(h.hole_number.toString()) && actPars.includes(h.par.toString())) { 
                filteredHoles.push(h); 
            } 
        });
        
        targetHoles = filteredHoles;
        let rs = 0; 
        
        if (targetHoles.length === 0 && (!r.hole_scores || r.hole_scores.length === 0)) { 
            rs = r.total_score; 
        } else { 
            targetHoles.forEach(h => { rs += (h.score || 0); }); 
        }
        baseScores.push(rs); 
        
        // Populate metric arrays for the trend slicer
        let p=0, fH=0, fT=0, gH=0, gT=0, dr=0, ssH=0, ssT=0, brd=0, pr=0, bog=0, tpA_H=0, tpA_T=0, ts=0, th=0;
        
        targetHoles.forEach(h => {
            if (h.putts !== null && h.putts > 0) { 
                p += h.putts; 
                tpA_T++; 
                if (h.putts < 3) tpA_H++; 
            }
            if (h.drops) dr += h.drops; 
            
            if (h.fir === 'hit' || h.fir === 'drv grn') { fT++; fH++; } 
            else if (h.fir === 'miss') fT++; 
            
            if (h.gir === 'hit' || h.gir === 'under') { gT++; gH++; } 
            else if (h.gir === 'miss') gT++; 
            
            if (h.gir === 'miss') {
                ts++; 
                if (h.score <= h.par) th++;
            }
            
            if (h.sand_save === 'yes' || h.sand_save === '1') { ssT++; ssH++; } 
            else if (h.sand_save === 'no' || h.sand_save === '2' || h.sand_save === '3+') ssT++; 
            
            if (h.score && h.par) { 
                let d = h.score - h.par; 
                if (d === -1) { brd++; tpBrd++; }
                else if (d === 0) { pr++; tpPar++; }
                else if (d === 1) { bog++; tpBog++; }
                else if (d >= 2) { bog++; tpDbl++; } // Graph bogeys as all dropped shots
                
                if (d >= 1 && h.par >= 3 && h.par <= 5) {
                    bogDblHoles[h.par]++;
                }
                
                if (h.par === 3) { p3T += h.score; p3C++; } 
                if (h.par === 4) { p4T += h.score; p4C++; } 
                if (h.par === 5) { p5T += h.score; p5C++; } 
            }
            
            let fA = h.fir_adv || ""; 
            let gA = h.gir_adv || ""; 
            let dA = h.drops_adv || ""; 
            
            if (h.fir === 'miss') { 
                fTotMiss++; 
                if (fA.includes('LEFT')) fL++; 
                if (fA.includes('RIGHT')) fR++; 
                if (fA.includes('SHORT')) fS++; 
            } 
            if (h.gir === 'miss') { 
                gTotMiss++; 
                if (gA.includes('LEFT')) gL++; 
                if (gA.includes('RIGHT')) gR++; 
                if (gA.includes('SHORT')) gS++; 
                if (gA.includes('LONG')) gLg++; 
            } 
            if (h.drops && h.drops > 0) { 
                if (dA.includes('WATER')) dW++; 
                if (dA.includes('OB')) dOB++; 
                if (dA.includes('LOST')) dL++; 
                if (dA.includes('UNPLAYABLE')) dU++; 
            } 
        });
        
        metricData.putts.push(p); 
        metricData.fir.push(fT > 0 ? Math.round((fH/fT)*100) : null); 
        metricData.gir.push(gT > 0 ? Math.round((gH/gT)*100) : null);
        metricData.acc.push((fT + gT) > 0 ? Math.round(((fH + gH) / (fT + gT)) * 100) : null);
        metricData.scram.push(ts > 0 ? Math.round((th/ts)*100) : null); 
        metricData.sand.push(ssT > 0 ? Math.round((ssH/ssT)*100) : null); 
        metricData.birdies.push(brd); 
        metricData.pars.push(pr); 
        metricData.bogeys.push(bog);
        metricData.drops.push(dr);
        
        accLabels.push(new Date(r.date_played).toLocaleDateString(undefined, {month:'short', day:'numeric'})); 
        firData.push(fT > 0 ? Math.round((fH/fT)*100) : null); 
        girData.push(gT > 0 ? Math.round((gH/gT)*100) : null);
    });
    
    let trendDatasets = [{ 
        label: actHoles.length < 18 ? 'Filtered Holes Score' : 'Total Score', 
        data: baseScores, 
        borderColor: '#10b981', 
        backgroundColor: 'rgba(16, 185, 129, 0.1)', 
        borderWidth: 2, 
        pointBackgroundColor: '#121212', 
        pointBorderColor: '#10b981', 
        fill: true, 
        yAxisID: 'y', 
        tension: 0.3 
    }];
    
    const oColors = { hcp:'#f59e0b', putts:'#3b82f6', fir:'#8b5cf6', gir:'#d946ef', acc:'#a855f7', scram:'#10b981', sand:'#eab308', birdies:'#10b981', pars:'#9ca3af', bogeys:'#ef4444', drops:'#ef4444' };
    const oLabels = { hcp:'HCP', putts:'Putts', fir:'FIR %', gir:'GIR %', acc:'Total Acc', scram:'Scrambling', sand:'Sand Save', birdies:'Birdies', pars:'Pars', bogeys:'Bogeys+', drops:'Penalties' };

    activeMetrics.forEach(m => {
        trendDatasets.push({ 
            label: oLabels[m], 
            data: metricData[m], 
            borderColor: oColors[m], 
            backgroundColor: 'transparent', 
            borderWidth: 2, 
            borderDash: [5, 5], 
            pointBackgroundColor: '#121212', 
            pointBorderColor: oColors[m], 
            yAxisID: 'y1', 
            tension: 0.3 
        });
    });
    
    try { 
        if (tCtx && typeof Chart !== 'undefined') {
            trendChart = new Chart(tCtx.getContext('2d'), { 
                type: 'line', 
                data: { 
                    labels: chartData.map(r => new Date(r.date_played).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })), 
                    datasets: trendDatasets 
                }, 
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false, 
                    plugins: { 
                        tooltip: { 
                            callbacks: { 
                                label: function(context) { 
                                    if (context.dataset.label === 'Trendline') return null; 
                                    return context.dataset.label + ': ' + context.raw; 
                                } 
                            } 
                        }, 
                        legend: { 
                            display: true, 
                            labels: {color: '#9ca3af', font: {size: 10}} 
                        }, 
                        title: { display: false } 
                    }, 
                    scales: { 
                        x: { display: false }, 
                        y: { type: 'linear', display: true, position: 'left', grid: { color: '#2a2a2a' } }, 
                        y1: { type: 'linear', display: activeMetrics.length > 0, position: 'right', grid: { drawOnChartArea: false } } 
                    } 
                } 
            }); 
        }
    } catch(e){}

    // Pie Chart Subtext Calculation
 let dsCtx = document.getElementById('droppedShotsPieChart');
    if (dsCtx && typeof Chart !== 'undefined') {
        window.droppedShotsPieChartObj = new Chart(dsCtx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Par 3s', 'Par 4s', 'Par 5s'],
                datasets: [{
                    data: [bogDblHoles[3], bogDblHoles[4], bogDblHoles[5]],
                    backgroundColor: ['#f43f5e', '#14b8a6', '#eab308'],
                    borderWidth: 0
                }]
            },
            options: { 
                responsive: true, maintainAspectRatio: false, 
                plugins: { legend: { position: 'right', labels: {color: '#9ca3af', font: {size: 10}} } } 
            }
        });
    }

    try { 
        if (pC && typeof Chart !== 'undefined') { 
            scorePieChart = new Chart(pC.getContext('2d'), { 
                type: 'doughnut', 
                data: { 
                    labels: ['Birdie or Better', 'Par', 'Bogey', 'Double+'], 
                    datasets: [{ 
                        data: [tpBrd, tpPar, tpBog, tpDbl], 
                        backgroundColor: ['#38bdf8', '#10b981', '#f59e0b', '#ef4444'], 
                        borderWidth: 0 
                    }] 
                }, 
                options: { 
                    responsive: true, maintainAspectRatio: false, 
                    plugins: { 
                        legend: { position: 'right', labels: {color: '#9ca3af', font: {size: 10}} },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let label = context.label || '';
                                    let value = context.raw || 0;
                                    let total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    let percentage = total > 0 ? ((value / total) * 100).toFixed(1) + '%' : '0%';
                                    return `${label}: ${value} (${percentage})`;
                                }
                            }
                        }
                    } 
                } 
            }); 
        } 
    } catch(e){}
    
    try { 
        if (pCtx && typeof Chart !== 'undefined') { 
            penaltyPieChartObj = new Chart(pCtx.getContext('2d'), { 
                type: 'doughnut', 
                data: { 
                    labels: ['Water', 'OB', 'Lost', 'Unplayable'], 
                    datasets: [{ 
                        data: [dW, dOB, dL, dU], 
                        backgroundColor: ['#38bdf8', '#ef4444', '#f59e0b', '#8b5cf6'], 
                        borderWidth: 0 
                    }] 
                }, 
                options: { 
                    responsive: true, maintainAspectRatio: false, 
                    plugins: { 
                        legend: { position: 'right', labels: {color: '#9ca3af', font: {size: 10}} },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let label = context.label || '';
                                    let value = context.raw || 0;
                                    let total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    let percentage = total > 0 ? ((value / total) * 100).toFixed(1) + '%' : '0%';
                                    return `${label}: ${value} (${percentage})`;
                                }
                            }
                        }
                    } 
                } 
            }); 
        } 
    } catch(e){}
    
    try { 
        if (aCtx && typeof Chart !== 'undefined') { 
            accuracyChart = new Chart(aCtx.getContext('2d'), { 
                type: 'line', 
                data: { 
                    labels: accLabels, 
                    datasets: [
                        { label: 'FIR %', data: firData, borderColor: '#8b5cf6', tension: 0.3 }, 
                        { label: 'GIR %', data: girData, borderColor: '#d946ef', tension: 0.3 }
                    ] 
                }, 
                options: { responsive: true, maintainAspectRatio: false } 
            }); 
        } 
    } catch(e){}
    
    try { 
        if (psCtx && typeof Chart !== 'undefined') { 
            parScoringChart = new Chart(psCtx.getContext('2d'), { 
                type: 'bar', 
                data: { 
                    labels: ['Par 3', 'Par 4', 'Par 5'], 
                    datasets: [{ 
                        label: 'Avg Strokes', 
                        data: [
                            p3C > 0 ? (p3T/p3C).toFixed(2) : 0, 
                            p4C > 0 ? (p4T/p4C).toFixed(2) : 0, 
                            p5C > 0 ? (p5T/p5C).toFixed(2) : 0
                        ], 
                        backgroundColor: ['#f43f5e', '#14b8a6', '#eab308'] 
                    }] 
                }, 
                options: { responsive: true, maintainAspectRatio: false } 
            }); 
        } 
    } catch(e){}

    let mpStat = document.getElementById('miss-penalty-stats');
    if (mpStat) { 
        mpStat.innerHTML = `
            <div style="margin-bottom: 10px;"><b>Drive Bias:</b> ${fTotMiss > 0 ? `${Math.round((fL/fTotMiss)*100)}% Left | ${Math.round((fR/fTotMiss)*100)}% Right` : 'No data.'}</div>
            <div><b>Approach Bias:</b> ${gTotMiss > 0 ? `${Math.round((gS/gTotMiss)*100)}% Short | ${Math.round((gL/gTotMiss)*100)}% Left` : 'No data.'}</div>
        `; 
    }
};

window.openStatGraph = function(title, statKey) {
    document.getElementById('stat-graph-title').innerText = title.toUpperCase(); 
    document.getElementById('stat-graph-modal').style.display = 'flex'; 
    currentStatKey = statKey; 
    currentStatTitle = title;
    
    let tfEl = document.getElementById('filter-timeframe'); 
    if (tfEl) { 
        let modTfEl = document.getElementById('modal-filter-timeframe'); 
        if (modTfEl) modTfEl.value = tfEl.value; 
    }
    
    window.refreshModalGraph();
};

window.refreshModalGraph = function() {
    if (!currentStatKey) return;
    
    let modTfEl = document.getElementById('modal-filter-timeframe'); 
    let tFilter = modTfEl ? modTfEl.value : 'season';
    
    let plotData = []; 
    let rList = [...currentFilteredRounds];
    
    if (tFilter === 'last10') rList = rList.slice(0, 10); 
    if (tFilter === 'last20') rList = rList.slice(0, 20); 
    rList = rList.reverse();
    
    rList.forEach(r => {
        let val = 0; 
        let valid = false; 
        let targetHoles = r.hole_scores || [];
        
        if (currentStatKey === 'score') { 
            let sSum = 0; 
            targetHoles.forEach(h => { sSum += (h.score||0); }); 
            val = sSum; valid = true; 
        }
        if (currentStatKey === 'putts') { 
            let th = 0, tp = 0; 
            targetHoles.forEach(h => { if (h.putts !== null && h.putts > 0){ tp += h.putts; th++; } }); 
            if (th > 0) { val = (tp/th)*18; valid = true; } 
        }
        if (currentStatKey === 'fir') { 
            let th = 0, tf = 0; 
            targetHoles.forEach(h => { if (h.fir === 'hit' || h.fir === 'miss' || h.fir === 'drv grn') { tf++; if (h.fir === 'hit' || h.fir === 'drv grn') th++; } }); 
            if (tf > 0) { val = (th/tf)*100; valid = true; } 
        }
        if (currentStatKey === 'gir') { 
            let th = 0, tg = 0; 
            targetHoles.forEach(h => { if (h.gir === 'hit' || h.gir === 'miss' || h.gir === 'under'){ tg++; if (h.gir === 'hit' || h.gir === 'under') th++; } }); 
            if (tg > 0) { val = (th/tg)*100; valid = true; } 
        }
        if (currentStatKey === 'drops') { 
            let dSum = 0; 
            targetHoles.forEach(h => { dSum += (h.drops||0); }); 
            val = dSum; valid = true; 
        }
        if (['hio','egl','brd','par','bog','dbl','tpl','qd'].includes(currentStatKey)) {
            let cnt = 0; 
            targetHoles.forEach(h => { 
                if (h.score && h.par) { 
                    let d = h.score - h.par; 
                    if (currentStatKey === 'hio' && h.score === 1) cnt++; 
                    else if (currentStatKey === 'egl' && d === -2) cnt++; 
                    else if (currentStatKey === 'brd' && d === -1) cnt++; 
                    else if (currentStatKey === 'par' && d === 0) cnt++; 
                    else if (currentStatKey === 'bog' && d === 1) cnt++; 
                    else if (currentStatKey === 'dbl' && d === 2) cnt++; 
                    else if (currentStatKey === 'tpl' && d === 3) cnt++; 
                    else if (currentStatKey === 'qd' && d >= 4) cnt++; 
                } 
            }); 
            val = cnt; valid = true;
        }
        
        if (valid) {
            plotData.push({ x: new Date(r.date_played).toLocaleDateString(undefined, {month:'short', day:'numeric'}), y: val });
        }
    });

    let sgTitle = document.getElementById('stat-graph-title');
    if (sgTitle) sgTitle.innerText = currentStatTitle.toUpperCase();

    if (statDetailChartObj) statDetailChartObj.destroy();
    
    let cEl = document.getElementById('statDetailChart'); 
    if (!cEl || typeof Chart === 'undefined') return;
    
    statDetailChartObj = new Chart(cEl.getContext('2d'), { 
        type: 'line', 
        data: { 
            labels: plotData.map(d => d.x), 
            datasets: [{ 
                label: currentStatTitle, data: plotData.map(d => d.y), 
                borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.2)', borderWidth: 2, fill: true, pointBackgroundColor: '#121212', tension: 0.3 
            }] 
        }, 
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { grid: { color: '#2a2a2a' } }, x: { display: false } } } 
    });
};
window.discardRound = function() {
    if (confirm("Are you sure you want to discard this round? All unsaved progress will be lost.")) {
        localStorage.removeItem('golf_round_state');
        localStorage.removeItem('golf_last_hole');
        location.reload(); // Instantly refreshes back to the blank Search Course screen
    }
};
document.addEventListener('DOMContentLoaded', function() {
    window.initializeApp();
});
