
'use client'

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import AppLogo from "@/components/app-logo"
import { useAuth, useUser } from "@/firebase"
import { sendPasswordResetEmail } from "firebase/auth"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft } from "lucide-react"

const forgotPasswordSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
})

export default function ForgotPasswordPage() {
  const router = useRouter()
  const { toast } = useToast()
  const auth = useAuth()
  const { user } = useUser()

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      router.replace('/dashboard')
    }
  }, [user, router])

  const form = useForm<z.infer<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  })

  const onSubmit = async (values: z.infer<typeof forgotPasswordSchema>) => {
    try {
      await sendPasswordResetEmail(auth, values.email)
      toast({
        title: "Check your email",
        description: "If an account with this email exists, a password reset link has been sent.",
        variant: 'success',
      })
      form.reset()
    } catch (error: any) {
        // Even on error, show a generic success message to prevent email enumeration
        toast({
            title: "Check your email",
            description: "If an account with this email exists, a password reset link has been sent.",
            variant: 'success',
        });
    }
  }

  if (user) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="mx-auto w-full max-w-sm animate-in fade-in zoom-in-95 duration-300">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <AppLogo />
          </div>
          <CardTitle className="text-2xl font-headline">Forgot Password</CardTitle>
          <CardDescription>
            Enter your email and we'll send you a link to reset your password.
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
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="m@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Sending...' : 'Send Reset Link'}
              </Button>
            </form>
          </Form>
          <div className="mt-4 text-center text-sm">
            <Link href="/login" className="inline-flex items-center gap-1 underline font-medium">
                <ArrowLeft className="h-4 w-4" />
                Back to login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
