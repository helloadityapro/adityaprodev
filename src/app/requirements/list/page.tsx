
"use client";

import * as React from "react";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { collection, doc, query, where, orderBy, or } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ClipboardList, Search } from "lucide-react";
import { isSuperAdmin } from "@/lib/auth-constants";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function RequirementListPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [searchTerm, setSearchTerm] = React.useState("");

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';
  const isManager = userProfile?.role === 'Site Manager';

  const requirementsQuery = useMemoFirebase(() => {
    if (!user || !userProfile) return null;
    const colRef = collection(firestore, 'requirements');
    if (isAdmin) return query(colRef, orderBy('createdAt', 'desc'));
    
    if (isManager) {
        return query(
            colRef, 
            or(where('userId', '==', user.uid), where('siteManagerId', '==', user.uid)),
            orderBy('createdAt', 'desc')
        );
    }
    
    return query(colRef, where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
  }, [firestore, user, userProfile, isAdmin, isManager]);

  const { data: requirements, isLoading: reqsLoading } = useCollection(requirementsQuery);

  const filteredReqs = React.useMemo(() => {
    if (!requirements) return [];
    return requirements.filter(req => 
      req.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (req.userName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [requirements, searchTerm]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
            <ClipboardList className="h-8 w-8" /> Requirement Data
          </h1>
          <p className="text-muted-foreground">Monitor and track site material requests.</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search requirements..." 
            className="pl-9 rounded-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card className="shadow-md border-primary/10 rounded-sm overflow-hidden">
        <CardHeader>
          <CardTitle>Pending & Past Requests</CardTitle>
          <CardDescription>Status tracking for all submitted site requirements.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {reqsLoading ? (
            <div className="p-6 space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filteredReqs && filteredReqs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Date</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Requirement</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReqs.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                        {req.createdAt ? format(req.createdAt.toDate(), 'dd MMM yyyy') : '—'}
                    </TableCell>
                    <TableCell className="font-semibold">{req.siteName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{req.userName || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-md truncate">
                        {req.description}
                    </TableCell>
                    <TableCell>
                        <Badge variant={req.status === 'Fulfilled' ? 'default' : 'secondary'} className="rounded-sm text-[10px] font-bold uppercase">
                            {req.status || 'Pending'}
                        </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-24 text-muted-foreground italic bg-muted/5">
              {searchTerm ? "No results found matching your search." : "No requirements found matching your criteria."}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
