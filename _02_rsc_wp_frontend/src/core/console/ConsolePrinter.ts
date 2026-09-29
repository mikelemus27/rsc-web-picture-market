export class ConsolePrinter {

  printTitle(title: string): void {

    console.log(`
==================================================
${title}
==================================================
`);

  }
  printSuccess(message: string): void {
    console.log(`✅ ${message}`);
  }

  printError(message: string): void {
    console.log(`❌ ${message}`);
  }

  printInfo(message: string): void {
    console.log(`📌 ${message}`);
  }

  printData(customMessage:string,data: unknown): void 
  {
    console.log(`📊 ${customMessage}`, data);
  }

}