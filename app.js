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

let trendChart = null, clubChart = null, radarChart = null, weatherChart = null, statDetailChartObj = null;
let currentFilteredRounds = [], roundWeather = { temp: null, wind: null }, dismissedWarnings = [];
let currentStatKey = null, currentStatTitle = null;
let practiceSessionData = [];

// CANVAS PUTT MAPPER GLOBALS
let puttCanvas = null, puttCtx = null;
let pinPos = null, ballPos = null;

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
    
    // Initialize Putt Canvas
    puttCanvas = document.getElementById('putt-canvas');
    if(puttCanvas) {
        puttCtx = puttCanvas.getContext('2d');
        puttCanvas.addEventListener('click', handlePuttClick);
    }
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

// ----------------------------------------------------
// RANGE / SIM TRACKER DASHBOARD
// ----------------------------------------------------
window.togglePracticeMode = function() {
    const val = document.getElementById('practice-type-select').value;
    const simDivs = document.querySelectorAll('.sim-metric');
    if(val === 'SIM') {
        simDivs.forEach(d => d.style.display = 'block');
    } else {
        simDivs.forEach(d => d.style.display = 'none');
    }
};

window.logPracticeShot = function() {
    const club = document.getElementById('range-club').value;
    const dist = parseInt(document.getElementById('range-dist').value);
    const strike = document.getElementById('range-strike').value;
    
    if(isNaN(dist) || dist <= 0) return alert("Please enter a valid distance.");
    
    practiceSessionData.push({ club: club, dist: dist, strike: strike });
    
    // Clear Input
    document.getElementById('range-dist').value = "";
    document.getElementById('sim-ball-speed').value = "";
    document.getElementById('sim-spin').value = "";
    
    updatePracticeTable();
};

function updatePracticeTable() {
    const tbody = document.getElementById('practice-session-body');
    if(practiceSessionData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--text-muted);">No shots logged this session.</td></tr>';
        return;
    }
    
    let grouped = {};
    practiceSessionData.forEach(s => {
        if(!grouped[s.club]) grouped[s.club] = { tot: 0, cnt: 0 };
        grouped[s.club].tot += s.dist;
        grouped[s.club].cnt++;
    });
    
    let html = "";
    Object.keys(grouped).forEach(c => {
        let avg = Math.round(grouped[c].tot / grouped[c].cnt);
        html += `<tr><td>${c}</td><td>${avg}y</td><td>${grouped[c].cnt}</td></tr>`;
    });
    
    tbody.innerHTML = html;
}

// ----------------------------------------------------
// PUTT MAPPER CANVAS LOGIC
// ----------------------------------------------------
window.openPuttMapper = function() {
    pinPos = null; ballPos = null;
    document.getElementById('putt-distance-display').innerText = "-- ft";
    document.getElementById('putt-map-modal').style.display = 'flex';
    clearPuttCanvas();
};

window.clearPuttMap = function() {
    pinPos = null; ballPos = null;
    document.getElementById('putt-distance-display').innerText = "-- ft";
    clearPuttCanvas();
};

function clearPuttCanvas() {
    if(!puttCtx || !puttCanvas) return;
    puttCtx.clearRect(0, 0, puttCanvas.width, puttCanvas.height);
    // Draw Grid Rings
    puttCtx.beginPath(); puttCtx.arc(150, 150, 50, 0, 2*Math.PI); puttCtx.strokeStyle = 'rgba(255,255,255,0.1)'; puttCtx.stroke();
    puttCtx.beginPath(); puttCtx.arc(150, 150, 100, 0, 2*Math.PI); puttCtx.strokeStyle = 'rgba(255,255,255,0.1)'; puttCtx.stroke();
    puttCtx.beginPath(); puttCtx.arc(150, 150, 140, 0, 2*Math.PI); puttCtx.strokeStyle = 'rgba(255,255,255,0.2)'; puttCtx.stroke();
}

function handlePuttClick(e) {
    const rect = puttCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (!pinPos) {
        pinPos = {x, y};
        puttCtx.font = "24px Arial";
        puttCtx.fillText("⛳", x - 12, y + 12);
    } 
    else if (!ballPos) {
        ballPos = {x, y};
        puttCtx.font = "18px Arial";
        puttCtx.fillText("⚪", x - 9, y + 9);
        
        // Draw line
        puttCtx.beginPath();
        puttCtx.moveTo(pinPos.x, pinPos.y);
        puttCtx.lineTo(ballPos.x, ballPos.y);
        puttCtx.setLineDash([5, 5]);
        puttCtx.strokeStyle = 'rgba(255,255,255,0.5)';
        puttCtx.stroke();
        puttCtx.setLineDash([]);
        
        // Calc Math (Assume radius of 150px = 50 feet green edge)
        // Ratio: 50ft / 150px = 0.333 ft per pixel
        let pxDist = Math.sqrt(Math.pow(ballPos.x - pinPos.x, 2) + Math.pow(ballPos.y - pinPos.y, 2));
        let ftDist = Math.round(pxDist * 0.333);
        
        document.getElementById('putt-distance-display').innerText = ftDist + " ft";
    }
}

window.savePuttMap = function() {
    let dText = document.getElementById('putt-distance-display').innerText;
    let dist = parseInt(dText.replace(' ft', ''));
    if(!isNaN(dist)) {
        document.getElementById('play-putt-dist').value = dist;
        syncPlayToState('puttDist', dist);
    }
    document.getElementById('putt-map-modal').style.display = 'none';
};


// ----------------------------------------------------
// ROUND FETCH & WEATHER
// ----------------------------------------------------
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
            
            // Auto hide search if loaded state has a course
            if(s.courseName && s.courseName !== 'NO COURSE' && s.courseName !== 'NO COURSE SELECTED') {
                document.getElementById('search-card').style.display = 'none';
                document.getElementById('golf-entry-form').style.display = 'block';
                togglePlayMode(true);
            }

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

window.adjustStat = function(field, amount) {
    let el = document.getElementById(`play-${field}`);
    let current = parseInt(el.value);
    if(isNaN(current)) current = (field === 'score' ? parseInt(currentCoursePars[currentPlayHole]) || 4 : 2);
    let next = current + amount;
    if(next < 0) next = 0;
    el.value = next;
    syncPlayToState(field, next);
};

window.adjustDrop = function(amount) {
    let cVal = parseInt(roundData[currentPlayHole].drops) || 0;
    let next = cVal + amount;
    if(next < 0) next = 0;
    
    roundData[currentPlayHole].drops = next;
    document.getElementById('play-drops-display').value = next;
    
    if (next === 0) {
        roundData[currentPlayHole].dropsAdv = [];
        document.getElementById('drop-sub-menu').style.display = 'none';
    } else {
        document.getElementById('drop-sub-menu').style.display = 'flex';
    }
    
    saveLocalState();
};

window.toggleDropType = function(type) {
    let adv = roundData[currentPlayHole].dropsAdv || [];
    if(adv.includes(type)) {
        adv = adv.filter(v => v !== type);
    } else {
        adv.push(type);
    }
    roundData[currentPlayHole].dropsAdv = adv;
    
    let wBtn = document.getElementById('drop-water');
    let oBtn = document.getElementById('drop-ob');
    let lBtn = document.getElementById('drop-lost');
    
    if(wBtn) { if(adv.includes('WATER')) wBtn.classList.add('active'); else wBtn.classList.remove('active'); }
    if(oBtn) { if(adv.includes('OB')) oBtn.classList.add('active'); else oBtn.classList.remove('active'); }
    if(lBtn) { if(adv.includes('LOST')) lBtn.classList.add('active'); else lBtn.classList.remove('active'); }
    
    saveLocalState();
};

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
            // FUZZY MATCH FIX
            let matchedCourse = teeData.find(t => t.course_name.trim().toUpperCase().includes(query.toUpperCase()) || query.toUpperCase().includes(t.course_name.trim().toUpperCase()));
            if (!matchedCourse && teeData.length > 0) matchedCourse = teeData[0];
            
            if (matchedCourse) {
                const fetchedCourseName = matchedCourse.course_name.trim();
                availableTees = teeData.filter(t => t.course_name.trim() === fetchedCourseName);
                
                fetchWeatherForCourse(fetchedCourseName);
                
                let parsedPars = availableTees[0].pars; if (typeof parsedPars === 'string') { try { parsedPars = JSON.parse(parsedPars.replace(/{/g, '[').replace(/}/g, ']')); } catch(e){} }
                currentCoursePars = Array.isArray(parsedPars) ? [...parsedPars] : Array(18).fill(""); 
                
                // YARDAGE PARSE FIX
                let y = availableTees[0].yardages;
                if (typeof y === 'string') {
                    try {
                        if (y === "null" || y === "") y = Array(18).fill("");
                        else y = JSON.parse(y.replace(/{/g, '[').replace(/}/g, ']'));
                    } catch(e) { y = Array(18).fill(""); }
                }
                currentYardages = Array.isArray(y) && y.length > 0 ? [...y] : Array(18).fill(""); 
                
                roundData = Array.from({length: 18}, () => ({ score: "", putts: "", fir: "", firAdv: [], gir: "", girAdv: [], drive: "", driveException: "", drops: 0, dropsAdv: [], sandSave: "", puttDist: "", driveClub: "", appClub: "", appDist: "" }));
                dismissedWarnings = [];
                
                document.getElementById('current-course-display').innerText = fetchedCourseName.toUpperCase(); 
                document.getElementById('current-course-display').style.color = 'var(--accent-green)';
                
                populateTeeDropdown(); 
                document.getElementById('api-status').innerText = ""; 
                buildGrid(); 
                updatePlayModeUI(); 
                saveLocalState(); 
                return;
            }
        }
    } catch(e) { 
        console.error(e); 
    } finally {
        fetchBtn.innerText = originalText; fetchBtn.disabled = false;
    }
    
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

function startRound() {
    document.getElementById('search-card').style.display = 'none';
    document.getElementById('golf-entry-form').style.display = 'block';
    togglePlayMode(true);
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
            else { cell.className = 'cell'; let cVal = roundData[i][row.type]; let btnText = row.type === 'sandSave' ? (cVal === "" ? "-" : cVal) : (cVal === 'hit' ? 'HIT' : (cVal === 'miss' ? 'MISS' : '-')); cell.innerHTML = `<button type="button" class="toggle-btn ${cVal === 'hit' || cVal === '0' ? 'hit' : ''}" id="grid-${row.type}-${i}" onclick="toggleGridHit(${i}, '${row.type}')">${btnText}</button>`; }
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
    if(s === "") s = "0"; 
    else if(s === "0") s = "1"; 
    else if(s === "1") s = "2"; 
    else if(s === "2") s = "3+"; 
    else s = ""; 
    
    roundData[currentPlayHole].sandSave = s;
    
    let gridBtn = document.getElementById(`grid-sandSave-${currentPlayHole}`);
    if(gridBtn) {
        gridBtn.innerText = s === "" ? "-" : s;
        if(s === "1") gridBtn.classList.add('hit'); else gridBtn.classList.remove('hit');
    }
    
    updatePlayModeUI();
    saveLocalState();
};

window.setPlayToggle = function(type, status) {
    let current = roundData[currentPlayHole][type];
    roundData[currentPlayHole][type] = (current === status) ? "" : status;
    
    // Clear sub array if we un-miss
    if (status !== 'miss') roundData[currentPlayHole][type + 'Adv'] = [];
    
    updatePlayModeUI();
    saveLocalState();
};

window.toggleAdv = function(type, val) {
    let arr = roundData[currentPlayHole][type + 'Adv'] || [];
    if(arr.includes(val)) {
        arr = arr.filter(v => v !== val);
    } else {
        arr.push(val);
    }
    roundData[currentPlayHole][type + 'Adv'] = arr;
    updatePlayModeUI();
    saveLocalState();
};

function toggleGridHit(index, type) { 
    const btn = document.getElementById(`grid-${type}-${index}`); 
    let ns = "";
    if (type === 'sandSave') {
        let cur = btn.innerText;
        ns = cur === "-" ? "0" : (cur === "0" ? "1" : (cur === "1" ? "2" : (cur === "2" ? "3+" : "")));
        btn.innerText = ns === "" ? "-" : ns;
    } else {
        ns = btn.innerText === "MISS" ? "hit" : "miss";
        btn.innerText = ns === "" ? "-" : ns.toUpperCase(); 
    }

    if(ns === 'hit' || ns === '1') btn.classList.add('hit'); else btn.classList.remove('hit'); 
    roundData[index][type] = ns === "-" ? "" : ns; 
    if(currentPlayHole === index) updatePlayModeUI(); 
    saveLocalState(); 
}

function togglePlayMode(isPlayMode) { 
    document.getElementById('btn-play-mode').className = isPlayMode ? 'view-toggle-btn primary' : 'view-toggle-btn'; 
    document.getElementById('btn-grid-mode').className = !isPlayMode ? 'view-toggle-btn primary' : 'view-toggle-btn'; 
    
    if (window.innerWidth >= 1000) {
        // Handled by CSS media queries
    } else {
        document.getElementById('grid-mode-container').style.display = isPlayMode ? 'none' : 'block'; 
        document.getElementById('play-mode-container').style.display = isPlayMode ? 'flex' : 'none'; 
    }
    
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
    
    // HISTORICAL SMART DEFAULTS
    if (state.score === "") {
        if ((par == 4 || par == 5)) {
            if (state.driveClub === "") {
                let dClubs = masterAnalyticsData.flatMap(r => (r.hole_scores||[]).filter(h => h.par == par && h.drive_club).map(h => h.drive_club));
                state.driveClub = dClubs.length ? dClubs.sort((a,b) => dClubs.filter(v => v===a).length - dClubs.filter(v => v===b).length).pop() : "Driver";
            }
        }
        if (par == 3) {
            if (state.appClub === "") {
                let aClubs = masterAnalyticsData.flatMap(r => (r.hole_scores||[]).filter(h => h.par == 3 && h.approach_club).map(h => h.approach_club));
                state.appClub = aClubs.length ? aClubs.sort((a,b) => aClubs.filter(v => v===a).length - aClubs.filter(v => v===b).length).pop() : "Iron";
            }
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
    if (state.sandSave === "0") { sBtn.innerText = "0 STROKES"; sBtn.className = "adv-btn active"; sBtn.style.background = "var(--accent-green)"; sBtn.style.borderColor = "var(--accent-green)"; sBtn.style.color = "#000"; }
    else if (state.sandSave === "1") { sBtn.innerText = "1 STROKE (SAVE)"; sBtn.className = "adv-btn active"; sBtn.style.background = "var(--accent-green)"; sBtn.style.borderColor = "var(--accent-green)"; sBtn.style.color = "#000"; }
    else if (state.sandSave === "2") { sBtn.innerText = "2 STROKES"; sBtn.className = "adv-btn active"; sBtn.style.background = "#ef4444"; sBtn.style.borderColor = "#ef4444"; sBtn.style.color = "#fff"; }
    else if (state.sandSave === "3+") { sBtn.innerText = "3+ STROKES"; sBtn.className = "adv-btn active"; sBtn.style.background = "#ef4444"; sBtn.style.borderColor = "#ef4444"; sBtn.style.color = "#fff"; }
    else { sBtn.innerText = "NONE"; sBtn.className = "adv-btn"; sBtn.style.background = "rgba(0,0,0,0.4)"; sBtn.style.color = "var(--text-muted)"; sBtn.style.borderColor = "var(--border-color)";}

    let dropsVal = parseInt(state.drops) || 0; 
    document.getElementById('play-drops-display').value = dropsVal;
    
    if (dropsVal > 0) {
        document.getElementById('drop-sub-menu').style.display = 'flex';
        let adv = state.dropsAdv || [];
        let wBtn = document.getElementById('drop-water');
        let oBtn = document.getElementById('drop-ob');
        let lBtn = document.getElementById('drop-lost');
        if(wBtn) { if(adv.includes('WATER')) wBtn.classList.add('active'); else wBtn.classList.remove('active'); }
        if(oBtn) { if(adv.includes('OB')) oBtn.classList.add('active'); else oBtn.classList.remove('active'); }
        if(lBtn) { if(adv.includes('LOST')) lBtn.classList.add('active'); else lBtn.classList.remove('active'); }
    } else {
        document.getElementById('drop-sub-menu').style.display = 'none';
    }

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
        
        let subMenu = document.getElementById(`${type}-sub-menu`);
        let advArr = state[type + 'Adv'] || [];
        
        if(state[type] === 'hit') { 
            if(hb) hb.classList.add('active'); 
            if(subMenu) subMenu.style.display = 'none';
        } 
        else if(state[type] === 'miss' && !(type === 'fir' && par === 3)) { 
            if(mb) mb.classList.add('active'); 
            if(subMenu) {
                subMenu.style.display = 'flex';
                document.querySelectorAll(`#${type}-sub-menu .sub-miss`).forEach(btn => {
                    let val = btn.id.split('-').pop().toUpperCase();
                    if(advArr.includes(val)) btn.classList.add('active');
                    else btn.classList.remove('active');
                });
            }
        }
        else {
            if(subMenu) subMenu.style.display = 'none';
        }
    });
    
    let dBlock = document.getElementById('play-fir-block'); 
    if(dBlock) {
        if(par == 3) {
            dBlock.style.opacity = '0.3';
            document.querySelectorAll('#play-fir-block button, #play-fir-block input, #play-fir-block select').forEach(el => el.disabled = true);
        } else {
            dBlock.style.opacity = '1';
            document.querySelectorAll('#play-fir-block button, #play-fir-block input, #play-fir-block select').forEach(el => el.disabled = false);
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

window.openHistoryModal = async function(id, name, date, score, holesPlayed, temp, wind) {
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

window.toggleModalDrops = function(btn, i) { let cVal = parseInt(modalRoundData[i].drops) || 0; let newVal = cVal >= 4 ? 0 : cVal + 1; modalRoundData[i].drops = newVal; btn.innerText = newVal === 0 ? "-" : newVal; btn.style.color = newVal > 0 ? "#ef4444" : "var(--text-muted)"; }
window.toggleModalHit = function(b, i, t) { let ns = t==='sandSave'?(b.innerText==="MISS"?"": (b.innerText==="SAVE"?"no":"yes")):(b.innerText==="MISS"?"hit":"miss"); b.innerText=ns==="-"?"-":(ns==='yes'?'SAVE':(ns==='no'?'MISS':ns.toUpperCase())); if(ns==='hit'||ns==='yes')b.classList.add('hit'); else b.classList.remove('hit'); modalRoundData[i][t] = ns==="-"?"":ns; }
window.closeHistoryModal = function() { document.getElementById('history-modal').classList.remove('active'); activeModalRoundId = null; }

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
        contentHtml = `<b>Par 3 Allocation Variance:</b> ${p3c>0 ? (p3/p3c>0?'+':'')+(p3/p3c).toFixed(2) : '-'}<br><br><b>Par 4 Allocation Variance:</b> ${p4c>0 ? (p4/p4c>0?'+':'')+(p4/p4c).toFixed(2) : '-'}<br><br><b>Par 5 Allocation Variance:</b> ${p5c>0 ? (p5/p5c>0?'+':'')+(p5/p5c).toFixed(2) : '-'}<br><br><i>This analyzes your pure mathematical baseline over par across hole architectures. A positive (+) number means you are leaking strokes against the field average on this hole type.</i>`;
    } 
    else if (type === "Mental Toughness") {
        let bbO=0, bbH=0, bbmO=0, bbmH=0;
        currentFilteredRounds.forEach(r => { 
            let hs = (r.hole_scores||[]).slice().sort((a,b)=>a.hole_number-b.hole_number);
            for(let i=0; i<hs.length-1; i++) { let c=hs[i], n=hs[i+1]; if(c.score && c.par && n.score && n.par) { let d=c.score-c.par; let nd=n.score-n.par; if(d===1){bbO++; if(nd<=0)bbH++;} if(d>=2){bbmO++; if(nd<=1)bbmH++;} } }
        });
        contentHtml = `<b>Bogey Salvage Conversion Rate:</b> ${bbO>0 ? (bbH/bbO*100).toFixed(0) : 0}% (${bbH}/${bbO})<br><br><b>Double Bogey+ Crisis Mitigation:</b> You stopped compound error leaks on ${bbmH}/${bbmO} attempts (${bbmO>0 ? (bbmH/bbmO*100).toFixed(0) : 0}%).<br><br><i>This evaluates your tilt-resistance. A high salvage rate means you successfully "stop the bleeding" and score Par or better immediately following a dropped shot.</i>`;
    }
    else if (type === "Fatigue") {
        let f9s=0, f9p=0, b9s=0, b9p=0;
        currentFilteredRounds.forEach(r => { r.hole_scores && r.hole_scores.forEach(h => { if(h.score && h.par) { if(h.hole_number<=9){f9s+=h.score; f9p+=h.par;} else{b9s+=h.score; b9p+=h.par;} } }); });
        let e1 = f9p>0 ? (f9s-f9p)/(f9p/6) : 0; let e2 = b9p>0 ? (b9s-b9p)/(b9p/6) : 0;
        contentHtml = `<b>Holes 1-6 Baseline Score Rate:</b> ${e1>0?'+':''}${e1.toFixed(1)}<br><br><b>Holes 13-18 Physical Exhaustion Rate:</b> ${e2>0?'+':''}${e2.toFixed(1)}<br><br><i>This normalizes your scoring pace per 6-hole window. A significant dropoff late in the round indicates a physical endurance gap or nutritional deficit on the back 9.</i>`;
    }
    else if (type === "Putting") {
        let p0=0, p1=0, p2=0, p3=0;
        currentFilteredRounds.forEach(r => { r.hole_scores && r.hole_scores.forEach(h => { if(h.putts===0)p0++; else if(h.putts===1)p1++; else if(h.putts===2)p2++; else if(h.putts>=3)p3++; }); });
        let tot = p0+p1+p2+p3;
        contentHtml = `<b>Total Holes Putted:</b> ${tot}<br><br><b>0-Putts:</b> ${p0} (${tot>0?(p0/tot*100).toFixed(1):0}%)<br><b>1-Putts:</b> ${p1} (${tot>0?(p1/tot*100).toFixed(1):0}%)<br><b>2-Putts:</b> ${p2} (${tot>0?(p2/tot*100).toFixed(1):0}%)<br><b>3+ Putts:</b> ${p3} (${tot>0?(p3/tot*100).toFixed(1):0}%)<br><br><i>Putting averages calculate pure volume. For distance-adjusted putting skill, check the Strokes Gained Putting (SGP) metric in the charts.</i>`;
    }
    else {
        contentHtml = `Deep-dive spatial analysis modeling is running in the background. Complete more round profiles to load this dataset.`;
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

window.getExpectedPutts = function(feet) {
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

window.loadAnalyticsData = async function() {
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

window.toggleGroupToggles = function(mainCb, childClass, btnTextId, defaultText) { document.querySelectorAll(childClass).forEach(b => b.checked = mainCb.checked); document.getElementById(btnTextId).innerText = mainCb.checked ? `All ${defaultText}s` : `0 ${defaultText}s`; updateAnalytics(); }
window.checkGroupToggles = function(childClass, mainId, btnTextId, defaultText) { const cbs = Array.from(document.querySelectorAll(childClass)); const allChecked = cbs.every(b => b.checked); const checkedCount = cbs.filter(b => b.checked).length; document.getElementById(mainId).checked = allChecked; document.getElementById(btnTextId).innerText = allChecked ? `All ${defaultText}s` : (checkedCount === 1 ? `1 ${defaultText}` : `${checkedCount} ${defaultText}s`); updateAnalytics(); }
window.toggleFilterDropdown = function(id) { const el = document.getElementById(id); el.style.display = el.style.display === 'flex' ? 'none' : 'flex'; }

function populateFilters() {
    const uC = [...new Set(masterAnalyticsData.map(r => r.course_name.trim()))].sort();
    document.getElementById('course-checkbox-list').innerHTML = `<label class="checkbox-container"><input type="checkbox" id="cb-all-courses" autocomplete="off" checked onchange="toggleGroupToggles(this, '.course-cb', 'course-btn-text', 'Course')"> <strong>All Courses</strong></label><hr style="width: 100%; border: 0; border-top: 1px solid var(--border-color); margin: 5px 0;">` + uC.map(c => `<label class="checkbox-container"><input type="checkbox" class="course-cb" value="${c.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}" autocomplete="off" checked onchange="checkGroupToggles('.course-cb', 'cb-all-courses', 'course-btn-text', 'Course')"> ${c}</label>`).join('');
    const uY = [...new Set(masterAnalyticsData.map(r => new Date(r.date_played).getUTCFullYear().toString()))].sort((a,b)=>b-a);
    document.getElementById('year-checkbox-list').innerHTML = `<label class="checkbox-container"><input type="checkbox" id="cb-all-years" autocomplete="off" checked onchange="toggleGroupToggles(this, '.year-cb', 'year-btn-text', 'Year')"> <strong>All Years</strong></label><hr style="width: 100%; border: 0; border-top: 1px solid var(--border-color); margin: 5px 0;">` + uY.map(y => `<label class="checkbox-container"><input type="checkbox" class="year-cb" value="${y}" autocomplete="off" checked onchange="checkGroupToggles('.year-cb', 'cb-all-years', 'year-btn-text', 'Year')"> ${y}</label>`).join('');
}

document.addEventListener('click', function(e) { if (!e.target.closest('.multi-select-container') && !e.target.closest('summary')) { document.querySelectorAll('.multi-select-dropdown').forEach(d => d.style.display = 'none'); } });

function calculateHandicap(allRounds) {
    const hcpRounds = allRounds.filter(r => r.course_rating && r.slope_rating && !(r.tee_name && r.tee_name.includes('[SIM]')) && !(r.tee_name && r.tee_name.includes('[RANGE]'))).slice(0, 20);
    const n = hcpRounds.length; if (n < 3) return "--.-";
    let diffs = hcpRounds.map(r => ((r.total_score - r.course_rating) * 113 / r.slope_rating)).sort((a,b) => a-b);
    let countToUse = 1, adj = 0;
    if (n === 3) { countToUse = 1; adj = -2.0; } else if (n === 4) { countToUse = 1; adj = -1.0; } else if (n === 5) { countToUse = 1; adj = 0; } else if (n === 6) { countToUse = 2; adj = -1.0; } else if (n >= 7 && n <= 8) { countToUse = 2; adj = 0; } else if (n >= 9 && n <= 11) { countToUse = 3; adj = 0; } else if (n >= 12 && n <= 14) { countToUse = 4; adj = 0; } else if (n >= 15 && n <= 16) { countToUse = 5; adj = 0; } else if (n >= 17 && n <= 18) { countToUse = 6; adj = 0; } else if (n === 19) { countToUse = 7; adj = 0; } else if (n === 20) { countToUse = 8; adj = 0; }
    const avg = (diffs.slice(0, countToUse).reduce((a,b) => a+b, 0) / countToUse) + adj; return Math.max(0, (Math.round(avg * 10) / 10)).toFixed(1);
}

function calculateHcpHistory(rounds) {
    let chrono = [...rounds].reverse();
    let history = [];
    for (let i = 0; i < chrono.length; i++) {
        let windowRounds = chrono.slice(Math.max(0, i - 19), i + 1).reverse();
        let h = calculateHandicap(windowRounds);
        history.push({ date: chrono[i].date_played, hcp: h });
    }
    return history;
}

function getRelativeParString(score, par) {
    if(par === 0 || score === 0) return "";
    let diff = score - par;
    return diff > 0 ? `(+${diff})` : (diff === 0 ? `(E)` : `(${diff})`);
}

function updateTrophyRoom(fRounds) {
    let lowScores = []; let minScore = 999;
    let longDrives = []; let maxDrive = 0;
    let lowPuttsList = []; let minPutts = 999;
    let mostFirsList = []; let maxFir = 0;

    fRounds.forEach(r => {
        let dStr = new Date(r.date_played).toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'});
        let holesPlayed = r.hole_scores ? r.hole_scores.filter(h => h.score > 0).length : 0;
        
        if (holesPlayed >= 18) {
            let coursePar = r.hole_scores.reduce((sum, h) => sum + (h.par || 0), 0);
            
            if (r.total_score > 0) {
                if (r.total_score < minScore) {
                    minScore = r.total_score;
                    lowScores = [{c: r.course_name.trim(), d: dStr, p: coursePar}];
                } else if (r.total_score === minScore) {
                    lowScores.push({c: r.course_name.trim(), d: dStr, p: coursePar});
                }
            }
            
            if (r.total_putts > 0) {
                if (r.total_putts < minPutts) {
                    minPutts = r.total_putts;
                    lowPuttsList = [{c: r.course_name.trim(), d: dStr}];
                } else if (r.total_putts === minPutts) {
                    lowPuttsList.push({c: r.course_name.trim(), d: dStr});
                }
            }
            
            let firs = r.hole_scores.filter(h => h.fir === 'hit').length;
            if (firs > maxFir) {
                maxFir = firs;
                mostFirsList = [{c: r.course_name.trim(), d: dStr}];
            } else if (firs === maxFir && firs > 0) {
                mostFirsList.push({c: r.course_name.trim(), d: dStr});
            }
        }
        
        if (r.hole_scores) {
            r.hole_scores.forEach(h => {
                if (h.drive_distance > 0 && (!h.drive_exception || h.drive_exception === "")) {
                    if (h.drive_distance > maxDrive) {
                        maxDrive = h.drive_distance;
                        longDrives = [{c: r.course_name.trim(), d: dStr}];
                    } else if (h.drive_distance === maxDrive) {
                        longDrives.push({c: r.course_name.trim(), d: dStr});
                    }
                }
            });
        }
    });

    const tBox = document.getElementById('trophy-room-box');
    if(!tBox) return;
    
    const tStyle = "flex: 1; min-width: 120px; background: rgba(0,0,0,0.2); border: 1px solid var(--border-color); border-radius: 8px; padding: 15px; text-align: center;";
    const labelStyle = "font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: bold; margin-bottom: 5px;";
    const valStyle = "font-size: 24px; color: var(--accent-green); font-weight: bold;";
    const subStyle = "font-size: 11px; color: var(--text-muted); margin-top: 5px; line-height: 1.4;";

    function formatList(arr) {
        if(arr.length === 0) return "--";
        let html = `<strong>${arr[0].c}</strong><br><span style="opacity:0.6">${arr[0].d}</span>`;
        if (arr.length === 2) html += `<br><hr style="border:0; border-top:1px solid var(--border-color); margin:4px 0;"><strong>${arr[1].c}</strong><br><span style="opacity:0.6">${arr[1].d}</span>`;
        else if (arr.length > 2) html += `<br><span style="color:var(--accent-green);">+ ${arr.length - 1} tied</span>`;
        return html;
    }

    let lowScoreRel = (minScore !== 999 && lowScores.length > 0) ? getRelativeParString(minScore, lowScores[0].p) : "";
    let displayScore = minScore === 999 ? '--' : `${minScore} <span style="font-size:14px; opacity:0.8;">${lowScoreRel}</span>`;

    tBox.innerHTML = `
        <div style="width: 100%; font-size: 14px; font-weight: bold; color: var(--accent-green); text-transform: uppercase; margin-bottom: 5px;">🏆 Trophy Room (18-Holes)</div>
        <div style="${tStyle}"><div style="${labelStyle}">Low Round</div><div style="${valStyle}">${displayScore}</div><div style="${subStyle}">${formatList(lowScores)}</div></div>
        <div style="${tStyle}"><div style="${labelStyle}">Long Drive</div><div style="${valStyle}">${maxDrive === 0 ? '--' : maxDrive + 'y'}</div><div style="${subStyle}">${formatList(longDrives)}</div></div>
        <div style="${tStyle}"><div style="${labelStyle}">Fewest Putts</div><div style="${valStyle}">${minPutts === 999 ? '--' : minPutts}</div><div style="${subStyle}">${formatList(lowPuttsList)}</div></div>
        <div style="${tStyle}"><div style="${labelStyle}">Most FIRs</div><div style="${valStyle}">${maxFir}</div><div style="${subStyle}">${formatList(mostFirsList)}</div></div>
    `;
}

function renderCharts(filteredRounds, actHoles, actPars) {
    const tCtx = document.getElementById('scoringTrendChart'); const cCtx = document.getElementById('clubChart'); const radCtx = document.getElementById('missRadarChart'); const wCtx = document.getElementById('weatherScoreChart');
    if (trendChart) trendChart.destroy(); if (clubChart) clubChart.destroy();
    if (radarChart) radarChart.destroy(); if (weatherChart) weatherChart.destroy();
    
    if (filteredRounds.length === 0) { 
        tCtx.parentElement.style.display = 'none'; cCtx.parentElement.style.display = 'none';
        radCtx.parentElement.style.display = 'none'; wCtx.parentElement.style.display = 'none';
        return; 
    }
    tCtx.parentElement.style.display = 'flex'; cCtx.parentElement.style.display = 'flex'; 
    radCtx.parentElement.style.display = 'block'; wCtx.parentElement.style.display = 'block';
    
    const chartData = [...filteredRounds].reverse(); 
    const activeOverlay = document.getElementById('primary-chart-metric').value;
    let baseScores = [];
    
    chartData.forEach(r => { 
        let targetHoles = r.hole_scores || []; 
        if (actHoles.length < 18) targetHoles = targetHoles.filter(h => actHoles.includes(h.hole_number.toString())); 
        if (actPars.length < 4) targetHoles = targetHoles.filter(h => actPars.includes(h.par.toString())); 
        
        let rs = 0;
        if (targetHoles.length === 0 && (!r.hole_scores || r.hole_scores.length === 0)) rs = r.total_score;
        else rs = targetHoles.reduce((sum, h) => sum + (h.score || 0), 0);
        baseScores.push(rs); 
    });
    
    let trendDatasets = [{ label: actHoles.length < 18 ? 'Filtered Holes Score' : 'Total Score', data: baseScores, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderWidth: 2, pointBackgroundColor: '#121212', pointBorderColor: '#10b981', fill: true, yAxisID: 'y', tension: 0.3 }];
    
    const badge = document.getElementById('trend-badge');
    if (baseScores.length > 1) {
        let n = baseScores.length, sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        for (let i = 0; i < n; i++) { sumX += i; sumY += baseScores[i]; sumXY += i * baseScores[i]; sumXX += i * i; }
        let m = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        let b = (sumY - m * sumX) / n;
        let trendData = baseScores.map((_, i) => m * i + b);
        trendDatasets.push({ label: 'Trendline', data: trendData, borderColor: 'rgba(255, 255, 255, 0.3)', borderWidth: 1, borderDash: [5, 5], pointRadius: 0, fill: false, yAxisID: 'y', pointHoverRadius: 0, hoverBorderColor: 'transparent' });
        
        let strokeShift = (m * (n - 1)).toFixed(1);
        if(strokeShift < 0) { badge.innerHTML = `<span style="color: var(--accent-green);">📈 Trending Better (${strokeShift} Strokes)</span>`; badge.style.display = 'block'; }
        else if(strokeShift > 0) { badge.innerHTML = `<span style="color: #ef4444;">📉 Trending Worse (+${strokeShift} Strokes)</span>`; badge.style.display = 'block'; }
        else { badge.style.display = 'none'; }
    } else { badge.style.display = 'none'; }

    const oColors = { hcp: '#f59e0b', putts: '#3b82f6', fir: '#8b5cf6', gir: '#d946ef', scram: '#10b981', drops: '#ef4444', p3: '#f43f5e', p4: '#14b8a6', p5: '#eab308', sg: '#38bdf8' };
    const oLabels = { hcp: 'Handicap', putts: 'Putts', fir: 'FIR %', gir: 'GIR %', scram: 'Scram %', drops: 'Drops', p3: 'Par 3 Avg', p4: 'Par 4 Avg', p5: 'Par 5 Avg', sg: 'Strokes Gained: Putts' };
    
    if (activeOverlay === 'hcp') {
        let hcpHist = calculateHcpHistory(filteredRounds);
        let hcpData = [...hcpHist].reverse().map(h => h.hcp === "--.-" ? null : parseFloat(h.hcp));
        trendDatasets.push({ label: oLabels['hcp'], data: hcpData, borderColor: oColors['hcp'], backgroundColor: 'transparent', borderWidth: 2, pointBackgroundColor: '#121212', pointBorderColor: oColors['hcp'], yAxisID: 'y1', tension: 0.3 });
    } else if (activeOverlay !== 'none') {
        let oData = [];
        chartData.forEach(r => {
            let p=0, fH=0, fT=0, gH=0, gT=0, sH=0, sT=0, dr=0, p3=0, p3c=0, p4=0, p4c=0, p5=0, p5c=0, sgTot=0, sgCnt=0; 
            let targetHoles = r.hole_scores || []; 
            if (actHoles.length < 18) targetHoles = targetHoles.filter(h => actHoles.includes(h.hole_number.toString())); 
            if (actPars.length < 4) targetHoles = targetHoles.filter(h => actPars.includes(h.par.toString()));
            
            targetHoles.forEach(h => { 
                if (h.putts) p += h.putts; 
                if (h.drops) dr += h.drops; 
                if (h.fir === 'hit' || h.fir === 'miss') { fT++; if (h.fir === 'hit') fH++; } 
                if (h.gir === 'hit' || h.gir === 'miss') { gT++; if (h.gir === 'hit') gH++; if(h.gir === 'miss') { sT++; if(h.score <= h.par) sH++; } } 
                if (h.score && h.par) { let d=h.score-h.par; if(h.par===3){p3+=d; p3c++;} if(h.par===4){p4+=d; p4c++;} if(h.par===5){p5+=d; p5c++;} }
                if (h.putts !== null && h.putt_1_ft > 0) { let exp = getExpectedPutts(h.putt_1_ft); sgTot += (exp - h.putts); sgCnt++; }
            });
            
            if (activeOverlay === 'putts') oData.push(p); if (activeOverlay === 'drops') oData.push(dr); if (activeOverlay === 'fir') oData.push(fT > 0 ? (fH/fT*100).toFixed(0) : null); if (activeOverlay === 'gir') oData.push(gT > 0 ? (gH/gT*100).toFixed(0) : null); if (activeOverlay === 'scram') oData.push(sT > 0 ? (sH/sT*100).toFixed(0) : null);
            if (activeOverlay === 'p3') oData.push(p3c>0 ? (p3/p3c).toFixed(2) : null); if (activeOverlay === 'p4') oData.push(p4c>0 ? (p4/p4c).toFixed(2) : null); if (activeOverlay === 'p5') oData.push(p5c>0 ? (p5/p5c).toFixed(2) : null);
            if (activeOverlay === 'sg') oData.push(sgCnt>0 ? sgTot.toFixed(2) : null);
        });
        trendDatasets.push({ label: oLabels[activeOverlay], data: oData, borderColor: oColors[activeOverlay], backgroundColor: 'transparent', borderWidth: 2, borderDash: [5, 5], pointBackgroundColor: '#121212', pointBorderColor: oColors[activeOverlay], yAxisID: 'y1', tension: 0.3 });
    }
    
    trendChart = new Chart(tCtx.getContext('2d'), { type: 'line', data: { labels: chartData.map(r => new Date(r.date_played).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })), datasets: trendDatasets }, options: { responsive: true, maintainAspectRatio: false, plugins: { tooltip: { callbacks: { label: function(context) { if (context.dataset.label === 'Trendline') return null; return context.dataset.label + ': ' + context.raw; } } }, legend: { display: activeOverlay !== 'none', labels: {color: '#9ca3af', font: {size: 10}} }, title: { display: false } }, scales: { x: { display: false }, y: { type: 'linear', display: true, position: 'left', grid: { color: '#2a2a2a' } }, y1: { type: 'linear', display: activeOverlay !== 'none', position: 'right', grid: { drawOnChartArea: false } } } } });

    // COMBINED CLUB & BAG DISTANCE MODEL GRAPH (INCLUDES RANGE PRACTICE)
    let clubStats = {};
    chartData.forEach(r => {
        let targetHoles = r.hole_scores || []; 
        if (actHoles.length < 18) targetHoles = targetHoles.filter(h => actHoles.includes(h.hole_number.toString())); 
        if (actPars.length < 4) targetHoles = targetHoles.filter(h => actPars.includes(h.par.toString()));
        targetHoles.forEach(h => {
            if (h.drive_club && h.drive_distance > 0 && (!h.drive_exception || h.drive_exception === "")) {
                if(!clubStats[h.drive_club]) clubStats[h.drive_club] = {tot:0, cnt:0};
                clubStats[h.drive_club].tot += h.drive_distance; clubStats[h.drive_club].cnt++;
            }
            if (h.approach_club && h.approach_yd > 0) {
                if(!clubStats[h.approach_club]) clubStats[h.approach_club] = {tot:0, cnt:0};
                clubStats[h.approach_club].tot += h.approach_yd; clubStats[h.approach_club].cnt++;
            }
        });
    });
    
    practiceSessionData.forEach(s => {
        if(!clubStats[s.club]) clubStats[s.club] = {tot:0, cnt:0};
        clubStats[s.club].tot += s.dist; clubStats[s.club].cnt++;
    });

    let cLabels = Object.keys(clubStats).sort((a,b) => (clubStats[b].tot/clubStats[b].cnt) - (clubStats[a].tot/clubStats[a].cnt));
    let cData = cLabels.map(c => Math.round(clubStats[c].tot/clubStats[c].cnt));

    clubChart = new Chart(cCtx.getContext('2d'), { 
        type: 'bar', 
        data: { labels: cLabels, datasets: [{ label: 'Avg Yards', data: cData, backgroundColor: '#3b82f6', borderRadius: 4 }] }, 
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: '#2a2a2a' } }, x: { grid: { display: false } } } }
    });

    // HORIZONTAL BAR CHART - DIRECTIONAL MISS BIAS
    let fL=0, fR=0, gL=0, gR=0, gS=0, gLg=0;
    chartData.forEach(r => {
        let th = r.hole_scores || [];
        if (actHoles.length < 18) th = th.filter(h => actHoles.includes(h.hole_number.toString())); 
        if (actPars.length < 4) th = th.filter(h => actPars.includes(h.par.toString()));
        th.forEach(h => {
            let fA = h.fir_adv || ""; let gA = h.gir_adv || "";
            if(fA.includes('LEFT')) fL++; if(fA.includes('RIGHT')) fR++;
            if(gA.includes('LEFT')) gL++; if(gA.includes('RIGHT')) gR++;
            if(gA.includes('SHORT')) gS++; if(gA.includes('LONG')) gLg++;
        });
    });
    
    radarChart = new Chart(radCtx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: ['GIR Left', 'GIR Right', 'GIR Short', 'GIR Long', 'FIR Left', 'FIR Right'],
            datasets: [{ 
                data: [gL, gR, gS, gLg, fL, fR], 
                backgroundColor: ['#d946ef', '#d946ef', '#d946ef', '#d946ef', '#3b82f6', '#3b82f6'],
                borderRadius: 4
            }]
        },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, grid: { color: '#2a2a2a' } }, y: { grid: { display: false }, ticks: { color: '#9ca3af', font: {weight: 'bold'} } } } }
    });

    // CLIMATE BAR CHART FIX
    let wBuckets = { cold: {tot:0, cnt:0}, optimal: {tot:0, cnt:0}, hot: {tot:0, cnt:0} };
    chartData.forEach(r => {
        if(r.weather_temp && r.total_score > 0) {
            let tempNum = parseInt(r.weather_temp.replace('°C', ''));
            let par = r.hole_scores ? r.hole_scores.reduce((sum, h) => sum + (h.par || 0), 0) : 72;
            let relScore = r.total_score - par;
            
            if(!isNaN(tempNum)) {
                if (tempNum < 15) { wBuckets.cold.tot += relScore; wBuckets.cold.cnt++; }
                else if (tempNum <= 25) { wBuckets.optimal.tot += relScore; wBuckets.optimal.cnt++; }
                else { wBuckets.hot.tot += relScore; wBuckets.hot.cnt++; }
            }
        }
    });

    let wLabels = ['Cold (<15°C)', 'Optimal (15-25°C)', 'Hot (>25°C)'];
    let wData = [
        wBuckets.cold.cnt > 0 ? (wBuckets.cold.tot/wBuckets.cold.cnt).toFixed(1) : 0,
        wBuckets.optimal.cnt > 0 ? (wBuckets.optimal.tot/wBuckets.optimal.cnt).toFixed(1) : 0,
        wBuckets.hot.cnt > 0 ? (wBuckets.hot.tot/wBuckets.hot.cnt).toFixed(1) : 0
    ];

    weatherChart = new Chart(wCtx.getContext('2d'), {
        type: 'bar',
        data: { 
            labels: wLabels, 
            datasets: [{ label: 'Avg Strokes To Par', data: wData, backgroundColor: ['#3b82f6', '#10b981', '#ef4444'], borderRadius: 4 }] 
        },
        options: { 
            responsive: true, maintainAspectRatio: false, 
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `Avg: ${c.raw > 0 ? '+'+c.raw : (c.raw===0?'E':c.raw)}` } } }, 
            scales: { y: { title: { display: true, text: 'Avg Strokes To Par', color:'#9ca3af', font:{size:10} }, grid: { color: '#2a2a2a' } }, x: { grid: { display: false } } } 
        }
    });
}

window.updateAnalytics = function() {
    const timeframe = document.getElementById('filter-timeframe').value; 
    const holeFilter = document.getElementById('filter-hole-count').value; 
    localStorage.setItem('golf_filter_timeframe', timeframe);
    localStorage.setItem('golf_filter_hole_count', holeFilter);
    const actCrs = Array.from(document.querySelectorAll('.course-cb:checked')).map(cb => cb.value.replace(/&quot;/g, '"').replace(/&#39;/g, "'")); const actYrs = Array.from(document.querySelectorAll('.year-cb:checked')).map(cb => cb.value); const actMonths = Array.from(document.querySelectorAll('.month-cb:checked')).map(cb => cb.value); const actPars = Array.from(document.querySelectorAll('.par-cb:checked')).map(cb => cb.value); const actHoles = Array.from(document.querySelectorAll('.hole-cb:checked')).map(cb => cb.value);
    
    let fRounds = masterAnalyticsData.filter(r => { 
        if (!actCrs.includes(r.course_name.trim())) return false; 
        
        const d = new Date(r.date_played); 
        if (timeframe === 'season' && d.getUTCFullYear().toString() !== new Date().getUTCFullYear().toString()) return false;
        if (timeframe !== 'season' && !actYrs.includes(d.getUTCFullYear().toString())) return false; 
        if (actMonths.length < 12 && !actMonths.includes((d.getUTCMonth() + 1).toString())) return false; 
        
        if(r.hole_scores && r.hole_scores.length > 0) {
            const playedHoles = r.hole_scores.filter(h => h.score && h.score > 0).length; 
            if (holeFilter === '18' && playedHoles < 18) return false;
            if (holeFilter === '9' && (playedHoles < 9 || playedHoles >= 18)) return false; 
        } else if (holeFilter === '9') {
            return false; 
        }
        
        let isFullyFiltered = actHoles.length < 18 || actPars.length < 4;
        if (isFullyFiltered && (!r.hole_scores || r.hole_scores.length === 0)) return false;

        if (actHoles.length < 18) { const hasHole = r.hole_scores.some(h => actHoles.includes(h.hole_number.toString()) && h.score && h.score > 0); if(!hasHole) return false; } 
        if (actPars.length < 4) { const hasPar = r.hole_scores.some(h => actPars.includes(h.par.toString()) && h.score && h.score > 0); if(!hasPar) return false; } 
        return true; 
    });
    
    currentFilteredRounds = fRounds;

    const t = document.getElementById('analytics-data-table');
    if(fRounds.length === 0) { t.innerHTML = `<thead><tr><th>Metric</th><th>Total</th><th>Avg</th><th>%</th></tr></thead><tbody><tr><td colspan="4" style="text-align:center; padding: 20px; color: var(--text-muted);">No data matches these filters.<br><span style="font-size:11px;color:var(--text-muted);">Total Rounds on Account: ${masterAnalyticsData.length}</span></td></tr></tbody>`; return; }

    if (timeframe.startsWith('last')) fRounds = fRounds.slice(0, parseInt(timeframe.replace('last', '')));
    document.getElementById('hcp-display').innerText = calculateHandicap(fRounds); renderCharts(fRounds, actHoles, actPars); 
    
    if(typeof window.generateInsights === 'function') {
        document.getElementById('ai-insights-box').innerHTML = window.generateInsights(fRounds);
    }
    
    updateTrophyRoom(fRounds);
    
    let s = { hio:0, alb:0, egl:0, brd:0, par:0, bog:0, dbl:0, tpl:0, qd:0, putts:0, pHP:0, drp:0, fH:0, fT:0, gH:0, gT:0, ssH:0, ssT:0, scramOpp:0, scramHit:0, tpOpp:0, tpHit:0, sgTot:0, sgCnt:0 }; let totalStrokes = 0; let totalHolesCount = 0; let p3Tot=0, p3Cnt=0, p4Tot=0, p4Cnt=0, p5Tot=0, p5Cnt=0;
    let f9Strokes=0, f9Par=0, b9Strokes=0, b9Par=0;

    fRounds.forEach(r => { 
        let targetHoles = r.hole_scores || []; 
        if (targetHoles.length === 0) { totalStrokes += r.total_score; totalHolesCount += 18; s.putts += r.total_putts || 0; s.pHP += 18; return; }
        
        if (actHoles.length < 18) targetHoles = targetHoles.filter(h => actHoles.includes(h.hole_number.toString())); 
        if (actPars.length < 4) targetHoles = targetHoles.filter(h => actPars.includes(h.par.toString())); 
        
        targetHoles.forEach(h => { 
            if (!h.score) return; 
            totalStrokes += h.score; 
            totalHolesCount++; 
            
            if (h.par) {
                const d = h.score - h.par; 
                if (h.par === 3) { p3Tot += h.score; p3Cnt++; } if (h.par === 4) { p4Tot += h.score; p4Cnt++; } if (h.par === 5) { p5Tot += h.score; p5Cnt++; } 
                if(h.score===1) s.hio++; else if(d===-3) s.alb++; else if(d===-2) s.egl++; else if(d===-1) s.brd++; else if(d===0) s.par++; else if(d===1) s.bog++; else if(d===2) s.dbl++; else if(d===3) s.tpl++; else if(d>=4) s.qd++; 
                
                if(h.hole_number <= 9) { f9Strokes += h.score; f9Par += h.par; } else { b9Strokes += h.score; b9Par += h.par; }
            }
            
            if(h.putts !== null && h.putts !== "") {
                s.putts+=h.putts; s.pHP++; 
                s.tpOpp++; if(h.putts < 3) s.tpHit++;
                
                if(h.putt_1_ft > 0) {
                    let exp = window.getExpectedPutts(h.putt_1_ft);
                    s.sgTot += (exp - h.putts);
                    s.sgCnt++;
                }
            } 
            if(h.drops) s.drp+=h.drops; 
            if(h.fir==='hit'||h.fir==='miss') { s.fT++; if(h.fir==='hit') s.fH++; } 
            if(h.gir==='hit'||h.gir==='miss') { 
                s.gT++; 
                if(h.gir==='hit') s.gH++; 
                if(h.gir==='miss') { s.scramOpp++; if(h.score <= h.par) s.scramHit++; }
            } 
            if(h.sand_save==='yes'||h.sand_save==='no' || h.sand_save==='1' || h.sand_save==='2' || h.sand_save==='3+') { s.ssT++; if(h.sand_save==='yes' || h.sand_save==='1') s.ssH++; } 
        }) 
    });
    
    if(totalHolesCount === 0) { t.innerHTML = `<thead><tr><th>Metric</th><th>Total</th><th>Avg</th><th>%</th></tr></thead><tbody><tr><td colspan="4" style="text-align:center; padding: 20px; color: var(--text-muted);">No data matches these filters.<br><span style="font-size:11px;color:var(--text-muted);">Total Rounds on Account: ${masterAnalyticsData.length}</span></td></tr></tbody>`; return; }
    const cA = (tot) => ((tot / totalHolesCount) * 18).toFixed(1); const cP = (tot) => ((tot / totalHolesCount) * 100).toFixed(1) + '%';
    t.innerHTML = `<thead><tr><th>Metric</th><th>Total</th><th>Avg / 18-Holes</th><th>Hole %</th></tr></thead><tbody>
        <tr style="background:rgba(0,0,0,0.2); color:var(--accent-green);"><td colspan="4" style="text-align:left; font-size:12px;">SCORING</td></tr>
        <tr onclick="openStatGraph('Hole Score', 'score')"><td>${actHoles.length < 18 ? 'Hole Score' : 'Total Score'}</td><td>${totalStrokes}</td><td>${cA(totalStrokes)}</td><td>-</td></tr>
        <tr onclick="openStatGraph('Hole in One', 'hio')"><td>Hole in One</td><td>${s.hio}</td><td>${cA(s.hio)}</td><td>${cP(s.hio)}</td></tr>
        <tr onclick="openStatGraph('Eagle', 'egl')"><td>Eagle</td><td>${s.egl}</td><td>${cA(s.egl)}</td><td>${cP(s.egl)}</td></tr>
        <tr onclick="openStatGraph('Birdie', 'brd')"><td>Birdie</td><td>${s.brd}</td><td>${cA(s.brd)}</td><td>${cP(s.brd)}</td></tr>
        <tr onclick="openStatGraph('Par', 'par')"><td>Par</td><td>${s.par}</td><td>${cA(s.par)}</td><td>${cP(s.par)}</td></tr>
        <tr onclick="openStatGraph('Bogey', 'bog')"><td>Bogey</td><td>${s.bog}</td><td>${cA(s.bog)}</td><td>${cP(s.bog)}</td></tr>
        <tr onclick="openStatGraph('Double Bogey', 'dbl')"><td>Double Bogey</td><td>${s.dbl}</td><td>${cA(s.dbl)}</td><td>${cP(s.dbl)}</td></tr>
        <tr onclick="openStatGraph('Triple Bogey', 'tpl')"><td>Triple Bogey</td><td>${s.tpl}</td><td>${cA(s.tpl)}</td><td>${cP(s.tpl)}</td></tr>
        <tr onclick="openStatGraph('Quad+ Bogey', 'qd')"><td>Quad+ Bogey</td><td>${s.qd}</td><td>${cA(s.qd)}</td><td>${cP(s.qd)}</td></tr>
        <tr style="background:rgba(0,0,0,0.2); color:var(--accent-green); border-top: 2px solid var(--border-color);"><td colspan="4" style="text-align:left; font-size:12px;">SCORING AVERAGES</td></tr>
        <tr onclick="openStatGraph('Par 3 Avg', 'p3')"><td>Scoring Avg (Par 3)</td><td>-</td><td>${p3Cnt > 0 ? (p3Tot/p3Cnt).toFixed(2) : '-'}</td><td>-</td></tr>
        <tr onclick="openStatGraph('Par 4 Avg', 'p4')"><td>Scoring Avg (Par 4)</td><td>-</td><td>${p4Cnt > 0 ? (p4Tot/p4Cnt).toFixed(2) : '-'}</td><td>-</td></tr>
        <tr onclick="openStatGraph('Par 5 Avg', 'p5')"><td>Scoring Avg (Par 5)</td><td>-</td><td>${p5Cnt > 0 ? (p5Tot/p5Cnt).toFixed(2) : '-'}</td><td>-</td></tr>
        <tr><td>Front 9 Scoring (+/- Par)</td><td>-</td><td>${f9Par > 0 ? getRelativeParString(f9Strokes, f9Par) : '-'}</td><td>-</td></tr>
        <tr><td>Back 9 Scoring (+/- Par)</td><td>-</td><td>${b9Par > 0 ? getRelativeParString(b9Strokes, b9Par) : '-'}</td><td>-</td></tr>
        <tr style="background:rgba(0,0,0,0.2); color:var(--accent-green); border-top: 2px solid var(--border-color);"><td colspan="4" style="text-align:left; font-size:12px;">EXECUTION</td></tr>
        <tr onclick="openStatGraph('Strokes Gained: Putts', 'sgPutt')"><td style="color:var(--accent-green);">Strokes Gained (Putts)</td><td>-</td><td>${s.sgCnt > 0 ? (s.sgTot > 0 ? '+'+s.sgTot.toFixed(2) : s.sgTot.toFixed(2)) : '-'}</td><td>-</td></tr>
        <tr onclick="openStatGraph('Putts', 'putts')"><td>Putts</td><td>${s.putts}</td><td>${s.pHP > 0 ? ((s.putts / s.pHP) * 18).toFixed(1) : '0.0'}</td><td>-</td></tr>
        <tr onclick="openStatGraph('3-Putt Avoidance %', 'tpAvoid')"><td>3-Putt Avoidance</td><td>${s.tpHit} / ${s.tpOpp}</td><td>-</td><td>${s.tpOpp > 0 ? ((s.tpHit / s.tpOpp) * 100).toFixed(1) + '%' : '0.0%'}</td></tr>
        <tr onclick="openStatGraph('Accuracy (FIR + GIR)', 'acc')"><td>Accuracy (FIR + GIR)</td><td>${s.fH + s.gH} / ${s.fT + s.gT}</td><td>-</td><td>${(s.fT + s.gT) > 0 ? (((s.fH + s.gH) / (s.fT + s.gT)) * 100).toFixed(1) + '%' : '0.0%'}</td></tr>
        <tr onclick="openStatGraph('FIR %', 'fir')"><td>FIR</td><td>${s.fH} / ${s.fT}</td><td>${s.fT > 0 ? ((s.fH / totalHolesCount) * 18).toFixed(1) : '0.0'}</td><td>${s.fT > 0 ? ((s.fH / s.fT) * 100).toFixed(1) + '%' : '0.0%'}</td></tr>
        <tr onclick="openStatGraph('GIR %', 'gir')"><td>GIR</td><td>${s.gH} / ${s.gT}</td><td>${s.gT > 0 ? ((s.gH / totalHolesCount) * 18).toFixed(1) : '0.0'}</td><td>${s.gT > 0 ? ((s.gH / s.gT) * 100).toFixed(1) + '%' : '0.0%'}</td></tr>
        <tr onclick="openStatGraph('Scrambling %', 'scram')"><td>Scrambling (Missed GIR)</td><td>${s.scramHit} / ${s.scramOpp}</td><td>-</td><td>${s.scramOpp > 0 ? ((s.scramHit / s.scramOpp) * 100).toFixed(1) + '%' : '0.0%'}</td></tr>
        <tr onclick="openStatGraph('Sand Save %', 'ss')"><td>Bunker Recoveries</td><td>${s.ssH} / ${s.ssT}</td><td>${s.ssT > 0 ? ((s.ssH / totalHolesCount) * 18).toFixed(1) : '0.0'}</td><td>${s.ssT > 0 ? ((s.ssH / s.ssT) * 100).toFixed(1) + '%' : '0.0%'}</td></tr>
        <tr onclick="openStatGraph('Drops', 'drops')"><td>Drops (Penalty)</td><td>${s.drp}</td><td>${cA(s.drp)}</td><td>-</td></tr>
    </tbody>`;
}

initializeApp();
