import { useState } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import "./AuthGate.css";

export default function AuthGate({ onAuthenticated }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to sign in.");
      onAuthenticated();
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-card__icon"><LockKeyhole size={25} /></div>
        <p className="login-card__eyebrow">KARIKAALA</p>
        <h1>Management Dashboard</h1>
        <p className="login-card__subtitle">Sign in to access confidential salary reports.</p>
        <form onSubmit={login} className="login-form">
          <label>Username<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" placeholder="Enter username" required /></label>
          <label>Password
            <div className="password-field">
              <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="Enter password" required />
              <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
          </label>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="login-submit" type="submit" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</button>
        </form>
        <p className="login-card__footer">Authorized management access only</p>
      </section>
    </main>
  );
}
