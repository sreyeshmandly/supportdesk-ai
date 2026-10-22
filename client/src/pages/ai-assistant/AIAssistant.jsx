import { useState } from "react";
import { Bot, BookOpenText, CornerDownLeft, Sparkles } from "lucide-react";
import { knowledgeBaseService } from "../../services/knowledgeBaseService";
import { getErrorMessage } from "../../services/api";
import s from "../Page.module.css";

const suggestions = [
  "What is the refund verification process?",
  "How long does an approved refund take?",
  "What should I include when escalating a support issue?",
];

export default function AIAssistant() {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  async function ask(value = question) {
    const clean = value.trim();

    if (clean.length < 3) {
      setError("Enter a question with at least 3 characters.");
      return;
    }

    setBusy(true);
    setError("");
    setResult(null);
    setQuestion(clean);

    try {
      const data = await knowledgeBaseService.ask(clean);

      setResult(data);

      setHistory((old) =>
        [
          {
            question: clean,
            answer: data.answer,
            time: new Date(),
          },
          ...old,
        ].slice(0, 5)
      );
    } catch (e) {
      setError(
        getErrorMessage(
          e,
          "The AI assistant could not answer this question."
        )
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className={s.pageHead}>
        <div>
          <div className={s.eyebrow}>GROUNDED AI WORKSPACE</div>

          <h1 className={s.title}>AI knowledge assistant</h1>

          <p className={s.description}>
            Ask a question and get an answer grounded in your organization's
            published knowledge.
          </p>
        </div>

        <div className={s.actions}>
          <span className="ai-status">
            <span />
            Gemini RAG connected through API
          </span>
        </div>
      </div>

      <div className="assistant-grid">
        <section className={s.panel}>
          <div className="assistant-hero">
            <div className="assistant-orb">
              <Bot size={25} />
            </div>

            <span className={s.eyebrow}>SUPPORTDESK AI</span>

            <h2>What can I help you find?</h2>

            <p>
              Ask about a policy, process, or support workflow. Answers
              include source references when relevant knowledge is available.
            </p>
          </div>

          <div style={{ padding: "0 22px 22px" }}>
            <div className="suggestions-label">TRY ASKING</div>

            <div className="suggestions">
              {suggestions.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => {
                    setQuestion(q);
                    ask(q);
                  }}
                  disabled={busy}
                >
                  {q}
                  <CornerDownLeft size={13} />
                </button>
              ))}
            </div>

            {error && (
              <div className={s.inlineError} style={{ marginTop: 16 }}>
                {error}
              </div>
            )}

            {busy && (
              <div className={s.loading}>
                <span className={s.spin}>◌</span>
                Searching published knowledge and generating an answer...
              </div>
            )}

            {result && (
              <div className="answer-card">
                <div className="answer-head">
                  <div className="answer-mark">
                    <Sparkles size={17} />
                  </div>

                  <div>
                    <strong>AI response</strong>
                    <small>
                      {result.model || "Configured Gemini model"} ·{" "}
                      {result.sources?.length || 0} source(s)
                    </small>
                  </div>
                </div>

                <div className={s.answer}>{result.answer}</div>

                {result.sources?.length > 0 ? (
                  <div className="source-list">
                    <div className="suggestions-label">SOURCES USED</div>

                    {result.sources.map((source, i) => (
                      <div
                        className={s.source}
                        key={`${source.articleId}-${source.chunkIndex}-${i}`}
                      >
                        <strong>
                          <BookOpenText
                            size={14}
                            style={{
                              verticalAlign: "middle",
                              marginRight: 6,
                            }}
                          />
                          {source.title || `Article #${source.articleId}`}
                        </strong>

                        <small>
                          Article #{source.articleId} · Chunk{" "}
                          {source.chunkIndex + 1} · Relevance{" "}
                          {(Number(source.similarity || 0) * 100).toFixed(0)}%
                        </small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={s.callout} style={{ marginTop: 15 }}>
                    No source articles were returned. Treat the answer
                    cautiously and consider adding or publishing relevant
                    knowledge.
                  </div>
                )}
              </div>
            )}

            <form
              className="ask-form"
              onSubmit={(e) => {
                e.preventDefault();
                ask();
              }}
            >
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask a question about your support knowledge..."
                maxLength={2000}
                rows={3}
              />

              <div className="ask-bottom">
                <span>
                  {question.length}/2000 · Answers may be incomplete if
                  knowledge is missing.
                </span>

                <button
                  type="submit"
                  className={`${s.button} ${s.primary}`}
                  disabled={busy || question.trim().length < 3}
                >
                  <Sparkles size={14} />
                  Ask assistant
                </button>
              </div>
            </form>
          </div>
        </section>

        <aside className={s.panel}>
          <div className={s.panelHead}>
            <div>
              <h2 className={s.panelTitle}>How answers work</h2>
              <div className={s.panelSub}>
                Retrieval-augmented generation
              </div>
            </div>

            <Sparkles size={17} color="#666de0" />
          </div>

          <div className={s.sideSection}>
            <div className="process-number">01</div>
            <div className={s.sideValue}>Search your knowledge</div>
            <p className={s.description}>
              The API retrieves relevant chunks from published articles in
              your organization.
            </p>
          </div>

          <div className={s.sideSection}>
            <div className="process-number">02</div>
            <div className={s.sideValue}>Generate a grounded response</div>
            <p className={s.description}>
              Gemini receives the question and retrieved context to draft an
              answer.
            </p>
          </div>

          <div className={s.sideSection}>
            <div className="process-number">03</div>
            <div className={s.sideValue}>Review the sources</div>
            <p className={s.description}>
              Check source article references and relevance before relying on
              an answer.
            </p>
          </div>

          <div className={s.sideSection}>
            <div className={s.sideLabel}>
              Recent questions in this session
            </div>

            {history.length ? (
              history.map((h, i) => (
                <button
                  key={`${h.question}-${i}`}
                  type="button"
                  className="history-item"
                  onClick={() => {
                    setQuestion(h.question);
                    setResult({
                      question: h.question,
                      answer: h.answer,
                      sources: [],
                      model: "",
                    });
                    setError("");
                  }}
                >
                  {h.question}
                </button>
              ))
            ) : (
              <p className={s.description}>
                Your recent questions will appear here while this page is
                open.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
