
'use client';

import * as React from 'react';
import { useCollection, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { GraduationCap, Clock, BookOpen, Search, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import Image from 'next/image';
import Link from 'next/link';

type Course = {
  id: string;
  title: string;
  description: string;
  category: string;
  thumbnailUrl?: string;
  duration: string;
  createdAt: any;
};

export default function LMSCatalogPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [searchTerm, setSearchTerm] = React.useState('');

  const coursesQuery = useMemoFirebase(() => query(collection(firestore, 'lms_courses'), orderBy('createdAt', 'desc')), [firestore]);
  const { data: courses, isLoading } = useCollection<Course>(coursesQuery);

  const filteredCourses = React.useMemo(() => {
    if (!courses) return [];
    return courses.filter(c => 
      c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [courses, searchTerm]);

  if (isLoading) {
    return (
      <div className="space-y-8 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-[350px] w-full rounded-sm" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-sm">
              <GraduationCap className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl font-black tracking-tight text-foreground">Learning Hub</h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-xl">
            Professional development and safety compliance training for Aditya Green Energy members.
          </p>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search courses..." 
            className="pl-9 rounded-sm border-primary/20 h-11"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {filteredCourses.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredCourses.map((course) => (
            <Card key={course.id} className="group hover:shadow-xl transition-all duration-300 rounded-sm overflow-hidden border-primary/10 flex flex-col h-full bg-card">
              <div className="relative aspect-video bg-muted overflow-hidden">
                <Image 
                  src={course.thumbnailUrl || `https://picsum.photos/seed/${course.id}/600/400`} 
                  alt={course.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                  data-ai-hint="solar energy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                  <Badge className="bg-primary border-none rounded-sm font-bold shadow-lg">Start Learning</Badge>
                </div>
                <div className="absolute top-3 left-3">
                  <Badge variant="secondary" className="rounded-sm font-black uppercase text-[9px] tracking-widest bg-white/90 backdrop-blur border-none text-primary">
                    {course.category}
                  </Badge>
                </div>
              </div>
              
              <CardHeader className="flex-1 space-y-3 pb-4">
                <CardTitle className="text-xl font-bold leading-tight group-hover:text-primary transition-colors line-clamp-2">
                  {course.title}
                </CardTitle>
                <CardDescription className="line-clamp-3 text-sm leading-relaxed">
                  {course.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-0">
                <div className="flex items-center gap-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    <span>{course.duration}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-primary" />
                    <span>Self-Paced</span>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="border-t bg-muted/5 p-4 mt-auto">
                <Button asChild className="w-full rounded-sm font-bold shadow-md h-11">
                  <Link href={`/lms/courses/${course.id}`}>
                    Access Course <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-32 text-center bg-muted/10 rounded-sm border border-dashed border-primary/20">
          <BookOpen className="h-16 w-16 text-muted-foreground/20 mb-4" />
          <h3 className="text-xl font-bold text-foreground">No Courses Found</h3>
          <p className="text-muted-foreground max-w-sm mx-auto mt-2">
            {searchTerm ? `We couldn't find any results for "${searchTerm}"` : "The Learning Hub is currently being prepared. Check back soon for safety and technical modules."}
          </p>
          {searchTerm && (
            <Button variant="ghost" className="mt-4" onClick={() => setSearchTerm('')}>Clear Search</Button>
          )}
        </div>
      )}
    </div>
  );
}
