// Both values come from `terraform output` and Vite inlines them into the
// bundle at build time. Neither is a secret — a public SPA app client has no
// client secret and anyone can read these out of the shipped JavaScript. They
// live in .env because they differ per stack, not to protect them.
export const cognitoConfig = {
  userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
  clientId: import.meta.env.VITE_COGNITO_CLIENT_ID || '',
};
