import { auth } from "../firebase";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

// Sends an authenticated POST request to your Render server, attaching the
// current user's Firebase ID token so the server can verify who's calling.
export async function authedFetch(path, body) {
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
