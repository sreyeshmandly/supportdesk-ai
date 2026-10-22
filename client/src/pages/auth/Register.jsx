import { useState } from "react";
import { Activity } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getErrorMessage } from "../../services/api";
import styles from "./Auth.module.css";

export default function Register() {
  const { register } = useAuth(); const navigate = useNavigate();
  const [form, setForm] = useState({ orgName: "", name: "", email: "", password: "" });
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });
  async function submit(event) {
    event.preventDefault(); setError("");
    if (form.password.length < 10) { setError("Use a password with at least 10 characters."); return; }
    setBusy(true);
    try { await register(form); navigate("/dashboard", { replace: true }); }
    catch (err) { setError(getErrorMessage(err, "Unable to create your workspace.")); }
    finally { setBusy(false); }
  }
  return <div className={styles.page}>
    <section className={styles.visual}><div className={styles.brand}><div className={styles.mark}><Activity size={22} /></div><div><strong>SupportDesk AI</strong><small>PRO WORKSPACE</small></div></div><div className={styles.visualCopy}><span className={styles.eyebrow}>YOUR TEAM, IN SYNC</span><h1>Make every support interaction <span>count.</span></h1><p>Create a workspace for your team and bring tickets, shared knowledge, and AI-assisted workflows together.</p><div className={styles.metrics}><div className={styles.metric}><strong>01</strong><span>Set up workspace</span></div><div className={styles.metric}><strong>02</strong><span>Invite your team</span></div><div className={styles.metric}><strong>03</strong><span>Help customers</span></div></div></div><div className={styles.quote}>Start with a clear view of customer issues, then build a faster, more consistent support operation.</div></section>
    <section className={styles.formSide}><div className={styles.formWrap}><h2>Create your workspace</h2><p className={styles.sub}>You'll be registered as the first administrator.</p>
      {error && <div className={styles.error} role="alert">{error}</div>}
      <form onSubmit={submit}>
        <div className={styles.field}><label htmlFor="orgName">Organization name</label><input id="orgName" name="orgName" placeholder="Acme Support" value={form.orgName} onChange={update} minLength={2} maxLength={120} required /></div>
        <div className={styles.field}><label htmlFor="name">Your full name</label><input id="name" name="name" autoComplete="name" placeholder="Alex Morgan" value={form.name} onChange={update} minLength={2} maxLength={100} required /></div>
        <div className={styles.field}><label htmlFor="email">Work email</label><input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" value={form.email} onChange={update} required /></div>
        <div className={styles.field}><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="new-password" placeholder="At least 10 characters" value={form.password} onChange={update} minLength={10} maxLength={72} required /></div>
        <button className={styles.submit} disabled={busy}>{busy ? "Creating workspace…" : "Create workspace"}</button>
      </form>
      <p className={styles.foot}>Already have an account? <Link to="/login">Sign in</Link></p>
    </div></section>
  </div>;
}
