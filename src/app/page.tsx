'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import dynamic from 'next/dynamic';
import FlightInfo from '@/components/FlightInfo';

// Dynamically import Map to avoid SSR issues with Leaflet
const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-gray-100 animate-pulse rounded-lg flex items-center justify-center">Loading Map...</div>
});

// Haversine formula to calculate distance
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

export default function Home() {
  const [flightNumber, setFlightNumber] = useState('');
  const [flightData, setFlightData] = useState<any>(null);
  const [locationData, setLocationData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [icao24, setIcao24] = useState<string | null>(null);

  // New State Variables
  const [trail, setTrail] = useState<[number, number][]>([]);
  const [altitudeHistory, setAltitudeHistory] = useState<{ time: string; alt: number }[]>([]);
  const [weather, setWeather] = useState<{ departure?: any; arrival?: any }>({});
  const [aircraftImage, setAircraftImage] = useState<string | null>(null);
  const [eta, setEta] = useState<string>('');
  const [distanceRemaining, setDistanceRemaining] = useState<number>(0);
  const [totalDistance, setTotalDistance] = useState<number>(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const pollTimer = useRef<NodeJS.Timeout | null>(null);

  // Load recent searches on mount
  useEffect(() => {
    const saved = localStorage.getItem('recentSearches');
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);

  const addToHistory = (flightNum: string) => {
    const upper = flightNum.toUpperCase();
    setRecentSearches(prev => {
      const filtered = prev.filter(f => f !== upper);
      const newHistory = [upper, ...filtered].slice(0, 5);
      localStorage.setItem('recentSearches', JSON.stringify(newHistory));
      return newHistory;
    });
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flightNumber.trim()) return;
    performSearch(flightNumber);
  };

  const performSearch = async (query: string) => {
    const code = query.toUpperCase();
    setFlightNumber(code); // Update input to match

    setLoading(true);
    setError('');
    setFlightData(null);
    setLocationData(null);
    setIcao24(null);
    setTrail([]);
    setAltitudeHistory([]);
    setWeather({});
    setAircraftImage(null);
    setEta('');
    setDistanceRemaining(0);
    setTotalDistance(0);

    if (pollTimer.current) clearInterval(pollTimer.current);

    try {
      console.log('Sending search request for:', code);
      const res = await axios.get(`/api/search-flight?flight_number=${code}`);
      console.log('Search response:', res.data);
      const data = res.data;

      if (data.error) {
        throw { response: { data: data } }; // Mimic axios error structure for catch block
      }

      setFlightData(data);
      addToHistory(code);

      // Fetch extra data
      fetchWeather(data.departure?.latitude, data.departure?.longitude, 'departure');
      fetchWeather(data.arrival?.latitude, data.arrival?.longitude, 'arrival');

      if (data.aircraft?.registration) {
        fetchAircraftImage(data.aircraft.registration);
      }

      // Calculate Total Distance if coords available
      if (data.departure?.latitude && data.arrival?.latitude) {
        const total = getDistanceFromLatLonInKm(
          parseFloat(data.departure.latitude), parseFloat(data.departure.longitude),
          parseFloat(data.arrival.latitude), parseFloat(data.arrival.longitude)
        );
        setTotalDistance(total);
      }

      // Try to get ICAO24 for tracking
      const hex = data.aircraft?.icao24;

      if (hex) {
        console.log('Found ICAO24:', hex);
        setIcao24(hex);
        fetchLocation(hex);
      } else {
        console.warn('No ICAO24 found in flight data');
        if (data.live) {
          console.log('Using live data from AviationStack');
          updateLocationState({
            latitude: data.live.latitude,
            longitude: data.live.longitude,
            altitude: data.live.altitude,
            speed: data.live.speed_horizontal,
            vertical_rate: data.live.speed_vertical,
          });
        } else if (data.departure?.scheduled && data.arrival?.scheduled && data.departure?.latitude && data.arrival?.latitude) {
          // Fallback: Calculate estimated position based on schedule
          console.log('Using estimated position based on schedule');
          console.warn('⚠️ ESTIMATED POSITION - Real-time tracking unavailable');

          const now = new Date().getTime();
          const depTime = new Date(data.departure.estimated || data.departure.scheduled).getTime();
          const arrTime = new Date(data.arrival.estimated || data.arrival.scheduled).getTime();

          // Check flight status to determine if it's still in flight
          const flightStatus = data.flight_status?.toLowerCase();
          const isActive = flightStatus === 'active' || flightStatus === 'en-route' || flightStatus === 'scheduled';
          const isLanded = flightStatus === 'landed' || flightStatus === 'arrived';

          if (now < depTime) {
            // Not departed yet
            updateLocationState({
              latitude: parseFloat(data.departure.latitude),
              longitude: parseFloat(data.departure.longitude),
              altitude: 0,
              speed: 0,
              heading: 0
            });
          } else if (isLanded || (now > arrTime && !isActive)) {
            // Only show as arrived if status confirms landing OR time passed and not active
            updateLocationState({
              latitude: parseFloat(data.arrival.latitude),
              longitude: parseFloat(data.arrival.longitude),
              altitude: 0,
              speed: 0,
              heading: 0
            });
          } else {
            // In flight - Interpolate position
            // If flight is active but past scheduled arrival, cap progress at 95%
            const totalDuration = arrTime - depTime;
            const elapsed = now - depTime;
            let progress = elapsed / totalDuration;

            // If status is active and we're past arrival time, cap at 95% to show still in flight
            if (isActive && progress > 0.95) {
              progress = 0.95;
              console.log('Flight still active - capping progress at 95%');
            }

            const lat1 = parseFloat(data.departure.latitude);
            const lon1 = parseFloat(data.departure.longitude);
            const lat2 = parseFloat(data.arrival.latitude);
            const lon2 = parseFloat(data.arrival.longitude);

            const curLat = lat1 + (lat2 - lat1) * progress;
            const curLon = lon1 + (lon2 - lon1) * progress;

            // Calculate bearing for heading
            const y = Math.sin(deg2rad(lon2 - lon1)) * Math.cos(deg2rad(lat2));
            const x = Math.cos(deg2rad(lat1)) * Math.sin(deg2rad(lat2)) -
              Math.sin(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.cos(deg2rad(lon2 - lon1));
            const bearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;

            updateLocationState({
              latitude: curLat,
              longitude: curLon,
              altitude: 35000, // Assume cruising altitude
              speed: 800, // Assume cruising speed
              heading: bearing
            });
          }
        } else {
          setError('Flight found, but aircraft identifier (ICAO24) tracking is unavailable.');
        }
      }

    } catch (err: any) {
      console.warn('Search error:', err);
      const data = err.response?.data;
      const msg =
        data?.apiError?.error?.message || // AviationStack specific error
        data?.apiError?.message || // Other APIs
        data?.details ||
        data?.error ||
        'Flight not found. Please check the flight number and try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const fetchWeather = async (lat: string, lon: string, type: 'departure' | 'arrival') => {
    console.log(`Attempting to fetch ${type} weather for lat: ${lat}, lon: ${lon}`);
    if (!lat || !lon) {
      console.warn(`Missing coordinates for ${type} weather`);
      return;
    }
    try {
      const res = await axios.get(`/api/weather?lat=${lat}&lon=${lon}`);
      console.log(`${type} weather fetched successfully`);
      setWeather(prev => ({ ...prev, [type]: res.data }));
    } catch (err) {
      console.error(`Error fetching ${type} weather:`, err);
    }
  };

  const fetchAircraftImage = async (registration: string) => {
    try {
      const res = await axios.get(`/api/aircraft-image?registration=${registration}`);
      if (res.data && res.data.url) {
        setAircraftImage(res.data.url);
      }
    } catch (err) {
      console.error('Error fetching aircraft image:', err);
    }
  };

  const fetchLocation = async (hex: string) => {
    try {
      const res = await axios.get(`/api/flight-location?icao24=${hex}`);
      updateLocationState(res.data);
    } catch (err: any) {
      if (err.response && err.response.status === 404) {
        console.warn('Location not found for this aircraft (it might be landed or out of coverage).');
      } else {
        console.warn('Error fetching location:', err.message);
      }
    }
  };

  const updateLocationState = (data: any) => {
    setLocationData(data);

    // Update Trail
    if (data.latitude && data.longitude) {
      setTrail(prev => [...prev, [data.latitude, data.longitude]]);
    }

    // Update Altitude History
    if (data.altitude) {
      setAltitudeHistory(prev => [...prev, {
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        alt: data.altitude
      }].slice(-20)); // Keep last 20 points
    }

    // Update ETA & Distance Remaining
    if (flightData?.arrival?.latitude && data.latitude && flightData?.departure?.latitude) {
      const currentLat = data.latitude;
      const currentLon = data.longitude;
      const destLat = parseFloat(flightData.arrival.latitude);
      const destLon = parseFloat(flightData.arrival.longitude);
      const originLat = parseFloat(flightData.departure.latitude);
      const originLon = parseFloat(flightData.departure.longitude);

      // 1. Total Route Distance (Origin -> Dest)
      const total = getDistanceFromLatLonInKm(originLat, originLon, destLat, destLon);
      setTotalDistance(total);

      // 2. Distance Travelled (Origin -> Current)
      const travelled = getDistanceFromLatLonInKm(originLat, originLon, currentLat, currentLon);

      // 3. Distance Remaining (Current -> Dest)
      const remaining = getDistanceFromLatLonInKm(currentLat, currentLon, destLat, destLon);
      setDistanceRemaining(remaining);

      // 4. ETA Calculation
      const speedKmph = (data.speed || 0) * 3.6;
      if (speedKmph > 50) {
        // Calculate seconds remaining
        const secondsRemaining = (remaining / speedKmph) * 3600;

        // Update ETA string
        const etaDate = new Date(Date.now() + secondsRemaining * 1000);
        setEta(etaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      } else {
        setEta('--:--');
      }
    }
  };

  // Polling effect
  useEffect(() => {
    if (icao24) {
      pollTimer.current = setInterval(() => {
        fetchLocation(icao24);
      }, 10000); // 10 seconds
    }

    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [icao24]);

  // Calculate route for map
  const route: [number, number][] = [];
  if (flightData?.departure?.latitude && flightData?.arrival?.latitude) {
    route.push([parseFloat(flightData.departure.latitude), parseFloat(flightData.departure.longitude)]);
    route.push([parseFloat(flightData.arrival.latitude), parseFloat(flightData.arrival.longitude)]);
  }

  const [estimatedSpeed, setEstimatedSpeed] = useState<number>(0);

  // Calculate estimated position if live data is missing
  const getEstimatedPosition = (): [number, number] | null => {
    if (!flightData || !flightData.departure?.latitude || !flightData.arrival?.latitude) return null;

    const depTime = flightData.departure.actual || flightData.departure.scheduled;
    const arrTime = flightData.arrival.estimated || flightData.arrival.scheduled;

    if (!depTime || !arrTime) return null;

    const start = new Date(depTime).getTime();
    const end = new Date(arrTime).getTime();
    const now = Date.now();

    if (now < start) return [parseFloat(flightData.departure.latitude), parseFloat(flightData.departure.longitude)]; // At gate
    if (now > end) return [parseFloat(flightData.arrival.latitude), parseFloat(flightData.arrival.longitude)]; // Arrived

    const percent = (now - start) / (end - start);

    const lat1 = parseFloat(flightData.departure.latitude);
    const lon1 = parseFloat(flightData.departure.longitude);
    const lat2 = parseFloat(flightData.arrival.latitude);
    const lon2 = parseFloat(flightData.arrival.longitude);

    // Simple linear interpolation (sufficient for visual estimation on world map)
    const lat = lat1 + (lat2 - lat1) * percent;
    const lon = lon1 + (lon2 - lon1) * percent;

    return [lat, lon];
  };

  // Effect to update metrics when using estimated position
  useEffect(() => {
    if (!locationData && flightData) {
      const estPos = getEstimatedPosition();
      if (estPos && flightData.arrival?.latitude) {
        const destLat = parseFloat(flightData.arrival.latitude);
        const destLon = parseFloat(flightData.arrival.longitude);
        const remaining = getDistanceFromLatLonInKm(estPos[0], estPos[1], destLat, destLon);
        setDistanceRemaining(remaining);

        // Calculate estimated speed based on schedule to make countdown work
        const arrTime = flightData.arrival.estimated || flightData.arrival.scheduled;
        if (arrTime) {
          const end = new Date(arrTime).getTime();
          const now = Date.now();
          const hoursLeft = (end - now) / (1000 * 60 * 60);

          if (hoursLeft > 0) {
            const speedKmph = remaining / hoursLeft;
            setEstimatedSpeed(speedKmph / 3.6); // Convert to m/s

            // Update ETA string for display
            setEta(new Date(arrTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
          } else {
            setEstimatedSpeed(0);
            setEta('--:--');
          }
        }
      }
    }
  }, [flightData, locationData]); // Re-run when flight data or location data changes

  // Continuous animation timer for estimated position
  useEffect(() => {
    let animationTimer: NodeJS.Timeout | null = null;

    // Only animate if using estimated position (no real-time data)
    if (flightData && !icao24 && !locationData) {
      const updateEstimatedPosition = () => {
        if (!flightData.departure?.scheduled || !flightData.arrival?.scheduled) return;
        if (!flightData.departure?.latitude || !flightData.arrival?.latitude) return;

        const now = new Date().getTime();
        const depTime = new Date(flightData.departure.estimated || flightData.departure.scheduled).getTime();
        const arrTime = new Date(flightData.arrival.estimated || flightData.arrival.scheduled).getTime();

        // Check flight status
        const flightStatus = flightData.flight_status?.toLowerCase();
        const isActive = flightStatus === 'active' || flightStatus === 'en-route' || flightStatus === 'scheduled';
        const isLanded = flightStatus === 'landed' || flightStatus === 'arrived';

        if (now < depTime) {
          // Not departed yet - stay at origin
          updateLocationState({
            latitude: parseFloat(flightData.departure.latitude),
            longitude: parseFloat(flightData.departure.longitude),
            altitude: 0,
            speed: 0,
            heading: 0
          });
        } else if (isLanded || (now > arrTime && !isActive)) {
          // Landed - stay at destination
          updateLocationState({
            latitude: parseFloat(flightData.arrival.latitude),
            longitude: parseFloat(flightData.arrival.longitude),
            altitude: 0,
            speed: 0,
            heading: 0
          });
        } else {
          // In flight - animate position
          const totalDuration = arrTime - depTime;
          const elapsed = now - depTime;
          let progress = elapsed / totalDuration;

          // Cap at 95% if still active
          if (isActive && progress > 0.95) {
            progress = 0.95;
          }

          const lat1 = parseFloat(flightData.departure.latitude);
          const lon1 = parseFloat(flightData.departure.longitude);
          const lat2 = parseFloat(flightData.arrival.latitude);
          const lon2 = parseFloat(flightData.arrival.longitude);

          const curLat = lat1 + (lat2 - lat1) * progress;
          const curLon = lon1 + (lon2 - lon1) * progress;

          // Calculate bearing
          const y = Math.sin(deg2rad(lon2 - lon1)) * Math.cos(deg2rad(lat2));
          const x = Math.cos(deg2rad(lat1)) * Math.sin(deg2rad(lat2)) -
            Math.sin(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.cos(deg2rad(lon2 - lon1));
          const bearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;

          updateLocationState({
            latitude: curLat,
            longitude: curLon,
            altitude: 35000,
            speed: 800,
            heading: bearing
          });
        }
      };

      // Update immediately
      updateEstimatedPosition();

      // Then update every 5 seconds to animate
      animationTimer = setInterval(updateEstimatedPosition, 5000);
    }

    return () => {
      if (animationTimer) clearInterval(animationTimer);
    };
  }, [flightData, icao24, locationData]); // Re-run when flight data changes

  const estimatedPos = !locationData ? getEstimatedPosition() : null;
  const position: [number, number] | null = locationData
    ? [locationData.latitude, locationData.longitude]
    : estimatedPos;

  // Calculate heading for estimated position
  const getBearing = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const dLon = deg2rad(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(deg2rad(lat2));
    const x = Math.cos(deg2rad(lat1)) * Math.sin(deg2rad(lat2)) -
      Math.sin(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.cos(dLon);
    const brng = Math.atan2(y, x);
    return (brng * 180 / Math.PI + 360) % 360;
  };

  const estimatedHeading = estimatedPos && flightData?.arrival?.latitude
    ? getBearing(estimatedPos[0], estimatedPos[1], parseFloat(flightData.arrival.latitude), parseFloat(flightData.arrival.longitude))
    : 0;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-slate-900 text-white p-4 shadow-md z-20">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold flex items-center gap-2 tracking-tight">
            ✈️ SkyTracker <span className="text-blue-400 text-sm font-normal uppercase tracking-widest border border-blue-400 rounded px-2 py-0.5">Pro</span>
          </h1>
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              placeholder="Flight No. (e.g. UA123)"
              className="px-4 py-2 rounded-l-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 flex-grow"
              value={flightNumber}
              onChange={(e) => setFlightNumber(e.target.value)}
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-r-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Searching...' : 'Track Flight'}
            </button>
          </form>

          {/* Recent Searches */}
          <div className="mt-3 flex items-center justify-center gap-2 text-sm text-gray-400">
            {recentSearches.length > 0 ? (
              <>
                <span className="font-medium text-gray-500">Recent:</span>
                <div className="flex gap-2">
                  {recentSearches.map(flight => (
                    <button
                      key={flight}
                      onClick={() => performSearch(flight)}
                      className="bg-slate-800 hover:bg-slate-700 text-blue-400 px-2 py-0.5 rounded text-xs font-mono transition-colors"
                    >
                      {flight}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <span className="opacity-60">Search for a flight to start your history</span>
            )}
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto px-4 py-6 flex flex-col lg:flex-row gap-6 h-[calc(100vh-80px)]">
        {/* Left Panel: Flight Info */}
        <div className="w-full lg:w-1/3 h-full">
          {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded shadow-sm" role="alert">
              <p>{error}</p>
            </div>
          )}
          <FlightInfo
            flightData={flightData}
            locationData={locationData}
            loading={loading}
            weather={weather}
            aircraftImage={aircraftImage}
            altitudeHistory={altitudeHistory}
            eta={eta}
            distanceRemaining={distanceRemaining}
            totalDistance={totalDistance}
            distanceTravelled={totalDistance - distanceRemaining}
            speed={locationData?.speed || 0}
          />
        </div>

        {/* Right Panel: Map */}
        <div className="w-full md:w-2/3" style={{ minHeight: '600px', height: '70vh' }}>
          <Map
            position={position}
            route={route}
            trail={trail}
            flightCode={flightData?.flight?.iata}
            heading={locationData?.heading || estimatedHeading}
            isEstimated={!!estimatedPos}
            departureCode={flightData?.departure?.iata}
            arrivalCode={flightData?.arrival?.iata}
            departureName={flightData?.departure?.airport}
            arrivalName={flightData?.arrival?.airport}
          />
          {!position && !loading && flightData && (
            <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-black/10 pointer-events-none backdrop-blur-[1px]">
              <span className="bg-white/90 px-6 py-3 rounded-full shadow-xl text-gray-700 font-medium border border-white/50">
                Waiting for live signal...
              </span>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
