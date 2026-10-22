const statusLabels = { open: "Open", pending: "Pending", resolved: "Resolved", closed: "Closed" };
const priorityLabels = { low: "Low", medium: "Medium", high: "High", urgent: "Urgent" };

export function StatusBadge({ status }) {
  return <span className={`badge status-${String(status || "unknown").toLowerCase()}`}>{statusLabels[status] || status || "Unknown"}</span>;
}
export function PriorityBadge({ priority }) {
  if (!priority) return <span className="muted">Not set</span>;
  return <span className={`badge priority-${String(priority).toLowerCase()}`}>{priorityLabels[priority] || priority}</span>;
}
export function TriageBadge({ status }) {
  const labels = { pending: "Waiting", queued: "Queued", completed: "Analyzed", failed: "Needs retry", skipped: "Skipped" };
  return <span className={`badge triage-${status || "pending"}`}>{labels[status] || "Not available"}</span>;
}
