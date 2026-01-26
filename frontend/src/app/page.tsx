"use client"; // Required for client-side state/loading

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/contexts/AuthContext';
import CreateObservationForm from '@/components/CreateObservationForm';
import Link from 'next/link';

// 1. Import the map dynamically with SSR disabled
const ClimbingMap = dynamic(() => import('@/app/map'), { 
  ssr: false,
  loading: () => <div className="h-screen w-full bg-gray-200 animate-pulse flex items-center justify-center">Loading Map Engine...</div>
});

interface Observation {
  id: number;
  user_id: number;
  caption: string;
  image_urls: string[];
  longitude: number;
  latitude: number;
  views: number;
  dateposted: string;
}

// 2. Mock Data as fallback
const MOCK_OBSERVATIONS: Observation[] = [
  {
    id: 1,
    user_id: 1,
    caption: "Classic Highball in Bishop",
    image_urls: [
      "https://placehold.co/400x400/png?text=Climbing+Photo+1",
      "https://placehold.co/400x400/png?text=Climbing+Photo+2"
    ],
    longitude: -118.5794,
    latitude: 37.3614,
    views: 42,
    dateposted: "2024-01-15T08:30:00Z",
  },
  {
    id: 2,
    user_id: 2,
    caption: "Perfect day at the Gunks",
    image_urls: [
      "https://placehold.co/400x400/png?text=Crag+View+1",
      "https://placehold.co/400x400/png?text=Crag+View+2",
      "https://placehold.co/400x400/png?text=Crag+View+3"
    ],
    longitude: -74.1956,
    latitude: 41.7486,
    views: 18,
    dateposted: "2024-01-16T14:20:00Z",
  },
  {
    id: 3,
    user_id: 3,
    caption: "Mount Rainier summit attempt - perfect conditions",
    image_urls: [
      "https://placehold.co/400x400/png?text=Rainier+1",
      "https://placehold.co/400x400/png?text=Rainier+2",
      "https://placehold.co/400x400/png?text=Rainier+3",
      "https://placehold.co/400x400/png?text=Rainier+4"
    ],
    longitude: -121.7603,
    latitude: 46.8523,
    views: 127,
    dateposted: "2024-01-17T10:15:00Z",
  },
  {
    id: 4,
    user_id: 4,
    caption: "Index Town Walls - classic crack climbing",
    image_urls: [
      "https://placehold.co/400x400/png?text=Index+1",
      "https://placehold.co/400x400/png?text=Index+2"
    ],
    longitude: -121.5544,
    latitude: 47.7828,
    views: 89,
    dateposted: "2024-01-18T16:45:00Z",
  },
  {
    id: 5,
    user_id: 5,
    caption: "Leavenworth bouldering session",
    image_urls: [
      "https://placehold.co/400x400/png?text=Leavenworth+1",
      "https://placehold.co/400x400/png?text=Leavenworth+2",
      "https://placehold.co/400x400/png?text=Leavenworth+3"
    ],
    longitude: -120.6615,
    latitude: 47.5962,
    views: 56,
    dateposted: "2024-01-19T12:00:00Z",
  },
  {
    id: 6,
    user_id: 6,
    caption: "Olympic National Park - Hurricane Ridge trail conditions",
    image_urls: [
      "https://placehold.co/400x400/png?text=Olympic+1",
      "https://placehold.co/400x400/png?text=Olympic+2"
    ],
    longitude: -123.4331,
    latitude: 47.9698,
    views: 34,
    dateposted: "2024-01-20T09:30:00Z",
  },
  {
    id: 7,
    user_id: 7,
    caption: "Smith Rock of the North - Vantage climbing",
    image_urls: [
      "https://placehold.co/400x400/png?text=Vantage+1",
      "https://placehold.co/400x400/png?text=Vantage+2",
      "https://placehold.co/400x400/png?text=Vantage+3",
      "https://placehold.co/400x400/png?text=Vantage+4",
      "https://placehold.co/400x400/png?text=Vantage+5"
    ],
    longitude: -119.9042,
    latitude: 46.9476,
    views: 203,
    dateposted: "2024-01-21T11:15:00Z",
  },
  {
    id: 8,
    user_id: 8,
    caption: "Mount Baker - Easton Glacier route",
    image_urls: [
      "https://placehold.co/400x400/png?text=Baker+1",
      "https://placehold.co/400x400/png?text=Baker+2"
    ],
    longitude: -121.8144,
    latitude: 48.7768,
    views: 91,
    dateposted: "2024-01-22T13:45:00Z",
  },
  {
    id: 9,
    user_id: 9,
    caption: "Exit 38 - I-90 corridor bouldering",
    image_urls: [
      "https://placehold.co/400x400/png?text=Exit38+1",
      "https://placehold.co/400x400/png?text=Exit38+2",
      "https://placehold.co/400x400/png?text=Exit38+3"
    ],
    longitude: -121.7897,
    latitude: 47.4256,
    views: 67,
    dateposted: "2024-01-23T15:20:00Z",
  },
  {
    id: 10,
    user_id: 10,
    caption: "North Cascades - Forbidden Peak approach",
    image_urls: [
      "https://placehold.co/400x400/png?text=Cascades+1",
      "https://placehold.co/400x400/png?text=Cascades+2"
    ],
    longitude: -121.0573,
    latitude: 48.5154,
    views: 45,
    dateposted: "2024-01-24T10:00:00Z",
  }
];

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function Home() {
  const [allObservations, setAllObservations] = useState<Observation[]>(MOCK_OBSERVATIONS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();

  const fetchObservations = () => {
    fetch(`${API_BASE_URL}/observations/`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }
        return response.json();
      })
      .then(data => {
        // Map backend's created_at to dateposted
        const mappedData = data.map((obs: any) => ({
          ...obs,
          dateposted: obs.created_at || obs.dateposted || new Date().toISOString()
        }));
        setAllObservations(mappedData);
        setLoading(false);
        setError(null); // Clear any previous errors
      })
      .catch(err => {
        // Check if it's a network/connection error (backend not running)
        const isNetworkError = err instanceof TypeError && err.message === 'Failed to fetch';
        
        if (isNetworkError) {
          // Backend is likely not running - this is expected in development
          setError('Backend server not available - using mock data');
          // Only log in development mode, not as an error
          if (process.env.NODE_ENV === 'development') {
            console.info('Backend server not available at', API_BASE_URL, '- using mock data');
          }
        } else {
          // Other errors (API errors, parsing errors, etc.)
          console.error('Error fetching observations:', err);
          setError(`Failed to fetch observations: ${err.message}`);
        }
        
        // Use mock data as fallback
        setAllObservations(MOCK_OBSERVATIONS);
        setLoading(false);
      });
  };

  // Fetch all observations from API (we'll filter by viewport in the map component)
  useEffect(() => {
    fetchObservations();
  }, []);

  // Handle viewport changes from map (optional, for future use)
  const handleViewportChange = (bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number; zoom: number }) => {
    // The map component handles filtering internally
    // This callback is available for future use (e.g., fetching from API with bounds)
  };

  const currentUserId = user?.id;

  if (loading) {
    return (
      <main className="h-screen w-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>Loading observations...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen w-screen relative">
      {/* Header with auth and create button */}
      <div className="absolute top-4 right-4 z-20 flex gap-2 items-center">
        {isAuthenticated ? (
          <>
            <span className="text-sm text-gray-700 bg-white px-3 py-1 rounded shadow">
              {user?.username}
            </span>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700"
            >
              Create Observation
            </button>
            <button
              onClick={logout}
              className="bg-gray-600 text-white px-4 py-2 rounded shadow hover:bg-gray-700"
            >
              Logout
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700"
          >
            Login
          </Link>
        )}
      </div>

      {error && (
        <div className="absolute top-4 left-4 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded z-10">
          <p className="text-sm">Using mock data: {error}</p>
        </div>
      )}

      {/* Create Observation Form Modal */}
      {showCreateForm && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-30 p-4">
          <div className="relative max-h-[90vh] overflow-y-auto">
            <CreateObservationForm
              onSuccess={() => {
                setShowCreateForm(false);
                fetchObservations();
              }}
              onCancel={() => setShowCreateForm(false)}
            />
          </div>
        </div>
      )}

      <ClimbingMap 
        observations={allObservations} 
        currentUserId={currentUserId}
        apiBaseUrl={API_BASE_URL}
        onViewportChange={handleViewportChange}
      />
    </main>
  );
}