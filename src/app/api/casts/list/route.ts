import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '~/lib/supabase';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fidParam = searchParams.get('fid');

  if (!fidParam) {
    return NextResponse.json({ error: 'Missing fid' }, { status: 400 });
  }

  const fid = Number.parseInt(fidParam, 10);
  if (Number.isNaN(fid)) {
    return NextResponse.json({ error: 'Invalid fid' }, { status: 400 });
  }

  try {
    const { data: casts, error } = await supabase
      .from('scheduled_casts')
      .select('*')
      .eq('fid', fid)
      .in('status', ['pending', 'sent', 'failed'])
      .order('scheduled_time', { ascending: true })
      .limit(50);

    if (error) {
      throw error;
    }

    return NextResponse.json({ casts });
  } catch (error) {
    console.error('List casts error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch casts' },
      { status: 500 },
    );
  }
}
