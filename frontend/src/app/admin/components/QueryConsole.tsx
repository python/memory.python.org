'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import AceEditor to avoid SSR issues
const AceEditor = dynamic(
  () =>
    import('react-ace').then((mod) => {
      // Load required ACE modules
      require('ace-builds/src-noconflict/mode-sql');
      require('ace-builds/src-noconflict/theme-monokai');
      require('ace-builds/src-noconflict/ext-language_tools');
      return mod.default;
    }),
  { ssr: false }
);
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import type { DatabaseTable, TableSchema, QueryResult } from '@/lib/types';
import { 
  Terminal, 
  Play, 
  Download,
  Database,
  Clock,
  Info,
  CheckCircle,
  XCircle,
  Eye,
  BookOpen
} from 'lucide-react';

interface DatabaseTableLocal {
  name: string;
  columns?: Array<{
    name: string;
    type: string;
    nullable: boolean;
    default: any;
  }>;
}

export default function QueryConsole() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [readOnly, setReadOnly] = useState(true);
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [tableSchema, setTableSchema] = useState<DatabaseTableLocal | null>(null);
  const [allSchemas, setAllSchemas] = useState<{[tableName: string]: DatabaseTableLocal}>({});
  const [queryHistory, setQueryHistory] = useState<string[]>([]);
  const aceEditorRef = useRef<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadTables();
    loadQueryHistory();
  }, []);

  // Load all schemas when tables are loaded
  useEffect(() => {
    if (tables.length > 0) {
      loadAllSchemas();
    }
  }, [tables]);

  const loadTables = async () => {
    try {
      const data = await api.getDatabaseTables();
      // Extract table names from the DatabaseTable response
      if (data && 'tables' in data) {
        setTables(data.tables);
      } else {
        setTables([]);
      }
    } catch (error) {
      console.error('Error loading tables:', error);
    }
  };

  const loadAllSchemas = async () => {
    try {
      const schemas: {[tableName: string]: DatabaseTableLocal} = {};
      
      // Load all table schemas in parallel
      const schemaPromises = tables.map(async (tableName) => {
        try {
          const data = await api.getTableSchema(tableName);
          return {
            tableName,
            schema: {
              name: tableName,
              columns: (data.columns || []).map(col => ({
                ...col,
                default: col.default ?? null,
              })),
            }
          };
        } catch (error) {
          console.error(`Error loading schema for ${tableName}:`, error);
          return null;
        }
      });

      const results = await Promise.all(schemaPromises);
      
      results.forEach(result => {
        if (result) {
          schemas[result.tableName] = result.schema;
        }
      });

      setAllSchemas(schemas);
      
      // Set up ACE autocomplete after schemas are loaded
      if (aceEditorRef.current?.editor) {
        setupAutoComplete(aceEditorRef.current.editor, schemas);
      }
    } catch (error) {
      console.error('Error loading all schemas:', error);
    }
  };

  const loadTableSchema = async (tableName: string) => {
    try {
      const data = await api.getTableSchema(tableName);
      setTableSchema({
        name: tableName,
        columns: (data.columns || []).map(col => ({
          ...col,
          default: col.default ?? null,
        })),
      });
    } catch (error) {
      console.error('Error loading table schema:', error);
      setTableSchema(null);
      toast({
        title: 'Error',
        description: 'Failed to load table schema',
        variant: 'destructive',
      });
    }
  };

  const setupAutoComplete = (editor: any, schemas: {[tableName: string]: DatabaseTableLocal}) => {
    // Remove existing custom completers
    const langTools = (window as any).ace.require('ace/ext/language_tools');
    
    // Custom completer for table names
    const tableCompleter = {
      getCompletions: function(editor: any, session: any, pos: any, prefix: any, callback: any) {
        const tableCompletions = Object.keys(schemas).map(tableName => ({
          caption: tableName,
          value: tableName,
          meta: 'table',
          score: 1000
        }));
        
        callback(null, tableCompletions);
      }
    };

    // Custom completer for column names  
    const columnCompleter = {
      getCompletions: function(editor: any, session: any, pos: any, prefix: any, callback: any) {
        const allColumns: any[] = [];
        
        // Get current line to detect context
        const line = session.getLine(pos.row).toLowerCase();
        
        // Add all columns from all tables
        Object.values(schemas).forEach(schema => {
          schema.columns?.forEach(column => {
            allColumns.push({
              caption: `${column.name} (${schema.name})`,
              value: column.name,
              meta: `${column.type} | ${schema.name}`,
              score: 900
            });
          });
        });

        // Try to detect table context for more relevant suggestions
        let contextTable = null;
        const tableNames = Object.keys(schemas);
        
        for (const tableName of tableNames) {
          if (line.includes(tableName.toLowerCase())) {
            contextTable = tableName;
            break;
          }
        }

        // If we found a table context, prioritize its columns
        if (contextTable && schemas[contextTable]) {
          const contextColumns = schemas[contextTable].columns?.map(column => ({
            caption: column.name,
            value: column.name,
            meta: `${column.type} | ${contextTable}`,
            score: 1100 // Higher score for context-aware suggestions
          })) || [];
          
          callback(null, [...contextColumns, ...allColumns]);
        } else {
          callback(null, allColumns);
        }
      }
    };

    // SQL keywords completer
    const sqlKeywordsCompleter = {
      getCompletions: function(editor: any, session: any, pos: any, prefix: any, callback: any) {
        const keywords = [
          'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN',
          'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'UNION ALL',
          'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'INDEX',
          'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'DISTINCT', 'AS', 'AND', 'OR', 'NOT',
          'NULL', 'IS NULL', 'IS NOT NULL', 'LIKE', 'ILIKE', 'IN', 'EXISTS', 'BETWEEN',
          'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'DESC', 'ASC'
        ];
        
        const keywordCompletions = keywords.map(keyword => ({
          caption: keyword,
          value: keyword,
          meta: 'keyword',
          score: 800
        }));
        
        callback(null, keywordCompletions);
      }
    };

    // Add our custom completers
    langTools.addCompleter(tableCompleter);
    langTools.addCompleter(columnCompleter);
    langTools.addCompleter(sqlKeywordsCompleter);
  };

  const loadQueryHistory = () => {
    const history = localStorage.getItem('admin_query_history');
    if (history) {
      try {
        setQueryHistory(JSON.parse(history));
      } catch (error) {
        console.error('Error loading query history:', error);
      }
    }
  };

  const saveToHistory = (query: string) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    const newHistory = [trimmedQuery, ...queryHistory.filter(q => q !== trimmedQuery)].slice(0, 20);
    setQueryHistory(newHistory);
    localStorage.setItem('admin_query_history', JSON.stringify(newHistory));
  };

  const executeQuery = async () => {
    if (!query.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a query',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const data = await api.executeQuery(query.trim(), readOnly);
      
      // Defensive check: if backend says success but we have indicators of failure
      // (null affected_rows, no rows, AND no execution_time), it might be a failed query
      // Note: execution_time_ms should always be present for successful queries
      if (data.success && 
          data.affected_rows === null && 
          (!data.rows || data.rows.length === 0) && 
          (data.execution_time_ms === null || data.execution_time_ms === undefined)) {
        // This looks like a failed query that the backend incorrectly marked as successful
        setResult({
          success: false,
          error: 'Query execution failed (no results or execution time returned)',
        });
        toast({
          title: 'Query Failed',
          description: 'Query execution failed (no results or execution time returned)',
          variant: 'destructive',
        });
      } else {
        // Use the API response as-is
        setResult(data);
        saveToHistory(query.trim());
        
        if (data.success) {
          toast({
            title: 'Query Executed',
            description: `Query completed in ${data.execution_time_ms}ms`,
          });
        } else {
          toast({
            title: 'Query Failed',
            description: data.error || 'Unknown error occurred',
            variant: 'destructive',
          });
        }
      }
    } catch (error: any) {
      console.error('Error executing query:', error);
      
      let errorMessage = 'Query execution failed';
      if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      setResult({
        success: false,
        error: errorMessage,
      });
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const insertSampleQuery = (sampleQuery: string) => {
    setQuery(sampleQuery);
    if (aceEditorRef.current) {
      aceEditorRef.current.editor.focus();
    }
  };

  const exportToCSV = () => {
    if (!result?.rows || !result?.column_names) return;

    const csvContent = [
      result.column_names.join(','),
      ...result.rows.map(row => 
        result.column_names!.map(col => {
          const value = row[col];
          // Escape values that contain commas or quotes
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value ?? '';
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query_results_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const queryCategories = {
    'Database Analysis': [
      {
        name: '📊 Database overview',
        query: `SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size('public.'||tablename)) as size,
  pg_stat_get_tuples_inserted(c.oid) as inserts,
  pg_stat_get_tuples_updated(c.oid) as updates,
  pg_stat_get_tuples_deleted(c.oid) as deletes
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size('public.'||tablename) DESC;`
      },
      {
        name: '📈 Table row counts',
        query: `SELECT 
  'commits' as table_name, COUNT(*) as row_count FROM commits
UNION ALL
SELECT 'runs', COUNT(*) FROM runs
UNION ALL
SELECT 'benchmark_results', COUNT(*) FROM benchmark_results
UNION ALL
SELECT 'binaries', COUNT(*) FROM binaries
UNION ALL
SELECT 'environments', COUNT(*) FROM environments
UNION ALL
SELECT 'auth_tokens', COUNT(*) FROM auth_tokens
UNION ALL
SELECT 'admin_users', COUNT(*) FROM admin_users
UNION ALL
SELECT 'admin_sessions', COUNT(*) FROM admin_sessions
ORDER BY row_count DESC;`
      },
      {
        name: '🔍 Index usage statistics',
        query: `SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;`
      },
      {
        name: '📊 Memory usage by benchmark',
        query: `SELECT 
  benchmark_name,
  COUNT(*) as result_count,
  pg_size_pretty(AVG(high_watermark_bytes)::bigint) as avg_memory,
  pg_size_pretty(MAX(high_watermark_bytes)) as max_memory,
  pg_size_pretty(MIN(high_watermark_bytes)) as min_memory,
  ROUND(STDDEV(high_watermark_bytes)/1024.0/1024.0, 2) as stddev_mb
FROM benchmark_results 
GROUP BY benchmark_name 
ORDER BY AVG(high_watermark_bytes) DESC;`
      },
      {
        name: '⏱️ Performance trends by Python version',
        query: `SELECT 
  CONCAT(c.python_major, '.', c.python_minor) as python_version,
  COUNT(DISTINCT c.sha) as commits_tested,
  COUNT(br.id) as total_benchmarks,
  pg_size_pretty(AVG(br.high_watermark_bytes)::bigint) as avg_memory_usage,
  COUNT(DISTINCT br.benchmark_name) as unique_benchmarks
FROM commits c
JOIN runs r ON c.sha = r.commit_sha
JOIN benchmark_results br ON r.run_id = br.run_id
GROUP BY c.python_major, c.python_minor
ORDER BY c.python_major DESC, c.python_minor DESC;`
      },
      {
        name: '📅 Data freshness check',
        query: `SELECT 
  'commits' as table_name,
  COUNT(*) as total_rows,
  MAX(timestamp) as latest_entry,
  MIN(timestamp) as oldest_entry,
  COUNT(CASE WHEN timestamp > NOW() - INTERVAL '7 days' THEN 1 END) as recent_week,
  COUNT(CASE WHEN timestamp > NOW() - INTERVAL '30 days' THEN 1 END) as recent_month
FROM commits
UNION ALL
SELECT 
  'runs',
  COUNT(*),
  MAX(timestamp),
  MIN(timestamp),
  COUNT(CASE WHEN timestamp > NOW() - INTERVAL '7 days' THEN 1 END),
  COUNT(CASE WHEN timestamp > NOW() - INTERVAL '30 days' THEN 1 END)
FROM runs;`
      }
    ],
    'Data Quality': [
      {
        name: '🔗 Orphaned records check',
        query: `SELECT 'Orphaned benchmark_results' as issue_type, COUNT(*) as count
FROM benchmark_results br
LEFT JOIN runs r ON br.run_id = r.run_id
WHERE r.run_id IS NULL
UNION ALL
SELECT 'Orphaned runs', COUNT(*)
FROM runs r
LEFT JOIN commits c ON r.commit_sha = c.sha
WHERE c.sha IS NULL
UNION ALL
SELECT 'Commits without runs', COUNT(*)
FROM commits c
LEFT JOIN runs r ON c.sha = r.commit_sha
WHERE r.commit_sha IS NULL;`
      },
      {
        name: '❌ Missing or invalid data',
        query: `SELECT 
  'Commits with empty messages' as issue_type, 
  COUNT(*) as count
FROM commits 
WHERE message IS NULL OR TRIM(message) = ''
UNION ALL
SELECT 'Results with zero memory', COUNT(*)
FROM benchmark_results 
WHERE high_watermark_bytes = 0 OR high_watermark_bytes IS NULL
UNION ALL
SELECT 'Runs with future timestamps', COUNT(*)
FROM runs 
WHERE timestamp > NOW()
UNION ALL
SELECT 'Inactive admin sessions', COUNT(*)
FROM admin_sessions 
WHERE is_active = false OR expires_at < NOW();`
      },
      {
        name: '📊 Duplicate detection',
        query: `SELECT 
  'Duplicate commit SHAs' as issue_type,
  COUNT(*) - COUNT(DISTINCT sha) as duplicates
FROM commits
UNION ALL
SELECT 'Duplicate run IDs',
  COUNT(*) - COUNT(DISTINCT run_id)
FROM runs
UNION ALL
SELECT 'Duplicate benchmark result IDs',
  COUNT(*) - COUNT(DISTINCT id)
FROM benchmark_results;`
      }
    ],
    'Performance Analysis': [
      {
        name: '🏃 Top performing benchmarks',
        query: `SELECT 
  br.benchmark_name,
  COUNT(*) as runs,
  pg_size_pretty(MIN(br.high_watermark_bytes)) as best_memory,
  pg_size_pretty(MAX(br.high_watermark_bytes)) as worst_memory,
  ROUND((MAX(br.high_watermark_bytes) - MIN(br.high_watermark_bytes)) / 
    MIN(br.high_watermark_bytes)::float * 100, 2) as variability_percent
FROM benchmark_results br
GROUP BY br.benchmark_name
HAVING COUNT(*) > 10
ORDER BY variability_percent DESC;`
      },
      {
        name: '🔄 Binary performance comparison',
        query: `SELECT 
  b.name as binary_name,
  COUNT(DISTINCT r.run_id) as total_runs,
  COUNT(DISTINCT br.benchmark_name) as benchmarks_tested,
  pg_size_pretty(AVG(br.high_watermark_bytes)::bigint) as avg_memory,
  COUNT(DISTINCT c.sha) as commits_tested
FROM binaries b
JOIN runs r ON b.id = r.binary_id
JOIN benchmark_results br ON r.run_id = br.run_id
JOIN commits c ON r.commit_sha = c.sha
GROUP BY b.id, b.name
ORDER BY AVG(br.high_watermark_bytes) DESC;`
      },
      {
        name: '🌍 Environment performance analysis',
        query: `SELECT 
  e.name as environment,
  COUNT(DISTINCT r.run_id) as total_runs,
  pg_size_pretty(AVG(br.high_watermark_bytes)::bigint) as avg_memory_usage,
  COUNT(DISTINCT br.benchmark_name) as unique_benchmarks,
  MAX(r.timestamp) as last_run
FROM environments e
JOIN runs r ON e.id = r.environment_id
JOIN benchmark_results br ON r.run_id = br.run_id
GROUP BY e.id, e.name
ORDER BY AVG(br.high_watermark_bytes) DESC;`
      }
    ],
    'Storage & Cleanup': [
      {
        name: '💾 Storage usage breakdown',
        query: `SELECT 
  'Flamegraph storage' as category,
  COUNT(CASE WHEN flamegraph_html IS NOT NULL THEN 1 END) as items_with_data,
  pg_size_pretty(SUM(LENGTH(flamegraph_html))::bigint) as total_size,
  pg_size_pretty(AVG(LENGTH(flamegraph_html))::bigint) as avg_size_per_item
FROM benchmark_results
UNION ALL
SELECT 
  'Commit messages',
  COUNT(CASE WHEN message IS NOT NULL THEN 1 END),
  pg_size_pretty(SUM(LENGTH(message))::bigint),
  pg_size_pretty(AVG(LENGTH(message))::bigint)
FROM commits;`
      },
      {
        name: '🗑️ Cleanup candidates',
        query: `SELECT 
  'Old runs (>90 days)' as cleanup_type,
  COUNT(*) as candidate_count,
  pg_size_pretty(COUNT(*) * 1000) as estimated_space_saved
FROM runs r
JOIN commits c ON r.commit_sha = c.sha
WHERE c.timestamp < NOW() - INTERVAL '90 days'
UNION ALL
SELECT 
  'Expired admin sessions',
  COUNT(*),
  pg_size_pretty(COUNT(*) * 500)
FROM admin_sessions
WHERE expires_at < NOW() OR is_active = false
UNION ALL
SELECT 
  'Unused auth tokens',
  COUNT(*),
  pg_size_pretty(COUNT(*) * 200)
FROM auth_tokens
WHERE is_active = false OR last_used < NOW() - INTERVAL '180 days';`
      }
    ],
    'Destructive Operations': [
      {
        name: '🗑️ Delete all flamegraphs',
        query: `UPDATE benchmark_results 
SET flamegraph_html = NULL 
WHERE flamegraph_html IS NOT NULL;`
      },
      {
        name: '🗑️ Delete old runs (>90 days)',
        query: `DELETE FROM runs 
WHERE run_id IN (
  SELECT r.run_id 
  FROM runs r 
  JOIN commits c ON r.commit_sha = c.sha 
  WHERE c.timestamp < NOW() - INTERVAL '90 days'
);`
      },
      {
        name: '🗑️ Delete results for specific benchmark',
        query: `DELETE FROM benchmark_results 
WHERE benchmark_name = 'REPLACE_WITH_BENCHMARK_NAME';`
      },
      {
        name: '🗑️ Clean up orphaned commits',
        query: `DELETE FROM commits 
WHERE sha NOT IN (SELECT DISTINCT commit_sha FROM runs);`
      },
      {
        name: '🗑️ Delete inactive tokens',
        query: `DELETE FROM auth_tokens 
WHERE is_active = false 
OR last_used < NOW() - INTERVAL '180 days';`
      },
      {
        name: '🗑️ Clear expired admin sessions',
        query: `DELETE FROM admin_sessions 
WHERE expires_at < NOW() OR is_active = false;`
      },
      {
        name: '🗑️ Delete benchmark results by memory threshold',
        query: `DELETE FROM benchmark_results 
WHERE high_watermark_bytes > 1000000000; -- 1GB threshold`
      },
      {
        name: '🗑️ Remove old Python version data (Step 1: benchmark_results)',
        query: `-- First delete benchmark_results for old Python versions
DELETE FROM benchmark_results 
WHERE run_id IN (
  SELECT r.run_id 
  FROM runs r 
  JOIN commits c ON r.commit_sha = c.sha 
  WHERE c.python_major < 3 OR (c.python_major = 3 AND c.python_minor < 10)
);`
      },
      {
        name: '🗑️ Remove old Python version data (Step 2: runs)',
        query: `-- Then delete runs for old Python versions
DELETE FROM runs 
WHERE run_id IN (
  SELECT r.run_id 
  FROM runs r 
  JOIN commits c ON r.commit_sha = c.sha 
  WHERE c.python_major < 3 OR (c.python_major = 3 AND c.python_minor < 10)
);`
      },
      {
        name: '🗑️ Delete specific Python version data',
        query: `-- Template: Replace X with Python minor version (e.g., 15)
-- Run this query twice: first for benchmark_results, then for runs
DELETE FROM benchmark_results 
WHERE run_id IN (
  SELECT run_id FROM runs WHERE python_minor = X
);
-- DELETE FROM runs WHERE python_minor = X;`
      },
      {
        name: '🗑️ Delete binary data (Step 1: benchmark_results)',
        query: `-- First delete benchmark_results for specific binary
DELETE FROM benchmark_results 
WHERE run_id IN (
  SELECT run_id FROM runs WHERE binary_id = 'REPLACE_WITH_BINARY_ID'
);`
      },
      {
        name: '🗑️ Delete binary data (Step 2: runs)',
        query: `-- Then delete runs for specific binary
DELETE FROM runs WHERE binary_id = 'REPLACE_WITH_BINARY_ID';`
      },
      {
        name: '🗑️ Delete environment data (Step 1: benchmark_results)',
        query: `-- First delete benchmark_results for specific environment
DELETE FROM benchmark_results 
WHERE run_id IN (
  SELECT run_id FROM runs WHERE environment_id = 'REPLACE_WITH_ENVIRONMENT_ID'
);`
      },
      {
        name: '🗑️ Delete environment data (Step 2: runs)',
        query: `-- Then delete runs for specific environment
DELETE FROM runs WHERE environment_id = 'REPLACE_WITH_ENVIRONMENT_ID';`
      },
      {
        name: '🗑️ Delete old data (Step 1: benchmark_results)',
        query: `-- First delete benchmark_results older than 6 months
DELETE FROM benchmark_results 
WHERE run_id IN (
  SELECT r.run_id 
  FROM runs r 
  JOIN commits c ON r.commit_sha = c.sha 
  WHERE c.timestamp < NOW() - INTERVAL '6 months'
);`
      },
      {
        name: '🗑️ Delete old data (Step 2: runs)',
        query: `-- Then delete runs older than 6 months
DELETE FROM runs 
WHERE run_id IN (
  SELECT r.run_id 
  FROM runs r 
  JOIN commits c ON r.commit_sha = c.sha 
  WHERE c.timestamp < NOW() - INTERVAL '6 months'
);`
      },
      {
        name: '🗑️ Delete largest benchmark results',
        query: `-- Delete benchmark results consuming most storage
DELETE FROM benchmark_results 
WHERE id IN (
  SELECT id FROM benchmark_results 
  ORDER BY LENGTH(COALESCE(flamegraph_html, '')) DESC 
  LIMIT 100
);`
      },
      {
        name: '🗑️ Keep only latest N commits per Python version',
        query: `-- Keep only the 50 most recent commits per Python version
DELETE FROM benchmark_results 
WHERE run_id IN (
  SELECT r.run_id FROM runs r
  JOIN commits c ON r.commit_sha = c.sha
  WHERE c.sha NOT IN (
    SELECT sha FROM (
      SELECT sha, ROW_NUMBER() OVER (
        PARTITION BY python_major, python_minor 
        ORDER BY timestamp DESC
      ) as rn
      FROM commits
    ) ranked WHERE rn <= 50
  )
);
DELETE FROM runs 
WHERE commit_sha NOT IN (
  SELECT sha FROM (
    SELECT sha, ROW_NUMBER() OVER (
      PARTITION BY python_major, python_minor 
      ORDER BY timestamp DESC
    ) as rn
    FROM commits
  ) ranked WHERE rn <= 50
);`
      }
    ],
    '💀 NUCLEAR OPTIONS': [
      {
        name: '💀 LEVEL 1: Benchmark data only',
        query: `-- 💀 NUKE LEVEL 1: Remove benchmark results and runs
-- PRESERVES: Commits, binaries, environments, all admin data
-- USE CASE: Clean up benchmark data while keeping commit history
-- RECOVERY: Re-run benchmarks on existing commits
DELETE FROM benchmark_results;
DELETE FROM runs;`
      },
      {
        name: '💀 LEVEL 2: All performance data',
        query: `-- 💀 NUKE LEVEL 2: Remove all performance tracking data  
-- PRESERVES: Binaries, environments, admin users, auth tokens
-- DESTROYS: All benchmark results, runs, commit history
-- USE CASE: Start fresh tracking but keep configuration
-- RECOVERY: Re-add commits and re-run all benchmarks
DELETE FROM benchmark_results;
DELETE FROM runs;
DELETE FROM commits;`
      },
      {
        name: '💀 LEVEL 3: Everything except admin',
        query: `-- 💀 NUKE LEVEL 3: Nuclear reset keeping only admin access
-- PRESERVES: Admin users (you can still log in)
-- DESTROYS: All data, all auth tokens, all configurations
-- USE CASE: Complete data reset while preserving admin accounts
-- RECOVERY: Reconfigure everything from scratch
DELETE FROM benchmark_results;
DELETE FROM runs;  
DELETE FROM commits;
DELETE FROM auth_tokens;
DELETE FROM admin_sessions;
DELETE FROM environments;
DELETE FROM binaries;`
      },
      {
        name: '💀 LEVEL 4: Total annihilation',
        query: `-- 💀 NUKE LEVEL 4: TOTAL DESTRUCTION OF EVERYTHING
-- PRESERVES: Nothing (you will lose admin access!)
-- DESTROYS: Every single piece of data in the database
-- USE CASE: Complete database reset/corruption recovery  
-- RECOVERY: Manual database recreation required
-- ⚠️ WARNING: You will be locked out and need DB admin access!
TRUNCATE TABLE benchmark_results CASCADE;
TRUNCATE TABLE runs CASCADE;
TRUNCATE TABLE commits CASCADE;
TRUNCATE TABLE auth_tokens CASCADE;
TRUNCATE TABLE admin_sessions CASCADE;
TRUNCATE TABLE admin_users CASCADE;
TRUNCATE TABLE environments CASCADE;
TRUNCATE TABLE binaries CASCADE;`
      },
      {
        name: '💀 LEVEL 5: Emergency recovery mode',
        query: `-- 💀 NUKE LEVEL 5: Emergency factory reset with recovery admin
-- PRESERVES: One admin user (replace username below)
-- DESTROYS: Everything else in the entire database
-- USE CASE: Database corruption with single admin recovery
-- RECOVERY: One admin can rebuild everything
-- ⚠️ CRITICAL: Replace 'YOUR_GITHUB_USERNAME' before running!
TRUNCATE TABLE benchmark_results CASCADE;
TRUNCATE TABLE runs CASCADE;
TRUNCATE TABLE commits CASCADE;
TRUNCATE TABLE auth_tokens CASCADE;
TRUNCATE TABLE admin_sessions CASCADE;
DELETE FROM admin_users WHERE github_username != 'YOUR_GITHUB_USERNAME';
TRUNCATE TABLE environments CASCADE;
TRUNCATE TABLE binaries CASCADE;`
      }
    ],
    'Maintenance': [
      {
        name: '🔧 Database maintenance info',
        query: `SELECT 
  'Last VACUUM' as operation,
  COALESCE(last_vacuum::text, 'Never') as last_run,
  COALESCE(last_autovacuum::text, 'Never') as last_auto_run
FROM pg_stat_user_tables 
WHERE schemaname = 'public' AND relname = 'benchmark_results'
UNION ALL
SELECT 
  'Last ANALYZE',
  COALESCE(last_analyze::text, 'Never'),
  COALESCE(last_autoanalyze::text, 'Never')
FROM pg_stat_user_tables 
WHERE schemaname = 'public' AND relname = 'benchmark_results';`
      },
      {
        name: '📊 Query performance stats',
        query: `SELECT 
  query,
  calls,
  total_time,
  mean_time,
  rows
FROM pg_stat_statements 
WHERE query LIKE '%benchmark_results%' 
ORDER BY total_time DESC 
LIMIT 10;`
      }
    ]
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Query Console</h2>
          <p className="text-gray-600">
            Execute custom SQL queries against the database
          </p>
        </div>
      </div>

      {/* Query Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Query Panel */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Terminal className="w-5 h-5 mr-2" />
                SQL Query
              </CardTitle>
              <CardDescription>
                Enter your SQL query below. Read-only mode is enabled by default for safety.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <AceEditor
                  mode="sql"
                  theme="monokai"
                  value={query}
                  onChange={setQuery}
                  name="sql-editor"
                  editorProps={{ $blockScrolling: true }}
                  width="100%"
                  height="200px"
                  fontSize={14}
                  showPrintMargin={false}
                  showGutter={true}
                  highlightActiveLine={true}
                  onLoad={(editor) => {
                    aceEditorRef.current = { editor };
                    // Set up autocomplete if schemas are already loaded
                    if (Object.keys(allSchemas).length > 0) {
                      setupAutoComplete(editor, allSchemas);
                    }
                  }}
                  setOptions={{
                    enableBasicAutocompletion: true,
                    enableLiveAutocompletion: true,
                    enableSnippets: true,
                    showLineNumbers: true,
                    tabSize: 2,
                  }}
                  style={{
                    borderRadius: '6px',
                    border: '1px solid hsl(var(--border))',
                  }}
                />
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="read-only"
                    checked={readOnly}
                    onCheckedChange={(checked) => setReadOnly(checked === true)}
                  />
                  <Label htmlFor="read-only">Read-only mode</Label>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Button 
                  onClick={executeQuery} 
                  disabled={loading || !query.trim()}
                  className="flex items-center"
                >
                  <Play className="w-4 h-4 mr-2" />
                  {loading ? 'Executing...' : 'Execute Query'}
                </Button>

                {result?.rows && result?.column_names && (
                  <Button variant="outline" onClick={exportToCSV}>
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          {result && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    {result.success ? (
                      <CheckCircle className="w-5 h-5 mr-2 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 mr-2 text-red-500" />
                    )}
                    Query Results
                  </CardTitle>
                  {result.execution_time_ms && (
                    <Badge variant="outline" className="flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {result.execution_time_ms}ms
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {result.success ? (
                  result.rows && result.rows.length > 0 ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          {result.rows.length} rows returned
                        </p>
                      </div>
                      
                      <div className="border rounded-lg overflow-hidden">
                        <div className="max-h-96 overflow-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                {result.column_names?.map((col) => (
                                  <TableHead key={col} className="font-medium">
                                    {col}
                                  </TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {result.rows.map((row, index) => (
                                <TableRow key={index}>
                                  {result.column_names?.map((col) => (
                                    <TableCell key={col} className="font-mono text-sm">
                                      {row[col] !== null && row[col] !== undefined 
                                        ? String(row[col]) 
                                        : <span className="text-muted-foreground italic">null</span>
                                      }
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                      <h3 className="text-lg font-medium">Query Executed Successfully</h3>
                      <p className="text-muted-foreground">
                        {result.affected_rows !== undefined && result.affected_rows !== null
                          ? `${result.affected_rows} rows affected`
                          : 'Query completed successfully'
                        }
                      </p>
                    </div>
                  )
                ) : (
                  <div className="text-center py-8">
                    <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium">Query Failed</h3>
                    <p className="text-red-600 font-mono text-sm mt-2">
                      {result.error}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Database Schema */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Database className="w-5 h-5 mr-2" />
                Database Schema
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="table-select">Tables</Label>
                <Select
                  value={selectedTable}
                  onValueChange={(value) => {
                    setSelectedTable(value);
                    loadTableSchema(value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a table..." />
                  </SelectTrigger>
                  <SelectContent>
                    {tables.map((table) => (
                      <SelectItem key={table} value={table}>
                        {table}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {tableSchema && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Columns</h4>
                  <div className="space-y-1 max-h-48 overflow-auto">
                    {tableSchema.columns?.map((column) => (
                      <div key={column.name} className="text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-mono">{column.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {column.type}
                          </Badge>
                        </div>
                        {!column.nullable && (
                          <span className="text-muted-foreground">NOT NULL</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => 
                      insertSampleQuery(`SELECT * FROM ${tableSchema.name} LIMIT 10;`)
                    }
                    className="w-full"
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    Preview Table
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sample Queries */}
          <div className="space-y-2">
            {Object.entries(queryCategories).map(([category, queries]) => (
              <Dialog key={category}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <BookOpen className="w-4 h-4 mr-2" />
                    {category}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
                  <DialogHeader>
                    <DialogTitle>{category} Queries</DialogTitle>
                    <DialogDescription>
                      Browse and select from pre-built {category.toLowerCase()} queries to help you get started.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                    {queries.map((sample, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={() => insertSampleQuery(sample.query)}
                        className="w-full justify-start text-left h-auto py-3"
                      >
                        <div className="w-full overflow-hidden">
                          <div className="font-medium text-sm mb-1">{sample.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {sample.query.split('\n')[0].substring(0, 60)}...
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            ))}
          </div>

          {/* Query History */}
          {queryHistory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Queries</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {queryHistory.slice(0, 5).map((historyQuery, index) => (
                  <Button
                    key={index}
                    variant="ghost"
                    size="sm"
                    onClick={() => setQuery(historyQuery)}
                    className="w-full justify-start text-left h-auto py-2"
                  >
                    <div className="truncate text-xs font-mono">
                      {historyQuery.substring(0, 50)}...
                    </div>
                  </Button>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}