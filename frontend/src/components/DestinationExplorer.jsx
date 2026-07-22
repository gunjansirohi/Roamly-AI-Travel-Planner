import { useEffect, useRef, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { AnimatePresence, motion } from "framer-motion";
import "leaflet/dist/leaflet.css";
import "./DestinationExplorer.css";
import { apiUrl } from "../config";

const DEFAULT_CENTER = [20.5937, 78.9629];
const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=85";
const markerIcon = L.divIcon({ className: "roamly-marker", html: "<span>✦</span>", iconSize: [38, 38], iconAnchor: [19, 38], popupAnchor: [0, -38] });

function MapViewport({ destination }) {
  const map = useMap();
  useEffect(() => {
    if (destination) map.flyTo(destination.coordinates, 12, { duration: 1.3 });
  }, [destination, map]);
  return null;
}

function MapControls({ mapShell, onLocation, onError }) {
  const map = useMap();
  const locate = () => {
    if (!navigator.geolocation) return onError("Your browser does not support current-location access.");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { const location = [coords.latitude, coords.longitude]; map.flyTo(location, 13, { duration: 1.1 }); onLocation(location); },
      () => onError("We couldn’t access your location. Check your browser permissions and try again."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };
  const fullscreen = () => {
    const element = mapShell.current;
    if (!element) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else element.requestFullscreen?.().catch(() => onError("Fullscreen is not available in this browser."));
  };
  return <div className="leaflet-custom-controls" aria-label="Map controls"><button onClick={() => map.zoomIn()} aria-label="Zoom in">+</button><button onClick={() => map.zoomOut()} aria-label="Zoom out">−</button><button onClick={fullscreen} aria-label="Toggle fullscreen">⛶</button><button onClick={locate} aria-label="Use current location">⌖</button></div>;
}

function DestinationExplorer({ onPlanTrip }) {
  const mapShell = useRef(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [weather, setWeather] = useState(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const term = query.trim();
    if (term.length < 3) { setSuggestions([]); return undefined; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true); setError("");
      try {
        const response = await fetch(apiUrl(`/api/destinations/search?q=${encodeURIComponent(term)}`), { signal: controller.signal });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success) throw new Error(data?.error?.message || `Destination search failed (${response.status}).`);
        setSuggestions(data.destinations || []);
      } catch (requestError) {
        if (requestError.name !== "AbortError") { setError(requestError.message || "Destination search is temporarily unavailable. Please try again."); setSuggestions([]); }
      } finally { if (!controller.signal.aborted) setSearching(false); }
    }, 450);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);

  const getWeather = async (latitude, longitude) => {
    try {
      const response = await fetch(apiUrl(`/api/destination-weather?latitude=${latitude}&longitude=${longitude}`));
      if (!response.ok) throw new Error("Weather unavailable");
      const data = await response.json();
      setWeather(data.weather || null);
    } catch { setWeather(null); }
  };

  const selectDestination = (place) => {
    const latitude = Number(place.lat); const longitude = Number(place.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) { setError("This result does not include usable map coordinates."); return; }
    const address = place.address || {};
    const name = place.name || address.city || address.town || address.village || address.country || place.display_name.split(",")[0];
    const destination = { name, displayName: place.display_name, country: address.country || "Not available", region: address.state || address.region || address.county || "Not available", coordinates: [latitude, longitude], image: FALLBACK_IMAGE };
    setSelected(destination); setQuery(place.display_name); setSuggestions([]); setWeather(null); getWeather(latitude, longitude);
  };

  const useCurrentLocation = (coordinates) => {
    const [latitude, longitude] = coordinates;
    setSelected({ name: "Your current location", displayName: "Current location", country: "Detected by your device", region: "Not available", coordinates, image: FALLBACK_IMAGE });
    setQuery("Your current location"); setSuggestions([]); setWeather(null); getWeather(latitude, longitude);
  };

  return <section id="smart-search" className="relative bg-[#edf0e9] px-5 py-16 sm:px-10 lg:px-20 lg:py-24"><div className="mx-auto max-w-7xl"><div className="mb-9 max-w-2xl"><p className="mb-3 text-xs font-bold tracking-[0.22em] text-[#59745e]">✦ SMART DESTINATION SEARCH</p><h2 className="font-['Playfair_Display'] text-4xl font-semibold tracking-tight text-[#15201d] sm:text-5xl">See the journey before you <span className="italic text-[#57795c]">go.</span></h2><p className="mt-4 text-sm leading-6 text-[#52605b] sm:text-base">Search any city, country, or landmark to explore it on the map and start planning.</p></div>
    <div className="overflow-hidden rounded-3xl border border-[#d4ddd0] bg-white shadow-xl shadow-[#173b35]/10"><div className="grid lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,.8fr)]"><div ref={mapShell} className="relative min-h-[530px] bg-[#dce6dc]"><div className="absolute left-4 right-4 top-4 z-[1000] sm:left-6 sm:right-auto sm:w-[min(460px,calc(100%-3rem))]"><div className="rounded-2xl border border-white/40 bg-white/90 p-2 shadow-lg backdrop-blur-xl"><div className="flex items-center gap-2"><span className="pl-2 text-lg text-[#55705c]">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a city, country, or landmark" className="w-full bg-transparent px-1 py-2.5 text-sm text-[#15201d] outline-none placeholder:text-[#718078]" aria-label="Search destinations" />{searching && <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-[#55705c] border-t-transparent" />}</div><AnimatePresence>{suggestions.length > 0 && <motion.ul initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="max-h-64 overflow-y-auto border-t border-[#dbe4d8] pt-1">{suggestions.map((suggestion) => <li key={suggestion.place_id}><button onClick={() => selectDestination(suggestion)} className="w-full px-3 py-3 text-left text-sm text-[#26372e] transition hover:bg-[#eff5e9]"><span className="mr-2 text-[#608469]">⌖</span>{suggestion.display_name}</button></li>)}</motion.ul>}</AnimatePresence></div>{error && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}</div>
      <MapContainer center={DEFAULT_CENTER} zoom={5} className="h-[530px] w-full" zoomControl={false} scrollWheelZoom><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><MapViewport destination={selected} /><MapControls mapShell={mapShell} onLocation={useCurrentLocation} onError={setError} />{selected && <Marker position={selected.coordinates} icon={markerIcon}><Popup><div className="min-w-[180px] text-[#15201d]"><strong className="block text-sm">{selected.name}</strong><p className="mt-1 text-xs text-[#59655f]">{selected.coordinates[0].toFixed(5)}, {selected.coordinates[1].toFixed(5)}</p></div></Popup></Marker>}</MapContainer></div><DestinationPanel selected={selected} weather={weather} onPlanTrip={onPlanTrip} /></div></div></div></section>;
}

function DestinationPanel({ selected, weather, onPlanTrip }) {
  if (!selected) return <aside className="flex min-h-[530px] flex-col justify-center bg-[#153a34] p-7 text-white sm:p-9"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#d6fb72] text-xl text-[#153a34]">✦</div><p className="mt-7 text-xs font-bold tracking-[0.18em] text-[#d6fb72]">READY WHEN YOU ARE</p><h3 className="mt-3 font-['Playfair_Display'] text-3xl font-semibold leading-tight">Search for a place worth remembering.</h3><p className="mt-4 max-w-sm text-sm leading-6 text-white/65">Search the OpenStreetMap directory for destinations worldwide, then explore their precise location before planning.</p></aside>;
  return <motion.aside key={selected.displayName} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} className="max-h-[530px] overflow-y-auto bg-[#153a34] text-white"><img src={selected.image} alt="Travel inspiration" className="h-48 w-full object-cover" /><div className="p-6 sm:p-7"><p className="text-xs font-bold tracking-[0.16em] text-[#d6fb72]">{selected.country}</p><h3 className="mt-1 font-['Playfair_Display'] text-3xl font-semibold">{selected.name}</h3><p className="mt-2 text-sm leading-6 text-white/65">{selected.displayName}</p><div className="mt-5 grid grid-cols-2 gap-3 text-xs"><Fact label="Region" value={selected.region} /><Fact label="Coordinates" value={`${selected.coordinates[0].toFixed(3)}, ${selected.coordinates[1].toFixed(3)}`} /><Fact label="Best time" value="Check seasonal conditions" /><Fact label="Time zone" value={weather?.timezone || "Loading…"} /><Fact label="Weather" value={weather ? `${weather.temperature}°C · wind ${weather.wind} km/h` : "Loading…"} wide /></div><button onClick={() => onPlanTrip(selected.name)} className="mt-7 w-full rounded-full bg-[#d6fb72] px-4 py-3 text-sm font-bold text-[#173b35] transition hover:bg-white">Plan My Trip <span className="ml-1">→</span></button></div></motion.aside>;
}
function Fact({ label, value, wide }) { return <div className={`rounded-xl bg-white/10 p-3 ${wide ? "col-span-2" : ""}`}><p className="text-[10px] font-bold uppercase tracking-[.12em] text-white/45">{label}</p><p className="mt-1 truncate text-xs font-medium text-white/90" title={value}>{value}</p></div>; }

export default DestinationExplorer;
