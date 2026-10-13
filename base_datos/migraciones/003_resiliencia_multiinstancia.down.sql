ALTER TABLE app_attendance DROP INDEX uq_attendance_effective;
DROP TABLE IF EXISTS app_instance_heartbeats;
DROP TABLE IF EXISTS app_email_outbox;
DROP TABLE IF EXISTS app_idempotency;
DROP TABLE IF EXISTS app_qr_tokens;
DROP TABLE IF EXISTS app_sessions;
DROP TABLE IF EXISTS app_runtime_state;
DELETE FROM app_state WHERE state_key = 'data_revision';
