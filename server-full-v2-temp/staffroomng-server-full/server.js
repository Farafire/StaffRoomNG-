const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const fetch = require("node-fetch");
const admin = require("firebase-admin");

// ---------- Firebase Admin setup ----------
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
console.log("Initializing Firebase Admin for project:", serviceAccount.project_id);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});
const db = admin.firestore();

// One-time startup check: confirm we can actually reach Firestore before
// accepting any requests. This prints a clear pass/fail line in the logs
// immediately on boot, instead of waiting for a user to trigger an error.
db.collection("__healthcheck__").limit(1).get()
  .then(() => console.log("Firestore healthcheck: OK — connected to project", serviceAccount.project_id))
  .catch((err) => console.error("Firestore healthcheck FAILED:", err.code, err.message, err.details || ""));

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const UNLOCK_FEE_KOBO = 150000; // ₦1,500.00

const app = express();
app.use(cors());

// ---------- Auth helper ----------
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing auth token." });
  try {
    req.uid = (await admin.auth().verifyIdToken(token)).uid;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}

// ---------- 1. Create a listing ----------
app.post("/create-listing", express.json(), requireAuth, async (req, res) => {
  try {
    const { contact, ...publicFields } = req.body || {};
    if (!publicFields.title || !contact || !contact.name || !contact.phone) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    const listingRef = db.collection("listings").doc();
    await listingRef.set({
      ...publicFields,
      ownerId: req.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await listingRef.collection("private").doc("contact").set(contact);

    res.json({ id: listingRef.id });
  } catch (err) {
    console.error("create-listing error:", err);
    res.status(500).json({ error: "Server error." });
  }
});

// ---------- 2. Start a Paystack payment ----------
app.post("/create-unlock-payment", express.json(), requireAuth, async (req, res) => {
  try {
    const { listingId, email } = req.body || {};
    if (!listingId) return res.status(400).json({ error: "listingId is required." });

    const listingSnap = await db.collection("listings").doc(listingId).get();
    if (!listingSnap.exists) return res.status(404).json({ error: "Listing not found." });
    if (listingSnap.data().ownerId === req.uid) {
      return res.status(400).json({ error: "You can't pay to unlock your own listing." });
    }

    const unlockId = `${req.uid}_${listingId}`;
    const existing = await db.collection("unlocks").doc(unlockId).get();
    if (existing.exists) return res.status(400).json({ error: "Already unlocked." });

    const reference = `unlock_${unlockId}_${Date.now()}`;

    const resp = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email || `${req.uid}@staffroomng.user`,
        amount: UNLOCK_FEE_KOBO,
        reference,
        metadata: { uid: req.uid, listingId, purpose: "contact_unlock" },
      }),
    });
    const data = await resp.json();
    if (!data.status) return res.status(500).json({ error: data.message || "Paystack init failed." });

    await db.collection("payments").doc(reference).set({
      uid: req.uid,
      listingId,
      reference,
      status: "pending",
      amountKobo: UNLOCK_FEE_KOBO,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ authorizationUrl: data.data.authorization_url, reference });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error." });
  }
});

// ---------- 3. Paystack webhook ----------
app.post(
  "/paystack-webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const signature = req.headers["x-paystack-signature"];
      const expected = crypto
        .createHmac("sha512", PAYSTACK_SECRET_KEY)
        .update(req.body)
        .digest("hex");

      if (signature !== expected) {
        console.warn("Webhook: signature mismatch");
        return res.status(401).send("Invalid signature");
      }

      const event = JSON.parse(req.body.toString("utf8"));
      if (event.event !== "charge.success") return res.status(200).send("Ignored");

      const reference = event.data.reference;
      const verifyResp = await fetch(
        `https://api.paystack.co/transaction/verify/${reference}`,
        { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
      );
      const verifyData = await verifyResp.json();
      if (!verifyData.status || verifyData.data.status !== "success") {
        return res.status(200).send("Not verified");
      }

      const { uid, listingId, purpose } = verifyData.data.metadata || {};
      if (purpose !== "contact_unlock" || !uid || !listingId) {
        return res.status(200).send("Not an unlock payment");
      }

      const unlockId = `${uid}_${listingId}`;
      await db.runTransaction(async (tx) => {
        const unlockRef = db.collection("unlocks").doc(unlockId);
        const unlockSnap = await tx.get(unlockRef);
        if (unlockSnap.exists) return;
        tx.set(unlockRef, {
          uid,
          listingId,
          reference,
          amountKobo: verifyData.data.amount,
          unlockedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        tx.set(db.collection("payments").doc(reference), { status: "success" }, { merge: true });
      });

      res.status(200).send("OK");
    } catch (err) {
      console.error("Webhook error:", err);
      res.status(500).send("Server error");
    }
  }
);

// ---------- 4. Fetch contact details after a confirmed unlock ----------
app.post("/get-unlocked-contact", express.json(), requireAuth, async (req, res) => {
  try {
    const { listingId } = req.body || {};
    if (!listingId) return res.status(400).json({ error: "listingId is required." });

    const unlockId = `${req.uid}_${listingId}`;
    const unlockSnap = await db.collection("unlocks").doc(unlockId).get();
    if (!unlockSnap.exists) return res.status(403).json({ error: "Not unlocked yet." });

    const contactSnap = await db
      .collection("listings").doc(listingId)
      .collection("private").doc("contact")
      .get();
    if (!contactSnap.exists) return res.status(404).json({ error: "Contact missing." });

    res.json(contactSnap.data());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error." });
  }
});

app.get("/", (_req, res) => res.send("StaffRoomNG payment server is running."));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
