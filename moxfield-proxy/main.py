from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from curl_cffi.requests import AsyncSession

app = FastAPI()
session = AsyncSession(impersonate="chrome120", max_clients=200)

HEADERS = {
    "accept-language": "en-US,en;q=0.9",
    "origin": "https://moxfield.com",
    "referer": "https://moxfield.com/",
    "x-moxfield-version": "2026.06.24.8",
}

class FetchRequest(BaseModel):
    url: str

class FetchResponse(BaseModel):
    status: int
    body: str

@app.post("/fetch")
async def fetch(req: FetchRequest) -> FetchResponse:
    try:
        response = await session.get(req.url, headers=HEADERS, timeout=30)
        return FetchResponse(status=response.status_code, body=response.text)
    except Exception as e:
        return FetchResponse(status=500, body=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8081)
