"use client"

import { usePathname } from 'next/navigation'
import { Bell } from 'lucide-react'
import { Button } from './ui/button'
import { SidebarTrigger } from './ui/sidebar'
import { ThemeToggle } from './theme-toggle'
import { ProfileAvatar } from './profileavatar'

const navigation = [
  { name: 'Home', href: '/' },
  { name: 'Recents', href: '/recents' },
  { name: 'Agents', href: '/agents' },
  { name: 'Integrations', href: '/integrations' },
  { name: 'Developer Settings', href: '/developer-settings' },
]

export function Navbar() {
  const pathname = usePathname()

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-sidebar px-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <h2 className="text-lg font-semibold">
          {navigation.find(item => item.href === pathname)?.name || 'Dashboard'}
        </h2>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Button variant="outline" size="icon">
          <Bell className="h-5 w-5" />
        </Button>
        <ProfileAvatar />
      </div>
    </header>
  )
}

