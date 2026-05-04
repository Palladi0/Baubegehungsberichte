'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'

export function LogoutButton() {
  const [isLoading, setIsLoading] = useState(false)

  async function handleLogout() {
    setIsLoading(true)
    try {
      const supabase = createBrowserClient()
      await supabase.auth.signOut()
    } finally {
      window.location.href = '/login'
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleLogout}
      disabled={isLoading}
      aria-label="Abmelden"
    >
      <LogOut className="mr-2 h-4 w-4" />
      {isLoading ? 'Abmelden...' : 'Abmelden'}
    </Button>
  )
}
