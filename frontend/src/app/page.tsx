"use client"; // Required for client-side state/loading

import dynamic from 'next/dynamic';

// 1. Import the map dynamically with SSR disabled
const ClimbingMap = dynamic(() => import('@/app/map'), { 
  ssr: false,
  loading: () => <div className="h-screen w-full bg-gray-200 animate-pulse flex items-center justify-center">Loading Map Engine...</div>
});

// 2. Mock Data so the component doesn't break
const MOCK_OBSERVATIONS = [
  {
    id: 1,
    caption: "Classic Highball in Bishop",
    image_url: "https://placehold.co/400x400/png?text=Climbing+Photo",
    longitude: -118.5794,
    latitude: 37.3614,
  },
  {
    id: 2,
    caption: "Perfect day at the Gunks",
    image_url: "https://placehold.co/400x400/png?text=Crag+View",
    longitude: -74.1956,
    latitude: 41.7486,
  }
];

export default function Home() {
  return (
    <main className="h-screen w-screen">
      {/* 3. Pass the mock data into your component */}
      <ClimbingMap observations={MOCK_OBSERVATIONS} />
    </main>
  );
}