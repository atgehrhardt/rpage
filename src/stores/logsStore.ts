import { writable, get } from 'svelte/store';
import type { Automation } from '../types';
import { fetchAPI } from '../utils/api';

export interface LogEntry {
  id: string;
  automationId: string;
  automationName: string;
  status: 'completed' | 'failed';
  output: string;
  timestamp: string;
}

// Pagination and loading states
export const PAGE_SIZE = 10; // Slightly increased page size for better initial load
export const logs = writable<LogEntry[]>([]);
export const isLoadingLogs = writable<boolean>(false);
export const hasMoreLogs = writable<boolean>(true);
export const currentPage = writable<number>(1);
export const totalLogCount = writable<number>(0);
export const lastLogsRefresh = writable<number>(0); // Timestamp of last refresh

// Cache for truncated log content - using WeakMap to avoid memory leaks
const logContentCache = new WeakMap<LogEntry, string>();

// New store to track if logs have been requested
export const logsRequested = writable<boolean>(false);

// Function to safely truncate long log output
export function getTruncatedLogOutput(log: LogEntry): string {
  // Check if we already have a cached truncated version
  if (logContentCache.has(log)) {
    return logContentCache.get(log)!;
  }
  
  const MAX_LOG_LENGTH = 5000; // Limit log length to prevent UI freeze
  
  if (!log.output) return '';
  
  // If log is too long, truncate it
  if (log.output.length > MAX_LOG_LENGTH) {
    const truncated = log.output.substring(0, MAX_LOG_LENGTH) + 
      '\n\n[Log output truncated for performance. Full log available via API]';
    
    // Cache the truncated result
    logContentCache.set(log, truncated);
    return truncated;
  }
  
  // For short logs, return as is
  return log.output;
}

// Function to add a log entry
export async function addLogEntry(automation: Automation, status: 'completed' | 'failed'): Promise<void> {
  if (!automation.output) return;
  
  // Truncate long outputs before storing to prevent UI performance issues
  const MAX_LOG_LENGTH = 10000; // Higher limit for storage vs display
  const outputToStore = automation.output.length > MAX_LOG_LENGTH 
    ? automation.output.substring(0, MAX_LOG_LENGTH) + '\n\n[Log truncated due to size limits]'
    : automation.output;
  
  const newEntry: LogEntry = {
    id: Date.now().toString(),
    automationId: automation.id,
    automationName: automation.name,
    status,
    output: outputToStore,
    timestamp: new Date().toISOString()
  };
  
  // Pre-cache the truncated version
  getTruncatedLogOutput(newEntry);
  
  // Update the local store (for immediate UI update)
  logs.update(entries => [newEntry, ...entries]);
  
  // Save the log entry to the server in the background
  // Don't await this - we don't want to block the UI
  setTimeout(() => {
    fetchAPI('/logs', {
      method: 'POST',
      body: JSON.stringify(newEntry)
    }).catch(error => {
      console.error('Error saving log entry to server:', error);
    });
  }, 0);
}

// Reset log pagination
export function resetLogPagination(): void {
  logs.set([]);
  currentPage.set(1);
  hasMoreLogs.set(true);
}

// Load initial batch of logs
export async function loadInitialLogs(): Promise<void> {
  // Check if refresh is needed - if last refresh was within 5 seconds, don't refresh
  let shouldRefresh = true;
  const now = Date.now();
  const lastRefresh = get(lastLogsRefresh);
  
  // Only skip refresh if we already have logs loaded and refresh was recent
  if (get(logs).length > 0 && now - lastRefresh < 5000) {
    console.log('Skipping logs refresh - last refresh was < 5 seconds ago');
    shouldRefresh = false;
    return;
  }
  
  // Update refresh timestamp
  lastLogsRefresh.set(now);
  
  // Reset pagination and load new data
  resetLogPagination();
  logsRequested.set(true);
  await loadMoreLogs();
}

// Load more logs incrementally, with backgrounded data fetching
export function loadMoreLogs(): Promise<void> {
  return new Promise((resolve) => {
    let loading = false;
    let hasMore = true;
    
    // Get current state values safely
    const unsubLoading = isLoadingLogs.subscribe(value => { loading = value; });
    const unsubHasMore = hasMoreLogs.subscribe(value => { hasMore = value; });
    
    // Make sure to unsubscribe to avoid memory leaks
    unsubLoading();
    unsubHasMore();
    
    // Don't load if we're already loading or there are no more results
    if (loading || !hasMore) {
      resolve();
      return;
    }
    
    // Set loading state
    isLoadingLogs.set(true);
    
    // Get current page value safely
    let page = 1;
    const unsubPage = currentPage.subscribe(value => { page = value; });
    unsubPage();
    
    // Use a Web Worker or requestIdleCallback when available for non-blocking data fetching
    const fetchData = async () => {
      try {
        // Try the API with pagination parameters
        const response = await fetchAPI(`/logs?page=${page}&limit=${PAGE_SIZE}`);
        
        let newLogs: LogEntry[] = [];
        
        if (response?.success && Array.isArray(response.data)) {
          newLogs = response.data;
        } else if (response && Array.isArray(response)) {
          newLogs = response;
        } else {
          // Fallback to direct endpoint
          const directResponse = await fetchAPI(`/logs-direct?page=${page}&limit=${PAGE_SIZE}`);
          if (Array.isArray(directResponse)) {
            newLogs = directResponse;
          }
        }
        
        // Process logs to ensure they're not too large for the UI
        newLogs = newLogs.map(log => {
          // Pre-cache truncated output for better UI rendering
          if (log.output) {
            getTruncatedLogOutput(log);
          }
          return log;
        });
        
        // Update pagination state
        if (newLogs.length < PAGE_SIZE) {
          hasMoreLogs.set(false);
        } else {
          currentPage.update(p => p + 1);
        }
        
        // Update total count if available
        if (response && response.total) {
          totalLogCount.set(response.total);
        }

        // Update logs store with new data
        if (newLogs.length > 0) {
          // Single update for better performance
          logs.update(existing => [...existing, ...newLogs]);
        }
      } catch (error) {
        console.error('Error loading logs:', error);
        hasMoreLogs.set(false); // Stop trying on error
      } finally {
        isLoadingLogs.set(false);
        resolve();
      }
    };

    // Use requestIdleCallback if available for better performance
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(() => fetchData());
    } else {
      // Fallback to setTimeout
      setTimeout(fetchData, 0);
    }
  });
}

// Function to clear all logs
export async function clearLogs(): Promise<void> {
  // Update UI immediately for responsiveness
  logs.set([]);
  
  // Then update server in background
  setTimeout(async () => {
    try {
      await fetchAPI('/logs', {
        method: 'DELETE'
      });
    } catch (error) {
      console.error('Error clearing logs:', error);
    }
  }, 0);
}

// Don't initialize logs automatically
// We'll load them when the component requests