-- Scoped API tokens (Fase A): trusted first-party integrations such as the
-- Chrome extension import rides with `Authorization: Bearer cr_…` instead of
-- the session JWT. Only the SHA-256 hash is stored, so the cleartext is
-- unrecoverable from the database; `lastFour` lets the UI identify the token.
CREATE TABLE "ApiToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "scope" VARCHAR(40) NOT NULL DEFAULT 'uber:import',
    "tokenHash" TEXT NOT NULL,
    "lastFour" CHAR(4) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApiToken_tokenHash_key" ON "ApiToken"("tokenHash");

CREATE INDEX "ApiToken_userId_idx" ON "ApiToken"("userId");

ALTER TABLE "ApiToken" ADD CONSTRAINT "ApiToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
