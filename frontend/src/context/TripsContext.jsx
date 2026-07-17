import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const TripsContext = createContext(null);
const FAVORITES_KEY = "roamly-favorite-trips";
const read = (key) => { try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; } };

export function TripsProvider({ children }) {
  const [favoriteTrips, setFavoriteTrips] = useState(() => read(FAVORITES_KEY));
  useEffect(() => localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoriteTrips)), [favoriteTrips]);
  const toggleFavorite = useCallback((trip) => setFavoriteTrips((items) => items.some((item) => item.id === trip.id) ? items.filter((item) => item.id !== trip.id) : [trip, ...items]), []);
  const value = useMemo(() => ({ favoriteTrips, toggleFavorite, removeFavorite: (id) => setFavoriteTrips((items) => items.filter((item) => item.id !== id)), isFavorite: (id) => favoriteTrips.some((item) => item.id === id) }), [favoriteTrips, toggleFavorite]);
  return <TripsContext.Provider value={value}>{children}</TripsContext.Provider>;
}
export function useTrips() { const value = useContext(TripsContext); if (!value) throw new Error("useTrips must be used inside TripsProvider"); return value; }
