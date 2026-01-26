"use client";

import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import dynamic from 'next/dynamic';
import exifr from 'exifr';

// Dynamically import map components to avoid SSR issues
const Map = dynamic(() => import('react-map-gl/maplibre').then(mod => mod.default), { 
  ssr: false,
  loading: () => <div className="h-64 bg-gray-200 animate-pulse rounded-md flex items-center justify-center">Loading map...</div>
});

const Marker = dynamic(() => import('react-map-gl/maplibre').then(mod => mod.Marker), { 
  ssr: false 
});

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface CreateObservationFormProps {
  latitude?: number;
  longitude?: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface ImageFile {
  file: File;
  preview: string;
  hasGps: boolean;
  lat?: number;
  lng?: number;
}

export default function CreateObservationForm({
  latitude,
  longitude,
  onSuccess,
  onCancel,
}: CreateObservationFormProps) {
  const [caption, setCaption] = useState('');
  const [imageFiles, setImageFiles] = useState<ImageFile[]>([]);
  const [lat, setLat] = useState(latitude?.toString() || '');
  const [lng, setLng] = useState(longitude?.toString() || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [mapMarker, setMapMarker] = useState<{ lat: number; lng: number } | null>(null);
  const [mapViewState, setMapViewState] = useState({
    longitude: -98.5,
    latitude: 39.5,
    zoom: 3.5,
  });
  const [extractingExif, setExtractingExif] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { token, isAuthenticated } = useAuth();

  // Extract GPS coordinates from image EXIF data
  const extractGpsFromImage = async (file: File): Promise<{ lat?: number; lng?: number }> => {
    try {
      const exifData = await exifr.parse(file, {
        gps: true,
        pick: ['GPSLatitude', 'GPSLongitude']
      });

      if (exifData?.GPSLatitude && exifData?.GPSLongitude) {
        return {
          lat: exifData.GPSLatitude,
          lng: exifData.GPSLongitude
        };
      }
      return {};
    } catch (err) {
      console.error('Error extracting EXIF data:', err);
      return {};
    }
  };

  // Handle file selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Limit to 5 images total
    const remainingSlots = 5 - imageFiles.length;
    const filesToAdd = Array.from(files).slice(0, remainingSlots);

    if (files.length > remainingSlots) {
      setError(`Maximum 5 images allowed. Only ${remainingSlots} more can be added.`);
    }

    setExtractingExif(true);
    setError('');

    try {
      const newImageFiles: ImageFile[] = [];

      for (const file of filesToAdd) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          setError(`${file.name} is not a valid image file`);
          continue;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          setError(`${file.name} is too large. Maximum size is 10MB`);
          continue;
        }

        // Create preview
        const preview = URL.createObjectURL(file);

        // Extract GPS data
        const gps = await extractGpsFromImage(file);
        const hasGps = !!(gps.lat && gps.lng);

        newImageFiles.push({
          file,
          preview,
          hasGps,
          lat: gps.lat,
          lng: gps.lng
        });

        // If this is the first image with GPS, use its coordinates
        if (hasGps && !lat && !lng) {
          setLat(gps.lat!.toString());
          setLng(gps.lng!.toString());
          setShowMap(false);
        }
      }

      setImageFiles([...imageFiles, ...newImageFiles]);

      // If no GPS found in any image and coordinates are not set, show map
      if (!lat && !lng && newImageFiles.every(img => !img.hasGps)) {
        setShowMap(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error processing images');
    } finally {
      setExtractingExif(false);
    }
  };

  // Remove an image
  const removeImage = (index: number) => {
    const imageToRemove = imageFiles[index];
    URL.revokeObjectURL(imageToRemove.preview);
    const newFiles = imageFiles.filter((_, i) => i !== index);
    setImageFiles(newFiles);

    // If we removed the image that had GPS and no other images have GPS, show map
    if (imageToRemove.hasGps && newFiles.every(img => !img.hasGps) && !mapMarker) {
      setShowMap(true);
      setLat('');
      setLng('');
    }
  };

  // Handle map click to set location
  const handleMapClick = (event: { lngLat: { lng: number; lat: number } }) => {
    const { lng, lat } = event.lngLat;
    setLng(lng.toString());
    setLat(lat.toString());
    setMapMarker({ lat, lng });
    setMapViewState({
      longitude: lng,
      latitude: lat,
      zoom: 10,
    });
    setShowMap(false);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isAuthenticated || !token) {
      setError('You must be logged in to create an observation');
      return;
    }

    // Validate caption
    if (!caption.trim()) {
      setError('Caption is required');
      return;
    }

    // Validate images
    if (imageFiles.length === 0) {
      setError('At least one image is required');
      return;
    }

    if (imageFiles.length > 5) {
      setError('Maximum 5 images allowed');
      return;
    }

    // Validate coordinates
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (isNaN(latNum) || isNaN(lngNum)) {
      setError('Valid latitude and longitude are required. Please select a location on the map or ensure your images have GPS metadata.');
      return;
    }

    if (latNum < -90 || latNum > 90) {
      setError('Latitude must be between -90 and 90');
      return;
    }

    if (lngNum < -180 || lngNum > 180) {
      setError('Longitude must be between -180 and 180');
      return;
    }

    setLoading(true);

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('caption', caption.trim());
      formData.append('latitude', latNum.toString());
      formData.append('longitude', lngNum.toString());
      
      // Append all image files
      imageFiles.forEach((imageFile, index) => {
        formData.append(`images`, imageFile.file);
      });

      const response = await fetch(`${API_BASE_URL}/observations/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to create observation' }));
        throw new Error(errorData.detail || 'Failed to create observation');
      }

      // Clean up preview URLs
      imageFiles.forEach(img => URL.revokeObjectURL(img.preview));

      // Reset form
      setCaption('');
      setImageFiles([]);
      setLat('');
      setLng('');
      setMapMarker(null);
      setShowMap(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create observation');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl">
        <p className="text-gray-600 mb-4">You must be logged in to create an observation.</p>
        <a href="/login" className="text-blue-600 hover:text-blue-500">
          Login
        </a>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl max-h-[90vh] overflow-y-auto">
      <h2 className="text-2xl font-bold mb-4">Create Observation</h2>
      
      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="caption" className="block text-sm font-medium text-gray-700 mb-1">
            Caption *
          </label>
          <textarea
            id="caption"
            name="caption"
            required
            rows={3}
            maxLength={500}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Describe your observation..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
          <p className="mt-1 text-xs text-gray-500">{caption.length}/500 characters</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Images * (1-5 images, max 10MB each)
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            disabled={imageFiles.length >= 5 || extractingExif}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {extractingExif && (
            <p className="mt-1 text-xs text-blue-600">Extracting GPS data from images...</p>
          )}
          {imageFiles.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-4">
              {imageFiles.map((imageFile, index) => (
                <div key={index} className="relative border rounded-md p-2">
                  <img
                    src={imageFile.preview}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-32 object-cover rounded"
                  />
                  {imageFile.hasGps && (
                    <span className="absolute top-3 right-3 bg-green-500 text-white text-xs px-2 py-1 rounded">
                      GPS
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="mt-2 w-full px-2 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
          {imageFiles.length < 5 && imageFiles.length > 0 && (
            <p className="mt-2 text-xs text-gray-500">
              {5 - imageFiles.length} more image{5 - imageFiles.length !== 1 ? 's' : ''} can be added
            </p>
          )}
        </div>

        {/* Map for manual location selection */}
        {showMap && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Location on Map *
            </label>
            <div className="h-64 w-full border border-gray-300 rounded-md overflow-hidden relative">
              <Map
                {...mapViewState}
                onMove={(evt) => setMapViewState(evt.viewState)}
                onClick={handleMapClick}
                mapStyle="https://raw.githubusercontent.com/nst-guide/osm-liberty-topo/gh-pages/style.json"
                style={{ width: '100%', height: '100%' }}
              >
                {mapMarker && (
                  <Marker
                    longitude={mapMarker.lng}
                    latitude={mapMarker.lat}
                    anchor="bottom"
                  >
                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        backgroundColor: 'red',
                        borderRadius: '50%',
                        border: '2px solid white',
                        cursor: 'pointer',
                      }}
                    />
                  </Marker>
                )}
              </Map>
            </div>
            <p className="mt-1 text-xs text-gray-500">Click on the map to set the location</p>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Location *
            </label>
            {!showMap && (
              <button
                type="button"
                onClick={() => {
                  const currentLat = parseFloat(lat) || 39.5;
                  const currentLng = parseFloat(lng) || -98.5;
                  setMapViewState({
                    longitude: currentLng,
                    latitude: currentLat,
                    zoom: currentLat !== 39.5 || currentLng !== -98.5 ? 10 : 3.5,
                  });
                  if (currentLat !== 39.5 || currentLng !== -98.5) {
                    setMapMarker({ lat: currentLat, lng: currentLng });
                  }
                  setShowMap(true);
                }}
                className="text-xs text-blue-600 hover:text-blue-500"
              >
                Select on map
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="latitude" className="block text-xs text-gray-600 mb-1">
                Latitude
              </label>
              <input
                id="latitude"
                name="latitude"
                type="number"
                step="any"
                required
                min="-90"
                max="90"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., 37.7749"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="longitude" className="block text-xs text-gray-600 mb-1">
                Longitude
              </label>
              <input
                id="longitude"
                name="longitude"
                type="number"
                step="any"
                required
                min="-180"
                max="180"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., -122.4194"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={loading || extractingExif}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Create Observation'}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
