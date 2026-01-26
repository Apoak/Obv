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

interface Cluster {
  center: { lat: number; lng: number };
  count: number;
}

interface Bounds {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

// Minimum zoom level to show observations
const MIN_ZOOM_LEVEL = 6;

// Helper function to create clusters from observations
function createClusters(observations: Observation[], bounds: Bounds, gridSize: number = 10): Cluster[] {
  if (observations.length === 0) return [];

  const lngRange = bounds.maxLng - bounds.minLng;
  const latRange = bounds.maxLat - bounds.minLat;
  const cellLng = lngRange / gridSize;
  const cellLat = latRange / gridSize;

  // Map to store clusters by grid cell (using Record to avoid conflict with imported Map component)
  const clusterMap: Record<string, Observation[]> = {};

  // Group observations by grid cell
  observations.forEach((obs: Observation) => {
    const cellX = Math.floor((obs.longitude - bounds.minLng) / cellLng);
    const cellY = Math.floor((obs.latitude - bounds.minLat) / cellLat);
    const cellKey = `${cellX},${cellY}`;

    if (!clusterMap[cellKey]) {
      clusterMap[cellKey] = [];
    }
    clusterMap[cellKey].push(obs);
  });

  // Convert to clusters with centers
  const clusters: Cluster[] = [];
  Object.entries(clusterMap).forEach(([cellKey, obsList]: [string, Observation[]]) => {
    if (obsList.length > 0) {
      // Calculate center as average of all observations in cluster
      const avgLng = obsList.reduce((sum: number, obs: Observation) => sum + obs.longitude, 0) / obsList.length;
      const avgLat = obsList.reduce((sum: number, obs: Observation) => sum + obs.latitude, 0) / obsList.length;

      clusters.push({
        center: { lat: avgLat, lng: avgLng },
        count: obsList.length
      });
    }
  });

  return clusters;
}

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
  // Track clusters when zoomed out
  const [clusters, setClusters] = useState<Cluster[]>([]);
  // Track full-screen observation
  const [fullScreenObs, setFullScreenObs] = useState<Observation | null>(null);
  // Track current viewport
  const [viewState, setViewState] = useState<ViewState>({
    longitude: -98.5,
    latitude: 39.5,
    zoom: 3.5,
    bearing: 0,
    pitch: 0,
    padding: { top: 0, bottom: 0, left: 0, right: 0 },
  });
  
  // Get actual bounds from map and filter observations
  const updateVisibleObservations = useCallback(() => {
    if (!mapRef.current) return;
    
    const map = mapRef.current.getMap();
    const bounds = map.getBounds();
    const zoom = map.getZoom();
    
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
    
    if (zoom < MIN_ZOOM_LEVEL) {
      // When zoomed out, create clusters instead of showing individual markers
      const newClusters = createClusters(filtered, boundsObj);
      setClusters(newClusters);
      setObservations([]);
    } else {
      // When zoomed in, show individual markers
      setClusters([]);
      setObservations(filtered);
    }
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

        {/* Render cluster markers when zoomed out */}
        {clusters.map((cluster, index) => (
          <Marker 
            key={`cluster-${index}`} 
            longitude={cluster.center.lng} 
            latitude={cluster.center.lat}
            anchor="center"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 text-white font-bold text-sm shadow-lg border-2 border-white">
              {cluster.count}
            </div>
          </Marker>
        ))}

        {/* Render individual observation markers when zoomed in */}
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
              <button
                onClick={() => {
                  setFullScreenObs(selectedObs);
                  setSelectedObs(null);
                }}
                className="mt-2 w-full bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-blue-700 transition-colors"
              >
                View Full Screen
              </button>
            </div>
          </Popup>
        )}
      </Map>

      {/* Full-screen observation modal */}
      {fullScreenObs && (
        <div 
          className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-30 p-4"
          onClick={() => setFullScreenObs(null)}
        >
          <div 
            className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setFullScreenObs(null)}
              className="absolute top-4 right-4 z-10 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 transition-colors"
              aria-label="Close"
            >
              <svg 
                className="w-6 h-6 text-gray-600" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Content */}
            <div className="p-6">
              {/* Image Gallery */}
              <div className="mb-4 space-y-3">
                {fullScreenObs.image_urls.map((imageUrl, index) => (
                  <img 
                    key={index}
                    src={imageUrl} 
                    alt={`${fullScreenObs.caption} - Image ${index + 1}`} 
                    className="rounded-lg w-full h-auto object-cover"
                  />
                ))}
              </div>

              {/* Caption */}
              <h2 className="text-2xl font-bold mb-3">{fullScreenObs.caption}</h2>

              {/* Metadata */}
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>Views: {fullScreenObs.views}</span>
                <span>Posted: {new Date(fullScreenObs.dateposted).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}