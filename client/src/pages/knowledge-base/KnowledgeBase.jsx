import { useEffect, useState } from "react";
import { BookOpenText, FileText, Plus, RotateCw, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { knowledgeBaseService } from "../../services/knowledgeBaseService";
import { getErrorMessage } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { LoadingState } from "../../components/common/Feedback";
import s from "../Page.module.css";

export default function KnowledgeBase() {
  const { user } = useAuth(); const [articles, setArticles] = useState([]); const [search, setSearch] = useState(""); const [busy, setBusy] = useState(true); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const staff = ["admin", "agent"].includes(user?.role);
  async function load() { setBusy(true); setError(""); try { setArticles(await knowledgeBaseService.list()); } catch (e) { setError(getErrorMessage(e)); } finally { setBusy(false); } }
  useEffect(() => { load(); }, []);
  async function publish(id) { setError(""); setNotice(""); try { const result = await knowledgeBaseService.publish(id); setNotice(`Article published and ${result.chunksIndexed} knowledge chunks indexed.`); await load(); } catch (e) { setError(getErrorMessage(e, "Publishing failed. Check the backend AI configuration.")); } }
  const visible = articles.filter((a) => (a.title || "").toLowerCase().includes(search.toLowerCase()));
  return <div><div className={s.pageHead}><div><div className={s.eyebrow}>SHARED KNOWLEDGE</div><h1 className={s.title}>Knowledge base</h1><p className={s.description}>Build a trusted source of answers for your team and AI assistant.</p></div>{staff && <Link to="/knowledge-base/new" className={`${s.button} ${s.primary}`}><Plus size={15} />New article</Link>}</div>
    <div className={s.callout} style={{ marginBottom: 20 }}><BookOpenText size={18} /><div><strong>Publish to make articles available to the AI assistant</strong>Published articles are indexed by the existing Gemini embedding workflow. Drafts remain available to authorized staff for editing.</div></div>
    {notice && <div className={s.inlineSuccess}>{notice}</div>}{error && <div className={s.inlineError}>{error} <button className="link-button" onClick={load}>Retry</button></div>}
    <section className={s.panel}><div className={s.panelHead}><div><h2 className={s.panelTitle}>Articles</h2><div className={s.panelSub}>{articles.length} article{articles.length === 1 ? "" : "s"} returned by your workspace API</div></div><div className={s.filters}><div style={{ position: "relative" }}><Search size={14} style={{ position: "absolute", left: 10, top: 12, color: "#9ba5b4" }} /><input className={s.search} style={{ paddingLeft: 30 }} placeholder="Search articles…" value={search} onChange={(e) => setSearch(e.target.value)} /></div><button className={s.button} onClick={load} aria-label="Refresh articles"><RotateCw size={14} /></button></div></div>
      {busy ? <LoadingState label="Loading articles…" /> : visible.length ? <div className={s.tableWrap}><table className={s.table}><thead><tr><th>Article</th><th>Status</th><th>Indexing</th><th>Actions</th></tr></thead><tbody>{visible.map((a) => <tr key={a.id}><td><Link className={s.tableLink} to={staff ? `/knowledge-base/${a.id}/edit` : `/knowledge-base/${a.id}`}>{a.title}</Link><div className={s.muted} style={{ marginTop: 5 }}>Article #{a.id}</div></td><td><span className={`badge ${a.status === "published" ? "status-resolved" : "status-pending"}`}>{a.status}</span></td><td>{a.embedded_at ? <span className="indexed"><span />Indexed</span> : <span className={s.muted}>Not indexed</span>}</td><td><div className={s.actions}>{staff && a.status !== "published" && <button className={s.button} onClick={() => publish(a.id)}>Publish & index</button>}{staff && <Link className={s.button} to={`/knowledge-base/${a.id}/edit`}>Edit</Link>}</div></td></tr>)}</tbody></table></div> : <div className={s.empty}><div className={s.emptyIcon}><FileText size={20} /></div><h3>No articles found</h3><p>{search ? "Try a different search term." : "Create your first knowledge article to give your team a reliable source of answers."}</p>{staff && !search && <Link to="/knowledge-base/new" className={`${s.button} ${s.primary}`}>Create article</Link>}</div>}
    </section>
  </div>;
}
