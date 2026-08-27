import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} não configurado no .env`);
  return value;
}

export const env = {
  databaseUrl: required('DATABASE_URL'),
  keycloakIssuer: required('KEYCLOAK_ISSUER'),
  keycloakJwksUri: required('KEYCLOAK_JWKS_URI'),
  port: Number(process.env.PORT ?? 3333),
};
