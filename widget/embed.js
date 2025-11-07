/**
 * RAG Assistant Widget - Async Embed Script
 * 
 * This script provides an async loading mechanism for the RAG Assistant widget.
 * It follows the pattern used by popular services like Google Analytics, Intercom, etc.
 * 
 * Usage:
 * <script>
 *   (function(w,d,s,o,f,js,fjs){
 *     w['RAGAssistant']=o;w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
 *     js=d.createElement(s),fjs=d.getElementsByTagName(s)[0];
 *     js.id=o;js.src=f;js.async=1;fjs.parentNode.insertBefore(js,fjs);
 *   }(window,document,'script','ra','https://cdn.rag-assistant.com/v1/widget.js'));
 *   
 *   ra('init', {
 *     merchantId: 'your_merchant_id',
 *     apiKey: 'pk_live_...',
 *     theme: {
 *       primaryColor: '#007bff',
 *       position: 'bottom-right'
 *     }
 *   });
 * </script>
 */

(function(window, document) {
  'use strict';

  // Prevent multiple initializations
  if (window.RAGAssistantEmbed) {
    console.warn('[RAG Assistant] Embed script already loaded');
    return;
  }

  // Configuration
  var config = {
    version: '1.0.0',
    widgetUrl: 'https://cdn.rag-assistant.com/v1/widget.js',
    fallbackUrl: 'https://cdn.rag-assistant.com/v1/widget.min.js'
  };

  // Queue for commands before widget loads
  var commandQueue = [];
  var widgetInstance = null;
  var isLoading = false;
  var isLoaded = false;

  /**
   * Main embed function
   * Queues commands until widget is loaded
   */
  function embedFunction() {
    var args = Array.prototype.slice.call(arguments);
    var command = args[0];
    var params = args.slice(1);

    // If widget is loaded, execute immediately
    if (isLoaded && widgetInstance) {
      executeCommand(command, params);
    } else {
      // Queue command for later execution
      commandQueue.push({ command: command, params: params });
      
      // Start loading if not already loading
      if (!isLoading && command === 'init') {
        loadWidget(params[0]);
      }
    }
  }

  /**
   * Load the widget script asynchronously
   */
  function loadWidget(initConfig) {
    if (isLoading || isLoaded) {
      return;
    }

    isLoading = true;
    console.log('[RAG Assistant] Loading widget...');

    // Determine widget URL (allow override for development)
    var widgetUrl = initConfig && initConfig.widgetUrl 
      ? initConfig.widgetUrl 
      : config.widgetUrl;

    // Create script element
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.src = widgetUrl;
    script.id = 'rag-assistant-widget';

    // Handle successful load
    script.onload = function() {
      console.log('[RAG Assistant] Widget loaded successfully');
      isLoaded = true;
      isLoading = false;
      onWidgetLoaded();
    };

    // Handle load error
    script.onerror = function() {
      console.error('[RAG Assistant] Failed to load widget from:', widgetUrl);
      isLoading = false;
      
      // Try fallback URL if different
      if (widgetUrl !== config.fallbackUrl) {
        console.log('[RAG Assistant] Trying fallback URL...');
        config.widgetUrl = config.fallbackUrl;
        loadWidget(initConfig);
      } else {
        console.error('[RAG Assistant] All widget URLs failed to load');
        showErrorMessage();
      }
    };

    // Insert script into page
    var firstScript = document.getElementsByTagName('script')[0];
    if (firstScript && firstScript.parentNode) {
      firstScript.parentNode.insertBefore(script, firstScript);
    } else {
      document.head.appendChild(script);
    }
  }

  /**
   * Called when widget script is loaded
   * Processes queued commands
   */
  function onWidgetLoaded() {
    // Check if RAGAssistant class is available
    if (!window.RAGAssistant) {
      console.error('[RAG Assistant] Widget loaded but RAGAssistant class not found');
      return;
    }

    // Process queued commands
    console.log('[RAG Assistant] Processing', commandQueue.length, 'queued commands');
    
    commandQueue.forEach(function(item) {
      executeCommand(item.command, item.params);
    });

    // Clear queue
    commandQueue = [];
  }

  /**
   * Execute a command
   */
  function executeCommand(command, params) {
    try {
      switch (command) {
        case 'init':
          initWidget(params[0]);
          break;
        
        case 'open':
          if (widgetInstance) {
            widgetInstance.open();
          }
          break;
        
        case 'close':
          if (widgetInstance) {
            widgetInstance.close();
          }
          break;
        
        case 'clearHistory':
          if (widgetInstance) {
            widgetInstance.clearHistory();
          }
          break;
        
        case 'resetSession':
          if (widgetInstance) {
            widgetInstance.resetSession();
          }
          break;
        
        case 'sendMessage':
          if (widgetInstance && params[0]) {
            widgetInstance.sendMessage(params[0]);
          }
          break;
        
        case 'getSessionId':
          if (widgetInstance) {
            var sessionId = widgetInstance.getSessionId();
            if (params[0] && typeof params[0] === 'function') {
              params[0](sessionId);
            }
            return sessionId;
          }
          break;
        
        default:
          console.warn('[RAG Assistant] Unknown command:', command);
      }
    } catch (error) {
      console.error('[RAG Assistant] Error executing command:', command, error);
    }
  }

  /**
   * Initialize the widget
   */
  function initWidget(config) {
    if (!config) {
      console.error('[RAG Assistant] Configuration required for init');
      return;
    }

    if (!config.merchantId) {
      console.error('[RAG Assistant] merchantId is required');
      return;
    }

    if (!config.apiKey) {
      console.error('[RAG Assistant] apiKey is required');
      return;
    }

    try {
      console.log('[RAG Assistant] Initializing widget for merchant:', config.merchantId);
      widgetInstance = new window.RAGAssistant(config);
      console.log('[RAG Assistant] Widget initialized successfully');
    } catch (error) {
      console.error('[RAG Assistant] Failed to initialize widget:', error);
      showErrorMessage();
    }
  }

  /**
   * Show error message to user
   */
  function showErrorMessage() {
    // Only show in development (check for localhost or specific flag)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      var errorDiv = document.createElement('div');
      errorDiv.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#f44336;color:white;padding:15px;border-radius:8px;box-shadow:0 4px 8px rgba(0,0,0,0.2);z-index:9999;max-width:300px;font-family:Arial,sans-serif;font-size:14px;';
      errorDiv.innerHTML = '<strong>RAG Assistant Error</strong><br>Failed to load widget. Check console for details.';
      document.body.appendChild(errorDiv);
      
      setTimeout(function() {
        if (errorDiv.parentNode) {
          errorDiv.parentNode.removeChild(errorDiv);
        }
      }, 5000);
    }
  }

  /**
   * Utility: Check if DOM is ready
   */
  function onDOMReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  }

  // Export embed function
  window.RAGAssistantEmbed = {
    version: config.version,
    load: loadWidget,
    execute: executeCommand
  };

  // Set up the global function if not already defined
  if (!window.ra) {
    window.ra = embedFunction;
  }

  console.log('[RAG Assistant] Embed script loaded (v' + config.version + ')');

})(window, document);
