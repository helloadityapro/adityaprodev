'use client';
import { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

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
  if (lines.length < 2) return [];
  
  // Handle potential carriage returns in headers
  const headers = lines[0].split(',').map(h => h.trim().replace(/\r/g, ''));
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    // Handle potential carriage returns in data rows
    const values = lines[i].split(',').map(v => v.trim().replace(/\r/g, ''));
    if (values.length === headers.length) {
      const entry: any = {};
      for (let j = 0; j < headers.length; j++) {
        entry[headers[j]] = values[j];
      }
      data.push(entry as SiteData);
    }
  }
  return data;
};


export default function DashboardPage() {
  const [sites, setSites] = useState<SiteData[]>([]);
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

  if (isLoading) return <p>Loading site data from Google Sheet...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <>
      <div className="flex items-center">
        <h1 className="text-lg font-headline font-semibold md:text-2xl">Site Projects</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Site Details</CardTitle>
          <CardDescription>An overview of sites from the connected Google Sheet.</CardDescription>
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
              {sites.length > 0 ? (
                sites.map((site, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{site['Project Company']}</TableCell>
                    <TableCell>{site['Project name']}</TableCell>
                    <TableCell>{site['AC Capacity']}</TableCell>
                    <TableCell>{site['DC Capacity']}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center">
                    No site data found in the Google Sheet.
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
