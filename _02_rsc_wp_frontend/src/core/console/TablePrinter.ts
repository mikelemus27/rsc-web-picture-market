import type { TestResult }
from "../types/TTestResult";

export class TablePrinter {

  print(results: TestResult[]): void {

    console.table(

      results.map(result => ({

        TEST: result.name,

        STATUS: result.status,

        ESPERADO:
          result.expectedStatus,

        RESULTADO: result.success  ? "✅ OK"  : "❌ FAIL"
      // , DATA:result.response
        })));

  }

}