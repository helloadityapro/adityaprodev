'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, useFirebaseApp } from '@/firebase';
import { collection, doc, query, where, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FileIcon, Upload, Trash2, ArrowLeft, Download, ExternalLink, Loader2, FileText, ImageIcon, Film, File as GenericFileIcon } from 'lucide-react';
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

export default function SiteDocumentsPage() {
  const params = useParams();
  const siteId = params.siteId as string;
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
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
    const file = e.target.files?.[0];
    if (!file || !user || !site || !userProfile) return;

    setIsUploading(true);
    const storage = getStorage(firebaseApp);
    const timestamp = Date.now();
    // Use explicit path separators to avoid permission errors
    const storagePath = `site_documents/${siteId}/${timestamp}-${file.name.replace(/\s+/g, '_')}`;
    const storageRef = ref(storage, storagePath);
    
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed', 
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      }, 
      (error) => {
        console.error(error);
        toast({ variant: 'destructive', title: 'Upload Failed', description: error.message });
        setIsUploading(false);
      }, 
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        
        // Tag the document with the manager's context for shared team folder access
        const siteManagerId = userProfile.siteManagerId || (userProfile.role === 'Site Manager' ? user.uid : null);

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

        toast({ title: 'Success', description: 'File uploaded to site folder.' });
        setIsUploading(false);
        setUploadProgress(0);
        e.target.value = ''; // Reset input
      }
    );
  };

  const confirmDelete = async () => {
    if (!docToDelete) return;

    try {
      // 1. Delete from Storage
      const storage = getStorage(firebaseApp);
      const storageRef = ref(storage, docToDelete.storagePath);
      await deleteObject(storageRef);

      // 2. Delete from Firestore
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

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" className="w-fit mb-2 -ml-2" onClick={() => router.push('/documents')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Explorer
        </Button>
        <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
          <FileIcon className="h-8 w-8" /> {site.name} Documents
        </h1>
        <p className="text-muted-foreground">Shared files and documentation for this project site.</p>
      </div>

      <div className="flex justify-end gap-2">
        <div className="relative">
          <Input 
            type="file" 
            className="hidden" 
            id="file-upload" 
            onChange={handleUpload}
            disabled={isUploading}
          />
          <Button asChild disabled={isUploading} className="rounded-sm font-bold">
            <label htmlFor="file-upload" className="cursor-pointer">
              {isUploading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {Math.round(uploadProgress)}%</>
              ) : (
                <><Upload className="mr-2 h-4 w-4" /> Upload Document</>
              )}
            </label>
          </Button>
        </div>
      </div>

      <Card className="rounded-sm overflow-hidden">
        <CardHeader className="bg-muted/5 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Site Repository</CardTitle>
              <CardDescription>Documents / {site.name}</CardDescription>
            </div>
            <Badge variant="outline" className="rounded-sm font-bold bg-primary/5 border-primary/20 text-primary">
              {siteDocs?.length || 0} Files
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {siteDocs && siteDocs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[400px]">File Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Uploaded By</TableHead>
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
                  <TableRow key={doc.id} className="hover:bg-muted/5 group">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-muted rounded-sm">
                          {getFileIcon(doc.fileType)}
                        </div>
                        <span className="truncate max-w-[300px]" title={doc.fileName}>{doc.fileName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px] font-bold uppercase py-0 px-1.5 rounded-sm">
                        {doc.fileType.split('/')[1] || 'FILE'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatSize(doc.fileSize)}</TableCell>
                    <TableCell className="text-xs font-semibold">{doc.uploadedByName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {doc.createdAt ? format(doc.createdAt.toDate(), 'dd MMM yyyy') : '—'}
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-sm" asChild title="Open">
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
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center bg-muted/5 italic text-muted-foreground">
              <GenericFileIcon className="h-12 w-12 opacity-20 mb-4" />
              <p>No documents uploaded to this folder yet.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!docToDelete} onOpenChange={(o) => !o && setDocToDelete(null)}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{docToDelete?.fileName}</strong> from the site folder and storage. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
