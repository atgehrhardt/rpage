import { writable, derived, get } from 'svelte/store';
import { fetchAPI } from '../utils/api';

export interface OutputFile {
  id: string;
  automationId: string;
  name: string;
  type: string;
  data: string;
  timestamp: string;
}

// Pagination and loading states
export const PAGE_SIZE = 30; // Increased page size for more efficient infinite scrolling
export const PRIORITY_FILES_COUNT = 5; // Increased priority files for better initial view
export const currentOutput = writable<string>('');
export const outputFiles = writable<OutputFile[]>([]);
export const priorityOutputFiles = writable<OutputFile[]>([]); // Store for priority files
export const isLoadingOutputs = writable<boolean>(false);
export const isPriorityLoaded = writable<boolean>(false); // Track if priority files are loaded
export const hasMoreOutputs = writable<boolean>(true);
export const currentPage = writable<number>(1);
export const totalOutputCount = writable<number>(0);
export const outputsRequested = writable<boolean>(false);
export const lastOutputsRefresh = writable<number>(0); // Timestamp of last refresh

// Store for cached parsed data to avoid re-parsing
const parsedDataCache = new Map<string, any>();

// Global cache for grouped output data with timestamp
export const outputsByTypeCache = {
  data: null as Record<string, OutputFile[]> | null,
  timestamp: 0
};

// Time to keep cache valid (3 seconds)
const CACHE_TTL = 3000;

// Calculate grouped outputs by type once and cache the result
// Optimized to reduce UI overhead with cache to prevent excessive recalculations
export const outputsByType = derived([outputFiles, priorityOutputFiles], ([$outputFiles, $priorityOutputFiles]) => {
  // Check if we can return cached data
  if (outputsByTypeCache.data && Date.now() - outputsByTypeCache.timestamp < CACHE_TTL) {
    return outputsByTypeCache.data;
  }
  
  console.log('Recalculating outputs grouping (cache expired or not set)');
  const grouped: Record<string, OutputFile[]> = {};
  
  // Process priority files first (always include all of them)
  $priorityOutputFiles.forEach(file => {
    const type = file.type || 'other';
    if (!grouped[type]) {
      grouped[type] = [];
    }
    grouped[type].push(file);
  });
  
  // Then process regular files (limit to 50 max to prevent UI freezing)
  // Filter out any files already in priorityOutputFiles
  const priorityIds = new Set($priorityOutputFiles.map(file => file.id));
  const remainingFiles = $outputFiles
    .filter(file => !priorityIds.has(file.id))
    .slice(0, 50); // Reduced from 100 to 50 for better performance
  
  remainingFiles.forEach(file => {
    const type = file.type || 'other';
    if (!grouped[type]) {
      grouped[type] = [];
    }
    grouped[type].push(file);
  });
  
  // Pre-sort each group by timestamp (newest first)
  Object.values(grouped).forEach(group => {
    group.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  });
  
  // Cache the result
  outputsByTypeCache.data = grouped;
  outputsByTypeCache.timestamp = Date.now();
  
  return grouped;
});

// Reset the current output
export function resetOutput(): void {
  currentOutput.set('');
}

// Append to the current output
export function appendOutput(text: string): void {
  currentOutput.update(value => value + text);
}

// Prioritization categories for parsing
const PRIORITY_HIGH = 1;
const PRIORITY_MEDIUM = 2;
const PRIORITY_LOW = 3;

// Queue for background parsing
const parseQueue: {file: OutputFile, priority: number}[] = [];
let isProcessingQueue = false;

// Process the parsing queue in background
function processParseQueue() {
  if (isProcessingQueue || parseQueue.length === 0) return;
  
  isProcessingQueue = true;
  
  // Sort queue by priority (lower number = higher priority)
  parseQueue.sort((a, b) => a.priority - b.priority);
  
  // Process one item from queue
  const item = parseQueue.shift();
  if (!item) {
    isProcessingQueue = false;
    return;
  }
  
  try {
    // Don't parse if already cached
    if (!parsedDataCache.has(item.file.id) && item.file.data) {
      const parsed = JSON.parse(item.file.data);
      parsedDataCache.set(item.file.id, parsed);
      
      // Trigger UI refresh without full recalculation
      if (item.priority === PRIORITY_HIGH) {
        // Force a lightweight update
        outputFiles.update(files => files);
      }
    }
  } catch (e) {
    // Store original data on parse error
    if (!parsedDataCache.has(item.file.id)) {
      parsedDataCache.set(item.file.id, item.file.data);
    }
  }
  
  // Schedule next item with small delay to prevent blocking UI
  setTimeout(() => {
    isProcessingQueue = false;
    if (parseQueue.length > 0) {
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        window.requestIdleCallback(() => processParseQueue());
      } else {
        setTimeout(processParseQueue, 0);
      }
    }
  }, 5);
}

// Fast lightweight preview generator for files
export function getFilePreview(file: OutputFile): any {
  // Always return a lightweight placeholder structure to ensure UI renders quickly
  return {
    id: file.id,
    type: file.type,
    name: file.name,
    timestamp: file.timestamp,
    // Create minimal preview to show before full data is processed
    preview: file.data ? file.data.substring(0, 20) + '...' : null,
    // Flag to indicate this is just a preview until full parsing is done
    isPreview: true
  };
}

// Parse and cache output data with performance optimizations and background processing
export function getParsedData(file: OutputFile): any {
  if (!file.data) return null;
  
  // Check if we already parsed this data
  if (parsedDataCache.has(file.id)) {
    return parsedDataCache.get(file.id);
  }
  
  // If this is the first access, just create a placeholder and queue the real parse
  // This ensures the UI renders immediately with a placeholder
  const preview = getFilePreview(file);
  
  // Queue the actual parsing to happen in background
  setTimeout(() => {
    // Background parsing task, won't block UI
    try {
      // Fast check: if it's not likely to be JSON, don't attempt parsing
      const trimmedData = file.data.trim();
      if (!(trimmedData.startsWith('{') || trimmedData.startsWith('['))) {
        parsedDataCache.set(file.id, file.data);
        return;
      }
      
      // Add to parse queue with priority based on type
      const isHighPriority = file.type === 'screenshot';
      
      parseQueue.push({
        file,
        priority: isHighPriority ? PRIORITY_HIGH : PRIORITY_MEDIUM
      });
      
      // Start queue processing if not already running
      if (!isProcessingQueue && typeof window !== 'undefined') {
        if ('requestIdleCallback' in window) {
          window.requestIdleCallback(processParseQueue);
        } else {
          setTimeout(processParseQueue, 0);
        }
      }
    } catch (e) {
      // Store original on error
      parsedDataCache.set(file.id, file.data);
    }
  }, 0);
  
  // Immediately return the lightweight preview for fast UI rendering
  return preview;
}

// Reset output pagination
export function resetOutputPagination(): void {
  outputFiles.set([]);
  priorityOutputFiles.set([]);
  isPriorityLoaded.set(false);
  currentPage.set(1);
  hasMoreOutputs.set(true);
  
  // Also clear outputsByTypeCache to force recalculation
  outputsByTypeCache.data = null;
  outputsByTypeCache.timestamp = 0;
  
  // Clear parse queue to avoid processing old files
  while (parseQueue.length > 0) {
    parseQueue.pop();
  }
}

// Load priority output files (most recent ones)
export async function loadPriorityOutputs(): Promise<void> {
  // First set loading state
  isLoadingOutputs.set(true);
  
  // Then decouple UI update from data loading with a small delay
  // This makes the UI responsive immediately
  setTimeout(async () => {
    try {
      const response = await fetchAPI(`/outputs?page=1&limit=${PRIORITY_FILES_COUNT}&sort=desc`);
      
      let priorityFiles: OutputFile[] = [];
      
      if (response?.success && Array.isArray(response.files)) {
        priorityFiles = response.files;
      } else if (response && Array.isArray(response)) {
        priorityFiles = response;
      } else {
        // Fallback to direct endpoint
        const directResponse = await fetchAPI(`/outputs-direct?page=1&limit=${PRIORITY_FILES_COUNT}&sort=desc`);
        if (Array.isArray(directResponse)) {
          priorityFiles = directResponse;
        }
      }
      
      // Update store with container objects immediately for fast UI rendering
      if (priorityFiles.length > 0) {
        priorityOutputFiles.set(priorityFiles);
      }
      
      // Mark priority loading as complete so UI can show something right away
      isPriorityLoaded.set(true);
      
      // Then process actual file data in background to avoid blocking UI
      if (priorityFiles.length > 0) {
        setTimeout(() => {
          console.log('Processing priority file data in background...');
          priorityFiles.forEach((file, index) => {
            // Stagger file processing to prevent UI jank
            setTimeout(() => {
              if (file.data) {
                getParsedData(file);
              }
              
              // Force lightweight UI refresh after each file is processed
              if ((index + 1) % 2 === 0) {
                priorityOutputFiles.update(files => files);
              }
            }, index * 50);
          });
        }, 100);
      }
    } catch (error) {
      console.error('Error loading priority output files:', error);
    } finally {
      isLoadingOutputs.set(false);
    }
  }, 0);
}

// Load initial batch of output files
export async function loadInitialOutputs(): Promise<void> {
  // Check if refresh is needed - if last refresh was within 5 seconds, don't refresh
  const now = Date.now();
  const lastRefresh = get(lastOutputsRefresh);
  
  // Only skip refresh if we already have outputs loaded and refresh was recent
  if ((get(outputFiles).length > 0 || get(priorityOutputFiles).length > 0) && 
      now - lastRefresh < 5000) {
    console.log('Skipping outputs refresh - last refresh was < 5 seconds ago');
    return;
  }
  
  // Update refresh timestamp
  lastOutputsRefresh.set(now);
  
  resetOutputPagination();
  outputsRequested.set(true);
  
  // First load priority files, then load the rest
  await loadPriorityOutputs();
  await loadMoreOutputs();
}

// Load more output files incrementally with background loading
export function loadMoreOutputs(): Promise<void> {
  return new Promise((resolve) => {
    let loading = false;
    let hasMore = true;
    let priorityLoaded = false;
    
    // Get current state values safely
    const unsubLoading = isLoadingOutputs.subscribe(value => { loading = value; });
    const unsubHasMore = hasMoreOutputs.subscribe(value => { hasMore = value; });
    const unsubPriorityLoaded = isPriorityLoaded.subscribe(value => { priorityLoaded = value; });
    
    // Make sure to unsubscribe to avoid memory leaks
    unsubLoading();
    unsubHasMore();
    unsubPriorityLoaded();
    
    // Don't load if we're already loading or there are no more results
    if (loading || !hasMore) {
      resolve();
      return;
    }
    
    // Set loading state
    isLoadingOutputs.set(true);
    
    // Allow the UI to become responsive immediately
    setTimeout(async () => {
      try {
        // Get current page value safely
        let page = 1;
        const unsubPage = currentPage.subscribe(value => { page = value; });
        unsubPage();
        
        // Skip priority files if they're already loaded
        const skipCount = priorityLoaded ? PRIORITY_FILES_COUNT : 0;
        
        // Try the API with pagination parameters
        const response = await fetchAPI(`/outputs?page=${page}&limit=${PAGE_SIZE}&skip=${skipCount}`);
        
        let newOutputs: OutputFile[] = [];
        
        if (response?.success && Array.isArray(response.files)) {
          newOutputs = response.files;
        } else if (response && Array.isArray(response)) {
          newOutputs = response;
        } else {
          // Fallback to direct endpoint
          const directResponse = await fetchAPI(`/outputs-direct?page=${page}&limit=${PAGE_SIZE}&skip=${skipCount}`);
          if (Array.isArray(directResponse)) {
            newOutputs = directResponse;
          }
        }
        
        // Update pagination state
        if (newOutputs.length < PAGE_SIZE) {
          hasMoreOutputs.set(false);
        } else {
          currentPage.update(p => p + 1);
        }
        
        // Update total count if available
        if (response && response.total) {
          totalOutputCount.set(response.total);
        }
        
        // Process outputs in a non-blocking way
        if (newOutputs.length > 0) {
          // Filter out any files already in priorityOutputFiles
          let priorityIds = new Set<string>([]);
          const unsubPriority = priorityOutputFiles.subscribe(files => {
            priorityIds = new Set(files.map(file => file.id));
          });
          unsubPriority();
          
          // Remove any files that are already in priorityOutputFiles
          newOutputs = newOutputs.filter(file => !priorityIds.has(file.id));
          
          // Update the store with lightweight file containers ASAP
          // This renders the UI immediately with just containers
          outputFiles.update(existing => [...existing, ...newOutputs]);
          
          // Then background process the actual file data
          // This avoids blocking the UI while processing potentially large files
          setTimeout(() => {
            try {
              console.log('Background processing file data...');
              newOutputs.forEach((file, index) => {
                // Stagger processing to avoid jank
                setTimeout(() => {
                  getParsedData(file);
                }, index * 10);
              });
            } catch (err) {
              console.error('Error in background processing:', err);
            }
          }, 50);
        }
      } catch (error) {
        console.error('Error loading output files:', error);
        hasMoreOutputs.set(false); // Stop trying on error
      } finally {
        isLoadingOutputs.set(false);
        resolve();
      }
    }, 0);
  });
}

// Delete an output file
export async function deleteOutputFile(id: string): Promise<boolean> {
  // Update UI immediately for responsiveness
  outputFiles.update(files => {
    const filteredFiles = files.filter(file => file.id !== id);
    // Force store to update by returning a new array
    return [...filteredFiles];
  });
  
  priorityOutputFiles.update(files => {
    const filteredFiles = files.filter(file => file.id !== id);
    // Force store to update by returning a new array
    return [...filteredFiles];
  });
  
  // Clean up cached data
  parsedDataCache.delete(id);
  
  // Force outputsByTypeCache to invalidate immediately so UI updates
  outputsByTypeCache.data = null;
  outputsByTypeCache.timestamp = 0;
  
  // Then delete from server immediately (not in background)
  try {
    // Delete from server - important to await this
    const response = await fetchAPI(`/outputs/${id}`, {
      method: 'DELETE'
    });
    
    // Log the response for debugging
    console.log(`Delete output response for ID ${id}:`, response);
    
    // Clear API cache for outputs from the api.ts module
    import('../utils/api').then(api => {
      if (typeof api.clearOutputsCache === 'function') {
        api.clearOutputsCache();
      }
    });
    
    // Update UI one more time after server response
    outputFiles.update(files => [...files]);
    priorityOutputFiles.update(files => [...files]);
    
    // Force a refresh of the derived store
    outputsByType.update(value => value);
    
    // Check response structure - API returns {success: true, data: {id}} on success
    if (response && (response.success === true || (response.data && response.data.id))) {
      return true;
    } else if (typeof response === 'object') {
      // Some APIs just return the data without a success field
      return true; // Assume success if we got a response object
    }
    
    return false;
  } catch (error) {
    console.error('Error deleting output file:', error);
    return false;
  }
}

// Test endpoint that creates a sample output - useful for development
export async function createTestOutput(): Promise<boolean> {
  try {
    const response = await fetchAPI('/test-output');
    if (response.success) {
      loadInitialOutputs(); // Reload the outputs
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error creating test output:', error);
    return false;
  }
}

// Don't initialize outputs automatically
// We'll load them when the component requests