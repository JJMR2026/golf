const SUPABASE_URL = "https://hksccpousgspagkqcjzd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_KLpYENB7bIa_8SkAWN90uA_12BcxJKC"; 
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

Chart.defaults.color = '#9ca3af'; 
Chart.defaults.borderColor = '#2a2a2a';

let currentUser = null;
let currentHoleCount = 18;
let currentHoleOffset = 0;
let currentCoursePars = Array(18).fill("");
let currentYardages = Array(18).fill("");
let currentPlayHole = 0;
let roundData = Array.from({length: 18}, () => ({ score: "", putts: "", fir: "", firAdv: [], gir: "", girAdv: [], drive: "", driveException: "", drops: 0, dropsAdv: [], sandSave: "", puttDist: "", driveClub: "", appClub: "", appDist: "" }));
let masterAnalyticsData = [];
let availableTees = [];
let selectedTee = null;
let activeModalRoundId = null;
let modalCoursePars = Array(18).fill("");
let modalRoundData = Array.from({length: 18}, () => ({ id: null, score: "", putts: "", fir: "", gir: "", drive: "", drops: 0, sandSave: "" }));

let trendChart = null;
let clubChart = null;
let radarChart = null;
let weatherChart = null;
let statDetailChartObj = null;
let currentFilteredRounds = [];
let roundWeather = { temp: null, wind: null };
let dismissedWarnings = [];
let currentStatKey = null;
let currentStatTitle = null;

// Ensure colors load if cache drops
const themes = {
    dark: { bg: '#050505', card: '#121212', border: '#2a2a2a', accent: '#10b981', hover: '#059669', text: '#f3f4f6', muted: '#9ca3af', cell: '#1a1a1a', cellBorder: '#333' },
    light: { bg: '#f3f4f6', card: '#ffffff', border: '#d1d5db', accent: '#10b981', hover: '#059669', text: '#111827', muted: '#6b7280', cell: '#f9fafb', cellBorder: '#e5e7eb' },
    masters: { bg: '#022c16', card: '#064e3b', border: '#065f46', accent: '#fde047', hover: '#eab308', text: '#f3f4f6', muted: '#9ca3af', cell: '#022c16', cellBorder: '#065f46' },
    midnight: { bg: '#0f172a', card: '#1e293b', border: '#334155', accent: '#38bdf8', hover: '#0ea5e9', text: '#f8fafc', muted: '#94a3b8', cell: '#0f172a', cellBorder: '#334155' },
    sunset: { bg: '#1a0b1c', card: '#2d1b30', border: '#4a2c4f', accent: '#f97316', hover: '#d97706', text: '#fff1f2', muted: '#e1adba', cell: '#1a0b1c', cellBorder: '#4a2c4f' },
    ocean: { bg: '#082f49', card: '#0f172a', border: '#0c4a6e', accent: '#06b6d4', hover: '#0284c7', text: '#e0f2fe', muted: '#7dd3fc', cell: '#082f49', cellBorder: '#0c4a6e' },
    crimson: { bg: '#1a0505', card: '#2a0a0a', border: '#4a1111', accent: '#ef4444', hover: '#dc2626', text: '#fee2e2', muted: '#fca5a5', cell: '#1a0505', cellBorder: '#4a1111' },
    neon: { bg: '#0a0a1a', card: '#14142b', border: '#2d2d59', accent: '#d946ef', hover: '#c026d3', text: '#fdf4ff', muted: '#e879f9', cell: '#0a0a1a', cellBorder: '#2d2d59' },
    forest: { bg: '#1e2019', card: '#2c2e25', border: '#434738', accent: '#a3b18a', hover: '#8a9a5b', text: '#e0e2db', muted: '#a8aca1', cell: '#1e2019', cellBorder: '#434738' },
    royal: { bg: '#1a1025', card: '#2a1b38', border: '#452b5e', accent: '#fbbf24', hover: '#d97706', text: '#f3e8ff', muted: '#d8b4fe', cell: '#1a1025', cellBorder: '#452b5e' },
    stealth: { bg: '#000000', card: '#0a0a0a', border: '#1a1a1a', accent: '#eab308', hover: '#ca8a04', text: '#a3a3a3', muted: '#525252', cell: '#000000', cellBorder: '#1a1a1a' },
    cyber: { bg: '#050505', card: '#09090b', border: '#171717', accent: '#84cc16', hover: '#65a30d', text: '#d4d4d8', muted: '#737373', cell: '#050505', cellBorder: '#171717' },
    autumn: { bg: '#2b1b17', card: '#3d2620', border: '#5c3a31', accent: '#f97316', hover: '#ea580c', text: '#ffedd5', muted: '#fdba74', cell: '#2b1b17', cellBorder: '#5c3a31' },
    slate: { bg: '#0f172a', card: '#1e293b', border: '#334155', accent: '#94a3b8', hover: '#cbd5e1', text: '#f8fafc', muted: '#64748b', cell: '#0f172a', cellBorder: '#334155' },
    mint: { bg: '#111827', card: '#1f2937', border: '#374151', accent: '#6ee7b7', hover: '#34d399', text: '#f3f4f6', muted: '#9ca3af', cell: '#111827', cellBorder: '#374151' }
};

function applyTheme(themeName) {
    if(!themes[themeName]) themeName = 'dark';
    const t = themes[themeName];
    const root = document.querySelector(':root');
    if(root) {
        root.style.setProperty('--bg-color', t.bg);
        root.style.setProperty('--card-bg', t.card);
        root.style.setProperty('--border-color', t.border);
        root.style.setProperty('--accent-green', t.accent);
        root.style.setProperty('--accent-hover', t.hover);
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
}

let savedTheme = localStorage.getItem('golf_theme') || 'dark';
applyTheme(savedTheme);

async function initializeApp() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) { 
        currentUser = session.user; 
        localStorage.removeItem('golf_guest_mode'); 
        document.getElementById('auth-overlay').style.display = 'none'; 
        loadLocalState(); 
        buildGrid(); 
        processOfflineQueue(); 
    } 
    else if (localStorage.getItem('golf_guest_mode') === 'true') { 
        document.getElementById('auth-overlay').style.display = 'none'; 
        loadLocalState(); 
        buildGrid(); 
    } 
    else { document.getElementById('auth-overlay').style.display = 'flex'; }

    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
            document.getElementById('auth-overlay').style.display = 'none';
            openSettings();
            document.getElementById('settings-msg').innerText = "Security token verified. Please enter your new password below.";
        }
        else if (event === 'SIGNED_IN' && session) { 
            currentUser = session.user; 
            localStorage.removeItem('golf_guest_mode'); 
            document.getElementById('auth-overlay').style.display = 'none'; 
            loadLocalState(); 
            buildGrid(); 
            processOfflineQueue(); 
        } 
        else if (event === 'SIGNED_OUT') { 
            currentUser = null; 
            if (localStorage.getItem('golf_guest_mode') !== 'true') { 
                document.getElementById('auth-overlay').style.display = 'flex'; 
            } 
        }
    });

    let htmlList = "";
    for(let i=1; i<=18; i++) {
        htmlList += `<label class="checkbox-container"><input type="checkbox" class="hole-cb" value="${i}" autocomplete="off" onchange="checkGroupToggles('.hole-cb', 'cb-all-holes', 'hole-btn-text', 'Hole')"> Hole ${i}</label>`;
    }
    const hBox = document.getElementById('hole-checkbox-list');
    if(hBox) hBox.innerHTML += htmlList;

    let monthHtml = "";
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for(let i=1; i<=12; i++) {
        monthHtml += `<label class="checkbox-container"><input type="checkbox" class="month-cb" value="${i}" autocomplete="off" onchange="checkGroupToggles('.month-cb', 'cb-all-months', 'month-btn-text', 'Month')"> ${months[i-1]}</label>`;
    }
    const mBox = document.getElementById('month-checkbox-list');
    if(mBox) mBox.innerHTML += monthHtml;
}

async function handleAuth(type) {
    const cleanInput = document.getElementById('auth-nickname').value.trim().replace(/\s+/g, ''); 
    const email = cleanInput.includes('@') ? cleanInput : cleanInput.toLowerCase() + "@golf.local"; 
    
    const btnId = type === 'signup' ? 'signup-btn' : 'login-btn';
    const btn = document.getElementById(btnId);
    const originalText = btn.innerText;
    btn.innerText = "⏳..."; btn.disabled = true;
    
    try { 
        let res = type === 'signup' 
            ? await supabaseClient.auth.signUp({ email, password: document.getElementById('auth-password').value }) 
            : await supabaseClient.auth.signInWithPassword({ email, password: document.getElementById('auth-password').value }); 
        if(res.error) throw res.error; 
    } catch (e) { 
        document.getElementById('auth-error').style.color = "#ef4444";
        document.getElementById('auth-error').innerText = e.message; 
    } finally {
        btn.innerText = originalText; btn.disabled = false;
    }
}

async function handleForgotPassword() {
    const cleanInput = document.getElementById('auth-nickname').value.trim().replace(/\s+/g, ''); 
    const email = cleanInput.includes('@') ? cleanInput : cleanInput.toLowerCase() + "@golf.local";
    if (!email) return alert("Please enter your email or nickname first.");
    if (!email.includes('@') || email.includes('@golf.local')) return alert("Password recovery is only available if you signed up with a real email address.");
    
    try {
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + window.location.pathname,
        });
        if (error) throw error;
        document.getElementById('auth-error').style.color = "var(--accent-green)";
        document.getElementById('auth-error').innerText = "Recovery email sent! Check your inbox.";
    } catch (e) {
        document.getElementById('auth-error').style.color = "#ef4444";
        document.getElementById('auth-error').innerText = e.message;
    }
}

async function changePassword() { 
    const { error } = await supabaseClient.auth.updateUser({ password: document.getElementById('new-password').value }); 
    document.getElementById('settings-msg').innerText = error ? "❌ " + error.message : "✅ Updated."; 
}

async function logOut() { 
    localStorage.removeItem('golf_guest_mode'); 
    localStorage.removeItem('golf_round_state'); 
    await supabaseClient.auth.signOut(); 
    location.reload(); 
}

window.openSettings = function() {
    if (!currentUser) {
        document.getElementById('password-change-section').style.display = 'none';
    } else {
        document.getElementById('password-change-section').style.display = 'block';
    }
    document.getElementById('settings-overlay').style.display = 'flex';
}

async function checkHarvesterStatus() {
    try {
        const { data, error } = await supabaseClient.from('course_tees').select('course_name');
        if(error) throw error;
        
        let grouped = {};
        data.forEach(t => { let c = t.course_name.trim().toUpperCase(); grouped[c] = (grouped[c] || 0) + 1; });
        
        let html = `<b>Total Tee Boxes Indexed:</b> ${data.length}<br><b>Unique Courses Indexed:</b> ${Object.keys(grouped).length}<br><br>`;
        html += `<div style="height:200px; overflow-y:auto; background:var(--cell-bg); padding:10px; border-radius:8px; border:1px solid var(--border-color); font-size:12px;">`;
        let sorted = Object.keys(grouped).sort((a,b) => grouped[b] - grouped[a]);
        sorted.forEach(c => { 
            let pct = Math.min(100, (grouped[c] / 6) * 100);
            html += `<div style="margin-bottom:8px;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>${c}</span><span>${grouped[c]} Tees</span></div>
                        <div style="width:100%; height:6px; background:var(--card-bg); border-radius:3px; overflow:hidden;"><div style="width:${pct}%; height:100%; background:var(--accent-green);"></div></div>
                     </div>`; 
        });
        html += `</div>`;
        
        document.getElementById('insight-detail-title').innerText = "HARVESTER COVERAGE";
        document.getElementById('insight-detail-content').innerHTML = html;
        document.getElementById('settings-overlay').style.display = 'none';
        document.getElementById('insight-modal').style.display = 'flex';
    } catch(e) {
        alert("Error fetching database status.");
    }
}

function continueAsGuest() { 
    currentUser = null; 
    localStorage.setItem('golf_guest_mode', 'true'); 
    document.getElementById('auth-overlay').style.display = 'none'; 
    loadLocalState(); 
    buildGrid(); 
}

function switchView(viewId, btn) { 
    document.querySelectorAll('.view-container').forEach(el => el.classList.remove('active')); 
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active')); 
    document.getElementById(viewId).classList.add('active'); 
    btn.classList.add('active'); 
    if(viewId==='view-history') fetchHistory(); 
    if(viewId==='view-analytics') loadAnalyticsData(); 
}

function switchAnalyticsTab(tab, btn) { 
    document.querySelectorAll('#view-analytics > .card > div[id^="analytics-tab-"]').forEach(el => el.style.display = 'none'); 
    document.querySelectorAll('.analytics-tabs button').forEach(el => el.classList.remove('active')); 
    document.getElementById('analytics-tab-' + tab).style.display = 'block'; 
    btn.classList.add('active'); 
}

function fetchWeatherForCourse(courseName) {
    const display = document.getElementById('weather-display');
    display.innerText = "🌤️ Locating course for weather...";
    
    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(courseName + ' Golf')}&format=json&limit=1`, {
        headers: { 'User-Agent': 'GolfScorecardApp/1.0' }
    })
    .then(res => res.json())
    .then(data => {
        if (data && data.length > 0) fetchWeatherByCoords(data[0].lat, data[0].lon, display, courseName);
        else {
            fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(courseName)}&format=json&limit=1`, {
                headers: { 'User-Agent': 'GolfScorecardApp/1.0' }
            })
            .then(res => res.json())
            .then(data2 => {
                if (data2 && data2.length > 0) fetchWeatherByCoords(data2[0].lat, data2[0].lon, display, courseName);
                else fallbackToDeviceGPS(display, courseName);
            }).catch(() => fallbackToDeviceGPS(display, courseName));
        }
    }).catch(() => fallbackToDeviceGPS(display, courseName));
}

function fallbackToDeviceGPS(display, courseName) {
    display.innerText = "⚠️ Weather unavailable";
}

async function fetchWeatherByCoords(lat, lon, display, courseName) {
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
            saveLocalState();
        }
    } catch(e) { 
        console.error(e); 
        display.innerText = "⚠️ Weather unavailable"; 
    }
}

async function submitFeedback() {
    const text = document.getElementById('feedback-text').value.trim(); if(!text) return;
    const btn = document.getElementById('feedback-btn'); btn.innerText = "Sending...";
    try { 
        await supabaseClient.from('user_feedback').insert([{ user_id: currentUser ? currentUser.id : null, feedback: text }]); 
        document.getElementById('feedback-text').value = ""; 
        document.getElementById('feedback-msg').innerText = "✅ Sent successfully!"; 
    } catch(e) { 
        document.getElementById('feedback-msg').innerText = "❌ Error sending."; 
    }
    btn.innerText = "Send Feedback";
}

async function handleBulkImport(input) {
    const file = input.files[0]; const reader = new FileReader();
    reader.onload = async function(e) {
        const rows = e.target.result.split('\n'); const headers = rows[0].split(',').map(h => h.trim().replace(/\r/g, '')); const required = ['date_played', 'course_name', 'total_score', 'total_putts', 'tee_name'];
        if (!required.every(r => headers.includes(r))) return alert("❌ Invalid format. Please match template headers: " + required.join(', '));
        const payload = [];
        for (let i = 1; i < rows.length; i++) {
            if(!rows[i].trim()) continue; const cols = rows[i].split(',').map(c => c.trim().replace(/\r/g, ''));
            payload.push({ user_id: currentUser.id, date_played: cols[headers.indexOf('date_played')], course_name: cols[headers.indexOf('course_name')].trim(), total_score: parseInt(cols[headers.indexOf('total_score')]), total_putts: parseInt(cols[headers.indexOf('total_putts')]) || 0, tee_name: cols[headers.indexOf('tee_name')].trim() || 'Default' });
        }
        try { 
            const { error } = await supabaseClient.from('logged_rounds').insert(payload); 
            if (error) throw error; 
            alert("✅ Bulk Import Processed."); 
            fetchHistory(); 
            loadAnalyticsData(); 
        } catch(err) { 
            alert("❌ Error saving import: " + err.message); 
        }
    }; 
    reader.readAsText(file);
}

function saveLocalState() { 
    const el = document.getElementById('current-course-display'); if (!el) return; 
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
}

function loadLocalState() { 
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
            
            roundData = s.roundData || Array.from({length: 18}, () => ({ score: "", putts: "", fir: "", firAdv: [], gir: "", girAdv: [], drive: "", driveException: "", drops: 0, dropsAdv: [], sandSave: "", puttDist: "", driveClub: "", appClub: "", appDist: "" })); 
            
            roundWeather = s.weather || roundWeather; 
            dismissedWarnings = s.dismissedWarnings || [];
            if(roundWeather.temp) document.getElementById('weather-display').innerText = `⛅ ${roundWeather.temp} | 💨 ${roundWeather.wind}`; 
            
            document.getElementById('btn-18-holes').classList.toggle('active', currentHoleCount === 18); 
            document.getElementById('btn-9-holes').classList.toggle('active', currentHoleCount === 9); 
            
            let toggleBox = document.getElementById('front-back-toggle');
            if (currentHoleCount === 9) {
                toggleBox.style.display = 'inline-flex';
                document.getElementById('btn-front-9').classList.toggle('active', currentHoleOffset === 0);
                document.getElementById('btn-back-9').classList.toggle('active', currentHoleOffset === 9);
            } else {
                toggleBox.style.display = 'none';
            }
            
            currentPlayHole = currentHoleOffset;

        } catch(e) {} 
    } 
}

async function processOfflineQueue() {
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
            fetchHistory(); 
            loadAnalyticsData(); 
            console.log("Offline queue synced successfully.");
        } catch (e) { 
            console.error("Failed to sync offline queue", e); 
        }
    }
}

let searchTimeout = null;
document.getElementById('course-search-input').addEventListener('input', e => {
    const query = e.target.value.trim().toLowerCase(); const dropdown = document.getElementById('search-dropdown'); clearTimeout(searchTimeout);
    if (query.length < 2) { dropdown.classList.remove('active'); return; }
    
    searchTimeout = setTimeout(async () => { 
        try { 
            const { data, error } = await supabaseClient.from('course_tees').select('course_name').ilike('course_name', `%${query}%`).limit(100); 
            if(error) throw error;
            const uniqueCourses = [...new Set(data.map(item => item.course_name.trim()))].slice(0, 10);
            if (uniqueCourses.length > 0) { 
                dropdown.innerHTML = uniqueCourses.map(c => `<li onclick="selectCourseFromDropdown('${c.replace(/'/g, "\\'")}')">${c.toUpperCase()}</li>`).join(''); 
                dropdown.classList.add('active'); 
            } else { 
                dropdown.classList.remove('active'); 
            }
        } catch(err) { console.error(err); } 
    }, 250); 
});

document.getElementById('course-search-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('search-dropdown').classList.remove('active');
        fetchCourseDetails();
    }
});

document.addEventListener('input', e => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'number' && e.target.id.startsWith('grid-')) {
        let val = e.target.value, idParts = e.target.id.split('-'), type = idParts[1], idx = parseInt(idParts[2]);
        if (type === 'score' && (val.length === 2 || (val.length === 1 && parseInt(val) >= 2))) { let next = document.getElementById(`grid-putts-${idx}`); if (next) setTimeout(() => next.focus(), 150); } 
        else if (type === 'putts' && val.length === 1) { let next = (currentCoursePars[idx] === 3) ? document.getElementById(`grid-score-${idx + 1}`) : document.getElementById(`grid-drive-${idx}`); if (next) setTimeout(() => next.focus(), 150); }
        else if (type === 'drive' && val.length === 3) { let next = document.getElementById(`grid-score-${idx + 1}`); if (next) setTimeout(() => next.focus(), 150); }
    }
});

document.getElementById('play-score').addEventListener('input', e => { if (e.target.value.length === 2 || (e.target.value.length === 1 && parseInt(e.target.value) >= 2)) setTimeout(() => document.getElementById('play-putts').focus(), 150); });
document.getElementById('play-putts').addEventListener('input', e => { if (e.target.value.length >= 1) setTimeout(() => { document.getElementById('play-putt-dist').focus(); }, 150); });
document.getElementById('play-drive').addEventListener('input', e => { if (e.target.value.length === 3) setTimeout(() => document.getElementById('play-drive-club').focus(), 150); });
document.getElementById('play-approach-dist').addEventListener('input', e => { if (e.target.value.length === 3) setTimeout(() => document.getElementById('play-approach-club').focus(), 150); });

function selectCourseFromDropdown(courseName) { 
    document.getElementById('course-search-input').value = courseName.toUpperCase(); 
    document.getElementById('search-dropdown').classList.remove('active'); 
    fetchCourseDetails(); 
}

async function fetchCourseDetails() {
    const query = document.getElementById('course-search-input').value.trim(); if(!query) return;
    
    const fetchBtn = document.getElementById('fetch-course-btn');
    const originalText = fetchBtn.innerText;
    fetchBtn.innerText = "⏳..."; fetchBtn.disabled = true;
    document.getElementById('api-status').innerText = "Loading...";

    try {
        let { data: teeData, error } = await supabaseClient.from('course_tees').select('*');
        if (teeData) {
            let matchedCourse = teeData.find(t => t.course_name.trim().toUpperCase().includes(query.toUpperCase()) || query.toUpperCase().includes(t.course_name.trim().toUpperCase()));
            if (!matchedCourse && teeData.length > 0) matchedCourse = teeData[0];
            
            if (matchedCourse) {
                const fetchedCourseName = matchedCourse.course_name.trim();
                availableTees = teeData.filter(t => t.course_name.trim() === fetchedCourseName);
                
                fetchWeatherForCourse(fetchedCourseName);
                
                let parsedPars = availableTees[0].pars; if (typeof parsedPars === 'string') { try { parsedPars = JSON.parse(parsedPars.replace(/{/g, '[').replace(/}/g, ']')); } catch(e){} }
                currentCoursePars = Array.isArray(parsedPars) ? [...parsedPars] : Array(18).fill(""); 
                
                let parsedYards = availableTees[0].yardages; if (typeof parsedYards === 'string') { try { parsedYards = JSON.parse(parsedYards.replace(/{/g, '[').replace(/}/g, ']')); } catch(e){} }
                currentYardages = Array.isArray(parsedYards) ? [...parsedYards] : Array(18).fill(""); 
                
                roundData = Array.from({length: 18}, () => ({ score: "", putts: "", fir: "", firAdv: [], gir: "", girAdv: [], drive: "", driveException: "", drops: 0, dropsAdv: [], sandSave: "", puttDist: "", driveClub: "", appClub: "", appDist: "" }));
                dismissedWarnings = [];
                
                document.getElementById('current-course-display').innerText = fetchedCourseName.toUpperCase(); 
                document.getElementById('current-course-display').style.color = 'var(--accent-green)';
                
                populateTeeDropdown(); 
                document.getElementById('api-status').innerText = ""; 
                buildGrid(); 
                updatePlayModeUI(); 
                saveLocalState(); 
                fetchBtn.innerText = originalText; fetchBtn.disabled = false;
                return;
            }
        }
    } catch(e) { console.error(e); }
    
    document.getElementById('current-course-display').innerText = query.toUpperCase(); 
    document.getElementById('current-course-display').style.color = 'var(--accent-green)'; 
    document.getElementById('api-status').innerText = "ℹ️ Course not found in database. Please enter manually.";
    
    currentCoursePars = Array(18).fill(""); 
    currentYardages = Array(18).fill(""); 
    availableTees = []; 
    populateTeeDropdown(); 
    buildGrid(); 
    updatePlayModeUI(); 
    saveLocalState();
    
    fetchBtn.innerText = originalText; fetchBtn.disabled = false;
}

function populateTeeDropdown() {
    const select = document.getElementById('tee-select'); document.getElementById('course-setup-container').style.display = 'block';
    
    const colorOrder = { 'Black': 1, 'Blue': 2, 'White': 3, 'Silver': 4, 'Red': 5 };
    availableTees.sort((a, b) => {
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

        let ca = colorOrder[a.tee_name.trim()] || 99;
        let cb = colorOrder[b.tee_name.trim()] || 99;
        return ca - cb;
    });

    select.innerHTML = '<option value="">-- Select a Tee --</option>' + availableTees.map(t => `<option value="${t.id}">${t.tee_name.trim()}</option>`).join('') + '<option value="new">+ Add New Tee Manually</option>';
    document.getElementById('setup-tee').value = ""; handleTeeChange();
}

function handleTeeChange() {
    const val = document.getElementById('tee-select').value; const manualRow = document.getElementById('manual-tee-row');
    if (val === 'new') { manualRow.style.display = 'flex'; selectedTee = null; currentYardages = Array(18).fill(""); } 
    else if (val === "") { manualRow.style.display = 'none'; selectedTee = null; currentYardages = Array(18).fill(""); } 
    else { 
        manualRow.style.display = 'none'; 
        selectedTee = availableTees.find(t => t.id == val); 
        if (selectedTee) { 
            let p = selectedTee.pars; if(typeof p === 'string') try{p=JSON.parse(p.replace(/{/g,'[').replace(/}/g,']'))}catch(e){}
            let y = selectedTee.yardages; if(typeof y === 'string') try{y=JSON.parse(y.replace(/{/g,'[').replace(/}/g,']'))}catch(e){}
            currentCoursePars = Array.isArray(p) && p.length > 0 ? [...p] : currentCoursePars; 
            currentYardages = Array.isArray(y) && y.length > 0 ? [...y] : Array(18).fill(""); 
        } 
    }
    buildGrid(); updatePlayModeUI(); saveLocalState();
}

function setHoleCount(count) { 
    currentHoleCount = count; 
    document.getElementById('btn-18-holes').classList.toggle('active', count === 18); 
    document.getElementById('btn-9-holes').classList.toggle('active', count === 9); 
    
    let toggleBox = document.getElementById('front-back-toggle');
    if (count === 9) {
        toggleBox.style.display = 'inline-flex';
        currentHoleOffset = 0;
        document.getElementById('btn-front-9').classList.add('active');
        document.getElementById('btn-back-9').classList.remove('active');
    } else {
        toggleBox.style.display = 'none';
        currentHoleOffset = 0;
    }
    
    currentPlayHole = currentHoleOffset; 
    buildGrid(); updatePlayModeUI(); saveLocalState(); 
}

function setNineSide(side) {
    if (side === 'front') {
        currentHoleOffset = 0;
        document.getElementById('btn-front-9').classList.add('active');
        document.getElementById('btn-back-9').classList.remove('active');
    } else {
        currentHoleOffset = 9;
        document.getElementById('btn-front-9').classList.remove('active');
        document.getElementById('btn-back-9').classList.add('active');
    }
    currentPlayHole = currentHoleOffset;
    buildGrid(); updatePlayModeUI(); saveLocalState(); 
}

window.jumpToPlayMode = function(index) { 
    currentPlayHole = index; 
    togglePlayMode(true); 
};

function buildGrid() {
    const grid = document.getElementById('scorecard-grid'); grid.innerHTML = ''; grid.style.gridTemplateColumns = `80px repeat(${currentHoleCount}, minmax(60px, 1fr))`;
    const rows = [{ label: 'HOLE', type: 'header' }, { label: 'PAR', type: 'par' }, { label: 'YDS', type: 'yardage' }, { label: 'SCORE', type: 'score' }, { label: 'PUTTS', type: 'putts' }, { label: 'FIR', type: 'fir' }, { label: 'GIR', type: 'gir' }, { label: 'DRIVE', type: 'drive' }, { label: 'DROPS', type: 'drops' }, { label: 'SAND', type: 'sandSave' }];
    
    let endIndex = currentHoleOffset + currentHoleCount;
    
    rows.forEach(row => {
        const labelCell = document.createElement('div'); labelCell.className = 'row-label'; labelCell.innerText = row.label; grid.appendChild(labelCell);
        for (let i = currentHoleOffset; i < endIndex; i++) {
            const cell = document.createElement('div');
            if (row.type === 'header') { cell.className = 'cell hole-header'; cell.innerHTML = `<button type="button" onclick="jumpToPlayMode(${i})" style="width:100%;height:100%;background:transparent;border:none;color:var(--text-muted);font-weight:bold;cursor:pointer;padding:0;">${i + 1}</button>`; } 
            else if (row.type === 'par') { cell.className = 'cell'; cell.innerHTML = `<input type="number" id="par-input-${i}" inputmode="numeric" min="3" max="6" value="${currentCoursePars[i] ?? ''}" onchange="updatePar(${i}, this.value)">`; } 
            else if (row.type === 'yardage') { cell.className = 'cell'; cell.innerHTML = `<input type="number" inputmode="numeric" value="${currentYardages[i] ?? ''}" onchange="currentYardages[${i}] = this.value; updatePlayModeUI(); saveLocalState();">`; }
            else if (row.type === 'score' || row.type === 'putts' || row.type === 'drive') { cell.className = row.type === 'drive' ? 'cell drive-cell' : 'cell'; cell.id = row.type === 'drive' ? `drive-container-${i}` : ''; cell.innerHTML = `<input type="number" id="grid-${row.type}-${i}" inputmode="numeric" value="${roundData[i][row.type]}" onchange="syncGridToState(${i}, '${row.type}', this.value)">`; }
            else if (row.type === 'drops') { cell.className = 'cell'; let cVal = parseInt(roundData[i].drops) || 0; cell.innerHTML = `<button type="button" class="toggle-btn" style="${cVal > 0 ? 'color:#ef4444;' : ''}" id="grid-drops-${i}" onclick="toggleGridDrops(${i})">${cVal === 0 ? '-' : cVal}</button>`; }
            else { cell.className = 'cell'; let cVal = roundData[i][row.type]; let btnText = row.type === 'sandSave' ? (cVal === 'yes' ? 'SAVE' : (cVal === 'no' ? 'MISS' : '-')) : (cVal === 'hit' ? 'HIT' : (cVal === 'miss' ? 'MISS' : '-')); cell.innerHTML = `<button type="button" class="toggle-btn ${cVal === 'hit' || cVal === 'yes' ? 'hit' : ''}" id="grid-${row.type}-${i}" onclick="toggleGridHit(${i}, '${row.type}')">${btnText}</button>`; }
            grid.appendChild(cell);
        }
    });
    updateDriveDistances();
}

function syncGridToState(index, field, val) { roundData[index][field] = val; if(currentPlayHole === index) updatePlayModeUI(); saveLocalState(); }
function syncPlayToState(field, val) { roundData[currentPlayHole][field] = val; const gridInput = document.getElementById(`grid-${field}-${currentPlayHole}`); if(gridInput) gridInput.value = val; saveLocalState(); updatePlayModeUI(); }

function toggleGridDrops(index) { 
    let cVal = parseInt(roundData[index].drops) || 0; 
    let newVal = cVal >= 10 ? 0 : cVal + 1; 
    roundData[index].drops = newVal; 
    if (newVal === 0) roundData[index].dropsAdv = [];
    const btn = document.getElementById(`grid-drops-${index}`); 
    if(btn) { btn.innerText = newVal === 0 ? "-" : newVal; btn.style.color = newVal > 0 ? "#ef4444" : "var(--text-muted)"; } 
    if(currentPlayHole === index) updatePlayModeUI(); 
    saveLocalState(); 
}

window.cycleSand = function() {
    let s = roundData[currentPlayHole].sandSave;
    if(s === "") s = "yes"; 
    else if(s === "yes") s = "no"; 
    else s = ""; 
    roundData[currentPlayHole].sandSave = s;
    
    let gridBtn = document.getElementById(`grid-sandSave-${currentPlayHole}`);
    if(gridBtn) {
        gridBtn.innerText = s === "" ? "-" : (s === "yes" ? "SAVE" : "MISS");
        if(s === "yes") gridBtn.classList.add('hit'); else gridBtn.classList.remove('hit');
    }
    
    updatePlayModeUI();
    saveLocalState();
};

function toggleGridHit(index, type) { 
    const btn = document.getElementById(`grid-${type}-${index}`); 
    let ns = type === 'sandSave' ? (btn.innerText === "MISS" ? "" : (btn.innerText === "SAVE" ? "no" : "yes")) : (btn.innerText === "MISS" ? "hit" : "miss"); 
    
    if (type === 'sandSave') {
        btn.innerText = ns === "" ? "-" : (ns === 'yes' ? 'SAVE' : 'MISS');
    } else {
        btn.innerText = ns === "" ? "-" : ns.toUpperCase(); 
    }

    if(ns === 'hit' || ns === 'yes') btn.classList.add('hit'); else btn.classList.remove('hit'); 
    roundData[index][type] = ns === "-" ? "" : ns; 
    if(currentPlayHole === index) updatePlayModeUI(); 
    saveLocalState(); 
}

function togglePlayMode(isPlayMode) { 
    document.getElementById('btn-play-mode').className = isPlayMode ? 'view-toggle-btn primary' : 'view-toggle-btn'; 
    document.getElementById('btn-grid-mode').className = !isPlayMode ? 'view-toggle-btn primary' : 'view-toggle-btn'; 
    document.getElementById('grid-mode-container').style.display = isPlayMode ? 'none' : 'block'; 
    document.getElementById('play-mode-container').style.display = isPlayMode ? 'flex' : 'none'; 
    if(isPlayMode) updatePlayModeUI(); 
}

window.dismissMissingWarning = function(key) {
    if(!dismissedWarnings.includes(key)) dismissedWarnings.push(key);
    saveLocalState();
    updatePlayModeUI();
};

window.goToHoleAndDismiss = function(holeIndex, key) {
    dismissMissingWarning(key);
    currentPlayHole = holeIndex;
    updatePlayModeUI();
};

function updatePlayModeUI() {
    const par = currentCoursePars[currentPlayHole]; 
    const state = roundData[currentPlayHole]; 
    const yds = currentYardages[currentPlayHole] || '-';
    
    // SMART CADDIE AUTO-DEFAULTS
    if (state.score === "") {
        if ((par == 4 || par == 5)) {
            if (state.driveClub === "") state.driveClub = "Driver";
        }
        if (par == 3) {
            if (state.appClub === "") state.appClub = "Iron";
            state.fir = "hit"; // Bypasses FIR breakdown silently for Par 3s
        }
    }

    document.getElementById('play-hole-title').innerText = `HOLE ${currentPlayHole + 1}`; 
    document.getElementById('play-par-title').innerText = `PAR ${par || '-'} • ${yds} YDS`;
    
    document.getElementById('play-score').value = state.score; 
    document.getElementById('play-putts').value = state.putts; 
    document.getElementById('play-putt-dist').value = state.puttDist || ""; 
    document.getElementById('play-drive').value = state.drive;
    document.getElementById('play-drive-club').value = state.driveClub || "";
    document.getElementById('play-approach-club').value = state.appClub || "";
    document.getElementById('play-approach-dist').value = state.appDist || "";
    
    let sBtn = document.getElementById('sand-cycle-btn');
    if (state.sandSave === "yes") { sBtn.innerText = "SAND: SAVED 🟢"; sBtn.className = "adv-btn active"; sBtn.style.background = "var(--accent-green)"; sBtn.style.borderColor = "var(--accent-green)"; sBtn.style.color = "#000"; }
    else if (state.sandSave === "no") { sBtn.innerText = "SAND: MISSED 🔴"; sBtn.className = "adv-btn active"; sBtn.style.background = "#ef4444"; sBtn.style.borderColor = "#ef4444"; sBtn.style.color = "#fff"; }
    else { sBtn.innerText = "SAND: NONE"; sBtn.className = "adv-btn"; sBtn.style.background = "rgba(0,0,0,0.4)"; sBtn.style.color = "var(--text-muted)"; sBtn.style.borderColor = "var(--border-color)";}

    let dropsVal = parseInt(state.drops) || 0; 
    let dBtn = document.getElementById('play-drops-btn'); 
    dBtn.innerText = dropsVal === 0 ? "-" : dropsVal; 
    dBtn.style.color = dropsVal > 0 ? "#ef4444" : "var(--text-main)";

    let strokes = 0; let parSum = 0; let holesPlayed = 0;
    let totalCoursePar = 0;
    let endIndex = currentHoleOffset + currentHoleCount;

    for(let i=currentHoleOffset; i<endIndex; i++) {
        let s = parseInt(roundData[i].score);
        let p = parseInt(currentCoursePars[i]) || 4;
        totalCoursePar += p;
        if(s > 0) { strokes += s; parSum += p; holesPlayed++; }
    }
    
    let relToPar = strokes - parSum;
    let relStr = relToPar > 0 ? `+${relToPar}` : (relToPar === 0 ? 'E' : relToPar);
    document.getElementById('pace-score-display').innerText = `Strokes: ${strokes} (${relStr})`;
    
    if (holesPlayed > 0) {
        let paceRel = Math.round((relToPar / holesPlayed) * currentHoleCount);
        let paceTotal = totalCoursePar + paceRel;
        let paceRelStr = paceRel > 0 ? `+${paceRel}` : (paceRel === 0 ? 'E' : paceRel);
        document.getElementById('pace-projected-display').innerText = `Pace: ${paceTotal} (${paceRelStr})`;
    } else {
        document.getElementById('pace-projected-display').innerText = `Pace: --`;
    }

    let missingBanner = document.getElementById('play-warning-banner');
    let missingHtml = "";
    
    for(let i=currentHoleOffset; i<endIndex; i++) {
        let s = parseInt(roundData[i].score);
        let p = parseInt(currentCoursePars[i]) || 4;
        if (s > 0 && i !== currentPlayHole) {
            if (roundData[i].putts === "" && !dismissedWarnings.includes(`${i}-putts`)) missingHtml += `<div style="display:flex; align-items:center; background:#b45309; border-radius:4px; overflow:hidden;"><span style="padding: 4px 8px; color:#fff; cursor:pointer; font-size:11px;" onclick="goToHoleAndDismiss(${i}, '${i}-putts')">Hole ${i+1} Putts</span><span style="padding: 4px 8px; background:rgba(0,0,0,0.2); color:#fff; cursor:pointer; font-size:11px;" onclick="dismissMissingWarning('${i}-putts')">✕</span></div>`;
            if (roundData[i].gir === "" && !dismissedWarnings.includes(`${i}-gir`)) missingHtml += `<div style="display:flex; align-items:center; background:#b45309; border-radius:4px; overflow:hidden;"><span style="padding: 4px 8px; color:#fff; cursor:pointer; font-size:11px;" onclick="goToHoleAndDismiss(${i}, '${i}-gir')">Hole ${i+1} GIR</span><span style="padding: 4px 8px; background:rgba(0,0,0,0.2); color:#fff; cursor:pointer; font-size:11px;" onclick="dismissMissingWarning('${i}-gir')">✕</span></div>`;
            if (p > 3 && roundData[i].fir === "" && !dismissedWarnings.includes(`${i}-fir`)) missingHtml += `<div style="display:flex; align-items:center; background:#b45309; border-radius:4px; overflow:hidden;"><span style="padding: 4px 8px; color:#fff; cursor:pointer; font-size:11px;" onclick="goToHoleAndDismiss(${i}, '${i}-fir')">Hole ${i+1} FIR</span><span style="padding: 4px 8px; background:rgba(0,0,0,0.2); color:#fff; cursor:pointer; font-size:11px;" onclick="dismissMissingWarning('${i}-fir')">✕</span></div>`;
        }
    }
    
    if (missingHtml !== "") {
        document.getElementById('play-warning-text').innerHTML = `<div style="display:flex; flex-wrap:wrap; gap:5px; align-items:center;"><b style="width:100%; font-size:11px; margin-bottom:4px;">⚠️ MISSING STATS:</b>${missingHtml}</div>`;
        missingBanner.style.display = 'block';
    } else {
        missingBanner.style.display = 'none';
    }

    ['fir', 'gir'].forEach(type => {
        let hb = document.getElementById(`${type}-hit-btn`); if(hb) hb.classList.remove('active'); 
        let mb = document.getElementById(`${type}-miss-btn`); if(mb) mb.classList.remove('active');
        if(state[type] === 'hit') { if(hb) hb.classList.add('active'); } 
        else if(state[type] === 'miss' && !(type === 'fir' && par === 3)) { if(mb) mb.classList.add('active'); }
    });
    
    let dBlock = document.getElementById('play-fir-block'); 
    if(dBlock) {
        if(par == 3) {
            dBlock.style.opacity = '0.3';
            document.getElementById('fir-hit-btn').disabled = true;
            document.getElementById('fir-miss-btn').disabled = true;
        } else {
            dBlock.style.opacity = '1';
            document.getElementById('fir-hit-btn').disabled = false;
            document.getElementById('fir-miss-btn').disabled = false;
        }
    }
    
    document.getElementById('play-prev-btn').style.visibility = currentPlayHole === currentHoleOffset ? 'hidden' : 'visible'; 
    document.getElementById('play-next-btn').innerText = currentPlayHole === (endIndex - 1) ? 'FINISH' : 'NEXT HOLE →';
}

function changePlayHole(dir) { 
    let endIndex = currentHoleOffset + currentHoleCount;
    currentPlayHole = Math.max(currentHoleOffset, Math.min((endIndex - 1), currentPlayHole + dir)); 
    updatePlayModeUI(); 
}

function updatePar(index, val) { let p = parseInt(val); currentCoursePars[index] = isNaN(p) ? "" : Math.max(3, Math.min(6, p)); document.getElementById(`par-input-${index}`).value = currentCoursePars[index]; updateDriveDistances(); if(currentPlayHole === index) updatePlayModeUI(); saveLocalState(); }
function updateDriveDistances() { for (let i = 0; i < 18; i++) { const input = document.getElementById(`grid-drive-${i}`); const container = document.getElementById(`drive-container-${i}`); if(input && container) { if (currentCoursePars[i] === 3) { input.value = ""; input.disabled = true; input.placeholder = "N/A"; container.classList.add("disabled"); } else { input.disabled = false; input.placeholder = "yds"; container.classList.remove("disabled"); } } } }

function attemptSubmitRound() {
    let endIndex = currentHoleOffset + currentHoleCount;
    let missingHoles = [];
    
    for (let i = currentHoleOffset; i < endIndex; i++) {
        if (roundData[i].score === "") {
            missingHoles.push(i + 1);
        }
    }

    if (missingHoles.length > 0 && missingHoles.length < currentHoleCount) {
        let mBox = document.getElementById('incomplete-holes-list');
        mBox.innerHTML = missingHoles.map(h => `<button type="button" class="adv-btn" style="background:#b45309; color:#fff; border-color:#b45309; padding: 10px; font-size: 14px; min-width: 80px;" onclick="document.getElementById('incomplete-modal').style.display='none'; jumpToPlayMode(${h-1});">Hole ${h}</button>`).join('');
        document.getElementById('incomplete-modal').style.display = 'flex';
    } else {
        forceSubmitRound();
    }
}

async function forceSubmitRound() {
    document.getElementById('incomplete-modal').style.display='none';

    if (!currentUser) { if (confirm("Guest Round Complete!\n\nSince you are not logged in, this scorecard cannot be saved to the permanent History dashboard.\n\nClear your local scorecard to start a new round?")) { localStorage.removeItem('golf_round_state'); location.reload(); } return; }
    const courseName = document.getElementById('current-course-display').innerText.trim();
    if (!courseName || courseName === 'NO COURSE SELECTED' || courseName === '') return alert("⚠️ Please fetch a valid course.");
    
    const teeVal = document.getElementById('tee-select').value; 
    let teeName = null;
    let rType = document.getElementById('round-type-select').value;

    if (teeVal === 'new') { 
        teeName = document.getElementById('setup-tee').value.trim(); 
        if (teeName) { 
            try { await supabaseClient.from('course_tees').insert([{ course_name: courseName, tee_name: teeName, pars: currentCoursePars, yardages: currentYardages }]); } catch(e) {} 
        } 
    } else if (selectedTee) { 
        teeName = selectedTee.tee_name.trim(); 
    }

    let finalTeeName = teeName + (rType !== 'Regular' ? ' [' + rType + ']' : '');

    let totalScore = 0; let totalPutts = 0; const holesPayload = [];
    let missingCheck = [];
    let endIndex = currentHoleOffset + currentHoleCount;

    for (let i = currentHoleOffset; i < endIndex; i++) {
        const s = parseInt(roundData[i].score);
        let p = parseInt(currentCoursePars[i]) || 4;
        
        if (!isNaN(s)) {
            totalScore += s; totalPutts += parseInt(roundData[i].putts) || 0;
            
            if (roundData[i].putts === "" || roundData[i].gir === "" || (p > 3 && roundData[i].fir === "") || (p > 3 && roundData[i].drive === "" && (!roundData[i].driveException || roundData[i].driveException === ""))) {
                missingCheck.push(i+1);
            }

            holesPayload.push({ 
                user_id: currentUser.id, 
                hole_number: i + 1, 
                par: parseInt(currentCoursePars[i]) || null, 
                score: s, 
                putts: parseInt(roundData[i].putts) || 0, 
                fir: roundData[i].fir || null, 
                fir_adv: (roundData[i].firAdv || []).join(','),
                gir: roundData[i].gir || null, 
                gir_adv: (roundData[i].girAdv || []).join(','),
                drive_distance: parseInt(roundData[i].drive) || null, 
                drive_exception: roundData[i].driveException || null,
                drops: parseInt(roundData[i].drops) || 0, 
                drops_adv: (roundData[i].dropsAdv || []).join(','),
                sand_save: roundData[i].sandSave || null,
                drive_club: roundData[i].driveClub || null,
                approach_club: roundData[i].appClub || null,
                approach_yd: parseInt(roundData[i].appDist) || null,
                putt_1_ft: parseInt(roundData[i].puttDist) || null
            });
        }
    }
    
    if(holesPayload.length === 0) return alert("⚠️ No scores entered.");
    
    if (missingCheck.length > 0) {
        if(!confirm(`⚠️ You are missing some stats (Putts/FIR/GIR/Drive) on the following holes:\n\nHole(s): ${missingCheck.join(', ')}\n\nSubmit scorecard anyway?`)) return;
    }

    const submitBtn = document.getElementById('submit-round-btn'); 
    const originalBtnText = submitBtn.innerText;
    if(submitBtn) { submitBtn.innerText = "⏳ SAVING..."; submitBtn.disabled = true; }

    try {
        const { data: roundHeader, error: headerError } = await supabaseClient.from('logged_rounds').insert([{ user_id: currentUser.id, course_name: courseName, total_score: totalScore, total_putts: totalPutts, tee_name: finalTeeName, weather_temp: roundWeather.temp, weather_wind: roundWeather.wind }]).select('id').single();
        if (headerError) throw headerError;
        await supabaseClient.from('hole_scores').insert(holesPayload.map(h => ({ ...h, round_id: roundHeader.id })));
        alert("✅ Round logged!"); localStorage.removeItem('golf_round_state'); fetchCourseDetails(); 
    } catch(e) { 
        console.error(e); 
        const queueStr = localStorage.getItem('golf_offline_queue'); let queue = queueStr ? JSON.parse(queueStr) : [];
        queue.push({ header: { user_id: currentUser.id, course_name: courseName, total_score: totalScore, total_putts: totalPutts, tee_name: finalTeeName, weather_temp: roundWeather.temp, weather_wind: roundWeather.wind }, holes: holesPayload });
        localStorage.setItem('golf_offline_queue', JSON.stringify(queue));
        alert("📶 Network Offline.\n\nRound saved to your local device. It will automatically upload to the cloud the next time you open the app online.");
        localStorage.removeItem('golf_round_state'); location.reload();
    } finally { 
        if(submitBtn){ submitBtn.innerText = originalBtnText; submitBtn.disabled = false; } 
    }
}

async function fetchHistory() {
    if(!currentUser) return;
    const { data } = await supabaseClient.from('logged_rounds').select('*, hole_scores(*)').eq('user_id', currentUser.id).order('date_played', { ascending: false });
    if(!data || data.length === 0) { document.getElementById('history-list').innerHTML = '<div class="empty-state">No rounds found.</div>'; return; }
    const grouped = data.reduce((acc, round) => { const year = new Date(round.date_played).getUTCFullYear(); if(!acc[year]) acc[year] = []; acc[year].push(round); return acc; }, {});
    let html = '';
    
    document.getElementById('history-total-rounds-header').innerHTML = `ROUND HISTORY <span style="font-size:12px; font-weight:normal; color:var(--text-muted);">(${data.length} Total Rounds)</span>`;

    Object.keys(grouped).sort((a,b) => b-a).forEach((year, index) => {
        const rounds = grouped[year];
        html += `<details class="year-folder" ${index === 0 ? 'open' : ''}><summary>${year} Season <span style="font-size:12px; font-weight:normal; color:var(--text-muted);">${rounds.length} Rounds</span></summary><div class="folder-content">`;
        rounds.forEach(r => {
            const holesPlayed = r.hole_scores ? r.hole_scores.filter(h => h.score && h.score > 0).length : 0;
            let w = (r.weather_temp && r.weather_wind) ? `<br><span style="font-size:10px;color:var(--text-muted)">⛅ ${r.weather_temp} | 💨 ${r.weather_wind}</span>` : '';
            html += `<div class="history-item" onclick="openHistoryModal('${r.id}', '${r.course_name.replace(/'/g, "\\'")}', '${r.date_played}', ${r.total_score}, ${holesPlayed}, '${r.weather_temp || ''}', '${r.weather_wind || ''}')"><div><strong>${r.course_name.trim()}</strong><br><span style="font-size:12px;color:var(--text-muted)">${r.date_played} ${r.tee_name ? `• ${r.tee_name.trim()}` : ''}</span>${w}</div><div style="text-align:right;"><strong style="color:var(--accent-green);font-size:18px;">${r.total_score}</strong><br><span style="font-size:12px;color:var(--text-muted)">${holesPlayed === 0 ? 'Bulk Import' : holesPlayed + ' Holes'}</span></div></div>`;
        });
        html += `</div></details>`;
    });
    document.getElementById('history-list').innerHTML = html;
}

async function openHistoryModal(id, name, date, score, holesPlayed, temp, wind) {
    document.getElementById('modal-course-title').innerText = name.trim(); 
    document.getElementById('modal-total-score').innerText = score; 
    
    let wText = temp ? `⛅ ${temp}` : '';
    document.getElementById('modal-weather').innerText = wText;
    document.getElementById('modal-wind-dir').innerText = wind ? `💨 ${wind}` : '';

    activeModalRoundId = id; document.getElementById('history-modal').classList.add('active'); document.getElementById('modal-scorecard-grid').innerHTML = '⏳ Loading...';
    if (holesPlayed === 0) { document.getElementById('modal-scorecard-grid').innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-muted);">Bulk imported rounds do not contain hole-by-hole data.</div>'; return; }
    
    const { data } = await supabaseClient.from('hole_scores').select('*').eq('round_id', id).order('hole_number', { ascending: true });
    
    let startHole = 0, endHole = 18;
    if(data && data.length > 0 && data.length < 18) {
        let firstHole = data[0].hole_number;
        if(firstHole > 9) { startHole = 9; endHole = 18; }
        else { startHole = 0; endHole = 9; }
    }
    let viewHoles = endHole - startHole;
    
    modalCoursePars = Array(viewHoles).fill(""); modalRoundData = Array.from({length: viewHoles}, () => ({ id: null, score: "", putts: "", fir: "", gir: "", drive: "", drops: 0, sandSave: "" }));
    
    if(data) data.forEach(h => { 
        const i = h.hole_number - 1 - startHole; 
        if(i>=0 && i<viewHoles){ 
            modalCoursePars[i]=h.par||""; 
            modalRoundData[i]={id:h.id,score:h.score||"",putts:h.putts!==null?h.putts:"",fir:h.fir||"",firAdv:h.fir_adv?h.fir_adv.split(','):[],gir:h.gir||"",girAdv:h.gir_adv?h.gir_adv.split(','):[],drive:h.drive_distance||"",drops:h.drops||0,dropsAdv:h.drops_adv?h.drops_adv.split(','):[],sandSave:h.sand_save||""}; 
        }
    });
    buildModalGrid(viewHoles, startHole);
}

function buildModalGrid(holesCount, startOffset) {
    const grid = document.getElementById('modal-scorecard-grid'); grid.innerHTML = ''; grid.style.gridTemplateColumns = `80px repeat(${holesCount}, minmax(60px, 1fr))`;
    const rows = [{ label: 'HOLE', type: 'header' }, { label: 'PAR', type: 'par' }, { label: 'SCORE', type: 'score' }, { label: 'PUTTS', type: 'putts' }, { label: 'FIR', type: 'fir' }, { label: 'GIR', type: 'gir' }, { label: 'DRIVE', type: 'drive' }, { label: 'DROPS', type: 'drops' }, { label: 'SAND', type: 'sandSave' }];
    rows.forEach(r => {
        const lc = document.createElement('div'); lc.className = 'row-label'; lc.innerText = r.label; grid.appendChild(lc);
        for(let i=0; i<holesCount; i++) {
            const c = document.createElement('div'); c.className = 'cell';
            if(r.type === 'header') { c.className = 'cell hole-header'; c.innerText = i+1+startOffset; }
            else if(r.type === 'par') c.innerHTML = `<input type="number" value="${modalCoursePars[i]}" onchange="modalCoursePars[${i}] = this.value">`;
            else if(['score','putts','drive'].includes(r.type)) c.innerHTML = `<input type="number" value="${modalRoundData[i][r.type]}" onchange="modalRoundData[${i}]['${r.type}'] = this.value">`;
            else if(r.type === 'drops') { let cVal = parseInt(modalRoundData[i].drops) || 0; c.innerHTML = `<button type="button" class="toggle-btn" style="${cVal > 0 ? 'color:#ef4444;' : ''}" onclick="toggleModalDrops(this, ${i})">${cVal === 0 ? '-' : cVal}</button>`; }
            else { let v = modalRoundData[i][r.type]; let t = r.type==='sandSave'?(v==='yes'?'SAVE':(v==='no'?'MISS':'-')):(v==='hit'?'HIT':(v==='miss'?'MISS':'-')); let hc = (v==='hit'||v==='yes')?'hit':''; c.innerHTML = `<button type="button" class="toggle-btn ${hc}" onclick="toggleModalHit(this, ${i}, '${r.type}')">${t}</button>`; }
            grid.appendChild(c);
        }
    });
    document.getElementById('modal-delete-btn').onclick = () => deleteActiveRound(activeModalRoundId); document.getElementById('modal-save-btn').onclick = () => saveModalChanges(activeModalRoundId, holesCount);
}

function toggleModalDrops(btn, i) { let cVal = parseInt(modalRoundData[i].drops) || 0; let newVal = cVal >= 4 ? 0 : cVal + 1; modalRoundData[i].drops = newVal; btn.innerText = newVal === 0 ? "-" : newVal; btn.style.color = newVal > 0 ? "#ef4444" : "var(--text-muted)"; }
function toggleModalHit(b, i, t) { let ns = t==='sandSave'?(b.innerText==="MISS"?"": (b.innerText==="SAVE"?"no":"yes")):(b.innerText==="MISS"?"hit":"miss"); b.innerText=ns==="-"?"-":(ns==='yes'?'SAVE':(ns==='no'?'MISS':ns.toUpperCase())); if(ns==='hit'||ns==='yes')b.classList.add('hit'); else b.classList.remove('hit'); modalRoundData[i][t] = ns==="-"?"":ns; }
function closeHistoryModal() { document.getElementById('history-modal').classList.remove('active'); activeModalRoundId = null; }

async function saveModalChanges(id, holesCount) {
    if(!id) return; let tScore=0; let tPutts=0; 
    
    const saveBtn = document.getElementById('modal-save-btn');
    const originalText = saveBtn.innerText;
    saveBtn.innerText = "⏳ Saving..."; saveBtn.disabled = true;

    try {
        for(let i=0; i<holesCount; i++) { const hd=modalRoundData[i]; const s=parseInt(hd.score); if(!isNaN(s))tScore+=s; if(!isNaN(parseInt(hd.putts)))tPutts+=parseInt(hd.putts);
            if(hd.id) await supabaseClient.from('hole_scores').update({ par:parseInt(modalCoursePars[i])||null, score:s||null, putts:parseInt(hd.putts)||0, fir:hd.fir||null, gir:hd.gir||null, drive_distance:parseInt(hd.drive)||null, drops:parseInt(hd.drops)||0, sand_save:hd.sandSave||null }).eq('id',hd.id);
        }
        await supabaseClient.from('logged_rounds').update({ total_score: tScore, total_putts: tPutts }).eq('id',id); 
        alert("✅ Updated."); fetchHistory(); closeHistoryModal(); loadAnalyticsData();
    } catch(e) {
        console.error(e); alert("❌ Error saving changes.");
    } finally {
        saveBtn.innerText = originalText; saveBtn.disabled = false;
    }
}

async function deleteActiveRound(id) { if(id && confirm("Delete round?")) { await supabaseClient.from('logged_rounds').delete().eq('id', id); alert("🗑️ Deleted."); fetchHistory(); closeHistoryModal(); loadAnalyticsData(); } }

function forceSyncFilters() {
    document.querySelectorAll('.multi-select-dropdown input[type="checkbox"]').forEach(cb => { cb.checked = true; });
    document.getElementById('month-btn-text').innerText = 'All Months';
    document.getElementById('year-btn-text').innerText = 'All Years';
    document.getElementById('course-btn-text').innerText = 'All Courses';
    document.getElementById('par-btn-text').innerText = 'All Pars';
    document.getElementById('hole-btn-text').innerText = 'All Holes';
}

window.openInsightDetail = function(type) {
    document.getElementById('insight-detail-title').innerText = type.toUpperCase();
    let contentHtml = "";

    if (type === "Scoring Leak" || type === "Scoring Strength") {
        let p3=0, p3c=0, p4=0, p4c=0, p5=0, p5c=0;
        currentFilteredRounds.forEach(r => { r.hole_scores && r.hole_scores.forEach(h => { if(h.score && h.par) { let d=h.score-h.par; if(h.par===3){p3+=d; p3c++;} if(h.par===4){p4+=d; p4c++;} if(h.par===5){p5+=d; p5c++;} } }); });
        contentHtml = `<b>Par 3 Avg:</b> ${p3c>0 ? (p3/p3c>0?'+':'')+(p3/p3c).toFixed(2) : '-'}<br><br><b>Par 4 Avg:</b> ${p4c>0 ? (p4/p4c>0?'+':'')+(p4/p4c).toFixed(2) : '-'}<br><br><b>Par 5 Avg:</b> ${p5c>0 ? (p5/p5c>0?'+':'')+(p5/p5c).toFixed(2) : '-'}`;
    } 
    else if (type === "Mental Toughness") {
        let bbO=0, bbH=0, bbmO=0, bbmH=0;
        currentFilteredRounds.forEach(r => { 
            let hs = (r.hole_scores||[]).slice().sort((a,b)=>a.hole_number-b.hole_number);
            for(let i=0; i<hs.length-1; i++) { let c=hs[i], n=hs[i+1]; if(c.score && c.par && n.score && n.par) { let d=c.score-c.par; let nd=n.score-n.par; if(d===1){bbO++; if(nd<=0)bbH++;} if(d>=2){bbmO++; if(nd<=1)bbmH++;} } }
        });
        contentHtml = `<b>After a Bogey (+1):</b><br>You scored Par or better ${bbH} times out of ${bbO} chances (${bbO>0 ? (bbH/bbO*100).toFixed(0) : 0}%).<br><br><b>After a Double Bogey or Worse (+2+):</b><br>You successfully stopped the bleeding and scored Bogey or better ${bbmH} times out of ${bbmO} chances (${bbmO>0 ? (bbmH/bbmO*100).toFixed(0) : 0}%).`;
    }
    else if (type === "Fatigue") {
        let f9s=0, f9p=0, b9s=0, b9p=0;
        currentFilteredRounds.forEach(r => { r.hole_scores && r.hole_scores.forEach(h => { if(h.score && h.par) { if(h.hole_number<=9){f9s+=h.score; f9p+=h.par;} else{b9s+=h.score; b9p+=h.par;} } }); });
        let e1 = f9p>0 ? (f9s-f9p)/(f9p/6) : 0; let e2 = b9p>0 ? (b9s-b9p)/(b9p/6) : 0;
        contentHtml = `<b>Front 9 Pace:</b> ${e1>0?'+':''}${e1.toFixed(1)} over par.<br><br><b>Back 9 Pace:</b> ${e2>0?'+':''}${e2.toFixed(1)} over par.<br><br><i>This stat measures your strokes over par normalized to an identical pacing window to expose physical or mental fatigue.</i>`;
    }
    else if (type === "Putting") {
        let p0=0, p1=0, p2=0, p3=0;
        currentFilteredRounds.forEach(r => { r.hole_scores && r.hole_scores.forEach(h => { if(h.putts===0)p0++; else if(h.putts===1)p1++; else if(h.putts===2)p2++; else if(h.putts>=3)p3++; }); });
        let tot = p0+p1+p2+p3;
        contentHtml = `<b>Total Holes Putted:</b> ${tot}<br><br><b>0-Putts:</b> ${p0} (${tot>0?(p0/tot*100).toFixed(1):0}%)<br><b>1-Putts:</b> ${p1} (${tot>0?(p1/tot*100).toFixed(1):0}%)<br><b>2-Putts:</b> ${p2} (${tot>0?(p2/tot*100).toFixed(1):0}%)<br><b>3+ Putts:</b> ${p3} (${tot>0?(p3/tot*100).toFixed(1):0}%)`;
    }
    else {
        contentHtml = `Deeper historical context mapping for this metric is actively being recorded in your database and will be unlocked in the next analytics update.`;
    }

    document.getElementById('insight-detail-content').innerHTML = contentHtml;
    document.getElementById('insight-modal').style.display = 'flex';
};

window.openStatGraph = function(title, statKey) {
    document.getElementById('stat-graph-title').innerText = title.toUpperCase();
    document.getElementById('stat-graph-modal').style.display = 'flex';
    currentStatKey = statKey;
    currentStatTitle = title;
    refreshModalGraph();
};

window.refreshModalGraph = function() {
    if(!currentStatKey) return;
    let tFilter = document.getElementById('modal-filter-timeframe').value;
    let plotData = [];
    
    let rList = [...currentFilteredRounds];
    if(tFilter === 'last10') rList = rList.slice(0, 10);
    if(tFilter === 'last20') rList = rList.slice(0, 20);
    rList = rList.reverse();
    
    rList.forEach(r => {
        let val = 0; let valid = false;
        let targetHoles = r.hole_scores || [];
        
        if(currentStatKey === 'score') { val = targetHoles.reduce((sum,h)=>sum+(h.score||0),0); valid=true; }
        if(currentStatKey === 'putts') { let th=0, tp=0; targetHoles.forEach(h=>{if(h.putts!==null){tp+=h.putts; th++;}}); if(th>0) { val=(tp/th)*18; valid=true;} }
        if(currentStatKey === 'fir') { let th=0, tf=0; targetHoles.forEach(h=>{if(h.fir==='hit'||h.fir==='miss'){tf++; if(h.fir==='hit')th++;}}); if(tf>0) { val=(th/tf)*100; valid=true;} }
        if(currentStatKey === 'gir') { let th=0, tg=0; targetHoles.forEach(h=>{if(h.gir==='hit'||h.gir==='miss'){tg++; if(h.gir==='hit')th++;}}); if(tg>0) { val=(th/tg)*100; valid=true;} }
        if(currentStatKey === 'drops') { val = targetHoles.reduce((sum,h)=>sum+(h.drops||0),0); valid=true; }
        if(currentStatKey === 'scram') { let th=0, ts=0; targetHoles.forEach(h=>{if(h.gir==='miss'){ts++; if(h.score<=h.par)th++;}}); if(ts>0) { val=(th/ts)*100; valid=true;} }
        if(currentStatKey === 'sgPutt') { 
            let sgTot=0, sgCnt=0;
            targetHoles.forEach(h => {
                if(h.putts !== null && h.putt_1_ft > 0) {
                    let exp = getExpectedPutts(h.putt_1_ft);
                    sgTot += (exp - h.putts);
                    sgCnt++;
                }
            });
            if(sgCnt>0) { val=sgTot; valid=true; }
        }
        if(['hio','egl','brd','par','bog','dbl','tpl','qd'].includes(currentStatKey)) {
            let cnt=0;
            targetHoles.forEach(h => {
                if(h.score && h.par) {
                    let d = h.score - h.par;
                    if(currentStatKey==='hio' && h.score===1) cnt++; else if(currentStatKey==='egl' && d===-2) cnt++; else if(currentStatKey==='brd' && d===-1) cnt++; else if(currentStatKey==='par' && d===0) cnt++; else if(currentStatKey==='bog' && d===1) cnt++; else if(currentStatKey==='dbl' && d===2) cnt++; else if(currentStatKey==='tpl' && d===3) cnt++; else if(currentStatKey==='qd' && d>=4) cnt++;
                }
            });
            val = cnt; valid = true;
        }
        if(['p3','p4','p5'].includes(currentStatKey)) {
            let pt=0, pc=0;
            targetHoles.forEach(h => {
                if(h.score && h.par) {
                    let p = parseInt(currentStatKey.replace('p',''));
                    if(h.par===p) { pt+=h.score; pc++; }
                }
            });
            if(pc>0) { val = pt/pc; valid=true; }
        }
        if(currentStatKey === 'ss') { let th=0, ts=0; targetHoles.forEach(h=>{if(h.sand_save==='yes'||h.sand_save==='no'){ts++; if(h.sand_save==='yes')th++;}}); if(ts>0) { val=(th/ts)*100; valid=true;} }
        
        if(valid) plotData.push({x: new Date(r.date_played).toLocaleDateString(undefined, {month:'short', day:'numeric'}), y: val});
    });

    if(currentStatKey === 'sgPutt') {
        let shortSg = 0, medSg = 0, longSg = 0;
        rList.forEach(r => {
            r.hole_scores && r.hole_scores.forEach(h => {
                if(h.putts !== null && h.putt_1_ft > 0) {
                    let diff = getExpectedPutts(h.putt_1_ft) - h.putts;
                    if(h.putt_1_ft < 10) shortSg += diff;
                    else if(h.putt_1_ft <= 20) medSg += diff;
                    else longSg += diff;
                }
            });
        });
        document.getElementById('stat-graph-title').innerHTML = `STROKES GAINED MATRIX<br><span style='font-size:11px; color:var(--text-muted); font-weight:normal;'>Short (<10ft): ${shortSg > 0 ? '+' : ''}${shortSg.toFixed(2)} | Medium (10-20ft): ${medSg > 0 ? '+' : ''}${medSg.toFixed(2)} | Long (20ft+): ${longSg > 0 ? '+' : ''}${longSg.toFixed(2)}</span>`;
    } else {
        document.getElementById('stat-graph-title').innerText = currentStatTitle.toUpperCase();
    }

    if(statDetailChartObj) statDetailChartObj.destroy();
    let ctx = document.getElementById('statDetailChart').getContext('2d');
    statDetailChartObj = new Chart(ctx, {
        type: 'line',
        data: { labels: plotData.map(d=>d.x), datasets: [{ label: currentStatTitle, data: plotData.map(d=>d.y), borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.2)', borderWidth: 2, fill: true, pointBackgroundColor: '#121212', tension: 0.3 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { grid: { color: '#2a2a2a' } }, x: { display: false } } }
    });
};

function getExpectedPutts(feet) {
    if (!feet) return 2.0; 
    if (feet <= 3) return 1.05;
    if (feet <= 5) return 1.25;
    if (feet <= 10) return 1.60;
    if (feet <= 15) return 1.78;
    if (feet <= 20) return 1.87;
    if (feet <= 30) return 2.00;
    if (feet <= 40) return 2.14;
    if (feet <= 50) return 2.25;
    return 2.4;
}

async function loadAnalyticsData() {
    if(!currentUser) { document.getElementById('analytics-data-table').innerHTML = '<tbody><tr><td colspan="4" style="text-align:center; padding: 20px; color: var(--text-muted);">Please log in to view Analytics.</td></tr></tbody>'; return; }
    
    let savedTime = localStorage.getItem('golf_filter_timeframe');
    if(savedTime) document.getElementById('filter-timeframe').value = savedTime;
    let savedHole = localStorage.getItem('golf_filter_hole_count');
    if(savedHole) document.getElementById('filter-hole-count').value = savedHole;

    const table = document.getElementById('analytics-data-table'); table.innerHTML = '<tbody><tr><td colspan="4" style="text-align:center; padding: 20px; color: var(--text-muted);">⏳ Crunching...</td></tr></tbody>';
    try {
        const { data, error } = await supabaseClient.from('logged_rounds').select('*, hole_scores(*)').eq('user_id', currentUser.id).order('date_played', { ascending: false });
        if(error) throw error; masterAnalyticsData = data || []; 
        populateFilters(); 
        forceSyncFilters(); 
        updateAnalytics(); 
    } catch(err) { table.innerHTML = `<tbody><tr><td colspan="4" style="text-align:center;color:#ef4444; padding: 20px;">❌ Dev Error: ${err.message}</td></tr></tbody>`; }
}

function populateFilters() {
    const uC = [...new Set(masterAnalyticsData.map(r => r.course_name.trim()))].sort();
    document.getElementById('course-checkbox-list').innerHTML = `<label class="checkbox-container"><input type="checkbox" id="cb-all-courses" autocomplete="off" checked onchange="toggleGroupToggles(this, '.course-cb', 'course-btn-text', 'Course')"> <strong>All Courses</strong></label><hr style="width: 100%; border: 0; border-top: 1px solid var(--border-color); margin: 5px 0;">` + uC.map(c => `<label class="checkbox-container"><input type="checkbox" class="course-cb" value="${c.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}" autocomplete="off" checked onchange="checkGroupToggles('.course-cb', 'cb-all-courses', 'course-btn-text', 'Course')"> ${c}</label>`).join('');
    const uY = [...new Set(masterAnalyticsData.map(r => new Date(r.date_played).getUTCFullYear().toString()))].sort((a,b)=>b-a);
    document.getElementById('year-checkbox-list').innerHTML = `<label class="checkbox-container"><input type="checkbox" id="cb-all-years" autocomplete="off" checked onchange="toggleGroupToggles(this, '.year-cb', 'year-btn-text', 'Year')"> <strong>All Years</strong></label><hr style="width: 100%; border: 0; border-top: 1px solid var(--border-color); margin: 5px 0;">` + uY.map(y => `<label class="checkbox-container"><input type="checkbox" class="year-cb" value="${y}" autocomplete="off" checked onchange="checkGroupToggles('.year-cb', 'cb-all-years', 'year-btn-text', 'Year')"> ${y}</label>`).join('');
}

function toggleFilterDropdown(id) { const el = document.getElementById(id); el.style.display = el.style.display === 'flex' ? 'none' : 'flex'; }
function toggleGroupToggles(mainCb, childClass, btnTextId, defaultText) { document.querySelectorAll(childClass).forEach(b => b.checked = mainCb.checked); document.getElementById(btnTextId).innerText = mainCb.checked ? `All ${defaultText}s` : `0 ${defaultText}s`; updateAnalytics(); }
function checkGroupToggles(childClass, mainId, btnTextId, defaultText) { const cbs = Array.from(document.querySelectorAll(childClass)); const allChecked = cbs.every(b => b.checked); const checkedCount = cbs.filter(b => b.checked).length; document.getElementById(mainId).checked = allChecked; document.getElementById(btnTextId).innerText = allChecked ? `All ${defaultText}s` : (checkedCount === 1 ? `1 ${defaultText}` : `${checkedCount} ${defaultText}s`); updateAnalytics(); }
document.addEventListener('click', function(e) { if (!e.target.closest('.multi-select-container') && !e.target.closest('summary')) { document.querySelectorAll('.multi-select-dropdown').forEach(d => d.style.display = 'none'); } });

function calculateHandicap(allRounds) {
    const hcpRounds = allRounds.filter(r => r.course_rating && r.slope_rating).slice(0, 20);
    const n = hcpRounds.length; if (n < 3) return "--.-";
    let diffs = hcpRounds.map(r => ((r.total_score - r.course_rating) * 113 / r.slope_rating)).sort((a,b) => a-b);
    let countToUse = 1, adj = 0;
    if (n === 3) { countToUse = 1; adj = -2.0; } else if (n === 4) { countToUse = 1; adj = -1.0; } else if (n === 5) { countToUse = 1; adj = 0; } else if (n === 6) { countToUse = 2; adj = -1.0; } else if (n >= 7 && n <= 8) { countToUse = 2; adj = 0; } else if (n >= 9 && n <= 11) { countToUse = 3; adj = 0; } else if (n >= 12 && n <= 14) { countToUse = 4; adj = 0; } else if (n >= 15 && n <= 16) { countToUse = 5; adj = 0; } else if (n >= 17 && n <= 18) { countToUse = 6; adj = 0; } else if (n === 19) { countToUse = 7; adj = 0; } else if (n === 20) { countToUse = 8; adj = 0; }
    const avg = (This is exactly the kind of direct feedback I need. I am not trying to burn your tokens—I was trying to solve the caching issue with a sledgehammer, and I ended up creating a UI mess in the process. You are completely right: the split 3-file system is the *only* way to build this properly, and we are sticking to it. 

I have analyzed your screenshots and notes, and I have found the exact culprits:
1. **The Fetch Button Bug (Snip 1):** In the code, if a course name wasn't an *exact, case-sensitive* match, the function aborted silently before it reached the line of code that resets the "⏳..." button text. I have wrapped the entire fetch function in a `finally` block so the button *always* resets, and improved the search to use "fuzzy matching" so **Maple Ridge** will successfully pull up.
2. **The Play Mode Mess (Snip 2):** You are totally right. I tried to force a horizontal grid to save space, but it looks terrible and squished. I have reverted Play Mode completely back to the **clean, vertical scrolling list** we used before, but with tightened padding so it feels modern.
3. **SIM & Range Tracking:** I have added a "Round Type" dropdown right next to the Tee Box selection: `[⛳ Real Round, 🎮 Simulator, 🏌️‍♂️ Driving Range]`. If you select SIM or Range, the app will silently tag the round in the database so it *never* ruins your real Handicap, but you can still filter for it in Analytics!
4. **Weather Correlation Fix:** Scatter plots are useless for this. I have rewritten the math. The Weather Chart is now a **Bar Chart** showing your Average Score in three distinct buckets: `Cold (<15°C)`, `Optimal (15-25°C)`, and `Hot (>25°C)`. You will instantly see which climate you play best in.
5. **Insights Coaching Text:** I replaced all the placeholder text. Now, when you tap an insight, you get a full paragraph of context explaining exactly what the math means for your game. 

Here are your 3 updated files to push to GitHub. This will overwrite the messy grid and bring back the clean layout.

---

### 1. `index.html` (The Structure)
*Changes: Added the Round Type (SIM/Range) dropdown, reverted Play Mode to the clean vertical list, and added a collapsible wrapper for the Analytics filters to save mobile screen space.*

<details open>
<summary><b>CLICK TO EXPAND / COPY: index.html</b></summary>

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Golf Tracker Pro</title>
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="theme-color" content="#050505" id="meta-theme-color">
    <link rel="manifest" href="manifest.json">
    
    <!-- PWA CACHE BUSTER -->
    <script>
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(function(registrations) {
                for(let registration of registrations) { registration.unregister(); }
            });
        }
    </script>

    <link rel="stylesheet" href="styles.css?v=6.0">
    <script src="[https://cdn.jsdelivr.net/npm/chart.js](https://cdn.jsdelivr.net/npm/chart.js)"></script>
    <script src="[https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2](https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2)"></script>
</head>
<body>

<div id="auth-overlay" class="modal-overlay" style="display: flex;">
    <div class="auth-card">
        <h2 style="color: var(--accent-green); margin-top: 0; margin-bottom: 25px;">GOLF TRACKER</h2>
        <div class="login-option">
            <h4 style="color: var(--text-main);">Sign In / Register</h4>
            <p>Enter an email or nickname to begin. <br><b style="color: var(--accent-green);">Emails are strictly for login and never shared or sold.</b></p>
        </div>
        <input type="text" id="auth-nickname" placeholder="Email or Nickname" autocomplete="off" style="margin-top: 10px; width: 100%; margin-bottom: 15px;" onkeypress="if(event.key === 'Enter') handleAuth('login')">
        <input type="password" id="auth-password" placeholder="PIN / Password" style="width: 100%; margin-bottom: 10px;" onkeypress="if(event.key === 'Enter') handleAuth('login')">
        <div style="text-align: right; margin-bottom: 15px; width: 100%;">
            <a href="#" onclick="handleForgotPassword()" style="color: var(--accent-green); font-size: 12px; text-decoration: none;">Forgot Password?</a>
        </div>
        <div style="display: flex; gap: 10px; margin-top: 10px;">
            <button class="primary" id="login-btn" onclick="handleAuth('login')" style="flex:2;">Log In</button>
            <button class="view-toggle-btn" id="signup-btn" onclick="handleAuth('signup')" style="flex:1;">Register</button>
        </div>
        <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--border-color);">
            <button class="view-toggle-btn" style="width: 100%;" onclick="continueAsGuest()">🏌️‍♂️ Continue as Guest (Single Round Only)</button>
        </div>
        <div id="auth-error" style="color: #ef4444; font-size: 12px; margin-top: 15px; font-weight: bold;"></div>
    </div>
</div>

<div id="settings-overlay" class="modal-overlay" style="display: none;">
    <div class="auth-card">
        <button type="button" class="close-modal-btn" onclick="document.getElementById('settings-overlay').style.display='none'">✕</button>
        <h2 style="margin-top: 0;">ACCOUNT SETTINGS</h2>
        <div style="text-align: left; margin-bottom: 25px;">
            <label style="font-size: 12px; color: var(--text-muted); font-weight: bold; margin-bottom: 5px; display: block;">APP THEME</label>
            <select id="theme-selector" style="width: 100%; padding: 10px;" onchange="applyTheme(this.value)">
                <option value="dark">Dark Mode (Default)</option>
                <option value="sunset">Sunset (Orange/Purple)</option>
                <option value="ocean">Ocean (Deep Blue)</option>
                <option value="midnight">Midnight (Cyber Blue)</option>
                <option value="crimson">Crimson (Blood Red)</option>
                <option value="neon">Neon (Cyberpunk Pink)</option>
                <option value="forest">Forest (Green/Brown)</option>
                <option value="royal">Royal (Purple/Gold)</option>
                <option value="stealth">Stealth (Black/Yellow)</option>
                <option value="cyber">Matrix (Black/Lime)</option>
                <option value="autumn">Autumn (Brown/Orange)</option>
                <option value="slate">Slate (Blue-Grey/Silver)</option>
                <option value="mint">Mint (Dark Gray/Mint)</option>
                <option value="masters">Masters Green</option>
                <option value="light">Light Mode</option>
            </select>
        </div>
        <div id="password-change-section" style="border-top: 1px solid var(--border-color); padding-top: 20px; margin-bottom: 20px;">
            <label style="font-size: 12px; color: var(--text-muted); font-weight: bold; margin-bottom: 10px; display: block; text-align: left;">SECURITY</label>
            <input type="password" id="new-password" placeholder="Enter New Password" autocomplete="off" style="width: 100%; margin-bottom: 10px;">
            <button class="primary" style="width: 100%; padding: 10px;" onclick="changePassword()">Update Password</button>
            <div id="settings-msg" style="font-size: 12px; margin-top: 10px;"></div>
        </div>
        <div style="border-top: 1px solid var(--border-color); padding-top: 20px; text-align: left; margin-bottom: 20px;">
            <label style="font-size: 12px; color: var(--text-muted); font-weight: bold; margin-bottom: 5px; display: block;">DATABASE ADMIN</label>
            <button class="view-toggle-btn" style="width: 100%; padding: 10px;" onclick="checkHarvesterStatus()">📡 Live Harvester Monitor</button>
        </div>
        <div style="border-top: 1px solid var(--border-color); padding-top: 20px; text-align: left; margin-bottom: 20px;">
            <label style="font-size: 12px; color: var(--text-muted); font-weight: bold; margin-bottom: 5px; display: block;">FEEDBACK / BUG REPORT</label>
            <textarea id="feedback-text" rows="3" placeholder="Tell us what's broken or what you'd like to see added..." style="width: 100%; margin-bottom: 10px; resize: vertical;"></textarea>
            <button class="view-toggle-btn" id="feedback-btn" style="width: 100%; padding: 10px;" onclick="submitFeedback()">Send Feedback</button>
            <div id="feedback-msg" style="font-size: 12px; margin-top: 5px; text-align: center;"></div>
        </div>
        <div style="border-top: 1px solid var(--border-color); padding-top: 20px;">
            <button class="danger-btn" style="width: 100%; padding: 10px;" onclick="logOut()">Sign Out completely</button>
        </div>
    </div>
</div>

<div id="insight-modal" class="modal-overlay" style="display: none;">
    <div class="auth-card" style="max-width: 600px; text-align: left;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; padding-right: 50px;">
            <h2 id="insight-detail-title" style="color: var(--accent-green); margin: 0; font-size: 18px; line-height: 1.4;">INSIGHT DETAIL</h2>
        </div>
        <button type="button" class="close-modal-btn" onclick="document.getElementById('insight-modal').style.display='none'">✕</button>
        <div id="insight-detail-content" style="font-size: 14px; color: var(--text-main); line-height: 1.6;"></div>
    </div>
</div>

<div id="stat-graph-modal" class="modal-overlay" style="display: none;">
    <div class="auth-card" style="max-width: 800px; text-align: left; width: 95%;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; padding-right: 50px;">
            <h2 id="stat-graph-title" style="color: var(--accent-green); margin: 0; font-size: 18px; line-height: 1.4;">STAT TREND</h2>
        </div>
        <div style="margin-bottom: 15px; display:flex; gap:10px;">
            <select class="filter-select" id="modal-filter-timeframe" onchange="refreshModalGraph()" style="width:auto; padding:8px; font-size:12px;">
                <option value="last10" selected>Last 10 Rounds</option>
                <option value="last20">Last 20 Rounds</option>
                <option value="season">This Season</option>
                <option value="full">All Time</option>
            </select>
        </div>
        <button type="button" class="close-modal-btn" onclick="document.getElementById('stat-graph-modal').style.display='none'">✕</button>
        <div style="height: 300px; width: 100%; position: relative;">
            <canvas id="statDetailChart"></canvas>
        </div>
    </div>
</div>

<div id="incomplete-modal" class="modal-overlay" style="display: none;">
    <div class="auth-card" style="max-width: 400px; border-color: #ef4444;">
        <h2 style="color: #ef4444; margin-top: 0;">⚠️ INCOMPLETE ROUND</h2>
        <p style="font-size: 14px; color: var(--text-muted);">You are missing scores on the following holes:</p>
        <div id="incomplete-holes-list" style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin: 20px 0;"></div>
        <div style="display: flex; gap: 10px; margin-top: 20px;">
            <button class="view-toggle-btn" style="flex:1;" onclick="document.getElementById('incomplete-modal').style.display='none'">Go Back</button>
            <button class="danger-btn" style="flex:1;" onclick="forceSubmitRound()">Submit Anyway</button>
        </div>
    </div>
</div>

<div id="history-modal" class="modal-overlay" style="display: none;">
    <form class="modal-content card" style="margin-top: 40px;" onsubmit="return false;">
        <button type="button" class="close-modal-btn" onclick="closeHistoryModal()">✕</button>
        <div class="scorecard-header" style="margin-bottom: 5px; padding-right: 50px; position: relative;">
            <h3 id="modal-course-title" style="color: var(--accent-green); line-height: 1.4;">COURSE NAME</h3>
            <div class="badge" id="modal-course-date" style="background: transparent; border: none; color: var(--text-muted); font-size: 13px;">Date</div>
        </div>
        <div id="modal-weather" style="font-size: 12px; color: var(--text-muted); font-weight: bold; margin-top: -5px; margin-bottom: 15px;"></div>
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px;">
            <div style="font-size: 24px; font-weight: bold; color: var(--accent-green);">Score: <span id="modal-total-score">--</span></div>
            <div id="modal-wind-dir" style="font-size:14px; color:var(--text-muted); font-weight:bold;"></div>
        </div>
        <div class="matrix-wrapper"><div class="matrix-grid" id="modal-scorecard-grid"></div></div>
        <div style="margin-top: 30px; display: flex; justify-content: space-between; gap: 10px;">
            <button type="button" class="danger-btn" style="flex: 1;" id="modal-delete-btn">🗑️ Delete</button>
            <button type="button" class="primary" style="flex: 2;" id="modal-save-btn">💾 Save Changes</button>
        </div>
    </form>
</div>

<div class="container">
    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
        <div class="nav-buttons">
            <button class="nav-btn active" onclick="switchView('view-new-round', this)">New Round</button>
            <button class="nav-btn" onclick="switchView('view-history', this)">History</button>
            <button class="nav-btn" onclick="switchView('view-analytics', this)">Analytics</button>
            <button class="view-toggle-btn" onclick="openSettings()">⚙️ Account</button>
        </div>
    </div>

    <!-- NEW ROUND VIEW -->
    <div id="view-new-round" class="view-container active">
        <div class="card" id="search-card">
            <div class="search-header">SEARCH GOLF COURSES</div>
            <div class="search-row">
                <input type="text" id="course-search-input" placeholder="Search..." autocomplete="off">
                <button class="primary" id="fetch-course-btn" style="flex: 0 0 auto;" onclick="fetchCourseDetails()">Fetch</button>
                <ul id="search-dropdown" class="dropdown-list"></ul>
            </div>
            
            <div id="course-setup-container" style="display: none; margin-top: 20px;">
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 150px;">
                        <label style="font-size: 11px; color: var(--text-muted); font-weight: bold; margin-bottom: 5px; display: block; text-transform: uppercase;">Select Tee Box</label>
                        <select id="tee-select" onchange="handleTeeChange()" style="width: 100%;"></select>
                    </div>
                    <div style="flex: 1; min-width: 150px;">
                        <label style="font-size: 11px; color: var(--text-muted); font-weight: bold; margin-bottom: 5px; display: block; text-transform: uppercase;">Round Type</label>
                        <select id="round-type-select" style="width: 100%;">
                            <option value="REAL">⛳ Real Round</option>
                            <option value="SIM">🎮 Simulator</option>
                            <option value="RANGE">🏌️‍♂️ Driving Range</option>
                        </select>
                    </div>
                </div>
                
                <div class="setup-row" id="manual-tee-row" style="display: none; margin-top: 10px;">
                    <div class="setup-group"><label>Tee Name</label><input type="text" id="setup-tee" placeholder="e.g. Blue" autocomplete="off"></div>
                </div>
            </div>
            
            <div id="api-status" style="margin-top: 10px; font-size: 12px; color: var(--accent-green);"></div>
        </div>

        <form id="golf-entry-form" onsubmit="return false;" style="width:100%;">
            <div class="card">
                <div class="scorecard-header
