'use client';

import * as React from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { format } from 'date-fns';
import { User, Clock, Calendar, MapPin, ExternalLink } from 'lucide-react';

/**
 * Interactive Leaflet Map component for visual personnel tracking.
 * Manually manages Leaflet lifecycle to prevent "already initialized" errors.
 */
export default function MapViewComponent({ records = [] }: { records: any[] }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<L.Map | null>(null);
  const markersLayerRef = React.useRef<L.LayerGroup | null>(null);

  // 1. Initial Map Setup (Runs Once)
  React.useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Check if the container already has a map instance attached to it
    // This is the definitive fix for "Map container is already initialized"
    if ((containerRef.current as any)._leaflet_id) return;

    const validPins = records.filter(r => r.checkInLat && r.checkInLng);
    const center: [number, number] = validPins.length > 0 
      ? [validPins[0].checkInLat, validPins[0].checkInLng] 
      : [20.5937, 78.9629];

    // Initialize map
    const map = L.map(containerRef.current, {
      center: center,
      zoom: 5,
      scrollWheelZoom: true,
    });

    // Add Tile Layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Marker Icon Fix for Webpack/Next.js
    const DefaultIcon = L.Icon.Default.prototype as any;
    delete DefaultIcon._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    // Create a managed layer group for markers
    const layer = L.layerGroup().addTo(map);
    
    markersLayerRef.current = layer;
    mapRef.current = map;

    // Proper cleanup on unmount
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersLayerRef.current = null;
      }
    };
  }, []);

  // 2. Dynamic Marker Updates (Runs whenever records change)
  React.useEffect(() => {
    if (!mapRef.current || !markersLayerRef.current) return;

    const layer = markersLayerRef.current;
    layer.clearLayers();

    const validPins = records.filter(r => r.checkInLat && r.checkInLng);

    validPins.forEach(record => {
      const marker = L.marker([record.checkInLat, record.checkInLng]);
      
      // Name Tooltip
      marker.bindTooltip(`<span class="font-bold text-xs">${record.userName}</span>`, {
        direction: 'top',
        offset: [0, -20],
        opacity: 0.9
      });

      // Detailed Info Popup
      const popupDiv = L.DomUtil.create('div', 'p-1 min-w-[220px] space-y-3 text-left');
      
      const headerDiv = L.DomUtil.create('div', 'flex items-center gap-2 border-b pb-2', popupDiv);
      headerDiv.innerHTML = `
        <div class="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
        <div class="flex flex-col">
          <span class="font-black text-xs uppercase tracking-tight text-foreground">${record.userName}</span>
          <span class="text-[9px] font-bold text-muted-foreground uppercase">Active Session</span>
        </div>
      `;

      const bodyDiv = L.DomUtil.create('div', 'space-y-2', popupDiv);
      bodyDiv.innerHTML = `
        <div class="flex items-center justify-between gap-4">
          <span class="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Logged:</span>
          <span class="text-[10px] font-mono font-black text-blue-600">${record.checkInTime ? format(record.checkInTime.toDate(), 'HH:mm') : '—'}</span>
        </div>
        <div class="flex items-center justify-between gap-4">
          <span class="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Date:</span>
          <span class="text-[10px] font-mono font-black">${record.date}</span>
        </div>
        <div class="flex flex-col gap-1 text-left pt-2 border-t">
          <span class="text-[9px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            Audit Stamp:
          </span>
          <p class="text-[10px] font-mono font-bold bg-muted/50 p-1.5 rounded-sm">${record.checkInLat.toFixed(6)}, ${record.checkInLng.toFixed(6)}</p>
        </div>
      `;

      const btnContainer = L.DomUtil.create('div', 'pt-2', popupDiv);
      const btn = L.DomUtil.create('a', 'inline-flex items-center justify-center w-full h-8 px-4 text-[9px] font-black uppercase rounded-sm border border-blue-600/20 text-blue-600 bg-white hover:bg-blue-50 shadow-sm no-underline', btnContainer);
      btn.href = `https://www.google.com/maps/search/?api=1&query=${record.checkInLat},${record.checkInLng}`;
      btn.target = "_blank";
      btn.rel = "noopener noreferrer";
      btn.innerHTML = `View Precise Map`;

      marker.bindPopup(popupDiv);
      marker.addTo(layer);
    });

    // Auto-focus if single record
    if (validPins.length === 1) {
      mapRef.current.setView([validPins[0].checkInLat, validPins[0].checkInLng], 14);
    }
  }, [records]);

  return (
    <div 
      ref={containerRef} 
      className="h-full w-full z-10 bg-muted/10 rounded-sm"
      style={{ minHeight: '500px' }}
    />
  );
}