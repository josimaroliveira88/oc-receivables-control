-- Adds DOTERRA to the PaymentType enum so orders paid/covered by dōTERRA with a
-- zero total can be recorded. Existing rows are unaffected.
ALTER TYPE "PaymentType" ADD VALUE 'DOTERRA';