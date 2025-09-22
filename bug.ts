export const assertDefined: <T>(value: T | undefined | null, error?: string)
  => asserts value is T
  = <T>(value,  error?)  => {

  if (typeof value === 'number' || typeof value === 'boolean') {
    return;
  }

  if (!value) {
    throw new Error(error || 'Value is not defined');
  }
};