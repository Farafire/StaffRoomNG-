# StaffRoomNG — Free Payment Server Update (no Blaze plan needed)

This replaces the Paystack payment logic that used to live in Firebase Cloud
Functions with a small server hosted for free on **Render.com**. Firebase
itself (Auth, Firestore) stays exactly as you already set it up — nothing
there needs to change.

## What you're adding
- A `server/` folder — a small Node.js app with 3 endpoints, doing the exact
  same job the Cloud Functions were going to do
- An updated `web/src/lib/payments.js` — now calls your Render server
  instead of Firebase Functions
- An updated `web/.env.example` — one new variable, `VITE_API_BASE_URL`

## Step 1 — Merge these files into your existing project (in your Codespace)

1. Upload this whole `staffroomng-render-update.zip` into your Codespace the
   same way you uploaded the first zip (right-click Explorer → Upload...)
2. In the terminal:
   ```
   cd /workspaces/StaffRoomNG-
   unzip staffroomng-render-update.zip -d update-temp
   ```
3. Copy the new server folder into your project:
   ```
   cp -r update-temp/server staffroomng/server
   ```
4. Replace the payments file:
   ```
   cp update-temp/web-src-lib-payments.js staffroomng/web/src/lib/payments.js
   ```
5. Update your web `.env` — open `staffroomng/web/.env` in the editor and add
   this new line (keep everything else that's already there):
   ```
   VITE_API_BASE_URL=
   ```
   (leave it blank for now — you'll fill it in after Step 3 below)

## Step 2 — Generate a Firebase service account key (free, no Blaze needed)

1. In the Firebase console, go to **Project settings** (gear icon) →
   **Service accounts** tab
2. Click **Generate new private key** → confirm — a `.json` file downloads
3. Open that downloaded file in any text editor, select all the text, and
   copy it — you'll need it as one block in Step 3

Keep this file private — it gives full admin access to your Firebase
project. Never commit it to a public GitHub repo.

## Step 3 — Deploy the server to Render (free, no card required)

1. Go to **render.com** and sign up (you can sign up with your GitHub
   account — convenient since your code's already on GitHub)
2. Click **New +** → **Web Service**
3. Connect your `staffroomng` GitHub repository
   - You'll first need to push your Codespace's changes back to GitHub:
     in the terminal, run:
     ```
     cd /workspaces/StaffRoomNG-
     git add .
     git commit -m "Add Render payment server"
     git push
     ```
4. On Render's setup screen:
   - **Root Directory**: `staffroomng/server`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
5. Under **Environment Variables**, add:
   - `PAYSTACK_SECRET_KEY` → paste your Paystack test secret key
   - `FIREBASE_SERVICE_ACCOUNT` → paste the *entire* contents of the
     service account JSON file from Step 2, as one block
6. Click **Create Web Service**. Render will build and deploy — takes a
   few minutes. When done, you'll get a URL like:
   ```
   https://staffroomng-server.onrender.com
   ```

Note: Render's free tier "sleeps" a service after 15 minutes of no traffic,
and takes ~30–60 seconds to wake back up on the next request. That's fine
for testing and even for a real early-stage launch — just know the first
unlock request after a quiet period will feel a bit slow. You can upgrade
later once there's real traffic to justify it.

## Step 4 — Connect the pieces

1. Copy your Render URL
2. In `staffroomng/web/.env`, set:
   ```
   VITE_API_BASE_URL=https://staffroomng-server.onrender.com
   ```
   (use your actual Render URL, no trailing slash)

## Step 5 — Set the Paystack webhook

1. Go to **dashboard.paystack.com** → **Settings → API Keys & Webhooks**
2. Set the **Webhook URL** to:
   ```
   https://staffroomng-server.onrender.com/paystack-webhook
   ```

## Step 6 — Test it

```
cd staffroomng/web
npm install
npm run dev
```

Codespaces will show a popup to open the forwarded port in your browser —
try registering a listing and unlocking a contact with a Paystack **test**
card (Paystack's docs list test card numbers that simulate a successful
payment without charging anything real).

If something breaks at any step, send a screenshot the way we've been
doing and we'll fix it one by one.
