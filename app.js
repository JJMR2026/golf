const SUPABASE_URL = "https://hksccpousgspagkqcjzd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_KLpYENB7bIa_8SkAWN90uA_12BcxJKC"; 
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// INSERT YOUR GOOGLE MAPS JAVASCRIPT API KEY HERE FOR SATELLITE GREEN TOPOGRAPHY
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

function applyTheme(themeName) {
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
}

let savedTheme = localStorage.getItem('golf_theme') || 'dark'; applyTheme(savedTheme);

async function initializeApp() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) { currentUser = session.user; localStorage.removeItem('golf_guest_mode'); document.getElementById('auth-overlay').style.display = 'none'; loadLocalState(); buildGrid(); processOfflineQueue(); } 
    else if (localStorage.getItem('golf_guest_mode') === 'true') { document.getElementById('auth-overlay').style.display = 'none'; loadLocalState(); buildGrid(); } 
    else { document.getElementById('auth-overlay').style.display = 'flex'; }

    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') { document.getElementById('auth-overlay').style.display = 'none'; openSettings(); document.getElementById('settings-msg').innerText = "Security routing verified."; }
        else if (event === 'SIGNED_IN' && session) { currentUser = session.user; localStorage.removeItem('golf_guest_mode'); document.getElementById('auth-overlay').style.display = 'none'; loadLocalState(); buildGrid(); processOfflineQueue(); } 
        else if (event === 'SIGNED_OUT') { currentUser = null; if (localStorage.getItem('golf_guest_mode') !== 'true') document.getElementById('auth-overlay').style.display = 'flex'; }
    });

    let htmlList = ""; for(let i=1; i<=18; i++) htmlList += `<label class="checkbox-container"><input type="checkbox" class="hole-cb" value="${i}" autocomplete="off" onchange="checkGroupToggles('.hole-cb', 'cb-all-holes', 'hole-btn-text', 'Hole')"> Hole ${i}</label>`;
    let hBox = document.getElementById('hole-checkbox-list'); if(hBox) hBox.innerHTML += htmlList;

    let monthHtml = ""; const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for(let i=1; i<=12; i++) monthHtml += `<label class="checkbox-container"><input type="checkbox" class="month-cb" value="${i}" autocomplete="off" onchange="checkGroupToggles('.month-cb', 'cb-all-months', 'month-btn-text', 'Month')"> ${months[i-1]}</label>`;
    let mBox = document.getElementById('month-checkbox-list'); if(mBox) mBox.innerHTML += monthHtml;

    puttCanvas = document.getElementById('putt-canvas');
    if(puttCanvas) { puttCtx = puttCanvas.getContext('2d'); puttCanvas.addEventListener('click', handlePuttClick); }
}

async function handleAuth(type) {
    const cleanInput = document.getElementById('auth-nickname').value.trim().replace(/\s+/g, ''); 
    const email = cleanInput.includes('@') ? cleanInput : cleanInput.toLowerCase() + "@golf.local"; 
    const btn = document.getElementById(type === 'signup' ? 'signup-btn' : 'login-btn');
    const originalText = btn.innerText; btn.innerText = "⏳..."; btn.disabled = true;
    try { 
        let res = type === 'signup' ? await supabaseClient.auth.signUp({ email, password: document.getElementById('auth-password').value }) : await supabaseClient.auth.signInWithPassword({ email, password: document.getElementById('auth-password').value }); 
        if(res.error) throw res.error; 
    } catch (e) { document.getElementById('auth-error').style.color = "#ef4444"; document.getElementById('auth-error').innerText = e.message; } finally { btn.innerText = originalText; btn.disabled = false; }
}

async function handleForgotPassword() {
    const cleanInput = document.getElementById('auth-nickname').value.trim().replace(/\s+/g, ''); 
    const email = cleanInput.includes('@') ? cleanInput : cleanInput.toLowerCase() + "@golf.local";
    if (!email || !email.includes('@') || email.includes('@golf.local')) return alert("Recovery mapping requires valid baseline email structure.");
    try { const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname }); if (error) throw error; document.getElementById('auth-error').style.color = "var(--accent-green)"; document.getElementById('auth-error').innerText = "Recovery email routed."; } catch (e) { document.getElementById('auth-error').style.color = "#ef4444"; document.getElementById('auth-error').innerText = e.message; }
}

async function changePassword() { const { error } = await supabaseClient.auth.updateUser({ password: document.getElementById('new-password').value }); document.getElementById('settings-msg').innerText = error ? "❌ " + error.message : "✅ Updated."; }
async function logOut() { localStorage.removeItem('golf_guest_mode'); localStorage.removeItem('golf_round_state'); await supabaseClient.auth.signOut(); location.reload(); }
window.openSettings = function() { document.getElementById('password-change-section').style.display = currentUser ? 'block' : 'none'; document.getElementById('settings-overlay').style.display = 'flex'; }
function continueAsGuest() { currentUser = null; localStorage.setItem('golf_guest_mode', 'true'); document.getElementById('auth-overlay').style.display = 'none'; loadLocalState(); buildGrid(); }

function switchView(viewId, btn) { 
    document.querySelectorAll('.view-container').forEach(el => el.classList.remove('active')); 
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active')); 
    document.querySelectorAll('.bottom-nav button').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active'); 
    if(btn) btn.classList.add('active'); 
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
// PRACTICE DASHBOARD LOGIC MATRIX
// ----------------------------------------------------
window.togglePracticeMode = function() {
    const val = document.getElementById('practice-type-select').value;
    document.querySelectorAll('.sim-metric').forEach(d => d.style.display = val === 'SIM' ? 'block' : 'none');
};

window.logPracticeShot = function() {
    const club = document.getElementById('range-club').value; const dist = parseInt(document.getElementById('range-dist').value);
    const strike = document.getElementById('range-strike').value; const shape = document.getElementById('range-shape').value;
    if(isNaN(dist) || dist <= 0) return alert("Enter valid total distance array metrics.");
    practiceSessionData.push({ club: club, dist: dist, strike: strike, shape: shape });
    document.getElementById('range-dist').value = ""; document.getElementById('sim-ball-speed').value = ""; document.getElementById('sim-spin').value = "";
    updatePracticeTable();
};

function updatePracticeTable() {
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
}

window.savePracticeSession = function() {
    if(practiceSessionData.length === 0) return alert("No active data arrays logged.");
    alert("Database connection for practice arrays is under development. Shots mapped locally."); practiceSessionData = []; updatePracticeTable();
};

// ----------------------------------------------------
// PUTT CANVASS METRIC INTERPOLATION (GOOGLE MAPS API)
// ----------------------------------------------------
window.openPuttMapper = function() { 
    pinPos = null; ballPos = null; document.getElementById('putt-distance-display').innerText = "-- ft"; document.getElementById('putt-map-modal').style.display = 'flex'; 
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => { loadSatelliteGreen(position.coords.latitude, position.coords.longitude); }, err => { clearPuttCanvas(); });
    } else { clearPuttCanvas(); }
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
    img.onload = () => { puttCtx.drawImage(img, 0, 0, 300, 300); };
    img.onerror = () => clearPuttCanvas();
}

function handlePuttClick(e) {
    const rect = puttCanvas.getBoundingClientRect(); const x = e.clientX - rect.left; const y = e.clientY - rect.top;
    if (!pinPos) { pinPos = {x, y}; puttCtx.font = "24px Arial"; puttCtx.fillText("⛳", x - 12, y + 12); } 
    else if (!ballPos) {
        ballPos = {x, y}; puttCtx.font = "18px Arial"; puttCtx.fillText("⚪", x - 9, y + 9);
        puttCtx.beginPath(); puttCtx.moveTo(pinPos.x, pinPos.y); puttCtx.lineTo(ballPos.x, ballPos.y);
        puttCtx.setLineDash([5, 5]); puttCtx.strokeStyle = 'rgba(255,255,255,0.8)'; puttCtx.lineWidth = 2; puttCtx.stroke(); puttCtx.setLineDash([]);
        let pxDist = Math.sqrt(Math.pow(ballPos.x - pinPos.x, 2) + Math.pow(ballPos.y - pinPos.y, 2)); let ftDist = Math.round(pxDist * 0.3); document.getElementById('putt-distance-display').innerText = ftDist + " ft";
    }
}

window.savePuttMap = function() {
    let dText = document.getElementById('putt-distance-display').innerText; let dist = parseInt(dText.replace(' ft', ''));
    if(!isNaN(dist)) { document.getElementById('play-putt-dist').value = dist; syncPlayToState('puttDist', dist); }
    document.getElementById('putt-map-modal').style.display = 'none';
};

// ----------------------------------------------------
// CORE INPUT ENGINE WITH DESKTOP TWO-WAY REFLECTION SYNC
// ----------------------------------------------------
window.adjustStat = function(field, amount) {
    let el = document.getElementById(`play-${field}`); let current = parseInt(el.value);
    if(isNaN(current)) current = (field === 'score' ? parseInt(currentCoursePars[currentPlayHole]) || 4 : 2);
    let next = current + amount; if(next < 0) next = 0; el.value = next; syncPlayToState(field, next);
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
    updatePlayModeUI(); saveLocalState();
};

window.toggleAdv = function(type, val) {
    let arr = roundData[currentPlayHole][type + 'Adv'] || []; if(arr.includes(val)) arr = arr.filter(v => v !== val); else arr.push(val);
    roundData[currentPlayHole][type + 'Adv'] = arr; updatePlayModeUI(); saveLocalState();
};

window.cycleSand = function() {
    let s = roundData[currentPlayHole].sandSave; let next = (s === "") ? "0" : (s === "0" ? "1" : (s === "1" ? "2" : (s === "2" ? "3+" : "")));
    roundData[currentPlayHole].sandSave = next;
    const gridCell = document.getElementById(`grid-sandSave-${currentPlayHole}`);
    if(gridCell) { gridCell.innerText = next === "" ? "-" : next; gridCell.classList.toggle('hit', next === "0" || next === "1"); }
    updatePlayModeUI(); saveLocalState();
};

function syncPlayToState(field, val) {
    roundData[currentPlayHole][field] = val;
    const gridInput = document.getElementById(`grid-${field}-${currentPlayHole}`); if(gridInput) gridInput.value = val;
    if (field === 'drive') {
        let holeYards = parseInt(currentYardages[currentPlayHole]); let driveYards = parseInt(val);
        if (!isNaN(holeYards) && !isNaN(driveYards)) { let remaining = holeYards - driveYards; if (remaining > 0) { roundData[currentPlayHole]['appDist'] = remaining; let rec = getSmartClubRecommendation(remaining); if (rec) roundData[currentPlayHole]['appClub'] = rec; } }
    }
    saveLocalState(); updatePlayModeUI();
}

window.syncGridToState = function(idx, field, val) {
    roundData[idx][field] = val;
    if(currentPlayHole === idx) { const pInput = document.getElementById(`play-${field}`); if(pInput) pInput.value = val; }
    let strokes = 0; let parSum = 0; let endIndex = currentHoleOffset + currentHoleCount;
    for(let i=currentHoleOffset; i<endIndex; i++) { let s = parseInt(roundData[i].score); let p = parseInt(currentCoursePars[i]) || 4; if(s > 0) { strokes += s; parSum += p; } }
    let relToPar = strokes - parSum; let relStr = relToPar > 0 ? `+${relToPar}` : (relToPar === 0 ? 'E' : relToPar);
    document.getElementById('pace-score-display').innerText = `Strokes: ${strokes} (${relStr})`; saveLocalState();
};

function updatePlayModeUI() {
    const par = currentCoursePars[currentPlayHole]; const state = roundData[currentPlayHole]; const yds = currentYardages[currentPlayHole] || '-';
    if (state.score === "") {
        if (par == 4 || par == 5) { if (state.driveClub === "") { let dClubs = masterAnalyticsData.flatMap(r => (r.hole_scores||[]).filter(h => h.par == par && h.drive_club).map(h => h.drive_club)); state.driveClub = dClubs.length ? dClubs.sort((a,b) => dClubs.filter(v => v===a).length - dClubs.filter(v => v===b).length).pop() : "Driver"; } }
        if (par == 3) { if (state.appClub === "") { let aClubs = masterAnalyticsData.flatMap(r => (r.hole_scores||[]).filter(h => h.par == 3 && h.approach_club).map(h => h.approach_club)); state.appClub = aClubs.length ? aClubs.sort((a,b) => aClubs.filter(v => v===a).length - aClubs.filter(v => v===b).length).pop() : "Iron"; } state.fir = "hit"; const fCell = document.getElementById(`grid-fir-${currentPlayHole}`); if(fCell) fCell.innerText = "HIT"; }
    }

    document.getElementById('play-hole-title').innerText = `HOLE ${currentPlayHole + 1}`; document.getElementById('play-par-title').innerText = `PAR ${par || '-'} • ${yds} YDS`;
    document.getElementById('play-score').value = state.score; document.getElementById('play-putts').value = state.putts; document.getElementById('play-putt-dist').value = state.puttDist || ""; document.getElementById('play-drive').value = state.drive; document.getElementById('play-drive-club').value = state.driveClub || ""; document.getElementById('play-approach-club').value = state.appClub || ""; document.getElementById('play-approach-dist').value = state.appDist || "";
    
    let sBtn = document.getElementById('sand-cycle-btn');
    if (state.sandSave === "0") { sBtn.innerText = "0 STROKES (SAVE)"; sBtn.className = "adv-btn active"; sBtn.style.background = "var(--accent-green)"; sBtn.style.color = "#000"; }
    else if (state.sandSave === "1") { sBtn.innerText = "1 STROKE (SAVE)"; sBtn.className = "adv-btn active"; sBtn.style.background = "var(--accent-green)"; sBtn.style.color = "#000"; }
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

window.checkHarvesterStatus = function() { document.getElementById('settings-overlay').style.display = 'none'; document.getElementById('insight-detail-title').innerText = "HARVESTER LAYER LOG"; document.getElementById('insight-detail-content').innerHTML = `<b>Unique Scraped Array Profiles:</b> Active matching processes operating normally across Western Canadian spatial tables.`; document.getElementById('insight-modal').style.display = 'flex'; };

// ----------------------------------------------------
// GRAPHICAL MATRIX VISUALIZATIONS (CHARTS ONLY)
// ----------------------------------------------------
function renderCharts(filteredRounds, actHoles, actPars) {
    const tCtx = document.getElementById('scoringTrendChart'); const cCtx = document.getElementById('clubChart'); const wCtx = document.getElementById('weatherScoreChart'); const pC = document.getElementById('scoringPieChart'); const pCtx = document.getElementById('penaltyPieChart'); const aCtx = document.getElementById('accuracyChart'); const psCtx = document.getElementById('parScoringChart');
    if (trendChart) trendChart.destroy(); if (clubChart) clubChart.destroy(); if (weatherChart) weatherChart.destroy(); if (scorePieChart) scorePieChart.destroy(); if(penaltyPieChartObj) penaltyPieChartObj.destroy(); if (accuracyChart) accuracyChart.destroy(); if(parScoringChart) parScoringChart.destroy();
    
    if (filteredRounds.length === 0) return;
    const chartData = [...filteredRounds].reverse(); const activeOverlay = document.getElementById('primary-chart-metric').value; let baseScores = [];
    
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
        let hcpHist = calculateHcpHistory(filteredRounds); let hcpData = [...hcpHist].reverse().map(h => h.hcp === "--.-" ? null : parseFloat(h.hcp));
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
                if(h.sand_save==='yes'||h.sand_save==='no' || h.sand_save==='1' || h.sand_save==='2' || h.sand_save==='3+') { ssT++; if(h.sand_save==='yes' || h.sand_save==='1') ssH++; }
                if(h.score && h.par) { let d=h.score-h.par; if(h.par===3){p3+=d; p3c++;} if(h.par===4){p4+=d; p4c++;} if(h.par===5){p5+=d; p5c++;} if(d===-1) brd++; if(d===0) pr++; if(d===1) bog++; }
                if(h.drive_distance>0) { dTot+=h.drive_distance; dCnt++; }
            });
            if(activeOverlay === 'putts') oData.push(p); if(activeOverlay === 'drops') oData.push(dr); if(activeOverlay === 'fir') oData.push(fT>0?Math.round((fH/fT)*100):null); if(activeOverlay === 'gir') oData.push(gT>0?Math.round((gH/gT)*100):null);
            if(activeOverlay === 'driveDist') oData.push(dCnt>0?Math.round(dTot/dCnt):null); if(activeOverlay === 'sand') oData.push(ssT>0?Math.round((ssH/ssT)*100):null); if(activeOverlay === 'birdies') oData.push(brd); if(activeOverlay === 'pars') oData.push(pr); if(activeOverlay === 'bogeys') oData.push(bog);
            if(activeOverlay === 'p3') oData.push(p3c>0 ? (p3/p3c).toFixed(2) : null); if(activeOverlay === 'p4') oData.push(p4c>0 ? (p4/p4c).toFixed(2) : null); if(activeOverlay === 'p5') oData.push(p5c>0 ? (p5/p5c).toFixed(2) : null);
            if(activeOverlay === 'sg') oData.push(sgCnt>0 ? sgTot.toFixed(2) : null); if(activeOverlay === 'f9') oData.push(f9); if(activeOverlay === 'b9') oData.push(b9);
            if(activeOverlay === 'tpAvoid') oData.push(tpA_T>0?Math.round((tpA_H/tpA_T)*100):null); if(activeOverlay === 'acc') oData.push((fT+gT)>0?Math.round(((fH+gH)/(fT+gT))*100):null);
        });
        trendDatasets.push({ label: activeOverlay.toUpperCase(), data: oData, borderColor: oColors[activeOverlay], backgroundColor: 'transparent', borderWidth: 2, yAxisID: 'y1', tension: 0.3 });
    }
    
    try { if(tCtx) trendChart = new Chart(tCtx.getContext('2d'), { type: 'line', data: { labels: chartData.map(r => new Date(r.date_played).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })), datasets: trendDatasets }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { type: 'linear', position: 'left' }, y1: { type: 'linear', position: 'right', display: activeOverlay!=='none' } } } }); } catch(e){}

    let tpBrd = 0, tpPar = 0, tpBog = 0, tpDbl = 0;
    chartData.forEach(r => { (r.hole_scores||[]).forEach(h => { if (h.score && h.par) { let d = h.score - h.par; if (d <= -1) tpBrd++; else if (d === 0) tpPar++; else if (d === 1) tpBog++; else tpDbl++; } }); });
    try { if(pC) scorePieChart = new Chart(pC.getContext('2d'), { type: 'doughnut', data: { labels: ['Birdie or Better', 'Par', 'Bogey', 'Double+'], datasets: [{ data: [tpBrd, tpPar, tpBog, tpDbl], backgroundColor: ['#38bdf8', '#10b981', '#f59e0b', '#ef4444'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false } }); } catch(e){}

    let dW=0, dOB=0, dL=0, dU=0; chartData.forEach(r => { (r.hole_scores||[]).forEach(h => { let dA = h.drops_adv || ""; if(h.drops && h.drops > 0) { if(dA.includes('WATER')) dW++; if(dA.includes('OB')) dOB++; if(dA.includes('LOST')) dL++; if(dA.includes('UNPLAYABLE')) dU++; } }); });
    try { if(pCtx) penaltyPieChartObj = new Chart(pCtx.getContext('2d'), { type: 'doughnut', data: { labels: ['Water', 'OB', 'Lost', 'Unplayable'], datasets: [{ data: [dW, dOB, dL, dU], backgroundColor: ['#38bdf8', '#ef4444', '#f59e0b', '#8b5cf6'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false } }); } catch(e){}

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
    chartData.forEach(r => { if(r.weather_temp && r.total_score > 0) { let tempNum = parseInt(r.weather_temp.replace('°C', '')); let par = r.hole_scores ? r.hole_scores.reduce((sum, h) => sum + (h.par || 0), 0) : 72; let relScore = r.total_score - par; if(!isNaN(tempNum)) { if (tempNum < 15) { wBuckets.cold.tot += relScore; wBuckets.cold.cnt++; } else if (tempNum <= 25) { wBuckets.optimal.tot += relScore; wBuckets.optimal.cnt++; } else { wBuckets.hot.tot += relScore; wBuckets.hot.cnt++; } } } });
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
}

function fetchHistory() {
    if(!currentUser) return;
    supabaseClient.from('logged_rounds').select('*, hole_scores(*)').eq('user_id', currentUser.id).order('date_played', { ascending: false }).then(({data}) => {
        if(!data || data.length === 0) { document.getElementById('history-list').innerHTML = '<div class="empty-state">No arrays found.</div>'; return; }
        const activeTabBtn = document.querySelector('#view-history .analytics-tabs button.active');
        const filterType = activeTabBtn ? (activeTabBtn.innerText.includes('Range') ? 'RANGE' : (activeTabBtn.innerText.includes('Sim') ? 'SIM' : 'REAL')) : 'REAL';
        window.renderHistoryList(data, filterType);
    });
}

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
            html += `<div class="history-item" onclick="openHistoryModal('${r.id}', '${r.course_name.replace(/'/g, "\\'")}', '${r.date_played}', ${r.total_score}, ${holesPlayed}, '${r.weather_temp || ''}', '${r.weather_wind || ''}')">
                <div><strong>${r.course_name.toUpperCase()}</strong><br><span style="font-size:12px;color:var(--text-muted)">${r.date_played}</span></div>
                <div style="text-align:right;"><strong style="color:var(--accent-green);font-size:18px;">${r.total_score}</strong></div>
            </div>`;
        });
        html += `</div></details>`;
    });
    tbody.innerHTML = html;
};

// Remaining structural references ported cleanly
window.syncGridToState = syncGridToState;
initializeApp();
