import { doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebase";

const API_BASE = import.meta.env.VITE_API_BASE_URL; // e.g. https://staffroomng-server.onrender.com

async function authedFetch(path, body) {
  const idToken = await auth.currentUser.getIdToken();
  const resp = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || "Request failed.");
  return data;
}

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
// Throws if called before an unlocks/{uid}_{listingId} record exists.
export async function fetchUnlockedContact(listingId) {
  return authedFetch("/get-unlocked-contact", { listingId });
}

// Live-subscribes to whether a given (uid, listingId) pair has been
// unlocked. Firestore rules only allow a user to read their own unlock
// records, so this is safe to call directly from the client.
export function subscribeUnlock(uid, listingId, callback) {
  const ref = doc(db, "unlocks", `${uid}_${listingId}`);
  return onSnapshot(ref, (snap) => callback(snap.exists()));
}
