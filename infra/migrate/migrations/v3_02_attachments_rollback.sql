-- V3-02 attachments: rollback. Drops the register only; objects already in
-- the S3 bucket are not touched (empty it with npm run attachments:deploy
-- -- --destroy if needed).

BEGIN;

DROP INDEX IF EXISTS idx_plan_attachments_plan;
DROP TABLE IF EXISTS plan_attachments;

COMMIT;