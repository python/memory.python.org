import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { LineChart, GitCompareArrows, Code2, ListChecks, GitCompare, GitBranch, Info } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

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
      title: 'Binary Comparison',
      description:
        'Compare memory usage across different binary configurations and build flags.',
      icon: GitCompare,
      href: '/build-comparison',
      cta: 'Compare Binaries',
    },
    {
      title: 'Version Comparison',
      description:
        'Analyze memory differences between Python versions and release candidates.',
      icon: GitBranch,
      href: '/version-comparison',
      cta: 'Compare Versions',
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
      title: 'Binary Configurations',
      description:
        'View details of available binary compilation flag configurations.',
      icon: ListChecks,
      href: '/binaries',
      cta: 'View Configurations',
    },
    {
      title: 'About',
      description:
        'Learn about the project, how it works, and get help from maintainers.',
      icon: Info,
      href: '/about',
      cta: 'Learn More',
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center text-center py-12">
      <Code2 className="h-24 w-24 text-primary mb-6" />
      <h1 className="text-5xl font-bold font-headline mb-4">
        CPython Memory Insights
      </h1>
      <p className="text-xl text-muted-foreground mb-4 max-w-2xl">
        Analyze memory behavior trends, compare builds and commits, and
        investigate performance regressions in the CPython project.
      </p>
      
      {/* Powered by Memray - anime style! */}
      <div className="relative mb-12 group">
        <div className="absolute inset-0 bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-cyan-500/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-all duration-500 group-hover:scale-110"></div>
        <Link 
          href="https://bloomberg.github.io/memray/" 
          target="_blank"
          rel="noopener noreferrer"
          className="relative inline-flex items-center gap-3 px-5 py-2.5 rounded-full border-2 border-transparent bg-background/80 backdrop-blur-sm group-hover:border-primary/50 transition-all duration-500 group-hover:scale-110 group-hover:rotate-1 hover:shadow-2xl hover:shadow-primary/20"
        >
          <span className="text-base text-muted-foreground group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-pink-500 group-hover:to-cyan-500 transition-all duration-500 font-bold tracking-wider uppercase">
            Powered by
          </span>
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-pink-500 to-cyan-500 rounded blur-md opacity-0 group-hover:opacity-75 transition-all duration-500 group-hover:animate-pulse"></div>
            <Image
              src="/memray-logo.png"
              alt="Memray"
              width={130}
              height={40}
              style={{ height: "auto" }}
              className="relative opacity-80 group-hover:opacity-100 transition-all duration-500 group-hover:drop-shadow-[0_0_20px_rgba(236,72,153,0.5)]"
            />
          </div>
        </Link>
      </div>

      <div className="w-full max-w-6xl">
        {/* First row - 3 cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {features.slice(0, 3).map((feature, index) => (
            <Card
              key={feature.title}
              className="flex flex-col shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group"
            >
              <CardHeader className="items-center">
                <feature.icon className="h-12 w-12 text-primary mb-3 group-hover:scale-110 transition-transform duration-300" />
                <CardTitle className="font-headline text-2xl group-hover:text-primary transition-colors duration-300">
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
        
        {/* Second row - 3 cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.slice(3).map((feature, index) => (
            <Card
              key={feature.title}
              className="flex flex-col shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group"
            >
              <CardHeader className="items-center">
                <feature.icon className="h-12 w-12 text-primary mb-3 group-hover:scale-110 transition-transform duration-300" />
                <CardTitle className="font-headline text-2xl group-hover:text-primary transition-colors duration-300">
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

    </div>
  );
}
