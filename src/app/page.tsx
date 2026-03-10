"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { UserButton, useUser } from "@clerk/nextjs";
import { 
  MapPin, CheckCircle2, ShieldCheck, Loader2, Search, 
  Car, Phone, MessageSquare 
} from "lucide-react"; // ✅ FIXED THIS LINE
import { motion, AnimatePresence } from "framer-motion";
import dynamic from 'next/dynamic';
import { supabase } from "@/lib/supabaseClient";
import { debounce } from "lodash";

const Map = dynamic(() => import('../components/Map'), { 
    ssr: false,
    loading: () => <div className="h-full w-full bg-slate-900 flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-widest italic">Cruiz Engine...</div>
});

export default function Home() {
  const { user, isLoaded } = useUser();
  const [appState, setAppState] = useState<"searching" | "selecting" | "finding" | "active" | "paying" | "completed">("searching");
  const [selectedRide, setSelectedRide] = useState<number | null>(null);
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [activeInput, setActiveInput] = useState<"pickup" | "destination" | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [coords, setCoords] = useState<{ pickup: any; drop: any }>({ pickup: null, drop: null });
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  const [confirmedOtp, setConfirmedOtp] = useState<number | null>(null); // ✅ FIXED: Store DB OTP
  const [walletBalance, setWalletBalance] = useState(540);

  // 📡 Real-time Listener: Pulls OTP from Database
  useEffect(() => {
    if (!currentRideId) return;
    const channel = supabase.channel(`ride-${currentRideId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rides', filter: `id=eq.${currentRideId}` }, (payload) => {
          if (payload.new.status === 'accepted') {
              setAppState("active");
              setConfirmedOtp(payload.new.otp); // ✅ Sync Rider OTP with DB
          }
          if (payload.new.status === 'completed') setAppState("paying");
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentRideId]);

  const fetchSuggestions = useCallback(debounce(async (q) => {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=5&countrycodes=in`);
    const data = await res.json();
    setSuggestions(data);
  }, 500), []);

  useEffect(() => {
    const query = activeInput === "pickup" ? pickup : destination;
    if (query?.length > 2) fetchSuggestions(query);
    else setSuggestions([]);
  }, [pickup, destination, activeInput]);

  const rideOptions = useMemo(() => [
    { id: 1, name: 'Cruiz X', price: distance ? Math.round(45 + distance * 12) : 120, icon: '🚗' },
    { id: 2, name: 'Cruiz Comfort', price: distance ? Math.round(65 + distance * 18) : 180, icon: '🚙' },
    { id: 3, name: 'Cruiz Luxury', price: distance ? Math.round(110 + distance * 30) : 350, icon: '✨' },
  ], [distance]);

  if (!isLoaded) return <div className="h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;

  const handleSuggestionClick = async (item: any) => {
    const lat = parseFloat(item.lat), lon = parseFloat(item.lon);
    window.dispatchEvent(new CustomEvent("map-fly-to", { detail: { lat, lng: lon } }));
    if (activeInput === "pickup") { 
      setPickup(item.display_name); setCoords(p => ({ ...p, pickup: { lat, lon } }));
    } else {
      setDestination(item.display_name); setCoords(p => ({ ...p, drop: { lat, lon } }));
      if (coords.pickup) {
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords.pickup.lon},${coords.pickup.lat};${lon},${lat}?overview=full&geometries=geojson`);
        const data = await res.json();
        if (data.routes?.[0]) {
          setDistance(data.routes[0].distance / 1000);
          const routeCoords = data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]]);
          window.dispatchEvent(new CustomEvent("draw-route", { detail: { coordinates: routeCoords } }));
        }
      }
      setAppState("selecting");
    }
    setSuggestions([]); setActiveInput(null);
  };

  const handleConfirmRide = async () => {
    setAppState("finding");
    const generatedOtp = Math.floor(1000 + Math.random() * 9000); // ✅ Generate ONCE
    const { data } = await supabase.from('rides').insert([{ 
      rider_name: user?.firstName || "Arnab",
      pickup, destination, fare: rideOptions.find(r => r.id === selectedRide)?.price || 0, 
      status: 'searching', 
      otp: generatedOtp 
    }]).select();
    if (data) {
        setCurrentRideId(data[0].id);
        setConfirmedOtp(generatedOtp); // Save locally too
    }
  };

  return (
    <div className="flex flex-col h-screen md:flex-row bg-slate-50 font-sans overflow-hidden">
      <aside className={`w-full md:w-[450px] h-[65vh] md:h-full flex flex-col z-[50] relative transition-all duration-700 shadow-2xl ${appState === 'active' || appState === 'paying' || appState === 'completed' ? 'bg-slate-950 text-white' : 'bg-white border-r'}`}>
        <div className="p-6 h-full flex flex-col overflow-y-auto">
          <header className="flex justify-between items-center mb-8">
            <div className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-xs font-black italic tracking-tighter uppercase">Cruiz Pro</div>
            <div className="flex items-center gap-4">
              <span className={`font-black text-sm ${appState === 'searching' || appState === 'selecting' ? 'text-black' : 'text-white'}`}>₹{walletBalance}</span>
              <UserButton />
            </div>
          </header>

          <AnimatePresence mode="wait">
            {(appState === "searching" || appState === "selecting") && (
              <motion.div key="search">
                <h2 className="text-3xl font-black mb-6 italic text-slate-900 leading-tight tracking-tighter uppercase">Where to, {user?.firstName}?</h2>
                <div className="space-y-4">
                  <div className="relative">
                    <input value={pickup} onFocus={() => setActiveInput("pickup")} onChange={(e) => setPickup(e.target.value)} placeholder="Pickup" className="w-full p-5 pl-12 rounded-3xl border-2 border-slate-100 bg-slate-50 font-bold text-black outline-none focus:border-blue-500 transition-all shadow-sm" />
                    <MapPin className="absolute left-4 top-5 text-blue-500" size={20} />
                    {activeInput === "pickup" && suggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 bg-white border shadow-2xl z-[100] rounded-2xl mt-2 overflow-hidden text-black text-xs font-bold">
                        {suggestions.map((s, i) => <div key={i} onClick={() => handleSuggestionClick(s)} className="p-4 hover:bg-slate-50 cursor-pointer border-b last:border-0 truncate">{s.display_name}</div>)}
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <input value={destination} onFocus={() => setActiveInput("destination")} onChange={(e) => setDestination(e.target.value)} placeholder="Destination" className="w-full p-5 pl-12 rounded-3xl border-2 border-slate-100 bg-slate-50 font-bold text-black outline-none focus:border-blue-500 transition-all shadow-sm" />
                    <Search className="absolute left-4 top-5 text-slate-400" size={20} />
                    {activeInput === "destination" && suggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 bg-white border shadow-2xl z-[100] rounded-2xl mt-2 overflow-hidden text-black text-xs font-bold">
                        {suggestions.map((s, i) => <div key={i} onClick={() => handleSuggestionClick(s)} className="p-4 hover:bg-slate-50 cursor-pointer border-b last:border-0 truncate">{s.display_name}</div>)}
                      </div>
                    )}
                  </div>
                </div>
                {appState === "selecting" && (
                  <div className="mt-8 space-y-3 pb-10">
                    {rideOptions.map((r) => (
                      <button key={r.id} onClick={() => setSelectedRide(r.id)} className={`w-full flex justify-between items-center p-4 border-2 rounded-2xl cursor-pointer transition-all ${selectedRide === r.id ? 'border-blue-600 bg-blue-50 text-blue-600 shadow-lg' : 'border-slate-100 bg-white text-slate-900'}`}>
                        <div className="flex items-center gap-4 text-3xl">{r.icon} <span className="font-black italic text-sm">{r.name}</span></div>
                        <span className="font-black">₹{r.price}</span>
                      </button>
                    ))}
                    <button onClick={handleConfirmRide} className="w-full bg-slate-950 text-white py-6 rounded-[2.5rem] font-black mt-6 tracking-widest shadow-xl uppercase italic active:scale-95 transition-all">Request Cruiz</button>
                  </div>
                )}
              </motion.div>
            )}

            {appState === "active" && (
                <motion.div key="active" className="flex flex-col items-center text-center justify-center h-full">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500 mb-6 italic">Share with Captain</p>
                    {/* ✅ FIXED OTP DISPLAY */}
                    <h2 className="text-8xl font-black italic text-white mb-12 tracking-tighter">{confirmedOtp}</h2>
                    <div className="p-6 bg-slate-900 rounded-[3rem] w-full border border-white/5 flex items-center gap-4 mb-8">
                        <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-2xl shadow-xl shadow-blue-500/20">👨🏻‍✈️</div>
                        <div className="text-left text-white">
                            <p className="font-black text-lg italic uppercase tracking-tighter">Captain Rajesh</p>
                            <p className="text-[10px] font-bold opacity-50 uppercase tracking-widest">White Swift • UP 32 AZ 1234</p>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* ... Payment and Completed UI stay the same ... */}
            {appState === "paying" && (
              <motion.div key="paying" className="flex-1 flex flex-col justify-center">
                 <h2 className="text-2xl font-black italic mb-6 text-center text-white tracking-tighter">CRUIZ PAY</h2>
                 <div className="bg-white text-black p-10 rounded-[4rem] mb-10 text-center shadow-2xl">
                    <p className="text-6xl font-black italic tracking-tighter">₹{rideOptions.find(r => r.id === selectedRide)?.price}</p>
                 </div>
                 <button onClick={() => {setWalletBalance(b => b - (rideOptions.find(r => r.id === selectedRide)?.price || 0)); setAppState("completed")}} className="w-full bg-blue-600 py-7 rounded-[2.5rem] font-black text-white shadow-xl uppercase tracking-widest italic active:scale-95 transition-all">Pay from Wallet</button>
              </motion.div>
            )}

            {appState === "completed" && (
              <motion.div key="completed" className="flex-1 flex flex-col items-center justify-center text-center">
                <CheckCircle2 size={80} className="text-emerald-500 mb-8 animate-bounce" />
                <h2 className="text-4xl font-black italic text-slate-900 uppercase tracking-tighter">Arrived!</h2>
                <button onClick={() => window.location.reload()} className="w-full bg-black text-white py-6 rounded-3xl font-black mt-12 shadow-2xl uppercase tracking-widest italic">Book Again</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </aside>

      <main className="flex-1 relative h-[35vh] md:h-full bg-slate-100 z-[10] border-t md:border-0 border-slate-200">
        <Map />
        {appState === "finding" && (
            <div className="absolute inset-0 bg-white/40 backdrop-blur-xl flex flex-col items-center justify-center z-[200]">
                <div className="bg-black p-12 rounded-full shadow-3xl animate-bounce text-white"><Car size={56}/></div>
                <h2 className="mt-8 text-3xl font-black italic uppercase tracking-widest text-black tracking-tighter text-center">Searching...</h2>
            </div>
        )}
      </main>
    </div>
  );
}