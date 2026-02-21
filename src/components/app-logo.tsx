
'use client';

import { cn } from "@/lib/utils";
import Image from "next/image";
import { PlaceHolderImages } from "@/lib/placeholder-images";

export default function AppLogo({ className }: { className?: string }) {
  const logoData = PlaceHolderImages.find(img => img.id === 'app-logo');

  return (
    <div className={cn("flex flex-col items-center gap-1 p-4", className)}>
      <div className="relative h-16 w-16 overflow-hidden rounded-sm border-2 border-primary/20 bg-white p-1 shadow-lg shadow-primary/10">
        {logoData && (
          <Image
            src={logoData.imageUrl}
            alt="Aditya Logo"
            fill
            className="object-contain"
            data-ai-hint={logoData.imageHint}
          />
        )}
      </div>
      <div className="flex flex-col items-center">
        <span className="font-headline text-xl font-black tracking-tighter text-foreground uppercase leading-none">Aditya</span>
      </div>
    </div>
  );
}
