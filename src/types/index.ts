export interface District {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export interface Region {
  id: string
  district_id: string
  name: string
  created_at: string
  updated_at: string
  // joined
  district?: District
}

export type PersonRoleType = 'chairperson' | 'vice_chairperson' | 'secretary' | 'vice_secretary'

/** Normalised view of a district or region role — produced by usePersonRoles for UI consumption. */
export interface PersonRole {
  id: string
  person_id: string
  entity_type: 'district' | 'region'
  entity_id: string
  role: PersonRoleType
  created_at: string
  // joined
  person?: Person
}

export interface DistrictRole {
  id: string
  district_id: string
  person_id: string
  role: PersonRoleType
  created_at: string
  person?: Person
}

export interface RegionRole {
  id: string
  region_id: string
  person_id: string
  role: PersonRoleType
  created_at: string
  person?: Person
}

export interface DepartmentRole {
  id: string
  department_id: string
  person_id: string
  role: 'hod'
  created_at: string
  person?: Person
}

export interface Department {
  id: string
  name: string
  created_at: string
  updated_at: string
  // computed
  member_count?: number
  // joined via department_roles
  hod?: Person | null
}

export interface Person {
  id: string
  name: string
  phone: string | null
  gender: 'male' | 'female' | 'other' | null
  district_id: string | null
  region_id: string | null
  department_id: string | null
  created_at: string
  updated_at: string
  // joined
  region?: Region | null
  department?: Department | null
  // computed
  contribution?: number
}

export interface Day {
  id: string
  district_id: string
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
  mcs?: Person[]
  session_managers?: Person[]
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
  start_time: string
  duration: number
  is_main_event: boolean
  created_at: string
  updated_at: string
  // joined
  people?: Person[]
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
  district_id: string
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
