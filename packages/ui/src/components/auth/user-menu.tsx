"use client"

import * as React from "react"
import { Button } from "../ui/button"
import { Card, CardContent } from "../ui/card"
import { LogOut, User as UserIcon, Settings } from "lucide-react"
import { User } from "./protected-route"

interface UserMenuProps {
  user: User
  onLogout: () => void
  onProfile?: () => void
  onSettings?: () => void
  className?: string
}

export function UserMenu({
  user,
  onLogout,
  onProfile,
  onSettings,
  className,
}: UserMenuProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  return (
    <div className={`relative ${className}`}>
      <Button
        variant="ghost"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
          {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
        </div>
        <span className="hidden md:inline-block">{user.name || user.email}</span>
      </Button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <Card className="absolute right-0 top-full z-20 mt-2 w-64">
            <CardContent className="p-4">
              <div className="space-y-4">
                <div className="border-b pb-3">
                  <p className="font-medium">{user.name || "User"}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    Role: {user.role}
                  </p>
                </div>
                
                <div className="space-y-2">
                  {onProfile && (
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => {
                        onProfile()
                        setIsOpen(false)
                      }}
                    >
                      <UserIcon className="mr-2 h-4 w-4" />
                      Profile
                    </Button>
                  )}
                  
                  {onSettings && (
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => {
                        onSettings()
                        setIsOpen(false)
                      }}
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Button>
                  )}
                  
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-destructive hover:text-destructive"
                    onClick={() => {
                      onLogout()
                      setIsOpen(false)
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}