#!/usr/bin/env python3
"""Cria índice twin-integrated no Pinecone se não existir."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.pinecone_client import ensure_index_exists

if __name__ == "__main__":
    print(ensure_index_exists())
