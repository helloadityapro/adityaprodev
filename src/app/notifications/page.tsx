'use client';

import * as React from 'react';
import { 
  useFirestore, 
  useUser, 
  useDoc, 
  useMemoFirebase, 
  updateDocumentNonBlocking, 
  deleteDocumentNonBlocking 
} from '@/firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  doc, 
  writeBatch,
  getDocs,
  startAfter,
  Timestamp,
  addDoc
} from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Bell, 
  CheckCheck, 
  Trash2, 
  Inbox, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ArrowRight,
  Loader2,
  ListFilter,
  History,
  FilterX,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

type Notification = {
  id: string;
  title: string;
  description: string;
  link: string;
  read: boolean;
  createdAt: any;
};

const PAGE_SIZE = 15;

export default function NotificationsHistoryPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [filter, setFilter] = React.useState<'all' | 'unread'>('all');
  const [isLoading, setIsLoading] = React.useState(true);
  const [isMoreLoading, setIsMoreLoading] = React.useState(false);
  const [lastDoc, setLastDoc] = React.useState<any>(null);
  const [isMoreAvailable, setIsMoreAvailable] = React.useState(true);
  const [isMigrating, setIsMigrating] = React.useState(false);
  
  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect(() => setIsMounted(true), []);

  const fetchNotifications = React.useCallback(async (isInitial = true, currentFilter = filter) => {
    if (!user) return;
    if (isInitial) setIsLoading(true);
    else setIsMoreLoading(true);

    try {
      const colRef = collection(firestore, 'users', user.uid, 'notifications');
      let q = query(colRef, orderBy('createdAt', 'desc'), limit(PAGE_SIZE));

      if (currentFilter === 'unread') {
        q = query(colRef, where('read', '==', false), orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
      }

      if (!isInitial && lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      const snap = await getDocs(q);
      const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification));
      
      if (isInitial) {
        setNotifications(results);
      } else {
        setNotifications(prev => [...prev, ...results]);
      }

      setLastDoc(snap.docs[snap.docs.length - 1]);
      setIsMoreAvailable(snap.docs.length === PAGE_SIZE);
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Fetch Error', description: 'Could not load notifications.' });
    } finally {
      setIsLoading(false);
      setIsMoreLoading(false);
    }
  }, [user, firestore, filter, toast, lastDoc]);

  // Handle one-time migration from global collection
  const migrateLegacyNotifications = React.useCallback(async () => {
    if (!user || isMigrating) return;
    setIsMigrating(true);
    try {
      const legacyQ = query(collection(firestore, 'notifications'), where('userId', '==', user.uid), limit(50));
      const legacySnap = await getDocs(legacyQ);
      
      if (!legacySnap.empty) {
        console.log(`Migrating ${legacySnap.size} legacy notifications for user ${user.uid}`);
        const batch = writeBatch(firestore);
        
        legacySnap.docs.forEach(d => {
          const data = d.data();
          const targetRef = doc(collection(firestore, 'users', user.uid, 'notifications'));
          batch.set(targetRef, {
            ...data,
            migratedFromLegacy: true
          });
          batch.delete(d.ref); // Remove from global after copying
        });

        await batch.commit();
        toast({ title: 'Inbox Synchronized', description: 'Previous notifications have been moved to your personal repository.' });
        fetchNotifications(true);
      }
    } catch (e) {
      console.error("Migration failed:", e);
    } finally {
      setIsMigrating(false);
    }
  }, [user, firestore, isMigrating, toast, fetchNotifications]);

  React.useEffect(() => {
    fetchNotifications(true);
    migrateLegacyNotifications();
  }, [user, filter]); // Re-fetch on filter change or user change

  const handleMarkAsRead = (notif: Notification) => {
    if (notif.read || !user) return;
    updateDocumentNonBlocking(doc(firestore, 'users', user.uid, 'notifications', notif.id), { read: true });
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
    if (notif.link) router.push(notif.link);
  };

  const handleMarkAllRead = async () => {
    if (!user || notifications.length === 0) return;
    const batch = writeBatch(firestore);
    notifications.filter(n => !n.read).forEach(n => {
      batch.update(doc(firestore, 'users', user.uid, 'notifications', n.id), { read: true });
    });
    await batch.commit();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    toast({ title: 'Success', description: 'All alerts marked as read.' });
  };

  const handleDeleteAllRead = async () => {
    if (!user) return;
    const batch = writeBatch(firestore);
    const readNotifs = notifications.filter(n => n.read);
    readNotifs.forEach(n => {
      batch.delete(doc(firestore, 'users', user.uid, 'notifications', n.id));
    });
    await batch.commit();
    setNotifications(prev => prev.filter(n => !n.read));
    toast({ title: 'Cleanup Complete', description: 'Read records purged from repository.' });
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto p-4 md:p-8">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-20 p-4 md:p-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-sm">
              <Bell className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight">Notification Hub</h1>
          </div>
          <p className="text-muted-foreground text-sm font-medium">Personal audit trail of your organizational alerts and updates.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleMarkAllRead} 
            disabled={unreadCount === 0}
            className="h-10 rounded-sm font-bold border-primary/20 text-primary hover:bg-primary/5"
          >
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark All Read
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleDeleteAllRead} 
            className="h-10 rounded-sm font-bold text-destructive hover:bg-destructive/5"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Read
          </Button>
        </div>
      </div>

      <Card className="rounded-sm shadow-xl border-primary/10 overflow-hidden">
        <CardHeader className="bg-muted/5 border-b py-4 flex flex-row items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-muted p-1 rounded-sm border">
               <button 
                onClick={() => setFilter('all')}
                className={cn(
                  "px-4 py-1.5 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all",
                  filter === 'all' ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
               >
                 All Logs
               </button>
               <button 
                onClick={() => setFilter('unread')}
                className={cn(
                  "px-4 py-1.5 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all relative",
                  filter === 'unread' ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
               >
                 Unread
                 {unreadCount > 0 && <span className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full border border-background" />}
               </button>
            </div>
          </div>
          <Badge variant="outline" className="rounded-sm font-black text-[10px] uppercase bg-primary/5 text-primary border-primary/10 h-6">
            {notifications.length}{isMoreAvailable ? '+' : ''} Records
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          {notifications.length > 0 ? (
            <div className="divide-y divide-border/40">
              {notifications.map((notif) => (
                <div 
                  key={notif.id} 
                  className={cn(
                    "p-6 flex flex-col sm:flex-row sm:items-start gap-4 transition-all hover:bg-primary/[0.01]",
                    !notif.read && "bg-primary/[0.02]"
                  )}
                >
                  <div className={cn(
                    "p-3 rounded-sm shrink-0 shadow-sm",
                    notif.title.toLowerCase().includes('approved') ? "bg-green-50 text-green-600" :
                    notif.title.toLowerCase().includes('rejected') ? "bg-red-50 text-red-600" :
                    "bg-muted text-primary"
                  )}>
                    {notif.title.toLowerCase().includes('approved') ? <CheckCircle2 className="h-5 w-5" /> :
                     notif.title.toLowerCase().includes('rejected') ? <XCircle className="h-5 w-5" /> :
                     <Inbox className="h-5 w-5" />}
                  </div>
                  
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-4">
                      <h4 className={cn("text-sm uppercase tracking-tight", notif.read ? "font-bold text-muted-foreground" : "font-black text-foreground")}>
                        {notif.title}
                      </h4>
                      <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-muted-foreground/40 shrink-0">
                        <Clock className="h-3 w-3" />
                        {isMounted && notif.createdAt ? formatDistanceToNow(notif.createdAt.toDate(), { addSuffix: true }) : '—'}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {notif.description}
                    </p>
                    <div className="flex items-center gap-4 pt-3">
                      {notif.link && (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 rounded-sm text-primary font-black uppercase text-[10px] tracking-widest px-4 bg-primary/5 hover:bg-primary/10"
                          onClick={() => handleMarkAsRead(notif)}
                        >
                          Review Entry <ArrowRight className="ml-1.5 h-3 w-3" />
                        </Button>
                      )}
                      {!notif.read && (
                        <button 
                          onClick={() => handleMarkAsRead(notif)}
                          className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 hover:text-primary transition-colors"
                        >
                          Mark as seen
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {isMoreAvailable && (
                <div className="p-6 bg-muted/10 flex justify-center">
                  <Button 
                    variant="outline" 
                    onClick={() => fetchNotifications(false)} 
                    disabled={isMoreLoading}
                    className="h-11 rounded-sm font-black uppercase text-[10px] tracking-widest px-10 border-primary/20 text-primary"
                  >
                    {isMoreLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading History</> : "Load More Notifications"}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="py-32 flex flex-col items-center justify-center text-center gap-4">
              <div className="p-6 bg-muted/50 rounded-full border-2 border-dashed">
                <Inbox className="h-12 w-12 text-muted-foreground/20" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Inbox Empty</p>
                <p className="text-xs text-muted-foreground/60 font-medium">All relevant alerts have been processed.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {isMigrating && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-900 text-white p-4 rounded-sm shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-10">
          <RefreshCw className="h-4 w-4 animate-spin text-primary" />
          <span className="text-[10px] font-black uppercase tracking-widest">Migrating Legacy History...</span>
        </div>
      )}
    </div>
  );
}
