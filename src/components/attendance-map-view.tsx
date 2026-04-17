'use client';

import * as React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { format } from 'date-fns';
import { User, Clock, Calendar, MapPin, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

/**
 * Helper component to handle map viewport updates without re-initializing the container.
 * This prevents the "Map container is already initialized" error.
 */
function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  React.useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

/**
 * Interactive Leaflet Map component for visual personnel tracking.
 * Plotted markers represent live 'ongoing' attendance sessions.
 */
export default function MapViewComponent({ records }: { records: any[] }) {
  // Fix for default marker icons in Next.js/Webpack environments
  React.useEffect(() => {
    const DefaultIcon = L.Icon.Default.prototype as any;
    delete DefaultIcon._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
  }, []);

  const validPins = React.useMemo(() => records.filter(r => r.checkInLat && r.checkInLng), [records]);
  
  // Default map position: Center of India or first available personnel
  const defaultCenter: [number, number] = React.useMemo(() => {
    return validPins.length > 0 
      ? [validPins[0].checkInLat, validPins[0].checkInLng] 
      : [20.5937, 78.9629];
  }, [validPins]);

  // We use a constant key for the MapContainer to prevent Leaflet re-init collisions.
  // The viewport is updated via the <ChangeView /> component.
  return (
    <div className="h-full w-full">
      <MapContainer 
        center={defaultCenter} 
        zoom={5} 
        className="h-full w-full z-10"
        scrollWheelZoom={true}
      >
        <ChangeView center={defaultCenter} zoom={5} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {validPins.map((record) => (
          <Marker 
            key={`marker-${record.id}`} 
            position={[record.checkInLat, record.checkInLng]}
          >
            <Tooltip direction="top" offset={[0, -20]} opacity={0.9}>
              <span className="font-bold text-xs">{record.userName}</span>
            </Tooltip>
            <Popup className="rounded-sm overflow-hidden custom-popup">
              <div className="p-1 min-w-[200px] space-y-3 text-left">
                <div className="flex items-center gap-2 border-b pb-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-black text-xs uppercase tracking-tight text-foreground">{record.userName}</span>
                    <span className="text-[9px] font-bold text-muted-foreground uppercase">Logged In</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Time:
                    </span>
                    <span className="text-[10px] font-mono font-black text-primary">
                      {record.checkInTime ? format(record.checkInTime.toDate(), 'HH:mm') : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Date:
                    </span>
                    <span className="text-[10px] font-mono font-black">
                      {record.date}
                    </span>
                  </div>
                  <Separator className="opacity-50" />
                  <div className="flex flex-col gap-1 text-left">
                    <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> Coordinates:
                    </span>
                    <p className="text-[10px] font-mono font-bold bg-muted/50 p-1.5 rounded-sm">
                      {record.checkInLat.toFixed(6)}, {record.checkInLng.toFixed(6)}
                    </p>
                  </div>
                </div>
                
                <Button variant="outline" size="sm" className="w-full h-8 text-[9px] font-black uppercase rounded-sm border-primary/20 text-primary shadow-sm hover:bg-primary/5" asChild>
                  <a href={`https://www.google.com/maps/search/?api=1&query=${record.checkInLat},${record.checkInLng}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3 mr-1" /> View on Maps
                  </a>
                </Button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
