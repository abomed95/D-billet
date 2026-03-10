"""
D-Billet API - Main entry point
This file imports from the new modular structure
"""
from main import app

# Re-export app for uvicorn
__all__ = ['app']
