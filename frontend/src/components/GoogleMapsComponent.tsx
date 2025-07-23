'use client';

import React, { useState, useCallback } from 'react';
import { APIProvider, Map, AdvancedMarker, InfoWindow, Pin } from '@vis.gl/react-google-maps';

interface Notice {
  id: string;
  village_name?: string;
  survey_number?: string;
  buyer_name?: string;
  seller_name?: string;
  notice_date?: string;
  latitude?: number;
  longitude?: number;
  district?: string;
  taluka?: string;
}

interface VillageLocation {
  name: string;
  lat: number;
  lng: number;
  count: number;
  notices: Notice[];
  district?: string;
  taluka?: string;
}

interface GoogleMapsComponentProps {
  villages: VillageLocation[];
  height?: string;
  zoom?: number;
}

// Map container style
const mapContainerStyle = {
  width: '100%',
  height: '400px'
};

const GoogleMapsComponent: React.FC<GoogleMapsComponentProps> = ({
  villages,
  height = '400px',
  zoom = 8,
}) => {
  const [selectedVillage, setSelectedVillage] = useState<VillageLocation | null>(null);

  // Get API key
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Calculate map center - only use real village coordinates
  const mapCenter = React.useMemo(() => {
    const validVillages = villages.filter(v => v.lat && v.lng);
    if (validVillages.length === 0) return null; // No fallback center
    
    const avgLat = validVillages.reduce((sum, v) => sum + v.lat, 0) / validVillages.length;
    const avgLng = validVillages.reduce((sum, v) => sum + v.lng, 0) / validVillages.length;
    
    return { lat: avgLat, lng: avgLng };
  }, [villages]);

  // Handle marker click
  const handleMarkerClick = useCallback((village: VillageLocation) => {
    setSelectedVillage(village);
  }, []);

  // Handle info window close
  const handleInfoWindowClose = useCallback(() => {
    setSelectedVillage(null);
  }, []);

  console.log('Google Maps API Key loaded:', apiKey ? 'Yes' : 'No');
  console.log('API Key (first 10 chars):', apiKey ? apiKey.substring(0, 10) + '...' : 'N/A');

  if (!apiKey) {
    return (
      <div className="w-full h-96 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-yellow-200">
        <div className="text-center p-6">
          <div className="text-yellow-600 text-lg font-semibold mb-2">
            🔑 API Key Missing
          </div>
          <div className="text-gray-600 text-sm">
            Google Maps API key not found in environment variables
          </div>
        </div>
      </div>
    );
  }

  // Don't render map if no valid coordinates
  if (!mapCenter) {
    return (
      <div className="w-full h-96 bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-center p-6">
          <div className="text-gray-400 text-4xl mb-3">🗺️</div>
          <div className="text-gray-600 text-lg font-semibold mb-2">
            No Location Data Available
          </div>
          <div className="text-gray-500 text-sm">
            Villages need valid latitude and longitude coordinates to be displayed on the map.
          </div>
        </div>
      </div>
    );
  }

  // Create pin icon with property count
  const getPinIcon = (count: number) => {
    let backgroundColor = '#3B82F6'; // Blue default
    const glyphColor = '#FFFFFF';
    
    if (count >= 5) {
      backgroundColor = '#EF4444'; // Red for high count
    } else if (count >= 3) {
      backgroundColor = '#F59E0B'; // Orange for medium count
    } else if (count >= 2) {
      backgroundColor = '#10B981'; // Green for low-medium count
    }

    return { backgroundColor, glyphColor };
  };

  return (
    <APIProvider apiKey={apiKey}>
      <div className="w-full" style={{ height }}>
        <Map
          style={mapContainerStyle}
          defaultCenter={mapCenter}
          defaultZoom={zoom}
          gestureHandling={'greedy'}
          disableDefaultUI={false}
          mapId={'DEMO_MAP_ID'}
        >
          {villages.map((village) => {
            const pinColors = getPinIcon(village.count);
            return (
              <AdvancedMarker
                key={village.name}
                position={{ lat: village.lat, lng: village.lng }}
                onClick={() => handleMarkerClick(village)}
              >
                <Pin
                  background={pinColors.backgroundColor}
                  glyphColor={pinColors.glyphColor}
                  borderColor={'#FFFFFF'}
                  scale={1.2}
                >
                  <div className="text-xs font-bold">{village.count}</div>
                </Pin>
              </AdvancedMarker>
            );
          })}

          {selectedVillage && (
            <InfoWindow
              position={{ lat: selectedVillage.lat, lng: selectedVillage.lng }}
              onCloseClick={handleInfoWindowClose}
            >
              <div className="p-3 max-w-sm">
                <h3 className="font-bold text-lg text-gray-800 mb-2">
                  {selectedVillage.name}
                </h3>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>📍 <strong>Properties:</strong> {selectedVillage.count}</div>
                  {selectedVillage.district && (
                    <div>🏛️ <strong>District:</strong> {selectedVillage.district}</div>
                  )}
                  {selectedVillage.taluka && (
                    <div>📍 <strong>Taluka:</strong> {selectedVillage.taluka}</div>
                  )}
                  <div className="mt-2 text-xs text-gray-500">
                    Coordinates: {selectedVillage.lat.toFixed(4)}, {selectedVillage.lng.toFixed(4)}
                  </div>
                </div>
              </div>
            </InfoWindow>
          )}
        </Map>
        
        {/* Map Legend */}
        <div className="mt-4 bg-white rounded-lg shadow-lg border border-gray-200 p-3">
          <h4 className="text-sm font-semibold text-gray-800 mb-2">📍 Pin Legend</h4>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
              <span>1 Property</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded-full"></div>
              <span>2-3 Properties</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-500 rounded-full"></div>
              <span>3-5 Properties</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded-full"></div>
              <span>5+ Properties</span>
            </div>
            <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
              📍 Click pins for details
            </div>
          </div>
        </div>
      </div>
    </APIProvider>
  );
};

export default GoogleMapsComponent; 