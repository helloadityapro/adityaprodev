
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
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
  Coins,
  Truck,
  Navigation,
  Activity,
  CalendarCheck,
  Clock,
  ChevronDown,
  CalendarDays,
  FileBarChart,
  Car,
  MapPinned,
  Fuel,
  BookOpen
} from "lucide-react"
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenuBadge,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

export function MainNav({ userRole, pendingPtwCount }: { userRole: string, pendingPtwCount: number }) {
  const pathname = usePathname()
  const isAdminOrHR = userRole === 'Admin' || userRole === 'Manager - Human Resources';

  return (
    <div className="flex flex-col gap-4 py-2 flex-1">
      {/* Main Section */}
      <SidebarGroup>
        <SidebarGroupLabel className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Main</SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Reports" isActive={pathname === '/reports'} className="rounded-sm">
              <Link href="/reports">
                <BarChart3 className="h-4 w-4" />
                <span className="font-medium">Reports</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          
          <Collapsible asChild defaultOpen={pathname.startsWith('/attendance')} className="group/collapsible">
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton tooltip="Attendance" isActive={pathname.startsWith('/attendance')} className="rounded-sm">
                  <CalendarCheck className="h-4 w-4 text-emerald-600" />
                  <span className="font-medium">Attendance</span>
                  <ChevronDown className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={pathname === '/attendance/check-in' || pathname === '/attendance/check-out'}>
                      <Link href="/attendance">
                        <Clock className="h-4 w-4" />
                        <span>Check-in / Out</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={pathname === '/attendance/history'}>
                      <Link href="/attendance/history">
                        <History className="h-4 w-4" />
                        <span>View History</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>

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

      {/* Vehicles Management */}
      <SidebarGroup>
        <SidebarGroupLabel className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Vehicles Management</SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Request a Vehicle" isActive={pathname === '/vehicles/request'} className="rounded-sm">
              <Link href="/vehicles/request">
                <Fuel className="h-4 w-4" />
                <span className="font-medium">Request a Vehicle</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Manage Trips" isActive={pathname === '/vehicles/trips/manage'} className="rounded-sm">
              <Link href="/vehicles/trips/manage">
                <MapPinned className="h-4 w-4 text-indigo-600" />
                <span className="font-bold">Manage Trips</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {userRole === 'Admin' && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Manage Vehicles" isActive={pathname === '/vehicles/manage'} className="rounded-sm">
                <Link href="/vehicles/manage">
                  <Car className="h-4 w-4 text-primary" />
                  <span className="font-bold">Manage Vehicles</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarGroup>

      {/* Site Visits */}
      <SidebarGroup>
        <SidebarGroupLabel className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Site Visits</SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Start Site Visit" isActive={pathname === '/site-visits/start'} className="rounded-sm">
              <Link href="/site-visits/start">
                <Navigation className="h-4 w-4" />
                <span className="font-medium">Start Visit</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Active Visits" isActive={pathname === '/site-visits/active'} className="rounded-sm">
              <Link href="/site-visits/active">
                <Activity className="h-4 w-4" />
                <span className="font-medium">Active Visits</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Visit History" isActive={pathname === '/site-visits/history'} className="rounded-sm">
              <Link href="/site-visits/history">
                <History className="h-4 w-4" />
                <span className="font-medium">Visit History</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>

      {/* Task Management */}
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

      {/* Permit to Work */}
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

      {/* DPR Reporting */}
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

      {/* Site Requirements */}
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

      {/* Material Movement */}
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
      
      {/* Administration Section */}
      {isAdminOrHR && (
        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Administration</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Attendance Summary" isActive={pathname === '/admin/attendance-summary'} className="rounded-sm">
                <Link href="/admin/attendance-summary">
                  <FileBarChart className="h-4 w-4 text-emerald-600" />
                  <span className="font-bold text-emerald-700">Attendance Summary</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {userRole === 'Admin' && (
              <>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Day Report" isActive={pathname === '/admin/day-report'} className="rounded-sm">
                    <Link href="/admin/day-report">
                      <CalendarDays className="h-4 w-4 text-amber-600" />
                      <span className="font-bold text-amber-700">Day Report</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
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
                  <SidebarMenuButton asChild tooltip="Manage Sites" isActive={pathname === '/settings/manage-sites'} className="rounded-sm">
                    <Link href="/settings/manage-sites">
                      <MapPin className="h-4 w-4" />
                      <span className="font-medium">Manage Sites</span>
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
              </>
            )}
          </SidebarMenu>
        </SidebarGroup>
      )}
    </div>
  )
}
