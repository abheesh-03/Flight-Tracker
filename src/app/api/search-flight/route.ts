import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const flightNumber = searchParams.get('flight_number');

  if (!flightNumber) {
    return NextResponse.json({ error: 'Flight number is required' }, { status: 400 });
  }

  console.log('Search request for:', flightNumber);
  const apiKey = process.env.AVIATION_STACK_KEY;
  console.log('API Key present:', !!apiKey);

  if (!apiKey) {
    console.error('API Key missing');
    return NextResponse.json({ error: 'API key not configured' }, { status: 200 });
  }

  try {
    const url = 'http://api.aviationstack.com/v1/flights';
    console.log('Calling AviationStack:', url);
    const response = await axios.get(url, {
      params: {
        access_key: apiKey,
        flight_iata: flightNumber,
        limit: 1,
      },
    });

    console.log('AviationStack response status:', response.status);
    const data = response.data;
    console.log('AviationStack data:', JSON.stringify(data).substring(0, 200) + '...');

    if (!data.data || data.data.length === 0) {
      console.warn('No flight data found');
      return NextResponse.json({ error: 'Flight not found' }, { status: 200 });
    }

    const flightData = data.data[0];

    // Helper to fetch airport details from Aerodatabox
    const fetchAirportDetails = async (iata: string) => {
      if (!iata) return null;
      try {
        const aeroKey = process.env.AERODATABOX_KEY;
        const aeroHost = process.env.AERODATABOX_HOST;
        if (!aeroKey || !aeroHost) return null;

        console.log(`Fetching airport details for ${iata} from Aerodatabox...`);
        const res = await axios.get(`https://${aeroHost}/airports/iata/${iata}`, {
          headers: {
            'x-rapidapi-key': aeroKey,
            'x-rapidapi-host': aeroHost
          }
        });
        return res.data;
      } catch (err: any) {
        console.error(`Failed to fetch airport ${iata}:`, err.message);
        return null;
      }
    };

    // Fetch details for departure and arrival in parallel
    const [depDetails, arrDetails] = await Promise.all([
      fetchAirportDetails(flightData.departure?.iata),
      fetchAirportDetails(flightData.arrival?.iata)
    ]);

    // Merge coordinates if available
    if (depDetails && depDetails.location) {
      console.log(`Updated Departure ${flightData.departure.iata} coords: ${depDetails.location.lat}, ${depDetails.location.lon}`);
      flightData.departure.latitude = depDetails.location.lat;
      flightData.departure.longitude = depDetails.location.lon;
      // Also add timezone if needed
      if (depDetails.timeZone) flightData.departure.timezone = depDetails.timeZone;
    }

    if (arrDetails && arrDetails.location) {
      console.log(`Updated Arrival ${flightData.arrival.iata} coords: ${arrDetails.location.lat}, ${arrDetails.location.lon}`);
      flightData.arrival.latitude = arrDetails.location.lat;
      flightData.arrival.longitude = arrDetails.location.lon;
      if (arrDetails.timeZone) flightData.arrival.timezone = arrDetails.timeZone;
    }

    return NextResponse.json(flightData);
  } catch (error: any) {
    console.error('Error fetching flight data:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    return NextResponse.json({
      error: 'Failed to fetch flight data',
      details: error.message,
      apiError: error.response?.data
    }, { status: 200 });
  }
}
