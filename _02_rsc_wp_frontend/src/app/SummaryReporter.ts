import type { TestResult }
from "../core/types/TTestResult";

export class SummaryReporter {

  print(
    results: TestResult[]
  ): void {

    const passed =
      results.filter(
        r => r.success
      ).length;

    const failed =
      results.filter(
        r => !r.success
      ).length;

    console.log(`
==================================================
📊 RESUMEN FINAL
==================================================

✅ APROBADAS: ${passed}

❌ FALLIDAS: ${failed}

🧪 TOTAL: ${results.length}

==================================================
`);

  }

}