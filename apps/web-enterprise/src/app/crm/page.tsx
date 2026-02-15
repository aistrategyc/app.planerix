"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import ProtectedRoute from "@/components/auth/ProtectedRoute"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { AnalyticsEmptyState } from "@/components/analytics/AnalyticsEmptyState"
import { getContacts, getDeals, createContact, CRMContact, CRMDeal } from "@/lib/api/crm"

import { Plus, Search, Users, Building2, Phone, Mail, Calendar, DollarSign, CheckCircle2, Edit3, UserPlus, Briefcase, Target, Activity, Trophy } from "lucide-react"

interface Contact {
  id: string
  name: string
  email: string
  phone?: string
  company: string
  position?: string
  status: 'lead' | 'prospect' | 'customer' | 'inactive'
  priority: 'low' | 'medium' | 'high'
  source: 'website' | 'referral' | 'cold_outreach' | 'event' | 'social'
  value?: number
  lastContact?: string
  nextFollowUp?: string
  notes?: string
  tags: string[]
  created_at: string
  updated_at: string
}

interface Deal {
  id: string
  title: string
  contact: string
  company: string
  amount: number
  stage: 'prospecting' | 'qualification' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost'
  probability: number
  expectedCloseDate: string
  created_at: string
  updated_at: string
}

export default function CRMPage() {
  return (
    <ProtectedRoute>
      <CRMPageContent />
    </ProtectedRoute>
  )
}

function CRMPageContent() {
  const { toast } = useToast()
  
  const [activeTab, setActiveTab] = useState<'contacts' | 'deals'>('contacts')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterPriority, setFilterPriority] = useState<string>("all")
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [showContactDialog, setShowContactDialog] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [loading, setLoading] = useState(true)
  const hasActiveFilters = Boolean(searchQuery) || filterStatus !== "all" || filterPriority !== "all"

  type NewContactDraft = {
    name: string
    email: string
    phone: string
    company: string
    position: string
    status: Contact["status"]
    priority: Contact["priority"]
    source: Contact["source"]
    notes: string
  }

  const [newContact, setNewContact] = useState<NewContactDraft>({
    name: "",
    email: "",
    phone: "",
    company: "",
    position: "",
    status: "lead",
    priority: "medium",
    source: "website",
    notes: ""
  })

  const mapContact = (contact: CRMContact): Contact => ({
    id: contact.id,
    name: contact.name,
    email: contact.email,
    phone: contact.phone || undefined,
    company: contact.company || "",
    position: contact.position || undefined,
    status: contact.status,
    priority: contact.priority,
    source: contact.source,
    value: contact.value || undefined,
    lastContact: contact.last_contact || undefined,
    nextFollowUp: contact.next_follow_up || undefined,
    notes: contact.notes || undefined,
    tags: contact.tags || [],
    created_at: contact.created_at,
    updated_at: contact.updated_at,
  })

  const mapDeal = (deal: CRMDeal): Deal => ({
    id: deal.id,
    title: deal.title,
    contact: deal.contact_name || "Unknown",
    company: deal.company || "Unknown",
    amount: deal.amount,
    stage: deal.stage,
    probability: deal.probability,
    expectedCloseDate: deal.expected_close_date || new Date().toISOString(),
    created_at: deal.created_at,
    updated_at: deal.updated_at,
  })

  const loadCRMData = useCallback(async () => {
    setLoading(true)
    try {
      const [contactsData, dealsData] = await Promise.all([
        getContacts(),
        getDeals(),
      ])
      setContacts(contactsData.map(mapContact))
      setDeals(dealsData.map(mapDeal))
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      const message = error?.response?.data?.detail || "Failed to load CRM data"
      toast({ title: "Error", description: message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadCRMData()
  }, [loadCRMData])

  const filteredContacts = useMemo(() => {
    return contacts.filter(contact => {
      const matchesSearch = contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          contact.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          contact.company.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = filterStatus === "all" || contact.status === filterStatus
      const matchesPriority = filterPriority === "all" || contact.priority === filterPriority
      
      return matchesSearch && matchesStatus && matchesPriority
    })
  }, [contacts, searchQuery, filterStatus, filterPriority])

  const getStatusColor = (status: Contact['status']) => {
    switch (status) {
      case 'lead': return 'bg-blue-100 text-blue-800'
      case 'prospect': return 'bg-yellow-100 text-yellow-800'
      case 'customer': return 'bg-green-100 text-green-800'
      case 'inactive': return 'bg-slate-100 text-slate-600'
      default: return 'bg-slate-100 text-slate-800'
    }
  }

  const getPriorityColor = (priority: Contact['priority']) => {
    switch (priority) {
      case 'high': return 'bg-red-500 text-white'
      case 'medium': return 'bg-yellow-500 text-white'
      case 'low': return 'bg-green-500 text-white'
      default: return 'bg-slate-500 text-white'
    }
  }

  const getStageColor = (stage: Deal['stage']) => {
    switch (stage) {
      case 'prospecting': return 'bg-slate-100 text-slate-800'
      case 'qualification': return 'bg-blue-100 text-blue-800'
      case 'proposal': return 'bg-yellow-100 text-yellow-800'
      case 'negotiation': return 'bg-orange-100 text-orange-800'
      case 'closed_won': return 'bg-green-100 text-green-800'
      case 'closed_lost': return 'bg-red-100 text-red-800'
      default: return 'bg-slate-100 text-slate-800'
    }
  }

  const stats = useMemo(() => {
    const totalContacts = contacts.length
    const leads = contacts.filter(c => c.status === 'lead').length
    const customers = contacts.filter(c => c.status === 'customer').length
    const totalValue = deals.reduce((sum, deal) => sum + deal.amount, 0)
    const wonDeals = deals.filter(d => d.stage === 'closed_won').length

    return { totalContacts, leads, customers, totalValue, wonDeals }
  }, [contacts, deals])

  const handleCreateContact = async () => {
    if (!newContact.name.trim() || !newContact.email.trim()) {
      toast({ title: "Error", description: "Name and email are required", variant: "destructive" })
      return
    }

    try {
      const created = await createContact({
        name: newContact.name.trim(),
        email: newContact.email.trim(),
        phone: newContact.phone?.trim() || undefined,
        company: newContact.company.trim() || undefined,
        position: newContact.position?.trim() || undefined,
        status: newContact.status,
        priority: newContact.priority,
        source: newContact.source,
        notes: newContact.notes?.trim() || undefined,
        tags: [],
        value: undefined,
        last_contact: undefined,
        next_follow_up: undefined,
      })
      setContacts(prev => [mapContact(created), ...prev])
      setNewContact({
        name: "",
        email: "",
        phone: "",
        company: "",
        position: "",
        status: "lead",
        priority: "medium",
        source: "website",
        notes: ""
      })
      setShowCreateDialog(false)
      toast({ title: "Success", description: "Contact created successfully" })
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      const message = error?.response?.data?.detail || "Failed to create contact"
      toast({ title: "Error", description: message, variant: "destructive" })
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-sm text-muted-foreground">Loading CRM data...</div>
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
            <h1 className="text-3xl font-bold">CRM</h1>
            <Badge variant="outline" className="ml-2">
              Customer Relationship Management
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Track contacts, pipeline value, and deal velocity across teams.
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 w-64"
            />
          </div>

          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Contact
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add New Contact</DialogTitle>
                <DialogDescription>Add a new contact to your CRM system</DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={newContact.name}
                      onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                      placeholder="Full name"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newContact.email}
                      onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                      placeholder="email@company.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={newContact.phone}
                      onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                      placeholder="+1-555-0123"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="company">Company</Label>
                    <Input
                      id="company"
                      value={newContact.company}
                      onChange={(e) => setNewContact({ ...newContact, company: e.target.value })}
                      placeholder="Company name"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="position">Position</Label>
                  <Input
                    id="position"
                    value={newContact.position}
                    onChange={(e) => setNewContact({ ...newContact, position: e.target.value })}
                    placeholder="Job title"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={newContact.status}
                      onValueChange={(value) =>
                        setNewContact({ ...newContact, status: value as Contact["status"] })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lead">Lead</SelectItem>
                        <SelectItem value="prospect">Prospect</SelectItem>
                        <SelectItem value="customer">Customer</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={newContact.priority}
                      onValueChange={(value) =>
                        setNewContact({ ...newContact, priority: value as Contact["priority"] })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="source">Source</Label>
                    <Select
                      value={newContact.source}
                      onValueChange={(value) =>
                        setNewContact({ ...newContact, source: value as Contact["source"] })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="website">Website</SelectItem>
                        <SelectItem value="referral">Referral</SelectItem>
                        <SelectItem value="cold_outreach">Cold Outreach</SelectItem>
                        <SelectItem value="event">Event</SelectItem>
                        <SelectItem value="social">Social Media</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={newContact.notes}
                    onChange={(e) => setNewContact({ ...newContact, notes: e.target.value })}
                    placeholder="Additional notes..."
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateContact}>
                  Add Contact
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="bg-card/40 border-border/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total Contacts</p>
                <p className="text-2xl font-bold">{stats.totalContacts}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-yellow-600" />
              <div>
                <p className="text-sm text-muted-foreground">Leads</p>
                <p className="text-2xl font-bold">{stats.leads}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Customers</p>
                <p className="text-2xl font-bold">{stats.customers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-purple-600" />
              <div>
                <p className="text-sm text-muted-foreground">Pipeline Value</p>
                <p className="text-2xl font-bold">${stats.totalValue.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Won Deals</p>
                <p className="text-2xl font-bold">{stats.wonDeals}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "contacts" | "deals")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="contacts">
            <Users className="w-4 h-4 mr-2" />
            Contacts ({contacts.length})
          </TabsTrigger>
          <TabsTrigger value="deals">
            <Briefcase className="w-4 h-4 mr-2" />
            Deals ({deals.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contacts" className="space-y-4">
          {/* Filters */}
          <div className="flex gap-2">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="prospect">Prospect</SelectItem>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Contacts Grid */}
          <div className="grid gap-4">
            {filteredContacts.map((contact) => (
              <Card 
                key={contact.id}
                className="cursor-pointer hover:shadow-md transition-shadow border-border/60 bg-card/40"
                onClick={() => {
                  setSelectedContact(contact)
                  setShowContactDialog(true)
                }}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold truncate">{contact.name}</h3>
                        <Badge className={getPriorityColor(contact.priority)} variant="secondary">
                          {contact.priority.toUpperCase()}
                        </Badge>
                        <Badge className={getStatusColor(contact.status)} variant="outline">
                          {contact.status.toUpperCase()}
                        </Badge>
                      </div>
                      
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          {contact.email}
                        </div>
                        {contact.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4" />
                            {contact.phone}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4" />
                          {contact.company}
                          {contact.position && ` • ${contact.position}`}
                        </div>
                      </div>
                    </div>

                    <div className="text-right ml-4">
                      {contact.value && (
                        <div className="text-lg font-bold text-green-600">
                          ${contact.value.toLocaleString()}
                        </div>
                      )}
                      {contact.nextFollowUp && (
                        <div className="text-xs text-muted-foreground">
                          Next: {new Date(contact.nextFollowUp).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>

                  {contact.tags.length > 0 && (
                    <div className="flex gap-1 mt-3">
                      {contact.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {filteredContacts.length === 0 && (
              <Card>
                <CardContent className="p-12 text-center">
                  {hasActiveFilters ? (
                    <>
                      <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">No contacts found</h3>
                      <p className="text-muted-foreground mb-4">
                        Try adjusting your filters or search terms.
                      </p>
                      <Button onClick={() => setShowCreateDialog(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Contact
                      </Button>
                    </>
                  ) : (
                    <AnalyticsEmptyState
                      context="crm"
                      title="Пока нет контактов"
                      description="Добавьте первый контакт или подключите CRM, чтобы загрузить данные автоматически."
                      showRequest={false}
                      primaryAction={{
                        label: "Добавить контакт",
                        onClick: () => setShowCreateDialog(true),
                      }}
                    />
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="deals" className="space-y-4">
          {/* Deals Pipeline */}
          <div className="grid gap-4">
            {deals.map((deal) => (
              <Card key={deal.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold">{deal.title}</h3>
                        <Badge className={getStageColor(deal.stage)} variant="outline">
                          {deal.stage.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </div>
                      
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          {deal.contact} • {deal.company}
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          Expected close: {new Date(deal.expectedCloseDate).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4" />
                          Probability: {deal.probability}%
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">
                        ${deal.amount.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Deal value
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {deals.length === 0 && (
              <Card>
                <CardContent className="p-12 text-center">
                  <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No deals yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first deal to start tracking your sales pipeline
                  </p>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Deal
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Contact Detail Dialog */}
      <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
        <DialogContent className="sm:max-w-[600px]">
          {selectedContact && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  {selectedContact.name}
                  <Badge className={getPriorityColor(selectedContact.priority)} variant="secondary">
                    {selectedContact.priority.toUpperCase()}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  {selectedContact.status.toUpperCase()} • {selectedContact.company}
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="details" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="activity">Activity</TabsTrigger>
                  <TabsTrigger value="deals">Deals</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4">
                  <div className="grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Email</Label>
                        <p className="text-sm">{selectedContact.email}</p>
                      </div>
                      {selectedContact.phone && (
                        <div>
                          <Label>Phone</Label>
                          <p className="text-sm">{selectedContact.phone}</p>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Company</Label>
                        <p className="text-sm">{selectedContact.company}</p>
                      </div>
                      {selectedContact.position && (
                        <div>
                          <Label>Position</Label>
                          <p className="text-sm">{selectedContact.position}</p>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Source</Label>
                        <p className="text-sm">{selectedContact.source.replace('_', ' ').toUpperCase()}</p>
                      </div>
                      {selectedContact.value && (
                        <div>
                          <Label>Potential Value</Label>
                          <p className="text-sm">${selectedContact.value.toLocaleString()}</p>
                        </div>
                      )}
                    </div>

                    {selectedContact.notes && (
                      <div>
                        <Label>Notes</Label>
                        <p className="text-sm text-muted-foreground">{selectedContact.notes}</p>
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground border-t pt-2">
                      Created: {new Date(selectedContact.created_at).toLocaleString()}
                      {selectedContact.updated_at !== selectedContact.created_at && (
                        <span> • Updated: {new Date(selectedContact.updated_at).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="activity" className="space-y-4">
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="w-12 h-12 mx-auto mb-4" />
                    <p>Activity tracking coming soon...</p>
                  </div>
                </TabsContent>

                <TabsContent value="deals" className="space-y-4">
                  <div className="text-center py-8 text-muted-foreground">
                    <Briefcase className="w-12 h-12 mx-auto mb-4" />
                    <p>No deals associated with this contact</p>
                    <Button size="sm" className="mt-2">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Deal
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex justify-between pt-4 border-t">
                <div className="flex gap-2">
                  <Button size="sm" variant="outline">
                    <Edit3 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button size="sm" variant="outline">
                    <Mail className="w-4 h-4 mr-2" />
                    Email
                  </Button>
                </div>
                <Button size="sm" onClick={() => setShowContactDialog(false)}>
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
