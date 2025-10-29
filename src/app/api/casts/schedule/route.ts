import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '~/lib/supabase';
import { getSession } from '~/auth';

interface ScheduleCastBody {
  content?: string;
  scheduled_time?: string;
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

    const { content, scheduled_time }: ScheduleCastBody = await req.json();

    if (!content || !scheduled_time) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      );
    }

    if (content.length > 320) {
      return NextResponse.json(
        { error: 'Cast content too long (max 320 characters)' },
        { status: 400 },
      );
    }

    const scheduledDate = new Date(scheduled_time);
    if (Number.isNaN(scheduledDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid scheduled_time' },
        { status: 400 },
      );
    }

    if (scheduledDate <= new Date()) {
      return NextResponse.json(
        { error: 'Scheduled time must be in the future' },
        { status: 400 },
      );
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('fid', fid)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.signer_uuid) {
      return NextResponse.json(
        { error: 'No signer found. Please connect your account.' },
        { status: 403 },
      );
    }

    if (
      user.plan === 'free' &&
      typeof user.casts_used === 'number' &&
      typeof user.max_free_casts === 'number' &&
      user.casts_used >= user.max_free_casts
    ) {
      return NextResponse.json(
        {
          error: 'Free limit reached',
          message: 'Upgrade to unlimited for unlimited scheduled casts!',
          requiresUpgrade: true,
        },
        { status: 403 },
      );
    }

    const { data: scheduledCast, error: scheduleError } = await supabase
      .from('scheduled_casts')
      .insert({
        fid,
        content,
        scheduled_time,
        status: 'pending',
      })
      .select()
      .single();

    if (scheduleError) {
      throw scheduleError;
    }

    return NextResponse.json({
      success: true,
      cast: scheduledCast,
    });
  } catch (error) {
    console.error('Schedule cast error:', error);
    return NextResponse.json(
      { error: 'Failed to schedule cast' },
      { status: 500 },
    );
  }
}
