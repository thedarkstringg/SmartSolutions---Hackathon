"""
CyberClowns ML Phishing Detector
Pre-trained Random Forest classifier for enhanced phishing detection
"""

import pickle
import os
import numpy as np
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

MODEL_PATH = Path(__file__).parent / "models" / "phishing_detector.pkl"


class PhishingMLDetector:
    """Pre-trained ML model for phishing detection"""

    _instance = None
    _model = None

    @classmethod
    def get_instance(cls):
        """Singleton pattern for model loading"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self):
        self.model = None
        self.load_model()

    def load_model(self):
        """Load pre-trained model or use fallback"""
        try:
            if MODEL_PATH.exists():
                with open(MODEL_PATH, "rb") as f:
                    self.model = pickle.load(f)
                logger.info("✅ ML model loaded successfully")
            else:
                logger.warning("ML model not found. Using rule-based scoring only.")
                self._create_dummy_model()
        except Exception as e:
            logger.error(f"Failed to load ML model: {e}")
            self._create_dummy_model()

    def _create_dummy_model(self):
        """Create a dummy model for fallback"""
        self.model = None

    def predict(self, features: dict) -> float:
        """
        Predict phishing probability using ML model.

        Args:
            features: Dict with extracted URL and behavior features

        Returns:
            Probability score 0.0-1.0 (higher = more phishing)
        """
        if self.model is None:
            return self._fallback_predict(features)

        try:
            # Extract feature vector
            feature_vector = self._extract_features(features)

            # Get prediction
            prediction = self.model.predict_proba([feature_vector])[0]
            phishing_probability = prediction[1]  # Class 1 = phishing

            return float(phishing_probability)

        except Exception as e:
            logger.warning(f"ML prediction failed: {e}")
            return self._fallback_predict(features)

    def _extract_features(self, features: dict) -> list:
        """
        Extract feature vector from raw features dict.

        Expected features:
        - has_ip_address
        - url_length
        - num_subdomains
        - has_at_symbol
        - has_double_slash_redirect
        - has_hyphen_in_domain
        - num_special_chars
        - is_https
        - domain_length
        - suspicious_keywords (list)
        - has_hidden_fields
        - redirect_count
        - has_obfuscated_js
        - has_suspicious_cookies
        - external_resources_ratio

        Returns:
            List of 15 features
        """
        return [
            float(features.get("has_ip_address", 0)),
            float(features.get("url_length", 0)) / 100.0,  # Normalize
            float(features.get("num_subdomains", 0)),
            float(features.get("has_at_symbol", 0)),
            float(features.get("has_double_slash_redirect", 0)),
            float(features.get("has_hyphen_in_domain", 0)),
            float(features.get("num_special_chars", 0)),
            float(not features.get("is_https", True)),  # 1 if HTTP (risky)
            float(features.get("domain_length", 0)) / 50.0,  # Normalize
            len(features.get("suspicious_keywords", [])),
            float(features.get("has_hidden_fields", 0)),
            float(features.get("redirect_count", 0)) / 5.0,  # Normalize
            float(features.get("has_obfuscated_js", 0)),
            float(features.get("has_suspicious_cookies", 0)),
            float(features.get("external_resources_ratio", 0)),
        ]

    def _fallback_predict(self, features: dict) -> float:
        """Simple fallback scoring when model unavailable"""
        score = 0.0

        if features.get("has_ip_address"):
            score += 0.25
        if not features.get("is_https"):
            score += 0.15
        if features.get("has_suspicious_cookies"):
            score += 0.15
        if len(features.get("suspicious_keywords", [])) > 1:
            score += 0.15
        if features.get("has_obfuscated_js"):
            score += 0.15
        if features.get("redirect_count", 0) > 2:
            score += 0.10
        if features.get("external_resources_ratio", 0) > 0.7:
            score += 0.10

        return min(score, 1.0)
