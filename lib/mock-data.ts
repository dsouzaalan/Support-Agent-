export type PriorityLevel = 'none' | 'low' | 'medium' | 'high' | 'urgent';
export type Sentiment = "positive" | "neutral" | "negative";
export type ChurnRisk = "low" | "medium" | "high";
export type TierType = "Platinum" | "Gold" | "Silver" | "New";
export type ConvStatus = "open" | "pending" | "closed";
export type Trajectory = "Expanding" | "Stable" | "Contracting";
export type AccountStatus = "Healthy" | "At Risk" | "Trial" | "New";

export interface MessageAttachment {
  name: string;
  url: string;
  contentType: string; // e.g. "image/png", "video/mp4", "application/pdf"
  width?: number;
  height?: number;
}

export interface Message {
  id: string;
  from: "customer" | "agent" | "note";
  text: string;
  html?: string;        // sanitized HTML from Intercom — render this when available
  time: string;
  read?: boolean;
  language?: string;
  translation?: string;
  author?: string;
  mentions?: string[];
  attachments?: MessageAttachment[];
  deleted?: boolean;
}

export interface CustomerNote {
  id: string;
  author: string;
  authorId: string;
  when: string;
  text: string;
}

export interface Customer {
  id: string;
  name: string;
  initials: string;
  email?: string;
  company: string;
  tier: TierType;
  status: AccountStatus;
  joinDate: string;
  accountAge: string;
  timezone: string;
  localTime: string;
  language: string;
  browser?: string;
  os?: string;
  hasHardBounced?: boolean;
  unsubscribedFromEmails?: boolean;
  workspaces: number;
  mailboxes: number;
  mailboxesDisconnected: number;
  disconnectedProviders: string[];
  positiveReplies: number;
  emailsSent: number;
  nextRenewal: string;
  trajectory: Trajectory;
  trajectoryReason: string;
  products: { label: string; count: number }[];
  destinations: string[];
  lastLogin: string;
  loginFrequency: "Daily active" | "Weekly active" | "Inactive";
  featureAdoption: number;
  trend: "growing" | "declining" | "stable";
  failedPayments: number;
  failedDomains: number;
  failedDomainList: string[];
  apiErrors: number;
  paymentExpired: boolean;
  lastStatusCheck: string;
  sentiment: Sentiment;
  sentimentReason: string;
  churn: ChurnRisk;
  tags: string[];
  suggestedAction: string;
  pastConversations: { id: string; subject: string; date: string; outcome: string }[];
  notes: CustomerNote[];
  loginAudit?: { agent: string; when: string };
}

export interface Conversation {
  id: string;
  customer: Customer;
  subject: string;
  preview: string;
  lastTime: string;
  unread: boolean;
  status: ConvStatus;
  assignedToMe: boolean;
  assignedAgent?: { id: string; name: string; assignedById: string; assignedByName: string; assignedAt: string } | null;
  intercomAssignee?: { id: string | number; name?: string; email?: string; type?: string } | null;
  sla?: { name: string | null; firstReplyBreached: boolean; nextReplyBreached: boolean; remainingSeconds: number | null; breachedAt: number | null } | null;
  createdByMe?: boolean;
  createdByAdmin?: { id: string; name: string } | null;
  messages: Message[];
  waitMinutes: number;
  slaMinutes: number;
  firstResponsePending: boolean;
  priorityScore: number;
  isHighPriority?: boolean;
  priorityLevel?: PriorityLevel;
  updatedAtTs?: number;
  viewers?: string[];
  triggerFlags?: string[];
  tags?: { id: string; name: string }[];
  snoozedUntil?: number | null;
}

const baseMessages = (name: string): Message[] => [
  { id: "m1", from: "customer", text: `Hey team — three of my Gmail mailboxes disconnected this morning and my sequences paused. Can you take a look? I'm losing money every hour.`, time: "9:14 AM", language: "en" },
  { id: "m2", from: "agent", text: `Hi ${name}, sorry about that! I'm pulling up your account now — give me a minute.`, time: "9:16 AM", read: true },
  { id: "m3", from: "customer", text: `Appreciate it. This is the second time this week. If it happens again I'm disputing the charge with my bank.`, time: "9:17 AM", language: "en" },
  { id: "n1", from: "note", text: `Heads-up: third disconnect incident this month — flagged as chargeback-risk. @Sam can you peek at the OAuth logs?`, time: "9:18 AM", author: "Riley Park", mentions: ["Sam"] },
  { id: "m4", from: "agent", text: `Totally understand the frustration. I can see 3 mailboxes lost their OAuth token. I'll walk you through the reconnect.`, time: "9:22 AM", read: true },
  { id: "m5", from: "customer", text: `Also — was I charged twice last month? My finance team flagged it.`, time: "9:24 AM", language: "en" },
];

export const conversations: Conversation[] = [
  {
    id: "c1",
    subject: "Mailboxes disconnected + billing question",
    preview: "If it happens again I'm disputing the charge with my bank.",
    lastTime: "2m",
    unread: true,
    status: "open",
    assignedToMe: true,
    waitMinutes: 14, slaMinutes: 15, firstResponsePending: false,
    priorityScore: 94, viewers: ["Sam K."],
    triggerFlags: ["chargeback-risk", "negative-sentiment"],
    customer: {
      id: "u1", name: "Marcus Chen", initials: "MC", company: "Northwind Outreach",
      tier: "Gold", status: "At Risk", joinDate: "Mar 12, 2023", accountAge: "1y 9mo",
      timezone: "America/Los_Angeles · GMT-8", localTime: "6:24 AM", language: "en",
      workspaces: 4, mailboxes: 28, mailboxesDisconnected: 3,
      disconnectedProviders: ["Gmail", "Gmail", "Outlook"],
      positiveReplies: 412, emailsSent: 184320, nextRenewal: "Jan 18, 2026",
      trajectory: "Contracting",
      trajectoryReason: "Cancelled 2 workspaces last month; mailbox count down 8.",
      products: [
        { label: "Domains", count: 12 },
        { label: "Mailboxes", count: 28 },
        { label: "Pre-warmed", count: 8 },
      ],
      destinations: ["Smartlead"],
      lastLogin: "23 min ago", loginFrequency: "Daily active",
      featureAdoption: 82, trend: "declining",
      failedPayments: 0, failedDomains: 2,
      failedDomainList: ["mail.northwind.io", "send.northwind.io"],
      apiErrors: 14, paymentExpired: false, lastStatusCheck: "12s ago",
      sentiment: "negative",
      sentimentReason: "Frustrated by mailbox disconnects in last 3 messages; raised duplicate-charge concern.",
      churn: "high",
      tags: ["disconnection-prone", "chargeback-risk", "VIP"],
      suggestedAction: "Offer 1:1 reconnect + 1-month credit; escalate to retention.",
      pastConversations: [
        { id: "p1", subject: "Mailbox disconnect (Gmail)", date: "Nov 18", outcome: "Resolved · OAuth reauth" },
        { id: "p2", subject: "Duplicate charge inquiry", date: "Oct 22", outcome: "Refunded" },
        { id: "p3", subject: "Domain DKIM failing", date: "Sep 04", outcome: "Resolved" },
      ],
      notes: [
        { id: "n1", author: "Riley Park", authorId: "me", when: "2 days ago", text: "Watch closely — upset about repeat disconnects." },
        { id: "n2", author: "Sam K.", authorId: "sam", when: "1 week ago", text: "Finance contact: Diane (CC'd on billing)." },
      ],
      loginAudit: { agent: "Sam K.", when: "12 min ago" },
    },
    messages: baseMessages("Marcus"),
  },
  {
    id: "c2",
    subject: "Domain verification failing on send.acme.co",
    preview: "DNS records look correct but ZapMail still shows unverified.",
    lastTime: "18m",
    unread: true,
    status: "pending",
    assignedToMe: true,
    waitMinutes: 22, slaMinutes: 30, firstResponsePending: false,
    priorityScore: 72,
    customer: {
      id: "u2", name: "Priya Raman", initials: "PR", company: "Acme Growth Studio",
      tier: "Platinum", status: "Healthy", joinDate: "Aug 02, 2022", accountAge: "2y 4mo",
      timezone: "Asia/Kolkata · GMT+5:30", localTime: "7:42 PM", language: "en",
      workspaces: 7, mailboxes: 64, mailboxesDisconnected: 0, disconnectedProviders: [],
      positiveReplies: 2840, emailsSent: 942100, nextRenewal: "Aug 02, 2026",
      trajectory: "Expanding",
      trajectoryReason: "Added 8 mailboxes in last 30 days; upgraded 2 workspaces.",
      products: [
        { label: "Domains", count: 38 },
        { label: "Mailboxes", count: 64 },
        { label: "Pre-warmed", count: 24 },
        { label: "API seats", count: 4 },
      ],
      destinations: ["Instantly", "Smartlead"],
      lastLogin: "4 min ago", loginFrequency: "Daily active",
      featureAdoption: 94, trend: "growing",
      failedPayments: 0, failedDomains: 1, failedDomainList: ["send.acme.co"],
      apiErrors: 0, paymentExpired: false, lastStatusCheck: "3s ago",
      sentiment: "neutral", sentimentReason: "Technical issue, calm tone, expects a fix.",
      churn: "low",
      tags: ["VIP", "upsell-candidate"],
      suggestedAction: "Resolve DNS quickly; great expansion candidate for Enterprise burst pool.",
      pastConversations: [
        { id: "p1", subject: "API rate-limit", date: "Oct 30", outcome: "Upgraded to burst pool" },
      ],
      notes: [],
    },
    messages: [
      { id: "m1", from: "customer", text: "DNS records look correct but ZapMail still shows unverified.", time: "8:42 AM", language: "en" },
      { id: "m2", from: "agent", text: "Hi Priya — checking propagation now. Which registrar are you on?", time: "8:48 AM", read: true },
      { id: "m3", from: "customer", text: "Cloudflare. TTL is 300.", time: "8:50 AM", language: "en" },
    ],
  },
  {
    id: "c3",
    subject: "Probleme zum CSV-Import aus Smartlead",
    preview: "Ich versuche ca. 500 Leads vor Ablauf der Testphase zu migrieren.",
    lastTime: "1h",
    unread: false,
    status: "open",
    assignedToMe: true,
    waitMinutes: 62, slaMinutes: 120, firstResponsePending: true,
    priorityScore: 41,
    customer: {
      id: "u3", name: "Tomás Herrera", initials: "TH", company: "Solo / Indie",
      tier: "New", status: "Trial", joinDate: "Dec 04, 2025", accountAge: "6 days",
      timezone: "Europe/Berlin · GMT+1", localTime: "3:14 PM", language: "de",
      workspaces: 1, mailboxes: 3, mailboxesDisconnected: 0, disconnectedProviders: [],
      positiveReplies: 4, emailsSent: 42, nextRenewal: "Dec 18, 2025",
      trajectory: "Expanding",
      trajectoryReason: "Onboarding signals strong; added 3 mailboxes in trial.",
      products: [{ label: "Mailboxes", count: 3 }],
      destinations: ["Smartlead"],
      lastLogin: "2 hr ago", loginFrequency: "Daily active",
      featureAdoption: 24, trend: "growing",
      failedPayments: 0, failedDomains: 0, failedDomainList: [],
      apiErrors: 0, paymentExpired: false, lastStatusCheck: "1m ago",
      sentiment: "positive", sentimentReason: "Engaged onboarding signals; asking advanced questions early.",
      churn: "low",
      tags: ["migration-in-progress"],
      suggestedAction: "Offer 10-min onboarding call; convert-likely.",
      pastConversations: [],
      notes: [],
    },
    messages: [
      { id: "m1", from: "customer", text: "Ich versuche ca. 500 Leads aus Smartlead vor Ablauf der Testphase zu migrieren. Gibt es einen CSV-Importer?", time: "Yesterday", language: "de", translation: "I'm trying to migrate ~500 leads from Smartlead before the trial ends. Is there a CSV importer?" },
    ],
  },
  {
    id: "c4",
    subject: "Payment method expired",
    preview: "Got an email saying renewal failed.",
    lastTime: "3h",
    unread: false,
    status: "pending",
    assignedToMe: true,
    waitMinutes: 180, slaMinutes: 60, firstResponsePending: true,
    priorityScore: 58,
    customer: {
      id: "u4", name: "Aisha Bello", initials: "AB", company: "Beacon Sales Co.",
      tier: "Silver", status: "At Risk", joinDate: "Feb 11, 2024", accountAge: "10mo",
      timezone: "Africa/Lagos · GMT+1", localTime: "3:14 PM", language: "en",
      workspaces: 2, mailboxes: 18, mailboxesDisconnected: 0, disconnectedProviders: [],
      positiveReplies: 162, emailsSent: 122430, nextRenewal: "Dec 11, 2025",
      trajectory: "Stable",
      trajectoryReason: "Mailbox count steady; no recent expansion or contraction.",
      products: [{ label: "Domains", count: 6 }, { label: "Mailboxes", count: 18 }],
      destinations: ["Instantly"],
      lastLogin: "1 day ago", loginFrequency: "Weekly active",
      featureAdoption: 71, trend: "stable",
      failedPayments: 1, failedDomains: 0, failedDomainList: [],
      apiErrors: 0, paymentExpired: true, lastStatusCheck: "30s ago",
      sentiment: "neutral", sentimentReason: "Practical billing question, neutral tone.",
      churn: "medium",
      tags: ["billing-followup"],
      suggestedAction: "Send secure card-update link; 5-day grace period applies.",
      pastConversations: [{ id: "p1", subject: "Sequence pause request", date: "Oct 02", outcome: "Resolved" }],
      notes: [],
    },
    messages: [
      { id: "m1", from: "customer", text: "Got an email saying renewal failed. What's the next step?", time: "6:02 AM", language: "en" },
    ],
  },
  {
    id: "c5",
    subject: "Loved the new analytics — feature request",
    preview: "Would be amazing to filter by sequence step.",
    lastTime: "Yesterday",
    unread: false,
    status: "closed",
    assignedToMe: true,
    waitMinutes: 0, slaMinutes: 60, firstResponsePending: false,
    priorityScore: 12,
    customer: {
      id: "u5", name: "Jordan Pike", initials: "JP", company: "Pike & Co.",
      tier: "Gold", status: "Healthy", joinDate: "May 09, 2023", accountAge: "1y 7mo",
      timezone: "America/New_York · GMT-5", localTime: "9:24 AM", language: "en",
      workspaces: 3, mailboxes: 22, mailboxesDisconnected: 0, disconnectedProviders: [],
      positiveReplies: 980, emailsSent: 311200, nextRenewal: "May 09, 2026",
      trajectory: "Expanding",
      trajectoryReason: "Added 4 mailboxes; advocate signals.",
      products: [{ label: "Domains", count: 14 }, { label: "Mailboxes", count: 22 }, { label: "Pre-warmed", count: 6 }],
      destinations: ["Smartlead"],
      lastLogin: "5 hr ago", loginFrequency: "Daily active",
      featureAdoption: 88, trend: "growing",
      failedPayments: 0, failedDomains: 0, failedDomainList: [],
      apiErrors: 0, paymentExpired: false, lastStatusCheck: "1 hr ago",
      sentiment: "positive", sentimentReason: "Positive product feedback, advocate signals.",
      churn: "low",
      tags: ["VIP", "advocate", "upsell-candidate"],
      suggestedAction: "Invite to beta program.",
      pastConversations: [],
      notes: [],
    },
    messages: [
      { id: "m1", from: "customer", text: "Would be amazing to filter by sequence step.", time: "Mon", language: "en" },
      { id: "m2", from: "agent", text: "Logged it! I'll loop in product.", time: "Mon", read: true },
    ],
  },
  {
    id: "c6",
    subject: "Rate limit warning on API",
    preview: "Hitting 429s on the /campaigns endpoint.",
    lastTime: "Yesterday",
    unread: false,
    status: "open",
    assignedToMe: false,
    waitMinutes: 240, slaMinutes: 60, firstResponsePending: true,
    priorityScore: 66,
    customer: {
      id: "u6", name: "Lin Wei", initials: "LW", company: "Helio Labs",
      tier: "Gold", status: "Healthy", joinDate: "Jan 22, 2024", accountAge: "11mo",
      timezone: "Asia/Singapore · GMT+8", localTime: "10:24 PM", language: "en",
      workspaces: 5, mailboxes: 41, mailboxesDisconnected: 1, disconnectedProviders: ["Outlook"],
      positiveReplies: 1240, emailsSent: 502300, nextRenewal: "Dec 22, 2025",
      trajectory: "Expanding",
      trajectoryReason: "API usage 3x in last 30 days.",
      products: [{ label: "Domains", count: 18 }, { label: "Mailboxes", count: 41 }, { label: "API seats", count: 2 }],
      destinations: ["Custom (API)"],
      lastLogin: "8 hr ago", loginFrequency: "Daily active",
      featureAdoption: 79, trend: "growing",
      failedPayments: 0, failedDomains: 0, failedDomainList: [],
      apiErrors: 42, paymentExpired: false, lastStatusCheck: "5m ago",
      sentiment: "neutral", sentimentReason: "Technical context, focused on resolution.",
      churn: "low",
      tags: ["upsell-candidate", "api-heavy"],
      suggestedAction: "Pitch Enterprise burst pool.",
      pastConversations: [],
      notes: [],
    },
    messages: [
      { id: "m1", from: "customer", text: "Hitting 429s on the /campaigns endpoint. What's our limit on Scale?", time: "Mon", language: "en" },
    ],
  },
];

export const platformIncidents: { kind: string; count: number; since: string }[] = [
  { kind: "Gmail OAuth disconnects", count: 14, since: "1 hour ago" },
];

export const tagLibrary = [
  "VIP", "disconnection-prone", "chargeback-risk", "migration-in-progress",
  "upsell-candidate", "advocate", "billing-followup", "api-heavy", "do-not-disturb",
];

export const cannedResponses = [
  { id: "r1", title: "Mailbox reconnect walkthrough", body: "Hi {name}, the disconnect was caused by a provider-side OAuth refresh. Click the reconnect link I just sent — it'll re-authorize all 3 mailboxes at once." },
  { id: "r2", title: "DNS verification troubleshooting", body: "Thanks for sending the records. I'm forcing a re-check on our end now — verification should propagate within 5 minutes." },
  { id: "r3", title: "Card update (secure link)", body: "I've sent a secure link to update your payment method. Your account stays active during the 5-day grace period." },
  { id: "r4", title: "Rate-limit options", body: "Two options: enable client-side backoff (snippet attached), or move to the Enterprise burst pool which lifts you to 1,000 req/min." },
  { id: "r5", title: "Trial CSV import", body: "Settings → Imports → CSV. Map 'email' + 'first_name' and you're set. Happy to jump on 10 min before your trial ends." },
];

export const helpArticles = [
  { id: "a1", title: "Why mailboxes disconnect (OAuth)", url: "#" },
  { id: "a2", title: "DNS / DKIM / SPF setup guide", url: "#" },
  { id: "a3", title: "Updating your payment method", url: "#" },
  { id: "a4", title: "API limits by plan", url: "#" },
];

export const agentMetrics = {
  responseTrend: [
    { day: "Mon", avg: 4.2 }, { day: "Tue", avg: 3.8 }, { day: "Wed", avg: 5.1 },
    { day: "Thu", avg: 3.4 }, { day: "Fri", avg: 2.9 }, { day: "Sat", avg: 4.6 }, { day: "Sun", avg: 3.1 },
  ],
  perDay: [
    { day: "Mon", count: 28 }, { day: "Tue", count: 34 }, { day: "Wed", count: 22 },
    { day: "Thu", count: 41 }, { day: "Fri", count: 37 }, { day: "Sat", count: 12 }, { day: "Sun", count: 8 },
  ],
  heatmap: Array.from({ length: 7 }, (_, d) =>
    Array.from({ length: 12 }, (_, h) => ({
      day: d, hour: h + 8,
      value: Math.round(Math.abs(Math.sin(d * 1.3 + h * 0.7)) * 10),
    }))
  ).flat(),
  kpis: {
    sent: 182, avgResponse: "3m 42s", median: "2m 18s", closed: 47, csat: 4.7, escalation: "6%", mcpQueries: 23,
  },
};

export const mcpPrompts = [
  "Why are his mailboxes disconnected?",
  "Check domain verification status for all domains",
  "What's his recent API error log?",
  "Summarize last 30 days of usage",
];

export function getMcpResponse(q: string, c: Customer): string[] {
  if (/mailbox|disconnect/i.test(q)) {
    return [
      `${c.mailboxesDisconnected} mailboxes disconnected: ${c.disconnectedProviders.join(", ") || "none"}.`,
      `Root cause: OAuth refresh token revoked by provider (3 events in last 24h).`,
      `Suggested fix: trigger reconnect flow + recommend dedicated app password for Outlook.`,
      `Past 30d: 5 prior disconnects on this account — above tier baseline.`,
    ];
  }
  if (/domain|verif/i.test(q)) {
    return [
      `${c.failedDomains} domains failing verification: ${c.failedDomainList.join(", ") || "none"}.`,
      `DKIM record found, but SPF includes an outdated IP range.`,
      `Estimated propagation: complete in <30 min after fix.`,
    ];
  }
  if (/api|error|rate|limit/i.test(q)) {
    return [
      `${c.apiErrors} API errors in the last 24h (mostly 429 Rate Limited).`,
      `Peak burst: 312 req/min at 14:02 UTC — exceeds plan ceiling of 240/min.`,
      `Recommend: enable client-side backoff or upgrade to Enterprise burst pool.`,
    ];
  }
  return [
    `Active workspaces: ${c.workspaces} • Mailboxes: ${c.mailboxes} • Positive replies: ${c.positiveReplies.toLocaleString()}.`,
    `Engagement trend: ${c.trend}. Feature adoption: ${c.featureAdoption}%.`,
    `Sentiment: ${c.sentiment}. Churn risk: ${c.churn}.`,
  ];
}

export function suggestedMcp(messages: Message[]): string | null {
  // Scan both plain text and HTML content (strip tags from HTML)
  const text = messages
    .map((m) => [(m.text || ""), (m.html || "").replace(/<[^>]+>/g, " ")].join(" "))
    .join(" ")
    .toLowerCase();
  if (/disconnect|mailbox|oauth|reconnect/.test(text)) return "Why are his mailboxes disconnected?";
  if (/dns|domain|verif|dkim|spf/.test(text)) return "Check domain verification status for all domains";
  if (/429|rate.?limit|api.?error/.test(text)) return "What's his recent API error log?";
  if (/payment|billing|charge|invoice|subscription/.test(text)) return "Check payment history and subscription status";
  // Generic fallback: always suggest a health check when there are customer messages
  if (messages.some((m) => m.from === "customer")) return "Run account health check for this customer";
  return null;
}

export interface SlackAlert {
  id: string;
  when: string;
  customer: string;
  tier: TierType;
  reason: string;
  snippet: string;
  conversationId: string;
}

export const slackAlerts: SlackAlert[] = [
  { id: "a1", when: "2 min ago", customer: "Marcus Chen", tier: "Gold", reason: "Chargeback signal detected", snippet: "If it happens again I'm disputing the charge with my bank.", conversationId: "c1" },
  { id: "a2", when: "14 min ago", customer: "Marcus Chen", tier: "Gold", reason: "Churn risk flipped to High", snippet: "Sentiment trending strongly negative across 3 msgs.", conversationId: "c1" },
  { id: "a3", when: "1 hr ago", customer: "Aisha Bello", tier: "Silver", reason: "SLA breach pending (Past Due billing)", snippet: "Got an email saying renewal failed. What's the next step?", conversationId: "c4" },
];

export interface AuditEntry {
  id: string;
  when: string;
  agent: string;
  customer: string;
  action: "One-Click Login" | "One-Click Stripe";
}

export const auditLog: AuditEntry[] = [
  { id: "1", when: "12 min ago", agent: "Sam K.", customer: "Marcus Chen", action: "One-Click Login" },
  { id: "2", when: "1 hr ago", agent: "Riley Park", customer: "Aisha Bello", action: "One-Click Stripe" },
  { id: "3", when: "Yesterday", agent: "Riley Park", customer: "Priya Raman", action: "One-Click Login" },
];

export const slackSettings = {
  channel: "#zapmail-alerts",
  thresholds: {
    negativeSentiment: true,
    churnHigh: true,
    chargebackKeywords: true,
    slaBreachVipMinutes: 15,
  },
};
