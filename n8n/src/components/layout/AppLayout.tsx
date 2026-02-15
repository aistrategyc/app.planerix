"use client"

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Header from '@/components/ui/header'
import Sidebar from '@/components/ui/sidebar'

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname()
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)

  // Pages that should not show the header/sidebar (none - show header on all pages)
  const authPages: string[] = []
  const isAuthPage = authPages.includes(pathname)

  useEffect(() => {
    setIsMobileNavOpen(false)
  }, [pathname])

  if (isAuthPage) {
    return <>{children}</>
  }

  return (
    <>
      <Header onMenuClick={() => setIsMobileNavOpen((prev) => !prev)} />
      <div className="relative flex min-h-screen">
        <Sidebar isMobileOpen={isMobileNavOpen} onClose={() => setIsMobileNavOpen(false)} />
        <main className="flex-1 overflow-y-auto pt-[72px] pb-10 pr-4 pl-0 md:pb-12 md:pr-8 md:pl-[88px] app-surface">
          <div className="mx-auto w-full max-w-[1440px]">
            {children}
          </div>
        </main>
      </div>
    </>
  )
}
