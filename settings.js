/* ═══════════════════════════════════════════════════════════════
   settings.js — SETTINGS PAGE
═══════════════════════════════════════════════════════════════ */

let pendingSettings = {};
let hasUnsaved = false;

(function initSettings() {
  const s = loadSettings();
  applySettings(s);
  pendingSettings = { ...s };
  populateUI(s);
  updateCacheInfo();
  updatePreview();

  // Mark unsaved on any interaction
  document.querySelectorAll('input, button.seg-btn, .swatch').forEach(el => {
    el.addEventListener('change', markUnsaved);
  });
})();

/* ── Populate all controls from settings object ─────────── */
function populateUI(s) {
  // Segmented controls
  selectSeg('themeControl',  s.theme,       false);
  selectSeg('fontControl',   s.fontSize,    false);
  selectSeg('tempControl',   s.tempUnit,    false);
  selectSeg('windControl',   s.windUnit,    false);
  selectSeg('pressControl',  s.pressureUnit,false);
  selectSeg('timeControl',   s.timeFormat,  false);

  // Accent swatch
  highlightSwatch(s.accentColor);

  // Text inputs
  const dc = document.getElementById('defaultCityInput');
  if (dc) dc.value = s.defaultCity || '';

  // Toggles
  setToggle('autoDetectToggle',  s.autoDetect);
  setToggle('showAQIToggle',     s.showAQI);
  setToggle('showUVToggle',      s.showUV);
  setToggle('showCompassToggle', s.showCompass);
  setToggle('showPressureToggle',s.showPressure);
  setToggle('showHourlyToggle',  s.showHourly);

  // Wire toggle change events
  const toggleIds = ['autoDetectToggle','showAQIToggle','showUVToggle','showCompassToggle','showPressureToggle','showHourlyToggle'];
  toggleIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => { markUnsaved(); updatePreview(); });
  });

  const dcInput = document.getElementById('defaultCityInput');
  if (dcInput) dcInput.addEventListener('input', markUnsaved);
}

/* ── Segmented control helper ───────────────────────────── */
function selectSeg(controlId, val, mark = true) {
  const ctrl = document.getElementById(controlId);
  if (!ctrl) return;
  ctrl.querySelectorAll('button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.val === val);
  });
  // Save to pending
  const keyMap = {
    themeControl:  'theme',
    fontControl:   'fontSize',
    tempControl:   'tempUnit',
    windControl:   'windUnit',
    pressControl:  'pressureUnit',
    timeControl:   'timeFormat',
  };
  if (keyMap[controlId]) pendingSettings[keyMap[controlId]] = val;
  if (mark) { markUnsaved(); updatePreview(); }
}

/* ── Colour swatch ──────────────────────────────────────── */
function selectSwatch(color) {
  pendingSettings.accentColor = color;
  highlightSwatch(color);
  markUnsaved();
  updatePreview();
}
function highlightSwatch(color) {
  document.querySelectorAll('.swatch').forEach(s => {
    s.classList.toggle('active', s.dataset.val === color);
  });
}

/* ── Toggle helper ──────────────────────────────────────── */
function setToggle(id, val) {
  const el = document.getElementById(id);
  if (el) el.checked = !!val;
}
function getToggle(id) {
  const el = document.getElementById(id);
  return el ? el.checked : true;
}

/* ── Collect all values from the UI ────────────────────── */
function collectSettings() {
  return {
    ...pendingSettings,
    defaultCity:   (document.getElementById('defaultCityInput')?.value || '').trim(),
    autoDetect:    getToggle('autoDetectToggle'),
    showAQI:       getToggle('showAQIToggle'),
    showUV:        getToggle('showUVToggle'),
    showCompass:   getToggle('showCompassToggle'),
    showPressure:  getToggle('showPressureToggle'),
    showHourly:    getToggle('showHourlyToggle'),
  };
}

/* ── Save ───────────────────────────────────────────────── */
function saveAllSettings() {
  const s = collectSettings();
  saveSettings(s);
  applySettings(s);
  hasUnsaved = false;
  document.getElementById('unsavedLabel')?.classList.add('hidden');
  showToast();
}

function showToast() {
  const t = document.getElementById('saveToast');
  if (!t) return;
  t.classList.remove('hidden');
  t.classList.add('show');
  setTimeout(() => { t.classList.remove('show'); t.classList.add('hidden'); }, 2500);
}

/* ── Reset ──────────────────────────────────────────────── */
function resetSettings() {
  if (!confirm('Reset all settings to defaults?')) return;
  pendingSettings = { ...DEFAULT_SETTINGS };
  saveSettings(DEFAULT_SETTINGS);
  applySettings(DEFAULT_SETTINGS);
  populateUI(DEFAULT_SETTINGS);
  hasUnsaved = false;
  document.getElementById('unsavedLabel')?.classList.add('hidden');
  showToast();
}

/* ── Unsaved indicator ──────────────────────────────────── */
function markUnsaved() {
  hasUnsaved = true;
  document.getElementById('unsavedLabel')?.classList.remove('hidden');
}

/* ── Live preview ───────────────────────────────────────── */
function updatePreview() {
  const s = collectSettings();
  // Apply accent + font to body immediately for live feel
  document.body.setAttribute('data-accent',   s.accentColor || 'cyan');
  document.body.setAttribute('data-fontsize', s.fontSize    || 'medium');
  let isDark = s.theme === 'dark';
  if (s.theme === 'auto') { const h = new Date().getHours(); isDark = h < 6 || h >= 19; }
  document.body.classList.toggle('theme-dark',  isDark);
  document.body.classList.toggle('theme-light', !isDark);
  document.querySelectorAll('.btn-theme i').forEach(i => {
    i.className = isDark ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
  });

  // Update preview card
  const tempC = 32;
  const tempStr = s.tempUnit === 'F' ? Math.round(tempC*9/5+32)+'°F' : tempC+'°C';
  setText('previewTemp', tempStr);

  // Show cached city in preview
  loadWeatherFromStorage();
  if (currentWeather) setText('previewCity', `${currentWeather.city_name}, ${currentWeather.country_code}`);
}

/* ── Cache info ─────────────────────────────────────────── */
function updateCacheInfo() {
  const info = document.getElementById('cacheInfo');
  if (!info) return;
  const w = localStorage.getItem('skycast_weather');
  if (w) {
    try {
      const d = JSON.parse(w);
      info.textContent = `📍 ${d.city_name}, ${d.country_code}`;
    } catch { info.textContent = 'Cached data present'; }
  } else {
    info.textContent = 'No cached data';
  }
}

function clearCache() {
  localStorage.removeItem('skycast_weather');
  localStorage.removeItem('skycast_forecast');
  localStorage.removeItem('skycast_hourly');
  updateCacheInfo();
  showToast();
}

/* ── Export Settings ────────────────────────────────────── */
function exportSettings() {
  const s = collectSettings();
  const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = 'skycast-settings.json';
  a.click();
}

/* Warn before leaving with unsaved changes */
window.addEventListener('beforeunload', e => {
  if (hasUnsaved) { e.preventDefault(); e.returnValue = ''; }
});