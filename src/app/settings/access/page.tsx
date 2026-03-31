
'use client';

import * as React from 'react';
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection, setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ShieldCheck, 
  Users, 
  UserCog, 
  ArrowLeft, 
  Save, 
  Loader2, 
  CheckCircle2, 
  Search, 
  FilterX, 
  Lock,
  LayoutGrid,
  ChevronRight,
  Info
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { APP_PAGES, type PageKey } from '@/lib/access-control';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { isSuperAdmin } from '@/lib/auth-constants';
import { cn } from '@/lib/utils';

type AccessConfig = {
  id: string;
  allowedPageKeys: PageKey[];
};

type UserProfile = {
  id: string;
  username: string;
  email: string;
  role: string;
  customPermissions?: PageKey[];
};

export default function UserAccessManagementPage() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [activeTab, setActiveTab] = React.useState("roles");
  const [selectedRole, setSelectedManagerRole] = React.useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(null);
  const [rolePermissions, setRolePermissions] = React.useState<PageKey[]>([]);
  const [userPermissions, setUserPermissions] = React.useState<PageKey[]>([]);
  const [isSaving, setIsSaving] = React.useState(false);
  const [userSearch, setUserSearch] = React.useState("");

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const rolesQuery = useMemoFirebase(() => collection(firestore, 'user_roles'), [firestore]);
  const { data: rolesList } = useCollection<{ name: string }>(rolesQuery);

  const roleConfigsQuery = useMemoFirebase(() => collection(firestore, 'system_settings', 'access', 'roles'), [firestore]);
  const { data: roleConfigs } = useCollection<AccessConfig>(roleConfigsQuery);

  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: allUsers } = useCollection<UserProfile>(usersQuery);

  React.useEffect(() => {
    if (!isUserLoading && !isProfileLoading && !isAdmin) {
      router.replace('/dashboard');
    }
  }, [isUserLoading, isProfileLoading, isAdmin, router]);

  // Load permissions for selected role
  React.useEffect(() => {
    if (selectedRole && roleConfigs) {
      const config = roleConfigs.find(c => c.id === selectedRole);
      setRolePermissions(config?.allowedPageKeys || []);
    }
  }, [selectedRole, roleConfigs]);

  // Load permissions for selected user
  React.useEffect(() => {
    if (selectedUserId && allUsers) {
      const foundUser = allUsers.find(u => u.id === selectedUserId);
      
      // If user has custom permissions, use them. Otherwise, initialize with role defaults or empty.
      if (foundUser?.customPermissions) {
        setUserPermissions(foundUser.customPermissions);
      } else {
        const roleConfig = roleConfigs?.find(c => c.id === foundUser?.role);
        setUserPermissions(roleConfig?.allowedPageKeys || []);
      }
    }
  }, [selectedUserId, allUsers, roleConfigs]);

  const togglePermission = (key: PageKey, type: 'role' | 'user') => {
    const current = type === 'role' ? rolePermissions : userPermissions;
    const setter = type === 'role' ? setRolePermissions : setUserPermissions;
    
    if (current.includes(key)) {
      setter(current.filter(k => k !== key));
    } else {
      setter([...current, key]);
    }
  };

  const handleSaveRole = async () => {
    if (!selectedRole) return;
    setIsSaving(true);
    try {
      const ref = doc(firestore, 'system_settings', 'access', 'roles', selectedRole);
      await setDocumentNonBlocking(ref, {
        allowedPageKeys: rolePermissions,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      toast({ title: 'Role Access Saved', description: `Default permissions for ${selectedRole} updated.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Save Failed', description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveUser = async () => {
    if (!selectedUserId) return;
    setIsSaving(true);
    try {
      const userRef = doc(firestore, 'users', selectedUserId);
      await updateDocumentNonBlocking(userRef, {
        customPermissions: userPermissions,
        updatedAt: serverTimestamp(),
      });
      toast({ title: 'User Override Saved', description: 'Individual access permissions customized.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Save Failed', description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetUser = async () => {
    if (!selectedUserId) return;
    setIsSaving(true);
    try {
      const userRef = doc(firestore, 'users', selectedUserId);
      await updateDocumentNonBlocking(userRef, {
        customPermissions: null, // This effectively removes the override
      });
      
      // Reset local state to role defaults
      const foundUser = allUsers?.find(u => u.id === selectedUserId);
      const roleConfig = roleConfigs?.find(c => c.id === foundUser?.role);
      setUserPermissions(roleConfig?.allowedPageKeys || []);
      
      toast({ title: 'Override Revoked', description: 'User has been returned to role-based default permissions.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Reset Failed', description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const categories = ['Main Hub', 'Operations', 'Administration'] as const;

  const filteredUsers = React.useMemo(() => {
    if (!allUsers) return [];
    return allUsers.filter(u => 
      u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase())
    ).sort((a, b) => a.username.localeCompare(b.username));
  }, [allUsers, userSearch]);

  if (isUserLoading || isProfileLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>;

  if (!isAdmin) return null;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" onClick={() => router.push('/settings')} className="w-fit mb-2 -ml-2 text-muted-foreground hover:text-primary">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Settings
        </Button>
        <h1 className="flex items-center gap-2">
          <Lock className="h-8 w-8 text-primary" /> User Access Management
        </h1>
        <p className="text-muted-foreground font-medium">Configure page visibility and authorization across the organization.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-muted/50 border border-primary/10 rounded-sm p-1 h-11 mb-8 max-w-md">
          <TabsTrigger value="roles" className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <UserCog className="h-3.5 w-3.5 mr-1.5" /> Designations
          </TabsTrigger>
          <TabsTrigger value="personnel" className="rounded-sm font-bold text-[10px] uppercase tracking-widest px-6 h-9 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Users className="h-3.5 w-3.5 mr-1.5" /> Personnel Overrides
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="space-y-8 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Roles Selection */}
            <Card className="rounded-sm border-primary/10 shadow-md h-fit overflow-hidden">
              <CardHeader className="bg-muted/5 border-b py-4">
                <CardTitle className="text-sm font-bold uppercase tracking-widest">Select Designation</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[400px]">
                  <div className="divide-y">
                    {rolesList?.map(role => (
                      <button
                        key={role.name}
                        onClick={() => setSelectedManagerRole(role.name)}
                        className={cn(
                          "w-full flex items-center justify-between p-4 text-left transition-colors group",
                          selectedRole === role.name ? "bg-primary/10 text-primary" : "hover:bg-muted/5"
                        )}
                      >
                        <span className="font-bold text-sm uppercase tracking-tight">{role.name}</span>
                        <ChevronRight className={cn("h-4 w-4 transition-all", selectedRole === role.name ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2")} />
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Permissions Grid for Roles */}
            <Card className="lg:col-span-2 rounded-sm border-primary/10 shadow-lg overflow-hidden">
              <CardHeader className="bg-muted/5 border-b py-4 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold uppercase tracking-widest">
                    {selectedRole ? `Allowed Pages: ${selectedRole}` : "Select a designation to configure"}
                  </CardTitle>
                  <CardDescription className="text-[10px] font-bold text-muted-foreground uppercase">Define global default visibility for this role</CardDescription>
                </div>
                {selectedRole && (
                  <Button onClick={handleSaveRole} disabled={isSaving} className="h-9 rounded-sm font-black uppercase text-[10px] tracking-widest">
                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                    Save Policy
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-6">
                {!selectedRole ? (
                  <div className="py-20 text-center text-muted-foreground italic flex flex-col items-center gap-4">
                    <ShieldCheck className="h-12 w-12 opacity-10" />
                    <p>Select a designation from the left to start configuring access rules.</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {categories.map(cat => (
                      <div key={cat} className="space-y-4">
                        <div className="flex items-center gap-2 border-b pb-2">
                          <LayoutGrid className="h-3.5 w-3.5 text-primary opacity-50" />
                          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{cat}</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {APP_PAGES.filter(p => p.category === cat).map(page => (
                            <div 
                              key={page.id} 
                              className={cn(
                                "flex items-center space-x-3 p-3 rounded-sm border transition-all cursor-pointer",
                                rolePermissions.includes(page.id) ? "bg-primary/5 border-primary/20 shadow-sm" : "bg-background border-border/50 hover:border-primary/10"
                              )}
                              onClick={() => togglePermission(page.id, 'role')}
                            >
                              <Checkbox 
                                id={`role-${page.id}`} 
                                checked={rolePermissions.includes(page.id)} 
                                onCheckedChange={() => togglePermission(page.id, 'role')}
                                className="rounded-full h-5 w-5"
                              />
                              <Label 
                                htmlFor={`role-${page.id}`} 
                                className="flex-1 cursor-pointer font-bold text-xs uppercase tracking-tight"
                              >
                                {page.label}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="personnel" className="space-y-8 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* User Selection */}
            <Card className="rounded-sm border-primary/10 shadow-md h-fit overflow-hidden">
              <CardHeader className="bg-muted/5 border-b p-4 space-y-4">
                <CardTitle className="text-sm font-bold uppercase tracking-widest">Select Personnel</CardTitle>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search name..." 
                    className="h-9 pl-8 text-xs rounded-sm" 
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[400px]">
                  <div className="divide-y">
                    {filteredUsers.map(u => (
                      <button
                        key={u.id}
                        onClick={() => setSelectedUserId(u.id)}
                        className={cn(
                          "w-full flex items-center justify-between p-4 text-left transition-colors group",
                          selectedUserId === u.id ? "bg-primary/10 text-primary" : "hover:bg-muted/5"
                        )}
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-sm truncate">{u.username}</span>
                          <span className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter">{u.role}</span>
                        </div>
                        <ChevronRight className={cn("h-4 w-4 transition-all shrink-0", selectedUserId === u.id ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2")} />
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Permissions Grid for Users */}
            <Card className="lg:col-span-2 rounded-sm border-primary/10 shadow-lg overflow-hidden">
              <CardHeader className="bg-muted/5 border-b py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-sm font-bold uppercase tracking-widest">
                    {selectedUserId ? `Access Override: ${allUsers?.find(u => u.id === selectedUserId)?.username}` : "Select personnel to override"}
                  </CardTitle>
                  <CardDescription className="text-[10px] font-bold text-muted-foreground uppercase">Assign individual permissions that bypass role defaults</CardDescription>
                </div>
                {selectedUserId && (
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleResetUser} disabled={isSaving} className="h-9 rounded-sm font-bold uppercase text-[10px] tracking-widest border-destructive/20 text-destructive hover:bg-destructive/5">
                      Reset to Default
                    </Button>
                    <Button onClick={handleSaveUser} disabled={isSaving} className="h-9 rounded-sm font-black uppercase text-[10px] tracking-widest">
                      {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                      Save Override
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-6">
                {!selectedUserId ? (
                  <div className="py-20 text-center text-muted-foreground italic flex flex-col items-center gap-4">
                    <Users className="h-12 w-12 opacity-10" />
                    <p>Select a user from the left to define custom access rules.</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-sm flex items-start gap-3">
                      <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-[11px] font-medium text-amber-800 leading-relaxed italic">
                        <strong>Note:</strong> Saving an override will create a custom permission profile for this user. This user will no longer be affected by changes to their Designation's default access rules until the override is reset.
                      </p>
                    </div>

                    {categories.map(cat => (
                      <div key={cat} className="space-y-4">
                        <div className="flex items-center gap-2 border-b pb-2">
                          <LayoutGrid className="h-3.5 w-3.5 text-primary opacity-50" />
                          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{cat}</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {APP_PAGES.filter(p => p.category === cat).map(page => (
                            <div 
                              key={page.id} 
                              className={cn(
                                "flex items-center space-x-3 p-3 rounded-sm border transition-all cursor-pointer",
                                userPermissions.includes(page.id) ? "bg-primary/5 border-primary/20 shadow-sm" : "bg-background border-border/50 hover:border-primary/10"
                              )}
                              onClick={() => togglePermission(page.id, 'user')}
                            >
                              <Checkbox 
                                id={`user-${page.id}`} 
                                checked={userPermissions.includes(page.id)} 
                                onCheckedChange={() => togglePermission(page.id, 'user')}
                                className="rounded-full h-5 w-5"
                              />
                              <Label 
                                htmlFor={`user-${page.id}`} 
                                className="flex-1 cursor-pointer font-bold text-xs uppercase tracking-tight"
                              >
                                {page.label}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
