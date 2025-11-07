import { RAGConfig, Message } from '../types';
import { MessageList } from './MessageList';
import { InputBox } from './InputBox';
import '../styles/widget.css';

/**
 * Main chat widget component
 */
export class ChatWidget {
  private config: RAGConfig;
  private container: HTMLElement | null = null;
  private messageList: MessageList;
  private inputBox: InputBox;
  private isOpen: boolean = false;
  private onSendMessage: (query: string) => void;

  constructor(config: RAGConfig, onSendMessage: (query: string) => void) {
    this.config = config;
    this.onSendMessage = onSendMessage;
    this.messageList = new MessageList(config);
    this.inputBox = new InputBox(config, this.handleSendMessage.bind(this));
  }

  /**
   * Render the widget
   */
  render(): void {
    // Create container
    this.container = document.createElement('div');
    this.container.id = 'rag-assistant-widget';
    this.container.className = 'rag-widget-container';
    this.container.style.cssText = this.getContainerStyles();

    // Create widget structure
    this.container.innerHTML = `
      <div class="rag-widget-toggle" id="rag-widget-toggle">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="rag-widget-window" id="rag-widget-window" style="display: none;">
        <div class="rag-widget-header">
          <div class="rag-widget-header-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>Shopping Assistant</span>
          </div>
          <button class="rag-widget-close" id="rag-widget-close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
        <div class="rag-widget-body" id="rag-widget-body">
          <!-- Message list will be inserted here -->
        </div>
        <div class="rag-widget-footer" id="rag-widget-footer">
          <!-- Input box will be inserted here -->
        </div>
      </div>
    `;

    // Append to body
    document.body.appendChild(this.container);

    // Apply theme
    this.applyTheme();

    // Render child components
    const bodyElement = this.container.querySelector('#rag-widget-body') as HTMLElement;
    const footerElement = this.container.querySelector('#rag-widget-footer') as HTMLElement;
    
    if (bodyElement) {
      this.messageList.render(bodyElement);
    }
    
    if (footerElement) {
      this.inputBox.render(footerElement);
    }

    // Add event listeners
    this.attachEventListeners();

    // Show greeting message
    if (this.config.behavior?.greeting) {
      this.addMessage({
        role: 'assistant',
        content: this.config.behavior.greeting,
        timestamp: new Date()
      });
    }
  }

  /**
   * Open the widget
   */
  open(): void {
    if (!this.container) return;

    const window = this.container.querySelector('#rag-widget-window') as HTMLElement;
    const toggle = this.container.querySelector('#rag-widget-toggle') as HTMLElement;

    if (window && toggle) {
      window.style.display = 'flex';
      toggle.style.display = 'none';
      this.isOpen = true;
      this.inputBox.focus();
    }
  }

  /**
   * Close the widget
   */
  close(): void {
    if (!this.container) return;

    const window = this.container.querySelector('#rag-widget-window') as HTMLElement;
    const toggle = this.container.querySelector('#rag-widget-toggle') as HTMLElement;

    if (window && toggle) {
      window.style.display = 'none';
      toggle.style.display = 'flex';
      this.isOpen = false;
    }
  }

  /**
   * Add a message to the chat
   */
  addMessage(message: Message): void {
    this.messageList.addMessage(message);
  }

  /**
   * Load conversation history
   */
  loadHistory(messages: Message[]): void {
    messages.forEach(msg => this.messageList.addMessage(msg));
  }

  /**
   * Show typing indicator
   */
  showTyping(): void {
    this.messageList.showTyping();
  }

  /**
   * Hide typing indicator
   */
  hideTyping(): void {
    this.messageList.hideTyping();
  }

  /**
   * Show error message
   */
  showError(message: string): void {
    this.addMessage({
      role: 'system',
      content: message,
      timestamp: new Date()
    });
  }

  /**
   * Clear all messages from the chat
   */
  clearMessages(): void {
    this.messageList.clearMessages();
    
    // Show greeting message again if configured
    if (this.config.behavior?.greeting) {
      this.addMessage({
        role: 'assistant',
        content: this.config.behavior.greeting,
        timestamp: new Date()
      });
    }
  }

  /**
   * Handle send message
   */
  private handleSendMessage(query: string): void {
    this.onSendMessage(query);
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    if (!this.container) return;

    const toggle = this.container.querySelector('#rag-widget-toggle');
    const close = this.container.querySelector('#rag-widget-close');

    if (toggle) {
      toggle.addEventListener('click', () => this.open());
    }

    if (close) {
      close.addEventListener('click', () => this.close());
    }
  }

  /**
   * Apply theme configuration
   */
  private applyTheme(): void {
    if (!this.container) return;

    const theme = this.config.theme || {};
    const root = this.container;

    if (theme.primaryColor) {
      root.style.setProperty('--rag-primary-color', theme.primaryColor);
    }

    if (theme.fontFamily) {
      root.style.setProperty('--rag-font-family', theme.fontFamily);
    }

    if (theme.borderRadius) {
      root.style.setProperty('--rag-border-radius', theme.borderRadius);
    }

    if (theme.zIndex) {
      root.style.zIndex = theme.zIndex.toString();
    }
  }

  /**
   * Get container styles based on position
   */
  private getContainerStyles(): string {
    const position = this.config.theme?.position || 'bottom-right';
    const baseStyles = 'position: fixed; z-index: 9999;';

    switch (position) {
      case 'bottom-right':
        return `${baseStyles} bottom: 20px; right: 20px;`;
      case 'bottom-left':
        return `${baseStyles} bottom: 20px; left: 20px;`;
      case 'top-right':
        return `${baseStyles} top: 20px; right: 20px;`;
      case 'top-left':
        return `${baseStyles} top: 20px; left: 20px;`;
      default:
        return `${baseStyles} bottom: 20px; right: 20px;`;
    }
  }
}
