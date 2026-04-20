'use client';

import * as React from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { format } from 'date-fns';

/**
 * Interactive Leaflet Map component for visual personnel tracking and site overview.
 * Optimized with preferCanvas and manual marker management.
 * Supports dynamic visibility toggles for layers and labels.
 */
export default function MapViewComponent({ 
  records = [], 
  focusedId = null,
  flyToLocation = null,
  sites = [],
  visibility = {
    showUsers: true,
    showUserNames: true,
    showSites: true,
    showSiteNames: true
  }
}: { 
  records: any[], 
  focusedId?: string | null,
  flyToLocation?: { lat: number, lng: number } | null,
  sites?: any[],
  visibility?: {
    showUsers: boolean;
    showUserNames: boolean;
    showSites: boolean;
    showSiteNames: boolean;
  }
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<L.Map | null>(null);
  const markersLayerRef = React.useRef<L.LayerGroup | null>(null);
  const sitesLayerRef = React.useRef<L.LayerGroup | null>(null);
  const markersMapRef = React.useRef<Map<string, L.Marker>>(new Map());
  
  const hasInitialCentered = React.useRef(false);

  // 1. Initial Map Setup (Runs Once)
  React.useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if ((containerRef.current as any)._leaflet_id) return;

    const map = L.map(containerRef.current, {
      center: [20.5937, 78.9629],
      zoom: 5,
      scrollWheelZoom: true,
      preferCanvas: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      updateWhenIdle: true,
      keepBuffer: 2
    }).addTo(map);

    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    const markersLayer = L.layerGroup().addTo(map);
    const sitesLayer = L.layerGroup().addTo(map);
    
    markersLayerRef.current = markersLayer;
    sitesLayerRef.current = sitesLayer;
    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersLayerRef.current = null;
        sitesLayerRef.current = null;
        markersMapRef.current.clear();
      }
    };
  }, []);

  // 2. Dynamic Personnel Marker Updates
  React.useEffect(() => {
    if (!mapRef.current || !markersLayerRef.current) return;

    const layer = markersLayerRef.current;
    layer.clearLayers();
    markersMapRef.current.clear();

    if (!visibility.showUsers) return;

    const validPins = records.filter(r => r.checkInLat && r.checkInLng);

    validPins.forEach(record => {
      const marker = L.marker([record.checkInLat, record.checkInLng]);
      
      if (visibility.showUserNames) {
        marker.bindTooltip(
          `<div class="bg-primary text-primary-foreground text-[10px] font-medium px-2 py-0.5 rounded-sm shadow-sm border border-primary/20">${record.userName}</div>`, 
          {
            direction: 'top',
            offset: [0, -32],
            opacity: 0.95,
            permanent: true,
            className: 'bg-transparent border-none shadow-none p-0'
          }
        );
      }

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
      `;

      const btnContainer = L.DomUtil.create('div', 'pt-2', popupDiv);
      const btn = L.DomUtil.create('a', 'inline-flex items-center justify-center w-full h-8 px-4 text-[9px] font-black uppercase rounded-sm border border-blue-600/20 text-blue-600 bg-white hover:bg-blue-50 shadow-sm no-underline', btnContainer);
      btn.href = `https://www.google.com/maps/search/?api=1&query=${record.checkInLat},${record.checkInLng}`;
      btn.target = "_blank";
      btn.rel = "noopener noreferrer";
      btn.innerHTML = `View Precise Map`;

      marker.bindPopup(popupDiv);
      marker.addTo(layer);
      markersMapRef.current.set(record.id, marker);
    });

    if (validPins.length > 0 && !focusedId && !flyToLocation && !hasInitialCentered.current) {
      const bounds = L.latLngBounds(validPins.map(p => [p.checkInLat, p.checkInLng]));
      mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      hasInitialCentered.current = true;
    }
  }, [records, visibility.showUsers, visibility.showUserNames]);

  // 3. Dynamic Site Marker Updates
  React.useEffect(() => {
    if (!mapRef.current || !sitesLayerRef.current) return;

    const layer = sitesLayerRef.current;
    layer.clearLayers();

    if (!visibility.showSites) return;

    const siteIcon = L.divIcon({
      className: 'custom-site-icon',
      html: `<div class="bg-emerald-600 text-white p-1 rounded-sm shadow-md border border-white"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    sites.filter(s => s.latitude && s.longitude).forEach(site => {
      const marker = L.marker([site.latitude, site.longitude], { icon: siteIcon });
      
      if (visibility.showSiteNames) {
        marker.bindTooltip(
          `<div class="bg-emerald-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-sm shadow-sm uppercase tracking-tighter">${site.name}</div>`, 
          {
            direction: 'bottom',
            offset: [0, 16],
            opacity: 0.9,
            permanent: true
          }
        );
      }

      marker.bindPopup(`
        <div class="p-2 space-y-1 text-left">
          <p class="font-black text-xs text-emerald-700 uppercase tracking-tight">${site.name}</p>
          <p class="text-[10px] font-medium text-muted-foreground">${site.projectCompany}</p>
          <div class="pt-1 mt-1 border-t flex flex-col gap-0.5">
            <span class="text-[8px] font-bold uppercase opacity-50">Capacity</span>
            <span class="text-[10px] font-black">${site.dcCapacity || '0'} MWp</span>
          </div>
        </div>
      `);

      marker.addTo(layer);
    });
  }, [sites, visibility.showSites, visibility.showSiteNames]);

  // 4. Interaction Handlers
  React.useEffect(() => {
    if (!focusedId || !mapRef.current) return;
    const marker = markersMapRef.current.get(focusedId);
    if (marker) {
      mapRef.current.setView(marker.getLatLng(), 16, { animate: true });
      marker.openPopup();
    }
  }, [focusedId]);

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
      className="h-full w-full z-10 bg-muted/10"
    />
  );
}
