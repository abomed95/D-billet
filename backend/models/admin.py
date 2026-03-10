"""
Pydantic models for admin features
"""
from pydantic import BaseModel
from typing import Optional


class TestimonialCreate(BaseModel):
    author_name: str
    author_role: str
    content: str
    rating: int = 5
    avatar_url: Optional[str] = None


class NewsCreate(BaseModel):
    title: str
    excerpt: str
    content: str
    image_url: Optional[str] = None
