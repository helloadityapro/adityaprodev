"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { FileVideo, Video } from "lucide-react"
import { useCollection, useFirestore, useUser, addDocumentNonBlocking, useMemoFirebase } from "@/firebase"
import { collection, serverTimestamp } from "firebase/firestore"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const raisePtwSchema = z.object({
  siteId: z.string().min(1, "Site is required"),
  ptwTypeId: z.string().min(1, "Permit type is required"),
  descriptionOfWork: z.string().min(10, "Description must be at least 10 characters"),
  comments: z.string().optional(),
})

type Site = { id: string; name: string };

export default function RaisePtwPage() {
  const firestore = useFirestore()
  const { user } = useUser()
  const router = useRouter()
  const { toast } = useToast()

  const [siteSearch, setSiteSearch] = React.useState("");
  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const ptwTypesQuery = useMemoFirebase(() => collection(firestore, 'permit_to_work_types'), [firestore]);

  const { data: sites } = useCollection<Site>(sitesQuery);
  const { data: ptwTypes } = useCollection(ptwTypesQuery);

  const form = useForm<z.infer<typeof raisePtwSchema>>({
    resolver: zodResolver(raisePtwSchema),
    defaultValues: {
      siteId: "",
      ptwTypeId: "",
      descriptionOfWork: "",
      comments: "",
    },
  })

  const filteredSites = React.useMemo(() => {
    if (siteSearch.length < 3) return [];
    return sites?.filter(site => site.name.toLowerCase().includes(siteSearch.toLowerCase())) || [];
  }, [siteSearch, sites]);

  React.useEffect(() => {
    if(siteSearch.length >= 3) {
      setIsSitePopoverOpen(true);
    } else {
      setIsSitePopoverOpen(false);
    }
  }, [siteSearch]);


  const onSubmit = (values: z.infer<typeof raisePtwSchema>) => {
    if (!user) {
        toast({ variant: "destructive", title: "You must be logged in to submit a permit." });
        return;
    }
    const permitData = {
      ...values,
      siteEngineerId: user.uid,
      status: "Pending",
      requestDate: serverTimestamp(),
      commentsAndRemarks: values.comments,
    }
    addDocumentNonBlocking(collection(firestore, "permits_to_work"), permitData);
    toast({ title: "Success", description: "Your permit request has been submitted." });
    router.push('/ptw/list');
  }

  return (
    <>
      <h1 className="text-lg font-headline font-semibold md:text-2xl">Raise a Permit to Work</h1>
      <Card className="w-full max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>New PtW Request</CardTitle>
          <CardDescription>Fill out the form below to submit a new permit request.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="siteId"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Select Site</FormLabel>
                        <Popover open={isSitePopoverOpen} onOpenChange={setIsSitePopoverOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Input
                                placeholder="Type to search for a site..."
                                value={siteSearch}
                                onChange={(e) => setSiteSearch(e.target.value)}
                                className="w-full"
                              />
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            {filteredSites.length > 0 ? (
                              <ul className="py-1">
                                {filteredSites.map((site) => (
                                  <li key={site.id}>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      className="w-full justify-start font-normal"
                                      onClick={() => {
                                        field.onChange(site.id);
                                        setSiteSearch(site.name);
                                        setIsSitePopoverOpen(false);
                                      }}
                                    >
                                      {site.name}
                                    </Button>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <div className="p-4 text-sm text-center text-muted-foreground">
                                {siteSearch.length < 3 ? "Type at least 3 characters" : "No sites found."}
                              </div>
                            )}
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="ptwTypeId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Select PtW Type</FormLabel>
                             <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a permit type" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {ptwTypes?.map((type) => (
                                    <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
              </div>
                <FormField
                    control={form.control}
                    name="descriptionOfWork"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Description of Work</FormLabel>
                            <FormControl>
                                <Textarea placeholder="Provide a detailed description of the work to be performed." rows={4} {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="grid gap-2">
                    <Label htmlFor="work-video">Attach video of work</Label>
                    <div className="flex items-center gap-2">
                        <FileVideo className="h-5 w-5 text-muted-foreground"/>
                        <Input id="work-video" type="file" className="border-dashed" />
                    </div>
                </div>
                 <div className="grid gap-2">
                    <Label htmlFor="vlog">Attach vlog of engineer</Label>
                     <div className="flex items-center gap-2">
                        <Video className="h-5 w-5 text-muted-foreground"/>
                        <Input id="vlog" type="file" className="border-dashed" />
                    </div>
                </div>
            </div>

            <FormField
                control={form.control}
                name="comments"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Comments and Remarks</FormLabel>
                        <FormControl>
                            <Textarea placeholder="Any additional comments or remarks." {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <div className="flex justify-end">
              <Button type="submit">Submit Request</Button>
            </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </>
  )
}
