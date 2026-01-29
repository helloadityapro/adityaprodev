'use client';
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
import { cn } from "@/lib/utils"
import { useCollection, useFirestore } from "@/firebase"
import { collection } from "firebase/firestore"

type Project = {
  id: string;
  name: string;
  description: string;
};

export default function DashboardPage() {
  const firestore = useFirestore();
  const { data: projects, isLoading } = useCollection<Project>(collection(firestore, 'projects'));

  if(isLoading) return <p>Loading projects...</p>

  return (
    <>
      <div className="flex items-center">
        <h1 className="text-lg font-headline font-semibold md:text-2xl">Projects</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Your Projects</CardTitle>
          <CardDescription>An overview of projects assigned to you.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project Name</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects?.map((project) => (
                <TableRow key={project.id}>
                  <TableCell className="font-medium">{project.name}</TableCell>
                  <TableCell>{project.description}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  )
}
