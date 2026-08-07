import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import webpush from "@/lib/webpush";


export async function GET(){

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