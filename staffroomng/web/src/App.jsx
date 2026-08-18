import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "./contexts/AuthContext.jsx";
import { createListing, subscribeListings } from "./lib/listings.js";
import { startUnlockPayment, subscribeUnlock, fetchUnlockedContact } from "./lib/payments.js";

const NAIRA = (n) => "₦" + Number(n || 0).toLocaleString("en-NG");
const UNLOCK_FEE = 1500;
const LEVELS = ["All levels", "Nursery", "Primary", "Secondary", "K–12 Campus", "Tertiary"];
const KINDS = [
  { value: "all", label: "Everyone" },
  { value: "vacancy", label: "Vacancies (schools & parents hiring)" },
  { value: "seeking", label: "Available teachers & tutors" },
];

export default function App() {
  const { user, authLoading } = useAuth();
  const [view, setView] = useState("home");
  const [regRole, setRegRole] = useState("school");
  const [listings, setListings] = useState([]);

  useEffect(() => subscribeListings(setListings), []);

  return (
    <div style={{ background: "var(--paper)", minHeight: "100vh", color: "var(--ink)" }}>
      <GlobalStyle />
      <NavBar view={view} setView={setView} />
      {view === "home" && <Home setView={setView} setRegRole={setRegRole} listings={listings} />}
      {view === "login" && <Login onDone={() => setView("register")} />}
      {view === "register" && (
        !authLoading && !user ? (
          <Login onDone={() => setView("register")} />
        ) : (
          <Register regRole={regRole} setRegRole={setRegRole} onDone={() => setView("browse")} />
        )
      )}
      {view === "browse" && <Browse listings={listings} />}
      <Footer setView={setView} setRegRole={setRegRole} />
    </div>
  );

  
  // ---------- Login ----------
}
function Login({ onDone }) {
  const { signUp, signIn } = useAuth();
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function friendlyError(err) {
    const code = err.code || "";
    if (code.includes("email-already-in-use")) return "That email's already registered — try signing in instead.";
    if (code.includes("invalid-credential") || code.includes("wrong-password")) return "Email or password didn't match. Try again.";
    if (code.includes("weak-password")) return "Please use at least 6 characters for your password.";
    if (code.includes("user-not-found")) return "No account found with that email — try registering instead.";
    return "Something went wrong. Please try again.";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "signup") {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
      onDone();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-5 py-16">
      <h1 className="ff-display" style={{ fontSize: "1.7rem", fontWeight: 700, color: "var(--chalk)" }}>
        {mode === "signup" ? "Create your account" : "Sign in to continue"}
      </h1>
      <p className="ff-body" style={{ opacity: 0.75, marginTop: "0.3rem" }}>
        {mode === "signup" ? "Just an email and password — free to register." : "Welcome back."}
      </p>

      <form onSubmit={handleSubmit} className="card p-6 mt-6 flex flex-col gap-4">
        <div>
          <label className="label">Email address</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p style={{ color: "var(--pin)", fontSize: "0.85rem" }}>{error}</p>}
        <button className="btn btn-chalk" disabled={busy}>
          {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(""); }}
        className="btn btn-outline"
        style={{ marginTop: "1rem", width: "100%" }}
      >
        {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
      </button>
    </div>
  );
}


// ---------- Register ----------
function Register({ regRole, setRegRole, onDone }) {
  const { user } = useAuth();
  const [form, setForm] = useState(emptyForm(regRole));
  const [submitting, setSubmitting] = useState(false);

  function switchRole(r) {
    setRegRole(r);
    setForm(emptyForm(r));
  }
  function emptyForm(r) {
    return {
      title: "", org: "", location: "", level: LEVELS[1], employment: "Full-time",
      pay: "", payUnit: r === "parent" ? "session" : "month", tags: "", note: "",
      name: "", phone: "", whatsapp: "", email: "",
    };
  }
  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title || !form.location || !form.pay || !form.name || !form.phone) return;
    setSubmitting(true);
    const kind = regRole === "school" || regRole === "parent" ? "vacancy" : "seeking";
    const postedBy = regRole === "school" ? "School" : regRole === "parent" ? "Parent" : "Teacher";
    try {
      await createListing({
        ownerId: user.uid,
        kind,
        title: form.title,
        org: form.org || form.name,
        location: form.location,
        level: form.level,
        employment: form.employment,
        pay: Number(form.pay) || 0,
        payUnit: form.payUnit,
        postedBy,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        note: form.note,
        contact: { name: form.name, phone: form.phone, whatsapp: form.whatsapp || form.phone, email: form.email },
      });
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  const roleCopy = {
    school: { titleLabel: "Role you're hiring for", titlePlaceholder: "e.g. SS2 Chemistry Teacher", orgLabel: "School name" },
    teacher: { titleLabel: "Your role / discipline", titlePlaceholder: "e.g. Primary Maths & English Teacher", orgLabel: "Full name (school field optional)" },
    parent: { titleLabel: "Lesson you need", titlePlaceholder: "e.g. JSS3 Home Tutor — Maths & English", orgLabel: "Your name / household" },
  };
  const rc = roleCopy[regRole];

  return (
    <div className="max-w-2xl mx-auto px-5 py-12">
      <h1 className="ff-display" style={{ fontSize: "1.9rem", fontWeight: 700, color: "var(--chalk)" }}>Register on the board</h1>
      <p className="ff-body" style={{ opacity: 0.75, marginTop: "0.3rem" }}>It's free to post. You'll only pay when you unlock someone else's contact.</p>

      <div className="role-toggle flex gap-2 mt-6 mb-8 flex-wrap">
        {[
          { v: "school", l: "School owner" },
          { v: "teacher", l: "Teacher / Tutor / Nurse" },
          { v: "parent", l: "Parent seeking tutor" },
        ].map((r) => (
          <button key={r.v} type="button" onClick={() => switchRole(r.v)} className={`btn ${regRole === r.v ? "active" : ""}`} style={{ fontSize: "0.85rem", padding: "0.55rem 1rem" }}>
            {r.l}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="card p-6 flex flex-col gap-4">
        <div>
          <label className="label">{rc.titleLabel}</label>
          <input className="input" placeholder={rc.titlePlaceholder} value={form.title} onChange={(e) => update("title", e.target.value)} required />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">{rc.orgLabel}</label>
            <input className="input" value={form.org} onChange={(e) => update("org", e.target.value)} />
          </div>
          <div>
            <label className="label">Location</label>
            <input className="input" placeholder="e.g. Ikeja, Lagos" value={form.location} onChange={(e) => update("location", e.target.value)} required />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Level</label>
            <select className="input" value={form.level} onChange={(e) => update("level", e.target.value)}>
              {LEVELS.filter((l) => l !== "All levels").map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Employment type</label>
            <select className="input" value={form.employment} onChange={(e) => update("employment", e.target.value)}>
              <option>Full-time</option>
              <option>Part-time</option>
              <option>Live-in</option>
              <option>Weekend / Home lessons</option>
              <option>Online / Remote</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">{regRole === "school" ? "Salary offered (₦)" : regRole === "parent" ? "Rate you'll pay (₦)" : "Expected pay (₦)"}</label>
            <input className="input" type="number" min="0" placeholder="e.g. 150000" value={form.pay} onChange={(e) => update("pay", e.target.value)} required />
          </div>
          <div>
            <label className="label">Per</label>
            <select className="input" value={form.payUnit} onChange={(e) => update("payUnit", e.target.value)}>
              <option value="month">Month</option>
              <option value="term">Term</option>
              <option value="session">Session</option>
              <option value="hour">Hour</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label">Subjects / tags (comma separated)</label>
          <input className="input" placeholder="e.g. Physics, Further Maths, WAEC" value={form.tags} onChange={(e) => update("tags", e.target.value)} />
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea className="input" rows={3} value={form.note} onChange={(e) => update("note", e.target.value)} />
        </div>
        <div style={{ borderTop: "1px dashed var(--line)", paddingTop: "1rem" }}>
          <p className="ff-mono" style={{ fontSize: "0.72rem", color: "var(--sage)" }}>YOUR CONTACT — ONLY SHOWN TO PEOPLE WHO UNLOCK IT</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            <div>
              <label className="label">Full name</label>
              <input className="input" value={form.name} onChange={(e) => update("name", e.target.value)} required />
            </div>
            <div>
              <label className="label">Phone number</label>
              <input className="input" value={form.phone} onChange={(e) => update("phone", e.target.value)} required />
            </div>
            <div>
              <label className="label">WhatsApp (if different)</label>
              <input className="input" value={form.whatsapp} onChange={(e) => update("whatsapp", e.target.value)} />
            </div>
            <div>
              <label className="label">Email (optional)</label>
              <input className="input" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
            </div>
          </div>
        </div>
        <button type="submit" className="btn btn-chalk" disabled={submitting}>
          {submitting ? "Posting…" : "Post to the board — free"}
        </button>
      </form>
    </div>
  );
}

// ---------- Browse ----------
function Browse({ listings }) {
  const [filters, setFilters] = useState({ kind: "all", level: "All levels", q: "" });
  const filtered = useMemo(() => listings.filter((l) => {
    if (filters.kind !== "all" && l.kind !== filters.kind) return false;
    if (filters.level !== "All levels" && l.level !== filters.level) return false;
    if (filters.q) {
      const hay = (l.title + " " + l.location + " " + (l.tags || []).join(" ")).toLowerCase();
      if (!hay.includes(filters.q.toLowerCase())) return false;
    }
    return true;
  }), [listings, filters]);

  return (
    <div className="max-w-6xl mx-auto px-5 py-12">
      <h1 className="ff-display" style={{ fontSize: "1.9rem", fontWeight: 700, color: "var(--chalk)" }}>Browse the board</h1>
      <p className="ff-body" style={{ opacity: 0.75 }}>{filtered.length} posting{filtered.length !== 1 ? "s" : ""} match your search.</p>
      <div className="card p-4 mt-6 grid grid-cols-1 sm:grid-cols-4 gap-3">
        <select className="input" value={filters.kind} onChange={(e) => setFilters((f) => ({ ...f, kind: e.target.value }))}>
          {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
        <select className="input" value={filters.level} onChange={(e) => setFilters((f) => ({ ...f, level: e.target.value }))}>
          {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <input className="input sm:col-span-2" placeholder="Search subject, location, keyword…" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
        {filtered.map((l) => <ListingCard key={l.id} listing={l} />)}
        {filtered.length === 0 && <p style={{ opacity: 0.6 }}>Nothing matches yet — try widening your filters, or be the first to post.</p>}
      </div>
    </div>
  );
}

function ListingCard({ listing: l }) {
  const { user } = useAuth();
  const [unlocked, setUnlocked] = useState(false);
  const [contact, setContact] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    return subscribeUnlock(user.uid, l.id, async (isUnlocked) => {
      setUnlocked(isUnlocked);
      if (isUnlocked && !contact) {
        try {
          setContact(await fetchUnlockedContact(l.id));
        } catch { /* ignore transient race right after webhook fires */ }
      }
    });
  }, [user, l.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleUnlock() {
    if (!user) { window.location.hash = "#login"; return; }
    setBusy(true);
    try {
      await startUnlockPayment(l.id, user.email || undefined);
      // Browser redirects to Paystack from here; nothing else to do.
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className={`tag ${l.kind === "vacancy" ? "badge-vacancy" : "badge-seeking"}`}>{l.kind === "vacancy" ? "VACANCY" : "AVAILABLE"}</span>
          <p className="ff-display" style={{ fontWeight: 600, fontSize: "1.08rem", marginTop: "0.5rem", color: "var(--chalk)" }}>{l.title}</p>
          <p className="ff-body" style={{ fontSize: "0.85rem", opacity: 0.7 }}>{l.org} · {l.location}</p>
        </div>
        <p className="ff-mono" style={{ fontSize: "0.85rem", color: "var(--pin)", whiteSpace: "nowrap" }}>{NAIRA(l.pay)}/{l.payUnit}</p>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-3">
        <span className="tag">{l.level}</span>
        <span className="tag">{l.employment}</span>
        {(l.tags || []).map((t) => <span className="tag" key={t}>{t}</span>)}
      </div>
      {l.note && <p className="ff-body" style={{ fontSize: "0.85rem", marginTop: "0.7rem", opacity: 0.8 }}>{l.note}</p>}
      <div style={{ borderTop: "1px dashed var(--line)", marginTop: "1rem", paddingTop: "0.9rem" }}>
        {unlocked && contact ? (
          <div className="flex flex-col gap-1">
            <span className="stamp" style={{ fontSize: "0.7rem", marginBottom: "0.4rem", width: "fit-content" }}>CONTACT UNLOCKED</span>
            <p><strong>{contact.name}</strong></p>
            <p className="ff-mono" style={{ fontSize: "0.82rem" }}>📞 {contact.phone}</p>
            <p className="ff-mono" style={{ fontSize: "0.82rem" }}>💬 {contact.whatsapp}</p>
            {contact.email && <p className="ff-mono" style={{ fontSize: "0.82rem" }}>✉️ {contact.email}</p>}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p style={{ fontSize: "0.8rem", opacity: 0.6 }}>Contact hidden until unlocked</p>
            <button className="btn btn-gold" style={{ fontSize: "0.82rem", padding: "0.5rem 0.9rem" }} onClick={handleUnlock} disabled={busy}>
              {busy ? "Redirecting…" : `Pay ${NAIRA(UNLOCK_FEE)} to unlock`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Home / Nav / Footer / Styles ----------
function NavBar({ view, setView }) {
  const { user, logOut } = useAuth();
  return (
    <div style={{ borderBottom: "1px solid var(--line)" }} className="sticky top-0 z-20" >
      <div className="max-w-6xl mx-auto flex items-center justify-between px-5 py-4">
        <button onClick={() => setView("home")} style={{ background: "none", border: "none", cursor: "pointer" }} className="flex items-center gap-2">
          <span style={{ width: 10, height: 10, background: "var(--pin)", borderRadius: "50%" }}></span>
          <span className="ff-display" style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--chalk)" }}>StaffRoom<span style={{ color: "var(--gold)" }}>NG</span></span>
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => setView("browse")} className="btn btn-outline" style={{ padding: "0.55rem 1rem", fontSize: "0.85rem" }}>Browse listings</button>
          <button onClick={() => setView(user ? "register" : "login")} className="btn btn-gold" style={{ padding: "0.55rem 1rem", fontSize: "0.85rem" }}>Register free</button>
          {user && <button onClick={logOut} className="btn btn-outline" style={{ padding: "0.55rem 1rem", fontSize: "0.85rem" }}>Sign out</button>}
        </div>
      </div>
    </div>
  );
}

function Home({ setView, setRegRole, listings }) {
  const boardItems = listings.slice(0, 4);
  return (
    <div>
      <section className="cork" style={{ borderBottom: "6px solid var(--chalk)" }}>
        <div className="max-w-6xl mx-auto px-5 pt-14 pb-16">
          <div className="max-w-xl mb-10">
            <p className="ff-mono" style={{ color: "var(--chalk)", fontSize: "0.78rem" }}>THE STAFFROOM NOTICEBOARD — NIGERIA & ABROAD</p>
            <h1 className="ff-display" style={{ fontSize: "2.6rem", lineHeight: 1.08, color: "var(--chalk)", fontWeight: 700 }}>
              Where schools find teachers,<br/>and teachers find schools.
            </h1>
            <p className="ff-body" style={{ marginTop: "1rem", fontSize: "1.02rem", opacity: 0.85 }}>
              Proprietors post vacancies. Teachers, tutors and school nurses post their availability.
              Parents post tutoring requests. Everyone sets their own price in Naira.
            </p>
            <div className="flex flex-wrap gap-3 mt-6">
              <button className="btn btn-chalk" onClick={() => { setRegRole("school"); setView("register"); }}>I'm hiring — post a vacancy</button>
              <button className="btn btn-outline" style={{ background: "var(--card)" }} onClick={() => { setRegRole("teacher"); setView("register"); }}>I'm a teacher/tutor</button>
            </div>
          </div>
          {boardItems.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 pt-4">
              {boardItems.map((l, i) => (
                <div key={l.id} className="pin-card p-4" style={{ transform: `rotate(${[-2, 1.5, -1, 2][i % 4]}deg)`, borderRadius: 3 }}>
                  <span className="pin-dot"></span>
                  <span className={`tag ${l.kind === "vacancy" ? "badge-vacancy" : "badge-seeking"}`}>{l.kind === "vacancy" ? "VACANCY" : "AVAILABLE"}</span>
                  <p className="ff-display" style={{ fontWeight: 600, fontSize: "0.98rem", marginTop: "0.5rem", color: "var(--chalk)" }}>{l.title}</p>
                  <p style={{ fontSize: "0.8rem", opacity: 0.7 }}>{l.location}</p>
                  <p className="ff-mono" style={{ fontSize: "0.78rem", marginTop: "0.5rem", color: "var(--pin)" }}>{NAIRA(l.pay)}/{l.payUnit}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Footer({ setView, setRegRole }) {
  return (
    <footer style={{ borderTop: "1px solid var(--line)" }} className="mt-4">
      <div className="max-w-6xl mx-auto px-5 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <p className="ff-display" style={{ fontWeight: 700, color: "var(--chalk)" }}>StaffRoom<span style={{ color: "var(--gold)" }}>NG</span></p>
        <button className="btn btn-outline" onClick={() => { setRegRole("school"); setView("register"); }}>Post your first listing</button>
      </div>
    </footer>
  );
}

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Work+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');
      :root{ --paper:#FBF6EC; --ink:#1B2A22; --chalk:#16342A; --chalk-2:#1F4636; --gold:#C9932B; --gold-2:#E0AE4E; --pin:#B4432E; --sage:#7C9282; --card:#FFFDF7; --line: rgba(27,42,34,0.14); }
      * { box-sizing: border-box; }
      .ff-display { font-family: 'Fraunces', serif; } .ff-body { font-family: 'Work Sans', sans-serif; } .ff-mono { font-family: 'IBM Plex Mono', monospace; }
      body { font-family: 'Work Sans', sans-serif; }
      .btn { font-family: 'Work Sans', sans-serif; font-weight: 600; border-radius: 3px; padding: 0.75rem 1.4rem; cursor: pointer; border: none; }
      .btn-gold { background: var(--gold); color: var(--chalk); } .btn-gold:hover { background: var(--gold-2); }
      .btn-chalk { background: var(--chalk); color: var(--paper); } .btn-chalk:hover { background: var(--chalk-2); }
      .btn-outline { background: transparent; border: 1.5px solid var(--ink); color: var(--ink); } .btn-outline:hover { background: var(--ink); color: var(--paper); }
      .card { background: var(--card); border: 1px solid var(--line); border-radius: 4px; }
      .pin-card { background: var(--card); border: 1px solid var(--line); box-shadow: 2px 4px 10px rgba(0,0,0,0.15); position: relative; }
      .pin-dot { position: absolute; top: -9px; left: 50%; transform: translateX(-50%); width: 16px; height: 16px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #E8654F, var(--pin)); box-shadow: 0 2px 3px rgba(0,0,0,0.35); }
      .cork { background-color: #C9A876; background-image: radial-gradient(rgba(0,0,0,0.06) 1px, transparent 1px), radial-gradient(rgba(0,0,0,0.05) 1px, transparent 1px); background-size: 14px 14px, 9px 9px; background-position: 0 0, 5px 6px; }
      .tag { font-family: 'IBM Plex Mono', monospace; font-size: 0.68rem; padding: 0.2rem 0.5rem; border-radius: 2px; background: rgba(22,52,42,0.08); color: var(--chalk); border: 1px solid rgba(22,52,42,0.15); }
      .badge-vacancy { background: rgba(180,67,46,0.1); color: var(--pin); border-color: rgba(180,67,46,0.3); }
      .badge-seeking { background: rgba(22,52,42,0.1); color: var(--chalk); border-color: rgba(22,52,42,0.25); }
      .input { width: 100%; border: 1.5px solid var(--line); background: var(--card); border-radius: 3px; padding: 0.65rem 0.8rem; font-family: 'Work Sans', sans-serif; font-size: 0.92rem; color: var(--ink); }
      .input:focus { outline: none; border-color: var(--gold); box-shadow: 0 0 0 3px rgba(201,147,43,0.18); }
      .label { font-size: 0.78rem; font-weight: 600; color: var(--chalk); margin-bottom: 0.3rem; display:block; }
      .stamp { display: inline-block; border: 2.5px solid var(--pin); color: var(--pin); font-family: 'IBM Plex Mono', monospace; font-weight: 600; padding: 0.35rem 0.7rem; border-radius: 3px; transform: rotate(-4deg); }
      .role-toggle button { border: 1.5px solid var(--line); background: var(--card); }
      .role-toggle button.active { background: var(--chalk); color: var(--paper); border-color: var(--chalk); }
    `}</style>
  );
}
