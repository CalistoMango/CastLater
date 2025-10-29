import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '~/lib/supabase';
import { getSession } from '~/auth';

interface CancelCastBody {
  cast_id?: string;
}

export async function POST(req: NextRequest) {
  try {
    // Authentication check - verify user session
    const session = await getSession();
    if (!session || !session.user?.fid) {
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in' },
        { status: 401 },
      );
    }

    // Use authenticated FID from session (not from request body)
    const fid = session.user.fid;

    const { cast_id }: CancelCastBody = await req.json();

    if (!cast_id) {
      return NextResponse.json(
        { error: 'Missing cast_id' },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from('scheduled_casts')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', cast_id)
      .eq('fid', fid)
      .eq('status', 'pending')
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Cast not found or already processed' },
          { status: 404 },
        );
      }
      throw error;
    }

    return NextResponse.json({ success: true, cast: data });
  } catch (error) {
    console.error('Cancel cast error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel cast' },
      { status: 500 },
    );
  }
}
