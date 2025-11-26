import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const icao24 = searchParams.get('icao24');

    if (!icao24) {
        return NextResponse.json({ error: 'ICAO24 code is required' }, { status: 400 });
    }

    try {
        // OpenSky API for specific aircraft
        const response = await axios.get('https://opensky-network.org/api/states/all', {
            params: {
                icao24: icao24,
            },
        });

        const data = response.data;

        if (!data.states || data.states.length === 0) {
            return NextResponse.json({ error: 'Location not available' }, { status: 404 });
        }

        // OpenSky returns an array of arrays. We need to map it to a usable object.
        // Index 5: longitude, Index 6: latitude, Index 13: geo_altitude, Index 9: velocity
        const state = data.states[0];
        const location = {
            longitude: state[5],
            latitude: state[6],
            altitude: state[13],
            speed: state[9],
            heading: state[10],
            on_ground: state[8],
            last_update: state[4],
        };

        return NextResponse.json(location);
    } catch (error) {
        console.error('Error fetching location data:', error);
        return NextResponse.json({ error: 'Failed to fetch location data' }, { status: 500 });
    }
}
