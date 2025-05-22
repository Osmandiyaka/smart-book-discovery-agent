import { environment } from "../config/environment";

export enum LogLevel {
    INFO = 'info',
    ERROR = 'error',
    DEBUG = 'debug',
    WARN = 'warn',
}


export class Logger {
    static log(level: LogLevel, message: string, meta?: any): void {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            ...(meta && { meta }),
        };
        console.log(JSON.stringify(logEntry));
    }

    static info(message: string, meta?: any): void {
        this.log(LogLevel.INFO, message, meta);
    }

    static error(message: string, meta?: any): void {
        this.log(LogLevel.ERROR, message, meta);
    }

    static debug(message: string, meta?: any): void {
        if (environment.nodeEnv === 'development') {
            this.log(LogLevel.DEBUG, message, meta);
        }
    }

    static warn(message: string, meta?: any): void {
        this.log(LogLevel.WARN, message, meta);
    }
}