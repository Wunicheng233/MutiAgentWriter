
#!/usr/bin/env python3
from backend.auth import decode_token
from core.config import settings

# The token from the screenshot
token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImlhdCI6MTc0NTQyNjQwMCwiZXhwIjoxNzQ1NTEyODAwfQ.zrwGsz6aYokEPZkB4XAKrKkSOy1hCA17AxpArriJH3w"

print(f"Token: {token[:60]}...")
print(f"SECRET_KEY length: {len(settings.jwt_secret_key)}, first 10 chars: {settings.jwt_secret_key[:10]}...")
print()

payload = decode_token(token)
if payload is None:
    print("decode_token returned None → JWT verification FAILED")
    print("This means signature is invalid because secret key doesn't match what was used to sign")
else:
    print(f"decode_token SUCCESS! Payload: {payload}")
