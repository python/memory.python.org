import { useState, useEffect } from 'react';

interface MemrayStatus {
  has_failures: boolean;
  failure_count: number;
  affected_environments: Array<{
    binary_id: string;
    environment_id: string;
    binary_name: string;
    environment_name: string;
    latest_failure: string;
    commit_sha: string;
    error_message: string;
    failure_timestamp: string;
  }>;
  message: string;
}

export function useMemrayStatus() {
  const [status, setStatus] = useState<MemrayStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000/api';

  const fetchStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/memray-status`);
      if (!response.ok) {
        throw new Error('Failed to fetch memray status');
      }
      const data = await response.json();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    
    // Refresh status every 5 minutes
    const interval = setInterval(fetchStatus, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [API_BASE]);

  const refresh = () => {
    setLoading(true);
    fetchStatus();
  };

  return { status, loading, error, refresh };
}