import { useEffect, useState } from "react";
import {
BookOpenText,
FileText,
Plus,
RotateCw,
Search,
Sparkles,
Send,
LoaderCircle,
MessageSquareText,
BookOpen,
} from "lucide-react";
import { Link } from "react-router-dom";
import { knowledgeBaseService } from "../../services/knowledgeBaseService";
import { getErrorMessage } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { LoadingState } from "../../components/common/Feedback";
import s from "../Page.module.css";

export default function KnowledgeBase() {
const { user } = useAuth();

const [articles, setArticles] = useState([]);
const [search, setSearch] = useState("");
const [busy, setBusy] = useState(true);
const [error, setError] = useState("");
const [notice, setNotice] = useState("");

const [question, setQuestion] = useState("");
const [asking, setAsking] = useState(false);
const [askError, setAskError] = useState("");
const [answerResult, setAnswerResult] = useState(null);

const staff = ["admin", "agent"].includes(user?.role);

async function load() {
setBusy(true);
setError("");


try {
  setArticles(await knowledgeBaseService.list());
} catch (e) {
  setError(getErrorMessage(e));
} finally {
  setBusy(false);
}


}

useEffect(() => {
load();
}, []);

async function publish(id) {
setError("");
setNotice("");

try {
  const result = await knowledgeBaseService.publish(id);
  setNotice(
    `Article published and ${result.chunksIndexed} knowledge chunks indexed.`
  );
  await load();
} catch (e) {
  setError(
    getErrorMessage(e, "Publishing failed. Check the backend AI configuration.")
  );
}


}

async function askQuestion(event) {
event.preventDefault();


const trimmedQuestion = question.trim();

if (!trimmedQuestion || asking) {
  return;
}

setAsking(true);
setAskError("");
setAnswerResult(null);

try {
  const result = await knowledgeBaseService.ask(trimmedQuestion);
  setAnswerResult(result);
} catch (e) {
  setAskError(
    getErrorMessage(
      e,
      "Could not generate an answer. Please try again."
    )
  );
} finally {
  setAsking(false);
}


}

const visible = articles.filter((article) =>
(article.title || "").toLowerCase().includes(search.toLowerCase())
);

return ( <div> <div className={s.pageHead}> <div> <div className={s.eyebrow}>SHARED KNOWLEDGE</div> <h1 className={s.title}>Knowledge base</h1> <p className={s.description}>
Build a trusted source of answers for your team and AI assistant. </p> </div>


    {staff && (
      <Link
        to="/knowledge-base/new"
        className={`${s.button} ${s.primary}`}
      >
        <Plus size={15} />
        New article
      </Link>
    )}
  </div>

  <div className={s.callout} style={{ marginBottom: 20 }}>
    <BookOpenText size={18} />
    <div>
      <strong>
        Publish to make articles available to the AI assistant
      </strong>
      Published articles are indexed by the existing Gemini embedding
      workflow. Drafts remain available to authorized staff for editing.
    </div>
  </div>

  {notice && <div className={s.inlineSuccess}>{notice}</div>}

  {error && (
    <div className={s.inlineError}>
      {error}{" "}
      <button className="link-button" onClick={load}>
        Retry
      </button>
    </div>
  )}

  {/* Ask AI */}
  <section className={s.panel} style={{ marginBottom: 24 }}>
    <div className={s.panelHead}>
      <div>
        <h2
          className={s.panelTitle}
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          <Sparkles size={17} />
          Ask AI
        </h2>
        <div className={s.panelSub}>
          Get answers grounded in your published knowledge-base articles.
        </div>
      </div>
    </div>

    <div style={{ padding: 20 }}>
      <form onSubmit={askQuestion}>
        <div className={s.formField}>
          <label htmlFor="knowledge-base-question">
            What would you like to know?
          </label>

          <textarea
            id="knowledge-base-question"
            className={s.textarea}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="For example: How long does an approved refund take to process?"
            minLength={1}
            maxLength={2000}
            required
            disabled={asking}
            style={{ minHeight: 105 }}
          />

          <span className={s.helper}>
            Answers are generated using relevant published articles.
            Verify important decisions against your official policies.
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span className={s.roleNote}>
            {question.length}/2000 characters
          </span>

          <button
            type="submit"
            className={`${s.button} ${s.primary}`}
            disabled={asking || !question.trim()}
          >
            {asking ? (
              <>
                <LoaderCircle size={15} className={s.spin} />
                Generating answer...
              </>
            ) : (
              <>
                <Send size={14} />
                Ask AI
              </>
            )}
          </button>
        </div>
      </form>

      {askError && (
        <div
          className={s.inlineError}
          role="alert"
          style={{ marginTop: 18, marginBottom: 0 }}
        >
          {askError}
        </div>
      )}

      {asking && (
        <div
          className={s.loading}
          role="status"
          aria-live="polite"
          style={{ padding: "28px 12px" }}
        >
          <LoaderCircle size={18} className={s.spin} />
          Searching published articles and generating an answer...
        </div>
      )}

      {answerResult && !asking && (
        <div
          aria-live="polite"
          style={{
            marginTop: 22,
            borderTop: "1px solid #edf0f5",
            paddingTop: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <MessageSquareText size={17} />
            <h3
              style={{
                margin: 0,
                fontSize: 13,
                color: "#263448",
              }}
            >
              Answer
            </h3>
          </div>

          <div
            className={s.answer}
            style={{
              padding: 16,
              background: "#f8f9ff",
              border: "1px solid #e7e9ff",
              borderRadius: 10,
            }}
          >
            {answerResult.answer}
          </div>

          <div style={{ marginTop: 18 }}>
            <h3
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                color: "#344256",
                margin: "0 0 10px",
              }}
            >
              <BookOpen size={15} />
              Retrieved sources ({answerResult.sources?.length || 0})
            </h3>

            {answerResult.sources?.length > 0 ? (
              answerResult.sources.map((source, index) => (
                <div className={s.source} key={`${source.articleId}-${source.chunkIndex}-${index}`}>
                  <strong>{source.title}</strong>

                  <small>
                    Article #{source.articleId}
                    {" · "}
                    Chunk {source.chunkIndex}
                    {" · "}
                    Similarity:{" "}
                    {typeof source.similarity === "number"
                      ? source.similarity.toFixed(4)
                      : "Unavailable"}
                  </small>
                </div>
              ))
            ) : (
              <div className={s.callout} style={{ marginTop: 10 }}>
                No relevant published sources were retrieved. Treat the
                answer cautiously and add or publish the relevant policy
                before relying on it.
              </div>
            )}
          </div>

          {answerResult.model && (
            <div className={s.roleNote} style={{ marginTop: 14 }}>
              Generated by {answerResult.model}
            </div>
          )}
        </div>
      )}
    </div>
  </section>

  {/* Existing article management */}
  <section className={s.panel}>
    <div className={s.panelHead}>
      <div>
        <h2 className={s.panelTitle}>Articles</h2>
        <div className={s.panelSub}>
          {articles.length} article
          {articles.length === 1 ? "" : "s"} returned by your workspace API
        </div>
      </div>

      <div className={s.filters}>
        <div style={{ position: "relative" }}>
          <Search
            size={14}
            style={{
              position: "absolute",
              left: 10,
              top: 12,
              color: "#9ba5b4",
            }}
          />

          <input
            className={s.search}
            style={{ paddingLeft: 30 }}
            placeholder="Search articles..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <button
          className={s.button}
          onClick={load}
          aria-label="Refresh articles"
          disabled={busy}
        >
          <RotateCw size={14} className={busy ? s.spin : undefined} />
        </button>
      </div>
    </div>

    {busy ? (
      <LoadingState label="Loading articles..." />
    ) : visible.length ? (
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Article</th>
              <th>Status</th>
              <th>Indexing</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {visible.map((article) => (
              <tr key={article.id}>
                <td>
                  <Link
                    className={s.tableLink}
                    to={
                      staff
                        ? `/knowledge-base/${article.id}/edit`
                        : `/knowledge-base/${article.id}`
                    }
                  >
                    {article.title}
                  </Link>

                  <div className={s.muted} style={{ marginTop: 5 }}>
                    Article #{article.id}
                  </div>
                </td>

                <td>
                  <span
                    className={`badge ${
                      article.status === "published"
                        ? "status-resolved"
                        : "status-pending"
                    }`}
                  >
                    {article.status}
                  </span>
                </td>

                <td>
                  {article.embedded_at ? (
                    <span className="indexed">
                      <span />
                      Indexed
                    </span>
                  ) : (
                    <span className={s.muted}>Not indexed</span>
                  )}
                </td>

                <td>
                  <div className={s.actions}>
                    {staff && article.status !== "published" && (
                      <button
                        className={s.button}
                        onClick={() => publish(article.id)}
                      >
                        Publish & index
                      </button>
                    )}

                    {staff && (
                      <Link
                        className={s.button}
                        to={`/knowledge-base/${article.id}/edit`}
                      >
                        Edit
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <div className={s.empty}>
        <div className={s.emptyIcon}>
          <FileText size={20} />
        </div>

        <h3>No articles found</h3>

        <p>
          {search
            ? "Try a different search term."
            : "Create your first knowledge article to give your team a reliable source of answers."}
        </p>

        {staff && !search && (
          <Link
            to="/knowledge-base/new"
            className={`${s.button} ${s.primary}`}
          >
            Create article
          </Link>
        )}
      </div>
    )}
  </section>
</div>


);
}
