'use client';

import * as React from 'react';
import { Bell, CheckCheck, X, CheckCircle, XCircle, ChevronRight, History, Loader2 } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverClose,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  useCollection,
  useFirestore,
  useUser,
  useMemoFirebase,
  updateDocumentNonBlocking,
} from '@/firebase';
import {
  collection,
  query,
  where,
  doc,
  writeBatch,
  limit,
  orderBy,
} from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';

type Notification = {
  id: string;
  userId: string;
  title: string;
  description: string;
  link: string;
  read: boolean;
  createdAt: any; // Firestore Timestamp
};

export function UserNotifications() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  
  // Mounted check to prevent hydration mismatch with time-ago strings
  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect(() => setIsMounted(true), []);

  const notificationsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(50) // Fix: Limit to 50 as requested
    );
  }, [user, firestore]);

  const { data: notifications, isLoading } = useCollection<Notification>(
    notificationsQuery
  );

  const unreadCount = React.useMemo(() => {
    return notifications?.filter((n) => !n.read).length || 0;
  }, [notifications]);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      const notifRef = doc(firestore, 'notifications', notification.id);
      updateDocumentNonBlocking(notifRef, { read: true });
    }
    if (notification.link) {
      router.push(notification.link);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!notifications || !firestore) return;

    const unreadNotifications = notifications.filter((n) => !n.read);
    if (unreadNotifications.length === 0) return;

    const batch = writeBatch(firestore);
    unreadNotifications.forEach((notification) => {
      const notifRef = doc(firestore, 'notifications', notification.id);
      batch.update(notifRef, { read: true });
    });
    await batch.commit();
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full transition-all hover:bg-primary/10">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 p-0 text-[9px] font-black text-white border-2 border-background animate-in zoom-in duration-300">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
          <span className="sr-only">Toggle notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 md:w-[400px] rounded-sm shadow-2xl border-primary/10 bg-background/95 backdrop-blur-sm overflow-hidden">
        <div className="flex items-center justify-between border-b bg-muted/30 p-4">
          <div className="space-y-0.5">
            <h3 className="text-xs font-black uppercase tracking-widest text-foreground">Alerts</h3>
            <p className="text-[10px] text-muted-foreground font-medium uppercase">{unreadCount} Unread</p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[10px] font-bold uppercase tracking-tight text-primary hover:bg-primary/5"
                onClick={handleMarkAllAsRead}
              >
                <CheckCheck className="mr-1 h-3.5 w-3.5" />
                Clear All
              </Button>
            )}
            <PopoverClose asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm text-muted-foreground opacity-50 hover:opacity-100 transition-opacity">
                <X className="h-4 w-4" />
              </Button>
            </PopoverClose>
          </div>
        </div>
        <ScrollArea className="h-[400px]">
          <div className="p-1">
            {isLoading ? (
              <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary opacity-20" /></div>
            ) : notifications && notifications.length > 0 ? (
              <div className="divide-y divide-border/40">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={cn(
                      'group relative flex cursor-pointer items-start gap-3 p-4 transition-all hover:bg-primary/[0.03]',
                      !notification.read && 'bg-primary/[0.01]'
                    )}
                  >
                    {!notification.read && (
                      <div className="absolute left-1 top-1/2 -translate-y-1/2 h-8 w-1 bg-primary rounded-full" />
                    )}
                    <div className={cn(
                      "mt-0.5 p-2 rounded-sm shrink-0",
                      notification.title.toLowerCase().includes('approved') ? "bg-green-50 text-green-600" :
                      notification.title.toLowerCase().includes('rejected') ? "bg-red-50 text-red-600" :
                      "bg-muted text-primary"
                    )}>
                      {notification.title.toLowerCase().includes('approved') ? <CheckCircle className="h-4 w-4" /> :
                       notification.title.toLowerCase().includes('rejected') ? <XCircle className="h-4 w-4" /> :
                       <Bell className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={cn("text-xs leading-none truncate", notification.read ? "font-semibold text-muted-foreground" : "font-black text-foreground")}>
                          {notification.title}
                        </p>
                        <span className="text-[8px] font-black uppercase text-muted-foreground/40 whitespace-nowrap">
                          {isMounted && notification.createdAt
                            ? formatDistanceToNow(notification.createdAt.toDate(), { addSuffix: true })
                            : ''}
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
                        {notification.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center opacity-30">
                <Bell className="h-10 w-10 mb-3" />
                <p className="text-xs font-black uppercase tracking-widest">Inbox Clean</p>
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="border-t bg-muted/30 p-2">
          <Button asChild variant="ghost" className="w-full h-9 rounded-sm font-black text-[10px] uppercase tracking-widest text-primary hover:bg-primary/5">
            <Link href="/notifications">
              <History className="mr-2 h-3.5 w-3.5" />
              View Full History <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
