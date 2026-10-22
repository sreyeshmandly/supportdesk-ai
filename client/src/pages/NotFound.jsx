import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import s from "./Page.module.css";

export default function NotFound() {
  return <div className={s.empty}><div className={s.emptyIcon}>404</div><h3>We couldn't find that page</h3><p>The page may have moved or the URL may be incorrect.</p><Link className={`${s.button} ${s.primary}`} to="/dashboard"><ArrowLeft size={14} />Back to dashboard</Link></div>;
}
