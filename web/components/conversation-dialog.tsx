"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ArrowUp,
  Check,
  Copy,
  Flag,
  LockKeyhole,
  MessageCircle,
  Pin,
  Send,
  ShieldCheck,
  Trash2,
  RefreshCw,
} from "lucide-react";
import {
  categoryFor,
  STATUS_LABELS,
  type ConversationDetail,
  type Session,
  type Status,
} from "@/lib/domain";
import { errorMessage, type ApiClient } from "@/lib/client";
import { Dialog, RepBadge, Spinner, StatusBadge, Timestamp } from "./ui";

export default function ConversationDialog({
  id,
  session,
  request,
  onClose,
  onChange,
  notify,
}: {
  id: string;
  session: Session;
  request: ApiClient;
  onClose: () => void;
  onChange: () => void;
  notify: (message: string) => void;
}) {
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [error, setError] = useState("");
  const [body, setBody] = useState("");
  const [asRep, setAsRep] = useState(session.isRep);
  const [busy, setBusy] = useState("");
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [reportList, setReportList] = useState<
    { reason: string; createdAt: number }[] | null
  >(null);
  useEffect(() => setAsRep(session.isRep), [session.isRep]);
  const load = useCallback(async () => {
    setError("");
    try {
      setDetail(await request<ConversationDetail>(`conversations/${id}`));
    } catch (error) {
      setError(errorMessage(error));
    }
  }, [id, request]);
  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const data = await request<ConversationDetail>(`conversations/${id}`);
        if (active) {
          setDetail(data);
          setError("");
        }
      } catch (error) {
        if (active) setError(errorMessage(error));
      }
    }
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [id, request]);
  async function mutate(path: string, method: string, values?: unknown) {
    setBusy(path || "update");
    setError("");
    try {
      const data = await request<ConversationDetail>(
        `conversations/${id}${path ? `/${path}` : ""}`,
        {
          method,
          ...(values === undefined ? {} : { body: JSON.stringify(values) }),
        },
      );
      setDetail(data);
      onChange();
      return true;
    } catch (error) {
      setError(errorMessage(error));
      return false;
    } finally {
      setBusy("");
    }
  }
  async function reply(event: FormEvent) {
    event.preventDefault();
    if (
      await mutate("replies", "POST", { body, asRep: session.isRep && asRep })
    )
      setBody("");
  }
  async function copyLink() {
    const url = new URL(window.location.href);
    url.searchParams.set("conversation", id);
    try {
      await navigator.clipboard.writeText(url.toString());
      notify("Conversation link copied.");
    } catch {
      notify("The link is in your browser’s address bar.");
    }
  }
  async function report(event: FormEvent) {
    event.preventDefault();
    setBusy("report");
    setError("");
    try {
      await request(`conversations/${id}/report`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      setReporting(false);
      setReason("");
      notify("Sent to your reps for review.");
      onChange();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy("");
    }
  }
  async function remove() {
    setBusy("delete");
    try {
      await request(`conversations/${id}`, { method: "DELETE" });
      onChange();
      onClose();
      notify("Conversation deleted.");
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy("");
    }
  }
  async function reviewReports() {
    setBusy("reports");
    try {
      const data = await request<{
        reports: { reason: string; createdAt: number }[];
      }>(`conversations/${id}/reports`);
      setReportList(data.reports);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy("");
    }
  }
  const thread = detail?.conversation;
  const category = thread && categoryFor(thread.category);
  return (
    <Dialog
      title="The conversation"
      eyebrow={
        thread?.visibility === "private"
          ? "JUST YOU & YOUR REPS"
          : "THE COMMON ROOM"
      }
      wide
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      {!thread ? (
        <div className="dialog-loading">
          {error ? (
            <>
              <p className="form-error" role="alert">
                {error}
              </p>
              <button className="button button-subtle" onClick={load}>
                <RefreshCw size={15} />
                Try again
              </button>
            </>
          ) : (
            <Spinner label="Loading conversation" />
          )}
        </div>
      ) : (
        <>
          <div className="conversation-detail">
            <div className="detail-meta">
              <span className={`topic-tag topic-${category?.color}`}>
                <span />
                {category?.label}
              </span>
              {thread.course && (
                <span className="course-tag">{thread.course}</span>
              )}
              <StatusBadge status={thread.status} />
              {thread.visibility === "private" && (
                <span className="private-tag">
                  <LockKeyhole size={12} />
                  Private
                </span>
              )}
            </div>
            <h1>{thread.title}</h1>
            <div className="author-line">
              <span
                className={`avatar ${thread.kind === "update" ? "avatar-rep" : ""}`}
              >
                {thread.kind === "update" ? (
                  <ShieldCheck size={17} />
                ) : (
                  <span className="anonymous-eyes">••</span>
                )}
              </span>
              <strong>
                {thread.kind === "update"
                  ? "Your academic reps"
                  : "Anonymous student"}
              </strong>
              {thread.isMine && <span className="you-badge">you</span>}
              <span className="meta-separator">·</span>
              <Timestamp value={thread.createdAt} />
            </div>
            <p className="message-body">{thread.body}</p>
            <div className="detail-actions">
              {thread.visibility === "public" && (
                <button
                  className={`button button-subtle ${thread.voted ? "has-voted" : ""}`}
                  disabled={!!busy}
                  onClick={() =>
                    mutate("vote", "PUT", { voted: !thread.voted })
                  }
                >
                  <ArrowUp size={16} />
                  {thread.voteCount}
                  <span>I have this too</span>
                </button>
              )}
              <button className="text-button" onClick={copyLink}>
                <Copy size={14} />
                Copy link
              </button>
              <span className="action-spacer" />
              {!thread.isMine && (
                <button
                  className="icon-button"
                  aria-label="Report conversation"
                  title="Report to your reps"
                  onClick={() => setReporting(!reporting)}
                >
                  <Flag size={15} />
                </button>
              )}
              {(thread.isMine || session.isRep) && (
                <button
                  className="icon-button danger-text"
                  aria-label="Delete conversation"
                  title="Delete conversation"
                  onClick={() => setDeleting(!deleting)}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
            {session.isRep && (
              <div className="rep-controls">
                <span>
                  <ShieldCheck size={15} />
                  Rep tools
                </span>
                <label className="sr-only" htmlFor="rep-status">
                  Conversation status
                </label>
                <select
                  id="rep-status"
                  className="input"
                  value={thread.status}
                  disabled={!!busy}
                  onChange={(event) =>
                    mutate("", "PATCH", {
                      status: event.target.value as Status,
                    })
                  }
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  className={`button button-subtle ${thread.pinned ? "has-voted" : ""}`}
                  disabled={!!busy}
                  onClick={() =>
                    mutate("", "PATCH", { pinned: !thread.pinned })
                  }
                >
                  <Pin size={14} />
                  {thread.pinned ? "Unpin" : "Pin"}
                </button>
                {thread.reportCount > 0 && (
                  <button
                    className="text-button danger-text"
                    onClick={reviewReports}
                    disabled={!!busy}
                  >
                    <Flag size={14} />
                    Review {thread.reportCount} report
                    {thread.reportCount !== 1 && "s"}
                  </button>
                )}
              </div>
            )}
            {reportList && (
              <div className="report-list">
                <h3>Reports for review</h3>
                {reportList.map((report, index) => (
                  <div key={index}>
                    <p>{report.reason}</p>
                    <Timestamp value={report.createdAt} />
                  </div>
                ))}
                <button
                  className="text-button"
                  onClick={() => setReportList(null)}
                >
                  Close reports
                </button>
              </div>
            )}
            {deleting && (
              <div className="inline-confirm">
                <p>
                  Delete this conversation and all its replies? This can’t be
                  undone.
                </p>
                <div>
                  <button
                    className="button button-danger"
                    disabled={!!busy}
                    onClick={remove}
                  >
                    Delete conversation
                  </button>
                  <button
                    className="text-button"
                    onClick={() => setDeleting(false)}
                  >
                    Keep it
                  </button>
                </div>
              </div>
            )}
            {reporting && (
              <form className="report-form" onSubmit={report}>
                <label className="field-label" htmlFor="report-reason">
                  What should your reps review?
                </label>
                <textarea
                  id="report-reason"
                  className="input"
                  rows={3}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  minLength={5}
                  maxLength={500}
                  required
                />
                <div>
                  <button className="button button-primary" disabled={!!busy}>
                    Send report
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setReporting(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
          <div className="replies-section">
            <div className="replies-heading">
              <h3>
                <MessageCircle size={17} />
                {thread.replyCount}{" "}
                {thread.replyCount === 1 ? "reply" : "replies"}
              </h3>
              <span>
                <span className="live-dot" />
                Refreshes automatically
              </span>
            </div>
            {thread.replyCount > detail.replies.length && (
              <p className="no-replies">
                Showing the latest {detail.replies.length} of{" "}
                {thread.replyCount} replies.
              </p>
            )}
            {detail.replies.length === 0 && (
              <p className="no-replies">
                A little quiet in here. Leave a reply to keep the conversation
                going.
              </p>
            )}
            {detail.replies.map((reply) => (
              <article
                key={reply.id}
                className={`reply ${reply.isRep ? "reply-rep" : ""}`}
              >
                <span className={`avatar ${reply.isRep ? "avatar-rep" : ""}`}>
                  {reply.isRep ? (
                    <ShieldCheck size={17} />
                  ) : (
                    <span className="anonymous-eyes">••</span>
                  )}
                </span>
                <div className="reply-content">
                  <div className="reply-meta">
                    <strong>{reply.authorName}</strong>
                    {reply.isRep && <RepBadge />}
                    {reply.isMine && <span className="you-badge">you</span>}
                    <Timestamp value={reply.createdAt} />
                  </div>
                  <p className="message-body">{reply.body}</p>
                </div>
              </article>
            ))}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <form className="reply-form" onSubmit={reply}>
              <label className="sr-only" htmlFor="reply-body">
                Your reply
              </label>
              <textarea
                id="reply-body"
                className="input"
                placeholder={
                  session.isRep && asRep
                    ? "Reply to the conversation as an academic rep…"
                    : "Add to the conversation. Your name stays out of it…"
                }
                rows={3}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                minLength={2}
                maxLength={4000}
                required
              />
              <div className="reply-form-footer">
                {session.isRep ? (
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={asRep}
                      onChange={(event) => setAsRep(event.target.checked)}
                    />
                    <ShieldCheck size={14} />
                    Reply as an academic rep
                  </label>
                ) : (
                  <span>
                    <LockKeyhole size={14} />
                    Replying anonymously
                  </span>
                )}
                <button
                  className="button button-primary"
                  disabled={!!busy || body.trim().length < 2}
                >
                  {busy === "replies" ? (
                    <Spinner />
                  ) : (
                    <>
                      <Send size={15} />
                      Send reply
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </Dialog>
  );
}
