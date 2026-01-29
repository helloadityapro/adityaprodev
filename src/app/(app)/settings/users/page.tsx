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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useCollection, useFirestore, updateDocumentNonBlocking, useMemoFirebase } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { AddUserDialog } from "@/components/add-user-dialog";

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
    const [isAddUserDialogOpen, setIsAddUserDialogOpen] = React.useState(false);

    const handleApproveRegistration = (userId: string) => {
        const userRef = doc(firestore, 'users', userId);
        updateDocumentNonBlocking(userRef, { registrationRequest: false });
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
                                    <TableHead>
                                        <span className="sr-only">Actions</span>
                                    </TableHead>
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
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button aria-haspopup="true" size="icon" variant="ghost">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                        <span className="sr-only">Toggle menu</span>
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    {user.registrationRequest && <DropdownMenuItem onClick={() => handleApproveRegistration(user.id)}>Approve Registration</DropdownMenuItem>}
                                                    <DropdownMenuItem>Edit User</DropdownMenuItem>
                                                    <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10">Delete User</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
            <AddUserDialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen} />
        </>
    )
}
