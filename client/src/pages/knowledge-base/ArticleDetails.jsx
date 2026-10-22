import { useEffect, useState } from "react";
import { ArrowLeft, BookOpenText, CalendarDays, PencilLine } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { knowledgeBaseService } from "../../services/knowledgeBaseService";
import { getErrorMessage } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { LoadingState } from "../../components/common/Feedback";
import s from "../Page.module.css";

export default function ArticleDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const [article, setArticle] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const staff = ["admin", "agent"].includes(user?.role);

  useEffect(() => {
    let active = true;
    knowledgeBaseService.get(id)
      .then((data) => { if (active) setArticle(data); })
      .catch((e) => { if (active) setError(getErrorMessage(e, "Could not load this article.")); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [id]);

  if (busy) return <LoadingState label="Loading article…" />;
  if (error) return <div><div className={s.inlineError}>{error}</div><Link to="/knowledge-base" className={s.button}><ArrowLeft size={14} />Back to knowledge base</Link></div>;
  if (!article) return null;

  return <div>
    <div className={s.pageHead}>
      <div><div className={s.eyebrow}>KNOWLEDGE ARTICLE · #{article.id}</div><h1 className={s.title}>{article.title}</h1><p className={s.description}>Reference guidance from your organization's knowledge base.</p></div>
      <div className={s.actions}><Link to="/knowledge-base" className={s.button}><ArrowLeft size={14} />All articles</Link>{staff && <Link to={`/knowledge-base/${article.id}/edit`} className={`${s.button} ${s.primary}`}><PencilLine size={14} />Edit article</Link>}</div>
    </div>
    <div className={s.detailGrid}>
      <article className={s.panel}>
        <div className={s.panelHead}><div><h2 className={s.panelTitle}>Article content</h2><div className={s.panelSub}>Read the full policy or process below</div></div><BookOpenText size={18} color="#666de0" /></div>
        <div style={{ padding: 24 }} className={s.articleContent}>{article.content}</div>
      </article>
      <aside className={s.panel}>
        <div className={s.panelHead}><h2 className={s.panelTitle}>Article details</h2></div>
        <div className={s.sideSection}><div className={s.sideLabel}>Publication status</div><span className={`badge ${article.status === "published" ? "status-resolved" : "status-pending"}`}>{article.status}</span></div>
        <div className={s.sideSection}><div className={s.sideLabel}>AI indexing</div><div className={s.sideValue}>{article.embedded_at ? "Indexed for retrieval" : "Not yet indexed"}</div><p className={s.helper}>Only published, indexed content can be retrieved by the AI assistant.</p></div>
        {article.embedded_at && <div className={s.sideSection}><div className={s.sideLabel}>Last indexed</div><div className={s.sideValue}><CalendarDays size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />{new Date(article.embedded_at).toLocaleString()}</div></div>}
        <div className={s.sideSection}><div className={s.sideLabel}>Organization</div><div className={s.sideValue}>Current workspace</div><p className={s.helper}>The backend scopes article access to your organization.</p></div>
      </aside>
    </div>
  </div>;
}
