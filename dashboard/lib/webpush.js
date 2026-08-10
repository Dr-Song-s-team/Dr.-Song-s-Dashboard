import webpush from "web-push";

let vapidInitialized = false;

/**
 * Initialize VAPID details for web-push.
 * Safe to call multiple times - only initializes once.
 * @throws {Error} if VAPID environment variables are not configured
 */
export function initializeVapid() {
  if (vapidInitialized) return;

  const vapidEmail = process.env.VAPID_EMAIL;
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

  if (!vapidEmail || !vapidPublicKey || !vapidPrivateKey) {
    throw new Error(
      "Push notifications not configured: missing VAPID_EMAIL, NEXT_PUBLIC_VAPID_PUBLIC_KEY, or VAPID_PRIVATE_KEY environment variables"
    );
  }

  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
  vapidInitialized = true;
}

/**
 * Check if VAPID is configured (all required env vars present).
 * @returns {boolean} true if VAPID env vars are set
 */
export function isVapidConfigured() {
  return !!(
    process.env.VAPID_EMAIL &&
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY
  );
}

export default webpush;