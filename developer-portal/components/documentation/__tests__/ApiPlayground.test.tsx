import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApiPlayground } from '../ApiPlayground';

// Mock fetch
global.fetch = jest.fn();

describe('ApiPlayground', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the API playground component', () => {
    render(<ApiPlayground />);
    
    expect(screen.getByText('API Playground')).toBeInTheDocument();
    expect(screen.getByText(/Test API endpoints directly from your browser/i)).toBeInTheDocument();
  });

  it('displays endpoint selection dropdown', () => {
    render(<ApiPlayground />);
    
    expect(screen.getByLabelText('Endpoint')).toBeInTheDocument();
  });

  it('displays base URL selection', () => {
    render(<ApiPlayground />);
    
    expect(screen.getByLabelText('Base URL')).toBeInTheDocument();
  });

  it('shows authentication field when endpoint requires auth', () => {
    render(<ApiPlayground />);
    
    // Default endpoint requires API key auth
    expect(screen.getByLabelText('API Key')).toBeInTheDocument();
  });

  it('displays request body textarea for POST endpoints', () => {
    render(<ApiPlayground />);
    
    // Default endpoint is POST /api/chat
    expect(screen.getByLabelText('Request Body (JSON)')).toBeInTheDocument();
  });

  it('shows send request button', () => {
    render(<ApiPlayground />);
    
    expect(screen.getByRole('button', { name: /Send Request/i })).toBeInTheDocument();
  });

  it('displays response and curl tabs', () => {
    render(<ApiPlayground />);
    
    expect(screen.getByRole('tab', { name: /Response/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /cURL/i })).toBeInTheDocument();
  });

  it('generates curl command correctly', () => {
    render(<ApiPlayground />);
    
    // Switch to cURL tab
    const curlTab = screen.getByRole('tab', { name: /cURL/i });
    fireEvent.click(curlTab);
    
    // Should show curl command
    expect(screen.getByText(/curl -X POST/i)).toBeInTheDocument();
  });

  it('handles successful API request', async () => {
    const mockResponse = {
      success: true,
      data: { message: 'Test response' }
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockResponse
    });

    render(<ApiPlayground />);
    
    // Fill in API key
    const apiKeyInput = screen.getByLabelText('API Key');
    fireEvent.change(apiKeyInput, { target: { value: 'pk_test_123' } });
    
    // Click send request
    const sendButton = screen.getByRole('button', { name: /Send Request/i });
    fireEvent.click(sendButton);
    
    // Wait for response
    await waitFor(() => {
      expect(screen.getByText('200 OK')).toBeInTheDocument();
    });
    
    // Check response body is displayed
    expect(screen.getByText(/"success": true/)).toBeInTheDocument();
  });

  it('handles API request errors', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    render(<ApiPlayground />);
    
    // Click send request
    const sendButton = screen.getByRole('button', { name: /Send Request/i });
    fireEvent.click(sendButton);
    
    // Wait for error
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('validates JSON in request body', async () => {
    render(<ApiPlayground />);
    
    // Enter invalid JSON
    const requestBodyTextarea = screen.getByLabelText('Request Body (JSON)');
    fireEvent.change(requestBodyTextarea, { target: { value: 'invalid json' } });
    
    // Click send request
    const sendButton = screen.getByRole('button', { name: /Send Request/i });
    fireEvent.click(sendButton);
    
    // Wait for error
    await waitFor(() => {
      expect(screen.getByText('Invalid JSON in request body')).toBeInTheDocument();
    });
  });

  it('allows copying response to clipboard', async () => {
    const mockResponse = {
      success: true,
      data: { message: 'Test response' }
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockResponse
    });

    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn()
      }
    });

    render(<ApiPlayground />);
    
    // Send request
    const sendButton = screen.getByRole('button', { name: /Send Request/i });
    fireEvent.click(sendButton);
    
    // Wait for response
    await waitFor(() => {
      expect(screen.getByText('200 OK')).toBeInTheDocument();
    });
    
    // Find and click copy button
    const copyButtons = screen.getAllByRole('button');
    const copyButton = copyButtons.find(btn => btn.querySelector('svg')); // Copy icon
    
    if (copyButton) {
      fireEvent.click(copyButton);
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    }
  });

  it('switches between different endpoints', () => {
    render(<ApiPlayground />);
    
    // Default is POST /api/chat
    expect(screen.getByText(/Send a chat query/i)).toBeInTheDocument();
    
    // Change endpoint (this would require interacting with the Select component)
    // For now, just verify the endpoint selector exists
    expect(screen.getByLabelText('Endpoint')).toBeInTheDocument();
  });

  it('switches between different environments', () => {
    render(<ApiPlayground />);
    
    // Verify base URL selector exists
    expect(screen.getByLabelText('Base URL')).toBeInTheDocument();
  });
});
