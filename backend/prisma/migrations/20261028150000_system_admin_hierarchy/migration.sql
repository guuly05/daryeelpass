CREATE TYPE "UserRole_new" AS ENUM ('PATIENT', 'STAFF', 'CLINIC_ADMIN', 'SYSTEM_ADMIN');

ALTER TABLE "users" DROP CONSTRAINT "users_staff_requires_clinic_check";
ALTER TABLE "users" DROP CONSTRAINT "users_patient_has_no_clinic_check";
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole_new"
  USING (CASE "role"::text WHEN 'ADMIN' THEN 'SYSTEM_ADMIN' ELSE "role"::text END)::"UserRole_new";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'PATIENT'::"UserRole_new";
ALTER TABLE "staff_invites" ADD COLUMN "role" "UserRole_new" NOT NULL DEFAULT 'STAFF';
DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";

ALTER TABLE "users" ADD CONSTRAINT "users_staff_requires_clinic_check"
  CHECK ("role" NOT IN ('STAFF', 'CLINIC_ADMIN') OR "clinic_id" IS NOT NULL);
ALTER TABLE "users" ADD CONSTRAINT "users_patient_has_no_clinic_check"
  CHECK ("role" NOT IN ('PATIENT', 'SYSTEM_ADMIN') OR "clinic_id" IS NULL);

CREATE TABLE "system_setup_state" (
  "id" TEXT NOT NULL DEFAULT 'singleton',
  "system_admin_id" TEXT NOT NULL,
  "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "system_setup_state_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "system_setup_state_singleton_check" CHECK ("id" = 'singleton'),
  CONSTRAINT "system_setup_state_single_admin_key" UNIQUE ("system_admin_id"),
  CONSTRAINT "system_setup_state_system_admin_id_fkey" FOREIGN KEY ("system_admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "system_setup_state" ("id", "system_admin_id")
SELECT 'singleton', "id" FROM "users" WHERE "role" = 'SYSTEM_ADMIN' ORDER BY "created_at" LIMIT 1;
ALTER TABLE "system_setup_state" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "system_setup_state" FORCE ROW LEVEL SECURITY;
CREATE POLICY "system_setup_state_auth_flow" ON "system_setup_state" FOR ALL
  USING (current_setting('app.auth_flow', true) = 'true')
  WITH CHECK (current_setting('app.auth_flow', true) = 'true');

DROP POLICY "users_staff_request_read" ON "users";
CREATE POLICY "users_staff_request_read" ON "users" FOR SELECT
  USING (
    current_setting('app.user_role', true) = 'SYSTEM_ADMIN' OR
    (current_setting('app.user_role', true) IN ('STAFF', 'CLINIC_ADMIN') AND EXISTS (
      SELECT 1 FROM "booking_requests" r WHERE r.user_id = "users"."id" AND r.clinic_id = nullif(current_setting('app.clinic_id', true), '')
    ))
  );
CREATE POLICY "users_system_admin_manage" ON "users" FOR UPDATE
  USING (current_setting('app.user_role', true) = 'SYSTEM_ADMIN')
  WITH CHECK (current_setting('app.user_role', true) = 'SYSTEM_ADMIN');

DROP POLICY "invites_admin_or_signup" ON "staff_invites";
CREATE POLICY "invites_admin_or_signup" ON "staff_invites" FOR ALL
  USING (
    current_setting('app.auth_flow', true) = 'true' OR
    current_setting('app.user_role', true) = 'SYSTEM_ADMIN' OR
    (current_setting('app.user_role', true) = 'CLINIC_ADMIN' AND clinic_id = nullif(current_setting('app.clinic_id', true), ''))
  )
  WITH CHECK (
    current_setting('app.auth_flow', true) = 'true' OR
    current_setting('app.user_role', true) = 'SYSTEM_ADMIN' OR
    (current_setting('app.user_role', true) = 'CLINIC_ADMIN' AND
      clinic_id = nullif(current_setting('app.clinic_id', true), '') AND role = 'STAFF')
  );

CREATE POLICY "sessions_system_admin_manage" ON "login_sessions" FOR ALL
  USING (current_setting('app.user_role', true) = 'SYSTEM_ADMIN')
  WITH CHECK (current_setting('app.user_role', true) = 'SYSTEM_ADMIN');

DROP POLICY "booking_request_read" ON "booking_requests";
CREATE POLICY "booking_request_read" ON "booking_requests" FOR SELECT
  USING (
    user_id = nullif(current_setting('app.user_id', true), '') OR
    current_setting('app.user_role', true) = 'SYSTEM_ADMIN' OR
    (current_setting('app.user_role', true) IN ('STAFF', 'CLINIC_ADMIN') AND clinic_id = nullif(current_setting('app.clinic_id', true), ''))
  );
DROP POLICY "booking_request_update" ON "booking_requests";
CREATE POLICY "booking_request_update" ON "booking_requests" FOR UPDATE
  USING (
    user_id = nullif(current_setting('app.user_id', true), '') OR
    current_setting('app.user_role', true) = 'SYSTEM_ADMIN' OR
    (current_setting('app.user_role', true) IN ('STAFF', 'CLINIC_ADMIN') AND clinic_id = nullif(current_setting('app.clinic_id', true), ''))
  )
  WITH CHECK (
    user_id = nullif(current_setting('app.user_id', true), '') OR
    current_setting('app.user_role', true) = 'SYSTEM_ADMIN' OR
    (current_setting('app.user_role', true) IN ('STAFF', 'CLINIC_ADMIN') AND clinic_id = nullif(current_setting('app.clinic_id', true), ''))
  );
DROP POLICY "booking_request_delete" ON "booking_requests";
CREATE POLICY "booking_request_delete" ON "booking_requests" FOR DELETE
  USING (user_id = nullif(current_setting('app.user_id', true), '') OR current_setting('app.user_role', true) = 'SYSTEM_ADMIN');

DROP POLICY "slots_staff_manage" ON "appointment_slots";
CREATE POLICY "slots_staff_manage" ON "appointment_slots" FOR ALL
  USING (current_setting('app.user_role', true) IN ('STAFF', 'CLINIC_ADMIN', 'SYSTEM_ADMIN') AND EXISTS (
    SELECT 1 FROM "services" s WHERE s.id = service_id AND
      (current_setting('app.user_role', true) = 'SYSTEM_ADMIN' OR s.clinic_id = nullif(current_setting('app.clinic_id', true), ''))
  ))
  WITH CHECK (current_setting('app.user_role', true) IN ('STAFF', 'CLINIC_ADMIN', 'SYSTEM_ADMIN') AND EXISTS (
    SELECT 1 FROM "services" s WHERE s.id = service_id AND
      (current_setting('app.user_role', true) = 'SYSTEM_ADMIN' OR s.clinic_id = nullif(current_setting('app.clinic_id', true), ''))
  ));
