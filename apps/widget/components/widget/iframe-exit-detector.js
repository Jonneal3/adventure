// Exit intent detection for Adventure Widget iframes
(function() {
  const IFRAME_MESSAGE_TYPE = 'MAGE_WIDGET_EXIT_INTENT';
  const registeredIframes = new Set();
  let isMouseLeaving = false;
  let mouseLeaveTimeout;

  // Register iframe when it sends a message
  window.addEventListener('message', (event) => {
    if (event.data?.type === IFRAME_MESSAGE_TYPE && 
        event.data?.action === 'register') {
      registeredIframes.add(event.data.instanceId);
    }
  });

  // Notify all registered iframes about exit intent
  function notifyIframes() {
    registeredIframes.forEach(instanceId => {
      // Find all iframes on the page
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach(iframe => {
        try {
          iframe.contentWindow.postMessage({
            type: IFRAME_MESSAGE_TYPE,
            action: 'exit-intent',
            instanceId
          }, '*');
        } catch (e) {
          console.warn('Could not send message to iframe:', e);
        }
      });
    });
  }

  // Handle mouse movement and exit intent
  document.addEventListener('mousemove', (e) => {
    // Check if mouse is leaving the viewport
    if (e.clientY <= 0 || e.clientX <= 0 || 
        e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
      isMouseLeaving = true;
      if (mouseLeaveTimeout) {
        clearTimeout(mouseLeaveTimeout);
      }
      mouseLeaveTimeout = setTimeout(() => {
        notifyIframes();
      }, 1000); // 1 second delay
    } else {
      isMouseLeaving = false;
      if (mouseLeaveTimeout) {
        clearTimeout(mouseLeaveTimeout);
      }
    }
  });

  // Handle page visibility changes
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      notifyIframes();
    }
  });

  // Handle page unload
  window.addEventListener('beforeunload', () => {
    notifyIframes();
  });

  // Handle tab/window close
  window.addEventListener('unload', () => {
    notifyIframes();
  });

  // Add script to page
  const script = document.createElement('script');
  script.textContent = `
    // Exit intent detection for Adventure Widget iframes
    (function() {
      const IFRAME_MESSAGE_TYPE = 'MAGE_WIDGET_EXIT_INTENT';
      const registeredIframes = new Set();
      let isMouseLeaving = false;
      let mouseLeaveTimeout;

      // Register iframe when it sends a message
      window.addEventListener('message', (event) => {
        if (event.data?.type === IFRAME_MESSAGE_TYPE && 
            event.data?.action === 'register') {
          registeredIframes.add(event.data.instanceId);
        }
      });

      // Notify all registered iframes about exit intent
      function notifyIframes() {
        registeredIframes.forEach(instanceId => {
          // Find all iframes on the page
          const iframes = document.querySelectorAll('iframe');
          iframes.forEach(iframe => {
            try {
              iframe.contentWindow.postMessage({
                type: IFRAME_MESSAGE_TYPE,
                action: 'exit-intent',
                instanceId
              }, '*');
            } catch (e) {
              console.warn('Could not send message to iframe:', e);
            }
          });
        });
      }

      // Handle mouse movement and exit intent
      document.addEventListener('mousemove', (e) => {
        // Check if mouse is leaving the viewport
        if (e.clientY <= 0 || e.clientX <= 0 || 
            e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
          isMouseLeaving = true;
          if (mouseLeaveTimeout) {
            clearTimeout(mouseLeaveTimeout);
          }
          mouseLeaveTimeout = setTimeout(() => {
            notifyIframes();
          }, 1000); // 1 second delay
        } else {
          isMouseLeaving = false;
          if (mouseLeaveTimeout) {
            clearTimeout(mouseLeaveTimeout);
          }
        }
      });

      // Handle page visibility changes
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          notifyIframes();
        }
      });

      // Handle page unload
      window.addEventListener('beforeunload', () => {
        notifyIframes();
      });

      // Handle tab/window close
      window.addEventListener('unload', () => {
        notifyIframes();
      });
    })();
  `;
  document.head.appendChild(script);
})(); 