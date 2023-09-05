export interface AsyncTask {
  index: number;
  task: (callback: any) => void;
}
