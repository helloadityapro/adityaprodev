
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
  ArrowLeftRight,
  ListTodo,
  CheckSquare,
  FolderOpen,
  Trophy,
  GraduationCap,
  BarChart3,
  BookOpen,
  Coins,
  Truck,
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
          {userRole === 'Admin' && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Projects" isActive={pathname === '/dashboard'} className="rounded-sm">
                <Link href="/dashboard">
                  <FolderKanban className="h-4 w-4" />
                  <span className="font-medium">Projects</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Reports" isActive={pathname === '/reports'} className="rounded-sm">
              <Link href="/reports">
                <BarChart3 className="h-4 w-4" />
                <span className="font-medium">Reports</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Documents" isActive={pathname.startsWith('/documents')} className="rounded-sm">
              <Link href="/documents">
                <FolderOpen className="h-4 w-4" />
                <span className="font-medium">Documents</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Learning Hub" isActive={pathname.startsWith('/lms')} className="rounded-sm">
              <Link href="/lms">
                <GraduationCap className="h-4 w-4" />
                <span className="font-medium">Learning Hub</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Rewards & Points" isActive={pathname === '/rewards'} className="rounded-sm">
              <Link href="/rewards">
                <Trophy className="h-4 w-4 text-amber-500" />
                <span className="font-medium">Points Bank</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Task Management</SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Assign Task" isActive={pathname === '/tasks/create'} className="rounded-sm">
              <Link href="/tasks/create">
                <CheckSquare className="h-4 w-4" />
                <span className="font-medium">Assign Task</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Tasks List" isActive={pathname === '/tasks/list'} className="rounded-sm">
              <Link href="/tasks/list">
                <ListTodo className="h-4 w-4" />
                <span className="font-medium">Tasks List</span>
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

      <SidebarGroup>
        <SidebarGroupLabel className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Material Movement</SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Record Movement" isActive={pathname === '/movements/record'} className="rounded-sm">
              <Link href="/movements/record">
                <ArrowLeftRight className="h-4 w-4" />
                <span className="font-medium">Record Movement</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Movement Data" isActive={pathname === '/movements/list'} className="rounded-sm">
              <Link href="/movements/list">
                <TableIcon className="h-4 w-4" />
                <span className="font-medium">Movement Data</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
      
      {userRole === "Admin" && (
        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Administration</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="LMS Admin" isActive={pathname.startsWith('/lms/admin')} className="rounded-sm">
                <Link href="/lms/admin">
                  <BookOpen className="h-4 w-4 text-primary" />
                  <span className="font-medium text-primary font-bold">LMS Admin</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Dashboard" isActive={pathname === '/admin/dashboard'} className="rounded-sm">
                <Link href="/admin/dashboard">
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="font-medium">Dashboard</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Rewards Setup" isActive={pathname === '/settings/rewards'} className="rounded-sm">
                <Link href="/settings/rewards">
                  <Coins className="h-4 w-4 text-amber-600" />
                  <span className="font-medium">Rewards Setup</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Suppliers" isActive={pathname.startsWith('/settings/suppliers')} className="rounded-sm">
                <Link href="/settings/suppliers">
                  <Truck className="h-4 w-4" />
                  <span className="font-medium">Suppliers</span>
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
