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
import { 
  User, 
  Eye, 
  Pencil, 
  Trash2, 
  Users, 
  UserPlus, 
  Shield, 
  UserCog, 
  HardHat, 
  CircleCheck, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Search, 
  CircleHelp, 
  Building2, 
  Truck, 
  Calendar, 
  Fingerprint, 
  CreditCard, 
  FileDown, 
  FolderOpen,
  MoreVertical,
  Cake,
  Award,
  UserX,
  UserCheck,
  FilterX
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useCollection, useFirestore, updateDocumentNonBlocking, useMemoFirebase, deleteDocumentNonBlocking, useUser, useDoc } from "@/firebase"
import { collection, doc, query, where } from "firebase/firestore"
import { AddUserDialog } from "@/components/add-user-dialog";
import { EditUserDialog } from "@/components/edit-user-dialog";
import { useToast } from "@/hooks/use-toast";
import { ViewUserDialog } from "@/components/view-user-dialog";
import { UserDocumentsDialog } from "@/components/user-documents-dialog";
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
import { format, addDays, isWithinInterval, setYear, startOfDay } from "date-fns";
import * as XLSX from 'xlsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";

type UserType = {
  id: string;
  username?: string;
  email?: string;
  mobile?: string;
  role?: string;
  department?: string;
  dob?: string;
  doj?: string;
  aadharNumber?: string;
  panNumber?: string;
  registrationRequest?: boolean;
  assignedProjectIds?: string[];
  siteManagerId?: string;
  avatarUrl?: string;
  createdAt?: any;
  suspended?: boolean;
  documents?: any[];
};

const getRoleIcon = (roleName: string) => {
    const name = roleName?.toLowerCase() || '';
    if (name.includes('admin')) return <Shield className="h-4 w-4" />;
    if (name.includes('manager')) return <UserCog className="h-4 w-4" />;
    if (name.includes('engineer')) return <HardHat className="h-4 w-4" />;
    if (name.includes('driver')) return <Truck className="h-4 w-4" />;
    return <User className="h-4 w-4" />;
};

function StatusBadge({ user }: { user: UserType }) {
  if (user.suspended) {
    return (
      <Badge className="bg-red-100 text-red-800 hover:bg-red-100/80 border-transparent text-xs font-medium uppercase px-2">
        Suspended
      </Badge>
    );
  }
  const status = user.registrationRequest ? "Pending" : "Active";
  return (
    <Badge
      className={cn("text-xs font-medium uppercase px-2", {
        "bg-yellow-100 text-yellow-800 hover:bg-yellow-100/80 dark:bg-yellow-900/50 dark:text-yellow-300 border-transparent": status === "Pending",
        "bg-green-100 text-green-800 hover:bg-green-100/80 dark:bg-green-900/50 dark:text-green-300 border-transparent": status === "Active",
      })}
    >
      {status}
    </Badge>
  )
}

type SortKey = 'username' | 'role' | 'registrationRequest' | 'createdAt' | 'department' | 'dob' | 'doj' | 'aadharNumber' | 'panNumber';

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
    const { data: users, isLoading: isUsersLoading } = useCollection<UserType>(usersQuery);

    const [filter, setFilter] = React.useState<string>('all');
    const [searchTerm, setSearchTerm] = React.useState('');
    const [sortConfig, setSortConfig] = React.useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'createdAt', direction: 'desc' });
    const [isAddUserDialogOpen, setIsAddUserDialogOpen] = React.useState(false);
    const [userToEdit, setUserToEdit] = React.useState<UserType | null>(null);
    const [userToView, setUserToView] = React.useState<UserType | null>(null);
    const [userIdForDocs, setUserIdForDocs] = React.useState<string | null>(null);
    const [userToDelete, setUserToDelete] = React.useState<UserType | null>(null);
    const [isRejecting, setIsRejecting] = React.useState(false);
    
    // New Advanced States
    const [showSuspended, setShowSuspended] = React.useState(true);
    const [upcomingFilter, setUpcomingFilter] = React.useState<'none' | 'birthday' | 'anniversary'>('none');

    const handleApproveRegistration = (userId: string) => {
        const userRef = doc(firestore, 'users', userId);
        updateDocumentNonBlocking(userRef, { registrationRequest: false });
        toast({ title: 'User Approved', description: 'User approved.' });
    }
    
    const handleRejectClick = (u: UserType) => {
        setIsRejecting(true);
        setUserToDelete(u);
    }

    const handleDeleteClick = (u: UserType) => {
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
        if (sortConfig.key !== column) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />;
        return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4 text-primary" /> : <ArrowDown className="ml-2 h-4 w-4 text-primary" />;
    };

    const isUpcoming = (dateStr?: string) => {
        if (!dateStr) return false;
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return false;
            
            const today = startOfDay(new Date());
            const thirtyDaysFromNow = addDays(today, 30);
            
            // Check this year
            const thisYear = setYear(date, today.getFullYear());
            if (isWithinInterval(thisYear, { start: today, end: thirtyDaysFromNow })) return true;
            
            // Check next year (for cases like Dec 25 -> Jan 5)
            const nextYear = setYear(date, today.getFullYear() + 1);
            if (isWithinInterval(nextYear, { start: today, end: thirtyDaysFromNow })) return true;
        } catch (e) {
            return false;
        }
        return false;
    };

    const summary = React.useMemo(() => {
        const counts: Record<string, number> = { total: 0, pending: 0 };
        if (!users) return counts;
        
        const baseList = users.filter(u => showSuspended || !u.suspended);
        counts.total = baseList.length;
        
        baseList.forEach(u => {
            if (u.registrationRequest) {
                counts.pending++;
            } else {
                const role = u.role || 'Other';
                counts[role] = (counts[role] || 0) + 1;
            }
        });
        return counts;
    }, [users, showSuspended]);

    const sortedAndFilteredUsers = React.useMemo(() => {
        if (!users) return [];
        let result = users.filter(u => {
            const term = searchTerm.toLowerCase();
            const matchesSearch = (u.username || '').toLowerCase().includes(term) || (u.email || '').toLowerCase().includes(term);
            const matchesFilter = filter === 'all' ? true :
                                  filter === 'pending' ? u.registrationRequest === true :
                                  u.role === filter;
            
            // Suspension filter
            if (!showSuspended && u.suspended) return false;

            // Upcoming filters
            if (upcomingFilter === 'birthday') {
                if (!u.dob || !isUpcoming(u.dob)) return false;
            }
            if (upcomingFilter === 'anniversary') {
                if (!u.doj || !isUpcoming(u.doj)) return false;
            }

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
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();

            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [users, filter, sortConfig, searchTerm, showSuspended, upcomingFilter]);

    const handleExport = () => {
        if (!sortedAndFilteredUsers || sortedAndFilteredUsers.length === 0) return;
        
        const exportData = sortedAndFilteredUsers.map(u => ({
            'Name': u.username || 'N/A',
            'Email': u.email || 'N/A',
            'Mobile': u.mobile || 'N/A',
            'Role': u.role || 'Unassigned',
            'Department': u.department || 'N/A',
            'Date of Joining': u.doj ? format(new Date(u.doj), 'dd/MM/yyyy') : 'N/A',
            'Date of Birth': u.dob ? format(new Date(u.dob), 'dd/MM/yyyy') : 'N/A',
            'Aadhar Number': u.aadharNumber || 'N/A',
            'PAN Number': u.panNumber || 'N/A',
            'Status': u.suspended ? 'Suspended' : (u.registrationRequest ? 'Pending' : 'Active'),
            'Date Created': u.createdAt ? format(u.createdAt.toDate(), 'dd/MM/yyyy HH:mm') : 'N/A'
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Users");
        XLSX.writeFile(wb, `AdityaPro_UserRegistry_${format(new Date(), 'yyyyMMdd')}.xlsx`);
        toast({ title: 'Export Success', description: 'User list saved to Excel.' });
    };

    if(isUserLoading || isProfileLoading || (isAdmin && isUsersLoading)) {
        return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>
    }
    
    if (!isAdmin) return null;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Users className="h-7 w-7 text-primary" /> Personnel Directory
                  </h1>
                  {upcomingFilter !== 'none' && (
                    <Badge variant="secondary" className="w-fit bg-primary/10 text-primary border-none animate-in fade-in zoom-in-95 font-bold uppercase text-[9px]">
                      Filter Active: Upcoming {upcomingFilter}s
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="h-10 w-10 rounded-sm border-primary/20 text-primary">
                        <MoreVertical className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 rounded-sm shadow-xl">
                      <DropdownMenuLabel className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Advanced Options</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleExport} className="gap-2 cursor-pointer font-bold text-xs uppercase">
                        <FileDown className="h-4 w-4 text-primary" /> Export User List
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Special Filters</DropdownMenuLabel>
                      <DropdownMenuItem 
                        onClick={() => setUpcomingFilter(upcomingFilter === 'birthday' ? 'none' : 'birthday')} 
                        className={cn("gap-2 cursor-pointer font-bold text-xs uppercase", upcomingFilter === 'birthday' && "bg-primary/10 text-primary")}
                      >
                        <Cake className="h-4 w-4" /> Upcoming Birthdays
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => setUpcomingFilter(upcomingFilter === 'anniversary' ? 'none' : 'anniversary')} 
                        className={cn("gap-2 cursor-pointer font-bold text-xs uppercase", upcomingFilter === 'anniversary' && "bg-primary/10 text-primary")}
                      >
                        <Award className="h-4 w-4" /> Upcoming Anniversaries
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuCheckboxItem 
                        checked={showSuspended} 
                        onCheckedChange={setShowSuspended}
                        className="gap-2 cursor-pointer font-bold text-xs uppercase"
                      >
                        <div className="flex items-center gap-2">
                          {showSuspended ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                          {showSuspended ? "Hide Suspended Users" : "Show Suspended Users"}
                        </div>
                      </DropdownMenuCheckboxItem>
                      {upcomingFilter !== 'none' && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setUpcomingFilter('none')} className="gap-2 cursor-pointer font-black text-[9px] uppercase text-destructive">
                            <FilterX className="h-3 w-3" /> Reset Specialized Filters
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button onClick={() => setIsAddUserDialogOpen(true)} className="rounded-sm font-black uppercase text-[10px] h-10 px-6 shadow-md tracking-widest">
                      <UserPlus className="mr-2 h-4 w-4" /> Add User
                  </Button>
                </div>
            </div>

            <ScrollArea className="w-full whitespace-nowrap pb-4">
                <div className="flex gap-4">
                    <Card onClick={() => setFilter('all')} className={cn("min-w-[140px] cursor-pointer transition-all hover:shadow-md border-primary/10", filter === 'all' && "ring-2 ring-primary bg-primary/5")}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                            <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total</CardTitle>
                            <Users className="h-4 w-4" />
                        </CardHeader>
                        <CardContent className="p-4 pt-0"><div className="text-xl font-black">{summary.total}</div></CardContent>
                    </Card>
                    <Card onClick={() => setFilter('pending')} className={cn("min-w-[140px] cursor-pointer transition-all hover:shadow-md border-primary/10", filter === 'pending' && "ring-2 ring-yellow-500 bg-yellow-500/5")}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                            <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Pending</CardTitle>
                            <UserPlus className="h-4 w-4" />
                        </CardHeader>
                        <CardContent className="p-4 pt-0"><div className="text-xl font-black">{summary.pending}</div></CardContent>
                    </Card>
                    {Object.entries(summary).map(([roleName, count]) => {
                        if (roleName === 'total' || roleName === 'pending') return null;
                        return (
                            <Card key={roleName} onClick={() => setFilter(roleName)} className={cn("min-w-[140px] cursor-pointer transition-all hover:shadow-md border-primary/10", filter === roleName && "ring-2 ring-primary bg-primary/5")}>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                                    <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate max-w-[80px]" title={roleName}>{roleName}</CardTitle>
                                    {getRoleIcon(roleName)}
                                </CardHeader>
                                <CardContent className="p-4 pt-0"><div className="text-xl font-black">{count}</div></CardContent>
                            </Card>
                        );
                    })}
                </div>
            </ScrollArea>

            <Card className="rounded-sm overflow-hidden border-primary/10 shadow-lg">
                <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b bg-muted/5">
                    <div>
                        <CardTitle className="text-sm font-bold uppercase tracking-widest">Access Registry</CardTitle>
                        <CardDescription className="text-[10px] font-bold text-muted-foreground uppercase">Managing organizational identities.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <div className="relative w-full md:w-72">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search name or email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 rounded-sm h-10 border-primary/10 bg-background text-sm" />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow>
                                <TableHead onClick={() => handleSort('username')} className="cursor-pointer hover:text-primary transition-colors text-[10px] font-black uppercase tracking-widest">User <SortIcon column="username" /></TableHead>
                                <TableHead onClick={() => handleSort('role')} className="cursor-pointer hover:text-primary transition-colors text-[10px] font-black uppercase tracking-widest">Role <SortIcon column="role" /></TableHead>
                                <TableHead onClick={() => handleSort('department')} className="cursor-pointer hover:text-primary transition-colors text-[10px] font-black uppercase tracking-widest">Dept <SortIcon column="department" /></TableHead>
                                <TableHead onClick={() => handleSort('doj')} className="cursor-pointer hover:text-primary transition-colors text-[10px] font-black uppercase tracking-widest">DOJ <SortIcon column="doj" /></TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest">Aadhar / PAN</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest">Status</TableHead>
                                <TableHead className="text-right px-6 text-[10px] font-black uppercase tracking-widest">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedAndFilteredUsers.length > 0 ? sortedAndFilteredUsers.map((u) => (
                                <TableRow key={u.id} className={cn("hover:bg-muted/5 transition-colors group", u.suspended && "opacity-60 bg-muted/10")}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-9 w-9 border shadow-sm"><AvatarFallback className="bg-primary/5 text-primary text-xs font-black">{(u.username || u.email || '?').charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                                            <div className="flex flex-col min-w-0">
                                                <p className="font-bold text-sm leading-tight text-foreground truncate">{u.username || 'N/A'}</p>
                                                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{u.email}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="rounded-sm font-bold uppercase text-[9px] border-primary/20 text-primary bg-primary/5">
                                            {u.role || 'Unassigned'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {u.department ? (
                                            <Badge variant="secondary" className="flex items-center gap-1 w-fit rounded-sm font-bold text-[9px] uppercase border-none bg-muted text-muted-foreground">
                                                <Building2 className="h-3 w-3" />
                                                {u.department}
                                            </Badge>
                                        ) : (
                                            <span className="text-[10px] text-muted-foreground italic font-medium">No Dept</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-xs font-mono font-bold text-primary">{u.doj ? format(new Date(u.doj), 'dd/MM/yy') : '—'}</span>
                                            {u.dob && <span className="text-[9px] text-muted-foreground font-medium">DOB: {format(new Date(u.dob), 'dd/MM/yy')}</span>}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-muted-foreground">
                                                <Fingerprint className="h-3 w-3 opacity-40" /> {u.aadharNumber || '—'}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-muted-foreground uppercase">
                                                <CreditCard className="h-3 w-3 opacity-40" /> {u.panNumber || '—'}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell><StatusBadge user={u} /></TableCell>
                                    <TableCell className="text-right px-6">
                                        <div className="flex justify-end gap-1">
                                            {u.registrationRequest ? (
                                                <>
                                                    <Button size="sm" className="h-8 rounded-sm bg-green-600 hover:bg-green-700 font-bold px-4 shadow-sm" onClick={() => handleApproveRegistration(u.id)}>Approve</Button>
                                                    <Button size="sm" variant="destructive" className="h-8 rounded-sm font-bold px-4 shadow-sm" onClick={() => handleRejectClick(u)}>Reject</Button>
                                                </>
                                            ) : (
                                                <>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm hover:bg-primary/5" onClick={() => setUserIdForDocs(u.id)} title="Documents Registry"><FolderOpen className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm hover:bg-primary/5" onClick={() => setUserToView(u as any)} title="Full Audit"><User className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 rounded-sm hover:bg-muted" onClick={() => setUserToEdit(u as any)} title="Modify Profile"><Pencil className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm hover:bg-red-50" onClick={() => handleDeleteClick(u)} title="Remove Account"><Trash2 className="h-4 w-4" /></Button>
                                                </>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-48 text-center text-muted-foreground italic uppercase font-black text-[10px] opacity-20 tracking-[0.2em]">No personnel matching criteria</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <AddUserDialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen} />
            <EditUserDialog user={userToEdit as any} open={!!userToEdit} onOpenChange={() => setUserToEdit(null)} />
            <ViewUserDialog user={userToView as any} open={!!userToView} onOpenChange={() => setUserToView(null)} />
            <UserDocumentsDialog userId={userIdForDocs} open={!!userIdForDocs} onOpenChange={() => setUserIdForDocs(null)} />
            
            <AlertDialog open={!!userToDelete} onOpenChange={(o) => !o && setUserToDelete(null)}>
                <AlertDialogContent className="rounded-sm max-md">
                    <AlertDialogHeader>
                    <AlertDialogTitle className="font-black uppercase tracking-tight flex items-center gap-2">
                      <Trash2 className="h-5 w-5 text-destructive" />
                      {isRejecting ? "Deny Registration" : "Account Removal"}
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-sm font-medium leading-relaxed">
                        {isRejecting 
                            ? `Are you sure you want to deny access and remove the registration request for ${userToDelete?.username}?` 
                            : `This action will permanently purge ${userToDelete?.username}'s professional profile from the organizational registry. This cannot be undone.`}
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2 flex flex-col sm:flex-row">
                    <AlertDialogCancel className="rounded-sm font-bold uppercase text-[10px] h-11 flex-1">Keep Record</AlertDialogCancel>
                    <AlertDialogAction onClick={() => userToDelete && handleConfirmDelete(userToDelete.id)} className={cn("rounded-sm font-black uppercase text-[10px] h-11 flex-1", isRejecting ? "bg-red-600 hover:bg-red-700" : "bg-destructive hover:bg-destructive/90")}>
                        {isRejecting ? "Confirm Rejection" : "Confirm Purge"}
                    </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
