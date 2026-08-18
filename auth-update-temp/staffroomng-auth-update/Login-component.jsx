// ---------- Login ----------
// This replaces the old phone-OTP Login component in App.jsx.
// Copy this whole function over the old `function Login({ onDone }) { ... }`
// block in web/src/App.jsx (see UPDATE2-README.md for exact instructions).
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
