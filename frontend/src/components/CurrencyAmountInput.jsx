import { useEffect, useState } from "react";
import { useCurrency } from "../context/CurrencyContext";

// Stores a budget in INR while displaying/editing it in the globally selected currency.
export default function CurrencyAmountInput({ value, onChange, id, className = "", placeholder = "", ...inputProps }) {
  const { currency, convert, currencies } = useCurrency();
  const [text, setText] = useState("");
  useEffect(() => { setText(value === "" || value == null ? "" : String(Math.round(convert(value, "INR", currency) * 100) / 100)); }, [value, currency, convert]);
  const change = (event) => { const raw = event.target.value; setText(raw); const amount = Number(raw.replace(/,/g, "")); onChange(Number.isFinite(amount) ? convert(amount, currency, "INR") : ""); };
  return <div className="currency-amount"><input id={id} inputMode="decimal" value={text} onChange={change} className={className} placeholder={placeholder} {...inputProps} /><span>{currencies.find((item) => item.code === currency)?.symbol} {currency}</span></div>;
}
