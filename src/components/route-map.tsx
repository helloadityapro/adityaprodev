'use client';

import * as React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { format } from 'date-fns';
import { Clock, MapPin, Navigation } from 'lucide-react';

/**
 * Helper component to handle map viewport updates without re-initializing the container.
 */
function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  React.useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

/**
 * Robust map component to visualize a personnel's movement route.
 */
export default function RouteMap({ record }: { record: any }) {
  React.useEffect(() => {
    // Fix default marker icons for Next.js build
    const DefaultIcon = L.Icon.Default.prototype as any;
    delete DefaultIcon._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
  }, []);

  const points = React.useMemo(() => {
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

  if (points.length === 0) return null;

  const checkInPos: [number, number] = [record.checkInLat, record.checkInLng];
  const checkOutPos: [number, number] | null = record.checkOutLat && record.checkOutLng 
    ? [record.checkOutLat, record.checkOutLng] 
    : null;

  // We use a constant key for the MapContainer while viewing the same record
  // but allow ChangeView to pan the map if data updates.
  return (
    <div className="h-full w-full">
      <MapContainer 
        center={checkInPos} 
        zoom={14} 
        className="h-full w-full z-10"
        scrollWheelZoom={true}
      >
        <ChangeView center={checkInPos} zoom={14} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Route Path */}
        {points.length > 1 && (
          <Polyline positions={points} color="#3b82f6" weight={4} opacity={0.6} dashArray="10, 10" />
        )}

        {/* Check-In Marker */}
        <Marker position={checkInPos} icon={new L.Icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        })}>
          <Tooltip permanent direction="top" offset={[0, -40]}>
            <span className="text-[10px] font-black uppercase">Check-In</span>
          </Tooltip>
          <Popup>
            <div className="p-1 space-y-1 text-left">
              <p className="font-bold text-xs uppercase text-emerald-700">Check-In Point</p>
              <p className="text-[10px] font-mono">{record.checkInTime ? format(record.checkInTime.toDate(), 'HH:mm') : '—'}</p>
            </div>
          </Popup>
        </Marker>

        {/* Tracking Breadcrumbs */}
        {record.trackingPoints?.map((p: any, idx: number) => (
          <Marker key={`breadcrumb-${idx}`} position={[p.lat, p.lng]} icon={new L.DivIcon({
            className: 'custom-div-icon',
            html: `<div style="background-color: #3b82f6; width: 10px; height: 10px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.3);"></div>`,
            iconSize: [10, 10],
            iconAnchor: [5, 5]
          })}>
            <Popup>
              <div className="p-1 space-y-1 text-left">
                <p className="font-bold text-[10px] uppercase text-primary">Tracking Log</p>
                <p className="text-[10px] font-mono">{p.timestamp ? format(new Date(p.timestamp), 'HH:mm') : '—'}</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Check-Out Marker */}
        {checkOutPos && (
          <Marker position={checkOutPos} icon={new L.Icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
          })}>
            <Tooltip permanent direction="top" offset={[0, -40]}>
              <span className="text-[10px] font-black uppercase">Check-Out</span>
            </Tooltip>
            <Popup>
              <div className="p-1 space-y-1 text-left">
                <p className="font-bold text-xs uppercase text-red-700">Check-Out Point</p>
                <p className="text-[10px] font-mono">{record.checkOutTime ? format(record.checkOutTime.toDate(), 'HH:mm') : '—'}</p>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
