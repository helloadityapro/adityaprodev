'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { collection, doc, query, where, orderBy, or } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  FileText, 
  ShieldCheck, 
  Users, 
  CheckSquare, 
  ArrowLeftRight, 
  Navigation, 
  MapPin, 
  ArrowLeft,
  Calendar,
  Clock,
  User,
  HardHat,
  Building2,
  Zap,
  Activity,
  FolderOpen
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';

type Site = {
  id: string;
  name: string;
  projectCompany: string;
  acCapacity: number;
  dcCapacity: number;
};

type UserProfile = {
  id: string;
  username: string;
  email: string;
  role: string;
  assignedProjectIds?: string[];
};

const formatTimestamp = (ts: any) => {
  if (!ts) return '—';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return format(date, 'dd MMM yyyy');
};

const formatCapacity = (val: any) => {
  const num = typeof val === 'number' ? val : parseFloat(String(val || 0));
  return isNaN(num) ? "0.000" : num.toFixed(3);
};

export default function SiteActivitiesPage() {
  const { siteId } = useParams() as { siteId: string };
  const firestore = useFirestore();
  const router = useRouter();

  // 1. Fetch Site Details
  const siteRef = useMemoFirebase(() => doc(firestore, 'sites', siteId), [firestore, siteId]);
  const { data: site, isLoading: siteLoading } = useDoc<Site>(siteRef);

  // 2. Fetch Team (Users assigned to this site)
  const teamQuery = useMemoFirebase(() => 
    query(collection(firestore, 'users'), where('assignedProjectIds', 'array-contains', siteId)),
    [firestore, siteId]
  );
  const { data: team, isLoading: teamLoading } = useCollection<UserProfile>(teamQuery);

  // 3. Fetch Site Specific Data (using site name for most entities as per current schema)
  const siteName = site?.name || "";

  const ptwQuery = useMemoFirebase(() => 
    siteName ? query(collection(firestore, 'permits_to_work'), where('siteName', '==', siteName)) : null,
    [firestore, siteName]
  );
  const { data: permits } = useCollection(ptwQuery);

  const dprQuery = useMemoFirebase(() => 
    siteName ? query(collection(firestore, 'dprs'), where('siteName', '==', siteName)) : null,
    [firestore, siteName]
  );
  const { data: dprs } = useCollection(dprQuery);

  const taskQuery = useMemoFirebase(() => 
    siteName ? query(collection(firestore, 'tasks'), where('siteName', '==', siteName)) : null,
    [firestore, siteName]
  );
  const { data: tasks } = useCollection(taskQuery);

  const movementQuery = useMemoFirebase(() => 
    siteName ? query(collection(firestore, 'material_movements'), where('siteName', '==', siteName)) : null,
    [firestore, siteName]
  );
  const { data: movements } = useCollection(movementQuery);

  const visitQuery = useMemoFirebase(() => 
    query(collection(firestore, 'site_visits'), where('siteId', '==', siteId)),
    [firestore, siteId]
  );
  const { data: visits } = useCollection(visitQuery);

  if (siteLoading) return (
    <div className="space-y-8 p-6">
      <Skeleton className="h-12 w-1/3" />
      <div className="grid grid-cols-4 gap-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
      <Skeleton className="h-[500px] w-full" />
    </div>
  );

  if (!site) return <div className="p-20 text-center">Site not found.</div>;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="mb-2 -ml-2 text-muted-foreground" asChild>
            <Link href="/documents"><ArrowLeft className="mr-2 h-4 w-4" /> Explorer</Link>
          </Button>
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-sm">
              <MapPin className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-foreground uppercase leading-none">{site.name}</h1>
              <p className="text-muted-foreground font-bold flex items-center gap-2 mt-1">
                <Building2 className="h-4 w-4 text-primary" /> {site.projectCompany}
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild className="rounded-sm font-bold border-primary/20 text-primary">
            <Link href={`/documents/${siteId}`}>
              <FolderOpen className="mr-2 h-4 w-4" /> View Documents
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-sm border-primary/10 shadow-sm bg-primary/5">
          <CardContent className="pt-6">
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">AC Capacity</p>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-black text-primary">{formatCapacity(site.acCapacity)}</span>
              <span className="text-[10px] font-bold text-muted-foreground mb-1 uppercase">MW</span>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-sm border-amber-500/10 shadow-sm bg-amber-500/5">
          <CardContent className="pt-6">
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">DC Capacity</p>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-black text-amber-700">{formatCapacity(site.dcCapacity)}</span>
              <span className="text-[10px] font-bold text-muted-foreground mb-1 uppercase">MWp</span>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-sm border-primary/10 shadow-sm">
          <CardContent className="pt-6">
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Personnel Assigned</p>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-black text-foreground">{team?.length || 0}</span>
              <Users className="h-4 w-4 text-primary mb-1.5" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-sm border-primary/10 shadow-sm">
          <CardContent className="pt-6">
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Total Activities</p>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-black text-foreground">
                {(permits?.length || 0) + (dprs?.length || 0) + (tasks?.length || 0) + (movements?.length || 0)}
              </span>
              <Activity className="h-4 w-4 text-primary mb-1.5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 mb-8 rounded-sm bg-muted/50 border border-primary/10 p-1">
          <TabsTrigger value="overview" className="rounded-sm font-bold text-[10px] uppercase">Overview</TabsTrigger>
          <TabsTrigger value="ptw" className="rounded-sm font-bold text-[10px] uppercase">Permits</TabsTrigger>
          <TabsTrigger value="dpr" className="rounded-sm font-bold text-[10px] uppercase">DPRs</TabsTrigger>
          <TabsTrigger value="tasks" className="rounded-sm font-bold text-[10px] uppercase">Tasks</TabsTrigger>
          <TabsTrigger value="logistics" className="rounded-sm font-bold text-[10px] uppercase">Logistics</TabsTrigger>
          <TabsTrigger value="visits" className="rounded-sm font-bold text-[10px] uppercase">Visits</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-8 animate-in fade-in-50 duration-300">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2 rounded-sm border-primary/10 shadow-md overflow-hidden">
              <CardHeader className="bg-muted/5 border-b">
                <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" /> Active Site Team
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {teamLoading ? (
                  <div className="p-8 space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
                ) : team && team.length > 0 ? (
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="px-6">Personnel</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Contact</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {team.map(member => (
                        <TableRow key={member.id} className="hover:bg-muted/5">
                          <TableCell className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-sm">{member.username}</span>
                              <span className="text-[10px] text-muted-foreground uppercase">{member.email}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="rounded-sm text-[9px] font-black uppercase border-primary/20 text-primary">
                              {member.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-medium font-mono">{member.mobile || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="p-20 text-center text-muted-foreground italic text-sm">No personnel currently assigned to this site.</div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="rounded-sm border-primary/10 shadow-sm">
                <CardHeader className="py-4 border-b bg-muted/5">
                  <CardTitle className="text-xs font-bold uppercase tracking-widest">Site Statistics</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <StatRow label="Approved Permits" value={permits?.filter((p: any) => p.status === 'Approved').length || 0} color="green" />
                  <StatRow label="Pending Permits" value={permits?.filter((p: any) => p.status === 'Pending').length || 0} color="amber" />
                  <StatRow label="Ongoing Tasks" value={tasks?.filter((t: any) => t.status !== 'Completed').length || 0} color="blue" />
                  <StatRow label="Total DPRs" value={dprs?.length || 0} color="primary" />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="ptw" className="animate-in fade-in-50 duration-300">
          <Card className="rounded-sm overflow-hidden border-primary/10 shadow-md">
            <CardHeader className="bg-muted/5 border-b py-4">
              <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" /> Permit to Work Audit
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {permits && permits.length > 0 ? (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="px-6">Serial No</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Requested By</TableHead>
                      <TableHead className="text-right px-6">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {permits.sort((a: any, b: any) => (b.requestDate?.toDate?.() || 0) - (a.requestDate?.toDate?.() || 0)).map((permit: any) => (
                      <TableRow key={permit.id} className="hover:bg-muted/5 group">
                        <TableCell className="px-6 py-4 font-mono text-xs font-bold text-primary">{permit.serialNumber || permit.id.slice(0, 8)}</TableCell>
                        <TableCell className="text-sm font-semibold">{permit.ptwType}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[9px] font-black uppercase rounded-sm">
                            {permit.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-medium">{permit.siteEngineerName || '—'}</TableCell>
                        <TableCell className="text-right px-6">
                          <Button variant="ghost" size="sm" asChild className="h-8 rounded-sm text-primary">
                            <Link href={`/ptw/list?view=${permit.id}`}>Details</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-20 text-center text-muted-foreground italic">No permits raised for this site.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dpr" className="animate-in fade-in-50 duration-300">
          <Card className="rounded-sm overflow-hidden border-primary/10 shadow-md">
            <CardHeader className="bg-muted/5 border-b py-4">
              <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> Daily Progress Reports
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {dprs && dprs.length > 0 ? (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="px-6">Date</TableHead>
                      <TableHead>Engineer</TableHead>
                      <TableHead className="max-w-[400px]">Update Summary</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dprs.sort((a: any, b: any) => new Date(b.reportDate).getTime() - new Date(a.reportDate).getTime()).map((dpr: any) => (
                      <TableRow key={dpr.id} className="hover:bg-muted/5">
                        <TableCell className="px-6 py-4 font-mono text-xs font-bold whitespace-nowrap">{dpr.reportDate}</TableCell>
                        <TableCell className="text-xs font-semibold">{dpr.userName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground italic line-clamp-2 py-4">"{dpr.description}"</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-20 text-center text-muted-foreground italic">No DPRs submitted for this site.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="animate-in fade-in-50 duration-300">
          <Card className="rounded-sm overflow-hidden border-primary/10 shadow-md">
            <CardHeader className="bg-muted/5 border-b py-4">
              <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-primary" /> Task Assignments
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {tasks && tasks.length > 0 ? (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="px-6">Title</TableHead>
                      <TableHead>Assignee</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right px-6">Due Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).map((task: any) => (
                      <TableRow key={task.id} className="hover:bg-muted/5">
                        <TableCell className="px-6 py-4 font-bold text-sm">{task.title}</TableCell>
                        <TableCell className="text-xs">{task.assignedToName}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(
                            "text-[9px] font-bold uppercase rounded-sm",
                            task.priority === 'High' ? "border-red-200 text-red-700 bg-red-50" :
                            task.priority === 'Medium' ? "border-amber-200 text-amber-700 bg-amber-50" :
                            "border-blue-200 text-blue-700 bg-blue-50"
                          )}>
                            {task.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[9px] font-black uppercase rounded-sm">{task.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right px-6 text-xs font-mono font-bold text-muted-foreground">{task.dueDate}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-20 text-center text-muted-foreground italic">No tasks assigned for this site.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logistics" className="animate-in fade-in-50 duration-300">
          <Card className="rounded-sm overflow-hidden border-primary/10 shadow-md">
            <CardHeader className="bg-muted/5 border-b py-4">
              <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4 text-primary" /> Material Movement Logs
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {movements && movements.length > 0 ? (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="px-6">Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead className="text-right px-6">Source/Dest</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.sort((a: any, b: any) => new Date(b.movementDate).getTime() - new Date(a.movementDate).getTime()).map((mov: any) => (
                      <TableRow key={mov.id} className="hover:bg-muted/5">
                        <TableCell className="px-6 py-4 font-mono text-xs font-bold whitespace-nowrap">{mov.movementDate}</TableCell>
                        <TableCell>
                          <Badge className={cn(
                            "text-[9px] font-black uppercase rounded-sm",
                            mov.movementType === 'Inward' ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"
                          )}>
                            {mov.movementType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm font-semibold">{mov.itemName}</TableCell>
                        <TableCell className="text-xs font-bold text-primary">{mov.quantity} {mov.unit}</TableCell>
                        <TableCell className="text-right px-6 text-[10px] font-bold text-muted-foreground uppercase">{mov.sourceOrDestination}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-20 text-center text-muted-foreground italic">No material logs recorded.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="visits" className="animate-in fade-in-50 duration-300">
          <Card className="rounded-sm overflow-hidden border-primary/10 shadow-md">
            <CardHeader className="bg-muted/5 border-b py-4">
              <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                <Navigation className="h-4 w-4 text-primary" /> Manager Visit Audit
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {visits && visits.length > 0 ? (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="px-6">Visit Start</TableHead>
                      <TableHead>Manager</TableHead>
                      <TableHead>Purpose</TableHead>
                      <TableHead className="text-right px-6">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visits.sort((a: any, b: any) => (b.startTime?.toDate?.() || 0) - (a.startTime?.toDate?.() || 0)).map((visit: any) => (
                      <TableRow key={visit.id} className="hover:bg-muted/5 group">
                        <TableCell className="px-6 py-4 font-mono text-xs font-bold">{formatTimestamp(visit.startTime)}</TableCell>
                        <TableCell className="text-sm font-semibold">{visit.managerName}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[9px] font-black uppercase rounded-sm">{visit.purpose || '—'}</Badge>
                        </TableCell>
                        <TableCell className="text-right px-6">
                          <Button variant="ghost" size="sm" asChild className="h-8 rounded-sm text-primary">
                            <Link href={`/site-visits/${visit.id}`}>View Audit</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-20 text-center text-muted-foreground italic">No visit logs recorded for this site.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatRow({ label, value, color }: { label: string, value: number, color: string }) {
  const colors = {
    green: "text-green-600 bg-green-50 border-green-100",
    amber: "text-amber-600 bg-amber-50 border-amber-100",
    blue: "text-blue-600 bg-blue-50 border-blue-100",
    primary: "text-primary bg-primary/5 border-primary/10",
  };
  
  return (
    <div className={cn("flex items-center justify-between p-3 rounded-sm border", (colors as any)[color])}>
      <span className="text-[10px] font-black uppercase tracking-wider">{label}</span>
      <span className="text-lg font-black">{value}</span>
    </div>
  );
}
