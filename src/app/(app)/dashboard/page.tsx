'use client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase } from "@/firebase"
import { collection, query, where, doc, documentId } from "firebase/firestore"

type Project = {
  id: string;
  name: string;
  description: string;
};

type UserProfile = {
    role: string;
    assignedProjectIds?: string[];
}

export default function DashboardPage() {
  const firestore = useFirestore();
  const { user } = useUser();

  const userProfileRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userProfile, isLoading: isUserProfileLoading } = useDoc<UserProfile>(userProfileRef);

  const projectsQuery = useMemoFirebase(() => {
    if (!userProfile) return null;
    
    const projectsCollection = collection(firestore, 'projects');

    if (userProfile.role === 'Admin') {
      return projectsCollection; // Admin can see all projects
    }
    
    if (userProfile.assignedProjectIds && userProfile.assignedProjectIds.length > 0) {
      return query(projectsCollection, where(documentId(), 'in', userProfile.assignedProjectIds));
    }
    
    return null;
  }, [firestore, userProfile]);

  const { data: projects, isLoading: areProjectsLoading } = useCollection<Project>(projectsQuery);
  
  const isLoading = isUserProfileLoading || areProjectsLoading;

  if (isLoading) return <p>Loading projects...</p>;

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
              {projects && projects.length > 0 ? (
                projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="font-medium">{project.name}</TableCell>
                    <TableCell>{project.description}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={2} className="text-center">
                    {userProfile?.role === 'Admin' ? 'No projects found.' : 'No projects assigned to you yet.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  )
}
