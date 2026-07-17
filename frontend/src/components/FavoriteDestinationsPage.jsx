import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useCurrency } from "../context/CurrencyContext";
import { useTrips } from "../context/TripsContext";
import "./FavoriteDestinationsPage.css";

const filters = ["All", "Beach", "Mountains", "City", "Adventure", "Cultural", "Luxury"];
const stockImages = {
  Beach: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=85",
  Mountains: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=85",
  City: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=1200&q=85",
  Adventure: "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=1200&q=85",
  Cultural: "https://images.unsplash.com/photo-1533669955142-6a73332af4db?auto=format&fit=crop&w=1200&q=85",
  Luxury: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=85",
};

const categoryFor = (trip) => {
  const value = `${trip.travelStyle || ""} ${trip.destination || ""}`.toLowerCase();
  if (/beach|relax|island|coast|goa|bali/.test(value)) return "Beach";
  if (/mountain|ski|hike|manali|alps/.test(value)) return "Mountains";
  if (/luxury|premium|resort/.test(value)) return "Luxury";
  if (/adventure|road|wildlife|safari/.test(value)) return "Adventure";
  if (/city|urban|break/.test(value)) return "City";
  return "Cultural";
};

const detailsFor = (trip) => {
  const [name, ...countryParts] = (trip.destination || "Untitled trip").split(",");
  const category = categoryFor(trip);
  const cleanItinerary = (trip.itinerary || "").replace(/[#*_`>-]/g, " ").replace(/\s+/g, " ").trim();
  return {
    name: name.trim(),
    country: countryParts.join(",").trim() || trip.country || "Destination awaiting discovery",
    category,
    description: trip.description || cleanItinerary.slice(0, 135) || "A thoughtfully saved escape, ready to become your next unforgettable journey.",
    rating: trip.rating || (4.5 + ((String(trip.id).length % 5) / 10)).toFixed(1),
    season: trip.bestSeason || (category === "Beach" ? "Nov – Mar" : category === "Mountains" ? "Mar – Jun" : "Year-round"),
    weather: trip.weatherIcon || (category === "Mountains" ? "❄️" : category === "Beach" ? "☀️" : "🌤️"),
    image: trip.thumbnail || stockImages[category],
  };
};

export default function FavoriteDestinationsPage({ onBack, onExplore, onPlanTrip }) {
  const navigate = useNavigate();
  const { favoriteTrips, removeFavorite } = useTrips();
  const { formatCurrency } = useCurrency();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => { const timer = setTimeout(() => setLoading(false), 450); return () => clearTimeout(timer); }, []);
  const matches = useMemo(() => favoriteTrips.filter((trip) => {
    const details = detailsFor(trip);
    const searchable = `${trip.destination} ${trip.travelStyle} ${details.country} ${details.description}`.toLowerCase();
    return searchable.includes(query.trim().toLowerCase()) && (filter === "All" || details.category === filter);
  }), [favoriteTrips, query, filter]);

  const goHome = (action) => {
    navigate("/");
    onBack?.();
    action?.();
  };

  return <motion.main className="favorites-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    <header className="favorites-nav">
      <button type="button" className="favorites-back ripple" onClick={() => goHome()} aria-label="Back to Roamly home"><span>←</span> Back to Roamly</button>
      <div className="favorites-brand"><i>✦</i> Roamly</div>
    </header>

    <section className="favorites-hero">
      <div className="favorites-hero-copy">
        <p className="favorites-eyebrow">YOUR PERSONAL TRAVEL COLLECTION</p>
        <h1>Favorite <em>Destinations</em></h1>
        <p>Keep every place that sparked your curiosity close, then turn inspiration into a beautifully planned escape.</p>
      </div>
      <div className="favorites-count"><strong>{favoriteTrips.length}</strong><span>saved<br />destination{favoriteTrips.length === 1 ? "" : "s"}</span></div>
      <div className="favorites-controls">
        <label className="favorites-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your saved escapes…" aria-label="Search favorite destinations" />{query && <button onClick={() => setQuery("")} aria-label="Clear search">×</button>}</label>
        <div className="favorites-filters" aria-label="Filter destinations">{filters.map((item) => <button type="button" key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div>
      </div>
    </section>

    <section className="favorites-content" aria-live="polite">
      {loading ? <div className="favorites-grid">{[1, 2, 3].map((item) => <div className="favorite-skeleton" key={item}><i /><span /><span /><span /></div>)}</div>
      : !matches.length ? <motion.div className="favorites-empty" initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }}>
          <div className="empty-illustration" aria-hidden="true"><span>♡</span><i className="empty-plane">✈</i><i className="empty-pin">⌖</i></div>
          <h2>{favoriteTrips.length ? "No escapes match your search" : "Your travel collection starts here"}</h2>
          <p>{favoriteTrips.length ? "Try another search or category to rediscover a saved destination." : "Save the places that make you pause, dream, and start checking flight dates."}</p>
          <button className="favorite-primary ripple" onClick={() => goHome(onExplore)}>Explore Destinations <span>→</span></button>
        </motion.div>
      : <motion.div className="favorites-grid" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: .08 } } }}>
        <AnimatePresence>{matches.map((trip) => {
          const info = detailsFor(trip);
          const isExpanded = expanded === trip.id;
          return <motion.article layout className="favorite-card" key={trip.id} variants={{ hidden: { opacity: 0, y: 22 }, visible: { opacity: 1, y: 0 } }} exit={{ opacity: 0, scale: .92 }} transition={{ duration: .35 }}>
            <div className="favorite-image"><img src={info.image} alt={`${info.name}${info.country ? `, ${info.country}` : ""}`} /><div className="favorite-image-shade" /><span className="favorite-category">{info.category}</span><button className="favorite-remove" onClick={() => removeFavorite(trip.id)} aria-label={`Remove ${info.name} from favorites`}>♥</button><div className="favorite-place"><p>{info.country}</p><h2>{info.name}</h2></div></div>
            <div className="favorite-card-body">
              <p className={`favorite-description ${isExpanded ? "expanded" : ""}`}>{info.description}{info.description.length >= 135 && "…"}</p>
              <div className="favorite-stats"><div><span>★</span><strong>{info.rating}</strong><small>Rating</small></div><div><span>{info.weather}</span><strong>{info.season}</strong><small>Best season</small></div><div><span>◈</span><strong>{trip.budget === "" || trip.budget == null ? "Flexible" : formatCurrency(trip.budget, "INR", { maximumFractionDigits: 0 })}</strong><small>Est. budget</small></div></div>
              <div className="favorite-saved"><span>♡ Saved {trip.createdAt ? new Date(trip.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "recently"}</span><span>{trip.travelers || 1} traveler{Number(trip.travelers) === 1 ? "" : "s"}</span></div>
              {isExpanded && <motion.div className="favorite-extra" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}><p>{trip.startDate || "Flexible dates"}{trip.endDate ? ` – ${trip.endDate}` : ""} · {trip.tripDuration || "Flexible"} days</p></motion.div>}
              <div className="favorite-actions"><button className="favorite-secondary ripple" onClick={() => setExpanded(isExpanded ? null : trip.id)}>{isExpanded ? "Hide Details" : "View Details"}</button><button className="favorite-primary ripple" onClick={() => goHome(() => onPlanTrip?.(trip))}>Plan Trip <span>→</span></button></div>
            </div>
          </motion.article>;
        })}</AnimatePresence>
      </motion.div>}
    </section>
  </motion.main>;
}
