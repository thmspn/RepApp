"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import {
  X,
  MessageCircle,
  ShieldCheck,
  CircleCheck,
  LoaderCircle,
} from "lucide-react";
import { STATUS_LABELS, relativeTime, type Status } from "@/lib/domain";

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand ${small ? "brand-small" : ""}`}>
      <span className="brand-symbol">
        <MessageCircle size={25} strokeWidth={2.3} />
        <span />
      </span>
      {!small && (
        <span>
          repapp<span className="brand-period">.</span>
        </span>
      )}
    </span>
  );
}
export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`status-badge status-${status}`}>
      {status === "resolved" ? (
        <CircleCheck size={12} />
      ) : (
        <span className="status-dot" />
      )}
      {STATUS_LABELS[status]}
    </span>
  );
}
export function RepBadge() {
  return (
    <span className="rep-badge">
      <ShieldCheck size={12} /> Academic rep
    </span>
  );
}
export function Timestamp({ value }: { value: number }) {
  return (
    <time
      dateTime={new Date(value).toISOString()}
      title={new Date(value).toLocaleString()}
    >
      {relativeTime(value)}
    </time>
  );
}
export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <span className="spinner" role="status">
      <LoaderCircle size={17} className="spin" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
export function Dialog({
  title,
  eyebrow,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const element = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    element?.showModal();
    element
      ?.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        "input:not([readonly]), textarea",
      )
      ?.focus();
    return () => {
      element?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? "dialog-wide" : ""}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        closeRef.current();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            closeRef.current();
        }
      }}
    >
      <div className="dialog-header">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2 id={titleId}>{title}</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
