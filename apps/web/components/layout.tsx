'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';
import { Navbar } from './navbar';
import { SidebarProvider, SidebarInset } from './ui/sidebar';
import { JobSearchDialog } from './job-search-dialog';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = usePathname();

  // Check if we're on the home page (root route)
  const isHomePage = pathname === '/';

  // Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setSearchOpen(open => !open);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // If on home page, render without sidebar and navbar
  if (isHomePage) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-grow h-screen w-screen bg-muted/10 overflow-hidden">
      <SidebarProvider open={false}>
        <Sidebar />
        <SidebarInset>
          <Navbar onSearchClick={() => setSearchOpen(true)} />
          <main className="p-6 h-screen overflow-y-auto">{children}</main>
        </SidebarInset>
      </SidebarProvider>
      <JobSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
