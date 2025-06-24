'use client';

import { Code2, Users, Zap, Database, GitBranch, BarChart3, HelpCircle, Key, Settings, Package, MessageSquare, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

interface FAQItem {
  question: string;
  answer: string;
  icon?: React.ElementType;
}

export default function AboutPage() {
  const [openFAQ, setOpenFAQ] = useState<string | null>(null);

  const faqItems: FAQItem[] = [
    {
      question: "How do I get an API token?",
      answer: "API tokens are managed by the project maintainers. Please contact one of the maintainers listed below via GitHub or email. Include your GitHub username and a brief description of what you'll be using the token for (e.g., running benchmarks on a specific fork, CI integration, etc.).",
      icon: Key,
    },
    {
      question: "How do I create a new environment?",
      answer: "Environments represent different hardware/OS combinations where benchmarks run. To add a new environment, contact the maintainers with details about your system (OS, CPU architecture, memory, etc.). They will create the environment configuration for you.",
      icon: Settings,
    },
    {
      question: "How do I add a new binary configuration?",
      answer: "Binary configurations represent different CPython build flags (e.g., --enable-optimizations, --with-lto). To add a new configuration, open a GitHub issue or contact the maintainers with the specific build flags you want to test.",
      icon: Package,
    },
    {
      question: "Why is my benchmark data not showing up?",
      answer: "There could be several reasons: 1) The benchmark worker might still be processing your commits, 2) There might be an issue with your API token permissions, 3) The specified binary/environment combination might not exist. Check the worker logs or contact the maintainers for help.",
      icon: HelpCircle,
    },
    {
      question: "How often are benchmarks run?",
      answer: "Benchmarks are automatically run for each commit to the main CPython repository by community members running worker processes. Anyone with an API token can run additional benchmarks on feature branches or custom commits using the worker tool.",
      icon: BarChart3,
    },
    {
      question: "Can I run benchmarks on my own fork?",
      answer: "Yes! Anyone can run the memory-tracker worker tool with an API token to benchmark any CPython fork or branch. The worker tool is open source and designed to be run by community members. See the worker documentation for setup instructions.",
      icon: GitBranch,
    },
  ];
  return (
    <div className="container py-12 max-w-6xl">
      {/* Hero Section */}
      <div className="text-center mb-16 relative">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-20 left-1/4 w-32 h-32 bg-primary/5 rounded-full blur-xl animate-pulse"></div>
          <div className="absolute top-32 right-1/3 w-24 h-24 bg-secondary/10 rounded-full blur-lg animate-pulse delay-1000"></div>
        </div>
        <div className="relative">
          <Code2 className="h-20 w-20 text-primary mx-auto mb-6" />
          <h1 className="text-5xl font-bold font-headline mb-6">
            CPython Memory Insights
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Memory profiling infrastructure for CPython core development
          </p>
        </div>
      </div>

      {/* How It Works - Expanded Section */}
      <div className="mb-16">
        <h2 className="text-4xl font-bold font-headline text-center mb-12">
          How Memory Insights Works
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
          {/* Step 1 */}
          <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors group-hover:scale-110 duration-300">
                <span className="text-2xl font-bold text-primary">1</span>
              </div>
              <CardTitle className="group-hover:text-primary transition-colors">Commit Detection</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Community members running worker processes monitor the CPython repository for new commits. 
                When a commit is pushed, workers can queue it for memory profiling across 
                multiple configurations and environments.
              </p>
            </CardContent>
          </Card>

          {/* Step 2 */}
          <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors group-hover:scale-110 duration-300">
                <span className="text-2xl font-bold text-primary">2</span>
              </div>
              <CardTitle className="group-hover:text-primary transition-colors">Benchmark Execution</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Worker processes (which anyone can run with an API token) compile CPython with various 
                optimization flags, then run a comprehensive suite of memory benchmarks using Memray. 
                Each benchmark captures detailed allocation data, call stacks, and memory usage patterns.
              </p>
            </CardContent>
          </Card>

          {/* Step 3 */}
          <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors group-hover:scale-110 duration-300">
                <span className="text-2xl font-bold text-primary">3</span>
              </div>
              <CardTitle className="group-hover:text-primary transition-colors">Analysis & Visualization</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Results are processed and stored with rich metadata. The web interface provides 
                interactive visualizations, trend analysis, and detailed flamegraphs to help 
                developers understand memory behavior and identify regressions.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* What you can do with this */}
        <h3 className="text-2xl font-bold mb-8 text-center">What you can do with this</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="group hover:shadow-xl transition-all duration-500 hover:-translate-y-2 hover:rotate-1 border-l-4 border-l-primary/30 hover:border-l-primary">
            <CardHeader>
              <BarChart3 className="h-8 w-8 text-primary mb-3 group-hover:scale-125 transition-transform duration-300" />
              <CardTitle className="group-hover:text-primary transition-colors">Continuous Memory Monitoring</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                CPython commits are profiled by community workers across multiple build configurations. 
                Track memory usage trends over time, identify sudden regressions, and validate that 
                memory optimizations are working as expected.
              </p>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-xl transition-all duration-500 hover:-translate-y-2 hover:-rotate-1 border-l-4 border-l-primary/30 hover:border-l-primary">
            <CardHeader>
              <GitBranch className="h-8 w-8 text-primary mb-3 group-hover:scale-125 transition-transform duration-300" />
              <CardTitle className="group-hover:text-primary transition-colors">Multi-Configuration Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Compare memory usage across different build flags (--enable-optimizations, --with-lto, 
                debug builds), Python versions, and hardware environments. Understand how different 
                configurations affect memory consumption.
              </p>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-xl transition-all duration-500 hover:-translate-y-2 hover:rotate-1 border-l-4 border-l-primary/30 hover:border-l-primary">
            <CardHeader>
              <Zap className="h-8 w-8 text-primary mb-3 group-hover:scale-125 transition-transform duration-300" />
              <CardTitle className="group-hover:text-primary transition-colors">Interactive Memory Flamegraphs</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Powered by Memray's flamegraph generation, explore exactly where memory is allocated 
                in the CPython codebase. Click through call stacks, zoom into specific functions, 
                and identify memory hotspots.
              </p>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-xl transition-all duration-500 hover:-translate-y-2 hover:-rotate-1 border-l-4 border-l-primary/30 hover:border-l-primary">
            <CardHeader>
              <Database className="h-8 w-8 text-primary mb-3 group-hover:scale-125 transition-transform duration-300" />
              <CardTitle className="group-hover:text-primary transition-colors">Historical Data Archive</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Access memory profiling data for any commit in CPython's history. Compare commits 
                across weeks, months, or years to understand long-term memory usage trends and 
                validate that optimizations have lasting impact.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Powered by Memray Section */}
      <Card className="mb-12 border-primary/20 bg-primary/5 hover:shadow-2xl transition-all duration-700 relative overflow-hidden group">
        {/* Anime-style spinning background elements */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
          <div className="absolute top-4 left-4 w-16 h-16 border-2 border-pink-400/30 rounded-full animate-spin" style={{animationDuration: '4s'}}></div>
          <div className="absolute top-8 right-8 w-12 h-12 border-2 border-cyan-400/30 rounded-full animate-spin" style={{animationDuration: '3s', animationDirection: 'reverse'}}></div>
          <div className="absolute bottom-6 left-12 w-20 h-20 border-2 border-purple-400/30 rounded-full animate-spin" style={{animationDuration: '5s'}}></div>
          <div className="absolute bottom-12 right-6 w-8 h-8 border-2 border-yellow-400/30 rounded-full animate-spin" style={{animationDuration: '2s', animationDirection: 'reverse'}}></div>
          
          {/* Glowing orbs */}
          <div className="absolute top-1/3 left-1/4 w-4 h-4 bg-pink-500/50 rounded-full blur-sm animate-pulse"></div>
          <div className="absolute top-2/3 right-1/3 w-6 h-6 bg-cyan-500/50 rounded-full blur-sm animate-pulse delay-500"></div>
          <div className="absolute bottom-1/3 left-1/3 w-3 h-3 bg-purple-500/50 rounded-full blur-sm animate-pulse delay-1000"></div>
          
          {/* Animated gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-cyan-500/10 animate-pulse"></div>
        </div>
        
        <CardHeader className="text-center relative z-10">
          <CardTitle className="text-3xl font-headline mb-6 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-pink-500 group-hover:via-purple-500 group-hover:to-cyan-500 transition-all duration-700">
            Powered by Memray
          </CardTitle>
          <Link 
            href="https://bloomberg.github.io/memray/" 
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block group/logo"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-pink-500 to-cyan-500 rounded-lg blur-lg opacity-0 group-hover:opacity-75 transition-opacity duration-700 group-hover:animate-pulse"></div>
              <Image
                src="/memray-logo.png"
                alt="Memray - Memory profiler for Python"
                width={300}
                height={90}
                style={{ height: "auto" }}
                className="mx-auto opacity-90 group-hover:opacity-100 relative z-10 group-hover:drop-shadow-[0_0_30px_rgba(236,72,153,0.6)] transition-all duration-700"
              />
            </div>
          </Link>
        </CardHeader>
        <CardContent className="prose prose-lg prose-neutral dark:prose-invert max-w-none text-center">
          <p>
            CPython Memory Insights is built on top of <strong>Memray</strong>, Bloomberg's 
            powerful memory profiler for Python. Memray provides the core profiling capabilities 
            that enable tracking memory allocations with minimal overhead and generate 
            detailed flamegraphs for analysis.
          </p>
          <p>
            <Link 
              href="https://bloomberg.github.io/memray/" 
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Learn more about Memray →
            </Link>
          </p>
        </CardContent>
      </Card>

      {/* FAQ Section */}
      <Card className="mb-12 hover:shadow-xl transition-all duration-500">
        <CardHeader>
          <HelpCircle className="h-10 w-10 text-primary mb-4 mx-auto animate-pulse" />
          <CardTitle className="text-3xl font-headline text-center">Frequently Asked Questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {faqItems.map((item, index) => (
            <Collapsible
              key={item.question}
              open={openFAQ === item.question}
              onOpenChange={() => setOpenFAQ(openFAQ === item.question ? null : item.question)}
            >
              <CollapsibleTrigger className="flex items-center justify-between w-full p-4 rounded-lg hover:bg-muted hover:shadow-md transition-all duration-300 group hover:-translate-y-0.5">
                <div className="flex items-center gap-3 text-left">
                  {item.icon && <item.icon className="h-5 w-5 text-primary flex-shrink-0 group-hover:scale-110 transition-transform" />}
                  <span className="font-medium group-hover:text-primary transition-colors">{item.question}</span>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground group-data-[state=open]:rotate-180 transition-transform duration-300" />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-4 pb-4">
                <div className="pl-8 text-muted-foreground">
                  {item.answer}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </CardContent>
      </Card>

      {/* Contact Section */}
      <Card className="mb-12 border-primary/20 bg-primary/5">
        <CardHeader className="text-center">
          <Users className="h-12 w-12 text-primary mx-auto mb-4" />
          <CardTitle className="text-3xl font-headline">Need Help?</CardTitle>
          <CardDescription className="text-lg">
            Contact the maintainers for assistance
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <p className="text-lg max-w-2xl mx-auto">
            The CPython Memory Insights maintainers are here to help with:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-background">
              <Key className="h-8 w-8 text-primary" />
              <span className="font-medium">API Tokens</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-background">
              <Settings className="h-8 w-8 text-primary" />
              <span className="font-medium">Environment Setup</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-background">
              <MessageSquare className="h-8 w-8 text-primary" />
              <span className="font-medium">Technical Issues</span>
            </div>
          </div>
          <div className="pt-4">
            <p className="text-muted-foreground mb-6">
              Reach out via GitHub or the CPython Discord channel
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              {/* Pablo's profile */}
              <Link
                href="https://github.com/pablogsal"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-2 rounded-lg bg-background hover:bg-muted group"
              >
                <Image
                  src="https://github.com/pablogsal.png"
                  alt="Pablo Galindo Salgado"
                  width={40}
                  height={40}
                  className="rounded-full ring-2 ring-muted group-hover:ring-primary"
                />
                <div className="text-left">
                  <p className="font-medium group-hover:text-primary">Pablo Galindo Salgado</p>
                  <p className="text-sm text-muted-foreground">@pablogsal</p>
                </div>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}