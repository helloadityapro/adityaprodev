
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
import { Eye, Pencil, Trash2, Users, UserPlus, Shield, UserCog, HardHat, CircleCheck, ArrowUpDown, ArrowUp, ArrowDown, Search, CircleHelp } from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
  username?: string;
  email?: string;
  mobile?: string;
  role?: UserRole;
  registrationRequest?: boolean;
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

type FilterType = 'all' | 'pending' | 'other' | UserRole;
type SortKey = 'username' | 'role' | 'registrationRequest' | 'createdAt';

export default function UsersPage() {
    const firestore = useFirestore();
    const router = useRouter();
    const { user: currentUser, isUserLoading } = useUser();
    const { toast } = useToast();

    const userProfileRef = useMemoFirebase(() => {
        if (!currentUser) return null;
        return doc(firestore, 'users', currentUser.uid);
    }, [firestore, currentUser]);
    const { data: userProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);

    const SUPER_ADMIN_EMAILS = [
      'abhijeet.agepl@gmail.com',
      'abhijeetsb22@gmail.com',
      'khalil@adityagreenenergy.com',
      'prafulrana143@gmail.com'
    ];

    const isAdmin = userProfile?.role === 'Admin' || (currentUser?.email && SUPER_ADMIN_EMAILS.includes(currentUser.email));

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
        toast({ title: 'User Approved', description: 'User approved.' });
    }
    
    const handleRejectClick = (u: User) => {
        setIsRejecting(true);
        setUserToDelete(u);
    }

    const handleDeleteClick = (u: User) => {
        if (u.id === currentUser?.uid) {
            toast({ variant: "destructive", title: "Restricted", description: "You cannot delete yourself." });
            return;
        }
        setIsRejecting(false);
        setUserToDelete(u);
    }
    
    const handleConfirmDelete = (userId: string) => {
        if (!userId) return;
        const userRef = doc(firestore, 'users', userId);
        deleteDocumentNonBlocking(userRef);
        toast({ title: isRejecting ? 'Rejected' : 'Deleted', description: `User ${isRejecting ? 'rejected' : 'deleted'}.` });
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

    const summary = React.useMemo(() => {
        const counts = { totalUsers: 0, pending: 0, admins: 0, managers: 0, engineers: 0, other: 0 };
        if (!users) return counts;
        counts.totalUsers = users.length;
        users.forEach(u => {
            if (u.registrationRequest) counts.pending++;
            else if (u.role === 'Admin') counts.admins++;
            else if (u.role === 'Site Manager') counts.managers++;
            else if (u.role === 'Site Engineer') counts.engineers++;
            else counts.other++;
        });
        return counts;
    }, [users]);

    const sortedAndFilteredUsers = React.useMemo(() => {
        if (!users) return [];
        let result = users.filter(u => {
            const term = searchTerm.toLowerCase();
            const matchesSearch = (u.username || '').toLowerCase().includes(term) || (u.email || '').toLowerCase().includes(term);
            const matchesFilter = filter === 'all' ? true :
                                  filter === 'pending' ? u.registrationRequest === true :
                                  filter === 'other' ? (!u.registrationRequest && !['Admin', 'Site Manager', 'Site Engineer'].includes(u.role || '')) :
                                  u.role === filter;
            return matchesSearch && matchesFilter;
        });

        return result.sort((a, b) => {
            const { key, direction } = sortConfig;
            let valA: any = a[key] ?? '';
            let valB: any = b[key] ?? '';
            if (key === 'createdAt') {
                valA = a.createdAt?.toDate?.()?.getTime() || 0;
                valB = b.createdAt?.toDate?.()?.getTime() || 0;
            }
            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [users, filter, sortConfig, searchTerm]);

    if(isUserLoading || isProfileLoading || (isAdmin && isUsersLoading)) {
        return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>
    }
    
    if (!isAdmin) return null;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Users</h1>
                <Button onClick={() => setIsAddUserDialogOpen(true)}>Add User</Button>
            </div>

            <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                <Card onClick={() => setFilter('all')} className={cn("cursor-pointer transition-all", filter === 'all' && "ring-2 ring-primary bg-primary/5")}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                        <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Total Users</CardTitle>
                        <Users className="h-4 w-4" />
                    </CardHeader>
                    <CardContent className="p-4 pt-0"><div className="text-2xl font-bold">{summary.totalUsers}</div></CardContent>
                </Card>
                <Card onClick={() => setFilter('pending')} className={cn("cursor-pointer transition-all", filter === 'pending' && "ring-2 ring-yellow-500 bg-yellow-500/5")}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                        <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Pending</CardTitle>
                        <UserPlus className="h-4 w-4" />
                    </CardHeader>
                    <CardContent className="p-4 pt-0"><div className="text-2xl font-bold">{summary.pending}</div></CardContent>
                </Card>
                <Card onClick={() => setFilter('Admin')} className={cn("cursor-pointer transition-all", filter === 'Admin' && "ring-2 ring-blue-500 bg-blue-500/5")}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                        <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Admins</CardTitle>
                        <Shield className="h-4 w-4" />
                    </CardHeader>
                    <CardContent className="p-4 pt-0"><div className="text-2xl font-bold">{summary.admins}</div></CardContent>
                </Card>
                <Card onClick={() => setFilter('Site Manager')} className={cn("cursor-pointer transition-all", filter === 'Site Manager' && "ring-2 ring-purple-500 bg-purple-500/5")}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                        <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Managers</CardTitle>
                        <UserCog className="h-4 w-4" />
                    </CardHeader>
                    <CardContent className="p-4 pt-0"><div className="text-2xl font-bold">{summary.managers}</div></CardContent>
                </Card>
                <Card onClick={() => setFilter('Site Engineer')} className={cn("cursor-pointer transition-all", filter === 'Site Engineer' && "ring-2 ring-orange-500 bg-orange-500/5")}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                        <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Engineers</CardTitle>
                        <HardHat className="h-4 w-4" />
                    </CardHeader>
                    <CardContent className="p-4 pt-0"><div className="text-2xl font-bold">{summary.engineers}</div></CardContent>
                </Card>
                <Card onClick={() => setFilter('other')} className={cn("cursor-pointer transition-all", filter === 'other' && "ring-2 ring-slate-500 bg-slate-500/5")}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                        <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Other</CardTitle>
                        <CircleHelp className="h-4 w-4" />
                    </CardHeader>
                    <CardContent className="p-4 pt-0"><div className="text-2xl font-bold">{summary.other}</div></CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Users List</CardTitle>
                        <CardDescription>Manage user accounts and approvals.</CardDescription>
                    </div>
                    <div className="relative w-64">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8" />
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead onClick={() => handleSort('username')} className="cursor-pointer">User <SortIcon column="username" /></TableHead>
                                <TableHead onClick={() => handleSort('role')} className="cursor-pointer">Role <SortIcon column="role" /></TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedAndFilteredUsers.map((u) => (
                                <TableRow key={u.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-9 w-9"><AvatarFallback>{(u.username || u.email || '?').charAt(0)}</AvatarFallback></Avatar>
                                            <div><p className="font-medium">{u.username || 'N/A'}</p><p className="text-xs text-muted-foreground">{u.email}</p></div>
                                        </div>
                                    </TableCell>
                                    <TableCell><Badge variant="outline">{u.role || 'Unassigned'}</Badge></TableCell>
                                    <TableCell><StatusBadge isPending={!!u.registrationRequest} /></TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            {u.registrationRequest ? (
                                                <>
                                                    <Button size="sm" onClick={() => handleApproveRegistration(u.id)}>Approve</Button>
                                                    <Button size="sm" variant="destructive" onClick={() => handleRejectClick(u)}>Reject</Button>
                                                </>
                                            ) : (
                                                <>
                                                    <Button variant="ghost" size="icon" onClick={() => setUserToView(u as any)}><Eye className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" onClick={() => setUserToEdit(u as any)}><Pencil className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteClick(u)}><Trash2 className="h-4 w-4" /></Button>
                                                </>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <AddUserDialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen} />
            <EditUserDialog user={userToEdit as any} open={!!userToEdit} onOpenChange={() => setUserToEdit(null)} />
            <ViewUserDialog user={userToView as any} open={!!userToView} onOpenChange={() => setUserToView(null)} />
            <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>{isRejecting ? "Reject and delete this user?" : "Permanently delete this user?"}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => userToDelete && handleConfirmDelete(userToDelete.id)} className={isRejecting ? "bg-red-600" : "bg-destructive"}>Confirm</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
