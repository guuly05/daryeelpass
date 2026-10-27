ALTER TABLE "clinics"
  ADD COLUMN "public_name" TEXT,
  ADD COLUMN "public_address" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "email" TEXT,
  ADD COLUMN "website_url" TEXT,
  ADD COLUMN "appointment_url" TEXT,
  ADD COLUMN "source_url" TEXT,
  ADD COLUMN "verified_at" TIMESTAMP(3);

CREATE TABLE "clinic_providers" (
  "id" TEXT NOT NULL,
  "clinic_id" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "specialty" TEXT NOT NULL,
  "profile_url" TEXT,
  "source_url" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "clinic_providers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "clinic_providers_clinic_id_display_name_specialty_key"
  ON "clinic_providers"("clinic_id", "display_name", "specialty");
CREATE INDEX "clinic_providers_clinic_id_active_idx"
  ON "clinic_providers"("clinic_id", "active");
ALTER TABLE "clinic_providers"
  ADD CONSTRAINT "clinic_providers_clinic_id_fkey"
  FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
