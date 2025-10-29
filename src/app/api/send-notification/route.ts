import { notificationDetailsSchema } from "@farcaster/miniapp-sdk";
import { NextRequest } from "next/server";
import { z } from "zod";
import { setUserNotificationDetails } from "~/lib/kv";
import { sendMiniAppNotification } from "~/lib/notifs";
import { sendNeynarMiniAppNotification } from "~/lib/neynar";
import { env } from '~/lib/env.server';
import { getSession } from '~/auth';

const requestSchema = z.object({
  notificationDetails: notificationDetailsSchema,
});

export async function POST(request: NextRequest) {
  // Authentication check - verify user session
  const session = await getSession();
  if (!session || !session.user?.fid) {
    return Response.json(
      { success: false, error: 'Unauthorized - Please sign in' },
      { status: 401 }
    );
  }

  // Use authenticated FID from session (not from request body)
  const fid = session.user.fid;

  // If Neynar is enabled, we don't need to store notification details
  // as they will be managed by Neynar's system
  const neynarEnabled = Boolean(env.NEYNAR_API_KEY && env.NEYNAR_CLIENT_ID);

  const requestJson = await request.json();
  const requestBody = requestSchema.safeParse(requestJson);

  if (requestBody.success === false) {
    return Response.json(
      { success: false, errors: requestBody.error.errors },
      { status: 400 }
    );
  }

  // Only store notification details if not using Neynar
  if (!neynarEnabled) {
    await setUserNotificationDetails(
      fid,
      requestBody.data.notificationDetails
    );
  }

  // Use appropriate notification function based on Neynar status
  const sendNotification = neynarEnabled ? sendNeynarMiniAppNotification : sendMiniAppNotification;
  const sendResult = await sendNotification({
    fid,
    title: "Test notification",
    body: "Sent at " + new Date().toISOString(),
  });

  if (sendResult.state === "error") {
    return Response.json(
      { success: false, error: sendResult.error },
      { status: 500 }
    );
  } else if (sendResult.state === "rate_limit") {
    return Response.json(
      { success: false, error: "Rate limited" },
      { status: 429 }
    );
  }

  return Response.json({ success: true });
}
