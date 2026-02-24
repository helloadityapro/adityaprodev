"use client";

import * as React from "react";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { collection, doc, query, where, orderBy, or } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { FileText, Search } from "lucide-react";
import { isSuperAdmin } from "@/lib/auth-constants";
import { Input } from "@/components/ui/input";

export default function DPRListPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [searchTerm, setSearchTerm] = React.useState("");

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';
  const isManager = userProfile?.role === 'Site Manager';

  const dprsQuery = useMemoFirebase(() => {
    if (!user || !userProfile) return null;
    const colRef = collection(firestore, 'dprs');
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

  const { data: dprs, isLoading: dprsLoading } = useCollection(dprsQuery);

  const filteredDprs = React.useMemo(() => {
    if (!dprs) return [];
    return dprs.filter(dpr => 
      dpr.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (dpr.userName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      dpr.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [dprs, searchTerm]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
            <FileText className="h-8 w-8" /> DPR Data
          </h1>
          <p className="text-muted-foreground">Track and review submitted progress reports.</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search reports..." 
            className="pl-9 rounded-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card className="shadow-md border-primary/10 rounded-sm overflow-hidden">
        <CardHeader>
          <CardTitle>Historical Updates</CardTitle>
          <CardDescription>Comprehensive list of daily site activities.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {dprsLoading ? (
            <div className="p-6 space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filteredDprs && filteredDprs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Date</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Update</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDprs.map((dpr) => (
                  <TableRow key={dpr.id}>
                    <TableCell className="font-medium whitespace-nowrap">{format(new Date(dpr.reportDate), 'dd MMM yyyy')}</TableCell>
                    <TableCell className="font-semibold">{dpr.siteName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{dpr.userName || '—'}</TableCell>
                    <TableCell className="text-sm italic text-muted-foreground max-w-md">"{dpr.description}"</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-24 text-muted-foreground italic bg-muted/5">
              {searchTerm ? "No results found matching your search." : "No reports found matching your criteria."}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
