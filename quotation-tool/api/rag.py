from datetime import datetime

from fastapi import APIRouter, UploadFile, File, Depends
from fastapi import HTTPException, Request
from starlette.responses import RedirectResponse, JSONResponse
from resources.database import db_client
from middleware.auth_middleware import verify_user

# Create the auth router
router = APIRouter(
    dependencies=[Depends(verify_user)]
)


def format_file(file, user_id, bucket_name):
    public_url = db_client.get_file(bucket_name, user_id, file['name'])['publicUrl']
    return {
        "name": file['name'],
        "type": "PDF" if file['name'].lower().endswith('.pdf') else "Excel",
        "uploadDate": datetime.strptime(file['created_at'], "%Y-%m-%dT%H:%M:%S.%fZ").strftime("%m/%d/%Y"),
        "size": file['metadata'].get('size', 0),
        "url": public_url,
        "path": f"{user_id}/{file['name']}"
    }

@router.post("/upload-excel")
async def upload_excel(request : Request, excel_files : list[UploadFile] = File(...)):
    """
    Initiate Google OAuth sign in
    """
    try:
        for file in excel_files:
            response = db_client.upload_file("excel-files", file, request.state.user_id)

        return JSONResponse(content={"message": "File uploaded successfully"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload-pdf")
async def upload_excel(request : Request, pdf_files : list[UploadFile] = File(...)):
    """
    Initiate Google OAuth sign in
    """
    try:
        for file in pdf_files:
            response = db_client.upload_file("pdf-files", file, request.state.user_id)

        return JSONResponse(content={"message": "File uploaded successfully"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/get-files")
async def get_files(request: Request):
    try:
        excel_files = db_client.get_files("excel-files", request.state.user_id)
        pdf_files = db_client.get_files("pdf-files", request.state.user_id)

        all_files = excel_files + pdf_files

        sorted_files = sorted(all_files, key=lambda x: x['created_at'])

        formatted_files = [format_file(file, request.state.user_id, "excel-files" if file['name'].lower().endswith('.xlsx') else "pdf-files") for file in sorted_files]

        return JSONResponse(content=formatted_files)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.delete("/delete-file")
async def delete_file(request: Request, file_name: str):
    try:
        if file_name.lower().endswith('.pdf'):
            db_client.delete_file("pdf-files", f"{request.state.user_id}/{file_name}")
        elif file_name.lower().endswith(('.xls', '.xlsx')):
            db_client.delete_file("excel-files", f"{request.state.user_id}/{file_name}")
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type")

        return JSONResponse(content={"message": "File deleted successfully"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/update-file")
async def update_file(request: Request, file: UploadFile):
    try:
        if file.filename.lower().endswith('.pdf'):
            db_client.update_file("pdf-files", file, request.state.user_id)
        elif file.filename.lower().endswith(('.xls', '.xlsx')):
            db_client.update_file("excel-files", file, request.state.user_id)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type")

        return JSONResponse(content={"message": "File updated successfully"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload-quotation")
async def upload_quotation(request: Request, quotations: list[UploadFile] = File(...)):
    try:
        uploaded_quotation = []
        for file in quotations:
            response = db_client.upload_file("excel-files", file, request.state.user_id)
            uploaded_quotation.append(response)


        return JSONResponse(content={"message": "Quotation uploaded successfully"})
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/update-price-list-files")
async def update_price_list_files(request: Request, price_list_files: list[UploadFile] = File(...)):
    try:
        uploaded_files = []
        for file in price_list_files:
            response = db_client.upload_file("excel-files", file, request.state.user_id)
            uploaded_files.append(response)

        return JSONResponse(content={"message": "Price list files uploaded successfully"})
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=str(e))

