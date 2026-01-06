'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  Blocks,
  Clock,
  FolderGit2,
  Bot,
  LayoutList,
  LogOut,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';

const navigation = [
  { name: 'Jobs', path: '', icon: LayoutList },
  { name: 'Recent Activities', path: '/recents', icon: Clock },
  { name: 'Agents', path: '/agents', icon: Bot },
  { name: 'Repositories', path: '/repositories', icon: FolderGit2 },
  { name: 'Integrations', path: '/integrations', icon: Blocks },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme } = useTheme();
  const logoSrc =
    theme === 'dark' ? '/sia-icon-dark.svg' : '/sia-icon-light.svg';
  const logoAlt = 'Sia Logo';

  // Extract project ID from pathname if we're in a project route
  const projectIdMatch = pathname?.match(/^\/projects\/([^/]+)/);
  const projectId = projectIdMatch ? projectIdMatch[1] : null;

  // Build navigation links - use project-scoped routes if in a project, otherwise use root routes
  const getNavigationHref = (itemPath: string) => {
    if (projectId) {
      return `/projects/${projectId}${itemPath}`;
    }
    // If not in a project, only show Home link
    return itemPath === '' ? '/' : null;
  };

  // Filter navigation items based on whether we're in a project
  const visibleNavigation = projectId
    ? navigation
    : navigation.filter(item => item.path === '');

  return (
    <ShadcnSidebar
      collapsible="icon"
      variant="sidebar"
      className="border-r border-border bg-sidebar backdrop-blur"
    >
      <SidebarHeader className="flex flex-col items-center justify-center p-4 border-b border-border  ">
        <span className="text-base font-bold text-foreground">Sia</span>
        <div className="mb-1 flex h-10 w-10 items-center justify-center">
          <Image src={logoSrc} alt={logoAlt} width={40} height={40} />
        </div>
        {/* <div className='mt-2 w-18 h-1 border-b border-border'/> */}
      </SidebarHeader>
      <SidebarContent className="py-2 flex flex-col">
        <SidebarMenu className="space-y-1 px-2 flex-1">
          {visibleNavigation.map(item => {
            const href = getNavigationHref(item.path);
            if (!href) return null;

            // Check if current path matches this navigation item
            const isActive = projectId
              ? pathname === `/projects/${projectId}${item.path}`
              : pathname === '/';

            return (
              <SidebarMenuItem key={item.name}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={item.name}
                  className="justify-center rounded-full h-8 w-8 text-xs text-muted-foreground"
                >
                  <Link
                    href={href}
                    className="flex items-center justify-center gap-3 text-xs"
                  >
                    <item.icon className=" text-center" />
                    <span className="text-[10px] font-medium text-foreground group-data-[collapsible=icon]:hidden">
                      {item.name}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
        {/* Logout button at the bottom */}
        <SidebarMenu className="space-y-1 px-2 mt-auto">
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => router.push('/')}
              tooltip="Go to Home"
              className="justify-center rounded-full h-8 w-8 text-xs text-muted-foreground hover:text-secondary-foreground"
            >
              <LogOut className="text-center" />
              <span className="text-[10px] font-medium text-secondary-foreground group-data-[collapsible=icon]:hidden">
                Go to Home
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
    </ShadcnSidebar>
  );
}
