import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Bot, Send, Sparkles } from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ticketService } from "../../services/ticketService";
import { userService } from "../../services/userService";
import { getErrorMessage } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { LoadingState, ErrorState } from "../../components/common/Feedback";
import { StatusBadge, PriorityBadge, TriageBadge } from "../../components/common/Badges";
import s from "../Page.module.css";

const nextStatuses = { open: ["pending", "resolved"], pending: ["open", "resolved"], resolved: ["open", "closed"], closed: [] };
export default function TicketDetails() {
  const { id } = useParams(); const { user } = useAuth(); const location = useLocation(); const navigate = useNavigate();
  const [ticket, setTicket] = useState(null); const [users, setUsers] = useState([]); const [body, setBody] = useState(""); const [isInternal, setIsInternal] = useState(false); const [busy, setBusy] = useState(true); const [sending, setSending] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const isStaff = ["admin", "agent"].includes(user?.role);
  const load = useCallback(async () => { setBusy(true); setError(""); try { const data = await ticketService.get(id); setTicket(data); if (isStaff) { try { setUsers(await userService.list()); } catch { setUsers([]); } } } catch (e) { setError(getErrorMessage(e, "Could not load ticket.")); } finally { setBusy(false); } }, [id, isStaff]);
  useEffect(() => { load(); }, [load]);
  async function sendMessage(e) { e.preventDefault(); setError(""); setSending(true); try { await ticketService.addMessage(id, { body, isInternal: isStaff && isInternal }); setBody(""); setIsInternal(false); setNotice("Your message was added."); await load(); } catch (e2) { setError(getErrorMessage(e2, "Could not send your message.")); } finally { setSending(false); } }
  async function changeStatus(next) { setError(""); try { await ticketService.update(id, { status: next }); setNotice(`Ticket status changed to ${next}.`); await load(); } catch (e) { setError(getErrorMessage(e, "Could not update status.")); } }
  async function assign(value) { setError(""); try { await ticketService.update(id, { assigneeId: value ? Number(value) : null }); setNotice("Assignee updated."); await load(); } catch (e) { setError(getErrorMessage(e, "Could not update assignee.")); } }
  if (busy) return <LoadingState label="Loading ticket…" />;
  if (error && !ticket) return <ErrorState message={error} onRetry={load} />;
  if (!ticket) return null;
  const assignee = users.find((u) => Number(u.id) === Number(ticket.assignee_id));
  return <div><div className={s.pageHead}><div><div className={s.eyebrow}>TICKET #{ticket.id}</div><h1 className={s.title}>{ticket.subject}</h1><p className={s.description}>Created {ticket.created_at ? new Date(ticket.created_at).toLocaleString() : "—"} · Keep the conversation clear and helpful.</p></div><Link to="/tickets" className={s.button}><ArrowLeft size={14} />Back to tickets</Link></div>
    {location.state?.created && <div className={s.inlineSuccess}>Ticket created successfully. {location.state.triageQueued ? "AI triage has been queued." : "The ticket was saved; background triage may be unavailable."}</div>}
    {notice && <div className={s.inlineSuccess}>{notice}</div>}{error && <div className={s.inlineError}>{error}</div>}
    <div className={s.detailGrid}><div className={s.page}>
      <section className={s.panel}><div className={s.panelHead}><div><h2 className={s.panelTitle}>Conversation</h2><div className={s.panelSub}>Messages and replies for this request</div></div><StatusBadge status={ticket.status} /></div><div style={{ padding: "0 20px" }}>
        <div className={s.message}><div className={s.messageTop}><div className={s.miniAvatar}>{(user?.name || "U")[0].toUpperCase()}</div><div><div className={s.messageName}>Ticket description</div><div className={s.messageDate}>Original request</div></div></div><div className={s.messageBody}>{ticket.body}</div></div>
        {(ticket.messages || []).map((m) => <div className={s.message} key={m.id}><div className={s.messageTop}><div className={s.miniAvatar}>{(m.author_name || "U")[0].toUpperCase()}</div><div><div className={s.messageName}>{m.author_name || "Workspace member"} {m.is_internal ? <span className="internal-note">INTERNAL NOTE</span> : null}</div><div className={s.messageDate}>{m.created_at ? new Date(m.created_at).toLocaleString() : ""}</div></div></div><div className={s.messageBody}>{m.body}</div></div>)}
      </div></section>
      {ticket.status !== "closed" && <section className={s.panel}><div className={s.panelHead}><div><h2 className={s.panelTitle}>Add a reply</h2><div className={s.panelSub}>Keep messages relevant and respectful.</div></div></div><form style={{ padding: 20 }} onSubmit={sendMessage}><div className={s.formField}><textarea className={s.textarea} value={body} onChange={(e) => setBody(e.target.value)} minLength={1} maxLength={5000} placeholder="Write your reply…" required /></div>{isStaff && <label className="checkbox-row"><input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} />Add as an internal note (not visible to customers)</label>}<div className={s.actions}><button className={`${s.button} ${s.primary}`} disabled={sending || !body.trim()}><Send size={14} />{sending ? "Sending…" : isInternal ? "Add internal note" : "Send reply"}</button></div></form></section>}
    </div>
    <aside className={s.panel}><div className={s.panelHead}><div><h2 className={s.panelTitle}>Ticket insights</h2><div className={s.panelSub}>Live fields from the support API</div></div><Bot size={17} color="#696fe0" /></div>
      <div className={s.sideSection}><div className={s.sideLabel}>Current status</div><StatusBadge status={ticket.status} />{isStaff && ticket.status !== "closed" && <select className={s.select} style={{ width: "100%", marginTop: 11 }} value="" onChange={(e) => e.target.value && changeStatus(e.target.value)}><option value="">Move to…</option>{(nextStatuses[ticket.status] || []).map((st) => <option key={st} value={st}>{st[0].toUpperCase() + st.slice(1)}</option>)}</select>}</div>
      <div className={s.sideSection}><div className={s.sideLabel}>AI triage</div><TriageBadge status={ticket.triage_status} /><div style={{ marginTop: 12 }}><div className={s.sideLabel}>Priority</div><PriorityBadge priority={ticket.priority} /></div><div style={{ marginTop: 12 }}><div className={s.sideLabel}>Category</div><div className={s.sideValue}>{ticket.category || "Not classified yet"}</div></div><p className={s.helper} style={{ marginTop: 12 }}>AI classification is processed in the background. The current API exposes these fields but not the full saved suggestion payload.</p></div>
      <div className={s.sideSection}><div className={s.sideLabel}>Requester ID</div><div className={s.sideValue}>User #{ticket.requester_id}</div></div>
      <div className={s.sideSection}><div className={s.sideLabel}>Assigned to</div><div className={s.sideValue}>{assignee?.name || (ticket.assignee_id ? `User #${ticket.assignee_id}` : "Unassigned")}</div>{isStaff && <select className={s.select} style={{ width: "100%", marginTop: 11 }} value={ticket.assignee_id || ""} onChange={(e) => assign(e.target.value)}><option value="">Unassigned</option>{users.filter((u) => ["admin", "agent"].includes(u.role)).map((u) => <option key={u.id} value={u.id}>{u.name} · {u.role}</option>)}</select>}</div>
      <div className={s.sideSection}><div className={s.sideLabel}>SLA due</div><div className={s.sideValue}>{ticket.sla_due_at ? new Date(ticket.sla_due_at).toLocaleString() : "Not set"}</div></div>
    </aside></div>
  </div>;
}
