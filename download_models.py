#!/usr/bin/env python3
"""
Script to pre-download TangoFlux model and cache it.
This is run during Docker image build to avoid downloading on every container start.
"""
import os
from tangoflux import TangoFluxInference

def download_tango_model():
    """Download and cache the TangoFlux model."""
    print("Downloading TangoFlux model...")
    print(f"Cache directory: {os.getenv('HF_HOME', 'default')}")

    # Initialize the model - this will download and cache it
    model = TangoFluxInference(name="declare-lab/TangoFlux")
    print("✓ TangoFlux model downloaded and cached successfully!")

    # Force cleanup to free memory
    del model
    print("✓ Memory cleaned up")

if __name__ == "__main__":
    download_tango_model()
