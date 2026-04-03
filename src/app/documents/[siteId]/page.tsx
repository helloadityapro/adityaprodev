
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, useFirebaseApp } from '@/firebase';
import { collection, doc, query, where, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FileIcon, Upload, Trash2, ArrowLeft, Download, ExternalLink, Loader2, FileText, ImageIcon, Film, File as GenericFileIcon, X } from 'lucide-react';
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
import { Progress } from "@/components/ui/progress";

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

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

  const siteRef = useMemoFirebase(() => doc(firestore, 'sites', siteId), [firestore, siteId]);
  const { data: site, isLoading: siteLoading } = useDoc<Site>(siteRef);

  const docsQuery = useMemoFirebase(() => 
    query(collection(firestore, 'site_documents'), where('siteId', '==', siteId)), 
    [firestore, siteId]
  );
  const { data: siteDocs, isLoading: docsLoading } = useCollection<SiteDocument>(docsQuery);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user || !site || !userProfile) return;

    setIsUploading(true);
    const storage = getStorage(firebaseApp);
    const siteManagerId = userProfile.siteManagerId || (userProfile.role === 'Site Manager' ? user.uid : null);

    // Array.from to iterate through multiple files if selected
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
            storagePath: storagePath
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
    e.target.value = ''; // Reset input
  };

  const confirmDelete = async () => {
    if (!docToDelete) return;

    try {
      const storage = getStorage(firebaseApp);
      const storageRef = ref(storage, docToDelete.storagePath);
      await deleteObject(storageRef);
      await deleteDocumentNonBlocking(doc(firestore, 'site_documents', docToDelete.id));
      toast({ title: 'Deleted', description: 'Document removed from site folder.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Delete Failed', description: e.message });
    } finally {
      setDocToDelete(null);
    }
  };

  if (siteLoading || docsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!site) return <div className="p-8 text-center">Site not found.</div>;

  const uploadEntries = Object.entries(activeUploads);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" className="w-fit mb-2 -ml-2" onClick={() => router.push('/documents')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Explorer
        </Button>
        <h1 className="flex items-center gap-2">
          <FileIcon className="h-8 w-8 text-primary" /> {site.name} Documents
        </h1>
        <p className="text-muted-foreground">Shared files and documentation for this project site.</p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex justify-end gap-2">
          <div className="relative">
            <Input 
              type="file" 
              multiple
              className="hidden" 
              id="file-upload" 
              onChange={handleUpload}
              disabled={isUploading}
            />
            <Button asChild disabled={isUploading} className="rounded-sm font-bold h-11 px-6 shadow-md">
              <label htmlFor="file-upload" className="cursor-pointer">
                {isUploading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Batch Uploading...</>
                ) : (
                  <><Upload className="mr-2 h-4 w-4" /> Upload Document(s)</>
                )}
              </label>
            </Button>
          </div>
        </div>

        {uploadEntries.length > 0 && (
          <Card className="border-primary/20 bg-primary/5 animate-in slide-in-from-top-2 duration-300">
            <CardHeader className="py-3 px-4 border-b border-primary/10">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" /> Real-time Transfer Queue
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {uploadEntries.map(([name, progress]) => (
                <div key={name} className="space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-tight">
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

      <Card className="rounded-sm overflow-hidden border-primary/10 shadow-lg">
        <CardHeader className="bg-muted/5 border-b py-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold uppercase tracking-widest">Site Repository</CardTitle>
              <CardDescription className="text-xs uppercase font-black text-muted-foreground mt-1">Files / {site.name}</CardDescription>
            </div>
            <Badge variant="outline" className="rounded-sm font-black uppercase text-[10px] bg-primary/5 border-primary/20 text-primary h-6">
              {siteDocs?.length || 0} Artifacts
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {siteDocs && siteDocs.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="px-6 min-w-[300px]">File Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Personnel</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right px-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {siteDocs.sort((a, b) => {
                    const dateA = a.createdAt?.toDate?.()?.getTime() || 0;
                    const dateB = b.createdAt?.toDate?.()?.getTime() || 0;
                    return dateB - dateA;
                  }).map((doc) => (
                    <TableRow key={doc.id} className="hover:bg-muted/5 group transition-colors">
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-muted rounded-sm text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                            {getFileIcon(doc.fileType)}
                          </div>
                          <span className="font-bold text-sm truncate max-w-[250px]" title={doc.fileName}>{doc.fileName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[9px] font-black uppercase rounded-sm bg-muted border-none">
                          {doc.fileType.split('/')[1] || 'FILE'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[10px] font-mono font-bold text-muted-foreground">{formatSize(doc.fileSize)}</TableCell>
                      <TableCell className="text-xs font-bold text-foreground">
                        <div className="flex items-center gap-1.5">
                          <UserProfileIcon className="h-3 w-3 opacity-40" />
                          {doc.uploadedByName}
                        </div>
                      </TableCell>
                      <TableCell className="text-[10px] font-bold text-muted-foreground uppercase whitespace-nowrap">
                        {doc.createdAt ? format(doc.createdAt.toDate(), 'dd MMM yyyy') : '—'}
                      </TableCell>
                      <TableCell className="text-right px-6">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-sm text-primary" asChild title="Open">
                            <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm" onClick={() => setDocToDelete(doc)} title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-32 text-center bg-muted/5 italic text-muted-foreground">
              <GenericFileIcon className="h-16 w-16 opacity-10 mb-4" />
              <p className="text-sm font-bold uppercase tracking-widest opacity-40">No documents found in this site folder.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!docToDelete} onOpenChange={(o) => !o && setDocToDelete(null)}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black uppercase tracking-tight">Remove Document?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs font-medium leading-relaxed">
              Permanently remove <strong>{docToDelete?.fileName}</strong> from the organizational repository? This action cannot be reversed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-sm font-bold uppercase text-[10px]">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-sm font-black uppercase text-[10px] shadow-lg">
              Confirm Deletion
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UserProfileIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
