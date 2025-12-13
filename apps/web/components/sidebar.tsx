'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Home, Users, Blocks, Clock, FolderGit2 } from 'lucide-react';
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
  { name: 'Home', href: '/', icon: Home },
  { name: 'Recents', href: '/recents', icon: Clock },
  { name: 'Agents', href: '/agents', icon: Users },
  { name: 'Repositories', href: '/repositories', icon: FolderGit2 },
  { name: 'Integrations', href: '/integrations', icon: Blocks },
];

export function Sidebar() {
  const pathname = usePathname();
  const { theme } = useTheme();
  const logoSrc =
    theme === 'dark' ? '/sia-icon-dark.svg' : '/sia-icon-light.svg';
  const logoAlt = 'Sia Logo';

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
      <SidebarContent className="py-2">
        <SidebarMenu className="space-y-1 px-2">
          {navigation.map(item => {
            const isActive = pathname === item.href;
            return (
              <SidebarMenuItem key={item.name}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={item.name}
                  className="justify-center rounded-full h-8 w-8 text-xs text-muted-foreground"
                >
                  <Link
                    href={item.href}
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
      </SidebarContent>
    </ShadcnSidebar>
  );
}
