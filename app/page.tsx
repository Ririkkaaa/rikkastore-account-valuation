"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Papa from "papaparse";

// --- DATABASE EMBEDDED FROM RIKKA STORE EXCEL ---
const CHARACTERS: Record<string, { tier: string, weight: number, signature: string | null }> = {
  "Chisa": { tier: "T0.5", weight: 1.5, signature: "Kumokiri" },
  "Qiuyuan": { tier: "T0", weight: 2.0, signature: "Emerald Sentence" },
  "Galbrena": { tier: "T0.5", weight: 1.5, signature: "Lux & Umbra" },
  "Iuno": { tier: "T0.5", weight: 1.5, signature: "Moongazer's Sigil" },
  "Augusta": { tier: "T0.5", weight: 1.5, signature: "Thunderflare Dominion" },
  "Phrolova": { tier: "T0.5", weight: 1.5, signature: "Lethean Elegy" },
  "Lupa": { tier: "T0", weight: 2.0, signature: "Wildfire Mark" },
  "Cartethyia": { tier: "T0.5", weight: 1.5, signature: "Defier's Thorn" },
  "Ciaccona": { tier: "T0", weight: 2.0, signature: "Woodland Aria" },
  "Zani": { tier: "T1", weight: 1.2, signature: "Blazing Justice" },
  "Cantarella": { tier: "T1.5", weight: 1.0, signature: "Whispers of Sirens" },
  "Brant": { tier: "T1.5", weight: 1.0, signature: "Unflickering Valor" },
  "Phoebe": { tier: "T1.5", weight: 1.0, signature: "Luminous Hymn" },
  "Roccia": { tier: "T3", weight: 0.5, signature: "Tragicomedy" },
  "Carlotta": { tier: "T1", weight: 1.2, signature: "The Last Dance" },
  "Camellya": { tier: "T3", weight: 0.5, signature: "Red Spring" },
  "Shorekeeper": { tier: "T0", weight: 2.0, signature: "Stellar Symphony" },
  "Xiangli Yao": { tier: "T2", weight: 0.8, signature: null },
  "Zhezhi": { tier: "T2", weight: 0.8, signature: "Rime-Draped Sprouts" },
  "Changli": { tier: "T2", weight: 0.8, signature: "Blazing Brilliance" },
  "Jinhsi": { tier: "T2", weight: 0.8, signature: "Ages of Harvest" },
  "Yinlin": { tier: "T3", weight: 0.5, signature: "Stringmaster" },
  "Verina": { tier: "T0.5", weight: 1.5, signature: null },
  "Jiyan": { tier: "T1.5", weight: 1.0, signature: "Verdant Summit" },
  "Sigrika": { tier: "T0", weight: 2.0, signature: "Solsworn Ciphers" },
  "Lynae": { tier: "T0", weight: 2.0, signature: "Spectrum Blaster" },
  "Mornye": { tier: "T0", weight: 2.0, signature: "Starfield Calibrator" },
  "Aemeath": { tier: "T0", weight: 2.0, signature: "Everbright Polestar" },
  "Luuk Hersen": { tier: "T1.5", weight: 1.0, signature: null },
  "Encore": { tier: "T2", weight: 0.8, signature: null },
  "Calcharo": { tier: "T4", weight: 0.2, signature: null }
};

const WEAPONS = Array.from(new Set(Object.values(CHARACTERS).map(c => c.signature).filter(Boolean))) as string[];
const CHAR_NAMES = Object.keys(CHARACTERS).sort();

const SYNERGY_TEAMS = [
  ["Sigrika", "Qiuyuan", "Mornye"], ["Sigrika", "Qiuyuan", "Shorekeeper"], ["Galbrena", "Qiuyuan", "Shorekeeper"],
  ["Phrolova", "Qiuyuan", "Cantarella"], ["Galbrena", "Lupa", "Shorekeeper"], ["Galbrena", "Phrolova", "Shorekeeper"],
  ["Galbrena", "Iuno", "Shorekeeper"], ["Galbrena", "Phrolova", "Cantarella"], ["Brant", "Lupa", "Changli"],
  ["Brant", "Lupa", "Shorekeeper"], ["Encore", "Lupa", "Shorekeeper"], ["Changli", "Brant", "Shorekeeper"],
  ["Jinhsi", "Changli", "Verina"], ["Luuk Hersen", "Lynae", "Mornye"], ["Luuk Hersen", "Lynae", "Shorekeeper"],
  ["Iuno", "Lynae", "Shorekeeper"], ["Xiangli Yao", "Lynae", "Shorekeeper"], ["Calcharo", "Lynae", "Shorekeeper"],
  ["Augusta", "Iuno", "Shorekeeper"], ["Jiyan", "Iuno", "Shorekeeper"], ["Iuno", "Ciaccona", "Shorekeeper"],
  ["Phoebe", "Ciaccona", "Shorekeeper"], ["Phoebe", "Ciaccona", "Verina"], ["Zani", "Ciaccona", "Shorekeeper"],
  ["Zani", "Phoebe", "Shorekeeper"], ["Aemeath", "Lynae", "Mornye"], ["Cartethyia", "Ciaccona", "Chisa"],
  ["Cartethyia", "Ciaccona", "Shorekeeper"], ["Augusta", "Phrolova", "Shorekeeper"], ["Augusta", "Yinlin", "Shorekeeper"],
  ["Augusta", "Jinhsi", "Shorekeeper"]
];

const MARGIN_BRACKETS = [
  { limit: 20, margin: 0.25 },
  { limit: 35, margin: 0.20 },
  { limit: 50, margin: 0.17 },
  { limit: Infinity, margin: 0.13 }
];

// --- PURE MATH ENGINE (Used by UI and CSV) ---
function calculateValuation(
  astritesAmount: number, 
  chars: string[], 
  weaps: string[], 
  config: { aWeight: number, cBase: number, wBase: number, tComp: number, floorPrice: number }
) {
  const currencyVal = (astritesAmount / 1000) * config.aWeight;

  const isSynergy = SYNERGY_TEAMS.some(team => 
    team.every(teamChar => chars.includes(teamChar))
  );

  const fmvWeaponsBase = weaps.length * config.wBase;

  let charBaseWeight = 0;
  let sigBonusWeight = 0;
  const availableWeaponsForBonus = [...weaps];

  chars.forEach(charName => {
    const charData = CHARACTERS[charName];
    if (!charData) return; // Skip invalid names gracefully

    charBaseWeight += charData.weight;
    const sigIndex = availableWeaponsForBonus.indexOf(charData.signature || "");
    if (sigIndex !== -1) {
      sigBonusWeight += (charData.weight * 0.5); 
      availableWeaponsForBonus.splice(sigIndex, 1); 
    }
  });

  const fmvCharBase = charBaseWeight * config.cBase;
  const fmvSigBonus = sigBonusWeight * config.cBase;
  const synergyMultiplier = isSynergy ? (config.tComp - 1.0) : 0;
  const fmvSynergyBonus = (fmvCharBase + fmvSigBonus) * synergyMultiplier;

  const total = currencyVal + fmvCharBase + fmvWeaponsBase + fmvSigBonus + fmvSynergyBonus;
  
  let activeMargin = 0.13;
  for (const bracket of MARGIN_BRACKETS) {
    if (total <= bracket.limit) {
      activeMargin = bracket.margin;
      break;
    }
  }

  const finalPrice = Math.max(total * (1 - activeMargin), config.floorPrice);

  return {
    fmvTotal: total,
    fmvCurrency: currencyVal,
    fmvCharBase,
    fmvWeaponsBase,
    fmvSigBonus,
    fmvSynergyBonus,
    hasSynergy: isSynergy,
    activeMargin,
    resellerPrice: finalPrice
  };
}

// --- CUSTOM MULTI-SELECT COMPONENT ---
function MultiSelect({ 
  options, selected, onChange, placeholder, getLabel = (opt: string) => opt
}: { 
  options: string[], selected: string[], onChange: (newSelected: string[]) => void, placeholder: string, getLabel?: (opt: string) => string
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter(item => item !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const removeOption = (e: React.MouseEvent, option: string) => {
    e.stopPropagation();
    onChange(selected.filter(item => item !== option));
  };

  return (
    <div className="relative" ref={containerRef}>
      <div 
        className="min-h-[52px] w-full bg-slate-50 dark:bg-slate-900 border-0 ring-1 ring-inset ring-slate-200 dark:ring-slate-700 rounded-xl p-2 flex flex-wrap gap-2 items-center cursor-pointer hover:ring-indigo-300 dark:hover:ring-indigo-500 transition-all"
        onClick={() => setIsOpen(!isOpen)}
      >
        {selected.length === 0 && <span className="text-slate-400 dark:text-slate-500 px-2 sm:text-sm">{placeholder}</span>}
        {selected.map(sel => (
          <span key={sel} className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-200 text-xs font-semibold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm border border-indigo-200 dark:border-indigo-800">
            {sel}
            <button onClick={(e) => removeOption(e, sel)} className="hover:bg-indigo-200 dark:hover:bg-indigo-800 text-indigo-500 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-100 rounded-full w-4 h-4 flex items-center justify-center transition-colors">×</button>
          </span>
        ))}
      </div>
      {isOpen && (
        <div className="absolute z-20 top-full left-0 w-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-60 overflow-y-auto">
          {options.map(opt => {
            const isChecked = selected.includes(opt);
            return (
              <div key={opt} onClick={() => toggleOption(opt)} className="flex items-center px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer border-b border-slate-100 dark:border-slate-700/50 last:border-0 transition-colors">
                <div className={`w-5 h-5 rounded border flex items-center justify-center mr-3 ${isChecked ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 dark:border-slate-600'}`}>
                  {isChecked && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </div>
                <span className={`text-sm ${isChecked ? 'font-medium text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>{getLabel(opt)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function RikkaPricingApp() {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [astrites, setAstrites] = useState<number | "">("");
  const [selectedChars, setSelectedChars] = useState<string[]>([]);
  const [selectedWeaps, setSelectedWeaps] = useState<string[]>([]);
  const [showAdmin, setShowAdmin] = useState<boolean>(false);

  // Admin Config
  const [aWeight, setAWeight] = useState<number>(0.3); 
  const [cBase, setCBase] = useState<number>(2.0); 
  const [wBase, setWBase] = useState<number>(4.0); 
  const [tComp, setTComp] = useState<number>(1.35); 
  const [floorPrice, setFloorPrice] = useState<number>(5.0); 

  // Single UI Valuation
  const results = useMemo(() => {
    return calculateValuation(Number(astrites) || 0, selectedChars, selectedWeaps, { aWeight, cBase, wBase, tComp, floorPrice });
  }, [astrites, selectedChars, selectedWeaps, aWeight, cBase, wBase, tComp, floorPrice]);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  // --- CSV BULK PROCESSING LOGIC ---
  const downloadTemplate = () => {
    const csvContent = "Astrites,Characters,Weapons\n45000,\"Qiuyuan, Phrolova\",\"Emerald Sentence\"\n20000,\"Chisa\",\"\"\n";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "Rikka_Bulk_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const processedData = result.data.map((row: any) => {
          const rawAstrites = Number(row.Astrites) || 0;
          
          // Split by comma and clean up whitespace
          const rawChars = row.Characters ? row.Characters.split(',').map((c: string) => c.trim()).filter(Boolean) : [];
          const rawWeaps = row.Weapons ? row.Weapons.split(',').map((w: string) => w.trim()).filter(Boolean) : [];

          // Run Math Engine
          const calc = calculateValuation(rawAstrites, rawChars, rawWeaps, { aWeight, cBase, wBase, tComp, floorPrice });

          return {
            ...row,
            "Calculated_FMV ($)": calc.fmvTotal.toFixed(2),
            "Reseller_Buy_Price ($)": calc.resellerPrice.toFixed(2),
            "Optimal_Synergy": calc.hasSynergy ? "Yes" : "No"
          };
        });

        // Convert back to CSV and trigger download
        const newCsv = Papa.unparse(processedData);
        const blob = new Blob([newCsv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `Processed_Rikka_Accounts_${new Date().getTime()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Reset file input
        event.target.value = ""; 
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-10 font-sans text-slate-800 dark:text-slate-100 transition-colors duration-300 selection:bg-indigo-200 dark:selection:bg-indigo-900">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 transition-colors">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Rikka Store</h1>
            <p className="text-slate-400 dark:text-slate-500 text-sm mt-0.5 font-medium">B2B Valuation Engine</p>
          </div>
          
          <div className="flex items-center gap-4">
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" title="Toggle Dark Mode">
              {isDarkMode ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg> : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>}
            </button>
            <button onClick={() => setShowAdmin(!showAdmin)} className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 px-4 py-2 rounded-lg transition-colors duration-200">
              {showAdmin ? "Close Panel" : "Admin Panel"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* UI Code for Left and Right columns remains identical to your previous iteration... */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 transition-colors">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                Account Inventory
              </h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">Total Astrites</label>
                  <input type="number" value={astrites} onChange={(e) => setAstrites(Number(e.target.value) || "")} className="w-full bg-slate-50 dark:bg-slate-900 border-0 ring-1 ring-inset ring-slate-200 dark:ring-slate-700 rounded-xl p-3.5 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:focus:ring-indigo-500 transition-all sm:text-sm" placeholder="Enter currency amount..." />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">Limited Characters</label>
                  <MultiSelect options={CHAR_NAMES} selected={selectedChars} onChange={setSelectedChars} placeholder="Select characters..." getLabel={(name) => `${name} (${CHARACTERS[name].tier})`} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">5-Star Weapons</label>
                  <MultiSelect options={WEAPONS} selected={selectedWeaps} onChange={setSelectedWeaps} placeholder="Select 5-star weapons..." />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 relative overflow-hidden h-full flex flex-col transition-colors">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Valuation Setup</h2>
                <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-bold px-3 py-1 rounded-full border border-indigo-200 dark:border-indigo-700/50">
                  Cut: {(results.activeMargin * 100).toFixed(0)}%
                </span>
              </div>
              <div className={`mb-6 flex items-center justify-center p-3 rounded-xl border ${results.hasSynergy ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700/50 text-slate-400 dark:text-slate-500'} transition-colors duration-300`}>
                <span className="text-sm font-bold tracking-wide uppercase">{results.hasSynergy ? "✓ Optimal Meta Team Detected" : "No Team Synergy"}</span>
              </div>
              <div className="space-y-3 flex-grow">
                <div className="flex justify-between text-sm"><span className="text-slate-500 dark:text-slate-400">Currency:</span><span className="font-mono text-slate-700 dark:text-slate-200 font-medium">${results.fmvCurrency.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500 dark:text-slate-400">Characters (Base):</span><span className="font-mono text-slate-700 dark:text-slate-200 font-medium">${results.fmvCharBase.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500 dark:text-slate-400">Weapons (Base):</span><span className="font-mono text-slate-700 dark:text-slate-200 font-medium">${results.fmvWeaponsBase.toFixed(2)}</span></div>
                {results.fmvSigBonus > 0 && <div className="flex justify-between text-sm text-indigo-600 dark:text-indigo-400 font-medium"><span>Signature Bonus:</span><span className="font-mono">+${results.fmvSigBonus.toFixed(2)}</span></div>}
                {results.fmvSynergyBonus > 0 && <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400 font-medium"><span>Synergy Boost:</span><span className="font-mono">+${results.fmvSynergyBonus.toFixed(2)}</span></div>}
                <div className="flex justify-between text-base font-bold text-slate-800 dark:text-slate-100 pt-4 border-t border-slate-100 dark:border-slate-800 mt-2 mb-8"><span>Fair Market Value:</span><span className="font-mono">${results.fmvTotal.toFixed(2)}</span></div>
              </div>
              <div className="bg-indigo-600 dark:bg-indigo-500 p-6 rounded-xl text-center shadow-lg shadow-indigo-200 dark:shadow-none mt-auto">
                <p className="text-indigo-200 dark:text-indigo-100 font-medium text-xs uppercase tracking-widest mb-2">Authorized Buy Price</p>
                <p className="text-4xl font-black text-white tracking-tight">${results.resellerPrice.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* ADMIN PANEL WITH BULK UPLOAD */}
          {showAdmin && (
            <div className="bg-slate-900 p-8 rounded-2xl shadow-xl mt-8 text-slate-300 border border-slate-700/50 lg:col-span-3">
              <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center mb-6 border-b border-slate-800 pb-4 gap-4">
                <h2 className="text-lg font-medium text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>
                  Admin & Bulk Operations
                </h2>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Global Variables */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Value / 1k Astrites</label>
                    <input type="number" step="0.05" value={aWeight} onChange={(e) => setAWeight(Number(e.target.value))} className="w-full bg-slate-800 border-0 ring-1 ring-inset ring-slate-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-indigo-500 font-mono text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Base Character Value</label>
                    <input type="number" step="0.5" value={cBase} onChange={(e) => setCBase(Number(e.target.value))} className="w-full bg-slate-800 border-0 ring-1 ring-inset ring-slate-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-indigo-500 font-mono text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Flat Weapon Value</label>
                    <input type="number" step="0.5" value={wBase} onChange={(e) => setWBase(Number(e.target.value))} className="w-full bg-slate-800 border-0 ring-1 ring-inset ring-slate-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-indigo-500 font-mono text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Floor Price ($)</label>
                    <input type="number" step="1" value={floorPrice} onChange={(e) => setFloorPrice(Number(e.target.value))} className="w-full bg-slate-800 border-0 ring-1 ring-inset ring-slate-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-indigo-500 font-mono text-sm" />
                  </div>
                </div>

                {/* Bulk Processing Zone */}
                <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 border-dashed flex flex-col justify-center">
                  <div className="text-center">
                    <svg className="mx-auto h-12 w-12 text-slate-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    <h3 className="text-sm font-semibold text-white mb-1">Bulk CSV Processing</h3>
                    <p className="text-xs text-slate-400 mb-4">Upload a file of unpriced accounts. The engine will process the math and return a calculated CSV instantly.</p>
                    
                    <div className="flex flex-col sm:flex-row justify-center gap-3">
                      <button onClick={downloadTemplate} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-lg transition-colors border border-slate-600">
                        Download Template.csv
                      </button>
                      
                      <label className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-lg shadow-indigo-900/20">
                        Upload & Process File
                        <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}