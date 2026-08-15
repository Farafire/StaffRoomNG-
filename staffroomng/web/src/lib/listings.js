import {
  collection,
  addDoc,
  doc,
  setDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

/**
 * Public listing fields live in /listings/{id}.
 * Sensitive contact info lives separately in /listings/{id}/private/contact,
 * which Firestore rules make unreadable from the client — only a Cloud
 * Function (via the Admin SDK) can read it, after confirming a paid unlock.
 */
export async function createListing({ ownerId, contact, ...publicFields }) {
  const ref = await addDoc(collection(db, "listings"), {
    ...publicFields,
    ownerId,
    createdAt: serverTimestamp(),
  });
  await setDoc(doc(db, "listings", ref.id, "private", "contact"), contact);
  return ref.id;
}

// Live-subscribes to all listings, newest first. Filtering by level/kind/
// keyword happens client-side for simplicity here; for a larger catalogue,
// move kind/level filters into the Firestore query itself (see
// firestore.indexes.json for the composite indexes already prepared).
export function subscribeListings(callback) {
  const q = query(collection(db, "listings"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    const listings = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(listings);
  });
}
