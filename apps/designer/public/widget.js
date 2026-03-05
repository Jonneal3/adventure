// Widget initialization script
// Keep a reference to the current widget state for dynamic updates
window.__sifWidgetState = window.__sifWidgetState || {
  rootId: null,
  container: null,
  props: null,
  reactRoot: null,
};

function postToParent(type, payload) {
  try {
    if (window.parent) window.parent.postMessage({ type, ...payload }, '*');
  } catch {}
}

function getWidgetComponent() {
  if (window.Widget) return window.Widget;
  // eslint-disable-next-line no-undef
  if (typeof Widget !== 'undefined') return Widget;
  return null;
}

function renderWidget(props) {
  const state = window.__sifWidgetState;
  if (!state || !state.container) throw new Error('Missing widget container');

  const WidgetComponent = getWidgetComponent();
  if (!WidgetComponent) throw new Error('Widget component not found (expected window.Widget)');

  if (!window.React) throw new Error('React not found on window.React');
  if (!window.ReactDOM) throw new Error('ReactDOM not found on window.ReactDOM');

  const element = window.React.createElement(WidgetComponent, props);

  if (typeof window.ReactDOM.createRoot === 'function') {
    if (!state.reactRoot) {
      state.reactRoot = window.ReactDOM.createRoot(state.container);
    }
    state.reactRoot.render(element);
    return;
  }

  if (typeof window.ReactDOM.render === 'function') {
    window.ReactDOM.render(element, state.container);
    return;
  }

  throw new Error('No supported ReactDOM render API found');
}

function showFatalError(container, message, err) {
  try {
    // eslint-disable-next-line no-console
    console.error('[widget preview]', message, err);
    const details = err && (err.stack || err.message || String(err));
    container.innerHTML = [
      '<div style="padding:16px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;line-height:1.4">',
      '<div style="font-weight:600;color:#dc2626;margin-bottom:6px">Widget preview failed to load</div>',
      `<div style="color:#111827;margin-bottom:10px">${message}</div>`,
      details ? `<pre style="white-space:pre-wrap;color:#6b7280;background:#f9fafb;padding:10px;border-radius:8px;border:1px solid #e5e7eb">${details}</pre>` : '',
      '</div>',
    ].join('');
  } catch {}
}

window.initWidget = function(rootId, options) {
  const { instanceId, config, fullPage, deployment } = options || {};

  // Create widget container
  const container = document.getElementById(rootId);
  if (!container) {
    return;
  }

  // Initialize the widget component
  const widgetProps = {
    instanceId,
    controlsOnly: false,
    designConfig: config,
    fullPage,
    deployment,
    className: 'w-full h-full'
  };

  // Persist state for future updates
  window.__sifWidgetState.rootId = rootId;
  window.__sifWidgetState.container = container;
  window.__sifWidgetState.props = widgetProps;
  window.__sifWidgetState.reactRoot = null;

  // Render when dependencies are ready (scripts may arrive async)
  const maxAttempts = 60; // ~6s @ 100ms
  let attempts = 0;

  const attemptRender = () => {
    attempts += 1;
    try {
      renderWidget(widgetProps);
      postToParent('WIDGET_READY');
    } catch (err) {
      if (attempts >= maxAttempts) {
        showFatalError(container, 'Timed out waiting for widget scripts to load.', err);
        postToParent('WIDGET_ERROR', { message: err && (err.message || String(err)) });
        return;
      }
      setTimeout(attemptRender, 100);
    }
  };

  attemptRender();
};

// Update widget configuration dynamically without full reload
window.updateWidgetConfig = function(newConfig) {
  const state = window.__sifWidgetState;
  if (!state || !state.container || !state.props) return;
  const nextProps = { ...state.props, designConfig: newConfig };
  state.props = nextProps;
  try {
    renderWidget(nextProps);
    postToParent('UPDATE_CONFIG_ACK');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[widget preview] failed to apply config update', err);
    postToParent('WIDGET_ERROR', { message: err && (err.message || String(err)) });
  }
};

// Listen for config updates from parent (designer)
window.addEventListener('message', (event) => {
  const data = event && event.data;
  if (!data || typeof data !== 'object') return;
  if (data.type === 'UPDATE_CONFIG' && data.config) {
    try {
      window.updateWidgetConfig(data.config);
    } catch {}
  }
});

// Shopify auto-detection and initialization
(function() {
  // Detect Shopify context
  const isShopify = window.Shopify || document.querySelector('[data-shop]');
  
  if (isShopify) {
    // Wait for DOM to be ready
    const initializeShopifyWidgets = () => {
      // Find all containers with data-shop attribute
      const containers = document.querySelectorAll('[data-shop][data-instance-id]');
      
      containers.forEach((container) => {
        const shop = container.getAttribute('data-shop');
        const instanceId = container.getAttribute('data-instance-id');
        const productId = container.getAttribute('data-product-id');
        
        if (!shop || !instanceId || !container.id) {
          return;
        }
        
        // Build API URL
        const siteUrl = window.location.origin;
        const apiUrl = new URL('/api/shopify/instance-config', siteUrl);
        apiUrl.searchParams.set('shop', shop);
        apiUrl.searchParams.set('instanceId', instanceId);
        if (productId) {
          apiUrl.searchParams.set('productId', productId);
        }
        
        // Fetch instance config and initialize widget
        fetch(apiUrl.toString())
          .then(response => {
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }
            return response.json();
          })
          .then(data => {
            if (window.initWidget && data.instanceId && data.config) {
              window.initWidget(container.id, {
                instanceId: data.instanceId,
                config: data.config,
                fullPage: false,
                deployment: true
              });
            } else {
              console.error('Failed to initialize widget: missing initWidget or config data');
            }
          })
          .catch(error => {
            console.error('Error loading widget config:', error);
            if (container) {
              container.innerHTML = '<p style="padding: 20px; color: #dc2626;">Failed to load widget configuration.</p>';
            }
          });
      });
    };
    
    // Run when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeShopifyWidgets);
    } else {
      // DOM is already ready
      initializeShopifyWidgets();
    }
    
    // Also run after a short delay to catch dynamically added elements
    setTimeout(initializeShopifyWidgets, 1000);
  }
})();
