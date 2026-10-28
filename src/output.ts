export function printJson(data: unknown): void {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

export function fail(message: string, extra?: Record<string, unknown>): never {
  printJson({ ok: false, error: message, ...extra });
  process.exit(1);
}

export function ok(data: Record<string, unknown> = {}): void {
  printJson({ ok: true, ...data });
}
