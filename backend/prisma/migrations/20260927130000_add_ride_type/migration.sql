-- Classify Uber rides as passenger rides or deliveries so the optimistic
-- matching / review can distinguish them. `UNKNOWN` is the default for rides
-- already imported (and for the featured activity, whose image is a route map).
CREATE TYPE "RideType" AS ENUM ('RIDE', 'DELIVERY', 'UNKNOWN');

ALTER TABLE "RideRecord" ADD COLUMN "rideType" "RideType" NOT NULL DEFAULT 'UNKNOWN';
