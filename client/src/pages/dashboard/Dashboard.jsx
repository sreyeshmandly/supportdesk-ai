import { useEffect, useState } from "react";
import { ArrowRight, BookOpenText, Bot, CircleCheck, Clock3, LifeBuoy, Plus, Sparkles, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { ticketService } from "../../services/ticketService";
import { getErrorMessage } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { LoadingState, ErrorState } from "../../components/common/Feedback";
import { StatusBadge, PriorityBadge, TriageBadge } from "../../components/common/Badges";
import s from "../Page.module.css";

function Stat({ icon: Icon, label, value, note }) { return <div className={s.statCard}><div className={s.statTop}><span>{label}</span><div className={s.statIcon}><Icon size={17} /></div></div><div className={s.statValue}>{value}</div><div className={s.statFoot}>{note}</div></div>; }
export default function Dashboard() {
  const { user } = useAuth(); const [tickets, setTickets] = useState([]); const [busy, setBusy] = useState(true); const [error, setError] = useState("");
  async function load() { setBusy(true); setError(""); try { const data = await ticketService.list({ page: 1, limit: 50 }); setTickets(data.tickets || []); } catch (e) { setError(getErrorMessage(e, "Could not load dashboard tickets.")); } finally { setBusy(false); } }
  useEffect(() => { load(); }, []);
  const count = (status) => tickets.filter((t) => t.status === status).length;
  const triaged = tickets.filter((t) => t.category || t.priority).length;
  return <div>
    <div className={s.pageHead}><div><div className={s.eyebrow}>YOUR SUPPORT OVERVIEW</div><h1 className={s.title}>Good to see you, {(user?.name || "there").split(" ")[0]}.</h1><p className={s.description}>Here’s what’s happening in your support workspace today.</p></div><div className={s.actions}><Link to="/ai-assistant" className={s.button}><Sparkles size={15} />Ask AI assistant</Link><Link to="/tickets/new" className={`${s.button} ${s.primary}`}><Plus size={16} />New ticket</Link></div></div>
    {error && <div className={s.inlineError}>{error} <button className="link-button" onClick={load}>Retry</button></div>}
    {busy ? <LoadingState /> : <>
      <div className={s.stats}>
        <Stat icon={LifeBuoy} label="Tickets in this view" value={tickets.length} note="Latest 50 tickets or fewer" />
        <Stat icon={Clock3} label="Open & pending" value={count("open") + count("pending")} note="Need attention from the team" />
        <Stat icon={CircleCheck} label="Resolved" value={count("resolved") + count("closed")} note="Resolved or closed in this view" />
        <Stat icon={Bot} label="AI classified" value={triaged} note="Have a category or priority assigned" />
      </div>
      <div className={s.page} style={{ marginTop: 22 }}>
        <div className={s.callout}><div><Sparkles size={18} /></div><div><strong>AI-assisted support, with your team in control</strong>New tickets can be queued for background triage. Use the ticket details page to review available priority, category, and processing status.</div></div>
        <section className={s.panel}><div className={s.panelHead}><div><h2 className={s.panelTitle}>Recent tickets</h2><div className={s.panelSub}>Latest tickets visible to your account</div></div><Link to="/tickets" className={s.button}>View all <ArrowRight size={14} /></Link></div>
          {tickets.length ? <div className={s.tableWrap}><table className={s.table}><thead><tr><th>Ticket</th><th>Status</th><th>Priority</th><th>Category</th><th>Created</th></tr></thead><tbody>{tickets.slice(0, 8).map((t) => <tr key={t.id}><td><Link className={s.tableLink} to={`/tickets/${t.id}`}>#{t.id} · {t.subject}</Link></td><td><StatusBadge status={t.status} /></td><td><PriorityBadge priority={t.priority} /></td><td>{t.category || <span className={s.muted}>Unclassified</span>}</td><td>{t.created_at ? new Date(t.created_at).toLocaleDateString() : "—"}</td></tr>)}</tbody></table></div> : <div className={s.empty}><div className={s.emptyIcon}><LifeBuoy size={20} /></div><h3>Your support queue is clear</h3><p>When tickets are created, they’ll appear here so your team can keep track of customer issues.</p><Link className={`${s.button} ${s.primary}`} to="/tickets/new">Create a ticket</Link></div>}
        </section>
        <div className={s.stats} style={{ gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))" }}>
          <Link to="/knowledge-base" className="feature-card"><div className="feature-icon"><BookOpenText size={19} /></div><strong>Knowledge base</strong><p>Maintain trusted answers your team can reuse.</p><span>Manage articles <ArrowRight size={13} /></span></Link>
          <Link to="/ai-assistant" className="feature-card"><div className="feature-icon"><Bot size={19} /></div><strong>AI knowledge assistant</strong><p>Ask questions grounded in published articles.</p><span>Ask a question <ArrowRight size={13} /></span></Link>
        </div>
      </div>
    </>}
  </div>;
}
