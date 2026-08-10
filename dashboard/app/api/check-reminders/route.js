import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import webpush, { initializeVapid, isVapidConfigured } from "@/lib/webpush";


export async function GET(){

// Check if push notifications are configured
if (!isVapidConfigured()) {
  console.warn("[check-reminders] Push notifications not configured - VAPID env vars missing");
  return NextResponse.json(
    { error: "Push notifications not configured" },
    { status: 503 }
  );
}

// Initialize VAPID (safe to call multiple times)
try {
  initializeVapid();
} catch (error) {
  console.error("[check-reminders] VAPID initialization failed:", error);
  return NextResponse.json(
    { error: "Push notifications not configured" },
    { status: 503 }
  );
}

const reminders =
await prisma.reminder.findMany({
where:{
sent:false,
remindAt:{
lte:new Date()
}
},
include:{
task:true
}
});


for(const reminder of reminders){

const subscriptions =
await prisma.pushSubscription.findMany();


for(const sub of subscriptions){

await webpush.sendNotification(
{
endpoint:sub.endpoint,
keys:{
p256dh:sub.p256dh,
auth:sub.auth
}
},
JSON.stringify({
title:"Calendar Reminder",
body:
reminder.task.title
})
);

}


await prisma.reminder.update({
where:{
id:reminder.id
},
data:{
sent:true
}
});

}


return NextResponse.json({
sent:reminders.length
});

}