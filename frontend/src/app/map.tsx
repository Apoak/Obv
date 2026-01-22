"use client";

import React, { useState } from 'react';
import Map, { Marker, Popup, NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

interface Observation {
  id: number;
  caption: string;
  image_url: string;
  longitude: number;
  latitude: number;
}

export default function ClimbingMap({ observations }: { observations: Observation[] }) {
  // Track which marker is clicked to show the popup
  const [selectedObs, setSelectedObs] = useState<Observation | null>(null);

  return (
    <div className="w-full h-full min-h-[500px]">
      <Map
        initialViewState={{
          longitude: -119.5383,
          latitude: 37.7456,
          zoom: 5,
        }}
        mapStyle="https://demotiles.maplibre.org/style.json"
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
              {/* The Thumbnail */}
              <div 
                className="w-10 h-10 rounded-full border-2 border-white shadow-lg bg-cover bg-center transition-transform hover:scale-110"
                style={{ backgroundImage: `url(${obs.image_url})` }}
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
            <div className="p-2 max-w-[200px]">
              <img 
                src={selectedObs.image_url} 
                alt={selectedObs.caption} 
                className="rounded mb-2 w-full h-32 object-cover"
              />
              <p className="text-sm font-medium">{selectedObs.caption}</p>
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}