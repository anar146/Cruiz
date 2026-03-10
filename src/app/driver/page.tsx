"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ShieldCheck, Loader2, Navigation, X } from "lucide-react";

export default function DriverPage() {
  const [rides, setRides] = useState<any[]>([]);
  const [activeRide, setActiveRide] = useState<any>(null); 
  const [inputOtp, setInputOtp] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const refreshFeed = useCallback(async () => {
    const { data } = await supabase.from("rides").select("*").eq("status", "searching").order('created_at', { ascending: false });
    if (data) setRides(data);
  }, []);

  useEffect(() => {
    refreshFeed();
    const channel = supabase.channel('driver-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rides' }, (payload) => {
        if (payload.new.status === 'searching') setRides((prev) => [payload.new, ...prev]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rides' }, (payload) => {
        if (payload.new.status !== 'searching') setRides((prev) => prev.filter(r => r.id !== payload.new.id));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refreshFeed]);

  const acceptRide = async (ride: any) => {
    const { data, error } = await supabase.from("rides").update({ status: "accepted" }).eq("id", ride.id).select().single();
    if (!error && data) {
      setActiveRide(data);
      setRides(prev => prev.filter(r => r.id !== ride.id));
    }
  };

  const verifyOtpAndEndTrip = async () => {
    // 🛡️ ARCHITECTURAL FIX: Force both to strings and trim to prevent type-mismatch errors
    const entered = String(inputOtp).trim();
    const expected = String(activeRide.otp).trim();

    if (entered === expected && entered !== "") {
        setIsProcessing(true);
        const { error } = await supabase.from("rides").update({ status: "completed" }).eq("id", activeRide.id);
        if (!error) {
            setActiveRide(null); 
            setInputOtp("");
        }
        setIsProcessing(false);
    } else {
        alert(`❌ Incorrect OTP! Entered: ${entered}, Expected: ${expected}`);
    }
  };

  return (
    <div className="p-6 bg-slate-950 min-h-screen text-white font-sans overflow-hidden">
      <div className="max-w-md mx-auto">
        <header className="mb-10 flex items-center justify-between">
            <h1 className="text-2xl font-black italic border-l-4 border-blue-500 pl-4 uppercase tracking-tighter">Captain OS</h1>
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        </header>
        
        {activeRide ? (
          <div className="bg-blue-600 p-8 rounded-[3.5rem] shadow-3xl animate-in zoom-in duration-500">
            <div className="flex justify-between items-start mb-8">
                <div>
                    <p className="text-[10px] font-black opacity-60 uppercase tracking-widest">Active Ride</p>
                    <h2 className="text-4xl font-black italic uppercase tracking-tighter">{activeRide.rider_name}</h2>
                </div>
                <Navigation size={28} />
            </div>

            <div className="space-y-6">
              <input type="text" placeholder="0000" maxLength={4} value={inputOtp} onChange={(e) => setInputOtp(e.target.value)}
                className="w-full bg-blue-800 border-2 border-blue-400 p-8 rounded-3xl text-center text-5xl font-black outline-none text-white transition-all focus:border-white" />
              <button onClick={verifyOtpAndEndTrip} disabled={isProcessing} className="w-full bg-white text-blue-600 py-6 rounded-3xl font-black uppercase text-lg shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all">
                {isProcessing ? <Loader2 className="animate-spin" /> : <ShieldCheck size={28}/>} 
                COMPLETE TRIP
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-slate-500 font-black text-[10px] tracking-widest uppercase px-2">Live Requests</p>
            {rides.length === 0 && <div className="py-20 text-center opacity-20 font-black italic">SEARCHING...</div>}
            {rides.map((ride) => (
              <div key={ride.id} className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 flex justify-between items-center transition-all hover:border-blue-500">
                <div className="overflow-hidden mr-4">
                    <h3 className="text-xl font-black italic uppercase truncate">{ride.rider_name}</h3>
                    <p className="text-[10px] text-slate-500 uppercase truncate tracking-widest">{ride.pickup}</p>
                </div>
                <button onClick={() => acceptRide(ride)} className="bg-white text-black px-6 py-3 rounded-xl font-black uppercase text-xs flex-shrink-0">Accept</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}