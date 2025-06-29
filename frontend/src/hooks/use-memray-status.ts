import { useState, useEffect } from 'react';
import api from '@/lib/api';
import type { MemrayStatus } from '@/lib/types';

export function useMemrayStatus() {
  const [status, setStatus] = useState<MemrayStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000/api';

  const fetchStatus = async () => {
    try {
      const status = await api.getMemrayStatus();
      setStatus(status);
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