import type { Automation, ApiResponse } from '../types';
import { automations } from '../stores/automationStore';
import { get } from 'svelte/store';
import { runAutomation } from './playwright';
import { addLogEntry } from '../stores/logsStore';

// Global cache for API responses
const apiCache = new Map<string, {data: any, timestamp: number}>();
const CACHE_EXPIRY = 30000; // 30 seconds cache expiry

// Function to clear cache for outputs endpoints
export function clearOutputsCache(): void {
  console.log('[API] Clearing outputs cache');
  // Get all keys for outputs-related endpoints
  const cacheKeys = Array.from(apiCache.keys())
    .filter(key => key.includes('output') || key.includes('Output'));
  
  // Delete each matching key
  cacheKeys.forEach(key => {
    console.log(`[API] Clearing cache for: ${key}`);
    apiCache.delete(key);
  });
}

// Generic fetch API function to interact with backend with caching
export async function fetchAPI(endpoint: string, options: RequestInit = {}): Promise<any> {
  try {
    // Check cache for GET requests
    const isGetRequest = !options.method || options.method === 'GET';
    
    if (isGetRequest) {
      const cacheKey = endpoint;
      const cachedResponse = apiCache.get(cacheKey);
      
      // Return cached data if it exists and hasn't expired
      if (cachedResponse && Date.now() - cachedResponse.timestamp < CACHE_EXPIRY) {
        return cachedResponse.data;
      }
    }
    
    // Try to use the vite dev server proxy which forwards to the actual API server
    // The server is already running on :3001, but when we access from frontend, we should go through the proxy
    // Add sort parameter for outputs endpoints if not already specified
    let modifiedEndpoint = endpoint;
    if (modifiedEndpoint.startsWith('/outputs') && !modifiedEndpoint.includes('sort=')) {
      const separator = modifiedEndpoint.includes('?') ? '&' : '?';
      modifiedEndpoint = `${modifiedEndpoint}${separator}sort=desc`;
    }
    
    const url = `/api${modifiedEndpoint}`;
    console.log(`[API] Fetching from: ${url}`, options.method || 'GET');
    
    // Set default headers if not provided
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    
    // Send the request with timeout to prevent long-hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.error(`[API] HTTP error ${response.status}: ${response.statusText}`);
        // Try to get error details if available
        let errorText = "";
        try {
          // First try to parse as JSON
          const errorData = await response.json();
          errorText = JSON.stringify(errorData);
        } catch (e) {
          // If not JSON, just get the text
          errorText = await response.text();
        }
        
        // Log the full error details for debugging
        console.error(`[API] Response error details from ${endpoint}:`, errorText);
        
        throw new Error(`HTTP error ${response.status}: ${errorText || response.statusText}`);
      }
      
      // Parse the response as JSON
      const data = await response.json();
      console.log(`[API] Response from ${endpoint}:`, data ? 'Data received' : 'Empty response');
      
      // Cache the response for GET requests
      if (isGetRequest) {
        apiCache.set(endpoint, {
          data,
          timestamp: Date.now()
        });
      }
      
      return data;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      // Improved error logging with network details
      if (fetchError.name === 'AbortError') {
        console.error(`[API] Request to ${endpoint} timed out after 10 seconds`);
        throw new Error(`Request to ${endpoint} timed out`);
      }
      
      throw fetchError;
    }
  } catch (error) {
    console.error(`[API] Error (${endpoint}):`, error);
    
    // For convenience in development, return mock data for certain endpoints
    // This makes the app usable even if the API server has issues
    
    if (endpoint === '/logs' || endpoint === '/logs-direct') {
      console.log('[API] Returning mock logs data due to API error');
      return [];
    }
    
    if (endpoint === '/outputs' || endpoint === '/outputs-direct') {
      console.log('[API] Returning mock outputs data due to API error');
      return [];
    }
    
    if (endpoint === '/settings') {
      console.log('[API] Returning mock settings due to API error');
      return {
        notificationsEnabled: true,
        darkTheme: true,
        keepOutputDays: 7
      };
    }
    
    // For other endpoints, return a default error response
    return { 
      success: false, 
      error: error.message || 'Unknown API error',
      isErrorResponse: true
    };
  }
}

// Ensure outputs directory exists
const ensureOutputDirectory = () => {
  try {
    // In browser environment, we can't access the file system
    // This would be handled on the server side in a real deployment
    console.log('Ensuring output directory exists');
  } catch (error) {
    console.error('Error creating outputs directory:', error);
  }
};

// Get all automations
export async function getAutomations(): Promise<ApiResponse<Automation[]>> {
  try {
    const data = get(automations);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: 'Failed to get automations' };
  }
}

// Get automation by ID
export async function getAutomationById(id: string): Promise<ApiResponse<Automation>> {
  try {
    const data = get(automations).find(a => a.id === id);
    if (!data) {
      return { success: false, error: 'Automation not found' };
    }
    return { success: true, data };
  } catch (error) {
    return { success: false, error: 'Failed to get automation' };
  }
}

// Create a new automation
export async function createAutomation(automation: Omit<Automation, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<Automation>> {
  try {
    const newAutomation: Automation = {
      ...automation,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    automations.update(items => [...items, newAutomation]);
    return { success: true, data: newAutomation };
  } catch (error) {
    return { success: false, error: 'Failed to create automation' };
  }
}

// Update an existing automation
export async function updateAutomation(id: string, updates: Partial<Automation>): Promise<ApiResponse<Automation>> {
  try {
    let updatedAutomation: Automation | undefined;
    
    automations.update(items => {
      const index = items.findIndex(a => a.id === id);
      if (index === -1) {
        return items;
      }
      
      updatedAutomation = {
        ...items[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      items[index] = updatedAutomation as Automation;
      return [...items];
    });
    
    if (!updatedAutomation) {
      return { success: false, error: 'Automation not found' };
    }
    
    return { success: true, data: updatedAutomation };
  } catch (error) {
    return { success: false, error: 'Failed to update automation' };
  }
}

// Delete an automation
export async function deleteAutomation(id: string): Promise<ApiResponse<{ id: string }>> {
  try {
    let deleted = false;
    
    automations.update(items => {
      const filtered = items.filter(a => a.id !== id);
      deleted = filtered.length < items.length;
      return filtered;
    });
    
    if (!deleted) {
      return { success: false, error: 'Automation not found' };
    }
    
    return { success: true, data: { id } };
  } catch (error) {
    return { success: false, error: 'Failed to delete automation' };
  }
}

// Import the output store
import { currentOutput, resetOutput, appendOutput, loadInitialOutputs } from '../stores/outputStore';

// Run an automation
export async function runAutomationById(id: string): Promise<ApiResponse<{ id: string, success: boolean, output?: string }>> {
  try {
    // Find the automation
    const automation = get(automations).find(a => a.id === id);
    if (!automation) {
      return { success: false, error: 'Automation not found' };
    }
    
    // Update status to running
    automations.update(items => {
      const index = items.findIndex(a => a.id === id);
      if (index >= 0) {
        items[index].status = 'running';
        items[index].output = undefined; // Clear previous output
        return [...items];
      }
      return items;
    });

    // Reset real-time output
    resetOutput();
    
    let result;
    
    // Always use the server for automation running
    const useServer = true;
    
    if (useServer) {
      try {
        console.log('[API] Running automation on server, ID:', automation.id);
        
        // First send the POST request to start the automation and get an SSE connection
        const response = await fetch('http://localhost:3001/api/run-automation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
          },
          body: JSON.stringify({
            id: automation.id,
            name: automation.name,
            script: automation.script
          }),
        });
        
        // Check if we got a proper SSE response
        if (response.headers.get('Content-Type')?.includes('text/event-stream')) {
          console.log('[API] Server responded with event stream, setting up listener');
          
          // Server responded with event stream directly
          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error('Failed to get reader from response body');
          }
          
          // Process the stream manually instead of using EventSource
          let buffer = '';
          const textDecoder = new TextDecoder();
          
          // Set up completion promise
          const completionPromise = new Promise((resolve, reject) => {
            // Process chunks as they arrive
            const processChunks = async () => {
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  
                  // Convert bytes to text and add to buffer
                  buffer += textDecoder.decode(value, { stream: true });
                  
                  // Process complete events in buffer
                  const events = buffer.split('\n\n');
                  buffer = events.pop() || ''; // Keep last incomplete event in buffer
                  
                  for (const event of events) {
                    if (!event.trim()) continue;
                    
                    // Parse event data
                    const dataMatch = event.match(/^data: (.+)$/m);
                    if (dataMatch && dataMatch[1]) {
                      try {
                        const data = JSON.parse(dataMatch[1]);
                        
                        switch (data.type) {
                          case 'log':
                            // Update real-time output
                            appendOutput(data.message + '\n');
                            break;
                            
                          case 'complete':
                            // Handle completion
                            reader.cancel();
                            if (data.success) {
                              resolve({
                                success: true,
                                output: data.output,
                                result: data.result // Include full result for outputs
                              });
                            } else {
                              resolve({
                                success: false,
                                output: data.output || `Error: ${data.error}`
                              });
                            }
                            return; // Exit the loop
                        }
                      } catch (error) {
                        console.error('[API] Error parsing SSE message:', error);
                      }
                    }
                  }
                }
                
                // If we get here, the stream ended without a complete event
                reject(new Error('Server stream ended without completion'));
              } catch (error) {
                reject(error);
              }
            };
            
            // Start processing chunks
            processChunks();
          });
          
          // Wait for completion
          console.log('[API] Waiting for automation to complete...');
          
          // Use a fallback in case the server doesn't respond
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Automation timed out after 2 minutes')), 120000);
          });
          
          // Return either the completion or timeout, whichever comes first
          result = await Promise.race([completionPromise, timeoutPromise]);
          console.log('[API] Automation completed with result:', result);
        } else {
          // Not an event stream - try to parse as regular JSON response
          console.log('[API] Server did not respond with event stream, checking for regular response');
          const data = await response.json();
          
          if (data.success) {
            result = {
              success: true,
              output: data.output || 'Automation completed successfully',
              result: data.data
            };
          } else {
            throw new Error(data.error || 'Unknown server error');
          }
          console.log('[API] Automation completed with json result:', result);
        }
      } catch (serverError) {
        console.error('Server error:', serverError);
        // Fall back to simulation if server is unavailable
        result = await runAutomation(automation);
      }
    } else {
      // Use the simulated runner (not used, but kept for fallback)
      result = await runAutomation(automation);
    }
    
    // Update status based on result and store output
    automations.update(items => {
      const index = items.findIndex(a => a.id === id);
      if (index >= 0) {
        items[index].status = result.success ? 'completed' : 'failed';
        items[index].output = result.output || '';
        
        // Show notification
        if (result.success) {
          showCompletionNotification(items[index]);
          // Use async/await with addLogEntry since we made it async
          (async () => {
            try {
              await addLogEntry(items[index], 'completed');
              
              // Auto-reset to idle after a short delay (notify user first)
              setTimeout(() => {
                automations.update(currentItems => {
                  const automationIndex = currentItems.findIndex(a => a.id === id);
                  if (automationIndex >= 0) {
                    currentItems[automationIndex].status = 'idle';
                    return [...currentItems];
                  }
                  return currentItems;
                });
              }, 3000); // Reset to idle after 3 seconds
              
            } catch (error) {
              console.error('Error adding log entry:', error);
            }
          })();
        } else {
          showFailureNotification(items[index]);
          // Use async/await with addLogEntry since we made it async
          (async () => {
            try {
              await addLogEntry(items[index], 'failed');
              
              // Auto-reset to idle after a short delay (notify user first)
              setTimeout(() => {
                automations.update(currentItems => {
                  const automationIndex = currentItems.findIndex(a => a.id === id);
                  if (automationIndex >= 0) {
                    currentItems[automationIndex].status = 'idle';
                    return [...currentItems];
                  }
                  return currentItems;
                });
              }, 3000); // Reset to idle after 3 seconds
              
            } catch (error) {
              console.error('Error adding log entry:', error);
            }
          })();
        }
        
        return [...items];
      }
      return items;
    });
    
    // Manually load the output files after a successful automation run
    if (result.success) {
      setTimeout(() => {
        try {
          console.log('Loading output files after successful automation...');
          // Reset everything and make sure we load from scratch
          loadInitialOutputs().then(() => {
            console.log('Outputs loaded after automation run');
            // Clear API cache for outputs endpoints to ensure fresh data
            const cacheKeys = Array.from(apiCache.keys())
              .filter(key => key.startsWith('/outputs'));
            
            cacheKeys.forEach(key => apiCache.delete(key));
          });
        } catch (error) {
          console.error('Error loading output files after automation:', error);
        }
      }, 1000); // Wait 1 second to make sure server has saved everything
    }
    
    return { 
      success: true, 
      data: { 
        id, 
        success: result.success,
        output: result.output
      } 
    };
  } catch (error) {
    // Update status to failed
    automations.update(items => {
      const index = items.findIndex(a => a.id === id);
      if (index >= 0) {
        items[index].status = 'failed';
        items[index].output = `Error: ${error.message}`;
        showFailureNotification(items[index]);
        // Add log entry for error
        (async () => {
          try {
            await addLogEntry(items[index], 'failed');
          } catch (logError) {
            console.error('Error adding log entry for failure:', logError);
          }
        })();
        return [...items];
      }
      return items;
    });
    
    return { success: false, error: 'Failed to run automation' };
  }
}

// Show completion notification
function showCompletionNotification(automation: Automation): void {
  // Check if browser supports notifications
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return;
  }

  // Check notification permission
  if (Notification.permission === 'granted') {
    createNotification(automation, true);
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        createNotification(automation, true);
      }
    });
  }
}

// Show failure notification
function showFailureNotification(automation: Automation): void {
  // Check if browser supports notifications
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return;
  }

  // Check notification permission
  if (Notification.permission === 'granted') {
    createNotification(automation, false);
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        createNotification(automation, false);
      }
    });
  }
}

// Create and show notification
function createNotification(automation: Automation, isSuccess: boolean): void {
  // Always show in-app toast notification
  import('./notificationUtils').then(({ showToast, showBrowserNotification }) => {
    // In-app toast is always shown regardless of notification settings
    showToast(
      isSuccess 
        ? `Automation "${automation.name}" completed successfully` 
        : `Automation "${automation.name}" failed to run`,
      isSuccess ? 'success' : 'error'
    );
    
    // Browser notification is controlled by notification settings
    showBrowserNotification(
      isSuccess 
        ? `Automation "${automation.name}" completed successfully` 
        : `Automation "${automation.name}" failed to run`, 
      {
        body: isSuccess 
          ? 'The automation has completed successfully.' 
          : 'The automation encountered an error.',
        icon: '/logo.svg'
      }
    );
  });
}