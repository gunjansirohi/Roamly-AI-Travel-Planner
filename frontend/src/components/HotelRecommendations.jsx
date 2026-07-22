import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { apiUrl } from "../config";
import "./HotelRecommendations.css";
import { syncFavorite } from "../services/persistenceService";
import { useAuth } from "../context/AuthContext";
import { recordSearch } from "../services/travelDataService";

// The hotel UI talks only to our Express routes; the Google Places key remains server-only.
const priceLabels = { PRICE_LEVEL_FREE: "Free", PRICE_LEVEL_INEXPENSIVE: "Budget", PRICE_LEVEL_MODERATE: "Moderate", PRICE_LEVEL_EXPENSIVE: "Premium", PRICE_LEVEL_VERY_EXPENSIVE: "Luxury", PRICE_LEVEL_UNSPECIFIED: "Price unavailable" };
const hotelTypes = ["All types", "Luxury", "Budget", "Business", "Family", "Resort"];
const markerIcon = (active) => L.divIcon({ className: "hotel-map-pin", html: `<span class="${active ? "active" : ""}">H</span>`, iconSize: [32, 32], iconAnchor: [16, 16] });
const imageUrl = (photoName) => { if (photoName?.startsWith("destination:")) { const [, city, slot] = photoName.split(":"); return apiUrl(`/api/place-photos/fallback?city=${encodeURIComponent(city)}&slot=${encodeURIComponent(slot)}`); } return apiUrl(`/api/hotels/photo?name=${encodeURIComponent(photoName || "")}`); };
const priceRank = (price) => ["PRICE_LEVEL_FREE", "PRICE_LEVEL_INEXPENSIVE", "PRICE_LEVEL_MODERATE", "PRICE_LEVEL_EXPENSIVE", "PRICE_LEVEL_VERY_EXPENSIVE"].indexOf(price);

function HotelMapViewport({ center, selectedHotel }) {
  const map = useMap();
  useEffect(() => { if (selectedHotel) map.flyTo([selectedHotel.coordinates.latitude, selectedHotel.coordinates.longitude], 15, { duration: 0.8 }); else if (center) map.flyTo([center.latitude, center.longitude], 12, { duration: 0.8 }); }, [center, selectedHotel, map]);
  return null;
}

// Shown after the planner form (and after the itinerary, when present); destination changes trigger a fresh nearby search.
export default function HotelRecommendations({ destination, onAddToTrip }) {
  const { user } = useAuth();
  const city = destination.trim();
  const [state, setState] = useState({ status: "idle", hotels: [], cityCenter: null, error: "" });
  const [filters, setFilters] = useState({ budget: "Any budget", rating: "0", type: "All types", distance: "Any distance", price: "Any price" });
  const [sort, setSort] = useState("Best Rated");
  const [selectedHotel, setSelectedHotel] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  // Saved IDs are local-only and never sent to Google Places.
  const [favoriteIds, setFavoriteIds] = useState(() => { try { return new Set(JSON.parse(localStorage.getItem("roamly-favourite-hotels") || "[]")); } catch { return new Set(); } });

  useEffect(() => {
    if (city.length < 2) { setState({ status: "idle", hotels: [], cityCenter: null, error: "" }); return undefined; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setState((current) => ({ ...current, status: "loading", error: "" }));
      try {
        const response = await fetch(apiUrl(`/api/hotels?city=${encodeURIComponent(city)}`), { signal: controller.signal });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || "Unable to load hotel recommendations.");
        if (!Array.isArray(payload.hotels)) throw new Error("The hotel service returned an invalid response.");
        setState({ status: "ready", hotels: payload.hotels.map((hotel, index) => ({ ...hotel, fallbackPhotoSlot: index })), cityCenter: payload.cityCenter, error: "" });
        if (user) void recordSearch(city, "hotel", { results: payload.hotels.length }).catch(() => {});
      } catch (error) { if (error.name !== "AbortError") setState({ status: "error", hotels: [], cityCenter: null, error: error.message || "Unable to reach hotel recommendations." }); }
    }, 600);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [city, retryKey, user]);

  const hotels = useMemo(() => state.hotels.filter((hotel) => {
    const rating = Number(filters.rating);
    const maxDistance = filters.distance === "Any distance" ? Infinity : Number(filters.distance);
    // Budget and price can both narrow results; the tighter selected ceiling wins.
    const maxBudget = filters.budget === "Any budget" ? Infinity : Number(filters.budget);
    const maxPrice = filters.price === "Any price" ? Infinity : Number(filters.price);
    const priceCeiling = Math.min(maxBudget, maxPrice);
    return hotel.rating >= rating && (filters.type === "All types" || hotel.category === filters.type) && (hotel.distanceKm == null || hotel.distanceKm <= maxDistance) && (priceRank(hotel.priceLevel) < 0 || priceRank(hotel.priceLevel) <= priceCeiling);
  }).sort((a, b) => {
    if (sort === "Lowest Price") return priceRank(a.priceLevel) - priceRank(b.priceLevel) || b.rating - a.rating;
    if (sort === "Nearest") return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
    if (sort === "Most Popular") return b.reviewCount - a.reviewCount;
    return b.rating - a.rating || b.reviewCount - a.reviewCount;
  }), [state.hotels, filters, sort]);

  const toggleFavorite = (hotel) => setFavoriteIds((current) => {
    if (!user) { window.location.assign("/login"); return current; }
    const next = new Set(current); const selected = !next.has(hotel.id); selected ? next.add(hotel.id) : next.delete(hotel.id);
    void syncFavorite("hotels", hotel, selected).catch(() => {});
    localStorage.setItem("roamly-favourite-hotels", JSON.stringify([...next])); return next;
  });

  if (!city) return null;
  return <section className="hotel-recommendations"><div className="hotel-heading"><div><p>STAY, CURATED FOR YOU</p><h2>Recommended <em>Hotels</em></h2><span>Nearby stays in {city}, powered by Google Places.</span></div>{state.status === "ready" && <label>Sort by <select value={sort} onChange={(event) => setSort(event.target.value)}>{["Best Rated", "Lowest Price", "Nearest", "Most Popular"].map((option) => <option key={option}>{option}</option>)}</select></label>}</div>
    {state.status === "loading" && <HotelSkeleton />}
    {state.status === "error" && <div className="hotel-feedback error"><strong>Hotel recommendations are unavailable</strong><p>{state.error}</p><button type="button" onClick={() => setRetryKey((value) => value + 1)}>Retry</button></div>}
    {state.status === "ready" && <><div className="hotel-filters"><Filter label="Budget" value={filters.budget} onChange={(value) => setFilters((current) => ({ ...current, budget: value }))} options={[["Any budget", "Any budget"], ["1", "Budget stays"], ["2", "Up to moderate"], ["4", "Any budget"]]} /><Filter label="Rating" value={filters.rating} onChange={(value) => setFilters((current) => ({ ...current, rating: value }))} options={[["0", "Any rating"], ["3", "3+"], ["4", "4+"], ["4.5", "4.5+"]]} /><Filter label="Hotel type" value={filters.type} onChange={(value) => setFilters((current) => ({ ...current, type: value }))} options={hotelTypes.map((item) => [item, item])} /><Filter label="Distance" value={filters.distance} onChange={(value) => setFilters((current) => ({ ...current, distance: value }))} options={[["Any distance", "Any distance"], ["2", "Within 2 km"], ["5", "Within 5 km"], ["10", "Within 10 km"]]} /><Filter label="Price" value={filters.price} onChange={(value) => setFilters((current) => ({ ...current, price: value }))} options={[["Any price", "Any price"], ["1", "Budget"], ["2", "Moderate"], ["4", "Premium"]]} /></div>
      {state.cityCenter && <div className="hotel-map"><MapContainer center={[state.cityCenter.latitude, state.cityCenter.longitude]} zoom={12} scrollWheelZoom={false} className="h-full w-full"><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><HotelMapViewport center={state.cityCenter} selectedHotel={selectedHotel} />{hotels.map((hotel) => <Marker key={hotel.id} position={[hotel.coordinates.latitude, hotel.coordinates.longitude]} icon={markerIcon(selectedHotel?.id === hotel.id)} eventHandlers={{ click: () => setSelectedHotel(hotel) }} />)}</MapContainer><span>Hotel map · select a marker to view details</span></div>}
      {!hotels.length ? <div className="hotel-feedback"><strong>No hotels match these filters.</strong><p>Try broadening your rating, distance, or price preferences.</p></div> : <motion.div layout className="hotel-grid">{hotels.map((hotel, index) => <HotelCard key={hotel.id} hotel={hotel} city={city} index={index} favorite={favoriteIds.has(hotel.id)} onOpen={() => setSelectedHotel(hotel)} onFavorite={() => toggleFavorite(hotel)} />)}</motion.div>}</>}
    <AnimatePresence>{selectedHotel && <HotelModal hotel={selectedHotel} isFavorite={favoriteIds.has(selectedHotel.id)} onClose={() => setSelectedHotel(null)} onFavorite={() => toggleFavorite(selectedHotel)} onAdd={() => onAddToTrip?.(selectedHotel)} />}</AnimatePresence>
  </section>;
}

function Filter({ label, value, onChange, options }) { return <label>{label}<select value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([optionValue, title]) => <option value={optionValue} key={optionValue}>{title}</option>)}</select></label>; }
function HotelCard({ hotel, city, index, favorite, onOpen, onFavorite }) { const fallback = `/api/place-photos/fallback?city=${encodeURIComponent(city)}&slot=${index}`; const [image, setImage] = useState(imageUrl(hotel.photoName)); return <motion.article layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * .04, .25) }} className="hotel-card" onClick={onOpen}><div className="hotel-image"><img src={image} alt={hotel.name} loading="lazy" decoding="async" onError={() => setImage(fallback)} /><button onClick={(event) => { event.stopPropagation(); onFavorite(); }} aria-label="Save favorite">{favorite ? "♥" : "♡"}</button><span>{hotel.category}</span></div><div className="hotel-card-body"><div className="hotel-card-title"><h3>{hotel.name}</h3><b>★ {hotel.rating ? hotel.rating.toFixed(1) : "—"}</b></div><p className="hotel-reviews">{hotel.reviewCount ? `${hotel.reviewCount.toLocaleString()} reviews` : "New listing"} · {priceLabels[hotel.priceLevel]}</p><p className="hotel-address">{hotel.address}</p><div className="hotel-meta"><span>{hotel.distanceKm != null ? `${hotel.distanceKm} km from centre` : "Distance unavailable"}</span><span className={hotel.openNow === false ? "closed" : "open"}>{hotel.openNow === false ? "Closed" : "Open Now"}</span></div></div></motion.article>; }
function HotelSkeleton() { return <div className="hotel-grid">{Array.from({ length: 6 }, (_, index) => <div className="hotel-skeleton" key={index}><i /><b /><b /><small /></div>)}</div>; }

function HotelModal({ hotel, isFavorite, onClose, onFavorite, onAdd }) {
  const [state, setState] = useState({ loading: true, details: null, error: "" });
  useEffect(() => { const controller = new AbortController(); (async () => { try { const response = await fetch(apiUrl(`/api/hotels/${encodeURIComponent(hotel.id)}`), { signal: controller.signal }); const payload = await response.json().catch(() => null); if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || "Unable to load hotel details."); setState({ loading: false, details: payload.details, error: "" }); } catch (error) { if (error.name !== "AbortError") setState({ loading: false, details: null, error: error.message }); } })(); return () => controller.abort(); }, [hotel.id]);
  const details = state.details;
  return <motion.div className="hotel-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}><motion.article className="hotel-modal" initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 25 }} onMouseDown={(event) => event.stopPropagation()}><button className="hotel-close" onClick={onClose} aria-label="Close hotel details">×</button><img src={imageUrl(hotel.photoName)} alt={hotel.name} /><div className="hotel-modal-body"><p className="hotel-eyebrow">{hotel.category} · {priceLabels[hotel.priceLevel]}</p><h2>{hotel.name}</h2><p className="hotel-modal-rating">★ {hotel.rating ? hotel.rating.toFixed(1) : "—"} · {hotel.reviewCount.toLocaleString()} reviews</p><p>{hotel.address}</p>{state.loading && <p>Loading hotel details…</p>}{state.error && <p className="hotel-detail-error">{state.error}</p>}{details && <><p className="hotel-description">{details.description}</p><div className="hotel-detail-grid"><Detail title="Amenities" values={details.amenities.length ? details.amenities : ["Contact hotel for amenity details"]} /><Detail title="Opening hours" values={details.openingHours.length ? details.openingHours : ["Hours unavailable"]} /></div>{details.reviews?.length > 0 && <div className="hotel-reviews-list"><h4>Guest reviews</h4>{details.reviews.slice(0, 2).map((review, index) => <p key={index}><b>{review.authorAttribution?.displayName || "Guest"}</b> · ★ {review.rating || "—"}<br />{review.text?.text || ""}</p>)}</div>}</>}<div className="hotel-actions">{hotel.mapsUrl && <a href={hotel.mapsUrl} target="_blank" rel="noreferrer">View on Google Maps</a>}{hotel.website && <a href={hotel.website} target="_blank" rel="noreferrer" className="outline">Visit Website</a>}<button onClick={onAdd}>Add to Trip</button><button className="outline" onClick={onFavorite}>{isFavorite ? "Saved ♥" : "Save Favorite"}</button></div>{hotel.phone && <p className="hotel-phone">Phone: {hotel.phone}</p>}</div></motion.article></motion.div>;
}
function Detail({ title, values }) { return <div><h4>{title}</h4>{values.map((value) => <p key={value}>{value}</p>)}</div>; }
