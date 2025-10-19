import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '~/lib/supabase';

interface CancelCastBody {
  cast_id?: string;
  fid?: number;
}

export async function POST(req: NextRequest) {
  try {
    const { cast_id, fid }: CancelCastBody = await req.json();

    if (!cast_id || !fid) {
      return NextResponse.json(
        { error: 'Missing cast_id or fid' },
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
