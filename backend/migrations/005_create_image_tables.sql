-- Image Semantic Search: separate tables from video/document tables.

-- Images: one row per uploaded image
CREATE TABLE IF NOT EXISTS images (
    id BIGSERIAL PRIMARY KEY,
    image_id TEXT UNIQUE NOT NULL,
    original_filename TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    file_size_bytes BIGINT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_images_image_id ON images(image_id);
CREATE INDEX IF NOT EXISTS idx_images_status ON images(status);

-- Vector embeddings for images (dimension must match IMAGE_EMBEDDING_DIM, e.g. 512 for CLIP)
CREATE TABLE IF NOT EXISTS image_embeddings (
    id BIGSERIAL PRIMARY KEY,
    image_id TEXT NOT NULL,
    embedding vector(512),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_image_embeddings_image FOREIGN KEY (image_id) REFERENCES images(image_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_image_embeddings_image_id ON image_embeddings(image_id);
CREATE INDEX IF NOT EXISTS idx_image_embeddings_hnsw ON image_embeddings
    USING hnsw (embedding vector_cosine_ops);

-- RPC for similarity search over images
CREATE OR REPLACE FUNCTION match_images(
    query_embedding vector(512),
    match_threshold float DEFAULT 0.0,
    match_count int DEFAULT 10
)
RETURNS TABLE (
    image_id text,
    stored_path text,
    similarity float
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        ie.image_id,
        img.stored_path,
        1 - (ie.embedding <=> query_embedding) AS similarity
    FROM image_embeddings ie
    JOIN images img ON img.image_id = ie.image_id
    WHERE 1 - (ie.embedding <=> query_embedding) > match_threshold
    ORDER BY ie.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
