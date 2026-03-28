"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ChevronDown,
  History,
  FolderOpen,
  BookOpen,
  FileBarChart,
  CalendarDays,
  Trophy,
  LayoutDashboard,
  MapPin,
  Coins,
  Truck,
  Workflow,
  Users,
  SlidersHorizontal,
  FileCheck,
  Briefcase,
  Boxes,
  UserCog,
  HardHat,
  Gavel,
  PackageCheck,
  ShieldCheck,
  ShoppingBag,
  CirclePlus,
  TrendingUp,
  HandCoins,
  FilePlus,
  MapPinned,
  Car,
  CalendarCheck,
  Clock,
  List,
  Building2,
  Navigation,
  CheckSquare,
  ListTodo,
  FileText,
  Table as TableIcon,
  ArrowLeftRight,
  UserPlus,
  Activity,
  Fuel,
  Plus,
  Settings2,
  Tag
} from "lucide-react"
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
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
      {/* Main Section */}
      <SidebarGroup>
        <SidebarGroupLabel className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Main Hub</SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Dashboard" isActive={pathname === '/reports'} className="rounded-sm" onClick={handleMobileClose}>
              <Link href="/reports">
                <FileBarChart className="h-4 w-4 text-primary" />
                <span className="font-bold">Dashboard</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Documents" isActive={pathname.startsWith('/documents')} className="rounded-sm" onClick={handleMobileClose}>
              <Link href="/documents">
                <FolderOpen className="h-4 w-4" />
                <span className="font-medium">Documents</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Learning Hub" isActive={pathname.startsWith('/lms')} className="rounded-sm" onClick={handleMobileClose}>
              <Link href="/lms">
                <BookOpen className="h-4 w-4" />
                <span className="font-medium">Learning Hub</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Rewards" isActive={pathname === '/rewards'} className="rounded-sm" onClick={handleMobileClose}>
              <Link href="/rewards">
                <Trophy className="h-4 w-4 text-amber-500" />
                <span className="font-medium">Rewards</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>

      {/* Operations Section */}
      <SidebarGroup>
        <SidebarGroupLabel className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Operations</SidebarGroupLabel>
        <SidebarMenu>
          {/* Projects Sub-Section */}
          {!isDriver && (
            <Collapsible asChild defaultOpen={pathname.startsWith('/projects')} className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip="Projects" isActive={pathname.startsWith('/projects')} className="rounded-sm">
                    <Briefcase className="h-4 w-4 text-primary" />
                    <span className="font-medium">Projects</span>
                    <ChevronDown className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {isAdmin && (
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={pathname === '/projects/add'} onClick={handleMobileClose}>
                          <Link href="/projects/add">
                            <Plus className="h-4 w-4" />
                            <span>Add New Project</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    )}
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === '/projects/list'} onClick={handleMobileClose}>
                        <Link href="/projects/list">
                          <List className="h-4 w-4" />
                          <span>Manage Projects</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          )}

          {/* Inventory Sub-Section */}
          {!isDriver && (
            <Collapsible asChild defaultOpen={pathname.startsWith('/inventory')} className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip="Inventory" isActive={pathname.startsWith('/inventory')} className="rounded-sm">
                    <Boxes className="h-4 w-4 text-primary" />
                    <span className="font-medium">Inventory</span>
                    <ChevronDown className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === '/inventory/global'} onClick={handleMobileClose}>
                        <Link href="/inventory/global">
                          <PackageCheck className="h-4 w-4" />
                          <span>Global Inventory</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === '/inventory/record'} onClick={handleMobileClose}>
                        <Link href="/inventory/record">
                          <ArrowLeftRight className="h-4 w-4" />
                          <span>Record Movement</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === '/inventory/data'} onClick={handleMobileClose}>
                        <Link href="/inventory/data">
                          <TableIcon className="h-4 w-4" />
                          <span>Movement Data</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    {isAdmin && (
                      <>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={pathname === '/inventory/manage'} onClick={handleMobileClose}>
                            <Link href="/inventory/manage">
                              <Settings2 className="h-4 w-4 text-primary" />
                              <span>Manage Items</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={pathname === '/inventory/categories'} onClick={handleMobileClose}>
                            <Link href="/inventory/categories">
                              <Tag className="h-4 w-4 text-primary" />
                              <span>Categories</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </>
                    )}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          )}

          {/* PO Sub-Section */}
          {!isDriver && (
            <Collapsible asChild defaultOpen={pathname.startsWith('/purchase-orders')} className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip="Purchase Orders" isActive={pathname.startsWith('/purchase-orders')} className="rounded-sm">
                    <ShoppingBag className="h-4 w-4 text-primary" />
                    <span className="font-medium">Purchase Orders</span>
                    <ChevronDown className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === '/purchase-orders/create'} onClick={handleMobileClose}>
                        <Link href="/purchase-orders/create">
                          <CirclePlus className="h-4 w-4" />
                          <span>Add New PO</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === '/purchase-orders/manage'} onClick={handleMobileClose}>
                        <Link href="/purchase-orders/manage">
                          <List className="h-4 w-4" />
                          <span>Manage PO</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === '/purchase-orders/suppliers'} onClick={handleMobileClose}>
                        <Link href="/purchase-orders/suppliers">
                          <TrendingUp className="h-4 w-4" />
                          <span>Supplier Summary</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          )}

          {/* WO Sub-Section */}
          {!isDriver && (
            <Collapsible asChild defaultOpen={pathname.startsWith('/work-orders')} className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip="Work Orders" isActive={pathname.startsWith('/work-orders')} className="rounded-sm">
                    <Gavel className="h-4 w-4 text-primary" />
                    <span className="font-medium">Work Orders</span>
                    <ChevronDown className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === '/work-orders/create'} onClick={handleMobileClose}>
                        <Link href="/work-orders/create">
                          <CirclePlus className="h-4 w-4" />
                          <span>Add New WO</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === '/work-orders/manage'} onClick={handleMobileClose}>
                        <Link href="/work-orders/manage">
                          <List className="h-4 w-4" />
                          <span>Manage WO</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === '/work-orders/contractors'} onClick={handleMobileClose}>
                        <Link href="/work-orders/contractors">
                          <TrendingUp className="h-4 w-4" />
                          <span>Contractor Summary</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          )}

          {/* Payments Sub-Section */}
          {!isDriver && (
            <Collapsible asChild defaultOpen={pathname.startsWith('/payments')} className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip="Payments" isActive={pathname.startsWith('/payments')} className="rounded-sm">
                    <HandCoins className="h-4 w-4 text-primary" />
                    <span className="font-medium">Payments</span>
                    <ChevronDown className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === '/payments/record'} onClick={handleMobileClose}>
                        <Link href="/payments/record">
                          <CirclePlus className="h-4 w-4" />
                          <span>Record Payment</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === '/payments/project-wise'} onClick={handleMobileClose}>
                        <Link href="/payments/project-wise">
                          <Building2 className="h-4 w-4" />
                          <span>Project-wise</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === '/payments/supplier-wise'} onClick={handleMobileClose}>
                        <Link href="/payments/supplier-wise">
                          <Truck className="h-4 w-4" />
                          <span>Supplier-wise</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === '/payments/contractor-wise'} onClick={handleMobileClose}>
                        <Link href="/payments/contractor-wise">
                          <HardHat className="h-4 w-4" />
                          <span>Contractor-wise</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          )}

          {/* DPR Sub-Section */}
          {!isDriver && (
            <Collapsible asChild defaultOpen={pathname.startsWith('/dpr')} className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip="DPR" isActive={pathname.startsWith('/dpr')} className="rounded-sm">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="font-medium">DPR</span>
                    <ChevronDown className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === '/dpr/submit'} onClick={handleMobileClose}>
                        <Link href="/dpr/submit">
                          <FilePlus className="h-4 w-4" />
                          <span>Submit DPR</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === '/dpr/list'} onClick={handleMobileClose}>
                        <Link href="/dpr/list">
                          <TableIcon className="h-4 w-4" />
                          <span>DPR Data</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          )}

          {/* Tasks Sub-Section */}
          {!isDriver && (
            <Collapsible asChild defaultOpen={pathname.startsWith('/tasks')} className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip="Tasks" isActive={pathname.startsWith('/tasks')} className="rounded-sm">
                    <CheckSquare className="h-4 w-4 text-primary" />
                    <span className="font-medium">Tasks</span>
                    <ChevronDown className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === '/tasks/create'} onClick={handleMobileClose}>
                        <Link href="/tasks/create">
                          <UserPlus className="h-4 w-4" />
                          <span>Assign Task</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === '/tasks/list'} onClick={handleMobileClose}>
                        <Link href="/tasks/list">
                          <ListTodo className="h-4 w-4" />
                          <span>Task Board</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          )}

          {/* Permits Sub-Section */}
          {!isDriver && (
            <Collapsible asChild defaultOpen={pathname.startsWith('/ptw')} className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip="Permits" isActive={pathname.startsWith('/ptw')} className="rounded-sm">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <span className="font-medium flex items-center gap-2">
                      Permits
                      {(isAdmin || isManager) && pendingPtwCount > 0 && (
                        <div className="bg-red-600 text-white rounded-full font-black h-5 min-w-5 flex items-center justify-center text-[9px] shadow-sm animate-in zoom-in duration-300 px-1 shrink-0">
                          {pendingPtwCount}
                        </div>
                      )}
                    </span>
                    <ChevronDown className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === '/ptw/raise'} onClick={handleMobileClose}>
                        <Link href="/ptw/raise">
                          <FilePlus className="h-4 w-4" />
                          <span>Request a PtW</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === '/ptw/list'} onClick={handleMobileClose}>
                        <Link href="/ptw/list">
                          <List className="h-4 w-4" />
                          <span>My PtWs</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === '/ptw/activities'} onClick={handleMobileClose}>
                        <Link href="/ptw/activities">
                          <History className="h-4 w-4" />
                          <span>PtW Activities</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          )}

          {/* Visits Sub-Section */}
          {!isDriver && (
            <Collapsible asChild defaultOpen={pathname.startsWith('/site-visits')} className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip="Visits" isActive={pathname.startsWith('/site-visits')} className="rounded-sm">
                    <Navigation className="h-4 w-4 text-primary" />
                    <span className="font-medium">Visits</span>
                    <ChevronDown className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === '/site-visits/start'} onClick={handleMobileClose}>
                        <Link href="/site-visits/start">
                          <Navigation className="h-4 w-4" />
                          <span>Start a Site Visit</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === '/site-visits/active'} onClick={handleMobileClose}>
                        <Link href="/site-visits/active">
                          <Activity className="h-4 w-4" />
                          <span>Active Visits</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === '/site-visits/history'} onClick={handleMobileClose}>
                        <Link href="/site-visits/history">
                          <History className="h-4 w-4" />
                          <span>Visits Data</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          )}

          {/* Vehicles Sub-Section (Logistics & Fleet) */}
          <Collapsible asChild defaultOpen={pathname.startsWith('/vehicles')} className="group/collapsible">
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton tooltip="Vehicles" isActive={pathname.startsWith('/vehicles')} className="rounded-sm">
                  <Car className="h-4 w-4 text-primary" />
                  <span className="font-medium">Vehicles</span>
                  <ChevronDown className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {!isDriver && (
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === '/vehicles/request'} onClick={handleMobileClose}>
                        <Link href="/vehicles/request">
                          <Fuel className="h-4 w-4" />
                          <span>Request a Vehicle</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  )}
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={pathname === '/vehicles/trips/manage'} onClick={handleMobileClose}>
                      <Link href="/vehicles/trips/manage">
                        <MapPinned className="h-4 w-4" />
                        <span>Trips</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>

          {/* Attendance Sub-Section */}
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
        </SidebarMenu>
      </SidebarGroup>
      
      {/* ADMINISTRATION Section */}
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
                  <SidebarMenuButton asChild tooltip="Admin Dashboard" isActive={pathname === '/admin/dashboard'} className="rounded-sm" onClick={handleMobileClose}>
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
                  <SidebarMenuButton asChild tooltip="Manage Vehicles" isActive={pathname === '/vehicles/manage'} className="rounded-sm" onClick={handleMobileClose}>
                    <Link href="/vehicles/manage">
                      <Car className="h-4 w-4 text-primary" />
                      <span className="font-medium">Manage Vehicles</span>
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
                  <SidebarMenuButton asChild tooltip="Contractors" isActive={pathname.startsWith('/settings/contractors')} className="rounded-sm" onClick={handleMobileClose}>
                    <Link href="/settings/contractors">
                      <HardHat className="h-4 w-4" />
                      <span className="font-medium">Contractors</span>
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
