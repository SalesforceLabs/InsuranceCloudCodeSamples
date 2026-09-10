import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const markerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export type MapLocation = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  insuredValue?: number | null;
  premium?: number | null;
};

type Props = {
  locations: MapLocation[];
  initialSelectedId?: string;
  height?: number | string;
};

const TILE_LAYERS = {
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
  },
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
};

const MAP_HEIGHT = 540;

type FocusTarget = { type: 'fit' } | { type: 'zoom'; lat: number; lng: number; zoom?: number } | null;

function MapController({
  locations,
  focus,
  onFocusHandled,
}: {
  locations: MapLocation[];
  focus: FocusTarget;
  onFocusHandled: () => void;
}) {
  const map = useMap();

  const fitAll = () => {
    if (locations.length === 0) return;
    if (locations.length === 1) {
      map.setView([locations[0].lat, locations[0].lng], 13);
      return;
    }
    const bounds = L.latLngBounds(locations.map((l) => [l.lat, l.lng]));
    map.fitBounds(bounds, { padding: [40, 40] });
  };

  // The map may mount before its container is laid out (e.g. inside a modal),
  // leaving Leaflet with a stale/zero size so flyTo lands on wrong coordinates.
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Key on the location *contents*, not the array identity — the parent rebuilds
  // the locations array on every render, so depending on the reference would re-run
  // fitAll after every click and snap the view back to full bounds, undoing the zoom.
  const locationsKey = locations.map((l) => `${l.id}:${l.lat},${l.lng}`).join('|');
  useEffect(() => {
    fitAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationsKey]);

  useEffect(() => {
    if (!focus) return;
    map.invalidateSize();
    if (focus.type === 'fit') fitAll();
    if (focus.type === 'zoom') map.flyTo([focus.lat, focus.lng], focus.zoom ?? 16, { duration: 0.6 });
    onFocusHandled();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  return null;
}

export default function LocationsMap({ locations, initialSelectedId, height = MAP_HEIGHT }: Props) {
  const [view, setView] = useState<'satellite' | 'street'>('satellite');
  const initialLoc = initialSelectedId ? locations.find((l) => l.id === initialSelectedId) : undefined;
  const [focus, setFocus] = useState<FocusTarget>(
    initialLoc ? { type: 'zoom', lat: initialLoc.lat, lng: initialLoc.lng, zoom: 17 } : null
  );
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? null);

  const center = useMemo<[number, number]>(() => {
    if (locations.length === 0) return [39.5, -98.35];
    return [locations[0].lat, locations[0].lng];
  }, [locations]);

  if (locations.length === 0) {
    return (
      <div
        style={{
          height,
          backgroundColor: '#f3f3f3',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#706E6B',
          fontSize: 13,
        }}
      >
        No location data available
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height }}>
      {/* LIST — left */}
      <div
        style={{
          flexBasis: '20%',
          flexGrow: 0,
          flexShrink: 0,
          borderRight: '1px solid #e5e5e5',
          backgroundColor: '#fff',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '8px 12px',
            borderBottom: '1px solid #e5e5e5',
            fontSize: 12,
            fontWeight: 600,
            color: '#001e5b',
            backgroundColor: '#fafafa',
          }}
        >
          Locations
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {locations.map((loc) => {
            const isSelected = selectedId === loc.id;
            return (
              <button
                key={loc.id}
                onClick={() => {
                  setSelectedId(loc.id);
                  setFocus({ type: 'zoom', lat: loc.lat, lng: loc.lng, zoom: 17 });
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 12px',
                  border: 'none',
                  borderBottom: '1px solid #f0f0f0',
                  backgroundColor: isSelected ? '#e8f1fb' : '#fff',
                  cursor: 'pointer',
                  fontSize: 12,
                  color: isSelected ? '#0176D3' : '#080707',
                  fontWeight: isSelected ? 600 : 400,
                  lineHeight: 1.35,
                }}
              >
                {loc.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* MAP — right */}
      <div style={{ position: 'relative', flexGrow: 1, flexShrink: 1, minWidth: 0 }}>
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            zIndex: 1000,
            display: 'flex',
            gap: 6,
          }}
        >
          <button
            onClick={() => {
              setSelectedId(null);
              setFocus({ type: 'fit' });
            }}
            style={{
              padding: '6px 10px',
              fontSize: 12,
              fontWeight: 500,
              border: '1px solid #c9c9c9',
              borderRadius: 4,
              background: '#fff',
              color: '#001e5b',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            Reset View
          </button>
          <div
            style={{
              display: 'flex',
              background: '#fff',
              borderRadius: 4,
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              overflow: 'hidden',
              border: '1px solid #c9c9c9',
            }}
          >
            {(['satellite', 'street'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: view === v ? 600 : 400,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: view === v ? '#0176D3' : '#fff',
                  color: view === v ? '#fff' : '#444',
                  textTransform: 'capitalize',
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <MapContainer center={center} zoom={4} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
          <TileLayer attribution={TILE_LAYERS[view].attribution} url={TILE_LAYERS[view].url} key={view} />
          <MapController locations={locations} focus={focus} onFocusHandled={() => setFocus(null)} />
          {locations.map((loc) => (
            <Marker key={loc.id} position={[loc.lat, loc.lng]} icon={markerIcon}>
              <Popup>
                <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 600, color: '#080707', marginBottom: 4 }}>{loc.name}</div>
                  <div style={{ color: '#444' }}>{loc.address}</div>
                  {(loc.insuredValue != null || loc.premium != null) && (
                    <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid #eee', color: '#444' }}>
                      {loc.insuredValue != null && (
                        <div>
                          <strong>Insured Value:</strong> ${loc.insuredValue.toLocaleString()}
                        </div>
                      )}
                      {loc.premium != null && (
                        <div>
                          <strong>Premium:</strong> ${loc.premium.toLocaleString()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
