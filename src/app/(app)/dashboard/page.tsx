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
import { mockProjects, type Project } from "@/lib/data"
import { cn } from "@/lib/utils"

function StatusBadge({ status }: { status: Project["status"] }) {
  return (
    <Badge
      className={cn("text-xs font-medium", {
        "bg-yellow-100 text-yellow-800 hover:bg-yellow-100/80 dark:bg-yellow-900/50 dark:text-yellow-300 border-transparent": status === "On Hold",
        "bg-green-100 text-green-800 hover:bg-green-100/80 dark:bg-green-900/50 dark:text-green-300 border-transparent": status === "Completed",
        "bg-blue-100 text-blue-800 hover:bg-blue-100/80 dark:bg-blue-900/50 dark:text-blue-300 border-transparent": status === "In Progress",
      })}
    >
      {status}
    </Badge>
  )
}

export default function DashboardPage() {
  const projects = mockProjects;

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
                <TableHead className="hidden md:table-cell">Site</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Manager</TableHead>
                <TableHead className="hidden sm:table-cell">Start Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell className="font-medium">{project.name}</TableCell>
                  <TableCell className="hidden md:table-cell">{project.site}</TableCell>
                  <TableCell>
                    <StatusBadge status={project.status} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{project.manager}</TableCell>
                  <TableCell className="hidden sm:table-cell">{project.startDate}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  )
}
