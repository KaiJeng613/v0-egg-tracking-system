"use client"

import { useState, useEffect } from "react"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Download, FileSpreadsheet } from "lucide-react"
import type { Coop, DailyEntry, EggGrade } from "@/lib/types"
import * as XLSX from "xlsx"

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]

const GRADES = [
  "AAA", "AA", "A", "B", "C", "D", "E", "F",
  "White Eggs", "Broken Eggs", "Water Eggs"
]

interface DailyData {
  date: string
  entries: Record<string, DailyEntry>
  grades: Record<string, EggGrade>
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

export function MonthlyReport() {
  const currentDate = new Date()
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth())
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())
  const [coops, setCoops] = useState<Coop[]>([])
  const [dailyData, setDailyData] = useState<DailyData[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i)

  useEffect(() => {
    loadCoops()
  }, [])

  useEffect(() => {
    if (coops.length > 0) {
      loadMonthlyData()
    }
  }, [selectedMonth, selectedYear, coops])

  async function loadCoops() {
    const { data } = await supabase
      .from("coops")
      .select("*")
      .order("display_order")

    setCoops(data || [])
  }

  async function loadMonthlyData() {
    setLoading(true)

    const startDate = startOfMonth(new Date(selectedYear, selectedMonth))
    const endDate = endOfMonth(new Date(selectedYear, selectedMonth))
    const days = eachDayOfInterval({ start: startDate, end: endDate })

    const startStr = format(startDate, "yyyy-MM-dd")
    const endStr = format(endDate, "yyyy-MM-dd")

    // Load all entries for the month
    const { data: entriesData } = await supabase
      .from("daily_entries")
      .select("*")
      .gte("entry_date", startStr)
      .lte("entry_date", endStr)

    const { data: gradesData } = await supabase
      .from("egg_grades")
      .select("*")
      .gte("entry_date", startStr)
      .lte("entry_date", endStr)

    // Group data by date
    const entriesByDate: Record<string, DailyEntry[]> = {}
    const gradesByDate: Record<string, EggGrade[]> = {}

    entriesData?.forEach((entry) => {
      if (!entriesByDate[entry.entry_date]) {
        entriesByDate[entry.entry_date] = []
      }
      entriesByDate[entry.entry_date].push(entry)
    })

    gradesData?.forEach((grade) => {
      if (!gradesByDate[grade.entry_date]) {
        gradesByDate[grade.entry_date] = []
      }
      gradesByDate[grade.entry_date].push(grade)
    })

    // Build daily data array
    const data: DailyData[] = days.map((day) => {
      const dateStr = format(day, "yyyy-MM-dd")
      const dayEntries = entriesByDate[dateStr] || []
      const dayGrades = gradesByDate[dateStr] || []

      const entriesRecord: Record<string, DailyEntry> = {}
      dayEntries.forEach((e) => {
        entriesRecord[e.coop_id] = e
      })

      const gradesRecord: Record<string, EggGrade> = {}
      dayGrades.forEach((g) => {
        gradesRecord[g.grade] = g
      })

      // Calculate totals
      let totalChickens = 0
      let totalDead = 0
      let totalBalance = 0
      let totalEggBoxes = 0
      let totalBrokenEggs = 0

      dayEntries.forEach((e) => {
        totalChickens += e.number_of_chickens || 0
        totalDead += e.dead_chickens || 0
        totalBalance += e.balance_stock || 0
        totalEggBoxes += parseFloat(e.egg_boxes as unknown as string) || 0
        totalBrokenEggs += e.broken_eggs || 0
      })

      const productionRate = totalChickens > 0
        ? (totalEggBoxes * 360) / totalChickens * 100
        : 0

      let totalGradeBoxes = 0
      let totalGradePieces = 0

      dayGrades.forEach((g) => {
        totalGradeBoxes += parseFloat(g.boxes as unknown as string) || 0
        totalGradePieces += g.pieces || 0
      })

      return {
        date: dateStr,
        entries: entriesRecord,
        grades: gradesRecord,
        totals: {
          chickens: totalChickens,
          dead: totalDead,
          balance: totalBalance,
          eggBoxes: totalEggBoxes,
          brokenEggs: totalBrokenEggs,
          productionRate,
        },
        gradeTotals: {
          boxes: totalGradeBoxes,
          pieces: totalGradePieces,
        },
      }
    })

    setDailyData(data)
    setLoading(false)
  }

  // Calculate monthly totals
  function calculateMonthlyTotals() {
    let totalChickens = 0
    let totalDead = 0
    let totalEggBoxes = 0
    let totalBrokenEggs = 0
    let daysWithData = 0

    dailyData.forEach((day) => {
      if (day.totals.chickens > 0) {
        totalChickens += day.totals.chickens
        daysWithData++
      }
      totalDead += day.totals.dead
      totalEggBoxes += day.totals.eggBoxes
      totalBrokenEggs += day.totals.brokenEggs
    })

    const avgChickens = daysWithData > 0 ? totalChickens / daysWithData : 0
    const avgProductionRate = avgChickens > 0
      ? (totalEggBoxes * 360) / (avgChickens * daysWithData) * 100
      : 0

    return {
      totalChickens: Math.round(avgChickens),
      totalDead,
      totalEggBoxes: totalEggBoxes.toFixed(2),
      totalBrokenEggs,
      avgProductionRate: avgProductionRate.toFixed(2),
      daysWithData,
    }
  }

  // Calculate monthly grade totals
  function calculateMonthlyGradeTotals() {
    const gradeTotals: Record<string, { boxes: number; pieces: number }> = {}
    
    GRADES.forEach((grade) => {
      gradeTotals[grade] = { boxes: 0, pieces: 0 }
    })

    dailyData.forEach((day) => {
      Object.entries(day.grades).forEach(([grade, data]) => {
        if (gradeTotals[grade]) {
          gradeTotals[grade].boxes += parseFloat(data.boxes as unknown as string) || 0
          gradeTotals[grade].pieces += data.pieces || 0
        }
      })
    })

    let totalBoxes = 0
    let totalPieces = 0
    Object.values(gradeTotals).forEach((v) => {
      totalBoxes += v.boxes
      totalPieces += v.pieces
    })

    return { gradeTotals, totalBoxes, totalPieces }
  }

  function exportToCSV() {
    const monthlyTotals = calculateMonthlyTotals()
    const { gradeTotals, totalBoxes, totalPieces } = calculateMonthlyGradeTotals()

    let csv = `Egg Production Report - ${MONTHS[selectedMonth]} ${selectedYear}\n\n`

    // Daily Production Summary
    csv += "DAILY PRODUCTION SUMMARY\n"
    csv += "Date,Total Chickens,Dead,Egg Boxes,Broken Eggs,Production Rate %\n"

    dailyData.forEach((day) => {
      if (day.totals.chickens > 0 || day.totals.eggBoxes > 0) {
        csv += `${format(parseISO(day.date), "dd/MM/yyyy")},`
        csv += `${day.totals.chickens},`
        csv += `${day.totals.dead},`
        csv += `${day.totals.eggBoxes.toFixed(2)},`
        csv += `${day.totals.brokenEggs},`
        csv += `${day.totals.productionRate.toFixed(2)}\n`
      }
    })

    csv += `\nMONTHLY TOTALS\n`
    csv += `Avg Chickens,${monthlyTotals.totalChickens}\n`
    csv += `Total Dead,${monthlyTotals.totalDead}\n`
    csv += `Total Egg Boxes,${monthlyTotals.totalEggBoxes}\n`
    csv += `Total Broken Eggs,${monthlyTotals.totalBrokenEggs}\n`
    csv += `Avg Production Rate,${monthlyTotals.avgProductionRate}%\n`

    // Grade Summary
    csv += `\nGRADE SUMMARY\n`
    csv += "Grade,Total Boxes,Total Pieces,Percentage %\n"

    GRADES.forEach((grade) => {
      const data = gradeTotals[grade]
      const percentage = totalBoxes > 0 ? (data.boxes / totalBoxes * 100).toFixed(2) : "0"
      csv += `${grade},${data.boxes.toFixed(2)},${data.pieces},${percentage}\n`
    })

    csv += `Total,${totalBoxes.toFixed(2)},${totalPieces},100\n`

    // Download
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `egg-report-${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportToExcel() {
    const monthlyTotals = calculateMonthlyTotals()
    const { gradeTotals, totalBoxes, totalPieces } = calculateMonthlyGradeTotals()

    const wb = XLSX.utils.book_new()

    // Daily Production Sheet
    const dailyRows: (string | number)[][] = [
      ["DAILY PRODUCTION SUMMARY", "", "", "", "", ""],
      ["Date", "Total Chickens", "Dead", "Egg Boxes", "Broken Eggs", "Production Rate %"],
    ]

    dailyData.forEach((day) => {
      if (day.totals.chickens > 0 || day.totals.eggBoxes > 0) {
        dailyRows.push([
          format(parseISO(day.date), "dd/MM/yyyy"),
          day.totals.chickens,
          day.totals.dead,
          parseFloat(day.totals.eggBoxes.toFixed(2)),
          day.totals.brokenEggs,
          parseFloat(day.totals.productionRate.toFixed(2)),
        ])
      }
    })

    dailyRows.push([])
    dailyRows.push(["MONTHLY TOTALS", "", "", "", "", ""])
    dailyRows.push(["Avg Chickens", monthlyTotals.totalChickens, "", "", "", ""])
    dailyRows.push(["Total Dead", monthlyTotals.totalDead, "", "", "", ""])
    dailyRows.push(["Total Egg Boxes", parseFloat(monthlyTotals.totalEggBoxes), "", "", "", ""])
    dailyRows.push(["Total Broken Eggs", monthlyTotals.totalBrokenEggs, "", "", "", ""])
    dailyRows.push(["Avg Production Rate", `${monthlyTotals.avgProductionRate}%`, "", "", "", ""])

    const ws1 = XLSX.utils.aoa_to_sheet(dailyRows)
    XLSX.utils.book_append_sheet(wb, ws1, "Daily Production")

    // Grade Summary Sheet
    const gradeRows: (string | number)[][] = [
      ["GRADE SUMMARY", "", "", ""],
      ["Grade", "Total Boxes", "Total Pieces", "Percentage %"],
    ]

    GRADES.forEach((grade) => {
      const data = gradeTotals[grade]
      const percentage = totalBoxes > 0 ? parseFloat((data.boxes / totalBoxes * 100).toFixed(2)) : 0
      gradeRows.push([grade, parseFloat(data.boxes.toFixed(2)), data.pieces, percentage])
    })

    gradeRows.push(["Total", parseFloat(totalBoxes.toFixed(2)), totalPieces, 100])

    const ws2 = XLSX.utils.aoa_to_sheet(gradeRows)
    XLSX.utils.book_append_sheet(wb, ws2, "Grade Summary")

    // Download
    XLSX.writeFile(wb, `egg-report-${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}.xlsx`)
  }

  const monthlyTotals = calculateMonthlyTotals()
  const { gradeTotals, totalBoxes, totalPieces } = calculateMonthlyGradeTotals()

  return (
    <div className="space-y-6">
      {/* Month/Year Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Select Period</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Select
              value={selectedMonth.toString()}
              onValueChange={(v) => setSelectedMonth(parseInt(v))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((month, idx) => (
                  <SelectItem key={idx} value={idx.toString()}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedYear.toString()}
              onValueChange={(v) => setSelectedYear(parseInt(v))}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={exportToCSV}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
              <Button variant="outline" onClick={exportToExcel}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Export Excel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Monthly Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Avg. Chickens
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{monthlyTotals.totalChickens.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Dead
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-600">{monthlyTotals.totalDead}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Egg Boxes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{monthlyTotals.totalEggBoxes}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Broken
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-orange-600">{monthlyTotals.totalBrokenEggs}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Avg. Production Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">{monthlyTotals.avgProductionRate}%</p>
              </CardContent>
            </Card>
          </div>

          {/* Daily Breakdown Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Daily Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium">Date</th>
                      <th className="px-3 py-2 text-right font-medium">Chickens</th>
                      <th className="px-3 py-2 text-right font-medium">Dead</th>
                      <th className="px-3 py-2 text-right font-medium">Egg Boxes</th>
                      <th className="px-3 py-2 text-right font-medium">Broken</th>
                      <th className="px-3 py-2 text-right font-medium">Prod. Rate</th>
                      <th className="px-3 py-2 text-right font-medium">Grade Boxes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyData.map((day) => {
                      const hasData = day.totals.chickens > 0 || day.totals.eggBoxes > 0
                      return (
                        <tr key={day.date} className={`border-b ${!hasData ? "text-muted-foreground" : ""}`}>
                          <td className="px-3 py-2">{format(parseISO(day.date), "EEE, dd MMM")}</td>
                          <td className="px-3 py-2 text-right">{day.totals.chickens || "-"}</td>
                          <td className="px-3 py-2 text-right">{day.totals.dead || "-"}</td>
                          <td className="px-3 py-2 text-right">{day.totals.eggBoxes > 0 ? day.totals.eggBoxes.toFixed(2) : "-"}</td>
                          <td className="px-3 py-2 text-right">{day.totals.brokenEggs || "-"}</td>
                          <td className="px-3 py-2 text-right">
                            {day.totals.productionRate > 0 ? `${day.totals.productionRate.toFixed(1)}%` : "-"}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {day.gradeTotals.boxes > 0 ? day.gradeTotals.boxes.toFixed(2) : "-"}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Grade Summary Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Monthly Grade Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium">Grade</th>
                      <th className="px-3 py-2 text-right font-medium">Total Boxes</th>
                      <th className="px-3 py-2 text-right font-medium">Total Pieces</th>
                      <th className="px-3 py-2 text-right font-medium">Percentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {GRADES.map((grade) => {
                      const data = gradeTotals[grade]
                      const percentage = totalBoxes > 0 ? (data.boxes / totalBoxes * 100).toFixed(1) : "0"
                      return (
                        <tr key={grade} className="border-b">
                          <td className="px-3 py-2 font-medium">{grade}</td>
                          <td className="px-3 py-2 text-right">{data.boxes.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right">{data.pieces}</td>
                          <td className="px-3 py-2 text-right">{percentage}%</td>
                        </tr>
                      )
                    })}
                    <tr className="bg-muted/50 font-semibold">
                      <td className="px-3 py-2">Total</td>
                      <td className="px-3 py-2 text-right">{totalBoxes.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{totalPieces}</td>
                      <td className="px-3 py-2 text-right">100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
