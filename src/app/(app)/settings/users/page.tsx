'use client';

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Eye, Edit, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useCollection, useFirestore, updateDocumentNonBlocking, useMemoFirebase, deleteDocumentNonBlocking } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { AddUserDialog } from "@/components/add-user-dialog";
import { EditUserDialog } from "@/components/edit-user-dialog";
import { useToast } from "@/hooks/use-toast";
import { ViewUserDialog } from "@/components/view-user-dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type User = {
  id: string;
  username: string;
  email: string;
  mobile: string;
  role: 'Admin' | 'Supervisor' | 'SiteEngineer';
  registrationRequest: boolean;
  avatarUrl?: string;
};

function StatusBadge({ isPending }: { isPending: boolean }) {
  const status = isPending ? "Pending" : "Active";
  return (
    <Badge
      className={cn("text-xs font-medium", {
        "bg-yellow-100 text-yellow-800 hover:bg-yellow-100/80 dark:bg-yellow-900/50 dark:text-yellow-300 border-transparent": status === "Pending",
        "bg-green-100 text-green-800 hover:bg-green-100/80 dark:bg-green-900/50 dark:text-green-300 border-transparent": status === "Active",
      })}
    >
      {status}
    </Badge>
  )
}

export default function UsersPage() {
    const firestore = useFirestore();
    const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
    const { data: users, isLoading } = useCollection<User>(usersQuery);
    const { toast } = useToast();

    const [isAddUserDialogOpen, setIsAddUserDialogOpen] = React.useState(false);
    const [userToEdit, setUserToEdit] = React.useState<User | null>(null);
    const [userToView, setUserToView] = React.useState<User | null>(null);
    const [userToDelete, setUserToDelete] = React.useState<User | null>(null);
    const [isRejecting, setIsRejecting] = React.useState(false);

    const handleApproveRegistration = (userId: string) => {
        const userRef = doc(firestore, 'users', userId);
        updateDocumentNonBlocking(userRef, { registrationRequest: false });
        toast({ title: 'User Approved', description: 'The user registration has been approved.' });
    }
    
    const handleRejectClick = (user: User) => {
        setIsRejecting(true);
        setUserToDelete(user);
    }

    const handleDeleteClick = (user: User) => {
        setIsRejecting(false);
        setUserToDelete(user);
    }
    
    const handleConfirmDelete = (userId: string) => {
        if (!userId) return;
        const userRef = doc(firestore, 'users', userId);
        deleteDocumentNonBlocking(userRef);
        toast({ title: isRejecting ? 'User Rejected' : 'User Deleted', description: `The user has been successfully ${isRejecting ? 'rejected and removed' : 'deleted'}.` });
        setUserToDelete(null);
    };

    const onDialogClose = () => {
        setUserToDelete(null);
        setIsRejecting(false);
    }

    if(isLoading) {
        return <p>Loading users...</p>
    }

    return (
        <>
            <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-lg font-headline font-semibold md:text-2xl">User Management</h1>
                    <Button onClick={() => setIsAddUserDialogOpen(true)}>Add User</Button>
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>Users</CardTitle>
                        <CardDescription>Manage your users and their roles.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="hidden md:table-cell">Mobile</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users?.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-9 w-9">
                                                    {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.username} data-ai-hint="person face" />}
                                                    <AvatarFallback>{user.username.charAt(0).toUpperCase()}</AvatarFallback>
                                                </Avatar>
                                                <div className="grid gap-0.5">
                                                    <p className="font-medium">{user.username}</p>
                                                    <p className="text-sm text-muted-foreground">{user.email}</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>{user.role}</TableCell>
                                        <TableCell>
                                            <StatusBadge isPending={user.registrationRequest} />
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell">{user.mobile}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {user.registrationRequest ? (
                                                    <>
                                                        <Button variant="outline" size="sm" onClick={() => handleApproveRegistration(user.id)}>Approve</Button>
                                                        <Button variant="destructive" size="sm" onClick={() => handleRejectClick(user)}>Reject</Button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Button variant="ghost" size="icon" onClick={() => setUserToView(user)}>
                                                            <Eye className="h-4 w-4" />
                                                            <span className="sr-only">View</span>
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => setUserToEdit(user)}>
                                                            <Edit className="h-4 w-4" />
                                                            <span className="sr-only">Edit</span>
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDeleteClick(user)}>
                                                            <Trash2 className="h-4 w-4" />
                                                            <span className="sr-only">Delete</span>
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
            <AddUserDialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen} />
            <EditUserDialog user={userToEdit} open={!!userToEdit} onOpenChange={() => setUserToEdit(null)} />
            <ViewUserDialog user={userToView} open={!!userToView} onOpenChange={() => setUserToView(null)} />
            <AlertDialog open={!!userToDelete} onOpenChange={onDialogClose}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        {isRejecting 
                            ? "This will reject the user registration and delete their account data. This action cannot be undone."
                            : "This action cannot be undone. This will permanently delete the user document from Firestore."
                        }
                         It will not remove the user from the authentication system.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => userToDelete && handleConfirmDelete(userToDelete.id)}>
                         {isRejecting ? 'Yes, Reject' : 'Delete'}
                    </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
