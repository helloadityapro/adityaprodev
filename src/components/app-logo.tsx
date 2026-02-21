
'use client';

import { cn } from "@/lib/utils";
import Image from "next/image";
import { PlaceHolderImages } from "@/lib/placeholder-images";

export default function AppLogo({ className }: { className?: string }) {
  const logoData = PlaceHolderImages.find(img => img.id === 'app-logo');

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <div className="relative h-16 w-16 overflow-hidden rounded-sm border-2 border-primary/20 bg-white p-1 shadow-lg shadow-primary/10">
        {logoData && (
          <Image
            src={logoData.imageUrl}
            alt="App Logo"
            fill
            className="object-contain"
            data-ai-hint={logoData.imageHint}
          />
        )}
      </div>
    </div>
  );
}
