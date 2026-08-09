#!/bin/bash
while true; do
  echo "Triggering local reminder cron..."
  curl -X GET http://localhost:3000/api/check-reminders -H "Authorization: Bearer local_development_secret_123"
  echo -e "\nSleeping for 60 seconds...\n"
  sleep 60
done

