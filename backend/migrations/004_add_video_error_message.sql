-- Optional: store last error message when status = 'failed'
ALTER TABLE videos ADD COLUMN IF NOT EXISTS error_message TEXT;
