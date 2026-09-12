export interface FSResult<T = string> {
  err: number;
  data: T;
}
export interface CEPFileSystem {
  readFile(path: string): FSResult;
  writeFile(path: string, data: string): FSResult;
  makedir(path: string): FSResult;
  stat(path: string): FSResult<{ isDirectory(): boolean; isFile(): boolean }>;
  showOpenDialogEx(
    multiple: boolean,
    directory: boolean,
    title: string,
    initial: string,
    types: string[],
  ): FSResult<string[]>;
  showSaveDialogEx(title: string, initial: string, types: string[], name: string): FSResult;
}
declare global {
  class CSInterface {
    evalScript(script: string, callback: (result: string) => void): void;
    getSystemPath(path: string): string;
    openURLInDefaultBrowser(url: string): number;
  }
  const SystemPath: { USER_DATA: string };
  interface Window {
    cep?: { fs: CEPFileSystem };
    __adobe_cep__?: { evalScript(script: string, callback: (result: string) => void): void };
  }
}
