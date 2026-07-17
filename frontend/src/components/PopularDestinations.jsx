import { motion } from "framer-motion";
import { useCurrency } from "../context/CurrencyContext";

const destinations = [
  { name: "Goa", rating: "4.8", budget: 18000, description: "Golden beaches, coastal cafés, and sun-soaked sunsets.", image: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=900&q=85" },
  { name: "Manali", rating: "4.7", budget: 15000, description: "Snowy peaks, pine forests, and Himalayan adventures.", image: "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=900&q=85" },
  { name: "Dubai", rating: "4.9", budget: 42000, description: "Skyline views, desert escapes, and vibrant nights.", image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=900&q=85" },
  { name: "Paris", rating: "4.8", budget: 65000, description: "Romantic boulevards, timeless art, and Parisian charm.", image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=900&q=85" },
  { name: "Bali", rating: "4.9", budget: 38000, description: "Lush rice terraces, temples, and island serenity.", image: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=900&q=85" },
  { name: "Tokyo", rating: "4.8", budget: 72000, description: "Neon-lit streets, exquisite food, and quiet shrines.", image: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=900&q=85" },
  { name: "Switzerland", rating: "4.9", budget: 85000, description: "Alpine villages, clear lakes, and scenic railways.", image: "https://images.unsplash.com/photo-1502786129293-79981df4e689?auto=format&fit=crop&w=900&q=85" },
  { name: "Jaipur", rating: "4.7", budget: 16000, description: "Royal palaces, colorful bazaars, and desert magic.", image: "https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&w=900&q=85" },
];

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
};

const card = {
  hidden: { opacity: 0, y: 26 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } },
};

export default function PopularDestinations({ onExplore }) {
  const { formatCurrency } = useCurrency();
  return (
    <section id="popular-destinations" className="bg-[#0f302b] px-5 py-20 sm:px-10 lg:px-20 lg:py-28">
      <motion.div className="mx-auto max-w-7xl" initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.15 }} variants={container}>
        <motion.div variants={card} className="mb-10 text-center sm:mb-14">
          <p className="mb-3 text-xs font-bold tracking-[0.22em] text-[#d6fb72]">✦ POPULAR DESTINATIONS</p>
          <h2 className="font-['Playfair_Display'] text-4xl font-semibold tracking-tight text-white sm:text-5xl">Find your next <span className="italic text-[#d6fb72]">escape.</span></h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/65 sm:text-base">From mountain hideaways to iconic city breaks, start with the places travelers love most.</p>
        </motion.div>
        <motion.div variants={container} className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {destinations.map((destination) => (
            <motion.article key={destination.name} variants={card} whileHover={{ y: -7, scale: 1.025 }} transition={{ type: "spring", stiffness: 280, damping: 20 }} className="group overflow-hidden rounded-3xl border border-white/20 bg-white/10 shadow-lg backdrop-blur-xl transition-shadow duration-300 hover:shadow-destination">
              <div className="relative h-56 overflow-hidden">
                <img src={destination.image} alt={destination.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#102c28]/85 via-transparent to-transparent" />
                <span className="absolute bottom-3 left-3 rounded-full border border-white/25 bg-black/25 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">{destination.rating} ⭐</span>
              </div>
              <div className="p-5 text-white">
                <div className="flex items-center justify-between gap-3"><h3 className="text-xl font-bold">{destination.name}</h3>{/* Destination budgets are canonical INR values formatted by the shared context. */}<span className="text-xs font-semibold text-[#d6fb72]">From {formatCurrency(destination.budget, "INR", { maximumFractionDigits: 0 })}</span></div>
                <p className="mt-2 min-h-[42px] text-sm leading-5 text-white/65">{destination.description}</p>
                <button type="button" onClick={() => onExplore(destination.name)} className="mt-5 w-full rounded-full border border-[#d6fb72]/70 bg-[#d6fb72] px-4 py-2.5 text-sm font-bold text-[#15201d] transition duration-300 hover:bg-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#173b35]">Explore <span aria-hidden="true" className="ml-1">→</span></button>
              </div>
            </motion.article>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}
