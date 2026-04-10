#!/usr/bin/env python3
"""
Build pre-trained ML model for phishing detection
Uses simulated phishing/safe domain data
"""

import pickle
from pathlib import Path
from sklearn.ensemble import RandomForestClassifier
import numpy as np

# Create models directory
MODEL_DIR = Path(__file__).parent / "models"
MODEL_DIR.mkdir(exist_ok=True)

# Simulated training data (phishing vs legitimate features)
# Features: [has_ip, url_len_norm, subdomains, has_at, has_redirect, has_hyphen, special_chars,
#            not_https, domain_len_norm, suspicious_keywords, has_hidden, redirects_norm,
#            has_obfuscated_js, has_sus_cookies, external_ratio]

phishing_samples = [
    [1, 0.8, 1, 0, 1, 1, 3, 1, 0.4, 2, 1, 0.5, 1, 1, 0.8],  # IP + HTTP + many red flags
    [0, 0.9, 2, 0, 1, 0, 2, 1, 0.3, 3, 1, 0.4, 1, 0, 0.7],  # Long URL + keywords + obfuscated
    [0, 0.6, 1, 0, 0, 1, 1, 1, 0.25, 2, 1, 0.2, 0, 1, 0.5],  # HTTP + suspicious cookies
    [1, 0.7, 0, 1, 0, 0, 2, 0, 0.2, 1, 0, 0, 0, 0, 0.3],    # IP + @ symbol
    [0, 0.8, 3, 0, 1, 0, 4, 1, 0.6, 2, 1, 0.6, 1, 1, 0.9],  # Multiple redirects + obfuscated
    [0, 0.7, 2, 0, 0, 1, 3, 1, 0.35, 2, 1, 0.3, 1, 0, 0.6],  # Many hyphens + keywords
]

safe_samples = [
    [0, 0.2, 2, 0, 0, 0, 0, 0, 0.15, 0, 0, 0, 0, 0, 0.1],    # HTTPS, normal domain
    [0, 0.3, 1, 0, 0, 0, 0, 0, 0.12, 0, 0, 0, 0, 0, 0.05],   # Simple domain
    [0, 0.25, 2, 0, 0, 0, 0, 0, 0.18, 0, 0, 0, 0, 0, 0.15],  # HTTPS + minimal external
    [0, 0.4, 3, 0, 0, 0, 1, 0, 0.25, 0, 0, 0, 0, 0, 0.2],    # HTTPS + more subdomains
    [0, 0.2, 1, 0, 0, 0, 0, 0, 0.1, 0, 0, 0, 0, 0, 0.08],    # Very clean
    [0, 0.35, 2, 0, 0, 0, 0, 0, 0.2, 0, 0, 0, 0, 0, 0.12],   # HTTPS + standard
]

# Combine and create labels
X = np.array(phishing_samples + safe_samples)
y = np.array([1] * len(phishing_samples) + [0] * len(safe_samples))

# Train Random Forest
print("🤖 Training Random Forest classifier...")
model = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)
model.fit(X, y)

# Save model
model_path = MODEL_DIR / "phishing_detector.pkl"
with open(model_path, "wb") as f:
    pickle.dump(model, f)

print(f"✅ Model trained and saved to {model_path}")

# Test the model
print("\n📊 Model Performance:")
train_score = model.score(X, y)
print(f"   Training accuracy: {train_score:.2%}")

# Test on sample phishing URL
test_phishing = np.array([[1, 0.8, 1, 0, 1, 1, 3, 1, 0.4, 2, 1, 0.5, 1, 1, 0.8]])
phishing_prob = model.predict_proba(test_phishing)[0]
print(f"   Sample phishing URL: {phishing_prob[1]:.2%} probability")

# Test on sample safe URL
test_safe = np.array([[0, 0.2, 2, 0, 0, 0, 0, 0, 0.15, 0, 0, 0, 0, 0, 0.1]])
safe_prob = model.predict_proba(test_safe)[0]
print(f"   Sample safe URL: {safe_prob[1]:.2%} probability")

print("\n✅ ML model ready for inference!")
