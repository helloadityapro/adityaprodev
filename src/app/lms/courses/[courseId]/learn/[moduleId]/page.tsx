'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useCollection, useFirestore, useUser, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, where, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, CheckCircle2, PlayCircle, GraduationCap, ArrowLeft, Radio, AlertCircle, Lock, Loader2 } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';

type Module = {
  id: string;
  courseId: string;
  title: string;
  content: string;
  order: number;
  videoUrl?: string;
};

type Quiz = {
  id: string;
  moduleId: string;
  questions: {
    question: string;
    options: string[];
    correctAnswerIndex: number;
  }[];
};

type ProgressData = {
  completedModuleIds: string[];
  quizResults?: Record<string, number>;
};

/**
 * Extracts the YouTube Video ID and returns a proper embed URL.
 * Prevents "Connection Refused" errors caused by using standard watch URLs in iframes.
 */
function getYouTubeEmbedUrl(url?: string) {
  if (!url) return '';
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  const videoId = (match && match[2].length === 11) ? match[2] : null;
  
  return videoId ? `https://www.youtube.com/embed/${videoId}?rel=0` : url;
}

export default function ModuleLearningPage() {
  const { courseId, moduleId } = useParams() as { courseId: string, moduleId: string };
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [quizState, setQuizState] = React.useState<Record<number, number>>({});
  const [isQuizSubmitted, setIsQuizSubmitted] = React.useState(false);
  const [score, setScore] = React.useState(0);

  const moduleRef = useMemoFirebase(() => doc(firestore, 'lms_modules', moduleId), [firestore, moduleId]);
  const { data: moduleData, isLoading: moduleLoading, error: moduleError } = useDoc<Module>(moduleRef);

  const quizRef = useMemoFirebase(() => {
    if (!moduleId) return null;
    return query(collection(firestore, 'lms_quizzes'), where('moduleId', '==', moduleId));
  }, [firestore, moduleId]);
  const { data: quizzes, error: quizError } = useCollection<Quiz>(quizRef);
  const quiz = quizzes?.[0];

  const allModulesQuery = useMemoFirebase(() => query(
    collection(firestore, 'lms_modules'), 
    where('courseId', '==', courseId)
  ), [firestore, courseId]);
  const { data: allModules, isLoading: allModulesLoading, error: allModulesError } = useCollection<Module>(allModulesQuery);

  const sortedModules = React.useMemo(() => {
    if (!allModules) return [];
    return [...allModules].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [allModules]);

  const progressRef = useMemoFirebase(() => user ? doc(firestore, 'lms_progress', `${user.uid}_${courseId}`) : null, [firestore, user, courseId]);
  const { data: progress } = useDoc<ProgressData>(progressRef);

  const currentIndex = sortedModules?.findIndex(m => m.id === moduleId) ?? -1;
  const nextModule = sortedModules?.[currentIndex + 1];
  const prevModule = sortedModules?.[currentIndex - 1];

  const handleQuizSubmit = () => {
    if (!quiz || !user) return;
    
    let correctCount = 0;
    quiz.questions.forEach((q, idx) => {
      if (quizState[idx] === q.correctAnswerIndex) {
        correctCount++;
      }
    });

    const finalScore = (correctCount / quiz.questions.length) * 100;
    setScore(finalScore);
    setIsQuizSubmitted(true);

    if (finalScore >= 80) {
      toast({ title: 'Assessment Passed!', description: `You scored ${finalScore}%. Module marked as complete.` });
      markModuleComplete(finalScore);
    } else {
      toast({ variant: 'destructive', title: 'Assessment Failed', description: `You scored ${finalScore}%. A minimum of 80% is required.` });
    }
  };

  const markModuleComplete = async (finalScore: number = 100) => {
    if (!user || !moduleId || !progress) return;
    
    if (!progress.completedModuleIds.includes(moduleId)) {
      updateDocumentNonBlocking(doc(firestore, 'lms_progress', `${user.uid}_${courseId}`), {
        completedModuleIds: arrayUnion(moduleId),
        [`quizResults.${moduleId}`]: finalScore,
        lastAccessed: serverTimestamp()
      });
    }
  };

  const handleFinishCourse = () => {
    if (!quiz) markModuleComplete();
    router.push(`/lms/courses/${courseId}`);
  };

  if (moduleLoading || allModulesLoading) {
    return (
      <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-8">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="aspect-video w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (moduleError || allModulesError || quizError) {
    return (
      <div className="p-12 text-center flex flex-col items-center gap-4">
        <AlertCircle className="h-12 w-12 text-destructive opacity-50" />
        <h2 className="text-xl font-bold text-destructive">Error Loading Module</h2>
        <p className="text-muted-foreground">{(moduleError || allModulesError || quizError)?.message}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>Retry Connection</Button>
      </div>
    );
  }

  if (!moduleData) return <div className="p-12 text-center">Module not found.</div>;

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-8 pb-32">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <Button variant="ghost" size="sm" asChild className="w-fit text-muted-foreground hover:text-primary">
          <Link href={`/lms/courses/${courseId}`}><ArrowLeft className="mr-2 h-4 w-4" /> Course Overview</Link>
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Module {currentIndex + 1} of {sortedModules.length}</span>
          <div className="flex gap-1">
            {sortedModules.map((m, i) => (
              <div key={m.id} className={cn("h-1 w-6 rounded-full transition-colors", i <= currentIndex ? "bg-primary" : "bg-muted")} />
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-10">
        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-black tracking-tight text-foreground">{moduleData.title}</h1>
            <Badge variant="outline" className="rounded-sm border-primary/20 text-primary font-bold uppercase text-[9px] tracking-tighter">Educational Module</Badge>
          </div>

          {moduleData.videoUrl && (
            <div className="aspect-video bg-black rounded-sm overflow-hidden shadow-xl ring-1 ring-primary/10">
              <iframe 
                src={getYouTubeEmbedUrl(moduleData.videoUrl)} 
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={moduleData.title}
              />
            </div>
          )}

          <div className="prose prose-blue dark:prose-invert max-w-none bg-card p-8 rounded-sm border border-primary/5 shadow-sm text-lg leading-relaxed whitespace-pre-wrap">
            {moduleData.content}
          </div>
        </div>

        {quiz && (
          <div className="space-y-6 pt-8 border-t border-primary/10">
            <div className="flex items-center gap-3">
              <div className="bg-amber-500/10 p-2 rounded-sm">
                <GraduationCap className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Knowledge Check</h2>
                <p className="text-sm text-muted-foreground">Complete the quiz to finalize this module.</p>
              </div>
            </div>

            <Card className={cn(
              "rounded-sm border-primary/10 transition-all shadow-md",
              isQuizSubmitted && (score >= 80 ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5")
            )}>
              <CardContent className="pt-8 space-y-10">
                {quiz.questions.map((q, qIdx) => (
                  <div key={qIdx} className="space-y-4">
                    <div className="flex gap-3">
                      <span className="font-mono font-bold text-primary">{qIdx + 1}.</span>
                      <p className="text-lg font-semibold">{q.question}</p>
                    </div>
                    <RadioGroup 
                      disabled={isQuizSubmitted}
                      onValueChange={(val) => setQuizState(prev => ({ ...prev, [qIdx]: parseInt(val) }))}
                      className="grid gap-3 pl-8"
                    >
                      {q.options.map((opt, oIdx) => (
                        <div key={oIdx} className={cn(
                          "flex items-center space-x-3 p-3 rounded-sm border transition-colors",
                          isQuizSubmitted && oIdx === q.correctAnswerIndex ? "bg-green-100 border-green-500/50" : "bg-muted/30",
                          isQuizSubmitted && quizState[qIdx] === oIdx && oIdx !== q.correctAnswerIndex ? "bg-red-100 border-red-500/50" : ""
                        )}>
                          <RadioGroupItem value={oIdx.toString()} id={`q${qIdx}-o${oIdx}`} />
                          <Label htmlFor={`q${qIdx}-o${oIdx}`} className="flex-1 cursor-pointer font-medium">{opt}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                ))}
              </CardContent>
              <CardFooter className="bg-muted/10 p-6 flex flex-col md:flex-row items-center justify-between gap-4 border-t">
                {isQuizSubmitted ? (
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "h-12 w-12 rounded-full flex items-center justify-center font-black text-xl border-4",
                      score >= 80 ? "border-green-500 text-green-600" : "border-red-500 text-red-600"
                    )}>
                      {Math.round(score)}
                    </div>
                    <div>
                      <p className={cn("font-bold text-lg", score >= 80 ? "text-green-700" : "text-red-700")}>
                        {score >= 80 ? 'Mastery Achieved!' : 'Further Review Needed'}
                      </p>
                      <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest">
                        {score >= 80 ? 'Module complete' : 'Try again to pass module'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-primary" /> All questions must be answered to submit.
                  </p>
                )}
                <div className="flex gap-2 w-full md:w-auto">
                  {isQuizSubmitted && score < 80 && (
                    <Button variant="outline" className="flex-1 md:w-32 rounded-sm font-bold" onClick={() => { setIsQuizSubmitted(false); setQuizState({}); }}>Retake Quiz</Button>
                  )}
                  {!isQuizSubmitted && (
                    <Button className="w-full md:w-48 rounded-sm font-black shadow-md h-11" onClick={handleQuizSubmit} disabled={Object.keys(quizState).length < quiz.questions.length}>
                      Submit Assessment
                    </Button>
                  )}
                </div>
              </CardFooter>
            </Card>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur border-t p-4 z-20 md:left-[16rem]">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <Button variant="ghost" disabled={!prevModule} asChild={!!prevModule} className="rounded-sm font-bold">
            {prevModule ? <Link href={`/lms/courses/${courseId}/learn/${prevModule.id}`}><ChevronLeft className="mr-2 h-4 w-4" /> Previous Module</Link> : <span><ChevronLeft className="mr-2 h-4 w-4" /> Previous</span>}
          </Button>

          <div className="hidden md:block flex-1 text-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-primary px-4 truncate max-w-[300px] inline-block">
              {moduleData.title}
            </span>
          </div>

          {nextModule ? (
            <Button 
              className="rounded-sm font-black shadow-md"
              disabled={!!quiz && (!isQuizSubmitted || score < 80)}
              asChild={!quiz || (isQuizSubmitted && score >= 80)}
              onClick={!quiz ? () => markModuleComplete() : undefined}
            >
              {!quiz || (isQuizSubmitted && score >= 80) ? (
                <Link href={`/lms/courses/${courseId}/learn/${nextModule.id}`}>Next Module <ChevronRight className="ml-2 h-4 w-4" /></Link>
              ) : (
                <span>Next Module <Lock className="ml-2 h-3.5 w-3.5" /></span>
              )}
            </Button>
          ) : (
            <Button 
              variant="default" 
              className="bg-green-600 hover:bg-green-700 rounded-sm font-black shadow-md"
              disabled={!!quiz && (!isQuizSubmitted || score < 80)}
              onClick={handleFinishCourse}
            >
              Finish Course <CheckCircle2 className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
