"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import ProtectedRoute from "@/components/auth/ProtectedRoute"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { MembershipRole, RoleLabels } from "@/types/roles"
import { getTeams, createTeam, inviteTeamMember, Team as ApiTeam, TeamMember as ApiTeamMember } from "@/lib/api/teams"

import {
  Plus,
  Search,
  Users,
  User,
  Shield,
  Crown,
  Mail,
  Activity,
  BarChart3,
  Target,
  Award,
  Settings
} from "lucide-react"

interface TeamMember {
  id: string
  name: string
  email: string
  role: MembershipRole
  department: string
  position: string
  avatar?: string
  phone?: string
  location?: string
  joinDate: string
  status: 'active' | 'inactive' | 'pending'
  skills: string[]
  tasksCompleted: number
  projectsActive: number
  tasksOpen: number
  tasksOverdue: number
  tasksInReview: number
  tasksBlocked: number
}

interface Team {
  id: string
  name: string
  description: string
  department: string
  lead: string
  policy?: {
    default_approver_role?: MembershipRole
    escalation_days?: number
    weekly_digest_recipients?: string[]
  }
  members: TeamMember[]
  projects: number
  tasksOpen: number
  tasksOverdue: number
  tasksInReview: number
  tasksBlocked: number
  created_at: string
}

const ROLE_OPTIONS: MembershipRole[] = [
  "owner",
  "admin",
  "bu_manager",
  "hod",
  "team_lead",
  "pmo",
  "member",
  "guest",
]

const getErrorMessage = (err: unknown, fallback: string): string => {
  if (err && typeof err === "object") {
    const candidate = err as { response?: { data?: { detail?: unknown } }; message?: unknown }
    const detail = candidate.response?.data?.detail
    if (typeof detail === "string") return detail
    if (typeof candidate.message === "string") return candidate.message
  }
  return fallback
}

export default function TeamsPage() {
  return (
    <ProtectedRoute>
      <TeamsPageContent />
    </ProtectedRoute>
  )
}

function TeamsPageContent() {
  const { toast } = useToast()
  
  const [activeTab, setActiveTab] = useState<'teams' | 'members'>('teams')
  const [teams, setTeams] = useState<Team[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [filterDepartment, setFilterDepartment] = useState<string>("all")
  const [filterRole, setFilterRole] = useState<"all" | MembershipRole>("all")
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [showTeamDialog, setShowTeamDialog] = useState(false)
  const [showMemberDialog, setShowMemberDialog] = useState(false)
  const [showCreateTeamDialog, setShowCreateTeamDialog] = useState(false)
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [loading, setLoading] = useState(true)

  const [newTeam, setNewTeam] = useState({
    name: "",
    description: "",
    department: "",
    lead: ""
  })
  const [newTeamPolicy, setNewTeamPolicy] = useState({
    default_approver_role: "team_lead" as MembershipRole,
    escalation_days: "",
    weekly_digest_recipients: ""
  })

  const [inviteData, setInviteData] = useState({
    email: "",
    role: "member" as MembershipRole,
    department: "",
    position: ""
  })

  const filteredMembers = useMemo(() => {
    return members.filter(member => {
      const matchesSearch = member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          member.department.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesDepartment = filterDepartment === "all" || member.department === filterDepartment
      const matchesRole = filterRole === "all" || member.role === filterRole
      
      return matchesSearch && matchesDepartment && matchesRole
    })
  }, [members, searchQuery, filterDepartment, filterRole])

  const getRoleColor = (role: TeamMember['role']) => {
    switch (role) {
      case 'owner': return 'bg-red-100 text-red-800'
      case 'admin': return 'bg-red-100 text-red-800'
      case 'bu_manager': return 'bg-blue-100 text-blue-800'
      case 'hod': return 'bg-blue-100 text-blue-800'
      case 'team_lead': return 'bg-blue-100 text-blue-800'
      case 'pmo': return 'bg-purple-100 text-purple-800'
      case 'member': return 'bg-green-100 text-green-800'
      case 'guest': return 'bg-slate-100 text-slate-600'
      default: return 'bg-slate-100 text-slate-800'
    }
  }

  const getRoleIcon = (role: TeamMember['role']) => {
    switch (role) {
      case 'owner': return <Crown className="w-4 h-4" />
      case 'admin': return <Crown className="w-4 h-4" />
      case 'bu_manager': return <Shield className="w-4 h-4" />
      case 'hod': return <Shield className="w-4 h-4" />
      case 'team_lead': return <Shield className="w-4 h-4" />
      case 'pmo': return <BarChart3 className="w-4 h-4" />
      case 'member': return <User className="w-4 h-4" />
      case 'guest': return <User className="w-4 h-4" />
      default: return <User className="w-4 h-4" />
    }
  }

  const getStatusColor = (status: TeamMember['status']) => {
    switch (status) {
      case 'active': return 'bg-green-500'
      case 'inactive': return 'bg-slate-500'
      case 'pending': return 'bg-yellow-500'
      default: return 'bg-slate-500'
    }
  }

  const handleCreateTeam = async () => {
    if (!newTeam.name.trim()) {
      toast({ title: "Error", description: "Team name is required", variant: "destructive" })
      return
    }

    try {
      const recipients = newTeamPolicy.weekly_digest_recipients
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
      const policyPayload = {
        default_approver_role: newTeamPolicy.default_approver_role,
        escalation_days: newTeamPolicy.escalation_days ? Number(newTeamPolicy.escalation_days) : undefined,
        weekly_digest_recipients: recipients.length ? recipients : undefined,
      }

      await createTeam({
        name: newTeam.name.trim(),
        description: newTeam.description.trim() || undefined,
        policy: policyPayload,
      })
      setNewTeam({ name: "", description: "", department: "", lead: "" })
      setNewTeamPolicy({ default_approver_role: "team_lead", escalation_days: "", weekly_digest_recipients: "" })
      setShowCreateTeamDialog(false)
      await reloadTeams()
      toast({ title: "Success", description: "Team created successfully" })
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Failed to create team")
      toast({ title: "Error", description: message, variant: "destructive" })
    }
  }

  const handleInviteMember = async () => {
    if (!inviteData.email.trim()) {
      toast({ title: "Error", description: "Email is required", variant: "destructive" })
      return
    }

    try {
      const departmentMatch = teams.find(
        (team) => team.name.toLowerCase() === inviteData.department.trim().toLowerCase()
      )
      await inviteTeamMember({
        email: inviteData.email.trim(),
        role: inviteData.role,
        department_id: departmentMatch?.id,
      })
      toast({
        title: "Invitation Sent",
        description: `Invitation sent to ${inviteData.email}`,
      })
      await reloadTeams()
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Failed to send invitation")
      toast({ title: "Error", description: message, variant: "destructive" })
    }

    setInviteData({ email: "", role: "member", department: "", position: "" })
    setShowInviteDialog(false)
  }

  const stats = useMemo(() => {
    const totalMembers = members.length
    const activeMembers = members.filter(m => m.status === 'active').length
    const totalTeams = teams.length
    const avgTasksCompleted = totalMembers > 0 ? 
      Math.round(members.reduce((sum, m) => sum + m.tasksCompleted, 0) / totalMembers) : 0

    return { totalMembers, activeMembers, totalTeams, avgTasksCompleted }
  }, [members, teams])

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase()
  }

  const normalizeStatus = useCallback((status?: string): TeamMember["status"] => {
    if (status === "pending") return "pending"
    if (status === "inactive" || status === "suspended") return "inactive"
    return "active"
  }, [])

  const mapMember = useCallback((member: ApiTeamMember): TeamMember => ({
    id: member.id,
    name: member.name,
    email: member.email,
    role: member.role,
    department: member.department || "General",
    position: member.position || "",
    avatar: member.avatar_url || "",
    joinDate: member.join_date || new Date().toISOString(),
    status: normalizeStatus(member.status || "active"),
    skills: [],
    tasksCompleted: member.tasks_completed || 0,
    projectsActive: member.projects_active || 0,
    tasksOpen: member.tasks_open || 0,
    tasksOverdue: member.tasks_overdue || 0,
    tasksInReview: member.tasks_in_review || 0,
    tasksBlocked: member.tasks_blocked || 0,
  }), [normalizeStatus])

  const mapTeam = useCallback((team: ApiTeam): Team => ({
    id: team.id,
    name: team.name,
    description: team.description || "",
    department: team.department || team.name,
    lead: team.lead || "TBD",
    policy: team.policy || undefined,
    members: (team.members || []).map(mapMember),
    projects: team.projects || 0,
    tasksOpen: team.tasks_open || 0,
    tasksOverdue: team.tasks_overdue || 0,
    tasksInReview: team.tasks_in_review || 0,
    tasksBlocked: team.tasks_blocked || 0,
    created_at: team.created_at || new Date().toISOString(),
  }), [mapMember])

  const reloadTeams = useCallback(async () => {
    setLoading(true)
    try {
      const teamItems = await getTeams()
      const mappedTeams = teamItems.map(mapTeam)
      setTeams(mappedTeams)
      setMembers(mappedTeams.flatMap((team) => team.members))
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Failed to load teams")
      toast({ title: "Error", description: message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast, mapTeam])

  useEffect(() => {
    reloadTeams()
  }, [reloadTeams])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-sm text-muted-foreground">Loading teams...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            <h1 className="text-3xl font-bold">Teams</h1>
            <Badge variant="outline" className="ml-2">
              Team Management
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Teams, ownership, and member performance in one place.
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search teams or members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 w-64"
            />
          </div>

          <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Mail className="w-4 h-4 mr-2" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle>Invite Team Member</DialogTitle>
                <DialogDescription>Send an invitation to join your team</DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={inviteData.email}
                    onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                    placeholder="colleague@company.com"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={inviteData.role}
                    onValueChange={(value) => setInviteData({ ...inviteData, role: value as MembershipRole })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((role) => (
                        <SelectItem key={role} value={role}>
                          {RoleLabels[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    value={inviteData.department}
                    onChange={(e) => setInviteData({ ...inviteData, department: e.target.value })}
                    placeholder="e.g., Engineering"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="position">Position</Label>
                  <Input
                    id="position"
                    value={inviteData.position}
                    onChange={(e) => setInviteData({ ...inviteData, position: e.target.value })}
                    placeholder="e.g., Senior Developer"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleInviteMember}>
                  Send Invitation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={showCreateTeamDialog} onOpenChange={setShowCreateTeamDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Team
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Create New Team</DialogTitle>
                <DialogDescription>Set up a new team for your organization</DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Team Name *</Label>
                  <Input
                    id="name"
                    value={newTeam.name}
                    onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                    placeholder="e.g., Engineering Team"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newTeam.description}
                    onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
                    placeholder="Brief description of the team..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="department">Department</Label>
                    <Input
                      id="department"
                      value={newTeam.department}
                      onChange={(e) => setNewTeam({ ...newTeam, department: e.target.value })}
                      placeholder="e.g., Technology"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="lead">Team Lead</Label>
                    <Input
                      id="lead"
                      value={newTeam.lead}
                      onChange={(e) => setNewTeam({ ...newTeam, lead: e.target.value })}
                      placeholder="Team leader name"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Default Approver Role</Label>
                  <Select
                    value={newTeamPolicy.default_approver_role}
                    onValueChange={(value) =>
                      setNewTeamPolicy({ ...newTeamPolicy, default_approver_role: value as MembershipRole })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((role) => (
                        <SelectItem key={role} value={role}>
                          {RoleLabels[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="escalationDays">Escalation Days</Label>
                    <Input
                      id="escalationDays"
                      type="number"
                      min={0}
                      value={newTeamPolicy.escalation_days}
                      onChange={(e) => setNewTeamPolicy({ ...newTeamPolicy, escalation_days: e.target.value })}
                      placeholder="e.g., 3"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="digestRecipients">Weekly Digest Recipients</Label>
                    <Input
                      id="digestRecipients"
                      value={newTeamPolicy.weekly_digest_recipients}
                      onChange={(e) => setNewTeamPolicy({ ...newTeamPolicy, weekly_digest_recipients: e.target.value })}
                      placeholder="user1@org.com, user2@org.com"
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateTeamDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateTeam}>
                  Create Team
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card/40 border-border/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total Members</p>
                <p className="text-2xl font-bold">{stats.totalMembers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Active Members</p>
                <p className="text-2xl font-bold">{stats.activeMembers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-purple-600" />
              <div>
                <p className="text-sm text-muted-foreground">Teams</p>
                <p className="text-2xl font-bold">{stats.totalTeams}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-orange-600" />
              <div>
                <p className="text-sm text-muted-foreground">Avg Tasks Done</p>
                <p className="text-2xl font-bold">{stats.avgTasksCompleted}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'teams' | 'members')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="teams">
            <Target className="w-4 h-4 mr-2" />
            Teams ({teams.length})
          </TabsTrigger>
          <TabsTrigger value="members">
            <Users className="w-4 h-4 mr-2" />
            Members ({members.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="teams" className="space-y-4">
          {/* Teams Grid */}
          <div className="grid gap-4">
            {teams.map((team) => (
              <Card 
                key={team.id}
                className="cursor-pointer hover:shadow-md transition-shadow border-border/60 bg-card/40"
                onClick={() => {
                  setSelectedTeam(team)
                  setShowTeamDialog(true)
                }}
              >
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-xl font-semibold">{team.name}</h3>
                        <Badge variant="outline">{team.department}</Badge>
                      </div>
                      
                      {team.description && (
                        <p className="text-sm text-muted-foreground mb-4">
                          {team.description}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {team.members.length} members
                        </div>
                        <div className="flex items-center gap-1">
                          <BarChart3 className="w-4 h-4" />
                          {team.projects} projects
                        </div>
                        <div className="flex items-center gap-1">
                          <Crown className="w-4 h-4" />
                          Led by {team.lead}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
                        <Badge variant="outline">Open {team.tasksOpen}</Badge>
                        <Badge variant="outline" className={team.tasksOverdue ? "border-amber-500 text-amber-700" : ""}>
                          Overdue {team.tasksOverdue}
                        </Badge>
                        <Badge variant="outline">In review {team.tasksInReview}</Badge>
                        <Badge variant="outline" className={team.tasksBlocked ? "border-rose-500 text-rose-700" : ""}>
                          Blocked {team.tasksBlocked}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex -space-x-2 ml-4">
                      {team.members.slice(0, 4).map((member) => (
                        <Avatar key={member.id} className="w-8 h-8 border-2 border-white">
                          <AvatarImage src={member.avatar} />
                          <AvatarFallback className="text-xs">
                            {getInitials(member.name)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {team.members.length > 4 && (
                        <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-xs text-slate-600">
                          +{team.members.length - 4}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {teams.length === 0 && (
              <Card>
                <CardContent className="p-12 text-center">
                  <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No teams yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first team to get started organizing your members
                  </p>
                  <Button onClick={() => setShowCreateTeamDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Team
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="members" className="space-y-4">
          {/* Filters */}
          <div className="flex gap-2">
            <Select value={filterDepartment} onValueChange={setFilterDepartment}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                <SelectItem value="Engineering">Engineering</SelectItem>
                <SelectItem value="Product">Product</SelectItem>
                <SelectItem value="Marketing">Marketing</SelectItem>
                <SelectItem value="Sales">Sales</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterRole} onValueChange={(value) => setFilterRole(value as MembershipRole | "all")}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {ROLE_OPTIONS.map((role) => (
                  <SelectItem key={role} value={role}>
                    {RoleLabels[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Members Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMembers.map((member) => (
              <Card 
                key={member.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => {
                  setSelectedMember(member)
                  setShowMemberDialog(true)
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="relative">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={member.avatar} />
                        <AvatarFallback>
                          {getInitials(member.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div 
                        className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${getStatusColor(member.status)}`}
                      />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold truncate">{member.name}</h3>
                        <Badge className={getRoleColor(member.role)} variant="outline">
                          {getRoleIcon(member.role)}
                          <span className="ml-1">{member.role.toUpperCase()}</span>
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-muted-foreground truncate">
                        {member.position} • {member.department}
                      </p>
                      
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <Mail className="w-3 h-3" />
                        <span className="truncate">{member.email}</span>
                      </div>
                      
                      <div className="flex flex-wrap gap-3 mt-2 text-xs">
                        <span className="text-green-600">{member.tasksCompleted} done</span>
                        <span className="text-blue-600">{member.tasksOpen} open</span>
                        <span className={member.tasksOverdue ? "text-amber-600" : "text-muted-foreground"}>
                          {member.tasksOverdue} overdue
                        </span>
                        <span className={member.tasksBlocked ? "text-rose-600" : "text-muted-foreground"}>
                          {member.tasksBlocked} blocked
                        </span>
                        <span className="text-muted-foreground">{member.projectsActive} projects</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredMembers.length === 0 && (
              <div className="col-span-full">
                <Card>
                  <CardContent className="p-12 text-center">
                    <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No members found</h3>
                    <p className="text-muted-foreground mb-4">
                      {searchQuery || filterDepartment !== "all" || filterRole !== "all"
                        ? "Try adjusting your filters or search terms"
                        : "Invite your first team member to get started"}
                    </p>
                    <Button onClick={() => setShowInviteDialog(true)}>
                      <Mail className="w-4 h-4 mr-2" />
                      Invite Member
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Team Detail Dialog */}
      <Dialog open={showTeamDialog} onOpenChange={setShowTeamDialog}>
        <DialogContent className="sm:max-w-[700px]">
          {selectedTeam && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  {selectedTeam.name}
                  <Badge variant="outline">{selectedTeam.department}</Badge>
                </DialogTitle>
                <DialogDescription>
                  {selectedTeam.members.length} members • {selectedTeam.projects} projects
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {selectedTeam.description && (
                  <div>
                    <Label>Description</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedTeam.description}
                    </p>
                  </div>
                )}

                <div>
                  <Label>Team Lead</Label>
                  <p className="text-sm">{selectedTeam.lead}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Open Tasks</Label>
                    <p className="text-sm">{selectedTeam.tasksOpen}</p>
                  </div>
                  <div>
                    <Label>Overdue Tasks</Label>
                    <p className="text-sm">{selectedTeam.tasksOverdue}</p>
                  </div>
                  <div>
                    <Label>In Review</Label>
                    <p className="text-sm">{selectedTeam.tasksInReview}</p>
                  </div>
                  <div>
                    <Label>Blocked</Label>
                    <p className="text-sm">{selectedTeam.tasksBlocked}</p>
                  </div>
                </div>

                <div>
                  <Label>Members ({selectedTeam.members.length})</Label>
                  <div className="mt-2 space-y-2">
                    {selectedTeam.members.map((member) => (
                      <div key={member.id} className="flex items-center gap-3 p-2 border rounded-lg">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={member.avatar} />
                          <AvatarFallback className="text-xs">
                            {getInitials(member.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{member.name}</span>
                            <Badge className={getRoleColor(member.role)} variant="outline">
                              {member.role}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {member.position}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button onClick={() => setShowTeamDialog(false)}>
                  Close
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Member Detail Dialog */}
      <Dialog open={showMemberDialog} onOpenChange={setShowMemberDialog}>
        <DialogContent className="sm:max-w-[500px]">
          {selectedMember && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={selectedMember.avatar} />
                    <AvatarFallback>
                      {getInitials(selectedMember.name)}
                    </AvatarFallback>
                  </Avatar>
                  {selectedMember.name}
                  <Badge className={getRoleColor(selectedMember.role)} variant="outline">
                    {selectedMember.role.toUpperCase()}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  {selectedMember.position} • {selectedMember.department}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Email</Label>
                    <p className="text-sm">{selectedMember.email}</p>
                  </div>
                  {selectedMember.phone && (
                    <div>
                      <Label>Phone</Label>
                      <p className="text-sm">{selectedMember.phone}</p>
                    </div>
                  )}
                </div>

                {selectedMember.location && (
                  <div>
                    <Label>Location</Label>
                    <p className="text-sm">{selectedMember.location}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Tasks Completed</Label>
                    <p className="text-sm">{selectedMember.tasksCompleted}</p>
                  </div>
                  <div>
                    <Label>Active Projects</Label>
                    <p className="text-sm">{selectedMember.projectsActive}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Open Tasks</Label>
                    <p className="text-sm">{selectedMember.tasksOpen}</p>
                  </div>
                  <div>
                    <Label>Overdue Tasks</Label>
                    <p className="text-sm">{selectedMember.tasksOverdue}</p>
                  </div>
                  <div>
                    <Label>In Review</Label>
                    <p className="text-sm">{selectedMember.tasksInReview}</p>
                  </div>
                  <div>
                    <Label>Blocked</Label>
                    <p className="text-sm">{selectedMember.tasksBlocked}</p>
                  </div>
                </div>

                <div>
                  <Label>Join Date</Label>
                  <p className="text-sm">{new Date(selectedMember.joinDate).toLocaleDateString()}</p>
                </div>

                {selectedMember.skills.length > 0 && (
                  <div>
                    <Label>Skills</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedMember.skills.map((skill) => (
                        <Badge key={skill} variant="outline" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-between pt-4 border-t">
                <div className="flex gap-2">
                  <Button size="sm" variant="outline">
                    <Mail className="w-4 h-4 mr-2" />
                    Email
                  </Button>
                  <Button size="sm" variant="outline">
                    <Settings className="w-4 h-4 mr-2" />
                    Manage
                  </Button>
                </div>
                <Button size="sm" onClick={() => setShowMemberDialog(false)}>
                  Close
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
