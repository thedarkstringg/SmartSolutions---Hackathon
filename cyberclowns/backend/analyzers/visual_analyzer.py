import json
import base64
from pathlib import Path
from io import BytesIO
import imagehash
from PIL import Image
from urllib.parse import urlparse
import logging

logger = logging.getLogger(__name__)

DATA_PATH = Path(__file__).parent.parent / "data" / "known_hashes.json"


def load_known_hashes() -> dict:
    """
    Load known site pHashes from JSON file.

    Returns:
        Dictionary mapping site names to imagehash.ImageHash objects.
        Returns empty dict if file doesn't exist (graceful degradation).
    """
    if not DATA_PATH.exists():
        logger.warning(
            f"Known hashes file not found at {DATA_PATH}. "
            f"Visual analysis will be limited. Run: python scripts/build_phash_db.py"
        )
        return {}

    try:
        with open(DATA_PATH, "r") as f:
            raw_hashes = json.load(f)

        # Convert hex strings back to ImageHash objects
        converted = {}
        for site, hash_str in raw_hashes.items():
            try:
                converted[site] = imagehash.ImageHash(imagehash.hex_to_hash(hash_str))
            except Exception as e:
                logger.warning(f"Failed to parse hash for {site}: {e}")
                continue

        return converted
    except Exception as e:
        logger.error(f"Failed to load known hashes: {e}")
        return {}


KNOWN_HASHES = load_known_hashes()


def extract_domain(url: str) -> str:
    """Extract domain from URL."""
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        # Remove 'www.' prefix if present
        if domain.startswith('www.'):
            domain = domain[4:]
        return domain
    except:
        return ""


async def analyze_visual(screenshot_base64: str, current_url: str = "") -> dict:
    """
    Analyze screenshot for visual similarity to known phishing targets.

    Args:
        screenshot_base64: Base64 encoded screenshot
        current_url: Current page URL for comparison

    Returns:
        Dictionary with score, matched_site, hash_distance, and verdict
    """
    try:
        # If no known hashes loaded, return neutral score
        if not KNOWN_HASHES:
            return {
                "score": 0.5,
                "matched_site": None,
                "hash_distance": -1,
                "verdict": "no_match"
            }

        # Decode base64 to PIL Image
        image_data = base64.b64decode(screenshot_base64)
        image = Image.open(BytesIO(image_data))

        # Compute perceptual hash
        current_hash = imagehash.phash(image)

        # Extract current domain
        current_domain = extract_domain(current_url)

        # Find closest match
        best_distance = float('inf')
        matched_site = None

        for site_name, known_hash in KNOWN_HASHES.items():
            distance = current_hash - known_hash

            if distance < best_distance:
                best_distance = distance
                matched_site = site_name

        # Determine verdict based on distance and domain match
        if best_distance == float('inf'):
            return {
                "score": 0.1,
                "matched_site": None,
                "hash_distance": -1,
                "verdict": "no_match"
            }

        best_distance = int(best_distance)

        # Extract matched site's main domain
        matched_domain = matched_site.split('.')[0]
        current_domain_part = current_domain.split('.')[0]

        if best_distance < 10:
            # Very close match
            if matched_domain.lower() == current_domain_part.lower():
                # Same domain - legitimate visit to real site
                return {
                    "score": 0.05,
                    "matched_site": matched_site,
                    "hash_distance": best_distance,
                    "verdict": "legitimate"
                }
            else:
                # Different domain but looks like a known login - PHISHING!
                return {
                    "score": 0.95,
                    "matched_site": matched_site,
                    "hash_distance": best_distance,
                    "verdict": "clone_detected"
                }

        elif best_distance < 20:
            # Moderately similar - suspicious
            return {
                "score": 0.5,
                "matched_site": matched_site,
                "hash_distance": best_distance,
                "verdict": "suspicious"
            }

        else:
            # Not similar
            return {
                "score": 0.1,
                "matched_site": None,
                "hash_distance": best_distance,
                "verdict": "no_match"
            }

    except Exception as e:
        logger.error(f"Visual analysis error: {e}")
        return {
            "score": 0.5,
            "matched_site": None,
            "hash_distance": -1,
            "verdict": "error"
        }
