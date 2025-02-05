import json

from fastapi import APIRouter
from fastapi import HTTPException
from fastapi import Request
from starlette.responses import RedirectResponse, JSONResponse
from resources.database import db_client
from resources.models import VerifyUserModel

# Create the auth router
router = APIRouter()

@router.get("/google")
async def google_sign_in():
    """
    Initiate Google OAuth sign in
    """
    try:
        # Get the Google OAuth URL from Supabase
        auth_url = db_client.google_sign_in()
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
        return JSONResponse(content={ "access_token": access_token, "refresh_token": refresh_token})
    except Exception as e:
        print("Error in Verify User : ", e)
        raise HTTPException(status_code=500, detail=str(e))


# @router.get("/verify-user")
# async def get_user(request: Request):
#     """
#     Get current user details
#     """
#     try:
#         # Get token from header
#         auth_header = request.headers.get("Authorization")
#         if not auth_header or not auth_header.startswith("Bearer "):
#             raise HTTPException(status_code=401, detail="Missing or invalid token")
#
#         token = auth_header.split(" ")[1]
#
#         user = db_client.get_user_by_token(token)
#
#         return {
#             "id": user.id,
#             "email": user.email,
#             "user_metadata": user.user_metadata
#         }
#
#     except Exception as e:
#         raise HTTPException(status_code=401, detail=str(e))
