'use client';

import Link from 'next/link';
import {
  Code2,
  LineChart,
  GitCompareArrows,
  ListChecks,
  Sun,
  Moon,
  GitCompare,
  GitBranch,
  Info,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';
import { useState, useEffect } from 'react';

const navItems = [
  { href: '/trends', label: 'Benchmark Trends', icon: LineChart },
  { href: '/build-comparison', label: 'Binary Comparison', icon: GitCompare },
  { href: '/version-comparison', label: 'Version Comparison', icon: GitBranch },
  { href: '/diff', label: 'Inspect Run Results', icon: GitCompareArrows },
  { href: '/binaries', label: 'Binary Configurations', icon: ListChecks },
  { href: '/about', label: 'About', icon: Info },
];

export default function Header() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  if (!mounted) {
    return (
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-headline font-bold"
          >
            <Code2 className="h-7 w-7 text-primary" />
            <span>CPython Memory Insights</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
          </div>
        </div>
      </header>
    );
  }

  const NavLinks = ({ inSheet = false }: { inSheet?: boolean }) =>
    navItems.map((item) => (
      <Button
        key={item.label}
        variant="ghost"
        asChild
        className={`justify-start ${inSheet ? 'w-full text-left' : ''}`}
        onClick={() => inSheet && setIsMobileMenuOpen(false)}
      >
        <Link href={item.href} className="flex items-center gap-2">
          <item.icon className="h-5 w-5" />
          {item.label}
        </Link>
      </Button>
    ));

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-headline font-bold"
        >
          <Code2 className="h-7 w-7 text-primary" />
          <span>CPython Memory Insights</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <NavLinks />
        </nav>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>
          <div className="md:hidden">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <div className="p-4">
                  <Link
                    href="/"
                    className="flex items-center gap-2 text-lg font-headline font-bold mb-6"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Code2 className="h-7 w-7 text-primary" />
                    <span>CPython Memory Insights</span>
                  </Link>
                  <nav className="flex flex-col gap-2">
                    <NavLinks inSheet={true} />
                  </nav>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
