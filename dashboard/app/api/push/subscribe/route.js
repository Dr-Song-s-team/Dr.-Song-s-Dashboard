import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function POST(req) {

  const subscription = await req.json();

  const saved =
    await prisma.pushSubscription.upsert({
      where: {
        endpoint: subscription.endpoint
      },
      update: {
        p256dh:
          subscription.keys.p256dh,
        auth:
          subscription.keys.auth,
      },
      create: {
        endpoint:
          subscription.endpoint,
        p256dh:
          subscription.keys.p256dh,
        auth:
          subscription.keys.auth,
      },
    });


  return NextResponse.json(saved);
}