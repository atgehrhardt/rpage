// Utility function to show toast notifications
export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  // Fade in
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  // Remove after duration
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, duration);
}

// Utility function to show browser notifications
export function showBrowserNotification(title: string, options: NotificationOptions = {}) {
  // Check if notifications are enabled in settings
  const checkNotificationsEnabled = async () => {
    try {
      // Try to load settings
      const response = await fetch('/api/settings');
      const data = await response.json();
      
      if (data && data.success && data.data) {
        return data.data.notificationsEnabled;
      }
      
      // Default to false if can't determine
      return false;
    } catch (error) {
      console.error('Error checking notification settings:', error);
      return false;
    }
  };

  // Early return if notifications are disabled
  checkNotificationsEnabled().then(enabled => {
    if (!enabled) {
      console.log('Browser notifications are disabled in settings');
      return;
    }

    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return;
    }

    if (Notification.permission === 'granted') {
      new Notification(title, options);
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification(title, options);
        }
      });
    }
  });
}