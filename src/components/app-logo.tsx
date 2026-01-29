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
            <path d="M14 2v6h6" />
            <path d="M10 16s.5-1 2-1 2 1 2 1" />
            <path d="M12 11.5a2.5 2.5 0 0 1 0 5" />
        </svg>
      <span className="font-headline text-xl font-semibold">Project Permits</span>
    </div>
  );
}
