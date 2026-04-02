export class AzdError extends Error {
  constructor(message: string, public exitCode: number = 1) {
    super(message);
    this.name = 'AzdError';
  }
}

export class AuthError extends AzdError {
  constructor(message = 'Not authenticated. Run: ado auth login') {
    super(message, 1);
    this.name = 'AuthError';
  }
}

export class NotFoundError extends AzdError {
  constructor(resource: string, id: string | number) {
    super(`${resource} #${id} not found`, 1);
    this.name = 'NotFoundError';
  }
}

export class ConfigError extends AzdError {
  constructor(message: string) {
    super(message, 1);
    this.name = 'ConfigError';
  }
}

export function handleApiError(err: unknown, resource?: string): never {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    const status = (err as { statusCode: number }).statusCode;
    if (status === 401 || status === 203) {
      throw new AuthError('Token expired or invalid. Run: ado auth login');
    }
    if (status === 403) {
      throw new AzdError('Insufficient permissions for this operation');
    }
    if (status === 404) {
      throw new AzdError(resource ? `${resource} not found` : 'Resource not found');
    }
    if (status === 429) {
      const retryAfter = (err as Record<string, unknown>).retryAfter ?? '60';
      throw new AzdError(`Rate limited. Retry after ${retryAfter}s`);
    }
  }
  throw err instanceof Error ? err : new AzdError(String(err));
}

export function handleUnknownCommand(this: import('commander').Command): void {
  const args = this.args;
  process.stderr.write(
    `azd: '${args.join(' ')}' is not a valid command.\nSee 'ado --help' for available commands.\n`
  );
  process.exit(1);
}
