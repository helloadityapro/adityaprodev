import { cn } from "@/lib/utils";

export default function AppLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
        <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-primary"
        >
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
            <path d="m10.5 17.5 3-3" />
            <path d="m13.5 17.5-3-3" />
            <path d="M8 14h.01" />
        </svg>
      <span className="font-headline text-xl font-semibold">Project Permits</span>
    </div>
  );
}
