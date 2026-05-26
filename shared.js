/* ═══════════════════════════════════════════════════════════════
   SKYCAST — shared.js
   Shared state, API calls, settings, and utilities used by ALL pages.
   Each page loads this file FIRST, then its own page-specific JS.
═══════════════════════════════════════════════════════════════ */

/* ── API Base URLs ────────────────────────────────────────── */
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
const AQI_URL     = 'https://air-quality-api.open-meteo.com/v1/air-quality';

/* ── Popular Cities ───────────────────────────────────────── */
const POPULAR_CITIES = [
  { name:'Delhi',     lat:28.6519,  lon:77.2315,   country:'IN' },
  { name:'Mumbai',    lat:19.0760,  lon:72.8777,   country:'IN' },
  { name:'London',    lat:51.5074,  lon:-0.1278,   country:'GB' },
  { name:'New York',  lat:40.7128,  lon:-74.0060,  country:'US' },
  { name:'Tokyo',     lat:35.6762,  lon:139.6503,  country:'JP' },
  { name:'Dubai',     lat:25.2048,  lon:55.2708,   country:'AE' },
  { name:'Paris',     lat:48.8566,  lon:2.3522,    country:'FR' },
  { name:'Sydney',    lat:-33.8688, lon:151.2093,  country:'AU' },
  { name:'Singapore', lat:1.3521,   lon:103.8198,  country:'SG' },
  { name:'Toronto',   lat:43.6532,  lon:-79.3832,  country:'CA' },
];

/* ═══════════════════════════════════════════════════════════════
   SETTINGS MANAGEMENT
═══════════════════════════════════════════════════════════════ */
const DEFAULT_SETTINGS = {
  theme:         'dark',    // 'dark' | 'light' | 'auto'
  accentColor:   'cyan',    // 'cyan' | 'purple' | 'green' | 'orange' | 'rose'
  fontSize:      'medium',  // 'small' | 'medium' | 'large'
  tempUnit:      'C',       // 'C' | 'F'
  windUnit:      'ms',      // 'ms' | 'kmh' | 'mph'
  pressureUnit:  'hpa',     // 'hpa' | 'inhg' | 'mmhg'
  timeFormat:    '12h',     // '12h' | '24h'
  defaultCity:   '',
  autoDetect:    true,
  showAQI:       true,
  showUV:        true,
  showCompass:   true,
  showPressure:  true,
  showHourly:    true,
};

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('skycast_settings') || '{}');
    return { ...DEFAULT_SETTINGS, ...saved };
  } catch { return { ...DEFAULT_SETTINGS }; }
}

function saveSettings(s) {
  localStorage.setItem('skycast_settings', JSON.stringify(s));
}

function applySettings(s) {
  const body = document.body;
  let isDark = s.theme === 'dark';
  if (s.theme === 'auto') { const h = new Date().getHours(); isDark = h < 6 || h >= 19; }
  body.classList.toggle('theme-dark',  isDark);
  body.classList.toggle('theme-light', !isDark);
  body.setAttribute('data-accent',   s.accentColor || 'cyan');
  body.setAttribute('data-fontsize', s.fontSize    || 'medium');
  document.querySelectorAll('.btn-theme i').forEach(icon => {
    icon.className = isDark ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
  });
  // Show / hide optional dashboard cards
  ['showAQI','showUV','showCompass','showPressure','showHourly'].forEach(key => {
    document.querySelectorAll(`[data-setting="${key}"]`).forEach(el => {
      el.style.display = s[key] ? '' : 'none';
    });
  });
}

/* ═══════════════════════════════════════════════════════════════
   STATE — Global shared variables (populated from localStorage)
═══════════════════════════════════════════════════════════════ */
let currentWeather = null;
let forecastDays   = null;
let hourlyRaw      = null;
let currentLat     = null;
let currentLon     = null;
let currentCity    = 'Unknown City';
let currentCountry = '';

function loadWeatherFromStorage() {
  try {
    const w = localStorage.getItem('skycast_weather');
    const f = localStorage.getItem('skycast_forecast');
    const h = localStorage.getItem('skycast_hourly');
    if (w) currentWeather = JSON.parse(w);
    if (f) forecastDays   = JSON.parse(f);
    if (h) hourlyRaw      = JSON.parse(h);
    if (currentWeather) {
      currentCity    = currentWeather.city_name;
      currentCountry = currentWeather.country_code;
    }
  } catch(e) { console.error('Storage load failed', e); }
}

function saveWeatherToStorage() {
  try {
    if (currentWeather) localStorage.setItem('skycast_weather',  JSON.stringify(currentWeather));
    if (forecastDays)   localStorage.setItem('skycast_forecast', JSON.stringify(forecastDays));
    if (hourlyRaw)      localStorage.setItem('skycast_hourly',   JSON.stringify(hourlyRaw));
  } catch(e) { console.error('Storage save failed', e); }
}

/* ═══════════════════════════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════════════════════════ */
function openMobileNav()  {
  document.getElementById('mobileDrawer')?.classList.add('open');
  document.getElementById('mobileOverlay')?.classList.add('open');
}
function closeMobileNav() {
  document.getElementById('mobileDrawer')?.classList.remove('open');
  document.getElementById('mobileOverlay')?.classList.remove('open');
}

/* ═══════════════════════════════════════════════════════════════
   THEME
═══════════════════════════════════════════════════════════════ */
function toggleTheme() {
  const s = loadSettings();
  const isDarkNow = document.body.classList.contains('theme-dark');
  s.theme = isDarkNow ? 'light' : 'dark';
  saveSettings(s);
  applySettings(s);
}

function applyWeatherTheme(d) {
  const body = document.body;
  const hour = new Date().getHours();
  const code = d.weather.code;
  body.classList.remove('weather-sunny','weather-rainy','weather-cloudy',
    'weather-stormy','weather-snowy','weather-night','weather-fog');
  if      (hour < 6 || hour > 20) body.classList.add('weather-night');
  else if (isStorm(code))         body.classList.add('weather-stormy');
  else if (isRain(code))          body.classList.add('weather-rainy');
  else if (isSnow(code))          body.classList.add('weather-snowy');
  else if (isFog(code))           body.classList.add('weather-fog');
  else if (isCloudy(code))        body.classList.add('weather-cloudy');
  else                            body.classList.add('weather-sunny');
  const rl = document.getElementById('rainLayer');
  if (rl) rl.classList.toggle('hidden', !isRain(code) && !isStorm(code));
}

/* ═══════════════════════════════════════════════════════════════
   UNIT HELPERS
═══════════════════════════════════════════════════════════════ */
function toDisplay(tempC) {
  const s = loadSettings();
  if (s.tempUnit === 'F') return Math.round(tempC * 9 / 5 + 32) + '°F';
  return Math.round(tempC) + '°C';
}

function windDisplay(ms) {
  const s = loadSettings();
  switch (s.windUnit) {
    case 'kmh': return (ms * 3.6).toFixed(1) + ' km/h';
    case 'mph': return (ms * 2.237).toFixed(1) + ' mph';
    default:    return ms.toFixed(1) + ' m/s';
  }
}

function pressureDisplay(hpa) {
  const s = loadSettings();
  switch (s.pressureUnit) {
    case 'inhg': return (hpa * 0.02953).toFixed(2) + ' inHg';
    case 'mmhg': return (hpa * 0.75006).toFixed(1) + ' mmHg';
    default:     return Math.round(hpa) + ' hPa';
  }
}

function timeDisplay(date, tz) {
  const s = loadSettings();
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: s.timeFormat === '12h', timeZone: tz || 'UTC'
  });
}

function setUnit(u) {
  const s = loadSettings(); s.tempUnit = u; saveSettings(s);
  document.getElementById('btnC')?.classList.toggle('active', u === 'C');
  document.getElementById('btnF')?.classList.toggle('active', u === 'F');
  if (currentWeather && typeof renderDashboard === 'function') renderDashboard(currentWeather);
}

/* ═══════════════════════════════════════════════════════════════
   GEOLOCATION
═══════════════════════════════════════════════════════════════ */
function getLocation() {
  if (!navigator.geolocation) { showError('Geolocation not supported by your browser.'); return; }
  showLoading(true);
  navigator.geolocation.getCurrentPosition(
    async pos => {
      const { latitude: lat, longitude: lon } = pos.coords;
      try {
        const r    = await fetch(`${REVERSE_URL}?lat=${lat}&lon=${lon}&format=json`, { headers: {'Accept-Language':'en'} });
        const g    = await r.json();
        currentCity    = g.address.city || g.address.town || g.address.village || g.address.county || 'Your Location';
        currentCountry = g.address.country_code?.toUpperCase() || '';
      } catch { currentCity = 'Your Location'; currentCountry = ''; }
      await fetchWeatherByCoords(lat, lon);
    },
    () => { showLoading(false); showError('Location denied. Please search a city manually.'); }
  );
}

/* ═══════════════════════════════════════════════════════════════
   API CALLS
═══════════════════════════════════════════════════════════════ */
async function geocodeAndFetch(cityName, redirectAfter) {
  showLoading(true); hideError();
  try {
    const res  = await fetch(`${GEOCODE_URL}?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`);
    const data = await res.json();
    if (!data.results?.length) {
      showLoading(false); showError(`City "${cityName}" not found. Check the spelling.`); return;
    }
    const place    = data.results[0];
    currentCity    = place.name;
    currentCountry = place.country_code?.toUpperCase() || place.country || '';
    currentLat     = place.latitude;
    currentLon     = place.longitude;
    await fetchWeatherByCoords(place.latitude, place.longitude, redirectAfter);
  } catch(e) { showLoading(false); showError('Geocoding failed. Check your connection.'); console.error(e); }
}

async function fetchWeatherByCoords(lat, lon, redirectAfter) {
  currentLat = lat; currentLon = lon; showLoading(true); hideError();
  const cVars  = 'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code,surface_pressure,visibility,is_day,precipitation,cloud_cover,dew_point_2m,precipitation_probability';
  const hVars  = 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation_probability,uv_index,relative_humidity_2m,visibility';
  const dVars  = 'weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,uv_index_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max';
  const wUrl   = `${WEATHER_URL}?latitude=${lat}&longitude=${lon}&current=${cVars}&hourly=${hVars}&daily=${dVars}&timezone=auto&forecast_days=7`;
  const aUrl   = `${AQI_URL}?latitude=${lat}&longitude=${lon}&current=pm2_5,pm10,us_aqi,european_aqi,nitrogen_dioxide,ozone&timezone=auto`;
  try {
    const [wRes, aRes] = await Promise.allSettled([fetch(wUrl), fetch(aUrl)]);
    if (wRes.status === 'rejected' || !wRes.value.ok) throw new Error('Weather API failed');
    const raw     = await wRes.value.json();
    const aqiData = (aRes.status === 'fulfilled' && aRes.value.ok) ? await aRes.value.json() : null;
    processOpenMeteoData(raw, aqiData, redirectAfter);
  } catch(e) { showLoading(false); showError('Failed to fetch weather. Try again.'); console.error(e); }
}

function processOpenMeteoData(raw, aqiData, redirectAfter) {
  let realAQI = null, pm25 = null, pm10 = null, no2 = null, ozone = null, aqiSource = 'estimated';
  if (aqiData?.current) {
    const ac = aqiData.current;
    realAQI = ac.us_aqi ?? ac.european_aqi ?? null;
    pm25    = ac.pm2_5 ?? null; pm10  = ac.pm10 ?? null;
    no2     = ac.nitrogen_dioxide ?? null; ozone = ac.ozone ?? null; aqiSource = 'real';
  }
  const c = raw.current, h = raw.hourly, d = raw.daily;
  const nowISO = new Date().toISOString().slice(0, 13);
  let uvNow = 0;
  if (h.time && h.uv_index) {
    const idx = h.time.findIndex(t => t.startsWith(nowISO));
    if (idx >= 0) uvNow = h.uv_index[idx] ?? 0;
    else {
      const todayStr = new Date().toISOString().slice(0, 10);
      const idxs = h.time.map((t,i) => t.startsWith(todayStr) ? i : -1).filter(i => i >= 0);
      const vals = idxs.map(i => h.uv_index[i]).filter(v => v != null);
      uvNow = vals.length ? Math.max(...vals) : (d.uv_index_max[0] ?? 0);
    }
  }
  const uvForLogic = c.is_day === 0 ? (d.uv_index_max[0] ?? 0) : uvNow;
  currentWeather = {
    city_name: currentCity, country_code: currentCountry,
    temp: c.temperature_2m, app_temp: c.apparent_temperature,
    rh: c.relative_humidity_2m, wind_spd: c.wind_speed_10m / 3.6,
    wind_dir: c.wind_direction_10m, wind_gust: c.wind_gusts_10m / 3.6,
    pres: c.surface_pressure, vis: (c.visibility / 1000).toFixed(1),
    uv: uvNow, uv_max: d.uv_index_max[0] ?? 0, uv_logic: uvForLogic,
    is_day: c.is_day, precipitation: c.precipitation, cloud_cover: c.cloud_cover,
    aqi:  realAQI !== null ? Math.round(realAQI) : estimateAQI(c.weather_code, c.wind_speed_10m),
    pm25, pm10, no2, ozone, aqiSource,
    dew_point: c.dew_point_2m ?? null, precip_prob: c.precipitation_probability ?? 0,
    weather: { code: c.weather_code, description: wmoDescription(c.weather_code) },
    high_temp: d.temperature_2m_max[0], low_temp: d.temperature_2m_min[0],
    sunrise: d.sunrise[0]?.split('T')[1]?.slice(0,5) || '06:00',
    sunset:  d.sunset[0]?.split('T')[1]?.slice(0,5)  || '18:00',
    timezone: raw.timezone
  };
  forecastDays = d.time.map((date, i) => ({
    date, max_temp: d.temperature_2m_max[i], min_temp: d.temperature_2m_min[i],
    weather: { code: d.weather_code[i], description: wmoDescription(d.weather_code[i]) },
    pop:    d.precipitation_probability_max[i] || 0,
    precip: d.precipitation_sum[i]             || 0,
    uv_max: d.uv_index_max[i]                  || 0,
    wind_max: (d.wind_speed_10m_max[i] / 3.6).toFixed(1),
    sunrise: d.sunrise[i]?.split('T')[1]?.slice(0,5),
    sunset:  d.sunset[i]?.split('T')[1]?.slice(0,5)
  }));
  hourlyRaw = h;
  saveWeatherToStorage();
  showLoading(false);
  if (redirectAfter) { window.location.href = redirectAfter; return; }
  if (typeof onPageWeatherLoaded === 'function') onPageWeatherLoaded();
  applyWeatherTheme(currentWeather);
}

function estimateAQI(wmoCode, windKmh) {
  let base = 40;
  if (windKmh < 5)  base += 30;
  if (windKmh < 10) base += 10;
  if (wmoCode >= 51 && wmoCode <= 77) base -= 20;
  if (wmoCode >= 45 && wmoCode <= 48) base += 40;
  return Math.max(5, Math.min(180, base));
}

/* ═══════════════════════════════════════════════════════════════
   CITY CHIPS & AUTOCOMPLETE
═══════════════════════════════════════════════════════════════ */
function populateCityChips(containerId, onSelect) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = POPULAR_CITIES.map(c => `
    <button class="city-chip" onclick="${onSelect}('${c.name}')">
      ${c.name} <small>${c.country}</small>
    </button>`).join('');
}

async function filterCitySuggestions(query) {
  const dd = document.getElementById('cityDropdown');
  if (!dd) return;
  if (query.length < 2) { dd.classList.add('hidden'); dd.innerHTML = ''; return; }
  try {
    const res  = await fetch(`${GEOCODE_URL}?name=${encodeURIComponent(query)}&count=6&language=en&format=json`);
    const data = await res.json();
    if (!data.results?.length) { dd.classList.add('hidden'); return; }
    dd.innerHTML = data.results.map(r => `
      <div class="city-suggestion" onclick="pickSuggestion('${r.name.replace(/'/g,"\\'")}')">
        <i class="fa-solid fa-location-dot"></i>
        <span>${r.name}</span><small>${r.country || ''}</small>
      </div>`).join('');
    dd.classList.remove('hidden');
  } catch {}
}

function pickSuggestion(name) {
  const inp = document.getElementById('dashSearchInput') || document.getElementById('heroSearchInput');
  if (inp) inp.value = name;
  const dd = document.getElementById('cityDropdown');
  if (dd) { dd.classList.add('hidden'); dd.innerHTML = ''; }
  if (typeof dashSearch === 'function') dashSearch();
  else if (typeof heroSearch === 'function') heroSearch();
}

/* ═══════════════════════════════════════════════════════════════
   WMO CODE HELPERS
═══════════════════════════════════════════════════════════════ */
function isStorm(c)  { return c >= 95; }
function isRain(c)   { return (c >= 51 && c <= 67) || (c >= 80 && c <= 82); }
function isSnow(c)   { return (c >= 71 && c <= 77) || c === 85 || c === 86; }
function isFog(c)    { return c === 45 || c === 48; }
function isCloudy(c) { return c === 2 || c === 3; }

function wmoDescription(code) {
  const m = {
    0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',
    45:'Fog',48:'Icy fog',
    51:'Light drizzle',53:'Moderate drizzle',55:'Dense drizzle',
    56:'Light freezing drizzle',57:'Heavy freezing drizzle',
    61:'Slight rain',63:'Moderate rain',65:'Heavy rain',
    66:'Light freezing rain',67:'Heavy freezing rain',
    71:'Slight snowfall',73:'Moderate snowfall',75:'Heavy snowfall',
    77:'Snow grains',80:'Slight rain showers',81:'Moderate rain showers',
    82:'Violent rain showers',85:'Slight snow showers',86:'Heavy snow showers',
    95:'Thunderstorm',96:'Thunderstorm with hail',99:'Thunderstorm, heavy hail'
  };
  return m[code] || 'Unknown';
}

function wmoEmoji(code, isDay = 1) {
  if (code === 0)                 return isDay ? '☀️' : '🌙';
  if (code === 1)                 return isDay ? '🌤️' : '🌙';
  if (code === 2)                 return '⛅';
  if (code === 3)                 return '☁️';
  if (code === 45 || code === 48) return '🌫️';
  if (code >= 51 && code <= 57)   return '🌦️';
  if (code >= 61 && code <= 67)   return '🌧️';
  if (code >= 71 && code <= 77)   return '❄️';
  if (code >= 80 && code <= 82)   return '🌧️';
  if (code === 85 || code === 86) return '🌨️';
  if (code >= 95)                 return '⛈️';
  return '🌡️';
}

function uvLabel(uv) {
  if (uv < 3)  return 'Low';
  if (uv < 6)  return 'Moderate';
  if (uv < 8)  return 'High';
  if (uv < 11) return 'Very High';
  return 'Extreme';
}
function aqiLabel(aqi) {
  if (aqi < 50)  return 'Good';
  if (aqi < 100) return 'Moderate';
  if (aqi < 150) return 'Unhealthy (Sensitive)';
  if (aqi < 200) return 'Unhealthy';
  return 'Hazardous';
}
function windCardinal(deg) {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

/* ═══════════════════════════════════════════════════════════════
   UTILITY HELPERS
═══════════════════════════════════════════════════════════════ */
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
function showLoading(on) {
  document.getElementById('loadingOverlay')?.classList.toggle('hidden', !on);
}
function showError(msg) {
  setText('errorMsg', msg);
  document.getElementById('errorBanner')?.classList.remove('hidden');
}
function hideError() {
  document.getElementById('errorBanner')?.classList.add('hidden');
}
function formatDate(d, tz) {
  const opts = { weekday:'long', year:'numeric', month:'long', day:'numeric' };
  if (tz) opts.timeZone = tz;
  return d.toLocaleDateString('en-IN', opts);
}
function parseHHMM(str) {
  const [h, m] = str.split(':').map(Number);
  const d = new Date(); d.setHours(h, m, 0, 0); return d;
}