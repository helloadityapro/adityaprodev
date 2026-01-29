"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { mockSites, mockPtwTypes } from "@/lib/data"
import { FileVideo, Video } from "lucide-react"

export default function RaisePtwPage() {
  return (
    <>
      <h1 className="text-lg font-headline font-semibold md:text-2xl">Raise a Permit to Work</h1>
      <Card className="w-full max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>New PtW Request</CardTitle>
          <CardDescription>Fill out the form below to submit a new permit request.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="site">Select Site</Label>
                <Select>
                  <SelectTrigger id="site">
                    <SelectValue placeholder="Select a site" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockSites.map((site) => (
                      <SelectItem key={site} value={site}>{site}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ptw-type">Select PtW Type</Label>
                <Select>
                  <SelectTrigger id="ptw-type">
                    <SelectValue placeholder="Select a permit type" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockPtwTypes.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description of Work</Label>
              <Textarea id="description" placeholder="Provide a detailed description of the work to be performed." rows={4}/>
            </div>

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

            <div className="grid gap-2">
              <Label htmlFor="comments">Comments and Remarks</Label>
              <Textarea id="comments" placeholder="Any additional comments or remarks." />
            </div>

            <div className="flex justify-end">
              <Button type="submit">Submit Request</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  )
}
