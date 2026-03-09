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
import { User, Eye, Pencil, Trash2, Users, UserPlus, Shield, UserCog, HardHat, CircleCheck, ArrowUpDown, ArrowUp, ArrowDown, Search, CircleHelp, Building2, Truck } from "lucide-react"
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { isSuperAdmin } from "@/lib/auth-constants";

type User = {
  id: string;
  username?: string;
  email?: string;
  mobile?: string;
  role?: string;
  department?: string;
  registrationRequest?: boolean;
  assignedProjectIds?: string[];
  siteManagerId?: string;
  avatarUrl?: string;
  createdAt?: any;
};

const getRoleIcon = (roleName: string) => {
    const name = roleName?.toLowerCase() || '';
    if (name.includes('admin')) return <Shield className="h-4 w-4" />;
    if (name.includes('manager')) return <UserCog className="h-4 w-4" />;
    if (name.includes('engineer')) return <HardHat className="h-4 w-4" />;
    if (name.includes('driver')) return <Truck className="h-4 w-4" />;
    return <User className="h-4 w-4" />;
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

type SortKey = 'username' | 'role' | 'registrationRequest' | 'createdAt' | 'department';

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

    const isAdmin = isSuperAdmin(currentUser?.email) || userProfile?.role === 'Admin';

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

    const rolesQuery = useMemoFirebase(() => collection(firestore, 'user_roles'), [firestore]);
    const { data: dbRoles } = useCollection<{ name: string }>(rolesQuery);

    const [filter, setFilter] = React.useState<string>('all');
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
        const counts: Record<string, number> = { total: 0, pending: 0 };
        if (!users) return counts;
        
        counts.total = users.length;
        
        const knownRoles = dbRoles?.length ? dbRoles.map(r => r.name) : ['Admin', 'Site Manager', 'Site Engineer', 'Driver'];
        
        users.forEach(u => {
            if (u.registrationRequest) {
                counts.pending++;
            } else {
                const role = u.role || 'Other';
                counts[role] = (counts[role] || 0) + 1;
            }
        });
        return counts;
    }, [users, dbRoles]);

    const sortedAndFilteredUsers = React.useMemo(() => {
        if (!users) return [];
        let result = users.filter(u => {
            const term = searchTerm.toLowerCase();
            const matchesSearch = (u.username || '').toLowerCase().includes(term) || (u.email || '').toLowerCase().includes(term);
            const matchesFilter = filter === 'all' ? true :
                                  filter === 'pending' ? u.registrationRequest === true :
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
                <h1 className="text-2xl font-bold">Personnel Directory</h1>
                <Button onClick={() => setIsAddUserDialogOpen(true)} className="rounded-sm font-bold">
                    <UserPlus className="mr-2 h-4 w-4" /> Add User
                </Button>
            </div>

            <ScrollArea className="w-full whitespace-nowrap pb-4">
                <div className="flex gap-4">
                    <Card onClick={() => setFilter('all')} className={cn("min-w-[140px] cursor-pointer transition-all hover:shadow-md", filter === 'all' && "ring-2 ring-primary bg-primary/5")}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                            <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total</CardTitle>
                            <Users className="h-4 w-4" />
                        </CardHeader>
                        <CardContent className="p-4 pt-0"><div className="text-xl font-bold">{summary.total}</div></CardContent>
                    </Card>
                    <Card onClick={() => setFilter('pending')} className={cn("min-w-[140px] cursor-pointer transition-all hover:shadow-md", filter === 'pending' && "ring-2 ring-yellow-500 bg-yellow-500/5")}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                            <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Pending</CardTitle>
                            <UserPlus className="h-4 w-4" />
                        </CardHeader>
                        <CardContent className="p-4 pt-0"><div className="text-xl font-bold">{summary.pending}</div></CardContent>
                    </Card>
                    {Object.entries(summary).map(([roleName, count]) => {
                        if (roleName === 'total' || roleName === 'pending') return null;
                        return (
                            <Card key={roleName} onClick={() => setFilter(roleName)} className={cn("min-w-[140px] cursor-pointer transition-all hover:shadow-md", filter === roleName && "ring-2 ring-primary bg-primary/5")}>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                                    <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate max-w-[80px]" title={roleName}>{roleName}</CardTitle>
                                    {getRoleIcon(roleName)}
                                </CardHeader>
                                <CardContent className="p-4 pt-0"><div className="text-xl font-bold">{count}</div></CardContent>
                            </Card>
                        );
                    })}
                </div>
            </ScrollArea>

            <Card className="rounded-sm overflow-hidden">
                <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b bg-muted/5">
                    <div>
                        <CardTitle className="text-lg">Users Management</CardTitle>
                        <CardDescription>Manage organizational accounts and access approvals.</CardDescription>
                    </div>
                    <div className="relative w-full md:w-72">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search name or email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 rounded-sm h-10" />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow>
                                <TableHead onClick={() => handleSort('username')} className="cursor-pointer hover:text-primary transition-colors">User <SortIcon column="username" /></TableHead>
                                <TableHead onClick={() => handleSort('role')} className="cursor-pointer hover:text-primary transition-colors">Role <SortIcon column="role" /></TableHead>
                                <TableHead onClick={() => handleSort('department')} className="cursor-pointer hover:text-primary transition-colors">Dept <SortIcon column="department" /></TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right px-6">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedAndFilteredUsers.length > 0 ? sortedAndFilteredUsers.map((u) => (
                                <TableRow key={u.id} className="hover:bg-muted/5 transition-colors">
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-9 w-9 border"><AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">{(u.username || u.email || '?').charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                                            <div className="flex flex-col">
                                                <p className="font-bold text-sm leading-none">{u.username || 'N/A'}</p>
                                                <p className="text-[10px] text-muted-foreground mt-1">{u.email}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="rounded-sm font-bold uppercase text-[9px] border-primary/20 text-primary">
                                            {u.role || 'Unassigned'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {u.department ? (
                                            <Badge variant="secondary" className="flex items-center gap-1 w-fit rounded-sm font-bold text-[9px] uppercase">
                                                <Building2 className="h-3 w-3" />
                                                {u.department}
                                            </Badge>
                                        ) : (
                                            <span className="text-[10px] text-muted-foreground italic font-medium">No Dept</span>
                                        )}
                                    </TableCell>
                                    <TableCell><StatusBadge isPending={!!u.registrationRequest} /></TableCell>
                                    <TableCell className="text-right px-6">
                                        <div className="flex justify-end gap-1">
                                            {u.registrationRequest ? (
                                                <>
                                                    <Button size="sm" className="h-8 rounded-sm bg-green-600 hover:bg-green-700" onClick={() => handleApproveRegistration(u.id)}>Approve</Button>
                                                    <Button size="sm" variant="destructive" className="h-8 rounded-sm" onClick={() => handleRejectClick(u)}>Reject</Button>
                                                </>
                                            ) : (
                                                <>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm" onClick={() => setUserToView(u as any)} title="View Profile"><User className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 rounded-sm" onClick={() => setUserToEdit(u as any)} title="Edit Details"><Pencil className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm" onClick={() => handleDeleteClick(u)} title="Delete Account"><Trash2 className="h-4 w-4" /></Button>
                                                </>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">No users found matching your filters.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <AddUserDialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen} />
            <EditUserDialog user={userToEdit as any} open={!!userToEdit} onOpenChange={() => setUserToEdit(null)} />
            <ViewUserDialog user={userToView as any} open={!!userToView} onOpenChange={() => setUserToView(null)} />
            
            <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
                <AlertDialogContent className="rounded-sm">
                    <AlertDialogHeader>
                    <AlertDialogTitle>{isRejecting ? "Reject Authorization" : "Confirm Deletion"}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {isRejecting 
                            ? `This will deny access and remove the registration request for ${userToDelete?.username}.` 
                            : `Are you sure you want to permanently delete ${userToDelete?.username}'s account and profile?`}
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-sm">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => userToDelete && handleConfirmDelete(userToDelete.id)} className={cn("rounded-sm", isRejecting ? "bg-red-600 hover:bg-red-700" : "bg-destructive hover:bg-destructive/90")}>
                        {isRejecting ? "Reject Request" : "Confirm Delete"}
                    </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
