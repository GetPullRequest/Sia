"use client"

import {
  useAuthInfo,
  useHostedPageUrls,
} from "@propelauth/react"
import React from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LogoutIndicationModal } from "./logout-modal";
import { User, LogOut, Key } from "lucide-react"
import { useRouter } from "next/navigation"

export const ProfileAvatar = () => {
  const { user } = useAuthInfo()
  const { getAccountPageUrl } = useHostedPageUrls()
  const router = useRouter()
  const [isLogoutIndicationModalOpen, setIsLogoutIndicationModalOpen] =
    React.useState(false)

  const handleProfileClick = () => {
    const currentUrl = window.location.origin
    const accountsUrl = getAccountPageUrl({
      redirectBackToUrl: currentUrl,
    })
    window.location.href = accountsUrl
  }

  const getFallbackText = (user: any) => {
    if (!user) return "?"
    const firstInitial = user.firstName?.[0]?.toUpperCase() || ""
    const lastInitial = user.lastName?.[0]?.toUpperCase() || ""
    if (firstInitial && lastInitial) return `${firstInitial}${lastInitial}`
    return user.email?.[0]?.toUpperCase() || "?"
  }

  const getDisplayName = () => {
    if (!user) return "Guest"
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`
    }
    if (user.firstName) return user.firstName
    return user.email?.split("@")[0] || "User"
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="relative h-9 w-9 rounded-full p-0 hover:bg-accent/50 transition-colors"
          >
            <Avatar className="h-9 w-9 border-2 border-border/50">
              <AvatarImage src={user?.pictureUrl} alt={getDisplayName()} />
              <AvatarFallback className="bg-muted text-muted-foreground text-sm font-semibold">
                {getFallbackText(user)}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64" align="end" sideOffset={8}>
          <DropdownMenuLabel className="font-normal p-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 border border-border/50">
                <AvatarImage src={user?.pictureUrl} alt={getDisplayName()} />
                <AvatarFallback className="bg-muted text-muted-foreground text-sm font-semibold">
                  {getFallbackText(user)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground leading-tight truncate">
                  {getDisplayName()}
                </p>
                <p className="text-xs text-muted-foreground leading-tight truncate">
                  {user?.email}
                </p>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleProfileClick}
            className="cursor-pointer focus:bg-accent"
          >
            <User className="mr-2 h-4 w-4" />
            <span>Profile Settings</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => router.push('/developer-settings')}
            className="cursor-pointer focus:bg-accent"
          >
            <Key className="mr-2 h-4 w-4" />
            <span>Developer Settings</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setIsLogoutIndicationModalOpen(true)}
            className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <LogoutIndicationModal
        isOpen={isLogoutIndicationModalOpen}
        onClose={() => setIsLogoutIndicationModalOpen(false)}
      />
    </>
  )
}