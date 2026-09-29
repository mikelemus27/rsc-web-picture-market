export type TTestResult = {
  name: string;
  success: boolean;
  status: number;
  expectedStatus: number;
  response: unknown;
};

export type TestResult = TTestResult;