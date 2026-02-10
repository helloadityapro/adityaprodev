
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FileText, FolderKanban, UserPlus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

function AdminDashboardSkeleton() {
    return (
        <div className="animate-pulse">
            <Skeleton className="h-9 w-64 mb-4" />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <Skeleton className="h-5 w-24" />
                        <Skeleton className="h-4 w-4" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-8 w-12" />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-4 w-4" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-8 w-12" />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <Skeleton className="h-5 w-24" />
                        <Skeleton className="h-4 w-4" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-8 w-12" />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <Skeleton className="h-5 w-24" />
                        <Skeleton className="h-4 w-4" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-8 w-12" />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default function AdminDashboardPage() {
    const firestore = useFirestore();
    const router = useRouter();
    const { user, isUserLoading } = useUser();

    const userProfileRef = useMemoFirebase(() => {
        if (!user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);

    const { data: userProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);

    const isAdmin = userProfile?.role === 'Admin' || 
                    user?.email === 'abhijeet.agepl@gmail.com' || 
                    user?.email === 'abhijeetsb22@gmail.com' ||
                    user?.email === 'khalil@adityagreenenergy.com' ||
                    user?.email === 'prafulrana143@gmail.com';

    useEffect(() => {
        if (!isUserLoading && !isProfileLoading && !isAdmin) {
            router.replace('/ptw/raise');
        }
    }, [isUserLoading, isProfileLoading, isAdmin, router]);

    const usersQuery = useMemoFirebase(() => {
        if (!isAdmin) return null;
        return collection(firestore, 'users');
    }, [firestore, isAdmin]);
    const { data: users, isLoading: usersLoading } = useCollection(usersQuery);

    const permitsQuery = useMemoFirebase(() => collection(firestore, 'permits_to_work'), [firestore]);
    const { data: permits, isLoading: permitsLoading } = useCollection(permitsQuery);

    const projectsQuery = useMemoFirebase(() => collection(firestore, 'projects'), [firestore]);
    const { data: projects, isLoading: projectsLoading } = useCollection(projectsQuery);

    if (isUserLoading || isProfileLoading || (isAdmin && usersLoading) || permitsLoading || projectsLoading) {
        return <AdminDashboardSkeleton />
    }

    if (!isAdmin) {
        return null;
    }
    
    const summary = {
        totalUsers: users?.length || 0,
        pendingRegistrations: users?.filter(u => u.registrationRequest).length || 0,
        totalProjects: projects?.length || 0,
        totalPermits: permits?.length || 0,
    };

    return (
        <>
            <h1 className="text-lg font-headline font-semibold md:text-2xl">Admin Dashboard</h1>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summary.totalUsers}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Registrations</CardTitle>
                        <UserPlus className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summary.pendingRegistrations}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
                        <FolderKanban className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summary.totalProjects}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Permits</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summary.totalPermits}</div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
