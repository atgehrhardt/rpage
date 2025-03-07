<!-- OutputsView.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { 
    outputFiles, 
    outputsByType, 
    deleteOutputFile, 
    loadInitialOutputs,
    loadMoreOutputs,
    isLoadingOutputs, 
    hasMoreOutputs,
    getParsedData,
    totalOutputCount,
    outputsRequested,
    isPriorityLoaded,
    priorityOutputFiles
  } from '../stores/outputStore';
  import { showToast } from '../utils/notificationUtils';
  
  // State variables
  let isVisible = false;
  let observer: IntersectionObserver | null = null;
  let infiniteScrollObserver: IntersectionObserver | null = null;
  let containerElement: HTMLElement;
  let infiniteScrollTrigger: HTMLElement;
  
  // We removed virtual scrolling approach for simplicity

  $: outputsExist = $outputFiles.length > 0 || $priorityOutputFiles.length > 0;
  $: isInitialLoading = $isLoadingOutputs && $outputFiles.length === 0 && $priorityOutputFiles.length === 0;
  $: anyOutputsLoaded = $isPriorityLoaded || $outputFiles.length > 0;
  
  function formatTimestamp(timestamp) {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleString();
  }
  
  async function handleDeleteOutput(id) {
    // Remove confirmation dialog
    try {
      // First perform the local UI update and trust it succeeded
      showToast('Output deleted', 'success');
      
      // Force UI refresh regardless of server response
      window.dispatchEvent(new CustomEvent('refresh-outputs'));
      
      // Force a reload of outputs data
      setTimeout(refreshOutputs, 100);
      
      // Force a recalculation of loaded images
      setTimeout(lazyLoadVisibleImages, 100);
      
      // Then perform the actual server deletion in background
      deleteOutputFile(id).then(success => {
        if (!success) {
          console.warn(`Server deletion may have failed for output ${id}, but UI was updated`);
        }
      });
    } catch (error) {
      console.error('Error in deletion handler:', error);
    }
  }
  
  async function refreshOutputs() {
    if (!$isLoadingOutputs) {
      try {
        console.log('Refreshing outputs...');
        await loadInitialOutputs();
        console.log('Outputs refreshed successfully');
      } catch (err) {
        console.error('Error refreshing outputs:', err);
      }
    }
  }
  
  async function loadMore() {
    if (!$isLoadingOutputs && $hasMoreOutputs) {
      try {
        console.log('Loading more outputs...');
        await loadMoreOutputs();
        console.log('More outputs loaded successfully');
      } catch (err) {
        console.error('Error loading more outputs:', err);
      }
    }
  }
  
  // Helper to check if an element is in the viewport
  function isInViewport(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }
  
  // Request initial outputs with debounce
  let initialLoadTimeout: number | null = null;
  function requestInitialOutputs(): void {
    if (!$outputsRequested && !$isLoadingOutputs) {
      // Clear any existing timeout
      if (initialLoadTimeout !== null) {
        clearTimeout(initialLoadTimeout);
      }
      
      // No need to manually clear cache here - the store will handle it
      
      // Set a new timeout to debounce multiple calls
      initialLoadTimeout = setTimeout(() => {
        console.log('Requesting initial outputs...');
        loadInitialOutputs()
          .then(() => {
            console.log('Initial outputs loaded successfully');
            // After initial load completes, show whatever we have without waiting
            // for all files to load - priorityOutputFiles should be loaded first
            if ($priorityOutputFiles.length > 0) {
              showToast(`Loaded ${$priorityOutputFiles.length} recent outputs`, 'info');
              // Schedule image loading for visible items
              setTimeout(lazyLoadVisibleImages, 100);
            }
          })
          .catch(err => {
            console.error('Error loading outputs:', err);
          });
        initialLoadTimeout = null;
      }, 20); // Even faster initial load
    }
  }
  
  // Track which images have been loaded to avoid redundant work
  const loadedImages = new Set<string>();
  
  // Lazy load images that are in viewport
  function lazyLoadVisibleImages() {
    if (typeof window === 'undefined') return;
    
    // Find all image placeholders that haven't been loaded yet
    const placeholders = document.querySelectorAll('.image-placeholder[data-src]:not(.loading)');
    
    // Process placeholders that are visible
    placeholders.forEach(placeholder => {
      const id = placeholder.getAttribute('data-id');
      if (id && loadedImages.has(id)) return;
      
      // Mark as being processed
      placeholder.classList.add('loading');
      
      // Check if this element is in viewport
      if (isInViewport(placeholder as HTMLElement)) {
        const src = placeholder.getAttribute('data-src');
        if (src) {
          // Create image element
          const img = document.createElement('img');
          img.src = `data:image/png;base64,${src}`;
          img.alt = "Screenshot";
          img.width = 100;
          img.height = 100;
          img.loading = "lazy";
          img.decoding = "async";
          img.onerror = handleImageError;
          
          // Replace placeholder with image
          placeholder.innerHTML = '';
          placeholder.appendChild(img);
          
          // Track that we loaded this image
          if (id) loadedImages.add(id);
        }
      }
    });
  }

  // Auto-reload data when navigating to this component
  function autoReloadData() {
    // Always refresh data when this component becomes visible
    console.log('Auto-refreshing outputs...');
    requestInitialOutputs();
  }
  
  // Define visibility change handler at component level
  let visibilityChangeHandler: () => void;
  
  // Set up intersection observer for lazy loading with performance optimizations
  onMount(() => {
    console.log('OutputsView mounted, setting up lazy loading...');
    
    // Force load priority outputs immediately to show something quickly
    // No delay - load immediately on mount for better UX
    requestInitialOutputs();
    
    // Set up visibilitychange handler to automatically reload when tab becomes visible
    visibilityChangeHandler = () => {
      if (document.visibilityState === 'visible' && isVisible) {
        autoReloadData();
      }
    };
    document.addEventListener('visibilitychange', visibilityChangeHandler);
    
    // Add the custom refresh event listener
    window.addEventListener('refresh-outputs', handleRefreshOutputs);
    
    // Create an intersection observer for initial load and reloading when visible
    observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          isVisible = true;
          
          // Always refresh when component becomes visible
          autoReloadData();
          
          // Set up infinite scroll observer after initial load
          setupInfiniteScroll();
        } else {
          isVisible = false;
        }
      });
    }, { 
      threshold: 0.05, // Trigger when just 5% of the element is visible for faster loading
      rootMargin: '300px' // Start loading even earlier
    }); 
    
    // Start observing the container element
    if (containerElement) {
      observer.observe(containerElement);
    }
    
    // Set up scroll event listener for lazy loading images during scrolling
    const scrollHandler = () => {
      if (isVisible) {
        // Debounce the scroll handler
        if (window.scrollDebounceTimer) {
          clearTimeout(window.scrollDebounceTimer);
        }
        window.scrollDebounceTimer = setTimeout(lazyLoadVisibleImages, 100);
      }
    };
    
    // Store reference for cleanup
    window.scrollHandler = scrollHandler;
    
    window.addEventListener('scroll', scrollHandler, { passive: true });
  });
  
  // Set up infinite scroll functionality
  function setupInfiniteScroll() {
    // Only set up the observer if it doesn't exist yet
    if (!infiniteScrollObserver && infiniteScrollTrigger) {
      console.log('Setting up infinite scroll observer...');
      
      infiniteScrollObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          // When the trigger element is visible and we're not already loading
          if (entry.isIntersecting && !$isLoadingOutputs && $hasMoreOutputs) {
            console.log('Infinite scroll trigger visible, loading more outputs...');
            loadMore();
          }
        });
      }, {
        rootMargin: '200px', // Start loading when element is 200px from viewport
        threshold: 0.1 // Trigger when 10% of the element is visible
      });
      
      // Start observing the trigger element
      infiniteScrollObserver.observe(infiniteScrollTrigger);
    }
  }
  
  // Set up custom event listener for refreshing outputs
  const handleRefreshOutputs = () => {
    // This forces a lightweight update in the background
    outputFiles.update(files => files);
  };

  // Clean up observers and event listeners on component destroy
  onDestroy(() => {
    // Clean up main visibility observer
    if (observer && containerElement) {
      observer.unobserve(containerElement);
      observer.disconnect();
    }
    
    // Clean up infinite scroll observer
    if (infiniteScrollObserver && infiniteScrollTrigger) {
      infiniteScrollObserver.unobserve(infiniteScrollTrigger);
      infiniteScrollObserver.disconnect();
    }
    
    // Remove event listeners
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', window.scrollHandler);
      document.removeEventListener('visibilitychange', visibilityChangeHandler);
      window.removeEventListener('refresh-outputs', handleRefreshOutputs);
      
      if (window.scrollDebounceTimer) {
        clearTimeout(window.scrollDebounceTimer);
      }
    }
  });
  
  // Handle image errors
  function handleImageError(event) {
    const img = event.target;
    img.style.display = 'none';
    img.parentNode.innerHTML += '<span class="error-text">Image load failed</span>';
  }
</script>

<div class="outputs-view" bind:this={containerElement}>
  <div class="outputs-header">
    <h2>Automation Outputs</h2>
    <div class="action-buttons">
      {#if $isLoadingOutputs}
        <div class="loading-indicator">
          <div class="small-spinner"></div>
          <span>Loading...</span>
        </div>
      {/if}
    </div>
  </div>
  
  {#if isInitialLoading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading outputs...</p>
    </div>
  {:else if !outputsExist}
    <div class="empty-state">
      <span class="material-icons">image</span>
      <p>No outputs available</p>
      <p class="sub-text">Run automations to generate outputs like screenshots</p>
    </div>
  {:else}
    <div class="outputs-list">
      {#if $isPriorityLoaded && $priorityOutputFiles.length > 0}
        <div class="priority-notification">
          <span class="material-icons">bolt</span>
          Showing recently created files first
        </div>
      {/if}
      {#each Object.entries($outputsByType) as [type, allFiles]}
        <!-- Use details/summary for collapsible sections -->
        <details class="output-group" open={isInitialLoading || allFiles.length < 10}>
          <summary class="output-group-title">
            {type.toUpperCase()} Files ({allFiles.length})
          </summary>
          <div class="output-grid">
            {#each allFiles.slice(0, 12) as file, index (file.id)}
              <div class="output-item">
                <div class="output-actions">
                  <button class="action-btn" on:click|stopPropagation={(e) => {
                    e.preventDefault();
                    handleDeleteOutput(file.id);
                  }}>
                    <span class="material-icons">delete</span>
                  </button>
                </div>
                
                <!-- Unified output-content with file type icon -->
                <div class="output-content {file.type === 'screenshot' ? 'image' : 'file'}" 
                     on:click={() => {
                       // Show modal viewer with loading state
                       const dialog = document.createElement('dialog');
                       dialog.classList.add('data-dialog');
                       
                       // Set initial content based on file type
                       const title = file.type === 'screenshot' 
                         ? 'Screenshot' 
                         : `${file.type.charAt(0).toUpperCase() + file.type.slice(1)} Data`;
                         
                       dialog.innerHTML = `
                         <div class="dialog-content ${file.type === 'screenshot' ? 'image-dialog' : ''}">
                           <div class="dialog-header">
                             <h3>${title}: ${file.name}</h3>
                             <button class="close-btn" aria-label="Close">
                               <span class="material-icons">close</span>
                             </button>
                           </div>
                           <div class="dialog-loading">
                             <div class="spinner"></div>
                             <p>Loading data...</p>
                           </div>
                         </div>
                       `;
                       
                       document.body.appendChild(dialog);
                       
                       // Set up close event
                       dialog.querySelector('.close-btn').addEventListener('click', () => dialog.close());
                       dialog.addEventListener('close', () => document.body.removeChild(dialog));
                       
                       // Show the dialog immediately
                       dialog.showModal();
                       
                       // Load content asynchronously
                       requestIdleCallback(() => {
                         const contentEl = dialog.querySelector('.dialog-content');
                         const loadingEl = dialog.querySelector('.dialog-loading');
                         
                         if (file.type === 'screenshot') {
                           // Load screenshot image
                           const imageData = getParsedData(file)?.imageData;
                           
                           if (imageData) {
                             const imageContainer = document.createElement('div');
                             imageContainer.className = 'image-container';
                             
                             const img = document.createElement('img');
                             img.src = `data:image/png;base64,${imageData}`;
                             img.alt = "Screenshot";
                             img.className = "fullsize-image";
                             img.loading = "eager"; // Load immediately once dialog is open
                             
                             // Create image controls
                             const controls = document.createElement('div');
                             controls.className = 'image-controls';
                             
                             // Zoom in button
                             const zoomInBtn = document.createElement('button');
                             zoomInBtn.className = 'control-btn';
                             zoomInBtn.innerHTML = '<span class="material-icons">zoom_in</span>';
                             zoomInBtn.addEventListener('click', () => {
                               const scale = img.style.transform.match(/scale\(([^)]+)\)/) || [null, '1'];
                               const currentScale = parseFloat(scale[1]);
                               img.style.transform = `scale(${currentScale * 1.2})`;
                             });
                             
                             // Zoom out button
                             const zoomOutBtn = document.createElement('button');
                             zoomOutBtn.className = 'control-btn';
                             zoomOutBtn.innerHTML = '<span class="material-icons">zoom_out</span>';
                             zoomOutBtn.addEventListener('click', () => {
                               const scale = img.style.transform.match(/scale\(([^)]+)\)/) || [null, '1'];
                               const currentScale = parseFloat(scale[1]);
                               const newScale = Math.max(0.1, currentScale / 1.2);
                               img.style.transform = `scale(${newScale})`;
                             });
                             
                             // Reset button
                             const resetBtn = document.createElement('button');
                             resetBtn.className = 'control-btn';
                             resetBtn.innerHTML = '<span class="material-icons">refresh</span>';
                             resetBtn.addEventListener('click', () => {
                               img.style.transform = 'scale(1)';
                             });
                             
                             controls.appendChild(zoomInBtn);
                             controls.appendChild(zoomOutBtn);
                             controls.appendChild(resetBtn);
                             
                             // Add drag functionality
                             let isDragging = false;
                             let lastX = 0;
                             let lastY = 0;
                             
                             img.addEventListener('mousedown', (e) => {
                               isDragging = true;
                               lastX = e.clientX;
                               lastY = e.clientY;
                               imageContainer.style.cursor = 'grabbing';
                             });
                             
                             document.addEventListener('mousemove', (e) => {
                               if (isDragging) {
                                 imageContainer.scrollLeft += lastX - e.clientX;
                                 imageContainer.scrollTop += lastY - e.clientY;
                                 lastX = e.clientX;
                                 lastY = e.clientY;
                               }
                             });
                             
                             document.addEventListener('mouseup', () => {
                               isDragging = false;
                               imageContainer.style.cursor = 'grab';
                             });
                             
                             // Add wheel zoom
                             imageContainer.addEventListener('wheel', (e) => {
                               e.preventDefault();
                               const scale = img.style.transform.match(/scale\(([^)]+)\)/) || [null, '1'];
                               let currentScale = parseFloat(scale[1]);
                               
                               if (e.deltaY < 0) {
                                 // Zoom in
                                 currentScale *= 1.1;
                               } else {
                                 // Zoom out
                                 currentScale /= 1.1;
                               }
                               
                               // Limit scale
                               currentScale = Math.min(Math.max(0.1, currentScale), 10);
                               img.style.transform = `scale(${currentScale})`;
                             });
                             
                             imageContainer.appendChild(img);
                             imageContainer.appendChild(controls);
                             
                             if (loadingEl) loadingEl.remove();
                             contentEl.appendChild(imageContainer);
                           } else {
                             // Error state
                             if (loadingEl) {
                               loadingEl.innerHTML = `
                                 <span class="material-icons error-icon">error</span>
                                 <p>Unable to load image data</p>
                               `;
                             }
                           }
                         } else {
                           // Load text or other data
                           try {
                             const dataContainer = document.createElement('div');
                             dataContainer.className = 'data-container';
                             
                             const preEl = document.createElement('pre');
                             preEl.textContent = typeof file.data === 'string' 
                               ? file.data 
                               : JSON.stringify(getParsedData(file) || file.data, null, 2);
                             
                             dataContainer.appendChild(preEl);
                             
                             if (loadingEl) loadingEl.remove();
                             contentEl.appendChild(dataContainer);
                           } catch (err) {
                             console.error('Error loading file data:', err);
                             if (loadingEl) {
                               loadingEl.innerHTML = `
                                 <span class="material-icons error-icon">error</span>
                                 <p>Error loading data: ${err.message}</p>
                               `;
                             }
                           }
                         }
                       });
                     }}>
                  <div class="preview-container">
                    <!-- Display appropriate icon based on file type -->
                    <span class="material-icons file-icon">
                      {#if file.type === 'screenshot'}photo
                      {:else if file.type === 'results'}assessment
                      {:else if file.type === 'text'}description
                      {:else}insert_drive_file{/if}
                    </span>
                    <span class="file-type">{file.type}</span>
                    <span class="view-hint">Click to view</span>
                  </div>
                </div>
                
                <div class="output-info">
                  <div class="output-name" title={file.name}>{file.name}</div>
                  <div class="output-timestamp">{formatTimestamp(file.timestamp)}</div>
                </div>
              </div>
            {/each}
            
            <!-- Show a "View More" button if there are more than 12 items -->
            {#if allFiles.length > 12}
              <div class="view-more-outputs">
                <button class="btn-view-more" on:click={(e) => {
                  // Find the closest output-grid and output-group
                  const outputGrid = e.target.closest('.output-grid');
                  const outputGroup = e.target.closest('.output-group');
                  
                  // Create and append all remaining items
                  const fragment = document.createDocumentFragment();
                  
                  allFiles.slice(12).forEach(file => {
                    const item = document.createElement('div');
                    item.className = 'output-item';
                    item.innerHTML = `
                      <div class="output-actions">
                        <button class="action-btn"><span class="material-icons">delete</span></button>
                      </div>
                      <div class="output-content ${file.type === 'screenshot' ? 'image' : 'file'}">
                        <div class="preview-container">
                          <span class="material-icons file-icon">
                            ${file.type === 'screenshot' ? 'photo' : 
                              file.type === 'results' ? 'assessment' :
                              file.type === 'text' ? 'description' : 'insert_drive_file'}
                          </span>
                          <span class="file-type">${file.type || 'File'}</span>
                          <span class="view-hint">Click to view</span>
                        </div>
                      </div>
                      <div class="output-info">
                        <div class="output-name" title="${file.name}">${file.name}</div>
                        <div class="output-timestamp">${formatTimestamp(file.timestamp)}</div>
                      </div>
                    `;
                    
                    // Add click handler to delete button
                    const deleteBtn = item.querySelector('.action-btn');
                    deleteBtn.addEventListener('click', (e) => {
                      e.stopPropagation(); // Prevent opening the viewer
                      e.preventDefault();
                      
                      try {
                        // First update UI immediately
                        showToast('Output deleted', 'success');
                        
                        // Remove the item from DOM immediately
                        item.remove();
                        
                        // Force UI refresh
                        window.dispatchEvent(new CustomEvent('refresh-outputs'));
                        
                        // Force a reload of outputs data
                        setTimeout(refreshOutputs, 100);
                        
                        // Force a recalculation of loaded images
                        setTimeout(lazyLoadVisibleImages, 100);
                        
                        // Then perform the server deletion in background
                        deleteOutputFile(file.id).then(success => {
                          if (!success) {
                            console.warn(`Server deletion may have failed for output ${file.id}, but UI was updated`);
                          }
                        });
                      } catch (error) {
                        console.error('Error in dynamic deletion handler:', error);
                      }
                    });
                    
                    // Add click handler to file container
                    const fileContainer = item.querySelector('.output-content');
                    if (fileContainer) {
                      fileContainer.addEventListener('click', () => {
                        // Create and show dialog
                        const dialog = document.createElement('dialog');
                        dialog.classList.add('data-dialog');
                        
                        // Set initial content based on file type
                        const title = file.type === 'screenshot' 
                          ? 'Screenshot' 
                          : `${file.type.charAt(0).toUpperCase() + file.type.slice(1)} Data`;
                          
                        dialog.innerHTML = `
                          <div class="dialog-content ${file.type === 'screenshot' ? 'image-dialog' : ''}">
                            <div class="dialog-header">
                              <h3>${title}: ${file.name}</h3>
                              <button class="close-btn" aria-label="Close">
                                <span class="material-icons">close</span>
                              </button>
                            </div>
                            <div class="dialog-loading">
                              <div class="spinner"></div>
                              <p>Loading data...</p>
                            </div>
                          </div>
                        `;
                        
                        document.body.appendChild(dialog);
                        dialog.querySelector('.close-btn').addEventListener('click', () => dialog.close());
                        dialog.addEventListener('close', () => document.body.removeChild(dialog));
                        dialog.showModal();
                        
                        // Load content asynchronously
                        requestIdleCallback(() => {
                          try {
                            const contentEl = dialog.querySelector('.dialog-content');
                            const loadingEl = dialog.querySelector('.dialog-loading');
                            
                            if (file.type === 'screenshot') {
                              // For screenshots, request the full data from the store
                              const fullFile = $outputFiles.find(f => f.id === file.id) || file;
                              const imageData = getParsedData(fullFile)?.imageData;
                              
                              if (imageData) {
                                const imageContainer = document.createElement('div');
                                imageContainer.className = 'image-container';
                                
                                const img = document.createElement('img');
                                img.src = `data:image/png;base64,${imageData}`;
                                img.alt = "Screenshot";
                                img.className = "fullsize-image";
                                
                                imageContainer.appendChild(img);
                                
                                if (loadingEl) loadingEl.remove();
                                contentEl.appendChild(imageContainer);
                              } else {
                                // Error state
                                if (loadingEl) {
                                  loadingEl.innerHTML = `
                                    <span class="material-icons error-icon">error</span>
                                    <p>Unable to load image data</p>
                                  `;
                                }
                              }
                            } else {
                              // For other files, show their data
                              const fullFile = $outputFiles.find(f => f.id === file.id) || file;
                              const dataContainer = document.createElement('div');
                              dataContainer.className = 'data-container';
                              
                              const preEl = document.createElement('pre');
                              preEl.textContent = typeof fullFile.data === 'string' 
                                ? fullFile.data 
                                : JSON.stringify(getParsedData(fullFile) || fullFile.data, null, 2);
                              
                              dataContainer.appendChild(preEl);
                              
                              if (loadingEl) loadingEl.remove();
                              contentEl.appendChild(dataContainer);
                            }
                          } catch (err) {
                            console.error('Error loading file data:', err);
                            const loadingEl = dialog.querySelector('.dialog-loading');
                            if (loadingEl) {
                              loadingEl.innerHTML = `
                                <span class="material-icons error-icon">error</span>
                                <p>Error loading data: ${err.message}</p>
                              `;
                            }
                          }
                        });
                      });
                    }
                    
                    fragment.appendChild(item);
                  });
                  
                  // Replace the view-more button with the actual items
                  e.target.closest('.view-more-outputs').remove();
                  outputGrid.appendChild(fragment);
                }}>
                  Show {allFiles.length - 12} more items
                </button>
              </div>
            {/if}
          </div>
        </details>
      {/each}
      
      <!-- Infinite scroll trigger element -->
      <div 
        class="infinite-scroll-trigger" 
        bind:this={infiniteScrollTrigger}
        class:hidden={!$hasMoreOutputs}
      >
        {#if $isLoadingOutputs}
          <div class="loading-indicator">
            <div class="small-spinner"></div>
            <span>Loading more outputs...</span>
          </div>
        {:else if !$hasMoreOutputs && $outputFiles.length > 0}
          <div class="all-loaded-message">
            All outputs loaded ({$outputFiles.length} items)
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .outputs-view {
    width: 100%;
  }
  
  .outputs-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }
  
  .action-buttons {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  
  h2 {
    margin: 0;
    color: var(--on-background);
  }
  
  .loading-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    color: var(--on-surface-variant);
    background-color: rgba(255, 255, 255, 0.05);
    padding: 0.3rem 0.75rem;
    border-radius: 4px;
  }
  
  .loading-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 1rem;
    background-color: rgba(0, 0, 0, 0.1);
    border-radius: 4px;
    min-height: 100px;
  }
  
  .loading-state, .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    background-color: var(--surface);
    border-radius: 8px;
    text-align: center;
  }
  
  .spinner, .small-spinner {
    border: 4px solid rgba(255, 255, 255, 0.1);
    border-left-color: var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    margin-bottom: 1rem;
  }
  
  .small-spinner {
    width: 16px;
    height: 16px;
    margin-right: 0.5rem;
    display: inline-block;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .empty-state .material-icons {
    font-size: 4rem;
    margin-bottom: 1rem;
    color: var(--primary);
  }
  
  .sub-text {
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.9rem;
    margin-top: 0.5rem;
  }
  
  .outputs-list {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }
  
  .output-group {
    background-color: var(--surface);
    border-radius: 8px;
    padding: 1rem;
  }
  
  .output-group-title {
    margin-top: 0;
    margin-bottom: 1rem;
    font-size: 1.1rem;
    color: var(--on-surface);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding-bottom: 0.5rem;
  }
  
  .output-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
    contain: content; /* Improve rendering performance */
  }
  
  .view-more-outputs {
    grid-column: 1 / -1;
    display: flex;
    justify-content: center;
    padding: 1rem;
    background-color: rgba(0, 0, 0, 0.1);
    border-radius: 8px;
    margin-top: 1rem;
  }
  
  .btn-view-more {
    background-color: var(--primary);
    color: var(--on-primary);
    border: none;
    border-radius: 4px;
    padding: 0.5rem 1rem;
    cursor: pointer;
    font-size: 0.9rem;
  }
  
  .image-placeholder {
    width: 100px;
    height: 100px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background-color: rgba(0, 0, 0, 0.2);
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8rem;
    gap: 0.5rem;
    transition: opacity 0.2s;
  }
  
  .image-placeholder.loading {
    opacity: 0.6;
  }
  
  .image-placeholder .material-icons {
    font-size: 32px;
    color: var(--primary);
  }
  
  .preview-title {
    font-size: 0.8rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
  
  .output-item {
    background-color: rgba(0, 0, 0, 0.2);
    border-radius: 4px;
    overflow: hidden;
    position: relative;
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: transform 0.2s;
    contain: content; /* Improve performance with CSS containment */
  }
  
  .output-item:hover {
    transform: translateY(-2px);
  }
  
  .output-actions {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    z-index: 2;
    opacity: 0;
    transition: opacity 0.2s;
  }
  
  .output-item:hover .output-actions {
    opacity: 1;
  }
  
  .action-btn {
    background-color: rgba(0, 0, 0, 0.6);
    color: white;
    border: none;
    border-radius: 50%;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  
  .action-btn:hover {
    background-color: rgba(255, 0, 0, 0.6);
  }
  
  .action-btn .material-icons {
    font-size: 16px;
  }
  
  .output-content {
    height: 150px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .output-content.image {
    overflow: hidden;
  }
  
  .preview-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    padding: 1rem;
    text-align: center;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .preview-container:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }
  
  .preview-container .material-icons.file-icon {
    font-size: 48px;
    margin-bottom: 0.5rem;
    color: var(--primary);
  }
  
  .output-content {
    background-color: rgba(0, 0, 0, 0.2);
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
  }
  
  .output-content:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  }
  
  .file-type {
    font-size: 0.9rem;
    margin-bottom: 0.5rem;
    color: var(--on-surface);
    text-transform: capitalize;
  }
  
  .view-hint {
    font-size: 0.8rem;
    color: var(--primary);
    opacity: 0.8;
    margin-top: 0.25rem;
    transition: opacity 0.2s;
  }
  
  .output-content:hover .view-hint {
    opacity: 1;
  }
  
  .output-info {
    padding: 0.75rem;
    background-color: rgba(0, 0, 0, 0.3);
  }
  
  .output-name {
    font-size: 0.9rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 0.25rem;
  }
  
  .output-timestamp {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
  }
  
  .data-preview {
    width: 100%;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }
  
  .data-preview pre {
    margin: 0;
    font-size: 0.8rem;
    color: var(--on-surface);
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .view-btn {
    background-color: var(--primary);
    color: var(--on-primary);
    border: none;
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 0.75rem;
    cursor: pointer;
  }
  
  .screenshot-preview {
    max-width: 100%;
    margin: 8px 0;
    overflow: hidden;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .screenshot-preview img {
    max-width: 100%;
    height: auto;
    display: block;
    object-fit: contain;
    will-change: transform; /* Hint to browser for optimal rendering */
  }
  
  .infinite-scroll-trigger {
    display: flex;
    justify-content: center;
    margin-top: 1rem;
    padding: 1rem;
    min-height: 80px;
    align-items: center;
  }
  
  .infinite-scroll-trigger.hidden {
    display: none;
  }
  
  .loading-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background-color: rgba(255, 255, 255, 0.05);
    padding: 0.5rem 1rem;
    border-radius: 4px;
    font-size: 0.9rem;
  }
  
  .priority-notification {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    background-color: rgba(255, 255, 255, 0.05);
    color: var(--primary);
    padding: 0.5rem;
    border-radius: 4px;
    font-size: 0.9rem;
    margin-bottom: 1rem;
  }
  
  .all-loaded-message {
    color: var(--on-surface-variant);
    font-size: 0.9rem;
    padding: 0.5rem;
    text-align: center;
    background-color: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
    padding: 0.75rem 1.5rem;
  }
  
  .error-text {
    color: var(--error);
    font-size: 0.8rem;
  }
  
  /* Modal dialog styling */
  :global(.data-dialog) {
    background-color: var(--surface);
    color: var(--on-surface);
    border: none;
    border-radius: 8px;
    padding: 0;
    max-width: 80vw;
    max-height: 80vh;
  }
  
  :global(.data-dialog::backdrop) {
    background-color: rgba(0, 0, 0, 0.7);
  }
  
  :global(.dialog-content) {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-height: calc(90vh - 3rem);
    overflow: auto;
    width: 100%;
  }
  
  :global(.dialog-header) {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding-bottom: 0.75rem;
    margin-bottom: 0.5rem;
  }
  
  :global(.dialog-content h3) {
    margin: 0;
    color: var(--primary);
    font-size: 1.2rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: calc(100% - 40px);
  }
  
  :global(.image-dialog) {
    padding: 1rem;
    max-width: 90vw;
    max-height: 90vh;
  }
  
  :global(.image-container) {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.3);
    border-radius: 4px;
    overflow: auto;
    position: relative;
  }
  
  :global(.fullsize-image) {
    max-width: none;
    max-height: none;
    object-fit: contain;
    transform-origin: center;
    transition: transform 0.1s ease;
    cursor: grab;
  }
  
  :global(.fullsize-image:active) {
    cursor: grabbing;
  }
  
  :global(.image-controls) {
    position: absolute;
    bottom: 10px;
    right: 10px;
    display: flex;
    gap: 5px;
    background-color: rgba(0, 0, 0, 0.6);
    padding: 5px;
    border-radius: 4px;
    z-index: 5;
  }
  
  :global(.control-btn) {
    background-color: transparent;
    color: white;
    border: none;
    border-radius: 50%;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  
  :global(.control-btn:hover) {
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  :global(.data-container) {
    width: 100%;
  }
  
  :global(.dialog-content pre) {
    background-color: rgba(0, 0, 0, 0.2);
    padding: 1rem;
    border-radius: 4px;
    overflow: auto;
    font-size: 0.9rem;
    max-height: 70vh;
    width: 100%;
    white-space: pre-wrap;
    word-break: break-word;
  }
  
  :global(.dialog-loading) {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    gap: 1rem;
    min-height: 200px;
  }
  
  :global(.error-icon) {
    color: var(--error);
    font-size: 2rem;
  }
  
  :global(.close-btn) {
    background-color: transparent;
    color: var(--on-surface);
    border: none;
    border-radius: 50%;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  :global(.close-btn:hover) {
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  :global(.close-btn .material-icons) {
    font-size: 20px;
  }
</style>