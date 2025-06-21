"""
GitHub OAuth authentication handler for admin panel access.
"""

import secrets
import logging
from typing import Optional, Dict, Any
from authlib.integrations.httpx_client import AsyncOAuth2Client
from fastapi import HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from .config import get_settings
from . import crud

logger = logging.getLogger(__name__)


class GitHubUser(BaseModel):
    id: int
    login: str
    name: Optional[str]
    email: Optional[str]
    avatar_url: str


class GitHubOAuth:
    def __init__(self):
        self.settings = get_settings()
        self.client_id = self.settings.github_client_id
        self.client_secret = self.settings.github_client_secret
        self.redirect_uri = self.settings.oauth_redirect_uri
        self.authorization_url = "https://github.com/login/oauth/authorize"
        self.token_url = "https://github.com/login/oauth/access_token"
        self.user_info_url = "https://api.github.com/user"
        
    def generate_authorization_url(self) -> tuple[str, str]:
        """Generate GitHub OAuth authorization URL and state."""
        state = secrets.token_urlsafe(32)
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "scope": "read:user user:email",  # basic user info only
            "state": state,
        }
        
        url_parts = [f"{k}={v}" for k, v in params.items()]
        auth_url = f"{self.authorization_url}?{'&'.join(url_parts)}"
        
        return auth_url, state
    
    async def exchange_code_for_token(self, code: str, state: str) -> str:
        """Exchange authorization code for access token."""
        async with AsyncOAuth2Client(
            client_id=self.client_id,
            client_secret=self.client_secret,
        ) as client:
            try:
                token_response = await client.fetch_token(
                    self.token_url,
                    code=code,
                    redirect_uri=self.redirect_uri,
                )
                return token_response["access_token"]
            except Exception as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to exchange code for token: {str(e)}"
                )
    
    async def get_user_info(self, access_token: str) -> GitHubUser:
        """Get user information from GitHub API."""
        async with AsyncOAuth2Client(token={"access_token": access_token}) as client:
            try:
                response = await client.get(self.user_info_url)
                response.raise_for_status()
                user_data = response.json()
                
                return GitHubUser(
                    id=user_data["id"],
                    login=user_data["login"],
                    name=user_data.get("name"),
                    email=user_data.get("email"),
                    avatar_url=user_data["avatar_url"],
                )
            except Exception as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to get user info: {str(e)}"
                )
    
    
    async def is_admin_user(self, username: str, db: AsyncSession = None) -> bool:
        """Check if the user is an admin based on username database."""
        logger.info(f"🔐 Checking admin access for {username}")
        
        # Check database for admin users
        if db:
            is_admin = await crud.is_admin_user(db, username)
            if is_admin:
                logger.info(f"✅ User {username} found in admin users database")
                return True
        
        # Fallback: Check initial admin from environment variable
        initial_admin = self.settings.admin_initial_username
        if initial_admin and username == initial_admin:
            logger.info(f"✅ User {username} matches initial admin from environment")
            return True
        
        logger.info(f"❌ User {username} is not an admin")
        return False


# Global OAuth instance
github_oauth = GitHubOAuth()