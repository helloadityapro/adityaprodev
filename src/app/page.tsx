
import { redirect } from 'next/navigation';

export default function RootPage() {
  // Redirect to dashboard. The AppShell in layout.tsx will 
  // handle redirecting to /login if the user is not authenticated.
  redirect('/dashboard');
}
