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
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild tooltip="Projects" isActive={pathname === '/dashboard'}>
            <Link href="/dashboard">
              <FolderKanban />
              Projects
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
      <SidebarGroup>
        <SidebarGroupLabel>PtW</SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Raise PtW" isActive={pathname === '/ptw/raise'}>
              <Link href="/ptw/raise">
                <FilePlus />
                Raise PtW
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="List of PtW" isActive={pathname === '/ptw/list'}>
              <Link href="/ptw/list">
                <List />
                List of PtW
              </Link>
            </SidebarMenuButton>
            {(userRole === 'Admin' || userRole === 'Supervisor') && pendingPtwCount > 0 && (
                <SidebarMenuBadge className="bg-red-500 text-white">
                    {pendingPtwCount}
                </SidebarMenuBadge>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
      {userRole === "Admin" && (
        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel>Admin</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Dashboard" isActive={pathname === '/admin/dashboard'}>
                <Link href="/admin/dashboard">
                  <LayoutDashboard />
                  Dashboard
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="User Management" isActive={pathname.startsWith('/settings/users')}>
                <Link href="/settings/users">
                  <Users />
                  Users management
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Add Options" isActive={pathname.startsWith('/settings/dropdown-management')}>
                <Link href="/settings/dropdown-management">
                  <SlidersHorizontal />
                  Add Options
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      )}
    </>
  )
}
