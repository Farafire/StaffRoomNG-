import {
  collection,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import { authedFetch } from "./api";

// Listing creation now goes through the Render server (Admin SDK), which
// has a reliable connection to Firestore even when the browser's direct
// connection is unreliable on some networks/devices. Reads still use the
// client SDK directly below, since those have been working fine.
export async function createListing({ ownerId, ...fields }) {
  const data = await authedFetch("/create-listing", fields);
  return data.id;
}

// Live-subscribes to all listings, newest first.
export function subscribeListings(callback) {
  const q = query(collection(db, "listings"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    const listings = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(listings);
  });
}
