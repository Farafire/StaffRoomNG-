const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const crypto = require("crypto");
const fetch = require("node-fetch");

admin.initializeApp();
const db = admin.firestore();

const PAYSTACK_SECRET_KEY = defineSecret("PAYSTACK_SECRET_KEY");
const UNLOCK_FEE_KOBO = 150000; // ₦1,500.00 — Paystack amounts are in kobo

/**
 * Callable from the web app once a signed-in user taps
 * "Pay ₦1,500 to unlock". Creates a Paystack transaction and returns
 * the checkout URL the client should redirect to.
 *
 * We never let the client tell us which listing they "paid" for after
 * the fact — the listingId is embedded in Paystack's metadata here,
 * and the webhook (below) is the only thing that ever grants the unlock.
 */
exports.createUnlockPayment = onCall(
  { secrets: [PAYSTACK_SECRET_KEY] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }

    const { listingId, email } = request.data || {};
    if (!listingId || typeof listingId !== "string") {
      throw new HttpsError("invalid-argument", "listingId is required.");
    }

    const listingSnap = await db.collection("listings").doc(listingId).get();
    if (!listingSnap.exists) {
      throw new HttpsError("not-found", "That listing no longer exists.");
    }
    if (listingSnap.data().ownerId === uid) {
      throw new HttpsError(
        "failed-precondition",
        "You can't pay to unlock your own listing."
      );
    }

    // Already unlocked? Don't charge again.
    const unlockId = `${uid}_${listingId}`;
    const existing = await db.collection("unlocks").doc(unlockId).get();
    if (existing.exists) {
      throw new HttpsError("already-exists", "Already unlocked.");
    }

    const reference = `unlock_${unlockId}_${Date.now()}`;

    const resp = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY.value()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email || `${uid}@staffroomng.user`, // Paystack requires an email
        amount: UNLOCK_FEE_KOBO,
        reference,
        metadata: {
          uid,
          listingId,
          purpose: "contact_unlock",
        },
      }),
    });

    const data = await resp.json();
    if (!data.status) {
      throw new HttpsError("internal", data.message || "Paystack init failed.");
    }

    // Record a pending payment so we have an audit trail even before the
    // webhook fires.
    await db.collection("payments").doc(reference).set({
      uid,
      listingId,
      reference,
      status: "pending",
      amountKobo: UNLOCK_FEE_KOBO,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { authorizationUrl: data.data.authorization_url, reference };
  }
);

/**
 * Paystack calls this URL after a payment completes. We verify the
 * signature, then independently re-verify the transaction directly with
 * Paystack's servers (never trust the webhook payload alone) before
 * granting the unlock. This is the only place unlock records get created.
 */
exports.paystackWebhook = onRequest(
  { secrets: [PAYSTACK_SECRET_KEY], cors: false },
  async (req, res) => {
    try {
      const signature = req.headers["x-paystack-signature"];
      const expected = crypto
        .createHmac("sha512", PAYSTACK_SECRET_KEY.value())
        .update(req.rawBody)
        .digest("hex");

      if (signature !== expected) {
        console.warn("Paystack webhook: signature mismatch");
        return res.status(401).send("Invalid signature");
      }

      const event = req.body;
      if (event.event !== "charge.success") {
        return res.status(200).send("Ignored");
      }

      const reference = event.data.reference;

      // Re-verify directly with Paystack — don't trust the webhook body alone.
      const verifyResp = await fetch(
        `https://api.paystack.co/transaction/verify/${reference}`,
        { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY.value()}` } }
      );
      const verifyData = await verifyResp.json();

      if (!verifyData.status || verifyData.data.status !== "success") {
        console.warn("Paystack webhook: verification failed", reference);
        return res.status(200).send("Not verified");
      }

      const { uid, listingId, purpose } = verifyData.data.metadata || {};
      if (purpose !== "contact_unlock" || !uid || !listingId) {
        return res.status(200).send("Not an unlock payment");
      }

      const unlockId = `${uid}_${listingId}`;

      await db.runTransaction(async (tx) => {
        const paymentRef = db.collection("payments").doc(reference);
        const unlockRef = db.collection("unlocks").doc(unlockId);

        const unlockSnap = await tx.get(unlockRef);
        if (unlockSnap.exists) return; // already granted, avoid double-processing

        tx.set(unlockRef, {
          uid,
          listingId,
          reference,
          amountKobo: verifyData.data.amount,
          unlockedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        tx.set(paymentRef, { status: "success" }, { merge: true });
      });

      return res.status(200).send("OK");
    } catch (err) {
      console.error("Paystack webhook error:", err);
      return res.status(500).send("Server error");
    }
  }
);

/**
 * Callable from the web app to actually fetch the contact details for a
 * listing, but only once. Firestore rules make listings/{id}/private/contact
 * unreadable by clients directly — this function re-checks that an
 * unlocks/{uid}_{listingId} record exists (proof of payment, only ever
 * created by paystackWebhook above) before returning anything.
 */
exports.getUnlockedContact = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }
  const { listingId } = request.data || {};
  if (!listingId) {
    throw new HttpsError("invalid-argument", "listingId is required.");
  }

  const unlockId = `${uid}_${listingId}`;
  const unlockSnap = await db.collection("unlocks").doc(unlockId).get();
  if (!unlockSnap.exists) {
    throw new HttpsError(
      "permission-denied",
      "This contact hasn't been unlocked yet."
    );
  }

  const contactSnap = await db
    .collection("listings")
    .doc(listingId)
    .collection("private")
    .doc("contact")
    .get();

  if (!contactSnap.exists) {
    throw new HttpsError("not-found", "Contact details are missing.");
  }

  return contactSnap.data();
});
