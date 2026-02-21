
'use client';

import { cn } from "@/lib/utils";
import Image from "next/image";
import { PlaceHolderImages } from "@/lib/placeholder-images";

export default function AppLogo({ className }: { className?: string }) {
  const logoData = PlaceHolderImages.find(img => img.id === 'app-logo');

  return (
    <div className={cn("flex items-center gap-2 p-2", className)}>
      <div className="relative h-12 w-12 overflow-hidden rounded-sm border-2 border-primary/20 shadow-lg shadow-primary/10">
        {logoData && (
          <Image
            src={logoData.imageUrl}
            alt="Aditya Logo"
            fill
            className="object-cover"
            data-ai-hint={logoData.imageHint}
          />
        )}
      </div>
      <div className="flex flex-col">
        <span className="font-headline text-lg font-bold tracking-tight text-foreground leading-none">Aditya Pro</span>
      </div>
    </div>
  );
}
