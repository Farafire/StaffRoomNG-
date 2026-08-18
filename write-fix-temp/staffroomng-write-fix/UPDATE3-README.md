# StaffRoomNG — Fix: Route Listing Writes Through the Server

## Why
Your Render server successfully reaches Firestore (we saw it get a real,
specific "not found" response, not a connection failure). But posting a
listing directly from the browser has been unreliable — it either hangs or
silently doesn't save. This routes listing creation through your Render
server instead, the same way payments already work, sidestepping whatever
is interfering with the browser's direct connection.

Reads (Browse listings) are untouched — those have been working fine.

## Step 1 — Add the new server route
1. Upload this zip into your Codespace (same as always: right-click
   Explorer → Upload)
2. Unzip it:
   ```
   cd /workspaces/StaffRoomNG-
   unzip staffroomng-write-fix.zip -d write-fix-temp
   ```
3. Open `staffroomng/server/server.js`
4. Open `write-fix-temp/staffroomng-write-fix/server-addition.js` in another
   tab — copy its contents (the `app.post("/create-listing", ...)` block)
5. Paste it into `server.js`, right before this line near the bottom:
   ```
   app.get("/", (_req, res) => res.send("StaffRoomNG payment server is running."));
   ```

## Step 2 — Replace the two client files
```
cp write-fix-temp/staffroomng-write-fix/api.js staffroomng/web/src/lib/api.js
cp write-fix-temp/staffroomng-write-fix/listings.js staffroomng/web/src/lib/listings.js
cp write-fix-temp/staffroomng-write-fix/payments.js staffroomng/web/src/lib/payments.js
```

## Step 3 — Push and redeploy the server
```
cd /workspaces/StaffRoomNG-
git add .
git commit -m "Route listing writes through server for reliability"
git push
```
Render should auto-redeploy within a minute or two (check the Render
dashboard's Logs tab — you should see "Your service is live" again). If it
doesn't redeploy automatically, go to your Render service → **Manual
Deploy** → **Deploy latest commit**.

## Step 4 — Test
```
cd staffroomng/web
npm run dev
```
Post a test listing. This time the write itself happens on Render's
servers, not your browser, so it should complete quickly and reliably.
Check the Firebase console's Firestore Data tab afterward — the listing
should now appear there consistently.

Send a screenshot after Step 4 and we'll confirm it's solid before moving
back to testing payments.
