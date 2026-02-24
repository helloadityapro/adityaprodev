
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  FolderKanban,
  FilePlus,
  List,
  Users,
  LayoutDashboard,
  SlidersHorizontal,
  Workflow,
  MapPin,
  History,
  FileText,
  Table as TableIcon,
  Package,
  ClipboardList,
} from "lucide-react"
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenuBadge,
} from "@/components/ui/sidebar"

export function MainNav({ userRole, pendingPtwCount }: { userRole: string, pendingPtwCount: number }) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col gap-4 py-2 flex-1">
      <SidebarGroup>
        <SidebarGroupLabel className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Main</SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Projects" isActive={pathname === '/dashboard'} className="rounded-sm">
              <Link href="/dashboard">
                <FolderKanban className="h-4 w-4" />
                <span className="font-medium">Projects</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Permit to Work</SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Raise PtW" isActive={pathname === '/ptw/raise'} className="rounded-sm">
              <Link href="/ptw/raise">
                <FilePlus className="h-4 w-4" />
                <span className="font-medium">Raise PtW</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="List of PtW" isActive={pathname === '/ptw/list'} className="rounded-sm">
              <Link href="/ptw/list">
                <List className="h-4 w-4" />
                <span className="font-medium">List of PtW</span>
              </Link>
            </SidebarMenuButton>
            {(userRole === 'Admin' || userRole === 'Site Manager') && pendingPtwCount > 0 && (
                <SidebarMenuBadge className="bg-red-500 text-white rounded-sm font-bold h-4 min-w-4 text-[10px]">
                    {pendingPtwCount}
                </SidebarMenuBadge>
            )}
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Activities" isActive={pathname === '/ptw/activities'} className="rounded-sm">
              <Link href="/ptw/activities">
                <History className="h-4 w-4" />
                <span className="font-medium">PtW Activities</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">DPR Reporting</SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Submit DPR" isActive={pathname === '/dpr/submit'} className="rounded-sm">
              <Link href="/dpr/submit">
                <FilePlus className="h-4 w-4" />
                <span className="font-medium">Submit DPR</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="DPR Data" isActive={pathname === '/dpr/list'} className="rounded-sm">
              <Link href="/dpr/list">
                <TableIcon className="h-4 w-4" />
                <span className="font-medium">DPR Data</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Site Requirements</SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Submit Requirement" isActive={pathname === '/requirements/submit'} className="rounded-sm">
              <Link href="/requirements/submit">
                <Package className="h-4 w-4" />
                <span className="font-medium">Submit Requirement</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Requirement Data" isActive={pathname === '/requirements/list'} className="rounded-sm">
              <Link href="/requirements/list">
                <ClipboardList className="h-4 w-4" />
                <span className="font-medium">Requirement Data</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
      
      {(userRole === "Admin" || userRole === "Site Manager") && (
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Management</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Assign Sites" isActive={pathname === '/settings/site-assignment'} className="rounded-sm">
                <Link href="/settings/site-assignment">
                  <MapPin className="h-4 w-4" />
                  <span className="font-medium">Assign Sites</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      )}

      {userRole === "Admin" && (
        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Administration</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Dashboard" isActive={pathname === '/admin/dashboard'} className="rounded-sm">
                <Link href="/admin/dashboard">
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="font-medium">Dashboard</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Users" isActive={pathname.startsWith('/settings/users')} className="rounded-sm">
                <Link href="/settings/users">
                  <Users className="h-4 w-4" />
                  <span className="font-medium">Users</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Teams" isActive={pathname === '/settings/teams'} className="rounded-sm">
                <Link href="/settings/teams">
                  <Workflow className="h-4 w-4" />
                  <span className="font-medium">Teams</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Settings" isActive={pathname.startsWith('/settings/dropdown-management')} className="rounded-sm">
                <Link href="/settings/dropdown-management">
                  <SlidersHorizontal className="h-4 w-4" />
                  <span className="font-medium">Settings</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      )}
    </div>
  )
}
