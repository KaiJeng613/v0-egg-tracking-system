export interface Coop {
  id: string
  name: string
  display_order: number
  created_at: string
}

export interface DailyEntry {
  id: string
  entry_date: string
  coop_id: string
  age: number | null
  number_of_chickens: number
  dead_chickens: number
  balance_stock: number
  egg_boxes: number
  broken_eggs: number
  production_rate: number
  remarks: string | null
  created_at: string
  updated_at: string
}

export interface DailyEntryWithCoop extends DailyEntry {
  coop: Coop
}

export interface EggGrade {
  id: string
  entry_date: string
  grade: string
  boxes: number
  pieces: number
  percentage: number
  created_at: string
  updated_at: string
}

export const GRADE_TYPES = [
  'AAA',
  'AA',
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'White Eggs',
  'Broken Eggs',
  'Water Eggs',
] as const

export type GradeType = (typeof GRADE_TYPES)[number]
