export type Role = "super" | "sub";

export const KPIS = {
  totalReviews: 12847,
  totalDevices: 24,
  avgRating: 4.6,
  activeTemplates: 8,
  dailyResponses: 312,
  npsScore: 72,
};

export const responseTrend = [
  { day: "Mon", responses: 220, rating: 4.4 },
  { day: "Tue", responses: 285, rating: 4.5 },
  { day: "Wed", responses: 312, rating: 4.6 },
  { day: "Thu", responses: 298, rating: 4.5 },
  { day: "Fri", responses: 410, rating: 4.7 },
  { day: "Sat", responses: 502, rating: 4.8 },
  { day: "Sun", responses: 388, rating: 4.6 },
];

export const ratingDistribution = [
  { rating: "5★", value: 6420, fill: "var(--color-chart-1)" },
  { rating: "4★", value: 3210, fill: "var(--color-chart-2)" },
  { rating: "3★", value: 1480, fill: "var(--color-chart-3)" },
  { rating: "2★", value: 920, fill: "var(--color-chart-4)" },
  { rating: "1★", value: 817, fill: "var(--color-chart-5)" },
];

export const peakHours = Array.from({ length: 12 }, (_, i) => ({
  hour: `${i * 2}:00`,
  responses: Math.round(40 + Math.sin(i / 2) * 30 + Math.random() * 40),
}));

export type Template = {
  id: string;
  name: string;
  description: string;
  category: string;
  status: "active" | "inactive" | "draft";
  questions: number;
  responses: number;
  assignedDevices: number;
  updatedAt: string;
};

export const templates: Template[] = [
  {
    id: "t1",
    name: "Restaurant Feedback",
    description: "Post-meal customer experience",
    category: "F&B",
    status: "active",
    questions: 8,
    responses: 4210,
    assignedDevices: 6,
    updatedAt: "2h ago",
  },
  {
    id: "t2",
    name: "Hotel Check-out Survey",
    description: "Stay satisfaction & NPS",
    category: "Hospitality",
    status: "active",
    questions: 12,
    responses: 2890,
    assignedDevices: 4,
    updatedAt: "1d ago",
  },
  {
    id: "t3",
    name: "Retail Store Visit",
    description: "Quick 3-tap rating",
    category: "Retail",
    status: "active",
    questions: 3,
    responses: 5102,
    assignedDevices: 10,
    updatedAt: "3h ago",
  },
  {
    id: "t4",
    name: "Clinic Visit Survey",
    description: "Patient experience",
    category: "Healthcare",
    status: "inactive",
    questions: 6,
    responses: 645,
    assignedDevices: 2,
    updatedAt: "5d ago",
  },
  {
    id: "t5",
    name: "Event Booth Demo",
    description: "Trade show feedback",
    category: "Events",
    status: "draft",
    questions: 5,
    responses: 0,
    assignedDevices: 0,
    updatedAt: "just now",
  },
];

export type Device = {
  id: string;
  name: string;
  location: string;
  status: "online" | "offline" | "syncing";
  androidVersion: string;
  lastSync: string;
  template: string;
  responsesToday: number;
};

export const devices: Device[] = [
  {
    id: "d1",
    name: "Device — Lobby",
    location: "Downtown Branch",
    status: "online",
    androidVersion: "Android 13",
    lastSync: "12s ago",
    template: "Restaurant Feedback",
    responsesToday: 48,
  },
  {
    id: "d2",
    name: "Device — Entrance",
    location: "Mall Outlet",
    status: "online",
    androidVersion: "Android 12",
    lastSync: "1m ago",
    template: "Retail Store Visit",
    responsesToday: 124,
  },
  {
    id: "d3",
    name: "Device — Reception",
    location: "Hotel North",
    status: "syncing",
    androidVersion: "Android 14",
    lastSync: "syncing",
    template: "Hotel Check-out Survey",
    responsesToday: 33,
  },
  {
    id: "d4",
    name: "Device — Exit",
    location: "Airport Lounge",
    status: "offline",
    androidVersion: "Android 11",
    lastSync: "2h ago",
    template: "Restaurant Feedback",
    responsesToday: 0,
  },
  {
    id: "d5",
    name: "Device — Counter",
    location: "Cafe Central",
    status: "online",
    androidVersion: "Android 13",
    lastSync: "44s ago",
    template: "Retail Store Visit",
    responsesToday: 87,
  },
  {
    id: "d6",
    name: "Device — Booth A",
    location: "Expo Hall",
    status: "online",
    androidVersion: "Android 12",
    lastSync: "3m ago",
    template: "Event Booth Demo",
    responsesToday: 19,
  },
];

export type Response = {
  id: string;
  template: string;
  device: string;
  rating: number;
  submittedAt: string;
  duration: string;
  comment?: string;
};

export const responses: Response[] = [
  {
    id: "r1",
    template: "Restaurant Feedback",
    device: "Device — Lobby",
    rating: 5,
    submittedAt: "2 min ago",
    duration: "0:42",
    comment: "Amazing service, fast and friendly.",
  },
  {
    id: "r2",
    template: "Retail Store Visit",
    device: "Device — Entrance",
    rating: 4,
    submittedAt: "5 min ago",
    duration: "0:18",
  },
  {
    id: "r3",
    template: "Hotel Check-out Survey",
    device: "Device — Reception",
    rating: 2,
    submittedAt: "9 min ago",
    duration: "1:24",
    comment: "Room was not ready on time.",
  },
  {
    id: "r4",
    template: "Restaurant Feedback",
    device: "Device — Counter",
    rating: 5,
    submittedAt: "12 min ago",
    duration: "0:51",
  },
  {
    id: "r5",
    template: "Retail Store Visit",
    device: "Device — Counter",
    rating: 3,
    submittedAt: "18 min ago",
    duration: "0:22",
  },
  {
    id: "r6",
    template: "Event Booth Demo",
    device: "Device — Booth A",
    rating: 5,
    submittedAt: "24 min ago",
    duration: "1:02",
    comment: "Loved the product demo!",
  },
  {
    id: "r7",
    template: "Restaurant Feedback",
    device: "Device — Lobby",
    rating: 4,
    submittedAt: "31 min ago",
    duration: "0:37",
  },
  {
    id: "r8",
    template: "Hotel Check-out Survey",
    device: "Device — Reception",
    rating: 5,
    submittedAt: "44 min ago",
    duration: "1:11",
  },
];

export type SubAdmin = {
  id: string;
  name: string;
  email: string;
  status: "active" | "disabled";
  devices: number;
  templates: number;
  responses: number;
  joined: string;
};

export const subAdmins: SubAdmin[] = [
  {
    id: "a1",
    name: "Aisha Khan",
    email: "aisha@brand.co",
    status: "active",
    devices: 8,
    templates: 3,
    responses: 4210,
    joined: "Jan 2026",
  },
  {
    id: "a2",
    name: "Marco Rossi",
    email: "marco@hotelnorth.com",
    status: "active",
    devices: 4,
    templates: 2,
    responses: 2890,
    joined: "Feb 2026",
  },
  {
    id: "a3",
    name: "Priya Shah",
    email: "priya@retailgroup.in",
    status: "active",
    devices: 10,
    templates: 4,
    responses: 5102,
    joined: "Mar 2026",
  },
  {
    id: "a4",
    name: "Daniel Park",
    email: "daniel@clinics.kr",
    status: "disabled",
    devices: 2,
    templates: 1,
    responses: 645,
    joined: "Dec 2025",
  },
];

export type QuestionType =
  | "short_text"
  | "long_text"
  | "rating"
  | "nps"
  | "multiple_choice"
  | "single_choice"
  | "yes_no"
  | "emoji"
  | "customer_info";

export type BuilderQuestion = {
  id: string;
  type: QuestionType;
  label: string;
  required: boolean;
  options?: string[];
  width?: "full" | "half";
  starLabels?: string[];
  emojis?: Array<{ emoji: string; label: string }>;
  yesLabel?: string;
  noLabel?: string;
  collectName?: boolean;
  collectEmail?: boolean;
  collectPhone?: boolean;
};

export const QUESTION_LIBRARY: { type: QuestionType; label: string; hint: string }[] = [
  { type: "rating", label: "Star Rating", hint: "1–5 stars with custom labels" },
  { type: "nps", label: "NPS Score", hint: "0–10 recommendation" },
  { type: "emoji", label: "Emoji Reaction", hint: "😡 😕 😐 🙂 😍 (custom list)" },
  { type: "yes_no", label: "Yes / No", hint: "Custom boolean buttons" },
  { type: "single_choice", label: "Single Choice", hint: "Pick one option" },
  { type: "multiple_choice", label: "Multiple Choice", hint: "Pick many" },
  { type: "short_text", label: "Short Text", hint: "One-line input" },
  { type: "long_text", label: "Long Text", hint: "Comment box" },
  { type: "customer_info", label: "Customer Info", hint: "Name, Email, Phone form" },
];
