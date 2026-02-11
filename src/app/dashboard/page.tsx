'use client';
import { useState, useEffect, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

// Define the type for our site data
type SiteData = {
  'Project Company': string;
  'Project name': string;
  'AC Capacity': string;
  'DC Capacity': string;
};

// Simple CSV to JSON parser
const parseCSV = (csvText: string): SiteData[] => {
  const lines = csvText.trim().split('\n');
  const data: SiteData[] = [];

  // Iterate over lines, skipping the header (i=1)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const values = line.split(',').map(v => v.trim().replace(/\r/g, ''));
    
    // A valid project row has a number in the first column ("Sr No") and a non-empty project name.
    if (values.length >= 5 && !isNaN(parseInt(values[0], 10)) && values[2] && values[2].trim() !== '') {
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


function DashboardSkeleton() {
    return (
      <div className="animate-pulse">
        <div className="flex items-center mb-6">
            <Skeleton className="h-9 w-48" />
        </div>
        <Card>
            <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-4 w-64 mt-1" />
                  </div>
                  <Skeleton className="h-10 w-full md:w-72" />
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead><Skeleton className="h-5 w-32" /></TableHead>
                            <TableHead><Skeleton className="h-5 w-32" /></TableHead>
                            <TableHead><Skeleton className="h-5 w-24" /></TableHead>
                            <TableHead><Skeleton className="h-5 w-24" /></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={i}>
                                <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
      </div>
    );
}

export default function DashboardPage() {
  const [sites, setSites] = useState<SiteData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vT8JE2-QFEjU_CVprrrBPivhxoygAtkC8S6JFPTK8-R28EL9XuTTv7aJ3Onejmsp55_RQEvF8g7Ku1p/pub?gid=1131066411&single=true&output=csv');
        if (!response.ok) {
          throw new Error('Failed to fetch data from Google Sheet.');
        }
        const csvText = await response.text();
        const parsedData = parseCSV(csvText);
        setSites(parsedData);
      } catch (err: any) {
        setError(err.message || 'An error occurred while fetching data.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredSites = useMemo(() => {
    return sites.filter(site => 
      site['Project Company'].toLowerCase().includes(searchTerm.toLowerCase()) ||
      site['Project name'].toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [sites, searchTerm]);

  if (isLoading) return <DashboardSkeleton />;
  if (error) return <p>Error: {error}</p>;

  return (
    <>
      <div className="flex items-center">
        <h1 className="text-3xl font-bold tracking-tight">Site Projects</h1>
      </div>
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Site Details</CardTitle>
              <CardDescription>An overview of sites from the connected Google Sheet.</CardDescription>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search projects or companies..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project Company</TableHead>
                <TableHead>Project Name</TableHead>
                <TableHead>AC Capacity</TableHead>
                <TableHead>DC Capacity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSites.length > 0 ? (
                filteredSites.map((site, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{site['Project Company']}</TableCell>
                    <TableCell>{site['Project name']}</TableCell>
                    <TableCell>{site['AC Capacity']}</TableCell>
                    <TableCell>{site['DC Capacity']}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    {searchTerm ? `No results found for "${searchTerm}"` : "No site data found in the Google Sheet."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  )
}
