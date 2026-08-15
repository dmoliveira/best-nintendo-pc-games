export interface PngInfo { width: number; height: number; }
export function parsePng(buffer: Buffer): PngInfo;
export function readPng(filePath: string, maximumBytes?: number): PngInfo;
