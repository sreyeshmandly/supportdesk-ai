import { useState } from "react";
import { Activity } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getErrorMessage } from "../../services/api";
import styles from "./Auth.module.css";

function Brand() { return <div className={styles.brand}><div className={styles.mark}><Activity size={22} /></div><div><strong>SupportDesk AI</strong><small>PRO WORKSPACE</small></div></div>; }

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });
  async function submit(event) {
    event.preventDefault(); setError(""); setBusy(true);
    try { await login(form); navigate(location.state?.from?.pathname || "/dashboard", { replace: true }); }
    catch (err) { setError(getErrorMessage(err, "Unable to sign in. Check your details and try again.")); }
    finally { setBusy(false); }
  }
  return <div className={styles.page}>
    <section className={styles.visual}><Brand /><div className={styles.visualCopy}><span className={styles.eyebrow}>SUPPORT OPERATIONS, REIMAGINED</span><h1>Better support starts with <span>better signals.</span></h1><p>Bring customer conversations, team workflows, and AI-assisted knowledge into one focused workspace.</p><div className={styles.metrics}><div className={styles.metric}><strong>01</strong><span>Unified workspace</span></div><div className={styles.metric}><strong>AI</strong><span>Assisted triage</span></div><div className={styles.metric}><strong>RAG</strong><span>Grounded answers</span></div></div></div><div className={styles.quote}>“The best support experience feels effortless to the customer—and clear to the team.”<strong>SupportDesk AI Pro · Workspace platform</strong></div></section>
    <section className={styles.formSide}><div className={styles.formWrap}><h2>Welcome back</h2><p className={styles.sub}>Sign in to continue to your support workspace.</p>
      {error && <div className={styles.error} role="alert">{error}</div>}
      <form onSubmit={submit}>
        <div className={styles.field}><label htmlFor="email">Work email</label><input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" value={form.email} onChange={update} required /></div>
        <div className={styles.field}><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" placeholder="Enter your password" value={form.password} onChange={update} required /></div>
        <button className={styles.submit} disabled={busy}>{busy ? "Signing you in…" : "Sign in to workspace"}</button>
      </form>
      <p className={styles.foot}>New to SupportDesk? <Link to="/register">Create a workspace</Link></p>
      <p className={styles.fineprint}>By continuing, you agree to use your organization's support workspace responsibly.</p>
    </div></section>
  </div>;
}
