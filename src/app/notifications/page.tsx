'use client';

import * as React from 'react';
import { 
  useCollection, 
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
  Timestamp
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
  FilterX
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
  userId: string;
  title: string;
  description: string;
  link: string;
  read: boolean;
  createdAt: any;
};

const PAGE_SIZE = 20;

export default function NotificationsHistoryPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [filter, setFilter] = React.useState<'all' | 'unread'>('all');
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const notificationsQuery = useMemoFirebase(() => {
    if (!user) return null;
    const colRef = collection(firestore, 'notifications');
    const baseQuery = filter === 'unread' 
      ? query(colRef, where('userId', '==', user.uid), where('read', '==', false), orderBy('createdAt', 'desc'))
      : query(colRef, where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
    
    return query(baseQuery, limit(100)); // Show a decent amount, pagination can be added if needed
  }, [user, firestore, filter]);

  const { data: notifications, isLoading } = useCollection<Notification>(notificationsQuery);

  const handleMarkAsRead = (id: string, link?: string) => {
    updateDocumentNonBlocking(doc(firestore, 'notifications', id), { read: true });
    if (link) router.push(link);
  };

  const handleMarkAllRead = async () => {
    if (!notifications || !user) return;
    setIsProcessing(true);
    try {
      const batch = writeBatch(firestore);
      notifications.filter(n => !n.read).forEach(n => {
        batch.update(doc(firestore, 'notifications', n.id), { read: true });
      });
      await batch.commit();
      toast({ title: 'Success', description: 'All alerts marked as read.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteAllRead = async () => {
    if (!notifications || !user) return;
    setIsProcessing(true);
    try {
      const batch = writeBatch(firestore);
      notifications.filter(n => n.read).forEach(n => {
        batch.delete(doc(firestore, 'notifications', n.id));
      });
      await batch.commit();
      toast({ title: 'Cleanup Complete', description: 'Read notifications cleared.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading || !mounted) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto p-4 md:p-8">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const unreadCount = notifications?.filter(n => !n.read).length || 0;

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
          <p className="text-muted-foreground text-sm font-medium">Full audit trail of your organizational alerts and updates.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleMarkAllRead} 
            disabled={unreadCount === 0 || isProcessing}
            className="h-10 rounded-sm font-bold border-primary/20 text-primary hover:bg-primary/5"
          >
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCheck className="h-4 w-4 mr-2" />}
            Mark All Read
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleDeleteAllRead} 
            className="h-10 rounded-sm font-bold text-destructive hover:bg-destructive/5"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear History
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
            {notifications?.length || 0} Records
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          {notifications && notifications.length > 0 ? (
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
                        {formatDistanceToNow(notif.createdAt?.toDate() || new Date(), { addSuffix: true })}
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
                          onClick={() => handleMarkAsRead(notif.id, notif.link)}
                        >
                          Review Entry <ArrowRight className="ml-1.5 h-3 w-3" />
                        </Button>
                      )}
                      {!notif.read && (
                        <button 
                          onClick={() => handleMarkAsRead(notif.id)}
                          className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 hover:text-primary transition-colors"
                        >
                          Mark as seen
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-32 flex flex-col items-center justify-center text-center gap-4">
              <div className="p-6 bg-muted/50 rounded-full border-2 border-dashed">
                <Inbox className="h-12 w-12 text-muted-foreground/20" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Notification Box Empty</p>
                <p className="text-xs text-muted-foreground/60 font-medium">All relevant alerts have been processed.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
