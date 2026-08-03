import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { apiUrl } from "../config";
import "./RestaurantRecommendations.css";
import { useAuth } from "../context/AuthContext";
import { recordSearch, saveProviderItem } from "../services/travelDataService";

const categories = ["All", "Indian", "Chinese", "Italian", "Mexican", "Japanese", "Korean", "Thai", "French", "Mediterranean", "Fast Food", "Cafe", "Bakery", "Vegetarian", "Vegan"];
const sortingOptions = ["Highest Rated", "Nearest", "Lowest Price", "Highest Price", "Most Popular"];
const priceLabels = { PRICE_LEVEL_FREE: "Free", PRICE_LEVEL_INEXPENSIVE: "$", PRICE_LEVEL_MODERATE: "$$", PRICE_LEVEL_EXPENSIVE: "$$$", PRICE_LEVEL_VERY_EXPENSIVE: "$$$$", PRICE_LEVEL_UNSPECIFIED: "Price unavailable" };
const priceRank = (price) => ["PRICE_LEVEL_FREE", "PRICE_LEVEL_INEXPENSIVE", "PRICE_LEVEL_MODERATE", "PRICE_LEVEL_EXPENSIVE", "PRICE_LEVEL_VERY_EXPENSIVE"].indexOf(price);
const foodImages = {
  Indian: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=900&q=85",
  Italian: "https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=900&q=85",
  Japanese: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=900&q=85",
  Chinese: "https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=900&q=85",
  Cafe: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=900&q=85",
  Bakery: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=85",
  default: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=85",
};
const dishIdeas = { Indian: ["Butter chicken", "Biryani", "Paneer tikka"], Italian: ["Wood-fired pizza", "Fresh pasta", "Tiramisu"], Japanese: ["Sushi", "Ramen", "Tempura"], Chinese: ["Dim sum", "Noodles", "Dumplings"], Mexican: ["Tacos", "Enchiladas", "Churros"], Thai: ["Pad Thai", "Green curry", "Mango rice"], Cafe: ["Specialty coffee", "Brunch", "Pastries"], Bakery: ["Croissants", "Sourdough", "Cakes"] };
const directionsUrl = (restaurant) => {
  const destination = Number.isFinite(restaurant.coordinates?.latitude) && Number.isFinite(restaurant.coordinates?.longitude)
    ? `${restaurant.coordinates.latitude},${restaurant.coordinates.longitude}`
    : `${restaurant.name} ${restaurant.address}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
};
const restaurantImage = (restaurant) => restaurant.photoUrl || restaurant.image || foodImages[restaurant.category] || foodImages.default;
const restaurantDishes = (restaurant) => restaurant.popularDishes?.slice(0, 3) || dishIdeas[restaurant.category] || ["Chef specials", "Local favourites", "Seasonal plates"];
const travelTime = (distance) => Number.isFinite(distance) ? `${Math.max(4, Math.round(distance * 4 + 3))} min drive` : "Travel time varies";
const markerIcon = (active) => L.divIcon({ className: "restaurant-map-marker", html: `<span class="${active ? "active" : ""}">🍴</span>`, iconSize: [42, 42], iconAnchor: [21, 38], popupAnchor: [0, -35] });

function MapViewport({ restaurant, center }) {
  const map = useMap();
  useEffect(() => { if (restaurant?.coordinates) map.flyTo([restaurant.coordinates.latitude, restaurant.coordinates.longitude], 15, { duration: .7 }); else if (center) map.setView(center, 13); }, [restaurant, center, map]);
  return null;
}

export default function RestaurantRecommendations({ destination }) {
  const { user } = useAuth();
  const city = destination.trim();
  const [state, setState] = useState({ status: "idle", restaurants: [], error: "" });
  const [filters, setFilters] = useState({ category: "All", rating: "0", price: "Any", distance: "Any" });
  const [sort, setSort] = useState("Highest Rated");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [favorites, setFavorites] = useState(() => new Set());
  const [retryKey, setRetryKey] = useState(0);
  const cardRefs = useRef({});

  useEffect(() => {
    if (city.length < 2) { setState({ status: "idle", restaurants: [], error: "" }); return undefined; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setState((current) => ({ ...current, status: "loading", error: "" }));
      try {
        const response = await fetch(apiUrl(`/api/restaurants?city=${encodeURIComponent(city)}`), { signal: controller.signal });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success || !Array.isArray(payload.restaurants)) throw new Error(payload?.error?.message || "Unable to load restaurant recommendations.");
        setState({ status: "ready", restaurants: payload.restaurants, error: "" });
        if (user) void recordSearch(city, "restaurant", { results: payload.restaurants.length }).catch(() => {});
      } catch (error) { if (error.name !== "AbortError") setState({ status: "error", restaurants: [], error: error.message || "Unable to reach restaurant recommendations." }); }
    }, 450);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [city, retryKey, user]);

  const restaurants = useMemo(() => state.restaurants.filter((restaurant) => {
    const searchable = `${restaurant.name} ${restaurant.address} ${(restaurant.categories || []).join(" ")}`.toLowerCase();
    const rank = priceRank(restaurant.priceLevel);
    return (filters.category === "All" || restaurant.categories?.includes(filters.category))
      && (!search.trim() || searchable.includes(search.trim().toLowerCase()))
      && restaurant.rating >= Number(filters.rating)
      && (filters.price === "Any" || rank === Number(filters.price))
      && (filters.distance === "Any" || restaurant.distanceKm == null || restaurant.distanceKm <= Number(filters.distance));
  }).sort((a, b) => {
    if (sort === "Nearest") return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
    if (sort === "Lowest Price") return priceRank(a.priceLevel) - priceRank(b.priceLevel) || b.rating - a.rating;
    if (sort === "Highest Price") return priceRank(b.priceLevel) - priceRank(a.priceLevel) || b.rating - a.rating;
    if (sort === "Most Popular") return b.reviewCount - a.reviewCount;
    return b.rating - a.rating || b.reviewCount - a.reviewCount;
  }), [state.restaurants, filters, search, sort]);

  const mappedRestaurants = restaurants.filter((item) => Number.isFinite(item.coordinates?.latitude) && Number.isFinite(item.coordinates?.longitude));
  const center = mappedRestaurants.length ? [mappedRestaurants[0].coordinates.latitude, mappedRestaurants[0].coordinates.longitude] : null;
  const selected = restaurants.find((item) => item.id === selectedId) || null;
  const clearFilters = () => { setSearch(""); setFilters({ category: "All", rating: "0", price: "Any", distance: "Any" }); setSort("Highest Rated"); };
  const selectRestaurant = (restaurant, scroll = false) => { setSelectedId(restaurant.id); if (scroll) cardRefs.current[restaurant.id]?.scrollIntoView({ behavior: "smooth", block: "center" }); };
  const toggleFavorite = async (event, restaurant) => {
    event.stopPropagation();
    if (!user) { window.location.assign("/login"); return; }
    setFavorites((current) => { const next = new Set(current); next.has(restaurant.id) ? next.delete(restaurant.id) : next.add(restaurant.id); return next; });
    try { await saveProviderItem("restaurants", restaurant); } catch { setFavorites((current) => { const next = new Set(current); next.delete(restaurant.id); return next; }); }
  };

  if (!city) return null;
  return <section className="restaurant-recommendations" aria-label="Restaurant recommendations">
    <header className="restaurant-heading"><div><p>ROAMLY DINING GUIDE</p><h2>Taste the <em>best of {city}</em></h2><span>Handpicked local favourites, memorable tables, and flavours worth travelling for.</span></div><div className="restaurant-result-count"><strong>{restaurants.length}</strong><span>places to discover</span></div></header>
    {state.status === "loading" && <Skeleton />}
    {state.status === "error" && <Feedback error={state.error} onRetry={() => setRetryKey((value) => value + 1)} />}
    {state.status === "ready" && <>
      <div className="restaurant-tools">
        <label className="restaurant-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search restaurants, cuisines, or neighbourhoods" aria-label="Search restaurants by name" /></label>
        <div className="restaurant-selects"><FilterSelect label="Rating" value={filters.rating} onChange={(rating) => setFilters((current) => ({ ...current, rating }))} options={[["0", "Any rating"], ["4", "4.0+ stars"], ["4.5", "4.5+ stars"]]} /><FilterSelect label="Price" value={filters.price} onChange={(price) => setFilters((current) => ({ ...current, price }))} options={[["Any", "Any price"], ["1", "$"], ["2", "$$"], ["3", "$$$"], ["4", "$$$$"]]} /><FilterSelect label="Distance" value={filters.distance} onChange={(distance) => setFilters((current) => ({ ...current, distance }))} options={[["Any", "Any distance"], ["2", "Within 2 km"], ["5", "Within 5 km"], ["10", "Within 10 km"]]} /><FilterSelect label="Sort" value={sort} onChange={setSort} options={sortingOptions.map((item) => [item, item])} /><button className="restaurant-clear" type="button" onClick={clearFilters}>Clear filters</button></div>
        <div className="category-chips" aria-label="Cuisine filters">{categories.map((item) => <button type="button" key={item} className={filters.category === item ? "active" : ""} onClick={() => setFilters((current) => ({ ...current, category: item }))}>{item}</button>)}</div>
      </div>
      {mappedRestaurants.length > 0 && <div className="restaurant-map"><MapContainer center={center} zoom={13} scrollWheelZoom={false} className="restaurant-leaflet"><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><MapViewport restaurant={selected} center={center} />{mappedRestaurants.map((restaurant) => <Marker key={restaurant.id} position={[restaurant.coordinates.latitude, restaurant.coordinates.longitude]} icon={markerIcon(selectedId === restaurant.id)} eventHandlers={{ click: () => selectRestaurant(restaurant, true) }}><Popup><div className="restaurant-popup"><img src={restaurantImage(restaurant)} alt="" /><div><strong>{restaurant.name}</strong><span>★ {restaurant.rating?.toFixed(1) || "New"} · {priceLabels[restaurant.priceLevel]}</span></div></div></Popup></Marker>)}</MapContainer><div className="restaurant-map-label"><span>●</span> Explore restaurants on the map</div></div>}
      {restaurants.length ? <motion.div layout className="restaurant-grid">{restaurants.map((restaurant, index) => <RestaurantCard key={restaurant.id} restaurant={restaurant} index={index} selected={selectedId === restaurant.id} favorite={favorites.has(restaurant.id)} cardRef={(node) => { cardRefs.current[restaurant.id] = node; }} onSelect={() => selectRestaurant(restaurant)} onFavorite={(event) => toggleFavorite(event, restaurant)} />)}</motion.div> : <Feedback />}
    </>}
  </section>;
}

function FilterSelect({ label, value, onChange, options }) { return <label><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([key, text]) => <option value={key} key={key}>{text}</option>)}</select></label>; }

function RestaurantCard({ restaurant, index, selected, favorite, cardRef, onSelect, onFavorite }) {
  const cuisines = restaurant.categories?.length ? restaurant.categories.slice(0, 2) : [restaurant.category || "Restaurant"];
  return <motion.article ref={cardRef} layout className={`restaurant-card ${selected ? "selected" : ""}`} initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .42, delay: Math.min(index * .055, .35) }} onClick={onSelect} tabIndex="0" onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && onSelect()}>
    <div className="restaurant-photo"><img src={restaurantImage(restaurant)} alt={`${restaurant.name} dining`} loading="lazy" /><div className="restaurant-photo-shade" /><span className={`restaurant-open ${restaurant.openNow === false ? "closed" : ""}`}>{restaurant.openNow === true ? "Open now" : restaurant.openNow === false ? "Closed" : "Hours vary"}</span><button type="button" className={`restaurant-heart ${favorite ? "active" : ""}`} onClick={onFavorite} aria-label={favorite ? "Remove from favorites" : "Save restaurant"}>{favorite ? "♥" : "♡"}</button></div>
    <div className="restaurant-body"><div className="restaurant-title"><h3>{restaurant.name}</h3><b><span>★</span> {restaurant.rating ? restaurant.rating.toFixed(1) : "New"}</b></div><div className="restaurant-meta"><span>{priceLabels[restaurant.priceLevel]}</span><i />{cuisines.map((cuisine) => <span className="restaurant-category" key={cuisine}>{cuisine}</span>)}</div><p className="restaurant-description">{restaurant.description || `A well-loved ${cuisines[0].toLowerCase()} spot for flavourful plates and a memorable meal in ${restaurant.address?.split(",").slice(-2).join(",") || "the city"}.`}</p><p className="place-address"><span>⌖</span>{restaurant.address}</p><div className="restaurant-journey"><span><b>{restaurant.distanceKm == null ? "Nearby" : `${restaurant.distanceKm.toFixed(1)} km`}</b> from destination</span><span><b>{travelTime(restaurant.distanceKm)}</b> estimated</span></div><div className="restaurant-dishes"><small>POPULAR PICKS</small><div>{restaurantDishes(restaurant).map((dish) => <span key={dish}>{dish}</span>)}</div></div><div className="restaurant-actions" onClick={(event) => event.stopPropagation()}>{restaurant.mapsUrl && <a href={restaurant.mapsUrl} target="_blank" rel="noreferrer">View on Map</a>}{restaurant.website && <a className="outline" href={restaurant.website} target="_blank" rel="noreferrer">Website / Menu</a>}<a className="directions" href={directionsUrl(restaurant)} target="_blank" rel="noreferrer">Directions <span>↗</span></a></div></div>
  </motion.article>;
}

function Skeleton() { return <div className="restaurant-grid">{Array.from({ length: 6 }, (_, index) => <div className="restaurant-skeleton" key={index}><i /><b /><b /><small /></div>)}</div>; }
function Feedback({ error, onRetry }) { return <motion.div className={`restaurant-feedback ${error ? "error" : ""}`} initial={{ opacity: 0, scale: .98 }} animate={{ opacity: 1, scale: 1 }}><div className="restaurant-empty-art" aria-hidden="true"><span>⌕</span><i>🍽</i><b>✦</b></div><strong>{error ? "Restaurant recommendations are unavailable" : "No restaurants found."}</strong><p>{error || "Try changing your filters."}</p>{onRetry && <button type="button" onClick={onRetry}>Try again</button>}</motion.div>; }
