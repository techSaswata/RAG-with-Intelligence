"""Extract frames from video files. Saves frames as images and returns metadata."""
import logging
import os
import uuid
from pathlib import Path
from typing import List

from models.video import FrameMetadata

logger = logging.getLogger(__name__)


class FrameExtractor:
    """Extract frames at a configurable interval and save as images."""

    def __init__(self, frame_interval_sec: float = 1.0):
        self.frame_interval_sec = frame_interval_sec

    def extract_frames(
        self,
        video_path: str,
        output_dir: str,
        video_id: str,
    ) -> List[FrameMetadata]:
        """
        Extract frames from video at interval_sec and save under output_dir.
        Returns list of FrameMetadata (frame_id, video_id, timestamp_sec, frame_path).
        """
        try:
            import cv2
        except ImportError:
            raise RuntimeError(
                "opencv-python-headless is required for frame extraction. "
                "Install with: pip install opencv-python-headless"
            )

        path = Path(video_path)
        if not path.is_file():
            raise FileNotFoundError(f"Video file not found: {video_path}")

        os.makedirs(output_dir, exist_ok=True)
        cap = cv2.VideoCapture(str(path))
        if not cap.isOpened():
            raise RuntimeError(f"Could not open video: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        frame_interval_frames = max(1, int(fps * self.frame_interval_sec))
        frames_metadata: List[FrameMetadata] = []
        frame_index = 0
        saved_count = 0

        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                t_sec = frame_index / fps
                if frame_index % frame_interval_frames == 0:
                    frame_id = f"{video_id}_{uuid.uuid4().hex[:12]}"
                    ext = ".jpg"
                    frame_path = os.path.join(output_dir, f"{frame_id}{ext}")
                    cv2.imwrite(frame_path, frame)
                    frames_metadata.append(
                        FrameMetadata(
                            frame_id=frame_id,
                            video_id=video_id,
                            timestamp_sec=round(t_sec, 2),
                            frame_path=frame_path,
                            caption=None,
                        )
                    )
                    saved_count += 1
                frame_index += 1
        finally:
            cap.release()

        logger.info(f"Extracted {saved_count} frames from {video_path} (interval={self.frame_interval_sec}s)")
        return frames_metadata
