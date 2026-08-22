'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { 
  FileText, 
  Upload, 
  Trash2, 
  Eye, 
  Download, 
  Loader2, 
  X, 
  CheckCircle2, 
  FileImage, 
  File as FileIcon, 
  RefreshCw,
  Plus
} from 'lucide-react';
import { useFirestore, useFirebaseApp, updateDocumentNonBlocking, useDoc, useMemoFirebase } from '@/firebase';
import { doc, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';

interface UserDocument {
  name: string;
  url: string;
  type: string;
  size: number;
  storagePath: string;
  uploadedAt: string;
}

interface UserDocumentsDialogProps {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserDocumentsDialog({ userId, open, onOpenChange }: UserDocumentsDialogProps) {
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() => userId ? doc(firestore, 'users', userId) : null, [firestore, userId]);
  const { data: user, isLoading: isUserLoading } = useDoc<any>(userProfileRef);

  const [docName, setNewDocName] = React.useState("");
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [viewingDoc, setViewingDoc] = React.useState<UserDocument | null>(null);

  const handleUpload = async () => {
    if (!user || !selectedFile || !docName.trim()) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const storage = getStorage(firebaseApp);
      const timestamp = Date.now();
      const storagePath = `user_documents/${user.id}/${timestamp}_${selectedFile.name.replace(/\s+/g, '_')}`;
      const storageRef = ref(storage, storagePath);
      
      const uploadTask = uploadBytesResumable(storageRef, selectedFile);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          toast({ variant: 'destructive', title: 'Upload Failed', description: error.message });
          setIsUploading(false);
        },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          const newDoc: UserDocument = {
            name: docName.trim(),
            url,
            type: selectedFile.type,
            size: selectedFile.size,
            storagePath,
            uploadedAt: new Date().toISOString()
          };

          const userRef = doc(firestore, 'users', user.id);
          updateDocumentNonBlocking(userRef, {
            documents: arrayUnion(newDoc),
            updatedAt: serverTimestamp()
          });

          toast({ title: 'Document Added', description: `${docName} saved to profile.` });
          resetForm();
        }
      );
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
      setIsUploading(false);
    }
  };

  const handleDelete = async (docToDelete: UserDocument) => {
    if (!user) return;
    try {
      const storage = getStorage(firebaseApp);
      const storageRef = ref(storage, docToDelete.storagePath);
      
      await deleteObject(storageRef).catch(e => console.warn("Storage deletion failed or file already missing", e));
      
      const userRef = doc(firestore, 'users', user.id);
      updateDocumentNonBlocking(userRef, {
        documents: arrayRemove(docToDelete),
        updatedAt: serverTimestamp()
      });

      toast({ title: 'Document Removed' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Delete Failed', description: e.message });
    }
  };

  const resetForm = () => {
    setNewDocName("");
    setSelectedFile(null);
    setIsUploading(false);
    setUploadProgress(0);
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const isImage = (type: string) => type.startsWith('image/');
  const isPdf = (type: string) => type.includes('pdf');

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px] rounded-sm h-[90vh] max-h-[90vh] flex flex-col p-0 border-none shadow-2xl overflow-hidden">
          <DialogHeader className="p-6 bg-primary/5 border-b shrink-0 text-left">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2.5 rounded-sm"><FileText className="h-5 w-5 text-primary" /></div>
              <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight leading-none">User Documents</DialogTitle>
                <DialogDescription className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                  Profile Repository : {isUserLoading ? 'Loading...' : user?.username}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            {isUserLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
              </div>
            ) : (
              <ScrollArea className="flex-1">
                <div className="p-6 space-y-10">
                  <section className="space-y-4">
                    <div className="flex items-center gap-2 border-b pb-2">
                      <Plus className="h-4 w-4 text-primary" />
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-foreground">Add New Credential</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-muted/20 p-4 rounded-sm border-2 border-dashed border-primary/10">
                      <div className="md:col-span-4 space-y-2">
                        <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest px-1">Document Label</Label>
                        <Input 
                          placeholder="e.g. Aadhaar Card, DL..." 
                          value={docName} 
                          onChange={e => setNewDocName(e.target.value)}
                          className="h-10 text-xs font-bold rounded-sm bg-background"
                          disabled={isUploading}
                        />
                      </div>
                      <div className="md:col-span-5 space-y-2">
                        <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest px-1">Select File (PDF/Image)</Label>
                        <div className="relative group">
                          <Input 
                            type="file" 
                            accept="image/*,application/pdf"
                            onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                            className="h-10 text-[10px] rounded-sm bg-background py-2 cursor-pointer border-dashed border-primary/20"
                            disabled={isUploading}
                          />
                          {selectedFile && !isUploading && (
                            <Button variant="ghost" size="icon" className="absolute right-1 top-1 h-8 w-8 text-destructive" onClick={() => setSelectedFile(null)}>
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="md:col-span-3">
                        <Button 
                          onClick={handleUpload} 
                          disabled={isUploading || !selectedFile || !docName.trim()}
                          className="w-full h-10 rounded-sm font-black uppercase text-[10px] tracking-widest shadow-md"
                        >
                          {isUploading ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {Math.round(uploadProgress)}%</>
                          ) : (
                            <><Upload className="mr-2 h-4 w-4" /> Upload</>
                          )}
                        </Button>
                      </div>
                    </div>
                    {isUploading && <Progress value={uploadProgress} className="h-1 rounded-none bg-primary/10" />}
                  </section>

                  <section className="space-y-4">
                    <div className="flex items-center justify-between border-b pb-2">
                      <div className="flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 text-primary" />
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-foreground">Stored Documents</h3>
                      </div>
                      <Badge variant="secondary" className="rounded-full h-5 px-2 text-[9px] font-black bg-primary/5 text-primary border-none">
                        {user?.documents?.length || 0} Artifacts
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {user?.documents && user.documents.length > 0 ? user.documents.map((doc, idx) => (
                        <Card key={idx} className="rounded-sm border-primary/5 bg-muted/[0.01] hover:bg-primary/[0.02] transition-all group shadow-sm">
                          <CardContent className="p-4 space-y-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="p-2.5 bg-background rounded-sm border shadow-sm text-primary shrink-0">
                                  {isPdf(doc.type) ? <FileText className="h-5 w-5" /> : <FileImage className="h-5 w-5" />}
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-sm font-black truncate text-foreground leading-tight uppercase tracking-tight">{doc.name}</span>
                                  <span className="text-[9px] font-mono font-bold text-muted-foreground uppercase">{formatSize(doc.size)} • {doc.type.split('/')[1] || 'FILE'}</span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="pt-2 border-t border-primary/5 flex items-center justify-between">
                              <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest">
                                Added {format(new Date(doc.uploadedAt), 'dd MMM yyyy')}
                              </span>
                              <div className="flex gap-1.5">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm bg-background border shadow-sm" onClick={() => setViewingDoc(doc)} title="View Document">
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-sm bg-background border shadow-sm" asChild title="Download">
                                  <a href={doc.url} download={doc.name} target="_blank" rel="noopener noreferrer">
                                    <Download className="h-4 w-4" />
                                  </a>
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm bg-background border shadow-sm" onClick={() => handleDelete(doc)} title="Remove Document">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )) : (
                        <div className="col-span-full py-20 text-center border-2 border-dashed rounded-sm opacity-20">
                          <FileIcon className="h-12 w-12 mx-auto mb-3" />
                          <p className="text-[10px] font-black uppercase tracking-widest">No documentation found</p>
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              </ScrollArea>
            )}
          </div>

          <DialogFooter className="p-4 bg-muted/5 border-t shrink-0">
            <DialogClose asChild><Button variant="outline" className="w-full rounded-sm font-black uppercase text-[10px] h-11 tracking-widest">Close Registry</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingDoc} onOpenChange={(o) => !o && setViewingDoc(null)}>
        <DialogContent className="max-w-[95vw] h-[90vh] p-0 border-none bg-black flex flex-col items-center justify-center rounded-sm overflow-hidden shadow-2xl z-[70]">
          <DialogHeader className="absolute top-0 left-0 right-0 z-[80] p-4 bg-gradient-to-b from-black/80 to-transparent flex flex-row items-center justify-between pointer-events-none">
            <div className="flex items-center gap-3">
              <div className="bg-white/10 p-2 rounded-sm pointer-events-auto"><FileIcon className="h-5 w-5 text-white" /></div>
              <div className="flex flex-col pointer-events-auto">
                <DialogTitle className="text-white text-lg font-black uppercase tracking-tight">{viewingDoc?.name}</DialogTitle>
                <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">{viewingDoc?.type}</span>
              </div>
            </div>
            <DialogClose asChild className="pointer-events-auto"><Button variant="ghost" size="icon" className="h-10 w-10 text-white hover:bg-red-600 transition-colors"><X className="h-6 w-6" /></Button></DialogClose>
          </DialogHeader>

          <div className="w-full h-full flex items-center justify-center p-4 pt-20">
            {viewingDoc && (
              isPdf(viewingDoc.type) ? (
                <iframe src={viewingDoc.url} className="w-full h-full border-none bg-white rounded-sm shadow-2xl" />
              ) : isImage(viewingDoc.type) ? (
                <img src={viewingDoc.url} className="max-w-full max-h-full object-contain shadow-2xl" alt={viewingDoc.name} />
              ) : (
                <div className="p-20 text-center space-y-6">
                  <Progress value={100} className="h-1 w-32 mx-auto mb-4" />
                  <div className="space-y-2">
                    <p className="text-white font-black uppercase tracking-widest">Preview Unavailable</p>
                    <p className="text-white/40 text-xs">This file type must be downloaded to be viewed.</p>
                  </div>
                  <Button asChild className="rounded-sm font-black uppercase h-12 px-10 shadow-lg"><a href={viewingDoc.url} download={viewingDoc.name}>Download Original</a></Button>
                </div>
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
