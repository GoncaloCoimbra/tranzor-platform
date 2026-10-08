export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret === 'replace-with-a-secure-random-secret') {
    throw new Error('JWT_SECRET must be configured with a non-default value');
  }

  return secret;
}
