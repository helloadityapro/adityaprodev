'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Award, ShieldCheck, Loader2, Share2 } from 'lucide-react';
import { format } from 'date-fns';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';

interface CertificateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  courseTitle: string;
  attempts: number;
}

export function CertificateDialog({ 
  open, 
  onOpenChange, 
  userName, 
  courseTitle, 
  attempts 
}: CertificateDialogProps) {
  const certificateRef = React.useRef<HTMLDivElement>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const { toast } = useToast();
  const [logoSrc, setLogoSrc] = React.useState('/icon.png');

  const handleDownload = async () => {
    if (!certificateRef.current) return;
    
    setIsProcessing(true);
    try {
      const canvas = await html2canvas(certificateRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      const imgWidth = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`AdityaPro_Certificate_${userName.replace(/\s+/g, '_')}.pdf`);
      
      toast({ title: 'Certificate Exported', description: 'Your completion document has been saved as PDF.' });
    } catch (error) {
      console.error('Certificate generation failed:', error);
      toast({ variant: 'destructive', title: 'Export Failed', description: 'Could not generate the certificate file.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleShare = async () => {
    if (!certificateRef.current) return;
    setIsProcessing(true);
    try {
      const canvas = await html2canvas(certificateRef.current, { scale: 2, useCORS: true });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], `AdityaPro_Certificate.png`, { type: 'image/png' });
        
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'My Course Completion Certificate',
            text: `I just earned a professional certificate for completing "${courseTitle}" on Aditya Pro!`,
          });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Certificate_${userName.replace(/\s+/g, '_')}.png`;
          a.click();
          URL.revokeObjectURL(url);
          toast({ title: 'Sharing Unavailable', description: 'Certificate downloaded as an image instead.' });
        }
      }, 'image/png');
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1000px] w-[98vw] h-[95vh] sm:h-auto sm:max-h-[95vh] p-0 overflow-hidden border-none shadow-2xl rounded-sm flex flex-col">
        <DialogHeader className="p-4 sm:p-6 bg-primary/5 border-b shrink-0 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-sm"><Award className="h-5 w-5 text-primary" /></div>
            <div>
              <DialogTitle className="text-base sm:text-xl font-black uppercase tracking-tight">Professional Certificate</DialogTitle>
              <DialogDescription className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hidden sm:block">Knowledge Milestone Verified</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden bg-muted/20 flex flex-col">
          <ScrollArea className="h-full w-full">
            <div className="p-4 sm:p-10 flex justify-center min-w-max sm:min-w-0">
               <div 
                  ref={certificateRef}
                  className="w-[800px] h-[565px] bg-white border-[12px] border-double border-primary/20 p-8 relative flex flex-col items-center justify-between text-center shadow-2xl shrink-0"
               >
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/5 rounded-tr-full" />
                
                {/* ✅ FIXED LOGO */}
                <div className="space-y-4 pt-4">
                  <div className="flex justify-center mb-2">
                    <img 
                      src={logoSrc} 
                      alt="Aditya Pro" 
                      crossOrigin="anonymous"
                      onError={() => setLogoSrc('https://placehold.co/240x80?text=ADITYA+PRO')}
                      className="h-24 w-auto object-contain"
                    />
                  </div>

                  {/* ✅ FIXED LETTER SPACING */}
                  <h4 
                    className="text-[10px] font-black uppercase text-primary"
                    style={{ letterSpacing: "0.4em" }}
                  >
                    Certificate of Completion
                  </h4>

                  <div className="h-0.5 w-64 bg-primary/20 mx-auto" />
                </div>

                <div className="space-y-4 flex-1 flex flex-col justify-center">
                  <p className="text-sm font-medium italic text-muted-foreground">
                    This is to officially certify that
                  </p>

                  <h2 className="text-4xl font-black tracking-tight text-foreground underline decoration-primary/10 underline-offset-8">
                    {userName}
                  </h2>

                  {/* ✅ FIXED WORD SPACING */}
                  <p 
                    className="text-sm font-medium text-muted-foreground max-w-lg mx-auto"
                    style={{ wordSpacing: "0.15em" }}
                  >
                    has successfully completed the course with proficiency
                  </p>

                  <h3 className="text-2xl font-black text-primary propercase tracking-tight leading-tight max-w-2xl">
                    {courseTitle}
                  </h3>
                </div>

                <div className="w-full grid grid-cols-3 items-end pb-8 border-t border-border/10 pt-8">
                  <div className="text-left space-y-1">
                    <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">Date Issued</p>
                    <p className="text-xs font-bold font-mono text-foreground">{format(new Date(), 'dd MMMM yyyy')}</p>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="relative">
                       <Award className="h-14 w-14 text-primary/10" />
                       <div className="absolute inset-0 flex items-center justify-center">
                         <ShieldCheck className="h-7 w-7 text-primary" />
                       </div>
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">Learning Effort</p>
                    <p className="text-xs font-bold uppercase text-foreground">{attempts} {attempts === 1 ? 'Attempt' : 'Attempts'}</p>
                  </div>
                </div>

                <div className="absolute bottom-4 right-4 opacity-30 pointer-events-none">
                  <p className="text-[7px] font-black uppercase tracking-[0.2em] -rotate-12">
                    Verification Ref: LMS-{Math.random().toString(36).substring(7).toUpperCase()}
                  </p>
                </div>
              </div>
            </div>
            <ScrollBar orientation="horizontal" />
            <ScrollBar orientation="vertical" />
          </ScrollArea>
        </div>

        <DialogFooter className="p-4 sm:p-6 bg-muted/5 border-t gap-3 shrink-0 flex flex-col sm:flex-row">
          <div className="grid grid-cols-2 sm:flex gap-3 w-full sm:w-auto">
            <Button 
              variant="outline" 
              onClick={handleShare}
              disabled={isProcessing}
              className="rounded-sm font-bold uppercase text-[10px] tracking-widest h-11 border-primary/20 text-primary hover:bg-primary/5"
            >
              <Share2 className="mr-2 h-4 w-4" /> Share
            </Button>
            <Button 
              onClick={handleDownload} 
              disabled={isProcessing}
              className="rounded-sm font-black uppercase text-[10px] tracking-widest shadow-xl h-11"
            >
              {isProcessing ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing</>
              ) : (
                <><Download className="mr-2 h-4 w-4" /> Save PDF</>
              )}
            </Button>
          </div>
          <DialogClose asChild>
            <Button variant="ghost" className="sm:hidden w-full h-10 text-[10px] font-bold uppercase text-muted-foreground">Close Window</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}