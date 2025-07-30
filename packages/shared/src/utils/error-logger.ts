export interface ErrorLogEntry {
  id: string;
  type: 'client_error' | 'api_error' | 'network_error' | 'validation_error';
  message: string;
  stack?: string;
  url: string;
  userAgent: string;
  timestamp: string;
  userId?: string;
  sessionId?: string;
  additionalData?: Record<string, any>;
}

export interface ErrorReportingConfig {
  apiUrl: string;
  maxRetries: number;
  retryDelay: number;
  batchSize: number;
  flushInterval: number;
  enableLocalStorage: boolean;
  enableConsoleLog: boolean;
}

class ErrorLogger {
  private config: ErrorReportingConfig;
  private errorQueue: ErrorLogEntry[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private retryCount = new Map<string, number>();

  constructor(config: Partial<ErrorReportingConfig> = {}) {
    this.config = {
      apiUrl: '/api/v1/errors/report',
      maxRetries: 3,
      retryDelay: 1000,
      batchSize: 10,
      flushInterval: 30000, // 30 seconds
      enableLocalStorage: true,
      enableConsoleLog: process.env.NODE_ENV === 'development',
      ...config,
    };

    // Start periodic flush
    this.startPeriodicFlush();

    // Load queued errors from localStorage on initialization
    this.loadQueuedErrors();

    // Set up global error handlers
    this.setupGlobalErrorHandlers();
  }

  private setupGlobalErrorHandlers() {
    if (typeof window === 'undefined') return;

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.logError({
        type: 'client_error',
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack,
        additionalData: {
          reason: event.reason,
          promise: event.promise,
        },
      });
    });

    // Handle global JavaScript errors
    window.addEventListener('error', (event) => {
      this.logError({
        type: 'client_error',
        message: event.message,
        stack: event.error?.stack,
        additionalData: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    });
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getCurrentUrl(): string {
    return typeof window !== 'undefined' ? window.location.href : '';
  }

  private getUserAgent(): string {
    return typeof window !== 'undefined' ? navigator.userAgent : '';
  }

  private getSessionId(): string {
    if (typeof window === 'undefined') return '';
    
    let sessionId = sessionStorage.getItem('error_session_id');
    if (!sessionId) {
      sessionId = this.generateId();
      sessionStorage.setItem('error_session_id', sessionId);
    }
    return sessionId;
  }

  private getUserId(): string | undefined {
    if (typeof window === 'undefined') return undefined;
    
    // Try to get user ID from localStorage or other auth storage
    try {
      const authData = localStorage.getItem('auth_user');
      if (authData) {
        const user = JSON.parse(authData);
        return user.id || user.email;
      }
    } catch {
      // Ignore parsing errors
    }
    return undefined;
  }

  public logError(error: Partial<ErrorLogEntry>): void {
    const errorEntry: ErrorLogEntry = {
      id: this.generateId(),
      type: error.type || 'client_error',
      message: error.message || 'Unknown error',
      stack: error.stack,
      url: error.url || this.getCurrentUrl(),
      userAgent: error.userAgent || this.getUserAgent(),
      timestamp: error.timestamp || new Date().toISOString(),
      userId: error.userId || this.getUserId(),
      sessionId: error.sessionId || this.getSessionId(),
      additionalData: error.additionalData,
    };

    // Log to console in development
    if (this.config.enableConsoleLog) {
      console.error('Error logged:', errorEntry);
    }

    // Add to queue
    this.errorQueue.push(errorEntry);

    // Save to localStorage if enabled
    if (this.config.enableLocalStorage) {
      this.saveQueuedErrors();
    }

    // Flush immediately if queue is full
    if (this.errorQueue.length >= this.config.batchSize) {
      this.flush();
    }
  }

  public logApiError(error: any, url: string, method: string): void {
    this.logError({
      type: 'api_error',
      message: error.message || 'API request failed',
      additionalData: {
        url,
        method,
        status: error.status,
        code: error.code,
        details: error.details,
      },
    });
  }

  public logNetworkError(error: any, url: string): void {
    this.logError({
      type: 'network_error',
      message: error.message || 'Network request failed',
      additionalData: {
        url,
        networkError: true,
      },
    });
  }

  public logValidationError(errors: any, context: string): void {
    this.logError({
      type: 'validation_error',
      message: 'Validation failed',
      additionalData: {
        context,
        validationErrors: errors,
      },
    });
  }

  private async flush(): Promise<void> {
    if (this.errorQueue.length === 0) return;

    const errorsToSend = this.errorQueue.splice(0, this.config.batchSize);
    
    try {
      const response = await fetch(this.config.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          errors: errorsToSend,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Clear retry counts for successful sends
      errorsToSend.forEach(error => {
        this.retryCount.delete(error.id);
      });

      // Update localStorage
      if (this.config.enableLocalStorage) {
        this.saveQueuedErrors();
      }
    } catch (error) {
      // Re-queue errors for retry
      errorsToSend.forEach(errorEntry => {
        const retries = this.retryCount.get(errorEntry.id) || 0;
        if (retries < this.config.maxRetries) {
          this.errorQueue.unshift(errorEntry);
          this.retryCount.set(errorEntry.id, retries + 1);
        } else {
          // Max retries reached, log to console and discard
          console.error('Failed to send error after max retries:', errorEntry);
          this.retryCount.delete(errorEntry.id);
        }
      });

      // Schedule retry
      setTimeout(() => {
        this.flush();
      }, this.config.retryDelay * Math.pow(2, Math.min(3, this.retryCount.size)));
    }
  }

  private startPeriodicFlush(): void {
    if (typeof window === 'undefined') return;

    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  private stopPeriodicFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private saveQueuedErrors(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem('error_queue', JSON.stringify(this.errorQueue));
    } catch (error) {
      console.error('Failed to save error queue to localStorage:', error);
    }
  }

  private loadQueuedErrors(): void {
    if (typeof window === 'undefined') return;

    try {
      const saved = localStorage.getItem('error_queue');
      if (saved) {
        this.errorQueue = JSON.parse(saved);
      }
    } catch (error) {
      console.error('Failed to load error queue from localStorage:', error);
      this.errorQueue = [];
    }
  }

  public getQueuedErrors(): ErrorLogEntry[] {
    return [...this.errorQueue];
  }

  public clearQueue(): void {
    this.errorQueue = [];
    this.retryCount.clear();
    
    if (this.config.enableLocalStorage && typeof window !== 'undefined') {
      localStorage.removeItem('error_queue');
    }
  }

  public destroy(): void {
    this.stopPeriodicFlush();
    this.flush(); // Final flush
    this.clearQueue();
  }
}

// Global error logger instance
let globalErrorLogger: ErrorLogger | null = null;

export function initializeErrorLogger(config?: Partial<ErrorReportingConfig>): ErrorLogger {
  if (globalErrorLogger) {
    globalErrorLogger.destroy();
  }
  
  globalErrorLogger = new ErrorLogger(config);
  return globalErrorLogger;
}

export function getErrorLogger(): ErrorLogger {
  if (!globalErrorLogger) {
    globalErrorLogger = new ErrorLogger();
  }
  return globalErrorLogger;
}

// Convenience functions
export function logError(error: Partial<ErrorLogEntry>): void {
  getErrorLogger().logError(error);
}

export function logApiError(error: any, url: string, method: string): void {
  getErrorLogger().logApiError(error, url, method);
}

export function logNetworkError(error: any, url: string): void {
  getErrorLogger().logNetworkError(error, url);
}

export function logValidationError(errors: any, context: string): void {
  getErrorLogger().logValidationError(errors, context);
}