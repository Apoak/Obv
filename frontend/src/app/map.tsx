"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Map, { Marker, Popup, NavigationControl, ViewState, MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

interface Observation {
  id: number;  // Post ID
  user_id: number;
  caption: string;
  image_urls: string[];  // Array of up to 5 image URLs
  longitude: number;
  latitude: number;
  views: number;
  dateposted: string;
}

interface ClimbingMapProps {
  observations: Observation[];
  currentUserId?: number;  // Optional: current user ID for view tracking
  apiBaseUrl?: string;  // Optional: API base URL (defaults to http://localhost:8000)
  onViewportChange?: (bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number; zoom: number }) => void;
}

// Minimum zoom level to show observations
const MIN_ZOOM_LEVEL = 6;

export default function ClimbingMap({ 
  observations: initialObservations, 
  currentUserId,
  apiBaseUrl = 'http://localhost:8000',
  onViewportChange
}: ClimbingMapProps) {
  // Map ref to access map instance
  const mapRef = useRef<MapRef>(null);
  // Track which marker is clicked to show the popup
  const [selectedObs, setSelectedObs] = useState<Observation | null>(null);
  // Keep observations in state so we can update them when views change
  const [observations, setObservations] = useState<Observation[]>([]);
  // Track current viewport
  const [viewState, setViewState] = useState<ViewState>({
    longitude: -98.5,
    latitude: 39.5,
    zoom: 3.5,
  });
  
  // Get actual bounds from map and filter observations
  const updateVisibleObservations = useCallback(() => {
    if (!mapRef.current) return;
    
    const map = mapRef.current.getMap();
    const bounds = map.getBounds();
    const zoom = map.getZoom();
    
    if (zoom < MIN_ZOOM_LEVEL) {
      setObservations([]);
      if (onViewportChange) {
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        onViewportChange({
          minLng: sw.lng,
          minLat: sw.lat,
          maxLng: ne.lng,
          maxLat: ne.lat,
          zoom: zoom
        });
      }
      return;
    }
    
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    
    const boundsObj = {
      minLng: sw.lng,
      minLat: sw.lat,
      maxLng: ne.lng,
      maxLat: ne.lat,
      zoom: zoom
    };
    
    if (onViewportChange) {
      onViewportChange(boundsObj);
    }
    
    // Filter observations based on actual map bounds
    const filtered = initialObservations.filter(obs => 
      obs.longitude >= boundsObj.minLng &&
      obs.longitude <= boundsObj.maxLng &&
      obs.latitude >= boundsObj.minLat &&
      obs.latitude <= boundsObj.maxLat
    );
    
    setObservations(filtered);
  }, [initialObservations, onViewportChange]);
  
  // Handle viewport changes
  const handleMoveEnd = useCallback(() => {
    updateVisibleObservations();
  }, [updateVisibleObservations]);
  
  // Initial filter when observations change or map loads
  useEffect(() => {
    // Small delay to ensure map is initialized
    const timer = setTimeout(() => {
      updateVisibleObservations();
    }, 100);
    return () => clearTimeout(timer);
  }, [initialObservations, updateVisibleObservations]);
  
  // Increment views when popup opens (if viewer is not the poster)
  useEffect(() => {
    if (selectedObs && currentUserId !== undefined) {
      // Only increment if viewer is not the poster
      if (currentUserId !== selectedObs.user_id) {
        fetch(`${apiBaseUrl}/observations/${selectedObs.id}/view`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ viewer_user_id: currentUserId }),
        })
        .then(response => response.json())
        .then(data => {
          // Map backend's created_at to dateposted if needed
          const mappedData = {
            ...data,
            dateposted: data.created_at || data.dateposted || new Date().toISOString()
          };
          // Update the selected observation with new view count
          setSelectedObs(mappedData);
          // Also update in the observations array
          setObservations(prev => 
            prev.map(obs => obs.id === mappedData.id ? mappedData : obs)
          );
        })
        .catch(error => {
          console.error('Error incrementing views:', error);
        });
      }
    }
  }, [selectedObs, currentUserId, apiBaseUrl]);

  return (
    <div className="w-full h-full min-h-[500px]">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        onMoveEnd={handleMoveEnd}
        onLoad={updateVisibleObservations}
        mapStyle="https://raw.githubusercontent.com/nst-guide/osm-liberty-topo/gh-pages/style.json"
      >
        <NavigationControl position="top-right" />

        {observations.map((obs) => (
          <Marker 
            key={obs.id} 
            longitude={obs.longitude} 
            latitude={obs.latitude}
            anchor="bottom"
          >
            <button
              className="group flex flex-col items-center"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedObs(obs);
              }}
            >
              {/* The Thumbnail - use first image */}
              <div 
                className="w-10 h-10 rounded-full border-2 border-white shadow-lg bg-cover bg-center transition-transform hover:scale-110"
                style={{ backgroundImage: `url(${obs.image_urls[0] || ''})` }}
              />
              {/* Triangle pointer */}
              <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-white" />
            </button>
          </Marker>
        ))}

        {selectedObs && (
          <Popup
            longitude={selectedObs.longitude}
            latitude={selectedObs.latitude}
            anchor="top"
            onClose={() => setSelectedObs(null)}
            closeOnClick={false}
          >
            <div className="p-2 max-w-[250px]">
              {/* Image Gallery - display all images */}
              <div className="mb-2 space-y-1">
                {selectedObs.image_urls.map((imageUrl, index) => (
                  <img 
                    key={index}
                    src={imageUrl} 
                    alt={`${selectedObs.caption} - Image ${index + 1}`} 
                    className="rounded w-full h-32 object-cover"
                  />
                ))}
              </div>
              <p className="text-sm font-medium mb-1">{selectedObs.caption}</p>
              <p className="text-xs text-gray-500">Views: {selectedObs.views}</p>
              <p className="text-xs text-gray-400 mt-1">
                Posted: {new Date(selectedObs.dateposted).toLocaleDateString()}
              </p>
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}