'use client';

import * as React from 'react';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { Trash2, Loader2, PlusCircle, Search, ChevronsUpDown, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type User = {
  id: string;
  username: string;
  email: string;
  role: 'Admin' | 'Site Manager' | 'Site Engineer';
  siteManagerId?: string;
  assignedProjectIds?: string[];
};

type Site = {
  id: string;
  name: string;
};

export default function SiteAssignmentPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);

  const isAdmin = userProfile?.role === 'Admin' || 
                  user?.email === 'abhijeet.agepl@gmail.com' || 
                  user?.email === 'abhijeetsb22@gmail.com' ||
                  user?.email === 'khalil@adityagreenenergy.com' ||
                  user?.email === 'prafulrana143@gmail.com';
  
  const isManager = userProfile?.role === 'Site Manager';

  React.useEffect(() => {
    if (!isProfileLoading && !isAdmin && !isManager) {
      router.replace('/ptw/raise');
    }
  }, [isProfileLoading, isAdmin, isManager, router]);

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: sites, isLoading: sitesLoading } = useCollection<Site>(sitesQuery);

  const usersQuery = useMemoFirebase(() => {
    if (isAdmin) return collection(firestore, 'users');
    if (isManager) return query(collection(firestore, 'users'), where('siteManagerId', '==', user?.uid));
    return null;
  }, [firestore, isAdmin, isManager, user]);
  const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);

  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(null);
  const [selectedSiteToAdd, setSelectedSiteToAdd] = React.useState<string | null>(null);
  const selectedUser = React.useMemo(() => users?.find(u => u.id === selectedUserId), [users, selectedUserId]);
  const [localAssignedSites, setLocalAssignedSites] = React.useState<string[]>([]);
  const [isSaving, setIsSaving] = React.useState(false);

  // Search/Popover States
  const [isUserPopoverOpen, setIsUserPopoverOpen] = React.useState(false);
  const [userSearchQuery, setUserSearchQuery] = React.useState("");
  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [siteSearchQuery, setSiteSearchQuery] = React.useState("");

  React.useEffect(() => {
    if (selectedUser) {
      setLocalAssignedSites(selectedUser.assignedProjectIds || []);
    } else {
      setLocalAssignedSites([]);
    }
  }, [selectedUser]);

  const filteredUsers = React.useMemo(() => {
    const list = users?.filter(u => {
      if (isAdmin) return u.role !== 'Admin' || u.id === user?.uid;
      return u.role === 'Site Engineer';
    }) || [];
    
    return list.filter(u => 
      u.username.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearchQuery.toLowerCase())
    );
  }, [users, isAdmin, user, userSearchQuery]);

  const availableSitesToAssign = React.useMemo(() => {
    const list = sites?.filter(site => !localAssignedSites.includes(site.id)) || [];
    return list.filter(site => 
      site.name.toLowerCase().includes(siteSearchQuery.toLowerCase())
    );
  }, [sites, localAssignedSites, siteSearchQuery]);

  const handleAddSite = () => {
    if (!selectedSiteToAdd) return;
    if (localAssignedSites.includes(selectedSiteToAdd)) {
        toast({ title: 'Already Assigned', description: 'This site is already assigned to the user.', variant: 'destructive' });
        return;
    }
    setLocalAssignedSites(prev => [...prev, selectedSiteToAdd]);
    setSelectedSiteToAdd(null);
  };

  const handleRemoveSite = (siteId: string) => {
    setLocalAssignedSites(prev => prev.filter(id => id !== siteId));
  };

  const handleSave = () => {
    if (!selectedUserId) return;
    setIsSaving(true);

    const userRef = doc(firestore, 'users', selectedUserId);
    updateDocumentNonBlocking(userRef, { assignedProjectIds: localAssignedSites });

    toast({
      title: 'Sites Assigned',
      description: `Sites have been successfully updated for ${selectedUser?.username}.`,
      variant: 'success',
    });
    setIsSaving(false);
  };

  if (isProfileLoading || sitesLoading || usersLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!isAdmin && !isManager) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Assign Sites</h1>
        <p className="text-muted-foreground">Manage which sites are accessible to specific users.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select User</CardTitle>
          <CardDescription>
            {isAdmin ? "Select any user to manage their site access." : "Select one of your engineers to manage their site access."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-md space-y-2">
            <Label>User</Label>
            <Popover open={isUserPopoverOpen} onOpenChange={setIsUserPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className={cn(
                    "w-full justify-between font-normal",
                    !selectedUserId && "text-muted-foreground"
                  )}
                >
                  {selectedUserId
                    ? users?.find((u) => u.id === selectedUserId)?.username
                    : "Select a user..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <div className="flex items-center border-b px-3">
                  <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                  <Input
                    placeholder="Search users..."
                    className="h-9 w-full border-none focus-visible:ring-0 px-0"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                  />
                </div>
                <ScrollArea className="h-[250px]">
                  <div className="p-1">
                    {filteredUsers.length > 0 ? (
                      filteredUsers.map((u) => (
                        <Button
                          key={u.id}
                          variant="ghost"
                          className="w-full justify-start font-normal"
                          onClick={() => {
                            setSelectedUserId(u.id);
                            setIsUserPopoverOpen(false);
                            setUserSearchQuery("");
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              u.id === selectedUserId ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col items-start">
                            <span>{u.username}</span>
                            <span className="text-[10px] text-muted-foreground">{u.role}</span>
                          </div>
                        </Button>
                      ))
                    ) : (
                      <p className="p-4 text-center text-sm text-muted-foreground">No user found.</p>
                    )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {selectedUserId && (
        <Card className="animate-in fade-in slide-in-from-top-4 duration-300">
          <CardHeader>
            <CardTitle>Site Access for {selectedUser?.username}</CardTitle>
            <CardDescription>Add new sites or remove existing ones from this user's access list.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col sm:flex-row items-end gap-4 p-4 border rounded-lg bg-muted/20">
              <div className="flex-1 space-y-2 w-full">
                <Label>Add New Site</Label>
                <Popover open={isSitePopoverOpen} onOpenChange={setIsSitePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={cn(
                        "w-full justify-between font-normal",
                        !selectedSiteToAdd && "text-muted-foreground"
                      )}
                    >
                      {selectedSiteToAdd
                        ? sites?.find((s) => s.id === selectedSiteToAdd)?.name
                        : availableSitesToAssign.length > 0 ? "Select a site to add" : "No more sites available"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <div className="flex items-center border-b px-3">
                      <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                      <Input
                        placeholder="Search sites..."
                        className="h-9 w-full border-none focus-visible:ring-0 px-0"
                        value={siteSearchQuery}
                        onChange={(e) => setSiteSearchQuery(e.target.value)}
                      />
                    </div>
                    <ScrollArea className="h-[250px]">
                      <div className="p-1">
                        {availableSitesToAssign.length > 0 ? (
                          availableSitesToAssign.map((site) => (
                            <Button
                              key={site.id}
                              variant="ghost"
                              className="w-full justify-start font-normal"
                              onClick={() => {
                                setSelectedSiteToAdd(site.id);
                                setIsSitePopoverOpen(false);
                                setSiteSearchQuery("");
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  site.id === selectedSiteToAdd ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {site.name}
                            </Button>
                          ))
                        ) : (
                          <p className="p-4 text-center text-sm text-muted-foreground">No available sites found.</p>
                        )}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
              </div>
              <Button onClick={handleAddSite} disabled={!selectedSiteToAdd} className="w-full sm:w-auto">
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Site
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-lg font-semibold">Assigned Sites</Label>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Site Name</TableHead>
                      <TableHead className="w-[100px] text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {localAssignedSites.length > 0 ? (
                      localAssignedSites.map(siteId => {
                        const site = sites?.find(s => s.id === siteId);
                        return (
                          <TableRow key={siteId}>
                            <TableCell className="font-medium">{site?.name || 'Unknown Site'}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleRemoveSite(siteId)}>
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Remove</span>
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={2} className="h-24 text-center text-muted-foreground italic">
                          No sites assigned to this user yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
            
            <div className="flex justify-end pt-4">
                <Button onClick={handleSave} disabled={isSaving} size="lg">
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save Assignment
                </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
