import type React from "react"
import UserNav from "@/components/user-nav"
import AppLogo from "@/components/app-logo"
import { MainNav } from "@/components/main-nav"
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // Mocking user role. In a real app, this would come from an auth context.
  const userRole = "admin" // or "supervisor" or "site-engineer"

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <AppLogo />
        </SidebarHeader>
        <SidebarContent>
          <MainNav userRole={userRole} />
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:h-[60px] lg:px-6">
          <SidebarTrigger />
          <div className="w-full flex-1">
            {/* Can add a search form here if needed */}
          </div>
          <UserNav />
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-muted/40">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
