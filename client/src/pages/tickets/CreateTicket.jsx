import { useState } from "react";
import { ArrowLeft, Send, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { ticketService } from "../../services/ticketService";
import { getErrorMessage } from "../../services/api";
import s from "../Page.module.css";

export default function CreateTicket() {
  const [form, setForm] = useState({ subject: "", body: "" }); const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const navigate = useNavigate();
  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  async function submit(e) { e.preventDefault(); setError(""); setBusy(true); try { const result = await ticketService.create(form); navigate(`/tickets/${result.id}`, { state: { created: true, triageQueued: result.triageQueued } }); } catch (err) { setError(getErrorMessage(err, "Could not create ticket.")); } finally { setBusy(false); } }
  return <div><div className={s.pageHead}><div><div className={s.eyebrow}>CUSTOMER SUPPORT</div><h1 className={s.title}>Create a ticket</h1><p className={s.description}>Capture the issue clearly so the team can resolve it faster.</p></div><Link to="/tickets" className={s.button}><ArrowLeft size={14} />Back to tickets</Link></div>
    <div className={s.formCard}><div className={s.callout} style={{ marginBottom: 22 }}><Sparkles size={18} /><div><strong>AI triage runs in the background</strong>After submission, the backend may queue the ticket for AI classification. The result becomes available as processing completes.</div></div>
      {error && <div className={s.inlineError}>{error}</div>}
      <form onSubmit={submit}><div className={s.formField}><label htmlFor="subject">Subject</label><input className={s.input} id="subject" name="subject" minLength={3} maxLength={200} placeholder="e.g. Unable to access my account" value={form.subject} onChange={update} required /><span className={s.helper}>Summarize the issue in a short, specific sentence.</span></div><div className={s.formField}><label htmlFor="body">Description</label><textarea className={s.textarea} id="body" name="body" minLength={5} maxLength={5000} placeholder="What happened? What did you expect? Include any steps that might help us reproduce the issue." value={form.body} onChange={update} required /><span className={s.helper}>{form.body.length}/5000 characters</span></div><div className={s.actions}><button className={`${s.button} ${s.primary}`} disabled={busy}><Send size={14} />{busy ? "Submitting…" : "Submit ticket"}</button><Link to="/tickets" className={s.button}>Cancel</Link></div></form>
    </div>
  </div>;
}
