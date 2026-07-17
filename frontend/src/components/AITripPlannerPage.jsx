import { useEffect, useState } from "react";
import { jsPDF } from "jspdf";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import CurrencyAmountInput from "./CurrencyAmountInput";
import TravelBookingHub from "./TravelBookingHub";
import { API_ENDPOINTS } from "../config";
import { useCurrency } from "../context/CurrencyContext";
import { useTrips } from "../context/TripsContext";
import { useTheme } from "../context/ThemeContext";
import { favoriteTrip } from "../services/travelDataService";

const travelStyles = ["Cultural", "Adventure", "Relaxation", "Beach", "City Break", "Road Trip", "Wildlife Safari", "Ski"];
const examples = ["Plan a 5-day trip to Goa", "Weekend trip to Jaipur", "Solo trip to Manali"];

function buildPrompt(details, formattedBudget) {
  const dateRange = details.startDate || details.endDate ? `${details.startDate || "flexible start"} to ${details.endDate || "flexible end"}` : `${details.tripDuration || "3"}-day trip`;
  return `${details.request || "Create a personalised trip"}. Destination: ${details.destination || "not specified"}. Travel dates: ${dateRange}. Budget: ${formattedBudget || "not specified"}. Travelers: ${details.travelers}. Travel style: ${details.travelStyle}.`.slice(0, 1500);
}

function downloadPdf(itinerary) {
  const pdf = new jsPDF();
  const lines = pdf.splitTextToSize(itinerary, 176);
  let y = 18;
  lines.forEach((line) => { if (y > 280) { pdf.addPage(); y = 18; } pdf.text(line, 17, y); y += 6; });
  pdf.save("travel-itinerary.pdf");
}

export default function AITripPlannerPage({ onBack, initialTrip = {} }) {
  const { formatCurrency } = useCurrency();
  const { theme, toggleTheme } = useTheme();
  const { toggleFavorite } = useTrips();
  const [details, setDetails] = useState({ request: "", destination: "", startDate: "", endDate: "", budget: "", travelers: "1", travelStyle: "Cultural", tripDuration: "3" });
  const [itinerary, setItinerary] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [tripRecord, setTripRecord] = useState(null);
  const [tripId, setTripId] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    // Imported budget values remain INR internally, preserving existing saved-trip data.
    setDetails((current) => ({ ...current, destination: initialTrip.destinationCountry || current.destination, budget: initialTrip.budget || current.budget, travelStyle: initialTrip.travelStyle || current.travelStyle, tripDuration: initialTrip.tripDuration || current.tripDuration }));
  }, [initialTrip]);

  const change = (event) => setDetails((current) => ({ ...current, [event.target.name]: event.target.value }));
  const generate = async (event) => {
    event.preventDefault();
    if (!details.destination.trim() && !details.request.trim()) { setError("Add a destination or describe the trip you would like to take."); return; }
    setLoading(true); setError(""); setSaved(false);
    try {
      const formattedBudget = details.budget === "" ? "" : formatCurrency(details.budget, "INR", { maximumFractionDigits: 0 });
      // Send the selected locale so the AI can write the itinerary in that language.
      const response = await fetch(API_ENDPOINTS.itinerary, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: buildPrompt(details, formattedBudget), language: "en", trip: { destination: details.destination, startDate: details.startDate, endDate: details.endDate, budget: details.budget, currency: "INR" } }) });
      const data = await response.json();
      if (!response.ok || !data?.success || !data.itinerary?.trim()) throw new Error(data?.error?.message || "Unable to create your itinerary. Please try again.");
      setItinerary(data.itinerary);
      const record = { id: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`, itinerary: data.itinerary, destination: details.destination, startDate: details.startDate, endDate: details.endDate, budget: details.budget, travelers: details.travelers, travelStyle: details.travelStyle, tripDuration: details.tripDuration, createdAt: new Date().toISOString(), thumbnail: "" };
      setTripRecord(record);
      setTripId(data.tripId || "");
    } catch (requestError) { setError(requestError instanceof TypeError ? "Could not reach the itinerary service. Start the API server with npm run server, then try again." : requestError.message); }
    finally { setLoading(false); }
  };
  const save = async () => { if (!tripRecord) return; const next = !saved; try { if (tripId) await favoriteTrip(tripId, next); toggleFavorite(tripRecord); setSaved(next); setNotice(next ? "Trip saved as a favorite." : "Trip removed from favorites."); } catch (saveError) { setNotice(saveError.message); } };
  const share = async () => {
    const url = window.location.href; const text = `My Roamly trip to ${details.destination || "an amazing destination"}`;
    try { if (navigator.share) await navigator.share({ title: "My Roamly trip", text, url }); else { await navigator.clipboard.writeText(url); } setNotice(navigator.share ? "Trip shared successfully." : "Share link copied to clipboard."); }
    catch (shareError) { if (shareError.name !== "AbortError") setNotice("Unable to share right now. Please try again."); }
  };
  const shareUrl = (service) => {
    const url = encodeURIComponent(window.location.href); const text = encodeURIComponent(`My Roamly trip to ${details.destination || "an amazing destination"}`);
    const links = { WhatsApp: `https://wa.me/?text=${text}%20${url}`, Telegram: `https://t.me/share/url?url=${url}&text=${text}`, Gmail: `mailto:?subject=${text}&body=${text}%20${url}`, Facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`, X: `https://twitter.com/intent/tweet?text=${text}&url=${url}` };
    window.open(links[service], "_blank", "noopener,noreferrer"); setNotice(`Opening ${service} sharing.`);
  };

  return <main className="min-h-screen bg-[#f5f2eb] text-[#15201d]">
    <header className="flex items-center justify-between gap-3 border-b border-[#d9e3d4] bg-[#153a34] px-5 py-5 text-white sm:px-10 lg:px-20"><button onClick={onBack} className="back-to-roamly text-sm font-semibold" aria-label="Back to Roamly">Back to Roamly</button><span className="text-lg font-bold">Roamly AI</span><div className="flex items-center gap-2"><button onClick={toggleTheme} className="planner-theme-toggle" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>{theme === "dark" ? "☀" : "☾"}</button></div></header>
    <section className="mx-auto max-w-6xl px-5 py-12 sm:px-10 lg:py-16">
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-3xl text-center"><p className="text-xs font-bold tracking-[.2em] text-[#5b7f60]">GEMINI-POWERED TRIP PLANNER</p><h1 className="mt-4 font-['Playfair_Display'] text-4xl font-semibold tracking-tight sm:text-6xl">Your next trip, <span className="italic text-[#5d825f]">thoughtfully planned.</span></h1></motion.div>
      <form onSubmit={generate} className="mx-auto mt-9 max-w-4xl rounded-3xl border border-[#cfe0cb] bg-white p-5 shadow-xl shadow-[#173b35]/10 sm:p-7"><label className="text-sm font-bold text-[#153a34]" htmlFor="request">What kind of trip are you imagining?</label><textarea id="request" name="request" value={details.request} onChange={change} maxLength={1500} rows={3} placeholder={`e.g. Plan a 5-day trip to Goa under ${formatCurrency(20000, "INR", { maximumFractionDigits: 0 })}`} className="mt-2 w-full resize-none rounded-2xl border-0 bg-[#f7faf4] p-4 text-sm leading-6 outline-none ring-[#84a882] focus:ring-2" /><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Field label="Destination" name="destination" value={details.destination} onChange={change} placeholder="Goa, India" required /><BudgetField value={details.budget} onChange={(budget) => setDetails((current) => ({ ...current, budget }))} placeholder={formatCurrency(20000, "INR", { maximumFractionDigits: 0 })} /><Field label="Travelers" name="travelers" value={details.travelers} onChange={change} type="number" min="1" /><Field label="Start date" name="startDate" value={details.startDate} onChange={change} type="date" /><Field label="End date" name="endDate" value={details.endDate} onChange={change} type="date" min={details.startDate || undefined} /><label className="flex flex-col gap-1.5 text-sm font-bold text-[#153a34]">Travel style<select name="travelStyle" value={details.travelStyle} onChange={change} className="rounded-xl border border-[#cfe0cb] bg-white px-3 py-2.5 text-sm font-normal text-[#15201d] outline-none focus:ring-2 focus:ring-[#84a882]">{travelStyles.map((style) => <option key={style}>{style}</option>)}</select></label></div><div className="mt-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><span className="text-xs text-[#718078]">{details.request.length}/1500</span><button type="submit" disabled={loading} className="rounded-full bg-[#153a34] px-5 py-3 text-sm font-bold text-[#d6fb72] transition hover:bg-[#244c44] disabled:cursor-wait disabled:opacity-70">{loading ? "Gemini is planning..." : "Generate AI Itinerary"}</button></div></form>
      <div className="mx-auto mt-4 flex max-w-4xl flex-wrap justify-center gap-2">{examples.map((example) => <button type="button" key={example} onClick={() => setDetails((current) => ({ ...current, request: example }))} className="rounded-full border border-[#cddcc8] bg-white px-3 py-2 text-xs text-[#4a6450]">{example}</button>)}</div>
      {error && <p role="alert" className="mx-auto mt-5 max-w-4xl rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}{notice && <p role="status" className="mx-auto mt-5 max-w-4xl rounded-xl bg-[#e7f5dc] px-4 py-3 text-sm text-[#24522d]">{notice}</p>}{loading && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto mt-10 max-w-4xl rounded-3xl bg-[#153a34] p-8 text-center text-white">Mapping routes, experiences, stays, and practical details...</motion.div>}{itinerary && !loading && <section className="mx-auto mt-11 max-w-4xl rounded-3xl bg-[#153a34] p-7 text-white sm:p-10"><div className="prose prose-invert max-w-none"><ReactMarkdown>{itinerary}</ReactMarkdown></div><div className="mt-7 flex flex-wrap gap-3"><button onClick={save} className="rounded-full bg-[#d6fb72] px-4 py-2.5 text-sm font-bold text-[#153a34]">{saved ? "♥ Saved favorite" : "♡ Save favorite"}</button><button onClick={share} className="itinerary-action itinerary-action-share">Share trip</button><button onClick={() => downloadPdf(itinerary)} className="itinerary-action itinerary-action-download">Download as PDF</button></div><div className="mt-3 flex flex-wrap gap-2 text-xs">{["WhatsApp", "Telegram", "Gmail", "Facebook", "X"].map((service) => <button type="button" key={service} onClick={() => shareUrl(service)} className="rounded-full bg-white/10 px-3 py-2 text-white hover:bg-white/20">{service}</button>)}</div></section>}
      {details.destination.trim().length >= 2 && <TravelBookingHub destination={details.destination.trim()} />}
    </section>
  </main>;
}

function Field({ label, name, value, onChange, ...props }) { return <label className="flex flex-col gap-1.5 text-sm font-bold text-[#153a34]">{label}<input name={name} value={value} onChange={onChange} className="rounded-xl border border-[#cfe0cb] px-3 py-2.5 text-sm font-normal outline-none focus:ring-2 focus:ring-[#84a882]" {...props} /></label>; }
// Reuses the global amount control so planner budgets update with the selected currency.
function BudgetField({ value, onChange, placeholder }) { return <label className="flex flex-col gap-1.5 text-sm font-bold text-[#153a34]">Budget<CurrencyAmountInput id="budget" value={value} onChange={onChange} placeholder={placeholder} className="rounded-xl border border-[#cfe0cb] px-3 py-2.5 text-sm font-normal outline-none focus:ring-2 focus:ring-[#84a882]" /></label>; }
