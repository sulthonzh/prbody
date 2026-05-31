export interface FileChange {
    file: string;
    status: 'added' | 'modified' | 'deleted' | 'renamed';
    additions: number;
    deletions: number;
    oldFile?: string;
}
export interface CommitInfo {
    hash: string;
    subject: string;
    author: string;
    date: string;
}
export interface PRDescription {
    title: string;
    summary: string;
    changes: FileChange[];
    commits: CommitInfo[];
    totalAdditions: number;
    totalDeletions: number;
    filesChanged: number;
    base: string;
    head: string;
}
export interface GenerateOptions {
    base?: string;
    head?: string;
    cwd?: string;
    maxFiles?: number;
    maxCommits?: number;
}
export declare function generate(options?: GenerateOptions): Promise<PRDescription>;
export declare function formatMarkdown(pr: PRDescription, options?: {
    stats?: boolean;
}): string;
export declare function formatJson(pr: PRDescription): string;
export declare function formatText(pr: PRDescription): string;
