export const CATEGORIES = [
  {
    id: "academics",
    label: "Academics",
    description: "Courses, assignments & exams",
    color: "purple",
  },
  {
    id: "workload",
    label: "Workload & wellbeing",
    description: "Finding a little balance",
    color: "orange",
  },
  {
    id: "campus",
    label: "Campus life",
    description: "Our little corner of Waterloo",
    color: "blue",
  },
  {
    id: "coop",
    label: "Co-op & careers",
    description: "What comes next",
    color: "green",
  },
  {
    id: "other",
    label: "Ideas & everything else",
    description: "There’s room for it here",
    color: "pink",
  },
] as const;
export type Category = (typeof CATEGORIES)[number]["id"];
export type Status = "open" | "in-progress" | "resolved";
export type View = "all" | "mine" | "updates" | "rep";
export type Conversation = {
  id: string;
  title: string;
  body: string;
  category: Category;
  course: string;
  visibility: "public" | "private";
  kind: "concern" | "update";
  status: Status;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  voteCount: number;
  replyCount: number;
  repReplyCount: number;
  voted: boolean;
  isMine: boolean;
  reportCount: number;
};
export type Reply = {
  id: string;
  body: string;
  isRep: boolean;
  isMine: boolean;
  isOriginalPoster: boolean;
  authorName: string;
  createdAt: number;
};
export type ConversationDetail = {
  conversation: Conversation;
  replies: Reply[];
};
export type Session = { isRep: boolean; repConfigured: boolean };
export type Feed = {
  conversations: Conversation[];
  total: number;
  hasMore: boolean;
  stats: {
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    mine: number;
  };
  courses: string[];
};
export const STATUS_LABELS: Record<Status, string> = {
  open: "Open",
  "in-progress": "With your reps",
  resolved: "Resolved",
};
export const TOKEN_PATTERN = /^ra_[a-f0-9]{64}$/;
export function createAnonymousKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return (
    "ra_" +
    Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
  );
}
export function categoryFor(id: string) {
  return CATEGORIES.find((category) => category.id === id) ?? CATEGORIES[4];
}
export function relativeTime(timestamp: number): string {
  const seconds = Math.max(0, (Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
  }).format(timestamp);
}
