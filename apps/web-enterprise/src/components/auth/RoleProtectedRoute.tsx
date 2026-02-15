"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import ProtectedRoute from "./ProtectedRoute"
import { Loader2, ShieldX } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { MembershipRole } from "@/types/roles"
import { CompanyAPI } from "@/lib/api/company"
import { api } from "@/lib/api/config"

interface RoleProtectedRouteProps {
  children: React.ReactNode
  allowedRoles: MembershipRole[]
  fallbackUrl?: string
  requireAuth?: boolean
  requireVerified?: boolean
  requireOrganization?: boolean
}

export default function RoleProtectedRoute({
  children,
  allowedRoles,
  fallbackUrl = "/dashboard",
  requireAuth = true,
  requireVerified = true,
  requireOrganization = false
}: RoleProtectedRouteProps) {
  const router = useRouter()
  const { user } = useAuth()
  const [userRole, setUserRole] = useState<MembershipRole | null>(null)
  const [roleLoading, setRoleLoading] = useState(false)

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) {
        setUserRole(null)
        return
      }
      
      setRoleLoading(true)
      try {
        const org = await CompanyAPI.getCurrentCompany()
        if (!org?.id) {
          setUserRole("guest")
          return
        }

        const resp = await api.get(`orgs/${org.id}/memberships/`)
        const items = resp.data?.items ?? resp.data ?? []
        const membership = items.find((m: { user_id?: string }) => m.user_id === user.id)
        if (membership?.role) {
          setUserRole(membership.role as MembershipRole)
          return
        }

        const fallbackMap: Record<string, MembershipRole> = {
          admin: "admin",
          manager: "team_lead",
          member: "member",
          guest: "guest",
        }
        const fallbackRole = user.role ? fallbackMap[user.role] : undefined
        setUserRole(fallbackRole || "member")
      } catch (error) {
        console.error('Failed to fetch user role:', error)
        setUserRole('guest')
      } finally {
        setRoleLoading(false)
      }
    }

    fetchUserRole()
  }, [user])

  // ✅ Проверка доступа по роли
  const hasAccess = userRole && allowedRoles.includes(userRole)

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Checking permissions...</p>
        </div>
      </div>
    )
  }

  if (!roleLoading && userRole && !hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md mx-auto p-6">
          <ShieldX className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <h2 className="text-2xl font-bold text-foreground mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-6">
            You don&apos;t have permission to access this page. 
            Required roles: {allowedRoles.join(', ')}. 
            Your role: {userRole}.
          </p>
          <Button 
            onClick={() => router.push(fallbackUrl)}
            variant="outline"
          >
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  return (
    <ProtectedRoute
      requireAuth={requireAuth}
      requireVerified={requireVerified}
      requireOrganization={requireOrganization}
    >
      {children}
    </ProtectedRoute>
  )
}
