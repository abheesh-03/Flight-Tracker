import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const registration = searchParams.get('registration');

    if (!registration) {
        return NextResponse.json({ error: 'Registration number required' }, { status: 400 });
    }

    const apiKey = process.env.AERODATABOX_KEY;
    const apiHost = process.env.AERODATABOX_HOST;

    if (!apiKey || !apiHost) {
        return NextResponse.json({ error: 'Aerodatabox API keys not configured' }, { status: 500 });
    }

    try {
        const response = await axios.get(`https://${apiHost}/flights/callsign/${registration}`, {
            // Note: Aerodatabox endpoint for image might be different. 
            // Checking docs: usually it's /aircrafts/reg/{reg}/image/beta
            // Let's try the image endpoint directly.
            baseURL: `https://${apiHost}`,
            url: `/aircrafts/reg/${registration}/image/beta`,
            headers: {
                'x-rapidapi-key': apiKey,
                'x-rapidapi-host': apiHost,
            },
        });

        return NextResponse.json(response.data);
    } catch (error: any) {
        console.error('Aircraft Image API Error:', error.message);
        // If 404, just return null so frontend knows no image found
        if (error.response && error.response.status === 404) {
            return NextResponse.json(null);
        }
        return NextResponse.json({ error: 'Failed to fetch aircraft image' }, { status: 500 });
    }
}
