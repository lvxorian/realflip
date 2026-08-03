-- target_roi: integer → real (decimal ROI precision, slider step 0.1)
ALTER TABLE "calculator_presets" ALTER COLUMN "target_roi" SET DATA TYPE real;
ALTER TABLE "calculator_presets" ALTER COLUMN "target_roi" SET DEFAULT 15;
