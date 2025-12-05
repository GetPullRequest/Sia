"use client"

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Home, Users, Blocks, Clock, FolderGit2 } from 'lucide-react'
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar'

const navigation = [
  { name: 'Home', href: '/', icon: Home },
  { name: 'Recents', href: '/recents', icon: Clock },
  { name: 'Agents', href: '/agents', icon: Users },
  { name: 'Repositories', href: '/repositories', icon: FolderGit2 },
  { name: 'Integrations', href: '/integrations', icon: Blocks },
]

export function Sidebar() {
  const pathname = usePathname()
  const { theme } = useTheme()

  return (
    <ShadcnSidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="border-b border-border/50">
        <div className="flex flex-col h-full justify-center items-center px-6 group-data-[collapsible=icon]:px-3 group-data-[collapsible=icon]:items-center">
          <div className="flex items-center gap-2">
            <Image
              src={theme === 'dark' ? '/sia-icon-dark.svg' : '/sia-icon-light.svg'}
              alt="Sia"
              width={48}
              height={48}
              className="transition-opacity"
            />
            <span className="text-3xl font-semibold text-foreground leading-tight group-data-[collapsible=icon]:hidden">Sia</span>
          </div>
          <span className="text-xs text-muted-foreground font-medium group-data-[collapsible=icon]:hidden">GetPullRequest</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <SidebarMenuItem key={item.name}>
                <SidebarMenuButton asChild isActive={isActive} tooltip={item.name}>
                  <Link href={item.href}>
                    <item.icon />
                    <span className="text-lg">{item.name}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarContent>
    </ShadcnSidebar>
  )
}