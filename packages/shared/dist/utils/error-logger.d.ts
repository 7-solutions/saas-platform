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
declare class ErrorLogger {
    private config;
    private errorQueue;
    private flushTimer;
    private retryCount;
    constructor(config?: Partial<ErrorReportingConfig>);
    private setupGlobalErrorHandlers;
    private generateId;
    private getCurrentUrl;
    private getUserAgent;
    private getSessionId;
    private getUserId;
    logError(error: Partial<ErrorLogEntry>): void;
    logApiError(error: any, url: string, method: string): void;
    logNetworkError(error: any, url: string): void;
    logValidationError(errors: any, context: string): void;
    private flush;
    private startPeriodicFlush;
    private stopPeriodicFlush;
    private saveQueuedErrors;
    private loadQueuedErrors;
    getQueuedErrors(): ErrorLogEntry[];
    clearQueue(): void;
    destroy(): void;
}
export declare function initializeErrorLogger(config?: Partial<ErrorReportingConfig>): ErrorLogger;
export declare function getErrorLogger(): ErrorLogger;
export declare function logError(error: Partial<ErrorLogEntry>): void;
export declare function logApiError(error: any, url: string, method: string): void;
export declare function logNetworkError(error: any, url: string): void;
export declare function logValidationError(errors: any, context: string): void;
export {};
//# sourceMappingURL=error-logger.d.ts.map