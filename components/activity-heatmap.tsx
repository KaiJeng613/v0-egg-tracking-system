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
 * Determines the color intensity level (0-4) for a given production value.
 * Level 0 = no data/zero production
 * Levels 1-4 = increasing intensity based on proportion to max
 */
export function getIntensityLevel(eggBoxes: number, maxEggBoxes: number): number {
  if (maxEggBoxes <= 0 || eggBoxes <= 0) return 0
  const ratio = eggBoxes / maxEggBoxes
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}

/**
 * Returns the Tailwind CSS class for a given intensity level.
 */
export function getColorClass(level: number): string {
  switch (level) {
    case 1:
      return "bg-green-200 dark:bg-green-900"
    case 2:
      return "bg-green-400 dark:bg-green-700"
    case 3:
      return "bg-green-500 dark:bg-green-500"
    case 4:
      return "bg-green-700 dark:bg-green-300"
    default:
      return "bg-muted"
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

export function ActivityHeatmap({ dailyData, selectedMonth, selectedYear }: ActivityHeatmapProps) {
  // Calculate max egg box production for the month
  const maxEggBoxes = dailyData.reduce((max, day) => Math.max(max, day.totals.eggBoxes), 0)

  // Build the grid
  const grid = buildHeatmapGrid(dailyData, selectedMonth, selectedYear)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Activity</CardTitle>
      </CardHeader>
      <CardContent>
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
                  // Check if this is a padding cell (outside the month)
                  const cellIndex = weekIdx * 7 + dayIdx
                  const firstDay = startOfMonth(new Date(selectedYear, selectedMonth))
                  const firstDayOfWeek = (getDay(firstDay) + 6) % 7
                  const dayOfMonth = cellIndex - firstDayOfWeek + 1
                  const daysInMonth = getDaysInMonth(new Date(selectedYear, selectedMonth))

                  if (dayOfMonth < 1 || dayOfMonth > daysInMonth) {
                    // Outside the month — invisible cell
                    return <div key={dayIdx} className="h-3 w-3 rounded-sm" />
                  }

                  // Inside the month but no data
                  const dateStr = format(new Date(selectedYear, selectedMonth, dayOfMonth), "yyyy-MM-dd")
                  return (
                    <div
                      key={dayIdx}
                      className="h-3 w-3 rounded-sm bg-muted"
                      title={`${format(parseISO(dateStr), "EEE, dd MMM yyyy")} — No production recorded`}
                    />
                  )
                }

                const level = getIntensityLevel(cell.totals.eggBoxes, maxEggBoxes)
                const colorClass = getColorClass(level)
                const tooltip =
                  cell.totals.eggBoxes > 0
                    ? `${format(parseISO(cell.date), "EEE, dd MMM yyyy")} — ${cell.totals.eggBoxes.toFixed(2)} egg boxes`
                    : `${format(parseISO(cell.date), "EEE, dd MMM yyyy")} — No production recorded`

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

        {/* Legend */}
        <div className="mt-3 flex items-center gap-1 text-[10px] text-muted-foreground">
          <span>Less</span>
          <div className="h-3 w-3 rounded-sm bg-muted" />
          <div className="h-3 w-3 rounded-sm bg-green-200 dark:bg-green-900" />
          <div className="h-3 w-3 rounded-sm bg-green-400 dark:bg-green-700" />
          <div className="h-3 w-3 rounded-sm bg-green-500 dark:bg-green-500" />
          <div className="h-3 w-3 rounded-sm bg-green-700 dark:bg-green-300" />
          <span>More</span>
        </div>
      </CardContent>
    </Card>
  )
}
