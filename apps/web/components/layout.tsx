"use client"

import { Sidebar } from './sidebar'
import { Navbar } from './navbar'
import { SidebarProvider, SidebarInset } from './ui/sidebar'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex flex-grow h-screen w-screen bg-background overflow-hidden">
      <SidebarProvider defaultOpen={false}>
        <Sidebar />
        <SidebarInset>
          <Navbar />
          <main className="p-4 h-screen overflow-y-auto">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}

