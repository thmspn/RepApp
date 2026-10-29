"use client";
import { useState, type FormEvent } from "react";
import { ArrowRight, Globe, LockKeyhole, ShieldCheck } from "lucide-react";
import {
  CATEGORIES,
  type Category,
  type ConversationDetail,
} from "@/lib/domain";
import { errorMessage, type ApiClient } from "@/lib/client";
import { Dialog, Spinner } from "./ui";

export type Draft = {
  title: string;
  body: string;
  category: Category;
  course: string;
  visibility: "public" | "private";
  kind: "concern" | "update";
};
export const emptyDraft: Draft = {
  title: "",
  body: "",
  category: "academics",
  course: "",
  visibility: "public",
  kind: "concern",
};
export default function ComposeDialog({
  draft,
  setDraft,
  request,
  onClose,
  onCreated,
}: {
  draft: Draft;
  setDraft: (draft: Draft) => void;
  request: ApiClient;
  onClose: () => void;
  onCreated: (detail: ConversationDetail) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const update = (values: Partial<Draft>) => setDraft({ ...draft, ...values });
  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      onCreated(
        await request<ConversationDetail>("conversations", {
          method: "POST",
          body: JSON.stringify(draft),
        }),
      );
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog
      title={
        draft.kind === "update"
          ? "An update for your class."
          : "What’s on your mind?"
      }
      eyebrow={
        draft.kind === "update" ? "FROM YOUR REPS" : "START A CONVERSATION"
      }
      onClose={() => {
        if (!pending) onClose();
      }}
    >
      <form className="compose-form" onSubmit={submit}>
        <p className="dialog-intro">
          {draft.kind === "update"
            ? "Share a class update. It will be marked as an official rep announcement."
            : "A question, a concern, or an idea. This is a good place for it."}
        </p>
        <label className="field-label" htmlFor="conversation-title">
          Give it a title <span>{draft.title.length}/160</span>
        </label>
        <input
          id="conversation-title"
          className="input title-input"
          placeholder="The thing I’ve been meaning to ask…"
          value={draft.title}
          onChange={(event) => update({ title: event.target.value })}
          minLength={8}
          maxLength={160}
          required
          autoFocus
        />
        <div className="form-row">
          <div>
            <label className="field-label" htmlFor="conversation-topic">
              Topic
            </label>
            <select
              id="conversation-topic"
              className="input"
              value={draft.category}
              onChange={(event) =>
                update({ category: event.target.value as Category })
              }
            >
              {CATEGORIES.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="conversation-course">
              Course <span>optional</span>
            </label>
            <input
              id="conversation-course"
              className="input"
              placeholder="e.g. MATH 115"
              value={draft.course}
              onChange={(event) => update({ course: event.target.value })}
              maxLength={24}
              pattern="[a-zA-Z0-9 \-]*"
            />
          </div>
        </div>
        <label className="field-label" htmlFor="conversation-body">
          Tell us a little more <span>{draft.body.length}/5,000</span>
        </label>
        <textarea
          id="conversation-body"
          className="input"
          rows={6}
          placeholder="A little context helps your reps understand. Please leave out names and identifying details."
          value={draft.body}
          onChange={(event) => update({ body: event.target.value })}
          minLength={20}
          maxLength={5000}
          required
        />
        {draft.kind === "concern" && (
          <fieldset className="visibility-field">
            <legend>Who’s this conversation for?</legend>
            <div className="visibility-options">
              <label
                className={draft.visibility === "public" ? "selected" : ""}
              >
                <input
                  type="radio"
                  name="visibility"
                  value="public"
                  checked={draft.visibility === "public"}
                  onChange={() => update({ visibility: "public" })}
                />
                <Globe size={19} />
                <span>
                  <strong>The whole class</strong>
                  <small>Let’s talk about it together.</small>
                </span>
              </label>
              <label
                className={draft.visibility === "private" ? "selected" : ""}
              >
                <input
                  type="radio"
                  name="visibility"
                  value="private"
                  checked={draft.visibility === "private"}
                  onChange={() => update({ visibility: "private" })}
                />
                <LockKeyhole size={19} />
                <span>
                  <strong>Just my reps</strong>
                  <small>Only you and your reps can open it.</small>
                </span>
              </label>
            </div>
          </fieldset>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="compose-footer">
          <span>
            <ShieldCheck size={16} />
            {draft.kind === "update"
              ? "Posted as an academic rep"
              : "Your name stays out of it."}
          </span>
          <button className="button button-primary" disabled={pending}>
            {pending ? (
              <Spinner />
            ) : (
              <>
                {draft.kind === "update"
                  ? "Publish update"
                  : "Post anonymously"}
                <ArrowRight size={17} />
              </>
            )}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
