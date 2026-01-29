'use client';

import * as React from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FolderKanban } from 'lucide-react';

type Permit = {
  id: string;
  siteName: string;
  ptwType: string;
  descriptionOfWork: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Corrected';
  siteEngineerId: string;
};

export default function ProfilePage() {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();

  const userProfileRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);

  const permitsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'permits_to_work'), where('siteEngineerId', '==', user.uid));
  }, [firestore, user]);
  const { data: permits, isLoading: arePermitsLoading } = useCollection<Permit>(permitsQuery);

  const appliedSites = React.useMemo(() => {
    if (!permits) return [];
    // Get unique site names
    const siteNames = permits.map(p => p.siteName);
    return [...new Set(siteNames)];
  }, [permits]);

  if (isAuthLoading || isProfileLoading || arePermitsLoading) {
    return <p>Loading profile...</p>;
  }

  if (!userProfile) {
    return <p>Could not load user profile.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
         <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="items-center text-center">
            <Avatar className="h-24 w-24 mb-4 border-2 border-primary">
              {user?.photoURL && <AvatarImage src={user.photoURL} alt={userProfile.username} data-ai-hint="person face" />}
              <AvatarFallback className="text-3xl">
                {userProfile.username?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <CardTitle className="text-2xl">{userProfile.username}</CardTitle>
            <CardDescription>{userProfile.email}</CardDescription>
            <Badge variant="outline" className="mt-2">{userProfile.role}</Badge>
          </CardHeader>
          <CardContent className="text-sm">
            <Separator className="my-4" />
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="font-semibold text-muted-foreground">Mobile</span>
                <span className="font-medium">{userProfile.mobile}</span>
              </div>
               <div className="flex justify-between">
                <span className="font-semibold text-muted-foreground">Status</span>
                <Badge variant={userProfile.registrationRequest ? 'destructive' : 'default'}>
                  {userProfile.registrationRequest ? 'Pending Approval' : 'Active'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>My Sites</CardTitle>
            <CardDescription>A list of sites where you have raised a Permit to Work.</CardDescription>
          </CardHeader>
          <CardContent>
            {appliedSites.length > 0 ? (
              <ul className="space-y-3">
                {appliedSites.map(site => (
                  <li key={site} className="flex items-center gap-3 rounded-md border p-3">
                    <FolderKanban className="h-5 w-5 text-primary" />
                    <span className="font-medium">{site}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-48">
                 <p>You have not raised any permits yet.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
