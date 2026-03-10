"use client";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useState } from 'react';

// Fix for default Leaflet icons in Next.js
const icon = L.icon({ iconUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png", shadowUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png", iconSize: [25, 41], iconAnchor: [12, 41] });

function MapController({ center, route }: { center: [number, number], route: any }) {
  const map = useMap();
  
  useEffect(() => {
    const handleFlyTo = (e: any) => {
      map.flyTo([e.detail.lat, e.detail.lng], 14);
    };
    window.addEventListener("map-fly-to", handleFlyTo);
    return () => window.removeEventListener("map-fly-to", handleFlyTo);
  }, [map]);

  return null;
}

export default function Map() {
  const [route, setRoute] = useState<[number, number][]>([]);

  useEffect(() => {
    const handleDraw = (e: any) => setRoute(e.detail.coordinates);
    window.addEventListener("draw-route", handleDraw);
    return () => window.removeEventListener("draw-route", handleDraw);
  }, []);

  return (
    <MapContainer center={[26.8467, 80.9462]} zoom={12} className="h-full w-full">
      <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
      <MapController center={[26.8467, 80.9462]} route={route} />
      {route.length > 0 && <Polyline positions={route} color="#2563eb" weight={5} />}
    </MapContainer>
  );
}