import os
from fastapi import APIRouter, Depends
from fastapi import HTTPException, Request
from pydantic import BaseModel
from starlette.responses import JSONResponse

from middleware.auth_middleware import verify_user
from resources.custom_openai import GPTProcessor
from constants.prompts import GENERATE_QUOTATION

# Create the auth router
router = APIRouter(
    dependencies=[Depends(verify_user)]
)

class GenerateQuotationInput(BaseModel):
    email_content: str

@router.post("/generate-quotation")
async def generate_quotation(request : Request, data: GenerateQuotationInput):
    """
    Generate quotation
    """
    try:
        gpt_processor = GPTProcessor(api_key=os.getenv("OPENAI_API_KEY"), model="gpt-4o-mini")

        user_prompt = f"""
            Extract information from given email:
            {data.email_content}
        """

        gpt_response = gpt_processor.process_text(input_text=user_prompt, prompt=GENERATE_QUOTATION)

        return JSONResponse(status_code=200, content={"quotation": gpt_response})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))