"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DailyEntryForm } from "@/components/daily-entry-form"
import { MonthlyReport } from "@/components/monthly-report"
import { YearlyReport } from "@/components/yearly-report"
import { Egg, ClipboardList, BarChart3, Calendar, AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function EggTracker() {
  const [activeTab, setActiveTab] = useState("daily")

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
              <Egg className="h-6 w-6 text-amber-700" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Egg Production Tracker</h1>
              <p className="text-sm text-muted-foreground">Track your daily egg production and grades</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        {/* Migration Notice */}
        <Alert className="mb-6 border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
          <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertTitle className="text-blue-900 dark:text-blue-100">Site Migrated</AlertTitle>
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            This site has been migrated to a new location.{" "}
            <a 
              href="https://egg-reports.lovable.app/" 
              className="font-medium underline underline-offset-4 hover:text-blue-600 dark:hover:text-blue-300"
              target="_blank"
              rel="noopener noreferrer"
            >
              Visit the new site here
            </a>
          </AlertDescription>
        </Alert>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-xl grid-cols-3">
            <TabsTrigger value="daily" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              Daily Entry
            </TabsTrigger>
            <TabsTrigger value="monthly" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Monthly Reports
            </TabsTrigger>
            <TabsTrigger value="yearly" className="gap-2">
              <Calendar className="h-4 w-4" />
              Yearly Reports
            </TabsTrigger>
          </TabsList>

          <TabsContent value="daily" className="space-y-6">
            <DailyEntryForm />
          </TabsContent>

          <TabsContent value="monthly" className="space-y-6">
            <MonthlyReport />
          </TabsContent>

          <TabsContent value="yearly" className="space-y-6">
            <YearlyReport />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
