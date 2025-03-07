import App from './App.svelte';
import SimpleApp from './SimpleApp.svelte';
import './global.css';

let app;

// Try to load the main app first, but catch any errors
try {
  // Log detailed info about app element and initialization
  const appElement = document.getElementById('app');
  console.log('App element found:', appElement);
  console.log('App element content:', appElement?.innerHTML);
  
  // If we're in an environment where window exists (browser)
  if (typeof window !== 'undefined') {
    // Add a custom error handler for the initial load
    window.onerror = function(message, source, lineno, colno, error) {
      console.error('Error in main app initialization:', message, error);
      
      if (!app) {
        console.log('Falling back to SimpleApp due to initialization error');
        
        // Make sure app element exists, create it if needed
        let targetElement = document.getElementById('app');
        if (!targetElement) {
          console.log('Creating missing app element');
          targetElement = document.createElement('div');
          targetElement.id = 'app';
          document.body.appendChild(targetElement);
        }
        
        // Create the simpler app instead
        app = new SimpleApp({
          target: targetElement,
        });
      }
      
      // Don't prevent default error handling
      return false;
    };
  }

  // Make sure app element exists
  const targetElement = document.getElementById('app');
  if (!targetElement) {
    throw new Error('App element not found in DOM');
  }

  // Create the app
  app = new App({
    target: targetElement,
  });

} catch (error) {
  console.error('Failed to initialize main app:', error);
  
  // Create the simpler app as fallback
  try {
    // Make sure app element exists, create it if needed
    let targetElement = document.getElementById('app');
    if (!targetElement) {
      console.log('Creating missing app element for fallback');
      targetElement = document.createElement('div');
      targetElement.id = 'app';
      document.body.appendChild(targetElement);
    }
    
    // Create the simpler app
    app = new SimpleApp({
      target: targetElement,
    });
    
    console.log('SimpleApp fallback initialized successfully');
  } catch (fallbackError) {
    console.error('Both main app and fallback failed:', fallbackError);
    // Display a basic error message directly in the DOM
    document.body.innerHTML = `
      <div style="max-width: 600px; margin: 100px auto; padding: 20px; background: #333; color: #fff; border-radius: 8px; text-align: center;">
        <h1>Rpage - Error</h1>
        <p>The application failed to initialize. Please check the console for details.</p>
        <p>Error: ${error.message}</p>
        <button onclick="window.location.reload()">Reload Page</button>
      </div>
    `;
  }
}

export default app;