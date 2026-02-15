"use client"

import { useState, useMemo } from "react"
import ProtectedRoute from "@/components/auth/ProtectedRoute"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"

import {
  Plus,
  Search,
  Filter,
  Target,
  TrendingUp,
  TrendingDown,
  Eye,
  MousePointer,
  DollarSign,
  BarChart3,
  Activity,
  Play,
  Pause,
  Square,
  Edit3,
  Trash2,
  Zap,
  Globe,
  Smartphone,
  Monitor,
  Calendar,
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Megaphone
} from "lucide-react"

interface Ad {
  id: string
  name: string
  campaign: string
  platform: 'google' | 'facebook' | 'linkedin' | 'twitter' | 'tiktok' | 'youtube'
  type: 'search' | 'display' | 'video' | 'shopping' | 'social'
  status: 'active' | 'paused' | 'draft' | 'rejected' | 'expired'
  budget: {
    daily: number
    total: number
  }
  spent: number
  bidStrategy: 'cpc' | 'cpm' | 'cpa' | 'roas'
  targetAudience: {
    age: string
    gender: string
    interests: string[]
    locations: string[]
  }
  creativeAssets: {
    headline: string
    description: string
    images: string[]
    video?: string
  }
  metrics: {
    impressions: number
    clicks: number
    conversions: number
    ctr: number
    cpc: number
    cpm: number
    cpa: number
    roas: number
    qualityScore?: number
  }
  schedule: {
    startDate: string
    endDate?: string
    timeSchedule?: string
  }
  created_at: string
  updated_at: string
}

interface AdGroup {
  id: string
  name: string
  campaign: string
  status: 'active' | 'paused' | 'draft'
  ads: Ad[]
  keywords?: string[]
  budget: number
  spent: number
}

// Mock data
const mockAds: Ad[] = [
  {
    id: "1",
    name: "Enterprise Software Solution - Search Ad",
    campaign: "Q1 Product Launch Campaign",
    platform: "google",
    type: "search",
    status: "active",
    budget: {
      daily: 500,
      total: 15000
    },
    spent: 8750,
    bidStrategy: "cpc",
    targetAudience: {
      age: "25-54",
      gender: "all",
      interests: ["Enterprise Software", "Business Solutions", "Technology"],
      locations: ["United States", "Canada", "United Kingdom"]
    },
    creativeAssets: {
      headline: "Revolutionary Enterprise Software | Free Trial",
      description: "Transform your business operations with our cutting-edge enterprise software. Start your free trial today!",
      images: ["ad-image-1.jpg", "ad-image-2.jpg"]
    },
    metrics: {
      impressions: 45000,
      clicks: 1800,
      conversions: 72,
      ctr: 4.0,
      cpc: 4.86,
      cpm: 194.44,
      cpa: 121.53,
      roas: 3.2,
      qualityScore: 8
    },
    schedule: {
      startDate: "2024-01-01",
      endDate: "2024-03-31",
      timeSchedule: "9:00-18:00"
    },
    created_at: "2023-12-15T00:00:00Z",
    updated_at: "2024-01-15T10:30:00Z"
  },
  {
    id: "2",
    name: "Social Media Engagement - Display Ad",
    campaign: "Brand Awareness Campaign",
    platform: "facebook",
    type: "display",
    status: "active",
    budget: {
      daily: 200,
      total: 6000
    },
    spent: 3200,
    bidStrategy: "cpm",
    targetAudience: {
      age: "18-45",
      gender: "all",
      interests: ["Small Business", "Entrepreneurship", "Digital Marketing"],
      locations: ["United States", "Australia", "New Zealand"]
    },
    creativeAssets: {
      headline: "Grow Your Business with Smart Tools",
      description: "Join thousands of successful businesses using our platform to streamline operations and boost growth.",
      images: ["social-ad-1.jpg", "social-ad-2.jpg"],
      video: "promo-video.mp4"
    },
    metrics: {
      impressions: 125000,
      clicks: 3500,
      conversions: 85,
      ctr: 2.8,
      cpc: 0.91,
      cpm: 25.60,
      cpa: 37.65,
      roas: 2.7
    },
    schedule: {
      startDate: "2024-01-15",
      endDate: "2024-04-15"
    },
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-10T14:20:00Z"
  }
]

const mockAdGroups: AdGroup[] = [
  {
    id: "1",
    name: "Enterprise Solutions",
    campaign: "Q1 Product Launch Campaign",
    status: "active",
    ads: [mockAds[0]],
    keywords: ["enterprise software", "business solutions", "productivity tools"],
    budget: 15000,
    spent: 8750
  },
  {
    id: "2",
    name: "Small Business Tools",
    campaign: "Brand Awareness Campaign",
    status: "active",
    ads: [mockAds[1]],
    keywords: ["small business tools", "business automation", "growth software"],
    budget: 6000,
    spent: 3200
  }
]

export default function AdsPage() {
  return (
    <ProtectedRoute>
      <AdsPageContent />
    </ProtectedRoute>
  )
}

function AdsPageContent() {
  const { toast } = useToast()
  
  const [activeTab, setActiveTab] = useState<'ads' | 'groups' | 'performance'>('ads')
  const [ads, setAds] = useState<Ad[]>(mockAds)
  const [adGroups, setAdGroups] = useState<AdGroup[]>(mockAdGroups)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterPlatform, setFilterPlatform] = useState<string>("all")
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null)
  const [showAdDialog, setShowAdDialog] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  const [newAd, setNewAd] = useState({
    name: "",
    campaign: "",
    platform: "google" as const,
    type: "search" as const,
    dailyBudget: "",
    totalBudget: "",
    headline: "",
    description: "",
    targetAge: "25-54",
    targetGender: "all",
    startDate: "",
    endDate: ""
  })

  const filteredAds = useMemo(() => {
    return ads.filter(ad => {
      const matchesSearch = ad.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          ad.campaign.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = filterStatus === "all" || ad.status === filterStatus
      const matchesPlatform = filterPlatform === "all" || ad.platform === filterPlatform
      
      return matchesSearch && matchesStatus && matchesPlatform
    })
  }, [ads, searchQuery, filterStatus, filterPlatform])

  const getStatusColor = (status: Ad['status']) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'paused': return 'bg-yellow-100 text-yellow-800'
      case 'draft': return 'bg-slate-100 text-slate-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      case 'expired': return 'bg-slate-100 text-slate-600'
      default: return 'bg-slate-100 text-slate-800'
    }
  }

  const getPlatformIcon = (platform: Ad['platform']) => {
    switch (platform) {
      case 'google': return <Globe className="w-4 h-4" />
      case 'facebook': return <Users className="w-4 h-4" />
      case 'linkedin': return <Users className="w-4 h-4" />
      case 'twitter': return <Users className="w-4 h-4" />
      case 'tiktok': return <Smartphone className="w-4 h-4" />
      case 'youtube': return <Monitor className="w-4 h-4" />
      default: return <Globe className="w-4 h-4" />
    }
  }

  const getPlatformColor = (platform: Ad['platform']) => {
    switch (platform) {
      case 'google': return 'bg-blue-100 text-blue-800'
      case 'facebook': return 'bg-blue-100 text-blue-800'
      case 'linkedin': return 'bg-blue-100 text-blue-800'
      case 'twitter': return 'bg-sky-100 text-sky-800'
      case 'tiktok': return 'bg-purple-100 text-purple-800'
      case 'youtube': return 'bg-red-100 text-red-800'
      default: return 'bg-slate-100 text-slate-800'
    }
  }

  const handleCreateAd = () => {
    if (!newAd.name.trim() || !newAd.headline.trim()) {
      toast({ title: "Error", description: "Ad name and headline are required", variant: "destructive" })
      return
    }

    const ad: Ad = {
      id: Date.now().toString(),
      name: newAd.name.trim(),
      campaign: newAd.campaign.trim() || "Default Campaign",
      platform: newAd.platform,
      type: newAd.type,
      status: 'draft',
      budget: {
        daily: parseInt(newAd.dailyBudget) || 0,
        total: parseInt(newAd.totalBudget) || 0
      },
      spent: 0,
      bidStrategy: 'cpc',
      targetAudience: {
        age: newAd.targetAge,
        gender: newAd.targetGender,
        interests: [],
        locations: []
      },
      creativeAssets: {
        headline: newAd.headline.trim(),
        description: newAd.description.trim() || "",
        images: []
      },
      metrics: {
        impressions: 0,
        clicks: 0,
        conversions: 0,
        ctr: 0,
        cpc: 0,
        cpm: 0,
        cpa: 0,
        roas: 0
      },
      schedule: {
        startDate: newAd.startDate,
        endDate: newAd.endDate
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    setAds(prev => [ad, ...prev])
    setNewAd({
      name: "",
      campaign: "",
      platform: "google",
      type: "search",
      dailyBudget: "",
      totalBudget: "",
      headline: "",
      description: "",
      targetAge: "25-54",
      targetGender: "all",
      startDate: "",
      endDate: ""
    })
    setShowCreateDialog(false)
    toast({ title: "Success", description: "Ad created successfully" })
  }

  const handleAdStatusChange = (adId: string, newStatus: Ad['status']) => {
    setAds(prev => prev.map(ad => 
      ad.id === adId ? { ...ad, status: newStatus, updated_at: new Date().toISOString() } : ad
    ))
    toast({ 
      title: "Success", 
      description: `Ad ${newStatus === 'active' ? 'activated' : newStatus === 'paused' ? 'paused' : newStatus}` 
    })
  }

  const stats = useMemo(() => {
    const totalAds = ads.length
    const activeAds = ads.filter(a => a.status === 'active').length
    const totalSpent = ads.reduce((sum, a) => sum + a.spent, 0)
    const totalBudget = ads.reduce((sum, a) => sum + a.budget.total, 0)
    const totalImpressions = ads.reduce((sum, a) => sum + a.metrics.impressions, 0)
    const totalClicks = ads.reduce((sum, a) => sum + a.metrics.clicks, 0)
    const totalConversions = ads.reduce((sum, a) => sum + a.metrics.conversions, 0)
    const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
    const avgCPC = totalClicks > 0 ? totalSpent / totalClicks : 0
    const avgROAS = ads.length > 0 ? ads.reduce((sum, a) => sum + a.metrics.roas, 0) / ads.length : 0

    return {
      totalAds,
      activeAds,
      totalSpent,
      totalBudget,
      totalImpressions,
      totalClicks,
      totalConversions,
      avgCTR,
      avgCPC,
      avgROAS
    }
  }, [ads])

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex items-center gap-2">
          <Megaphone className="w-6 h-6 text-blue-600" />
          <h1 className="text-3xl font-bold">Ads Manager</h1>
          <Badge variant="outline" className="ml-2">
            Advertising Campaigns
          </Badge>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search ads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 w-64"
            />
          </div>

          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Ad
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Create New Ad</DialogTitle>
                <DialogDescription>Set up a new advertising campaign</DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                <div className="grid gap-2">
                  <Label htmlFor="name">Ad Name *</Label>
                  <Input
                    id="name"
                    value={newAd.name}
                    onChange={(e) => setNewAd({ ...newAd, name: e.target.value })}
                    placeholder="e.g., Enterprise Software - Search Campaign"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="campaign">Campaign</Label>
                  <Input
                    id="campaign"
                    value={newAd.campaign}
                    onChange={(e) => setNewAd({ ...newAd, campaign: e.target.value })}
                    placeholder="Campaign name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="platform">Platform</Label>
                    <Select
                      value={newAd.platform}
                      onValueChange={(value: any) => setNewAd({ ...newAd, platform: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="google">Google Ads</SelectItem>
                        <SelectItem value="facebook">Facebook</SelectItem>
                        <SelectItem value="linkedin">LinkedIn</SelectItem>
                        <SelectItem value="twitter">Twitter</SelectItem>
                        <SelectItem value="tiktok">TikTok</SelectItem>
                        <SelectItem value="youtube">YouTube</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="type">Ad Type</Label>
                    <Select
                      value={newAd.type}
                      onValueChange={(value: any) => setNewAd({ ...newAd, type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="search">Search</SelectItem>
                        <SelectItem value="display">Display</SelectItem>
                        <SelectItem value="video">Video</SelectItem>
                        <SelectItem value="shopping">Shopping</SelectItem>
                        <SelectItem value="social">Social</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="dailyBudget">Daily Budget ($)</Label>
                    <Input
                      id="dailyBudget"
                      type="number"
                      value={newAd.dailyBudget}
                      onChange={(e) => setNewAd({ ...newAd, dailyBudget: e.target.value })}
                      placeholder="100"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="totalBudget">Total Budget ($)</Label>
                    <Input
                      id="totalBudget"
                      type="number"
                      value={newAd.totalBudget}
                      onChange={(e) => setNewAd({ ...newAd, totalBudget: e.target.value })}
                      placeholder="3000"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="headline">Headline *</Label>
                  <Input
                    id="headline"
                    value={newAd.headline}
                    onChange={(e) => setNewAd({ ...newAd, headline: e.target.value })}
                    placeholder="Compelling ad headline"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newAd.description}
                    onChange={(e) => setNewAd({ ...newAd, description: e.target.value })}
                    placeholder="Ad description..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="targetAge">Target Age</Label>
                    <Select
                      value={newAd.targetAge}
                      onValueChange={(value) => setNewAd({ ...newAd, targetAge: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="18-24">18-24</SelectItem>
                        <SelectItem value="25-34">25-34</SelectItem>
                        <SelectItem value="35-44">35-44</SelectItem>
                        <SelectItem value="45-54">45-54</SelectItem>
                        <SelectItem value="25-54">25-54</SelectItem>
                        <SelectItem value="55+">55+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="targetGender">Target Gender</Label>
                    <Select
                      value={newAd.targetGender}
                      onValueChange={(value) => setNewAd({ ...newAd, targetGender: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={newAd.startDate}
                      onChange={(e) => setNewAd({ ...newAd, startDate: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={newAd.endDate}
                      onChange={(e) => setNewAd({ ...newAd, endDate: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateAd}>
                  Create Ad
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total Ads</p>
                <p className="text-2xl font-bold">{stats.totalAds}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Play className="w-4 h-4 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold">{stats.activeAds}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-red-600" />
              <div>
                <p className="text-sm text-muted-foreground">Spent</p>
                <p className="text-2xl font-bold">${stats.totalSpent.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-purple-600" />
              <div>
                <p className="text-sm text-muted-foreground">Impressions</p>
                <p className="text-2xl font-bold">{stats.totalImpressions.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <MousePointer className="w-4 h-4 text-orange-600" />
              <div>
                <p className="text-sm text-muted-foreground">Clicks</p>
                <p className="text-2xl font-bold">{stats.totalClicks.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-teal-600" />
              <div>
                <p className="text-sm text-muted-foreground">Avg ROAS</p>
                <p className="text-2xl font-bold">{stats.avgROAS.toFixed(1)}x</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="ads">
            <Target className="w-4 h-4 mr-2" />
            Ads ({ads.length})
          </TabsTrigger>
          <TabsTrigger value="groups">
            <Users className="w-4 h-4 mr-2" />
            Ad Groups ({adGroups.length})
          </TabsTrigger>
          <TabsTrigger value="performance">
            <BarChart3 className="w-4 h-4 mr-2" />
            Performance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ads" className="space-y-4">
          {/* Filters */}
          <div className="flex gap-2">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterPlatform} onValueChange={setFilterPlatform}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                <SelectItem value="google">Google</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
                <SelectItem value="linkedin">LinkedIn</SelectItem>
                <SelectItem value="twitter">Twitter</SelectItem>
                <SelectItem value="tiktok">TikTok</SelectItem>
                <SelectItem value="youtube">YouTube</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Ads Grid */}
          <div className="grid gap-4">
            {filteredAds.map((ad) => (
              <Card 
                key={ad.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => {
                  setSelectedAd(ad)
                  setShowAdDialog(true)
                }}
              >
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getPlatformIcon(ad.platform)}
                          <h3 className="text-lg font-semibold">{ad.name}</h3>
                          <Badge className={getStatusColor(ad.status)} variant="outline">
                            {ad.status.toUpperCase()}
                          </Badge>
                          <Badge className={getPlatformColor(ad.platform)} variant="outline">
                            {ad.platform.toUpperCase()}
                          </Badge>
                        </div>
                        
                        <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                          {ad.creativeAssets.headline}
                        </p>

                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(ad.schedule.startDate).toLocaleDateString()}
                            {ad.schedule.endDate && ` - ${new Date(ad.schedule.endDate).toLocaleDateString()}`}
                          </div>
                          <div className="flex items-center gap-1">
                            <Target className="w-4 h-4" />
                            {ad.type.toUpperCase()}
                          </div>
                        </div>
                      </div>

                      <div className="text-right ml-4">
                        <div className="text-2xl font-bold text-red-600">
                          ${ad.spent.toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          of ${ad.budget.total.toLocaleString()}
                        </div>
                        <Progress 
                          value={ad.budget.total > 0 ? (ad.spent / ad.budget.total) * 100 : 0} 
                          className="w-20 mt-1" 
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-5 gap-4 pt-3 border-t">
                      <div className="text-center">
                        <div className="text-lg font-bold">{ad.metrics.impressions.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">Impressions</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold">{ad.metrics.clicks.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">Clicks</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold">{ad.metrics.ctr.toFixed(1)}%</div>
                        <div className="text-xs text-muted-foreground">CTR</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold">${ad.metrics.cpc.toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">CPC</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold">{ad.metrics.roas.toFixed(1)}x</div>
                        <div className="text-xs text-muted-foreground">ROAS</div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleAdStatusChange(ad.id, ad.status === 'active' ? 'paused' : 'active')
                        }}
                      >
                        {ad.status === 'active' ? (
                          <>
                            <Pause className="w-4 h-4 mr-2" />
                            Pause
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-2" />
                            Activate
                          </>
                        )}
                      </Button>
                      <Button size="sm" variant="outline" onClick={(e) => e.stopPropagation()}>
                        <Edit3 className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredAds.length === 0 && (
              <Card>
                <CardContent className="p-12 text-center">
                  <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No ads found</h3>
                  <p className="text-muted-foreground mb-4">
                    {searchQuery || filterStatus !== "all" || filterPlatform !== "all"
                      ? "Try adjusting your filters or search terms"
                      : "Create your first ad to start advertising"}
                  </p>
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Ad
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="groups" className="space-y-4">
          <div className="grid gap-4">
            {adGroups.map((group) => (
              <Card key={group.id}>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold">{group.name}</h3>
                          <Badge className={getStatusColor(group.status as any)} variant="outline">
                            {group.status.toUpperCase()}
                          </Badge>
                        </div>
                        
                        <p className="text-sm text-muted-foreground mb-2">
                          Campaign: {group.campaign}
                        </p>

                        {group.keywords && (
                          <div className="flex gap-1 mb-2">
                            {group.keywords.slice(0, 3).map((keyword) => (
                              <Badge key={keyword} variant="outline" className="text-xs">
                                {keyword}
                              </Badge>
                            ))}
                            {group.keywords.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{group.keywords.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="text-right ml-4">
                        <div className="text-2xl font-bold text-red-600">
                          ${group.spent.toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          of ${group.budget.toLocaleString()}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {group.ads.length} ads
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {adGroups.length === 0 && (
              <Card>
                <CardContent className="p-12 text-center">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No ad groups yet</h3>
                  <p className="text-muted-foreground">
                    Create ad groups to organize your advertisements
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Performance Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {stats.avgCTR.toFixed(2)}%
                      </div>
                      <div className="text-sm text-muted-foreground">Average CTR</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        ${stats.avgCPC.toFixed(2)}
                      </div>
                      <div className="text-sm text-muted-foreground">Average CPC</div>
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-3xl font-bold text-purple-600">
                      {stats.totalConversions}
                    </div>
                    <div className="text-sm text-muted-foreground">Total Conversions</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Top Performing Ads
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {ads
                    .sort((a, b) => b.metrics.roas - a.metrics.roas)
                    .slice(0, 3)
                    .map((ad) => (
                    <div key={ad.id} className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium">{ad.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {ad.platform.toUpperCase()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-green-600">{ad.metrics.roas.toFixed(1)}x</div>
                        <div className="text-sm text-muted-foreground">ROAS</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Ad Detail Dialog */}
      <Dialog open={showAdDialog} onOpenChange={setShowAdDialog}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
          {selectedAd && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {getPlatformIcon(selectedAd.platform)}
                  {selectedAd.name}
                  <Badge className={getStatusColor(selectedAd.status)} variant="outline">
                    {selectedAd.status.toUpperCase()}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  {selectedAd.platform.toUpperCase()} • {selectedAd.type.toUpperCase()} Ad
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="metrics">Metrics</TabsTrigger>
                  <TabsTrigger value="targeting">Targeting</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <div className="grid gap-4">
                    <div>
                      <Label>Headline</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedAd.creativeAssets.headline}
                      </p>
                    </div>

                    {selectedAd.creativeAssets.description && (
                      <div>
                        <Label>Description</Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          {selectedAd.creativeAssets.description}
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Campaign</Label>
                        <p className="text-sm">{selectedAd.campaign}</p>
                      </div>
                      <div>
                        <Label>Bid Strategy</Label>
                        <p className="text-sm">{selectedAd.bidStrategy.toUpperCase()}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Daily Budget</Label>
                        <p className="text-sm">${selectedAd.budget.daily.toLocaleString()}</p>
                      </div>
                      <div>
                        <Label>Total Budget</Label>
                        <p className="text-sm">${selectedAd.budget.total.toLocaleString()}</p>
                      </div>
                    </div>

                    <div>
                      <Label>Budget Utilization</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Progress 
                          value={selectedAd.budget.total > 0 ? (selectedAd.spent / selectedAd.budget.total) * 100 : 0} 
                          className="flex-1" 
                        />
                        <span className="text-sm">
                          {selectedAd.budget.total > 0 ? ((selectedAd.spent / selectedAd.budget.total) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        ${selectedAd.spent.toLocaleString()} spent of ${selectedAd.budget.total.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="metrics" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-2xl font-bold">{selectedAd.metrics.impressions.toLocaleString()}</div>
                        <div className="text-sm text-muted-foreground">Impressions</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-2xl font-bold">{selectedAd.metrics.clicks.toLocaleString()}</div>
                        <div className="text-sm text-muted-foreground">Clicks</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-2xl font-bold">{selectedAd.metrics.conversions}</div>
                        <div className="text-sm text-muted-foreground">Conversions</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-2xl font-bold">{selectedAd.metrics.ctr.toFixed(1)}%</div>
                        <div className="text-sm text-muted-foreground">CTR</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-2xl font-bold">${selectedAd.metrics.cpc.toFixed(2)}</div>
                        <div className="text-sm text-muted-foreground">CPC</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-2xl font-bold">{selectedAd.metrics.roas.toFixed(1)}x</div>
                        <div className="text-sm text-muted-foreground">ROAS</div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="targeting" className="space-y-4">
                  <div className="grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Age Range</Label>
                        <p className="text-sm">{selectedAd.targetAudience.age}</p>
                      </div>
                      <div>
                        <Label>Gender</Label>
                        <p className="text-sm">{selectedAd.targetAudience.gender.toUpperCase()}</p>
                      </div>
                    </div>

                    {selectedAd.targetAudience.interests.length > 0 && (
                      <div>
                        <Label>Interests</Label>
                        <div className="flex gap-1 mt-1">
                          {selectedAd.targetAudience.interests.map((interest) => (
                            <Badge key={interest} variant="outline" className="text-xs">
                              {interest}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedAd.targetAudience.locations.length > 0 && (
                      <div>
                        <Label>Locations</Label>
                        <div className="flex gap-1 mt-1">
                          {selectedAd.targetAudience.locations.map((location) => (
                            <Badge key={location} variant="outline" className="text-xs">
                              {location}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex justify-end pt-4 border-t">
                <Button onClick={() => setShowAdDialog(false)}>
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