
'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Award, ShieldCheck, Printer, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { cn } from '@/lib/utils';

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
  const [isExporting, setIsProcessing] = React.useState(false);

  const handleDownload = async () => {
    if (!certificateRef.current) return;
    
    setIsProcessing(true);
    try {
      const canvas = await html2canvas(certificateRef.current, {
        scale: 3, // High DPI
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      const imgWidth = 297; // A4 Landscape width
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`Certificate_${courseTitle.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error('Certificate generation failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] p-0 overflow-hidden border-none shadow-2xl rounded-sm">
        <DialogHeader className="p-6 bg-primary/5 border-b shrink-0 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-sm"><Award className="h-5 w-5 text-primary" /></div>
            <div>
              <DialogTitle className="text-xl font-black uppercase tracking-tight">Course Completion Certificate</DialogTitle>
              <DialogDescription className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Certified Professional Growth</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 sm:p-10 bg-muted/30 flex justify-center">
          {/* Certificate Design Container */}
          <div 
            ref={certificateRef}
            className="w-[800px] h-[565px] bg-white border-[12px] border-double border-primary/20 p-8 relative flex flex-col items-center justify-between text-center shadow-inner overflow-hidden"
          >
            {/* Background elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/5 rounded-tr-full" />
            
            {/* Header */}
            <div className="space-y-4 pt-10">
              <div className="flex justify-center mb-2">
                <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <ShieldCheck className="h-10 w-10 text-primary" />
                </div>
              </div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">Certificate of Completion</h4>
              <div className="h-0.5 w-48 bg-primary/20 mx-auto" />
            </div>

            {/* Content */}
            <div className="space-y-8 flex-1 flex flex-col justify-center">
              <p className="text-sm font-medium italic text-muted-foreground">This is to certify that</p>
              <h2 className="text-4xl font-black tracking-tight text-foreground underline decoration-primary/20 underline-offset-8">
                {userName}
              </h2>
              <p className="text-sm font-medium text-muted-foreground max-w-lg mx-auto">
                has successfully completed the training curriculum for the course
              </p>
              <h3 className="text-2xl font-black text-primary uppercase tracking-tight">
                {courseTitle}
              </h3>
            </div>

            {/* Footer / Stats */}
            <div className="w-full grid grid-cols-3 items-end pb-8">
              <div className="text-left space-y-1">
                <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Issued On</p>
                <p className="text-xs font-bold font-mono">{format(new Date(), 'dd MMMM yyyy')}</p>
              </div>
              <div className="flex flex-col items-center">
                <div className="relative">
                   <Award className="h-16 w-16 text-primary/10" />
                   <div className="absolute inset-0 flex items-center justify-center">
                     <p className="text-[10px] font-black uppercase text-primary">Official</p>
                   </div>
                </div>
              </div>
              <div className="text-right space-y-1">
                <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Assessment Records</p>
                <p className="text-xs font-bold uppercase">{attempts} {attempts === 1 ? 'Attempt' : 'Attempts'} to complete</p>
              </div>
            </div>
            
            {/* Authenticity Watermark */}
            <div className="absolute bottom-4 right-4 opacity-10 pointer-events-none">
              <p className="text-[8px] font-black uppercase tracking-[0.2em] -rotate-12">Aditya Pro Learning Engine</p>
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 bg-muted/5 border-t gap-3 shrink-0 sm:justify-between">
          <p className="hidden sm:block text-[10px] font-bold text-muted-foreground uppercase italic px-2">
            Verification ID: {Math.random().toString(36).substring(2, 10).toUpperCase()}
          </p>
          <div className="flex gap-2 w-full sm:w-auto">
            <DialogClose asChild>
              <Button variant="outline" className="flex-1 sm:flex-none h-10 rounded-sm font-bold uppercase text-[10px]">Cancel</Button>
            </DialogClose>
            <Button 
              onClick={handleDownload} 
              disabled={isExporting}
              className="flex-1 sm:flex-none h-10 rounded-sm font-black uppercase text-[10px] tracking-widest shadow-md"
            >
              {isExporting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
              ) : (
                <><Download className="mr-2 h-4 w-4" /> Download PDF</>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
