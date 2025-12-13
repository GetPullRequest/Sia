'use client';

import { Sidebar } from './sidebar';
import { Navbar } from './navbar';
import { SidebarProvider, SidebarInset } from './ui/sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex flex-grow h-screen w-screen bg-muted/10 overflow-hidden">
      <SidebarProvider open={false}>
        <Sidebar />
        <SidebarInset>
          <Navbar />
          <main className="p-6 h-screen overflow-y-auto">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
