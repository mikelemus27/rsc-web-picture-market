import type { TTestResult } from "../../core/types/TTestResult";

export interface ITest {
  run(): Promise<TTestResult>;

}