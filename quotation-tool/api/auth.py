import json

from fastapi import APIRouter
from fastapi import HTTPException
from starlette.responses import RedirectResponse, JSONResponse
from resources.database import db_client
from resources.models import VerifyUserModel

# Create the auth router
router = APIRouter()

@router.get("/google")
async def google_sign_in(from_chrome_ext:bool=False):
    """
    Initiate Google OAuth sign in
    """
    try:
        auth_url = db_client.google_sign_in(from_chrome_ext)
        return RedirectResponse(url=auth_url.url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))




@router.post("/verify-user")
async def verify_user(data : VerifyUserModel):
    """
    Handle Google OAuth callback
    """
    try:
        # Exchange the code for a session
        auth_response = db_client.verify_user(data.code)

        # Get user data
        session = auth_response.session
        access_token = session.access_token
        refresh_token = session.refresh_token
        response_session = json.loads(session.model_dump_json())
        return JSONResponse(content={ "access_token": access_token, "refresh_token": refresh_token, "session" : response_session})
    except Exception as e:
        print("Error in Verify User : ", e)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/get-refresh-token")
async def get_refresh_token():
    """
    Get refresh token
    """
    try:
        refresh_token = db_client.get_refresh_token()
        session = refresh_token.session
        access_token = session.access_token
        refresh_token = session.refresh_token
        response_session = json.loads(session.model_dump_json())
        return JSONResponse(content={ "access_token": access_token, "refresh_token": refresh_token, "session" : response_session})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))