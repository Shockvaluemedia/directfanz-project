-- CreateTable
CREATE TABLE "oauth_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,

    CONSTRAINT "oauth_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "oauth_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "oauth_tokens_userId_provider_key" ON "oauth_tokens"("userId", "provider");

-- Clean up existing insecure token storage in accounts table
-- This removes the sensitive tokens from the accounts table as they'll now be stored encrypted
UPDATE "accounts" SET 
    "access_token" = NULL,
    "refresh_token" = NULL
WHERE "access_token" IS NOT NULL OR "refresh_token" IS NOT NULL;
