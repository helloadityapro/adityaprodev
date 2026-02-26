
'use client';

import * as React from 'react';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { BookOpen, Plus, Trash2, Edit3, Layers, Layout, GraduationCap, Video, FileText, CheckCircle2, ChevronRight, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { isSuperAdmin } from '@/lib/auth-constants';
import { useRouter } from 'next/navigation';

type Course = {
  id: string;
  title: string;
  description: string;
  category: string;
  duration: string;
};

type Module = {
  id: string;
  title: string;
  content: string;
  order: number;
  courseId: string;
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

export default function LMSAdminPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [isCourseDialogOpen, setIsCourseDialogOpen] = React.useState(false);
  const [isModuleDialogOpen, setIsModuleDialogOpen] = React.useState(false);
  const [isQuizDialogOpen, setIsQuizDialogOpen] = React.useState(false);
  const [selectedCourse, setSelectedCourse] = React.useState<Course | null>(null);
  const [selectedModule, setSelectedModule] = React.useState<Module | null>(null);

  // Form states
  const [courseForm, setCourseForm] = React.useState({ title: '', description: '', category: 'Safety', duration: '30 mins' });
  const [moduleForm, setModuleForm] = React.useState({ title: '', content: '', order: 1, videoUrl: '' });
  const [quizForm, setQuizForm] = React.useState({ questions: [{ question: '', options: ['', '', ''], correctAnswerIndex: 0 }] });

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc(userProfileRef);
  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  const coursesQuery = useMemoFirebase(() => query(collection(firestore, 'lms_courses'), orderBy('createdAt', 'desc')), [firestore]);
  const { data: courses, isLoading: coursesLoading } = useCollection<Course>(coursesQuery);

  const modulesQuery = useMemoFirebase(() => {
    if (!selectedCourse) return null;
    return query(collection(firestore, 'lms_modules'), where('courseId', '==', selectedCourse.id), orderBy('order', 'asc'));
  }, [firestore, selectedCourse]);
  const { data: modules } = useCollection<Module>(modulesQuery);

  const handleCreateCourse = async () => {
    if (!user || !isAdmin) return;
    await addDocumentNonBlocking(collection(firestore, 'lms_courses'), {
      ...courseForm,
      createdAt: serverTimestamp(),
      createdBy: user.uid
    });
    setIsCourseDialogOpen(false);
    toast({ title: 'Course Created', description: 'Learning path added to catalog.' });
  };

  const handleCreateModule = async () => {
    if (!selectedCourse) return;
    await addDocumentNonBlocking(collection(firestore, 'lms_modules'), {
      ...moduleForm,
      courseId: selectedCourse.id,
      order: Number(moduleForm.order)
    });
    setIsModuleDialogOpen(false);
    toast({ title: 'Module Added', description: 'Curriculum content expanded.' });
  };

  const handleCreateQuiz = async () => {
    if (!selectedModule) return;
    await addDocumentNonBlocking(collection(firestore, 'lms_quizzes'), {
      ...quizForm,
      courseId: selectedModule.courseId,
      moduleId: selectedModule.id
    });
    setIsQuizDialogOpen(false);
    toast({ title: 'Quiz Activated', description: 'Assessment added to module.' });
  };

  const handleDeleteCourse = (id: string) => {
    deleteDocumentNonBlocking(doc(firestore, 'lms_courses', id));
    toast({ title: 'Course Deleted' });
  };

  const handleAddQuestion = () => {
    setQuizForm(prev => ({
      ...prev,
      questions: [...prev.questions, { question: '', options: ['', '', ''], correctAnswerIndex: 0 }]
    }));
  };

  if (!isAdmin && user) {
    return <div className="p-12 text-center font-bold text-destructive">Unauthorized Access.</div>;
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-black tracking-tight uppercase">LMS Administration</h1>
          </div>
          <p className="text-muted-foreground text-sm">Manage corporate training courses, safety modules and MCQs.</p>
        </div>
        <Button onClick={() => setIsCourseDialogOpen(true)} className="rounded-sm font-black h-11 px-6 shadow-md">
          <Plus className="mr-2 h-5 w-5" /> New Course
        </Button>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Course List */}
        <Card className="lg:col-span-1 rounded-sm border-primary/10 shadow-md h-fit overflow-hidden">
          <CardHeader className="bg-muted/5 border-b py-4">
            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <Layout className="h-4 w-4 text-primary" /> Course Catalog
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {coursesLoading ? (
              <div className="p-4 space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
            ) : courses && courses.length > 0 ? (
              <div className="divide-y">
                {courses.map(course => (
                  <div 
                    key={course.id} 
                    className={cn(
                      "p-4 flex items-center justify-between group hover:bg-primary/5 transition-colors cursor-pointer",
                      selectedCourse?.id === course.id ? "bg-primary/10 ring-1 ring-inset ring-primary/20" : ""
                    )}
                    onClick={() => setSelectedCourse(course)}
                  >
                    <div className="space-y-1 overflow-hidden">
                      <p className={cn("font-bold text-sm truncate", selectedCourse?.id === course.id ? "text-primary" : "")}>{course.title}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="rounded-sm text-[8px] h-4 py-0 font-black uppercase">{course.category}</Badge>
                        <span className="text-[10px] text-muted-foreground font-medium">{course.duration}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteCourse(course.id); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <ChevronRight className="h-4 w-4 text-muted-foreground ml-1 self-center" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center text-xs text-muted-foreground italic">No courses in hub. Click "New Course" to start.</div>
            )}
          </CardContent>
        </Card>

        {/* Module List */}
        <Card className="lg:col-span-2 rounded-sm border-primary/10 shadow-md overflow-hidden h-fit">
          <CardHeader className="bg-muted/5 border-b py-4 flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" /> {selectedCourse ? `${selectedCourse.title} Curriculum` : 'Select Course to Manage'}
              </CardTitle>
              {selectedCourse && <CardDescription className="text-[10px] uppercase font-black text-muted-foreground">Course ID: {selectedCourse.id}</CardDescription>}
            </div>
            {selectedCourse && (
              <Button size="sm" onClick={() => setIsModuleDialogOpen(true)} className="h-8 rounded-sm text-xs font-bold px-4">
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Module
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {!selectedCourse ? (
              <div className="p-32 flex flex-col items-center justify-center text-center gap-4">
                <Layout className="h-12 w-12 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground font-medium">Please select a course from the left to manage modules and assessments.</p>
              </div>
            ) : modules && modules.length > 0 ? (
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="w-16 text-center">Ord</TableHead>
                    <TableHead>Module Title</TableHead>
                    <TableHead>Content Type</TableHead>
                    <TableHead className="text-right px-6">Assessment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modules.map(module => (
                    <TableRow key={module.id} className="hover:bg-muted/5 group">
                      <TableCell className="text-center font-mono font-bold text-xs text-primary">{module.order}</TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="font-bold text-sm">{module.title}</p>
                          <p className="text-[10px] text-muted-foreground line-clamp-1">{module.content}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1.5">
                          {module.videoUrl && <Badge variant="outline" className="rounded-sm border-blue-200 text-blue-700 bg-blue-50 text-[8px] h-4"><Video className="h-2.5 w-2.5 mr-1" /> VIDEO</Badge>}
                          <Badge variant="outline" className="rounded-sm border-primary/20 text-primary bg-primary/5 text-[8px] h-4"><FileText className="h-2.5 w-2.5 mr-1" /> TEXT</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right px-6">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-7 text-[10px] font-bold rounded-sm border-amber-500/30 text-amber-700 hover:bg-amber-50"
                          onClick={() => { setSelectedModule(module); setIsQuizDialogOpen(true); }}
                        >
                          <GraduationCap className="h-3 w-3 mr-1.5" /> Set Quiz
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-32 flex flex-col items-center justify-center text-center gap-4 border-t border-dashed">
                <Layers className="h-12 w-12 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground font-medium italic">No modules added to this course yet.</p>
                <Button variant="outline" onClick={() => setIsModuleDialogOpen(true)} className="rounded-sm font-bold h-9">Create First Module</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Course Dialog */}
      <Dialog open={isCourseDialogOpen} onOpenChange={setIsCourseDialogOpen}>
        <DialogContent className="rounded-sm max-w-lg">
          <DialogHeader>
            <DialogTitle>Define New Learning Path</DialogTitle>
            <DialogDescription>Add a new course to the corporate learning hub.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2"><Label>Title</Label><Input placeholder="e.g. Safety at High Altitudes" onChange={e => setCourseForm({...courseForm, title: e.target.value})} /></div>
            <div className="grid gap-2"><Label>Category</Label><Input placeholder="e.g. Safety, Technical, Onboarding" onChange={e => setCourseForm({...courseForm, category: e.target.value})} /></div>
            <div className="grid gap-2"><Label>Description</Label><Textarea placeholder="Course overview..." rows={4} onChange={e => setCourseForm({...courseForm, description: e.target.value})} /></div>
            <div className="grid gap-2"><Label>Estimated Duration</Label><Input placeholder="e.g. 45 mins" onChange={e => setCourseForm({...courseForm, duration: e.target.value})} /></div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" className="rounded-sm">Cancel</Button></DialogClose>
            <Button className="rounded-sm font-bold" onClick={handleCreateCourse}>Publish Course</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Module Dialog */}
      <Dialog open={isModuleDialogOpen} onOpenChange={setIsModuleDialogOpen}>
        <DialogContent className="rounded-sm max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Lesson Module</DialogTitle>
            <DialogDescription>Define content for {selectedCourse?.title}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-3 grid gap-2"><Label>Module Title</Label><Input onChange={e => setModuleForm({...moduleForm, title: e.target.value})} /></div>
              <div className="grid gap-2"><Label>Order</Label><Input type="number" onChange={e => setModuleForm({...moduleForm, order: Number(e.target.value)})} /></div>
            </div>
            <div className="grid gap-2"><Label>Video URL (YouTube)</Label><Input placeholder="https://..." onChange={e => setModuleForm({...moduleForm, videoUrl: e.target.value})} /></div>
            <div className="grid gap-2"><Label>Instructional Content</Label><Textarea placeholder="Module body text..." rows={10} onChange={e => setModuleForm({...moduleForm, content: e.target.value})} /></div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" className="rounded-sm">Cancel</Button></DialogClose>
            <Button className="rounded-sm font-bold" onClick={handleCreateModule}>Save Module</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quiz Dialog */}
      <Dialog open={isQuizDialogOpen} onOpenChange={setIsQuizDialogOpen}>
        <DialogContent className="rounded-sm max-w-3xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>MCQ Assessment Generator</DialogTitle>
            <DialogDescription>Adding knowledge check for: {selectedModule?.title}.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 p-6">
            <div className="space-y-10">
              {quizForm.questions.map((q, idx) => (
                <div key={idx} className="p-6 border rounded-sm bg-muted/10 space-y-6 relative">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="rounded-sm font-black uppercase text-[10px] tracking-widest text-primary border-primary/20">Question #{idx + 1}</Badge>
                    {quizForm.questions.length > 1 && (
                      <Button variant="ghost" size="sm" className="h-7 text-destructive" onClick={() => {
                        const newQs = [...quizForm.questions];
                        newQs.splice(idx, 1);
                        setQuizForm({ questions: newQs });
                      }}>Remove</Button>
                    )}
                  </div>
                  
                  <div className="grid gap-2">
                    <Label>Question Text</Label>
                    <Input 
                      value={q.question} 
                      onChange={e => {
                        const newQs = [...quizForm.questions];
                        newQs[idx].question = e.target.value;
                        setQuizForm({ questions: newQs });
                      }}
                    />
                  </div>

                  <div className="space-y-4">
                    <Label>Multiple Choice Options</Label>
                    {q.options.map((opt, oIdx) => (
                      <div key={oIdx} className="flex gap-2 items-center">
                        <Badge 
                          variant={q.correctAnswerIndex === oIdx ? 'default' : 'outline'} 
                          className={cn("h-8 w-8 flex items-center justify-center rounded-sm cursor-pointer transition-all", q.correctAnswerIndex === oIdx ? "bg-green-600 border-green-600 shadow-sm" : "hover:border-primary/40")}
                          onClick={() => {
                            const newQs = [...quizForm.questions];
                            newQs[idx].correctAnswerIndex = oIdx;
                            setQuizForm({ questions: newQs });
                          }}
                        >
                          {String.fromCharCode(65 + oIdx)}
                        </Badge>
                        <Input 
                          placeholder={`Option ${String.fromCharCode(65 + oIdx)}`} 
                          value={opt}
                          onChange={e => {
                            const newQs = [...quizForm.questions];
                            newQs[idx].options[oIdx] = e.target.value;
                            setQuizForm({ questions: newQs });
                          }}
                          className={cn("rounded-sm", q.correctAnswerIndex === oIdx ? "border-green-500/50 bg-green-50/30" : "")}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <Button variant="outline" className="w-full border-dashed rounded-sm h-12 text-primary border-primary/20 hover:bg-primary/5" onClick={handleAddQuestion}>
                <Plus className="mr-2 h-4 w-4" /> Add Next Question
              </Button>
            </div>
          </ScrollArea>
          <DialogFooter className="p-6 border-t bg-muted/5">
            <DialogClose asChild><Button variant="outline" className="rounded-sm">Cancel</Button></DialogClose>
            <Button className="rounded-sm font-black shadow-md min-w-[150px]" onClick={handleCreateQuiz}>Finalize Quiz</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
