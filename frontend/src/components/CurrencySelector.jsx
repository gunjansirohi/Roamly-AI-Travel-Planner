import { useMemo, useRef, useState } from "react";
import { useCurrency } from "../context/CurrencyContext";
import "./CurrencySelector.css";

// Shared searchable selector: code, currency name, and country/region are all indexed.
export default function CurrencySelector({ compact = false }) {
  const { currency, currencies, setCurrency, notice, dismissNotice } = useCurrency();
  const [open, setOpen] = useState(false); const [query, setQuery] = useState(""); const input = useRef(null);
  const selected = currencies.find((item) => item.code === currency);
  const matches = useMemo(() => currencies.filter((item) => `${item.code} ${item.name} ${item.region}`.toLowerCase().includes(query.toLowerCase())), [currencies, query]);
  const choose = (code) => { setCurrency(code); setOpen(false); setQuery(""); };
  return <div className={`currency-selector ${compact ? "compact" : ""}`}><button type="button" className="currency-trigger" onClick={() => { setOpen(!open); setTimeout(() => input.current?.focus(), 0); }} aria-haspopup="listbox" aria-expanded={open} aria-label="Choose currency"><span>{selected?.symbol}</span>{currency}<i>⌄</i></button>{open && <div className="currency-menu"><input ref={input} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, code, or country" aria-label="Search currencies" /><div role="listbox">{matches.map((item) => <button type="button" role="option" aria-selected={item.code === currency} key={item.code} onClick={() => choose(item.code)}><b>{item.symbol}</b><span>{item.code}</span><small>{item.name}<em>{item.region}</em></small></button>)}{!matches.length && <p className="currency-empty">No currencies found.</p>}</div></div>}{notice && <div className="currency-notice" role="status">{notice}<button onClick={dismissNotice} aria-label="Dismiss exchange-rate notification">×</button></div>}</div>;
}
