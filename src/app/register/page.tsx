
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
import { useAuth, useFirestore, setDocumentNonBlocking, useUser } from "@/firebase"
import { useToast } from "@/hooks/use-toast"
import { createUserWithEmailAndPassword } from "firebase/auth"
import { doc, serverTimestamp } from "firebase/firestore"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const registerSchema = z.object({
  username: z.string().min(1, { message: "Username is required." }),
  email: z.string().email({ message: "Invalid email address." }),
  mobile: z.string().min(1, { message: "Mobile number is required." }),
  role: z.enum(['SiteEngineer', 'Site Manager'], { required_error: "Please select a role." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

export default function RegisterPage() {
  const router = useRouter()
  const auth = useAuth()
  const firestore = useFirestore()
  const { toast } = useToast()
  const { user } = useUser()

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      router.replace('/dashboard')
    }
  }, [user, router])

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      mobile: "",
      password: "",
      confirmPassword: "",
      role: undefined,
    },
  })

  const onSubmit = async (values: z.infer<typeof registerSchema>) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password)
      const newUser = userCredential.user

      const userDoc = {
        id: newUser.uid,
        username: values.username,
        email: values.email,
        mobile: values.mobile,
        role: values.role,
        registrationRequest: true,
        assignedProjectIds: [],
        createdAt: serverTimestamp(),
      }

      setDocumentNonBlocking(doc(firestore, "users", newUser.uid), userDoc, { merge: true })

      toast({
        title: "Registration successful!",
        description: "Your account has been created and is pending approval.",
      })
      // The AppShell logic in layout.tsx will handle the pending approval state
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: error.message || "Could not create account.",
      })
    }
  }

  if (user) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="mx-auto w-full max-w-md animate-in fade-in zoom-in-95 duration-300">
        <CardHeader className="text-center">
            <div className="mb-4 flex justify-center">
                <AppLogo />
            </div>
          <CardTitle className="text-2xl font-headline">Create an account</CardTitle>
          <CardDescription>
            Enter your information to create an account. Your account will need admin approval.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
              <FormField
                control={form.control}
                name="mobile"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mobile Number</FormLabel>
                    <FormControl>
                      <Input placeholder="+1 234 567 890" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a role for your account" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="SiteEngineer">Site Engineer</SelectItem>
                            <SelectItem value="Site Manager">Site Manager</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Creating account...' : 'Create an account'}
              </Button>
            </form>
          </Form>
          <div className="mt-4 text-center text-sm">
            Already have an account?{" "}
            <Link href="/login" className="underline font-medium">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
