-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "doterraId" VARCHAR(32),
ADD COLUMN     "registrationDate" DATE;

-- CreateIndex
-- Uniqueness is per user: a dōTERRA member number can only identify one local
-- client for a given user, but any number of clients may have a NULL id
-- (Postgres treats NULLs as distinct in a unique index).
CREATE UNIQUE INDEX "Person_userId_doterraId_key" ON "Person"("userId", "doterraId");
