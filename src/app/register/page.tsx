'use client'

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { useAuth, useFirestore, setDocumentNonBlocking, useUser, useDoc, useMemoFirebase } from "@/firebase"
import { useToast } from "@/hooks/use-toast"
import { createUserWithEmailAndPassword } from "firebase/auth"
import { doc, serverTimestamp } from "firebase/firestore"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, CheckCircle2 } from "lucide-react"

const registerSchema = z.object({
  username: z.string().min(1, { message: "Username is required." }),
  email: z.string().email({ message: "Invalid email address." }),
  mobile: z.string().min(1, { message: "Mobile number is required." }),
  role: z.enum(['Site Engineer', 'Site Manager'], { required_error: "Please select a role." }),
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
  const [isSuccess, setIsSuccess] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);

  useEffect(() => {
    if (mounted && user && userProfile && !isProfileLoading && !userProfile.registrationRequest) {
      router.replace('/rewards')
    }
  }, [user, userProfile, isProfileLoading, router, mounted])

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
      let uid = user?.uid;

      if (!uid) {
        const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password)
        uid = userCredential.user.uid;
      }

      const userDoc = {
        id: uid,
        username: values.username,
        email: values.email,
        mobile: values.mobile,
        role: values.role,
        registrationRequest: true,
        assignedProjectIds: [],
        totalPoints: 0,
        pointsMultiplier: 1,
        createdAt: serverTimestamp(),
      }

      setDocumentNonBlocking(doc(firestore, "users", uid), userDoc, { merge: true })

      setIsSuccess(true);
      toast({
        title: "Registration successful!",
        description: "Your professional profile has been initialized and is pending approval.",
      })
    } catch (error: any) {
      let title = "Uh oh! Something went wrong.";
      let description = error.message || "Could not create account.";

      if (error.code === 'auth/email-already-in-use') {
        title = "Account Already Exists";
        description = "This email is already registered. Please login to your existing account to restore your profile.";
      }

      toast({
        variant: "destructive",
        title: title,
        description: description,
      })
    }
  }

  if (!mounted) return null;

  if (isSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="mx-auto w-full max-w-md text-center py-10">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle className="text-2xl font-bold">Registration Pending</CardTitle>
            <CardDescription className="text-lg">
              Account created successfully.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your request for access to Aditya Pro has been received. Project administration will review and approve your credentials shortly.
            </p>
            <Button variant="outline" onClick={() => auth.signOut()} className="w-full">
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="mx-auto w-full max-w-md animate-in fade-in zoom-in-95 duration-300">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-headline">Create an account</CardTitle>
          <CardDescription>
            {user ? "Your profile was missing. Please complete registration to gain access." : "Enter your information to create an account. Admin approval is required."}
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
                      <Input placeholder="8989898989" {...field} />
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
                            <SelectItem value="Site Engineer">Site Engineer</SelectItem>
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
                {form.formState.isSubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
                ) : (
                  user ? 'Restore Profile' : 'Create an account'
                )}
              </Button>
            </form>
          </Form>
          <div className="mt-4 text-center text-sm">
            Already have an account?{" "}
            <Link href="/login" className="underline font-medium text-primary">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
