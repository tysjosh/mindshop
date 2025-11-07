import { RAGConfig } from '../types';

/**
 * Input box component for user message input
 */
export class InputBox {
  private config: RAGConfig;
  private container: HTMLElement | null = null;
  private input: HTMLTextAreaElement | null = null;
  private sendButton: HTMLButtonElement | null = null;
  private onSend: (query: string) => void;

  constructor(config: RAGConfig, onSend: (query: string) => void) {
    this.config = config;
    this.onSend = onSend;
  }

  /**
   * Render the input box
   */
  render(container: HTMLElement): void {
    this.container = container;
    this.container.className = 'rag-input-box';

    // Create input textarea
    this.input = document.createElement('textarea');
    this.input.className = 'rag-input-textarea';
    this.input.placeholder = this.config.behavior?.placeholder || 'Ask me anything...';
    this.input.rows = 1;
    this.input.maxLength = 500;

    // Create send button
    this.sendButton = document.createElement('button');
    this.sendButton.className = 'rag-input-send-button';
    this.sendButton.disabled = true;
    this.sendButton.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;

    // Append elements
    this.container.appendChild(this.input);
    this.container.appendChild(this.sendButton);

    // Attach event listeners
    this.attachEventListeners();
  }

  /**
   * Focus the input
   */
  focus(): void {
    if (this.input) {
      this.input.focus();
    }
  }

  /**
   * Clear the input
   */
  clear(): void {
    if (this.input) {
      this.input.value = '';
      this.adjustHeight();
      this.updateSendButton();
    }
  }

  /**
   * Disable the input
   */
  disable(): void {
    if (this.input) {
      this.input.disabled = true;
    }
    if (this.sendButton) {
      this.sendButton.disabled = true;
    }
  }

  /**
   * Enable the input
   */
  enable(): void {
    if (this.input) {
      this.input.disabled = false;
    }
    this.updateSendButton();
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    if (!this.input || !this.sendButton) return;

    // Input event - adjust height and update button
    this.input.addEventListener('input', () => {
      this.adjustHeight();
      this.updateSendButton();
    });

    // Keydown event - send on Enter (without Shift)
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });

    // Send button click
    this.sendButton.addEventListener('click', () => {
      this.handleSend();
    });
  }

  /**
   * Handle send action
   */
  private handleSend(): void {
    if (!this.input) return;

    const query = this.input.value.trim();
    if (!query) return;

    // Call the onSend callback
    this.onSend(query);

    // Clear input
    this.clear();
  }

  /**
   * Adjust textarea height based on content
   */
  private adjustHeight(): void {
    if (!this.input) return;

    // Reset height to auto to get the correct scrollHeight
    this.input.style.height = 'auto';

    // Set height based on scrollHeight (max 120px)
    const maxHeight = 120;
    const newHeight = Math.min(this.input.scrollHeight, maxHeight);
    this.input.style.height = `${newHeight}px`;

    // Enable scrolling if content exceeds max height
    if (this.input.scrollHeight > maxHeight) {
      this.input.style.overflowY = 'auto';
    } else {
      this.input.style.overflowY = 'hidden';
    }
  }

  /**
   * Update send button state
   */
  private updateSendButton(): void {
    if (!this.input || !this.sendButton) return;

    const hasContent = this.input.value.trim().length > 0;
    this.sendButton.disabled = !hasContent || this.input.disabled;
  }
}
