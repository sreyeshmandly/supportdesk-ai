import { AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react";

export function LoadingState({ label = "Loading…" }) {
  return <div className="loading-state"><LoaderCircle className="spin" size={19} />{label}</div>;
}
export function ErrorState({ message, onRetry }) {
  return <div className="feedback error-feedback"><AlertCircle size={19} /><span>{message}</span>{onRetry && <button className="text-button" onClick={onRetry}>Try again</button>}</div>;
}
export function SuccessNotice({ children }) {
  return <div className="feedback success-feedback"><CheckCircle2 size={18} /><span>{children}</span></div>;
}
export function EmptyState({ title, description, action }) {
  return <div className="empty-state"><div className="empty-icon">✦</div><h3>{title}</h3><p>{description}</p>{action}</div>;
}
