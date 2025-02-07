from fastapi import Request, HTTPException
from resources.database import db_client

def verify_user(request : Request):
    try:
        auth_header = request.headers.get("Authorization")

        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing or invalid authorization token")

        token = auth_header.split(" ")[1]

        user_data = db_client.get_user(token)

        if not user_data or "error" in user_data:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

        request.state.user = user_data.user
        request.state.user_id = user_data.user.id
        return True
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))