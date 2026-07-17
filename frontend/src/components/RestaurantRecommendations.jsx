import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { apiUrl } from "../config";
import "./RestaurantRecommendations.css";
import { useAuth } from "../context/AuthContext";
import { recordSearch, saveProviderItem } from "../services/travelDataService";

const categories = ["All", "Indian", "Chinese", "Italian", "Mexican", "Japanese", "Korean", "Thai", "French", "Mediterranean", "Fast Food", "Cafe", "Bakery", "Vegetarian", "Vegan"];
const sortingOptions = ["Highest Rated", "Nearest", "Lowest Price", "Highest Price", "Most Popular"];
const priceLabels = { PRICE_LEVEL_FREE: "Free", PRICE_LEVEL_INEXPENSIVE: "$", PRICE_LEVEL_MODERATE: "$$", PRICE_LEVEL_EXPENSIVE: "$$$", PRICE_LEVEL_VERY_EXPENSIVE: "$$$$", PRICE_LEVEL_UNSPECIFIED: "Price unavailable" };
const priceRank = (price) => ["PRICE_LEVEL_FREE", "PRICE_LEVEL_INEXPENSIVE", "PRICE_LEVEL_MODERATE", "PRICE_LEVEL_EXPENSIVE", "PRICE_LEVEL_VERY_EXPENSIVE"].indexOf(price);
const imageUrl = (photoName) => photoName?.startsWith("destination:") ? `/api/place-photos/fallback?city=${photoName.split(":")[1]}&slot=${photoName.split(":")[2]}` : `/api/restaurants/photo?name=${encodeURIComponent(photoName || "")}`;

export default function RestaurantRecommendations({ destination }) {
  const { user } = useAuth();
  const city = destination.trim();
  const [state, setState] = useState({ status: "idle", restaurants: [], error: "" });
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("Highest Rated");
  const [search, setSearch] = useState("");
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const [saveNotice, setSaveNotice] = useState("");
  const saveRestaurant = async () => { if (!user) { window.location.assign("/login"); return; } try { await saveProviderItem("restaurants", selectedRestaurant); setSaveNotice("Restaurant saved to your dashboard."); } catch (error) { setSaveNotice(error.message); } };

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
    const matchesCategory = category === "All" || restaurant.categories?.includes(category);
    const searchable = `${restaurant.name} ${restaurant.address} ${(restaurant.categories || []).join(" ")}`.toLowerCase();
    return matchesCategory && (!search.trim() || searchable.includes(search.trim().toLowerCase()));
  }).sort((a, b) => {
    if (sort === "Nearest") return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
    if (sort === "Lowest Price") return priceRank(a.priceLevel) - priceRank(b.priceLevel) || b.rating - a.rating;
    if (sort === "Highest Price") return priceRank(b.priceLevel) - priceRank(a.priceLevel) || b.rating - a.rating;
    if (sort === "Most Popular") return b.reviewCount - a.reviewCount;
    return b.rating - a.rating || b.reviewCount - a.reviewCount;
  }), [state.restaurants, category, search, sort]);

  if (!city) return null;
  return <section className="restaurant-recommendations" aria-label="Restaurant recommendations">
    <div className="restaurant-heading"><div><p>LOCAL FLAVOURS, CURATED FOR YOU</p><h2>Restaurant <em>Recommendations</em></h2><span>Great places to eat around {city}, powered by Google Places.</span></div><label>Sort by<select value={sort} onChange={(event) => setSort(event.target.value)}>{sortingOptions.map((option) => <option key={option}>{option}</option>)}</select></label></div>
    {state.status === "loading" && <Skeleton />}
    {state.status === "error" && <Feedback error={state.error} onRetry={() => setRetryKey((value) => value + 1)} />}
    {state.status === "ready" && <><div className="restaurant-tools"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search restaurants by name" aria-label="Search restaurants by name" /><div className="category-chips">{categories.map((item) => <button type="button" key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div></div>{restaurants.length ? <motion.div layout className="restaurant-grid">{restaurants.map((restaurant, index) => <RestaurantCard key={restaurant.id} restaurant={restaurant} city={city} index={index} onOpen={() => setSelectedRestaurant(restaurant)} />)}</motion.div> : <Feedback />}</>}
    {selectedRestaurant && <button type="button" className="restaurant-save-selected" onClick={saveRestaurant}>{saveNotice || "♡ Save this restaurant"}</button>}
    <AnimatePresence>{selectedRestaurant && <RestaurantModal restaurant={selectedRestaurant} onClose={() => { setSelectedRestaurant(null); setSaveNotice(""); }} />}</AnimatePresence>
  </section>;
}

function RestaurantCard({ restaurant, city, index, onOpen }) {
  const fallback = `/api/place-photos/fallback?city=${encodeURIComponent(city)}&slot=${index}`;
  const [image, setImage] = useState(imageUrl(restaurant.photoName));
  return <motion.article layout className="restaurant-card" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.035, 0.28) }} onClick={onOpen} tabIndex="0" role="button" onKeyDown={(event) => event.key === "Enter" && onOpen()}>
    <div className="restaurant-image"><img src={image} alt={restaurant.name} loading="lazy" decoding="async" onError={() => setImage(fallback)} /><span>{restaurant.category || "Restaurant"}</span></div>
    <div className="restaurant-body"><div className="restaurant-title"><h3>{restaurant.name}</h3><b>★ {restaurant.rating ? restaurant.rating.toFixed(1) : "—"}</b></div><p>{restaurant.reviewCount ? `${restaurant.reviewCount.toLocaleString()} reviews` : "Reviews unavailable"} · {priceLabels[restaurant.priceLevel]}</p><p className="place-address">{restaurant.address}</p><div className="restaurant-meta"><span>{restaurant.distanceKm != null ? `${restaurant.distanceKm} km from centre` : "Distance unavailable"}</span><strong className={restaurant.openNow === false ? "closed" : "open"}>{restaurant.openNow === false ? "Closed" : "Open now"}</strong></div><div className="restaurant-actions" onClick={(event) => event.stopPropagation()}>{restaurant.website && <a href={restaurant.website} target="_blank" rel="noreferrer">Website</a>}<a className="outline" href={restaurant.mapsUrl} target="_blank" rel="noreferrer">View directions</a></div>{restaurant.phone && <small>{restaurant.phone}</small>}</div>
  </motion.article>;
}

function RestaurantModal({ restaurant, onClose }) {
  const [state, setState] = useState({ loading: true, details: null, error: "" });
  useEffect(() => { const controller = new AbortController(); (async () => { try { const response = await fetch(apiUrl(`/api/restaurants/${encodeURIComponent(restaurant.id)}`), { signal: controller.signal }); const payload = await response.json().catch(() => null); if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || "Unable to load restaurant details."); setState({ loading: false, details: payload.details, error: "" }); } catch (error) { if (error.name !== "AbortError") setState({ loading: false, details: null, error: error.message }); } })(); return () => controller.abort(); }, [restaurant.id]);
  const details = state.details;
  return <motion.div className="restaurant-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}><motion.article className="restaurant-modal" initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 25 }} onMouseDown={(event) => event.stopPropagation()}><button className="restaurant-close" onClick={onClose} aria-label="Close restaurant details">×</button><img src={imageUrl(restaurant.photoName)} alt={restaurant.name} /><div className="restaurant-modal-body"><p className="restaurant-eyebrow">{restaurant.category || "Restaurant"} · {priceLabels[restaurant.priceLevel]}</p><h2>{restaurant.name}</h2><p className="restaurant-modal-rating">★ {restaurant.rating ? restaurant.rating.toFixed(1) : "—"} · {restaurant.reviewCount.toLocaleString()} reviews</p><p>{restaurant.address}</p>{restaurant.phone && <p>Phone: {restaurant.phone}</p>}{state.loading && <p>Loading complete details…</p>}{state.error && <p className="restaurant-detail-error">{state.error}</p>}{details && <><p className="restaurant-description">{details.description}</p><div className="restaurant-detail-grid"><Detail title="Amenities" values={details.amenities?.length ? details.amenities : ["Amenity details unavailable"]} /><Detail title="Opening hours" values={details.openingHours?.length ? details.openingHours : ["Hours unavailable"]} /></div>{details.reviews?.length > 0 && <div className="restaurant-reviews-list"><h4>Reviews summary</h4>{details.reviews.slice(0, 2).map((review, index) => <p key={index}><b>{review.authorAttribution?.displayName || "Guest"}</b> · ★ {review.rating || "—"}<br />{review.text?.text || ""}</p>)}</div>}</>}<div className="restaurant-modal-actions">{restaurant.website && <a href={restaurant.website} target="_blank" rel="noreferrer">Visit website</a>}<a href={restaurant.mapsUrl} target="_blank" rel="noreferrer" className="outline">Google Maps</a></div></div></motion.article></motion.div>;
}
function Detail({ title, values }) { return <div><h4>{title}</h4>{values.map((value) => <p key={value}>{value}</p>)}</div>; }
function Skeleton() { return <div className="restaurant-grid">{Array.from({ length: 10 }, (_, index) => <div className="restaurant-skeleton" key={index}><i /><b /><b /></div>)}</div>; }
function Feedback({ error, onRetry }) { return <div className={`restaurant-feedback ${error ? "error" : ""}`}><strong>{error ? "Restaurant recommendations are unavailable" : "No restaurants found"}</strong><p>{error || "Try a different cuisine category or search term."}</p>{onRetry && <button type="button" onClick={onRetry}>Retry</button>}</div>; }
