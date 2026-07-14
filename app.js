const SUPABASE_URL = "https://hksccpousgspagkqcjzd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_KLpYENB7bIa_8SkAWN90uA_12BcxJKC"; 
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const GOOGLE_MAPS_API_KEY = "YOUR_GOOGLE_MAPS_API_KEY_HERE"; 

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

let trendChart = null, clubChart = null, statDetailChartObj = null, scorePieChart = null, weatherChart = null, penaltyPieChartObj = null, accuracyChart = null, parScoringChart = null;
let currentFilteredRounds = [], roundWeather = { temp: null, wind: null }, dismissedWarnings = [];
let currentStatKey = null, currentStatTitle = null;
let practiceSessionData = [];

let puttCanvas = null, puttCtx = null, pinPos = null, ballPos = null;

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
        root.style.setProperty('--bg-color', t.bg); root.style.setProperty('--card-bg', t.card);
        root.style.setProperty('--border-color', t.border); root.style.setProperty('--accent-green', t.accent);
        root.style.setProperty('--text-main', t.text); root.style.setProperty('--text-muted', t.muted);
        root.style.setProperty('--cell-bg', t.cell); root.style.setProperty('--cell-border', t.cellBorder);
    }
    const metaTheme = document.getElementById('meta-theme-color');
    if(metaTheme) metaTheme.setAttribute('content', t.bg);
    localStorage.setItem('golf_theme', themeName);
    const selector = document.getElementById('theme-selector');
    if (selector) selector.value = themeName;
};

let savedTheme = localStorage.getItem('golf_theme') || 'dark'; 
window.applyTheme(savedTheme);

async function initializeApp() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) { 
        currentUser = session.user; 
        localStorage.removeItem('golf_guest_mode'); 
        document.getElementById('auth-overlay').style.display = 'none'; 
        loadLocalState(); 
        window.buildGrid(); 
        processOfflineQueue(); 
    } 
    else if (localStorage.getItem('golf_guest_mode') === 'true') { 
        document.getElementById('auth-overlay').style.display = 'none'; 
        loadLocalState(); 
        window.buildGrid(); 
    } 
    else { 
        document.getElementById('auth-overlay').style.display = 'flex'; 
    }

    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') { document.getElementById('auth-overlay').style.display = 'none'; window.openSettings(); document.getElementById('settings-msg').innerText = "Security token authenticated."; }
        else if (event === 'SIGNED_IN' && session) { currentUser = session.user; localStorage.removeItem('golf_guest_mode'); document.getElementById('auth-overlay').style.display = 'none'; loadLocalState(); window.buildGrid(); processOfflineQueue(); } 
        else if (event === 'SIGNED_OUT') { currentUser = null; if (localStorage.getItem('golf_guest_mode') !== 'true') document.getElementById('auth-overlay').style.display = 'flex'; }
    });

    let htmlList = ""; for(let i=1; i<=18; i++) htmlList += `<label class="checkbox-container"><input type="checkbox" class="hole-cb" value="${i}" autocomplete="off" checked onchange="window.checkGroupToggles('.hole-cb', 'cb-all-holes', 'hole-btn-text', 'Hole')"> Hole ${i}</label>`;
    let hBox = document.getElementById('hole-checkbox-list'); if(hBox) hBox.innerHTML += htmlList;

    let monthHtml = ""; const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for(let i=1; i<=12; i++) monthHtml += `<label class="checkbox-container"><input type="checkbox" class="month-cb" value="${i}" autocomplete="off" checked onchange="window.checkGroupToggles('.month-cb', 'cb-all-months', 'month-btn-text', 'Month')"> ${months[i-1]}</label>`;
    let mBox = document.getElementById('month-checkbox-list'); if(mBox) mBox.innerHTML += monthHtml;

    puttCanvas = document.getElementById('putt-canvas');
    if(puttCanvas) { puttCtx = puttCanvas.getContext('2d'); puttCanvas.addEventListener('click', handlePuttClick); }
    
    window.buildGrid();
    window.updatePlayModeUI();
}

window.handleAuth = async function(type) {
    const cleanInput = document.getElementById('auth-nickname').value.trim().replace(/\s+/g, ''); 
    const email = cleanInput.includes('@') ? cleanInput : cleanInput.toLowerCase() + "@golf.local"; 
    const btn = document.getElementById(type === 'signup' ? 'signup-btn' : 'login-btn');
    const originalText = btn.innerText; btn.innerText = "⏳..."; btn.disabled = true;
    try { 
        let res = type === 'signup' ? await supabaseClient.auth.signUp({ email, password: document.getElementById('auth-password').value }) : await supabaseClient.auth.signInWithPassword({ email, password: document.getElementById('auth-password').value }); 
        if(res.error) throw res.error; 
    } catch (e) { document.getElementById('auth-error').style.color = "#ef4444"; document.getElementById('auth-error').innerText = e.message; } finally { btn.innerText = originalText; btn.disabled = false; }
};

window.handleForgotPassword = async function() {
    const cleanInput = document.getElementById('auth-nickname').value.trim().replace(/\s+/g, ''); 
    const email = cleanInput.includes('@') ? cleanInput : cleanInput.toLowerCase() + "@golf.local";
    if (!email || !email.includes('@') || email.includes('@golf.local')) return alert("Recovery mapping requires valid verification email layout.");
    try { const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname }); if (error) throw error; document.getElementById('auth-error').style.color = "var(--accent-green)"; document.getElementById('auth-error').innerText = "Recovery link routed."; } catch (e) { document.getElementById('auth-error').style.color = "#ef4444"; document.getElementById('auth-error').innerText = e.message; }
};

window.changePassword = async function() { const { error } = await supabaseClient.auth.updateUser({ password: document.getElementById('new-password').value }); document.getElementById('settings-msg').innerText = error ? "❌ " + error.message : "✅ Updated."; };
window.logOut = async function() { localStorage.removeItem('golf_guest_mode'); localStorage.removeItem('golf_round_state'); await supabaseClient.auth.signOut(); location.reload(); };
window.openSettings = function() { document.getElementById('password-change-section').style.display = currentUser ? 'block' : 'none'; document.getElementById('settings-overlay').style.display = 'flex'; };
window.continueAsGuest = function() { currentUser = null; localStorage.setItem('golf_guest_mode', 'true'); document.getElementById('auth-overlay').style.display = 'none'; loadLocalState(); window.buildGrid(); };

window.switchView = function(viewId, btn) { 
    document.querySelectorAll('.view-container').forEach(el => el.classList.remove('active')); 
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active')); 
    document.querySelectorAll('.bottom-nav button').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active'); 
    if(btn) btn.classList.add('active'); 
    if(viewId==='view-history') window.fetchHistory(); 
    if(viewId==='view-analytics') window.loadAnalyticsData(); 
};

window.switchAnalyticsTab = function(tab, btn) { 
    document.querySelectorAll('#view-analytics > .card > div[id^="analytics-tab-"]').forEach(el => el.style.display = 'none'); 
    document.querySelectorAll('.analytics-tabs button').forEach(el => el.classList.remove('active')); 
    document.getElementById('analytics-tab-' + tab).style.display = 'block'; 
    btn.classList.add('active'); 
};

window.checkHarvesterStatus = async function() {
    document.getElementById('settings-overlay').style.display = 'none';
    document.getElementById('insight-detail-title').innerText = "HARVESTER LAYER LOG";
    document.getElementById('insight-detail-content').innerHTML = "⏳ Pinging database...";
    document.getElementById('insight-modal').style.display = 'flex';
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
            html += `<div style="margin-bottom:8px;"><div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>${c}</span><span>${grouped[c]} Tees</span></div><div style="width:100%; height:6px; background:var(--card-bg); border-radius:3px; overflow:hidden;"><div style="width:${pct}%; height:100%; background:var(--accent-green);"></div></div></div>`;
        });
        html += `</div>`;
        document.getElementById('insight-detail-content').innerHTML = html;
    } catch(e) { document.getElementById('insight-detail-content').innerHTML = "❌ Error fetching status: " + e.message; }
};

// ----------------------------------------------------
// PRACTICE HUB CONTROLLER
// ----------------------------------------------------
window.togglePracticeMode = function() {
    const val = document.getElementById('practice-type-select').value;
    document.querySelectorAll('.sim-metric').forEach(d => d.style.display = val === 'SIM' ? 'block' : 'none');
};

window.logPracticeShot = function() {
    const club = document.getElementById('range-club').value; const dist = parseInt(document.getElementById('range-dist').value);
    const strike = document.getElementById('range-strike').value; const shape = document.getElementById('range-shape').value;
    if(isNaN(dist) || dist <= 0) return alert("Enter accurate target numerical metrics.");
    
    practiceSessionData.push({ club: club, dist: dist, strike: strike, shape: shape });
    document.getElementById('range-dist').value = ""; document.getElementById('sim-ball-speed').value = ""; document.getElementById('sim-spin').value = "";
    window.updatePracticeTable();
};

window.updatePracticeTable = function() {
    const tbody = document.getElementById('practice-session-body');
    if(practiceSessionData.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding: 15px;">No shots logged this session.</td></tr>'; return; }
    let grouped = {};
    practiceSessionData.forEach(s => { 
        if(!grouped[s.club]) grouped[s.club] = { tot: 0, cnt: 0, shapes: {} }; 
        grouped[s.club].tot += s.dist; grouped[s.club].cnt++; grouped[s.club].shapes[s.shape] = (grouped[s.club].shapes[s.shape] || 0) + 1;
    });
    let html = "";
    Object.keys(grouped).sort((a,b) => (grouped[b].tot/grouped[b].cnt) - (grouped[a].tot/grouped[a].cnt)).forEach(c => {
        let avg = Math.round(grouped[c].tot / grouped[c].cnt); let commonShape = Object.keys(grouped[c].shapes).sort((x,y) => grouped[c].shapes[y] - grouped[c].shapes[x])[0];
        html += `<tr><td>${c}</td><td>${avg}y</td><td>${commonShape}</td><td>${grouped[c].cnt}</td></tr>`;
    });
    tbody.innerHTML = html;
};

window.savePracticeSession = function() {
    if(practiceSessionData.length === 0) return alert("Session log buffer evaluation empty.");
    alert("Practice telemetry array synchronized to terminal memory stacks."); practiceSessionData = []; window.updatePracticeTable();
};

// ----------------------------------------------------
// PUTT CANVASS METRIC INTERPOLATION
// ----------------------------------------------------
window.openPuttMapper = function() { 
    pinPos = null; ballPos = null; document.getElementById('putt-distance-display').innerText = "-- ft"; document.getElementById('putt-map-modal').style.display = 'flex'; 
    if (navigator.geolocation) { navigator.geolocation.getCurrentPosition(position => { loadSatelliteGreen(position.coords.latitude, position.coords.longitude); }, err => { clearPuttCanvas(); }); } 
    else { clearPuttCanvas(); }
};

window.clearPuttMap = function() { pinPos = null; ballPos = null; document.getElementById('putt-distance-display').innerText = "-- ft"; clearPuttCanvas(); };

function clearPuttCanvas() {
    if(!puttCtx || !puttCanvas) return;
    puttCtx.clearRect(0, 0, puttCanvas.width, puttCanvas.height);
    puttCtx.beginPath(); puttCtx.arc(150, 150, 50, 0, 2*Math.PI); puttCtx.strokeStyle = 'rgba(255,255,255,0.1)'; puttCtx.stroke();
    puttCtx.beginPath(); puttCtx.arc(150, 150, 100, 0, 2*Math.PI); puttCtx.strokeStyle = 'rgba(255,255,255,0.1)'; puttCtx.stroke();
}

function loadSatelliteGreen(lat, lon) {
    if(!puttCtx || !puttCanvas) return;
    if (GOOGLE_MAPS_API_KEY === "YOUR_GOOGLE_MAPS_API_KEY_HERE") { clearPuttCanvas(); return; }
    const img = new Image(); img.crossOrigin = "Anonymous";
    img.src = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lon}&zoom=20&size=300x300&maptype=satellite&key=${GOOGLE_MAPS_API_KEY}`;
    img.onload = () => { puttCtx.drawImage(img, 0, 0, 300, 300); }; img.onerror = () => clearPuttCanvas();
}

function handlePuttClick(e) {
    const rect = puttCanvas.getBoundingClientRect(); const x = e.clientX - rect.left; const y = e.clientY - rect.top;
    if (!pinPos) { pinPos = {x, y}; puttCtx.font = "24px Arial"; puttCtx.fillText("⛳", x - 12, y + 12); } 
    else if (!ballPos) {
        ballPos = {x, y}; puttCtx.font = "18px Arial"; puttCtx.fillText("⚪", x - 9, y + 9);
        puttCtx.beginPath(); puttCtx.moveTo(pinPos.x, pinPos.y); puttCtx.lineTo(ballPos.x, ballPos.y);
        puttCtx.setLineDash([5, 5]); puttCtx.strokeStyle = 'rgba(255,255,255,0.8)'; puttCtx.lineWidth = 2; puttCtx.stroke(); puttCtx.setLineDash([]);
        let pxDist = Math.sqrt(Math.pow(ballPos.x - pinPos.x, 2) + Math.pow(ballPos.y - pinPos.y, 2));
        let ftDist = Math.round(pxDist * 0.3); document.getElementById('putt-distance-display').innerText = ftDist + " ft";
    }
}

window.savePuttMap = function() {
    let dText = document.getElementById('putt-distance-display').innerText; let dist = parseInt(dText.replace(' ft', ''));
    if(!isNaN(dist)) { document.getElementById('play-putt-dist').value = dist; window.syncPlayToState('puttDist', dist); }
    document.getElementById('putt-map-modal').style.display = 'none';
};

// ----------------------------------------------------
// ROUND FETCH & WEATHER
// ----------------------------------------------------
function fetchWeatherForCourse(courseName) {
    const display = document.getElementById('weather-display'); display.innerText = "🌤️ Locating course for weather...";
    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(courseName + ' Golf')}&format=json&limit=1`, { headers: { 'User-Agent': 'GolfScorecardApp/1.0' } })
    .then(res => res.json()).then(data => {
        if (data && data.length > 0) fetchWeatherByCoords(data[0].lat, data[0].lon, display, courseName);
        else {
            fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(courseName)}&format=json&limit=1`, { headers: { 'User-Agent': 'GolfScorecardApp/1.0' } })
            .then(res => res.json()).then(data2 => {
                if (data2 && data2.length > 0) fetchWeatherByCoords(data2[0].lat, data2[0].lon, display, courseName);
                else display.innerText = "⚠️ Weather unavailable";
            }).catch(() => display.innerText = "⚠️ Weather unavailable");
        }
    }).catch(() => display.innerText = "⚠️ Weather unavailable");
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
            document.getElementById('practice-weather-display').innerText = `⛅ ${roundWeather.temp} | 💨 ${roundWeather.wind}`;
            saveLocalState();
        }
    } catch(e) { display.innerText = "⚠️ Weather unavailable"; }
}

function saveLocalState() { 
    const el = document.getElementById('current-course-display'); if (!el) return; 
    localStorage.setItem('golf_round_state', JSON.stringify({ 
        courseName: el.innerText.trim(), holeCount: currentHoleCount, holeOffset: currentHoleOffset, pars: currentCoursePars, 
        yardages: currentYardages, roundData: roundData, weather: roundWeather, dismissedWarnings: dismissedWarnings
    })); 
}

function loadLocalState() { 
    const saved = localStorage.getItem('golf_round_state'); 
    if(saved) { 
        try { 
            const s = JSON.parse(saved); 
            document.getElementById('current-course-display').innerText = s.courseName; document.getElementById('current-course-display').style.color = 'var(--accent-green)'; 
            currentHoleCount = s.holeCount || 18; currentHoleOffset = s.holeOffset || 0;
            currentCoursePars = s.pars || Array(18).fill(""); currentYardages = s.yardages || Array(18).fill(""); 
            roundData = s.roundData || Array.from({length: 18}, () => ({ score: "", putts: "", fir: "", firAdv: [], gir: "", girAdv: [], drive: "", driveException: "", drops: 0, dropsAdv: [], sandSave: "", puttDist: "", driveClub: "", appClub: "", appDist: "" })); 
            roundWeather = s.weather || roundWeather; dismissedWarnings = s.dismissedWarnings || [];
            
            if(roundWeather.temp) {
                document.getElementById('weather-display').innerText = `⛅ ${roundWeather.temp} | 💨 ${roundWeather.wind}`; 
                document.getElementById('practice-weather-display').innerText = `⛅ ${roundWeather.temp} | 💨 ${roundWeather.wind}`;
            }
            
            document.getElementById('btn-18-holes').classList.toggle('active', currentHoleCount === 18); 
            document.getElementById('btn-9-holes').classList.toggle('active', currentHoleCount === 9); 
            
            let toggleBox = document.getElementById('front-back-toggle');
            if (currentHoleCount === 9) { toggleBox.style.display = 'inline-flex'; document.getElementById('btn-front-9').classList.toggle('active', currentHoleOffset === 0); document.getElementById('btn-back-9').classList.toggle('active', currentHoleOffset === 9); } 
            else { toggleBox.style.display = 'none'; }
            
            currentPlayHole = currentHoleOffset;
            
            if(s.courseName && s.courseName !== 'NO COURSE' && s.courseName !== 'NO COURSE SELECTED' && s.courseName !== 'MANUAL SCORECARD (SEARCH TO FETCH)') {
                document.getElementById('search-card').style.display = 'none'; window.togglePlayMode(true);
            }
        } catch(e) {} 
    } 
}

async function processOfflineQueue() {
    const queueStr = localStorage.getItem('golf_offline_queue');
    if (queueStr && currentUser) {
        try {
            const queue = JSON.parse(queueStr);
            for (const round of queue) { const { data: roundHeader, error: hErr } = await supabaseClient.from('logged_rounds').insert([round.header]).select('id').single(); if (hErr) throw hErr; await supabaseClient.from('hole_scores').insert(round.holes.map(h => ({ ...h, round_id: roundHeader.id }))); }
            localStorage.removeItem('golf_offline_queue'); window.fetchHistory(); window.loadAnalyticsData(); console.log("Offline queue synced successfully.");
        } catch (e) { console.error("Failed to sync offline queue", e); }
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
            if (uniqueCourses.length > 0) { dropdown.innerHTML = uniqueCourses.map(c => `<li onclick="window.selectCourseFromDropdown('${c.replace(/'/g, "\\'")}')">${c.toUpperCase()}</li>`).join(''); dropdown.classList.add('active'); } 
            else { dropdown.classList.remove('active'); }
        } catch(err) { console.error(err); } 
    }, 250); 
});

document.getElementById('course-search-input').addEventListener('keypress', function(e) { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('search-dropdown').classList.remove('active'); window.fetchCourseDetails(); } });

function getGlobalClubAverages() {
    let stats = {};
    masterAnalyticsData.forEach(r => {
        (r.hole_scores||[]).forEach(h => {
            if(h.drive_club && h.drive_distance > 0 && !h.drive_exception) { if(!stats[h.drive_club]) stats[h.drive_club] = {tot:0, cnt:0}; stats[h.drive_club].tot += h.drive_distance; stats[h.drive_club].cnt++; }
            if(h.approach_club && h.approach_yd > 0) { if(!stats[h.approach_club]) stats[h.approach_club] = {tot:0, cnt:0}; stats[h.approach_club].tot += h.approach_yd; stats[h.approach_club].cnt++; }
        });
    });
    practiceSessionData.forEach(s => {
        if(!stats[s.club]) stats[s.club] = {tot:0, cnt:0};
        stats[s.club].tot += s.dist; stats[s.club].cnt++;
    });
    let avgs = {}; for (let c in stats) avgs[c] = Math.round(stats[c].tot / stats[c].cnt);
    return avgs;
}

function getSmartClubRecommendation(targetDistance) {
    if (!targetDistance || targetDistance <= 0) return "";
    let clubAverages = getGlobalClubAverages(); 
    let closestClub = ""; let minDiff = 999;
    for (const [club, avgDist] of Object.entries(clubAverages)) {
        let diff = Math.abs(avgDist - targetDistance);
        if (diff < minDiff) { minDiff = diff; closestClub = club; }
    }
    return closestClub;
}

// ----------------------------------------------------
// PLAY MODE LOGIC & DESKTOP SYNC
// ----------------------------------------------------
window.adjustStat = function(field, amount) {
    let el = document.getElementById(`play-${field}`); let current = parseInt(el.value);
    if(isNaN(current)) current = (field === 'score' ? parseInt(currentCoursePars[currentPlayHole]) || 4 : 2);
    let next = current + amount; if(next < 0) next = 0; el.value = next; window.syncPlayToState(field, next);
};

window.adjustDrop = function(amount) {
    let cVal = parseInt(roundData[currentPlayHole].drops) || 0; let next = cVal + amount; if(next < 0) next = 0;
    roundData[currentPlayHole].drops = next; document.getElementById('play-drops-display').value = next;
    const gridCell = document.getElementById(`grid-drops-${currentPlayHole}`); if(gridCell) { gridCell.innerText = next === 0 ? '-' : next; gridCell.style.color = next > 0 ? '#ef4444' : 'var(--text-muted)'; }
    document.getElementById('drop-sub-menu').style.display = next === 0 ? 'none' : 'flex'; saveLocalState();
};

window.toggleDropType = function(type) {
    let adv = roundData[currentPlayHole].dropsAdv || []; if(adv.includes(type)) adv = adv.filter(v => v !== type); else adv.push(type);
    roundData[currentPlayHole].dropsAdv = adv; ['WATER', 'OB', 'LOST', 'UNPLAYABLE'].forEach(id => { const btn = document.getElementById(`drop-${id.toLowerCase()}`); if(btn) btn.classList.toggle('active', adv.includes(id)); }); saveLocalState();
};

window.setPlayToggle = function(type, status) {
    let current = roundData[currentPlayHole][type]; let nextStatus = (current === status) ? "" : status;
    roundData[currentPlayHole][type] = nextStatus; if (status !== 'miss') roundData[currentPlayHole][type + 'Adv'] = [];
    const gridCell = document.getElementById(`grid-${type}-${currentPlayHole}`);
    if(gridCell) { gridCell.innerText = nextStatus === "" ? "-" : nextStatus.toUpperCase(); gridCell.classList.toggle('hit', nextStatus === 'hit'); }
    window.updatePlayModeUI(); saveLocalState();
};

window.toggleAdv = function(type, val) {
    let arr = roundData[currentPlayHole][type + 'Adv'] || []; if(arr.includes(val)) arr = arr.filter(v => v !== val); else arr.push(val);
    roundData[currentPlayHole][type + 'Adv'] = arr; window.updatePlayModeUI(); saveLocalState();
};

window.cycleSand = function() {
    let s = roundData[currentPlayHole].sandSave; let next = (s === "") ? "1" : (s === "1" ? "2" : (s === "2" ? "3+" : ""));
    roundData[currentPlayHole].sandSave = next;
    const gridCell = document.getElementById(`grid-sandSave-${currentPlayHole}`);
    if(gridCell) { gridCell.innerText = next === "" ? "-" : next; gridCell.classList.toggle('hit', next === "1"); }
    window.updatePlayModeUI(); saveLocalState();
};

window.syncPlayToState = function(field, val) {
    roundData[currentPlayHole][field] = val;
    const gridInput = document.getElementById(`grid-${field}-${currentPlayHole}`); if(gridInput) gridInput.value = val;
    if (field === 'drive') {
        let holeYards = parseInt(currentYardages[currentPlayHole]); let driveYards = parseInt(val);
        if (!isNaN(holeYards) && !isNaN(driveYards)) { let remaining = holeYards - driveYards; if (remaining > 0) { roundData[currentPlayHole]['appDist'] = remaining; let rec = getSmartClubRecommendation(remaining); if (rec) roundData[currentPlayHole]['appClub'] = rec; } }
    }
    saveLocalState(); window.updatePlayModeUI();
}

window.syncGridToState = function(idx, field, val) {
    roundData[idx][field] = val;
    if(currentPlayHole === idx) { const pInput = document.getElementById(`play-${field}`); if(pInput) pInput.value = val; }
    let strokes = 0; let parSum = 0; let endIndex = currentHoleOffset + currentHoleCount;
    for(let i=currentHoleOffset; i<endIndex; i++) { let s = parseInt(roundData[i].score); let p = parseInt(currentCoursePars[i]) || 4; if(s > 0) { strokes += s; parSum += p; } }
    let relToPar = strokes - parSum; let relStr = relToPar > 0 ? `+${relToPar}` : (relToPar === 0 ? 'E' : relToPar);
    document.getElementById('pace-score-display').innerText = `Strokes: ${strokes} (${window.getRelativeParString(strokes, parSum)})`; saveLocalState();
};

window.updatePlayModeUI = function() {
    const par = currentCoursePars[currentPlayHole]; const state = roundData[currentPlayHole]; const yds = currentYardages[currentPlayHole] || '-';
    if (state.score === "") {
        if (par == 4 || par == 5) { if (state.driveClub === "") { let dClubs = masterAnalyticsData.flatMap(r => (r.hole_scores||[]).filter(h => h.par == par && h.drive_club).map(h => h.drive_club)); state.driveClub = dClubs.length ? dClubs.sort((a,b) => dClubs.filter(v => v===a).length - dClubs.filter(v => v===b).length).pop() : "Driver"; } }
        if (par == 3) { if (state.appClub === "") { let aClubs = masterAnalyticsData.flatMap(r => (r.hole_scores||[]).filter(h => h.par == 3 && h.approach_club).map(h => h.approach_club)); state.appClub = aClubs.length ? aClubs.sort((a,b) => aClubs.filter(v => v===a).length - aClubs.filter(v => v===b).length).pop() : "Iron"; } state.fir = "hit"; const fCell = document.getElementById(`grid-fir-${currentPlayHole}`); if(fCell) fCell.innerText = "HIT"; }
    }

    document.getElementById('play-hole-title').innerText = `HOLE ${currentPlayHole + 1}`; document.getElementById('play-par-title').innerText = `PAR ${par || '-'} • ${yds} YDS`;
    document.getElementById('play-score').value = state.score; document.getElementById('play-putts').value = state.putts; document.getElementById('play-putt-dist').value = state.puttDist || ""; document.getElementById('play-drive').value = state.drive; document.getElementById('play-drive-club').value = state.driveClub || ""; document.getElementById('play-approach-club').value = state.appClub || ""; document.getElementById('play-approach-dist').value = state.appDist || "";
    
    let sBtn = document.getElementById('sand-cycle-btn');
    if (state.sandSave === "1") { sBtn.innerText = "1 STROKE (SAVE)"; sBtn.className = "adv-btn active"; sBtn.style.background = "var(--accent-green)"; sBtn.style.color = "#000"; }
    else if (state.sandSave === "2") { sBtn.innerText = "2 STROKES"; sBtn.className = "adv-btn active"; sBtn.style.background = "#ef4444"; sBtn.style.color = "#fff"; }
    else if (state.sandSave === "3+") { sBtn.innerText = "3+ STROKES"; sBtn.className = "adv-btn active"; sBtn.style.background = "#ef4444"; sBtn.style.color = "#fff"; }
    else { sBtn.innerText = "NONE"; sBtn.className = "adv-btn"; sBtn.style.background = "rgba(0,0,0,0.4)"; sBtn.style.color = "var(--text-muted)"; }

    let dropsVal = parseInt(state.drops) || 0; document.getElementById('play-drops-display').value = dropsVal;
    if (dropsVal > 0) { document.getElementById('drop-sub-menu').style.display = 'flex'; let adv = state.dropsAdv || []; ['WATER', 'OB', 'LOST', 'UNPLAYABLE'].forEach(id => { const btn = document.getElementById(`drop-${id.toLowerCase()}`); if(btn) btn.classList.toggle('active', adv.includes(id)); }); } else { document.getElementById('drop-sub-menu').style.display = 'none'; }

    ['fir', 'gir'].forEach(type => {
        let hb = document.getElementById(`${type}-hit-btn`); let mb = document.getElementById(`${type}-miss-btn`); let subMenu = document.getElementById(`${type}-sub-menu`); let advArr = state[type + 'Adv'] || [];
        if(hb) hb.classList.toggle('active', state[type] === 'hit'); if(mb) mb.classList.toggle('active', state[type] === 'miss');
        if(subMenu) { subMenu.style.display = state[type] === 'miss' ? 'flex' : 'none'; document.querySelectorAll(`#${type}-sub-menu .sub-miss`).forEach(btn => { let val = btn.id.split('-').pop().toUpperCase(); btn.classList.toggle('active', advArr.includes(val)); }); }
    });
    let dBlock = document.getElementById('play-fir-block'); if(dBlock) { document.querySelectorAll('#play-fir-block button, #play-fir-block input, #play-fir-block select').forEach(el => el.disabled = (par == 3)); dBlock.style.opacity = (par == 3) ? '0.3' : '1'; }
}

window.selectCourseFromDropdown = function(courseName) { document.getElementById('course-search-input').value = courseName.toUpperCase(); document.getElementById('search-dropdown').classList.remove('active'); window.fetchCourseDetails(); };

window.fetchCourseDetails = async function() {
    const query = document.getElementById('course-search-input').value.trim(); if(!query) return;
    const fetchBtn = document.getElementById('fetch-course-btn'); const originalText = fetchBtn.innerText;
    fetchBtn.innerText = "⏳..."; fetchBtn.disabled = true; document.getElementById('api-status').innerText = "Loading...";

    try {
        let { data: teeData, error } = await supabaseClient.from('course_tees').select('*').ilike('course_name', `%${query}%`).limit(100); 
        if (teeData) {
            let matchedCourse = teeData.find(t => t.course_name.trim().toUpperCase().includes(query.toUpperCase()) || query.toUpperCase().includes(t.course_name.trim().toUpperCase()));
            if (!matchedCourse && teeData.length > 0) matchedCourse = teeData[0];
            
            if (matchedCourse) {
                const fetchedCourseName = matchedCourse.course_name.trim();
                availableTees = teeData.filter(t => t.course_name.trim() === fetchedCourseName);
                fetchWeatherForCourse(fetchedCourseName);
                
                let parsedPars = availableTees[0].pars; if (typeof parsedPars === 'string') { try { parsedPars = JSON.parse(parsedPars.replace(/{/g, '[').replace(/}/g, ']')); } catch(e){} }
                currentCoursePars = Array.isArray(parsedPars) ? [...parsedPars] : Array(18).fill(""); 
                
                let y = availableTees[0].yardages;
                if (typeof y === 'string') { try { if (y === "null" || y === "") y = Array(18).fill(""); else y = JSON.parse(y.replace(/{/g, '[').replace(/}/g, ']')); } catch(e) { y = Array(18).fill(""); } }
                currentYardages = Array.isArray(y) && y.length > 0 ? [...y] : Array(18).fill(""); 
                
                roundData = Array.from({length: 18}, () => ({ score: "", putts: "", fir: "", firAdv: [], gir: "", girAdv: [], drive: "", driveException: "", drops: 0, dropsAdv: [], sandSave: "", puttDist: "", driveClub: "", appClub: "", appDist: "" }));
                dismissedWarnings = [];
                
                document.getElementById('current-course-display').innerText = fetchedCourseName.toUpperCase(); document.getElementById('current-course-display').style.color = 'var(--accent-green)';
                window.populateTeeDropdown(); document.getElementById('api-status').innerText = ""; window.buildGrid(); window.updatePlayModeUI(); saveLocalState(); 
                return;
            }
        }
    } catch(e) { console.error(e); } finally { fetchBtn.innerText = originalText; fetchBtn.disabled = false; }
    
    document.getElementById('current-course-display').innerText = query.toUpperCase(); document.getElementById('current-course-display').style.color = 'var(--accent-green)'; document.getElementById('api-status').innerText = "ℹ️ Course not found in database. Please enter manually.";
    currentCoursePars = Array(18).fill(""); currentYardages = Array(18).fill(""); availableTees = []; window.populateTeeDropdown(); window.buildGrid(); window.updatePlayModeUI(); saveLocalState();
};

window.populateTeeDropdown = function() {
    const select = document.getElementById('tee-select'); document.getElementById('course-setup-container').style.display = 'block';
    const colorOrder = { 'Black': 1, 'Blue': 2, 'White': 3, 'Silver': 4, 'Red': 5 };
    availableTees.sort((a, b) => {
        let yardA = 0, yardB = 0;
        try { let yaArr = typeof a.yardages === 'string' ? JSON.parse(a.yardages.replace(/{/g, '[').replace(/}/g, ']')) : a.yardages; if (Array.isArray(yaArr)) yardA = yaArr.reduce((sum, val) => sum + (parseInt(val) || 0), 0); } catch(e) {}
        try { let ybArr = typeof b.yardages === 'string' ? JSON.parse(b.yardages.replace(/{/g, '[').replace(/}/g, ']')) : b.yardages; if (Array.isArray(ybArr)) yardB = ybArr.reduce((sum, val) => sum + (parseInt(val) || 0), 0); } catch(e) {}
        if (yardA > 0 && yardB > 0 && yardA !== yardB) return yardB - yardA;
        let ca = colorOrder[a.tee_name.trim()] || 99; let cb = colorOrder[b.tee_name.trim()] || 99; return ca - cb;
    });
    select.innerHTML = '<option value="">-- Select a Tee --</option>' + availableTees.map(t => `<option value="${t.id}">${t.tee_name.trim()}</option>`).join('') + '<option value="new">+ Add New Tee Manually</option>';
    window.handleTeeChange();
};

window.handleTeeChange = function() {
    const val = document.getElementById('tee-select').value; const manualRow = document.getElementById('manual-tee-row');
    if (val === 'new') { manualRow.style.display = 'flex'; selectedTee = null; currentYardages = Array(18).fill(""); } 
    else if (val === "") { manualRow.style.display = 'none'; selectedTee = null; currentYardages = Array(18).fill(""); } 
    else { 
        manualRow.style.display = 'none'; selectedTee = availableTees.find(t => t.id == val); 
        if (selectedTee) { 
            let p = selectedTee.pars; if(typeof p === 'string') try{p=JSON.parse(p.replace(/{/g,'[').replace(/}/g,']'))}catch(e){}
            let y = selectedTee.yardages; if(typeof y === 'string') try{y=JSON.parse(y.replace(/{/g,'[').replace(/}/g,']'))}catch(e){}
            currentCoursePars = Array.isArray(p) && p.length > 0 ? [...p] : currentCoursePars; currentYardages = Array.isArray(y) && y.length > 0 ? [...y] : Array(18).fill(""); 
        } 
    }
    window.buildGrid(); window.updatePlayModeUI(); saveLocalState();
};

window.startRound = function() { document.getElementById('search-card').style.display = 'none'; window.togglePlayMode(true); };

window.setHoleCount = function(count) { 
    currentHoleCount = count; document.getElementById('btn-18-holes').classList.toggle('active', count === 18); document.getElementById('btn-9-holes').classList.toggle('active', count === 9); 
    let toggleBox = document.getElementById('front-back-toggle');
    if (count === 9) { toggleBox.style.display = 'inline-flex'; currentHoleOffset = 0; document.getElementById('btn-front-9').classList.toggle('active', currentHoleOffset === 0); document.getElementById('btn-back-9').classList.toggle('active', currentHoleOffset === 9); } 
    else { toggleBox.style.display = 'none'; currentHoleOffset = 0; }
    currentPlayHole = currentHoleOffset; window.buildGrid(); window.updatePlayModeUI(); saveLocalState(); 
};

window.setNineSide = function(side) {
    if (side === 'front') { currentHoleOffset = 0; document.getElementById('btn-front-9').classList.add('active'); document.getElementById('btn-back-9').classList.remove('active'); } 
    else { currentHoleOffset = 9; document.getElementById('btn-front-9').classList.remove('active'); document.getElementById('btn-back-9').classList.add('active'); }
    currentPlayHole = currentHoleOffset; window.buildGrid(); window.updatePlayModeUI(); saveLocalState(); 
};

window.jumpToPlayMode = function(index) { currentPlayHole = index; window.togglePlayMode(true); };

window.buildGrid = function() {
    const grid = document.getElementById('scorecard-grid'); grid.innerHTML = ''; grid.style.gridTemplateColumns = `70px repeat(${currentHoleCount}, minmax(35px, 1fr))`;
    const rows = [{ label: 'HOLE', type: 'header' }, { label: 'PAR', type: 'par' }, { label: 'YDS', type: 'yardage' }, { label: 'SCORE', type: 'score' }, { label: 'PUTTS', type: 'putts' }, { label: 'FIR', type: 'fir' }, { label: 'GIR', type: 'gir' }, { label: 'DRIVE', type: 'drive' }, { label: 'DROPS', type: 'drops' }, { label: 'SAND', type: 'sandSave' }];
    let endIndex = currentHoleOffset + currentHoleCount;
    rows.forEach(row => {
        const labelCell = document.createElement('div'); labelCell.className = 'row-label'; labelCell.innerText = row.label; grid.appendChild(labelCell);
        for (let i = currentHoleOffset; i < endIndex; i++) {
            const cell = document.createElement('div');
            if (row.type === 'header') { cell.className = 'cell hole-header'; cell.innerHTML = `<button type="button" onclick="window.jumpToPlayMode(${i})" style="width:100%;height:100%;background:transparent;border:none;color:var(--text-muted);font-weight:bold;cursor:pointer;padding:0;">${i + 1}</button>`; } 
            else if (row.type === 'par') { cell.className = 'cell'; cell.innerHTML = `<input type="number" id="par-input-${i}" inputmode="numeric" min="3" max="6" value="${currentCoursePars[i] ?? ''}" onchange="window.updatePar(${i}, this.value)">`; } 
            else if (row.type === 'yardage') { cell.className = 'cell'; cell.innerHTML = `<input type="number" inputmode="numeric" value="${currentYardages[i] ?? ''}" onchange="currentYardages[${i}] = this.value; window.updatePlayModeUI(); saveLocalState();">`; }
            else if (row.type === 'score' || row.type === 'putts' || row.type === 'drive') { cell.className = row.type === 'drive' ? 'cell drive-cell' : 'cell'; cell.id = row.type === 'drive' ? `drive-container-${i}` : ''; cell.innerHTML = `<input type="number" id="grid-${row.type}-${i}" inputmode="numeric" value="${roundData[i][row.type]}" onchange="window.syncGridToState(${i}, '${row.type}', this.value)">`; }
            else if (row.type === 'drops') { cell.className = 'cell'; let cVal = parseInt(roundData[i].drops) || 0; cell.innerHTML = `<button type="button" class="toggle-btn" style="${cVal > 0 ? 'color:#ef4444;' : ''}" id="grid-drops-${i}" onclick="window.toggleGridDrops(${i})">${cVal === 0 ? '-' : cVal}</button>`; }
            else { cell.className = 'cell'; let cVal = roundData[i][row.type]; let btnText = row.type === 'sandSave' ? (cVal === "" ? "-" : cVal) : (cVal === 'hit' ? 'HIT' : (cVal === 'miss' ? 'MISS' : '-')); cell.innerHTML = `<button type="button" class="toggle-btn ${cVal === 'hit' || cVal === '1' ? 'hit' : ''}" id="grid-${row.type}-${i}" onclick="window.toggleGridHit(${i}, '${row.type}')">${btnText}</button>`; }
            grid.appendChild(cell);
        }
    });
    window.updateDriveDistances();
};

window.toggleGridDrops = function(index) { 
    let cVal = parseInt(roundData[index].drops) || 0; let newVal = cVal >= 10 ? 0 : cVal + 1; roundData[index].drops = newVal; 
    if (newVal === 0) roundData[index].dropsAdv = [];
    const btn = document.getElementById(`grid-drops-${index}`); if(btn) { btn.innerText = newVal === 0 ? "-" : newVal; btn.style.color = newVal > 0 ? "#ef4444" : "var(--text-muted)"; } 
    if(currentPlayHole === index) window.updatePlayModeUI(); saveLocalState(); 
};

window.toggleGridHit = function(index, type) { 
    const btn = document.getElementById(`grid-${type}-${index}`); let ns = "";
    if (type === 'sandSave') { let cur = btn.innerText; ns = cur === "-" ? "1" : (cur === "1" ? "2" : (cur === "2" ? "3+" : "")); btn.innerText = ns === "" ? "-" : ns; } 
    else { ns = btn.innerText === "MISS" ? "hit" : "miss"; btn.innerText = ns === "" ? "-" : ns.toUpperCase(); }
    if(ns === 'hit' || ns === '1') btn.classList.add('hit'); else btn.classList.remove('hit'); 
    roundData[index][type] = ns === "-" ? "" : ns; if(currentPlayHole === index) window.updatePlayModeUI(); saveLocalState(); 
};

window.togglePlayMode = function(isPlayMode) { 
    document.getElementById('btn-play-mode').className = isPlayMode ? 'view-toggle-btn primary' : 'view-toggle-btn'; 
    document.getElementById('btn-grid-mode').className = !isPlayMode ? 'view-toggle-btn primary' : 'view-toggle-btn'; 
    document.getElementById('grid-mode-container').style.display = isPlayMode ? 'none' : 'block'; 
    document.getElementById('play-mode-container').style.display = isPlayMode ? 'flex' : 'none'; 
    if(isPlayMode) window.updatePlayModeUI(); 
};

window.changePlayHole = function(dir) { let endIndex = currentHoleOffset + currentHoleCount; currentPlayHole = Math.max(currentHoleOffset, Math.min((endIndex - 1), currentPlayHole + dir)); window.updatePlayModeUI(); };
window.updatePar = function(index, val) { let p = parseInt(val); currentCoursePars[index] = isNaN(p) ? "" : Math.max(3, Math.min(6, p)); document.getElementById(`par-input-${index}`).value = currentCoursePars[index]; window.updateDriveDistances(); if(currentPlayHole === index) window.updatePlayModeUI(); saveLocalState(); };
window.updateDriveDistances = function() { for (let i = 0; i < 18; i++) { const input = document.getElementById(`grid-drive-${i}`); const container = document.getElementById(`drive-container-${i}`); if(input && container) { if (currentCoursePars[i] === 3) { input.value = ""; input.disabled = true; input.placeholder = "N/A"; container.classList.add("disabled"); } else { input.disabled = false; input.placeholder = "yds"; container.classList.remove("disabled"); } } } };

window.attemptSubmitRound = function() {
    let endIndex = currentHoleOffset + currentHoleCount; let missingHoles = [];
    for (let i = currentHoleOffset; i < endIndex; i++) { if (roundData[i].score === "") missingHoles.push(i + 1); }
    if (missingHoles.length > 0 && missingHoles.length < currentHoleCount) {
        let mBox = document.getElementById('incomplete-holes-list'); mBox.innerHTML = missingHoles.map(h => `<button type="button" class="adv-btn" style="background:#b45309; color:#fff; border-color:#b45309; padding: 10px; font-size: 14px; min-width: 80px;" onclick="document.getElementById('incomplete-modal').style.display='none'; window.jumpToPlayMode(${h-1});">Hole ${h}</button>`).join('');
        document.getElementById('incomplete-modal').style.display = 'flex';
    } else { window.forceSubmitRound(); }
};

window.forceSubmitRound = async function() {
    document.getElementById('incomplete-modal').style.display='none';
    if (!currentUser) { if (confirm("Guest Round Complete!\n\nSince you are not logged in, this scorecard cannot be saved to the permanent History dashboard.\n\nClear your local scorecard to start a new round?")) { localStorage.removeItem('golf_round_state'); location.reload(); } return; }
    const courseName = document.getElementById('current-course-display').innerText.trim();
    if (!courseName || courseName === 'NO COURSE SELECTED' || courseName === 'MANUAL SCORECARD (SEARCH TO FETCH)') return alert("⚠️ Please fetch a valid course.");
    
    const teeVal = document.getElementById('tee-select').value; let teeName = null; let rType = document.getElementById('round-type-select').value;
    if (teeVal === 'new') { teeName = document.getElementById('setup-tee').value.trim(); if (teeName) { try { await supabaseClient.from('course_tees').insert([{ course_name: courseName, tee_name: teeName, pars: currentCoursePars, yardages: currentYardages }]); } catch(e) {} } } else if (selectedTee) { teeName = selectedTee.tee_name.trim(); }

    let finalTeeName = teeName + (rType !== 'Regular' ? ' [' + rType + ']' : '');
    let totalScore = 0; let totalPutts = 0; const holesPayload = []; let missingCheck = []; let endIndex = currentHoleOffset + currentHoleCount;

    for (let i = currentHoleOffset; i < endIndex; i++) {
        const s = parseInt(roundData[i].score); let p = parseInt(currentCoursePars[i]) || 4;
        if (!isNaN(s)) {
            totalScore += s; totalPutts += parseInt(roundData[i].putts) || 0;
            if (roundData[i].putts === "" || roundData[i].gir === "" || (p > 3 && roundData[i].fir === "") || (p > 3 && roundData[i].drive === "" && (!roundData[i].driveException || roundData[i].driveException === ""))) { missingCheck.push(i+1); }

            holesPayload.push({ 
                user_id: currentUser.id, hole_number: i + 1, par: parseInt(currentCoursePars[i]) || null, score: s, putts: parseInt(roundData[i].putts) || 0, 
                fir: roundData[i].fir || null, fir_adv: (roundData[i].firAdv || []).join(','), gir: roundData[i].gir || null, gir_adv: (roundData[i].girAdv || []).join(','),
                drive_distance: parseInt(roundData[i].drive) || null, drive_exception: roundData[i].driveException || null, drops: parseInt(roundData[i].drops) || 0, drops_adv: (roundData[i].dropsAdv || []).join(','),
                sand_save: roundData[i].sandSave || null, drive_club: roundData[i].driveClub || null, approach_club: roundData[i].appClub || null, approach_yd: parseInt(roundData[i].appDist) || null, putt_1_ft: parseInt(roundData[i].puttDist) || null
            });
        }
    }
    
    if(holesPayload.length === 0) return alert("⚠️ No scores entered.");
    if (missingCheck.length > 0) { if(!confirm(`⚠️ You are missing some stats (Putts/FIR/GIR/Drive) on the following holes:\n\nHole(s): ${missingCheck.join(', ')}\n\nSubmit scorecard anyway?`)) return; }

    const submitBtn = document.getElementById('submit-round-btn'); const originalBtnText = submitBtn.innerText;
    if(submitBtn) { submitBtn.innerText = "⏳ SAVING..."; submitBtn.disabled = true; }

    try {
        const { data: roundHeader, error: headerError } = await supabaseClient.from('logged_rounds').insert([{ user_id: currentUser.id, course_name: courseName, total_score: totalScore, total_putts: totalPutts, tee_name: finalTeeName, weather_temp: roundWeather.temp, weather_wind: roundWeather.wind }]).select('id').single();
        if (headerError) throw headerError;
        await supabaseClient.from('hole_scores').insert(holesPayload.map(h => ({ ...h, round_id: roundHeader.id })));
        alert("✅ Round logged!"); localStorage.removeItem('golf_round_state'); window.fetchCourseDetails(); 
    } catch(e) { 
        console.error(e); 
        const queueStr = localStorage.getItem('golf_offline_queue'); let queue = queueStr ? JSON.parse(queueStr) : [];
        queue.push({ header: { user_id: currentUser.id, course_name: courseName, total_score: totalScore, total_putts: totalPutts, tee_name: finalTeeName, weather_temp: roundWeather.temp, weather_wind: roundWeather.wind }, holes: holesPayload });
        localStorage.setItem('golf_offline_queue', JSON.stringify(queue));
        alert("📶 Network Offline.\n\nRound saved to your local device. It will automatically upload to the cloud the next time you open the app online.");
        localStorage.removeItem('golf_round_state'); location.reload();
    } finally { if(submitBtn){ submitBtn.innerText = originalBtnText; submitBtn.disabled = false; } }
};

window.fetchHistory = function() {
    if(!currentUser) return;
    supabaseClient.from('logged_rounds').select('*, hole_scores(*)').eq('user_id', currentUser.id).order('date_played', { ascending: false }).then(({data}) => {
        if(!data || data.length === 0) { document.getElementById('history-list').innerHTML = '<div class="empty-state">No arrays found.</div>'; return; }
        const activeTabBtn = document.querySelector('#view-history .analytics-tabs button.active');
        const filterType = activeTabBtn ? (activeTabBtn.innerText.includes('Range') ? 'RANGE' : (activeTabBtn.innerText.includes('Sim') ? 'SIM' : 'REAL')) : 'REAL';
        window.renderHistoryList(data, filterType);
    });
};

window.filterHistoryList = function(type, btn) {
    document.querySelectorAll('#view-history .analytics-tabs button').forEach(el => el.classList.remove('active')); btn.classList.add('active');
    supabaseClient.from('logged_rounds').select('*, hole_scores(*)').eq('user_id', currentUser.id).order('date_played', { ascending: false }).then(({data}) => { if(data) window.renderHistoryList(data, type); });
};

window.renderHistoryList = function(allData, type) {
    let data = allData.filter(r => { let tName = r.tee_name || ""; if (type === 'RANGE') return tName.includes('[RANGE]'); if (type === 'SIM') return tName.includes('[SIM]'); return !tName.includes('[RANGE]') && !tName.includes('[SIM]'); });
    const tbody = document.getElementById('history-list'); if(data.length === 0) { tbody.innerHTML = '<div class="empty-state">No saved records here.</div>'; return; }
    let html = "";
    const grouped = data.reduce((acc, round) => { const year = new Date(round.date_played).getUTCFullYear(); if(!acc[year]) acc[year] = []; acc[year].push(round); return acc; }, {});
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
    document.getElementById('modal-course-title').innerText = name; document.getElementById('modal-total-score').innerText = score; 
    document.getElementById('modal-weather').innerText = temp ? `⛅ ${temp}` : ''; document.getElementById('modal-wind-dir').innerText = wind ? `💨 ${wind}` : '';
    document.getElementById('modal-course-date').innerText = date;
    activeModalRoundId = id; 
    document.getElementById('history-modal').style.display = 'flex'; 
    document.getElementById('modal-scorecard-grid').innerHTML = '⏳ Loading...';
    if (holesPlayed === 0) { document.getElementById('modal-scorecard-grid').innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-muted);">Bulk imported rounds do not contain hole-by-hole data.</div>'; return; }
    
    const { data } = await supabaseClient.from('hole_scores').select('*').eq('round_id', id).order('hole_number', { ascending: true });
    let startHole = 0, endHole = 18;
    if(data && data.length > 0 && data.length < 18) { let firstHole = data[0].hole_number; if(firstHole > 9) { startHole = 9; endHole = 18; } else { startHole = 0; endHole = 9; } }
    let viewHoles = endHole - startHole;
    
    modalCoursePars = Array(viewHoles).fill(""); modalRoundData = Array.from({length: viewHoles}, () => ({ id: null, score: "", putts: "", fir: "", gir: "", drive: "", drops: 0, sandSave: "" }));
    if(data) data.forEach(h => { 
        const i = h.hole_number - 1 - startHole; 
        if(i>=0 && i<viewHoles){ 
            modalCoursePars[i]=h.par||""; 
            modalRoundData[i]={id:h.id,score:h.score||"",putts:h.putts!==null?h.putts:"",fir:h.fir||"",firAdv:h.fir_adv?h.fir_adv.split(','):[],gir:h.gir||"",girAdv:h.gir_adv?h.gir_adv.split(','):[],drive:h.drive_distance||"",drops:h.drops||0,dropsAdv:h.drops_adv?h.drops_adv.split(','):[],sandSave:h.sand_save||""}; 
        }
    });
    window.buildModalGrid(viewHoles, startHole);
};

window.buildModalGrid = function(holesCount, startOffset) {
    const grid = document.getElementById('modal-scorecard-grid'); grid.innerHTML = ''; grid.style.gridTemplateColumns = `70px repeat(${holesCount}, minmax(35px, 1fr))`;
    const rows = [{ label: 'HOLE', type: 'header' }, { label: 'PAR', type: 'par' }, { label: 'SCORE', type: 'score' }, { label: 'PUTTS', type: 'putts' }, { label: 'FIR', type: 'fir' }, { label: 'GIR', type: 'gir' }, { label: 'DRIVE', type: 'drive' }, { label: 'DROPS', type: 'drops' }, { label: 'SAND', type: 'sandSave' }];
    rows.forEach(r => {
        const lc = document.createElement('div'); lc.className = 'row-label'; lc.innerText = r.label; grid.appendChild(lc);
        for(let i=0; i<holesCount; i++) {
            const c = document.createElement('div'); c.className = 'cell';
            if(r.type === 'header') { c.className = 'cell hole-header'; c.innerText = i+1+startOffset; }
            else if(r.type === 'par') c.innerHTML = `<input type="number" value="${modalCoursePars[i]}" onchange="modalCoursePars[${i}] = this.value">`;
            else if(['score','putts','drive'].includes(r.type)) c.innerHTML = `<input type="number" value="${modalRoundData[i][r.type]}" onchange="modalRoundData[${i}]['${r.type}'] = this.value">`;
            else if(r.type === 'drops') { let cVal = parseInt(modalRoundData[i].drops) || 0; c.innerHTML = `<button type="button" class="toggle-btn" style="${cVal > 0 ? 'color:#ef4444;' : ''}" onclick="window.toggleModalDrops(this, ${i})">${cVal === 0 ? '-' : cVal}</button>`; }
            else { let v = modalRoundData[i][r.type]; let t = r.type==='sandSave'?(v==='yes'?'SAVE':(v==='no'?'MISS':(v==='stuck'?'STUCK':'-'))):(v==='hit'?'HIT':(v==='miss'?'MISS':'-')); let hc = (v==='hit'||v==='yes'||v==='1')?'hit':''; c.innerHTML = `<button type="button" class="toggle-btn ${hc}" onclick="window.toggleModalHit(this, ${i}, '${r.type}')">${t}</button>`; }
            grid.appendChild(c);
        }
    });
    document.getElementById('modal-delete-btn').onclick = () => window.deleteActiveRound(activeModalRoundId); document.getElementById('modal-save-btn').onclick = () => window.saveModalChanges(activeModalRoundId, holesCount);
};

window.toggleModalDrops = function(btn, i) { let cVal = parseInt(modalRoundData[i].drops) || 0; let newVal = cVal >= 4 ? 0 : cVal + 1; modalRoundData[i].drops = newVal; btn.innerText = newVal === 0 ? "-" : newVal; btn.style.color = newVal > 0 ? "#ef4444" : "var(--text-muted)"; };
window.toggleModalHit = function(b, i, t) { let ns = t==='sandSave'?(b.innerText==="MISS"?"": (b.innerText==="SAVE"?"no":"yes")):(b.innerText==="MISS"?"hit":"miss"); b.innerText=ns==="-"?"-":(ns==='yes'?'SAVE':(ns==='no'?'MISS':ns.toUpperCase())); if(ns==='hit'||ns==='yes')b.classList.add('hit'); else b.classList.remove('hit'); modalRoundData[i][t] = ns==="-"?"":ns; };
window.closeHistoryModal = function() { document.getElementById('history-modal').style.display = 'none'; activeModalRoundId = null; };

window.saveModalChanges = async function(id, holesCount) {
    if(!id) return; let tScore=0; let tPutts=0; const saveBtn = document.getElementById('modal-save-btn'); const originalText = saveBtn.innerText; saveBtn.innerText = "⏳ Saving..."; saveBtn.disabled = true;
    try {
        for(let i=0; i<holesCount; i++) { const hd=modalRoundData[i]; const s=parseInt(hd.score); if(!isNaN(s))tScore+=s; if(!isNaN(parseInt(hd.putts)))tPutts+=parseInt(hd.putts);
            if(hd.id) await supabaseClient.from('hole_scores').update({ par:parseInt(modalCoursePars[i])||null, score:s||null, putts:parseInt(hd.putts)||0, fir:hd.fir||null, gir:hd.gir||null, drive_distance:parseInt(hd.drive)||null, drops:parseInt(hd.drops)||0, sand_save:hd.sandSave||null }).eq('id',hd.id);
        }
        await supabaseClient.from('logged_rounds').update({ total_score: tScore, total_putts: tPutts }).eq('id',id); 
        alert("✅ Updated."); window.fetchHistory(); window.closeHistoryModal(); window.loadAnalyticsData();
    } catch(e) { console.error(e); alert("❌ Error saving changes."); } finally { saveBtn.innerText = originalText; saveBtn.disabled = false; }
};

window.deleteActiveRound = async function(id) { if(id && confirm("Delete round?")) { await supabaseClient.from('logged_rounds').delete().eq('id', id); alert("🗑️ Deleted."); window.fetchHistory(); window.closeHistoryModal(); window.loadAnalyticsData(); } };

// ----------------------------------------------------
// ANALYTICS & MATH GLOBAL DECLARATIONS
// ----------------------------------------------------
window.getRelativeParString = function(score, par) { if(par === 0 || score === 0) return ""; let diff = score - par; return diff > 0 ? `(+${diff})` : (diff === 0 ? `(E)` : `(${diff})`); };

window.calculateHandicap = function(allRounds) {
    const hcpRounds = allRounds.filter(r => r.course_rating && r.slope_rating && !(r.tee_name && r.tee_name.includes('[SIM]')) && !(r.tee_name && r.tee_name.includes('[RANGE]'))).slice(0, 20);
    const n = hcpRounds.length; if (n < 3) return "--.-";
    let diffs = hcpRounds.map(r => ((r.total_score - r.course_rating) * 113 / r.slope_rating)).sort((a,b) => a-b);
    let countToUse = 1, adj = 0;
    if (n === 3) { countToUse = 1; adj = -2.0; } else if (n === 4) { countToUse = 1; adj = -1.0; } else if (n === 5) { countToUse = 1; adj = 0; } else if (n === 6) { countToUse = 2; adj = -1.0; } else if (n >= 7 && n <= 8) { countToUse = 2; adj = 0; } else if (n >= 9 && n <= 11) { countToUse = 3; adj = 0; } else if (n >= 12 && n <= 14) { countToUse = 4; adj = 0; } else if (n >= 15 && n <= 16) { countToUse = 5; adj = 0; } else if (n >= 17 && n <= 18) { countToUse = 6; adj = 0; } else if (n === 19) { countToUse = 7; adj = 0; } else if (n === 20) { countToUse = 8; adj = 0; }
    const avg = (diffs.slice(0, countToUse).reduce((a,b) => a+b, 0) / countToUse) + adj; return Math.max(0, (Math.round(avg * 10) / 10)).toFixed(1);
};

window.calculateHcpHistory = function(rounds) {
    let chrono = [...rounds].reverse(); let history = [];
    for (let i = 0; i < chrono.length; i++) { let windowRounds = chrono.slice(Math.max(0, i - 19), i + 1).reverse(); history.push({ date: chrono[i].date_played, hcp: window.calculateHandicap(windowRounds) }); } return history;
};

// ----------------------------------------------------
// SELF-HEALING ARRAYS PROCESSING FILTER (FOOLPROOF ENGINE)
// ----------------------------------------------------
window.updateAnalytics = function() {
    try {
        let actCrs = Array.from(document.querySelectorAll('.course-cb:checked')).map(cb => cb.value.replace(/&quot;/g, '"').replace(/&#39;/g, "'"));
        let actYrs = Array.from(document.querySelectorAll('.year-cb:checked')).map(cb => cb.value);
        let actMonths = Array.from(document.querySelectorAll('.month-cb:checked')).map(cb => cb.value);
        let actPars = Array.from(document.querySelectorAll('.par-cb:checked')).map(cb => cb.value);
        let actHoles = Array.from(document.querySelectorAll('.hole-cb:checked')).map(cb => cb.value);

        if(actCrs.length === 0) actCrs = [...new Set(masterAnalyticsData.map(r => (r.course_name || "").trim()))];
        if(actYrs.length === 0) actYrs = [...new Set(masterAnalyticsData.map(r => r.date_played ? new Date(r.date_played).getUTCFullYear().toString() : new Date().getUTCFullYear().toString()))];
        if(actMonths.length === 0) actMonths = ["1","2","3","4","5","6","7","8","9","10","11","12"];
        if(actPars.length === 0) actPars = ["3","4","5","6"];
        if(actHoles.length === 0) { actHoles = []; for(let i=1; i<=18; i++) actHoles.push(i.toString()); }

        const timeframe = document.getElementById('filter-timeframe') ? document.getElementById('filter-timeframe').value : 'season'; 
        const holeFilter = document.getElementById('filter-hole-count') ? document.getElementById('filter-hole-count').value : 'all'; 
        
        let fRounds = masterAnalyticsData.filter(r => { 
            if (!actCrs.includes((r.course_name || "").trim())) return false; 
            const d = r.date_played ? new Date(r.date_played) : new Date(); 
            if (timeframe === 'season' && d.getUTCFullYear().toString() !== new Date().getUTCFullYear().toString()) return false;
            if (timeframe !== 'season' && timeframe !== 'full' && !actYrs.includes(d.getUTCFullYear().toString())) return false; 
            if(r.hole_scores && r.hole_scores.length > 0) {
                const playedHoles = r.hole_scores.filter(h => h.score && h.score > 0).length; 
                if (holeFilter === '18' && playedHoles < 18) return false;
                if (holeFilter === '9' && (playedHoles < 9 || playedHoles >= 18)) return false; 
            }
            return true; 
        });
        
        currentFilteredRounds = fRounds;
        const t = document.getElementById('analytics-data-table');
        if(fRounds.length === 0) { 
            if(t) t.innerHTML = `<tbody><tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-muted);">No logs match selected filters.</td></tr></tbody>`; 
            window.renderCharts([], [], []);
            document.getElementById('ai-insights-box').innerHTML = "Not enough data.";
            document.getElementById('hcp-display').innerText = "--.-";
            document.getElementById('trophy-room-box').innerHTML = "";
            return; 
        }

        if (timeframe.startsWith('last')) fRounds = fRounds.slice(0, parseInt(timeframe.replace('last', '')));
        
        let hcDisplay = document.getElementById('hcp-display');
        if (hcDisplay) hcDisplay.innerText = window.calculateHandicap(fRounds); 
        
        window.renderCharts(fRounds, actHoles, actPars); 
        if(typeof window.generateInsights === 'function') document.getElementById('ai-insights-box').innerHTML = window.generateInsights(fRounds);
        window.updateTrophyRoom(fRounds);
        
        let s = { hio:0, alb:0, egl:0, brd:0, par:0, bog:0, dbl:0, tpl:0, qd:0, putts:0, pHP:0, drp:0, fH:0, fT:0, gH:0, gT:0, ssH:0, ssT:0 }; let totalStrokes = 0; let totalHolesCount = 0;
        fRounds.forEach(r => { 
            let th = r.hole_scores || []; 
            th.forEach(h => { 
                if (!h.score) return; totalStrokes += h.score; totalHolesCount++; 
                if (h.par) {
                    const d = h.score - h.par; 
                    if(d===-1) s.brd++; else if(d===0) s.par++; else if(d===1) s.bog++;
                }
                if(h.putts !== null && h.putts !== "") { s.putts+=h.putts; s.pHP++; } if(h.drops) s.drp+=h.drops; 
                if(h.fir=='hit'||h.fir=='miss') { s.fT++; if(h.fir=='hit') s.fH++; } if(h.gir=='hit'||h.gir=='miss') { s.gT++; if(h.gir=='hit') s.gH++; } 
                if(h.sand_save==='1'||h.sand_save==='yes') { s.ssT++; s.ssH++; } else if(h.sand_save==='2'||h.sand_save==='3+') { s.ssT++; }
            }) 
        });
        
        const cA = (tot) => ((tot / totalHolesCount) * 18).toFixed(1); const cP = (tot) => ((tot / totalHolesCount) * 100).toFixed(1) + '%';
        if(t) {
            t.innerHTML = `<thead><tr><th>Metric</th><th>Total</th><th>Avg / 18</th><th>Hole %</th></tr></thead><tbody>
                <tr style="background:rgba(0,0,0,0.2); color:var(--accent-green);"><td colspan="4" style="text-align:left; font-size:12px;">SCORING</td></tr>
                <tr onclick="window.openStatGraph('Hole Score', 'score')"><td>Total Score</td><td>${totalStrokes}</td><td>${cA(totalStrokes)}</td><td>-</td></tr>
                <tr onclick="window.openStatGraph('Birdie', 'birdies')"><td>Birdie</td><td>${s.brd}</td><td>${cA(s.brd)}</td><td>${cP(s.brd)}</td></tr>
                <tr onclick="window.openStatGraph('Par', 'pars')"><td>Par</td><td>${s.par}</td><td>${cA(s.par)}</td><td>${cP(s.par)}</td></tr>
                <tr onclick="window.openStatGraph('Bogey', 'bogeys')"><td>Bogey</td><td>${s.bog}</td><td>${cA(s.bog)}</td><td>${cP(s.bog)}</td></tr>
                <tr style="background:rgba(0,0,0,0.2); color:var(--accent-green); border-top: 2px solid var(--border-color);"><td colspan="4" style="text-align:left; font-size:12px;">EXECUTION</td></tr>
                <tr onclick="window.openStatGraph('Putts', 'putts')"><td>Putts</td><td>${s.putts}</td><td>${s.pHP > 0 ? ((s.putts / s.pHP) * 18).toFixed(1) : '0.0'}</td><td>-</td></tr>
                <tr onclick="window.openStatGraph('FIR %', 'fir')"><td>FIR</td><td>${s.fH} / ${s.fT}</td><td>-</td><td>${s.fT > 0 ? ((s.fH / s.fT) * 100).toFixed(1) + '%' : '0.0%'}</td></tr>
                <tr onclick="window.openStatGraph('GIR %', 'gir')"><td>GIR</td><td>${s.gH} / ${s.gT}</td><td>-</td><td>${s.gT > 0 ? ((s.gH / s.gT) * 100).toFixed(1) + '%' : '0.0%'}</td></tr>
                <tr onclick="window.openStatGraph('Drops', 'drops')"><td>Drops (Penalty)</td><td>${s.drp}</td><td>${cA(s.drp)}</td><td>-</td></tr>
            </tbody>`;
        }
    } catch(err) {
        console.error("Analytics Crash Detected: ", err);
        const t = document.getElementById('analytics-data-table');
        if(t) t.innerHTML = `<tbody><tr><td colspan="4" style="color:#ef4444; padding:20px; text-align:center;">❌ Analytics Sync Error: ${err.message}</td></tr></tbody>`;
    }
};

window.loadAnalyticsData = async function() {
    if(!currentUser) { document.getElementById('analytics-data-table').innerHTML = '<tbody><tr><td colspan="4" style="text-align:center; padding: 20px; color: var(--text-muted);">Please log in to view Analytics.</td></tr></tbody>'; return; }
    let savedTime = localStorage.getItem('golf_filter_timeframe'); if(savedTime) document.getElementById('filter-timeframe').value = savedTime;
    let savedHole = localStorage.getItem('golf_filter_hole_count'); if(savedHole) document.getElementById('filter-hole-count').value = savedHole;
    const table = document.getElementById('analytics-data-table'); table.innerHTML = '<tbody><tr><td colspan="4" style="text-align:center; padding: 20px; color: var(--text-muted);">⏳ Crunching...</td></tr></tbody>';
    try {
        const { data, error } = await supabaseClient.from('logged_rounds').select('*, hole_scores(*)').eq('user_id', currentUser.id).order('date_played', { ascending: false });
        if(error) throw error; masterAnalyticsData = data || []; window.populateFilters(); window.forceSyncFilters(); window.updateAnalytics(); 
    } catch(err) { table.innerHTML = `<tbody><tr><td colspan="4" style="text-align:center;color:#ef4444; padding: 20px;">❌ Dev Error: ${err.message}</td></tr></tbody>`; }
};

window.populateFilters = function() {
    const uC = [...new Set(masterAnalyticsData.map(r => (r.course_name || "").trim()))].sort();
    document.getElementById('course-checkbox-list').innerHTML = `<label class="checkbox-container"><input type="checkbox" id="cb-all-courses" autocomplete="off" checked onchange="window.checkGroupToggles('.course-cb', 'cb-all-courses', 'course-btn-text', 'Course')"> <strong>All Courses</strong></label><hr style="width: 100%; border: 0; border-top: 1px solid var(--border-color); margin: 5px 0;">` + uC.map(c => `<label class="checkbox-container"><input type="checkbox" class="course-cb" value="${c.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}" autocomplete="off" checked onchange="window.checkGroupToggles('.course-cb', 'cb-all-courses', 'course-btn-text', 'Course')"> ${c}</label>`).join('');
    const uY = [...new Set(masterAnalyticsData.map(r => r.date_played ? new Date(r.date_played).getUTCFullYear().toString() : new Date().getUTCFullYear().toString()))].sort((a,b)=>b-a);
    document.getElementById('year-checkbox-list').innerHTML = `<label class="checkbox-container"><input type="checkbox" id="cb-all-years" autocomplete="off" checked onchange="window.checkGroupToggles('.year-cb', 'cb-all-years', 'year-btn-text', 'Year')"> <strong>All Years</strong></label><hr style="width: 100%; border: 0; border-top: 1px solid var(--border-color); margin: 5px 0;">` + uY.map(y => `<label class="checkbox-container"><input type="checkbox" class="year-cb" value="${y}" autocomplete="off" checked onchange="window.checkGroupToggles('.year-cb', 'cb-all-years', 'year-btn-text', 'Year')"> ${y}</label>`).join('');
};

document.addEventListener('click', function(e) { if (!e.target.closest('.multi-select-container') && !e.target.closest('summary')) { document.querySelectorAll('.multi-select-dropdown').forEach(d => d.style.display = 'none'); } });

window.toggleGroupToggles = function(mainCb, childClass, btnTextId, defaultText) { document.querySelectorAll(childClass).forEach(b => b.checked = mainCb.checked); window.updateAnalytics(); };
window.checkGroupToggles = function(childClass, mainId, btnTextId, defaultText) { const cbs = Array.from(document.querySelectorAll(childClass)); const allChecked = cbs.every(b => b.checked); const checkedCount = cbs.filter(b => b.checked).length; document.getElementById(mainId).checked = allChecked; document.getElementById(btnTextId).innerText = allChecked ? `All ${defaultText}s` : (checkedCount === 1 ? `1 ${defaultText}` : `${checkedCount} ${defaultText}s`); window.updateAnalytics(); };
window.toggleFilterDropdown = function(id) { const el = document.getElementById(id); el.style.display = el.style.display === 'flex' ? 'none' : 'flex'; };

window.forceSyncFilters = function() {
    document.querySelectorAll('.multi-select-dropdown input[type="checkbox"]').forEach(cb => { cb.checked = true; });
    document.getElementById('month-btn-text').innerText = 'All Months'; document.getElementById('year-btn-text').innerText = 'All Years';
    document.getElementById('course-btn-text').innerText = 'All Courses'; document.getElementById('par-btn-text').innerText = 'All Pars'; document.getElementById('hole-btn-text').innerText = 'All Holes';
};

window.renderCharts = function(filteredRounds, actHoles, actPars) {
    const tCtx = document.getElementById('scoringTrendChart'); const cCtx = document.getElementById('clubChart'); const wCtx = document.getElementById('weatherScoreChart'); const pC = document.getElementById('scoringPieChart'); const pCtx = document.getElementById('penaltyPieChart'); const aCtx = document.getElementById('accuracyChart'); const psCtx = document.getElementById('parScoringChart');
    if (trendChart) trendChart.destroy(); if (clubChart) clubChart.destroy(); if (weatherChart) weatherChart.destroy(); if (scorePieChart) scorePieChart.destroy(); if(penaltyPieChartObj) penaltyPieChartObj.destroy(); if (accuracyChart) accuracyChart.destroy(); if(parScoringChart) parScoringChart.destroy();
    
    if (filteredRounds.length === 0) return;
    const chartData = [...filteredRounds].reverse(); const activeOverlay = document.getElementById('primary-chart-metric') ? document.getElementById('primary-chart-metric').value : 'none'; let baseScores = [];
    
    chartData.forEach(r => { 
        let targetHoles = r.hole_scores || []; 
        if (actHoles.length < 18) targetHoles = targetHoles.filter(h => actHoles.includes(h.hole_number.toString())); 
        if (actPars.length < 4) targetHoles = targetHoles.filter(h => actPars.includes(h.par.toString())); 
        let rs = 0; if (targetHoles.length === 0 && (!r.hole_scores || r.hole_scores.length === 0)) rs = r.total_score; else rs = targetHoles.reduce((sum, h) => sum + (h.score || 0), 0);
        baseScores.push(rs); 
    });
    
    let trendDatasets = [{ label: actHoles.length < 18 ? 'Filtered Holes Score' : 'Total Score', data: baseScores, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderWidth: 2, pointBackgroundColor: '#121212', pointBorderColor: '#10b981', fill: true, yAxisID: 'y', tension: 0.3 }];
    const oColors = { hcp: '#f59e0b', putts: '#3b82f6', driveDist: '#8b5cf6', fir: '#8b5cf6', gir: '#d946ef', scram: '#10b981', sand: '#eab308', drops: '#ef4444', p3: '#f43f5e', p4: '#14b8a6', p5: '#eab308', sg: '#38bdf8', birdies: '#10b981', pars: '#9ca3af', bogeys: '#ef4444', tpAvoid: '#2dd4bf', acc: '#a855f7', f9: '#facc15', b9: '#fb923c' };

    if (activeOverlay === 'hcp') {
        let hcpHist = window.calculateHcpHistory(filteredRounds); let hcpData = [...hcpHist].reverse().map(h => h.hcp === "--.-" ? null : parseFloat(h.hcp));
        trendDatasets.push({ label: 'Handicap Index', data: hcpData, borderColor: '#f59e0b', backgroundColor: 'transparent', borderWidth: 2, pointBackgroundColor: '#121212', pointBorderColor: '#f59e0b', yAxisID: 'y1', tension: 0.3 });
    } else if (activeOverlay !== 'none') {
        let oData = [];
        chartData.forEach(r => {
            let p=0, fH=0, fT=0, gH=0, gT=0, dr=0, p3=0, p3c=0, p4=0, p4c=0, p5=0, p5c=0, sgTot=0, sgCnt=0, ssH=0, ssT=0, brd=0, pr=0, bog=0, dTot=0, dCnt=0, f9=0, b9=0, tpA_H=0, tpA_T=0;
            let th = r.hole_scores || []; 
            if (actHoles.length < 18) th = th.filter(h => actHoles.includes(h.hole_number.toString())); 
            if (actPars.length < 4) th = th.filter(h => actPars.includes(h.par.toString()));
            th.forEach(h => {
                if(h.hole_number <= 9) f9 += h.score; else b9 += h.score;
                if(h.putts !== null && h.putts !== "") { p+=h.putts; tpA_T++; if(h.putts < 3) tpA_H++; if(h.putt_1_ft > 0) { sgTot += (window.getExpectedPutts(h.putt_1_ft) - h.putts); sgCnt++; } }
                if(h.drops) dr+=h.drops; if(h.fir==='hit'||h.fir==='miss') { fT++; if(h.fir==='hit') fH++; } if(h.gir==='hit'||h.gir==='miss') { gT++; if(h.gir==='hit') gH++; }
                if(h.sand_save==='yes'||h.sand_save==='1') { ssT++; ssH++; } else if(h.sand_save==='no' || h.sand_save==='2' || h.sand_save==='3+') { ssT++; }
                if(h.score && h.par) { let d=h.score-h.par; if(h.par===3){p3+=d; p3c++;} if(h.par===4){p4+=d; p4c++;} if(h.par===5){p5+=d; p5c++;} if(d===-1) brd++; if(d===0) pr++; if(d===1) bog++; }
                if(h.drive_distance>0) { dTot+=h.drive_distance; dCnt++; }
            });
            if(activeOverlay === 'putts') oData.push(p); if(activeOverlay === 'drops') oData.push(dr); if(activeOverlay === 'fir') oData.push(fT>0?Math.round((fH/fT)*100):null); if(activeOverlay === 'gir') oData.push(gT>0?Math.round((gH/gT)*100):null);
            if(activeOverlay === 'driveDist') oData.push(dCnt>0?Math.round(dTot/dCnt):null); if(activeOverlay === 'sand') oData.push(ssT>0?Math.round((ssH/ssT)*100):null); if(activeOverlay === 'birdies') oData.push(brd); if(activeOverlay === 'pars') oData.push(pr); if(activeOverlay === 'bogeys') oData.push(bog);
            if(activeOverlay === 'p3') oData.push(p3c>0 ? (p3/p3c).toFixed(2) : null); if(activeOverlay === 'p4') oData.push(p4c>0 ? (p4/p4c).toFixed(2) : null); if(activeOverlay === 'p5') oData.push(p5c>0 ? (p5/p5c).toFixed(2) : null);
            if(activeOverlay === 'sg') oData.push(sgCnt>0 ? sgTot.toFixed(2) : null); if(activeOverlay === 'f9') oData.push(f9); if(activeOverlay === 'b9') oData.push(b9);
            if(activeOverlay === 'tpAvoid') oData.push(tpA_T>0?Math.round((tpA_H/tpA_T)*100):null); if(activeOverlay === 'acc') oData.push((fT+gT)>0?Math.round(((fH+gH)/(fT+gT))*100):null);
        });
        trendDatasets.push({ label: activeOverlay.toUpperCase(), data: oData, borderColor: oColors[activeOverlay], backgroundColor: 'transparent', borderWidth: 2, borderDash: [5, 5], pointBackgroundColor: '#121212', pointBorderColor: oColors[activeOverlay], yAxisID: 'y1', tension: 0.3 });
    }
    
    try { if(tCtx) trendChart = new Chart(tCtx.getContext('2d'), { type: 'line', data: { labels: chartData.map(r => new Date(r.date_played).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })), datasets: trendDatasets }, options: { responsive: true, maintainAspectRatio: false, plugins: { tooltip: { callbacks: { label: function(context) { if (context.dataset.label === 'Trendline') return null; return context.dataset.label + ': ' + context.raw; } } }, legend: { display: activeOverlay !== 'none', labels: {color: '#9ca3af', font: {size: 10}} }, title: { display: false } }, scales: { x: { display: false }, y: { type: 'linear', display: true, position: 'left', grid: { color: '#2a2a2a' } }, y1: { type: 'linear', display: activeOverlay !== 'none', position: 'right', grid: { drawOnChartArea: false } } } } }); } catch(e){}

    let tpBrd = 0, tpPar = 0, tpBog = 0, tpDbl = 0;
    chartData.forEach(r => { (r.hole_scores||[]).forEach(h => { if (h.score && h.par) { let d = h.score - h.par; if (d <= -1) tpBrd++; else if (d === 0) tpPar++; else if (d === 1) tpBog++; else tpDbl++; } }); });
    try { if(pC) scorePieChart = new Chart(pC.getContext('2d'), { type: 'doughnut', data: { labels: ['Birdie or Better', 'Par', 'Bogey', 'Double+'], datasets: [{ data: [tpBrd, tpPar, tpBog, tpDbl], backgroundColor: ['#38bdf8', '#10b981', '#f59e0b', '#ef4444'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: {color: '#9ca3af', font: {size: 10}} } } } }); } catch(e){}

    let dW=0, dOB=0, dL=0, dU=0; chartData.forEach(r => { (r.hole_scores||[]).forEach(h => { let dA = h.drops_adv || ""; if(h.drops && h.drops > 0) { if(dA.includes('WATER')) dW++; if(dA.includes('OB')) dOB++; if(dA.includes('LOST')) dL++; if(dA.includes('UNPLAYABLE')) dU++; } }); });
    try { if(pCtx) penaltyPieChartObj = new Chart(pCtx.getContext('2d'), { type: 'doughnut', data: { labels: ['Water', 'OB', 'Lost', 'Unplayable'], datasets: [{ data: [dW, dOB, dL, dU], backgroundColor: ['#38bdf8', '#ef4444', '#f59e0b', '#8b5cf6'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: {color: '#9ca3af', font: {size: 10}} } } } }); } catch(e){}

    let accLabels = [], firData = [], girData = [];
    chartData.forEach(r => {
        let fH=0, fT=0, gH=0, gT=0; (r.hole_scores || []).forEach(h => { if(h.fir === 'hit' || h.fir === 'miss') { fT++; if(h.fir === 'hit') fH++; } if(h.gir === 'hit' || h.gir === 'miss') { gT++; if(h.gir === 'hit') gH++; } });
        accLabels.push(new Date(r.date_played).toLocaleDateString(undefined, {month:'short', day:'numeric'})); firData.push(fT > 0 ? Math.round((fH/fT)*100) : null); girData.push(gT > 0 ? Math.round((gH/gT)*100) : null);
    });
    try { if(aCtx) accuracyChart = new Chart(aCtx.getContext('2d'), { type: 'line', data: { labels: accLabels, datasets: [{ label: 'FIR %', data: firData, borderColor: '#8b5cf6', tension: 0.3 }, { label: 'GIR %', data: girData, borderColor: '#d946ef', tension: 0.3 }] }, options: { responsive: true, maintainAspectRatio: false } }); } catch(e){}

    let p3T=0, p3C=0, p4T=0, p4C=0, p5T=0, p5C=0;
    chartData.forEach(r => { (r.hole_scores || []).forEach(h => { if (h.score && h.par) { if(h.par === 3) { p3T+=h.score; p3C++; } if(h.par === 4) { p4T+=h.score; p4C++; } if(h.par === 5) { p5T+=h.score; p5C++; } } }); });
    try { if(psCtx) parScoringChart = new Chart(psCtx.getContext('2d'), { type: 'bar', data: { labels: ['Par 3', 'Par 4', 'Par 5'], datasets: [{ label: 'Avg Strokes', data: [p3C>0?(p3T/p3C).toFixed(2):0, p4C>0?(p4T/p4C).toFixed(2):0, p5C>0?(p5T/p5C).toFixed(2):0], backgroundColor: ['#f43f5e', '#14b8a6', '#eab308'] }] }, options: { responsive: true, maintainAspectRatio: false } }); } catch(e){}

    let clubStats = {}; chartData.forEach(r => { (r.hole_scores||[]).forEach(h => { if (h.drive_club && h.drive_distance > 0) { if(!clubStats[h.drive_club]) clubStats[h.drive_club] = {tot:0, cnt:0}; clubStats[h.drive_club].tot += h.drive_distance; clubStats[h.drive_club].cnt++; } if (h.approach_club && h.approach_yd > 0) { if(!clubStats[h.approach_club]) clubStats[h.approach_club] = {tot:0, cnt:0}; clubStats[h.approach_club].tot += h.approach_yd; clubStats[h.approach_club].cnt++; } }); }); practiceSessionData.forEach(s => { if(!clubStats[s.club]) clubStats[s.club] = {tot:0, cnt:0}; clubStats[s.club].tot += s.dist; clubStats[s.club].cnt++; });
    let cLabels = Object.keys(clubStats).sort((a,b) => (clubStats[b].tot/clubStats[b].cnt) - (clubStats[a].tot/clubStats[a].cnt)); let cData = cLabels.map(c => Math.round(clubStats[c].tot/clubStats[c].cnt));
    try { if(cCtx) clubChart = new Chart(cCtx.getContext('2d'), { type: 'bar', data: { labels: cLabels, datasets: [{ data: cData, backgroundColor: '#3b82f6' }] }, options: { responsive: true, maintainAspectRatio: false } }); } catch(e){}

    let wBuckets = { cold: {tot:0, cnt:0}, optimal: {tot:0, cnt:0}, hot: {tot:0, cnt:0} };
    chartData.forEach(r => { if(r.weather_temp && r.total_score > 0) { let tempNum = parseInt(String(r.weather_temp).replace('°C', '')); let par = r.hole_scores ? r.hole_scores.reduce((sum, h) => sum + (h.par || 0), 0) : 72; let relScore = r.total_score - par; if(!isNaN(tempNum)) { if (tempNum < 15) { wBuckets.cold.tot += relScore; wBuckets.cold.cnt++; } else if (tempNum <= 25) { wBuckets.optimal.tot += relScore; wBuckets.optimal.cnt++; } else { wBuckets.hot.tot += relScore; wBuckets.hot.cnt++; } } } });
    try { if(wCtx) weatherChart = new Chart(wCtx.getContext('2d'), { type: 'bar', data: { labels: ['Cold (<15°C)', 'Optimal (15-25°C)', 'Hot (>25°C)'], datasets: [{ data: [wBuckets.cold.cnt>0?(wBuckets.cold.tot/wBuckets.cold.cnt):0, wBuckets.optimal.cnt>0?(wBuckets.optimal.tot/wBuckets.optimal.cnt):0, wBuckets.hot.cnt>0?(wBuckets.hot.tot/wBuckets.hot.cnt):0], backgroundColor: ['#3b82f6', '#10b981', '#ef4444'] }] }, options: { responsive: true, maintainAspectRatio: false } }); } catch(e){}

    let fL=0, fR=0, fS=0, fTotMiss=0; let gL=0, gR=0, gS=0, gLg=0, gTotMiss=0;
    chartData.forEach(r => { (r.hole_scores || []).forEach(h => { let fA = h.fir_adv || ""; let gA = h.gir_adv || ""; if(h.fir === 'miss') { fTotMiss++; if(fA.includes('LEFT')) fL++; if(fA.includes('RIGHT')) fR++; if(fA.includes('SHORT')) fS++; } if(h.gir === 'miss') { gTotMiss++; if(gA.includes('LEFT')) gL++; if(gA.includes('RIGHT')) gR++; if(gA.includes('SHORT')) gS++; if(gA.includes('LONG')) gLg++; } }); });
    let mpStat = document.getElementById('miss-penalty-stats');
    if(mpStat) {
        mpStat.innerHTML = `
            <div style="margin-bottom: 10px;"><b>Drive Bias:</b> ${fTotMiss>0 ? `${Math.round((fL/fTotMiss)*100)}% Left | ${Math.round((fR/fTotMiss)*100)}% Right` : 'No data.'}</div>
            <div><b>Approach Bias:</b> ${gTotMiss>0 ? `${Math.round((gS/gTotMiss)*100)}% Short | ${Math.round((gL/gTotMiss)*100)}% Left` : 'No data.'}</div>
        `;
    }
};

window.generateInsights = function(fRounds) {
    let insights = [], p3=0, p3c=0, p4=0, p4c=0, p5=0, p5c=0, putts=0, holesPutted=0, threePutts=0;
    let bbOpp=0, bbHit=0, bbmOpp=0, bbmHit=0, f9={s:0,p:0}, late={s:0,p:0};
    let windArr = [], tempArr = [], scoreArr = [];
    
    fRounds.forEach(r => { 
        if(r.weather_temp && r.weather_wind && r.total_score > 0) {
            let t = parseInt(String(r.weather_temp).replace('°C', ''));
            let w = parseInt(String(r.weather_wind).replace('km/h', ''));
            let par = r.hole_scores ? r.hole_scores.reduce((sum, h) => sum + (h.par || 0), 0) : 72;
            if(!isNaN(t) && !isNaN(w)) { tempArr.push(t); windArr.push(w); scoreArr.push(r.total_score - par); }
        }

        if(!r.hole_scores || r.hole_scores.length === 0) { if(r.total_putts) { putts += r.total_putts; holesPutted += 18; if(r.total_putts >= 36) threePutts++; } return; }
        
        let hs = r.hole_scores.slice().sort((a,b) => a.hole_number - b.hole_number);
        for(let i=0; i<hs.length - 1; i++) {
            let curr = hs[i], next = hs[i+1];
            if(curr.score && curr.par && next.score && next.par) {
                let prevDiff = curr.score - curr.par; let nextDiff = next.score - next.par;
                if(prevDiff === 1) { bbOpp++; if(nextDiff <= 0) bbHit++; }
                if(prevDiff >= 2) { bbmOpp++; if(nextDiff <= 1) bbmHit++; }
            }
        }

        hs.forEach(h => {
            if(h.score && h.par) { 
                let diff = h.score - h.par; 
                if(h.par===3){p3+=diff; p3c++;} if(h.par===4){p4+=diff; p4c++;} if(h.par===5){p5+=diff; p5c++;} 
                if(h.hole_number >= 1 && h.hole_number <= 6) { f9.s += h.score; f9.p += h.par; }
                if(h.hole_number >= 13 && h.hole_number <= 18) { late.s += h.score; late.p += h.par; }
            }
            if(h.putts !== null && h.putts !== "") { putts += h.putts; holesPutted++; if(h.putts >= 3) threePutts++; }
        }); 
    });
    
    let averages = [];
    if (p3c > 0) averages.push({type: 'Par 3s', val: p3/p3c}); if (p4c > 0) averages.push({type: 'Par 4s', val: p4/p4c}); if (p5c > 0) averages.push({type: 'Par 5s', val: p5/p5c});
    if (averages.length > 0) { averages.sort((a,b) => b.val - a.val); let worst = averages[0]; let best = averages[averages.length - 1]; insights.push(`<div class="insight-btn" onclick="window.openInsightDetail('Scoring Leak')"><span style="font-size:18px;">🔴</span><div><b>Scoring Leak:</b> Your weakest holes are <b>${worst.type}</b>, averaging +${worst.val.toFixed(1)} to par.</div></div>`); if (averages.length > 1 && best.val < worst.val) { insights.push(`<div class="insight-btn" onclick="window.openInsightDetail('Scoring Strength')"><span style="font-size:18px;">🟢</span><div><b>Scoring Strength:</b> You excel on <b>${best.type}</b>, playing them efficiently at +${best.val.toFixed(1)} to par.</div></div>`); } }
    
    if(scoreArr.length > 5) {
        let rWind = window.pearsonCorrelation(windArr, scoreArr);
        let rTemp = window.pearsonCorrelation(tempArr, scoreArr);
        let msg = "No strong climate correlations detected yet.";
        if (rWind > 0.4) msg = "Strong correlation detected. Your score negatively compounds in high winds.";
        if (rTemp < -0.4) msg = "Correlation detected. You bleed strokes rapidly in colder weather.";
        insights.push(`<div class="insight-btn" onclick="window.openInsightDetail('Climate Impact')"><span style="font-size:18px;">⛅</span><div><b>Climate Impact:</b> ${msg}</div></div>`);
    }

    if (holesPutted > 0) { let avgPutts = putts / holesPutted; let threePuttRate = (threePutts / holesPutted) * 100; if (avgPutts > 2.0) insights.push(`<div class="insight-btn" onclick="window.openInsightDetail('Putting')"><span style="font-size:18px;">🔴</span><div><b>Putting:</b> You average ${avgPutts.toFixed(1)} putts per hole.</div></div>`); else insights.push(`<div class="insight-btn" onclick="window.openInsightDetail('Putting')"><span style="font-size:18px;">🟢</span><div><b>Putting:</b> You average ${avgPutts.toFixed(1)} putts per hole.</div></div>`); }
    
    if (insights.length === 0) return "Gathering more round data to generate your performance insights..."; return `<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:10px;">${insights.join('')}</div>`;
};

window.openInsightDetail = function(type) {
    document.getElementById('insight-detail-title').innerText = type.toUpperCase();
    let contentHtml = "";
    if (type === "Scoring Leak" || type === "Scoring Strength") { contentHtml = `<i>Analyzes your pure mathematical baseline over par across hole architectures.</i>`; } 
    else if (type === "Climate Impact") { contentHtml = `<i>Pearson Correlation (r) maps your historical scores strictly against documented weather vectors at the time of your round.</i>`; }
    else { contentHtml = `Deeper historical context mapping is actively being recorded.`; }
    document.getElementById('insight-detail-content').innerHTML = contentHtml; document.getElementById('insight-modal').style.display = 'flex';
};

window.openStatGraph = function(title, statKey) {
    document.getElementById('stat-graph-title').innerText = title.toUpperCase(); document.getElementById('stat-graph-modal').style.display = 'flex';
    currentStatKey = statKey; currentStatTitle = title;
    let tf = document.getElementById('filter-timeframe').value; document.getElementById('modal-filter-timeframe').value = tf;
    window.refreshModalGraph();
};

window.refreshModalGraph = function() {
    if(!currentStatKey) return;
    let tFilter = document.getElementById('modal-filter-timeframe').value;
    let plotData = []; let rList = [...currentFilteredRounds];
    if(tFilter === 'last10') rList = rList.slice(0, 10);
    if(tFilter === 'last20') rList = rList.slice(0, 20);
    rList = rList.reverse();
    
    rList.forEach(r => {
        let val = 0; let valid = false; let targetHoles = r.hole_scores || [];
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
                    let exp = window.getExpectedPutts(h.putt_1_ft);
                    sgTot += (exp - h.putts);
                    sgCnt++;
                }
            });
            if(sgCnt>0) { val=sgTot; valid=true; }
        }
        if(currentStatKey === 'driveDist') {
            let drvTot=0, drvCnt=0;
            targetHoles.forEach(h => { if(h.drive_distance > 0 && (!h.drive_exception || h.drive_exception === "")) { drvTot += h.drive_distance; drvCnt++; } });
            if(drvCnt>0) { val = Math.round(drvTot/drvCnt); valid = true; }
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
        if(currentStatKey === 'ss') { let th=0, ts=0; targetHoles.forEach(h=>{if(h.sand_save==='yes'||h.sand_save==='no' || h.sand_save==='1' || h.sand_save==='2' || h.sand_save==='3+'){ts++; if(h.sand_save==='yes' || h.sand_save==='1')th++;}}); if(ts>0) { val=(th/ts)*100; valid=true;} }
        
        if(valid) plotData.push({x: new Date(r.date_played).toLocaleDateString(undefined, {month:'short', day:'numeric'}), y: val});
    });

    document.getElementById('stat-graph-title').innerText = currentStatTitle.toUpperCase();
    if(statDetailChartObj) statDetailChartObj.destroy();
    let cEl = document.getElementById('statDetailChart'); if(!cEl) return;
    statDetailChartObj = new Chart(cEl.getContext('2d'), { type: 'line', data: { labels: plotData.map(d=>d.x), datasets: [{ label: currentStatTitle, data: plotData.map(d=>d.y), borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.2)', borderWidth: 2, fill: true, pointBackgroundColor: '#121212', tension: 0.3 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { grid: { color: '#2a2a2a' } }, x: { display: false } } } });
};

window.addEventListener('DOMContentLoaded', initializeApp);
