
'use client';

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Eye, Edit, Trash2, Users, UserPlus, Shield, UserCog, HardHat, CheckCircle2, ArrowUpDown, ArrowUp, ArrowDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/avatar"
import { useCollection, useFirestore, updateDocumentNonBlocking, useMemoFirebase, deleteDocumentNonBlocking, useUser, useDoc } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { AddUserDialog } from "@/components/add-user-dialog";
import { EditUserDialog } from "@/components/edit-user-dialog";
import { useToast } from "@/hooks/use-toast";
import { ViewUserDialog } from "@/components/view-user-dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";

type UserRole = 'Admin' | 'Site Manager' | 'Site Engineer';

type User = {
  id: string;
  username: string;
  email: string;
  mobile: string;
  role: UserRole;
  registrationRequest: boolean;
  avatarUrl?: string;
  createdAt?: any;
};

function StatusBadge({ isPending }: { isPending: boolean }) {
  const status = isPending ? "Pending" : "Active";
  return (
    <Badge
      className={cn("text-xs font-medium", {
        "bg-yellow-100 text-yellow-800 hover:bg-yellow-100/80 dark:bg-yellow-900/50 dark:text-yellow-300 border-transparent": status === "Pending",
        "bg-green-100 text-green-800 hover:bg-green-100/80 dark:bg-green-900/50 dark:text-green-300 border-transparent": status === "Active",
      })}
    >
      {status}
    </Badge>
  )
}

function UsersPageSkeleton() {
    return (
        <div className="flex flex-col gap-6 animate-pulse">
            <div className="flex items-center justify-between">
                <Skeleton className="h-9 w-48" />
                <Skeleton className="h-10 w-24" />
            </div>

            <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
            </div>

            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-40" />
                    <Skeleton className="h-4 w-64 mt-1" />
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead><Skeleton className="h-5 w-40" /></TableHead>
                                <TableHead><Skeleton className="h-5 w-24" /></TableHead>
                                <TableHead><Skeleton className="h-5 w-24" /></TableHead>
                                <TableHead className="hidden md:table-cell"><Skeleton className="h-5 w-32" /></TableHead>
                                <TableHead><Skeleton className="h-5 w-32" /></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Skeleton className="h-9 w-9 rounded-full" />
                                            <div className="grid gap-1">
                                                <Skeleton className="h-4 w-24" />
                                                <Skeleton className="h-3 w-32" />
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                                    <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-32" /></TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Skeleton className="h-8 w-20" />
                                            <Skeleton className="h-8 w-20" />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}

type FilterType = 'all' | 'pending' | UserRole;
type SortKey = 'username' | 'role' | 'registrationRequest' | 'createdAt';

export default function UsersPage() {
    const firestore = useFirestore();
    const router = useRouter();
    const { user, isUserLoading } = useUser();
    const { toast } = useToast();

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

    React.useEffect(() => {
        if (!isUserLoading && !isProfileLoading && !isAdmin) {
            router.replace('/ptw/raise');
        }
    }, [isUserLoading, isProfileLoading, isAdmin, router]);

    const usersQuery = useMemoFirebase(() => {
        if (!isAdmin) return null;
        return collection(firestore, 'users');
    }, [firestore, isAdmin]);
    const { data: users, isLoading: isUsersLoading } = useCollection<User>(usersQuery);

    const [filter, setFilter] = React.useState<FilterType>('all');
    const [searchTerm, setSearchTerm] = React.useState('');
    const [sortConfig, setSortConfig] = React.useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'createdAt', direction: 'desc' });
    const [isAddUserDialogOpen, setIsAddUserDialogOpen] = React.useState(false);
    const [userToEdit, setUserToEdit] = React.useState<User | null>(null);
    const [userToView, setUserToView] = React.useState<User | null>(null);
    const [userToDelete, setUserToDelete] = React.useState<User | null>(null);
    const [isRejecting, setIsRejecting] = React.useState(false);

    const handleApproveRegistration = (userId: string) => {
        const userRef = doc(firestore, 'users', userId);
        updateDocumentNonBlocking(userRef, { registrationRequest: false });
        toast({ title: 'User Approved', description: 'The user registration has been approved.' });
    }
    
    const handleRejectClick = (user: User) => {
        setIsRejecting(true);
        setUserToDelete(user);
    }

    const handleDeleteClick = (user: User) => {
        setIsRejecting(false);
        setUserToDelete(user);
    }
    
    const handleConfirmDelete = (userId: string) => {
        if (!userId) return;
        const userRef = doc(firestore, 'users', userId);
        deleteDocumentNonBlocking(userRef);
        toast({ title: isRejecting ? 'User Rejected' : 'User Deleted', description: `The user has been successfully ${isRejecting ? 'rejected and removed' : 'deleted'}.` });
        setUserToDelete(null);
    };

    const handleSort = (key: SortKey) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const SortIcon = ({ column }: { column: SortKey }) => {
        if (sortConfig.key !== column) return <ArrowUpDown className="ml-2 h-4 w-4" />;
        return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
    };

    const sortedAndFilteredUsers = React.useMemo(() => {
        if (!users) return [];
        let result = [...users];

        // Apply Search Filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(u => 
                u.username.toLowerCase().includes(term) || 
                u.email.toLowerCase().includes(term)
            );
        }
        
        // Apply Role Filter
        if (filter === 'pending') {
            result = result.filter(u => u.registrationRequest);
        } else if (filter !== 'all') {
            result = result.filter(u => u.role === filter);
        }

        // Apply Sorting
        return result.sort((a, b) => {
            const { key, direction } = sortConfig;
            let valA: any = a[key];
            let valB: any = b[key];

            if (key === 'createdAt') {
                valA = a.createdAt?.toDate()?.getTime() || 0;
                valB = b.createdAt?.toDate()?.getTime() || 0;
            }

            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [users, filter, sortConfig, searchTerm]);

    const summary = React.useMemo(() => {
        if (!users) return { totalUsers: 0, pendingRegistrations: 0, admins: 0, managers: 0, engineers: 0 };
        return {
            totalUsers: users.length,
            pendingRegistrations: users.filter(u => u.registrationRequest).length,
            admins: users.filter(u => u.role === 'Admin').length,
            managers: users.filter(u => u.role === 'Site Manager').length,
            engineers: users.filter(u => u.role === 'Site Engineer').length,
        };
    }, [users]);

    if(isUserLoading || isProfileLoading || (isAdmin && isUsersLoading)) {
        return <UsersPageSkeleton />
    }
    
    if (!isAdmin) {
        return null;
    }

    return (
        <>
            <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-lg font-headline font-semibold md:text-2xl">User Management</h1>
                    <Button onClick={() => setIsAddUserDialogOpen(true)}>Add User</Button>
                </div>

                <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                    <Card onClick={() => setFilter('all')} className={cn("cursor-pointer transition-all hover:bg-muted/50", filter === 'all' && "ring-2 ring-primary bg-primary/5")}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Users</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{summary.totalUsers}</div>
                        </CardContent>
                    </Card>

                    <Card onClick={() => setFilter('pending')} className={cn("cursor-pointer transition-all hover:bg-muted/50 relative overflow-hidden", filter === 'pending' && "ring-2 ring-yellow-500 bg-yellow-500/5")}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Pending</CardTitle>
                            <UserPlus className="h-4 w-4 text-yellow-500" />
                        </CardHeader>
                        <CardContent className="flex items-center justify-between">
                            <div className="text-2xl font-bold">{summary.pendingRegistrations}</div>
                            {summary.pendingRegistrations > 0 && (
                                <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="h-7 px-2 text-[10px] text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setFilter('pending');
                                    }}
                                >
                                    Review <CheckCircle2 className="ml-1 h-3 w-3" />
                                </Button>
                            )}
                        </CardContent>
                    </Card>

                    <Card onClick={() => setFilter('Admin')} className={cn("cursor-pointer transition-all hover:bg-muted/50", filter === 'Admin' && "ring-2 ring-blue-500 bg-blue-500/5")}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Admins</CardTitle>
                            <Shield className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{summary.admins}</div>
                        </CardContent>
                    </Card>

                    <Card onClick={() => setFilter('Site Manager')} className={cn("cursor-pointer transition-all hover:bg-muted/50", filter === 'Site Manager' && "ring-2 ring-purple-500 bg-purple-500/5")}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Managers</CardTitle>
                            <UserCog className="h-4 w-4 text-purple-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{summary.managers}</div>
                        </CardContent>
                    </Card>

                    <Card onClick={() => setFilter('Site Engineer')} className={cn("cursor-pointer transition-all hover:bg-muted/50", filter === 'Site Engineer' && "ring-2 ring-orange-500 bg-orange-500/5")}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Engineers</CardTitle>
                            <HardHat className="h-4 w-4 text-orange-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{summary.engineers}</div>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <CardTitle>
                                {filter === 'all' && 'All Users'}
                                {filter === 'pending' && 'Pending Registrations'}
                                {filter === 'Admin' && 'Admins'}
                                {filter === 'Site Manager' && 'Site Managers'}
                                {filter === 'Site Engineer' && 'Site Engineers'}
                            </CardTitle>
                            <CardDescription>
                                {filter === 'all' && 'Showing every user registered in the system.'}
                                {filter === 'pending' && 'Users awaiting approval from an administrator.'}
                                {filter === 'Admin' && 'Users with administrative privileges.'}
                                {filter === 'Site Manager' && 'Users responsible for first-level permit approvals.'}
                                {filter === 'Site Engineer' && 'Users who raise permit requests at sites.'}
                            </CardDescription>
                        </div>
                        <div className="relative w-full md:w-72">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by name or email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8"
                            />
                        </div>
                    </CardHeader>
                    <CardContent>
                        {sortedAndFilteredUsers.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead onClick={() => handleSort('username')} className="cursor-pointer hover:bg-muted/50 transition-colors">
                                            <div className="flex items-center">User <SortIcon column="username" /></div>
                                        </TableHead>
                                        <TableHead onClick={() => handleSort('role')} className="cursor-pointer hover:bg-muted/50 transition-colors">
                                            <div className="flex items-center">Role <SortIcon column="role" /></div>
                                        </TableHead>
                                        <TableHead onClick={() => handleSort('registrationRequest')} className="cursor-pointer hover:bg-muted/50 transition-colors">
                                            <div className="flex items-center">Status <SortIcon column="registrationRequest" /></div>
                                        </TableHead>
                                        <TableHead className="hidden md:table-cell">Mobile</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedAndFilteredUsers.map((user) => (
                                        <TableRow key={user.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-9 w-9">
                                                        {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.username} data-ai-hint="person face" />}
                                                        <AvatarFallback>{user.username.charAt(0).toUpperCase()}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="grid gap-0.5">
                                                        <p className="font-medium">{user.username}</p>
                                                        <p className="text-sm text-muted-foreground">{user.email}</p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="font-normal capitalize">
                                                    {user.role}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <StatusBadge isPending={user.registrationRequest} />
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell">{user.mobile}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {user.registrationRequest ? (
                                                        <>
                                                            <Button variant="outline" size="sm" className="h-8" onClick={() => handleApproveRegistration(user.id)}>Approve</Button>
                                                            <Button variant="destructive" size="sm" className="h-8" onClick={() => handleRejectClick(user)}>Reject</Button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setUserToView(user)}>
                                                                <Eye className="h-4 w-4" />
                                                                <span className="sr-only">View</span>
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setUserToEdit(user)}>
                                                                <Edit className="h-4 w-4" />
                                                                <span className="sr-only">Edit</span>
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteClick(user)}>
                                                                <Trash2 className="h-4 w-4" />
                                                                <span className="sr-only">Delete</span>
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="text-center py-12 text-muted-foreground">
                               <p>No users found matching your search or filter.</p>
                               <Button variant="link" onClick={() => { setFilter('all'); setSearchTerm(''); }}>Clear all filters</Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
            <AddUserDialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen} />
            <EditUserDialog user={userToEdit} open={!!userToEdit} onOpenChange={() => setUserToEdit(null)} />
            <ViewUserDialog user={userToView} open={!!userToView} onOpenChange={() => setUserToView(null)} />
            <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        {isRejecting 
                            ? "This will reject the user registration and delete their account data. This action cannot be undone."
                            : "This action cannot be undone. This will permanently delete the user document from Firestore."
                        }
                         It will not remove the user from the authentication system.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => userToDelete && handleConfirmDelete(userToDelete.id)} className={cn(isRejecting ? "bg-red-600 hover:bg-red-700" : "bg-destructive hover:bg-destructive/90")}>
                         {isRejecting ? 'Yes, Reject' : 'Delete'}
                    </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
