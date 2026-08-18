import { useState } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { encryptedSalaryPayload } from "../data/encryptedSalaryData";
import "./AuthGate.css";

const bytes = (value) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

async function decryptSalaryData(password) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: bytes(encryptedSalaryPayload.salt),
      iterations: encryptedSalaryPayload.iterations,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytes(encryptedSalaryPayload.iv) },
    key,
    bytes(encryptedSalaryPayload.data),
  );
  return JSON.parse(new TextDecoder().decode(decrypted));
}

export default function AuthGate({ onAuthenticated }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async (event) => {
    event.preventDefault();
    setError("");
    if (username.trim().toLowerCase() !== "admin") {
      setError("Incorrect username or password.");
      return;
    }
    setLoading(true);
    try {
      const salaryData = await decryptSalaryData(password);
      onAuthenticated(salaryData);
    } catch {
      setError("Incorrect username or password.");
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
