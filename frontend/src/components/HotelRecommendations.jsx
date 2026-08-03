import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { apiUrl } from "../config";
import "./HotelRecommendations.css";
import { syncFavorite } from "../services/persistenceService";
import { useAuth } from "../context/AuthContext";
import { recordSearch } from "../services/travelDataService";
import { validHotelWebsiteUrl } from "../utils/hotelWebsite";

const hotelTypes = ["All types", "Luxury", "Budget", "Business", "Family", "Couple", "Resort"];
const amenityFilters = ["WiFi", "Pool", "Breakfast", "Parking", "Air conditioning"];
const amenityIcons = { WiFi: "⌁", Pool: "≈", Breakfast: "☕", Parking: "P", "Air conditioning": "❄", Spa: "✦" };
const fallbacks = {
  Luxury: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1000&q=85",
  Resort: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1000&q=85",
  Budget: "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=1000&q=85",
  Business: "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1000&q=85",
  Family: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1000&q=85",
  Couple: "https://images.unsplash.com/photo-1455587734955-081b22074882?auto=format&fit=crop&w=1000&q=85",
  default: "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1000&q=85",
};
const priceRank = (price) => ["PRICE_LEVEL_FREE", "PRICE_LEVEL_INEXPENSIVE", "PRICE_LEVEL_MODERATE", "PRICE_LEVEL_EXPENSIVE", "PRICE_LEVEL_VERY_EXPENSIVE"].indexOf(price);
const directionsUrl = (hotel) => { const destination = Number.isFinite(hotel.coordinates?.latitude) ? `${hotel.coordinates.latitude},${hotel.coordinates.longitude}` : `${hotel.name} ${hotel.address}`; return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`; };
const fallbackImage = (hotel) => fallbacks[hotel.category] || fallbacks.default;
const hotelImage = (hotel) => hotel.photoName ? apiUrl(`/api/place-photo?name=${encodeURIComponent(hotel.photoName)}`) : hotel.image || fallbackImage(hotel);
const normalizeAmenity = (value) => { const name = value.toLowerCase(); if (name.includes("wi-fi") || name.includes("wifi")) return "WiFi"; if (name.includes("pool")) return "Pool"; if (name.includes("breakfast")) return "Breakfast"; if (name.includes("parking")) return "Parking"; if (name.includes("air conditioning") || name === "ac") return "Air conditioning"; if (name.includes("spa")) return "Spa"; return value; };
const amenitiesFor = (hotel) => [...new Set((hotel.amenities || ["WiFi", "Breakfast", "Air conditioning"]).map(normalizeAmenity))];
const markerIcon = (active) => L.divIcon({ className: "hotel-map-pin", html: `<span class="${active ? "active" : ""}">H</span>`, iconSize: [42, 42], iconAnchor: [21, 38], popupAnchor: [0, -34] });

function HotelMapViewport({ center, selectedHotel }) { const map = useMap(); useEffect(() => { if (selectedHotel) map.flyTo([selectedHotel.coordinates.latitude, selectedHotel.coordinates.longitude], 15, { duration: .7 }); else if (center) map.setView([center.latitude, center.longitude], 12); }, [center, selectedHotel, map]); return null; }

export default function HotelRecommendations({ destination, onAddToTrip }) {
  const { user } = useAuth();
  const city = destination.trim();
  const [state, setState] = useState({ status: "idle", hotels: [], cityCenter: null, error: "" });
  const [filters, setFilters] = useState({ maxBudget: 500, rating: "0", type: "All types", distance: "Any", amenities: [] });
  const [sort, setSort] = useState("Best Rated");
  const [selectedHotel, setSelectedHotel] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const cardRefs = useRef({});
  const [favoriteIds, setFavoriteIds] = useState(() => { try { return new Set(JSON.parse(localStorage.getItem("roamly-favourite-hotels") || "[]")); } catch { return new Set(); } });

  useEffect(() => {
    if (city.length < 2) { setState({ status: "idle", hotels: [], cityCenter: null, error: "" }); return undefined; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setState((current) => ({ ...current, status: "loading", error: "" }));
      try {
        const response = await fetch(apiUrl(`/api/hotels?city=${encodeURIComponent(city)}`), { signal: controller.signal });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success || !Array.isArray(payload.hotels)) throw new Error(payload?.error?.message || "Unable to load hotel recommendations.");
        setState({ status: "ready", hotels: payload.hotels, cityCenter: payload.cityCenter, error: "" });
        if (user) void recordSearch(city, "hotel", { results: payload.hotels.length }).catch(() => {});
      } catch (error) { if (error.name !== "AbortError") setState({ status: "error", hotels: [], cityCenter: null, error: error.message || "Unable to reach hotel recommendations." }); }
    }, 600);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [city, retryKey, user]);

  const highestRate = Math.max(500, ...state.hotels.map((hotel) => Number(hotel.nightlyRate) || 0));
  const hotels = useMemo(() => state.hotels.filter((hotel) => {
    const amenities = amenitiesFor(hotel);
    return hotel.rating >= Number(filters.rating)
      && (filters.type === "All types" || hotel.category === filters.type)
      && (filters.distance === "Any" || hotel.distanceKm == null || hotel.distanceKm <= Number(filters.distance))
      && (!hotel.nightlyRate || hotel.nightlyRate <= filters.maxBudget)
      && filters.amenities.every((amenity) => amenities.includes(amenity));
  }).sort((a, b) => {
    if (sort === "Lowest Price") return (a.nightlyRate ?? Infinity) - (b.nightlyRate ?? Infinity) || b.rating - a.rating;
    if (sort === "Highest Price") return (b.nightlyRate ?? 0) - (a.nightlyRate ?? 0) || b.rating - a.rating;
    if (sort === "Nearest") return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
    if (sort === "Most Popular") return b.reviewCount - a.reviewCount;
    return b.rating - a.rating || priceRank(a.priceLevel) - priceRank(b.priceLevel);
  }), [state.hotels, filters, sort]);

  const toggleAmenity = (amenity) => setFilters((current) => ({ ...current, amenities: current.amenities.includes(amenity) ? current.amenities.filter((item) => item !== amenity) : [...current.amenities, amenity] }));
  const clearFilters = () => { setFilters({ maxBudget: highestRate, rating: "0", type: "All types", distance: "Any", amenities: [] }); setSort("Best Rated"); };
  const toggleFavorite = (hotel) => setFavoriteIds((current) => { if (!user) { window.location.assign("/login"); return current; } const next = new Set(current); const selected = !next.has(hotel.id); selected ? next.add(hotel.id) : next.delete(hotel.id); void syncFavorite("hotels", hotel, selected).catch(() => {}); localStorage.setItem("roamly-favourite-hotels", JSON.stringify([...next])); return next; });
  const selectHotel = (hotel, scroll = false) => { setSelectedHotel(hotel); if (scroll) cardRefs.current[hotel.id]?.scrollIntoView({ behavior: "smooth", block: "center" }); };

  useEffect(() => { if (state.status === "ready") setFilters((current) => current.maxBudget === 500 ? { ...current, maxBudget: highestRate } : current); }, [state.status, highestRate]);
  if (!city) return null;
  return <section className="hotel-recommendations"><header className="hotel-heading"><div><p>ROAMLY STAY COLLECTION</p><h2>Stay somewhere <em>remarkable</em></h2><span>Handpicked hotels around {city}, balancing comfort, character, and location.</span></div><div className="hotel-result-count"><strong>{hotels.length}</strong><span>stays selected</span></div></header>
    {state.status === "loading" && <HotelSkeleton />}
    {state.status === "error" && <HotelFeedback error={state.error} onRetry={() => setRetryKey((value) => value + 1)} />}
    {state.status === "ready" && <><div className="hotel-filters"><div className="hotel-filter-row"><label className="hotel-budget"><span>Nightly budget <b>Up to USD {filters.maxBudget}</b></span><input type="range" min="50" max={highestRate} step="10" value={filters.maxBudget} onChange={(event) => setFilters((current) => ({ ...current, maxBudget: Number(event.target.value) }))} /></label><Filter label="Rating" value={filters.rating} onChange={(rating) => setFilters((current) => ({ ...current, rating }))} options={[["0", "Any rating"], ["4", "4.0+ stars"], ["4.5", "4.5+ stars"]]} /><Filter label="Hotel type" value={filters.type} onChange={(type) => setFilters((current) => ({ ...current, type }))} options={hotelTypes.map((item) => [item, item])} /><Filter label="Distance" value={filters.distance} onChange={(distance) => setFilters((current) => ({ ...current, distance }))} options={[["Any", "Any distance"], ["2", "Within 2 km"], ["5", "Within 5 km"], ["10", "Within 10 km"]]} /><Filter label="Sort by" value={sort} onChange={setSort} options={["Best Rated", "Lowest Price", "Highest Price", "Nearest", "Most Popular"].map((item) => [item, item])} /><button type="button" className="hotel-clear" onClick={clearFilters}>Clear filters</button></div><div className="hotel-amenity-filters"><small>Must-have amenities</small>{amenityFilters.map((amenity) => <button type="button" key={amenity} className={filters.amenities.includes(amenity) ? "active" : ""} onClick={() => toggleAmenity(amenity)}><span>{amenityIcons[amenity]}</span>{amenity === "Air conditioning" ? "AC" : amenity}</button>)}</div></div>
      {state.cityCenter && <div className="hotel-map"><MapContainer center={[state.cityCenter.latitude, state.cityCenter.longitude]} zoom={12} scrollWheelZoom={false} className="hotel-leaflet"><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><HotelMapViewport center={state.cityCenter} selectedHotel={selectedHotel} />{hotels.map((hotel) => <Marker key={hotel.id} position={[hotel.coordinates.latitude, hotel.coordinates.longitude]} icon={markerIcon(selectedHotel?.id === hotel.id)} eventHandlers={{ click: () => selectHotel(hotel, true) }}><Popup><div className="hotel-popup"><img src={hotelImage(hotel)} onError={(event) => { event.currentTarget.src = fallbackImage(hotel); }} alt="" /><div><strong>{hotel.name}</strong><span>★ {hotel.rating?.toFixed(1) || "New"} · {hotel.currency || "USD"} {hotel.nightlyRate || "—"}</span></div></div></Popup></Marker>)}</MapContainer><span>● Explore stays on the map</span></div>}
      {hotels.length ? <motion.div layout className="hotel-grid">{hotels.map((hotel, index) => <HotelCard key={hotel.id} hotel={hotel} index={index} selected={selectedHotel?.id === hotel.id} favorite={favoriteIds.has(hotel.id)} cardRef={(node) => { cardRefs.current[hotel.id] = node; }} onOpen={() => selectHotel(hotel)} onFavorite={() => toggleFavorite(hotel)} />)}</motion.div> : <HotelFeedback />}</>}
    <AnimatePresence>{selectedHotel && <HotelModal hotel={selectedHotel} isFavorite={favoriteIds.has(selectedHotel.id)} onClose={() => setSelectedHotel(null)} onFavorite={() => toggleFavorite(selectedHotel)} onAdd={() => onAddToTrip?.(selectedHotel)} />}</AnimatePresence>
  </section>;
}

function Filter({ label, value, onChange, options }) { return <label>{label}<select value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([optionValue, title]) => <option value={optionValue} key={optionValue}>{title}</option>)}</select></label>; }
function HotelImage({ hotel }) { return <img src={hotelImage(hotel)} onError={(event) => { if (event.currentTarget.src !== fallbackImage(hotel)) event.currentTarget.src = fallbackImage(hotel); }} alt={`${hotel.name} accommodation`} loading="lazy" />; }
function HotelCard({ hotel, index, selected, favorite, cardRef, onOpen, onFavorite }) { const websiteUrl = validHotelWebsiteUrl(hotel.website); const amenities = amenitiesFor(hotel).slice(0, 5); return <motion.article ref={cardRef} layout initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .42, delay: Math.min(index * .055, .35) }} className={`hotel-card ${selected ? "selected" : ""}`} onClick={onOpen} tabIndex="0" onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && onOpen()}><div className="hotel-photo"><HotelImage hotel={hotel} /><div className="hotel-photo-shade" /><span className="hotel-category">{hotel.category || "Hotel"}</span>{hotel.discountPercent > 0 && <span className="hotel-deal">{hotel.discountPercent}% off</span>}<button className={`hotel-favorite ${favorite ? "active" : ""}`} onClick={(event) => { event.stopPropagation(); onFavorite(); }} aria-label={favorite ? "Remove favorite" : "Save favorite"}>{favorite ? "♥" : "♡"}</button></div><div className="hotel-card-body"><div className="hotel-card-title"><h3>{hotel.name}</h3><b><span>★</span> {hotel.rating ? hotel.rating.toFixed(1) : "New"}</b></div><p className="hotel-reviews">{hotel.reviewCount ? `${hotel.reviewCount.toLocaleString()} reviews` : "Recently listed"}</p><p className="hotel-address"><span>⌖</span>{hotel.address}</p><div className="hotel-price-row"><div><strong>{hotel.currency || "USD"} {hotel.nightlyRate || "—"}</strong><span>per night</span></div><p><b>{hotel.distanceKm == null ? "Nearby" : `${hotel.distanceKm.toFixed(1)} km`}</b> from destination</p></div><div className="hotel-amenities">{amenities.map((amenity) => <span key={amenity} title={amenity}><i>{amenityIcons[amenity] || "✓"}</i>{amenity === "Air conditioning" ? "AC" : amenity}</span>)}</div><div className="hotel-card-actions" onClick={(event) => event.stopPropagation()}>{websiteUrl && <a href={websiteUrl} target="_blank" rel="noopener noreferrer">Website / Booking</a>}<a className="outline" href={directionsUrl(hotel)} target="_blank" rel="noreferrer">Directions <span>↗</span></a></div></div></motion.article>; }
function HotelSkeleton() { return <div className="hotel-grid">{Array.from({ length: 6 }, (_, index) => <div className="hotel-skeleton" key={index}><i /><b /><b /><small /></div>)}</div>; }
function HotelFeedback({ error, onRetry }) { return <motion.div className={`hotel-feedback ${error ? "error" : ""}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}><div className="hotel-empty-art">⌂<span>✦</span></div><strong>{error ? "Hotel recommendations are unavailable" : "No stays match your filters"}</strong><p>{error || "Adjust your budget or remove a filter to discover more places."}</p>{onRetry && <button type="button" onClick={onRetry}>Try again</button>}</motion.div>; }
function HotelModal({ hotel, isFavorite, onClose, onFavorite, onAdd }) { const websiteUrl = validHotelWebsiteUrl(hotel.website); return <motion.div className="hotel-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}><motion.article className="hotel-modal" initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 25 }} onMouseDown={(event) => event.stopPropagation()}><div className="hotel-modal-photo"><HotelImage hotel={hotel} /><button className="hotel-close" onClick={onClose} aria-label="Close hotel details">×</button></div><div className="hotel-modal-body"><p className="hotel-eyebrow">{hotel.category || "Hotel"} · {hotel.currency || "USD"} {hotel.nightlyRate || "—"} per night</p><h2>{hotel.name}</h2><p className="hotel-modal-rating">★ {hotel.rating ? hotel.rating.toFixed(1) : "New"} · {hotel.reviewCount || 0} reviews</p><p>{hotel.address}</p><div className="hotel-amenities modal">{amenitiesFor(hotel).map((amenity) => <span key={amenity}><i>{amenityIcons[amenity] || "✓"}</i>{amenity}</span>)}</div><div className="hotel-actions"><a href={directionsUrl(hotel)} target="_blank" rel="noreferrer">Get Directions</a>{websiteUrl && <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="outline">Website / Booking</a>}<button onClick={onAdd}>Add to Trip</button><button className="outline" onClick={onFavorite}>{isFavorite ? "Saved ♥" : "Save Favorite"}</button></div></div></motion.article></motion.div>; }
