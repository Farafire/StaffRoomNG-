# Final fix — full server.js replacement

This is the entire, correct server.js file, with all four routes properly
registered (create-listing, create-unlock-payment, paystack-webhook,
get-unlocked-contact). No manual pasting into the middle of code this time —
just overwrite the whole file.

## Step 1 — Upload & unzip
1. Upload `staffroomng-server-full.zip` into your Codespace (right-click
   Explorer → Upload...)
2. In the terminal:
   ```
   cd /workspaces/StaffRoomNG-
   unzip staffroomng-server-full.zip -d server-full-temp
   ```

## Step 2 — Overwrite the file completely (one command, no editing)
```
cp server-full-temp/staffroomng-server-full/server.js staffroomng/server/server.js
```

## Step 3 — Verify it's really in there
```
grep -n "app.post" staffroomng/server/server.js
```
You should see 4 lines print out — one for each route
(`/create-listing`, `/create-unlock-payment`, `/paystack-webhook`,
`/get-unlocked-contact`). If you see all 4, the file is correct.

## Step 4 — Push and wait for redeploy
```
git add .
git commit -m "Replace server.js with complete corrected version"
git push
```
Go to Render dashboard → Logs (or Events) tab, wait for "Your service is
live" with the new commit hash.

## Step 5 — Test
```
https://staffroomng.onrender.com/create-listing
```
in a new tab should show "Cannot GET /create-listing" (expected, since it's
a POST-only route). Then go back to the app and try posting a real test
listing.

Send a screenshot after Step 3 (the grep result) before pushing — that's
the one moment we can catch any problem before it goes live again.
