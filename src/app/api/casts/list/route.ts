import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '~/lib/supabase';
import { getSession } from '~/auth';

export async function GET(_req: NextRequest) {
  try {
    // Authentication check - verify user session
    const session = await getSession();
    if (!session || !session.user?.fid) {
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in' },
        { status: 401 },
      );
    }

    // Use authenticated FID from session (ignore any fid query parameter)
    const fid = session.user.fid;

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
