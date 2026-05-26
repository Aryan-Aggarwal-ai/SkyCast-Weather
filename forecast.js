/* ═══════════════════════════════════════════════════════════════
   forecast.js — FORECAST PAGE
═══════════════════════════════════════════════════════════════ */

(function initForecast() {
  const s = loadSettings();
  applySettings(s);
  loadWeatherFromStorage();
  if (currentWeather && forecastDays) {
    renderForecast(forecastDays, currentWeather);
    applyWeatherTheme(currentWeather);
  } else {
    if (s.autoDetect) getLocation();
    else if (s.defaultCity) geocodeAndFetch(s.defaultCity);
  }
})();

function dashSearch() {
  const city = document.getElementById('dashSearchInput').value.trim();
  if (city) geocodeAndFetch(city);
}

function onPageWeatherLoaded() {
  if (currentWeather && forecastDays) {
    renderForecast(forecastDays, currentWeather);
    applyWeatherTheme(currentWeather);
  }
}

/* ── Main Forecast Renderer ─────────────────────────────── */
function renderForecast(days, current) {
  setText('forecastCityLabel',
    `${current.city_name}${current.country_code ? ', ' + current.country_code : ''}`);
  document.getElementById('dashSearchInput').value = current.city_name;

  renderHourlyStrip(current);
  renderDailyCards(days);
  drawTempChart(days);
  applySettings(loadSettings());
}

/* ── Hourly Strip ───────────────────────────────────────── */
function renderHourlyStrip(current) {
  if (!hourlyRaw || !hourlyRaw.time) {
    document.getElementById('hourlyScroll').innerHTML =
      '<p style="opacity:.5;padding:1rem">Hourly data unavailable.</p>';
    return;
  }
  const now      = new Date();
  const nowHour  = now.toISOString().slice(0, 13);
  const times    = hourlyRaw.time;
  const temps    = hourlyRaw.temperature_2m;
  const codes    = hourlyRaw.weather_code;
  const pops     = hourlyRaw.precipitation_probability;

  let startIdx = times.findIndex(t => t.startsWith(nowHour));
  if (startIdx < 0) startIdx = 0;

  const hours = [];
  for (let i = startIdx; i < startIdx + 12 && i < times.length; i++) {
    const date = new Date(times[i]);
    hours.push({
      label:  i === startIdx ? 'Now' : date.getHours().toString().padStart(2,'0') + ':00',
      temp:   temps[i], code: codes[i],
      pop:    pops ? pops[i] : 0, isCurr: i === startIdx
    });
  }

  document.getElementById('hourlyScroll').innerHTML = hours.map(h => `
    <div class="hourly-card ${h.isCurr ? 'current-hour' : ''}">
      <div class="hourly-time">${h.label}</div>
      <div class="hourly-icon">${wmoEmoji(h.code, 1)}</div>
      <div class="hourly-temp">${toDisplay(h.temp)}</div>
      ${h.pop > 0 ? `<div class="fd-pop"><i class="fa-solid fa-droplet"></i> ${h.pop}%</div>` : ''}
    </div>
  `).join('');
}

/* ── Daily Cards ────────────────────────────────────────── */
function renderDailyCards(days) {
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  document.getElementById('forecastGrid').innerHTML = days.map((d, i) => {
    const date  = new Date(d.date + 'T12:00:00');
    const label = i === 0 ? 'Today' : dayNames[date.getDay()];
    return `
      <div class="forecast-day-card">
        <div class="fd-day">${label}</div>
        <div class="fd-icon">${wmoEmoji(d.weather.code, 1)}</div>
        <div class="fd-desc">${d.weather.description}</div>
        <div class="fd-temps">
          <span class="fd-high">${toDisplay(d.max_temp)}</span>
          <span class="fd-low">${toDisplay(d.min_temp)}</span>
        </div>
        <div class="fd-pop"><i class="fa-solid fa-droplet"></i> ${d.pop}%</div>
        <div class="fd-extra"><i class="fa-solid fa-sun"></i> UV ${d.uv_max.toFixed(1)}</div>
      </div>`;
  }).join('');
}

/* ── Canvas Temp Chart ──────────────────────────────────── */
function drawTempChart(days) {
  const canvas = document.getElementById('tempChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W   = Math.max((canvas.parentElement?.clientWidth || 600) - 48, 300);
  const H   = 240;
  canvas.width = W; canvas.height = H;

  const highs  = days.map(d => d.max_temp);
  const lows   = days.map(d => d.min_temp);
  const labels = days.map((d, i) => {
    const date = new Date(d.date + 'T12:00:00');
    return i === 0 ? 'Today' : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][date.getDay()];
  });
  const n   = days.length;
  const all = [...highs, ...lows];
  const minT = Math.min(...all) - 3, maxT = Math.max(...all) + 3;
  const padL=46, padR=16, padT=36, padB=40;
  const cW = W-padL-padR, cH = H-padT-padB;
  const xP = i => padL + (i/(n-1))*cW;
  const yP = t => padT + cH - ((t-minT)/(maxT-minT))*cH;

  ctx.clearRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle='rgba(255,255,255,0.05)'; ctx.lineWidth=1;
  for (let i=0; i<=4; i++) {
    const y=padT+(i/4)*cH;
    ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(padL+cW,y); ctx.stroke();
    ctx.fillStyle='rgba(180,200,255,0.4)'; ctx.font='11px Space Mono,monospace'; ctx.textAlign='right';
    ctx.fillText(Math.round(maxT-(i/4)*(maxT-minT))+'°', padL-4, y+4);
  }

  // Fill
  const grad = ctx.createLinearGradient(0,padT,0,padT+cH);
  grad.addColorStop(0,'rgba(0,229,255,0.25)'); grad.addColorStop(1,'rgba(0,229,255,0)');
  ctx.beginPath();
  highs.forEach((t,i) => i===0 ? ctx.moveTo(xP(i),yP(t)) : ctx.lineTo(xP(i),yP(t)));
  ctx.lineTo(xP(n-1),H-padB); ctx.lineTo(xP(0),H-padB); ctx.closePath();
  ctx.fillStyle=grad; ctx.fill();

  // High line
  ctx.beginPath();
  highs.forEach((t,i) => i===0 ? ctx.moveTo(xP(i),yP(t)) : ctx.lineTo(xP(i),yP(t)));
  ctx.strokeStyle='#00e5ff'; ctx.lineWidth=2.5; ctx.lineJoin='round'; ctx.stroke();

  // Low line
  ctx.beginPath();
  lows.forEach((t,i) => i===0 ? ctx.moveTo(xP(i),yP(t)) : ctx.lineTo(xP(i),yP(t)));
  ctx.strokeStyle='#a855f7'; ctx.lineWidth=2; ctx.lineJoin='round'; ctx.stroke();

  // Dots + labels
  highs.forEach((t,i) => {
    ctx.beginPath(); ctx.arc(xP(i),yP(t),4,0,Math.PI*2);
    ctx.fillStyle='#00e5ff'; ctx.fill();
    ctx.fillStyle='rgba(220,240,255,0.85)'; ctx.font='bold 11px Outfit,sans-serif';
    ctx.textAlign='center'; ctx.fillText(Math.round(t)+'°', xP(i), yP(t)-10);
  });

  // X-axis labels
  labels.forEach((label,i) => {
    ctx.fillStyle='rgba(180,200,255,0.55)'; ctx.font='11px Outfit,sans-serif';
    ctx.textAlign='center'; ctx.fillText(label, xP(i), H-10);
  });

  // Legend
  ctx.textAlign='left'; ctx.font='bold 11px Outfit,sans-serif';
  ctx.fillStyle='#00e5ff'; ctx.fillText('── High', padL, 20);
  ctx.fillStyle='#a855f7'; ctx.fillText('── Low',  padL+82, 20);
}