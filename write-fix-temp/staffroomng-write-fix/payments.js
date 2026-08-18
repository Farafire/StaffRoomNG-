import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { authedFetch } from "./api";

// Kicks off a Paystack transaction for unlocking a listing's contact info,
// then redirects the browser to Paystack's hosted checkout page. The actual
// unlock is granted asynchronously by the server's /paystack-webhook route
// once Paystack confirms payment — the UI listens for the Firestore doc
// (see subscribeUnlock below) rather than trusting the redirect alone.
export async function startUnlockPayment(listingId, email) {
  const data = await authedFetch("/create-unlock-payment", { listingId, email });
  window.location.href = data.authorizationUrl;
}

// Fetches the actual contact details once a listing is confirmed unlocked.
export async function fetchUnlockedContact(listingId) {
  return authedFetch("/get-unlocked-contact", { listingId });
}

// Live-subscribes to whether a given (uid, listingId) pair has been
// unlocked.
export function subscribeUnlock(uid, listingId, callback) {
  const ref = doc(db, "unlocks", `${uid}_${listingId}`);
  return onSnapshot(ref, (snap) => callback(snap.exists()));
}
