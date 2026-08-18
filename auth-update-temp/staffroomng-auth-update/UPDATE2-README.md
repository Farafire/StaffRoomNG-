# StaffRoomNG — Switch to Email/Password Sign-in

This replaces phone OTP sign-in with email + password. No billing account
needed for this — it's free on Firebase's default plan.

## Step 1 — Enable Email/Password in Firebase console
1. Go to **console.firebase.google.com** → your `staffroomng` project
2. **Security → Authentication → Sign-in method** tab
3. Click **Email/Password** in the provider list
4. Toggle it **Enable** → **Save**
   (You can leave Phone enabled too, doesn't matter — we just won't use it)

## Step 2 — Get these two files into your Codespace
1. Upload this zip into your Codespace the same way as before
   (right-click Explorer → Upload...)
2. In the terminal:
   ```
   cd /workspaces/StaffRoomNG-
   unzip staffroomng-auth-update.zip -d auth-update-temp
   ```

## Step 3 — Replace AuthContext.jsx completely
```
cp auth-update-temp/staffroomng-auth-update/AuthContext.jsx staffroomng/web/src/contexts/AuthContext.jsx
```

## Step 4 — Swap the Login component inside App.jsx
This one needs a manual edit since it's a function living inside a bigger
file. In the Codespace file explorer:

1. Open `staffroomng/web/src/App.jsx`
2. Find the section that starts with:
   ```
   // ---------- Login ----------
   function Login({ onDone }) {
   ```
   and ends right before:
   ```
   // ---------- Register ----------
   ```
3. Select that whole `Login` function (everything between those two
   comments) and delete it
4. Open `auth-update-temp/staffroomng-auth-update/Login-component.jsx` in
   another tab, copy its entire contents, and paste it into `App.jsx` in
   the spot you just cleared

## Step 5 — Test it
```
cd staffroomng/web
npm run dev
```

Try creating an account with an email + password. If Codespaces already had
the dev server running, you may need to stop it (Ctrl+C in the terminal)
and run `npm run dev` again to pick up the changes.

Send a screenshot of what you see and we'll keep going.
