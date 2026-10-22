import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Filter, Plus, Search, RotateCw } from "lucide-react";
import { ticketService } from "../../services/ticketService";
import { getErrorMessage } from "../../services/api";
import { LoadingState } from "../../components/common/Feedback";
import { StatusBadge, PriorityBadge } from "../../components/common/Badges";
import s from "../Page.module.css";

export default function Tickets() {
  const [tickets, setTickets] = useState([]); const [status, setStatus] = useState(""); const [search, setSearch] = useState(""); const [busy, setBusy] = useState(true); const [error, setError] = useState("");
  async function load() { setBusy(true); setError(""); try { const data = await ticketService.list({ page: 1, limit: 50, ...(status ? { status } : {}) }); setTickets(data.tickets || []); } catch (e) { setError(getErrorMessage(e)); } finally { setBusy(false); } }
  useEffect(() => { load(); }, [status]);
  const visible = useMemo(() => tickets.filter((t) => `${t.subject} ${t.id} ${t.category || ""}`.toLowerCase().includes(search.toLowerCase())), [tickets, search]);
  return <div>
    <div className={s.pageHead}><div><div className={s.eyebrow}>CUSTOMER SUPPORT</div><h1 className={s.title}>Tickets</h1><p className={s.description}>Track requests, review AI classifications, and keep conversations moving.</p></div><Link to="/tickets/new" className={`${s.button} ${s.primary}`}><Plus size={15} />Create ticket</Link></div>
    <section className={s.panel}><div className={s.panelHead}><div><h2 className={s.panelTitle}>Ticket queue</h2><div className={s.panelSub}>Showing up to 50 results for the selected filter</div></div><div className={s.filters}><div style={{ position: "relative" }}><Search size={14} style={{ position: "absolute", left: 10, top: 12, color: "#9ba5b4" }} /><input className={s.search} style={{ paddingLeft: 30 }} placeholder="Search subject or ID…" value={search} onChange={(e) => setSearch(e.target.value)} /></div><select className={s.select} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status"><option value="">All statuses</option><option value="open">Open</option><option value="pending">Pending</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select><button className={s.button} onClick={load} title="Refresh tickets"><RotateCw size={14} /></button></div></div>
      {error && <div className={s.inlineError} style={{ margin: 16 }}>{error} <button className="link-button" onClick={load}>Retry</button></div>}
      {busy ? <LoadingState label="Loading tickets…" /> : visible.length ? <div className={s.tableWrap}><table className={s.table}><thead><tr><th>Ticket</th><th>Status</th><th>Priority</th><th>Category</th><th>Created</th><th></th></tr></thead><tbody>{visible.map((t) => <tr key={t.id}><td><Link className={s.tableLink} to={`/tickets/${t.id}`}>#{t.id} · {t.subject}</Link></td><td><StatusBadge status={t.status} /></td><td><PriorityBadge priority={t.priority} /></td><td>{t.category || <span className={s.muted}>Unclassified</span>}</td><td>{t.created_at ? new Date(t.created_at).toLocaleDateString() : "—"}</td><td><Link to={`/tickets/${t.id}`} className="small-link">Open →</Link></td></tr>)}</tbody></table></div> : <div className={s.empty}><div className={s.emptyIcon}><Filter size={20} /></div><h3>No matching tickets</h3><p>Try changing the status filter or search term, or create a new ticket.</p><button className={s.button} onClick={() => { setStatus(""); setSearch(""); }}>Clear filters</button></div>}
    </section>
  </div>;
}
