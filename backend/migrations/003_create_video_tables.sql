-- Video Semantic Search: separate tables from document_chunks. Do not modify document_chunks.

-- Videos: one row per uploaded video
CREATE TABLE IF NOT EXISTS videos (
    id BIGSERIAL PRIMARY KEY,
    video_id TEXT UNIQUE NOT NULL,
    original_filename TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    file_size_bytes BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_videos_video_id ON videos(video_id);
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);

-- Frames: one row per extracted frame
CREATE TABLE IF NOT EXISTS video_frames (
    id BIGSERIAL PRIMARY KEY,
    frame_id TEXT UNIQUE NOT NULL,
    video_id TEXT NOT NULL,
    timestamp_sec NUMERIC(10,2) NOT NULL,
    frame_path TEXT NOT NULL,
    caption TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_video_frames_video FOREIGN KEY (video_id) REFERENCES videos(video_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_video_frames_video_id ON video_frames(video_id);

-- Vector embeddings for frames (dimension must match VIDEO_EMBEDDING_DIM, e.g. 512 for CLIP)
CREATE TABLE IF NOT EXISTS video_frame_embeddings (
    id BIGSERIAL PRIMARY KEY,
    frame_id TEXT NOT NULL,
    video_id TEXT NOT NULL,
    embedding vector(512),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_vfe_frame FOREIGN KEY (frame_id) REFERENCES video_frames(frame_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_video_frame_embeddings_video_id ON video_frame_embeddings(video_id);
CREATE INDEX IF NOT EXISTS idx_video_frame_embeddings_hnsw ON video_frame_embeddings
    USING hnsw (embedding vector_cosine_ops);

-- RPC for similarity search over video frames
CREATE OR REPLACE FUNCTION match_video_frames(
    query_embedding vector(512),
    match_threshold float DEFAULT 0.0,
    match_count int DEFAULT 10
)
RETURNS TABLE (
    frame_id text,
    video_id text,
    timestamp_sec numeric,
    frame_path text,
    similarity float
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        vfe.frame_id,
        vfe.video_id,
        vf.timestamp_sec,
        vf.frame_path,
        1 - (vfe.embedding <=> query_embedding) AS similarity
    FROM video_frame_embeddings vfe
    JOIN video_frames vf ON vf.frame_id = vfe.frame_id
    WHERE 1 - (vfe.embedding <=> query_embedding) > match_threshold
    ORDER BY vfe.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
