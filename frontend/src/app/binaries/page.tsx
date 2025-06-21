'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ListChecks,
  Settings,
  Code2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import type { Binary } from '@/lib/types';
import { api } from '@/lib/api';
import { getIconByName } from '@/lib/icons';
import Link from 'next/link';

export default function BinariesPage() {
  const [binaries, setBinaries] = useState<Binary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadBinaries() {
      try {
        setLoading(true);
        setError(null);
        const binariesData = await api.getBinaries();
        console.log(
          'Binaries data received:',
          binariesData.map((b) => ({ id: b.id, icon: b.icon, color: b.color }))
        );
        setBinaries(binariesData);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load binaries'
        );
      } finally {
        setLoading(false);
      }
    }

    loadBinaries();
  }, []);

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col items-center text-center">
          <ListChecks className="h-16 w-16 text-primary mb-4" />
          <h1 className="text-4xl font-bold font-headline">
            Binary Configurations
          </h1>
          <div className="h-4 w-96 bg-muted animate-pulse rounded mt-2"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="h-48">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="h-8 w-8 bg-muted animate-pulse rounded"></div>
                  <div className="h-6 w-32 bg-muted animate-pulse rounded"></div>
                  <div className="h-4 w-full bg-muted animate-pulse rounded"></div>
                  <div className="h-4 w-3/4 bg-muted animate-pulse rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col items-center text-center">
          <ListChecks className="h-16 w-16 text-primary mb-4" />
          <h1 className="text-4xl font-bold font-headline">
            Binary Configurations
          </h1>
        </div>
        <Card className="max-w-3xl mx-auto">
          <CardContent className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <AlertCircle className="w-16 h-16 mb-4 text-red-500" />
            <p className="text-lg">Error loading binaries</p>
            <p className="text-sm">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Helper function to get display info from binary configuration
  const getBinaryInfo = (binary: Binary) => {
    console.log(
      `getBinaryInfo for ${binary.id}: icon=${binary.icon}, color=${binary.color}`
    );
    const IconComponent = getIconByName(binary.icon);
    const color = binary.color || '#8b5cf6';

    return {
      icon: IconComponent,
      description: binary.description || 'CPython build configuration',
      color: 'text-current',
      bgColor: 'bg-muted/50 border-border hover:bg-muted/70',
      accentColor: 'border-l-4',
      accentBorderColor: color,
    };
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center text-center">
        <ListChecks className="h-16 w-16 text-primary mb-4" />
        <h1 className="text-4xl font-bold font-headline">
          Binary Configurations
        </h1>
        <p className="text-lg text-muted-foreground mt-2 max-w-2xl">
          Explore different CPython compilation configurations. Each binary
          represents a unique combination of compilation flags that affects
          performance, debugging capabilities, and memory usage patterns.
        </p>
      </div>

      {binaries.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {binaries.map((binary) => {
            const info = getBinaryInfo(binary);
            const IconComponent = info.icon;

            return (
              <Card
                key={binary.id}
                className={`hover:shadow-lg transition-all duration-200 ${info.accentColor}`}
                style={{ borderLeftColor: info.accentBorderColor }}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <IconComponent
                      className="h-8 w-8"
                      style={{ color: info.accentBorderColor }}
                    />
                    <div className="flex-1">
                      <CardTitle className="text-lg">{binary.name}</CardTitle>
                      <Badge
                        variant="outline"
                        className="font-mono text-xs mt-1"
                      >
                        {binary.id}
                      </Badge>
                    </div>
                  </div>
                  <CardDescription className="text-sm leading-relaxed line-clamp-3">
                    {info.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-0">
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                        <Code2 className="h-3 w-3" />
                        FLAGS
                      </h4>
                      {binary.flags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {binary.flags.slice(0, 2).map((flag, index) => (
                            <Badge
                              key={index}
                              variant="secondary"
                              className="font-mono text-xs"
                            >
                              {flag}
                            </Badge>
                          ))}
                          {binary.flags.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{binary.flags.length - 2} more
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          Default build
                        </Badge>
                      )}
                    </div>

                    <Link href={`/binaries/${binary.id}`}>
                      <Button className="w-full mt-4" variant="outline">
                        Explore Environments
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="max-w-md mx-auto">
          <CardContent className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Settings className="w-16 h-16 mb-4" />
            <p className="text-lg">No binary configurations found</p>
            <p className="text-sm">
              Check your database or add some binary configurations.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
