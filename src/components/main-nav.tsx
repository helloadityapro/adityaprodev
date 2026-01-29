"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  FolderKanban,
  FilePlus,
  List,
  Users
} from "lucide-react"
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel
} from "@/components/ui/sidebar"

export function MainNav({ userRole }: { userRole: string }) {
  const pathname = usePathname()

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <Link href="/dashboard" legacyBehavior passHref>
            <SidebarMenuButton tooltip="Projects" isActive={pathname === '/dashboard'}>
              <FolderKanban />
              Projects
            </SidebarMenuButton>
          </Link>
        </SidebarMenuItem>
      </SidebarMenu>
      <SidebarGroup>
        <SidebarGroupLabel>PtW</SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuItem>
            <Link href="/ptw/raise" legacyBehavior passHref>
              <SidebarMenuButton tooltip="Raise PtW" isActive={pathname === '/ptw/raise'}>
                <FilePlus />
                Raise PtW
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <Link href="/ptw/list" legacyBehavior passHref>
              <SidebarMenuButton tooltip="List of PtW" isActive={pathname === '/ptw/list'}>
                <List />
                List of PtW
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
      {userRole === "admin" && (
        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <Link href="/settings/users" legacyBehavior passHref>
                <SidebarMenuButton tooltip="User Management" isActive={pathname.startsWith('/settings/users')}>
                  <Users />
                  Users management
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      )}
    </>
  )
}
