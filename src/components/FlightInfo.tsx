import React, { useState } from 'react';
import {
    LineChart, Line, ResponsiveContainer, YAxis
} from 'recharts';
import {
    Plane,
    MapPin,
    Clock,
    Calendar,
    Wind,
    Thermometer,
    TrendingUp,
    Navigation,
    AlertTriangle,
    CheckCircle,
    Building,
    DoorOpen,
    Globe,
    Share2,
    Car
} from 'lucide-react';

interface FlightInfoProps {
    flightData: any;
    locationData: any;
    loading: boolean;
    weather: { departure?: any; arrival?: any };
    aircraftImage: string | null;
    altitudeHistory: { time: string; alt: number }[];
    eta: string;
    distanceRemaining: number;
    totalDistance: number;
    distanceTravelled: number;
    speed: number;
}

const AirlineLogo = ({ iata, name }: { iata?: string, name?: string }) => {
    const [error, setError] = useState(false);

    React.useEffect(() => { setError(false); }, [iata]);

    if (error || !iata) {
        return (
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold border border-white/30 text-white backdrop-blur-sm">
                {iata || name?.[0] || '?'}
            </div>
        );
    }

    return (
        <img
            src={`https://pics.avs.io/200/200/${iata}.png`}
            alt={name || 'Airline'}
            className="w-6 h-6 rounded-full bg-white object-contain p-0.5 shadow-sm"
            onError={() => setError(true)}
        />
    );
};

export default function FlightInfo({
    flightData,
    locationData,
    loading,
    weather,
    aircraftImage,
    altitudeHistory,
    eta,
    distanceRemaining,
    totalDistance,
    distanceTravelled,
    speed
}: FlightInfoProps) {

    if (loading) {
        return (
            <div className="bg-white rounded-2xl shadow-xl p-8 h-full flex flex-col items-center justify-center space-y-4 animate-pulse">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                    <Plane className="w-8 h-8 text-blue-500 animate-bounce" />
                </div>
                <div className="text-gray-400 font-medium">Searching for flight...</div>
            </div>
        );
    }

    if (!flightData) {
        return (
            <div className="bg-white rounded-2xl shadow-xl p-8 h-full flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                    <Navigation className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-700">Ready to Track</h3>
                <p className="text-gray-500 max-w-xs">Enter a flight number above to see live details, weather, and more.</p>
            </div>
        );
    }

    const { airline, flight, departure, arrival, aircraft, live } = flightData;
    const currentAltitude = locationData?.altitude || live?.altitude || 0;
    const currentSpeed = speed || 0;

    // --- Helper Functions ---

    // Format Time (HH:MM)
    const formatTime = (dateString: string) => {
        if (!dateString) return '--:--';
        return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // Format Local ETA
    const formatLocalTime = (dateString: string, timeZone: string) => {
        if (!dateString || !timeZone) return '--:--';
        try {
            return new Date(dateString).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: timeZone
            });
        } catch (e) {
            return formatTime(dateString);
        }
    };

    // Calculate Delay Status
    const getDelayStatus = () => {
        if (!arrival?.scheduled || !arrival?.estimated) return { text: 'On Time', color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle };

        const scheduled = new Date(arrival.scheduled).getTime();
        const estimated = new Date(arrival.estimated).getTime();
        const diffMinutes = (estimated - scheduled) / (1000 * 60);

        if (diffMinutes > 5) {
            return { text: `Delayed +${Math.round(diffMinutes)}m`, color: 'text-amber-600', bg: 'bg-amber-100', icon: AlertTriangle };
        } else if (diffMinutes < -5) {
            return { text: `Early ${Math.round(Math.abs(diffMinutes))}m`, color: 'text-emerald-600', bg: 'bg-emerald-100', icon: CheckCircle };
        }
        return { text: 'On Time', color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle };
    };

    const delayStatus = getDelayStatus();

    // Progress Calculation
    const progress = totalDistance > 0 ? Math.min(100, Math.max(0, (distanceTravelled / totalDistance) * 100)) : 0;

    // Arrival Countdown Logic
    const getCountdown = () => {
        if (distanceRemaining < 20 && distanceRemaining > 0) return "On Final Approach";
        if (currentSpeed < 1 && progress > 90) return "Landed";
        if (currentSpeed < 150 && progress > 90) return "Taxiing";
        if (!eta || eta === '--:--') return "--";

        if (currentSpeed > 0) {
            const speedKmph = currentSpeed * 3.6;
            if (speedKmph < 50) return "--";

            const totalHours = distanceRemaining / speedKmph;
            const h = Math.floor(totalHours);
            const m = Math.round((totalHours - h) * 60);
            return `${h}h ${m}m`;
        }
        return "--";
    };

    const timeRemaining = getCountdown();

    // Share functionality
    const [showToast, setShowToast] = useState(false);

    const handleShare = async () => {
        const flightNumber = flight?.iata || 'Unknown';
        const departureCode = departure?.iata || 'Unknown';
        const arrivalCode = arrival?.iata || 'Unknown';
        const arrivalTime = arrival?.estimated || arrival?.scheduled || 'Unknown';

        const shareText = `Track ${flightNumber}: ${departureCode} → ${arrivalCode}, arriving at ${arrivalTime}`;
        const shareData = {
            title: `Flight ${flightNumber}`,
            text: shareText,
            url: window.location.href
        };

        // Try Web Share API first
        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                // User cancelled or error occurred
                console.log('Share cancelled or failed');
            }
        } else {
            // Fallback to clipboard
            try {
                await navigator.clipboard.writeText(`${shareText}\n${window.location.href}`);
                setShowToast(true);
                setTimeout(() => setShowToast(false), 3000);
            } catch (err) {
                console.error('Failed to copy to clipboard', err);
            }
        }
    };

    // Boarding Status calculation
    const getBoardingStatus = () => {
        if (!departure?.scheduled) {
            return { text: 'Unknown', bg: 'bg-gray-100', color: 'text-gray-600' };
        }

        const departureTime = new Date(departure.scheduled);
        const now = new Date();
        const minutesUntilDeparture = Math.floor((departureTime.getTime() - now.getTime()) / (1000 * 60));

        if (minutesUntilDeparture > 45) {
            return { text: 'Not Boarding Yet', bg: 'bg-gray-100', color: 'text-gray-600' };
        } else if (minutesUntilDeparture > 25) {
            return { text: 'Boarding Soon', bg: 'bg-blue-100', color: 'text-blue-700' };
        } else if (minutesUntilDeparture > 10) {
            return { text: 'Boarding Now', bg: 'bg-green-100', color: 'text-green-700' };
        } else if (minutesUntilDeparture > 0) {
            return { text: 'Final Call', bg: 'bg-orange-100', color: 'text-orange-700' };
        } else {
            return { text: 'Departed', bg: 'bg-red-100', color: 'text-red-700' };
        }
    };

    const boardingStatus = getBoardingStatus();

    // Leave Time Helper
    const getLeaveTime = () => {
        if (!departure?.scheduled) return null;

        const departureTime = new Date(departure.scheduled);
        const now = new Date();

        // If flight departed, show specific message
        if (now > departureTime) {
            return { time: null, status: 'departed' };
        }

        // Subtract 90 minutes buffer
        const leaveTime = new Date(departureTime.getTime() - 90 * 60000);

        return {
            time: leaveTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            status: 'future'
        };
    };

    const leaveInfo = getLeaveTime();


    return (
        <div className="bg-white rounded-2xl shadow-xl h-full overflow-y-auto scrollbar-hide border border-gray-100">
            {/* Header Image / Watermark */}
            <div className="relative h-48 w-full bg-slate-900 overflow-hidden">
                {/* Watermark Logo */}
                {airline?.iata ? (
                    <>
                        <img
                            src={`https://pics.avs.io/200/200/${airline.iata}.png`}
                            alt=""
                            className="absolute -right-12 -bottom-12 w-64 h-64 object-contain opacity-[0.15] rotate-12 grayscale contrast-125"
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                document.getElementById('fallback-plane')?.classList.remove('hidden');
                            }}
                        />
                        {/* Fallback Plane (Hidden by default, shown on error) */}
                        <div id="fallback-plane" className="hidden absolute inset-0 flex items-center justify-center opacity-10">
                            <Plane className="w-32 h-32 text-white" />
                        </div>
                    </>
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center opacity-10">
                        <Plane className="w-32 h-32 text-white" />
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                <div className="absolute bottom-4 left-6 text-white">
                    <div className="text-sm font-bold opacity-80 tracking-wider uppercase text-blue-100 mb-1">{airline?.name}</div>
                    <div className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        {flight?.iata}
                        <span className={`text-xs px-2 py-1 rounded-full font-bold uppercase tracking-wider ${delayStatus.bg} ${delayStatus.color} border border-white/20`}>
                            {delayStatus.text}
                        </span>
                    </div>
                    {/* Aircraft Type */}
                    {/* Aircraft Type - Only show if known */}
                    {(aircraft?.iata || aircraft?.icao || aircraft?.registration) && (
                        <div className="text-sm mt-1 opacity-80 flex items-center gap-1">
                            <Plane className="w-3 h-3" />
                            {aircraft?.iata || aircraft?.icao || aircraft?.registration}
                            {aircraft?.icao24 ? ` • ${aircraft.icao24.toUpperCase()}` : ''}
                        </div>
                    )}
                </div>
            </div>

            {/* Share Flight Button */}
            <div className="px-6 pt-4 pb-2">
                <button
                    onClick={handleShare}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium text-sm shadow-md hover:shadow-lg transition-all duration-200"
                >
                    <Share2 className="w-4 h-4" />
                    Share Flight
                </button>
            </div>

            {/* Toast Notification */}
            {showToast && (
                <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-xl flex items-center gap-2 animate-fade-in">
                    <CheckCircle className="w-5 h-5" />
                    Flight details copied!
                </div>
            )}

            <div className="p-6 space-y-8">
                {/* Route & Times */}
                <div className="flex justify-between items-start relative">
                    {/* Connecting Line */}
                    <div className="absolute top-3 left-4 right-4 h-0.5 bg-gray-100 -z-10" />

                    {/* Departure */}
                    <div className="text-center bg-white px-2">
                        <div className="text-3xl font-black text-slate-800">{departure?.iata}</div>
                        <div className="text-xs text-gray-500 font-medium uppercase tracking-wider mt-1">Departure</div>
                        <div className="text-lg font-bold text-blue-600 mt-1">{formatLocalTime(departure?.actual || departure?.scheduled, departure?.timezone)}</div>

                        {/* Terminal/Gate */}
                        <div className="mt-2 text-xs text-gray-600 space-y-0.5">
                            <div className="flex items-center justify-center gap-1">
                                <Building className="w-3 h-3" /> Terminal: {departure?.terminal || '—'}
                            </div>
                            <div className="flex items-center justify-center gap-1">
                                <DoorOpen className="w-3 h-3" /> Gate: {departure?.gate || '—'}
                            </div>
                        </div>
                    </div>

                    {/* Flight Duration / Icon */}
                    <div className="flex flex-col items-center bg-white px-2 mt-1">
                        <Plane className="w-5 h-5 text-blue-400 rotate-90 mb-1" />
                        <div className="text-xs font-bold text-gray-400">{timeRemaining !== '--' ? `${timeRemaining} left` : 'In Flight'}</div>
                    </div>

                    {/* Arrival */}
                    <div className="text-center bg-white px-2">
                        <div className="text-3xl font-black text-slate-800">{arrival?.iata}</div>
                        <div className="text-xs text-gray-500 font-medium uppercase tracking-wider mt-1">Arrival</div>
                        <div className="text-lg font-bold text-blue-600 mt-1">{formatLocalTime(arrival?.estimated || arrival?.scheduled, arrival?.timezone)}</div>
                        <div className="text-[10px] text-blue-400 font-medium mt-0.5 whitespace-nowrap">
                            ({arrival?.iata} local • {formatTime(arrival?.estimated || arrival?.scheduled)} your time)
                        </div>

                        {/* Terminal/Gate */}
                        <div className="mt-2 text-xs text-gray-600 space-y-0.5">
                            <div className="flex items-center justify-center gap-1">
                                <Building className="w-3 h-3" /> Terminal: {arrival?.terminal || '—'}
                            </div>
                            <div className="flex items-center justify-center gap-1">
                                <DoorOpen className="w-3 h-3" /> Gate: {arrival?.gate || '—'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Time Zone Explanation */}
                <div className="mt-2 text-[10px] text-center text-gray-400 border-t border-gray-100 pt-1">
                    Times shown in local time at each airport. Your local time: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
                </div>

                {/* Local ETA */}
                {arrival?.timezone && (
                    <div className="bg-blue-50 rounded-xl p-3 flex items-center justify-between border border-blue-100">
                        <div className="flex items-center gap-2 text-blue-800">
                            <Globe className="w-4 h-4" />
                            <span className="text-sm font-medium">Destination Time</span>
                        </div>
                        <div className="text-blue-900 font-bold text-sm">
                            Arriving: {formatLocalTime(arrival?.estimated || arrival?.scheduled, arrival?.timezone)}
                        </div>
                    </div>
                )}

                {/* Leave Time Helper */}
                {leaveInfo && (
                    <div className={`mt-3 flex items-center justify-center gap-2 text-xs py-2 px-3 rounded-lg border ${leaveInfo.status === 'departed' ? 'bg-orange-50 border-orange-100 text-orange-600' : 'bg-gray-50 border-gray-100 text-gray-500'}`}>
                        <Car className={`w-3.5 h-3.5 ${leaveInfo.status === 'departed' ? 'text-orange-500' : 'text-gray-400'}`} />
                        {leaveInfo.status === 'departed' ? (
                            <span>Flight already departed – leave time has passed</span>
                        ) : (
                            <span>Suggested leave time: <span className="font-semibold text-gray-700">{leaveInfo.time}</span> (arrive ~90 min before)</span>
                        )}
                    </div>
                )}

                {/* Boarding Status */}
                <div className="flex justify-center animate-fade-in">
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${boardingStatus.bg} ${boardingStatus.color} font-semibold text-sm shadow-sm`}>
                        {boardingStatus.text}
                    </div>
                </div>

                {/* Estimated Position Warning */}
                {(!aircraft?.icao24 && currentSpeed > 0) && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-amber-800">
                            <span className="font-semibold">Estimated Position</span> - Real-time tracking unavailable. Position is calculated based on scheduled times and may not reflect actual location.
                        </div>
                    </div>
                )}

                {/* Progress Bar */}
                <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium text-gray-500">
                        <span>{Math.round(distanceTravelled)} km flown</span>
                        <span>{Math.round(distanceRemaining)} km left</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                        <div
                            className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-1000 ease-out relative"
                            style={{ width: `${progress}%` }}
                        >
                            <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/30" />
                        </div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-400">
                        <span>{departure?.iata}</span>
                        <span>{Math.round(progress)}%</span>
                        <span>{arrival?.iata}</span>
                    </div>
                </div>

                {/* Telemetry Grid */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-2 text-slate-400 mb-1">
                            <TrendingUp className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase">Altitude</span>
                        </div>
                        <div className="text-xl font-bold text-slate-700">{Math.round(currentAltitude).toLocaleString()} <span className="text-sm font-normal text-slate-400">ft</span></div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-2 text-slate-400 mb-1">
                            <Wind className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase">Ground Speed</span>
                        </div>
                        <div className="text-xl font-bold text-slate-700">{Math.round(currentSpeed * 3.6)} <span className="text-sm font-normal text-slate-400">km/h</span></div>
                    </div>
                </div>

                {/* Altitude Chart */}
                {altitudeHistory.length > 1 && (
                    <div className="h-24 w-full">
                        <div className="text-xs font-bold text-gray-400 mb-2 uppercase">Altitude Profile</div>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={altitudeHistory}>
                                <YAxis domain={['auto', 'auto']} hide />
                                <Line
                                    type="monotone"
                                    dataKey="alt"
                                    stroke="#3b82f6"
                                    strokeWidth={2}
                                    dot={false}
                                    isAnimationActive={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Weather Widgets */}
                {(weather.departure || weather.arrival) && (
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                        {weather.departure && (
                            <div className="text-center">
                                <div className="text-xs text-gray-400 mb-1">DEP Weather</div>
                                <div className="flex items-center justify-center gap-1">
                                    <img
                                        src={`http://openweathermap.org/img/w/${weather.departure.weather[0].icon}.png`}
                                        alt="weather"
                                        className="w-8 h-8"
                                    />
                                    <span className="font-bold text-gray-700">{Math.round(weather.departure.main.temp)}°C</span>
                                </div>
                            </div>
                        )}
                        {weather.arrival && (
                            <div className="text-center border-l border-gray-100">
                                <div className="text-xs text-gray-400 mb-1">ARR Weather</div>
                                <div className="flex items-center justify-center gap-1">
                                    <img
                                        src={`http://openweathermap.org/img/w/${weather.arrival.weather[0].icon}.png`}
                                        alt="weather"
                                        className="w-8 h-8"
                                    />
                                    <span className="font-bold text-gray-700">{Math.round(weather.arrival.main.temp)}°C</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
