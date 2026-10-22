import { useEffect, useState } from "react";
import { ArrowLeft, BookOpenText, Save } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { knowledgeBaseService } from "../../services/knowledgeBaseService";
import { getErrorMessage } from "../../services/api";
import { LoadingState } from "../../components/common/Feedback";
import { useAuth } from "../../context/AuthContext";
import s from "../Page.module.css";

export default function ArticleEditor() {
  const { id } = useParams(); const navigate = useNavigate(); const { user } = useAuth();
  const [form, setForm] = useState({ title: "", content: "" }); const [article, setArticle] = useState(null); const [busy, setBusy] = useState(Boolean(id)); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const staff = ["admin", "agent"].includes(user?.role);
  useEffect(() => { let active = true; if (!id) return; knowledgeBaseService.get(id).then((data) => { if (active) { setArticle(data); setForm({ title: data.title || "", content: data.content || "" }); } }).catch((e) => { if (active) setError(getErrorMessage(e)); }).finally(() => { if (active) setBusy(false); }); return () => { active = false; }; }, [id]);
  async function submit(e) { e.preventDefault(); setError(""); setSaving(true); try { if (id) await knowledgeBaseService.update(id, form); else await knowledgeBaseService.create(form); navigate("/knowledge-base", { replace: true }); } catch (e2) { setError(getErrorMessage(e2, "Could not save article.")); } finally { setSaving(false); } }
  if (busy) return <LoadingState label="Loading article…" />;
  if (!staff) return <div className={s.inlineError}>Only administrators and agents can create or edit articles.</div>;
  return <div><div className={s.pageHead}><div><div className={s.eyebrow}>KNOWLEDGE MANAGEMENT</div><h1 className={s.title}>{id ? "Edit article" : "Create article"}</h1><p className={s.description}>Write accurate, reusable guidance that can be retrieved by the AI assistant.</p></div><Link to="/knowledge-base" className={s.button}><ArrowLeft size={14} />Back to knowledge base</Link></div>
    {article?.status === "published" && <div className={s.callout} style={{ marginBottom: 18 }}><BookOpenText size={18} /><div><strong>This article is published</strong>Saving changes to a published article triggers the backend's existing re-embedding workflow.</div></div>}
    {error && <div className={s.inlineError}>{error}</div>}
    <div className={s.formCard}><form onSubmit={submit}><div className={s.formField}><label htmlFor="title">Article title</label><input className={s.input} id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} minLength={2} maxLength={200} placeholder="e.g. Refund processing policy" required /></div><div className={s.formField}><label htmlFor="content">Article content</label><textarea className={s.textarea} id="content" style={{ minHeight: 280 }} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} minLength={20} maxLength={50000} placeholder="Describe the policy or process clearly. Include eligibility, steps, timelines, and exceptions." required /><span className={s.helper}>{form.content.length.toLocaleString()} / 50,000 characters · Minimum 20 characters.</span></div><div className={s.actions}><button className={`${s.button} ${s.primary}`} disabled={saving}><Save size={14} />{saving ? "Saving…" : id ? "Save changes" : "Create draft"}</button><Link to="/knowledge-base" className={s.button}>Cancel</Link></div></form></div>
  </div>;
}
