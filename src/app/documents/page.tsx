'use client';

import * as React from 'react';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FolderIcon, Search, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { isSuperAdmin } from '@/lib/auth-constants';

type Site = {
  id: string;
  name: string;
  projectCompany: string;
};

type UserProfile = {
  id: string;
  username: string;
  role: string;
  assignedProjectIds?: string[];
};

export default function DocumentsExplorerPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [searchTerm, setSearchTerm] = React.useState('');

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: allSites, isLoading: sitesLoading } = useCollection<Site>(sitesQuery);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';
  const isManager = userProfile?.role === 'Site Manager';

  // For managers, we also need to fetch their engineers to see their assigned sites
  const teamQuery = useMemoFirebase(() => {
    if (!isManager || !user) return null;
    return query(collection(firestore, 'users'), where('siteManagerId', '==', user.uid));
  }, [firestore, user, isManager]);
  const { data: teamMembers, isLoading: teamLoading } = useCollection<UserProfile>(teamQuery);

  const accessibleSites = React.useMemo(() => {
    if (!allSites || (!userProfile && !isAdmin)) return [];
    
    // Admins see all folders
    if (isAdmin) return allSites;

    // Build a set of all unique project IDs this user should see
    const assignedIds = new Set<string>(userProfile?.assignedProjectIds || []);
    
    // If manager, add all project IDs assigned to their engineers
    if (isManager && teamMembers) {
      teamMembers.forEach(member => {
        (member.assignedProjectIds || []).forEach(id => assignedIds.add(id));
      });
    }

    return allSites.filter(site => assignedIds.has(site.id));
  }, [allSites, userProfile, isAdmin, isManager, teamMembers]);

  const filteredSites = React.useMemo(() => {
    return accessibleSites.filter(site => 
      site.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      site.projectCompany.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [accessibleSites, searchTerm]);

  if (isProfileLoading || sitesLoading || (isManager && teamLoading)) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2">
          <FolderIcon className="h-8 w-8 text-primary" /> Documents Explorer
        </h1>
        <p className="text-muted-foreground">Access and manage files for your authorized project sites.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search site folders..." 
          className="pl-9 rounded-sm border-primary/20" 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {filteredSites.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredSites.map((site) => (
            <Link key={site.id} href={`/documents/${site.id}`}>
              <Card className="hover:shadow-md transition-all cursor-pointer group border-primary/10 rounded-sm overflow-hidden h-full">
                <CardHeader className="bg-muted/5 flex flex-row items-start justify-between space-y-0">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-sm text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                      <FolderIcon className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-lg group-hover:text-primary transition-colors">{site.name}</CardTitle>
                      <CardDescription className="text-xs">{site.projectCompany}</CardDescription>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity translate-x-[-10px] group-hover:translate-x-0" />
                </CardHeader>
                <CardContent className="pt-4">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Storage Folder</p>
                  <p className="text-xs text-muted-foreground truncate mt-1">Documents / {site.name}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center bg-card border border-dashed rounded-sm border-primary/20">
          <FolderIcon className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold">No Site Folders Found</h3>
          <p className="text-muted-foreground max-sm mx-auto">
            {searchTerm ? "No sites match your search criteria." : "You currently don't have access to any site document folders. Please contact Admin for assignment."}
          </p>
        </div>
      )}
    </div>
  );
}