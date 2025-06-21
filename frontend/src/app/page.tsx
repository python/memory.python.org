import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { LineChart, GitCompareArrows, Code2, ListChecks } from 'lucide-react'; // Removed UploadCloud
import Link from 'next/link';

export default function Home() {
  const features = [
    {
      title: 'Benchmark Trends',
      description:
        'Visualize memory benchmark trends over time for selected configurations.',
      icon: LineChart,
      href: '/trends',
      cta: 'View Trends',
    },
    {
      title: 'Inspect Run Results',
      description:
        'Analyze memory metrics for specific runs and compare with previous results.',
      icon: GitCompareArrows,
      href: '/diff',
      cta: 'Inspect Results',
    },
    {
      title: 'Inspect Binaries',
      description:
        'View details of available binary compilation flag configurations.',
      icon: ListChecks,
      href: '/binaries',
      cta: 'Inspect Binaries',
    },
    // { // Removed Upload Data feature card
    //   title: "Upload Data",
    //   description: "Upload new benchmark results via JSON files for analysis.",
    //   icon: UploadCloud,
    //   href: "/upload",
    //   cta: "Upload Data",
    // },
  ];

  return (
    <div className="flex flex-col items-center justify-center text-center py-12">
      <Code2 className="h-24 w-24 text-primary mb-6" />
      <h1 className="text-5xl font-bold font-headline mb-4">
        CPython Memory Insights
      </h1>
      <p className="text-xl text-muted-foreground mb-12 max-w-2xl">
        Analyze memory behavior trends, compare builds and commits, and
        investigate performance regressions in the CPython project.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl">
        {features.map((feature) => (
          <Card
            key={feature.title}
            className="flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300"
          >
            <CardHeader className="items-center">
              <feature.icon className="h-12 w-12 text-primary mb-3" />
              <CardTitle className="font-headline text-2xl">
                {feature.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col items-center text-center">
              <CardDescription className="mb-6 flex-grow">
                {feature.description}
              </CardDescription>
              <Button
                asChild
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Link href={feature.href}>{feature.cta}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
