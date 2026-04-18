'use client';

import * as React from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { format } from 'date-fns';

/**
 * Interactive Leaflet Map component for visual personnel tracking.
 * Manually manages Leaflet lifecycle to prevent "already initialized" errors.
 * Optimized with preferCanvas and manual marker management for high performance.
 */
export default function MapViewComponent({ 
  records = [], 
  focusedId = null,
  flyToLocation = null
}: { 
  records: any[], 
  focusedId?: string | null,
  flyToLocation?: { lat: number, lng: number } | null
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<L.Map | null>(null);
  const markersLayerRef = React.useRef<L.LayerGroup | null>(null);
  const markersMapRef = React.useRef<Map<string, L.Marker>>(new Map());
  
  // Track if we have already performed the initial auto-center to prevent "zoom looping" on data updates
  const hasInitialCentered = React.useRef(false);

  // 1. Initial Map Setup (Runs Once)
  React.useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if ((containerRef.current as any)._leaflet_id) return;

    // Initialize map with performance optimizations
    const map = L.map(containerRef.current, {
      center: [20.5937, 78.9629],
      zoom: 5,
      scrollWheelZoom: true,
      preferCanvas: true // Significant performance boost for marker rendering
    });

    // Add Tile Layer with caching optimization
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      updateWhenIdle: true,
      keepBuffer: 2
    }).addTo(map);

    // Marker Icon Fix for Webpack/Next.js using high-performance CDN
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
        markersMapRef.current.clear();
      }
    };
  }, []);

  // 2. Dynamic Marker Updates (Runs whenever records change)
  React.useEffect(() => {
    if (!mapRef.current || !markersLayerRef.current) return;

    const layer = markersLayerRef.current;
    layer.clearLayers();
    markersMapRef.current.clear();

    const validPins = records.filter(r => r.checkInLat && r.checkInLng);

    validPins.forEach(record => {
      const marker = L.marker([record.checkInLat, record.checkInLng]);
      
      // Minimalist Name Tooltip - Displayed permanent directly on pin
      marker.bindTooltip(
        `<div class="bg-primary text-primary-foreground text-[11px] font-medium px-2 py-0.5 rounded-sm shadow-sm border border-primary/20">${record.userName}</div>`, 
        {
          direction: 'top',
          offset: [0, -32],
          opacity: 0.95,
          permanent: true,
          className: 'bg-transparent border-none shadow-none p-0'
        }
      );

      // Detailed Info Popup
      const popupDiv = L.DomUtil.create('div', 'p-1 min-w-[220px] space-y-3 text-left');
      
      const headerDiv = L.DomUtil.create('div', 'flex items-center gap-2 border-b pb-2', popupDiv);
      headerDiv.innerHTML = `
        <div class="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
        <div class="flex flex-col">
          <span class="font-black text-xs uppercase tracking-tight text-foreground">${record.userName}</span>
          <span class="text-[9px] font-bold text-muted-foreground uppercase">${record.status || 'Active'} Log</span>
        </div>
      `;

      const bodyDiv = L.DomUtil.create('div', 'space-y-2', popupDiv);
      bodyDiv.innerHTML = `
        <div class="flex items-center justify-between gap-4">
          <span class="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Entry:</span>
          <span class="text-[10px] font-mono font-black text-blue-600">${record.checkInTime ? format(record.checkInTime.toDate(), 'HH:mm') : '—'}</span>
        </div>
        <div class="flex items-center justify-between gap-4">
          <span class="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Status:</span>
          <span class="text-[9px] font-black uppercase ${record.status === 'ongoing' ? 'text-blue-600' : 'text-emerald-600'}">${record.status === 'ongoing' ? 'In Session' : 'Completed'}</span>
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
      
      // Index marker for focus lookup
      markersMapRef.current.set(record.id, marker);
    });

    // ONLY center map on initial load or when first set of valid records arrives
    // This prevents "zoom looping" on data updates
    if (validPins.length > 0 && !focusedId && !flyToLocation && !hasInitialCentered.current) {
      const bounds = L.latLngBounds(validPins.map(p => [p.checkInLat, p.checkInLng]));
      mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      hasInitialCentered.current = true;
    }
  }, [records]);

  // 3. Handle External Focus Requests (Personnel)
  React.useEffect(() => {
    if (!focusedId || !mapRef.current) return;

    const marker = markersMapRef.current.get(focusedId);
    if (marker) {
      mapRef.current.setView(marker.getLatLng(), 16, { animate: true });
      marker.openPopup();
    }
  }, [focusedId]);

  // 4. Handle External Focus Requests (Locations)
  React.useEffect(() => {
    if (!flyToLocation || !mapRef.current) return;

    mapRef.current.flyTo([flyToLocation.lat, flyToLocation.lng], 14, {
      animate: true,
      duration: 1.5
    });
  }, [flyToLocation]);

  return (
    <div 
      ref={containerRef} 
      className="h-full w-full z-10 bg-muted/10 rounded-sm"
      style={{ minHeight: '500px' }}
    />
  );
}
