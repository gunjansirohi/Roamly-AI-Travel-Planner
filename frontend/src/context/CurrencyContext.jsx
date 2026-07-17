import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

// Current ISO 4217 legal-tender currencies. The region field is deliberately
// searchable: a traveler can type either a country, a currency name, or a code.
const ISO_4217 = `
AFN|Afghan Afghani|Afghanistan
ALL|Albanian Lek|Albania
DZD|Algerian Dinar|Algeria
AOA|Angolan Kwanza|Angola
XCD|East Caribbean Dollar|Anguilla, Antigua and Barbuda, Dominica, Grenada, Montserrat, Saint Kitts and Nevis, Saint Lucia, Saint Vincent and the Grenadines
ARS|Argentine Peso|Argentina
AMD|Armenian Dram|Armenia
AWG|Aruban Florin|Aruba
AUD|Australian Dollar|Australia, Christmas Island, Cocos Islands, Kiribati, Nauru, Norfolk Island, Tuvalu
AZN|Azerbaijani Manat|Azerbaijan
BSD|Bahamian Dollar|Bahamas
BHD|Bahraini Dinar|Bahrain
BDT|Bangladeshi Taka|Bangladesh
BBD|Barbados Dollar|Barbados
BMD|Bermudian Dollar|Bermuda
BYN|Belarusian Ruble|Belarus
BZD|Belize Dollar|Belize
XOF|West African CFA Franc|Benin, Burkina Faso, Côte d’Ivoire, Guinea-Bissau, Mali, Niger, Senegal, Togo
BTN|Bhutanese Ngultrum|Bhutan
BOB|Bolivian Boliviano|Bolivia
BOV|Bolivian Mvdol|Bolivia
BAM|Bosnia and Herzegovina Convertible Mark|Bosnia and Herzegovina
BWP|Botswana Pula|Botswana
BRL|Brazilian Real|Brazil
BND|Brunei Dollar|Brunei
BGN|Bulgarian Lev|Bulgaria
BIF|Burundian Franc|Burundi
CVE|Cabo Verde Escudo|Cabo Verde
KHR|Cambodian Riel|Cambodia
XAF|Central African CFA Franc|Cameroon, Central African Republic, Chad, Republic of the Congo, Equatorial Guinea, Gabon
CAD|Canadian Dollar|Canada
KYD|Cayman Islands Dollar|Cayman Islands
CLP|Chilean Peso|Chile
CLF|Chilean Unidad de Fomento|Chile
CNY|Chinese Yuan|China
COP|Colombian Peso|Colombia
COU|Colombian Unidad de Valor Real|Colombia
KMF|Comorian Franc|Comoros
CDF|Congolese Franc|Democratic Republic of the Congo
NZD|New Zealand Dollar|Cook Islands, New Zealand, Niue, Pitcairn, Tokelau
CRC|Costa Rican Colon|Costa Rica
CUP|Cuban Peso|Cuba
CZK|Czech Koruna|Czechia
DKK|Danish Krone|Denmark, Faroe Islands, Greenland
DJF|Djiboutian Franc|Djibouti
DOP|Dominican Peso|Dominican Republic
EGP|Egyptian Pound|Egypt
SVC|Salvadoran Colon|El Salvador
ERN|Eritrean Nakfa|Eritrea
SZL|Eswatini Lilangeni|Eswatini
ETB|Ethiopian Birr|Ethiopia
EUR|Euro|Eurozone, Andorra, Austria, Belgium, Croatia, Cyprus, Estonia, Finland, France, Germany, Greece, Ireland, Italy, Kosovo, Latvia, Lithuania, Luxembourg, Malta, Monaco, Montenegro, Netherlands, Portugal, San Marino, Slovakia, Slovenia, Spain, Vatican City
FKP|Falkland Islands Pound|Falkland Islands
FJD|Fijian Dollar|Fiji
XPF|CFP Franc|French Polynesia, New Caledonia, Wallis and Futuna
GMD|Gambian Dalasi|Gambia
GEL|Georgian Lari|Georgia
GHS|Ghanaian Cedi|Ghana
GIP|Gibraltar Pound|Gibraltar
GTQ|Guatemalan Quetzal|Guatemala
GBP|Pound Sterling|United Kingdom, Guernsey, Isle of Man, Jersey
GNF|Guinean Franc|Guinea
GYD|Guyanese Dollar|Guyana
HTG|Haitian Gourde|Haiti
HNL|Honduran Lempira|Honduras
HKD|Hong Kong Dollar|Hong Kong
HUF|Hungarian Forint|Hungary
ISK|Icelandic Krona|Iceland
INR|Indian Rupee|India
IDR|Indonesian Rupiah|Indonesia
IRR|Iranian Rial|Iran
IQD|Iraqi Dinar|Iraq
ILS|Israeli New Shekel|Israel, Palestinian Territories
JMD|Jamaican Dollar|Jamaica
JPY|Japanese Yen|Japan
JOD|Jordanian Dinar|Jordan
KZT|Kazakhstani Tenge|Kazakhstan
KES|Kenyan Shilling|Kenya
KPW|North Korean Won|North Korea
KRW|South Korean Won|South Korea
KWD|Kuwaiti Dinar|Kuwait
KGS|Kyrgyzstani Som|Kyrgyzstan
LAK|Lao Kip|Laos
LBP|Lebanese Pound|Lebanon
LSL|Lesotho Loti|Lesotho
LRD|Liberian Dollar|Liberia
LYD|Libyan Dinar|Libya
CHF|Swiss Franc|Liechtenstein, Switzerland
MOP|Macanese Pataca|Macao
MGA|Malagasy Ariary|Madagascar
MWK|Malawian Kwacha|Malawi
MYR|Malaysian Ringgit|Malaysia
MVR|Maldivian Rufiyaa|Maldives
MRU|Mauritanian Ouguiya|Mauritania
MUR|Mauritian Rupee|Mauritius
MXN|Mexican Peso|Mexico
MXV|Mexican Unidad de Inversion|Mexico
MDL|Moldovan Leu|Moldova
MNT|Mongolian Tugrik|Mongolia
MAD|Moroccan Dirham|Morocco, Western Sahara
MZN|Mozambican Metical|Mozambique
MMK|Myanmar Kyat|Myanmar
NAD|Namibian Dollar|Namibia
NPR|Nepalese Rupee|Nepal
ANG|Netherlands Antillean Guilder|Curaçao, Sint Maarten
NIO|Nicaraguan Cordoba|Nicaragua
NGN|Nigerian Naira|Nigeria
MKD|Macedonian Denar|North Macedonia
NOK|Norwegian Krone|Norway, Bouvet Island, Svalbard and Jan Mayen
OMR|Omani Rial|Oman
PKR|Pakistani Rupee|Pakistan
PAB|Panamanian Balboa|Panama
PGK|Papua New Guinean Kina|Papua New Guinea
PYG|Paraguayan Guarani|Paraguay
PEN|Peruvian Sol|Peru
PHP|Philippine Peso|Philippines
PLN|Polish Zloty|Poland
QAR|Qatari Rial|Qatar
RON|Romanian Leu|Romania
RUB|Russian Ruble|Russia
RWF|Rwandan Franc|Rwanda
SHP|Saint Helena Pound|Saint Helena, Ascension, Tristan da Cunha
WST|Samoan Tala|Samoa
STN|Sao Tome and Principe Dobra|Sao Tome and Principe
SAR|Saudi Riyal|Saudi Arabia
RSD|Serbian Dinar|Serbia
SCR|Seychellois Rupee|Seychelles
SLL|Sierra Leonean Leone|Sierra Leone
SGD|Singapore Dollar|Singapore
SLE|Sierra Leonean Leone|Sierra Leone
XSU|SUCRE|Sistema Unitario de Compensacion Regional
SBD|Solomon Islands Dollar|Solomon Islands
SOS|Somali Shilling|Somalia
ZAR|South African Rand|South Africa
SSP|South Sudanese Pound|South Sudan
LKR|Sri Lankan Rupee|Sri Lanka
SDG|Sudanese Pound|Sudan
SRD|Surinamese Dollar|Suriname
SEK|Swedish Krona|Sweden
CHE|WIR Euro|Switzerland
CHW|WIR Franc|Switzerland
SYP|Syrian Pound|Syria
TWD|New Taiwan Dollar|Taiwan
TJS|Tajikistani Somoni|Tajikistan
TZS|Tanzanian Shilling|Tanzania
THB|Thai Baht|Thailand
TOP|Tongan Pa’anga|Tonga
TTD|Trinidad and Tobago Dollar|Trinidad and Tobago
TND|Tunisian Dinar|Tunisia
TRY|Turkish Lira|Türkiye
TMT|Turkmenistan Manat|Turkmenistan
UGX|Ugandan Shilling|Uganda
UAH|Ukrainian Hryvnia|Ukraine
AED|UAE Dirham|United Arab Emirates
USD|US Dollar|United States, American Samoa, British Indian Ocean Territory, Ecuador, Guam, Marshall Islands, Micronesia, Northern Mariana Islands, Palau, Puerto Rico, Timor-Leste, US Virgin Islands
USN|US Dollar (Next day)|United States
UYU|Uruguayan Peso|Uruguay
UYI|Uruguay Peso en Unidades Indexadas|Uruguay
UYW|Unidad Previsional|Uruguay
UZS|Uzbekistani Som|Uzbekistan
VUV|Vanuatu Vatu|Vanuatu
VES|Venezuelan Bolivar|Venezuela
VED|Venezuelan Digital Bolivar|Venezuela
VND|Vietnamese Dong|Vietnam
YER|Yemeni Rial|Yemen
ZMW|Zambian Kwacha|Zambia
ZWL|Zimbabwean Dollar|Zimbabwe
XBA|European Composite Unit|European Union
XBB|European Monetary Unit|European Union
XBC|European Unit of Account 9|European Union
XBD|European Unit of Account 17|European Union
XDR|Special Drawing Rights|International Monetary Fund
XAU|Gold|International
XAG|Silver|International
XPT|Platinum|International
XPD|Palladium|International
XUA|ADB Unit of Account|Asian Development Bank
XTS|Testing Code|International
XXX|No Currency|International
XCG|Caribbean Guilder|Curaçao, Sint Maarten
`.trim();

const currencySymbol = (code) => {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency: code, currencyDisplay: "narrowSymbol", maximumFractionDigits: 0 }).formatToParts(0).find((part) => part.type === "currency")?.value || code;
  } catch { return code; }
};

export const CURRENCIES = ISO_4217.split("\n").map((row) => {
  const [code, name, region] = row.split("|");
  return { code, name, region, symbol: currencySymbol(code) };
}).sort((a, b) => a.name.localeCompare(b.name));

const STORAGE_KEY = "roamly-currency";
const RATES_KEY = "roamly-exchange-rates-usd";
const CACHE_MS = 60 * 60 * 1000;
const DEFAULT_CURRENCY = "INR";
const fallbackRates = { USD: 1, INR: 83.5, EUR: 0.92, GBP: 0.79, JPY: 150, AED: 3.67, CAD: 1.36, AUD: 1.52, SGD: 1.34, CHF: 0.9, CNY: 7.2, KRW: 1330 };
const countryCurrencies = { AF: "AFN", AL: "ALL", DZ: "DZD", AO: "AOA", AR: "ARS", AM: "AMD", AW: "AWG", AU: "AUD", AT: "EUR", AZ: "AZN", BS: "BSD", BH: "BHD", BD: "BDT", BB: "BBD", BY: "BYN", BZ: "BZD", BJ: "XOF", BT: "BTN", BO: "BOB", BA: "BAM", BW: "BWP", BR: "BRL", BN: "BND", BG: "BGN", BI: "BIF", CV: "CVE", KH: "KHR", CM: "XAF", CA: "CAD", KY: "KYD", CL: "CLP", CN: "CNY", CO: "COP", KM: "KMF", CD: "CDF", CK: "NZD", CR: "CRC", CU: "CUP", CZ: "CZK", DK: "DKK", DJ: "DJF", DO: "DOP", EG: "EGP", SV: "USD", ER: "ERN", SZ: "SZL", ET: "ETB", FJ: "FJD", FK: "FKP", FO: "DKK", GA: "XAF", GM: "GMD", GE: "GEL", GH: "GHS", GI: "GIP", GR: "EUR", GL: "DKK", GT: "GTQ", GN: "GNF", GY: "GYD", HT: "HTG", HN: "HNL", HK: "HKD", HU: "HUF", IS: "ISK", IN: "INR", ID: "IDR", IR: "IRR", IQ: "IQD", IE: "EUR", IL: "ILS", IT: "EUR", JM: "JMD", JP: "JPY", JO: "JOD", KZ: "KZT", KE: "KES", KP: "KPW", KR: "KRW", KW: "KWD", KG: "KGS", LA: "LAK", LB: "LBP", LS: "LSL", LR: "LRD", LY: "LYD", LI: "CHF", MO: "MOP", MG: "MGA", MW: "MWK", MY: "MYR", MV: "MVR", MR: "MRU", MU: "MUR", MX: "MXN", MD: "MDL", MC: "EUR", MN: "MNT", ME: "EUR", MA: "MAD", MZ: "MZN", MM: "MMK", NA: "NAD", NP: "NPR", NL: "EUR", NZ: "NZD", NI: "NIO", NG: "NGN", MK: "MKD", NO: "NOK", OM: "OMR", PK: "PKR", PA: "PAB", PG: "PGK", PY: "PYG", PE: "PEN", PH: "PHP", PL: "PLN", PT: "EUR", PR: "USD", QA: "QAR", RO: "RON", RU: "RUB", RW: "RWF", WS: "WST", SM: "EUR", ST: "STN", SA: "SAR", SN: "XOF", RS: "RSD", SC: "SCR", SL: "SLE", SG: "SGD", SB: "SBD", SO: "SOS", ZA: "ZAR", SS: "SSP", ES: "EUR", LK: "LKR", SD: "SDG", SR: "SRD", SE: "SEK", CH: "CHF", SY: "SYP", TW: "TWD", TJ: "TJS", TZ: "TZS", TH: "THB", TL: "USD", TO: "TOP", TT: "TTD", TN: "TND", TR: "TRY", TM: "TMT", UG: "UGX", UA: "UAH", AE: "AED", GB: "GBP", US: "USD", UY: "UYU", UZ: "UZS", VU: "VUV", VE: "VES", VN: "VND", YE: "YER", ZM: "ZMW", ZW: "ZWL" };
const CurrencyContext = createContext(null);

function localCurrency() {
  try {
    const region = new Intl.Locale(navigator.language).region;
    return countryCurrencies[region] || ({ BM: "BMD", CW: "XCG", SX: "XCG" }[region]) || DEFAULT_CURRENCY;
  } catch { return DEFAULT_CURRENCY; }
}
function readCache() { try { return JSON.parse(localStorage.getItem(RATES_KEY) || "null"); } catch { return null; } }

export function CurrencyProvider({ children }) {
  const [currency, setCurrencyState] = useState(() => localStorage.getItem(STORAGE_KEY) || localCurrency());
  const [rates, setRates] = useState(fallbackRates);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const cached = readCache();
    if (cached?.rates) setRates({ ...fallbackRates, ...cached.rates });
    if (cached?.rates && Date.now() - cached.savedAt < CACHE_MS) return undefined;
    const controller = new AbortController();
    fetch("https://open.er-api.com/v6/latest/USD", { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error("Exchange rate service unavailable"); return response.json(); })
      .then((payload) => {
        if (payload?.result !== "success" || !payload?.rates) throw new Error("Invalid exchange rate response");
        const nextRates = { ...fallbackRates, ...payload.rates, USD: 1 };
        setRates(nextRates); localStorage.setItem(RATES_KEY, JSON.stringify({ rates: nextRates, savedAt: Date.now() }));
      })
      .catch((error) => { if (error.name !== "AbortError") { setCurrencyState(DEFAULT_CURRENCY); setNotice("Live exchange rates are unavailable. Prices are shown in INR using backup rates."); } });
    return () => controller.abort();
  }, []);
  const setCurrency = useCallback((code) => {
    if (!CURRENCIES.some((item) => item.code === code)) return;
    setCurrencyState(code); localStorage.setItem(STORAGE_KEY, code);
  }, []);
  const convert = useCallback((amount, from = DEFAULT_CURRENCY, to = currency) => {
    const number = Number(amount); const fromRate = rates[from]; const toRate = rates[to];
    return Number.isFinite(number) && fromRate && toRate ? (number / fromRate) * toRate : number || 0;
  }, [currency, rates]);
  const formatCurrency = useCallback((amount, from = DEFAULT_CURRENCY, options = {}) => {
    const fractionDigits = ["JPY", "KRW", "VND", "CLP", "PYG", "UGX", "XAF", "XOF", "XPF"].includes(currency) ? 0 : 2;
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: fractionDigits, ...options }).format(convert(amount, from));
  }, [convert, currency]);
  const value = useMemo(() => ({ currency, currencies: CURRENCIES, setCurrency, convert, formatCurrency, notice, dismissNotice: () => setNotice("") }), [currency, setCurrency, convert, formatCurrency, notice]);
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}
export function useCurrency() { const context = useContext(CurrencyContext); if (!context) throw new Error("useCurrency must be used inside CurrencyProvider"); return context; }
