
'use client';

import { cn } from "@/lib/utils";
import Image from "next/image";
import { PlaceHolderImages } from "@/lib/placeholder-images";

export default function AppLogo({ className }: { className?: string }) {
  const logoData = PlaceHolderImages.find(img => img.id === 'app-logo');

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative h-10 w-10 overflow-hidden rounded-sm">
        {logoData && (
          <Image
            src={logoData.imageUrl}
            alt="Aditya Logo"
            width={40}
            height={40}
            className="object-contain"
            data-ai-hint={logoData.imageHint}
          />
        )}
      </div>
      <span className="font-headline text-xl font-bold tracking-tight">Aditya Pro</span>
    </div>
  );
}
