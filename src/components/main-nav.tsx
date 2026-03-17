"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  FilePlus,
  List,
  ChevronDown,
  CalendarCheck,
  Clock,
  History,
  FolderOpen,
  GraduationCap,
  Trophy,
  Fuel,
  MapPinned,
  Car,
  Navigation,
  Activity,
  CheckSquare,
  ListTodo,
  FileText,
  Table as TableIcon,
  Package,
  ClipboardList,
  ArrowLeftRight,
  FileBarChart,
  CalendarDays,
  BookOpen,
  LayoutDashboard,
  MapPin,
  Coins,
  Truck,
  Workflow,
  Users,
  SlidersHorizontal,
  FileCheck,
  Briefcase,
  Boxes
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
  useSidebar,
} from "@/components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

export function MainNav({ userRole, pendingPtwCount }: { userRole: string, pendingPtwCount: number }) {
  const pathname = usePathname()
  const isDriver = userRole === 'Driver';
  const isAdmin = userRole === 'Admin';
  const isManager = userRole === 'Site Manager';
  const isAdminOrHR = isAdmin || userRole === 'Manager - Human Resources';
  
  const { setOpenMobile, isMobile } = useSidebar();

  const handleMobileClose = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 py-2 flex-1">
      {/* Main Operations Section */}
      <SidebarGroup>
        <SidebarGroupLabel className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Operations</SidebarGroupLabel>
        <SidebarMenu>
          {!isDriver && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Manage Projects" isActive={pathname.startsWith('/projects')} className="rounded-sm" onClick={handleMobileClose}>
                <Link href="/projects/list">
                  <Briefcase className="h-4 w-4 text-primary" />
                  <span className="font-bold">Manage Projects</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}

          {!isDriver && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Master Inventory" isActive={pathname === '/inventory'} className="rounded-sm" onClick={handleMobileClose}>
                <Link href="/inventory">
                  <Boxes className="h-4 w-4" />
                  <span className="font-medium">Master Inventory</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}

          {!isDriver && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Reports" isActive={pathname === '/reports'} className="rounded-sm" onClick={handleMobileClose}>
                <Link href="/reports">
                  <FileBarChart className="h-4 w-4" />
                  <span className="font-medium">Reports Dashboard</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          
          <Collapsible asChild defaultOpen={pathname.startsWith('/attendance')} className="group/collapsible">
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton tooltip="Attendance" isActive={pathname.startsWith('/attendance')} className="rounded-sm">
                  <CalendarCheck className="h-4 w-4 text-emerald-600" />
                  <span className="font-medium">Attendance Logs</span>
                  <ChevronDown className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={pathname === '/attendance/check-in' || pathname === '/attendance/check-out'} onClick={handleMobileClose}>
                      <Link href="/attendance">
                        <Clock className="h-4 w-4" />
                        <span>Check-in / Out</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={pathname === '/attendance/history'} onClick={handleMobileClose}>
                      <Link href="/attendance/history">
                        <History className="h-4 w-4" />
                        <span>Attendance History</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>

          {!isDriver && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Documents" isActive={pathname.startsWith('/documents')} className="rounded-sm" onClick={handleMobileClose}>
                <Link href="/documents">
                  <FolderOpen className="h-4 w-4" />
                  <span className="font-medium">Site Documents</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Learning Hub" isActive={pathname.startsWith('/lms')} className="rounded-sm" onClick={handleMobileClose}>
              <Link href="/lms">
                <GraduationCap className="h-4 w-4" />
                <span className="font-medium">Training Center</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Rewards & Points" isActive={pathname === '/rewards'} className="rounded-sm" onClick={handleMobileClose}>
              <Link href="/rewards">
                <Trophy className="h-4 w-4 text-amber-500" />
                <span className="font-medium">Points Bank</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>

      {/* Field Activities Group */}
      {!isDriver && (
        <>
          <SidebarGroup>
            <SidebarGroupLabel className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Field Presence</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Start a Site Visit" isActive={pathname === '/site-visits/start'} className="rounded-sm" onClick={handleMobileClose}>
                  <Link href="/site-visits/start">
                    <Navigation className="h-4 w-4" />
                    <span className="font-medium">Start a Site Visit</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Active Visits" isActive={pathname === '/site-visits/active'} className="rounded-sm" onClick={handleMobileClose}>
                  <Link href="/site-visits/active">
                    <Activity className="h-4 w-4" />
                    <span className="font-medium">Ongoing Visits</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Visit History" isActive={pathname === '/site-visits/history'} className="rounded-sm" onClick={handleMobileClose}>
                  <Link href="/site-visits/history">
                    <History className="h-4 w-4" />
                    <span className="font-medium">Visit Archive</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">HSE Compliance</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Raise a PtW" isActive={pathname === '/ptw/raise'} className="rounded-sm" onClick={handleMobileClose}>
                  <Link href="/ptw/raise">
                    <FilePlus className="h-4 w-4" />
                    <span className="font-medium">Raise a PtW</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="My PtWs" isActive={pathname === '/ptw/list'} className="rounded-sm" onClick={handleMobileClose}>
                  <Link href="/ptw/list">
                    <List className="h-4 w-4" />
                    <span className="font-medium">My PtWs</span>
                  </Link>
                </SidebarMenuButton>
                {(isAdmin || isManager) && pendingPtwCount > 0 && (
                  <SidebarMenuBadge className="bg-red-500 text-white rounded-sm font-bold h-4 min-w-4 text-[10px]">
                    {pendingPtwCount}
                  </SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Documentation</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Submit DPR" isActive={pathname === '/dpr/submit'} className="rounded-sm" onClick={handleMobileClose}>
                  <Link href="/dpr/submit">
                    <FilePlus className="h-4 w-4" />
                    <span className="font-medium">Submit Daily Report</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="DPR Data" isActive={pathname === '/dpr/list'} className="rounded-sm" onClick={handleMobileClose}>
                  <Link href="/dpr/list">
                    <TableIcon className="h-4 w-4" />
                    <span className="font-medium">Report Repository</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </>
      )}

      {/* Requirement & Movement */}
      {!isDriver && (
        <>
          <SidebarGroup>
            <SidebarGroupLabel className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">SITE REQUIREMENTS</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Submit Requirement" isActive={pathname === '/requirements/submit'} className="rounded-sm" onClick={handleMobileClose}>
                  <Link href="/requirements/submit">
                    <Package className="h-4 w-4" />
                    <span className="font-medium">Submit Requirement</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Requirement Data" isActive={pathname === '/requirements/list'} className="rounded-sm" onClick={handleMobileClose}>
                  <Link href="/requirements/list">
                    <ClipboardList className="h-4 w-4" />
                    <span className="font-medium">Requirement Data</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">MATERIAL MOVEMENT</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Record Movement" isActive={pathname === '/movements/record'} className="rounded-sm" onClick={handleMobileClose}>
                  <Link href="/movements/record">
                    <ArrowLeftRight className="h-4 w-4" />
                    <span className="font-medium">Record Movement</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Movement Data" isActive={pathname === '/movements/list'} className="rounded-sm" onClick={handleMobileClose}>
                  <Link href="/movements/list">
                    <TableIcon className="h-4 w-4" />
                    <span className="font-medium">Movement Data</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </>
      )}

      {/* Logistics & Fleet */}
      <SidebarGroup>
        <SidebarGroupLabel className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Logistics & Fleet</SidebarGroupLabel>
        <SidebarMenu>
          {!isDriver && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Request a Vehicle" isActive={pathname === '/vehicles/request'} className="rounded-sm" onClick={handleMobileClose}>
                <Link href="/vehicles/request">
                  <Fuel className="h-4 w-4" />
                  <span className="font-medium">Vehicle Request</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Manage Trips" isActive={pathname === '/vehicles/trips/manage'} className="rounded-sm" onClick={handleMobileClose}>
              <Link href="/vehicles/trips/manage">
                <MapPinned className="h-4 w-4 text-indigo-600" />
                <span className="font-bold">Trip Management</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
      
      {/* Administration Section */}
      {isAdminOrHR && (
        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">ADMINISTRATION</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Attendance Summary" isActive={pathname === '/admin/attendance-summary'} className="rounded-sm" onClick={handleMobileClose}>
                <Link href="/admin/attendance-summary">
                  <FileBarChart className="h-4 w-4 text-emerald-600" />
                  <span className="font-bold text-emerald-700">Attendance Summary</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {isAdmin && (
              <>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Day Report" isActive={pathname === '/admin/day-report'} className="rounded-sm" onClick={handleMobileClose}>
                    <Link href="/admin/day-report">
                      <CalendarDays className="h-4 w-4 text-amber-600" />
                      <span className="font-bold text-amber-700">Day Report</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="LMS Admin" isActive={pathname.startsWith('/lms/admin')} className="rounded-sm" onClick={handleMobileClose}>
                    <Link href="/lms/admin">
                      <BookOpen className="h-4 w-4 text-primary" />
                      <span className="font-bold">LMS Admin</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Dashboard" isActive={pathname === '/admin/dashboard'} className="rounded-sm" onClick={handleMobileClose}>
                    <Link href="/admin/dashboard">
                      <LayoutDashboard className="h-4 w-4" />
                      <span className="font-medium">Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Permit Management" isActive={pathname === '/settings/permits'} className="rounded-sm" onClick={handleMobileClose}>
                    <Link href="/settings/permits">
                      <FileCheck className="h-4 w-4 text-primary" />
                      <span className="font-bold">Permit Management</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Manage Sites" isActive={pathname === '/settings/manage-sites'} className="rounded-sm" onClick={handleMobileClose}>
                    <Link href="/settings/manage-sites">
                      <MapPin className="h-4 w-4" />
                      <span className="font-medium">Manage Sites</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Rewards Setup" isActive={pathname === '/settings/rewards'} className="rounded-sm" onClick={handleMobileClose}>
                    <Link href="/settings/rewards">
                      <Coins className="h-4 w-4 text-amber-600" />
                      <span className="font-medium">Rewards Setup</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Suppliers" isActive={pathname.startsWith('/settings/suppliers')} className="rounded-sm" onClick={handleMobileClose}>
                    <Link href="/settings/suppliers">
                      <Truck className="h-4 w-4" />
                      <span className="font-medium">Suppliers</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Users" isActive={pathname.startsWith('/settings/users')} className="rounded-sm" onClick={handleMobileClose}>
                    <Link href="/settings/users">
                      <Users className="h-4 w-4" />
                      <span className="font-medium">Users</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Teams" isActive={pathname === '/settings/teams'} className="rounded-sm" onClick={handleMobileClose}>
                    <Link href="/settings/teams">
                      <Workflow className="h-4 w-4" />
                      <span className="font-medium">Teams</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Settings" isActive={pathname.startsWith('/settings/dropdown-management')} className="rounded-sm" onClick={handleMobileClose}>
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
