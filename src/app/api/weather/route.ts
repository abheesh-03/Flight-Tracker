import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');
    const airport = searchParams.get('airport');

    const apiKey = process.env.OPENWEATHER_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: 'OpenWeather API key not configured' }, { status: 500 });
    }

    try {
        let url = '';
        let params: any = {
            appid: apiKey,
            units: 'metric',
        };

        if (lat && lon) {
            url = 'https://api.openweathermap.org/data/2.5/weather';
            params.lat = lat;
            params.lon = lon;
            console.log(`Fetching weather for lat: ${lat}, lon: ${lon}`);
        } else if (airport) {
            // OpenWeather doesn't support airport code directly in free tier usually, 
            // but we can try q={city} if we had city. 
            // For now, let's assume the frontend sends lat/lon of the airport.
            return NextResponse.json({ error: 'Airport code search not implemented, use lat/lon' }, { status: 400 });
        } else {
            console.warn('Weather request missing coordinates');
            return NextResponse.json({ error: 'Missing coordinates' }, { status: 400 });
        }

        const response = await axios.get(url, { params });
        console.log('Weather API response status:', response.status);
        return NextResponse.json(response.data);
    } catch (error: any) {
        console.error('Weather API Error:', error.message);
        if (error.response) {
            console.error('Weather API Response:', error.response.data);
        }
        return NextResponse.json({ error: 'Failed to fetch weather' }, { status: 500 });
    }
}
