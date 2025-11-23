// ====== CONFIG ======
const API_KEY = "YOUR_OPENWEATHER_API_KEY"; // <-- OpenWeatherMap api key kiriting
const API_BASE = "https://api.openweathermap.org/data/2.5";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 daqiqa
const DEFAULT_CITY = "Tashkent";

// ====== DOM ======
const cityInput = document.getElementById("cityInput");
const searchForm = document.getElementById("searchForm");
const statusBar = document.getElementById("statusBar");

const weatherCard = document.getElementById("weatherCard");
const cityNameEl = document.getElementById("cityName");
const updatedAtEl = document.getElementById("updatedAt");
const mainIconEl = document.getElementById("mainIcon");
const tempEl = document.getElementById("temp");
const descEl = document.getElementById("description");
const feelsLikeEl = document.getElementById("feelsLike");
const humidityEl = document.getElementById("humidity");
const windEl = document.getElementById("wind");
const pressureEl = document.getElementById("pressure");

const saveCityBtn = document.getElementById("saveCity");
const favoritesList = document.getElementById("favoritesList");

const themeToggle = document.getElementById("themeToggle");
const useGeoBtn = document.getElementById("useGeo");

// ====== UTIL: Cache helpers ======
function setCache(key, data) {
  const payload = { data, ts: Date.now() };
  localStorage.setItem(key, JSON.stringify(payload));
}

function getCache(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.ts < CACHE_TTL_MS) {
      return parsed.data;
    }
    return null; // expired
  } catch {
    return null;
  }
}

// ====== UTIL: UI helpers ======
function setStatus(msg, type = "info") {
  statusBar.textContent = msg;
  statusBar.style.color = type === "error" ? "var(--danger)" : "var(--muted)";
}

function toCelsius(kelvin) {
  return Math.round(kelvin - 273.15);
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString();
}

function iconFor(weatherMain, weatherId) {
  // Minimal emoji-based icon set
  const main = (weatherMain || "").toLowerCase();
  if (main.includes("cloud")) return "☁️";
  if (main.includes("rain")) return "🌧️";
  if (main.includes("drizzle")) return "🌦️";
  if (main.includes("thunder")) return "⛈️";
  if (main.includes("snow")) return "❄️";
  if (main.includes("mist") || main.includes("fog") || main.includes("haze")) return "🌫️";
  if (main.includes("clear")) return "☀️";
  // fallback by id
  if (weatherId >= 200 && weatherId < 300) return "⛈️";
  if (weatherId >= 300 && weatherId < 600) return "🌧️";
  if (weatherId >= 600 && weatherId < 700) return "❄️";
  if (weatherId >= 700 && weatherId < 800) return "🌫️";
  if (weatherId === 800) return "☀️";
  if (weatherId > 800) return "⛅";
  return "⛅";
}

// ====== API ======
async function fetchWeatherByCity(city) {
  const cacheKey = `weather:${city.toLowerCase()}`;
  const cached = getCache(cacheKey);
  if (cached) {
    setStatus(`Cache’dan ko‘rsatilyapti: ${city}`);
    return { data: cached, fromCache: true };
  }

  setStatus(`Yuklanyapti: ${city} ob-havo...`);
  const url = `${API_BASE}/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API xato: ${res.status}`);
  }
  const json = await res.json();
  setCache(cacheKey, json);
  return { data: json, fromCache: false };
}

async function fetchWeatherByCoords(lat, lon) {
  const cacheKey = `weather:${lat.toFixed(3)},${lon.toFixed(3)}`;
  const cached = getCache(cacheKey);
  if (cached) {
    setStatus(`Cache’dan ko‘rsatilyapti: GPS`);
    return { data: cached, fromCache: true };
  }

  setStatus(`GPS bo‘yicha yuklanyapti...`);
  const url = `${API_BASE}/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API xato: ${res.status}`);
  const json = await res.json();
  setCache(cacheKey, json);
  return { data: json, fromCache: false };
}

// ====== RENDER ======
function renderWeather(json) {
  const { name, weather, main, wind } = json;
  const w0 = weather?.[0];
  const icon = iconFor(w0?.main || "", w0?.id || 800);

  cityNameEl.textContent = name || "—";
  mainIconEl.textContent = icon;
  tempEl.textContent = toCelsius(main.temp);
  descEl.textContent = (w0?.description || "—")
    .replace(/\b\w/g, c => c.toUpperCase()); // capitalize words
  feelsLikeEl.textContent = `${toCelsius(main.feels_like)} °C`;
  humidityEl.textContent = `${main.humidity} %`;
  windEl.textContent = `${(wind.speed ?? 0).toFixed(1)} m/s`;
  pressureEl.textContent = `${main.pressure} hPa`;

  updatedAtEl.textContent = `Yangilandi: ${formatTime(Date.now())}`;

  weatherCard.classList.remove("hidden");
  weatherCard.setAttribute("aria-hidden", "false");
}

// ====== Favorites ======
function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem("favorites") || "[]");
  } catch { return []; }
}
function setFavorites(list) {
  localStorage.setItem("favorites", JSON.stringify(list));
}
function isFavorite(city) {
  return getFavorites().some(c => c.toLowerCase() === city.toLowerCase());
}
function toggleFavorite(city) {
  const favs = getFavorites();
  const exists = favs.findIndex(c => c.toLowerCase() === city.toLowerCase());
  if (exists >= 0) {
    favs.splice(exists, 1);
    setFavorites(favs);
    setStatus(`"${city}" o‘chirildi.`);
  } else {
    favs.push(city);
    setFavorites(favs);
    setStatus(`"${city}" saqlandi.`);
  }
  renderFavorites();
  updateStar(city);
}
function updateStar(city) {
  saveCityBtn.textContent = isFavorite(city) ? "★" : "☆";
}

function renderFavorites() {
  const favs = getFavorites();
  favoritesList.innerHTML = "";
  if (favs.length === 0) {
    favoritesList.innerHTML = `<span class="muted">Hozircha yo‘q.</span>`;
    return;
  }
  favs.forEach(city => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = city;
    chip.addEventListener("click", () => {
      cityInput.value = city;
      doSearch(city);
    });

    const remove = document.createElement("span");
    remove.className = "remove";
    remove.textContent = "✕";
    remove.title = "O‘chirish";
    remove.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFavorite(city);
    });
    chip.appendChild(remove);
    favoritesList.appendChild(chip);
  });
}

// ====== Theme ======
function initTheme() {
  const stored = localStorage.getItem("theme") || "dark";
  if (stored === "light") {
    document.body.classList.add("light");
    themeToggle.textContent = "🌞";
  } else {
    document.body.classList.remove("light");
    themeToggle.textContent = "🌙";
  }
}
function toggleTheme() {
  const isLight = document.body.classList.toggle("light");
  localStorage.setItem("theme", isLight ? "light" : "dark");
  themeToggle.textContent = isLight ? "🌞" : "🌙";
}

// ====== Graceful fallback ======
async function doSearch(city) {
  try {
    const { data, fromCache } = await fetchWeatherByCity(city);
    renderWeather(data);
    updateStar(data.name || city);
    if (!fromCache) setStatus(`Yangi ma’lumot olindi: ${data.name}`);
  } catch (err) {
    console.error(err);
    // fallback: try cache even if expired, then default city
    setStatus("API mavjud emas yoki xato. Fallback rejimi...", "error");
    const cacheKey = `weather:${city.toLowerCase()}`;
    const raw = localStorage.getItem(cacheKey);
    if (raw) {
      try {
        const payload = JSON.parse(raw);
        renderWeather(payload.data);
        updateStar(payload.data.name || city);
        setStatus("Eskirgan cache ko‘rsatildi.");
        return;
      } catch {}
    }
    if (city.toLowerCase() !== DEFAULT_CITY.toLowerCase()) {
      setStatus(`Default shahar: ${DEFAULT_CITY} ko‘rsatiladi.`);
      try {
        const { data } = await fetchWeatherByCity(DEFAULT_CITY);
        renderWeather(data);
        updateStar(data.name || DEFAULT_CITY);
        return;
      } catch {}
    }
    setStatus("Ma’lumot topilmadi. Iltimos, keyinroq urinib ko‘ring.", "error");
  }
}

async function doGeo() {
  if (!("geolocation" in navigator)) {
    setStatus("Geolokatsiya qo‘llab-quvvatlanmaydi.", "error");
    return;
  }
  setStatus("Joylashuv aniqlanmoqda...");
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { latitude, longitude } = pos.coords;
    try {
      const { data } = await fetchWeatherByCoords(latitude, longitude);
      renderWeather(data);
      updateStar(data.name || "GPS");
      setStatus(`Joylashuv: ${data.name}`);
    } catch (err) {
      console.error(err);
      setStatus("GPS bo‘yicha ma’lumot olinmadi.", "error");
    }
  }, (err) => {
    console.error(err);
    setStatus("Geolokatsiya rad etildi yoki xato.", "error");
  }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 });
}

// ====== Events ======
searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const city = cityInput.value.trim();
  if (!city) return;
  doSearch(city);
});

saveCityBtn.addEventListener("click", () => {
  const city = cityNameEl.textContent;
  if (!city || city === "—") return;
  toggleFavorite(city);
});

themeToggle.addEventListener("click", toggleTheme);
useGeoBtn.addEventListener("click", doGeo);

// ====== Init ======
(function init() {
  initTheme();
  renderFavorites();
  // Auto-load last selected or default
  const lastCity = localStorage.getItem("lastCity") || DEFAULT_CITY;
  cityInput.value = lastCity;
  doSearch(lastCity);
  // Track last city on submit
  searchForm.addEventListener("submit", () => {
    const c = cityInput.value.trim();
    if (c) localStorage.setItem("lastCity", c);
  });
})();
