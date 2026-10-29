'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Users, Building2, User, UserCog, HardHat, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Project, UserProfile, MappingOverride } from '../types';
import { getDaysRemaining } from '../utils';

interface SiteDashboardProps {
  project: Project;
  siteTeam: UserProfile[];
  allUsers: UserProfile[] | null;
  siteOverrides: MappingOverride[] | null;
  permitsCount: number;
  dprsCount: number;
  visitsCount: number;
  tasksCount: number;
  liaisonCompletion: number;
}

export function SiteDashboard({
  project,
  siteTeam,
  allUsers,
  siteOverrides,
  permitsCount,
  dprsCount,
  visitsCount,
  tasksCount,
  liaisonCompletion
}: SiteDashboardProps) {
  
  const renderDaysBadge = (days: number | null) => {
    if (days === null) return <span className="text-muted-foreground/30 font-bold">—</span>;
    const isOverdue = days < 0;
    const isCritical = days <= 30;
    return (
      <Badge variant="outline" className={cn(
        "font-mono font-black text-[9px] h-4 px-1 rounded-sm border-none shadow-sm block w-fit",
        isOverdue ? "bg-red-500 text-white" : isCritical ? "bg-amber-500 text-white" : "bg-emerald-100 text-emerald-800"
      )}>
        {isOverdue ? `Overdue ${Math.abs(days)}d` : `${days}d Left`}
      </Badge>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <Card className="lg:col-span-2 rounded-sm border-primary/10 shadow-md overflow-hidden">
        <CardHeader className="bg-muted/5 border-b py-4 text-left">
          <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Site Personnel Hierarchy
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="px-6 font-black uppercase text-[10px] tracking-widest">Personnel</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest">Supervisor</TableHead>
                <TableHead className="text-center font-black uppercase text-[10px] tracking-widest">Sites</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {project.projectOwnerName && (
                <TableRow className="bg-primary/[0.03] hover:bg-primary/[0.05] transition-colors border-b-2">
                  <TableCell className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-background rounded-full border shadow-sm shrink-0">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="font-black text-sm text-primary uppercase">{project.projectOwnerName}</span>
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Authority Holder</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className="rounded-sm text-[9px] font-black uppercase bg-primary text-white border-none h-5 px-2">
                      Project Owner
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="rounded-sm font-mono text-[10px] bg-primary/5 border-primary/20 text-primary">—</Badge>
                  </TableCell>
                </TableRow>
              )}
              {siteTeam.length > 0 ? siteTeam.map(member => {
                const override = siteOverrides?.find(o => o.engineerId === member.id);
                const effectiveManagerId = override ? override.managerId : member.siteManagerId;
                const manager = allUsers?.find(m => m.id === effectiveManagerId);
                
                return (
                  <TableRow key={member.id} className="hover:bg-muted/5 group transition-colors">
                    <TableCell className="px-6 py-4">
                      <div className="flex flex-col text-left">
                        <span className="font-bold text-sm text-foreground">{member.username}</span>
                        <span className="text-[10px] text-muted-foreground uppercase">{member.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                        <div className="flex flex-col gap-1 text-left">
                            <Badge variant="outline" className={cn(
                                "w-fit rounded-sm text-[9px] font-black uppercase border-primary/20",
                                member.role === 'Site Manager' ? "bg-primary text-white border-none" : "text-primary bg-primary/5"
                            )}>
                                {member.role === 'Site Manager' && <UserCog className="h-2.5 w-2.5 mr-1" />}
                                {member.role}
                            </Badge>
                            <div className="flex flex-col pl-1">
                                <span className="text-[10px] font-bold text-foreground">
                                    {manager?.username || (member.role === 'Site Engineer' ? 'Unassigned' : '—')}
                                </span>
                                {override && (
                                    <Badge variant="outline" className="w-fit text-[7px] h-3 px-1 mt-0.5 border-amber-200 text-amber-700 bg-amber-50 font-black uppercase">Site Override</Badge>
                                )}
                            </div>
                        </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="rounded-sm font-mono text-[10px] bg-primary/5 border-primary/20 text-primary">
                        {member.assignedProjectIds?.length || 0}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              }) : !project.projectOwnerName && (
                <TableRow>
                  <TableCell colSpan={3} className="p-20 text-center text-muted-foreground italic text-sm">No personnel currently mapped to this site.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="rounded-sm border-primary/10 shadow-sm overflow-hidden h-fit">
          <CardHeader className="py-4 border-b bg-muted/5 text-left">
            <CardTitle className="text-xs font-bold uppercase tracking-widest">WORK STATUS AND PROJECT DATES</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6 text-left">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Work Status</Label>
                <div>
                  <Badge variant="outline" className={cn(
                    "text-[8px] font-black uppercase rounded-sm px-1.5 h-5",
                    project.workStatus === 'Completed' ? "bg-green-50 text-green-700 border-green-200" :
                    project.workStatus === 'Cancelled' ? "bg-red-50 text-red-700 border-red-200" :
                    project.workStatus === 'Yet to Start' ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                    "bg-blue-50 text-blue-700 border-blue-200"
                  )}>
                    {project.workStatus || "In Progress"}
                  </Badge>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Project Status</Label>
                <div>
                  <Badge variant="outline" className={cn(
                    "text-[8px] font-black uppercase h-5 px-1.5 border-none",
                    project.projectStatus === 'close' ? "bg-slate-900 text-white" : "bg-primary text-white"
                  )}>
                    {project.projectStatus || "open"}
                  </Badge>
                </div>
              </div>
            </div>

            <Separator className="opacity-10" />

            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest px-1">PPA Date</Label>
                <p className="text-xs font-bold font-mono">{project.ppaDate ? format(parseISO(project.ppaDate), 'dd MMM yyyy') : '—'}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest px-1">Fin. Closure</Label>
                <p className="text-xs font-bold font-mono">{project.financialClosureDate ? format(parseISO(project.financialClosureDate), 'dd MMM yyyy') : '—'}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase text-primary tracking-widest px-1">PPA SCOD</Label>
                <div className="space-y-1">
                  <p className="text-xs font-black font-mono text-primary">{project.ppaScodDate ? format(parseISO(project.ppaScodDate), 'dd MMM yyyy') : '—'}</p>
                  {renderDaysBadge(getDaysRemaining(project.ppaScodDate))}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase text-foreground tracking-widest px-1">Planned SCOD</Label>
                <div className="space-y-1">
                  <p className="text-xs font-black font-mono text-foreground">{project.plannedScodDate ? format(parseISO(project.plannedScodDate), 'dd MMM yyyy') : '—'}</p>
                  {renderDaysBadge(getDaysRemaining(project.plannedScodDate))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-sm border-primary/10 shadow-sm overflow-hidden h-fit">
          <CardHeader className="py-4 border-b bg-muted/5 text-left">
            <CardTitle className="text-xs font-bold uppercase tracking-widest">Compliance Health</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className={cn("flex items-center justify-between p-3 rounded-sm border text-emerald-600 bg-emerald-50 border-emerald-100")}>
              <span className="text-[10px] font-black uppercase tracking-wider">Liaisoning Progress</span>
              <span className="text-lg font-black">{liaisonCompletion}%</span>
            </div>
            <div className={cn("flex items-center justify-between p-3 rounded-sm border text-green-600 bg-green-50 border-green-100")}>
              <span className="text-[10px] font-black uppercase tracking-wider">Approved Permits</span>
              <span className="text-lg font-black">{permitsCount}</span>
            </div>
            <div className={cn("flex items-center justify-between p-3 rounded-sm border text-amber-600 bg-amber-50 border-amber-100")}>
              <span className="text-[10px] font-black uppercase tracking-wider">Reports Logged</span>
              <span className="text-lg font-black">{dprsCount}</span>
            </div>
            <div className={cn("flex items-center justify-between p-3 rounded-sm border text-blue-600 bg-blue-50 border-blue-100")}>
              <span className="text-[10px] font-black uppercase tracking-wider">Ongoing Visits</span>
              <span className="text-lg font-black">{visitsCount}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
