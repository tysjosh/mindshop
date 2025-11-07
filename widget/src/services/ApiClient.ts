import axios, { AxiosInstance } from 'axios';
import {
  ChatRequest,
  ChatResponse,
  SessionRequest,
  SessionResponse
} from '../types';

/**
 * API Client for communicating with RAG Assistant backend
 */
export class ApiClient {
  private client: AxiosInstance;
  private apiKey: string;
  private merchantId: string;

  constructor(apiKey: string, merchantId: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.merchantId = merchantId;

    this.client = axios.create({
      baseURL: baseUrl || 'https://api.rag-assistant.com',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-Merchant-ID': merchantId
      }
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        console.debug('[RAG Widget] API Request:', config.method?.toUpperCase(), config.url);
        return config;
      },
      (error) => {
        console.error('[RAG Widget] API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        console.debug('[RAG Widget] API Response:', response.status, response.data);
        return response;
      },
      (error) => {
        console.error('[RAG Widget] API Response Error:', error.response?.data || error.message);
        return Promise.reject(this.handleError(error));
      }
    );
  }

  /**
   * Create a new chat session
   */
  async createSession(data: SessionRequest): Promise<SessionResponse> {
    const response = await this.client.post<any>('/api/chat/sessions', data);
    // Backend returns { success, data: { sessionId, createdAt }, ... }
    return response.data.data || response.data;
  }

  /**
   * Send a chat message
   */
  async chat(data: ChatRequest): Promise<ChatResponse> {
    const response = await this.client.post<any>('/api/chat', data);
    // Backend returns { success, data: { response, recommendations, sessionId }, ... }
    return response.data.data || response.data;
  }

  /**
   * Get session history
   */
  async getHistory(sessionId: string, merchantId?: string): Promise<ChatResponse[]> {
    const params = merchantId ? { merchantId } : {};
    const response = await this.client.get<any>(
      `/api/chat/sessions/${sessionId}/history`,
      { params }
    );
    // Backend returns { success, data: { sessionId, messages }, ... }
    const result = response.data.data || response.data;
    return result.messages || result;
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.client.delete(`/api/chat/sessions/${sessionId}`);
  }

  /**
   * Handle API errors
   */
  private handleError(error: any): Error {
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const message = error.response.data?.error || error.response.data?.message || 'Unknown error';

      switch (status) {
        case 401:
          return new Error('Invalid API key. Please check your configuration.');
        case 403:
          return new Error('Access denied. Please check your permissions.');
        case 429:
          return new Error('Rate limit exceeded. Please try again later.');
        case 500:
          return new Error('Server error. Please try again later.');
        default:
          return new Error(`API Error (${status}): ${message}`);
      }
    } else if (error.request) {
      // Request made but no response received
      return new Error('Network error. Please check your connection.');
    } else {
      // Something else happened
      return new Error(error.message || 'Unknown error occurred.');
    }
  }
}
