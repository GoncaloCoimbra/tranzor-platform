export function isStrongPassword(password: string): boolean {
  return /^(?=.{8,128}$)(?=.*[A-Z])(?=.*\d).+$/.test(password);
}
