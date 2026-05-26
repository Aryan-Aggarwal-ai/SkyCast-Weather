/* ═══════════════════════════════════════════════════════════════
   app.js — HERO PAGE
   Search fetches weather, saves to localStorage, redirects to dashboard.
═══════════════════════════════════════════════════════════════ */

// On hero load: apply settings, populate chips, try auto-detect
(function initHero() {
  const s = loadSettings();
  applySettings(s);

  // Populate city chips
  const chips = document.getElementById('heroCityChips');
  if (chips) {
    chips.innerHTML = POPULAR_CITIES.map(c => `
      <button class="city-chip" onclick="selectPopularCity('${c.name}')">
        ${c.name} <small>${c.country}</small>
      </button>`).join('');
  }

  // If weather already in storage, show the hero card without fetching
  loadWeatherFromStorage();
  if (currentWeather) {
    renderHeroCard(currentWeather);
  } else if (s.autoDetect) {
    getLocation();
  } else if (s.defaultCity) {
    geocodeAndFetch(s.defaultCity);
  } else {
    // No data — show empty state
    const loading = document.getElementById('heroCardLoading');
    if (loading) loading.innerHTML = '<p style="opacity:.6;padding:1rem">Search a city to see weather</p>';
  }
})();

/* Hero search — fetches then redirects to dashboard */
function heroSearch() {
  const city = document.getElementById('heroSearchInput').value.trim();
  if (!city) return;
  geocodeAndFetch(city, 'dashboard.html');
}

/* Popular city click on hero */
function selectPopularCity(name) {
  document.getElementById('heroSearchInput').value = name;
  geocodeAndFetch(name, 'dashboard.html');
}

/* Called by shared.js after data loads (e.g. auto-detect on hero) */
function onPageWeatherLoaded() {
  if (currentWeather) {
    renderHeroCard(currentWeather);
    applyWeatherTheme(currentWeather);
  }
}

/* ── Hero Card Renderer ─────────────────────────────────── */
function renderHeroCard(d) {
  document.getElementById('heroCardLoading').style.display = 'none';
  document.getElementById('heroCardData').classList.remove('hidden');

  setText('hcCity',     `${d.city_name}${d.country_code ? ', ' + d.country_code : ''}`);
  setText('hcDate',     formatDate(new Date(), d.timezone));
  setText('hcTemp',     toDisplay(d.temp));
  setText('hcDesc',     d.weather.description);
  setText('hcHumidity', d.rh);
  setText('hcWind',     windDisplay(d.wind_spd));
  setText('hcVis',      d.vis);

  const uvShow = d.is_day ? (d.uv || 0) : (d.uv_max || 0);
  setText('hcUvBadge', `UV ${uvShow.toFixed(1)}${!d.is_day ? ' (today max)' : ''}`);
  document.getElementById('hcIcon').textContent = wmoEmoji(d.weather.code, d.is_day);

  const tip = getTopTip(d);
  document.getElementById('hcQuickRec').textContent = '💡 ' + tip;
}

/* ── Quick Tip ──────────────────────────────────────────── */
function getTopTip(d) {
  const code = d.weather.code;
  const uv   = d.uv_logic || d.uv_max || d.uv || 0;
  if (isStorm(code))                     return `⛈️ Active storm — stay indoors!`;
  if (isRain(code) && d.precipitation > 5) return `🌧️ Heavy rain — carry an umbrella.`;
  if (isRain(code))                      return `🌦️ Light rain possible — pack a compact umbrella.`;
  if (d.temp > 38)                       return `🌡️ Extreme heat — stay hydrated, avoid noon sun!`;
  if (d.temp > 32)                       return `☀️ Hot day — drink 3L+ water.`;
  if (uv >= 8)                           return `🔴 UV ${uv.toFixed(1)} is very high — SPF 50+ and hat!`;
  if (uv >= 6)                           return `🟠 UV ${uv.toFixed(1)} is high — apply sunscreen.`;
  if (d.wind_spd > 12)                   return `💨 Strong winds — secure loose items!`;
  if (isSnow(code))                      return `❄️ Snowfall — icy roads, drive slowly.`;
  if (isFog(code))                       return `🌫️ Dense fog — use low-beam headlights.`;
  if (d.temp >= 18 && d.temp <= 26)      return `✨ Beautiful ${Math.round(d.temp)}°C — ideal for outdoors!`;
  if (d.temp < 5)                        return `🥶 ${Math.round(d.temp)}°C — wear a heavy coat!`;
  if (d.temp < 12)                       return `🧥 Cool ${Math.round(d.temp)}°C — a jacket is a good idea.`;
  return `🌤 ${Math.round(d.temp)}°C, ${d.rh}% humidity — check Suggestions for your plan.`;
}