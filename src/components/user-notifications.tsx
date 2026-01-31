'use client';

import * as React from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
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
  orderBy,
  doc,
  writeBatch,
} from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { ScrollArea } from '@/components/ui/scroll-area';

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

  const notificationsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
  }, [user, firestore]);

  const { data: notifications } = useCollection<Notification>(
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
    router.push(notification.link);
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
        <Button variant="ghost" size="icon" className="relative h-8 w-8 rounded-full">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 p-0 text-xs text-white">
              {unreadCount}
            </Badge>
          )}
          <span className="sr-only">Toggle notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 md:w-96">
        <div className="flex items-center justify-between border-b p-3">
          <h3 className="font-medium">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={handleMarkAllAsRead}
            >
              <CheckCheck className="mr-1 h-4 w-4" />
              Mark all as read
            </Button>
          )}
        </div>
        <ScrollArea className="h-96">
          <div className="p-2">
            {notifications && notifications.length > 0 ? (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    'flex cursor-pointer flex-col gap-1 rounded-md p-2 hover:bg-accent',
                    !notification.read && 'bg-blue-500/10'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{notification.title}</p>
                    {!notification.read && (
                      <div className="h-2 w-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {notification.description}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {notification.createdAt
                      ? formatDistanceToNow(notification.createdAt.toDate(), {
                          addSuffix: true,
                        })
                      : ''}
                  </p>
                </div>
              ))
            ) : (
              <div className="flex h-48 items-center justify-center text-center text-sm text-muted-foreground">
                <p>You have no notifications.</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
