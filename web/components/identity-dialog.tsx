"use client";
import { useState, type FormEvent } from "react";
import { Copy, Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import { TOKEN_PATTERN } from "@/lib/domain";
import { Dialog } from "./ui";
export default function IdentityDialog({
  token,
  onClose,
  onRestore,
  notify,
}: {
  token: string;
  onClose: () => void;
  onRestore: (key: string) => void;
  notify: (message: string) => void;
}) {
  const [reveal, setReveal] = useState(false);
  const [restore, setRestore] = useState("");
  const [error, setError] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(token);
      notify("Key copied. Keep it somewhere private.");
    } catch {
      setReveal(true);
      setError("Select and copy your key manually.");
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!TOKEN_PATTERN.test(restore.trim())) {
      setError(
        "That key doesn’t look right. Paste the complete key starting with ra_.",
      );
      return;
    }
    onRestore(restore.trim());
  }
  return (
    <Dialog
      title="Your conversations, still yours."
      eyebrow="YOUR ANONYMOUS KEY"
      onClose={onClose}
    >
      <div className="dialog-content">
        <div className="info-icon">
          <KeyRound size={25} />
        </div>
        <p>
          Your browser remembers you with a random key. Save it to return to
          your conversations on another device, or after clearing your browser.
        </p>
        <label className="field-label" htmlFor="anonymous-key">
          Your private key
        </label>
        <div className="key-field">
          <input
            id="anonymous-key"
            type={reveal ? "text" : "password"}
            value={token}
            readOnly
            aria-label="Your private anonymous key"
          />
          <button
            className="icon-button"
            onClick={() => setReveal(!reveal)}
            aria-label={reveal ? "Hide key" : "Reveal key"}
          >
            {reveal ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
          <button
            className="icon-button"
            onClick={copy}
            aria-label="Copy anonymous key"
          >
            <Copy size={17} />
          </button>
        </div>
        <p className="small-note">
          <ShieldCheck size={15} />
          Anyone with this key can access your conversations. Keep it private.
        </p>
        <form className="restore-form" onSubmit={submit}>
          <h3>Coming back with a saved key?</h3>
          <p className="muted">
            Restoring replaces this browser’s key. Save your current one first.
          </p>
          <label className="sr-only" htmlFor="restore-key">
            Saved anonymous key
          </label>
          <input
            id="restore-key"
            className="input"
            type="password"
            placeholder="Paste your saved key"
            value={restore}
            onChange={(event) => setRestore(event.target.value)}
            autoComplete="off"
          />
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button button-primary" disabled={!restore.trim()}>
            Restore my conversations
          </button>
        </form>
      </div>
    </Dialog>
  );
}
