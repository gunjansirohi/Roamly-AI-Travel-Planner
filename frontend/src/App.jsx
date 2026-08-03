import { lazy, Suspense, useEffect, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import PopularDestinations from "./components/PopularDestinations";
import DestinationExplorer from "./components/DestinationExplorer";
import WeatherCard from "./components/WeatherCard";
import CurrencySelector from "./components/CurrencySelector";
import CurrencyAmountInput from "./components/CurrencyAmountInput";
import { useTheme } from "./context/ThemeContext";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import { ForgotPasswordPage, LoginPage, ResetPasswordPage, SignupPage } from "./pages/AuthPages";
import { SettingsPage } from "./pages/ProfilePages";
import { DashboardPage, MongoTripsPage } from "./pages/TravelDashboard";
import "./App.css";

const AITripPlannerPage = lazy(() => import("./components/AITripPlannerPage"));
const FavoriteDestinationsPage = lazy(() => import("./components/FavoriteDestinationsPage"));

const travelStyles = ["cultural", "adventure", "relaxation", "beach", "cityBreak", "roadTrip", "wildlife", "ski"];
const activities = ["Outdoor", "Sightseeing", "Shopping", "Nightlife", "Museums", "Theme Parks", "Water Sports", "Yoga and Wellness"];
const interests = ["History", "Art", "Food", "Music", "Nature", "Sports", "Photography", "Architecture", "Literature"];

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" } },
};

function Home() {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [aiTripPage, setAiTripPage] = useState(window.location.hash === "#ai-planner");
  const [libraryPage, setLibraryPage] = useState(window.location.hash === "#favorites" ? "favorites" : "");
  const [values, setValues] = useState({
    destinationCountry: "",
    // INR is canonical; the input below converts it for the selected currency.
    budget: 20800,
    travelStyle: "cultural",
    interestsNew: [],
    transportationType: "Bus",
    activityType: ["Outdoor"],
    tripDuration: "3",
  });
  const { scrollYProgress } = useScroll();
  const heroScale = useTransform(scrollYProgress, [0, 0.32], [1, 1.08]);

  const update = (event) => setValues((current) => ({ ...current, [event.target.name]: event.target.value }));
  const toggleOption = (field, option) => {
    setValues((current) => {
      const selected = current[field].includes(option)
        ? current[field].filter((item) => item !== option)
        : [...current[field], option];
      return { ...current, [field]: selected };
    });
  };
  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  };
  useEffect(() => {
    const onHashChange = () => { setAiTripPage(window.location.hash === "#ai-planner"); setLibraryPage(window.location.hash === "#favorites" ? "favorites" : ""); };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  const openAiTripPlanner = () => {
    if (!user) { navigate("/login", { state: { from: { pathname: "/" } } }); return; }
    if (window.location.hash !== "#ai-planner") window.location.hash = "ai-planner";
    setAiTripPage(true);
    setMenuOpen(false);
  };
  const openLibrary = (page) => { if (!user) { navigate("/login", { state: { from: { pathname: "/favorites" } } }); return; } window.location.hash = page; setLibraryPage(page); setMenuOpen(false); };
  const submitPlanner = (event) => {
    event.preventDefault();
    openAiTripPlanner();
  };
  const closeAiTripPlanner = () => {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    setAiTripPage(false);
  };
  const closeLibrary = () => { setLibraryPage(""); setMenuOpen(false); };
  const planFavorite = (trip) => {
    setValues((current) => ({ ...current, destinationCountry: trip.destination || "", budget: trip.budget ?? current.budget, travelStyle: trip.travelStyle || current.travelStyle, tripDuration: trip.tripDuration || current.tripDuration }));
    setLibraryPage("");
    openAiTripPlanner();
  };
  const exploreDestination = (destination) => {
    setValues((current) => ({ ...current, destinationCountry: destination }));
    scrollTo("planner");
  };
  if (aiTripPage) return <Suspense fallback={null}><AITripPlannerPage onBack={closeAiTripPlanner} initialTrip={values} /></Suspense>;
  if (libraryPage) return <Suspense fallback={null}><FavoriteDestinationsPage onBack={closeLibrary} onExplore={() => setTimeout(() => scrollTo("destinations"), 0)} onPlanTrip={planFavorite} /></Suspense>;

  return (
    <main className="site-shell">
      <section id="home" className="hero">
        <motion.video style={{ scale: heroScale }} className="hero-video" autoPlay muted loop playsInline poster="https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=2200&q=80">
          <source src="https://cdn.coverr.co/videos/coverr-aerial-view-of-the-coast-1575/1080p.mp4" type="video/mp4" />
        </motion.video>
        <div className="hero-overlay" />
        <nav className="nav" aria-label="Primary navigation">
          <button className="brand" onClick={() => scrollTo("home")} aria-label="Go to home"><span>✦</span> Roamly</button>
          <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-label="Toggle menu">{menuOpen ? "×" : "☰"}</button>
          <div className={`nav-links ${menuOpen ? "open" : ""}`}>
            {[ ["Home", "home"], ["Destinations", "destinations"], ["AI Planner", "ai-planner"], ["Favorites", "favorites"], ["About", "about"], ["Contact", "contact"] ].map(([label, id]) => (
              <button key={id} onClick={() => id === "favorites" ? openLibrary(id) : id === "ai-planner" ? openAiTripPlanner() : scrollTo(id)}>{label}</button>
            ))}
          </div>
          <div className="nav-actions flex shrink-0 items-center gap-3 sm:gap-4">
            <button className="theme-toggle !static" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>{theme === "dark" ? "☀" : "☾"}</button>
            <div className="auth-nav !ml-0">{user ? <button className="avatar-button" aria-label="Open account menu">{user.profilePicture ? <img src={user.profilePicture} alt="" /> : user.fullName?.slice(0, 1).toUpperCase()}<span className="account-dropdown"><button onClick={() => navigate("/profile")}>My Profile</button><button onClick={() => navigate("/saved-trips")}>Saved Trips</button><button onClick={() => navigate("/favorites")}>Favorites</button><button onClick={() => navigate("/settings")}>Settings</button><button onClick={logout}>Logout</button></span></button> : <><button onClick={() => navigate("/login")}>Login</button><button className="signup-nav" onClick={() => navigate("/signup")}>Sign Up</button></>}</div>
          </div>
        </nav>
        <div className="floating-icon icon-plane">✈</div><div className="floating-icon icon-pin">⌖</div><div className="floating-icon icon-palm">♧</div>
        <motion.div className="hero-content" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.13 } } }}>
          <motion.p className="eyebrow" variants={fadeUp}><span /> YOUR NEXT ADVENTURE STARTS HERE</motion.p>
          <motion.h1 variants={fadeUp}>Explore the World <em>with AI</em></motion.h1>
          <motion.p className="hero-copy" variants={fadeUp}>Plan smarter, travel better with AI-powered itineraries.</motion.p>
          <motion.div className="hero-actions" variants={fadeUp}>
            <button className="button primary" onClick={() => scrollTo("planner")}>Start Planning <span>→</span></button>
            <button className="button ghost" onClick={() => scrollTo("destinations")}>Explore Destinations</button>
          </motion.div>
        </motion.div>
        <button className="scroll-cue" onClick={() => scrollTo("destinations")}>Scroll to explore <span>↓</span></button>
      </section>

      <DestinationExplorer onPlanTrip={exploreDestination} />

      <section id="destinations" className="destinations section">
        <motion.div className="section-heading" initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.25 }} variants={fadeUp}>
          <p className="eyebrow dark"><span /> CURATED FOR YOUR CURIOSITY</p><h2>Where will curiosity <em>take you?</em></h2>
        </motion.div>
        <div className="destination-grid">
          {[ ["Bali", "Indonesia", "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=900&q=85"], ["Santorini", "Greece", "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=900&q=85"], ["Kyoto", "Japan", "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=900&q=85"] ].map(([city, country, image], index) => (
            <motion.article className="destination-card" key={city} initial={{ opacity: 0, y: 36 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.6, delay: index * 0.1 }}>
              <img src={image} alt={`${city}, ${country}`} /><div className="card-shade" /><div className="card-label"><p>{country}</p><h3>{city}</h3><button onClick={() => { setValues((v) => ({ ...v, destinationCountry: `${city}, ${country}` })); scrollTo("planner"); }} aria-label={`Plan a trip to ${city}`}>↗</button></div>
            </motion.article>
          ))}
        </div>
      </section>

      <PopularDestinations onExplore={exploreDestination} />

      <section id="planner" className="planner section">
        <motion.div className="planner-intro" initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} variants={fadeUp}>
          <p className="eyebrow"><span /> YOUR PERSONAL TRAVEL CONCIERGE</p><h2>Turn your ideas into an <em>unforgettable journey.</em></h2><p>Tell us what inspires you and our AI will shape a trip that feels entirely yours.</p>
        </motion.div>
        <motion.form className="planner-card" onSubmit={submitPlanner} initial={{ opacity: 0, y: 36 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }} transition={{ duration: 0.7 }}>
          <div className="field full"><label htmlFor="destinationCountry">Where do you want to go?</label><input id="destinationCountry" name="destinationCountry" value={values.destinationCountry} onChange={update} placeholder="Paris, France" required /></div>
          {/* Fetches weather after the destination input settles; the key never reaches the browser. */}
          <WeatherCard destination={values.destinationCountry} />
          <div className="form-grid"><div className="field"><label htmlFor="tripDuration">How long is your trip?</label><input id="tripDuration" name="tripDuration" type="number" min="1" value={values.tripDuration} onChange={update} required /></div><div className="field"><label htmlFor="budget">Total Budget</label><div className="flex items-center gap-2"><CurrencyAmountInput id="budget" value={values.budget} onChange={(budget) => setValues((current) => ({ ...current, budget }))} required /><CurrencySelector compact /></div></div><div className="field"><label htmlFor="travelStyle">Travel style</label><select id="travelStyle" name="travelStyle" value={values.travelStyle} onChange={update}>{travelStyles.map((item) => <option key={item}>{item}</option>)}</select></div><div className="field"><label htmlFor="transportationType">Getting around</label><input id="transportationType" name="transportationType" value={values.transportationType} onChange={update} required /></div></div>
          <fieldset><legend>What interests you most? <small>Select any</small></legend><div className="choice-list">{interests.map((item) => <button type="button" className={values.interestsNew.includes(item) ? "selected" : ""} onClick={() => toggleOption("interestsNew", item)} key={item}>{item}</button>)}</div></fieldset>
          <fieldset><legend>Favorite activities <small>Select any</small></legend><div className="choice-list">{activities.map((item) => <button type="button" className={values.activityType.includes(item) ? "selected" : ""} onClick={() => toggleOption("activityType", item)} key={item}>{item}</button>)}</div></fieldset>
          <button className="button primary generate" type="button" onClick={openAiTripPlanner}>Create my itinerary <span>→</span></button>
        </motion.form>
      </section>

      <section id="about" className="about section"><motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} variants={fadeUp}><p className="eyebrow dark"><span /> TRAVEL, REIMAGINED</p><h2>Less planning. More <em>wandering.</em></h2><p>Roamly blends intelligent recommendations with your personal travel style, giving you more time to look forward to the journey.</p></motion.div><div className="stat-row"><div><strong>∞</strong><span>possibilities</span></div><div><strong>24/7</strong><span>your guide</span></div><div><strong>100%</strong><span>personalized</span></div></div></section>
      <footer id="contact"><a className="brand" href="#home"><span>✦</span> Roamly</a><p>Made for travelers who go farther.</p><a href="mailto:hello@roamly.travel">hello@roamly.travel</a></footer>
    </main>
  );
}

function App() {
  return <Routes>
    <Route path="/" element={<Home />} /><Route path="/destinations" element={<Home />} /><Route path="/hotels" element={<Home />} /><Route path="/restaurants" element={<Home />} /><Route path="/flights" element={<Home />} />
    <Route path="/login" element={<LoginPage />} /><Route path="/signup" element={<SignupPage />} /><Route path="/forgot-password" element={<ForgotPasswordPage />} /><Route path="/reset-password/:token" element={<ResetPasswordPage />} />
    <Route path="/profile" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} /><Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} /><Route path="/favorites" element={<ProtectedRoute><MongoTripsPage favoritesOnly /></ProtectedRoute>} /><Route path="/saved-trips" element={<ProtectedRoute><MongoTripsPage /></ProtectedRoute>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}

export default App;
