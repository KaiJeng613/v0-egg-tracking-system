"use client"

import { useState, useEffect } from "react"
import { format, startOfYear, endOfYear, eachMonthOfInterval, startOfMonth, endOfMonth, parseISO } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Download, FileSpreadsheet, FileText } from "lucide-react"
import type { DailyEntry, EggGrade } from "@/lib/types"
import * as XLSX from "xlsx"
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, WidthType } from "docx"

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]

const GRADES = [
  "AAA", "AA", "A", "B", "C", "D", "E", "F",
  "White Eggs", "Broken Eggs", "Water Eggs"
]

interface MonthlyData {
  month: number
  monthName: string
  totals: {
    chickens: number
    dead: number
    balance: number
    eggBoxes: number
    brokenEggs: number
    productionRate: number
    daysWithData: number
  }
  gradeTotals: {
    boxes: number
    pieces: number
  }
  gradeBreakdown: Record<string, { boxes: number; pieces: number }>
}

export function YearlyReport() {
  const currentDate = new Date()
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  const years = Array.from({ length: 10 }, (_, i) => currentDate.getFullYear() - i)

  useEffect(() => {
    loadYearlyData()
  }, [selectedYear])

  async function loadYearlyData() {
    setLoading(true)

    const startDate = startOfYear(new Date(selectedYear, 0))
    const endDate = endOfYear(new Date(selectedYear, 0))
    const months = eachMonthOfInterval({ start: startDate, end: endDate })

    const startStr = format(startDate, "yyyy-MM-dd")
    const endStr = format(endDate, "yyyy-MM-dd")

    // Load all entries for the year
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

    // Group data by month
    const data: MonthlyData[] = months.map((monthDate, index) => {
      const monthStart = startOfMonth(monthDate)
      const monthEnd = endOfMonth(monthDate)
      const monthStartStr = format(monthStart, "yyyy-MM-dd")
      const monthEndStr = format(monthEnd, "yyyy-MM-dd")

      // Filter entries for this month
      const monthEntries = entriesData?.filter((e) => {
        return e.entry_date >= monthStartStr && e.entry_date <= monthEndStr
      }) || []

      const monthGrades = gradesData?.filter((g) => {
        return g.entry_date >= monthStartStr && g.entry_date <= monthEndStr
      }) || []

      // Calculate totals by day first, then aggregate
      const entriesByDate: Record<string, DailyEntry[]> = {}
      monthEntries.forEach((entry) => {
        if (!entriesByDate[entry.entry_date]) {
          entriesByDate[entry.entry_date] = []
        }
        entriesByDate[entry.entry_date].push(entry)
      })

      let totalChickens = 0
      let totalDead = 0
      let totalBalance = 0
      let totalEggBoxes = 0
      let totalBrokenEggs = 0
      let daysWithData = 0

      Object.values(entriesByDate).forEach((dayEntries) => {
        let dayChickens = 0
        let dayDead = 0
        let dayBalance = 0
        let dayEggBoxes = 0
        let dayBroken = 0

        dayEntries.forEach((e) => {
          dayChickens += e.number_of_chickens || 0
          dayDead += e.dead_chickens || 0
          dayBalance += e.balance_stock || 0
          dayEggBoxes += parseFloat(e.egg_boxes as unknown as string) || 0
          dayBroken += e.broken_eggs || 0
        })

        if (dayChickens > 0) {
          totalChickens += dayChickens
          daysWithData++
        }
        totalDead += dayDead
        totalBalance += dayBalance
        totalEggBoxes += dayEggBoxes
        totalBrokenEggs += dayBroken
      })

      const avgChickens = daysWithData > 0 ? totalChickens / daysWithData : 0
      const productionRate = avgChickens > 0 && daysWithData > 0
        ? (totalEggBoxes * 360) / (avgChickens * daysWithData) * 100
        : 0

      // Calculate grade totals
      const gradeBreakdown: Record<string, { boxes: number; pieces: number }> = {}
      GRADES.forEach((grade) => {
        gradeBreakdown[grade] = { boxes: 0, pieces: 0 }
      })

      let totalGradeBoxes = 0
      let totalGradePieces = 0

      monthGrades.forEach((g) => {
        const boxes = parseFloat(g.boxes as unknown as string) || 0
        const pieces = g.pieces || 0
        if (gradeBreakdown[g.grade]) {
          gradeBreakdown[g.grade].boxes += boxes
          gradeBreakdown[g.grade].pieces += pieces
        }
        totalGradeBoxes += boxes
        totalGradePieces += pieces
      })

      return {
        month: index,
        monthName: MONTHS[index],
        totals: {
          chickens: Math.round(avgChickens),
          dead: totalDead,
          balance: Math.round(totalBalance / Math.max(daysWithData, 1)),
          eggBoxes: totalEggBoxes,
          brokenEggs: totalBrokenEggs,
          productionRate,
          daysWithData,
        },
        gradeTotals: {
          boxes: totalGradeBoxes,
          pieces: totalGradePieces,
        },
        gradeBreakdown,
      }
    })

    setMonthlyData(data)
    setLoading(false)
  }

  // Calculate yearly totals
  function calculateYearlyTotals() {
    let totalChickens = 0
    let totalDead = 0
    let totalEggBoxes = 0
    let totalBrokenEggs = 0
    let totalDaysWithData = 0
    let monthsWithData = 0

    monthlyData.forEach((month) => {
      if (month.totals.chickens > 0) {
        totalChickens += month.totals.chickens
        monthsWithData++
      }
      totalDead += month.totals.dead
      totalEggBoxes += month.totals.eggBoxes
      totalBrokenEggs += month.totals.brokenEggs
      totalDaysWithData += month.totals.daysWithData
    })

    const avgChickens = monthsWithData > 0 ? totalChickens / monthsWithData : 0
    const avgProductionRate = avgChickens > 0 && totalDaysWithData > 0
      ? (totalEggBoxes * 360) / (avgChickens * totalDaysWithData) * 100
      : 0

    return {
      avgChickens: Math.round(avgChickens),
      totalDead,
      totalEggBoxes: totalEggBoxes.toFixed(2),
      totalBrokenEggs,
      avgProductionRate: avgProductionRate.toFixed(2),
      totalDaysWithData,
      monthsWithData,
    }
  }

  // Calculate yearly grade totals
  function calculateYearlyGradeTotals() {
    const gradeTotals: Record<string, { boxes: number; pieces: number }> = {}
    
    GRADES.forEach((grade) => {
      gradeTotals[grade] = { boxes: 0, pieces: 0 }
    })

    monthlyData.forEach((month) => {
      Object.entries(month.gradeBreakdown).forEach(([grade, data]) => {
        if (gradeTotals[grade]) {
          gradeTotals[grade].boxes += data.boxes
          gradeTotals[grade].pieces += data.pieces
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
    const yearlyTotals = calculateYearlyTotals()
    const { gradeTotals, totalBoxes, totalPieces } = calculateYearlyGradeTotals()

    let csv = `Egg Production Yearly Report - ${selectedYear}\n\n`

    // Monthly Production Summary
    csv += "MONTHLY PRODUCTION SUMMARY\n"
    csv += "Month,Avg Chickens,Total Dead,Egg Boxes,Broken Eggs,Production Rate %,Days Recorded\n"

    monthlyData.forEach((month) => {
      csv += `${month.monthName},`
      csv += `${month.totals.chickens},`
      csv += `${month.totals.dead},`
      csv += `${month.totals.eggBoxes.toFixed(2)},`
      csv += `${month.totals.brokenEggs},`
      csv += `${month.totals.productionRate.toFixed(2)},`
      csv += `${month.totals.daysWithData}\n`
    })

    csv += `\nYEARLY TOTALS\n`
    csv += `Avg Chickens,${yearlyTotals.avgChickens}\n`
    csv += `Total Dead,${yearlyTotals.totalDead}\n`
    csv += `Total Egg Boxes,${yearlyTotals.totalEggBoxes}\n`
    csv += `Total Broken Eggs,${yearlyTotals.totalBrokenEggs}\n`
    csv += `Avg Production Rate,${yearlyTotals.avgProductionRate}%\n`
    csv += `Total Days Recorded,${yearlyTotals.totalDaysWithData}\n`

    // Grade Summary
    csv += `\nYEARLY GRADE SUMMARY\n`
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
    a.download = `egg-yearly-report-${selectedYear}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportToExcel() {
    const yearlyTotals = calculateYearlyTotals()
    const { gradeTotals, totalBoxes, totalPieces } = calculateYearlyGradeTotals()

    const wb = XLSX.utils.book_new()

    // Monthly Production Sheet
    const monthlyRows: (string | number)[][] = [
      ["MONTHLY PRODUCTION SUMMARY", "", "", "", "", "", ""],
      ["Month", "Avg Chickens", "Total Dead", "Egg Boxes", "Broken Eggs", "Production Rate %", "Days Recorded"],
    ]

    monthlyData.forEach((month) => {
      monthlyRows.push([
        month.monthName,
        month.totals.chickens,
        month.totals.dead,
        parseFloat(month.totals.eggBoxes.toFixed(2)),
        month.totals.brokenEggs,
        parseFloat(month.totals.productionRate.toFixed(2)),
        month.totals.daysWithData,
      ])
    })

    monthlyRows.push([])
    monthlyRows.push(["YEARLY TOTALS", "", "", "", "", "", ""])
    monthlyRows.push(["Avg Chickens", yearlyTotals.avgChickens, "", "", "", "", ""])
    monthlyRows.push(["Total Dead", yearlyTotals.totalDead, "", "", "", "", ""])
    monthlyRows.push(["Total Egg Boxes", parseFloat(yearlyTotals.totalEggBoxes), "", "", "", "", ""])
    monthlyRows.push(["Total Broken Eggs", yearlyTotals.totalBrokenEggs, "", "", "", "", ""])
    monthlyRows.push(["Avg Production Rate", `${yearlyTotals.avgProductionRate}%`, "", "", "", "", ""])
    monthlyRows.push(["Total Days Recorded", yearlyTotals.totalDaysWithData, "", "", "", "", ""])

    const ws1 = XLSX.utils.aoa_to_sheet(monthlyRows)
    XLSX.utils.book_append_sheet(wb, ws1, "Monthly Production")

    // Grade Summary Sheet
    const gradeRows: (string | number)[][] = [
      ["YEARLY GRADE SUMMARY", "", "", ""],
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

    // Monthly Grade Breakdown Sheet
    const monthlyGradeRows: (string | number)[][] = [
      ["MONTHLY GRADE BREAKDOWN", ...GRADES],
      ["Month", ...GRADES.map(() => "Boxes")],
    ]

    monthlyData.forEach((month) => {
      const row: (string | number)[] = [month.monthName]
      GRADES.forEach((grade) => {
        row.push(parseFloat(month.gradeBreakdown[grade].boxes.toFixed(2)))
      })
      monthlyGradeRows.push(row)
    })

    const ws3 = XLSX.utils.aoa_to_sheet(monthlyGradeRows)
    XLSX.utils.book_append_sheet(wb, ws3, "Monthly Grades")

    // Download
    XLSX.writeFile(wb, `egg-yearly-report-${selectedYear}.xlsx`)
  }

  async function exportToWord() {
    const yearlyTotals = calculateYearlyTotals()
    const { gradeTotals, totalBoxes, totalPieces } = calculateYearlyGradeTotals()

    const headerCellProps = { shading: { fill: "f3f4f6" } }

    // Monthly Production Summary table
    const monthlyHeaderRow = new TableRow({
      children: ["Month", "Avg Chickens", "Total Dead", "Egg Boxes", "Broken Eggs", "Production Rate %", "Days Recorded"].map(
        (text) => new TableCell({ ...headerCellProps, children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })] })
      ),
    })

    const monthlyDataRows = monthlyData.map(
      (month) =>
        new TableRow({
          children: [
            month.monthName,
            month.totals.chickens.toString(),
            month.totals.dead.toString(),
            month.totals.eggBoxes.toFixed(2),
            month.totals.brokenEggs.toString(),
            `${month.totals.productionRate.toFixed(2)}%`,
            month.totals.daysWithData.toString(),
          ].map((text) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text })] })] })),
        })
    )

    const monthlyTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [monthlyHeaderRow, ...monthlyDataRows],
    })

    // Grade Summary table
    const gradeHeaderRow = new TableRow({
      children: ["Grade", "Total Boxes", "Total Pieces", "Percentage %"].map(
        (text) => new TableCell({ ...headerCellProps, children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })] })
      ),
    })

    const gradeDataRows = GRADES.map((grade) => {
      const data = gradeTotals[grade]
      const percentage = totalBoxes > 0 ? (data.boxes / totalBoxes * 100).toFixed(2) : "0.00"
      return new TableRow({
        children: [grade, data.boxes.toFixed(2), data.pieces.toString(), `${percentage}%`].map(
          (text) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text })] })] })
        ),
      })
    })

    const gradeTotalRow = new TableRow({
      children: ["Total", totalBoxes.toFixed(2), totalPieces.toString(), "100.00%"].map(
        (text) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })] })
      ),
    })

    const gradeTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [gradeHeaderRow, ...gradeDataRows, gradeTotalRow],
    })

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              heading: HeadingLevel.TITLE,
              children: [new TextRun({ text: `Egg Production Yearly Report - ${selectedYear}` })],
            }),
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              children: [new TextRun({ text: "Monthly Production Summary" })],
            }),
            monthlyTable,
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              children: [new TextRun({ text: "Yearly Totals" })],
            }),
            new Paragraph({ children: [new TextRun({ text: `Avg Chickens: ${yearlyTotals.avgChickens}` })] }),
            new Paragraph({ children: [new TextRun({ text: `Total Dead: ${yearlyTotals.totalDead}` })] }),
            new Paragraph({ children: [new TextRun({ text: `Total Egg Boxes: ${yearlyTotals.totalEggBoxes}` })] }),
            new Paragraph({ children: [new TextRun({ text: `Total Broken Eggs: ${yearlyTotals.totalBrokenEggs}` })] }),
            new Paragraph({ children: [new TextRun({ text: `Avg Production Rate: ${yearlyTotals.avgProductionRate}%` })] }),
            new Paragraph({ children: [new TextRun({ text: `Total Days Recorded: ${yearlyTotals.totalDaysWithData}` })] }),
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              children: [new TextRun({ text: "Yearly Grade Summary" })],
            }),
            gradeTable,
          ],
        },
      ],
    })

    const blob = await Packer.toBlob(doc)
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `egg-yearly-report-${selectedYear}.docx`
    a.click()
    URL.revokeObjectURL(url)
  }

  const yearlyTotals = calculateYearlyTotals()
  const { gradeTotals, totalBoxes, totalPieces } = calculateYearlyGradeTotals()

  return (
    <div className="space-y-6">
      {/* Year Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Select Year</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
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
              <Button variant="outline" onClick={exportToWord}>
                <FileText className="mr-2 h-4 w-4" />
                Export Word
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
          {/* Yearly Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Avg. Chickens
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{yearlyTotals.avgChickens.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Dead
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-600">{yearlyTotals.totalDead}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Egg Boxes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{yearlyTotals.totalEggBoxes}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Broken
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-orange-600">{yearlyTotals.totalBrokenEggs}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Avg. Production Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">{yearlyTotals.avgProductionRate}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Days Recorded
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{yearlyTotals.totalDaysWithData}</p>
              </CardContent>
            </Card>
          </div>

          {/* Monthly Breakdown Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Monthly Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium">Month</th>
                      <th className="px-3 py-2 text-right font-medium">Avg Chickens</th>
                      <th className="px-3 py-2 text-right font-medium">Dead</th>
                      <th className="px-3 py-2 text-right font-medium">Egg Boxes</th>
                      <th className="px-3 py-2 text-right font-medium">Broken</th>
                      <th className="px-3 py-2 text-right font-medium">Prod. Rate</th>
                      <th className="px-3 py-2 text-right font-medium">Grade Boxes</th>
                      <th className="px-3 py-2 text-right font-medium">Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.map((month) => {
                      const hasData = month.totals.daysWithData > 0
                      return (
                        <tr key={month.month} className={`border-b ${!hasData ? "text-muted-foreground" : ""}`}>
                          <td className="px-3 py-2 font-medium">{month.monthName}</td>
                          <td className="px-3 py-2 text-right">{month.totals.chickens || "-"}</td>
                          <td className="px-3 py-2 text-right">{month.totals.dead || "-"}</td>
                          <td className="px-3 py-2 text-right">{month.totals.eggBoxes > 0 ? month.totals.eggBoxes.toFixed(2) : "-"}</td>
                          <td className="px-3 py-2 text-right">{month.totals.brokenEggs || "-"}</td>
                          <td className="px-3 py-2 text-right">
                            {month.totals.productionRate > 0 ? `${month.totals.productionRate.toFixed(1)}%` : "-"}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {month.gradeTotals.boxes > 0 ? month.gradeTotals.boxes.toFixed(2) : "-"}
                          </td>
                          <td className="px-3 py-2 text-right">{month.totals.daysWithData || "-"}</td>
                        </tr>
                      )
                    })}
                    <tr className="bg-muted/50 font-semibold">
                      <td className="px-3 py-2">Total / Avg</td>
                      <td className="px-3 py-2 text-right">{yearlyTotals.avgChickens}</td>
                      <td className="px-3 py-2 text-right">{yearlyTotals.totalDead}</td>
                      <td className="px-3 py-2 text-right">{yearlyTotals.totalEggBoxes}</td>
                      <td className="px-3 py-2 text-right">{yearlyTotals.totalBrokenEggs}</td>
                      <td className="px-3 py-2 text-right">{yearlyTotals.avgProductionRate}%</td>
                      <td className="px-3 py-2 text-right">{totalBoxes.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{yearlyTotals.totalDaysWithData}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Yearly Grade Summary Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Yearly Grade Summary</CardTitle>
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
