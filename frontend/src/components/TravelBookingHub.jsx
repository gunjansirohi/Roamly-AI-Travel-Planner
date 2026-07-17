import { useState } from "react";
import { motion } from "framer-motion";
import CurrencySelector from "./CurrencySelector";
import HotelRecommendations from "./HotelRecommendations";
import RestaurantRecommendations from "./RestaurantRecommendations";
import FlightSuggestions from "./FlightSuggestions";
import "./TravelBookingHub.css";

const sections = [["hotels", "Hotels", "Find a stay"], ["restaurants", "Restaurants", "Plan meals"], ["flights", "Flights", "Compare fares"]];

// Keeps recommendation verticals independent and delays API calls until selected.
export default function TravelBookingHub({ destination }) {
  const [active, setActive] = useState("hotels");
  const share = async () => {
    try { if (navigator.share) await navigator.share({ title: "Roamly travel options", text: `Travel options for ${destination}`, url: window.location.href }); else await navigator.clipboard.writeText(window.location.href); } catch { /* Native share cancellation needs no UI error. */ }
  };
  return <section className="booking-hub" aria-label="Travel booking recommendations">
    <div className="booking-hub-topline"><div><p>ROAMLY MARKETPLACE</p><h2>Plan every part of your <em>journey.</em></h2></div><div className="booking-hub-actions"><CurrencySelector compact /><button type="button" onClick={share}>Share</button></div></div>
    <div className="booking-tabs" role="tablist" aria-label="Travel categories">{sections.map(([id, title, caption]) => <button key={id} type="button" role="tab" aria-selected={active === id} className={active === id ? "active" : ""} onClick={() => setActive(id)}><b>{title}</b><span>{caption}</span></button>)}</div>
    <motion.div key={active} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .25 }}>{active === "hotels" && <HotelRecommendations destination={destination} />}{active === "restaurants" && <RestaurantRecommendations destination={destination} />}{active === "flights" && <FlightSuggestions destination={destination} />}</motion.div>
  </section>;
}
