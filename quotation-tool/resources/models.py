from pydantic import BaseModel


class VerifyUserModel(BaseModel):
    code : str