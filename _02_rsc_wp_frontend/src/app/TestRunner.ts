import type { ITest }
from "../users/interfaces/ITest";

import type { TestResult }
from "../core/types/TTestResult";

import { ConsolePrinter }
from "../core/console/ConsolePrinter";

export class TestRunner {

  private readonly results:
    TestResult[] = [];

  constructor(

    private readonly printer:
      ConsolePrinter

  ) {}

  async runTests(
    tests: ITest[]
  ): Promise<TestResult[]> {

    for (const test of tests) {

      const result =
        await test.run();

      this.results.push(result);

      if (result.success) {

        this.printer.printSuccess(
          result.name
        );

      } else {

        this.printer.printError(
          result.name
        );

      }

    }

    return this.results;

  }

}