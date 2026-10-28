CREATE TYPE "UserRole" AS ENUM ('PATIENT', 'STAFF', 'ADMIN');
CREATE TYPE "BookingRequestStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DECLINED', 'CANCELLED');

ALTER TABLE "appointment_slots" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'staff';

CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'PATIENT',
  "clinic_id" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "users_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_clinic_id_role_active_idx" ON "users"("clinic_id", "role", "active");
ALTER TABLE "users" ADD CONSTRAINT "users_staff_requires_clinic_check" CHECK ("role" <> 'STAFF' OR "clinic_id" IS NOT NULL);
ALTER TABLE "users" ADD CONSTRAINT "users_patient_has_no_clinic_check" CHECK ("role" <> 'PATIENT' OR "clinic_id" IS NULL);

CREATE TABLE "login_sessions" (
  "id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "login_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "login_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "login_sessions_token_hash_key" ON "login_sessions"("token_hash");
CREATE INDEX "login_sessions_user_id_expires_at_idx" ON "login_sessions"("user_id", "expires_at");

CREATE TABLE "staff_invites" (
  "id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "clinic_id" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "staff_invites_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "staff_invites_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "staff_invites_token_hash_key" ON "staff_invites"("token_hash");
CREATE INDEX "staff_invites_email_expires_at_idx" ON "staff_invites"("email", "expires_at");

CREATE TABLE "booking_requests" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "clinic_id" TEXT NOT NULL,
  "service_id" TEXT NOT NULL,
  "starts_at" TIMESTAMP(3) NOT NULL,
  "phone" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'suggested',
  "status" "BookingRequestStatus" NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "booking_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "booking_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "booking_requests_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "booking_requests_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "booking_requests_user_id_status_starts_at_idx" ON "booking_requests"("user_id", "status", "starts_at");
CREATE INDEX "booking_requests_clinic_id_status_starts_at_idx" ON "booking_requests"("clinic_id", "status", "starts_at");

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
CREATE POLICY "users_auth_flow" ON "users" FOR ALL
  USING (current_setting('app.auth_flow', true) = 'true' OR id = nullif(current_setting('app.user_id', true), ''))
  WITH CHECK (current_setting('app.auth_flow', true) = 'true' OR id = nullif(current_setting('app.user_id', true), ''));
CREATE POLICY "users_staff_request_read" ON "users" FOR SELECT
  USING (
    current_setting('app.user_role', true) = 'ADMIN' OR
    (current_setting('app.user_role', true) = 'STAFF' AND EXISTS (
      SELECT 1 FROM "booking_requests" r WHERE r.user_id = "users"."id" AND r.clinic_id = nullif(current_setting('app.clinic_id', true), '')
    ))
  );

ALTER TABLE "login_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "login_sessions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "sessions_auth_flow" ON "login_sessions" FOR ALL
  USING (current_setting('app.auth_flow', true) = 'true' OR user_id = nullif(current_setting('app.user_id', true), ''))
  WITH CHECK (current_setting('app.auth_flow', true) = 'true' OR user_id = nullif(current_setting('app.user_id', true), ''));

ALTER TABLE "staff_invites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff_invites" FORCE ROW LEVEL SECURITY;
CREATE POLICY "invites_admin_or_signup" ON "staff_invites" FOR ALL
  USING (current_setting('app.auth_flow', true) = 'true' OR (current_setting('app.user_role', true) = 'ADMIN' AND current_setting('app.user_id', true) IS NOT NULL))
  WITH CHECK (current_setting('app.auth_flow', true) = 'true' OR (current_setting('app.user_role', true) = 'ADMIN' AND current_setting('app.user_id', true) IS NOT NULL));

ALTER TABLE "booking_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "booking_requests" FORCE ROW LEVEL SECURITY;
CREATE POLICY "booking_request_read" ON "booking_requests" FOR SELECT
  USING (
    user_id = nullif(current_setting('app.user_id', true), '') OR
    (current_setting('app.user_role', true) IN ('STAFF', 'ADMIN') AND
      (current_setting('app.user_role', true) = 'ADMIN' OR clinic_id = nullif(current_setting('app.clinic_id', true), '')))
  );
CREATE POLICY "booking_request_insert_own" ON "booking_requests" FOR INSERT
  WITH CHECK (user_id = nullif(current_setting('app.user_id', true), '') AND current_setting('app.user_role', true) = 'PATIENT');
CREATE POLICY "booking_request_update" ON "booking_requests" FOR UPDATE
  USING (user_id = nullif(current_setting('app.user_id', true), '') OR
    (current_setting('app.user_role', true) IN ('STAFF', 'ADMIN') AND
      (current_setting('app.user_role', true) = 'ADMIN' OR clinic_id = nullif(current_setting('app.clinic_id', true), ''))))
  WITH CHECK (user_id = nullif(current_setting('app.user_id', true), '') OR
    (current_setting('app.user_role', true) IN ('STAFF', 'ADMIN') AND
      (current_setting('app.user_role', true) = 'ADMIN' OR clinic_id = nullif(current_setting('app.clinic_id', true), ''))));
CREATE POLICY "booking_request_delete" ON "booking_requests" FOR DELETE
  USING (user_id = nullif(current_setting('app.user_id', true), '') OR current_setting('app.user_role', true) = 'ADMIN');

ALTER TABLE "appointment_slots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointment_slots" FORCE ROW LEVEL SECURITY;
CREATE POLICY "slots_public_read" ON "appointment_slots" FOR SELECT USING (active = true);
CREATE POLICY "slots_staff_manage" ON "appointment_slots" FOR ALL
  USING (current_setting('app.user_role', true) IN ('STAFF', 'ADMIN') AND EXISTS (
    SELECT 1 FROM "services" s WHERE s.id = service_id AND
      (current_setting('app.user_role', true) = 'ADMIN' OR s.clinic_id = nullif(current_setting('app.clinic_id', true), ''))
  ))
  WITH CHECK (current_setting('app.user_role', true) IN ('STAFF', 'ADMIN') AND EXISTS (
    SELECT 1 FROM "services" s WHERE s.id = service_id AND
      (current_setting('app.user_role', true) = 'ADMIN' OR s.clinic_id = nullif(current_setting('app.clinic_id', true), ''))
  ));

-- Remove the unused local eSignet and synthetic appointment/check-in tables.
DROP TABLE "check_in_tokens";
DROP TABLE "appointments";
DROP TABLE "identity_links";
DROP TABLE "patients";
DROP TABLE "staff_users";
DROP TABLE "audit_events";
DROP TYPE "AppointmentStatus";
