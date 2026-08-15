# StaffRoomNG — Production Scaffold (Firebase + Paystack)

This is a real, runnable starting point for the platform: React (Vite) front end,
Firebase Auth (phone OTP), Firestore database, and Cloud Functions that talk to
Paystack to charge the flat ₦1,500 "unlock contact" fee.

It is **not yet deployed anywhere** — you'll do that from your own machine with
your own Firebase + Paystack accounts, following the steps below. Everything
here is real, working code, not a mockup.

---

## 0. What you'll need before you start

- A Google account (for Firebase) — free
- A Paystack account (https://paystack.com) — free to create, you'll need your
  **Test** API keys to start, then **Live** keys once you're ready to charge real money
- Node.js 18+ installed on your computer
- The Firebase CLI: `npm install -g firebase-tools`

---

## 1. Create the Firebase project

1. Go to https://console.firebase.google.com → **Add project** → name it
   (e.g. `staffroomng`) → finish the wizard.
2. In the project, go to **Build → Authentication → Get started** → enable
   **Phone** as a sign-in provider.
   - While testing, add your own number under "Phone numbers for testing" so
     you don't burn real SMS credits.
3. Go to **Build → Firestore Database → Create database** → start in
   **Production mode** → pick a region close to Nigeria (e.g. `europe-west1`).
4. Go to **Project settings → General**, scroll to "Your apps", click the
   **Web** icon (`</>`), register the app (e.g. "StaffRoomNG Web"). Copy the
   `firebaseConfig` object it gives you — you'll paste it into
   `web/src/firebase.js`.
5. Cloud Functions need the **Blaze (pay-as-you-go) plan** because they make
   outbound calls to Paystack. Blaze still has a generous free tier — you
   only pay for what you use beyond it. Upgrade under **Project settings →
   Usage and billing**.

---

## 2. Get your Paystack keys

1. Sign up / log in at https://dashboard.paystack.com
2. Go to **Settings → API Keys & Webhooks**. Copy the **Test Secret Key** and
   **Test Public Key** to start.
3. You'll set the **Secret Key** as a Cloud Functions secret (step 4) and the
   **Public Key** in the web app's `.env`.
4. Later, once you're ready to go live: switch to **Live** keys in the same
   place, and update the webhook URL (step 5) to point at your deployed
   function.

---

## 3. Install the Firebase CLI and connect this project

```bash
npm install -g firebase-tools
firebase login
cd staffroomng
firebase use --add        # pick the Firebase project you created in step 1
```

---

## 4. Configure secrets for Cloud Functions

```bash
cd functions
npm install
firebase functions:secrets:set PAYSTACK_SECRET_KEY
# paste your Paystack Test Secret Key when prompted
```

---

## 5. Set up the Paystack webhook

Paystack needs a URL to notify when a payment succeeds. After your first
deploy (step 7), you'll get a URL like:

```
https://<region>-<project-id>.cloudfunctions.net/paystackWebhook
```

Paste that into Paystack Dashboard → **Settings → API Keys & Webhooks →
Webhook URL**.

---

## 6. Run it locally first (recommended)

```bash
# Terminal 1 — emulate Firebase (Auth, Firestore, Functions) locally
firebase emulators:start

# Terminal 2 — run the web app
cd web
npm install
cp .env.example .env      # then fill in your firebaseConfig + Paystack public key
npm run dev
```

Open the local URL Vite gives you (usually http://localhost:5173).

Note: Firebase phone auth's reCAPTCHA doesn't fully work against the local
emulator UI in every browser — if OTP gets stuck locally, test phone auth
against a real deployed version instead (step 7), using a test phone number
you registered in step 1.

---

## 7. Deploy for real

```bash
cd staffroomng
firebase deploy
```

This deploys Firestore rules, Cloud Functions, and (if you build the web app
with `npm run build` inside `web/` and set up Firebase Hosting) the site
itself. To add Hosting:

```bash
firebase init hosting
# public directory: web/dist
# configure as single-page app: yes
cd web && npm run build && cd ..
firebase deploy
```

---

## What's already wired up in this scaffold

- **Phone OTP sign-in** (`web/src/contexts/AuthContext.jsx`)
- **Firestore-backed listings** — post, browse, filter (`web/src/lib/listings.js`)
- **Paystack unlock flow**:
  1. User taps "Pay ₦1,500 to unlock" → calls the `createUnlockPayment`
     Cloud Function → gets a Paystack checkout URL → redirects there.
  2. User pays on Paystack's page.
  3. Paystack calls your `paystackWebhook` function → it verifies the payment
     server-side (never trust the client) → writes an `unlocks/{uid}_{listingId}`
     document in Firestore.
  4. The web app listens to that document in real time — the moment it
     appears, the contact details reveal, no page refresh needed.
- **Firestore security rules** (`firestore.rules`) — listings are publicly
  readable, only editable by their owner; contact-unlock records can only be
  written by the Cloud Function (server-side), never directly by a client —
  this is what stops someone from unlocking contacts for free.

## What you still need to decide / build as you go

- School/teacher **verification** (e.g. upload a CAC certificate or teaching
  credential) — not built yet, worth adding before launch to build trust.
- **Reporting / moderation** for fake listings.
- Switching Paystack from Test to Live keys when you're ready to charge real
  users.
- A proper domain name + Firebase Hosting custom domain setup.
