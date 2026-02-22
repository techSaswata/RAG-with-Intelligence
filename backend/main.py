"""Main entry point for ClearPath RAG Chatbot API."""
import logging
import time
import tempfile
import os
import shutil
import tiktoken
from typing import List
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from config import PORT, CORS_ORIGINS
from models.api import QueryRequest, QueryResponse, ResponseMetadata, TokenUsage, Source, UploadResponse, UploadFileResult
from models.chunk import Chunk, ScoredChunk
from services.model_router import ModelRouter
from services.retrieval_engine import RetrievalEngine
from services.llm_client import LLMClient, LLMClientError
from services.output_evaluator import OutputEvaluator
from services.conversation_manager import ConversationManager
from services.routing_logger import RoutingLogger
from services.vector_store import VectorStore
from services.embedding_model import EmbeddingModel
from services.document_loader import DocumentLoader
from services.chunking_engine import ChunkingEngine

# Video semantic search (optional; isolated from document RAG)
try:
    from routers.video import router as video_router
    from routers.video import set_video_services
    from services.video import (
        VideoUploadHandler,
        VideoMetadataManager,
        VideoVectorStore,
        VideoSearchService,
        process_video_pipeline,
    )
    from services.video.video_embedding_engine import get_video_embedding_engine
    from config import (
        VIDEO_MODE,
        VIDEO_EMBEDDING_DIM,
        VIDEO_FRAME_INTERVAL_SEC,
        HUGGINGFACE_API_KEY,
        VIDEO_LOCAL_EMBEDDING_MODEL,
        VIDEO_SERVER_EMBEDDING_MODEL,
    )
    _VIDEO_AVAILABLE = True
except Exception as e:
    logging.getLogger(__name__).warning(f"Video semantic search not available: {e}")
    _VIDEO_AVAILABLE = False

# Initialize logging
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="ClearPath RAG Chatbot",
    description="Customer support chatbot for ClearPath project management tool",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,  # Load from environment variable
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if _VIDEO_AVAILABLE:
    app.include_router(video_router)

# Initialize services (will be done on startup)
model_router: ModelRouter = None
retrieval_engine: RetrievalEngine = None
llm_client: LLMClient = None
output_evaluator: OutputEvaluator = None
conversation_manager: ConversationManager = None
routing_logger: RoutingLogger = None
chunking_engine: ChunkingEngine = None
vector_store_instance: VectorStore = None
embedding_model_instance: EmbeddingModel = None
tiktoken_encoder = None


@app.on_event("startup")
async def startup_event():
    """Initialize services on startup."""
    global model_router, retrieval_engine, llm_client, output_evaluator
    global conversation_manager, routing_logger, tiktoken_encoder
    global chunking_engine, vector_store_instance, embedding_model_instance

    logger.info("Initializing ClearPath RAG Chatbot services...")

    try:
        # Initialize tiktoken encoder for Llama 3 token counting
        tiktoken_encoder = tiktoken.get_encoding("o200k_base")
        logger.info("Initialized tiktoken encoder (o200k_base)")

        # Initialize services
        model_router = ModelRouter()
        logger.info("Initialized ModelRouter")

        embedding_model_instance = EmbeddingModel()
        vector_store_instance = VectorStore(embedding_model_instance)
        retrieval_engine = RetrievalEngine(vector_store_instance, embedding_model_instance)
        logger.info("Initialized RetrievalEngine")

        chunking_engine = ChunkingEngine()
        logger.info("Initialized ChunkingEngine")
        
        llm_client = LLMClient()
        logger.info("Initialized LLMClient")
        
        output_evaluator = OutputEvaluator()
        logger.info("Initialized OutputEvaluator")
        
        conversation_manager = ConversationManager()
        logger.info("Initialized ConversationManager")
        
        routing_logger = RoutingLogger()
        logger.info("Initialized RoutingLogger")

        # Video semantic search (isolated from document RAG)
        if _VIDEO_AVAILABLE:
            try:
                video_upload_handler = VideoUploadHandler()
                video_metadata_manager = VideoMetadataManager()
                video_vector_store = VideoVectorStore()
                video_embedding_engine = get_video_embedding_engine(
                    VIDEO_MODE,
                    local_model=VIDEO_LOCAL_EMBEDDING_MODEL,
                    server_model=VIDEO_SERVER_EMBEDDING_MODEL,
                    api_key=HUGGINGFACE_API_KEY,
                    dimension=VIDEO_EMBEDDING_DIM,
                )
                video_search_service = VideoSearchService(video_embedding_engine, video_vector_store)

                def run_video_job(video_id: str):
                    process_video_pipeline(
                        video_id,
                        frame_interval_sec=VIDEO_FRAME_INTERVAL_SEC,
                        metadata_manager=video_metadata_manager,
                        embedding_engine=video_embedding_engine,
                        vector_store=video_vector_store,
                        get_stored_path_fn=video_upload_handler.get_stored_path,
                    )

                set_video_services(
                    upload_handler=video_upload_handler,
                    metadata_manager=video_metadata_manager,
                    vector_store=video_vector_store,
                    search_service=video_search_service,
                    base_url="",
                    process_video_callable=run_video_job,
                )
                logger.info("Video semantic search services initialized")
            except Exception as ve:
                logger.warning(f"Video services init failed (video endpoints may return 503): {ve}")

        logger.info("All services initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize services: {e}", exc_info=True)
        raise


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "message": "ClearPath RAG Chatbot API"}


@app.get("/health")
async def health():
    """Detailed health check."""
    return {
        "status": "healthy",
        "service": "clearpath-rag-chatbot",
        "version": "1.0.0"
    }
@app.get("/wake")
async def wake():
    """
    Lightweight wake-up endpoint for cold start detection.
    Returns immediately to signal the service is awake.
    """
    return {"status": "awake", "timestamp": time.time()}


@app.post("/query", response_model=QueryResponse)
async def query_endpoint(request: QueryRequest) -> QueryResponse:
    """
    Main query endpoint for the ClearPath RAG Chatbot.
    
    Processes user queries through the three-layer architecture:
    1. RAG Pipeline: Retrieves relevant document chunks
    2. Model Router: Classifies query and selects appropriate LLM
    3. Output Evaluator: Analyzes response quality
    
    Args:
        request: QueryRequest with question and optional conversation_id
        
    Returns:
        QueryResponse with answer, metadata, sources, and conversation_id
        
    Raises:
        HTTPException: For validation errors or API failures
    """
    start_time = time.time()
    
    try:
        # Step 1: Validate request
        if not request.question or not request.question.strip():
            raise HTTPException(status_code=400, detail="Question field is required and cannot be empty")
        
        logger.info(f"Processing query: {request.question[:100]}...")
        
        # Step 2: Get or create conversation
        conversation = conversation_manager.get_or_create_conversation(request.conversation_id)
        conversation_id = conversation.conversation_id
        
        # Step 3: Classify query using ModelRouter
        classification = model_router.classify_query(request.question)
        
        # Step 4: Retrieve relevant chunks (skip if OOD filter triggered)
        retrieved_chunks: List[ScoredChunk] = []
        if classification.skip_retrieval:
            logger.info("Skipping retrieval (OOD filter triggered)")
        else:
            retrieved_chunks = retrieval_engine.retrieve(request.question)
        
        chunks_retrieved = len(retrieved_chunks)
        logger.info(f"Retrieved {chunks_retrieved} chunks")
        
        # Step 5: Build prompt with context and conversation history
        conversation_history = conversation_manager.get_context(conversation_id, max_turns=3)
        
        # Extract chunk texts for prompt
        chunk_texts = [chunk.chunk.text for chunk in retrieved_chunks]
        
        prompt = LLMClient.build_prompt(
            query=request.question,
            retrieved_chunks=chunk_texts if chunk_texts else None,
            conversation_history=conversation_history if conversation_history else None
        )
        
        # Step 6: Count tokens using tiktoken (o200k_base for Llama 3)
        prompt_tokens = len(tiktoken_encoder.encode(prompt))
        
        # Step 7: Generate response using LLMClient
        llm_response = llm_client.generate(
            model=classification.model_name,
            prompt=prompt,
            max_tokens=500
        )
        
        # Step 8: Evaluate response using OutputEvaluator
        evaluator_flags = output_evaluator.evaluate(
            response=llm_response.text,
            chunks_retrieved=chunks_retrieved,
            sources=retrieved_chunks
        )
        
        # Step 9: Calculate complexity score for logging
        complexity_score = _calculate_complexity_score(request.question, classification)
        
        # Step 10: Log routing decision
        routing_logger.log_routing_decision(
            query=request.question,
            classification=classification.category,
            model_used=classification.model_name,
            tokens_input=llm_response.tokens_input,
            tokens_output=llm_response.tokens_output,
            latency_ms=llm_response.latency_ms,
            rule_triggered=classification.rule_triggered,
            complexity_score=complexity_score,
            chunks_retrieved=chunks_retrieved,
            evaluator_flags=evaluator_flags
        )
        
        # Step 11: Add turn to conversation history
        conversation_manager.add_turn(
            conversation_id=conversation_id,
            query=request.question,
            response=llm_response.text
        )
        
        # Step 12: Format sources
        sources = [
            Source(
                document=chunk.chunk.document_name,
                page=chunk.chunk.page_number,
                relevance_score=chunk.relevance_score
            )
            for chunk in retrieved_chunks
        ]
        
        # Step 13: Calculate total latency
        total_latency_ms = int((time.time() - start_time) * 1000)
        
        # Step 14: Build and return response
        response = QueryResponse(
            answer=llm_response.text,
            metadata=ResponseMetadata(
                model_used=classification.model_name,
                classification=classification.category,
                tokens=TokenUsage(
                    input=llm_response.tokens_input,
                    output=llm_response.tokens_output
                ),
                latency_ms=total_latency_ms,
                chunks_retrieved=chunks_retrieved,
                evaluator_flags=evaluator_flags
            ),
            sources=sources,
            conversation_id=conversation_id
        )
        
        logger.info(f"Query processed successfully in {total_latency_ms}ms")
        return response
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except LLMClientError as e:
        # Handle LLM client errors with structured error response
        logger.error(f"LLM client error: {e.error.message}")
        raise HTTPException(
            status_code=503,
            detail={
                "error": {
                    "code": e.error.code,
                    "message": e.error.message,
                    "details": e.error.details
                }
            }
        )
    except Exception as e:
        # Handle unexpected errors
        logger.error(f"Unexpected error processing query: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )


def _calculate_complexity_score(query: str, classification) -> dict:
    """
    Calculate complexity score metrics for logging.
    
    Args:
        query: User query string
        classification: Classification result from ModelRouter
        
    Returns:
        Dictionary with complexity metrics
    """
    word_count = len(query.split())
    question_mark_count = query.count('?')
    
    # Count complex keywords
    query_lower = query.lower()
    complex_keyword_count = sum(
        1 for keyword in ModelRouter.COMPLEX_KEYWORDS
        if keyword in query_lower
    )
    
    # Count comparison words
    comparison_word_count = sum(
        1 for word in ModelRouter.COMPARISON_WORDS
        if word in query_lower
    )
    
    return {
        "word_count": word_count,
        "complex_keyword_count": complex_keyword_count,
        "question_mark_count": question_mark_count,
        "comparison_word_count": comparison_word_count
    }
@app.post("/query/stream")
async def query_stream_endpoint(request: QueryRequest):
    """
    Streaming query endpoint for the ClearPath RAG Chatbot.

    Processes user queries and streams the response as Server-Sent Events (SSE).
    Sends tokens progressively as they are generated, followed by final metadata.

    Args:
        request: QueryRequest with question and optional conversation_id

    Returns:
        StreamingResponse with SSE format:
        - data: {type: "token", content: "..."} for each token
        - data: {type: "metadata", data: {...}} for final metadata

    Raises:
        HTTPException: For validation errors or API failures
    """
    async def generate_stream():
        """Generator function for streaming response."""
        start_time = time.time()

        try:
            # Step 1: Validate request
            if not request.question or not request.question.strip():
                yield f"data: {{'error': 'Question field is required and cannot be empty'}}\n\n".encode('utf-8')
                return

            logger.info(f"Processing streaming query: {request.question[:100]}...")

            # Step 2: Get or create conversation
            conversation = conversation_manager.get_or_create_conversation(request.conversation_id)
            conversation_id = conversation.conversation_id

            # Step 3: Classify query using ModelRouter
            classification = model_router.classify_query(request.question)

            # Step 4: Retrieve relevant chunks (skip if OOD filter triggered)
            retrieved_chunks: List[ScoredChunk] = []
            if classification.skip_retrieval:
                logger.info("Skipping retrieval (OOD filter triggered)")
            else:
                retrieved_chunks = retrieval_engine.retrieve(request.question)

            chunks_retrieved = len(retrieved_chunks)
            logger.info(f"Retrieved {chunks_retrieved} chunks")

            # Step 5: Build prompt with context and conversation history
            conversation_history = conversation_manager.get_context(conversation_id, max_turns=3)

            # Extract chunk texts for prompt
            chunk_texts = [chunk.chunk.text for chunk in retrieved_chunks]

            prompt = LLMClient.build_prompt(
                query=request.question,
                retrieved_chunks=chunk_texts if chunk_texts else None,
                conversation_history=conversation_history if conversation_history else None
            )

            # Step 6: Count tokens using tiktoken (o200k_base for Llama 3)
            prompt_tokens = len(tiktoken_encoder.encode(prompt))

            # Step 7: Stream response using LLMClient
            accumulated_text = ""
            llm_metadata = None

            for chunk in llm_client.generate_stream(
                model=classification.model_name,
                prompt=prompt,
                max_tokens=500
            ):
                if chunk["type"] == "token":
                    # Stream token to client
                    import json
                    accumulated_text += chunk["content"]
                    logger.debug(f"Streaming token: {repr(chunk['content'])}, length: {len(chunk['content'])}")
                    data = f"data: {json.dumps(chunk)}\n\n"
                    yield data.encode('utf-8')  # Encode to bytes for proper streaming
                elif chunk["type"] == "metadata":
                    # Store metadata for final processing
                    llm_metadata = chunk["data"]

            # Step 8: Evaluate response using OutputEvaluator
            evaluator_flags = output_evaluator.evaluate(
                response=accumulated_text,
                chunks_retrieved=chunks_retrieved,
                sources=retrieved_chunks
            )

            # Step 9: Calculate complexity score for logging
            complexity_score = _calculate_complexity_score(request.question, classification)

            # Step 10: Log routing decision
            routing_logger.log_routing_decision(
                query=request.question,
                classification=classification.category,
                model_used=classification.model_name,
                tokens_input=llm_metadata["tokens_input"],
                tokens_output=llm_metadata["tokens_output"],
                latency_ms=llm_metadata["latency_ms"],
                rule_triggered=classification.rule_triggered,
                complexity_score=complexity_score,
                chunks_retrieved=chunks_retrieved,
                evaluator_flags=evaluator_flags
            )

            # Step 11: Add turn to conversation history
            conversation_manager.add_turn(
                conversation_id=conversation_id,
                query=request.question,
                response=accumulated_text
            )

            # Step 12: Format sources
            sources = [
                {
                    "document": chunk.chunk.document_name,
                    "page": chunk.chunk.page_number,
                    "relevance_score": chunk.relevance_score
                }
                for chunk in retrieved_chunks
            ]

            # Step 13: Calculate total latency
            total_latency_ms = int((time.time() - start_time) * 1000)

            # Step 14: Send final metadata
            import json
            final_metadata = {
                "type": "metadata",
                "data": {
                    "metadata": {
                        "model_used": classification.model_name,
                        "classification": classification.category,
                        "tokens": {
                            "input": llm_metadata["tokens_input"],
                            "output": llm_metadata["tokens_output"]
                        },
                        "latency_ms": total_latency_ms,
                        "chunks_retrieved": chunks_retrieved,
                        "evaluator_flags": evaluator_flags
                    },
                    "sources": sources,
                    "conversation_id": conversation_id
                }
            }
            yield f"data: {json.dumps(final_metadata)}\n\n".encode('utf-8')

            logger.info(f"Streaming query processed successfully in {total_latency_ms}ms")

        except LLMClientError as e:
            # Handle LLM client errors
            import json
            logger.error(f"LLM client error during streaming: {e.error.message}")
            error_data = {
                "type": "error",
                "error": {
                    "code": e.error.code,
                    "message": e.error.message,
                    "details": e.error.details
                }
            }
            yield f"data: {json.dumps(error_data)}\n\n".encode('utf-8')
        except Exception as e:
            # Handle unexpected errors
            import json
            logger.error(f"Unexpected error during streaming: {e}", exc_info=True)
            error_data = {
                "type": "error",
                "error": {
                    "code": "UNKNOWN_ERROR",
                    "message": f"Internal server error: {str(e)}"
                }
            }
            yield f"data: {json.dumps(error_data)}\n\n".encode('utf-8')

    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable buffering in nginx
        }
    )



@app.post("/upload", response_model=UploadResponse)
async def upload_endpoint(files: List[UploadFile] = File(...)):
    """
    Upload PDF files and ingest them into the vector store.

    Processes each file through the full ingestion pipeline:
    1. PDF text extraction (PyMuPDF)
    2. Contextual header injection (font-size analysis)
    3. Token-aware chunking (300t / 50 overlap)
    4. Embedding generation (all-mpnet-base-v2, 768-d)
    5. Vector storage (Supabase pgvector)

    Args:
        files: One or more PDF files

    Returns:
        UploadResponse with per-file results and totals
    """
    start_time = time.time()
    results: List[UploadFileResult] = []
    total_chunks = 0
    total_pages = 0

    for upload_file in files:
        # Validate file type
        if not upload_file.filename or not upload_file.filename.lower().endswith('.pdf'):
            results.append(UploadFileResult(
                filename=upload_file.filename or "unknown",
                status="error",
                error="Only PDF files are accepted"
            ))
            continue

        # Validate file size (50MB limit)
        contents = await upload_file.read()
        if len(contents) > 50 * 1024 * 1024:
            results.append(UploadFileResult(
                filename=upload_file.filename,
                status="error",
                error="File exceeds 50MB limit"
            ))
            continue

        tmp_dir = None
        try:
            # Write to a temp directory using the original filename
            # so ChunkingEngine._extract_headers() can find it at {dir}/{filename}
            tmp_dir = tempfile.mkdtemp()
            tmp_path = os.path.join(tmp_dir, upload_file.filename)
            with open(tmp_path, "wb") as f:
                f.write(contents)

            # Step 1: Load PDF
            loader = DocumentLoader(docs_directory=tmp_dir)
            document = loader._load_pdf(tmp_path, upload_file.filename)
            if not document or not document.pages:
                results.append(UploadFileResult(
                    filename=upload_file.filename,
                    status="error",
                    error="Could not extract text from PDF"
                ))
                continue

            file_pages = len(document.pages)

            # Step 2-3: Chunk with contextual headers
            chunks = chunking_engine.chunk_documents([document], docs_directory=tmp_dir)

            if not chunks:
                results.append(UploadFileResult(
                    filename=upload_file.filename,
                    pages=file_pages,
                    status="error",
                    error="No chunks produced from document"
                ))
                continue

            file_chunks = len(chunks)

            # Step 4-5: Embed and store in batches
            batch_size = 10
            for i in range(0, len(chunks), batch_size):
                batch = chunks[i:i + batch_size]
                vector_store_instance.add_chunks(batch)

            total_chunks += file_chunks
            total_pages += file_pages

            results.append(UploadFileResult(
                filename=upload_file.filename,
                pages=file_pages,
                chunks=file_chunks,
                status="success"
            ))
            logger.info(f"Ingested {upload_file.filename}: {file_pages} pages, {file_chunks} chunks")

        except Exception as e:
            logger.error(f"Error processing {upload_file.filename}: {e}", exc_info=True)
            results.append(UploadFileResult(
                filename=upload_file.filename,
                status="error",
                error=str(e)
            ))
        finally:
            # Clean up temp directory
            if tmp_dir and os.path.exists(tmp_dir):
                try:
                    shutil.rmtree(tmp_dir)
                except OSError:
                    pass

    latency_ms = int((time.time() - start_time) * 1000)

    return UploadResponse(
        files=results,
        total_chunks=total_chunks,
        total_pages=total_pages,
        latency_ms=latency_ms
    )


if __name__ == "__main__":
    import uvicorn
    logger.info(f"Starting ClearPath RAG Chatbot API on port {PORT}")
    uvicorn.run(app, host="0.0.0.0", port=PORT)
