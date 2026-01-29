"use client";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { MoreHorizontal, FileCheck, Clock, FileX, ArrowUpRight, List as ListIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, where } from "firebase/firestore";

type Permit = {
  id: string;
  siteId: string;
  ptwTypeId: string;
  descriptionOfWork: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Corrected';
  siteEngineerId: string;
  supervisorId?: string;
  adminId?: string;
  requestDate: any; // Should be a timestamp
};

function StatusBadge({ status }: { status: Permit["status"] }) {
    const statusConfig = {
        Pending: { icon: Clock, className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100/80 dark:bg-yellow-900/50 dark:text-yellow-300 border-transparent' },
        Approved: { icon: FileCheck, className: 'bg-green-100 text-green-800 hover:bg-green-100/80 dark:bg-green-900/50 dark:text-green-300 border-transparent' },
        Rejected: { icon: FileX, className: 'bg-red-100 text-red-800 hover:bg-red-100/80 dark:bg-red-900/50 dark:text-red-300 border-transparent' },
        Corrected: { icon: ArrowUpRight, className: 'bg-blue-100 text-blue-800 hover:bg-blue-100/80 dark:bg-blue-900/50 dark:text-blue-300 border-transparent' },
    };

    const config = statusConfig[status];
    if (!config) return null;
    const Icon = config.icon;

    return (
        <Badge
          className={cn("flex items-center gap-1.5 text-xs font-medium", config.className)}
        >
            <Icon className="h-3 w-3" />
            {status}
        </Badge>
    );
}

function UserDisplay({ userId }: { userId: string }) {
  const firestore = useFirestore();
  const userRef = useMemoFirebase(() => userId ? doc(firestore, 'users', userId) : null, [firestore, userId]);
  const { data: user, isLoading } = useDoc(userRef);

  if (isLoading) return <span>...</span>;
  return <span>{user?.username || 'Unknown'}</span>;
}

function SiteDisplay({ siteId }: { siteId: string }) {
  const firestore = useFirestore();
  const siteRef = useMemoFirebase(() => siteId ? doc(firestore, 'sites', siteId) : null, [firestore, siteId]);
  const { data: site, isLoading } = useDoc(siteRef);

  if (isLoading) return <span>...</span>;
  return <span>{site?.name || 'Unknown Site'}</span>;
}

function PtwTypeDisplay({ ptwTypeId }: { ptwTypeId: string }) {
  const firestore = useFirestore();
  const ptwTypeRef = useMemoFirebase(() => ptwTypeId ? doc(firestore, 'permit_to_work_types', ptwTypeId) : null, [firestore, ptwTypeId]);
  const { data: ptwType, isLoading } = useDoc(ptwTypeRef);

  if (isLoading) return <span>...</span>;
  return <span>{ptwType?.name || 'Unknown Type'}</span>;
}


function PermitListTable({ permits, onAction, userRole }: { permits: Permit[]; onAction: (permitId: string, status: Permit['status']) => void; userRole: string }) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Permit ID</TableHead>
            <TableHead>Site</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="hidden md:table-cell">Requested By</TableHead>
            <TableHead className="hidden sm:table-cell">Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {permits.map((permit) => (
            <TableRow key={permit.id}>
              <TableCell className="font-medium">{permit.id.substring(0,7)}...</TableCell>
              <TableCell><SiteDisplay siteId={permit.siteId} /></TableCell>
              <TableCell><PtwTypeDisplay ptwTypeId={permit.ptwTypeId} /></TableCell>
              <TableCell className="hidden md:table-cell"><UserDisplay userId={permit.siteEngineerId} /></TableCell>
              <TableCell className="hidden sm:table-cell">{permit.requestDate ? new Date(permit.requestDate?.toDate()).toLocaleDateString() : 'N/A'}</TableCell>
              <TableCell>
                <StatusBadge status={permit.status} />
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button aria-haspopup="true" size="icon" variant="ghost">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Toggle menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem>View Details</DropdownMenuItem>
                    {(userRole === 'Admin' || userRole === 'Supervisor') && permit.status === 'Pending' && (
                        <>
                            <DropdownMenuItem onClick={() => onAction(permit.id, 'Approved')}>Approve</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onAction(permit.id, 'Rejected')} className="text-destructive focus:text-destructive focus:bg-destructive/10">Reject</DropdownMenuItem>
                        </>
                    )}
                    {userRole === 'SiteEngineer' && permit.status === 'Rejected' && (
                        <DropdownMenuItem>Correct & Resubmit</DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
}

export default function PtwListPage() {
  const firestore = useFirestore();
  const { user } = useUser();

  const userProfileRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userProfile } = useDoc(userProfileRef);
  const userRole = userProfile?.role;
  
  const permitsQuery = useMemoFirebase(() => {
    if (!userRole) return null;
    const baseQuery = collection(firestore, 'permits_to_work');
    if (userRole === 'SiteEngineer') {
      return query(baseQuery, where('siteEngineerId', '==', user?.uid));
    }
    return baseQuery;
  }, [firestore, userRole, user]);

  const { data: permits, isLoading } = useCollection<Permit>(permitsQuery);

  const handlePermitAction = (permitId: string, status: Permit['status']) => {
    const permitRef = doc(firestore, "permits_to_work", permitId);
    let updateData: any = { status };
    if (userRole === 'Supervisor') {
        updateData.supervisorId = user?.uid;
    }
    if (userRole === 'Admin') {
        updateData.adminId = user?.uid;
    }
    updateDocumentNonBlocking(permitRef, updateData);
  };

  const summary = {
    total: permits?.length || 0,
    pending: permits?.filter(p => p.status === 'Pending').length || 0,
    approved: permits?.filter(p => p.status === 'Approved').length || 0,
    rejected: permits?.filter(p => p.status === 'Rejected').length || 0,
  };

  if (isLoading || !userProfile) {
    return <p>Loading permits...</p>
  }
  
  const allPermits = permits || [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center">
        <h1 className="text-lg font-headline font-semibold md:text-2xl">Permits to Work</h1>
      </div>

      {(userRole === 'Admin' || userRole === 'Supervisor') && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Permits</CardTitle>
                    <ListIcon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{summary.total}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Approved</CardTitle>
                    <FileCheck className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{summary.approved}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Pending</CardTitle>
                    <Clock className="h-4 w-4 text-yellow-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{summary.pending}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Rejected</CardTitle>
                    <FileX className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{summary.rejected}</div>
                </CardContent>
            </Card>
        </div>
      )}

      <Tabs defaultValue="all">
        <TabsList className="grid w-full grid-cols-4 sm:w-auto sm:inline-flex">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>
        <Card className="mt-4">
            <TabsContent value="all" className="m-0">
                <PermitListTable permits={allPermits} onAction={handlePermitAction} userRole={userRole || ''} />
            </TabsContent>
            <TabsContent value="pending" className="m-0">
                <PermitListTable permits={allPermits.filter(p => p.status === 'Pending')} onAction={handlePermitAction} userRole={userRole || ''} />
            </TabsContent>
            <TabsContent value="approved" className="m-0">
                <PermitListTable permits={allPermits.filter(p => p.status === 'Approved')} onAction={handlePermitAction} userRole={userRole || ''} />
            </TabsContent>
            <TabsContent value="rejected" className="m-0">
                <PermitListTable permits={allPermits.filter(p => p.status === 'Rejected')} onAction={handlePermitAction} userRole={userRole || ''} />
            </TabsContent>
        </Card>
      </Tabs>
    </div>
  )
}
