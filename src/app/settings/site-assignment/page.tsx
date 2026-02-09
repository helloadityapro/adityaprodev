
'use client';

import * as React from 'react';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { MapPin, Users, Loader2 } from 'lucide-react';

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
                  user?.email === 'khalil@adityagreenenergy.com';
  
  const isManager = userProfile?.role === 'Site Manager';

  React.useEffect(() => {
    if (!isProfileLoading && !isAdmin && !isManager) {
      router.replace('/ptw/raise');
    }
  }, [isProfileLoading, isAdmin, isManager, router]);

  // Fetch all sites
  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: sites, isLoading: sitesLoading } = useCollection<Site>(sitesQuery);

  // Fetch users based on role
  const usersQuery = useMemoFirebase(() => {
    if (isAdmin) return collection(firestore, 'users');
    if (isManager) return query(collection(firestore, 'users'), where('siteManagerId', '==', user?.uid));
    return null;
  }, [firestore, isAdmin, isManager, user]);
  const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);

  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(null);
  const selectedUser = React.useMemo(() => users?.find(u => u.id === selectedUserId), [users, selectedUserId]);
  const [localAssignedSites, setLocalAssignedSites] = React.useState<string[]>([]);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (selectedUser) {
      setLocalAssignedSites(selectedUser.assignedProjectIds || []);
    } else {
      setLocalAssignedSites([]);
    }
  }, [selectedUser]);

  const toggleSite = (siteId: string) => {
    setLocalAssignedSites(prev => 
      prev.includes(siteId) ? prev.filter(id => id !== siteId) : [...prev, siteId]
    );
  };

  const handleSave = () => {
    if (!selectedUserId) return;
    setIsSaving(true);

    const userRef = doc(firestore, 'users', selectedUserId);
    updateDocumentNonBlocking(userRef, { assignedProjectIds: localAssignedSites });

    toast({
      title: 'Sites Assigned',
      description: `Sites have been successfully updated for ${selectedUser?.username}.`,
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

  // Filter users to show only those relevant for the current logged in user
  // Admins see everyone (except themselves maybe, or just Managers/Engineers)
  // Managers see only their Engineers
  const filteredUsers = users?.filter(u => {
      if (isAdmin) return u.role !== 'Admin' || u.id === user?.uid; // Allow admins to manage themselves or others
      return u.role === 'Site Engineer'; // Managers only manage engineers
  }) || [];

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
            <Select value={selectedUserId || ''} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a User" />
              </SelectTrigger>
              <SelectContent>
                {filteredUsers.map(u => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.username} ({u.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedUserId && (
        <Card className="animate-in fade-in slide-in-from-top-4 duration-300">
          <CardHeader>
            <CardTitle>Sites for {selectedUser?.username}</CardTitle>
            <CardDescription>Select the sites this user should be allowed to access.</CardDescription>
          </CardHeader>
          <CardContent>
            {sites && sites.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sites.map(site => (
                  <div key={site.id} className="flex items-center space-x-3 p-3 rounded-md border bg-card hover:bg-muted/50 transition-colors">
                    <Checkbox 
                      id={`site-${site.id}`} 
                      checked={localAssignedSites.includes(site.id)}
                      onCheckedChange={() => toggleSite(site.id)}
                    />
                    <Label htmlFor={`site-${site.id}`} className="flex-1 cursor-pointer font-medium">
                      {site.name}
                    </Label>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border rounded-lg border-dashed">
                <MapPin className="h-12 w-12 mb-4 opacity-20" />
                <p>No sites found. Please add sites in Admin Settings.</p>
              </div>
            )}
            
            <div className="mt-8 flex justify-end">
                <Button onClick={handleSave} disabled={isSaving}>
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
