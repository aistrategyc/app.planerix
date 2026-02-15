"use client"

import { useState, useCallback, useEffect } from "react"
import { useCompany, useDepartments, useCompanyTeam } from "@/app/company/hooks/useCompany"
import ProtectedRoute from "@/components/auth/ProtectedRoute"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Loader2, Plus, Building2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { PageHeader } from "@/components/layout/PageHeader"

type TabKey = "overview" | "departments" | "team" | "projects"

export default function CompanyPageContent() {
  const { toast } = useToast()

  // company state + creation
  const { company, loading, createCompany } = useCompany()
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  type CompanyFormData = {
    name: string
    description?: string
    website?: string
    industry?: string
    size?: string
    address?: string
    phone?: string
    email?: string
  }

  const [formData, setFormData] = useState<CompanyFormData>({
    name: "",
    description: "",
    website: "",
    industry: "",
    size: "",
    address: "",
    phone: "",
    email: "",
  })

  // related collections (departments, team)
  const { departments, loading: depsLoading } = useDepartments(company?.id)
  const { teamMembers, loading: teamLoading } = useCompanyTeam(company?.id)

  const [active, setActive] = useState<TabKey>("overview")

  useEffect(() => {
    if (!company) return
    const details: CompanyFormData = {
      name: company.name || "",
      description: company.description || "",
      website: company.website || "",
      industry: company.industry || "",
      size: company.size || "",
      address: company.address || "",
      phone: company.phone || "",
      email: company.email || "",
    }
    setFormData(details)
  }, [company])

  const handleSave = useCallback(async () => {
    if (!formData.name.trim()) {
      toast({ variant: "destructive", title: "Название обязательно", description: "Введите название компании" })
      return
    }
    const success = await createCompany({
      name: formData.name,
      description: formData.description,
      website: formData.website,
      industry: formData.industry,
      size: formData.size,
    })
    if (success) {
      setShowCreateDialog(false)
      toast({ title: "Профиль создан", description: "Компания успешно сохранена" })
    }
  }, [createCompany, formData, toast])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading company information...</p>
        </div>
      </div>
    )
  }

  // Empty state — no company yet
  if (!company && !loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Company profile"
          description="Create your company workspace to unlock organization features."
        />
        <Card className="glass-panel">
          <CardContent className="p-12 text-center">
            <Building2 className="w-16 h-16 mx-auto mb-6 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-4">No Company Profile</h2>
            <p className="text-muted-foreground mb-6">
              You haven&apos;t set up your company profile yet. Create one to get started.
            </p>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button size="lg">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Company Profile
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Create Company Profile</DialogTitle>
                  <DialogDescription>Set up your company information to get started.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="create-name">Company Name *</Label>
                      <Input
                        id="create-name"
                        value={formData.name}
                        onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="create-website">Website</Label>
                      <Input
                        id="create-website"
                        value={formData.website}
                        onChange={(e) => setFormData((prev) => ({ ...prev, website: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="create-industry">Industry</Label>
                      <Input
                        id="create-industry"
                        value={formData.industry}
                        onChange={(e) => setFormData((prev) => ({ ...prev, industry: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="create-size">Size</Label>
                      <Input
                        id="create-size"
                        value={formData.size}
                        onChange={(e) => setFormData((prev) => ({ ...prev, size: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="create-phone">Phone</Label>
                      <Input
                        id="create-phone"
                        value={formData.phone}
                        onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="create-email">Email</Label>
                      <Input
                        id="create-email"
                        value={formData.email}
                        onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="create-description">Description</Label>
                    <Textarea
                      id="create-description"
                      value={formData.description}
                      onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                </div>
                <DialogFooter className="pt-4">
                  <Button onClick={handleSave}>Save</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Company exists — render hierarchy tabs
  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <PageHeader
          title={company?.name || "Company"}
          description={company?.description || "Company profile"}
          meta={
            company?.industry ? <Badge variant="outline">{company.industry}</Badge> : null
          }
        />

        {/* Simple tabs */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={active === "overview" ? "default" : "secondary"}
            onClick={() => setActive("overview")}
          >
            Overview
          </Button>
          <Button
            variant={active === "departments" ? "default" : "secondary"}
            onClick={() => setActive("departments")}
          >
            Departments
          </Button>
          <Button
            variant={active === "team" ? "default" : "secondary"}
            onClick={() => setActive("team")}
          >
            Team
          </Button>
          <Button
            variant={active === "projects" ? "default" : "secondary"}
            onClick={() => setActive("projects")}
          >
            Projects
          </Button>
        </div>

        {/* Panels */}
        {active === "overview" && (
          <Card className="glass-panel">
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">Website</div>
                  <div className="text-sm break-all">
                    {company?.website || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Industry</div>
                  <div className="text-sm">{company?.industry || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Size</div>
                  <div className="text-sm">{company?.size || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Email</div>
                  <div className="text-sm break-all">{company?.email || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Phone</div>
                  <div className="text-sm">{company?.phone || "—"}</div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-xs text-muted-foreground">Address</div>
                  <div className="text-sm">{company?.address || "—"}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {active === "departments" && (
          <Card className="glass-panel">
            <CardContent className="p-6 space-y-4">
              {depsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading departments…
                </div>
              ) : departments?.length ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {departments.map((d) => (
                    <div key={d.id ?? d.name} className="rounded-md border p-4">
                      <div className="font-medium">{d.name}</div>
                      {d.description ? (
                        <div className="text-sm text-muted-foreground mt-1">{d.description}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No departments yet.
                </div>
              )}
              {/* Future: button to add department here or link to dedicated page */}
              {/* <Button onClick={() => ...}><Plus className="mr-2 h-4 w-4" />Add department</Button> */}
            </CardContent>
          </Card>
        )}

        {active === "team" && (
          <Card className="glass-panel">
            <CardContent className="p-6 space-y-4">
              {teamLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading team…
                </div>
              ) : teamMembers.length ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {teamMembers.map((m) => (
                    <div key={m.id ?? m.email} className="rounded-md border p-4">
                      <div className="font-medium">{m.username || m.email}</div>
                      <div className="text-sm text-muted-foreground">
                        {m.email || "—"} {m.role ? `• ${m.role}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No team members yet.</div>
              )}
            </CardContent>
          </Card>
        )}

        {active === "projects" && (
          <Card className="glass-panel">
            <CardContent className="p-6 space-y-2">
              <div className="text-sm text-muted-foreground">
                Projects module placeholder. Link this with your projects API/routes (e.g., /projects) when ready.
              </div>
              <div>
                {/* <Button asChild><Link href="/projects"><Plus className="mr-2 h-4 w-4" />Create project</Link></Button> */}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </ProtectedRoute>
  )
}
