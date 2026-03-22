export interface District {
  id: string
  name: string
  chairperson: string
  vice_chairperson: string | null
  secretary: string | null
  vice_secretary: string | null
  created_at: string
  updated_at: string
}

export interface Region {
  id: string
  district_id: string
  name: string
  chairperson: string
  vice_chairperson: string | null
  secretary: string | null
  vice_secretary: string | null
  created_at: string
  updated_at: string
  // joined
  district?: District
}

export interface Department {
  id: string
  name: string
  hod: string
  created_at: string
  updated_at: string
  // computed
  member_count?: number
}

export interface Person {
  id: string
  name: string
  phone: string | null
  gender: 'male' | 'female' | 'other' | null
  region_id: string | null
  department_id: string | null
  contribution: number
  created_at: string
  updated_at: string
  // joined
  region?: Region | null
  department?: Department | null
}

export interface Day {
  id: string
  date: string
  label: string | null
  created_at: string
  updated_at: string
}

export interface Session {
  id: string
  day_id: string
  name: string
  start_time: string
  allocated_duration: number
  created_at: string
  updated_at: string
  // joined
  events?: Event[]
}

export interface EventVideo {
  id: string
  event_id: string
  youtube_id: string
  title: string | null
  created_at: string
  updated_at: string
}

export interface EventCommentary {
  id: string
  event_id: string
  speaker_id: string | null
  speaker_name: string | null
  body: string
  created_at: string
  updated_at: string
  // joined
  speaker?: Person | null
}

export interface EventPhoto {
  id: string
  event_id: string
  url: string
  caption: string | null
  taken_at: string | null
  created_at: string
  updated_at: string
}

export interface Event {
  id: string
  session_id: string
  title: string
  allocated_person: string | null
  start_time: string
  duration: number
  created_at: string
  updated_at: string
  // joined
  person?: Person | null
  videos?: EventVideo[]
  commentaries?: EventCommentary[]
  photos?: EventPhoto[]
}

export interface MealMenuItem {
  id: string
  meal_id: string
  name: string
  notes: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Meal {
  id: string
  day_id: string
  name: string
  scheduled_time: string
  duration: number
  created_at: string
  updated_at: string
  // joined
  menu_items?: MealMenuItem[]
}

export interface Certificate {
  id: string
  name: string
  min_amount: number | null
  max_amount: number | null
  is_grand_prize: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface LeaderboardEntry {
  id: string
  name: string
  gender: string | null
  contribution: number
  region_name: string | null
  district_id: string | null
  department_name: string | null
  rank: number
  certificate_name: string | null
}

export interface Page {
  id: string
  title: string
  slug: string
  content: string | null
  featured_image_url: string | null
  icon_class: string | null
  sort_order: number
  published: boolean
  created_at: string
  updated_at: string
}

export interface Song {
  id: string
  title: string
  author: string | null
  song_key: string | null
  lyrics: string | null
  sort_order: number
  published: boolean
  created_at: string
  updated_at: string
}

export interface Expense {
  id: string
  district_id: string
  description: string
  amount: number
  date: string
  created_at: string
  // joined
  district?: District | null
}

export interface Contribution {
  id: string
  person_id: string
  amount: number
  note: string | null
  date: string
  created_at: string
}

export interface Notification {
  id: string
  title: string
  body: string
  type: 'announcement' | 'programme' | 'song' | 'general'
  recipient_count: number
  sent_at: string
}

export interface OverviewStats {
  totalPeople: number
  totalFunds: number
  totalExpenses: number
  netBalance: number
  totalDays: number
  totalDepartments: number
  topContributors: LeaderboardEntry[]
}
