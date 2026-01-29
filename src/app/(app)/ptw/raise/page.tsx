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
import { useFirestore, useUser, addDocumentNonBlocking } from "@/firebase"
import { collection, serverTimestamp } from "firebase/firestore"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const raisePtwSchema = z.object({
  siteName: z.string().min(1, "Site is required"),
  ptwType: z.string().min(1, "Permit type is required"),
  descriptionOfWork: z.string().min(10, "Description must be at least 10 characters"),
  comments: z.string().optional(),
})

const ptwTypes = [
  "MMS columns concreting/erection work",
  "AC Cables cutting",
  "AC Cable Trench laying",
  "Civil works",
];

type SiteData = {
  'Project Company': string;
  'Project name': string;
  'AC Capacity': string;
  'DC Capacity': string;
};

const parseCSV = (csvText: string): SiteData[] => {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const dataRows = lines.slice(1);
  const data: SiteData[] = [];

  for (const line of dataRows) {
    const values = line.split(',').map(v => v.trim().replace(/\r/g, ''));
    if (values.length >= 5) {
      const entry: SiteData = {
        'Project Company': values[1],
        'Project name': values[2],
        'DC Capacity': values[3],
        'AC Capacity': values[4],
      };
      data.push(entry);
    }
  }
  return data;
};

export default function RaisePtwPage() {
  const firestore = useFirestore()
  const { user } = useUser()
  const router = useRouter()
  const { toast } = useToast()

  const [allSites, setAllSites] = React.useState<SiteData[]>([]);
  const [isSitePopoverOpen, setIsSitePopoverOpen] = React.useState(false);
  const [selectedSite, setSelectedSite] = React.useState<SiteData | null>(null);

  const form = useForm<z.infer<typeof raisePtwSchema>>({
    resolver: zodResolver(raisePtwSchema),
    defaultValues: {
      siteName: "",
      ptwType: "",
      descriptionOfWork: "",
      comments: "",
    },
  })

  const siteNameValue = form.watch('siteName');

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vT8JE2-QFEjU_CVprrrBPivhxoygAtkC8S6JFPTK8-R28EL9XuTTv7aJ3Onejmsp55_RQEvF8g7Ku1p/pub?gid=1131066411&single=true&output=csv');
        if (!response.ok) {
          throw new Error('Failed to fetch site data.');
        }
        const csvText = await response.text();
        const parsedData = parseCSV(csvText);
        setAllSites(parsedData);
      } catch (err: any) {
        toast({ variant: "destructive", title: "Error fetching sites", description: err.message });
      }
    };
    fetchData();
  }, [toast]);

  const filteredSites = React.useMemo(() => {
    if (!siteNameValue || siteNameValue.length < 3) return [];
    return allSites?.filter(site => site['Project name'].toLowerCase().includes(siteNameValue.toLowerCase())) || [];
  }, [siteNameValue, allSites]);
  
  React.useEffect(() => {
    if (selectedSite && siteNameValue !== selectedSite['Project name']) {
      setSelectedSite(null);
    }
  }, [siteNameValue, selectedSite]);

  React.useEffect(() => {
    const shouldBeOpen = !!(siteNameValue && siteNameValue.length >= 3 && filteredSites.length > 0 && (!selectedSite || selectedSite['Project name'] !== siteNameValue));
    setIsSitePopoverOpen(shouldBeOpen);
  }, [siteNameValue, filteredSites, selectedSite]);


  const handleSiteSelect = (site: SiteData) => {
    form.setValue('siteName', site['Project name'], { shouldValidate: true });
    setSelectedSite(site);
    setIsSitePopoverOpen(false);
  }

  const onSubmit = (values: z.infer<typeof raisePtwSchema>) => {
    if (!user) {
        toast({ variant: "destructive", title: "You must be logged in to submit a permit." });
        return;
    }
    if(!selectedSite || values.siteName !== selectedSite['Project name']) {
        form.setError('siteName', { type: 'manual', message: 'Please select a valid site from the list.' });
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
              <div className="grid gap-2">
                <Label>Requesting Engineer</Label>
                <Input readOnly value={user?.displayName || user?.email || ''} className="bg-muted"/>
              </div>

              <FormField
                  control={form.control}
                  name="siteName"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Site Name</FormLabel>
                      <Popover open={isSitePopoverOpen} onOpenChange={setIsSitePopoverOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Input
                              placeholder="Type to search for a site..."
                              {...field}
                            />
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                          {filteredSites.length > 0 ? (
                            <ul className="py-1">
                              {filteredSites.map((site, index) => (
                                <li key={index}>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    className="w-full justify-start font-normal"
                                    onClick={() => handleSiteSelect(site)}
                                  >
                                    {site['Project name']}
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="p-4 text-sm text-center text-muted-foreground">
                              {siteNameValue && siteNameValue.length < 3 ? "Type at least 3 characters" : "No sites found."}
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
              />
              
              {selectedSite && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Site Details</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="text-muted-foreground">Project Company</p>
                        <p className="font-medium">{selectedSite['Project Company']}</p>
                    </div>
                     <div>
                        <p className="text-muted-foreground">AC Capacity</p>
                        <p className="font-medium">{selectedSite['AC Capacity']}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">DC Capacity</p>
                        <p className="font-medium">{selectedSite['DC Capacity']}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              <FormField
                  control={form.control}
                  name="ptwType"
                  render={({ field }) => (
                      <FormItem>
                          <FormLabel>PTW for</FormLabel>
                           <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                              <SelectTrigger>
                                  <SelectValue placeholder="Select a permit type" />
                              </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                  {ptwTypes.map((type) => (
                                  <SelectItem key={type} value={type}>{type}</SelectItem>
                                  ))}
                              </SelectContent>
                          </Select>
                          <FormMessage />
                      </FormItem>
                  )}
              />

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
                      <Label htmlFor="work-video">Attach video and photos</Label>
                      <div className="flex items-center gap-2">
                          <FileVideo className="h-5 w-5 text-muted-foreground"/>
                          <Input id="work-video" type="file" className="border-dashed" multiple />
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
                          <FormLabel>Additional Comments and Remarks</FormLabel>
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
