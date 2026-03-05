import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { predictionId } = body;

    if (!predictionId) {
      return NextResponse.json({ error: 'Prediction ID is required' }, { status: 400 });
    }

    const apiKey = process.env.REPLICATE_API_TOKEN;
    if (!apiKey) {
      return NextResponse.json({ error: 'REPLICATE_API_TOKEN not configured' }, { status: 500 });
    }

    const replicate = new Replicate({ auth: apiKey });

    try {
      const prediction = await replicate.predictions.get(predictionId);
      
      return NextResponse.json({
        success: true,
        prediction: {
          id: prediction.id,
          status: prediction.status,
          output: prediction.output,
          error: prediction.error,
        }
      });
    } catch (error) {
      return NextResponse.json({ error: 'Failed to fetch prediction' }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 