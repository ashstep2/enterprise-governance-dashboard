export interface TaskEntry {
    content?: string;
    status?: string;
    activeForm?: string;
    id?: string;
    type?: string;
    message?: string;
    timestamp?: string;
    model?: string;
    cost?: number;
    tokens?: {
        input?: number;
        output?: number;
    };
    [key: string]: unknown;
}
export interface TaskFile {
    filename: string;
    entries: TaskEntry[];
    raw: unknown;
}
export interface AggregatedData {
    totalFiles: number;
    totalEntries: number;
    statusCounts: Record<string, number>;
    typeCounts: Record<string, number>;
    modelCounts: Record<string, number>;
    totalTokensInput: number;
    totalTokensOutput: number;
    estimatedCost: number;
    taskFiles: TaskFile[];
    patterns: {
        key: string;
        count: number;
    }[];
    recentTasks: TaskEntry[];
}
export declare function collectTasks(customDir?: string): Promise<AggregatedData>;
