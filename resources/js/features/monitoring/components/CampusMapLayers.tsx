// Base layers every campus map shares: satellite and street tiles, plus the campus border.
// Used by the admin live map and the location pin picker, so both look the same.
import { LayersControl, Polygon, TileLayer } from 'react-leaflet';
import { CAMPUS_BOUNDARY } from '../mapView';

// Campus border colors. Approved look: thin maroon line on a white edge, no fill.
const BORDER_EDGE = '#ffffff';
const BORDER_LINE = '#7f1d1d';

export function CampusMapLayers() {
    return (
        <>
            <LayersControl position="topright">
                <LayersControl.BaseLayer checked name="Satellite (Esri)">
                    <TileLayer
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                        attribution="Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community"
                        maxZoom={19}
                    />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="Streets (OpenStreetMap)">
                    <TileLayer
                        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution="&copy; OpenStreetMap contributors"
                        maxZoom={19}
                    />
                </LayersControl.BaseLayer>
            </LayersControl>
            <Polygon
                positions={CAMPUS_BOUNDARY}
                pathOptions={{ color: BORDER_EDGE, weight: 6, fillOpacity: 0 }}
                interactive={false}
            />
            <Polygon
                positions={CAMPUS_BOUNDARY}
                pathOptions={{ color: BORDER_LINE, weight: 2.5, fillOpacity: 0 }}
                interactive={false}
            />
        </>
    );
}

export function HomeIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="1.5" />
        </svg>
    );
}
