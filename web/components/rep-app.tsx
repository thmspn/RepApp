"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Bell,
  BookOpen,
  Briefcase,
  Check,
  ChevronDown,
  CircleHelp,
  Coffee,
  GraduationCap,
  Heart,
  Inbox,
  KeyRound,
  Leaf,
  LockKeyhole,
  LogOut,
  Megaphone,
  Menu,
  MessageCircle,
  MessagesSquare,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  X,
  Pin,
  Flag,
} from "lucide-react";
import {
  CATEGORIES,
  categoryFor,
  type Conversation,
  type ConversationDetail,
  type Feed,
  type Session,
  type View,
} from "@/lib/domain";
import {
  clientFor,
  errorMessage,
  IDENTITY_STORAGE,
  loadIdentity,
} from "@/lib/client";
import ComposeDialog, { emptyDraft, type Draft } from "./compose-dialog";
import ConversationDialog from "./conversation-dialog";
import IdentityDialog from "./identity-dialog";
import { Dialog, Logo, Spinner, StatusBadge, Timestamp } from "./ui";

const topicIcons = {
  academics: BookOpen,
  workload: Heart,
  campus: Coffee,
  coop: Briefcase,
  other: Sparkles,
};
const blankSession: Session = { isRep: false, repConfigured: false };

function ConversationCard({
  conversation: item,
  onOpen,
  onVote,
  busy,
}: {
  conversation: Conversation;
  onOpen: () => void;
  onVote: () => void;
  busy: boolean;
}) {
  const category = categoryFor(item.category);
  return (
    <article className={`conversation-card ${item.pinned ? "is-pinned" : ""}`}>
      {item.pinned && (
        <div className="pinned-label">
          <Pin size={11} />
          Pinned conversation
        </div>
      )}
      <div className="card-inner">
        {item.visibility === "public" ? (
          <button
            className={`vote-box ${item.voted ? "has-voted" : ""}`}
            aria-label={`${item.voted ? "Remove upvote from" : "Upvote"} ${item.title}`}
            aria-pressed={item.voted}
            disabled={busy}
            onClick={onVote}
          >
            <ArrowUp size={19} />
            <strong>{item.voteCount}</strong>
          </button>
        ) : (
          <div
            className="vote-box private-vote"
            title="Private to you and your reps"
          >
            <LockKeyhole size={18} />
          </div>
        )}
        <div className="card-content">
          <div className="card-topline">
            <span className={`topic-tag topic-${category.color}`}>
              <span />
              {category.label}
            </span>
            {item.course && <span className="course-tag">{item.course}</span>}
            {item.visibility === "private" && (
              <span className="private-tag">
                <LockKeyhole size={11} />
                Private
              </span>
            )}
            <Timestamp value={item.createdAt} />
          </div>
          <button className="conversation-open" onClick={onOpen}>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
          </button>
          <div className="card-bottom">
            <button className="reply-count" onClick={onOpen}>
              <MessageCircle size={15} />
              {item.replyCount} {item.replyCount === 1 ? "reply" : "replies"}
            </button>
            {item.repReplyCount > 0 && (
              <span className="rep-replied">
                <ShieldCheck size={13} />
                Rep replied
              </span>
            )}
            {item.isMine && (
              <span className="mine-label">Your conversation</span>
            )}
            {item.reportCount > 0 && (
              <span className="report-label">
                <Flag size={12} />
                {item.reportCount}
              </span>
            )}
            <span className="action-spacer" />
            <StatusBadge status={item.status} />
          </div>
        </div>
      </div>
    </article>
  );
}

function SpeechArt() {
  return (
    <svg
      className="speech-art"
      viewBox="0 0 280 210"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M42 53C42 38 54 27 69 27H184C199 27 211 39 211 54V104C211 119 199 131 184 131H111L77 155V131H69C54 131 42 119 42 104V53Z"
        fill="#F9F8E9"
        stroke="#234B3D"
        strokeWidth="2.4"
        transform="rotate(-7 126 90)"
      />
      <path
        d="M105 96C105 84 115 75 128 75H224C237 75 247 85 247 97V139C247 152 237 162 224 162H212V185L181 162H128C115 162 105 152 105 139V96Z"
        fill="#285542"
        stroke="#234B3D"
        strokeWidth="2.4"
        transform="rotate(8 176 131)"
      />
      <path
        d="M78 66H158M78 84H132"
        stroke="#234B3D"
        strokeWidth="5"
        strokeLinecap="round"
        transform="rotate(-7 126 90)"
      />
      <circle cx="151" cy="119" r="4.5" fill="#E9EEB2" />
      <circle cx="177" cy="122" r="4.5" fill="#E9EEB2" />
      <circle cx="203" cy="125" r="4.5" fill="#E9EEB2" />
      <path
        d="M237 31L240 18M249 39L262 35M27 150L17 156M37 164L33 176"
        stroke="#5B7756"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M25 33L28 23L32 33L42 36L32 40L28 50L25 40L15 36L25 33Z"
        fill="#E6B46C"
      />
      <circle cx="261" cy="174" r="4" fill="#D6AF7B" />
    </svg>
  );
}

export default function RepApp() {
  const [token, setToken] = useState("");
  const [temporaryIdentity, setTemporaryIdentity] = useState(false);
  const request = useMemo(() => (token ? clientFor(token) : null), [token]);
  const [session, setSession] = useState<Session>(blankSession);
  const [feed, setFeed] = useState<Feed | null>(null);
  const [view, setView] = useState<View>("all");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [course, setCourse] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("latest");
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [compose, setCompose] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [info, setInfo] = useState<"privacy" | "reps" | "key" | null>(null);
  const [toast, setToast] = useState("");
  const [voting, setVoting] = useState("");
  const sequence = useRef(0);
  const notify = useCallback((message: string) => setToast(message), []);

  useEffect(() => {
    const identity = loadIdentity();
    setToken(identity.token);
    setTemporaryIdentity(identity.temporary);
  }, []);
  useEffect(() => {
    if (!mobileNav) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNav(false);
    };
    document.addEventListener("keydown", dismiss);
    return () => document.removeEventListener("keydown", dismiss);
  }, [mobileNav]);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const sync = () =>
      setSelectedId(
        new URL(window.location.href).searchParams.get("conversation"),
      );
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  useEffect(() => {
    if (!request) return;
    let active = true;
    request<Session>("session")
      .then((value) => {
        if (active) setSession(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [request]);

  const loadFeed = useCallback(
    async (showLoading = false) => {
      if (!request) return;
      const current = ++sequence.current;
      if (showLoading) setLoading(true);
      const params = new URLSearchParams({
        view,
        category,
        status,
        course,
        q: query,
        sort,
      });
      try {
        const results = await Promise.all(
          Array.from({ length: pages }, (_, page) =>
            request<Feed>(`conversations?${params}&page=${page}`),
          ),
        );
        if (current === sequence.current) {
          setFeed({
            ...results[0],
            conversations: Array.from(
              new Map(
                results
                  .flatMap((result) => result.conversations)
                  .map((item) => [item.id, item]),
              ).values(),
            ),
            hasMore: results[results.length - 1].hasMore,
          });
          setError("");
        }
      } catch (error) {
        if (current === sequence.current) setError(errorMessage(error));
      } finally {
        if (current === sequence.current) setLoading(false);
      }
    },
    [request, view, category, status, course, query, sort, pages],
  );

  useEffect(() => {
    void loadFeed(true);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void loadFeed();
    }, 20000);
    const focus = () => {
      if (document.visibilityState === "visible") void loadFeed();
    };
    document.addEventListener("visibilitychange", focus);
    return () => {
      sequence.current++;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", focus);
    };
  }, [loadFeed]);
  function navigate(next: View, topic = "") {
    setView(next);
    setCategory(topic);
    setStatus("");
    setCourse("");
    setSearch("");
    setQuery("");
    setPages(1);
    setMobileNav(false);
  }
  function startConversation(values: Partial<Draft> = {}) {
    setDraft((current) => ({
      ...current,
      ...values,
      ...(values.kind === "update" ? { visibility: "public" as const } : {}),
    }));
    setCompose(true);
  }
  function openConversation(id: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("conversation", id);
    window.history.pushState(null, "", url);
    setSelectedId(id);
  }
  function closeConversation() {
    const url = new URL(window.location.href);
    url.searchParams.delete("conversation");
    window.history.pushState(null, "", url);
    setSelectedId(null);
  }
  function created(detail: ConversationDetail) {
    setCompose(false);
    setDraft(emptyDraft);
    void loadFeed();
    openConversation(detail.conversation.id);
    notify(
      detail.conversation.visibility === "private"
        ? "Sent to your reps. You can keep the conversation going here."
        : "Your conversation is posted. Your reps can reply right here.",
    );
  }
  async function vote(item: Conversation) {
    if (!request || voting) return;
    setVoting(item.id);
    try {
      const result = await request<ConversationDetail>(
        `conversations/${item.id}/vote`,
        { method: "PUT", body: JSON.stringify({ voted: !item.voted }) },
      );
      setFeed(
        (current) =>
          current && {
            ...current,
            conversations: current.conversations.map((row) =>
              row.id === item.id ? result.conversation : row,
            ),
          },
      );
    } catch (error) {
      notify(errorMessage(error));
    } finally {
      setVoting("");
    }
  }
  function restoreIdentity(key: string) {
    try {
      localStorage.setItem(IDENTITY_STORAGE, key);
      setTemporaryIdentity(false);
    } catch {
      setTemporaryIdentity(true);
    }
    setToken(key);
    setFeed(null);
    setSession(blankSession);
    setInfo(null);
    navigate("mine");
    notify("Your anonymous key is restored.");
  }

  const title = category
    ? categoryFor(category).label
    : view === "mine"
      ? "Your conversations"
      : view === "updates"
        ? "A word from your reps"
        : view === "rep"
          ? "The rep desk"
          : "The common room";
  const subtitle =
    view === "mine"
      ? "Pick up where you left off. You’re still anonymous here."
      : view === "updates"
        ? "Class updates, follow-ups, and the things worth knowing."
        : view === "rep"
          ? "Listen, follow up, and help move things forward."
          : category
            ? categoryFor(category).description
            : "A little space for the things on your mind.";
  const filtered = !!(category || status || course || query);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to conversations
      </a>
      {mobileNav && (
        <button
          className="nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      )}
      <aside
        className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}
        aria-label="Main navigation"
      >
        <button
          className="brand-button"
          onClick={() => navigate("all")}
          aria-label="RepApp home"
        >
          <Logo />
        </button>
        <div className="cohort-card">
          <span className="cohort-icon">
            <GraduationCap size={21} />
          </span>
          <div>
            <strong>Biomedical Engineering</strong>
            <span>Waterloo · Class of ’31</span>
          </div>
          <span className="cohort-dot" />
        </div>
        <p className="nav-label">YOUR COMMON ROOM</p>
        <nav className="primary-nav">
          <button
            className={view === "all" && !category ? "active" : ""}
            aria-current={view === "all" && !category ? "page" : undefined}
            onClick={() => navigate("all")}
          >
            <MessagesSquare size={18} />
            All conversations
            {feed && <span className="nav-count">{feed.stats.total}</span>}
          </button>
          <button
            className={view === "mine" ? "active" : ""}
            aria-current={view === "mine" ? "page" : undefined}
            onClick={() => navigate("mine")}
          >
            <Inbox size={18} />
            My conversations
            {feed && feed.stats.mine > 0 && (
              <span className="nav-count">{feed.stats.mine}</span>
            )}
          </button>
          <button
            className={view === "updates" ? "active" : ""}
            aria-current={view === "updates" ? "page" : undefined}
            onClick={() => navigate("updates")}
          >
            <Megaphone size={18} />
            Rep updates
          </button>
          {session.isRep && (
            <button
              className={view === "rep" ? "active" : ""}
              onClick={() => navigate("rep")}
            >
              <ShieldCheck size={18} />
              Rep desk<span className="rep-nav-tag">REP</span>
            </button>
          )}
        </nav>
        <div className="sidebar-divider" />
        <p className="nav-label">FIND YOUR TOPIC</p>
        <nav className="topic-nav">
          {CATEGORIES.map((topic) => {
            const Icon = topicIcons[topic.id];
            return (
              <button
                key={topic.id}
                className={category === topic.id ? "active" : ""}
                aria-current={category === topic.id ? "page" : undefined}
                onClick={() => navigate("all", topic.id)}
              >
                <Icon size={17} />
                <span>{topic.label}</span>
                <span className={`topic-dot dot-${topic.color}`} />
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="anonymity-note">
            <span className="note-spark">✳</span>
            <h3>
              Your voice.
              <br />
              Without the spotlight.
            </h3>
            <p>
              Real conversations.
              <br />A little more peace of mind.
            </p>
            <button onClick={() => setInfo("privacy")}>
              How anonymity works
              <ArrowUpRight size={14} />
            </button>
          </div>
          <button
            className="sidebar-bottom-link"
            onClick={() => setInfo("reps")}
          >
            <ShieldCheck size={16} />
            {session.isRep
              ? "Rep access is active"
              : "Are you an academic rep?"}
            <ArrowUpRight size={13} />
          </button>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobileNav(true)}
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb">
              BME ’31<span>/</span>
              <strong>Our space</strong>
            </span>
            <span className="term-badge">FALL 2026</span>
          </div>
          <div className="topbar-actions">
            <span className="anonymous-status">
              <span className="live-dot" />
              Anonymous to your class
            </span>
            <button
              className="icon-button notification-button"
              title="Go to your conversations"
              aria-label="Check replies in my conversations"
              onClick={() => navigate("mine")}
            >
              <Bell size={19} />
            </button>
            <button
              className="identity-button"
              onClick={() => setInfo("key")}
              title="Manage your anonymous key"
              aria-label="Manage your anonymous key"
            >
              <span className="anonymous-eyes">••</span>
            </button>
          </div>
        </header>
        <main id="main" className="workspace">
          <div className="page-heading">
            <div>
              <p className="eyebrow">A LITTLE MORE CONNECTED</p>
              <h1>
                {title}
                <span className="heading-dot">.</span>
              </h1>
              <p>{subtitle}</p>
            </div>
            <button
              className="button button-primary new-conversation"
              disabled={!request}
              onClick={() =>
                startConversation({
                  kind: view === "rep" ? "update" : "concern",
                })
              }
            >
              <Plus size={17} />
              <span>
                {view === "rep" ? "Post an update" : "New conversation"}
              </span>
            </button>
          </div>
          {temporaryIdentity && (
            <div className="storage-warning">
              <KeyRound size={18} />
              <p>
                Your browser can’t remember your key.{" "}
                <button className="text-button" onClick={() => setInfo("key")}>
                  Save your key
                </button>{" "}
                before leaving to keep your conversations.
              </p>
            </div>
          )}
          <div className="content-grid">
            <div className="feed-column">
              {view === "all" && !category && (
                <section className="welcome-banner">
                  <div>
                    <span className="banner-eyebrow">
                      <span />
                      SMALL COHORT. BIG CONVERSATIONS.
                    </span>
                    <h2>
                      Your voice,
                      <br />a little louder.
                    </h2>
                    <p>
                      Questions, concerns, or a good idea?
                      <br />
                      Your reps are listening.
                    </p>
                    <button
                      className="banner-link"
                      disabled={!request}
                      onClick={() => startConversation({ kind: "concern" })}
                    >
                      Let’s talk about it
                      <ArrowUpRight size={17} />
                    </button>
                  </div>
                  <SpeechArt />
                  <span className="banner-sticker">
                    for us,
                    <br />
                    <em>by us.</em>
                  </span>
                </section>
              )}
              {view === "mine" && (
                <div className="context-note">
                  <KeyRound size={19} />
                  <p>
                    No login to remember. Just keep your{" "}
                    <button
                      className="text-button"
                      onClick={() => setInfo("key")}
                    >
                      anonymous key
                    </button>{" "}
                    to find these conversations again.
                  </p>
                </div>
              )}
              {view === "rep" && (
                <div className="context-note">
                  <ShieldCheck size={19} />
                  <p>
                    You can see private concerns, post verified replies, and
                    update a conversation’s status. Student identities stay
                    anonymous.
                  </p>
                </div>
              )}
              <div className="feed-heading">
                <h2>
                  {view === "all"
                    ? "Around the common room"
                    : view === "mine"
                      ? "Started by you"
                      : view === "updates"
                        ? "From the rep team"
                        : "Conversations to follow up"}
                  {feed && <span>{feed.total}</span>}
                </h2>
                <span className="live-label">
                  <span className="live-dot" />
                  Live conversations
                </span>
              </div>
              <div className="feed-toolbar">
                <div className="feed-tabs" aria-label="Filter by status">
                  {[
                    { value: "", label: "All" },
                    { value: "unanswered", label: "Needs a reply" },
                    { value: "resolved", label: "Resolved" },
                  ].map((tab) => (
                    <button
                      key={tab.value}
                      className={status === tab.value ? "active" : ""}
                      aria-pressed={status === tab.value}
                      onClick={() => {
                        setStatus(tab.value);
                        setPages(1);
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <label className="sort-control">
                  <span className="sr-only">Sort conversations</span>
                  <select
                    value={sort}
                    onChange={(event) => {
                      setSort(event.target.value);
                      setPages(1);
                    }}
                  >
                    <option value="latest">Newest first</option>
                    <option value="popular">Most supported</option>
                  </select>
                  <ChevronDown size={13} />
                </label>
              </div>
              <div className="search-row">
                <div className="search-field">
                  <Search size={17} />
                  <input
                    aria-label="Search conversations"
                    placeholder="Find a conversation…"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPages(1);
                    }}
                  />
                  {search && (
                    <button
                      className="icon-button"
                      aria-label="Clear search"
                      onClick={() => setSearch("")}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                {feed && feed.courses.length > 0 && (
                  <label className="course-filter">
                    <BookOpen size={15} />
                    <span className="sr-only">Filter by course</span>
                    <select
                      value={course}
                      onChange={(event) => {
                        setCourse(event.target.value);
                        setPages(1);
                      }}
                    >
                      <option value="">All courses</option>
                      {feed.courses.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                )}
                <button
                  className={`icon-button refresh-button ${loading ? "is-refreshing" : ""}`}
                  aria-label="Refresh conversations"
                  title="Refresh conversations"
                  onClick={() => loadFeed(true)}
                  disabled={loading}
                >
                  <RefreshCw size={17} />
                </button>
              </div>
              {category && (
                <div className="active-filters">
                  <span>
                    {categoryFor(category).label}
                    <button
                      aria-label="Clear topic filter"
                      onClick={() => {
                        setCategory("");
                        setPages(1);
                      }}
                    >
                      <X size={12} />
                    </button>
                  </span>
                </div>
              )}
              {error && (
                <div className="feed-error" role="alert">
                  <p>{error}</p>
                  <button
                    className="text-button"
                    onClick={() => loadFeed(true)}
                  >
                    Try again
                    <RefreshCw size={14} />
                  </button>
                </div>
              )}
              {loading && !feed ? (
                <div
                  className="feed-skeleton"
                  aria-label="Loading conversations"
                  role="status"
                >
                  {[0, 1, 2].map((i) => (
                    <div className="skeleton-card" key={i}>
                      <span />
                      <span />
                      <span />
                    </div>
                  ))}
                </div>
              ) : feed && feed.conversations.length > 0 ? (
                <div
                  className={`conversation-list ${loading ? "list-loading" : ""}`}
                >
                  {feed.conversations.map((item) => (
                    <ConversationCard
                      key={item.id}
                      conversation={item}
                      onOpen={() => openConversation(item.id)}
                      onVote={() => vote(item)}
                      busy={!!voting}
                    />
                  ))}
                  {feed.hasMore && (
                    <button
                      className="button button-subtle load-more"
                      disabled={loading}
                      onClick={() => setPages((page) => page + 1)}
                    >
                      {loading ? <Spinner /> : "More conversations"}
                      <ChevronDown size={15} />
                    </button>
                  )}
                </div>
              ) : (
                !error &&
                feed && (
                  <section className="empty-state">
                    <div className="empty-illustration">
                      <MessagesSquare size={37} strokeWidth={1.35} />
                      <span className="empty-spark">✳</span>
                    </div>
                    <span className="eyebrow">
                      {filtered
                        ? "A FRESH PERSPECTIVE"
                        : view === "updates"
                          ? "STAY IN THE LOOP"
                          : "SOMEONE HAS TO GO FIRST"}
                    </span>
                    <h3>
                      {filtered
                        ? "Nothing here just yet."
                        : view === "mine"
                          ? "Your first conversation starts here."
                          : view === "updates"
                            ? "Good things are worth sharing."
                            : "Make yourself heard."}
                    </h3>
                    <p>
                      {filtered
                        ? "Try another search or filter. The conversation you’re looking for might be just around the corner."
                        : view === "mine"
                          ? "Ask that question. Share that concern. Your conversations and your reps’ replies will stay right here."
                          : view === "updates"
                            ? "When your reps post a class update, it’ll have a home right here. Check back as the term gets going."
                            : "If it’s on your mind, it might be on someone else’s too. Start the first conversation. We’re all ears."}
                    </p>
                    {filtered ? (
                      <button
                        className="button button-subtle"
                        onClick={() => navigate(view)}
                      >
                        Clear filters
                        <ArrowRight size={15} />
                      </button>
                    ) : view !== "updates" ? (
                      <button
                        className="button button-primary"
                        disabled={!request}
                        onClick={() => startConversation({ kind: "concern" })}
                      >
                        Start a conversation
                        <ArrowRight size={16} />
                      </button>
                    ) : (
                      session.isRep && (
                        <button
                          className="button button-primary"
                          onClick={() => startConversation({ kind: "update" })}
                        >
                          Post a class update
                          <Plus size={15} />
                        </button>
                      )
                    )}
                    <span className="empty-footnote">
                      <LockKeyhole size={12} />
                      No names. No awkward hand-raising.
                    </span>
                  </section>
                )
              )}
              {view === "all" && !filtered && (
                <div className="prompt-cards">
                  <button
                    onClick={() =>
                      startConversation({
                        category: "academics",
                        kind: "concern",
                      })
                    }
                  >
                    <span className="prompt-icon">
                      <BookOpen size={18} />
                    </span>
                    <span>
                      <strong>Something about a course?</strong>
                      <small>Let’s figure it out together.</small>
                    </span>
                    <ArrowUpRight size={16} />
                  </button>
                  <button
                    onClick={() =>
                      startConversation({
                        visibility: "private",
                        kind: "concern",
                      })
                    }
                  >
                    <span className="prompt-icon prompt-peach">
                      <LockKeyhole size={18} />
                    </span>
                    <span>
                      <strong>Just between us?</strong>
                      <small>Send a concern only to your reps.</small>
                    </span>
                    <ArrowUpRight size={16} />
                  </button>
                </div>
              )}
              <footer className="feed-footer">
                <Leaf size={13} />
                <span>Made for BME, by BME.</span>
                <span className="footer-heart">
                  A little care goes a long way.
                </span>
              </footer>
            </div>
            <aside className="right-rail" aria-label="About your common room">
              <section className="rep-card">
                <div className="rail-heading">
                  <span className="eyebrow">IN YOUR CORNER</span>
                  <span className="hand-star">✳</span>
                </div>
                <h2>
                  Your class.
                  <br />
                  Your reps.
                  <br />
                  <em>Your voice.</em>
                </h2>
                <p>
                  Here to listen, connect the dots, and bring your concerns to
                  the right people.
                </p>
                <div className="rep-person">
                  <span className="rep-avatar">
                    a
                    <span>
                      <Check size={9} />
                    </span>
                  </span>
                  <div>
                    <strong>Amanda</strong>
                    <span>BME ’31 · Academic rep</span>
                  </div>
                  <ShieldCheck size={17} />
                </div>
                <button
                  className="text-button"
                  onClick={() =>
                    startConversation({
                      visibility: "private",
                      kind: "concern",
                    })
                  }
                >
                  Say something privately
                  <ArrowUpRight size={14} />
                </button>
              </section>
              <section className="community-pulse">
                <div className="rail-title">
                  <h3>A little progress</h3>
                  <span className="live-dot" />
                </div>
                <p>Every conversation is a step forward.</p>
                <div className="pulse-numbers">
                  <div>
                    <strong>{feed?.stats.open ?? "—"}</strong>
                    <span>Open conversations</span>
                  </div>
                  <div>
                    <strong>{feed?.stats.resolved ?? "—"}</strong>
                    <span>Marked resolved</span>
                  </div>
                </div>
              </section>
              <section className="how-card">
                <h3>So, how does this work?</h3>
                <ol>
                  <li>
                    <span>01</span>
                    <div>
                      <strong>You bring it up.</strong>
                      <p>A question, concern, or bright idea.</p>
                    </div>
                  </li>
                  <li>
                    <span>02</span>
                    <div>
                      <strong>We keep talking.</strong>
                      <p>Your reps reply in the same thread.</p>
                    </div>
                  </li>
                  <li>
                    <span>03</span>
                    <div>
                      <strong>Something moves forward.</strong>
                      <p>Follow along as your concern is heard.</p>
                    </div>
                  </li>
                </ol>
              </section>
              <section className="community-note">
                <Heart size={18} />
                <h3>A good space starts with us.</h3>
                <p>
                  Be kind. Keep names out of it. Give each other a little room.
                </p>
                <button
                  className="text-button"
                  onClick={() => setInfo("privacy")}
                >
                  Our shared space
                  <ArrowUpRight size={13} />
                </button>
              </section>
            </aside>
          </div>
        </main>
      </div>
      {compose && request && (
        <ComposeDialog
          draft={draft}
          setDraft={setDraft}
          request={request}
          onClose={() => setCompose(false)}
          onCreated={created}
        />
      )}
      {selectedId && request && (
        <ConversationDialog
          key={`${token}:${selectedId}`}
          id={selectedId}
          session={session}
          request={request}
          onClose={closeConversation}
          onChange={() => loadFeed()}
          notify={notify}
        />
      )}
      {info === "key" && token && (
        <IdentityDialog
          token={token}
          onClose={() => setInfo(null)}
          onRestore={restoreIdentity}
          notify={notify}
        />
      )}
      {info === "privacy" && (
        <Dialog
          title="A little space. A little trust."
          eyebrow="HOW ANONYMITY WORKS"
          onClose={() => setInfo(null)}
        >
          <div className="dialog-content privacy-content">
            <div className="info-icon">
              <ShieldCheck size={25} />
            </div>
            <h3>Your name stays out of the conversation.</h3>
            <p>
              RepApp gives your browser a random key. Your posts and replies
              show up anonymously to classmates and reps. Anonymous nicknames
              are specific to each conversation.
            </p>
            <h3>You choose who can read it.</h3>
            <p>
              Class discussions can be read by everyone who has access to this
              board. “Just my reps” conversations can only be opened by their
              author and authorized reps.
            </p>
            <h3>A key, not a profile.</h3>
            <p>
              No student name or email is saved with your messages. Your private
              key lets you return, reply, and delete your own conversations.
              Save it before clearing your browser. Hosting providers may still
              process sign-in and request information; this is anonymity within
              the app.
            </p>
            <h3>Help keep this a good space.</h3>
            <p>
              Avoid identifying yourself or others. Be considerate, stay
              constructive, and use the report button if a conversation needs
              your reps’ attention. Reps can remove conversations that don’t
              belong here.
            </p>
            <button
              className="button button-primary"
              onClick={() => setInfo("key")}
            >
              <KeyRound size={16} />
              Save my anonymous key
            </button>
          </div>
        </Dialog>
      )}
      {info === "reps" && (
        <Dialog
          title={
            session.isRep
              ? "You’re in your rep era."
              : "A little more behind the scenes."
          }
          eyebrow="ACADEMIC REP ACCESS"
          onClose={() => setInfo(null)}
        >
          <div className="dialog-content">
            <div className="info-icon">
              <ShieldCheck size={25} />
            </div>
            <p>
              {session.isRep
                ? "Your rep access is active. You can reply as an academic rep, read private concerns, publish updates, and mark conversations as they move forward."
                : "Academic reps sign in with an approved account to read private concerns, post verified replies, and share class updates. Students don’t need a rep account to post anonymously."}
            </p>
            {session.isRep ? (
              <>
                <button
                  className="button button-primary"
                  onClick={() => {
                    setInfo(null);
                    navigate("rep");
                  }}
                >
                  Open the rep desk
                  <ArrowRight size={16} />
                </button>
                <a
                  className="text-button signout-link"
                  href="/signout-with-chatgpt?return_to=/"
                  target="_top"
                >
                  <LogOut size={14} />
                  Sign out of rep access
                </a>
              </>
            ) : (
              <>
                <a
                  className="button button-primary"
                  href="/signin-with-chatgpt?return_to=/"
                  target="_top"
                >
                  Sign in as a rep
                  <ArrowUpRight size={16} />
                </a>
                <p className="small-note">
                  Only accounts on the rep allowlist get rep tools. The project
                  owner can manage the list in the site settings.
                </p>
              </>
            )}
          </div>
        </Dialog>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          <span>{toast}</span>
          <button aria-label="Dismiss message" onClick={() => setToast("")}>
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
