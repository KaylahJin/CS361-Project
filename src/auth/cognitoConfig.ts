// Build-time Cognito wiring. Both values come from `terraform output`
// (see docs/cognito-setup.md) and are inlined into the bundle by Vite, the
// same way VITE_API_URL already is in src/data/companyApi.ts.
//
// Neither is a secret: a public SPA App Client has no client secret, and
// anyone can read both out of the shipped JavaScript. They live in .env
// because they differ per stack, not because they need protecting.
export const cognitoConfig = {
  userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
  clientId: import.meta.env.VITE_COGNITO_CLIENT_ID || '',
};
