'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Pencil, 
  Search, 
  Tags, 
  Check, 
  Building2, 
  CheckCircle2, 
  Loader2,
  ListChecks,
  X
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { isSuperAdmin } from '@/lib/auth-constants';
import { cn } from '@/lib/utils';

export default function SiteGroupsManagementPage() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [activeTab, setActiveTab] = React.useState("list");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [newGroupName, setNewGroupName] = React.useState("");
  const [groupSiteIds, setGroupSiteIds] = React.useState<string[]>([]);
  const [groupSiteSearch, setGroupSiteSearch] = React.useState("");
  const [editingGroupId, setEditingGroupId] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  React.useEffect(() => {
    if (!isUserLoading && !isProfileLoading && !isAdmin) {
      router.replace('/dashboard');
    }
  }, [isUserLoading, isProfileLoading, isAdmin, router]);

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites, isLoading: sitesLoading } = useCollection<any>(sitesQuery);

  const groupsQuery = useMemoFirebase(() => collection(firestore, 'site_groups'), [firestore]);
  const { data: groups, isLoading: groupsLoading } = useCollection<any>(groupsQuery);

  const handleSaveGroup = async () => {
    if (!newGroupName.trim() || groupSiteIds.length === 0 || !user) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Group name and at least one site selection is required.' });
      return;
    }
    setIsSubmitting(true);
    try {
      if (editingGroupId) {
        await updateDocumentNonBlocking(doc(firestore, 'site_groups', editingGroupId), {
          name: newGroupName.trim(),
          siteIds: groupSiteIds,
          updatedAt: serverTimestamp(),
        });
        toast({ title: 'Group Updated', description: `Modifications to "${newGroupName}" saved.` });
      } else {
        await addDocumentNonBlocking(collection(firestore, 'site_groups'), {
          name: newGroupName.trim(),
          siteIds: groupSiteIds,
          createdById: user.uid,
          createdAt: serverTimestamp(),
        });
        toast({ title: 'Group Created', description: `Site group "${newGroupName}" initialized.` });
      }
      resetForm();
      setActiveTab("list");
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Operation Failed', description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setNewGroupName("");
    setGroupSiteIds([]);
    setEditingGroupId(null);
  };

  const handleEditGroup = (group: any) => {
    setEditingGroupId(group.id);
    setNewGroupName(group.name);
    setGroupSiteIds(group.siteIds || []);
    setActiveTab("create");
  };

  const handleDeleteGroup = (id: string) => {
    deleteDocumentNonBlocking(doc(firestore, 'site_groups', id));
    toast({ title: 'Group Removed' });
  };

  const filteredGroups = React.useMemo(() => {
    if (!groups) return [];
    return groups.filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [groups, searchTerm]);

  if (isUserLoading || isProfileLoading || sitesLoading || groupsLoading) {
    return (
      <div className="space-y-6 animate-pulse p-8">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto pb-20">
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" onClick={() => router.push('/projects/add')} className="w-fit mb-2 -ml-2 text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Projects Management
        </Button>
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-sm shrink-0">
            <Tags className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight">Site Grouping Hub</h1>
            <p className="text-muted-foreground text-xs font-medium">Categorize project locations for cluster reports and filtering.</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-muted/50 border border-primary/10 rounded-sm p-1 h-11 mb-8 max-w-md">
          <TabsTrigger value="list" className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <ListChecks className="h-3.5 w-3.5 mr-1.5" /> Active Groups
          </TabsTrigger>
          <TabsTrigger value="create" className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            {editingGroupId ? <Pencil className="h-3.5 w-3.5 mr-1.5" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
            {editingGroupId ? "Edit Group" : "Create New Group"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-6 animate-in fade-in duration-300 m-0">
          <div className="flex items-center gap-3 bg-card p-4 border border-primary/10 rounded-sm shadow-sm">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search groups by name..." 
                className="pl-10 h-10 rounded-sm border-primary/20 bg-background text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Badge variant="outline" className="rounded-sm font-black uppercase text-[10px] h-10 px-4 border-primary/20 text-primary bg-primary/5">
              {filteredGroups.length} Groups Found
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGroups.length > 0 ? filteredGroups.map(g => (
              <Card key={g.id} className="rounded-sm border-primary/10 shadow-sm hover:shadow-md transition-all group overflow-hidden h-full flex flex-col">
                <CardHeader className="bg-primary/5 py-4 border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-black uppercase tracking-tight text-primary truncate pr-2">{g.name}</CardTitle>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm text-primary hover:bg-primary/10" onClick={() => handleEditGroup(g)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm text-destructive hover:bg-destructive/10" onClick={() => handleDeleteGroup(g.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 flex-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase mb-3">Linked Projects ({g.siteIds?.length || 0})</p>
                  <div className="space-y-2">
                    {(g.siteIds || []).slice(0, 5).map((id: string) => {
                      const site = allSites?.find(s => s.id === id);
                      return (
                        <div key={id} className="flex items-center gap-2 text-xs font-medium text-foreground">
                          <Building2 className="h-3 w-3 text-primary opacity-40 shrink-0" />
                          <span className="truncate">{site?.name || "Unknown Site"}</span>
                        </div>
                      );
                    })}
                    {g.siteIds?.length > 5 && (
                      <p className="text-[9px] font-black text-primary/60 uppercase pl-5 pt-1">+{g.siteIds.length - 5} More Projects</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )) : (
              <div className="col-span-full py-24 text-center border-2 border-dashed rounded-sm bg-muted/5">
                <Tags className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                <p className="font-black uppercase tracking-widest text-muted-foreground">No site groups configured</p>
                <Button variant="outline" className="mt-4 rounded-sm font-bold" onClick={() => setActiveTab("create")}>Initialize First Group</Button>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="create" className="animate-in fade-in duration-300 m-0">
          <Card className="rounded-sm border-primary/10 shadow-lg overflow-hidden max-w-4xl mx-auto">
            <CardHeader className="bg-primary/5 border-b p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-xl font-black uppercase tracking-tight">
                    {editingGroupId ? "Modify Group Structure" : "Define New Site Group"}
                  </CardTitle>
                  <CardDescription className="text-xs">Select project locations to cluster under this group.</CardDescription>
                </div>
                {editingGroupId && (
                  <Button variant="ghost" size="sm" onClick={resetForm} className="text-destructive font-bold uppercase text-[10px] tracking-widest">
                    <X className="h-3.5 w-3.5 mr-1" /> Reset Form
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-10">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Group Label / Name</Label>
                <Input 
                  placeholder="e.g. Cluster North, Industrial Zone, Phase 1..." 
                  className="h-14 rounded-sm text-xl font-black tracking-tight border-primary/10 focus-visible:ring-primary/20"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                />
              </div>

              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Project Selection</Label>
                    <Badge className="bg-primary h-5 text-[8px] uppercase font-black px-2">{groupSiteIds.length} Selected</Badge>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Filter sites..." 
                      className="pl-8 h-9 rounded-sm text-xs bg-muted/20 border-none" 
                      value={groupSiteSearch}
                      onChange={(e) => setGroupSiteSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div className="border rounded-sm bg-muted/5 shadow-inner">
                  <ScrollArea className="h-[450px]">
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {allSites?.filter(s => s.name.toLowerCase().includes(groupSiteSearch.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name)).map(site => (
                        <div 
                          key={site.id} 
                          className={cn(
                            "flex items-center space-x-3 p-4 rounded-sm border transition-all cursor-pointer group",
                            groupSiteIds.includes(site.id) 
                              ? "bg-primary/5 border-primary/30 shadow-sm" 
                              : "bg-background border-border/50 hover:border-primary/20"
                          )}
                          onClick={() => {
                            setGroupSiteIds(prev => prev.includes(site.id) ? prev.filter(id => id !== site.id) : [...prev, site.id]);
                          }}
                        >
                          <Checkbox checked={groupSiteIds.includes(site.id)} className="h-5 w-5 rounded-full border-primary/30" />
                          <div className="flex flex-col min-w-0">
                            <span className={cn("text-[13px] font-black truncate leading-none mb-1.5 transition-colors", groupSiteIds.includes(site.id) ? "text-primary" : "text-foreground")}>{site.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-bold text-muted-foreground uppercase truncate opacity-60 flex items-center gap-1">
                                <Building2 className="h-2.5 w-2.5" /> {site.projectCompany}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>

              <div className="pt-6 border-t flex flex-col sm:flex-row gap-4 items-center justify-between bg-primary/[0.01] -mx-8 -mb-8 p-8">
                <div className="space-y-1">
                   <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Confirmation Summary</p>
                   <p className="text-xs font-medium text-foreground/70">
                    {groupSiteIds.length > 0 
                      ? `${groupSiteIds.length} projects will be linked to this cluster.` 
                      : "Please select at least one site to continue."}
                   </p>
                </div>
                <Button 
                  className="w-full sm:w-[280px] h-14 font-black uppercase text-xs tracking-widest shadow-xl shadow-primary/20"
                  disabled={!newGroupName.trim() || groupSiteIds.length === 0 || isSubmitting}
                  onClick={handleSaveGroup}
                >
                  {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
                  {editingGroupId ? "Update Configuration" : "Finalize Site Group"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
