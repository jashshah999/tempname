import base64
import hashlib
import json
import mimetypes
import os
import urllib.parse
from datetime import datetime

from fastapi import HTTPException, UploadFile
from supabase import create_client, Client, ClientOptions
from config import SUPABASE_URL, SUPABASE_KEY, SERVER_URL, FRONTEND_URL
from gotrue import SyncMemoryStorage
from fastapi import  Request



class FastAPISessionStorage(SyncMemoryStorage):
    def __init__(self):
        self.storage = {}

    def get_item(self, key: str) -> str | None:
        if key in self.storage:
            return self.storage[key]

    def set_item(self, key: str, value: str) -> None:
        self.storage[key] = value

    def remove_item(self, key: str) -> None:
        if key in self.storage:
            self.storage.pop(key, None)

class SupabaseConfig:
    """
    Class to handle Supabase connection and configuration
    """

    def __init__(self, supabase_url: str = None, supabase_key: str = None):
        """
        Initialize Supabase configuration
        Args:
            supabase_url (str): Supabase project URL
            supabase_key (str): Supabase project API key
        """
        # Load environment variables if not provided directly


        self.supabase_url = supabase_url or SUPABASE_URL
        self.supabase_key = supabase_key or SUPABASE_KEY

        if not self.supabase_url or not self.supabase_key:
            raise ValueError("Supabase URL and API key are required")

        self.client = self._initialize_client()

    def _initialize_client(self) -> Client:
        """
        Initialize Supabase client
        Returns:
            Client: Supabase client instance
        """
        try:
            return create_client(self.supabase_url, self.supabase_key, options=ClientOptions(
                storage=FastAPISessionStorage(),
                flow_type="pkce"
            ))
        except Exception as e:
            raise ConnectionError(f"Failed to initialize Supabase client: {str(e)}")

    def get_client(self) -> Client:
        """
        Get Supabase client instance
        Returns:
            Client: Supabase client instance
        """
        return self.client


class SupabaseOperations:
    """
    Class to handle Supabase database operations
    """

    def __init__(self, config: SupabaseConfig):
        """
        Initialize SupabaseOperations with configuration
        Args:
            config (SupabaseConfig): Instance of SupabaseConfig
        """
        self.client = config.get_client()

    @staticmethod
    def generate_code_verifier():
        code_verifier = base64.urlsafe_b64encode(os.urandom(32)).decode("utf-8")
        return code_verifier.rstrip("=")  # Remove padding

    @staticmethod
    def generate_code_challenge(code_verifier):
        digest = hashlib.sha256(code_verifier.encode("utf-8")).digest()
        code_challenge = base64.urlsafe_b64encode(digest).decode("utf-8")
        return code_challenge.rstrip("=")  # Remove padding


    def google_sign_in(self, from_chrom_ext):
        code_verifier = self.generate_code_verifier()
        self.client.auth._storage.set_item("code_verifier", code_verifier)
        if from_chrom_ext:
            redirect_url = f"{FRONTEND_URL}/auth/callback?from_chrome_ext={from_chrom_ext}"
        else:
            redirect_url = f"{FRONTEND_URL}/auth/callback"
        auth_url = self.client.auth.sign_in_with_oauth({
            'provider': 'google',
            'options': {
                'redirect_to': redirect_url,
                'code_challenge': self.generate_code_challenge(code_verifier),
                'code_challenge_method': 'S256'
            }
        })
        return auth_url

    def verify_user(self, code: str):
        auth_response = self.client.auth.exchange_code_for_session({"auth_code": code})

        if not auth_response:
            raise HTTPException(status_code=400, detail="Failed to exchange code for session")

        return auth_response

    def get_refresh_token(self, token):
        try:
            response = self.client.auth.get_refresh_token(token)
            return response
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    def get_user(self, access_token: str):
        try:
            response = self.client.auth.get_user(access_token)
            return response
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


    def upload_file(self, bucket_name:str, file: UploadFile, user_id):
        try:
            file_bytes = file.file.read()
            ext = os.path.splitext(file.filename)[1].lstrip('.').lower()
            mime_type, _ = mimetypes.guess_type(file.filename)
            if not mime_type:
                if ext == "xlsx":
                    mime_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                elif ext == "xls":
                    mime_type = "application/vnd.ms-excel"
                else:
                    mime_type = "application/octet-stream"
            response = self.client.storage.from_(bucket_name).upload(
                file=file_bytes,
                path=f"{user_id}/{file.filename}",
                file_options={"cache-control": "3600", "upsert": "false", "content-type": mime_type},
            )
            return response
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


    def get_files(self, bucket_name:str, user_id):
        try:
            response = self.client.storage.from_(bucket_name).list(user_id)
            return response
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


    def get_file(self, bucket_name:str, user_id, file_name):
        try:
            response = self.client.storage.from_(bucket_name).get_public_url(f"{user_id}/{file_name}")
            return response
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


    def delete_file(self, bucket_name:str, path):
        try:
            response = self.client.storage.from_(bucket_name).remove(path)
            return response
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


    def update_file(self, bucket_name:str, file: UploadFile, user_id):
        try:
            response = self.client.storage.from_(bucket_name).update(
                path=f"{user_id}/{file.filename}",
                file=file.read(),
                file_options={"cache-control": "3600", "upsert": "true"},
            )
            return response
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


    def save_quotation(self, user_id, file_paths: list[str]):
        try:
            data = [{"user_id": user_id, "quotation_file_path": path} for path in file_paths]
            response = self.client.table("quotations_uploads").insert(data)
            return response
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


    def save_price_list(self, user_id, file_paths: list[str]):
        try:
            data = [{"user_id": user_id, "path": path} for path in file_paths]
            response = self.client.table("price_list_path").insert(data)
            return response
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))






db_client = SupabaseOperations(SupabaseConfig())