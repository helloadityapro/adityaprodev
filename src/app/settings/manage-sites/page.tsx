'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { Trash2, Search, MapPin, Loader2, Plus, Database, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { isSuperAdmin } from '@/lib/auth-constants';

const siteSchema = z.object({
  name: z.string().min(1, 'Site name is required.'),
  projectCompany: z.string().min(1, 'Project company is required.'),
  acCapacity: z.string().min(1, 'AC capacity is required.'),
  dcCapacity: z.string().min(1, 'DC capacity is required.'),
});

const GLOBAL_SITES_BOOTSTRAP = [
  { projectCompany: "HTI Energies And Infra Private Limited", name: "Shahapur - 194082", dcCapacity: "5.174", acCapacity: "4.000" },
  { projectCompany: "Annusaya Construction Green Energy Private Limited", name: "Tapse Chincholi - 154099", dcCapacity: "6.283", acCapacity: "5.000" },
  { projectCompany: "Urgunde Solar Power Energy Private Limited", name: "Bardapur - 54014", dcCapacity: "3.788", acCapacity: "3.000" },
  { projectCompany: "Bidada Industries Private Limited", name: "Lamjana - 154026", dcCapacity: "2.495", acCapacity: "2.000" },
  { projectCompany: "Yashprabha Green Energy Private Limited", name: "Bitargaon - 154084", dcCapacity: "7.608", acCapacity: "6.000" },
  { projectCompany: "Kalpkala Solar Power Private Limited", name: "Bhatangali - 154094", dcCapacity: "1.355", acCapacity: "1.000" },
  { projectCompany: "Shivni Majra Solar Power Private Limited", name: "Shivankhed - 154080", dcCapacity: "6.283", acCapacity: "5.000" },
  { projectCompany: "Punpale Brothers Green Energy Private Limited", name: "Renapur - 154007", dcCapacity: "9.055", acCapacity: "7.000" },
  { projectCompany: "Aviraj Green Energy Private Limited", name: "Narangwadi - 194028", dcCapacity: "2.587", acCapacity: "2.000" },
  { projectCompany: "Ravikiran Green Energy Private Limited", name: "Kumtha - 154079", dcCapacity: "6.273", acCapacity: "5.000" },
  { projectCompany: "Ravikiran Green Energy Private Limited", name: "Devangara - 154117", dcCapacity: "6.334", acCapacity: "5.000" },
  { projectCompany: "Mahira Renewable Energy Private Limited", name: "Halli - 154012", dcCapacity: "10.556", acCapacity: "8.000" },
  { projectCompany: "Jagruti Sugar & Allied Industries Limited", name: "Lohara - 194016", dcCapacity: "13.987", acCapacity: "11.000" },
  { projectCompany: "Jagruti Sugar & Allied Industries Limited", name: "Tawshigad - 195000", dcCapacity: "5.205", acCapacity: "4.000" },
  { projectCompany: "Jagruti Sugar & Allied Industries Limited", name: "Walandi - 154023", dcCapacity: "10.377", acCapacity: "8.000" },
  { projectCompany: "Jagruti Sugar & Allied Industries Limited", name: "Babhalgaon - 154033", dcCapacity: "11.414", acCapacity: "9.000" },
  { projectCompany: "Shri Satyasai Baba Infra Ventures Private Limited", name: "Bopla - 154028", dcCapacity: "6.283", acCapacity: "5.000" },
  { projectCompany: "Shri Satyasai Baba Infra Ventures Private Limited", name: "Nagarsoga - 154058", dcCapacity: "6.593", acCapacity: "5.000" },
  { projectCompany: "Shri Satyasai Baba Infra Ventures Private Limited", name: "Shirur Tajband - 154020", dcCapacity: "10.858", acCapacity: "8.000" },
  { projectCompany: "Shri Satyasai Baba Infra Ventures Private Limited", name: "Chakur - 154019", dcCapacity: "11.619", acCapacity: "9.000" },
  { projectCompany: "Shri Satyasai Baba Infra Ventures Private Limited", name: "Dhanora/Gondri - 154074", dcCapacity: "6.491", acCapacity: "5.000" },
  { projectCompany: "Shri Satyasai Baba Infra Ventures Private Limited", name: "Bhisewagholi - 154119", dcCapacity: "6.235", acCapacity: "5.000" },
  { projectCompany: "Balaji Construction & RMC Private Limited", name: "Balsoor - 194074", dcCapacity: "8.897", acCapacity: "7.000" },
  { projectCompany: "Shrihari Steels and Renewables Private Limited", name: "Mangrool - 154069", dcCapacity: "6.499", acCapacity: "5.000" },
  { projectCompany: "Manmath Green Energy Private Limited", name: "Zari - 154011", dcCapacity: "2.603", acCapacity: "2.000" },
  { projectCompany: "Solfam Energy Private Limited", name: "Nagral - 154122", dcCapacity: "5.236", acCapacity: "4.000" },
  { projectCompany: "Tapovan Energy Private Limited", name: "Ahmedpur - 154004", dcCapacity: "2.720", acCapacity: "2.000" },
  { projectCompany: "Khandoba Distilleries Private Limited", name: "Palsi - 154057", dcCapacity: "10.499", acCapacity: "8.000" },
  { projectCompany: "Khandoba Distilleries Private Limited", name: "Jawalban - 54111", dcCapacity: "6.334", acCapacity: "5.000" },
  { projectCompany: "Ganga Mauli Sugar and Allied Industries Private Limited", name: "Umari - 54140", dcCapacity: "3.788", acCapacity: "3.000" },
  { projectCompany: "Ganga Mauli Solar Private Limited", name: "Jawalgaon - 54110", dcCapacity: "3.784", acCapacity: "3.000" },
  { projectCompany: "AaradhyaBright Energy Private Limited", name: "Talni - 154091", dcCapacity: "3.696", acCapacity: "3.000" },
  { projectCompany: "Kasale Solar Power Private Limited", name: "Mamdapur - 154022", dcCapacity: "2.587", acCapacity: "2.000" },
  { projectCompany: "AGE RCC Energy Private Limited", name: "Kharosa - 154055", dcCapacity: "2.472", acCapacity: "2.000" },
  { projectCompany: "Nitya Shakti Private Limited", name: "Madansuri - 154029", dcCapacity: "6.532", acCapacity: "5.000" },
  { projectCompany: "Gajanan Energy Private Limited", name: "Shambhu Umarga - 154087", dcCapacity: "3.810", acCapacity: "3.000" },
  { projectCompany: "Kotecha Sales Private Limited", name: "Nandurghat - 54038", dcCapacity: "3.921", acCapacity: "3.000" },
  { projectCompany: "Yash Constructions Infra Private Limited", name: "Ghatnandur - 54020", dcCapacity: "5.225", acCapacity: "4.000" },
  { projectCompany: "Shivam Solar Nexus Private Limited", name: "Gharni - 154143", dcCapacity: "5.127", acCapacity: "4.000" },
  { projectCompany: "Praashgreen Energy Private Limited", name: "Umapur - 54012", dcCapacity: "2.500", acCapacity: "2.000" },
  { projectCompany: "Praashgreen Energy Private Limited", name: "Massa - 194054", dcCapacity: "3.774", acCapacity: "3.000" },
  { projectCompany: "Gurutara Green Energy Private Limited", name: "Killari - 154008", dcCapacity: "6.448", acCapacity: "5.000" },
  { projectCompany: "Kalika Ginning and Pressing Private Limited", name: "Khalapuri - 54054", dcCapacity: "3.981", acCapacity: "3.000" },
  { projectCompany: "Guru Ram Green Energy Private Limited", name: "Raimoha - 54013", dcCapacity: "1.269", acCapacity: "1.000" },
  { projectCompany: "Vijay Clean Energy Private Limited", name: "Jawalga - 154041", dcCapacity: "6.520", acCapacity: "5.000" },
  { projectCompany: "Hariganga Solar Energy Private Limited", name: "Nalgir - 154025", dcCapacity: "6.381", acCapacity: "5.000" },
  { projectCompany: "Devarjan Green Energy Private Limited", name: "Lasona - 154123", dcCapacity: "2.564", acCapacity: "2.000" },
  { projectCompany: "Devarjan Green Energy Private Limited", name: "Devarjan - 154039", dcCapacity: "7.702", acCapacity: "6.000" },
  { projectCompany: "Ganesh International Enterprises Green Energy Private Limited", name: "Ashta - 154097", dcCapacity: "6.443", acCapacity: "5.000" },
  { projectCompany: "Ganesh International Enterprises Green Energy Private Limited", name: "Togri - 154098", dcCapacity: "6.283", acCapacity: "5.000" },
  { projectCompany: "Maharudra Energy Private Limited", name: "Ramegaon - 154102", dcCapacity: "5.219", acCapacity: "4.000" },
  { projectCompany: "Maharudra Energy Private Limited", name: "Panchincholi - 154027", dcCapacity: "2.564", acCapacity: "2.000" },
  { projectCompany: "VMR Green Energy Private Limited", name: "Dhoki - 194010", dcCapacity: "9.108", acCapacity: "7.000" },
  { projectCompany: "VMR Green Energy Private Limited", name: "Lodga - 154136", dcCapacity: "1.297", acCapacity: "1.000" },
  { projectCompany: "VMR Green Energy Private Limited", name: "Budhoda - 154054", dcCapacity: "6.566", acCapacity: "5.000" },
  { projectCompany: "Sharda Construction and Corporation Private Limited", name: "Khandali - 154141", dcCapacity: "6.298", acCapacity: "5.000" },
  { projectCompany: "Sharda Construction and Corporation Private Limited", name: "Ujalamb - 154096", dcCapacity: "6.632", acCapacity: "5.000" },
  { projectCompany: "Sharda Construction and Corporation Private Limited", name: "Wai Choundi - 324092", dcCapacity: "6.596", acCapacity: "5.000" },
  { projectCompany: "Sharda Construction and Corporation Private Limited", name: "Bhosi - 174116", dcCapacity: "6.514", acCapacity: "5.000" },
  { projectCompany: "Sharda Construction and Corporation Private Limited", name: "Salna - 324082", dcCapacity: "6.465", acCapacity: "5.000" },
  { projectCompany: "Sharda Construction and Corporation Private Limited", name: "Jintur Urban - 204053", dcCapacity: "8.918", acCapacity: "7.000" },
  { projectCompany: "Sharda Construction and Corporation Private Limited", name: "Jintur - 204114", dcCapacity: "3.773", acCapacity: "3.000" },
  { projectCompany: "Sharda Construction and Corporation Private Limited", name: "Hadolti - 154082", dcCapacity: "10.438", acCapacity: "8.000" },
  { projectCompany: "Sharda Construction and Corporation Private Limited", name: "Ujana - 154043", dcCapacity: "7.414", acCapacity: "6.000" },
  { projectCompany: "Padmanabha Real Estate and Translogic Solution Private Limited", name: "Aurad - 154056", dcCapacity: "0.000", acCapacity: "2.000" },
  { projectCompany: "Rokdoba Green Energy Private Limited", name: "Andhori - 154081", dcCapacity: "2.728", acCapacity: "2.000" },
  { projectCompany: "Purushottamdada Sonavane Energy Private Limited", name: "Hanumant Pimpri - 54043", dcCapacity: "2.541", acCapacity: "2.000" },
  { projectCompany: "Amberkhane Power Private Limited", name: "Kolnoor - 154037", dcCapacity: "6.484", acCapacity: "5.000" },
  { projectCompany: "Ekansh Green Energy Private Limited", name: "Karadkhel - 154031", dcCapacity: "5.633", acCapacity: "4.000" },
  { projectCompany: "Rajyog Green Energy Private Limited", name: "Yerol - 154024", dcCapacity: "6.788", acCapacity: "5.000" },
  { projectCompany: "Sankav Dhrumankshi Green Energy Private Limited", name: "Madaj - 194091", dcCapacity: "6.532", acCapacity: "5.000" },
  { projectCompany: "Sriguruchandra Solar Private Limited", name: "Nanand - 154104", dcCapacity: "7.359", acCapacity: "6.000" },
  { projectCompany: "CleanHedge New Energies Private Limited", name: "Sawargao - 194043", dcCapacity: "6.673", acCapacity: "6.000" },
  { projectCompany: "CleanHedge New Energies Private Limited", name: "Padoli - 194058", dcCapacity: "7.501", acCapacity: "6.000" },
  { projectCompany: "CleanHedge New Energies Private Limited", name: "Deolali - 194101", dcCapacity: "3.369", acCapacity: "3.000" },
  { projectCompany: "CleanHedge New Energies Private Limited", name: "Yermala - 194004", dcCapacity: "10.266", acCapacity: "8.000" },
  { projectCompany: "VNM Suntech Private Limited", name: "Salegaon - 54149", dcCapacity: "5.067", acCapacity: "4.000" },
  { projectCompany: "VNM Suntech Private Limited", name: "Pangaon - 154036", dcCapacity: "3.758", acCapacity: "3.000" },
  { projectCompany: "SRP Infra And Power Private Limited", name: "Upla (M) - 194049", dcCapacity: "6.479", acCapacity: "5.000" },
  { projectCompany: "SRP Infra And Power Private Limited", name: "Mangrul - 194083", dcCapacity: "6.621", acCapacity: "5.000" },
  { projectCompany: "Sastur Green Energy Private Limited", name: "Sastur - 194092", dcCapacity: "1.327", acCapacity: "1.000" },
  { projectCompany: "Vyankatesh Solar Power Generation Private Limited", name: "Manur Dev - 54134", dcCapacity: "1.308", acCapacity: "1.000" },
  { projectCompany: "Latur Vejaan Green Energy Private Limited", name: "Karla - 154093", dcCapacity: "2.587", acCapacity: "2.000" },
  { projectCompany: "SBK Green Energy Private Limited", name: "Almala - 154132", dcCapacity: "3.604", acCapacity: "3.000" },
  { projectCompany: "Kotalwar Green Energy Private Limited", name: "Dongraj - 154089", dcCapacity: "6.314", acCapacity: "5.000" },
  { projectCompany: "Siddhivinayak Vastunirmiti Limited", name: "Chikurda - 154061", dcCapacity: "6.436", acCapacity: "5.000" },
  { projectCompany: "Sarisha Energy Solutions Private Limited", name: "Bhokaramba - 154124", dcCapacity: "6.273", acCapacity: "5.000" },
  { projectCompany: "Arul Ecoenergy Private Limited", name: "Gutti - 154103", dcCapacity: "6.484", acCapacity: "5.000" },
  { projectCompany: "Nathani Green Energy Solutions Private Limited", name: "Padalsingi - 54086", dcCapacity: "10.235", acCapacity: "8.000" },
  { projectCompany: "RRT Greens Private Limited", name: "Nagazri - 154120", dcCapacity: "3.733", acCapacity: "3.000" }
];

export default function ManageSitesPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const { user, isUserLoading } = useUser();

  const [searchTerm, setSearchTerm] = React.useState("");
  const [isBootstrapping, setIsBootstrapping] = React.useState(false);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);

  const isAdmin = isSuperAdmin(user?.email) || userProfile?.role === 'Admin';

  React.useEffect(() => {
    if (!isUserLoading && !isProfileLoading && !isAdmin) {
      router.replace('/dashboard');
    }
  }, [isUserLoading, isProfileLoading, isAdmin, router]);

  const sitesQuery = useMemoFirebase(() => collection(firestore, 'sites'), [firestore]);
  const { data: sites, isLoading: sitesLoading } = useCollection<any>(sitesQuery);

  const siteForm = useForm<z.infer<typeof siteSchema>>({
    resolver: zodResolver(siteSchema),
    defaultValues: { name: '', projectCompany: '', acCapacity: '', dcCapacity: '' },
  });

  const onSiteSubmit = (values: z.infer<typeof siteSchema>) => {
    addDocumentNonBlocking(collection(firestore, 'sites'), {
      ...values,
      createdAt: serverTimestamp()
    });
    toast({ title: 'Success', description: 'New Site added.' });
    siteForm.reset();
  };

  const deleteSite = (id: string) => {
    deleteDocumentNonBlocking(doc(firestore, 'sites', id));
    toast({ title: 'Success', description: 'Site deleted.' });
  };

  const handleBootstrap = async () => {
    if (!isAdmin) return;
    setIsBootstrapping(true);
    try {
      const batch = writeBatch(firestore);
      const sitesCol = collection(firestore, 'sites');
      
      GLOBAL_SITES_BOOTSTRAP.forEach((site) => {
        const newRef = doc(sitesCol);
        batch.set(newRef, {
          ...site,
          createdAt: serverTimestamp()
        });
      });

      await batch.commit();
      toast({ title: "Bootstrap Complete", description: `${GLOBAL_SITES_BOOTSTRAP.length} sites added to production.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Bootstrap Failed", description: e.message });
    } finally {
      setIsBootstrapping(false);
    }
  };

  const filteredSitesList = React.useMemo(() => {
    if (!sites) return [];
    return sites.filter(s => 
      s.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.projectCompany?.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [sites, searchTerm]);

  if (isUserLoading || isProfileLoading || sitesLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
            <MapPin className="h-8 w-8" /> Manage Project Sites
          </h1>
          <p className="text-muted-foreground">Define and organize project locations for organizational operations.</p>
        </div>
        <Button 
          variant="outline" 
          onClick={handleBootstrap} 
          disabled={isBootstrapping}
          className="rounded-sm font-bold border-amber-500 text-amber-700 bg-amber-50 hover:bg-amber-100"
        >
          {isBootstrapping ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Database className="h-4 w-4 mr-2" />}
          Bootstrap Global Project List
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="rounded-sm h-fit lg:col-span-1">
          <CardHeader>
            <CardTitle>Register New Site</CardTitle>
            <CardDescription>Add a specific project location to the registry.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...siteForm}>
              <form onSubmit={siteForm.handleSubmit(onSiteSubmit)} className="space-y-4">
                <FormField control={siteForm.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Site Name</FormLabel><FormControl><Input placeholder="e.g., Shahapur - 194082" {...field} className="rounded-sm" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={siteForm.control} name="projectCompany" render={({ field }) => (
                  <FormItem><FormLabel>Project Company</FormLabel><FormControl><Input placeholder="e.g., HTI Energies" {...field} className="rounded-sm" /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={siteForm.control} name="acCapacity" render={({ field }) => (
                    <FormItem><FormLabel>AC Capacity</FormLabel><FormControl><Input placeholder="4.000" {...field} className="rounded-sm" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={siteForm.control} name="dcCapacity" render={({ field }) => (
                    <FormItem><FormLabel>DC Capacity</FormLabel><FormControl><Input placeholder="5.174" {...field} className="rounded-sm" /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <Button type="submit" className="w-full rounded-sm font-bold h-11">
                  <Plus className="h-4 w-4 mr-2" /> Add Project Site
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className="rounded-sm overflow-hidden lg:col-span-2 border-primary/10 shadow-md">
          <CardHeader className="bg-muted/5 border-b py-4 flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-sm font-bold uppercase tracking-widest">Site Registry</CardTitle>
              <CardDescription className="text-xs uppercase font-black text-primary">{sites?.length || 0} Locations Active</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search name or company..." 
                className="pl-8 rounded-sm h-9 border-primary/20 text-xs" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[600px] overflow-auto">
              <Table>
                <TableHeader className="bg-muted/30 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="text-[10px] uppercase font-bold">Site Name</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold">Company</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold text-center">AC / DC</TableHead>
                    <TableHead className="text-right px-6"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSitesList.length > 0 ? (
                    filteredSitesList.map((site) => (
                      <TableRow key={site.id} className="hover:bg-muted/5 group">
                        <TableCell className="font-bold text-sm">{site.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground font-medium">{site.projectCompany}</TableCell>
                        <TableCell className="text-center font-mono text-[10px] font-bold">
                          <span className="text-blue-600">{site.acCapacity}</span> / <span className="text-amber-600">{site.dcCapacity}</span>
                        </TableCell>
                        <TableCell className="text-right px-6">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-sm" onClick={() => deleteSite(site.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic">
                        {searchTerm ? `No sites found matching "${searchTerm}"` : "Registry empty. Add sites or use bootstrap."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
