'use client'

import Link from "next/link"
import { useRouter } from 'next/navigation'
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { useAuth, useUser } from "@/firebase"
import { signInWithEmailAndPassword } from "firebase/auth"
import { useToast } from "@/hooks/use-toast"
import { Eye, EyeOff, Loader2 } from "lucide-react"

const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
})

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [showPassword, setShowPassword] = useState(false)
  const auth = useAuth()
  const { user } = useUser()

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      router.replace('/dashboard')
    }
  }, [user, router])

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })
  
  const onSubmit = async (values: z.infer<typeof loginSchema>) => {
    try {
      await signInWithEmailAndPassword(auth, values.email, values.password);
    } catch (error: any) {
      let description = "An unexpected error occurred during login.";
      let title = "Login Failed";

      // Consolidated error mapping to account for Firebase's ambiguous 'invalid-credential' code
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
          title = "Login Failed";
          description = "Incorrect credentials or account not found. Please check your password or register if you are a new user.";
      } else if (error.code === 'auth/network-request-failed') {
          description = "Network error. Please check your internet connection.";
      } else if (error.code === 'auth/user-disabled') {
          description = "This account has been disabled. Please contact project administration.";
      }
      
      toast({
        variant: "destructive",
        title: title,
        description: description,
      });
    }
  }

  if (user) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="mx-auto w-full max-w-sm animate-in fade-in zoom-in-95 duration-300">
        <CardHeader className="text-center pb-8 pt-10">
          <CardTitle className="text-3xl font-bold tracking-tight text-primary">Aditya Pro</CardTitle>
          <CardDescription className="mt-2">
            Sign in to your professional account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input placeholder="name@adityagreenenergy.com" {...field} className="rounded-sm" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                     <div className="flex items-center">
                        <FormLabel>Password</FormLabel>
                        <Link
                          href="/forgot-password"
                          className="ml-auto inline-block text-xs underline text-muted-foreground hover:text-primary transition-colors"
                        >
                          Forgot password?
                        </Link>
                      </div>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          type={showPassword ? "text" : "password"} 
                          {...field} 
                          className="pr-10 rounded-sm"
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full w-10 text-muted-foreground hover:bg-transparent"
                            onClick={() => setShowPassword((prev) => !prev)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          <span className="sr-only">{showPassword ? 'Hide password' : 'Show password'}</span>
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full h-11 rounded-sm font-bold" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Authenticating...</> : 'Sign In'}
              </Button>
            </form>
          </Form>
          <div className="mt-6 text-center text-sm text-muted-foreground">
            New to the platform?{" "}
            <Link href="/register" className="underline font-bold text-primary">
              Register Here
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
