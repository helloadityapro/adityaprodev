'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useCollection, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where, setDoc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { GraduationCap, Clock, CheckCircle2, BookOpen, ArrowLeft, ChevronRight, Lock, Loader2, AlertCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';

type Course = {
  id: string;
  title: string;
  description: string;
  category: string;
  thumbnailUrl?: string;
  duration: string;
};

type Module = {
  id: string;
  title: string;
  order: number;
};

type ProgressData = {
  completedModuleIds: string[];
};

export default function CourseDetailsPage() {
  const { courseId } = useParams() as { courseId: string };
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [isStarting, setIsStarting] = React.useState(false);

  const courseRef = useMemoFirebase(() => doc(firestore, 'lms_courses', courseId), [firestore, courseId]);
  const { data: course, isLoading: courseLoading, error: courseError } = useDoc<Course>(courseRef);

  // Use simple query to avoid composite index requirements
  const modulesQuery = useMemoFirebase(() => query(
    collection(firestore, 'lms_modules'), 
    where('courseId', '==', courseId)
  ), [firestore, courseId]);
  const { data: modules, isLoading: modulesLoading, error: modulesError } = useCollection<Module>(modulesQuery);

  const sortedModules = React.useMemo(() => {
    if (!modules) return [];
    return [...modules].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [modules]);

  const progressRef = useMemoFirebase(() => user ? doc(firestore, 'lms_progress', `${user.uid}_${courseId}`) : null, [firestore, user, courseId]);
  const { data: progress } = useDoc<ProgressData>(progressRef);

  const startCourse = async () => {
    if (!user || !course) return;
    
    if (!sortedModules || sortedModules.length === 0) {
      toast({
        variant: "destructive",
        title: "Course Unavailable",
        description: "This course does not have any modules yet. Please check back later."
      });
      return;
    }

    setIsStarting(true);
    try {
      if (!progress) {
        const pRef = doc(firestore, 'lms_progress', `${user.uid}_${courseId}`);
        // Initiate the write operation non-blockingly as per optimization guidelines.
        setDoc(pRef, {
          userId: user.uid,
          courseId: courseId,
          completedModuleIds: [],
          status: 'started',
          lastAccessed: serverTimestamp()
        }, { merge: true });
      }

      // Navigate to first uncompleted module or the first one if all finished
      const targetModule = sortedModules.find(m => !progress?.completedModuleIds?.includes(m.id)) || sortedModules[0];
      router.push(`/lms/courses/${courseId}/learn/${targetModule.id}`);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to start course."
      });
      setIsStarting(false);
    }
  };

  if (courseLoading || modulesLoading) {
    return (
      <div className="space-y-8 p-6 animate-pulse">
        <Skeleton className="h-64 w-full rounded-sm" />
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-32 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (courseError || modulesError) {
    return (
      <div className="p-12 text-center flex flex-col items-center gap-4">
        <AlertCircle className="h-12 w-12 text-destructive opacity-50" />
        <h2 className="text-xl font-bold">Error Loading Curriculum</h2>
        <p className="text-muted-foreground">{(courseError || modulesError)?.message}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  if (!course) return <div className="p-12 text-center text-muted-foreground">Course not found.</div>;

  const totalModules = sortedModules?.length || 0;
  const completedCount = progress?.completedModuleIds?.length || 0;
  const progressPercent = totalModules > 0 ? (completedCount / totalModules) * 100 : 0;

  return (
    <div className="space-y-8 max-w-6xl mx-auto p-4 md:p-8">
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2 text-muted-foreground hover:text-primary">
        <Link href="/lms"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Learning Hub</Link>
      </Button>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge className="bg-primary/10 text-primary border-none rounded-sm uppercase font-black text-[10px] tracking-widest px-3">
                {course.category}
              </Badge>
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground leading-none">
              {course.title}
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {course.description}
            </p>
          </div>

          <Card className="rounded-sm border-primary/10 shadow-md bg-card overflow-hidden">
            <CardHeader className="bg-muted/5 border-b py-4">
              <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" /> Curriculum Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {sortedModules && sortedModules.length > 0 ? (
                <div className="divide-y">
                  {sortedModules.map((m, idx) => {
                    const isCompleted = progress?.completedModuleIds?.includes(m.id);
                    return (
                      <Link 
                        key={m.id} 
                        href={progress ? `/lms/courses/${courseId}/learn/${m.id}` : '#'}
                        className={cn(
                          "flex items-center justify-between p-5 transition-all group",
                          progress ? "hover:bg-primary/5" : "cursor-default opacity-70"
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "h-10 w-10 rounded-full flex items-center justify-center font-mono font-bold text-sm border-2",
                            isCompleted ? "bg-green-500 border-green-500 text-white" : "border-primary/20 text-muted-foreground group-hover:border-primary group-hover:text-primary"
                          )}>
                            {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : idx + 1}
                          </div>
                          <div>
                            <p className="font-bold text-base">{m.title}</p>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Instructional Module</p>
                          </div>
                        </div>
                        {progress ? (
                          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                        ) : (
                          <Lock className="h-4 w-4 text-muted-foreground/40" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="p-12 text-center italic text-muted-foreground">Curriculum content being uploaded...</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar / Enrollment */}
        <div className="space-y-6">
          <Card className="rounded-sm border-primary/10 shadow-lg sticky top-24 overflow-hidden">
            <div className="aspect-video relative bg-muted">
              <Image 
                src={course.thumbnailUrl || `https://picsum.photos/seed/${course.id}/600/400`} 
                alt={course.title}
                fill
                className="object-cover"
                data-ai-hint="engineer learning"
              />
              <div className="absolute inset-0 bg-black/20" />
            </div>
            
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <Clock className="h-4 w-4 text-primary" />
                    <span>{course.duration}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <GraduationCap className="h-4 w-4 text-primary" />
                    <span>Official Certification</span>
                  </div>
                </div>

                {progress && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      <span>Course Progress</span>
                      <span className="text-primary">{Math.round(progressPercent)}%</span>
                    </div>
                    <Progress value={progressPercent} className="h-2 rounded-full" />
                  </div>
                )}
              </div>

              <Separator />

              <Button 
                size="lg" 
                className="w-full h-12 text-lg font-black rounded-sm shadow-md" 
                onClick={startCourse}
                disabled={isStarting}
              >
                {isStarting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Starting...</>
                ) : (
                  progress ? 'Continue Learning' : 'Enroll Now'
                )}
              </Button>
              
              <p className="text-[10px] text-center text-muted-foreground uppercase font-bold tracking-tighter">
                {progress ? 'Resume where you left off' : 'Free enrollment for Aditya personnel'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
