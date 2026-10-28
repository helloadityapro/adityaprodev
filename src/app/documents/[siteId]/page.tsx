'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, useFirebaseApp } from '@/firebase';
import { collection, doc, query, where, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FileIcon, Upload, Trash2, ArrowLeft, Download, ExternalLink, Loader2, FileText, ImageIcon, Film, File as GenericFileIcon, X, Folder, FolderPlus, ChevronRight, Home, MoreVertical, ShieldCheck, PlugZap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from '@/lib/utils';

type LiaisoningDocument = {
  url: string;
  name: string;
  storagePath: string;
  uploadedAt: string;
};

type StageData = {
  status: string;
  remarks: string;
  documents: LiaisoningDocument[];
};

type LiaisoningRecord = {
  id: string;
  siteId: string;
  siteName: string;
  stages: Record<string, StageData>;
};

type SiteDocument = {
  id: string;
  siteId: string;
  siteName: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedById: string;
  uploadedByName: string;
  siteManagerId: string | null;
  createdAt: any;
  storagePath: string;
  parentFolderId?: string | null;
};

type SiteFolder = {
  id: string;
  siteId: string;
  name: string;
  parentFolderId: string | null;
  createdById: string;
  createdAt: any;
};

type Site = {
  id: string;
  name: string;
};

type UserProfile = {
  id: string;
  username: string;
  role: string;
  siteManagerId?: string;
};

const LIAISONING_STAGES = [
  { id: 'loa', label: '1. LOA' },
  { id: 'ppa', label: '2. PPA' },
  { id: 'spv_docs', label: '3. SPV or Company Documents' },
  { id: 'land_acquisition', label: '4. Land Acquisition' },
  { id: 'grid_connectivity', label: '5. Grid Connectivity' },
  { id: 'estimate_approval', label: '6. Estimate Approval' },
  { id: 'estimate_sanction', label: '7. Estimate Sanction' },
  { id: 'supervision_testing', label: '8. Supervision & Testing' },
  { id: 'material_inspection', label: '9. Material Inspection' },
  { id: 'work_progress', label: '10. Work Progress' },
  { id: 'wcr', label: '11. WCR Submission' },
  { id: 'pre_commissioning', label: '12. Pre-Commissioning' },
  { id: 'format_ii_approval', label: '13. Format II Approval' },
  { id: 'ptc', label: '14. PTC Issuance' },
  { id: 'clearance', label: '15. Clearance Certificate' },
  { id: 'commissioning', label: '16. Final Commissioning' },
  { id: 'commissioning_certificate', label: '17. Commissioning Certificate' }
];

const getFileIcon = (type: string) => {
  if (type.startsWith('image/')) return <ImageIcon className="h-4 w-4" />;
  if (type.startsWith('video/')) return <Film className="h-4 w-4" />;
  if (type.includes('pdf')) return <FileText className="h-4 w-4 text-red-500" />;
  return <GenericFileIcon className="h-4 w-4" />;
};

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function SiteDocumentsPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = React.use(params);
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [isUploading, setIsUploading] = React.useState(false);
  const [activeUploads, setActiveUploads] = React.useState<Record<string, number>>({});
  const [docToDelete, setDocToDelete] = React.useState<SiteDocument | null>(null);
  
  // Folder System States
  const [currentFolderId, setCurrentFolderId] = React.useState<string | null>(null);
  const [isFolderDialogOpen, setIsFolderDialogOpen] = React.useState(false);
  const [newFolderName, setNewFolderName] = React.useState("");
  const [folderToDelete, setFolderToDelete] = React.useState<SiteFolder | null>(null);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

  const siteRef = useMemoFirebase(() => doc(firestore, 'sites', siteId), [firestore, siteId]);
  const { data: site, isLoading: siteLoading } = useDoc<Site>(siteRef);

  const docsQuery = useMemoFirebase(() => 
    query(collection(firestore, 'site_documents'), where('siteId', '==', siteId)), 
    [firestore, siteId]
  );
  const { data: allDocs, isLoading: docsLoading } = useCollection<SiteDocument>(docsQuery);

  const foldersQuery = useMemoFirebase(() => 
    query(collection(firestore, 'site_folders'), where('siteId', '==', siteId)), 
    [firestore, siteId]
  );
  const { data: allFolders, isLoading: foldersLoading } = useCollection<SiteFolder>(foldersQuery);

  const liaisonRef = useMemoFirebase(() => doc(firestore, 'liaisoning_records', siteId), [firestore, siteId]);
  const { data: liaisonRecord, isLoading: liaisonLoading } = useDoc<LiaisoningRecord>(liaisonRef);

  const isLiaisonRoot = currentFolderId === 'liaison_root';
  const isLiaisonStage = currentFolderId?.startsWith('liaison_stage_');

  const displayedDocs = React.useMemo(() => {
    if (isLiaisonRoot) return [];
    if (isLiaisonStage) {
      const stageId = currentFolderId?.replace('liaison_stage_', '');
      const stageDocs = liaisonRecord?.stages?.[stageId || '']?.documents || [];
      return stageDocs.map(d => ({
        id: d.url,
        fileName: d.name,
        fileUrl: d.url,
        fileType: d.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
        fileSize: 0,
        uploadedByName: 'Workflow Sync',
        createdAt: { toDate: () => new Date(d.uploadedAt) },
        isVirtual: true,
        storagePath: d.storagePath
      }));
    }
    if (!allDocs) return [];
    return allDocs.filter(d => (d.parentFolderId || null) === currentFolderId);
  }, [allDocs, currentFolderId, isLiaisonRoot, isLiaisonStage, liaisonRecord]);

  const displayedFolders = React.useMemo(() => {
    // If we are at root, add the virtual "Liaisoning Portfolio" folder
    if (currentFolderId === null) {
      const list = allFolders ? allFolders.filter(f => f.parentFolderId === null) : [];
      return [
        { id: 'liaison_root', name: 'Liaisoning Documents', isVirtual: true },
        ...list
      ];
    }
    
    // If we are inside the liaison root, show the stages
    if (isLiaisonRoot) {
      return LIAISONING_STAGES.map(s => ({
        id: `liaison_stage_${s.id}`,
        name: s.label,
        isVirtual: true,
        isStage: true
      }));
    }

    if (!allFolders) return [];
    return allFolders.filter(f => (f.parentFolderId || null) === currentFolderId);
  }, [allFolders, currentFolderId, isLiaisonRoot]);

  const breadcrumbs = React.useMemo(() => {
    const path = [];
    let cur = currentFolderId;

    if (isLiaisonRoot) {
      path.unshift({ id: 'liaison_root', name: 'Liaisoning Documents' });
      return path;
    }

    if (isLiaisonStage) {
      const stageId = currentFolderId?.replace('liaison_stage_', '');
      const stage = LIAISONING_STAGES.find(s => s.id === stageId);
      path.unshift({ id: currentFolderId!, name: stage?.label || 'Stage' });
      path.unshift({ id: 'liaison_root', name: 'Liaisoning Documents' });
      return path;
    }

    while (cur) {
      const folder = allFolders?.find(f => f.id === cur);
      if (folder) {
        path.unshift(folder);
        cur = folder.parentFolderId;
      } else {
        break;
      }
    }
    return path;
  }, [allFolders, currentFolderId, isLiaisonRoot, isLiaisonStage]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !user || !site) return;
    try {
      await addDocumentNonBlocking(collection(firestore, 'site_folders'), {
        siteId,
        name: newFolderName.trim(),
        parentFolderId: currentFolderId,
        createdById: user.uid,
        createdAt: serverTimestamp()
      });
      setNewFolderName("");
      setIsFolderDialogOpen(false);
      toast({ title: 'Folder Created' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user || !site || !userProfile) return;

    setIsUploading(true);
    const storage = getStorage(firebaseApp);
    const siteManagerId = userProfile.siteManagerId || (userProfile.role === 'Site Manager' ? user.uid : null);

    for (const file of Array.from(files)) {
      const timestamp = Date.now();
      const storagePath = `site_documents/${siteId}/${timestamp}-${file.name.replace(/\s+/g, '_')}`;
      const storageRef = ref(storage, storagePath);
      
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setActiveUploads(prev => ({ ...prev, [file.name]: progress }));
        }, 
        (error) => {
          console.error(error);
          toast({ variant: 'destructive', title: `Upload Failed: ${file.name}`, description: error.message });
          setActiveUploads(prev => {
            const next = { ...prev };
            delete next[file.name];
            return next;
          });
        }, 
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          
          await addDocumentNonBlocking(collection(firestore, 'site_documents'), {
            siteId,
            siteName: site.name,
            fileName: file.name,
            fileUrl: url,
            fileType: file.type,
            fileSize: file.size,
            uploadedById: user.uid,
            uploadedByName: userProfile.username || user.email || 'User',
            siteManagerId: siteManagerId,
            createdAt: serverTimestamp(),
            storagePath: storagePath,
            parentFolderId: currentFolderId
          });

          setActiveUploads(prev => {
            const next = { ...prev };
            delete next[file.name];
            if (Object.keys(next).length === 0) setIsUploading(false);
            return next;
          });
        }
      );
    }
    e.target.value = '';
  };

  const confirmDeleteDoc = async () => {
    if (!docToDelete) return;
    try {
      const storage = getStorage(firebaseApp);
      await deleteObject(ref(storage, docToDelete.storagePath)).catch(e => console.warn("Storage deletion failed or file already missing", e));
      await deleteDocumentNonBlocking(doc(firestore, 'site_documents', docToDelete.id));
      toast({ title: 'Deleted' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Delete Failed', description: e.message });
    } finally {
      setDocToDelete(null);
    }
  };

  const confirmDeleteFolder = async () => {
    if (!folderToDelete) return;
    try {
      await deleteDocumentNonBlocking(doc(firestore, 'site_folders', folderToDelete.id));
      toast({ title: 'Folder Removed' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setFolderToDelete(null);
    }
  };

  if (siteLoading || docsLoading || foldersLoading || liaisonLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!site) return <div className="p-8 text-center">Site not found.</div>;

  const uploadEntries = Object.entries(activeUploads);
  const isReadOnlyArea = isLiaisonRoot || isLiaisonStage;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" className="w-fit mb-2 -ml-2" onClick={() => router.push('/documents')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Explorer
        </Button>
        <h1 className="flex items-center gap-2">
          <FileIcon className="h-8 w-8 text-primary" /> {site.name} Documents
        </h1>
        <p className="text-muted-foreground">Shared files and organization for this project site.</p>
      </div>

      <div className="flex flex-col gap-4">
        {!isReadOnlyArea && (
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              className="rounded-sm font-bold h-11 px-6 shadow-sm border-primary/20 text-primary hover:bg-primary/5"
              onClick={() => setIsFolderDialogOpen(true)}
            >
              <FolderPlus className="mr-2 h-4 w-4" /> New folder
            </Button>
            <div className="relative">
              <input type="file" multiple className="hidden" id="file-upload" onChange={handleUpload} disabled={isUploading} />
              <Button asChild disabled={isUploading} className="rounded-sm font-bold h-11 px-6 shadow-md">
                <label htmlFor="file-upload" className="cursor-pointer">
                  {isUploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</> : <><Upload className="mr-2 h-4 w-4" /> Upload Document(s)</>}
                </label>
              </Button>
            </div>
          </div>
        )}

        {isReadOnlyArea && (
          <div className="flex justify-end">
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 py-2 px-4 rounded-sm font-black uppercase text-[10px] tracking-widest">
              <ShieldCheck className="h-3.5 w-3.5 mr-2" /> Liaisoning Documents
            </Badge>
          </div>
        )}

        {uploadEntries.length > 0 && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 space-y-4">
              {uploadEntries.map(([name, progress]) => (
                <div key={name} className="space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase">
                    <span className="truncate max-w-[250px]">{name}</span>
                    <span className="text-primary">{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-1.5 rounded-none" />
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 bg-muted/20 p-2 rounded-sm w-fit border border-primary/5">
        <button 
          onClick={() => setCurrentFolderId(null)}
          className={cn("flex items-center gap-1 hover:text-primary transition-colors", !currentFolderId && "text-primary")}
        >
          <Home className="h-3 w-3" />
          ROOT
        </button>
        {breadcrumbs.map((folder) => (
          <React.Fragment key={folder.id}>
            <ChevronRight className="h-3 w-3 opacity-30" />
            <button 
              onClick={() => setCurrentFolderId(folder.id)}
              className={cn("hover:text-primary transition-colors", currentFolderId === folder.id && "text-primary")}
            >
              {folder.name}
            </button>
          </React.Fragment>
        ))}
      </div>

      <Card className="rounded-sm overflow-hidden border-primary/10 shadow-lg">
        <CardHeader className="bg-muted/5 border-b py-4">
          <CardTitle className="text-sm font-bold uppercase tracking-widest">Repository Contents</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="px-6 min-w-[300px]">Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Personnel</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right px-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Render Folders First */}
                {displayedFolders.map((folder: any) => (
                  <TableRow key={folder.id} className="hover:bg-primary/[0.02] group transition-colors cursor-pointer" onClick={() => setCurrentFolderId(folder.id)}>
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-2 rounded-sm transition-colors",
                          folder.isVirtual ? "bg-emerald-500/10 text-emerald-600" : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white"
                        )}>
                          {folder.isVirtual ? <PlugZap className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
                        </div>
                        <span className="font-bold text-sm truncate max-w-[250px]">{folder.name}</span>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="secondary" className={cn("text-[9px] font-black uppercase rounded-sm border-none", folder.isVirtual ? "bg-emerald-100 text-emerald-800" : "bg-muted")}>{folder.isVirtual ? 'SYNC FOLDER' : 'FOLDER'}</Badge></TableCell>
                    <TableCell className="text-[10px] font-mono font-bold text-muted-foreground">—</TableCell>
                    <TableCell className="text-xs font-bold text-foreground">—</TableCell>
                    <TableCell className="text-[10px] font-bold text-muted-foreground uppercase">
                      {folder.createdAt ? format(folder.createdAt.toDate(), 'dd MMM yyyy') : '—'}
                    </TableCell>
                    <TableCell className="text-right px-6" onClick={e => e.stopPropagation()}>
                      {!folder.isVirtual && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm" onClick={() => setFolderToDelete(folder)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}

                {/* Render Documents */}
                {displayedDocs.map((doc: any) => (
                  <TableRow key={doc.id} className="hover:bg-muted/5 group transition-colors">
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-muted rounded-sm text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                          {getFileIcon(doc.fileType)}
                        </div>
                        <span className="font-bold text-sm truncate max-w-[250px]" title={doc.fileName}>{doc.fileName}</span>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="secondary" className={cn("text-[9px] font-black uppercase rounded-sm border-none", doc.isVirtual ? "bg-primary/5 text-primary" : "bg-muted")}>{doc.fileType.split('/')[1]?.toUpperCase() || 'FILE'}</Badge></TableCell>
                    <TableCell className="text-[10px] font-mono font-bold text-muted-foreground">{doc.fileSize ? formatSize(doc.fileSize) : '—'}</TableCell>
                    <TableCell className="text-xs font-bold text-foreground">{doc.uploadedByName}</TableCell>
                    <TableCell className="text-[10px] font-bold text-muted-foreground uppercase">
                      {doc.createdAt ? format(doc.createdAt.toDate(), 'dd MMM yyyy') : '—'}
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-sm text-primary" asChild>
                          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                        </Button>
                        {!doc.isVirtual && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm" onClick={() => setDocToDelete(doc)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

                {displayedDocs.length === 0 && displayedFolders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic uppercase font-black text-[10px] opacity-20">Empty Directory</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* New Folder Dialog */}
      <Dialog open={isFolderDialogOpen} onOpenChange={setIsFolderDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-sm border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tight">Create New Folder</DialogTitle>
            <DialogDescription className="text-xs">Organize your site documents into a new directory.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Label className="text-[10px] font-black uppercase text-muted-foreground px-1">Folder Name</Label>
            <Input 
              placeholder="Enter name..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="rounded-sm h-11"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            />
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild><Button variant="outline" className="rounded-sm font-bold uppercase text-[10px]">Cancel</Button></DialogClose>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()} className="rounded-sm font-black uppercase text-[10px] shadow-lg">Create Folder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Doc Alert */}
      <AlertDialog open={!!docToDelete} onOpenChange={(o) => !o && setDocToDelete(null)}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black uppercase tracking-tight">Remove Document?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium leading-relaxed text-muted-foreground">Permanently remove this file from the repository? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm font-bold uppercase text-[10px]">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteDoc} className="bg-destructive text-white rounded-sm font-black uppercase text-[10px]">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Folder Alert */}
      <AlertDialog open={!!folderToDelete} onOpenChange={(o) => !o && setFolderToDelete(null)}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black uppercase tracking-tight">Remove Folder?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium leading-relaxed text-muted-foreground">Deleting a folder will not delete the documents inside, but they will return to the root directory. Confirm removal of <strong>{folderToDelete?.name}</strong>?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm font-bold uppercase text-[10px]">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteFolder} className="bg-destructive text-white rounded-sm font-black uppercase text-[10px]">Delete Folder</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}