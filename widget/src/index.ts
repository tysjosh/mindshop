/**
 * RAG Assistant Widget
 * Embeddable chat widget for merchant websites
 * 
 * @example
 * ```html
 * <script src="https://cdn.rag-assistant.com/v1/widget.js"></script>
 * <script>
 *   const assistant = new RAGAssistant({
 *     merchantId: 'your_merchant_id',
 *     apiKey: 'pk_live_...',
 *     theme: {
 *       primaryColor: '#007bff',
 *       position: 'bottom-right'
 *     },
 *     behavior: {
 *       autoOpen: false,
 *       greeting: 'Hi! How can I help you today?'
 *     },
 *     integration: {
 *       addToCartCallback: (product) => {
 *         console.log('Add to cart:', product);
 *       }
 *     }
 *   });
 * </script>
 * ```
 */

import RAGAssistant from './RAGAssistant';

// Export types for TypeScript users
export * from './types';

// Export services for advanced usage
export { Analytics } from './services/Analytics';
export { ApiClient } from './services/ApiClient';
export { Storage } from './services/Storage';

// Export main class
export { RAGAssistant };

// Make available globally for script tag usage
if (typeof window !== 'undefined') {
  (window as any).RAGAssistant = RAGAssistant;
}

// Default export
export default RAGAssistant;
