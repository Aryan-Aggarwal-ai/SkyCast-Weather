/* suggestions.js — SUGGESTIONS PAGE */
(function initSuggestions() {
  const s = loadSettings();
  applySettings(s);
  loadWeatherFromStorage();
  if (currentWeather) {
    renderRecommendations(currentWeather);
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
  if (currentWeather) { renderRecommendations(currentWeather); applyWeatherTheme(currentWeather); }
}

function heatIndex(t, rh) {
  if (t < 27) return t;
  return -8.78469 + 1.61139*t + 2.33855*rh - 0.14611*t*rh - 0.01230*t*t
    - 0.01642*rh*rh + 0.00221*t*rh*rh + 0.00072*t*t*rh - 0.00000358*t*t*rh*rh;
}
function dewDiscomfort(dp) {
  if (dp === null || dp === undefined) return null;
  if (dp >= 26) return { label: `dew point ${dp.toFixed(1)}°C — oppressively muggy` };
  if (dp >= 24) return { label: `dew point ${dp.toFixed(1)}°C — very humid` };
  if (dp >= 21) return { label: `dew point ${dp.toFixed(1)}°C — noticeably humid` };
  if (dp >= 18) return { label: `dew point ${dp.toFixed(1)}°C — slightly sticky` };
  if (dp >= 13) return { label: `dew point ${dp.toFixed(1)}°C — comfortable` };
  return { label: `dew point ${dp.toFixed(1)}°C — crisp and dry` };
}
function aqiDetail(d) {
  let detail = `AQI ${d.aqi||0}`;
  if (d.aqiSource === 'real') {
    const p = [];
    if (d.pm25 !== null) p.push(`PM2.5 ${d.pm25.toFixed(1)} µg/m³`);
    if (d.pm10 !== null) p.push(`PM10 ${d.pm10.toFixed(1)} µg/m³`);
    if (p.length) detail += ` (${p.join(', ')})`;
  }
  return detail;
}

function calcScore(d) {
  let score = 100;
  const code = d.weather.code, uv = d.uv_logic||d.uv_max||d.uv||0;
  if (isStorm(code)) score -= 50;
  else if (isRain(code) && d.precipitation > 5) score -= 30;
  else if (isRain(code)) score -= 18;
  else if (isSnow(code)) score -= 22;
  else if (isFog(code))  score -= 12;
  if (d.temp > 42 || d.temp < -10) score -= 28;
  else if (d.temp > 38 || d.temp < 0) score -= 18;
  else if (d.temp > 33 || d.temp < 5) score -= 10;
  if (d.wind_spd > 15) score -= 18; else if (d.wind_spd > 10) score -= 8;
  if (d.rh > 90) score -= 12; else if (d.rh > 80) score -= 6;
  if (uv >= 11) score -= 15; else if (uv >= 8) score -= 10;
  if ((d.aqi||0) > 200) score -= 25; else if ((d.aqi||0) > 150) score -= 18; else if ((d.aqi||0) > 100) score -= 8;
  if (parseFloat(d.vis) < 1) score -= 10;
  return Math.max(0, Math.min(100, score));
}

function scoreText(s) {
  if (s >= 80) return { title:'Excellent Weather Day!',   desc:'Near-perfect conditions. Enjoy outdoor activities.', badge:'🌟 Outstanding' };
  if (s >= 60) return { title:'Good Conditions Today',    desc:'Comfortable weather. Most outdoor activities are fine.', badge:'✅ Good Day' };
  if (s >= 40) return { title:'Mixed Weather Conditions', desc:'Some factors need attention. Check suggestions.', badge:'⚠️ Mixed' };
  if (s >= 20) return { title:'Challenging Weather',      desc:'Difficult conditions. Prefer indoor activities.', badge:'🌧 Tough Day' };
  return { title:'Severe Weather Warning', desc:'Dangerous conditions. Stay indoors.', badge:'🚨 Stay Safe' };
}

function renderRecommendations(d) {
  setText('recCityLabel', `${d.city_name}${d.country_code ? ', '+d.country_code : ''}`);
  document.getElementById('dashSearchInput').value = d.city_name;
  const score = calcScore(d);
  const { title, desc, badge } = scoreText(score);
  setText('scoreNum', score); setText('scoreTitle', title);
  setText('scoreDesc', desc); setText('scoreBadge', badge);
  animateScoreRing(score);
  const recs = buildRecommendations(d);
  document.getElementById('recGrid').innerHTML = recs.map((r, idx) => `
    <div class="rec-card rec-${r.status}" style="animation-delay:${idx*0.07}s">
      <div class="rec-card-top">
        <div class="rec-icon ${r.status}"><i class="fa-solid ${r.icon}"></i></div>
        <div><div class="rec-title">${r.cat}</div><div class="rec-desc">${r.msg}</div></div>
      </div>
      <span class="rec-status-pill ${r.status}-pill">${r.label}</span>
    </div>`).join('');
  renderClothing(d);
  renderHealth(d);
}

function animateScoreRing(score) {
  const circle = document.getElementById('scoreCircle');
  if (!circle) return;
  setTimeout(() => {
    circle.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)';
    circle.style.strokeDashoffset = 314 - (score/100)*314;
  }, 300);
}

function buildRecommendations(d) {
  const temp=d.temp, rh=d.rh, wind=d.wind_spd, gust=d.wind_gust||wind;
  const code=d.weather.code, aqi=d.aqi||0;
  const uv=d.uv_logic||d.uv_max||d.uv||0, vis=parseFloat(d.vis)||10;
  const prec=d.precipitation||0, cloud=d.cloud_cover||0, pprob=d.precip_prob||0;
  const dp=d.dew_point, hi=heatIndex(temp,rh), dew=dewDiscomfort(dp);
  const aqiStr=aqiDetail(d), city=d.city_name, recs=[];

  // 1. Exercise
  if (isStorm(code)) recs.push({icon:'fa-person-running',cat:'Outdoor Exercise',status:'bad',label:'✗ Life-Threatening',msg:`⛈️ Active thunderstorm in ${city}. Do NOT exercise outdoors.`});
  else if (isRain(code)&&prec>=5) recs.push({icon:'fa-person-running',cat:'Outdoor Exercise',status:'bad',label:'✗ Skip Outdoors',msg:`🌧️ Heavy rain (${prec.toFixed(1)} mm). Hit the gym today.`});
  else if (temp>=12&&temp<=22&&wind<7&&!isRain(code)) recs.push({icon:'fa-person-running',cat:'Outdoor Exercise',status:'good',label:'✓ Perfect Conditions',msg:`🏃 ${city}: ${Math.round(temp)}°C, ${rh}% humidity — near-perfect for jogging or cycling!`});
  else if (temp>38) recs.push({icon:'fa-person-running',cat:'Outdoor Exercise',status:'bad',label:'✗ Extreme Heat',msg:`🌡️ ${city}: ${Math.round(temp)}°C. Exercising now risks heat stroke.`});
  else if (temp<5) recs.push({icon:'fa-person-running',cat:'Outdoor Exercise',status:'warn',label:'⚠ Cold',msg:`🥶 ${city}: ${Math.round(temp)}°C. Layer up in thermals before heading out.`});
  else recs.push({icon:'fa-person-running',cat:'Outdoor Exercise',status:'warn',label:'⚠ Moderate',msg:`🌤 ${city}: ${Math.round(temp)}°C, ${rh}% humidity, ${cloud}% cloud cover. Okay for light activity.`});

  // 2. Travel
  if (isStorm(code)) recs.push({icon:'fa-car',cat:'Travel & Commute',status:'bad',label:'✗ Avoid Travel',msg:`⛈️ Thunderstorm in ${city}. Visibility ${vis} km. Stay home.`});
  else if (vis<0.5) recs.push({icon:'fa-car',cat:'Travel & Commute',status:'bad',label:'✗ Near-Zero Visibility',msg:`🌫️ Only ${vis} km visibility — extremely dangerous to drive.`});
  else if (isRain(code)&&prec>=5) recs.push({icon:'fa-car',cat:'Travel & Commute',status:'warn',label:'⚠ Wet Roads',msg:`🌧️ ${prec.toFixed(1)} mm rain. Reduce speed, double following distance.`});
  else if (!isRain(code)&&wind<8&&vis>5) recs.push({icon:'fa-car',cat:'Travel & Commute',status:'good',label:'✓ Clear Roads',msg:`🛣️ ${city}: ${Math.round(temp)}°C, ${vis} km visibility, ${windDisplay(wind)} wind. Great travel conditions.`});
  else recs.push({icon:'fa-car',cat:'Travel & Commute',status:'warn',label:'⚠ Drive Carefully',msg:`🚗 ${city}: Wind ${windDisplay(wind)}, vis ${vis} km. Allow extra time.`});

  // 3. Productivity
  if (isStorm(code)||isRain(code)) recs.push({icon:'fa-laptop',cat:'Indoor Productivity',status:'good',label:'✓ Peak Focus Day',msg:`☕ ${city}: ${Math.round(temp)}°C rain/storm outside. Perfect deep-work session!`});
  else if (temp>35&&rh>65) recs.push({icon:'fa-laptop',cat:'Indoor Productivity',status:'bad',label:'✗ Heat Fatigue',msg:`🥵 ${city}: ${Math.round(temp)}°C + ${rh}% humidity. Set AC to 23°C, take breaks.`});
  else recs.push({icon:'fa-laptop',cat:'Indoor Productivity',status:'good',label:'✓ Good Balance',msg:`🌤 ${city}: ${Math.round(temp)}°C — schedule 90-min work blocks with outdoor breaks.`});

  // 4. Social
  if (isStorm(code)) recs.push({icon:'fa-umbrella-beach',cat:'Social & Outdoor Plans',status:'bad',label:'✗ Cancel Plans',msg:`⛈️ Storm in ${city}. All outdoor events must move inside.`});
  else if (temp>=20&&temp<=30&&wind<9&&!isRain(code)&&uv<8) recs.push({icon:'fa-umbrella-beach',cat:'Social & Outdoor Plans',status:'good',label:'✓ Perfect Outing',msg:`🧺 ${city}: ${Math.round(temp)}°C, gentle ${windDisplay(wind)} breeze. Ideal for picnics, BBQs!`});
  else if (temp>33||(uv>=8&&!isRain(code))) recs.push({icon:'fa-umbrella-beach',cat:'Social & Outdoor Plans',status:'warn',label:'⚠ Seek Shade',msg:`☀️ ${city}: UV ${uv.toFixed(1)} — plan events in shade or before 11 AM.`});
  else recs.push({icon:'fa-umbrella-beach',cat:'Social & Outdoor Plans',status:'warn',label:'⚠ Decent Conditions',msg:`🌥 ${city}: ${Math.round(temp)}°C. Bring a layer for outdoor gatherings.`});

  // 5. Sleep
  const nightTemp=currentWeather?.low_temp??(temp-5);
  if (nightTemp>=14&&nightTemp<=20&&rh>=35&&rh<=60) recs.push({icon:'fa-bed',cat:'Sleep Quality Tonight',status:'good',label:'✓ Excellent Sleep',msg:`😴 ${city}: Tonight's low ~${Math.round(nightTemp)}°C, ${rh}% humidity. Textbook sleep conditions.`});
  else if (nightTemp>24) recs.push({icon:'fa-bed',cat:'Sleep Quality Tonight',status:'bad',label:'✗ Hot Night',msg:`🥵 ${city}: Tonight stays ~${Math.round(nightTemp)}°C. Use fan/AC, wear thin cotton.`});
  else if (nightTemp<5) recs.push({icon:'fa-bed',cat:'Sleep Quality Tonight',status:'warn',label:'⚠ Freezing Night',msg:`🥶 ${city}: Dropping to ~${Math.round(nightTemp)}°C. Heavy duvet and warm socks.`});
  else recs.push({icon:'fa-bed',cat:'Sleep Quality Tonight',status:'good',label:'✓ Comfortable',msg:`🌙 ${city}: ~${Math.round(nightTemp)}°C tonight. A light blanket is all you need.`});

  // 6. UV Safety
  if (uv>=11) recs.push({icon:'fa-glasses',cat:'UV & Sun Safety',status:'bad',label:'✗ Extreme UV',msg:`☢️ ${city}: UV ${uv.toFixed(1)} EXTREME. SPF 50+ every 90 min. Stay indoors 10 AM–4 PM.`});
  else if (uv>=8) recs.push({icon:'fa-glasses',cat:'UV & Sun Safety',status:'bad',label:'✗ Very High UV',msg:`🔴 ${city}: UV ${uv.toFixed(1)}. Apply SPF 50+, wide-brim hat, avoid 11 AM–3 PM.`});
  else if (uv>=6) recs.push({icon:'fa-glasses',cat:'UV & Sun Safety',status:'warn',label:'⚠ High UV',msg:`🟠 ${city}: UV ${uv.toFixed(1)}. SPF 30–50, reapply every 2 hours.`});
  else if (uv>=3) recs.push({icon:'fa-glasses',cat:'UV & Sun Safety',status:'warn',label:'⚠ Moderate UV',msg:`🟡 ${city}: UV ${uv.toFixed(1)}. Light SPF 30 for outings over 30 minutes.`});
  else recs.push({icon:'fa-glasses',cat:'UV & Sun Safety',status:'good',label:'✓ UV Safe',msg:`🟢 ${city}: UV ${uv.toFixed(1)} — no sunscreen required. Today's peak was ${(d.uv_max||0).toFixed(1)}.`});

  // 7. Air Quality
  if (aqi>200) recs.push({icon:'fa-mask',cat:'Air Quality',status:'bad',label:'✗ Hazardous',msg:`☠️ ${city}: ${aqiStr} — HAZARDOUS. N95 mandatory if going outside.`});
  else if (aqi>150) recs.push({icon:'fa-mask',cat:'Air Quality',status:'bad',label:'✗ Wear N95',msg:`🟣 ${city}: ${aqiStr} — unhealthy for ALL. Avoid outdoor exercise.`});
  else if (aqi>100) recs.push({icon:'fa-mask',cat:'Air Quality',status:'warn',label:'⚠ Sensitive Groups',msg:`🟠 ${city}: ${aqiStr}. Sensitive groups limit outdoor time.`});
  else if (aqi>50) recs.push({icon:'fa-mask',cat:'Air Quality',status:'warn',label:'⚠ Moderate',msg:`🟡 ${city}: ${aqiStr}. Acceptable for most people.`});
  else recs.push({icon:'fa-mask',cat:'Air Quality',status:'good',label:'✓ Good Air',msg:`🟢 ${city}: ${aqiStr} — clean air. Safe for all outdoor activities.`});

  return recs;
}

function renderClothing(d) {
  const items=[], t=d.temp, code=d.weather.code, rh=d.rh;
  const uvW=d.uv_logic||d.uv_max||d.uv||0, wind=d.wind_spd;
  if      (t<-5) items.push('🧥 Extreme cold coat + thermal layers','🧣 Balaclava + insulated gloves','🥾 Insulated waterproof boots');
  else if (t<0)  items.push('🧥 Heavy down or wool coat','🧣 Thick scarf + winter gloves','🧦 Thermal socks');
  else if (t<8)  items.push('🧥 Warm jacket','🧤 Light gloves + warm socks');
  else if (t<15) items.push('🧥 Light jacket or fleece','👕 Long-sleeve underneath');
  else if (t<20) items.push('🧤 Hoodie or cardigan','👖 Jeans or chinos');
  else if (t<26) items.push('👕 T-shirt or light cotton top','👖 Light trousers or jeans');
  else if (t<32) items.push('👕 Breathable cotton top','🩳 Shorts or light trousers','🩴 Sandals');
  else           items.push('👕 Ultra-light moisture-wicking top','🩳 Light shorts','🩴 Open sandals');
  if (rh>85&&t>20) items.push('💧 Sweat-wicking fabric — very humid today');
  if (isStorm(code)) items.push('☂️ Large umbrella or full raincoat','🥾 Waterproof boots');
  else if (isRain(code)) items.push('☂️ Umbrella or raincoat','👟 Waterproof footwear');
  if (uvW>=8) items.push('🕶️ UV400 sunglasses','🧴 SPF 50+ sunscreen','🧢 Wide-brim hat');
  else if (uvW>=5) items.push('🕶️ UV sunglasses','🧴 SPF 30+ sunscreen');
  if (wind>12) items.push('🧢 Secure hat with chin strap','🧥 Windproof shell');
  if ((d.aqi||0)>150) items.push('😷 N95/FFP2 mask — air quality unhealthy');
  document.getElementById('wearItems').innerHTML = items.map(i=>`<div class="wear-item">${i}</div>`).join('');
}

function renderHealth(d) {
  const alerts=[], temp=d.temp, rh=d.rh, aqi=d.aqi||0, hi=heatIndex(temp,rh), city=d.city_name;
  const uv=d.uv_logic||d.uv_max||d.uv||0, wind=d.wind_spd, code=d.weather.code;
  // Hydration
  if (hi>40||temp>38) alerts.push({cls:'alert-crit',icon:'💧',msg:`Extreme heat in ${city}: ${Math.round(temp)}°C (heat index ${Math.round(hi)}°C). Drink 3.5–4 litres minimum. Heat stroke risk is REAL.`});
  else if (temp>26&&rh>70) alerts.push({cls:'alert-warn',icon:'💧',msg:`${city}: ${Math.round(temp)}°C with ${rh}% humidity. Drink 2–2.5 litres and rest frequently.`});
  else alerts.push({cls:'alert-ok',icon:'💧',msg:`${city}: ${Math.round(temp)}°C — 1.5–2 litres is sufficient. Extra glass if you exercise.`});
  // Air quality
  const aqiTag=d.aqiSource==='real'?`Real-time AQI ${aqi}`:`Estimated AQI ~${aqi}`;
  if (aqi>200) alerts.push({cls:'alert-crit',icon:'🫁',msg:`${city}: ${aqiTag} — HAZARDOUS. Stay indoors. N95 mandatory.`});
  else if (aqi>100) alerts.push({cls:'alert-warn',icon:'🫁',msg:`${city}: ${aqiTag}. Sensitive groups limit outdoor time.`});
  else alerts.push({cls:'alert-ok',icon:'🫁',msg:`${city}: ${aqiTag} — clean air. Safe for all activities.`});
  // Cold/flu
  if (isRain(code)&&temp<12) alerts.push({cls:'alert-warn',icon:'🤧',msg:`${city}: Wet + cold (${Math.round(temp)}°C). Change out of damp clothes, wash hands frequently.`});
  else if (temp<5) alerts.push({cls:'alert-warn',icon:'🤧',msg:`${city}: Sub-5°C (${Math.round(temp)}°C). Layer up properly.`});
  else alerts.push({cls:'alert-ok',icon:'🤧',msg:`${city}: Low cold/flu risk at ${Math.round(temp)}°C, ${rh}% humidity.`});
  // UV skin
  if (uv>=8) alerts.push({cls:'alert-crit',icon:'☀️',msg:`${city}: UV ${uv.toFixed(1)} — apply SPF 50+ every 2 hours. Prolonged exposure causes DNA damage.`});
  else if (uv>=5) alerts.push({cls:'alert-warn',icon:'☀️',msg:`${city}: UV ${uv.toFixed(1)}. Apply SPF 30. Reapply after swimming.`});
  else alerts.push({cls:'alert-ok',icon:'☀️',msg:`${city}: UV ${uv.toFixed(1)} — no protection needed right now.`});
  document.getElementById('alertsList').innerHTML = alerts.map(a=>`
    <div class="alert-item ${a.cls}">
      <span class="alert-icon">${a.icon}</span><span>${a.msg}</span>
    </div>`).join('');
}