"use client"

import { format, startOfMonth, getDay, getDaysInMonth, parseISO } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface DailyData {
  date: string
  totals: {
    chickens: number
    dead: number
    balance: number
    eggBoxes: number
    brokenEggs: number
    productionRate: number
  }
  gradeTotals: {
    boxes: number
    pieces: number
  }
}

interface ActivityHeatmapProps {
  dailyData: DailyData[]
  selectedMonth: number
  selectedYear: number
}

/**
 * Determines the color intensity level (0-4) for a given value.
 * Level 0 = no data/zero
 * Levels 1-4 = increasing intensity based on proportion to max
 */
export function getIntensityLevel(value: number, maxValue: number): number {
  if (maxValue <= 0 || value <= 0) return 0
  const ratio = value / maxValue
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}

/**
 * Returns the Tailwind CSS class for a given intensity level (green scale).
 */
export function getGreenColorClass(level: number): string {
  switch (level) {
    case 1: return "bg-green-200 dark:bg-green-900"
    case 2: return "bg-green-400 dark:bg-green-700"
    case 3: return "bg-green-500 dark:bg-green-500"
    case 4: return "bg-green-700 dark:bg-green-300"
    default: return "bg-muted"
  }
}

/**
 * Returns the Tailwind CSS class for a given intensity level (amber/orange scale).
 */
export function getAmberColorClass(level: number): string {
  switch (level) {
    case 1: return "bg-amber-200 dark:bg-amber-900"
    case 2: return "bg-amber-400 dark:bg-amber-700"
    case 3: return "bg-amber-500 dark:bg-amber-500"
    case 4: return "bg-amber-700 dark:bg-amber-300"
    default: return "bg-muted"
  }
}

/**
 * Builds the heatmap grid: an array of week columns, each containing
 * up to 7 day cells (Monday=0 through Sunday=6).
 * Null cells represent padding for days outside the month.
 */
export function buildHeatmapGrid(
  dailyData: DailyData[],
  month: number,
  year: number
): (DailyData | null)[][] {
  const firstDay = startOfMonth(new Date(year, month))
  const daysInMonth = getDaysInMonth(new Date(year, month))

  // getDay returns 0=Sunday, 1=Monday, ..., 6=Saturday
  // Convert to Monday-based: Monday=0, Tuesday=1, ..., Sunday=6
  const firstDayOfWeek = (getDay(firstDay) + 6) % 7

  // Create a lookup map for daily data by date string
  const dataByDate: Record<string, DailyData> = {}
  dailyData.forEach((d) => {
    dataByDate[d.date] = d
  })

  // Calculate total cells needed (padding + days)
  const totalCells = firstDayOfWeek + daysInMonth
  const numWeeks = Math.ceil(totalCells / 7)

  const grid: (DailyData | null)[][] = []

  for (let week = 0; week < numWeeks; week++) {
    const column: (DailyData | null)[] = []
    for (let day = 0; day < 7; day++) {
      const cellIndex = week * 7 + day
      const dayOfMonth = cellIndex - firstDayOfWeek + 1

      if (dayOfMonth < 1 || dayOfMonth > daysInMonth) {
        column.push(null)
      } else {
        const dateStr = format(new Date(year, month, dayOfMonth), "yyyy-MM-dd")
        column.push(dataByDate[dateStr] || null)
      }
    }
    grid.push(column)
  }

  return grid
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

interface HeatmapGridProps {
  grid: (DailyData | null)[][]
  maxValue: number
  getValue: (data: DailyData) => number
  getColorClass: (level: number) => string
  formatTooltip: (data: DailyData) => string
  emptyTooltip: (dateStr: string) => string
  selectedMonth: number
  selectedYear: number
}

function HeatmapGrid({
  grid,
  maxValue,
  getValue,
  getColorClass,
  formatTooltip,
  emptyTooltip,
  selectedMonth,
  selectedYear,
}: HeatmapGridProps) {
  return (
    <div className="flex gap-1">
      {/* Day-of-week labels */}
      <div className="flex flex-col gap-1 pr-2 pt-0">
        {DAY_LABELS.map((label, idx) => (
          <div
            key={label}
            className="h-3 w-8 text-[10px] leading-3 text-muted-foreground"
            style={{ visibility: idx % 2 === 0 ? "visible" : "hidden" }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Grid columns (weeks) */}
      {grid.map((week, weekIdx) => (
        <div key={weekIdx} className="flex flex-col gap-1">
          {week.map((cell, dayIdx) => {
            if (cell === null) {
              const cellIndex = weekIdx * 7 + dayIdx
              const firstDay = startOfMonth(new Date(selectedYear, selectedMonth))
              const firstDayOfWeek = (getDay(firstDay) + 6) % 7
              const dayOfMonth = cellIndex - firstDayOfWeek + 1
              const daysInMonth = getDaysInMonth(new Date(selectedYear, selectedMonth))

              if (dayOfMonth < 1 || dayOfMonth > daysInMonth) {
                return <div key={dayIdx} className="h-3 w-3 rounded-sm" />
              }

              const dateStr = format(new Date(selectedYear, selectedMonth, dayOfMonth), "yyyy-MM-dd")
              return (
                <div
                  key={dayIdx}
                  className="h-3 w-3 rounded-sm bg-muted"
                  title={emptyTooltip(dateStr)}
                />
              )
            }

            const value = getValue(cell)
            const level = getIntensityLevel(value, maxValue)
            const colorClass = getColorClass(level)
            const tooltip = value > 0
              ? formatTooltip(cell)
              : emptyTooltip(cell.date)

            return (
              <div
                key={dayIdx}
                className={`h-3 w-3 rounded-sm ${colorClass}`}
                title={tooltip}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}

export function ActivityHeatmap({ dailyData, selectedMonth, selectedYear }: ActivityHeatmapProps) {
  const grid = buildHeatmapGrid(dailyData, selectedMonth, selectedYear)

  // Max values for each metric
  const maxEggBoxes = dailyData.reduce((max, day) => Math.max(max, day.totals.eggBoxes), 0)
  const maxGradeBoxes = dailyData.reduce((max, day) => Math.max(max, day.gradeTotals.boxes), 0)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Production Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Egg Boxes (Trays) Heatmap */}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Egg Trays (Production)</p>
          <HeatmapGrid
            grid={grid}
            maxValue={maxEggBoxes}
            getValue={(data) => data.totals.eggBoxes}
            getColorClass={getGreenColorClass}
            formatTooltip={(data) =>
              `${format(parseISO(data.date), "EEE, dd MMM yyyy")} — ${data.totals.eggBoxes.toFixed(2)} trays`
            }
            emptyTooltip={(dateStr) =>
              `${format(parseISO(dateStr), "EEE, dd MMM yyyy")} — No production recorded`
            }
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
          />
          <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
            <span>Less</span>
            <div className="h-3 w-3 rounded-sm bg-muted" />
            <div className="h-3 w-3 rounded-sm bg-green-200 dark:bg-green-900" />
            <div className="h-3 w-3 rounded-sm bg-green-400 dark:bg-green-700" />
            <div className="h-3 w-3 rounded-sm bg-green-500 dark:bg-green-500" />
            <div className="h-3 w-3 rounded-sm bg-green-700 dark:bg-green-300" />
            <span>More</span>
          </div>
        </div>

        {/* Grade Boxes Heatmap */}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Egg Grades (Boxes)</p>
          <HeatmapGrid
            grid={grid}
            maxValue={maxGradeBoxes}
            getValue={(data) => data.gradeTotals.boxes}
            getColorClass={getAmberColorClass}
            formatTooltip={(data) =>
              `${format(parseISO(data.date), "EEE, dd MMM yyyy")} — ${data.gradeTotals.boxes.toFixed(2)} grade boxes`
            }
            emptyTooltip={(dateStr) =>
              `${format(parseISO(dateStr), "EEE, dd MMM yyyy")} — No grades recorded`
            }
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
          />
          <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
            <span>Less</span>
            <div className="h-3 w-3 rounded-sm bg-muted" />
            <div className="h-3 w-3 rounded-sm bg-amber-200 dark:bg-amber-900" />
            <div className="h-3 w-3 rounded-sm bg-amber-400 dark:bg-amber-700" />
            <div className="h-3 w-3 rounded-sm bg-amber-500 dark:bg-amber-500" />
            <div className="h-3 w-3 rounded-sm bg-amber-700 dark:bg-amber-300" />
            <span>More</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
