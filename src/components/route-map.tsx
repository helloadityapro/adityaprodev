'use client';

import * as React from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { format } from 'date-fns';

/**
 * Robust map component to visualize a personnel's movement route.
 * Manually manages Leaflet lifecycle to avoid "already initialized" errors.
 */
export default function RouteMap({ record }: { record: any }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<L.Map | null>(null);
  const layerRef = React.useRef<L.LayerGroup | null>(null);

  const points: [number, number][] = React.useMemo(() => {
    const list: [number, number][] = [];
    if (record.checkInLat && record.checkInLng) {
      list.push([record.checkInLat, record.checkInLng]);
    }
    if (record.trackingPoints) {
      record.trackingPoints.forEach((p: any) => {
        if (p.lat && p.lng) list.push([p.lat, p.lng]);
      });
    }
    if (record.checkOutLat && record.checkOutLng) {
      list.push([record.checkOutLat, record.checkOutLng]);
    }
    return list;
  }, [record]);

  // 1. Initial Setup (Runs Once)
  React.useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if ((containerRef.current as any)._leaflet_id) return;

    // Marker icon fix
    const DefaultIcon = L.Icon.Default.prototype as any;
    delete DefaultIcon._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    const startPos: [number, number] = [record.checkInLat, record.checkInLng];

    const map = L.map(containerRef.current, {
      center: startPos,
      zoom: 14,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    const layer = L.layerGroup().addTo(map);
    layerRef.current = layer;
    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
      }
    };
  }, []);

  // 2. Dynamic Itinerary Update (Runs on data changes)
  React.useEffect(() => {
    if (!mapRef.current || !layerRef.current) return;
    const layer = layerRef.current;
    const map = mapRef.current;
    layer.clearLayers();

    // Draw route path
    if (points.length > 1) {
      L.polyline(points, { color: '#3b82f6', weight: 4, opacity: 0.6, dashArray: '10, 10' }).addTo(layer);
    }

    // Origin
    if (record.checkInLat && record.checkInLng) {
      const icon = new L.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });

      L.marker([record.checkInLat, record.checkInLng], { icon })
        .bindTooltip('<span class="text-[10px] font-black uppercase">Check-In</span>', { permanent: true, direction: 'top', offset: [0, -40] })
        .bindPopup(`<div class="p-1 space-y-1 text-left"><p class="font-bold text-xs uppercase text-emerald-700">Check-In Point</p><p class="text-[10px] font-mono">${record.checkInTime ? format(record.checkInTime.toDate(), 'HH:mm') : '—'}</p></div>`)
        .addTo(layer);
    }

    // Breadcrumbs
    record.trackingPoints?.forEach((p: any, idx: number) => {
      const divIcon = new L.DivIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: #3b82f6; width: 10px; height: 10px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.3);"></div>`,
        iconSize: [10, 10],
        iconAnchor: [5, 5]
      });

      L.marker([p.lat, p.lng], { icon: divIcon })
        .bindPopup(`<div class="p-1 space-y-1 text-left"><p class="font-bold text-[10px] uppercase text-primary">Tracking Log</p><p class="text-[10px] font-mono">${p.timestamp ? format(new Date(p.timestamp), 'HH:mm') : '—'}</p></div>`)
        .addTo(layer);
    });

    // Destination
    if (record.checkOutLat && record.checkOutLng) {
      const icon = new L.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });

      L.marker([record.checkOutLat, record.checkOutLng], { icon })
        .bindTooltip('<span class="text-[10px] font-black uppercase">Check-Out</span>', { permanent: true, direction: 'top', offset: [0, -40] })
        .bindPopup(`<div class="p-1 space-y-1 text-left"><p class="font-bold text-xs uppercase text-red-700">Check-Out Point</p><p class="text-[10px] font-mono">${record.checkOutTime ? format(record.checkOutTime.toDate(), 'HH:mm') : '—'}</p></div>`)
        .addTo(layer);
    }

    // Bounds fitting
    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [record, points]);

  return (
    <div 
      ref={containerRef} 
      className="h-full w-full z-10 bg-muted/10"
    />
  );
}