"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { CalendarIcon, Save, Loader2, WifiOff, RefreshCw } from "lucide-react"
import type { Coop, DailyEntry, EggGrade } from "@/lib/types"
import {
  getCachedCoops,
  setCachedCoops,
  getLocalDailyEntries,
  saveLocalDailyEntry,
  getLocalEggGrades,
  saveLocalEggGrade,
  addToPendingSync,
  getPendingSyncQueue,
  clearPendingSyncQueue,
  getPendingSyncCount,
  setOfflineMode,
} from "@/lib/local-storage"

const GRADES = [
  "AAA",
  "AA",
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "White Eggs",
  "Broken Eggs",
  "Water Eggs",
] as const

interface CoopEntry {
  coop_id: string
  age: string
  number_of_chickens: string
  dead_chickens: string
  balance_stock: string
  egg_boxes: string
  broken_eggs: string
  production_rate: string
  remarks: string
}

interface GradeEntry {
  grade: string
  boxes: string
  pieces: string
  percentage: string
}

export function DailyEntryForm() {
  const [date, setDate] = useState<Date>(new Date())
  const [coops, setCoops] = useState<Coop[]>([])
  const [coopEntries, setCoopEntries] = useState<Record<string, CoopEntry>>({})
  const [gradeEntries, setGradeEntries] = useState<Record<string, GradeEntry>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [message, setMessage] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null)

  const supabase = createClient()

  useEffect(() => {
    loadCoops()
  }, [])

  useEffect(() => {
    if (coops.length > 0) {
      loadExistingData()
    }
  }, [date, coops])

  useEffect(() => {
    setPendingCount(getPendingSyncCount())
  }, [saving])

  async function loadCoops() {
    try {
      const { data, error } = await supabase
        .from("coops")
        .select("*")
        .order("display_order")

      if (error) throw error

      setCoops(data || [])
      setCachedCoops(data || [])
      setIsOffline(false)
      setOfflineMode(false)

      // Initialize entries
      initializeEntries(data || [])
    } catch (err) {
      console.error("Supabase unavailable, using local fallback:", err)
      // Fall back to cached/default coops
      const cachedCoops = getCachedCoops() as Coop[]
      setCoops(cachedCoops)
      setIsOffline(true)
      setOfflineMode(true)
      initializeEntries(cachedCoops)
    }

    setLoading(false)
  }

  function initializeEntries(coopList: Coop[]) {
    const initialCoopEntries: Record<string, CoopEntry> = {}
    coopList.forEach((coop) => {
      initialCoopEntries[coop.id] = {
        coop_id: coop.id,
        age: "",
        number_of_chickens: "",
        dead_chickens: "",
        balance_stock: "",
        egg_boxes: "",
        broken_eggs: "",
        production_rate: "",
        remarks: "",
      }
    })
    setCoopEntries(initialCoopEntries)

    const initialGradeEntries: Record<string, GradeEntry> = {}
    GRADES.forEach((grade) => {
      initialGradeEntries[grade] = {
        grade,
        boxes: "",
        pieces: "",
        percentage: "",
      }
    })
    setGradeEntries(initialGradeEntries)
  }

  async function loadExistingData() {
    const dateStr = format(date, "yyyy-MM-dd")

    if (isOffline) {
      loadFromLocalStorage(dateStr)
      return
    }

    try {
      // Load existing daily entries
      const { data: dailyData, error: dailyError } = await supabase
        .from("daily_entries")
        .select("*")
        .eq("entry_date", dateStr)

      if (dailyError) throw dailyError

      if (dailyData && dailyData.length > 0) {
        const entries: Record<string, CoopEntry> = { ...coopEntries }
        dailyData.forEach((entry: DailyEntry) => {
          entries[entry.coop_id] = {
            coop_id: entry.coop_id,
            age: entry.age?.toString() || "",
            number_of_chickens: entry.number_of_chickens?.toString() || "",
            dead_chickens: entry.dead_chickens?.toString() || "",
            balance_stock: entry.balance_stock?.toString() || "",
            egg_boxes: entry.egg_boxes?.toString() || "",
            broken_eggs: entry.broken_eggs?.toString() || "",
            production_rate: entry.production_rate?.toString() || "",
            remarks: entry.remarks || "",
          }
        })
        setCoopEntries(entries)
      } else {
        resetCoopEntries()
      }

      // Load existing grade entries
      const { data: gradeData, error: gradeError } = await supabase
        .from("egg_grades")
        .select("*")
        .eq("entry_date", dateStr)

      if (gradeError) throw gradeError

      if (gradeData && gradeData.length > 0) {
        const entries: Record<string, GradeEntry> = { ...gradeEntries }
        gradeData.forEach((entry: EggGrade) => {
          entries[entry.grade] = {
            grade: entry.grade,
            boxes: entry.boxes?.toString() || "",
            pieces: entry.pieces?.toString() || "",
            percentage: entry.percentage?.toString() || "",
          }
        })
        setGradeEntries(entries)
      } else {
        resetGradeEntries()
      }
    } catch (err) {
      console.error("Failed to load from Supabase, falling back to local:", err)
      setIsOffline(true)
      setOfflineMode(true)
      loadFromLocalStorage(dateStr)
    }
  }

  function loadFromLocalStorage(dateStr: string) {
    const localEntries = getLocalDailyEntries(dateStr)
    if (localEntries.length > 0) {
      const entries: Record<string, CoopEntry> = { ...coopEntries }
      localEntries.forEach((entry) => {
        entries[entry.coop_id] = {
          coop_id: entry.coop_id,
          age: entry.age?.toString() || "",
          number_of_chickens: entry.number_of_chickens?.toString() || "",
          dead_chickens: entry.dead_chickens?.toString() || "",
          balance_stock: entry.balance_stock?.toString() || "",
          egg_boxes: entry.egg_boxes?.toString() || "",
          broken_eggs: entry.broken_eggs?.toString() || "",
          production_rate: entry.production_rate?.toString() || "",
          remarks: entry.remarks || "",
        }
      })
      setCoopEntries(entries)
    } else {
      resetCoopEntries()
    }

    const localGrades = getLocalEggGrades(dateStr)
    if (localGrades.length > 0) {
      const entries: Record<string, GradeEntry> = { ...gradeEntries }
      localGrades.forEach((entry) => {
        entries[entry.grade] = {
          grade: entry.grade,
          boxes: entry.boxes?.toString() || "",
          pieces: entry.pieces?.toString() || "",
          percentage: entry.percentage?.toString() || "",
        }
      })
      setGradeEntries(entries)
    } else {
      resetGradeEntries()
    }
  }

  function resetCoopEntries() {
    const emptyEntries: Record<string, CoopEntry> = {}
    coops.forEach((coop) => {
      emptyEntries[coop.id] = {
        coop_id: coop.id,
        age: "",
        number_of_chickens: "",
        dead_chickens: "",
        balance_stock: "",
        egg_boxes: "",
        broken_eggs: "",
        production_rate: "",
        remarks: "",
      }
    })
    setCoopEntries(emptyEntries)
  }

  function resetGradeEntries() {
    const emptyGrades: Record<string, GradeEntry> = {}
    GRADES.forEach((grade) => {
      emptyGrades[grade] = {
        grade,
        boxes: "",
        pieces: "",
        percentage: "",
      }
    })
    setGradeEntries(emptyGrades)
  }

  function updateCoopEntry(coopId: string, field: keyof CoopEntry, value: string) {
    setCoopEntries((prev) => ({
      ...prev,
      [coopId]: {
        ...prev[coopId],
        [field]: value,
      },
    }))
  }

  function updateGradeEntry(grade: string, field: keyof GradeEntry, value: string) {
    setGradeEntries((prev) => ({
      ...prev,
      [grade]: {
        ...prev[grade],
        [field]: value,
      },
    }))
  }

  function calculateCoopTotals() {
    let totalChickens = 0
    let totalDead = 0
    let totalBalance = 0
    let totalEggBoxes = 0
    let totalBrokenEggs = 0

    Object.values(coopEntries).forEach((entry) => {
      totalChickens += parseFloat(entry.number_of_chickens) || 0
      totalDead += parseFloat(entry.dead_chickens) || 0
      totalBalance += parseFloat(entry.balance_stock) || 0
      totalEggBoxes += parseFloat(entry.egg_boxes) || 0
      totalBrokenEggs += parseFloat(entry.broken_eggs) || 0
    })

    const avgProductionRate = totalChickens > 0
      ? ((totalEggBoxes * 360) / totalChickens * 100).toFixed(2)
      : "0"

    return {
      totalChickens,
      totalDead,
      totalBalance,
      totalEggBoxes: totalEggBoxes.toFixed(2),
      totalBrokenEggs,
      avgProductionRate,
    }
  }

  function calculateGradeTotals() {
    let totalBoxes = 0
    let totalPieces = 0

    Object.values(gradeEntries).forEach((entry) => {
      totalBoxes += parseFloat(entry.boxes) || 0
      totalPieces += parseFloat(entry.pieces) || 0
    })

    return {
      totalBoxes: totalBoxes.toFixed(2),
      totalPieces,
    }
  }

  async function handleSave() {
    setSaving(true)
    setMessage(null)

    const dateStr = format(date, "yyyy-MM-dd")

    if (isOffline) {
      // Save to localStorage
      saveToLocalStorage(dateStr)
      setMessage({ type: "warning", text: "Saved locally (offline mode). Data will sync when database is available." })
      setSaving(false)
      return
    }

    try {
      // Try saving to Supabase
      for (const entry of Object.values(coopEntries)) {
        const hasData =
          entry.age ||
          entry.number_of_chickens ||
          entry.dead_chickens ||
          entry.balance_stock ||
          entry.egg_boxes ||
          entry.broken_eggs ||
          entry.remarks

        if (hasData) {
          const { error } = await supabase
            .from("daily_entries")
            .upsert(
              {
                entry_date: dateStr,
                coop_id: entry.coop_id,
                age: entry.age ? parseInt(entry.age) : null,
                number_of_chickens: parseInt(entry.number_of_chickens) || 0,
                dead_chickens: parseInt(entry.dead_chickens) || 0,
                balance_stock: parseInt(entry.balance_stock) || 0,
                egg_boxes: parseFloat(entry.egg_boxes) || 0,
                broken_eggs: parseInt(entry.broken_eggs) || 0,
                production_rate: parseFloat(entry.production_rate) || 0,
                remarks: entry.remarks || null,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "entry_date,coop_id" }
            )

          if (error) throw error
        }
      }

      for (const entry of Object.values(gradeEntries)) {
        const hasData = entry.boxes || entry.pieces || entry.percentage

        if (hasData) {
          const { error } = await supabase
            .from("egg_grades")
            .upsert(
              {
                entry_date: dateStr,
                grade: entry.grade,
                boxes: parseFloat(entry.boxes) || 0,
                pieces: parseInt(entry.pieces) || 0,
                percentage: parseFloat(entry.percentage) || 0,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "entry_date,grade" }
            )

          if (error) throw error
        }
      }

      setMessage({ type: "success", text: "Data saved successfully!" })
    } catch (error) {
      console.error("Supabase save failed, saving locally:", error)
      // Fall back to local save
      setIsOffline(true)
      setOfflineMode(true)
      saveToLocalStorage(dateStr)
      setMessage({ type: "warning", text: "Database unavailable. Saved locally — will sync when back online." })
    } finally {
      setSaving(false)
    }
  }

  function saveToLocalStorage(dateStr: string) {
    for (const entry of Object.values(coopEntries)) {
      const hasData =
        entry.age ||
        entry.number_of_chickens ||
        entry.dead_chickens ||
        entry.balance_stock ||
        entry.egg_boxes ||
        entry.broken_eggs ||
        entry.remarks

      if (hasData) {
        const localEntry = {
          entry_date: dateStr,
          coop_id: entry.coop_id,
          age: entry.age ? parseInt(entry.age) : null,
          number_of_chickens: parseInt(entry.number_of_chickens) || 0,
          dead_chickens: parseInt(entry.dead_chickens) || 0,
          balance_stock: parseInt(entry.balance_stock) || 0,
          egg_boxes: parseFloat(entry.egg_boxes) || 0,
          broken_eggs: parseInt(entry.broken_eggs) || 0,
          production_rate: parseFloat(entry.production_rate) || 0,
          remarks: entry.remarks || null,
          updated_at: new Date().toISOString(),
        }
        saveLocalDailyEntry(localEntry)
        addToPendingSync({
          type: "daily_entry",
          data: localEntry,
          timestamp: new Date().toISOString(),
        })
      }
    }

    for (const entry of Object.values(gradeEntries)) {
      const hasData = entry.boxes || entry.pieces || entry.percentage

      if (hasData) {
        const localGrade = {
          entry_date: dateStr,
          grade: entry.grade,
          boxes: parseFloat(entry.boxes) || 0,
          pieces: parseInt(entry.pieces) || 0,
          percentage: parseFloat(entry.percentage) || 0,
          updated_at: new Date().toISOString(),
        }
        saveLocalEggGrade(localGrade)
        addToPendingSync({
          type: "egg_grade",
          data: localGrade,
          timestamp: new Date().toISOString(),
        })
      }
    }

    setPendingCount(getPendingSyncCount())
  }

  async function handleSync() {
    setSyncing(true)
    setMessage(null)

    const queue = getPendingSyncQueue()
    if (queue.length === 0) {
      setMessage({ type: "success", text: "Nothing to sync." })
      setSyncing(false)
      return
    }

    try {
      for (const item of queue) {
        if (item.type === "daily_entry") {
          const { error } = await supabase
            .from("daily_entries")
            .upsert(item.data as unknown as Record<string, unknown>, { onConflict: "entry_date,coop_id" })
          if (error) throw error
        } else {
          const { error } = await supabase
            .from("egg_grades")
            .upsert(item.data as unknown as Record<string, unknown>, { onConflict: "entry_date,grade" })
          if (error) throw error
        }
      }

      clearPendingSyncQueue()
      setPendingCount(0)
      setIsOffline(false)
      setOfflineMode(false)
      setMessage({ type: "success", text: `Synced ${queue.length} entries to database!` })
    } catch (error) {
      console.error("Sync failed:", error)
      setMessage({ type: "error", text: "Sync failed — database still unavailable. Try again later." })
    } finally {
      setSyncing(false)
    }
  }

  const coopTotals = calculateCoopTotals()
  const gradeTotals = calculateGradeTotals()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Offline Banner */}
      {isOffline && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <WifiOff className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Offline Mode — Database unavailable. Data is saved locally.
                </span>
              </div>
              {pendingCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSync}
                  disabled={syncing}
                  className="border-amber-400 text-amber-700 hover:bg-amber-100"
                >
                  {syncing ? (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-3 w-3" />
                  )}
                  Sync {pendingCount} entries
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Date Picker */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Select Date</CardTitle>
        </CardHeader>
        <CardContent>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[280px] justify-start text-left font-normal",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => d && setDate(d)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>

      {/* Coop Production Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Daily Egg Production</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium">Coop</th>
                  <th className="px-3 py-2 text-left font-medium">Age/Week</th>
                  <th className="px-3 py-2 text-left font-medium">Chickens</th>
                  <th className="px-3 py-2 text-left font-medium">Dead</th>
                  <th className="px-3 py-2 text-left font-medium">Balance</th>
                  <th className="px-3 py-2 text-left font-medium">Egg Per Tray</th>
                  <th className="px-3 py-2 text-left font-medium">2nd Grade</th>
                  <th className="px-3 py-2 text-left font-medium">Prod. Rate %</th>
                  <th className="px-3 py-2 text-left font-medium">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {coops.map((coop) => (
                  <tr key={coop.id} className="border-b">
                    <td className="px-3 py-2 font-medium">{coop.name}</td>
                    <td className="px-1 py-1">
                      <Input
                        type="number"
                        value={coopEntries[coop.id]?.age || ""}
                        onChange={(e) => updateCoopEntry(coop.id, "age", e.target.value)}
                        className="h-8 w-16"
                      />
                    </td>
                    <td className="px-1 py-1">
                      <Input
                        type="number"
                        value={coopEntries[coop.id]?.number_of_chickens || ""}
                        onChange={(e) => updateCoopEntry(coop.id, "number_of_chickens", e.target.value)}
                        className="h-8 w-20"
                      />
                    </td>
                    <td className="px-1 py-1">
                      <Input
                        type="number"
                        value={coopEntries[coop.id]?.dead_chickens || ""}
                        onChange={(e) => updateCoopEntry(coop.id, "dead_chickens", e.target.value)}
                        className="h-8 w-16"
                      />
                    </td>
                    <td className="px-1 py-1">
                      <Input
                        type="number"
                        value={coopEntries[coop.id]?.balance_stock || ""}
                        onChange={(e) => updateCoopEntry(coop.id, "balance_stock", e.target.value)}
                        className="h-8 w-20"
                      />
                    </td>
                    <td className="px-1 py-1">
                      <Input
                        type="number"
                        step="0.01"
                        value={coopEntries[coop.id]?.egg_boxes || ""}
                        onChange={(e) => updateCoopEntry(coop.id, "egg_boxes", e.target.value)}
                        className="h-8 w-20"
                      />
                    </td>
                    <td className="px-1 py-1">
                      <Input
                        type="number"
                        value={coopEntries[coop.id]?.broken_eggs || ""}
                        onChange={(e) => updateCoopEntry(coop.id, "broken_eggs", e.target.value)}
                        className="h-8 w-16"
                      />
                    </td>
                    <td className="px-1 py-1">
                      <Input
                        type="number"
                        step="0.01"
                        value={coopEntries[coop.id]?.production_rate || ""}
                        onChange={(e) => updateCoopEntry(coop.id, "production_rate", e.target.value)}
                        className="h-8 w-20"
                      />
                    </td>
                    <td className="px-1 py-1">
                      <Input
                        value={coopEntries[coop.id]?.remarks || ""}
                        onChange={(e) => updateCoopEntry(coop.id, "remarks", e.target.value)}
                        className="h-8 w-32"
                      />
                    </td>
                  </tr>
                ))}
                {/* Totals Row */}
                <tr className="bg-muted/50 font-semibold">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2">-</td>
                  <td className="px-3 py-2">{coopTotals.totalChickens}</td>
                  <td className="px-3 py-2">{coopTotals.totalDead}</td>
                  <td className="px-3 py-2">{coopTotals.totalBalance}</td>
                  <td className="px-3 py-2">{coopTotals.totalEggBoxes}</td>
                  <td className="px-3 py-2">{coopTotals.totalBrokenEggs}</td>
                  <td className="px-3 py-2">{coopTotals.avgProductionRate}%</td>
                  <td className="px-3 py-2">-</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Egg Grades Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Egg Grading</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium">Grade</th>
                  <th className="px-3 py-2 text-left font-medium">Box</th>
                  <th className="px-3 py-2 text-left font-medium">Pcs</th>
                  <th className="px-3 py-2 text-left font-medium">Percentage %</th>
                </tr>
              </thead>
              <tbody>
                {GRADES.map((grade) => (
                  <tr key={grade} className="border-b">
                    <td className="px-3 py-2 font-medium">{grade}</td>
                    <td className="px-1 py-1">
                      <Input
                        type="number"
                        step="0.01"
                        value={gradeEntries[grade]?.boxes || ""}
                        onChange={(e) => updateGradeEntry(grade, "boxes", e.target.value)}
                        className="h-8 w-24"
                      />
                    </td>
                    <td className="px-1 py-1">
                      <Input
                        type="number"
                        value={gradeEntries[grade]?.pieces || ""}
                        onChange={(e) => updateGradeEntry(grade, "pieces", e.target.value)}
                        className="h-8 w-24"
                      />
                    </td>
                    <td className="px-1 py-1">
                      <Input
                        type="number"
                        step="0.01"
                        value={gradeEntries[grade]?.percentage || ""}
                        onChange={(e) => updateGradeEntry(grade, "percentage", e.target.value)}
                        className="h-8 w-24"
                      />
                    </td>
                  </tr>
                ))}
                {/* Totals Row */}
                <tr className="bg-muted/50 font-semibold">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2">{gradeTotals.totalBoxes}</td>
                  <td className="px-3 py-2">{gradeTotals.totalPieces}</td>
                  <td className="px-3 py-2">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex items-center gap-4">
        <Button onClick={handleSave} disabled={saving} className="min-w-[120px]">
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Data
        </Button>
        {message && (
          <p
            className={cn(
              "text-sm",
              message.type === "success" && "text-green-600",
              message.type === "error" && "text-red-600",
              message.type === "warning" && "text-amber-600"
            )}
          >
            {message.text}
          </p>
        )}
      </div>
    </div>
  )
}
