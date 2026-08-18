// ---------- ADD THIS TO server/server.js ----------
// Paste this new route into your existing server/server.js file, anywhere
// after the `requireAuth` function is defined and before `app.get("/", ...)`.
// It reuses the same `db`, `admin`, and `requireAuth` already set up there.

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
