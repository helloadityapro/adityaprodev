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
import { useAuth, useFirestore, setDocumentNonBlocking, useUser, useDoc, useMemoFirebase, useCollection } from "@/firebase"
import { useToast } from "@/hooks/use-toast"
import { createUserWithEmailAndPassword } from "firebase/auth"
import { doc, serverTimestamp, collection } from "firebase/firestore"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, CheckCircle2 } from "lucide-react"

const registerSchema = z.object({
  username: z.string().min(1, { message: "Username is required." }),
  email: z.string().email({ message: "Invalid email address." }),
  mobile: z.string().min(1, { message: "Mobile number is required." }),
  role: z.string().min(1, "Please select a role."),
  department: z.string().min(1, "Please select a department."),
  dob: z.string().min(1, "Date of Birth is required."),
  doj: z.string().min(1, "Date of Joining is required."),
  aadharNumber: z.string().min(12, "Aadhar Number must be 12 digits.").max(12, "Aadhar Number must be 12 digits."),
  panNumber: z.string().min(10, "PAN Number must be 10 characters.").max(10, "PAN Number must be 10 characters."),
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

  const rolesQuery = useMemoFirebase(() => collection(firestore, 'user_roles'), [firestore]);
  const { data: roles } = useCollection<{ name: string }>(rolesQuery);

  const deptsQuery = useMemoFirebase(() => collection(firestore, 'user_departments'), [firestore]);
  const { data: departments } = useCollection<{ name: string }>(deptsQuery);

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
      role: "",
      department: "",
      dob: "",
      doj: "",
      aadharNumber: "",
      panNumber: "",
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
        department: values.department,
        dob: values.dob,
        doj: values.doj,
        aadharNumber: values.aadharNumber,
        panNumber: values.panNumber,
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
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 py-12">
        <Card className="mx-auto w-full max-w-md text-center py-10 shadow-xl border-primary/10 rounded-sm">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle className="text-2xl font-black uppercase tracking-tight">ACCOUNT CREATED</CardTitle>
            <CardDescription className="text-base font-medium">
              Profile initialized successfully.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your request for access to Aditya Pro has been received. Project administration will review and verify your credentials shortly. You will be notified once access is granted.
            </p>
            <div className="flex flex-col gap-2">
              <Button asChild className="w-full rounded-sm font-bold shadow-md h-12">
                <Link href="/login">Return to Sign In</Link>
              </Button>
              <Button variant="outline" onClick={() => auth.signOut()} className="w-full rounded-sm font-bold border-primary/20">
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 py-12">
      <Card className="mx-auto w-full max-w-lg animate-in fade-in zoom-in-95 duration-300">
        <CardHeader className="text-center pb-8 pt-10">
          <CardTitle className="text-3xl font-bold tracking-tight text-primary">Aditya Pro</CardTitle>
          <CardDescription className="mt-2">
            Create your Aditya Pro account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-foreground">Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter your full name" {...field} className="rounded-sm h-11" />
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
                      <FormLabel className="text-sm font-semibold text-foreground">Email</FormLabel>
                      <FormControl>
                        <Input placeholder="name@adityagreenenergy.com" {...field} className="rounded-sm h-11" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="mobile"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-foreground">Contact Number</FormLabel>
                      <FormControl>
                        <Input placeholder="10-digit mobile number" {...field} className="rounded-sm h-11" />
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
                      <FormLabel className="text-sm font-semibold text-foreground">Designation</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                              <SelectTrigger className="rounded-sm h-11">
                                  <SelectValue placeholder="Select Designation" />
                              </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                              {roles?.length ? roles.map(r => (
                                <SelectItem key={r.id} value={r.name} className="font-medium">{r.name}</SelectItem>
                              )) : (
                                <>
                                  <SelectItem value="Site Engineer">Site Engineer</SelectItem>
                                  <SelectItem value="Site Manager">Site Manager</SelectItem>
                                  <SelectItem value="Driver">Driver</SelectItem>
                                </>
                              )}
                          </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-foreground">Department</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                            <SelectTrigger className="rounded-sm h-11">
                                <SelectValue placeholder="Select Department" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {departments?.length ? departments.map(d => (
                              <SelectItem key={d.id} value={d.name} className="font-medium">{d.name}</SelectItem>
                            )) : (
                              <>
                                <SelectItem value="Projects">Projects</SelectItem>
                                <SelectItem value="O&M">O&M</SelectItem>
                              </>
                            )}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="dob"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-foreground">Date of Birth</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} className="rounded-sm h-11" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="doj"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-foreground">Date of Joining</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} className="rounded-sm h-11" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="aadharNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-foreground">Aadhar Number</FormLabel>
                      <FormControl>
                        <Input placeholder="12-digit number" {...field} className="rounded-sm h-11" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="panNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-foreground">PAN Number</FormLabel>
                      <FormControl>
                        <Input placeholder="10-character code" {...field} className="rounded-sm h-11 uppercase" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-foreground">Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} className="rounded-sm h-11" />
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
                      <FormLabel className="text-sm font-semibold text-foreground">Confirm Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} className="rounded-sm h-11" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" className="w-full rounded-sm h-12 font-bold text-sm shadow-xl tracking-wider" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Finalizing Profile...</>
                ) : (
                  user ? 'Restore My Profile' : 'Create an account'
                )}
              </Button>
            </form>
          </Form>
          <div className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-bold text-primary hover:underline">
              Sign In
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}